"""
Round out the atlas's Finance category with the per-pupil functional spending
CATEGORIES that DESE publishes but the atlas did not yet surface. Pulls from MA
DESE open data (Education-to-Career hub, Socrata) and writes a side-join file
keyed by 8-digit DIST_CODE.

Source: "District Expenditures by Spending Category" [er3w-dyti],
ind_cat='Expenditures Per Pupil'. For SY2024 that category has exactly twelve
DISTINCT ind_subcat values. NINE are already shipped by the atlas (do NOT
duplicate):

    Total Expenditures              -> per_pupil
    Teachers                        -> per_pupil_teachers
    Administration                  -> per_pupil_admin
    Pupil Services                  -> per_pupil_pupil_services
    Operations and Maintenance      -> per_pupil_operations
    Instructional Leadership        -> per_pupil_instr_leadership
    Instructional Materials, ...    -> per_pupil_instr_materials
    Guidance, Counseling and Testing-> per_pupil_guidance
    Insurance, Retirement Programs and Other -> per_pupil_insurance_other
    (Total In-District Expenditures is used internally, not a metric.)

This fetcher adds the TWO remaining, non-duplicate subcategories:

    per_pupil_prof_dev        <- ind_subcat='Professional Development'
    per_pupil_other_teaching  <- ind_subcat='Other Teaching Services'

Both are per-pupil DOLLAR amounts (ind_value_type='Amount'), kept RAW.

WHAT IS *NOT* HERE, AND WHY (the common "buses / food / benefits" questions):
  * Transportation and Food Services / Nutrition are NOT broken out as per-pupil
    functional categories anywhere in er3w-dyti. The per-pupil functional split
    DESE publishes here covers in-district INSTRUCTIONAL + operations functions
    only; pupil transportation and food service are reported solely as total
    dollars in a different (function-code) report, not as a queryable per-pupil
    Socrata column. Rather than fabricate or change units, they are omitted.
  * Employee Benefits / Fixed Charges is not a standalone per-pupil subcat —
    DESE folds retirement/insurance/benefits into "Insurance, Retirement
    Programs and Other", which the atlas already ships as
    per_pupil_insurance_other. Adding a "benefits" metric would duplicate it.

The distinct ind_subcat universe under ind_cat='Expenditures Per Pupil'
(SY2024) was confirmed with:
  er3w-dyti.json?ind_cat=Expenditures Per Pupil&sy=2024
    &$select=ind_subcat&$group=ind_subcat

Latest fiscal year published is SY2024 (er3w-dyti runs 2009..2024). Reported at
the district level for most of the atlas's academic districts.

Output: ``data/ma_district_finance_categories.json`` :: { DIST_CODE: {col: value} }
Dollar amounts are kept RAW (per-pupil USD), not fractions; missing -> null
(district simply omitted from / lacks that column), never 0.

Run from repo root::  python scripts/fetch_finance_categories.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_finance_categories.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2024"  # latest fiscal year published in er3w-dyti
IND_CAT = "Expenditures Per Pupil"

# col name  ->  DESE ind_subcat (under ind_cat='Expenditures Per Pupil').
# Only the subcats NOT already shipped as per_pupil_* metrics.
SPEND_CATS = {
    "per_pupil_prof_dev":       "Professional Development",
    "per_pupil_other_teaching": "Other Teaching Services",
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
    # One query per distinct non-duplicate subcategory. SY2024 is the latest.
    # Filter on BOTH ind_cat and ind_subcat so we never pick up a same-named
    # subcat from a different ind_cat.
    hits: dict[str, int] = {col: 0 for col in SPEND_CATS}
    for col, subcat in SPEND_CATS.items():
        rows = soda("er3w-dyti", {
            "ind_cat": IND_CAT,
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
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(of {len(ours)} academic-district universe)")
    for col in SPEND_CATS:
        print(f"  {col:26s} {hits[col]:>3} (SY{SY}, USD per pupil)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
