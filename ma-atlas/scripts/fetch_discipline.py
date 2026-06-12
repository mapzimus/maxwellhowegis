"""
Add a new "student discipline & climate" data category to the atlas by pulling
district-level discipline metrics from MA DESE's open data (Education-to-Career
hub, Socrata) and writing a join file keyed by DIST_CODE:

  disc_students_pct  <- Student Discipline [2kca-w7rq]  stu_discipl_cnt / stu_cnt
  disc_oss_pct       <- Student Discipline [2kca-w7rq]  out_susp_pct
  disc_iss_pct       <- Student Discipline [2kca-w7rq]  in_susp_pct

DESE's "Student Discipline" dataset reports, per district / student group /
offense, the unduplicated count of students disciplined (stu_discipl_cnt) out of
enrollment (stu_cnt), plus the share of students receiving in-school suspension
(in_susp_pct) and out-of-school suspension (out_susp_pct). All three published
*_pct columns are already fractions (0-1). We compute the overall
"% of students disciplined" as stu_discipl_cnt / stu_cnt since DESE does not
publish that ratio as its own column.

We slice org_type='District', stu_grp='All Students', offense='All Offenses',
and take the latest published school year (SY2025).

Output: ``data/ma_district_discipline.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0-1) rounded to 4 decimals, to match the atlas's other
*_pct / rate columns.

Run from repo root::  python scripts/fetch_discipline.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_discipline.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest published school year in [2kca-w7rq]


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. Discipline *_pct columns come as
    fractions (0.023) already; detect and divide only if it looks like a percent."""
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

    # Student Discipline — latest SY, All Students, All Offenses, district level.
    rows = soda("2kca-w7rq", {
        "$where": f"org_type='District' AND stu_grp='All Students' "
                  f"AND offense='All Offenses' AND sy='{SY}'",
        "$select": "dist_code,stu_cnt,stu_discipl_cnt,in_susp_pct,out_susp_pct",
        "$limit": "2000",
    })

    s_hits = oss_hits = iss_hits = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue

        # % of students disciplined = unduplicated disciplined count / enrollment.
        try:
            cnt = float(r.get("stu_cnt"))
            disc = float(r.get("stu_discipl_cnt"))
        except (TypeError, ValueError):
            cnt = disc = None
        if cnt and cnt > 0 and disc is not None and disc >= 0:
            out[dc]["disc_students_pct"] = round(disc / cnt, 4); s_hits += 1

        oss = to_frac(r.get("out_susp_pct"))
        if oss is not None:
            out[dc]["disc_oss_pct"] = round(oss, 4); oss_hits += 1

        iss = to_frac(r.get("in_susp_pct"))
        if iss is not None:
            out[dc]["disc_iss_pct"] = round(iss, 4); iss_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  disc_students_pct: {s_hits}")
    print(f"  disc_oss_pct:      {oss_hits}")
    print(f"  disc_iss_pct:      {iss_hits}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
