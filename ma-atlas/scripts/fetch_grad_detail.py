"""
Add the remaining 4-year cohort-outcome categories from MA DESE's High School
Graduation Rates dataset (Education-to-Career hub, Socrata [n2xa-p822]) — the
same dataset the atlas already mines for grad_4yr / dropout_pct. The 4-year
adjusted cohort always sums to 100%:

  grad_pct + in_sch_pct + non_grad_pct + ged_pct + drpout_pct + exclud_pct = 1.0

The atlas already carries grad_pct (grad_4yr) and drpout_pct (dropout_pct). This
script pulls the FOUR remaining, distinct outcome categories and writes a join
file keyed by DIST_CODE:

  still_enrolled_pct        <- in_sch_pct   (still enrolled after 4 yrs, not yet grad/dropout)
  ged_pct                   <- ged_pct      (earned a GED)
  non_grad_completer_pct    <- non_grad_pct (non-grad completer: certificate of attainment)
  permanently_excluded_pct  <- exclud_pct   (permanently excluded / other)

Filters: org_type='District', stu_grp='All Students',
grad_rate_type='4-Year Graduation Rate', latest year (SY2025).

Output: ``data/ma_district_grad_detail.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1); DESE already publishes these as fractions, to_frac
leaves them untouched. Only districts with a 4-year cohort (those operating a
high school) appear — the rest of the atlas's academic districts are
elementary-only and have no graduating cohort, exactly as for grad_4yr.

Run from repo root::  python scripts/fetch_grad_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_grad_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "n2xa-p822"
SY = "2025"
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
    """Normalize a value to a 0–1 fraction. The cohort columns ship as fractions
    already (e.g. 0.044); divide only if a percent (>1) ever slips through."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


# DESE source column -> atlas output column
COLMAP = {
    "in_sch_pct":   "still_enrolled_pct",
    "ged_pct":      "ged_pct",
    "non_grad_pct": "non_grad_completer_pct",
    "exclud_pct":   "permanently_excluded_pct",
}


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 4-year adjusted cohort, All Students, latest year (SY2025), District level.
    rows = soda(DATASET, {
        "$where": "org_type='District' AND stu_grp='All Students' "
                  f"AND grad_rate_type='4-Year Graduation Rate' AND sy='{SY}'",
        "$select": "dist_code," + ",".join(COLMAP),
        "$limit": "5000",
    })

    hits = {dst: 0 for dst in COLMAP.values()}
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        for src, dst in COLMAP.items():
            v = to_frac(r.get(src))
            if v is not None:
                out[dc][dst] = round(v, 4)
                hits[dst] += 1

    # Drop districts that got nothing (elementary-only, no 4-year cohort)
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY}, 4-yr cohort)")
    for dst, n in hits.items():
        print(f"  {dst:24s} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
