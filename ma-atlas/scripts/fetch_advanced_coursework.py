"""
Add an *advanced coursework* metric category to the atlas by pulling
district-level participation / completion rates from MA DESE's open data
(Education-to-Career hub, Socrata) and writing a join file keyed by DIST_CODE:

  adv_course_completion_pct  <- Advanced Course Completion [ujwr-ux9i]  adv_comp_pct
  ap_participation_pct       <- DART: Success After HS     [adqe-6sht]  indicator
                                "Jr/Sr enrolled in one or more AP / IB courses"

These are DISTINCT from the atlas's existing ``ap_pct_3plus`` (% of AP test
takers scoring 3+). They measure *course-taking / completion*, not exam scores:

  * adv_course_completion_pct -- share of 11th/12th graders who complete at
    least one advanced course (AP, IB, dual-enrollment, or other advanced),
    published directly at the district level (org_type='District',
    stu_grp='All Students'), latest year SY2025.
  * ap_participation_pct -- share of juniors/seniors enrolled in one or more
    AP/IB courses. DART publishes this per high school only, so we aggregate
    to the district as sum(stu_cnt)/sum(stu_incl) (enrollment-weighted),
    latest year SY2024.

We deliberately DROP a dual-enrollment / early-college column: DESE's Early
College Participation [p2yd-4gvj] publishes only raw participant counts (per
partner college, with no grade 9-12 denominator and possible cross-college
double counting), so a clean 0-1 rate cannot be derived without fabricating
one. Kept honest: only published, computable rates ship.

Output: ``data/ma_district_advanced.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0-1) to match the atlas's other *_pct columns.

Run from repo root::  python scripts/fetch_advanced_coursework.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_advanced.json"
DOMAIN = "educationtocareer.data.mass.gov"
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
    """Normalize a value to a 0-1 fraction. adv_comp_pct comes as 0.811 already;
    DART aggregates we build ourselves as a ratio. Detect percent-form and
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


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Advanced course completion -- % of g11/g12 completing >=1 advanced
    #    course. Published directly at district level, latest year SY2025.
    adv = soda("ujwr-ux9i", {
        "$where": "org_type='District' AND stu_grp='All Students' AND sy='2025'",
        "$select": "dist_code,adv_comp_pct",
        "$limit": "2000",
    })
    c_hits = 0
    for r in adv:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("adv_comp_pct"))) is not None:
            out[dc]["adv_course_completion_pct"] = round(v, 4); c_hits += 1

    # 2) AP/IB participation -- % of Jr/Sr enrolled in >=1 AP/IB course.
    #    DART reports this per high school; aggregate to district as an
    #    enrollment-weighted rate = sum(stu_cnt) / sum(stu_incl). Latest SY2024.
    ap = soda("adqe-6sht", {
        "$where": "indicator='Jr/Sr enrolled in one or more AP / IB courses' "
                  "AND stu_grp='All Students' AND sy='2024' AND value IS NOT NULL",
        "$select": "dist_code,sum(stu_incl) as denom,sum(stu_cnt) as numer",
        "$group": "dist_code",
        "$limit": "2000",
    })
    a_hits = 0
    for r in ap:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        try:
            denom = float(r.get("denom") or 0)
            numer = float(r.get("numer") or 0)
        except ValueError:
            continue
        if denom > 0:
            out[dc]["ap_participation_pct"] = round(numer / denom, 4); a_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  adv_course_completion_pct: {c_hits} (SY2025)")
    print(f"  ap_participation_pct:      {a_hits} (SY2024, district-aggregated)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
