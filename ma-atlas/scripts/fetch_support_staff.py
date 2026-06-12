"""
Add a NEW metric category — student-support staffing ratios — to the atlas by
pulling FTE counts per support role from MA DESE's open data (Education-to-Career
hub, Socrata) and dividing district enrollment by them:

  students_per_counselor      enrollment / (School Counselor + School Adjustment Counselor) FTE
  students_per_nurse          enrollment / (School Nurse Non-SpEd + SpEd) FTE
  students_per_psychologist   enrollment / (School Psychologist Non-SpEd + SpEd) FTE
  students_per_social_worker  enrollment / (School Social Worker Non-SpEd + SpEd) FTE
  students_per_librarian      enrollment / Librarians and Media Center Directors FTE

Source dataset: "Staffing: Race/Ethnicity and Gender" [j5ue-xkfn]. It reports
``fte_total`` for every ``jobclass`` at District / School / State level. We take
org_type='District' for the latest published year (SY2026). The support roles
are not currently represented in the atlas (which only has student:teacher ratio
and teacher workforce metrics), so these are NEW well-being/support indicators.

These are RAW ratios — students per one FTE — NOT percentages. Lower is better
(more support staff per student). We compute ratio = enrollment / role_FTE and
skip any district where the role FTE is missing or 0, or where enrollment is
unavailable. Enrollment denominator comes from the atlas's own
``ma_academic_districts.geojson`` TOTAL_CNT (keyed by DIST_CODE), since the
staffing dataset only ships FTE counts.

Output: ``data/ma_district_support.json`` :: { DIST_CODE: {col: value, ...} }
Ratios are rounded to whole numbers.

Run from repo root::  python scripts/fetch_support_staff.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_support.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "j5ue-xkfn"  # Staffing: Race/Ethnicity and Gender (FTE by jobclass)
SY = "2026"            # latest published school year with District-level rows
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# Map output column -> the jobclass label(s) whose FTE we sum for that role.
ROLES = {
    # MA-specific: in DESE's job taxonomy "School Counselor" is largely a
    # secondary-grades guidance role; the elementary analog is the "School
    # Adjustment Counselor." Many K-8/elementary districts report 0.0 FTE for
    # the narrow "School Counselor" jobclass yet do staff School Adjustment
    # Counselors, so counting only "School Counselor" left ~31 such districts
    # blank. We sum all three counselor-family jobclasses so the ratio is
    # computed on a comparable basis statewide. NOTE: these are distinct from
    # "School Social Worker" (used by students_per_social_worker), so summing
    # them here introduces no double-counting across roles.
    "students_per_counselor":     ["School Counselor",
                                   "School Adjustment Counselor -- Non-Special Education",
                                   "School Adjustment Counselor -- Special Education"],
    "students_per_nurse":         ["School Nurse -- Non-Special Education",
                                   "School Nurse -- Special Education"],
    "students_per_psychologist":  ["School Psychologist -- Non-Special Education",
                                   "School Psychologist -- Special Education"],
    "students_per_social_worker": ["School Social Worker -- Non-Special Education",
                                   "School Social Worker -- Special Education"],
    "students_per_librarian":     ["Librarians and Media Center Directors"],
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char DIST_CODE."""
    return str(code).zfill(8)


def to_num(v):
    """Parse a raw number (FTE count or enrollment). Returns float or None."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f


def main() -> int:
    # Enrollment denominator (TOTAL_CNT) keyed by DIST_CODE, from the atlas geojson.
    feats = json.loads(DISTS.read_text())["features"]
    ours = {f["properties"]["DIST_CODE"] for f in feats}
    enroll: dict[str, float] = {}
    for f in feats:
        dc = f["properties"]["DIST_CODE"]
        n = to_num(f["properties"].get("TOTAL_CNT"))
        if n:
            enroll[dc] = n

    # Pull all support-role FTE rows for District, latest year, in one call.
    wanted = sorted({jc for jcs in ROLES.values() for jc in jcs})
    jc_in = ",".join("'" + jc.replace("'", "''") + "'" for jc in wanted)
    rows = soda(DATASET, {
        "$where": f"org_type='District' AND sy='{SY}' AND jobclass IN ({jc_in})",
        "$select": "dist_code,jobclass,fte_total",
        "$limit": "20000",
    })

    # Accumulate FTE per (district, output column).
    fte: dict[str, dict[str, float]] = {dc: {} for dc in ours}
    col_of_jc = {jc: col for col, jcs in ROLES.items() for jc in jcs}
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in fte:
            continue
        col = col_of_jc.get(r.get("jobclass"))
        if col is None:
            continue
        v = to_num(r.get("fte_total"))
        if v is None:
            continue
        fte[dc][col] = fte[dc].get(col, 0.0) + v

    # Compute students-per-FTE; skip missing/zero FTE or missing enrollment.
    out: dict[str, dict] = {dc: {} for dc in ours}
    hits = {col: 0 for col in ROLES}
    for dc in ours:
        e = enroll.get(dc)
        if not e:
            continue
        for col in ROLES:
            f = fte[dc].get(col)
            if not f:  # None or 0.0 -> can't form a ratio
                continue
            out[dc][col] = round(e / f)
            hits[col] += 1

    # Emit districts in sorted DIST_CODE order so output is reproducible:
    # `ours` is a set, whose iteration order varies by PYTHONHASHSEED, which
    # would otherwise reshuffle the whole file on every run. Inner per-role keys
    # keep their ROLES insertion order.
    out = {k: out[k] for k in sorted(out) if out[k]}
    OUT.write_text(json.dumps(out, indent=1))

    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  districts in atlas: {len(ours)}; with enrollment: {len(enroll)}")
    for col in ROLES:
        print(f"  {col:28s} {hits[col]:4d}/274  (students per FTE)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
