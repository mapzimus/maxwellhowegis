"""
Fill the WORKFORCE holes in the atlas (round 3) — staff Asian share and two
staffing-structure ratios — pulled from MA DESE's open data (Education-to-Career
hub, Socrata) and written to a join file keyed by DIST_CODE. These are DISTINCT
from the workforce columns the atlas already carries (teacher retention,
% experienced, % in-field, % licensed, teacher attendance, avg teacher salary,
educators of color, principal retention, student:teacher ratio, and the existing
staff White/Hispanic/Black race shares):

  staff_asian_pct        <- Staffing: Race/Ethnicity and Gender [j5ue-xkfn]
                            org_type='District', jobclass='All', as_pct.
                            COMPLETES the existing all-staff race set
                            (staff_white_pct / staff_hispanic_pct /
                            staff_black_pct all come from this same dataset's
                            wh_pct / hl_pct / baa_pct), which had NO Asian slice
                            so the four shares did not reconcile to ~1.0. Stored
                            as a 0-1 fraction. A genuine 0 (as_cnt=0, district
                            simply employs no Asian staff) is kept as 0.0 to match
                            its White/Hispanic/Black siblings — these are real
                            zeros, not suppression. null only when the district
                            row is absent or reports 0 total FTE (e.g. Gosnold).

  students_per_admin     <- Staffing: Race/Ethnicity and Gender [j5ue-xkfn]
                            org_type='District', SUM of fte_total over the whole
                            jobclass_cat='Administrators' family (superintendents,
                            principals, asst principals, district/curriculum
                            directors, etc.). Ratio = district enrollment / admin
                            FTE. RAW ratio, NOT a percentage; LOWER is better
                            (fewer students per administrator). Mirrors the
                            existing students_per_<support-role> metrics.

  para_per_100_students  <- Staffing: Race/Ethnicity and Gender [j5ue-xkfn]
                            org_type='District', jobclass='Paraprofessional'
                            fte_total. Ratio = para FTE / enrollment * 100, i.e.
                            paraprofessional FTE per 100 students. RAW ratio, NOT
                            a percentage; HIGHER is more support.

Enrollment denominator/numerator-base (TOTAL_CNT) comes from the atlas's own
``ma_academic_districts.geojson`` keyed by DIST_CODE, exactly as
``fetch_support_staff.py`` does, since the staffing dataset only ships FTE counts.

Zero-denominator trap (see scripts/analysis/data_anomalies.md Issue 10/11 and
Bug 2): a district with 0 admin/para FTE, or 0 / missing enrollment, must be
stored as ``null`` — NEVER a huge or zero ratio. Gosnold (01090000, TOTAL_CNT=0,
0 staff FTE) is the canonical case and correctly drops to null on all three.

Latest published school year for j5ue-xkfn at District level: SY2026.

NOT INCLUDED — deliberately dropped:
  * teacher_masters_plus_pct (% teachers with a master's+): DESE's
    Education-to-Career open-data portal publishes NO teacher-degree /
    credential-depth dataset. A catalog search ("degree"/"master") plus a scan of
    every educator/teacher/staff dataset's column metadata surfaced only
    POSTSECONDARY "Awards (Degrees) Conferred" datasets (students earning
    bachelor/master/doctoral degrees), never an educator-held-degree column. No
    honest source exists, so this metric is skipped rather than fabricated.

Output: ``data/ma_district_educator3.json`` :: { DIST_CODE: {col: value, ...} }
*_pct columns are 0-1 fractions; the two ratios are raw numbers (admin ratio
rounded to whole students; para-per-100 rounded to 2 dp).

Run from repo root::  python scripts/fetch_educator3.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_educator3.json"
DOMAIN = "educationtocareer.data.mass.gov"
DATASET = "j5ue-xkfn"  # Staffing: Race/Ethnicity and Gender (race % + FTE by jobclass)
SY = "2026"            # latest published school year with District-level rows
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char DIST_CODE."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0-1 fraction. as_pct comes as 0.023 already, but guard
    against any percent-style value (2.3). Distinguishes a real 0 (kept) from
    missing (None)."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_num(v):
    """Parse a raw number (FTE count or enrollment). Returns float or None."""
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f


def main() -> int:
    feats = json.loads(DISTS.read_text())["features"]
    ours = {f["properties"]["DIST_CODE"] for f in feats}
    # Enrollment denominator (TOTAL_CNT) keyed by DIST_CODE, from the atlas geojson.
    enroll: dict[str, float] = {}
    for f in feats:
        dc = f["properties"]["DIST_CODE"]
        n = to_num(f["properties"].get("TOTAL_CNT"))
        if n:  # None or 0 -> no usable denominator (Gosnold has TOTAL_CNT=0)
            enroll[dc] = n

    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) staff_asian_pct — Asian share of ALL staff, jobclass='All', District,
    #    SY2026. Completes the existing White/Hispanic/Black staff-race set (same
    #    dataset). Keep a genuine 0 (as_cnt=0) as 0.0 so the four shares reconcile;
    #    only drop to null when the row reports 0 total FTE (no staff at all).
    a_hits = a_zero = 0
    allrows = soda(DATASET, {
        "$select": "dist_code,as_pct,fte_total",
        "$where": f"org_type='District' AND sy='{SY}' AND jobclass='All'",
        "$limit": "20000",
    })
    for r in allrows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        tot = to_num(r.get("fte_total"))
        if not tot:  # 0 or missing total staff FTE -> share is meaningless -> null
            continue
        v = to_frac(r.get("as_pct"))
        if v is None:
            continue
        out[dc]["staff_asian_pct"] = round(v, 4)
        a_hits += 1
        if v == 0:
            a_zero += 1

    # 2) students_per_admin — enrollment / SUM(admin-family FTE). Server-side
    #    sum over the whole jobclass_cat='Administrators' bucket. LOWER is better.
    adm = soda(DATASET, {
        "$select": "dist_code,sum(fte_total) as fte",
        "$where": f"org_type='District' AND sy='{SY}' AND jobclass_cat='Administrators'",
        "$group": "dist_code",
        "$limit": "20000",
    })
    admin_fte: dict[str, float] = {}
    for r in adm:
        dc = norm(r.get("dist_code"))
        if dc in out:
            f = to_num(r.get("fte"))
            if f is not None:
                admin_fte[dc] = f
    s_hits = 0
    for dc in ours:
        e = enroll.get(dc)
        f = admin_fte.get(dc)
        if e and f:  # both present and > 0 (zero-denominator -> stays null)
            out[dc]["students_per_admin"] = round(e / f)
            s_hits += 1

    # 3) para_per_100_students — paraprofessional FTE per 100 students. HIGHER is
    #    more support. Single jobclass='Paraprofessional'.
    par = soda(DATASET, {
        "$select": "dist_code,fte_total",
        "$where": f"org_type='District' AND sy='{SY}' AND jobclass='Paraprofessional'",
        "$limit": "20000",
    })
    para_fte: dict[str, float] = {}
    for r in par:
        dc = norm(r.get("dist_code"))
        if dc in out:
            f = to_num(r.get("fte_total"))
            if f is not None:
                para_fte[dc] = f
    p_hits = 0
    for dc in ours:
        e = enroll.get(dc)
        f = para_fte.get(dc)
        if e and f:  # both present and > 0 (zero-denominator -> stays null)
            out[dc]["para_per_100_students"] = round(f / e * 100.0, 2)
            p_hits += 1

    # Emit in sorted DIST_CODE order for reproducibility (ours is a set whose
    # iteration order varies by PYTHONHASHSEED); drop districts that got nothing.
    out = {k: out[k] for k in sorted(out) if out[k]}
    OUT.write_text(json.dumps(out, indent=1))

    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)}, SY{SY})")
    print(f"  districts with enrollment: {len(enroll)}")
    print(f"  staff_asian_pct:       {a_hits:4d}/{len(ours)}  ({a_zero} genuine 0.0 kept; null when 0 total FTE)")
    print(f"  students_per_admin:    {s_hits:4d}/{len(ours)}  (raw ratio, lower is better)")
    print(f"  para_per_100_students: {p_hits:4d}/{len(ours)}  (para FTE per 100 students)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
