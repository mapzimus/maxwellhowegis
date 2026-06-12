"""
FEDERAL Civil Rights Data Collection (CRDC) **course-access** district metrics — a
third CRDC slice, complementing scripts/fetch_crdc.py (athletics) and
scripts/fetch_crdc_equity.py (gifted / school policing). These answer the very
relatable parent question DESE leaves unanswered:

  "Does this district's high school actually OFFER Calculus / Physics / Chemistry /
   Algebra II?"

DESE publishes course-TAKING (arts / digital-literacy in the whole-child file) and AP
exam performance, but NOTHING on whether a school OFFERS these specific core advanced
courses. CRDC does: its school-level "offerings" module reports the number of class
sections each school runs in each subject (num_classes_calculus, num_classes_physics,
num_classes_chemistry, num_classes_algebra2, ...). A school OFFERS the course when that
section count is > 0; a definitive 0 means "this school runs no such class"; a negative
CRDC sentinel (-1/-2/-3/-5/-6/-8/-9) means unknown/suppressed and is treated as missing.

Metrics written (district-level, 0-1 fraction, format "pct" in the atlas) — each is
"% of high-school students in schools that OFFER the course", i.e.

      Σ CRDC enrollment of HIGH SCHOOLS that offer the course
      ───────────────────────────────────────────────────────
      Σ CRDC enrollment of HIGH SCHOOLS with a known offering status

  calculus_access_pct  — enrollment-weighted share of HS students in a school
        offering Calculus (num_classes_calculus > 0). The headline metric: many
        comprehensive HSs are at 1.0, but a real tail of small / alternative /
        vocational HSs sit below 1.0 or at 0.0 (no calculus at all).
  physics_access_pct   — same, Physics (num_classes_physics).
  chemistry_access_pct — same, Chemistry (num_classes_chemistry).
  algebra2_access_pct  — same, Algebra II (num_classes_algebra2).

DENOMINATOR CHOICE (documented per the task): only HIGH SCHOOLS count toward the
denominator. These are HS-level courses, so a K-5 or middle school "not offering
calculus" must NOT drag a district down. We define a high school as CCD
`school_level == 3` (the NCES Common Core of Data High level) from
schools/ccd/directory/2017. This is deliberately *cleaner* than the CRDC directory's
g9..g12 grade flags: ~29 MA elementary/middle schools carry a stray grade-9 flag (often
an ungraded / SPED placement) yet serve grades PK-8 and offer zero advanced courses —
using g9..g12 would wrongly pull them into the denominator and depress every district
with such a school (e.g. many Boston K-8s). school_level==3 yields 369 MA high schools,
and the level-3 schools that DO report zero advanced courses are genuine high schools
(alternative / evening / innovation HSs) — a true "this HS offers nothing advanced"
signal, kept, not noise. A district with NO level-3 school (a K-8 district with no high
school) gets null for every course metric, never 0.

Source: U.S. Dept. of Education, Office for Civil Rights, **CRDC 2017-18** (the last
pre-COVID collection — Urban labels it year=2017 — so section counts are not collapsed
by the 2020-21 remote year), served over REST by the Urban Institute Education Data
Portal (https://educationdata.urban.org):

  /api/v1/schools/crdc/offerings/2017/             (num_classes_<subject> = # sections
                                                    the school runs → the offering signal)
  /api/v1/schools/crdc/enrollment/2017/race/sex/   (enrollment_crdc = weighting denominator)
  /api/v1/schools/ccd/directory/2017/              (school_level → identifies high schools)
  /api/v1/school-districts/ccd/directory/2017/     (state_leaid → DESE DIST_CODE crosswalk)

CROSSWALK (NCES → DESE), identical to the other CRDC fetchers: the CCD LEA directory
exposes `state_leaid` = "MA-XXXX" (XXXX = 4-digit DESE org code); DESE's 8-digit
DIST_CODE = XXXX + "0000". Covers all 281 atlas districts.

WHAT WAS CONSIDERED AND SKIPPED (not fabricated):
  * Computer Science access (cs_access_pct): the CRDC 2017-18 collection *did* gather a
    computer-science course indicator, but the Urban Institute API does NOT expose any
    computer-science / CS field on ANY of its CRDC 2017 endpoints (offerings,
    math-and-science, algebra1, dual-enrollment, credit-recovery all checked — no
    comp*/cs*/computer* variable). With no authoritative field to read, cs_access_pct is
    DROPPED rather than fabricated.
  * Advanced Mathematics / Biology / Geometry / Algebra I offerings: also available as
    num_classes_* and could ship, but the four shipped (Calculus, Physics, Chemistry,
    Algebra II) are the clearest "does the HS even offer it?" parent questions; the rest
    are left to avoid metric bloat.
  * AP course offerings (ap_courses_indicator etc.): DESE already covers AP intensity in
    the atlas (ap_participation_pct, ap_* family) — not duplicated, same as the other
    CRDC fetchers.

Output: data/ma_district_crdc_courses.json :: { DIST_CODE: {col: val} }. null (omit) for
any district with no high school or all-suppressed offering status; never a fabricated 0.
Raw Urban API pulls are cached under scripts/.crdc_courses_cache/ (gitignored); only the
small derived JSON is committed. Coverage (districts): all four = 217/281 (the other 64
are K-8 districts with no high school → correctly absent).

Run from repo root::  python scripts/fetch_crdc_courses.py
"""
from __future__ import annotations
import json, urllib.request
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_crdc_courses.json"
CACHE = Path(__file__).resolve().parent / ".crdc_courses_cache"

