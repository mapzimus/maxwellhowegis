"""
FEDERAL Civil Rights Data Collection (CRDC) district metrics for the atlas —
equity data the MA DESE open-data hub does NOT publish.

Source: U.S. Dept. of Education, Office for Civil Rights, CRDC **2020-21** (the
latest CRDC release), served cleanly over REST by the Urban Institute Education
Data Portal (https://educationdata.urban.org). CRDC athletics live in the
SCHOOL-level "offerings" file; we aggregate them up to the district (LEA).

  /api/v1/schools/crdc/offerings/2020/        (per-school athletics + AP offerings)
  /api/v1/schools/crdc/enrollment/2020/race/sex/  (per-school CRDC enrollment, used
                                                   as the denominator, same universe)
  /api/v1/school-districts/ccd/directory/2020/    (NCES CCD LEA directory — supplies
                                                   the state_leaid → DESE crosswalk)

Metrics written (keyed by 8-digit DIST_CODE):

  athletics_participation_pct  — interscholastic-athletics participations summed
        over all schools in the district ÷ total district CRDC enrollment. CRDC
        counts participation SLOTS (a two-sport athlete counts twice), so read this
        as "athletic participations per enrolled student" — a sports-opportunity
        index, not a head-count of athletes. Bounded 0-1 against full K-12
        enrollment (statewide range ~0.01-0.95, median ~0.19). 0-1 fraction.
  athletics_participants       — raw count of athletics participations in the
        district (the "how many kids play sports?" answer). Raw number.
  athletics_girls_share        — girls' share of athletics participations
        (female ÷ (male+female) single-sex-sport participants). A Title-IX-relevant
        sex-equity read; ~0.47 statewide (parity = 0.50). 0-1 fraction.

WHY CRDC athletics specifically: interscholastic-athletics participation has NO
queryable MA DESE open dataset — scripts/fetch_whole_child.py explicitly documents
athletics (MIAA) as an unfilled gap. CRDC is the only public per-district source.

CROSSWALK (NCES → DESE): the CCD LEA directory exposes `state_leaid` = "MA-XXXX",
where XXXX is the 4-digit DESE org code; DESE's 8-digit DIST_CODE = XXXX + "0000".
This maps all 281 atlas districts with zero unreachable. (The CRDC/CCD universe
has ~429 MA LEAs — mostly charters — but every atlas academic district is covered.)

WHAT WE DELIBERATELY DID NOT SHIP (not fabricated):
  * School-based arrests / law-enforcement referrals: present in CRDC
    (students_arrested, students_referred_law_enforce) and genuinely absent from
    DESE — BUT 2020-21 was the COVID remote-learning year, so the MA totals are
    near-zero (5 arrests, 263 referrals statewide). Zero-coverage at the district
    level → dropped (would violate the no-zero-coverage rule).
  * AP access (% enrolled in ≥1 AP): DESE already covers AP participation/exam
    intensity in the atlas (ap_participation_pct, ap_* family), so not duplicated.

COVID-YEAR CAVEAT: this is the 2020-21 CRDC. Athletics rosters reported here may
reflect a disrupted year for some districts; labels/PR note the year. Values are
plausible (non-collapsed), so athletics is shipped; the discipline-action measures
that DID collapse are not.

Coverage (districts): athletics_participation_pct 200, athletics_participants 200,
athletics_girls_share 205 (of 281) — districts with no interscholastic-athletics-
offering school (K-8 districts, some voc/tiny rurals) are correctly absent (null),
not 0.

Output: data/ma_district_crdc.json :: { DIST_CODE: {col: val} }
Raw Urban API pulls are cached under scripts/.crdc_cache/ (gitignored); only the
small derived JSON is committed.

Run from repo root::  python scripts/fetch_crdc.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_crdc.json"
CACHE = Path(__file__).resolve().parent / ".crdc_cache"

API = "https://educationdata.urban.org/api/v1"
YEAR = 2020                      # CRDC 2020-21 collection (Urban labels it year=2020)
FIPS_MA = 25
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# CRDC negative sentinels (-1 reserved/NA, -2 not-applicable/skip, -3 suppressed,
# -5/-6/-8/-9 various). Anything < 0 is missing, never a real value.
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
    """GET every page of an Urban API endpoint (follows `next`), cached to disk."""
    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / (path.strip("/").replace("/", "_") + ".json")
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    rows: list[dict] = []
    url = f"{API}/{path}?fips={FIPS_MA}&limit=10000"
    while url:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
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

    # 3) Per-school athletics (CRDC "offerings"): interscholastic single-sex-sport
    #    participants (total + by sex). offerings carries the leaid we crosswalk on.
    off = fetch_all(f"schools/crdc/offerings/{YEAR}")

    # Accumulate to district: participations, male/female participations, and the
    # CRDC enrollment of every school in the district (the denominator universe).
    part = {}        # DIST_CODE -> total athletics participations
    part_m = {}      # DIST_CODE -> male participations
    part_f = {}      # DIST_CODE -> female participations
    enroll = {}      # DIST_CODE -> total CRDC enrollment (all schools in LEA)

    # district enrollment = sum of CRDC enrollment over all schools mapped to it
    sch_lea = {r["ncessch"]: str(r.get("leaid")) for r in off if r.get("leaid")}
    for ncessch, e in sch_enroll.items():
        dc = lea2dc.get(sch_lea.get(ncessch, ""))
        if dc and dc in ours:
            enroll[dc] = enroll.get(dc, 0.0) + e

    for r in off:
        dc = lea2dc.get(str(r.get("leaid")))
        if not dc or dc not in ours:
            continue
        p = num(r.get("participants_single_sex_sports"))
        if p is not None:
            part[dc] = part.get(dc, 0.0) + p
        m = num(r.get("participants_single_sex_sports_m"))
        if m is not None:
            part_m[dc] = part_m.get(dc, 0.0) + m
        f = num(r.get("participants_single_sex_sports_f"))
        if f is not None:
            part_f[dc] = part_f.get(dc, 0.0) + f

    # 4) Compose the metrics. Store null (omit) for anything without a real basis;
    #    never write 0 for "no data".
    out: dict[str, dict] = {dc: {} for dc in ours}
    n_pct = n_cnt = n_girls = 0
    for dc in ours:
        tot_part = part.get(dc)
        tot_enr = enroll.get(dc, 0.0)
        if tot_part is not None and tot_part > 0:
            out[dc]["athletics_participants"] = int(round(tot_part))
            n_cnt += 1
            if tot_enr > 0:
                out[dc]["athletics_participation_pct"] = round(tot_part / tot_enr, 4)
                n_pct += 1
        m = part_m.get(dc, 0.0)
        f = part_f.get(dc, 0.0)
        if (m + f) > 0:
            # girls' share is meaningful whenever any single-sex-sport participation
            # was reported; a real reported 0 girls (with boys > 0) is a true equity
            # signal and kept as 0.0, not nulled.
            out[dc]["athletics_girls_share"] = round(f / (m + f), 4)
            n_girls += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (CRDC {YEAR}-21)")
    print(f"  athletics_participation_pct: {n_pct}/281  (0-1 fraction; participations ÷ district enrollment)")
    print(f"  athletics_participants:      {n_cnt}/281  (raw count of participations)")
    print(f"  athletics_girls_share:       {n_girls}/281  (0-1 fraction; female ÷ total participations)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
