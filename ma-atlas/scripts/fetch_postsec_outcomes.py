"""
Pull ACTUAL postsecondary OUTCOMES of Massachusetts high-school graduates from
MA DESE's open data (Education-to-Career hub, Socrata) into a join file keyed by
DIST_CODE. These are real, National-Student-Clearinghouse-derived enrollment and
persistence results -- DISTINCT from the existing self-reported "plans" metrics
(Plans of High School Graduates, 37px-xsir) already in the atlas.

  college_enroll_pct      <- HS Grads Attending Higher Education [kgrx-cg4a]
                             attend_coll_pct (enrolled in ANY college within
                             16 months of HS graduation, as a share of grads)
  college_enroll_4yr_pct  <- [kgrx-cg4a]  priv_4yr_pct + pub_4yr_pct
  college_enroll_2yr_pct  <- [kgrx-cg4a]  priv_2yr_pct + pub_2yr_pct
  college_persist_pct     <- Student Progression from HS through Postsecondary
                             [sg4g-eg2n]  persist_cnt / cohort_cnt, aggregated
                             over schools per district (persisted into a 2nd
                             year of postsecondary, as a share of the cohort)

UNITS / FILTERS:
  * kgrx-cg4a is sliced to org_type='District', stu_grp='All Students',
    attend_range='16 Months', percent_by='High School Grad' (so the pct is of
    ALL grads, not just attendees), in_out_state='All Colleges and Universities'.
    The latest year with a full 16-month follow-up window is SY2023 (SY2024 only
    has the 9-month "March" snapshot). All *_pct fields are 0-1 fractions.
    The 4yr / 2yr sector columns are mutually exclusive shares of HS grads and
    sum to attend_coll_pct, so total 4yr = priv_4yr + pub_4yr, total 2yr =
    priv_2yr + pub_2yr.
  * sg4g-eg2n is published at the SCHOOL level (no district rollup row), so the
    district persistence rate is built from PUBLISHED COUNTS via the Socrata
    server: sum(persist_cnt)/sum(cohort_cnt) grouped by dist_code. DESE's own
    persist_pct uses the entering cohort (cohort_cnt) as the denominator, which
    we match. Latest cohort year published is 2023.

All values are 0-1 fractions to match the atlas's other *_pct / rate columns.

Output: ``data/ma_district_postsec.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_postsec_outcomes.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_postsec.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

ENROLL_SY = "2023"   # latest 16-month follow-up window (kgrx-cg4a)
COHORT_YR = "2023"   # latest progression cohort (sg4g-eg2n)


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a percentage to a 0-1 fraction. DESE here reports 0.748 etc.
    already as a fraction; divide only if a 0-100 percent ever shows up."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) College enrollment within 16 months -- HS Grads Attending Higher
    #    Education, District, All Students, % of all HS grads, all colleges.
    enr = soda("kgrx-cg4a", {
        "$where": "org_type='District' AND stu_grp='All Students' "
                  "AND attend_range='16 Months' AND percent_by='High School Grad' "
                  "AND in_out_state='All Colleges and Universities' "
                  f"AND sy='{ENROLL_SY}'",
        "$select": "dist_code,attend_coll_pct,priv_2yr_pct,pub_2yr_pct,"
                   "priv_4yr_pct,pub_4yr_pct",
        "$limit": "2000",
    })
    enr_hits = yr4_hits = yr2_hits = 0
    for r in enr:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        tot = to_frac(r.get("attend_coll_pct"))
        if tot is not None:
            out[dc]["college_enroll_pct"] = round(tot, 4); enr_hits += 1
        p4, q4 = to_frac(r.get("priv_4yr_pct")), to_frac(r.get("pub_4yr_pct"))
        if p4 is not None and q4 is not None:
            out[dc]["college_enroll_4yr_pct"] = round(p4 + q4, 4); yr4_hits += 1
        p2, q2 = to_frac(r.get("priv_2yr_pct")), to_frac(r.get("pub_2yr_pct"))
        if p2 is not None and q2 is not None:
            out[dc]["college_enroll_2yr_pct"] = round(p2 + q2, 4); yr2_hits += 1

    # 2) Persistence to a 2nd year -- Student Progression from HS through
    #    Postsecondary. School-level source; aggregate published counts per
    #    district on the server: sum(persist_cnt)/sum(cohort_cnt).
    prog = soda("sg4g-eg2n", {
        "$where": f"cohortyr='{COHORT_YR}' AND stu_grp='All Students' "
                  "AND dist_code!='00000000'",
        "$select": "dist_code,sum(cohort_cnt) as coh,sum(persist_cnt) as per",
        "$group": "dist_code",
        "$limit": "2000",
    })
    per_hits = 0
    for r in prog:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        try:
            coh = float(r.get("coh"))
            per = float(r.get("per"))
        except (TypeError, ValueError):
            continue
        if coh > 0:
            out[dc]["college_persist_pct"] = round(per / coh, 4); per_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  college_enroll_pct:      {enr_hits} (SY{ENROLL_SY}, 16mo)")
    print(f"  college_enroll_4yr_pct:  {yr4_hits} (SY{ENROLL_SY})")
    print(f"  college_enroll_2yr_pct:  {yr2_hits} (SY{ENROLL_SY})")
    print(f"  college_persist_pct:     {per_hits} (cohort {COHORT_YR})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
