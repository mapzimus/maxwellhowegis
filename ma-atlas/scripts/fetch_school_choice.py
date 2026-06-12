"""
Add a NEW "Enrollment flow" metric category to the atlas: the share of a
district's RESIDENT students who leave their home district to attend school
elsewhere via inter-district School Choice and/or Commonwealth charter schools.
This is an indicator of enrollment outflow / competitive pressure that the
atlas otherwise lacks.

Source — MA DESE Education-to-Career hub (Socrata):

  Where Residents Go to School (Sending)  [vxt3-k35x]
      town_name   resident municipality (town of residence)
      enr_reason  why/where the resident student is enrolled, e.g.
                  'Resident/Member', 'School Choice Program', 'Charter School',
                  'Tuitioned In - ...', 'METCO', 'Foreign Exchange Student', ...
      enr_cnt     count of resident students in that town/reason
      sy          school year (latest = 2026)

For each residence town we sum enr_cnt across ALL reasons to get the total
resident-student base (the denominator: every resident student is counted once
under exactly one reason), then take the School Choice Program and Charter
School counts as outflow numerators:

  school_choice_out_pct = School Choice Program / total resident students
  charter_out_pct       = Charter School        / total resident students
  enrollment_out_pct    = (School Choice + Charter) / total resident students

Coverage / honest scope:
  This dataset is keyed by TOWN OF RESIDENCE. The atlas is keyed by DIST_CODE.
  For single-town municipal districts the atlas DIST_NAME is the town name, so
  the town maps 1:1 to a DIST_CODE and the rate is clean. Regional districts
  (Acton-Boxborough, Dennis-Yarmouth, etc.) draw residents from several towns
  and the dataset offers no town->regional-district crosswalk, so a single
  resident-based rate is NOT cleanly derivable for them — we DROP those rather
  than fabricate an aggregation. Result: ~229/274 districts (single-town).

Denominator note: the denominator is the dataset's own count of RESIDENT
students (all reasons), not the atlas's TOTAL_CNT (students ENROLLED in the
district). Resident-based is the correct denominator for an outflow share and
is self-contained, so TOTAL_CNT is not used.

Output: ``data/ma_district_choice.json`` :: { DIST_CODE: {col: value, ...} }
Rates are fractions (0-1) to match the atlas's other *_pct columns.

Run from repo root::  python scripts/fetch_school_choice.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_choice.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2026"  # latest school year published in vxt3-k35x


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def to_frac(num, den):
    """Outflow share as a 0-1 fraction; None when denominator is empty."""
    if not den or den <= 0 or num is None:
        return None
    return num / den


def main() -> int:
    feats = json.loads(DISTS.read_text())["features"]
    # Map single-town municipal districts by name -> DIST_CODE.
    # (Regional districts have multi-town names that won't match a town.)
    name_to_code = {f["properties"]["DIST_NAME"]: f["properties"]["DIST_CODE"]
                    for f in feats}
    ours = set(name_to_code.values())

    rows = soda("vxt3-k35x", {
        "$select": "town_name,enr_reason,sum(enr_cnt)",
        "$group": "town_name,enr_reason",
        "$where": f"sy='{SY}'",
        "$limit": "20000",
    })

    total = defaultdict(float)
    choice = defaultdict(float)
    charter = defaultdict(float)
    for r in rows:
        t = r.get("town_name")
        c = to_num(r.get("sum_enr_cnt"))
        if t is None or c is None:
            continue
        total[t] += c
        reason = r.get("enr_reason")
        if reason == "School Choice Program":
            choice[t] += c
        elif reason == "Charter School":
            charter[t] += c

    out: dict[str, dict] = {}
    n_choice = n_charter = n_comb = 0
    for name, code in name_to_code.items():
        if name not in total:
            continue  # regional / unmatched residence town — dropped
        dc = norm(code)
        if dc not in ours:
            continue
        den = total[name]
        rec = {}
        sc = to_frac(choice.get(name, 0.0), den)
        ch = to_frac(charter.get(name, 0.0), den)
        comb = to_frac(choice.get(name, 0.0) + charter.get(name, 0.0), den)
        if sc is not None:
            rec["school_choice_out_pct"] = round(sc, 4); n_choice += 1
        if ch is not None:
            rec["charter_out_pct"] = round(ch, 4); n_charter += 1
        if comb is not None:
            rec["enrollment_out_pct"] = round(comb, 4); n_comb += 1
        if rec:
            out[dc] = rec

    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  school_choice_out_pct: {n_choice}")
    print(f"  charter_out_pct:       {n_charter}")
    print(f"  enrollment_out_pct:    {n_comb}")
    print(f"  (single-town districts matched of {len(name_to_code)} atlas districts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
