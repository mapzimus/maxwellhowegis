"""
Add an *early education access* metric category to the atlas by pulling
district-level pre-K / kindergarten enrollment from MA DESE's open data
(Education-to-Career hub, Socrata) and writing a join file keyed by DIST_CODE:

  full_day_k_pct      <- Pre-K & Kindergarten Enrollment [rg9w-dkpg]
                         kgr_subgroup_ful_pct  (full-day K as share of all K)
  prek_per_k_ratio    <- Pre-K & Kindergarten Enrollment [rg9w-dkpg]
                         pkg_pkenr_tot / kgr_subgroup_cnt  (PK enrollment relative
                         to the kindergarten cohort)
  prek_enrollment     <- pkg_pkenr_tot       (absolute Pre-K headcount)
  kindergarten_enrollment <- kgr_subgroup_cnt (absolute Kindergarten headcount)
  prek_low_income_pct <- pk_subgroup_cnt(Low Income) / pkg_pkenr_tot
                         (share of a district's Pre-K enrollment that is low-income)

Both come from the same dataset, same year (latest, SY2026), same population
(org_type='District', stu_grp='All Students').

Why these two, and the denominator choices:

  * full_day_k_pct -- DESE publishes a full-day kindergarten share directly as
    ``kgr_subgroup_ful_pct``. "Full-day" K (``kgr_subgroup_ful_cnt`` = total K
    minus part-time K, i.e. full-time + tuition-charged full-day seats) divided
    by total K (``kgr_subgroup_cnt``). This is the headline early-access metric:
    what fraction of a district's kindergartners attend full-day (vs half-day)
    programs. We re-derive it from the counts when both are present and fall
    back to the published pct otherwise; the two agree.

  * prek_per_k_ratio -- there is NO clean per-capita PK rate at the district
    level: DESE does not publish a count of age-eligible 3-4 year-olds living in
    a district, and many PK seats are tuition/grant funded rather than tied to
    resident counts, so PK-enrollment / resident-preschoolers cannot be built
    here without fabricating a denominator. The most defensible, fully-derivable
    denominator already in this dataset is the district's kindergarten cohort
    (``kgr_subgroup_cnt``). PK / K expresses how many pre-K seats a district
    offers relative to its incoming kindergarten class -- a within-district
    proxy for pre-K access/capacity. It is NOT a coverage rate of all eligible
    children and is reported as a ratio (can exceed 1.0 where a district runs a
    large PK program), so it ships as format "num", not "pct". Districts with no
    PK program (no ``pkg_pkenr_tot``) are dropped for this column rather than
    coerced to 0, since absence here means "not reported," not "zero seats."

We ALSO surface absolute Pre-K and Kindergarten headcounts (``prek_enrollment``,
``kindergarten_enrollment``). A raw headcount is not ideal as a choropleth — it
largely tracks district size — but it answers the plain question "how many kids
are in the program here," it mirrors the atlas's existing raw Total Enrollment
metric, and it is genuinely useful in the feature panel. The PK/K *ratio* remains
the size-normalized access signal. ``prek_low_income_pct`` adds an equity lens —
what share of a district's Pre-K cohort is low-income — a composition RATE that
IS comparable across districts (suppressed for small N, so coverage is lower).

Output: ``data/ma_district_early_ed.json`` :: { DIST_CODE: {col: value, ...} }
full_day_k_pct is a 0-1 fraction (matches the atlas's other *_pct columns);
prek_per_k_ratio is a plain ratio.

Run from repo root::  python scripts/fetch_early_ed.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_early_ed.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes can drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. kgr_subgroup_ful_pct comes as 0.963
    already; rates we build ourselves are already 0-1. Detect percent-form and
    divide as needed."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_num(v):
    """Parse a plain numeric count; return None on missing/blank/bad."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    SY = "2026"  # latest published year in rg9w-dkpg

    # Pre-K & Kindergarten Enrollment -- District level, All Students, latest.
    rows = soda("rg9w-dkpg", {
        "$where": f"org_type='District' AND stu_grp='All Students' AND sy='{SY}'",
        "$select": "dist_code,kgr_subgroup_cnt,kgr_subgroup_ful_cnt,"
                   "kgr_subgroup_ful_pct,pkg_pkenr_tot",
        "$limit": "2000",
    })

    fdk_hits = 0   # full_day_k_pct
    pk_hits = 0    # prek_per_k_ratio
    pkc_hits = 0   # prek_enrollment (count)
    kc_hits = 0    # kindergarten_enrollment (count)
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue

        k_tot = to_num(r.get("kgr_subgroup_cnt"))
        k_ful = to_num(r.get("kgr_subgroup_ful_cnt"))
        pk_tot = to_num(r.get("pkg_pkenr_tot"))

        # full_day_k_pct: re-derive from counts when both present (and agree),
        # else fall back to the published share.
        fdk = None
        if k_ful is not None and k_tot and k_tot > 0:
            fdk = k_ful / k_tot
        else:
            fdk = to_frac(r.get("kgr_subgroup_ful_pct"))
        if fdk is not None and 0.0 <= fdk <= 1.0:
            out[dc]["full_day_k_pct"] = round(fdk, 4); fdk_hits += 1

        # prek_per_k_ratio: PK enrollment relative to the kindergarten cohort.
        # Require a real PK program AND a K denominator; drop otherwise.
        if pk_tot is not None and pk_tot > 0 and k_tot and k_tot > 0:
            out[dc]["prek_per_k_ratio"] = round(pk_tot / k_tot, 4); pk_hits += 1

        # Absolute headcounts (see module docstring): weak as a choropleth (track
        # district size) but intuitive and useful in the feature panel.
        if pk_tot is not None and pk_tot > 0:
            out[dc]["prek_enrollment"] = int(round(pk_tot)); pkc_hits += 1
        if k_tot is not None and k_tot > 0:
            out[dc]["kindergarten_enrollment"] = int(round(k_tot)); kc_hits += 1

    # prek_low_income_pct: low-income share of the Pre-K cohort. Second query for
    # the Low Income subgroup; pk_subgroup_cnt is that subgroup's PK headcount.
    # Divide by the All-Students PK total already stored as prek_enrollment.
    # A composition RATE (comparable across districts); suppressed for small N.
    li = soda("rg9w-dkpg", {
        "$where": f"org_type='District' AND stu_grp='Low Income' AND sy='{SY}'",
        "$select": "dist_code,pk_subgroup_cnt", "$limit": "2000",
    })
    li_hits = 0
    for r in li:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        pk_li = to_num(r.get("pk_subgroup_cnt"))
        pk_all = out[dc].get("prek_enrollment")
        if pk_li is not None and pk_li >= 0 and pk_all and pk_all > 0 and pk_li <= pk_all:
            out[dc]["prek_low_income_pct"] = round(pk_li / pk_all, 4); li_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  full_day_k_pct:          {fdk_hits} (SY{SY})")
    print(f"  prek_per_k_ratio:        {pk_hits} (SY{SY}, PK enrollment / K cohort)")
    print(f"  prek_enrollment:         {pkc_hits} (SY{SY}, raw PK headcount)")
    print(f"  kindergarten_enrollment: {kc_hits} (SY{SY}, raw K headcount)")
    print(f"  prek_low_income_pct:     {li_hits} (SY{SY}, low-income share of PK)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
