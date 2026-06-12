"""
Add a "School climate & safety" district lens to the atlas. The atlas already has
discipline RATES (suspension/expulsion); this adds three DISTINCT safety/climate
signals from MA DESE open data (Education-to-Career hub, Socrata), keyed by
DIST_CODE:

  bullying_per_100      <- Student Discipline   [2kca-w7rq]  stu_discipl_cnt(Bullying)/stu_cnt *100
  restraint_per_100     <- Student Restraints   [3ss8-pnvb]  SUM(stu_rest_cnt)/enrollment   *100
  law_referral_per_100  <- Student Discipline   [2kca-w7rq]  lawenf_ref_pct(All Offenses)   *100

All three are PER-100-STUDENTS rates (higher = worse → OrRd palette). Suppressed /
unreported values are stored as ``null`` (never 0), so a small district that DESE
masked does not read as "perfectly safe". Slice: latest published year SY2025,
stu_grp='All Students'.

----------------------------------------------------------------------------------
PER-METRIC SOURCING NOTES (what's real, what was dropped, and why)
----------------------------------------------------------------------------------

bullying_per_100 — Student Discipline [2kca-w7rq], offense='Bullying'.
  DESE's discipline dataset reports, per district, the unduplicated count of
  students DISCIPLINED for a given offense (stu_discipl_cnt) out of enrollment
  (stu_cnt, which on every offense row equals the district's discipline-universe
  enrollment). We take the 'Bullying' offense row and compute disciplined-for-
  bullying per 100 enrolled students. NOTE this is bullying that resulted in a
  DISCIPLINARY action, not all reported/investigated bullying incidents — MA's
  raw bullying-incident counts (Ch. 92 of the Acts of 2010 reporting) are not
  published as a queryable district table on the open-data domain. Districts with
  NO 'Bullying' offense row (i.e. zero disciplined OR a count small enough to be
  suppressed) are stored as null, not 0 — 181/~396 districts have a value.

restraint_per_100 — Student Restraints [3ss8-pnvb].
  DESE's physical-restraint report is published at the SCHOOL level (org_type
  'Public Schools', one row per school) carrying the parent dist_code. There is
  NO district-rollup row in the dataset, so we AGGREGATE: sum stu_rest_cnt (the
  number of distinct students physically restrained) across a district's listed
  schools. The dataset lists only a SUBSET of schools (those in the restraint
  report), and each row's enroll_cnt is just that one school's enrollment, so
  summing the dataset's own enroll_cnt UNDER-counts the district denominator.
  We therefore use the district's full SY2025 enrollment (TOTAL_CNT__2025 on
  ma_academic_districts.geojson) as the denominator — the correct base for a
  district-wide "students restrained per 100 enrolled" rate. A district that
  appears in the report with summed restraints = 0 is a genuine 0 (it reported);
  a district that does not appear at all, or has no usable enrollment, is null.
  tot_rest_cnt (total restraint *incidents*, which can exceed students) and
  inj_cnt (restraint injuries) are available but NOT shipped — students-restrained
  is the cleaner, more comparable headline; the others are documented here.

law_referral_per_100 — Student Discipline [2kca-w7rq], offense='All Offenses',
  column lawenf_ref_pct.
  The brief proposed federal CRDC (US DOE OCR) for referrals to law enforcement,
  but DESE publishes lawenf_ref_pct (fraction of enrolled students referred to a
  law-enforcement agency) DIRECTLY on the same discipline dataset the atlas
  already uses — same district granularity, same SY2025 cadence, no multi-year
  federal lag, no extra source. We ship the DESE column (×100 = referrals per 100
  students) instead of CRDC. It is rare in MA: 314 districts report a value
  (genuine 0s kept); ~22 are nonzero; 82 districts are null (suppressed/unreported
  → stored as null). The sibling column arrest_pct (school-based arrests) exists
  but only ~11 districts are nonzero — too sparse to be a useful map layer, so it
  is documented here and NOT shipped.

VOCAL (Views of Climate and Learning) student survey — NOT SHIPPED, no district
  source. The VOCAL Index dataset [bfp2-2pmt] (and Item Response [jqvp-ngaw])
  publish the safety/engagement/environment climate indices ONLY at the STATE
  level on the open-data domain: across every survey year (2018-2025) the only
  dist_code present is 00000000 (State). No district roll-up is published as a
  queryable table, so a district `vocal_safety_index` cannot be sourced and is
  deliberately omitted rather than fabricated. (School-level VOCAL reports live on
  a non-tabular DESE resource page, [jgga-jdgw], not a district table.)

----------------------------------------------------------------------------------
Output: ``data/ma_district_climate_safety.json`` :: { DIST_CODE: {col: value} }
All three columns are per-100-students rates rounded to 3 decimals.

Run from repo root::  python scripts/fetch_climate_safety.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_climate_safety.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest published school year in [2kca-w7rq] and [3ss8-pnvb]
ENROLL_PROP = "TOTAL_CNT__2025"  # district SY2025 enrollment denominator (geojson)


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_num(v):
    """Parse a raw numeric value (no rescaling). Returns float or None."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def main() -> int:
    feats = json.loads(DISTS.read_text())["features"]
    ours = {f["properties"]["DIST_CODE"] for f in feats}
    # District SY2025 enrollment, used as the denominator for restraint rates.
    enroll = {}
    for f in feats:
        p = f["properties"]
        e = to_num(p.get(ENROLL_PROP))
        if e and e > 0:
            enroll[p["DIST_CODE"]] = e
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) bullying_per_100 — students disciplined for bullying / enrollment * 100.
    #    Student Discipline [2kca-w7rq], offense='Bullying', latest SY, All Students,
    #    District level. stu_cnt is the district enrollment on every offense row;
    #    stu_discipl_cnt is the count disciplined for THIS offense.
    brows = soda("2kca-w7rq", {
        "$where": f"org_type='District' AND stu_grp='All Students' "
                  f"AND offense='Bullying' AND sy='{SY}'",
        "$select": "dist_code,stu_cnt,stu_discipl_cnt",
        "$limit": "5000",
    })
    bull_hits = 0
    for r in brows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        denom = to_num(r.get("stu_cnt"))
        num = to_num(r.get("stu_discipl_cnt"))
        if denom and denom > 0 and num is not None:
            out[dc]["bullying_per_100"] = round(num / denom * 100.0, 3)
            bull_hits += 1

    # 2) law_referral_per_100 — referrals to law enforcement per 100 students.
    #    Student Discipline [2kca-w7rq], offense='All Offenses', column
    #    lawenf_ref_pct (fraction of enrolled students referred). Null when DESE
    #    did not publish a value (suppressed) — kept null, never 0. Genuine 0s
    #    (district reported, no referrals) are kept.
    arows = soda("2kca-w7rq", {
        "$where": f"org_type='District' AND stu_grp='All Students' "
                  f"AND offense='All Offenses' AND sy='{SY}'",
        "$select": "dist_code,lawenf_ref_pct",
        "$limit": "5000",
    })
    law_hits = 0
    for r in arows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        frac = to_num(r.get("lawenf_ref_pct"))  # already a 0-1 fraction
        if frac is not None:
            out[dc]["law_referral_per_100"] = round(frac * 100.0, 3)
            law_hits += 1

    # 3) restraint_per_100 — distinct students physically restrained per 100
    #    enrolled. Student Restraints [3ss8-pnvb] is school-level (org_type
    #    'Public Schools'); aggregate stu_rest_cnt to the parent district, then
    #    divide by the district's full SY2025 enrollment (geojson TOTAL_CNT__2025),
    #    since the dataset lists only a subset of schools and its own enroll_cnt
    #    would under-count the denominator.
    rrows = soda("3ss8-pnvb", {
        "$where": f"sy='{SY}' AND org_type='Public Schools'",
        "$select": "dist_code,stu_rest_cnt",
        "$limit": "5000",
    })
    agg: dict[str, float] = {}
    seen_dist: set[str] = set()
    for r in rrows:
        dc = norm(r.get("dist_code"))
        if dc not in out:  # skips state/collab rollups and out-of-universe codes
            continue
        seen_dist.add(dc)
        st = to_num(r.get("stu_rest_cnt"))
        if st is not None:
            agg[dc] = agg.get(dc, 0.0) + st
    rest_hits = 0
    for dc in seen_dist:
        denom = enroll.get(dc)
        if not denom:
            continue  # no usable district enrollment → null, don't fabricate
        num = agg.get(dc, 0.0)  # district appeared in the report; 0 = genuine
        out[dc]["restraint_per_100"] = round(num / denom * 100.0, 3)
        rest_hits += 1

    # Drop districts that got nothing, keep the file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  bullying_per_100:     {bull_hits}  (disciplined-for-bullying /100 enrolled)")
    print(f"  restraint_per_100:    {rest_hits}  (students restrained /100 enrolled)")
    print(f"  law_referral_per_100: {law_hits}  (law-enforcement referrals /100 enrolled)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