API = "https://educationdata.urban.org/api/v1"
YEAR = 2017                      # CRDC 2017-18 collection (Urban labels it year=2017);
                                 # last pre-COVID release → section counts not collapsed.
FIPS_MA = 25
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# Subject -> CRDC offerings field holding the count of class sections the school runs.
# A school OFFERS the subject iff this count is > 0. Output metric id is "<key>_access_pct".
SUBJECTS = {
    "calculus":  "num_classes_calculus",
    "physics":   "num_classes_physics",
    "chemistry": "num_classes_chemistry",
    "algebra2":  "num_classes_algebra2",
}


# CRDC negative sentinels (-1 reserved/NA, -2 not-applicable, -3 suppressed,
# -5/-6/-8/-9 various). Anything < 0 is missing/NA, never a real value.
def num(v):
    """Parse a CRDC numeric (may be a '6.000' string). Return float, or None for
    blanks AND for any negative sentinel."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    return None if f < 0 else f


def fetch_all(path: str) -> list[dict]:
    """GET every page of an Urban API endpoint (follows `next`), cached to disk."""
    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / (path.strip("/").replace("/", "_") + ".json")
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    rows: list[dict] = []
    url = f"{API}/{path}?fips={FIPS_MA}&limit=10000"
    while url:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=180) as r:
            j = json.loads(r.read().decode("utf-8"))
        rows += j["results"]
        url = j.get("next")
    cache_file.write_text(json.dumps(rows))
    return rows


def state_leaid_to_distcode(state_leaid) -> str | None:
    """CCD state_leaid 'MA-0753' → DESE DIST_CODE '07530000'."""
    if not state_leaid:
        return None
    s = str(state_leaid)
    if s.startswith("MA-"):
        s = s[3:]
    s = s.strip()
    return s.zfill(4) + "0000" if s.isdigit() else None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}

    # 1) NCES leaid → DESE DIST_CODE crosswalk (via CCD state_leaid).
    ccd = fetch_all(f"school-districts/ccd/directory/{YEAR}")
    lea2dc = {}
    for row in ccd:
        dc = state_leaid_to_distcode(row.get("state_leaid"))
        if dc:
            lea2dc[str(row["leaid"])] = dc

    # 2) High-school identification: CCD school_level == 3 (NCES "High"). This is the
    #    denominator universe — advanced HS courses, so non-HS schools are excluded.
    ccdsch = fetch_all(f"schools/ccd/directory/{YEAR}")
    is_hs = {r["ncessch"]: (r.get("school_level") == 3) for r in ccdsch}

    # 3) Per-school CRDC enrollment (race=Total[99], sex=Total[99]) — the weighting
    #    denominator. (An HS missing CRDC enrollment is simply not weighted; only 1 of
    #    369 MA high schools lacks it.)
    enr = fetch_all(f"schools/crdc/enrollment/{YEAR}/race/sex")
    sch_enroll = {}
    for r in enr:
        if r.get("race") == 99 and r.get("sex") == 99:
            v = num(r.get("enrollment_crdc"))
            if v is not None:
                sch_enroll[r["ncessch"]] = v

    # 4) Per-school course offerings (num_classes_<subject>). Carries leaid we crosswalk on.
    off = fetch_all(f"schools/crdc/offerings/{YEAR}")
    off_by_sch = {r["ncessch"]: r for r in off}

    # ncessch → leaid (prefer offerings, fall back to ccd directory / enrollment).
    sch_lea = {}
    for src in (off, ccdsch, enr):
        for r in src:
            if r.get("leaid") and r["ncessch"] not in sch_lea:
                sch_lea[r["ncessch"]] = str(r["leaid"])

    # 5) Accumulate per district, per subject:
    #      d_known[subj][dc] = Σ HS enrollment of schools whose offering status is KNOWN
    #      d_offer[subj][dc] = Σ HS enrollment of schools that OFFER the subject (>0 sections)
    d_known = {s: defaultdict(float) for s in SUBJECTS}
    d_offer = {s: defaultdict(float) for s in SUBJECTS}

    for ncessch, e in sch_enroll.items():
        if not is_hs.get(ncessch):          # high schools only
            continue
        dc = lea2dc.get(sch_lea.get(ncessch, ""))
        if not dc or dc not in ours:
            continue
        row = off_by_sch.get(ncessch)
        if not row:
            continue
        for subj, fld in SUBJECTS.items():
            v = num(row.get(fld))           # None for negative sentinel / blank
            if v is None:                   # offering status unknown for this subject
                continue
            d_known[subj][dc] += e
            if v > 0:                       # > 0 sections ⇒ the school offers it
                d_offer[subj][dc] += e

    # 6) Compose metrics. null (omit) when no HS has a known offering status.
    out: dict[str, dict] = {dc: {} for dc in ours}
    cov = {s: 0 for s in SUBJECTS}
    for dc in ours:
        for subj in SUBJECTS:
            kn = d_known[subj][dc]
            if kn > 0:
                out[dc][f"{subj}_access_pct"] = round(d_offer[subj][dc] / kn, 4)
                cov[subj] += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (CRDC {YEAR}-18)")
    for subj in SUBJECTS:
        print(f"  {subj+'_access_pct':22s} {cov[subj]:3d}/281  "
              f"(% of HS students in schools offering {subj}; HS = CCD school_level==3)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
