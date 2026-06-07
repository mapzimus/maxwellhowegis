#!/usr/bin/env python3
"""
download_osm.py
===============
Extract OpenStreetMap features for Concord, NH via the Overpass API and save
them as GeoJSON. Themed queries (roads, buildings, water, POIs, landuse, etc.)
are defined in ../sources.json under "osm_queries".

    python download_osm.py            # download all themes
    python download_osm.py --list
    python download_osm.py --only roads buildings

Output: concord-nh-data/data/osm/<theme>.geojson

Notes
-----
* Uses the public Overpass API; be polite (the script sleeps between calls).
* Geometry is built from Overpass `out geom;` output: nodes -> Point,
  ways -> LineString (or Polygon if closed + area-like), relations are skipped
  for simplicity (use osmium/osmnx if you need full multipolygons).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.normpath(os.path.join(HERE, "..", "sources.json"))
OUT_ROOT = os.path.normpath(os.path.join(HERE, "..", "data", "osm"))

# Concord, NH bbox as Overpass (south,west,north,east)
BBOX = "43.151772,-71.668185,43.309419,-71.456903"
ENDPOINT = "https://overpass-api.de/api/interpreter"
AREA_KEYS = {"building", "landuse", "natural", "leisure", "amenity", "water"}


def overpass(query: str) -> Dict[str, Any]:
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=data,
        headers={"User-Agent": "concord-nh-data/1.0 (mhowe.gis@gmail.com)"},
    )
    delay = 5.0
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8", "replace"))
        except Exception as exc:  # noqa: BLE001
            if attempt < 4:
                print(f"    retry in {delay:.0f}s ({exc})", file=sys.stderr)
                time.sleep(delay)
                delay *= 2
            else:
                raise
    raise RuntimeError("unreachable")


def to_geojson(osm: Dict[str, Any]) -> Dict[str, Any]:
    feats: List[Dict[str, Any]] = []
    for el in osm.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "node" and "lat" in el:
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif el["type"] == "way" and el.get("geometry"):
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            closed = len(coords) > 3 and coords[0] == coords[-1]
            is_area = closed and any(k in tags for k in AREA_KEYS)
            geom = ({"type": "Polygon", "coordinates": [coords]} if is_area
                    else {"type": "LineString", "coordinates": coords})
        else:
            continue
        feats.append({
            "type": "Feature",
            "id": f"{el['type']}/{el['id']}",
            "properties": {"osm_id": el["id"], "osm_type": el["type"], **tags},
            "geometry": geom,
        })
    return {"type": "FeatureCollection", "features": feats}


def load_themes():
    with open(SOURCES, encoding="utf-8") as fh:
        return json.load(fh).get("osm_queries", [])


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--overwrite", action="store_true")
    args = ap.parse_args(argv)

    themes = load_themes()
    if args.only:
        themes = [t for t in themes if t["theme"] in set(args.only)]
    if args.list:
        for t in themes:
            print(f"  {t['theme']:14s} {t['selector']}")
        return 0

    os.makedirs(OUT_ROOT, exist_ok=True)
    ok = skipped = failed = 0
    for t in themes:
        theme = t["theme"]
        out_path = os.path.join(OUT_ROOT, f"{theme}.geojson")
        if os.path.exists(out_path) and not args.overwrite:
            print(f"  = skip (exists) {theme}", file=sys.stderr)
            skipped += 1
            continue
        # selector is an Overpass filter like: nwr["highway"]
        q = f"[out:json][timeout:120][bbox:{BBOX}];({t['selector']};);out geom;"
        try:
            print(f"  > {theme}: {t['selector']}", file=sys.stderr)
            fc = to_geojson(overpass(q))
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(fc, fh)
            print(f"    wrote {len(fc['features'])} features -> data/osm/{theme}.geojson",
                  file=sys.stderr)
            ok += 1
            time.sleep(3)  # be polite to the public endpoint
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {theme}: {exc}", file=sys.stderr)
            failed += 1

    print(f"\nDone. {ok} downloaded, {skipped} skipped, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
