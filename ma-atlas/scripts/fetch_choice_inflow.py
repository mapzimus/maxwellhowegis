"""
Add the RECEIVING side of the atlas's "Enrollment flow" category. The existing
``scripts/fetch_school_choice.py`` ships OUTFLOW only — the share of a district's
resident students who *leave* via inter-district School Choice (and charters).
This fetcher ships the complementary inflow + net so the map can show which
districts *gain* students.

Sources — MA DESE Education-to-Career hub (Socrata), school year 2026 (latest):

  Reasons for Student Enrollment by Town (Receiving)  [8xyg-59b2]
      dist_code   8-digit operating-district org code (== atlas DIST_CODE)
      enr_reason  why a student is enrolled IN this district, e.g.
                  'Resident/Member', 'School Choice Program', 'Charter School',
                  'Tuitioned In - ...', 'METCO', ...
      enr_cnt     count of students enrolled in that district for that reason
  Summing enr_cnt over ALL reasons for a dist_code gives that district's total
  enrollment (every enrolled student is counted once, under one reason); the
  'School Choice Program' slice is the School-Choice INFLOW numerator.

  Where Residents Go to School (Sending)  [vxt3-k35x]
      town_name / enr_reason / enr_cnt — keyed by town OF RESIDENCE. This is the
  same dataset fetch_school_choice.py uses for the outflow numerator/denominator.
  We re-read it here ONLY to build the net metric on the resident-student base.

Metrics
-------
  choice_in_pct  = School-Choice students RECEIVED / total students ENROLLED in
                   the district (the receiving dataset's own all-reasons total).
                   "Of the kids enrolled here, what share came via School Choice."
                   District-keyed, so it is clean for regional districts too.

  choice_net_pct = (choice_in_count − choice_out_count) / resident-student base.
                   Net inter-district School-Choice flow as a share of the home
                   student population. POSITIVE = net receiver (pulls in more than
                   it loses), NEGATIVE = net loser. Diverging around 0 (palette
                   RdBu): blue = net receiver, red = net loser.

Denominator note (honest scope)
-------------------------------
  The two rates intentionally use different denominators, each the correct one
  for its own question:
    * choice_in_pct  -> ENROLLED base  (receiving dataset; district-keyed; ~280
      districts incl. regionals). It measures composition of who is enrolled.
    * choice_net_pct -> RESIDENT base  (sending dataset; town-of-residence keyed).
      This base is what fetch_school_choice.py already uses for
      school_choice_out_pct, so choice_net_pct reconciles exactly with the
      existing outflow metric (net ≈ in_on_resident_base − school_choice_out_pct).
  The sending dataset offers no town->regional-district crosswalk, so net is only
  cleanly derivable for SINGLE-TOWN municipal districts (atlas DIST_NAME == town
  name). Regionals (Acton-Boxborough, etc.) are DROPPED for net rather than
  fabricate a multi-town aggregation — same scope as the existing outflow metric
  (~229 single-town districts). choice_in_pct still covers them.

Output: ``data/ma_district_choice_inflow.json`` :: { DIST_CODE: {col: value} }
Rates are fractions (0-1) to match the atlas's other *_pct columns; suppressed /
absent values are omitted (-> null in app), never stored as 0.

Run from repo root::  python scripts/fetch_choice_inflow.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_choice_inflow.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2026"  # latest school year published in 8xyg-59b2 / vxt3-k35x
RECEIVING = "8xyg-59b2"
SENDING = "vxt3-k35x"
CHOICE = "School Choice Program"


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
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
    """Share as a 0-1 fraction; None when denominator is empty/invalid."""
    if not den or den <= 0 or num is None:
        return None
    return num / den


def main() -> int:
    feats = json.loads(DISTS.read_text())["features"]
    name_to_code = {f["properties"]["DIST_NAME"]: f["properties"]["DIST_CODE"]
                    for f in feats}
    atlas = set(name_to_code.values())

    # ── Receiving side: district-keyed inflow + enrolled denominator ──────────
    recv = soda(RECEIVING, {
        "$select": "dist_code,enr_reason,sum(enr_cnt)",
        "$group": "dist_code,enr_reason",
        "$where": f"sy='{SY}'",
        "$limit": "50000",
    })
    enrolled = defaultdict(float)   # total enrolled IN district (all reasons)
    choice_in = defaultdict(float)  # School-Choice students received
    for r in recv:
        dc = norm(r.get("dist_code"))
        c = to_num(r.get("sum_enr_cnt"))
        if c is None:
            continue
        enrolled[dc] += c
        if r.get("enr_reason") == CHOICE:
            choice_in[dc] += c

    # ── Sending side: resident-town base + choice outflow (for the net only) ──
    send = soda(SENDING, {
        "$select": "town_name,enr_reason,sum(enr_cnt)",
        "$group": "town_name,enr_reason",
        "$where": f"sy='{SY}'",
        "$limit": "30000",
    })
    resident = defaultdict(float)    # total resident students (all reasons)
    choice_out = defaultdict(float)  # resident students leaving via School Choice
    for r in send:
        t = r.get("town_name")
        c = to_num(r.get("sum_enr_cnt"))
        if t is None or c is None:
            continue
        resident[t] += c
        if r.get("enr_reason") == CHOICE:
            choice_out[t] += c

    out: dict[str, dict] = {}
    n_in = n_net = 0
    for name, code in name_to_code.items():
        dc = norm(code)
        if dc not in atlas:
            continue
        rec = {}
        # choice_in_pct — enrolled base; available for every receiving district.
        ci = to_frac(choice_in.get(dc, 0.0), enrolled.get(dc, 0.0))
        if ci is not None:
            rec["choice_in_pct"] = round(ci, 4)
            n_in += 1
        # choice_net_pct — resident base; single-town districts only (name match).
        if name in resident and resident[name] > 0:
            net = (choice_in.get(dc, 0.0) - choice_out.get(name, 0.0)) / resident[name]
            rec["choice_net_pct"] = round(net, 4)
            n_net += 1
        if rec:
            out[dc] = rec

    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  choice_in_pct:  {n_in}  (enrolled base, district-keyed incl. regionals)")
    print(f"  choice_net_pct: {n_net}  (resident base, single-town districts only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
