"""
Add NEW Advanced Placement *intensity / breadth* metrics to the atlas by pulling
district-level AP data from MA DESE's open data (Education-to-Career hub,
Socrata) and writing a join file keyed by DIST_CODE:

  ap_exams_per_taker        <- AP Participation [37cp-pad8]
                               tests_taken_cnt / test_takers_cnt
  ap_subjects_offered       <- AP Participation [37cp-pad8]
                               # of distinct AP subjects with >=1 exam taken
  ap_pct_score_3plus_exams  <- AP Performance   [787a-3wen]  pct_3_5
  ap_tests_per_100          <- AP Participation [37cp-pad8] tests_taken_cnt
                               / district TOTAL_CNT enrollment * 100

These are DISTINCT from the atlas's two existing AP metrics:

  * ap_pct_3plus (existing) -- % of AP TEST TAKERS (students) scoring 3+ on at
    least one exam (student-level success rate).
  * ap_participation_pct (existing) -- % of Jr/Sr enrolled in >=1 AP/IB course.

The NEW metrics measure exam *volume / intensity / breadth*, not the share of
students who participate or succeed:

  * ap_exams_per_taker -- average number of AP exams each AP student sat
    (exam intensity). Raw ratio (counts), typically ~1.5-2.5. From the AP
    Participation dataset's test_takers_cnt / tests_taken_cnt, latest SY2025.
  * ap_subjects_offered -- count of distinct AP subjects in which the district's
    students took at least one exam (curriculum breadth). Built by counting
    distinct subj rows (excluding the dataset's rollup labels) with
    tests_taken_cnt > 0, latest SY2025.
  * ap_pct_score_3plus_exams -- % of AP EXAMS (not students) scoring 3+. This is
    exam-weighted and distinct from the student-level ap_pct_3plus above. From
    the AP Performance dataset's published pct_3_5, latest SY2025.
  * ap_tests_per_100 -- AP exams sat per 100 enrolled students. tests_taken_cnt
    over the district's total enrollment (TOTAL_CNT from the atlas geojson) x100.
    NOTE: denominator is total K-12 enrollment, not just grades 11-12, so this
    is a coarse intensity measure that runs lower for K-12 districts than a
    pure HS denominator would; kept because TOTAL_CNT is the enrollment the
    atlas already uses and no clean per-district HS-only count is published with
    these AP tables.

Output: ``data/ma_district_ap_detail.json`` :: { DIST_CODE: {col: value, ...} }
Counts/ratios are raw numbers (format "num"); ap_pct_score_3plus_exams is a
0-1 fraction (format "pct") to match the atlas's other *_pct columns.

Run from repo root::  python scripts/fetch_ap_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_ap_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# Rollup / category labels in the AP datasets' `subj` column that are NOT a
# single AP subject and must be excluded when counting distinct subjects.
ROLLUPS = {
    "All Subjects", "English Language Arts", "History and Social Science",
    "Foreign Languages", "Arts", "Math and Computer Science",
    "Science and Technology", "Capstone",
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_num(v):
    """Parse a raw count / ratio (NOT a percent). Returns float or None."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    return f if f >= 0 else None


def to_frac(v):
    """Normalize a percentage to a 0-1 fraction. pct_3_5 arrives as 0.648
    already; divide only if it came through as a >1 percent."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def main() -> int:
    geo = json.loads(DISTS.read_text())["features"]
    ours = {f["properties"]["DIST_CODE"] for f in geo}
    enroll = {f["properties"]["DIST_CODE"]: to_num(f["properties"].get("TOTAL_CNT"))
              for f in geo}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) AP Participation [37cp-pad8] -- pull every district subject row for the
    #    latest year. The "All Subjects" row gives test_takers_cnt /
    #    tests_taken_cnt (intensity + per-100); the individual subject rows give
    #    breadth.
    part = soda("37cp-pad8", {
        "$where": "org_type='District' AND stu_grp='All Students' AND sy='2025'",
        "$select": "dist_code,subj,test_takers_cnt,tests_taken_cnt",
        "$limit": "20000",
    })
    subj_counts: dict[str, set] = {dc: set() for dc in ours}
    intensity_hits = per100_hits = 0
    for r in part:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        subj = r.get("subj")
        takers = to_num(r.get("test_takers_cnt"))
        tests = to_num(r.get("tests_taken_cnt"))
        if subj == "All Subjects":
            # exam intensity
            if takers and takers > 0 and tests is not None:
                out[dc]["ap_exams_per_taker"] = round(tests / takers, 3)
                intensity_hits += 1
            # exams per 100 enrolled students (TOTAL_CNT denominator)
            denom = enroll.get(dc)
            if tests is not None and denom and denom > 0:
                out[dc]["ap_tests_per_100"] = round(tests / denom * 100.0, 2)
                per100_hits += 1
        elif subj not in ROLLUPS and tests and tests > 0:
            subj_counts[dc].add(subj)

    breadth_hits = 0
    for dc, subjs in subj_counts.items():
        if subjs:
            out[dc]["ap_subjects_offered"] = len(subjs)
            breadth_hits += 1

    # 2) AP Performance [787a-3wen] -- % of EXAMS scoring 3+ (exam-weighted),
    #    distinct from the student-level ap_pct_3plus already in the atlas.
    perf = soda("787a-3wen", {
        "$where": "org_type='District' AND subj='All Subjects' "
                  "AND stu_grp='All Students' AND sy='2025'",
        "$select": "dist_code,pct_3_5",
        "$limit": "2000",
    })
    pct_hits = 0
    for r in perf:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("pct_3_5"))) is not None:
            out[dc]["ap_pct_score_3plus_exams"] = round(v, 4)
            pct_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  ap_exams_per_taker:        {intensity_hits}/274 (SY2025, num)")
    print(f"  ap_subjects_offered:       {breadth_hits}/274 (SY2025, num)")
    print(f"  ap_tests_per_100:          {per100_hits}/274 (SY2025, num)")
    print(f"  ap_pct_score_3plus_exams:  {pct_hits}/274 (SY2025, pct)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
