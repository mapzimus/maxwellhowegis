"""
Add NEW middle-grade MCAS achievement columns to the atlas. The geojson +
companion files already carry single-grade cells for Gr3 ELA/Math, Gr4 Math,
Gr8 Math (mcas_g*_*_me), the g3-8 *aggregate* (mcas_g38_*) and grade-10
(mcas_g10_*) percent Meeting+Exceeding. This rounds out the picture with the
MISSING middle grades (5/6/7) — NOT already present anywhere:

  mcas_g5_ela_me   <- Grade 5 ELA  % M+E
  mcas_g5_math_me  <- Grade 5 Math % M+E
  mcas_g6_ela_me   <- Grade 6 ELA  % M+E
  mcas_g6_math_me  <- Grade 6 Math % M+E
  mcas_g7_ela_me   <- Grade 7 ELA  % M+E
  mcas_g7_math_me  <- Grade 7 Math % M+E

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] on the Education-to-Career
hub (Socrata). That dataset has a per-row ``test_grade`` (03..10, plus the
"ALL (03-08)" aggregate and "HS SCI") and ``subject_code`` (ELA/MATH/SCI/...),
so we filter to one (grade, subject) cell per column. ``m_plus_e_pct`` is
published as a 0–1 fraction already, matching the atlas's other MCAS columns.

Filters: org_type='Public School District', stu_grp='All Students', latest
year (SY2025).

Output: ``data/ma_district_mcas_grades2.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_mcas_grades2.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_grades2.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# (column, test_grade, subject_code) — single-grade middle-grade cells distinct
# from the mcas_g3/g4/g8 cells, the mcas_g38_* aggregate and mcas_g10_* already
# in the atlas.
CELLS = [
    ("mcas_g5_ela_me",  "05", "ELA"),
    ("mcas_g5_math_me", "05", "MATH"),
    ("mcas_g6_ela_me",  "06", "ELA"),
    ("mcas_g6_math_me", "06", "MATH"),
    ("mcas_g7_ela_me",  "07", "ELA"),
    ("mcas_g7_math_me", "07", "MATH"),
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

    for col, grade, subj in CELLS:
        rows = soda(DATASET, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='All Students' AND sy='{SY}' "
                       f"AND test_grade='{grade}' AND subject_code='{subj}'"),
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
    for col, grade, subj in CELLS:
        print(f"  {col:18s} grade {grade} {subj:4s}: {hits[col]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
