"""
Add NEW MCAS achievement columns to the atlas: the grade-10 tail levels and the
grade-specific SCIENCE results. The geojson and the companion side files already
carry grade-10 ELA/Math/STE *combined* % Meeting+Exceeding (mcas_g10_*) and the
grades 3-8 aggregate tail levels (mcas_g38_*_exceeding / _not_meeting). This
pulls two DISTINCT, not-yet-present families from the SAME achievement data:

  (a) Grade-10 ELA & Math distribution tails — the top (% EXCEEDING, excellence)
      and bottom (% NOT MEETING, struggling), mirroring the g3-8 tail columns:

  mcas_g10_ela_exceeding    <- Grade 10 ELA  % Exceeding    (e_pct)
  mcas_g10_ela_not_meeting  <- Grade 10 ELA  % Not Meeting  (nm_pct)
  mcas_g10_math_exceeding   <- Grade 10 MATH % Exceeding    (e_pct)
  mcas_g10_math_not_meeting <- Grade 10 MATH % Not Meeting  (nm_pct)

  (b) Grade-specific SCIENCE % Meeting+Exceeding — Massachusetts administers the
      MCAS Science/Tech (STE) test in grades 5 and 8 (and HS). These single-grade
      science cells are NOT already in the atlas:

  mcas_g5_sci_me   <- Grade 5 Science % M+E   (m_plus_e_pct)
  mcas_g8_sci_me   <- Grade 8 Science % M+E   (m_plus_e_pct)

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] on the Education-to-Career
hub (Socrata) — the same dataset used for the other MCAS columns. Each row carries
per-level percentages: ``e_pct`` (Exceeding), ``m_pct`` (Meeting), ``pm_pct``
(Partially Meeting), ``nm_pct`` (Not Meeting), and ``m_plus_e_pct`` (Meeting +
Exceeding). All are published as 0–1 fractions, matching the atlas's other MCAS
columns. These metrics are DISTINCT from the existing mcas_g10_* combined and
mcas_g38_* columns.

Filters: org_type='Public School District', stu_grp='All Students', latest year
(SY2025).

Output: ``data/ma_district_mcas_g10_sci.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_mcas_g10_sci.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_g10_sci.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# (column, test_grade, subject_code, source_col) — grade-10 distribution tails
# (e_pct / nm_pct) and grade-specific science M+E, all distinct from the existing
# mcas_g10_* combined and mcas_g38_* tail columns.
CELLS = [
    ("mcas_g10_ela_exceeding",    "10", "ELA",  "e_pct"),
    ("mcas_g10_ela_not_meeting",  "10", "ELA",  "nm_pct"),
    ("mcas_g10_math_exceeding",   "10", "MATH", "e_pct"),
    ("mcas_g10_math_not_meeting", "10", "MATH", "nm_pct"),
    ("mcas_g5_sci_me",            "05", "SCI",  "m_plus_e_pct"),
    ("mcas_g8_sci_me",            "08", "SCI",  "m_plus_e_pct"),
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
    """e_pct / nm_pct / m_plus_e_pct are published as 0–1 fractions (e.g. 0.23).
    Guard anyway: if a value ever comes through as a percent (>1), divide."""
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

    # One query per (grade, subject) cell pulls just the source column it needs.
    for col, grade, subj, src in CELLS:
        rows = soda(DATASET, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='All Students' AND sy='{SY}' "
                       f"AND test_grade='{grade}' AND subject_code='{subj}'"),
            "$select": f"dist_code,{src}",
            "$limit": "5000",
        })
        n = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            v = to_frac(r.get(src))
            if v is not None:
                out[dc][col] = round(v, 4)
                n += 1
        hits[col] = n

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  (of {len(ours)} districts in {DISTS.name})")
    for col, grade, subj, src in CELLS:
        print(f"  {col:26s} grade {grade} {subj:4s} {src:12s}: {hits[col]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
