"""
Expand MCAS achievement-by-subgroup coverage — the equity lens — in two ways the
atlas was missing:

1. Gr3-8 aggregate (% M+E) for the subgroups NOT already shipped: White, Asian,
   Multi-Race, and the High Needs umbrella. (Low Income / SWD / EL / Black /
   Hispanic already ship via fetch_mcas_groups.py.)
2. Gr10 (high-school) % M+E by subgroup — an entirely new lens; the atlas had NO
   subgroup achievement at grade 10. Ships the nine subgroups whose live coverage
   clears ~40% of HS districts.

All cells are ELA + Math. Subgroup labels are the EXACT distinct stu_grp strings
from the dataset (verified live; e.g. note the comma in 'Multi-Race, Not Hispanic
or Latino'). Rows below DESE's min-n are suppressed -> stored null, never 0.

Live operating-district coverage (SY2025), for reference:
  Gr3-8: White 287, High Needs 286, Multi 238, Asian 185
  Gr10 : White 256, High Needs 254, Low Income 251, SWD 242, Hispanic 191,
         Black 110, Multi 100, Asian 86, English Learners 75

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] (Education-to-Career hub,
Socrata), SY2025. ``m_plus_e_pct`` is a 0-1 fraction.

Output: ``data/ma_district_mcas_groups2.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_mcas_groups2.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_groups2.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# (key, exact stu_grp label). Labels verified against the dataset's distinct values.
NEW_G38 = [
    ("white",      "White"),
    ("asian",      "Asian"),
    ("multi",      "Multi-Race, Not Hispanic or Latino"),
    ("high_needs", "High Needs"),
]
# Gr10 ships the existing five PLUS the four above (none existed at grade 10 before).
G10 = [
    ("low_income", "Low Income"),
    ("swd",        "Students with Disabilities"),
    ("ell",        "English Learners"),
    ("black",      "Black or African American"),
    ("hispanic",   "Hispanic or Latino"),
    ("white",      "White"),
    ("asian",      "Asian"),
    ("multi",      "Multi-Race, Not Hispanic or Latino"),
    ("high_needs", "High Needs"),
]
SUBJECTS = [("ela", "ELA"), ("math", "MATH")]

# Build (column, test_grade, subject_code, stu_grp) cells.
CELLS = []
for subj_lc, subj in SUBJECTS:
    for key, label in NEW_G38:
        CELLS.append((f"mcas_{subj_lc}_{key}", "ALL (03-08)", subj, label))
    for key, label in G10:
        CELLS.append((f"mcas_g10_{subj_lc}_{key}", "10", subj, label))


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """m_plus_e_pct is published as a 0-1 fraction. Guard: divide if it ever
    arrives as a percent (>1); reject negatives."""
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

    for col, grade, subj, grp in CELLS:
        grp_esc = grp.replace("'", "''")
        rows = soda(DATASET, {
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

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, grade, subj, grp in CELLS:
        print(f"  {col:26s} {grade:11s} {subj:4s} {grp:36s}: {hits[col]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
