"""
Add a NEW district metric — grade retention rate — to the atlas by pulling it
from MA DESE's open data (Education-to-Career hub, Socrata) and writing a join
file keyed by DIST_CODE:

  grade_retention_pct  <- Student Retention Report [c8ur-ajfv]  ret_all_pct

DESE's "Student Retention Report" tracks the share of students retained in
grade (held back / repeating a grade) rather than promoted. ``ret_all_pct`` is
the all-grades retention rate, already published as a 0–1 fraction (e.g. the
statewide SY2026 value is 0.009 = 0.9%), so to_frac is a near no-op here but is
applied for consistency with the atlas's other *_pct / rate columns.

We take org_type='District', stu_grp='All Students', latest school year
(SY2026). Reported for ~270+/274 of the atlas's academic districts. Where the
percent is missing but a count is present we derive it as ret_all_cnt /
enroll_all_cnt (the dataset ships its own enrollment denominator).

Output: ``data/ma_district_retention.json`` :: { DIST_CODE: {col: value} }
Values are fractions (0–1).

Run from repo root::  python scripts/fetch_retention.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_retention.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
SY = "2026"  # latest school year published in c8ur-ajfv


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0–1 fraction. Retention pcts already come as
    0.009; if a source ever sends 0.9 (percent) we'd divide. Detect and act."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # Grade retention — latest year (SY2026), District level, All Students.
    rows = soda("c8ur-ajfv", {
        "$where": f"org_type='District' AND stu_grp='All Students' AND sy='{SY}'",
        "$select": "dist_code,enroll_all_cnt,ret_all_cnt,ret_all_pct",
        "$limit": "2000",
    })
    hits = derived = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        v = to_frac(r.get("ret_all_pct"))
        if v is None:
            # Derive from the dataset's own counts when pct is missing.
            ret, enr = num(r.get("ret_all_cnt")), num(r.get("enroll_all_cnt"))
            if ret is not None and enr and enr > 0:
                v = ret / enr
                derived += 1
        if v is not None:
            out[dc]["grade_retention_pct"] = round(v, 4)
            hits += 1

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  grade_retention_pct: {hits} (SY{SY}; {derived} derived from counts)")
    print(f"  coverage: {len(out)}/{len(ours)} atlas academic districts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
