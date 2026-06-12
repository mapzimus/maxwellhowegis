"""
Per-pupil TRANSPORTATION and FOOD-SERVICES spending for the atlas's Finance
category. Pulls TOTAL dollars by function from MA DESE open data
(Education-to-Career hub, Socrata) and NORMALIZES them per pupil, writing a
side-join file keyed by 8-digit DIST_CODE.

WHY THIS FETCHER EXISTS (the common "how much do we spend on buses / food?"
question): DESE does NOT publish transportation or food as per-pupil FUNCTIONAL
categories. The atlas's existing per-pupil columns come from "District
Expenditures by Spending Category" [er3w-dyti], whose per-pupil split covers
in-district instructional + operations functions ONLY — pupil transportation
and food service are absent there (confirmed in fetch_finance_categories.py).
They ARE published, but only as TOTAL DOLLARS BY FUNCTION CODE, in a different
report:

  Source: "District Expenditures by Function Code" [cnfs-edqq], SY2024 (latest;
  the table runs 2009..2024). Columns used: dist_code, func_cat_code, func_code,
  func_desc, tot_exp (total dollars; gen_fund + grnts_revolv).

So the build is: fetch each function's TOTAL $ -> divide by FTE pupils.

  per_pupil_transportation      = tot_exp[func_code 3300 "Transportation
                                  Services", In-District] / enrollment_fte
                                  -- the classic in-district pupil-transport
                                  (yellow-bus) line.
  per_pupil_transportation_ood  = SUM of tot_exp over the "Out-of-district
                                  Transportation" category [func_cat_code ODTR]
                                  / enrollment_fte -- busing students to
                                  out-of-district / charter / special-ed
                                  placements (the ODTR category contains a bulk
                                  func_code='ODTR' line plus a '9130' Charter
                                  Transportation Tuition line; both are summed).
  per_pupil_food                = tot_exp[func_code 3400 "Food Services",
                                  In-District] / enrollment_fte

DENOMINATOR: enrollment_fte (Total FTE Pupils, SY2024) is read from the
already-shipped data/ma_district_finance.json (sourced from er3w-dyti
'Total FTE Pupils'); it is NOT re-fetched. NOTE: DESE's own per_pupil_exp column
in cnfs-edqq uses a slightly SMALLER denominator (in-district FTE, which
excludes tuitioned-out pupils), so these computed figures run a touch lower than
DESE's per_pupil_exp — but they share ONE consistent denominator across
transport/food and the atlas's other per-pupil finance metrics, which is what
makes them comparable. We deliberately compute total / Total-FTE rather than
reuse DESE's per_pupil_exp.

SUPPRESSION / MISSING: cnfs-edqq simply OMITS a function line a district did not
report (it never reports a literal 0), so missing -> the district lacks that
column -> rendered as null by the atlas. Any stray 0 total, or a district with
no/zero FTE (e.g. Gosnold 01090000, an island with no schools), is stored as
null, NEVER 0 (a 0 would poison choropleth ramps and ranks). A handful of tiny
rural districts legitimately spend almost nothing in-house on food (food handled
regionally) — those small-but-real values are kept as measured.

Output: data/ma_district_transport.json :: { DIST_CODE: {col: value, ...} },
per-pupil USD rounded to 2 dp, restricted to the
data/ma_academic_districts.geojson DIST_CODE universe (state row 00000000
dropped), districts that got nothing omitted. Prints per-column coverage.

Run from repo root::  python scripts/fetch_transport_spending.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
FIN = REPO / "data" / "ma_district_finance.json"   # supplies enrollment_fte (Total FTE Pupils)
OUT = REPO / "data" / "ma_district_transport.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "cnfs-edqq"  # District Expenditures by Function Code
SY = "2024"            # latest fiscal year published in cnfs-edqq
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE drops leading zeros; the atlas uses zero-padded 8-char codes.
    cnfs-edqq already ships 8-char codes, but zfill keeps this robust."""
    return str(code).zfill(8)


def to_num(v):
    """Parse a numeric string to float (total dollars pass through). Returns
    None for blanks/non-numeric. A literal 0 is returned as 0.0 here; callers
    convert non-positive totals to None so a missing/zero line never stores 0."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def per_pupil(total, fte):
    """total $ / FTE pupils. None (not 0) for missing/zero/negative total or a
    missing/zero FTE denominator — never store 0 (it poisons ramps and ranks)."""
    if total is None or total <= 0:
        return None
    if fte is None or fte <= 0:
        return None
    return round(total / fte, 2)


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    ours.discard("00000000")  # never the state-totals row
    # FTE denominator from the already-shipped finance side file.
    fin = json.loads(FIN.read_text())
    fte_of = {dc: rec.get("enrollment_fte") for dc, rec in fin.items()}

    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) In-district pupil transportation: func_code 3300 (one row per district).
    trans = soda(DATASET, {
        "$where": f"sy='{SY}' AND func_code='3300'",
        "$select": "dist_code,tot_exp", "$limit": "5000",
    })
    n_trans = 0
    for r in trans:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        pp = per_pupil(to_num(r.get("tot_exp")), fte_of.get(dc))
        if pp is not None:
            out[dc]["per_pupil_transportation"] = pp
            n_trans += 1

    # 2) Out-of-district transportation: SUM every row in the ODTR category
    #    (bulk 'ODTR' line + '9130' charter-transport line) per district.
    oodr = soda(DATASET, {
        "$where": f"sy='{SY}' AND func_cat_code='ODTR'",
        "$select": "dist_code,tot_exp", "$limit": "20000",
    })
    ood_tot: dict[str, float] = {}
    for r in oodr:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        v = to_num(r.get("tot_exp"))
        if v is not None:
            ood_tot[dc] = ood_tot.get(dc, 0.0) + v
    n_ood = 0
    for dc, tot in ood_tot.items():
        pp = per_pupil(tot, fte_of.get(dc))
        if pp is not None:
            out[dc]["per_pupil_transportation_ood"] = pp
            n_ood += 1

    # 3) Food services: func_code 3400 (one row per district).
    food = soda(DATASET, {
        "$where": f"sy='{SY}' AND func_code='3400'",
        "$select": "dist_code,tot_exp", "$limit": "5000",
    })
    n_food = 0
    for r in food:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        pp = per_pupil(to_num(r.get("tot_exp")), fte_of.get(dc))
        if pp is not None:
            out[dc]["per_pupil_food"] = pp
            n_food += 1

    # Drop districts that got nothing, keep file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(of {len(ours)} academic-district universe)")
    print(f"  per_pupil_transportation      {n_trans:>3}  (SY{SY}, in-district func 3300 / FTE, USD)")
    print(f"  per_pupil_transportation_ood  {n_ood:>3}  (SY{SY}, ODTR category sum / FTE, USD)")
    print(f"  per_pupil_food                {n_food:>3}  (SY{SY}, func 3400 / FTE, USD)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
