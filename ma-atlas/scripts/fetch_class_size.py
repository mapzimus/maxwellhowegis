"""
Add NEW class-size metrics broken out by SUBJECT to the atlas, pulled from MA
DESE's open data (Education-to-Career hub, Socrata) and written to a join file
keyed by DIST_CODE. These are DISTINCT from the atlas's existing overall
``avg_class_size`` (which is the same dataset filtered to subj='All').

  class_size_ela      <- Class Size [35yv-uxv5]  subj='English/Language Arts'  avg_clss_cnt
  class_size_math     <- Class Size [35yv-uxv5]  subj='Mathematics'            avg_clss_cnt
  class_size_science  <- Class Size [35yv-uxv5]  subj='Science'                avg_clss_cnt

WHY SUBJECT, NOT GRADE BAND: the Class Size dataset [35yv-uxv5] is the only
class-size source on the hub, and it has NO grade/level field. Its only
breakdown axis is ``subj`` (alongside demographic share columns). There is no
elementary/middle/high split published. The cleanest, most universally
comparable distinct cut is therefore the three core academic subjects:
English/Language Arts, Mathematics, Science. avg_clss_cnt is a raw count of
students per class (NOT a percent), so we use to_num() and do NOT fraction-
normalize.

Latest published year: SY2025 (same as the overall avg_class_size column).
District-level rows (org_type='District').

Output: ``data/ma_district_class_size.json`` :: { DIST_CODE: {col: value, ...} }
Values are raw students-per-class numbers, rounded to 1 decimal.

Run from repo root::  python scripts/fetch_class_size.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_class_size.json"
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


def to_num(v):
    """Parse a raw number (students per class). NOT a percent, so no /100.
    DESE reports avg_clss_cnt='0.0' (with 0 classes / 0 students) for subjects a
    district simply doesn't offer — a sentinel, not a real class size — so we
    treat 0 as missing and drop it rather than charting it as "0 students/class".
    """
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return f if f > 0 else None


# (atlas column, DESE subj value) — latest year SY2025, District-level.
SUBJECTS = [
    ("class_size_ela",     "English/Language Arts"),
    ("class_size_math",    "Mathematics"),
    ("class_size_science", "Science"),
]
SY = "2025"


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}
    hits: dict[str, int] = {col: 0 for col, _ in SUBJECTS}

    for col, subj in SUBJECTS:
        rows = soda("35yv-uxv5", {
            "$where": f"org_type='District' AND sy='{SY}' AND subj='{subj}'",
            "$select": "dist_code,avg_clss_cnt",
            "$limit": "3000",
        })
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc in out and (v := to_num(r.get("avg_clss_cnt"))) is not None:
                out[dc][col] = round(v, 1); hits[col] += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    for col, _ in SUBJECTS:
        print(f"  {col}: {hits[col]} (SY{SY}, students/class)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
