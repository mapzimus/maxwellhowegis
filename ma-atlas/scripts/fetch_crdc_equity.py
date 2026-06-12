"""
FEDERAL Civil Rights Data Collection (CRDC) **equity** district metrics — a second
CRDC slice, complementing scripts/fetch_crdc.py (athletics). These cover two access/
climate measures the MA DESE open-data hub does NOT publish at all:

  gifted_enrollment_pct — share of a district's students enrolled in a Gifted &
        Talented program. DESE publishes NO gifted/talented data, so this is wholly
        new. CRDC reports gifted enrollment per school (the "PENR" program-enrollment
        module); we sum it over a district's schools and divide by district CRDC
        enrollment. A district where EVERY school reports "no G&T program"
        (gifted_talented_indicator == 0, which is NOT a suppression code) is a real,
        measured 0.0 — "this district offers no formal gifted program" — not missing
        data, so it is kept as 0.0 (like athletics_girls_share keeps real zeros).
        Only ~21 of 281 MA districts run any formal G&T program at all; that scarcity
        is itself the equity finding. 0-1 fraction; statewide range 0-0.21.

  school_police_pct    — share of a district's students attending a school that has
        a sworn law-enforcement officer (CRDC teachers-staff law_enforcement_ind).
        Enrollment-weighted: Σ enrollment of schools WITH an officer ÷ Σ enrollment of
        schools whose officer status is known. New vs DESE (DESE has discipline /
        law-REFERRAL counts, but not the presence of a school-based officer). 0-1
        fraction; statewide median ~0.31.

Source: U.S. Dept. of Education, Office for Civil Rights, **CRDC 2017-18** (the last
pre-COVID collection — Urban labels it year=2017 — so counts are NOT collapsed by the
2020-21 remote-learning year), served over REST by the Urban Institute Education Data
Portal (https://educationdata.urban.org):

  /api/v1/schools/crdc/ap-ib-enrollment/2017/race/sex/  (carries enrl_gifted_talented)
  /api/v1/schools/crdc/offerings/2017/                  (gifted_talented_indicator =
                                                         does the school run a G&T program)
  /api/v1/schools/crdc/teachers-staff/2017/             (law_enforcement_ind = sworn
                                                         officer present at the school)
  /api/v1/schools/crdc/enrollment/2017/race/sex/        (enrollment_crdc = denominator)
  /api/v1/school-districts/ccd/directory/2017/          (CCD state_leaid → DESE crosswalk)

CROSSWALK (NCES → DESE), identical to fetch_crdc.py: the CCD LEA directory exposes
`state_leaid` = "MA-XXXX" (XXXX = 4-digit DESE org code); DESE's 8-digit DIST_CODE =
XXXX + "0000". Covers all 281 atlas districts (280 reachable in CRDC 2017-18; one tiny
district has no CRDC-universe school and is correctly absent).

WHAT WAS CONSIDERED AND SKIPPED (not fabricated):
  * Gifted race access-gap (Black/Hispanic share of G&T vs their enrollment share):
    enrl_gifted_talented IS disaggregated by race, but only ~21 districts run any G&T
    program, so a per-race gap would exist for a handful of districts — too sparse to
    ship as a map metric. Dropped.
  * AP access (% enrolled in >=1 AP): DESE already covers AP intensity in the atlas
    (ap_participation_pct, ap_* family) — not duplicated.

Output: data/ma_district_crdc_equity.json :: { DIST_CODE: {col: val} }. null (omit) for
districts whose status is unknown; never a fabricated 0. Coverage: gifted 280, police 280.
Raw Urban API pulls are cached under scripts/.crdc_equity_cache/ (gitignored — a prior
run already populated it); only the small derived JSON is committed.

Run from repo root::  python scripts/fetch_crdc_equity.py
"""
from __future__ import annotations
import json, urllib.request
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_crdc_equity.json"
CACHE = Path(__file__).resolve().parent / ".crdc_equity_cache"

API = "https://educationdata.urban.org/api/v1"
YEAR = 2017                      # CRDC 2017-18 collection (Urban labels it year=2017);
                                 # last pre-COVID release → counts not collapsed.
FIPS_MA = 25
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


