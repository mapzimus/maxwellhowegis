"""
Fill the two missing cells in the grade-level MCAS grid: Gr4 ELA and Gr8 ELA.
The atlas already ships Gr4 Math and Gr8 Math (plus Gr3/5/6/7 ELA+Math and the
Gr3-8 / Gr10 aggregates), so ELA at grades 4 and 8 were the only single-grade
holes. Same dataset, same query shape as fetch_mcas_grades / fetch_mcas_grades2.

  mcas_g4_ela_me  <- grade 04 ELA % Meeting+Exceeding, All Students  (live cov: 269)
  mcas_g8_ela_me  <- grade 08 ELA % Meeting+Exceeding, All Students  (live cov: 238)

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] (Education-to-Career hub,
Socrata), SY2025. ``m_plus_e_pct`` is a 0-1 fraction. Districts below DESE's
min-n are suppressed (stored null, never 0).

Output: ``data/ma_district_mcas_grades3.json`` :: { DIST_CODE: {col: value} }

Run from repo root::  python scripts/fetch_mcas_grades3.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_grades3.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# (column, test_grade, subject_code) — the two missing ELA cells.
CELLS = [
    ("mcas_g4_ela_me", "04", "ELA"),
    ("mcas_g8_ela_me", "08", "ELA"),
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
    """m_plus_e_pct is published as a 0-1 fraction (e.g. 0.31). Guard anyway:
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
