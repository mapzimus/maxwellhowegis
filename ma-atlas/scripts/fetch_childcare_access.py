"""
Build ``data/ma_muni_childcare.json`` -- a municipality-level "child-care access"
metric: licensed child-care capacity per 100 resident children under 5.

NUMERATOR -- licensed child-care CAPACITY summed by municipality. Every licensed
EEC program (Family Child Care + Center-based; dataset iyks-y3g6) is joined to
its municipality by a point-in-polygon test on program_latitude/longitude
against ma_municipalities.geojson (shapely). The spatial join sidesteps the 100+
Boston-neighborhood / village labels in ``program_city`` (Dorchester, Hyannis,
Whitinsville, …) that a name match would miss.

In-home Family Child Care IS counted here, unlike the points layer: an aggregate
town sum exposes no individual provider, and FCC is real child-care supply
(heavily under-5, and a big share of capacity in rural / working-class towns).

DENOMINATOR -- resident children under 5 (ACS B01001_003E male + B01001_027E
female), pulled keyless from the Census Reporter mirror at the county-subdivision
level and matched to TOWN_ID by the same ``normalize_name`` rule
``fetch_acs_basics.py`` uses (this is the documented no-API-key fallback).

HONEST CAVEAT (baked into the metric label/description in app.js): licensed
capacity counts seats of ALL ages (including school-age after-school), while the
denominator is under-5 -- so this is a child-care SUPPLY proxy relative to the
young-child population, not an under-5-only ratio. FCC reports no age breakdown,
so a clean under-5-only numerator isn't derivable across both settings. Read it
as "licensed child-care seats per 100 young children": higher = more supply,
very low = a likely child-care desert.

Output: ``data/ma_muni_childcare.json`` :: { "<TOWN_ID>": {
  "childcare_capacity": int, "children_under5": int,
  "childcare_capacity_per_100_u5": float } }
Run from repo root::  python scripts/fetch_childcare_access.py
"""
from __future__ import annotations
import json, statistics, urllib.parse, urllib.request
from pathlib import Path
from shapely.geometry import shape, Point
from shapely import STRtree

REPO = Path(__file__).resolve().parent.parent
MUNI = REPO / "data" / "ma_municipalities.geojson"
OUT = REPO / "data" / "ma_muni_childcare.json"
EEC_DOMAIN = "educationtocareer.data.mass.gov"
EEC_DS = "iyks-y3g6"
CENSUS_REPORTER = "https://api.censusreporter.org/1.0/data/show/latest"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def http_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def soda_all(select: str, where: str) -> list[dict]:
    rows, off, page = [], 0, 5000
    while True:
        url = f"https://{EEC_DOMAIN}/resource/{EEC_DS}.json?" + urllib.parse.urlencode(
            {"$select": select, "$where": where, "$order": "provider_number",
             "$limit": str(page), "$offset": str(off)})
        batch = http_json(url)
        rows.extend(batch)
        if len(batch) < page:
            break
        off += page
    return rows


def normalize_name(raw: str) -> str:
    """Mirror fetch_acs_basics.py: strip Census suffixes (repeatedly, for the
    'Braintree Town city' doubled-suffix case) and upper-case for TOWN matching."""
    if not raw:
        return ""
    name = raw.split(",")[0].strip()
    suffixes = (" town", " city", " borough", " plantation", " CDP", " (balance)")
    changed = True
    while changed:
        changed = False
        for s in suffixes:
            if name.lower().endswith(s.lower()):
                name = name[: -len(s)].strip()
                changed = True
                break
    return name.upper()


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> int:
    muni = json.loads(MUNI.read_text(encoding="utf-8"))
    polys, tids, town_to_tid = [], [], {}
    for f in muni["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID"))
        polys.append(shape(f["geometry"]))
        tids.append(tid)
        t = (p.get("TOWN") or p.get("town_display") or "").upper().strip()
        if t:
            town_to_tid[t] = tid
    tree = STRtree(polys)

    # ── Numerator: licensed capacity by town via point-in-polygon ────────────
    cap: dict[str, float] = {}
    matched = unmatched = 0
    for r in soda_all("program_latitude,program_longitude,licensed_capacity",
                      "licensed_funded='Licensed'"):
        lat, lon, c = num(r.get("program_latitude")), num(r.get("program_longitude")), num(r.get("licensed_capacity"))
        if lat is None or lon is None or c is None:
            continue
        pt = Point(lon, lat)
        tid = None
        for idx in tree.query(pt):           # bbox candidates, then exact test
            if polys[int(idx)].contains(pt):
                tid = tids[int(idx)]
                break
        if tid is None:
            unmatched += 1
            continue
        cap[tid] = cap.get(tid, 0.0) + c
        matched += 1

    # ── Denominator: under-5 by town (Census Reporter, keyless) ──────────────
    cr = http_json(CENSUS_REPORTER + "?" + urllib.parse.urlencode(
        {"table_ids": "B01001", "geo_ids": "060|04000US25"}))
    u5: dict[str, int] = {}
    release = cr.get("release", {}).get("name", "ACS 5-year")
    for gid, d in cr["data"].items():
        est = d["B01001"]["estimate"]
        val = int((est.get("B01001003") or 0) + (est.get("B01001027") or 0))
        tid = town_to_tid.get(normalize_name(cr["geography"].get(gid, {}).get("name", "")))
        if tid is None:
            continue
        if val > u5.get(tid, -1):            # prefer the larger (actual town) row
            u5[tid] = val

    # ── Combine ──────────────────────────────────────────────────────────────
    out: dict[str, dict] = {}
    deserts = 0
    for tid in tids:
        cp, under5 = cap.get(tid), u5.get(tid)
        row = {}
        if under5 is not None and under5 > 0:
            # A town with young children but NO matched licensed program has 0
            # seats located in its borders — a child-care desert, not missing
            # data. Represent it as 0 so the worst-access towns aren't grey.
            seats = int(round(cp)) if cp is not None else 0
            if seats == 0:
                deserts += 1
            row["children_under5"] = under5
            row["childcare_capacity"] = seats
            row["childcare_capacity_per_100_u5"] = round(seats / under5 * 100, 1)
        elif cp is not None:
            # capacity but no under-5 denominator (tiny town) — capacity only
            row["childcare_capacity"] = int(round(cp))
        if row:
            out[tid] = row

    OUT.write_text(json.dumps(out, separators=(",", ":")))
    vals = sorted(r["childcare_capacity_per_100_u5"] for r in out.values()
                  if "childcare_capacity_per_100_u5" in r)
    print(f"wrote {OUT.relative_to(REPO)}: {len(out)} towns  (denominator: {release})")
    print(f"  programs PIP-matched: {matched}  | unmatched (off-map coords): {unmatched}")
    print(f"  towns w/ a ratio: {len(vals)}  | zero-supply deserts (under-5 kids, no licensed seats): {deserts}")
    if vals:
        print(f"  capacity per 100 under-5: min={vals[0]} "
              f"p10={vals[len(vals)//10]} median={statistics.median(vals)} "
              f"p90={vals[len(vals)*9//10]} max={vals[-1]}")
        lowest = sorted((r["childcare_capacity_per_100_u5"], t) for t, r in out.items()
                        if "childcare_capacity_per_100_u5" in r)[:5]
        print(f"  lowest-supply towns (TOWN_ID, per100): {lowest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
