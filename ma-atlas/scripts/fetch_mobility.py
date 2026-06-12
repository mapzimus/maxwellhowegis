"""
ECONOMIC MOBILITY from the Opportunity Atlas (Raj Chetty / Opportunity Insights) —
the one outcomes lens the atlas otherwise lacks. The atlas has academics (SEDA),
earnings, college-going; this answers "do kids who GREW UP in this district
actually move up?" — for children raised here, their predicted adult outcomes.

Source: Opportunity Insights "Opportunity Atlas", tract-level simplified file
`tract_outcomes_simple.csv` (point estimates; opportunityinsights.org/data). The
pooled-race/gender, low-parental-income (25th percentile) columns:
  kfr_pooled_pooled_p25   = mean child HOUSEHOLD-INCOME RANK in adulthood (0-100)
                            for kids whose parents were at the 25th pctile
                            = UPWARD MOBILITY (the headline Opportunity Atlas measure).
  jail_pooled_pooled_p25  = share incarcerated on Census day (~age 30).
  teenbrth_pooled_female_p25 = teen-birth share (women).
  (others shipped if present + relatable.)
Vintage: children born ~1978-1983; adult outcomes measured ~2014-2015. This is
PREDICTIVE RESEARCH data about PAST cohorts who grew up in each place — not a
current-students metric. Labels say so.

Tract → district crosswalk: tract CENTROID (Census 2020 Gazetteer, state 25) →
point-in-polygon against ma_academic_districts.geojson (shapely). Aggregated to
the district as a POPULATION-WEIGHTED mean of tract values (tract total population
from the Census ACS API; falls back to an unweighted tract mean if unavailable).

Output: data/ma_district_mobility.json :: { DIST_CODE: {col: value} }
Cache (gitignored): scripts/.mobility_cache/.

Run from repo root::  python scripts/fetch_mobility.py
"""
from __future__ import annotations
import csv, json, os, urllib.request
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.prepared import prep

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
CACHE = REPO / "scripts" / ".mobility_cache"
CACHE.mkdir(exist_ok=True)
OUT = DATA / "ma_district_mobility.json"
UA = {"User-Agent": "Mozilla/5.0 (ma-education-atlas mobility fetch)"}

OA_URL = "https://opportunityinsights.org/wp-content/uploads/2018/10/tract_outcomes_simple.csv"
GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_gaz_tracts_25.txt"

# (OA column, atlas metric id) — relatable, pooled, low-income-parent outcomes.
WANT = {
    "kfr_pooled_pooled_p25":      "mobility_kfr_p25",
    "jail_pooled_pooled_p25":     "mobility_jail_p25",
    "teenbrth_pooled_female_p25": "mobility_teenbirth_p25",
    "coll_pooled_pooled_p25":     "mobility_college_p25",
}


def download(url, path):
    if path.exists() and path.stat().st_size > 1000:
        return
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        path.write_bytes(r.read())


def num(v):
    try:
        f = float(v)
        return f if f == f else None  # drop NaN
    except (TypeError, ValueError):
        return None


def tract_population_ma():
    """Census ACS5 total population per MA tract, keyed by 11-digit GEOID.
    Keyless request; returns {} on any failure (caller falls back to unweighted)."""
    try:
        u = "https://api.census.gov/data/2021/acs/acs5?get=B01003_001E&for=tract:*&in=state:25"
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            rows = json.loads(r.read().decode())
        out = {}
        for rec in rows[1:]:
            pop, st, co, tr = rec
            out[f"{int(st):02d}{int(co):03d}{int(tr):06d}"] = max(0.0, num(pop) or 0.0)
        return out
    except Exception as e:
        print(f"  (tract population unavailable: {e}; using unweighted tract mean)")
        return {}


