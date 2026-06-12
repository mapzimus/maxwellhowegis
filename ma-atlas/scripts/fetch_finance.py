"""
Add a NEW district-finance metric category (school finance: state aid & budget)
to the atlas by pulling distinct dollar/ratio measures from MA DESE open data
(Education-to-Career hub, Socrata) and writing a side join file keyed by
DIST_CODE. These do NOT duplicate the per-pupil expenditure columns the atlas
already ships (per_pupil = Total Expenditures, plus teachers/admin/pupil
services).

  foundation_budget        <- Ch.70 Foundation Budget & NSS [5izv-jyrd] fdn_bdgt_amt   (dollars)
  required_nss             <- Ch.70 Foundation Budget & NSS [5izv-jyrd] req_nss_amt    (dollars)
  actual_nss               <- Ch.70 Foundation Budget & NSS [5izv-jyrd] actl_nss_amt   (dollars)
  nss_pct_of_required      <- Ch.70 Foundation Budget & NSS [5izv-jyrd] actl_nss_req_cnt (fraction, actual/required; >1 = spending above required)
  nss_pct_of_foundation    <- Ch.70 Foundation Budget & NSS [5izv-jyrd] actl_nss_fdn_cnt (fraction, actual/foundation)
  in_district_pp_exp       <- District Expenditures by Spending Category [er3w-dyti]
                              ind_subcat='Total In-District Expenditures' (per-pupil dollars;
                              distinct from the atlas's per_pupil = Total Expenditures)
  enrollment_fte           <- District Expenditures by Spending Category [er3w-dyti]
                              ind_subcat='Total FTE Pupils' (count; lets the dollar totals above
                              be normalized per pupil if desired)

Chapter 70 STATE AID dollars are NOT published as a queryable Socrata table on
this domain: the "Chapter 70 Program Information and Data" catalog entry
[qt58-634r] is a type='href' link to an external DESE page, not a tabular
resource, so it is omitted rather than fabricated. The NSS dataset's required
net school spending is the closest published proxy for the Chapter 70 funding
formula and is included.

Latest fiscal year published differs by source: NSS/foundation = FY/SY2022
(5izv-jyrd stops there); in-district per-pupil + enrollment = SY2024 (er3w-dyti).
Both reported at the district level for 273/274 of the atlas's academic
districts.

Output: ``data/ma_district_finance.json`` :: { DIST_CODE: {col: value, ...} }
Dollar amounts are kept RAW (not fractions); true ratios are 0–1+ fractions.

Run from repo root::  python scripts/fetch_finance.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_finance.json"
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


def to_num(v):
    """Parse a numeric string to float; keep its native magnitude (dollars and
    raw FTE counts pass through unchanged). Returns None for blanks/non-numeric.
    Negatives are allowed: over/under-required spending can legitimately be
    negative, and ratios are always positive."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def to_frac(v):
    """For ratio columns already expressed as a multiple (actl/required = 1.27).
    These are kept as-is (0–1+ fraction), not divided — 1.27 means 127% of
    required. Guard against blanks/negatives."""
    f = to_num(v)
    if f is None or f < 0:
        return None
    return f


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Chapter 70 Foundation Budget & Net School Spending — latest is SY2022.
    #    Dollar amounts kept raw; the two *_cnt fields are actual-vs-required and
    #    actual-vs-foundation multiples (fractions, 1.0 == exactly at target).
    nss = soda("5izv-jyrd", {
        "sy": "2022",
        "$where": "dist_code != '00000000'",  # drop the State Totals row
        "$select": "dist_code,fdn_bdgt_amt,req_nss_amt,actl_nss_amt,"
                   "actl_nss_req_cnt,actl_nss_fdn_cnt",
        "$limit": "5000",
    })
    fdn_hits = req_hits = nss_hits = ratio_hits = 0
    for r in nss:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        fb = to_num(r.get("fdn_bdgt_amt"))
        rq = to_num(r.get("req_nss_amt"))
        ac = to_num(r.get("actl_nss_amt"))
        pr = to_frac(r.get("actl_nss_req_cnt"))
        pf = to_frac(r.get("actl_nss_fdn_cnt"))
        if fb is not None:
            out[dc]["foundation_budget"] = round(fb, 2); fdn_hits += 1
        if rq is not None:
            out[dc]["required_nss"] = round(rq, 2); req_hits += 1
        if ac is not None:
            out[dc]["actual_nss"] = round(ac, 2); nss_hits += 1
        if pr is not None:
            out[dc]["nss_pct_of_required"] = round(pr, 4); ratio_hits += 1
        if pf is not None:
            out[dc]["nss_pct_of_foundation"] = round(pf, 4)

    # 2) District Expenditures by Spending Category — latest is SY2024.
    #    Total In-District Expenditures per pupil is DISTINCT from the atlas's
    #    existing per_pupil (= Total Expenditures, which also counts
    #    out-of-district tuition). Also pull Total FTE Pupils so the dollar
    #    totals above can be normalized per pupil downstream.
    pp = soda("er3w-dyti", {
        "sy": "2024",
        "$where": "ind_subcat='Total In-District Expenditures'",
        "$select": "dist_code,ind_value", "$limit": "5000",
    })
    idpp_hits = 0
    for r in pp:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_num(r.get("ind_value"))) is not None:
            out[dc]["in_district_pp_exp"] = round(v, 2); idpp_hits += 1

    enr = soda("er3w-dyti", {
        "sy": "2024",
        "$where": "ind_subcat='Total FTE Pupils'",
        "$select": "dist_code,ind_value", "$limit": "5000",
    })
    enr_hits = 0
    for r in enr:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_num(r.get("ind_value"))) is not None:
            out[dc]["enrollment_fte"] = round(v, 1); enr_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  foundation_budget:      {fdn_hits} (SY2022, USD)")
    print(f"  required_nss:           {req_hits} (SY2022, USD)")
    print(f"  actual_nss:             {nss_hits} (SY2022, USD)")
    print(f"  nss_pct_of_required:    {ratio_hits} (SY2022, fraction)")
    print(f"  in_district_pp_exp:     {idpp_hits} (SY2024, USD per pupil)")
    print(f"  enrollment_fte:         {enr_hits} (SY2024, FTE count)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
