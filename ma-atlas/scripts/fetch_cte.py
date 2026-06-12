"""
Add a career / vocational-technical education metric to the atlas by pulling
Chapter 74 CTE enrollment from MA DESE's open data (Education-to-Career hub,
Socrata) and writing a join file keyed by DIST_CODE:

  cte_enrollment_pct  <- Pathways/Programs Enrollment [9p45-t37j]  program_pct
                         (pathway = "Career Technical Education (Chapter 74
                         Programs)", roll-up program = "Career Technical
                         Education Programs")

This is the % of a district's students enrolled in a Chapter 74 (CTE) program.
We take the latest published year (SY2026) at the District level, All Students.
program_pct already ships as a 0-1 fraction, matching the atlas's other *_pct
columns.

NOTE ON DROPPED COLUMNS
-----------------------
The brief also asked for ``cte_completer_pct`` and ``industry_credential_pct``.
After auditing the Education-to-Career hub (catalog searches for "chapter 74",
"career technical", "CTE", "completer", "credential", "perkins") there is NO
published district-level Socrata table for CTE completers or for industry-
recognized credential attainment. The only CTE/Perkins entry is a non-tabular
"Resource Page" (m43v-328k, returns 403 as a SODA resource). The College &
Career Outcomes table (vj54-j4q3) only carries postsecondary-enrollment /
employment outcome_types -- nothing CTE-completer or credential specific. Those
two columns are therefore intentionally dropped rather than fabricated.

Output: ``data/ma_district_cte.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0-1).

Run from repo root::  python scripts/fetch_cte.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_cte.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. program_pct ships as 0.135 already;
    divide only if a stray percent (>1) shows up."""
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

    # Chapter 74 CTE enrollment share -- latest (SY2026), District, the
    # per-district roll-up row across all Chapter 74 programs.
    cte = soda("9p45-t37j", {
        "$where": "org_type='District' AND sy='2026' "
                  "AND pathway='Career Technical Education (Chapter 74 Programs)' "
                  "AND program='Career Technical Education Programs'",
        "$select": "dist_code,program_pct",
        "$limit": "2000",
    })
    c_hits = 0
    for r in cte:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("program_pct"))) is not None:
            out[dc]["cte_enrollment_pct"] = round(v, 4); c_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  cte_enrollment_pct: {c_hits} (SY2026)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