# CRDC negative sentinels (-1 reserved/NA, -2 not-applicable/no-program, -3 suppressed,
# -5/-6/-8/-9 various). Anything < 0 is missing/NA, never a real value.
def num(v):
    """Parse a CRDC numeric (may be a '37.000' string). Return float, or None for
    blanks AND for any negative sentinel."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (ValueError, TypeError):
        return None
    return None if f < 0 else f


def fetch_all(path: str) -> list[dict]:
    """GET every page of an Urban API endpoint (follows `next`), cached to disk.
    Cache filename matches what a prior (rate-limited) run already wrote, so an
    existing cache is reused verbatim and nothing is re-downloaded."""
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

    # 2) Per-school CRDC enrollment denominator (race=Total[99], sex=Total[99]).
    enr = fetch_all(f"schools/crdc/enrollment/{YEAR}/race/sex")
    sch_enroll = {}
    for r in enr:
        if r.get("race") == 99 and r.get("sex") == 99:
            v = num(r.get("enrollment_crdc"))
            if v is not None:
                sch_enroll[r["ncessch"]] = v

    # 3) Per-school gifted enrollment count (enrl_gifted_talented, race=99/sex=99) and
    #    the gifted-program indicator (offerings.gifted_talented_indicator: 1 = the
    #    school runs a G&T program, 0 = it does not — a definitive answer, not a
    #    suppression). offerings + teachers-staff also carry the leaid we crosswalk on.
    ap = fetch_all(f"schools/crdc/ap-ib-enrollment/{YEAR}/race/sex")
    sch_gift_enr = {r["ncessch"]: num(r.get("enrl_gifted_talented"))
                    for r in ap if r.get("race") == 99 and r.get("sex") == 99}

    off = fetch_all(f"schools/crdc/offerings/{YEAR}")
    sch_gift_ind = {r["ncessch"]: r.get("gifted_talented_indicator") for r in off}

    # 4) Per-school sworn-officer indicator (law_enforcement_ind: 1 yes / 0 no / <0 NA).
    ts = fetch_all(f"schools/crdc/teachers-staff/{YEAR}")
    sch_law = {r["ncessch"]: r.get("law_enforcement_ind") for r in ts}

    # leaid lookup: prefer offerings, fall back to teachers-staff / enrollment.
    sch_lea = {}
    for src in (off, ts, ap, enr):
        for r in src:
            if r.get("leaid") and r["ncessch"] not in sch_lea:
                sch_lea[r["ncessch"]] = str(r["leaid"])

    # Accumulate per district.
    d_enroll       = defaultdict(float)   # Σ enrollment, all schools (gifted denom)
    d_gift         = defaultdict(float)   # Σ gifted enrollment
    d_gift_nsch    = defaultdict(int)     # # schools mapped to the district
    d_gift_known   = defaultdict(int)     # # schools with a definitive G&T indicator (0/1)
    d_law_enr_known = defaultdict(float)  # Σ enrollment of schools w/ known officer status
    d_law_enr_yes   = defaultdict(float)  # Σ enrollment of schools WITH a sworn officer

    for ncessch, e in sch_enroll.items():
        dc = lea2dc.get(sch_lea.get(ncessch, ""))
        if not dc or dc not in ours:
            continue
        # gifted
        d_enroll[dc] += e
        d_gift_nsch[dc] += 1
        ind = sch_gift_ind.get(ncessch)
        if ind in (0, 1):
            d_gift_known[dc] += 1
            if ind == 1:
                g = sch_gift_enr.get(ncessch)
                if g is not None:
                    d_gift[dc] += g
        # police
        li = sch_law.get(ncessch)
        if li in (0, 1):
            d_law_enr_known[dc] += e
            if li == 1:
                d_law_enr_yes[dc] += e

    # 5) Compose the metrics. null (omit) for anything without a real basis.
    out: dict[str, dict] = {dc: {} for dc in ours}
    n_gift = n_gift_pos = n_police = 0
    for dc in ours:
        # gifted: only when EVERY mapped school's G&T status is known (no suppression),
        # so a 0.0 here is a true "no district offers G&T", not a partial/unknown blank.
        if d_enroll[dc] > 0 and d_gift_nsch[dc] > 0 and d_gift_known[dc] == d_gift_nsch[dc]:
            out[dc]["gifted_enrollment_pct"] = round(d_gift[dc] / d_enroll[dc], 4)
            n_gift += 1
            if d_gift[dc] > 0:
                n_gift_pos += 1
        # police: enrollment-weighted share of students in a school with a sworn officer.
        if d_law_enr_known[dc] > 0:
            out[dc]["school_police_pct"] = round(d_law_enr_yes[dc] / d_law_enr_known[dc], 4)
            n_police += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (CRDC {YEAR}-18)")
    print(f"  gifted_enrollment_pct: {n_gift}/281  ({n_gift_pos} run a G&T program; the rest are a measured 0 = no program)")
    print(f"  school_police_pct:     {n_police}/281  (enrollment-weighted share in a school with a sworn officer)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
