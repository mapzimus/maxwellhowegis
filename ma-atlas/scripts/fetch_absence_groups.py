"""
Add an absenteeism-EQUITY lens to the atlas: the chronic-absenteeism rate broken
out by student SUBGROUP, so disparities are visible alongside the existing
All-Students chronic_absent_pct. Pulls from MA DESE open data (Education-to-Career
hub, Socrata) and writes a join file keyed by DIST_CODE:

  chronic_low_income  <- Student Attendance [ak6h-9k7x] pct_chron_abs_10, stu_grp='Low Income'
  chronic_swd         <- Student Attendance [ak6h-9k7x] pct_chron_abs_10, stu_grp='Students with Disabilities'
  chronic_ell         <- Student Attendance [ak6h-9k7x] pct_chron_abs_10, stu_grp='English Learners'
  chronic_black       <- Student Attendance [ak6h-9k7x] pct_chron_abs_10, stu_grp='Black or African American'
  chronic_hispanic    <- Student Attendance [ak6h-9k7x] pct_chron_abs_10, stu_grp='Hispanic or Latino'

These are the SAME dataset and SAME pct_chron_abs_10 column that
scripts/fetch_attendance_teacher.py uses for All Students, just sliced by the
dataset's `stu_grp` dimension. pct_chron_abs_10 is already a fraction (0-1).

The exact stu_grp labels were verified against the live dataset's distinct
values (?$select=distinct stu_grp). Note DESE publishes "Low Income" (NOT
"Economically Disadvantaged" for this lens, matching the discipline-by-group
mirror); both labels exist but "Low Income" is the equity standard used here.

Subgroup cells are suppressed for small N (a district with too few students in a
group reports no value), so coverage is honestly LOWER than the 274-district set
— especially for English Learners and Black/African American. We drop missing
cells; we never fabricate.

Slice: org_type='District', attend_period='End of Year', latest published
complete school year (SY2025 — SY2026 has 0 End-of-Year rows) — matching
scripts/fetch_attendance_teacher.py — one query per subgroup.

Output: ``data/ma_district_absence_groups.json`` :: { DIST_CODE: {col: val} }
Values are fractions (0-1) rounded to 4 decimals.

Run from repo root::  python scripts/fetch_absence_groups.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_absence_groups.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest complete End-of-Year in [ak6h-9k7x] (SY2026 has 0 EOY rows)

# Output column -> exact DESE stu_grp label (verified against live distinct values).
GROUPS = {
    "chronic_low_income": "Low Income",
    "chronic_swd": "Students with Disabilities",
    "chronic_ell": "English Learners",
    "chronic_black": "Black or African American",
    "chronic_hispanic": "Hispanic or Latino",
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
    """Normalize a value to a 0-1 fraction. pct_chron_abs_10 comes as a fraction
    (0.096) already; detect and divide only if it looks like a percent."""
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

    # Chronic-absenteeism rate per subgroup — Student Attendance [ak6h-9k7x],
    # latest complete End-of-Year, district level, one query per student group.
    # pct_chron_abs_10 is a published fraction of that subgroup's enrollment.
    hits = {col: 0 for col in GROUPS}
    for col, grp in GROUPS.items():
        rows = soda("ak6h-9k7x", {
            "$where": f"org_type='District' AND stu_grp='{grp}' "
                      f"AND attend_period='End of Year' AND sy='{SY}'",
            "$select": "dist_code,pct_chron_abs_10",
            "$limit": "2000",
        })
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            ca = to_frac(r.get("pct_chron_abs_10"))
            if ca is not None:
                out[dc][col] = round(ca, 4); hits[col] += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, grp in GROUPS.items():
        print(f"  {col:18s} {hits[col]:>4}/274  stu_grp='{grp}'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
