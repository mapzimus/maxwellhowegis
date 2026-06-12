"""
Build the NON-PUBLIC side of the atlas's "Enrollment flow" category: the share
of a town's school-age children attending private/parochial school, and the share
being homeschooled. The atlas otherwise only knows where PUBLIC students go.

(Distinct from ``scripts/fetch_private_schools.py``, which builds the private-
school *point* reference layer ``data/ma_private_schools.geojson`` from NCES PSS.
This fetcher writes a DESE-sourced district side-join JSON of enrollment SHARES.)

Source — MA DESE Education-to-Career hub (Socrata), school year 2026 (latest):

  School Attending Children  [rdxw-mfv3]
      town_code           8-digit municipal org code (== atlas DIST_CODE for
                          single-town municipal districts)
      town                town name
      total_cnt           ALL school-age children resident in the town, across
                          every setting (the denominator)
      in_state_priv_cnt   children attending an in-state private school
      oos_priv_cnt        children attending an out-of-state private school
      home_schld_cnt      children being homeschooled
      total_pub_cnt       children in public school (sanity: ~ total - priv - home)
      public_pct          DESE's published % public (cross-check only)

  This is a census of where a town's resident children are educated, so it is the
  correct basis for "% of a town's school-age population in private / homeschool."

Metrics
-------
  private_school_pct = (in_state_priv_cnt + oos_priv_cnt) / total_cnt
  homeschool_pct     = home_schld_cnt / total_cnt
  Both are 0-1 fractions to match the atlas's other *_pct columns.

Honest scope
------------
  The dataset is keyed by TOWN. For single-town municipal districts the atlas
  DIST_NAME is the town and town_code == DIST_CODE, so the share maps 1:1 to a
  district (~229 of the atlas's 281). Regional districts (Acton-Boxborough, etc.)
  span several towns and DESE offers no town->regional crosswalk here, so a single
  district rate is NOT cleanly derivable — those are DROPPED rather than
  fabricated (same scope limit as the existing School-Choice outflow metric).
  Homeschool counts ARE published in this dataset (home_schld_cnt), so homeschool
  is shipped, not skipped. Values are stored as null (omitted) — never 0 — when a
  town has no SY2026 row or a zero/empty denominator.

  Note on coverage vs the choropleth: these are town-resident shares attached to
  the single-town district that shares the town's code. They are correct as a
  town-level "% non-public" read; regionals are simply blank.

Output: ``data/ma_district_private.json`` :: { DIST_CODE: {col: value} }

Run from repo root::  python scripts/fetch_private_enrollment.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_private.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2026"          # latest school year published in rdxw-mfv3
DATASET = "rdxw-mfv3"
STATE_ROW = "00000000"


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    return str(code).zfill(8)


def to_num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def to_frac(num, den):
    if not den or den <= 0 or num is None:
        return None
    return num / den


def main() -> int:
    feats = json.loads(DISTS.read_text())["features"]
    atlas = {f["properties"]["DIST_CODE"] for f in feats}

    rows = soda(DATASET, {
        "$select": ("town_code,total_cnt,in_state_priv_cnt,oos_priv_cnt,"
                    "home_schld_cnt"),
        "$where": f"sy='{SY}' AND town_code!='{STATE_ROW}'",
        "$limit": "5000",
    })

    out: dict[str, dict] = {}
    n_priv = n_home = 0
    for r in rows:
        dc = norm(r.get("town_code"))
        if dc not in atlas:
            continue  # regional / non-single-town — no clean district mapping
        total = to_num(r.get("total_cnt"))
        if not total or total <= 0:
            continue
        in_priv = to_num(r.get("in_state_priv_cnt")) or 0.0
        oos_priv = to_num(r.get("oos_priv_cnt")) or 0.0
        home = to_num(r.get("home_schld_cnt"))

        rec = {}
        pp = to_frac(in_priv + oos_priv, total)
        if pp is not None:
            rec["private_school_pct"] = round(pp, 4)
            n_priv += 1
        hp = to_frac(home, total)
        if hp is not None:
            rec["homeschool_pct"] = round(hp, 4)
            n_home += 1
        if rec:
            out[dc] = rec

    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  private_school_pct: {n_priv}")
    print(f"  homeschool_pct:     {n_home}")
    print(f"  (single-town municipal districts of {len(atlas)} atlas districts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
