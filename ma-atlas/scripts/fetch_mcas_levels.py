"""
Add NEW MCAS achievement-LEVEL detail columns to the atlas. The geojson and the
companion side files already carry the *combined* middle-pass rate
(``m_plus_e_pct`` -> mcas_g38_*_me, % Meeting+Exceeding). This pulls the DISTINCT
tail levels from the SAME achievement data — the top of the distribution
(% EXCEEDING Expectations, excellence) and the bottom (% NOT MEETING
Expectations, struggling) — for the grades 3-8 aggregate ELA and Math:

  mcas_g38_ela_exceeding    <- ALL (03-08) ELA  % Exceeding    (e_pct)
  mcas_g38_ela_not_meeting  <- ALL (03-08) ELA  % Not Meeting  (nm_pct)
  mcas_g38_math_exceeding   <- ALL (03-08) MATH % Exceeding    (e_pct)
  mcas_g38_math_not_meeting <- ALL (03-08) MATH % Not Meeting  (nm_pct)

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] on the Education-to-Career
hub (Socrata) — the same dataset used for the grade-level MCAS columns. Each row
carries per-level percentages: ``e_pct`` (Exceeding), ``m_pct`` (Meeting),
``pm_pct`` (Partially Meeting), ``nm_pct`` (Not Meeting), alongside the
``m_plus_e_pct`` already used. These are published as 0–1 fractions, matching the
atlas's other MCAS columns. These tail metrics are DISTINCT from the existing
combined m_plus_e (mcas_g38_*_me) columns.

Filters: org_type='Public School District', stu_grp='All Students',
test_grade='ALL (03-08)', subject_code ELA + MATH, latest year (SY2025).

Output: ``data/ma_district_mcas_levels.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_mcas_levels.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_levels.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"
GRADE = "ALL (03-08)"

# (column, subject_code, source_col) — top/bottom tail levels of the g3-8
# aggregate distribution, distinct from the combined m_plus_e_pct columns.
CELLS = [
    ("mcas_g38_ela_exceeding",    "ELA",  "e_pct"),
    ("mcas_g38_ela_not_meeting",  "ELA",  "nm_pct"),
    ("mcas_g38_math_exceeding",   "MATH", "e_pct"),
    ("mcas_g38_math_not_meeting", "MATH", "nm_pct"),
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
    """e_pct / nm_pct are published as 0–1 fractions (e.g. 0.05). Guard anyway:
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

    # One query per subject pulls both tail levels (e_pct + nm_pct) at once.
    for subj in ("ELA", "MATH"):
        cols = [c for c in CELLS if c[1] == subj]
        src_cols = sorted({c[2] for c in cols})
        rows = soda(DATASET, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='All Students' AND sy='{SY}' "
                       f"AND test_grade='{GRADE}' AND subject_code='{subj}'"),
            "$select": "dist_code," + ",".join(src_cols),
            "$limit": "5000",
        })
        for col, _subj, src in cols:
            hits[col] = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            for col, _subj, src in cols:
                v = to_frac(r.get(src))
                if v is not None:
                    out[dc][col] = round(v, 4)
                    hits[col] += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, subj, src in CELLS:
        print(f"  {col:26s} {subj:4s} {src:7s}: {hits[col]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
