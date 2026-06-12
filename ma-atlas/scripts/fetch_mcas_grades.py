"""
Add NEW grade-specific MCAS achievement columns to the atlas. The geojson
already carries g3-8 *aggregate* (mcas_g38_*) and grade-10 (mcas_g10_*)
percent Meeting+Exceeding. This pulls DISTINCT single-grade cells that are
high-signal early-literacy / numeracy / algebra-readiness markers and that are
NOT already present:

  mcas_g3_ela_me   <- Grade 3 ELA  % M+E   (early reading)
  mcas_g3_math_me  <- Grade 3 Math % M+E   (early numeracy)
  mcas_g4_math_me  <- Grade 4 Math % M+E
  mcas_g8_math_me  <- Grade 8 Math % M+E   (algebra readiness)

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] on the Education-to-Career
hub (Socrata). That dataset has a per-row ``test_grade`` (03..10, plus the
"ALL (03-08)" aggregate and "HS SCI") and ``subject_code`` (ELA/MATH/SCI/...),
so we filter to one (grade, subject) cell per column. ``m_plus_e_pct`` is
published as a 0–1 fraction already, matching the atlas's other MCAS columns.

Filters: org_type='Public School District', stu_grp='All Students', latest
year (SY2025).

Output: ``data/ma_district_mcas_grades.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_mcas_grades.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_grades.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# (column, test_grade, subject_code) — single-grade cells distinct from the
# mcas_g38_* aggregate and mcas_g10_* already in the geojson.
CELLS = [
    ("mcas_g3_ela_me",  "03", "ELA"),
    ("mcas_g3_math_me", "03", "MATH"),
    ("mcas_g4_math_me", "04", "MATH"),
    ("mcas_g8_math_me", "08", "MATH"),
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
