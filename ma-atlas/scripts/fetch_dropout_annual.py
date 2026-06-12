"""
ANNUAL (single-year) dropout rate per district for the atlas's Outcomes
category. Pulls from MA DESE open data (Education-to-Career hub, Socrata) and
writes a side-join file keyed by 8-digit DIST_CODE.

WHY THIS FETCHER EXISTS — it is NOT the dropout rate the atlas already has.
The atlas's existing ``dropout_pct`` (baked on the district geojson) is the
4-YEAR COHORT dropout rate: of a single 9th-grade cohort, the share that had
dropped out by the end of year four (it completes to 100% with grad_4yr,
still_enrolled_pct, ged_pct, etc.). This fetcher ships the ANNUAL dropout rate
instead: the share of grades 9-12 students who dropped out in ONE school year
(drpout_cnt / enroll_cnt for that year). The two answer different questions and
differ materially — across MA districts the mean absolute gap is ~2.0
percentage points, and ~2/3 of districts differ by >0.5pp — so this is genuinely
new district detail, not a duplicate of the cohort rate.

  Source: "Dropout Report" [cmm7-ttbg], SY2025 (latest; the table runs
  2006..2025). org_type='District', stu_grp='All Students'. Column used:
  drpout_pct_all (already a 0-1 fraction = annual dropouts / grades 9-12
  enrollment). enroll_cnt_all / drpout_cnt_all are read only to tell a TRUE 0%
  (a district that really had 0 dropouts, with real enrollment) from a
  missing/zero-enrollment row.

  dropout_annual_pct = drpout_pct_all   (annual, grades 9-12, All Students)

SUPPRESSION / MISSING: only districts that operate grades 9-12 report a value;
elementary-only districts are absent (left null). A genuine 0.0 (drpout_cnt_all
== 0 with real enroll_cnt_all > 0) is a true 0% and KEPT — exactly as the cohort
dropout_pct keeps real low values. A 0 with no/zero enrollment, or a blank, is
stored as null, NEVER 0 (a 0 would poison choropleth ramps and ranks). Charter
"districts" (04xxxxxx) and other non-academic-district orgs in the feed are
dropped because they are outside the geojson's academic-district universe.

Output: data/ma_district_dropout_annual.json :: { DIST_CODE: {col: value} },
fraction rounded to 4 dp, restricted to the data/ma_academic_districts.geojson
DIST_CODE universe (state row 00000000 dropped), districts that got nothing
omitted. Prints coverage.

Run from repo root::  python scripts/fetch_dropout_annual.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_dropout_annual.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "cmm7-ttbg"  # Dropout Report
SY = "2025"            # latest school year published in cmm7-ttbg
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE drops leading zeros; the atlas uses zero-padded 8-char codes."""
    return str(code).zfill(8)


def to_frac(v):
    """drpout_pct_all is published as a 0-1 fraction. Returns None for
    blanks/non-numeric; guards against a stray percent-style value."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_int(v):
    if v is None or v == "":
        return None
    try:
        return int(round(float(v)))
    except (ValueError, TypeError):
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    ours.discard("00000000")  # never the state-totals row

    out: dict[str, dict] = {dc: {} for dc in ours}

    rows = soda(DATASET, {
        "$where": f"sy='{SY}' AND org_type='District' AND stu_grp='All Students'",
        "$select": "dist_code,drpout_pct_all,drpout_cnt_all,enroll_cnt_all",
        "$limit": "5000",
    })
    n = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        frac = to_frac(r.get("drpout_pct_all"))
        if frac is None:
            continue
        # Keep a genuine 0% only when it's a real zero: 0 dropouts AND real
        # enrollment. A 0 with no/zero enrollment is "no grades 9-12 here",
        # which is absence, not a value -> leave null (never store 0).
        if frac == 0.0:
            enr = to_int(r.get("enroll_cnt_all"))
            cnt = to_int(r.get("drpout_cnt_all"))
            if not (enr and enr > 0 and cnt == 0):
                continue
        out[dc]["dropout_annual_pct"] = round(frac, 4)
        n += 1

    # Drop districts that got nothing, keep file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(of {len(ours)} academic-district universe)")
    print(f"  dropout_annual_pct  {n:>3}  (SY{SY}, annual grades 9-12, All Students, 0-1 fraction)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
