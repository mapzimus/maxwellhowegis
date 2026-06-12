"""
Add a NEW metric category — English Learner (EL) progress & access — by pulling
DESE's ACCESS for ELLs Reporting Elements (Title III / ESSA) from MA DESE's open
data (Education-to-Career hub, Socrata) and writing a side join file keyed by
DIST_CODE:

  el_making_progress_pct  <- ACCESS Reporting Elements [puw9-zucz]  re1_pct
  el_proficiency_pct      <- ACCESS Reporting Elements [puw9-zucz]  re2_pct
  el_exiting_pct          <- ACCESS Reporting Elements [puw9-zucz]  re3_pct

These are EL OUTCOMES, distinct from the atlas's existing EL_PCT demographic
(% of students who are English learners). The reporting elements are:

  RE1: % of ELs who make progress toward English language proficiency
  RE2: % of ELs who attain an ACCESS score indicating English proficiency
  RE3: % of ELs who exit EL classification on attaining English proficiency
  (RE5 — % not proficient within six years — is published but omitted here as a
   negative indicator; RE4 is not in the source dataset.)

We take the latest published year (SY2025) for the district-level All-grades
aggregate (org_type='District', grade='ALL'). EL enrollment as a separate %
column was NOT added: the source only exposes enrolled_cnt (a count), and a
% English-learner demographic already ships as EL_PCT, so no distinct
el_enroll_pct exists to publish.

Output: ``data/ma_district_el.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0–1) to match the atlas's other *_pct columns; the source
publishes them already as 0–1.

Run from repo root::  python scripts/fetch_el_progress.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_el.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
SY = "2025"  # latest year published in puw9-zucz (2022..2025)


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes may drop leading zeros; atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0–1 fraction. ACCESS reporting-element pcts come as 0.43
    already; divide only if the value reads as a 0–100 percent."""
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

    # ACCESS for ELLs Reporting Elements — latest SY, District-level All grades.
    rows = soda("puw9-zucz", {
        "$where": f"org_type='District' AND grade='ALL' AND sy='{SY}'",
        "$select": "dist_code,re1_pct,re2_pct,re3_pct",
        "$limit": "2000",
    })

    p_hits = f_hits = x_hits = 0
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        prog = to_frac(r.get("re1_pct"))
        prof = to_frac(r.get("re2_pct"))
        exit_ = to_frac(r.get("re3_pct"))
        if prog is not None:
            out[dc]["el_making_progress_pct"] = round(prog, 4); p_hits += 1
        if prof is not None:
            out[dc]["el_proficiency_pct"] = round(prof, 4); f_hits += 1
        if exit_ is not None:
            out[dc]["el_exiting_pct"] = round(exit_, 4); x_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts  (SY{SY})")
    print(f"  el_making_progress_pct:  {p_hits}")
    print(f"  el_proficiency_pct:      {f_hits}")
    print(f"  el_exiting_pct:          {x_hits}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
