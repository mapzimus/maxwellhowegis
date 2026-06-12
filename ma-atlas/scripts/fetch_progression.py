"""
Add NEW district *progression / early-warning* metrics to the atlas — the
"is my kid on track" lens — from MA DESE open data (Education-to-Career hub,
Socrata), keyed by DIST_CODE.

The "Progression" category previously held only ``grade_retention_pct`` (Student
Retention Report, c8ur-ajfv). 9th-grade course passing — DESE's flagship
early-warning predictor of on-time graduation — is genuinely published at district
level, so we ship it here.

Columns written
---------------
  g9_pass_all_pct   <- Grade Nine Course Passing Report [4sut-78p8]  pass_pct (subject='All Subjects')
  g9_pass_ela_pct   <- 4sut-78p8  pass_pct (subject='English Language Arts')
  g9_pass_math_pct  <- 4sut-78p8  pass_pct (subject='Mathematics')

Source & meaning
----------------
* **Grade Nine Course Passing Report [4sut-78p8]** (SY2025). Research consistently
  finds that whether a student passes their 9th-grade courses is one of the strongest
  predictors of on-time graduation. ``pass_pct`` is the share of grade-9 students who
  passed, reported per ``subject``. We take the three most parent-legible cells: All
  Subjects (the on-track headline) plus the two gateway subjects, ELA and Math.
  ``pass_pct`` ships as a 0-1 fraction (statewide SY2025 All-Subjects ~= 0.90).
  HS-only: only the ~217 districts operating grade 9 appear (K-8 sending districts are
  legitimately absent, not suppressed).

All cells: org_type='District', stu_grp='All Students', latest school year. Rows below
DESE's min-n are suppressed -> stored ``null``, never ``0``.

NOTES on dropped proposals:
* Student mobility (stability / churn) is already in the atlas as ``stability_rate`` /
  ``churn_pct`` (Outcomes), from the same DESE Student Mobility Rate source — NOT
  re-shipped here to avoid a duplicate metric.
* A district-level *over-age-for-grade* rate and a standalone *course-failure* count
  are not published as queryable Socrata datasets (course failure is just 1 - pass_pct,
  so not fabricated as a separate column). See the PR for the full search log.

Output: ``data/ma_district_progression.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0-1).

Run from repo root::  python scripts/fetch_progression.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_progression.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
SY = "2025"  # latest school year published in 4sut-78p8

# Grade Nine Course Passing: (column, exact subject label). pass_pct is the share
# of grade-9 students passing that subject. 'All Subjects' is the on-track headline.
G9_SUBJECTS = [
    ("g9_pass_all_pct",  "All Subjects"),
    ("g9_pass_ela_pct",  "English Language Arts"),
    ("g9_pass_math_pct", "Mathematics"),
]


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    last = None
    for _ in range(5):  # the hub occasionally resets the connection; retry.
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2)
    raise RuntimeError(f"SODA fetch failed for {dataset}: {last}")


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0-1 fraction. pass_pct already arrives as 0-1; guard by dividing
    if a percent (>1) ever shows up; reject negatives and blanks (-> None, never 0)."""
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
    hits: dict[str, int] = {}

    # Grade Nine Course Passing — one query per subject (District, All Students).
    for col, subj in G9_SUBJECTS:
        subj_esc = subj.replace("'", "''")
        rows = soda("4sut-78p8", {
            "$where": (f"org_type='District' AND stu_grp='All Students' "
                       f"AND sy='{SY}' AND subject='{subj_esc}'"),
            "$select": "dist_code,pass_pct",
            "$limit": "5000",
        })
        n = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            v = to_frac(r.get("pass_pct"))
            if v is not None:
                out[dc][col] = round(v, 4)
                n += 1
        hits[col] = n
        time.sleep(0.5)

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, label in G9_SUBJECTS:
        print(f"  {col:24s}: {hits[col]}")
    print(f"  coverage: {len(out)}/{len(ours)} atlas academic districts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
