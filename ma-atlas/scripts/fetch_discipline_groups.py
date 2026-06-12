"""
Add a discipline-EQUITY lens to the atlas: the out-of-school suspension (OSS)
rate broken out by student SUBGROUP, so disparities are visible alongside the
existing All-Students discipline rates. Pulls from MA DESE open data
(Education-to-Career hub, Socrata) and writes a join file keyed by DIST_CODE:

  oss_low_income  <- Student Discipline [2kca-w7rq] out_susp_pct, stu_grp='Low Income'
  oss_swd         <- Student Discipline [2kca-w7rq] out_susp_pct, stu_grp='Students with Disabilities'
  oss_ell         <- Student Discipline [2kca-w7rq] out_susp_pct, stu_grp='English Learners'
  oss_black       <- Student Discipline [2kca-w7rq] out_susp_pct, stu_grp='Black or African American'
  oss_hispanic    <- Student Discipline [2kca-w7rq] out_susp_pct, stu_grp='Hispanic or Latino'

These are the SAME dataset and SAME out_susp_pct column that
scripts/fetch_discipline.py uses for All Students, just sliced by the dataset's
`stu_grp` dimension. out_susp_pct is already a fraction (0-1).

The exact stu_grp labels were verified against the live dataset's distinct
values (?$select=stu_grp&$group=stu_grp). Note DESE publishes "Low Income"
(NOT "Economically Disadvantaged", which has 0 rows in SY2025).

Subgroup cells are heavily suppressed for small N (a district with too few
students in a group reports no value), so coverage is honestly LOWER than the
274-district set — especially for English Learners and Black/African American.
We drop missing cells; we never fabricate.

Slice: org_type='District', offense='All Offenses', latest published school
year (SY2025) — matching scripts/fetch_discipline.py — one query per subgroup.

Output: ``data/ma_district_discipline_groups.json`` :: { DIST_CODE: {col: val} }
Values are fractions (0-1) rounded to 4 decimals.

Run from repo root::  python scripts/fetch_discipline_groups.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_discipline_groups.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest published school year in [2kca-w7rq]

# Output column -> exact DESE stu_grp label (verified against live distinct values).
GROUPS = {
    "oss_low_income": "Low Income",
    "oss_swd": "Students with Disabilities",
    "oss_ell": "English Learners",
    "oss_black": "Black or African American",
    "oss_hispanic": "Hispanic or Latino",
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. Discipline *_pct columns come as
    fractions (0.023) already; detect and divide only if it looks like a percent."""
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

    # OSS rate per subgroup — Student Discipline [2kca-w7rq], latest SY, All
    # Offenses, district level, one query per student group. out_susp_pct is a
    # published fraction of that subgroup's enrollment (0-1).
    hits = {col: 0 for col in GROUPS}
    for col, grp in GROUPS.items():
        rows = soda("2kca-w7rq", {
            "$where": f"org_type='District' AND stu_grp='{grp}' "
                      f"AND offense='All Offenses' AND sy='{SY}'",
            "$select": "dist_code,out_susp_pct",
            "$limit": "2000",
        })
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            oss = to_frac(r.get("out_susp_pct"))
            if oss is not None:
                out[dc][col] = round(oss, 4); hits[col] += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, grp in GROUPS.items():
        print(f"  {col:16s} {hits[col]:>4}/274  stu_grp='{grp}'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
