"""
Add a NEW metric category to the atlas — MCAS student GROWTH (Student Growth
Percentile, SGP) — which is DISTINCT from the achievement columns already in the
atlas (% Meeting+Exceeding, % Exceeding, % Not Meeting, avg scaled score). SGP
measures how much a district's students grew on MCAS relative to their academic
peers (students with similar score histories), independent of starting level. A
value of ~50 is average growth; 1–99 is the full range.

  mcas_ela_sgp       <- ELA  Grades 3-8 avg SGP, All Students              (1–99)
  mcas_math_sgp      <- Math Grades 3-8 avg SGP, All Students              (1–99)
  mcas_ela_sgp_g10   <- ELA  Grade 10  avg SGP, All Students               (1–99)
  mcas_math_sgp_g10  <- Math Grade 10  avg SGP, All Students               (1–99)
  mcas_ela_sgp_swd   <- ELA  Grades 3-8 avg SGP, Students w/ Disabilities  (1–99)
  mcas_math_sgp_swd  <- Math Grades 3-8 avg SGP, Students w/ Disabilities  (1–99)

Source: MA DESE publishes SGP on the Education-to-Career hub (Socrata) NOT as a
column but as indicator rows inside the district indicators dataset
"Special Education Indicators" [yamx-769q] — despite the name it carries
ASSESSMENTS (Next Gen MCAS) indicators for All Students at the district level.
The relevant rows are:

  ind_desc = 'Average student growth percentiles (SGP) - ELA (Grades 3-8)'
  ind_desc = 'Average student growth percentiles (SGP) - Math (Grades 3-8)'

with the SGP value carried in ``ind_pct`` (e.g. 50.0). NOTE: ind_pct here is a
1–99 PERCENTILE, NOT a 0–1 fraction or a percentage — do NOT divide by 100.

The Grades 3-8 aggregate is the broad elementary/middle growth signal with the
widest district coverage; the Grade-10 variants add the high-school slice. SWD
(Students with Disabilities) is the only student subgroup this dataset breaks SGP
out by, so it is the one equity-of-growth lens available here — its cells are
suppressed for small N, so coverage runs lower than All Students.

Filters: latest year (SY2025); per-cell (ind_desc, stu_grp) pairs — see CELLS.

Output: ``data/ma_district_growth.json`` :: { DIST_CODE: {col: value, ...} }
Values are raw SGP numbers (1–99); ~50 = average growth. format:"num" in the UI.

Run from repo root::  python scripts/fetch_mcas_growth.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_growth.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "yamx-769q"
SY = "2025"

# (column, ind_desc, stu_grp). The value lives in ind_pct as a 1–99 percentile
# (median/average growth vs academic peers). Grades 3-8 = broad elementary/middle
# signal; Grade 10 = high-school slice; SWD = the one subgroup growth lens DESE
# publishes here.
CELLS = [
    ("mcas_ela_sgp",      "Average student growth percentiles (SGP) - ELA (Grades 3-8)",  "All Students"),
    ("mcas_math_sgp",     "Average student growth percentiles (SGP) - Math (Grades 3-8)", "All Students"),
    ("mcas_ela_sgp_g10",  "Average student growth percentiles (SGP) - ELA (Grades 10)",   "All Students"),
    ("mcas_math_sgp_g10", "Average student growth percentiles (SGP) - Math (Grades 10)",  "All Students"),
    ("mcas_ela_sgp_swd",  "Average student growth percentiles (SGP) - ELA (Grades 3-8)",  "Students with Disabilities"),
    ("mcas_math_sgp_swd", "Average student growth percentiles (SGP) - Math (Grades 3-8)", "Students with Disabilities"),
]


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_num(v):
    """SGP is a raw 1–99 percentile (e.g. 50.0). Keep it as a number — do NOT
    divide by 100, do NOT treat as a 0–1 fraction. Drop blanks / out-of-range."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0 or f > 100:
        return None
    return f


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}
    hits: dict[str, int] = {}

    for col, ind, grp in CELLS:
        rows = soda(DATASET, {
            "$where": (f"sy='{SY}' AND stu_grp='{grp}' "
                       f"AND ind_desc='{ind}'"),
            "$select": "dist_code,ind_pct",
            "$limit": "5000",
        })
        n = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            v = to_num(r.get("ind_pct"))
            if v is not None:
                out[dc][col] = round(v, 1)
                n += 1
        hits[col] = n

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, ind, grp in CELLS:
        print(f"  {col:18s}: {hits[col]:>3}/{len(ours)}  [{grp}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