def main() -> int:
    download(OA_URL, CACHE / "tract_outcomes_simple.csv")
    download(GAZ_URL, CACHE / "gaz_tracts_25.txt")

    # 1) Opportunity Atlas outcomes for MA tracts -> {GEOID: {metric: value}}
    oa = {}
    with open(CACHE / "tract_outcomes_simple.csv", encoding="latin-1") as f:
        rd = csv.DictReader(f)
        have = [c for c in WANT if c in rd.fieldnames]
        for row in rd:
            if str(row.get("state", "")).strip() not in ("25", "25.0"):
                continue
            geoid = f"{int(float(row['state'])):02d}{int(float(row['county'])):03d}{int(float(row['tract'])):06d}"
            vals = {WANT[c]: num(row[c]) for c in have if num(row[c]) is not None}
            if vals:
                oa[geoid] = vals
    print(f"OA MA tracts with data: {len(oa)} | outcomes: {[WANT[c] for c in have]}")

    # 2) Tract centroids (Gazetteer)
    cent = {}
    with open(CACHE / "gaz_tracts_25.txt", encoding="latin-1") as f:
        rd = csv.DictReader(f, delimiter="\t")
        for row in rd:
            row = {k.strip(): v for k, v in row.items()}
            try:
                cent[row["GEOID"].strip()] = Point(float(row["INTPTLONG"]), float(row["INTPTLAT"]))
            except (KeyError, ValueError):
                continue

    # 3) District polygons
    geo = json.loads((DATA / "ma_academic_districts.geojson").read_text())
    dists = [(f["properties"]["DIST_CODE"], prep(shape(f["geometry"]))) for f in geo["features"]]

    # 4) tract -> district (point in polygon), 5) population-weighted aggregate
    pop = tract_population_ma()
    acc = {}  # DIST_CODE -> {metric: [weighted_sum, weight]}
    matched = 0
    for geoid, vals in oa.items():
        pt = cent.get(geoid)
        if pt is None:
            continue
        dc = next((code for code, poly in dists if poly.contains(pt)), None)
        if dc is None:
            continue
        matched += 1
        w = pop.get(geoid, 1.0) or 1.0
        d = acc.setdefault(dc, {})
        for m, v in vals.items():
            s = d.setdefault(m, [0.0, 0.0])
            s[0] += v * w
            s[1] += w

    # Fallback: small / regional districts whose tracts' CENTROIDS fell in a
    # neighboring polygon get left empty by the strict point-in-polygon above.
    # Give each still-empty district the value of the NEAREST OA tract centroid
    # (a "closest-neighborhood" estimate) so it isn't blank. Recovers the ~30
    # districts the centroid match misses; documented as an approximation.
    oa_pts = [(cent[g], oa[g]) for g in oa if g in cent]
    reps = {f["properties"]["DIST_CODE"]: shape(f["geometry"]).representative_point()
            for f in geo["features"]}
    recovered = 0
    for code, rp in reps.items():
        if code in acc or not oa_pts:
            continue
        _, vals = min(oa_pts, key=lambda t: rp.distance(t[0]))
        d = acc.setdefault(code, {})
        for m, v in vals.items():
            d.setdefault(m, [0.0, 0.0])
            d[m][0] += v
            d[m][1] += 1.0
        recovered += 1
    print(f"recovered {recovered} empty districts via nearest-tract fallback")

    out = {}
    for dc, mets in acc.items():
        rec = {}
        for m, (s, wt) in mets.items():
            if wt <= 0:
                continue
            v = s / wt
            if m == "mobility_kfr_p25":
                v = v * 100.0          # income rank as 0-100 percentile (clearer than 0-1)
            elif m in ("mobility_jail_p25", "mobility_teenbirth_p25"):
                v = max(0.0, v)        # clamp tiny rounding negatives on rate columns
            rec[m] = round(v, 2)
        if rec:
            out[dc] = rec
    OUT.write_text(json.dumps(out, indent=1))
    print(f"tracts matched to a district: {matched}/{len(oa)}")
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"({'population-weighted' if pop else 'unweighted tract mean'})")
    for m in set(WANT.values()):
        cov = sum(1 for r in out.values() if m in r)
        if cov:
            vs = [r[m] for r in out.values() if m in r]
            print(f"  {m:24s} cov {cov:3d}  range [{min(vs):.1f}, {max(vs):.1f}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
