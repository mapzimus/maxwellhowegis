"""
Add NEW school-finance DETAIL metrics (spending mix) to the atlas by pulling
additional per-pupil expenditure CATEGORIES from MA DESE open data
(Education-to-Career hub, Socrata) and writing a side join file keyed by
DIST_CODE. These do NOT duplicate the per-pupil columns the atlas already ships
(Total Expenditures, Teachers, Administration, Pupil Services, Total In-District)
nor the Chapter 70 / NSS columns in data/ma_district_finance.json.

Source: "District Expenditures by Spending Category" [er3w-dyti],
ind_cat='Expenditures Per Pupil'. The atlas already used the Total/Teachers/
Administration/Pupil Services/Total In-District subcategories; this file adds the
remaining DISTINCT subcategories that describe the spending MIX:

  per_pupil_operations        <- ind_subcat='Operations and Maintenance'
  per_pupil_instr_leadership  <- ind_subcat='Instructional Leadership'
  per_pupil_instr_materials   <- ind_subcat='Instructional Materials, Equipment and Technology'
  per_pupil_guidance          <- ind_subcat='Guidance, Counseling and Testing'
  per_pupil_insurance_other   <- ind_subcat='Insurance, Retirement Programs and Other'

All five are per-pupil DOLLAR amounts (ind_value_type='Amount'), kept RAW.

REVENUE BY SOURCE (% local / % state / % federal) is NOT published as a
queryable Socrata table on educationtocareer.data.mass.gov — the only finance
datasets are expenditures (er3w-dyti spending category, cnfs-edqq function code,
i5up-aez6 school-level) and Chapter 70/NSS (5izv-jyrd). No revenue-by-source
dataset exists on this domain, so those columns are omitted rather than
fabricated. The spending-mix categories above are the distinct detail metrics
that are cleanly published.

Latest fiscal year published is SY2024 (er3w-dyti runs 2009..2024). Reported at
the district level for ~273/274 of the atlas's academic districts.

Output: ``data/ma_district_finance_detail.json`` :: { DIST_CODE: {col: value} }
Dollar amounts are kept RAW (per-pupil USD), not fractions.

Run from repo root::  python scripts/fetch_finance_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_finance_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2024"  # latest fiscal year published in er3w-dyti

# col name  ->  DESE ind_subcat (under ind_cat='Expenditures Per Pupil')
SPEND_MIX = {
    "per_pupil_operations":       "Operations and Maintenance",
    "per_pupil_instr_leadership": "Instructional Leadership",
    "per_pupil_instr_materials":  "Instructional Materials, Equipment and Technology",
    "per_pupil_guidance":         "Guidance, Counseling and Testing",
    "per_pupil_insurance_other":  "Insurance, Retirement Programs and Other",
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char.
    er3w-dyti already ships 8-char codes, but zfill keeps this robust."""
    return str(code).zfill(8)


def to_num(v):
    """Parse a numeric string to float; keep its native magnitude (per-pupil
    dollars pass through unchanged). Returns None for blanks/non-numeric."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # District Expenditures by Spending Category — per-pupil dollar amounts.
    # One query per distinct spending-mix subcategory; all DISTINCT from the
    # categories the atlas already ships. SY2024 is the latest.
    hits: dict[str, int] = {col: 0 for col in SPEND_MIX}
    for col, subcat in SPEND_MIX.items():
        rows = soda("er3w-dyti", {
            "ind_cat": "Expenditures Per Pupil",
            "ind_subcat": subcat,
            "sy": SY,
            "$select": "dist_code,ind_value",
            "$limit": "5000",
        })
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc in out and (v := to_num(r.get("ind_value"))) is not None:
                out[dc][col] = round(v, 2)
                hits[col] += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    for col in SPEND_MIX:
        print(f"  {col:28s} {hits[col]:>3} (SY{SY}, USD per pupil)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
