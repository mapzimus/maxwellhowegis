"""
Pull MA DESE **College and Career Outcomes of High School Graduates** into a
district-keyed join file. These are the ACTUAL post-graduation outcomes of a HS
graduating cohort (where they ended up), DISTINCT from:
  * the self-reported *plans* metrics already in the atlas (pct_any_college,
    pct_work_after_hs, pct_military — what seniors SAY they'll do), and
  * the NSC college-enrollment/persistence outcomes already in the atlas
    (college_enroll_pct, college_persist_pct, college_completion_pct).
This dataset adds the two outcomes the atlas was MISSING: EMPLOYED and the
DISCONNECTED ("Total Missing": not enrolled, not employed) shares.

SOURCE: College and Career Outcomes of HS Graduates [vj54-j4q3]
  (Education-to-Career hub, Socrata; domain educationtocareer.data.mass.gov)
  cols: district_code, hs_grad_year, outcome_year, outcome_type, grad_count,
        outcome_count.
  It is longitudinal: each HS grad cohort (`hs_grad_year`) is observed in every
  later `outcome_year`. `grad_count` is the cohort size (constant per district x
  grad_year); `outcome_count` is the # of grads in that `outcome_type` bucket in
  that observation year.

  The seven outcome_type values are MUTUALLY EXCLUSIVE & EXHAUSTIVE — for any
  (district, grad_year, outcome_year) they partition the cohort:
     In-State Private + In-State Public 2-Year + In-State Public 4-Year +
     Out-of-State   = "Total Postsecondary Enrollment"   (college, 4 sectors)
     "Total Employed"                                     (working, not enrolled)
     "Total Missing"                                      (neither — disconnected)
  and  Total Postsecondary Enrollment + Total Employed + Total Missing
       == grad_count   (verified exact, e.g. Boston grad2019 -> 2111+382+1079
       == 3516 grads). So each share is a clean fraction of all grads.

SNAPSHOT CHOSEN: grad cohort SY2020 observed ONE YEAR after graduation
  (outcome_year 2021) — the most recent HS cohort for which a full "+1 year"
  follow-up exists (grad 2021 only has a same-year 2021 observation). A fixed
  grad_year+1 window keeps every district comparable.

DERIVED COLUMNS (% of all HS grads, 0-1 fractions):
  grad_pct_employed     <- "Total Employed" / grad_count.  Employed (and not
                           enrolled in college) ~1 year after HS graduation.
  grad_pct_disconnected <- "Total Missing"  / grad_count.  Neither enrolled nor
                           employed ~1 year out (DESE's "missing" bucket) — a
                           lower-is-better, "disconnected youth" indicator.

  The college-enrollment outcomes (Total Postsecondary Enrollment and the four
  sector splits) are DELIBERATELY NOT shipped here: the atlas already has NSC
  immediate-enrollment + sector metrics (college_enroll_pct / _4yr / _2yr).
  No "military" outcome_type exists in this dataset (only Employed / Missing /
  the enrollment sectors), so no military outcome is added.

UNIVERSE / SUPPRESSION:
  * Restricted to DIST_CODEs in data/ma_academic_districts.geojson; the
    00000000 'State' row is filtered out. HS-only universe.
  * A share is written only when grad_count > 0; otherwise null (never 0). If a
    district has no row for the chosen window it is simply absent (no-data).

Output: data/ma_district_grad_outcomes.json :: { DIST_CODE: {col: value, ...} }
Run from repo root::  python scripts/fetch_grad_outcomes.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_grad_outcomes.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

GRAD_YEAR = "2020"     # HS graduating cohort
OUTCOME_YEAR = "2021"  # observed one year after graduation (grad_year + 1)


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char DIST_CODE."""
    return str(code).zfill(8)


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    rows = soda("vj54-j4q3", {
        "$where": f"hs_grad_year='{GRAD_YEAR}' AND outcome_year='{OUTCOME_YEAR}' "
                  "AND district_code!='00000000' "
                  "AND outcome_type in('Total Employed','Total Missing')",
        "$select": "district_code,outcome_type,grad_count,outcome_count",
        "$limit": "5000",
    })

    # Collect grad_count + the two buckets per district.
    grp: dict[str, dict] = {}
    for r in rows:
        dc = norm(r.get("district_code"))
        if dc not in out:
            continue
        g = grp.setdefault(dc, {})
        gc = num(r.get("grad_count"))
        if gc is not None:
            g["grad"] = gc
        oc = num(r.get("outcome_count"))
        if r.get("outcome_type") == "Total Employed":
            g["emp"] = oc
        elif r.get("outcome_type") == "Total Missing":
            g["miss"] = oc

    n_emp = n_dis = 0
    for dc, g in grp.items():
        grad = g.get("grad")
        if not grad or grad <= 0:
            continue
        emp, miss = g.get("emp"), g.get("miss")
        if emp is not None:
            out[dc]["grad_pct_employed"] = round(emp / grad, 4)
            n_emp += 1
        if miss is not None:
            out[dc]["grad_pct_disconnected"] = round(miss / grad, 4)
            n_dis += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  grad_pct_employed:     {n_emp} (grad {GRAD_YEAR}, +1yr {OUTCOME_YEAR})")
    print(f"  grad_pct_disconnected: {n_dis} (grad {GRAD_YEAR}, +1yr {OUTCOME_YEAR})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
