"""
Add DEEPER district-level ACCOUNTABILITY metrics to the atlas (session S1).

The category currently surfaces a single metric, ``pct_targets_met`` (from
``scripts/fetch_accountability.py`` → ``cumulative_prgrss_pct``). This script
fills out the category with three more relatable, district-level measures, all
live-validated against the source before shipping:

  accountability_percentile         <- ROLLED UP from data/ma_school_metrics.json
                                       (DESE publishes the 1-99 percentile to
                                       SCHOOLS only; the District rows of
                                       ``ppbc-i8t9`` carry an empty ``accntblty_pctle``
                                       for 0/396 districts — see fetch_accountability.py).
                                       We roll the per-school ``sch_accountability_pctile``
                                       up to the district as an ENROLLMENT-WEIGHTED MEAN,
                                       keyed by the school id's 4-digit district prefix.
                                       Format "num", range 1-99 (NOT a fraction).

  pct_schools_needing_support       <- DERIVED from ppbc-i8t9 SCHOOL rows: the share of
                                       a district's schools classified
                                       "Requiring assistance or intervention"
                                       (DESE's comprehensive/targeted-support bucket),
                                       out of the schools that received a DETERMINATE
                                       classification (i.e. excluding "Insufficient data").
                                       Format "pct" (0-1). A genuine 0.0 (no flagged
                                       schools) is KEPT — most MA districts truly have
                                       zero flagged schools, and that is the headline
                                       fact, not a suppression artifact (cf. el_proficiency
                                       Benign #10 in scripts/analysis/data_anomalies.md).
                                       Stored null ONLY when a district has no determinate
                                       school at all (all schools "Insufficient data").

  curr_year_tgt_pct                 <- DESE district ``curr_year_tgt_pct``: the CURRENT-year
                                       criterion-referenced "% of accountability targets met"
                                       (the most recent single-year signal feeding the
                                       cumulative blend behind ``pct_targets_met``).
                                       Distinct column from ``cumulative_prgrss_pct`` /
                                       ``pct_targets_met`` — not a duplicate. Format "pct" (0-1).

Source: MA DESE Education-to-Career hub (Socrata), domain
``educationtocareer.data.mass.gov``, dataset ``ppbc-i8t9`` (School/District
Accountability Classifications), school year SY2025 — the same base dataset and
year as ``pct_targets_met``. Per-school percentile fallback comes from the
in-repo ``data/ma_school_metrics.json`` (field ``sch_accountability_pctile``,
weighted by ``sch_enrollment``).

Output: ``data/ma_district_accountability_detail.json`` :: { DIST_CODE: {col: value} },
filtered to the DIST_CODEs in ``data/ma_academic_districts.geojson`` (drops the
``00000000`` state row and any out-of-universe school's district). Districts that
get nothing are dropped. A 0 is NEVER stored for a suppressed/missing value.

Run from repo root::  python scripts/fetch_accountability_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path
from collections import defaultdict

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
SCHOOLS = REPO / "data" / "ma_school_metrics.json"
OUT = REPO / "data" / "ma_district_accountability_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "ppbc-i8t9"
SY = "2025"
SUPPORT_CLASS = "Requiring assistance or intervention"
INSUFFICIENT = "Insufficient data"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0-1 fraction; None for missing. curr_year_tgt_pct arrives as
    0.34 already — guard against a stray percent (e.g. 34) just in case."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # ── (1) accountability_percentile — enrollment-weighted roll-up of the per-school
    #        1-99 percentile (DESE assigns the percentile to schools, not districts).
    sch = json.loads(SCHOOLS.read_text())
    wsum: dict[str, float] = defaultdict(float)  # sum(pctile * weight)
    weight: dict[str, float] = defaultdict(float)
    for schid, m in sch.items():
        p = m.get("sch_accountability_pctile")
        if p is None:
            continue
        try:
            p = float(p)
        except (TypeError, ValueError):
            continue
        dc = norm(schid)[:4] + "0000"          # school id's district prefix → DIST_CODE
        if dc not in out:
            continue                            # charter/collaborative outside atlas universe
        e = m.get("sch_enrollment")
        w = e if isinstance(e, (int, float)) and e > 0 else 1
        wsum[dc] += p * w
        weight[dc] += w
    p_hits = 0
    for dc, w in weight.items():
        if w > 0:
            out[dc]["accountability_percentile"] = round(wsum[dc] / w, 1); p_hits += 1

    # ── (2) curr_year_tgt_pct — DESE district current-year % of targets met (0-1).
    drows = soda(DATASET, {
        "$where": f"org_type='District' AND sy='{SY}' AND curr_year_tgt_pct IS NOT NULL",
        "$select": "dist_code,curr_year_tgt_pct",
        "$limit": "2000",
    })
    c_hits = 0
    for r in drows:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("curr_year_tgt_pct"))) is not None:
            out[dc]["curr_year_tgt_pct"] = round(v, 4); c_hits += 1

    # ── (3) pct_schools_needing_support — share of a district's schools in the
    #        support/intervention bucket, among schools with a DETERMINATE class.
    srows = soda(DATASET, {
        "$where": f"org_type='School' AND sy='{SY}' AND classification_overall IS NOT NULL",
        "$select": "dist_code,classification_overall",
        "$limit": "5000",
    })
    need: dict[str, int] = defaultdict(int)
    denom: dict[str, int] = defaultdict(int)
    for r in srows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        c = r.get("classification_overall")
        if not c or c == INSUFFICIENT:
            continue                            # not a determinate classification
        denom[dc] += 1
        if c == SUPPORT_CLASS:
            need[dc] += 1
    s_hits = s_zero = 0
    for dc, d in denom.items():
        if d <= 0:
            continue                            # store null (drop), never 0/0
        frac = need[dc] / d
        out[dc]["pct_schools_needing_support"] = round(frac, 4); s_hits += 1
        if frac == 0:
            s_zero += 1

    # Drop districts that got nothing; keep the file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))

    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  accountability_percentile:     {p_hits}/{len(ours)} (1-99 num; enrollment-weighted school roll-up)")
    print(f"  curr_year_tgt_pct:             {c_hits}/{len(ours)} (SY{SY}, fraction 0-1)")
    print(f"  pct_schools_needing_support:   {s_hits}/{len(ours)} (fraction 0-1; "
          f"{s_zero} legit 0.0, denom=determinate schools)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
