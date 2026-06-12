"""
Pull MA DESE **Early College** participation into a district-keyed join file.

Early College is a selectively designated DESE program in which high-school
students take real college courses (with a partner institution) for college
credit while still in high school. Only ~40 districts run a designated program,
so this is an HS-only, low-coverage metric by nature.

SOURCES (Education-to-Career hub, Socrata; domain educationtocareer.data.mass.gov):
  * Early College Participation [p2yd-4gvj] — participant head-counts by grade,
    one row per (school org_code x partner college ceeb_code x term `period`).
    cols: dist_code, org_code, sy, period, stu_grp, g09_cnt..g12_cnt, all_cnt.
    Latest full year with a complete term: SY2024 (Fall).
  * Enrollment by Grade [t8td-gens] — district grade 9-12 head-counts, used as
    the HS denominator for the participation rate (org_type='District', same SY).

DERIVED COLUMNS (All Students, SY2024):
  early_college_participants  <- sum(all_cnt) over a district's school x partner
                                 rows. NOTE: a student enrolled with two partner
                                 colleges is counted once per partner, so this is
                                 participant-*enrollments* (program reach), not an
                                 unduplicated student count. Stored as a raw count.
  early_college_pct           <- early_college_participants / (g9..g12 enrollment).
                                 Because the numerator can exceed an unduplicated
                                 head-count (multi-partner students) this reads as
                                 "early-college course enrollments per HS student";
                                 a few intensive programs can approach/exceed ~1.
                                 Stored as a 0-1 fraction (atlas *_pct convention).
  early_college_g12_pct       <- sum(g12_cnt) / g12 enrollment — share of the
                                 SENIOR class taking early-college courses. g12 is
                                 single-grade so this has far less multi-partner
                                 inflation and is the cleanest "how many seniors"
                                 read. 0-1 fraction.

EARLY-COLLEGE CREDITS [yau2-eqsf] (All Students, SY2023 — latest published; one
row per school x partner x term, numeric cols stored as text so summed via
::number on the server):
  early_college_credits_per_student  <- sum(earned_credit_cnt) / sum(stu_cnt).
                                 Both sides are summed over Fall+Spring terms, so
                                 the denominator is student-*term*-enrollments;
                                 reads as "college credits EARNED per participating
                                 student-term". Raw count (format num).
  early_college_credit_success_pct   <- sum(earned_credit_cnt) /
                                 sum(reg_credits_cnt) — share of registered college
                                 credits the cohort actually earned (course-pass
                                 quality). Ratio-of-totals, so it is robust to the
                                 term/partner double-counting above. 0-1 fraction.

UNIVERSE / SUPPRESSION:
  * Restricted to DIST_CODEs present in data/ma_academic_districts.geojson; the
    00000000 state row is never queried. Districts with no Early College program
    simply have no row in p2yd-4gvj -> they are absent here (no-data), NOT 0.
  * A rate is only written when the matching grade denominator is > 0; otherwise
    null (never 0), so ranks/choropleths aren't poisoned.

Output: data/ma_district_early_college.json :: { DIST_CODE: {col: value, ...} }
Run from repo root::  python scripts/fetch_early_college.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_early_college.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

PART_SY = "2024"   # latest full Early College participation year (p2yd-4gvj, Fall)
PART_PERIOD = "Fall"
ENR_SY = "2024"    # matching enrollment-by-grade year (t8td-gens)
CRED_SY = "2023"   # latest Early College credits year (yau2-eqsf)


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 350000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def num(v):
    if v is None or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) HS (grade 9-12) enrollment denominator, District level, matching SY.
    enr = soda("t8td-gens", {
        "$where": f"sy='{ENR_SY}' AND org_type='District'",
        "$select": "dist_code,g9_cnt,g10_cnt,g11_cnt,g12_cnt",
        "$limit": "5000",
    })
    hs_enr: dict[str, float] = {}
    g12_enr: dict[str, float] = {}
    for r in enr:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        hs = num(r.get("g9_cnt")) + num(r.get("g10_cnt")) + \
            num(r.get("g11_cnt")) + num(r.get("g12_cnt"))
        if hs > 0:
            hs_enr[dc] = hs
        g12 = num(r.get("g12_cnt"))
        if g12 > 0:
            g12_enr[dc] = g12

    # 2) Early College participation — All Students, latest full term. Aggregate
    #    the per-school x per-partner rows up to the district.
    part = soda("p2yd-4gvj", {
        "$where": f"sy='{PART_SY}' AND period='{PART_PERIOD}' "
                  "AND stu_grp='All Students'",
        "$select": "dist_code,g12_cnt,all_cnt",
        "$limit": "5000",
    })
    participants: dict[str, float] = {}
    g12_part: dict[str, float] = {}
    for r in part:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        participants[dc] = participants.get(dc, 0.0) + num(r.get("all_cnt"))
        g12_part[dc] = g12_part.get(dc, 0.0) + num(r.get("g12_cnt"))

    n_part = n_rate = n_g12 = 0
    for dc, tot in participants.items():
        if tot <= 0:
            continue
        out[dc]["early_college_participants"] = int(round(tot))
        n_part += 1
        denom = hs_enr.get(dc)
        if denom and denom > 0:
            out[dc]["early_college_pct"] = round(tot / denom, 4)
            n_rate += 1
        g12d = g12_enr.get(dc)
        g12n = g12_part.get(dc, 0.0)
        if g12d and g12d > 0 and g12n > 0:
            out[dc]["early_college_g12_pct"] = round(min(g12n / g12d, 1.0), 4)
            n_g12 += 1

    # 3) Early College credits — All Students, summed over terms on the server.
    cred = soda("yau2-eqsf", {
        "$where": f"sy='{CRED_SY}' AND stu_grp='All Students'",
        "$select": "dist_code,sum(stu_cnt::number) as stu,"
                   "sum(reg_credits_cnt::number) as reg,"
                   "sum(earned_credit_cnt::number) as earned",
        "$group": "dist_code",
        "$limit": "5000",
    })
    n_cps = n_succ = 0
    for r in cred:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        stu, reg, earned = num(r.get("stu")), num(r.get("reg")), num(r.get("earned"))
        if stu > 0 and earned > 0:
            out[dc]["early_college_credits_per_student"] = round(earned / stu, 2)
            n_cps += 1
        if reg > 0 and earned > 0:
            out[dc]["early_college_credit_success_pct"] = round(min(earned / reg, 1.0), 4)
            n_succ += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  early_college_participants: {n_part} (SY{PART_SY} {PART_PERIOD})")
    print(f"  early_college_pct:          {n_rate} (vs grade 9-12 enrollment SY{ENR_SY})")
    print(f"  early_college_g12_pct:      {n_g12} (seniors)")
    print(f"  early_college_credits_per_student: {n_cps} (SY{CRED_SY})")
    print(f"  early_college_credit_success_pct:  {n_succ} (SY{CRED_SY})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
