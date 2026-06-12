"""
Special-education DYNAMICS + alternate assessment + student attrition + SWD
post-secondary progression for MA districts, pulled from MA DESE open data
(Education-to-Career hub, Socrata) into one join file keyed by DIST_CODE.

These add four lenses the atlas did not have:
  * how students with the most significant disabilities perform on the alternate
    assessment (MCAS-Alt) — distinct from the standard MCAS the atlas already maps;
  * how much a district's special-education roster CHURNS year to year (students
    moving into / out of SpEd services);
  * how much the district loses students between grades overall (attrition);
  * longer-horizon outcomes for students-with-disabilities (5-yr graduation and
    2nd-year college persistence) that the atlas's existing SWD slice
    (immediate college enrollment) did not include.

Output columns (atlas id <- source, latest published period, atlas coverage of the
281-district universe in parens; all clear the >=40%-of-districts bar):

  mcas_alt_progressing_pct  <- ks7h-2kdy  (MCAS Alternate Assessment, SY2025)  48%
  sped_movein_pct           <- 8aww-sugs  (SpEd move in/out, SY2025)          100%
  sped_moveout_pct          <- 8aww-sugs  (SpEd move in/out, SY2025)          100%
  student_attrition_pct     <- 4as3-w39x  (Student Attrition, SY2026)         100%
  swd_grad_5yr_pct          <- cdfp-645n  (SWD HS->postsec, cohort 2023)       78%
  swd_college_persist_pct   <- cdfp-645n  (SWD HS->postsec, cohort 2023)       78%

────────────────────────────────────────────────────────────────────────────────
1. MCAS-ALT  ::  ks7h-2kdy  "MCAS Alternate Assessment (MCAS-Alt)"  SY2025
   The MCAS-Alt is the portfolio assessment taken by the ~1% of students with the
   most significant cognitive disabilities (in place of the standard MCAS). DESE
   scores each student Progressing / Emerging / Awareness / Incomplete; the four
   shares (prog/emrg/awr/incomplt _pct) sum to ~1.0 per district-subject. We ship
   the % at PROGRESSING (the top performance level) for the whole tested group.
   There is no student-group breakdown in this dataset and no "All subjects" row,
   so we COUNT-WEIGHT-COMBINE the two universal academic subjects offered at every
   tested grade — English Language Arts + Mathematics — into one comparable rate:
        sum(prog_cnt) / sum(tot_stu_cnt)  over {ELA, Math}, district-level.
   (Science/Civics are grade-band-limited, so folding them in would mix universes;
   they are excluded for comparability.) org_type='District' is the district roll-up
   (School / Collaborative rows are dropped). Combining from counts also dodges the
   rounded-to-0 trap: prog_pct is published to 2 decimals, but we never read it.

2. SPED CHURN  ::  8aww-sugs  "Students Moving In and Out of Special Education
   Services"  SY2025.  Uses the grades='K-12' district roll-up row. Fields:
   sped_tot (students in SpEd), movein_cnt / moveout_cnt (entered / exited SpEd
   services over the year). DENOMINATOR = sped_tot (the special-ed population), not
   total enrollment: these are rates of SpEd-roster turnover —
        sped_movein_pct  = movein_cnt  / sped_tot
        sped_moveout_pct = moveout_cnt / sped_tot
   i.e. "of the district's SpEd students, what share newly entered / left services
   this year." (Dividing by total enrollment would bury the signal — SpEd is ~20%
   of students, so both rates would compress toward zero and stop differentiating
   districts.) A district with sped_tot=0 is skipped (null, never a divide-by-zero).

3. ATTRITION  ::  4as3-w39x  "Student Attrition"  SY2026.  Attrition = students
   enrolled in a grade in year N who are not enrolled in the district the following
   October (per-grade gk_pct..g11_pct; grade 12 has no successor grade so it is not
   measured). DESE also publishes grd_all, its own all-grade district summary, which
   we ship directly as student_attrition_pct for org_type='District',
   stu_grp='All Students'. (Shipping DESE's published all-grade figure avoids
   inventing an ad-hoc per-grade average over unequal grade sizes.) A value that
   rounds to exactly 0.0 is stored as null: at 3-decimal precision a true-zero and a
   suppressed/too-small cell are indistinguishable, and a 0 would poison ranks
   (see scripts/analysis/data_anomalies.md). Real values run ~0.01-0.26.

4. SWD POSTSEC  ::  cdfp-645n  "Special Education Student Progression from High
   School Through Postsecondary"  cohort 2023.  stu_grp='Students with Disabilities'.
   This dataset tracks the SWD graduating cohort forward. We ship the two outcomes
   the atlas did NOT already have for SWD:
        swd_grad_5yr_pct        <- grad_5yr_pct  (graduated within 5 years)
        swd_college_persist_pct <- persist_pct   (still enrolled in postsec into the
                                                  2nd year — the persistence rate)
   These are the SWD analogues of the all-students grad_5yr and college_persist_pct
   already in the atlas.
   NOT SHIPPED — coll_imm_fall_pct (immediate college enrollment for SWD): the atlas
   ALREADY has this as `college_enroll_swd` (from sg4g-eg2n, fetch_postsec_detail.py),
   so it would duplicate an existing metric. Dropped to avoid a dupe, documented here.
   A pct that rounds to exactly 0.0 is stored as null (same reasoning as attrition).

Universe / suppression conventions (shared with the other fetchers):
  * norm(code) = str(code).zfill(8) — DESE drops leading zeros; the atlas uses
    zero-padded 8-char DIST_CODEs.
  * Only districts present in data/ma_academic_districts.geojson are kept; the
    statewide row dist_code='00000000' is dropped everywhere.
  * Store null (omit the key), never 0, for suppressed/missing/zero-denominator.
  * A district that gets nothing is dropped from the output entirely.

Output: data/ma_district_sped_dynamics.json :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_sped_dynamics.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_sped_dynamics.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# Latest published period per dataset (confirmed live via $group on `sy`/`cohort_yr`).
SY_ALT = "2025"          # ks7h-2kdy MCAS-Alt
SY_CHURN = "2025"        # 8aww-sugs move in/out
SY_ATTR = "2026"         # 4as3-w39x attrition
COHORT_SWD = "2023"      # cdfp-645n SWD postsec progression


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def fnum(v):
    """Parse a Socrata numeric string to float, or None if blank/garbage."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def pct_or_null(v):
    """A published 0-1 pct -> float, but a value rounding to exactly 0.0 is treated
    as suppressed/indistinguishable and returned as None (never store 0)."""
    f = fnum(v)
    if f is None or f <= 0:
        return None
    if f > 1.5:           # guard a stray percent-form value
        f /= 100.0
    return f


