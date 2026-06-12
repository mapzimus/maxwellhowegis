"""
Add DISTINCT discipline-DETAIL district metrics to the atlas, beyond the
existing disciplined / OSS / ISS rates. Pulls from MA DESE open data
(Education-to-Career hub, Socrata) and writes a join file keyed by DIST_CODE:

  expulsion_pct          <- Student Discipline           [2kca-w7rq] exp_pct
  emergency_removal_pct  <- Student Discipline           [2kca-w7rq] emerg_rmvl_pct
  days_lost_per_100      <- Student Discipline Days Missed [3etc-hecr] days_*_pct

WHY these three (and what we deliberately dropped):

* exp_pct (expulsion rate) and emerg_rmvl_pct (emergency-removal rate) are
  published *_pct columns on the SAME "Student Discipline" dataset the atlas
  already uses, but were NOT used by scripts/fetch_discipline.py (which took
  only out_susp_pct / in_susp_pct / the disciplined-count ratio). Both are
  fractions (0-1) of enrollment. Expulsions are very rare in MA (state-wide
  ~0.0), so most districts read 0.0 — that is real published data, not null.

* days_lost_per_100 is DERIVED from the separate "Student Discipline Days
  Missed" dataset [3etc-hecr], which gives, per district, the share of
  ENROLLED students who lost 1, 2-3, 4-7, 8-10, or >10 days of instruction to
  discipline (days_1_pct, days_2_3_pct, days_4_7_pct, days_8_10_pct,
  days_grtr_10_pct — each a fraction of enrollment, mutually exclusive,
  summing to the disciplined rate). We estimate the AVERAGE instructional days
  lost per 100 students using bucket midpoints (1, 2.5, 5.5, 9, 11 for the
  open-ended >10 bucket) x 100. This is an UNDER-estimate for the top bucket
  (capped at 11) and a small-sample estimate, but is a real, distinct measure
  of instructional time lost to discipline. Kept as a RAW number (days per 100
  students), NOT a fraction.

* multiple_offense_pct / repeat-offender rate: DROPPED. Neither dataset has a
  repeat- or multiple-offense flag. 2kca-w7rq's `offense` field is an
  offense-TYPE taxonomy (fights, weapons, etc.), not a per-student repeat
  indicator, so a clean "share of disciplined students who are repeat
  offenders" cannot be computed and is not published. Not fabricated.

Slice: org_type='District', stu_grp='All Students', offense='All Offenses',
latest published school year (SY2025) — matching scripts/fetch_discipline.py.

Output: ``data/ma_district_discipline_detail.json`` :: { DIST_CODE: {col: val} }
Rates are fractions (0-1) rounded to 4 dp; days_lost_per_100 is a raw number
rounded to 2 dp.

Run from repo root::  python scripts/fetch_discipline_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_discipline_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest published school year in both datasets

# Midpoints (instructional days) for the days-missed buckets. The final bucket
# is open-ended (>10 days); we cap it at 11 so the estimate stays conservative.
DAY_MIDPOINTS = {
    "days_1_pct": 1.0,
    "days_2_3_pct": 2.5,
    "days_4_7_pct": 5.5,
    "days_8_10_pct": 9.0,
    "days_grtr_10_pct": 11.0,
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. Discipline *_pct columns come as
    fractions (0.023) already; detect and divide only if it looks like a percent."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_num(v):
    """Parse a raw numeric value (no rescaling). Returns float or None."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Expulsion + emergency-removal rates — Student Discipline [2kca-w7rq],
    #    latest SY, All Students, All Offenses, district level. Both are
    #    published fractions of enrollment (0-1).
    rows = soda("2kca-w7rq", {
        "$where": f"org_type='District' AND stu_grp='All Students' "
                  f"AND offense='All Offenses' AND sy='{SY}'",
        "$select": "dist_code,exp_pct,emerg_rmvl_pct",
        "$limit": "2000",
    })
    exp_hits = emerg_hits = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        exp = to_frac(r.get("exp_pct"))
        if exp is not None:
            out[dc]["expulsion_pct"] = round(exp, 4); exp_hits += 1
        emerg = to_frac(r.get("emerg_rmvl_pct"))
        if emerg is not None:
            out[dc]["emergency_removal_pct"] = round(emerg, 4); emerg_hits += 1

    # 2) Estimated instructional days lost to discipline per 100 students —
    #    Student Discipline Days Missed [3etc-hecr]. Each days_*_pct is the
    #    share of ENROLLED students who lost that many days; weight by bucket
    #    midpoint and scale to per-100-students.
    dmrows = soda("3etc-hecr", {
        "$where": f"org_type='District' AND stu_grp='All Students' "
                  f"AND offense='All Offenses' AND sy='{SY}'",
        "$select": "dist_code," + ",".join(DAY_MIDPOINTS),
        "$limit": "2000",
    })
    days_hits = 0
    for r in dmrows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        days_per_student = 0.0
        seen = False
        for col, mid in DAY_MIDPOINTS.items():
            frac = to_frac(r.get(col))
            if frac is not None:
                days_per_student += frac * mid
                seen = True
        if seen:
            out[dc]["days_lost_per_100"] = round(days_per_student * 100.0, 2)
            days_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  expulsion_pct:         {exp_hits}/274  (fraction 0-1)")
    print(f"  emergency_removal_pct: {emerg_hits}/274  (fraction 0-1)")
    print(f"  days_lost_per_100:     {days_hits}/274  (raw: est. days/100 students)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
