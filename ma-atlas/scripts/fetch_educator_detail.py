"""
Add NEW educator-workforce metrics to the atlas — teacher salary & licensure —
pulled from MA DESE's open data (Education-to-Career hub, Socrata) and written to
a join file keyed by DIST_CODE. These are DISTINCT from the workforce columns the
atlas already carries (retention, % experienced, % in-field, staff race/ethnicity,
student:teacher ratio):

  avg_teacher_salary     <- District Expenditures by Spending Category [er3w-dyti]
                            ind_cat='Teacher Salaries',
                            ind_subcat='Average Teacher Salary'  (raw dollars)
  teacher_licensed_pct   <- Elementary and Secondary Teacher Data    [4684-cw3t]
                            subject='All Teachers'  tchr_lic_pct      (0–1 fraction)
  classes_licensed_pct   <- Elementary and Secondary Teacher Data    [4684-cw3t]
                            subject='Core-All Subjects' tchr_lic_pct  (0–1 fraction)
  teacher_attendance_pct <- Elementary and Secondary Staff Attendance [2hei-cc7k]
                            staff_grp='Teachers'  staff_attend_rate   (0–1 fraction)

Latest published year per source: salary SY2024 (Amount), licensure SY2026,
teacher attendance SY2025 (the only year published). The licensure dataset's
tchr_lic_pct is the share of teachers holding a valid license for their
assignment; its complement is the share teaching on a waiver/without a proper
license. We keep that as the published "licensed" fraction.

Output: ``data/ma_district_educator.json`` :: { DIST_CODE: {col: value, ...} }
Salary stays a RAW dollar amount (not a fraction); the *_pct columns are 0–1.

Run from repo root::  python scripts/fetch_educator_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_educator.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0–1 fraction. The licensure/attendance columns come
    as 0.987 already, but guard against any percent-style values (81.1)."""
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
    """Parse a raw numeric value WITHOUT rescaling — used for salary (dollars).
    Do NOT divide by 100; $88,409 must stay 88409, not 884.09."""
    if v is None or v == "":
        return None
    try:
        f = float(str(v).replace(",", "").replace("$", ""))
    except ValueError:
        return None
    if f < 0:
        return None
    return f


def pos_cnt(v):
    """A teacher/headcount that is present and strictly > 0, else None. DESE emits
    rows with tchr_cnt=0 for subject breakdowns it did not tabulate for a district
    (e.g. 'Core-All Subjects' is blank for many districts that still report 'All
    Teachers'); in those rows tchr_lic_pct is published as 0, which is a NO-DATA
    sentinel — NOT a real 0% licensed. Guarding on tchr_cnt>0 keeps those null."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Average teacher salary — latest (SY2024). Raw dollars (ind_value_type
    #    'Amount'); this dataset has no org_type field — rows are per dist_code.
    sal = soda("er3w-dyti", {
        "$where": "ind_cat='Teacher Salaries' AND ind_subcat='Average Teacher Salary' "
                  "AND sy='2024'",
        "$select": "dist_code,ind_value", "$limit": "2000",
    })
    s_hits = 0
    for r in sal:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_num(r.get("ind_value"))) is not None:
            out[dc]["avg_teacher_salary"] = round(v); s_hits += 1

    # 2) % of teachers licensed for their assignment — latest (SY2026),
    #    All Teachers, District-level. tchr_lic_pct is already a 0–1 fraction.
    #    Guard on tchr_cnt>0: a 0-teacher row is a no-data sentinel (e.g. Gosnold),
    #    whose published lic_pct of 0 must stay null, not paint as 0% licensed.
    lic = soda("4684-cw3t", {
        "$where": "org_type='District' AND subject='All Teachers' AND sy='2026'",
        "$select": "dist_code,tchr_cnt,tchr_lic_pct", "$limit": "2000",
    })
    l_hits = 0
    for r in lic:
        dc = norm(r.get("dist_code"))
        if (dc in out and pos_cnt(r.get("tchr_cnt")) is not None
                and (v := to_frac(r.get("tchr_lic_pct"))) is not None):
            out[dc]["teacher_licensed_pct"] = round(v, 4); l_hits += 1

    # 3) % of core classes taught by a licensed teacher — latest (SY2026),
    #    Core-All Subjects, District-level. Same tchr_cnt>0 guard: DESE leaves the
    #    Core-All-Subjects breakdown un-tabulated (tchr_cnt=0, lic_pct=0) for many
    #    districts that DO report All-Teachers (Fall River, Malden, several
    #    regionals) — those must be null, not a misleading 0% (see
    #    scripts/analysis/audit_quality.md).
    core = soda("4684-cw3t", {
        "$where": "org_type='District' AND subject='Core-All Subjects' AND sy='2026'",
        "$select": "dist_code,tchr_cnt,tchr_lic_pct", "$limit": "2000",
    })
    c_hits = 0
    for r in core:
        dc = norm(r.get("dist_code"))
        if (dc in out and pos_cnt(r.get("tchr_cnt")) is not None
                and (v := to_frac(r.get("tchr_lic_pct"))) is not None):
            out[dc]["classes_licensed_pct"] = round(v, 4); c_hits += 1

    # 4) Teacher attendance rate — only published year (SY2025), Teachers,
    #    District-level.
    att = soda("2hei-cc7k", {
        "$where": "org_type='District' AND staff_grp='Teachers' AND sy='2025'",
        "$select": "dist_code,staff_attend_rate", "$limit": "2000",
    })
    a_hits = 0
    for r in att:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("staff_attend_rate"))) is not None:
            out[dc]["teacher_attendance_pct"] = round(v, 4); a_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  avg_teacher_salary:     {s_hits} (SY2024, raw $)")
    print(f"  teacher_licensed_pct:   {l_hits} (SY2026, fraction)")
    print(f"  classes_licensed_pct:   {c_hits} (SY2026, fraction)")
    print(f"  teacher_attendance_pct: {a_hits} (SY2025, fraction)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
