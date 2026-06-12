"""
Add the GENDER lens — the atlas had no male/female anything. Ships standalone
gendered district metrics (additive; does NOT touch the shared KNOWN_GROUPS
student-group axis) from two MA DESE open datasets (Education-to-Career hub,
Socrata), SY2025:

1. MCAS achievement % Meeting+Exceeding by gender [i9w6-niyt] — the same dataset
   the atlas already mines for subgroup achievement. ``stu_grp`` carries 'Male'
   and 'Female' (verified live, ~285 districts each at Gr3-8). ``m_plus_e_pct``
   is a 0-1 fraction.
     mcas_ela_male/female        test_grade='ALL (03-08)'  subject_code='ELA'
     mcas_math_male/female       test_grade='ALL (03-08)'  subject_code='MATH'
     mcas_g10_ela_male/female    test_grade='10'           subject_code='ELA'
     mcas_g10_math_male/female   test_grade='10'           subject_code='MATH'

2. 4-year graduation + dropout by gender [n2xa-p822] — same dataset behind
   grad_4yr / dropout_pct. ``stu_grp`` carries 'Male'/'Female' (verified live,
   304 districts each). 4-year adjusted cohort, ``grad_rate_type='4-Year
   Graduation Rate'``. grad_pct / drpout_pct ship as 0-1 fractions.
     grad_4yr_male/female        <- grad_pct
     dropout_male/female         <- drpout_pct

Live SY2025 coverage AFTER restricting to the atlas's 281 academic districts is
printed at the end (gender splits clear the ~40% bar comfortably). Rows below
DESE's min-n are suppressed -> stored null, never 0.

Output: ``data/ma_district_gender.json`` :: { DIST_CODE: {col: value, ...} },
filtered to DIST_CODEs present in data/ma_academic_districts.geojson, dropping
districts that got nothing.

Run from repo root::  python scripts/fetch_gender.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_gender.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
SY = "2025"

MCAS = "i9w6-niyt"   # MCAS Achievement Results
GRAD = "n2xa-p822"   # High School Graduation Rates

GENDERS = [("male", "Male"), ("female", "Female")]

# ── MCAS cells: (column, test_grade, subject_code, stu_grp) ──────────────────
# m_plus_e_pct, 0-1 fraction. Gr3-8 aggregate + Gr10 (HS), ELA + Math, M + F.
MCAS_CELLS = []
for g_lc, g_label in GENDERS:
    MCAS_CELLS.append((f"mcas_ela_{g_lc}",      "ALL (03-08)", "ELA",  g_label))
    MCAS_CELLS.append((f"mcas_math_{g_lc}",     "ALL (03-08)", "MATH", g_label))
    MCAS_CELLS.append((f"mcas_g10_ela_{g_lc}",  "10",          "ELA",  g_label))
    MCAS_CELLS.append((f"mcas_g10_math_{g_lc}", "10",          "MATH", g_label))

# ── Grad cells: (column, source_col, stu_grp) ───────────────────────────────
# 4-year adjusted cohort; grad_pct / drpout_pct, 0-1 fractions.
GRAD_CELLS = []
for g_lc, g_label in GENDERS:
    GRAD_CELLS.append((f"grad_4yr_{g_lc}", "grad_pct",   g_label))
    GRAD_CELLS.append((f"dropout_{g_lc}",  "drpout_pct", g_label))


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """m_plus_e_pct / grad_pct / drpout_pct are published as 0-1 fractions.
    Guard: divide if a value ever arrives as a percent (>1); reject negatives;
    suppressed cells (None/'') -> None so they store as null, never 0."""
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

    # ── MCAS % M+E by gender ─────────────────────────────────────────────────
    for col, grade, subj, grp in MCAS_CELLS:
        grp_esc = grp.replace("'", "''")
        rows = soda(MCAS, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='{grp_esc}' AND sy='{SY}' "
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

    # ── 4-yr graduation + dropout by gender ──────────────────────────────────
    for col, src, grp in GRAD_CELLS:
        grp_esc = grp.replace("'", "''")
        rows = soda(GRAD, {
            "$where": (f"org_type='District' AND sy='{SY}' "
                       f"AND grad_rate_type='4-Year Graduation Rate' "
                       f"AND stu_grp='{grp_esc}'"),
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
    print(f"  (atlas universe = {len(ours)} academic districts)")
    for col, *_ in MCAS_CELLS + [(c, s, g) for c, s, g in GRAD_CELLS]:
        pct = 100.0 * hits[col] / len(ours)
        print(f"  {col:22s}: {hits[col]:4d}  ({pct:4.0f}% of universe)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
