"""
Backfill four district education columns that ship empty in
``ma_academic_districts.geojson`` by pulling them from MA DESE's open data
(Education-to-Career hub, Socrata) and writing a join file keyed by DIST_CODE:

  attendance_rate          <- Student Attendance        [ak6h-9k7x]  attend_rate
  chronic_absent_pct       <- Student Attendance        [ak6h-9k7x]  pct_chron_abs_10
  teacher_experienced_pct  <- Experienced/In-Field Tchrs [b99t-n6jh] ind_pct (Experienced)
  teacher_infield_pct      <- Experienced/In-Field Tchrs [b99t-n6jh] ind_pct (In-Field)

These were 100%-empty placeholder columns in the DESE source as originally
built. All four are reported at the district level for ~273/274 of the atlas's
academic districts. We take the latest year each metric is published:
attendance SY2025, experienced SY2023, in-field SY2022 (DESE stopped publishing
in-field after 2022).

Output: ``data/ma_district_edu_extra.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1) to match the atlas's other *_pct / rate columns.

Run from repo root::  python scripts/fetch_attendance_teacher.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_edu_extra.json"
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
    """Normalize a value to a 0–1 fraction. Attendance comes as 0.939 already;
    teacher pcts come as 81.1 (percent). Detect and divide as needed."""
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

    # 1) Attendance + chronic absenteeism — latest End-of-Year, All Students.
    att = soda("ak6h-9k7x", {
        "$where": "org_type='District' AND stu_grp='All Students' "
                  "AND attend_period='End of Year' AND sy='2025'",
        "$select": "dist_code,attend_rate,pct_chron_abs_10",
        "$limit": "1000",
    })
    a_hits = 0
    for r in att:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        ar = to_frac(r.get("attend_rate"))
        ca = to_frac(r.get("pct_chron_abs_10"))
        if ar is not None:
            out[dc]["attendance_rate"] = round(ar, 4); a_hits += 1
        if ca is not None:
            out[dc]["chronic_absent_pct"] = round(ca, 4)

    # 2) Experienced teachers — latest (SY2023), All Educators.
    exp = soda("b99t-n6jh", {
        "$where": "race_eth='All Educators' AND ind='Experienced Teachers' AND sy='2023'",
        "$select": "dist_code,ind_pct", "$limit": "2000",
    })
    e_hits = 0
    for r in exp:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("ind_pct"))) is not None:
            out[dc]["teacher_experienced_pct"] = round(v, 4); e_hits += 1

    # 3) In-field teachers — latest available (SY2022; not published after).
    inf = soda("b99t-n6jh", {
        "$where": "race_eth='All Educators' AND ind='In-Field Teachers' AND sy='2022'",
        "$select": "dist_code,ind_pct", "$limit": "2000",
    })
    i_hits = 0
    for r in inf:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("ind_pct"))) is not None:
            out[dc]["teacher_infield_pct"] = round(v, 4); i_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  attendance_rate:         {a_hits}")
    print(f"  teacher_experienced_pct: {e_hits} (SY2023)")
    print(f"  teacher_infield_pct:     {i_hits} (SY2022)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