def fetch_mcas_alt(out: dict) -> int:
    """% Progressing on MCAS-Alt, count-weighted over ELA+Math, district roll-up."""
    rows = soda("ks7h-2kdy", {
        "$where": (f"sy='{SY_ALT}' AND org_type='District' AND dist_code!='00000000' "
                   f"AND (subj='English Language Arts' OR subj='Mathematics')"),
        "$select": "dist_code,subj,prog_cnt,tot_stu_cnt",
        "$limit": "5000",
    })
    agg: dict[str, list[float]] = {}   # dc -> [sum prog_cnt, sum tot_stu_cnt]
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        prog, tot = fnum(r.get("prog_cnt")), fnum(r.get("tot_stu_cnt"))
        if prog is None or tot is None or tot <= 0:
            continue
        a = agg.setdefault(dc, [0.0, 0.0])
        a[0] += prog
        a[1] += tot
    n = 0
    for dc, (prog, tot) in agg.items():
        if tot > 0:
            v = prog / tot
            if v > 0:                  # an all-zero Progressing roll-up -> null
                out[dc]["mcas_alt_progressing_pct"] = round(v, 4)
                n += 1
    return n


def fetch_sped_churn(out: dict) -> tuple[int, int]:
    """SpEd move-in / move-out as a share of the SpEd population (grades='K-12')."""
    rows = soda("8aww-sugs", {
        "$where": f"sy='{SY_CHURN}' AND grades='K-12' AND dist_code!='00000000'",
        "$select": "dist_code,sped_tot,movein_cnt,moveout_cnt",
        "$limit": "5000",
    })
    nin = nout = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        sped = fnum(r.get("sped_tot"))
        if not sped or sped <= 0:      # no SpEd population -> both null
            continue
        mi, mo = fnum(r.get("movein_cnt")), fnum(r.get("moveout_cnt"))
        if mi is not None and mi > 0:
            out[dc]["sped_movein_pct"] = round(mi / sped, 4); nin += 1
        if mo is not None and mo > 0:
            out[dc]["sped_moveout_pct"] = round(mo / sped, 4); nout += 1
    return nin, nout


def fetch_attrition(out: dict) -> int:
    """DESE's published all-grade attrition summary (grd_all) for All Students."""
    rows = soda("4as3-w39x", {
        "$where": (f"sy='{SY_ATTR}' AND org_type='District' "
                   f"AND stu_grp='All Students' AND dist_code!='00000000'"),
        "$select": "dist_code,grd_all",
        "$limit": "5000",
    })
    n = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        v = pct_or_null(r.get("grd_all"))
        if v is not None:
            out[dc]["student_attrition_pct"] = round(v, 4); n += 1
    return n


def fetch_swd_postsec(out: dict) -> tuple[int, int]:
    """5-yr graduation + 2nd-year college persistence for Students with Disabilities."""
    rows = soda("cdfp-645n", {
        "$where": (f"cohort_yr='{COHORT_SWD}' AND stu_grp='Students with Disabilities' "
                   f"AND dist_code!='00000000'"),
        "$select": "dist_code,grad_5yr_pct,persist_pct",
        "$limit": "5000",
    })
    ng = np = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        g = pct_or_null(r.get("grad_5yr_pct"))
        p = pct_or_null(r.get("persist_pct"))
        if g is not None:
            out[dc]["swd_grad_5yr_pct"] = round(g, 4); ng += 1
        if p is not None:
            out[dc]["swd_college_persist_pct"] = round(p, 4); np += 1
    return ng, np


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    n_alt = fetch_mcas_alt(out)
    n_in, n_out = fetch_sped_churn(out)
    n_attr = fetch_attrition(out)
    n_grad, n_persist = fetch_swd_postsec(out)

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))

    tot = len(ours)
    def pct(n): return f"{n:3d}/{tot} ({100*n/tot:4.0f}%)"
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {tot})")
    print(f"  mcas_alt_progressing_pct  {pct(n_alt)}   (ks7h-2kdy SY{SY_ALT}, ELA+Math)")
    print(f"  sped_movein_pct           {pct(n_in)}   (8aww-sugs SY{SY_CHURN})")
    print(f"  sped_moveout_pct          {pct(n_out)}   (8aww-sugs SY{SY_CHURN})")
    print(f"  student_attrition_pct     {pct(n_attr)}   (4as3-w39x SY{SY_ATTR})")
    print(f"  swd_grad_5yr_pct          {pct(n_grad)}   (cdfp-645n cohort {COHORT_SWD})")
    print(f"  swd_college_persist_pct   {pct(n_persist)}   (cdfp-645n cohort {COHORT_SWD})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
