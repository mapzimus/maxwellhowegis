"""
Add NEW MCAS achievement-by-SUBGROUP columns to the atlas — the equity lens.
The geojson and companion side files already carry the g3-8 aggregate
``m_plus_e_pct`` (% Meeting+Exceeding) for *All Students*. This pulls the SAME
grades 3-8 aggregate ELA & Math % M+E, but broken out by the key reporting
subgroups, so achievement gaps are visible district by district:

  mcas_ela_low_income    <- ALL (03-08) ELA  % M+E, Low Income
  mcas_ela_swd           <- ALL (03-08) ELA  % M+E, Students with Disabilities
  mcas_ela_ell           <- ALL (03-08) ELA  % M+E, English Learners
  mcas_ela_black         <- ALL (03-08) ELA  % M+E, Black or African American
  mcas_ela_hispanic      <- ALL (03-08) ELA  % M+E, Hispanic or Latino
  mcas_math_low_income   <- ALL (03-08) MATH % M+E, Low Income
  mcas_math_swd          <- ALL (03-08) MATH % M+E, Students with Disabilities
  mcas_math_ell          <- ALL (03-08) MATH % M+E, English Learners
  mcas_math_black        <- ALL (03-08) MATH % M+E, Black or African American
  mcas_math_hispanic     <- ALL (03-08) MATH % M+E, Hispanic or Latino

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] on the Education-to-Career
hub (Socrata) — the same dataset used for the existing grade-level / level-detail
MCAS columns. Each row carries a ``stu_grp`` dimension; the EXACT subgroup labels
(verified against the dataset's distinct stu_grp values) are:
  'Low Income', 'Students with Disabilities', 'English Learners',
  'Black or African American', 'Hispanic or Latino'.
``m_plus_e_pct`` is published as a 0–1 fraction already, matching the atlas's
other MCAS columns. Subgroup rows are suppressed where counts are small, so
coverage is lower than the 274-district All-Students baseline — we drop missing
and report honestly rather than fabricate.

Filters: org_type='Public School District', test_grade='ALL (03-08)',
subject_code ELA + MATH, per stu_grp, latest year (SY2025).

Output: ``data/ma_district_mcas_groups.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_mcas_groups.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_groups.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"
GRADE = "ALL (03-08)"

# (column, subject_code, stu_grp) — g3-8 aggregate % M+E per subgroup. The
# stu_grp labels are EXACT strings from the dataset's distinct stu_grp values.
CELLS = [
    ("mcas_ela_low_income",  "ELA",  "Low Income"),
    ("mcas_ela_swd",         "ELA",  "Students with Disabilities"),
    ("mcas_ela_ell",         "ELA",  "English Learners"),
    ("mcas_ela_black",       "ELA",  "Black or African American"),
    ("mcas_ela_hispanic",    "ELA",  "Hispanic or Latino"),
    ("mcas_math_low_income", "MATH", "Low Income"),
    ("mcas_math_swd",        "MATH", "Students with Disabilities"),
    ("mcas_math_ell",        "MATH", "English Learners"),
    ("mcas_math_black",      "MATH", "Black or African American"),
    ("mcas_math_hispanic",   "MATH", "Hispanic or Latino"),
]


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """m_plus_e_pct is published as a 0–1 fraction (e.g. 0.31). Guard anyway:
    if a value ever comes through as a percent (>1), divide."""
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
    hits: dict[str, int] = {}

    # One query per (subject, subgroup) cell.
    for col, subj, grp in CELLS:
        grp_esc = grp.replace("'", "''")
        rows = soda(DATASET, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='{grp_esc}' AND sy='{SY}' "
                       f"AND test_grade='{GRADE}' AND subject_code='{subj}'"),
            "$select": "dist_code,m_plus_e_pct",
            "$limit": "5000",
        })
        n = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            v = to_frac(r.get("m_plus_e_pct"))
            if v is not None:
                out[dc][col] = round(v, 4)
                n += 1
        hits[col] = n

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, subj, grp in CELLS:
        print(f"  {col:22s} {subj:4s} {grp:28s}: {hits[col]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
