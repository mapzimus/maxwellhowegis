"""
Pull POST-GRADUATION EARNINGS & EMPLOYMENT of Massachusetts high-school graduates
from MA DESE's open data (Education-to-Career hub, Socrata) into a join file keyed
by DIST_CODE. This powers a brand-new, highly relatable atlas category --
"Earnings & employment" -- answering "what do this district's grads actually earn,
and how many are working?" a few years out of high school.

  grad_avg_earnings            <- Average Earnings of High School Graduates by
                                  Student Group [9vfm-6vxq], average_earnings for
                                  stu_grp='All Students'. Mean annual wage earnings
                                  of the district's HS-grad cohort, in dollars.
  grad_employment_pct          <- [9vfm-6vxq]  employed_count / grad_count for
                                  stu_grp='All Students' (0-1 fraction of grads with
                                  any in-state employment / wage record that year).
  grad_avg_earnings_lowincome  <- [9vfm-6vxq]  average_earnings for
                                  stu_grp='Economically Disadvantaged' -- the same
                                  measure for the district's low-income grads, to
                                  surface the earnings equity gap. (DESE's
                                  "Economically Disadvantaged" is its current
                                  low-income flag.)

COHORT / YEAR CHOICE:
  The dataset tracks each HS-grad cohort (hs_grad_year 2010-2021) forward through
  every later earnings_year up to 2021 (the latest published). We fix on the
  hs_grad_year=2016 cohort observed in earnings_year=2021 -- i.e. earnings ~5 years
  after graduation, the most recent cohort with a full 5-year maturity window. Five
  years out is late enough that most grads have left college / settled into work, so
  the figure reflects real labor-market outcomes rather than part-time student wages,
  while 2021 keeps it the most recent data available. All Students.

UNITS / FILTERS:
  * district_code='00000000' is the statewide roll-up row -- dropped (atlas universe
    is the per-district geojson). norm() zero-pads DESE codes to the atlas's 8-char
    DIST_CODE (DESE already emits 8-char here, but zfill is idempotent + future-proof).
  * average_earnings arrives as a STRING dollar amount; cast to float, store as a
    plain number (atlas format:"usd"). Suppressed / missing earnings -> null, never 0.
  * employment pct = employed_count / grad_count, both ints; stored only when
    grad_count > 0. 0-1 fraction to match the atlas's other *_pct columns. Observed
    statewide range is ~0.21-0.81; no district exceeds 1.

COVERAGE (HS-only universe is expected -- K-8 districts have no HS grads and are
correctly absent / null):
  Of the 281 geojson districts, ~216 are HS-granting and appear here. All ~216 carry
  All-Students earnings + employment; ~209 also carry the Economically-Disadvantaged
  earnings slice (the remainder suppressed for small low-income cohorts).

The companion industry/NAICS dataset (wxc8-6an4) splits earnings across many industry
codes per district -- too granular to collapse into one honest district metric, and
no single industry is a clean district-wide signal, so it is intentionally NOT used.

Output: ``data/ma_district_earnings.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_earnings.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_earnings.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "9vfm-6vxq"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

HS_GRAD_YEAR = "2016"   # cohort that graduated HS in 2016
EARNINGS_YEAR = "2021"  # observed ~5 years out; latest earnings year published


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char DIST_CODE."""
    return str(code).zfill(8)


def to_num(v):
    """Cast a DESE string/number to float; '', None or non-positive -> None
    (treat 0 / blank as suppressed-or-missing, never a real value)."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def to_int(v):
    if v is None or v == "":
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def fetch_group(stu_grp: str) -> list[dict]:
    return soda(DATASET, {
        "$where": f"hs_grad_year='{HS_GRAD_YEAR}' AND earnings_year='{EARNINGS_YEAR}' "
                  f"AND stu_grp='{stu_grp}' AND district_code!='00000000'",
        "$select": "district_code,grad_count,employed_count,average_earnings",
        "$limit": "5000",
    })


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    earn_hits = emp_hits = 0
    for r in fetch_group("All Students"):
        dc = norm(r.get("district_code"))
        if dc not in out:
            continue
        earn = to_num(r.get("average_earnings"))
        if earn is not None:
            out[dc]["grad_avg_earnings"] = round(earn)
            earn_hits += 1
        grad = to_int(r.get("grad_count"))
        emp = to_int(r.get("employed_count"))
        if grad and grad > 0 and emp is not None:
            out[dc]["grad_employment_pct"] = round(emp / grad, 4)
            emp_hits += 1

    # Equity slice: same earnings measure for low-income (Economically
    # Disadvantaged) grads, to expose the earnings gap.
    li_hits = 0
    for r in fetch_group("Economically Disadvantaged"):
        dc = norm(r.get("district_code"))
        if dc not in out:
            continue
        earn = to_num(r.get("average_earnings"))
        if earn is not None:
            out[dc]["grad_avg_earnings_lowincome"] = round(earn)
            li_hits += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  grad_avg_earnings:            {earn_hits} "
          f"(grad {HS_GRAD_YEAR} / earnings {EARNINGS_YEAR}, All Students)")
    print(f"  grad_employment_pct:         {emp_hits}")
    print(f"  grad_avg_earnings_lowincome: {li_hits} (Economically Disadvantaged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
