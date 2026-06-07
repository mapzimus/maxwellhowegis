#!/usr/bin/env python3
"""
download_businesses.py
======================
Build a "every business in Concord" point layer from two complementary sources:

  1. OpenStreetMap (default) — comprehensive Overpass query across all
     business-ish tags (shop, office, craft, commercial amenities, tourism,
     healthcare, fitness). Stdlib only, runs anywhere. -> data/businesses/osm_businesses.geojson

  2. Overture Maps "places" theme (--overture) — ~60M+ conflated global POIs
     (name, category, brand, confidence), free & redistributable. Needs either
     the `overturemaps` CLI or the `duckdb` Python package (both pip-installable).
     -> data/businesses/overture_places.geojson

    python download_businesses.py                 # OSM businesses (no deps)
    python download_businesses.py --overture      # add Overture places
    python download_businesses.py --overture-only

Foursquare Open Source Places (Apache-2.0 Parquet) is another great free source;
see the README for the DuckDB one-liner.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "data", "businesses"))

# Concord, NH bbox
W, S, E, N = -71.668185, 43.151772, -71.456903, 43.309419
OVERPASS = "https://overpass-api.de/api/interpreter"
UA = "concord-gis/1.0 (mhowe.gis@gmail.com)"

# Overture release to query when using DuckDB directly. The `overturemaps` CLI
# auto-selects the latest; with raw DuckDB you pin a release. Check the current
# tag at https://docs.overturemaps.org/release/latest/ and pass --release.
DEFAULT_OVERTURE_RELEASE = "2025-05-21.0"

# Comprehensive "is this a business?" selector. Multiple nwr statements are
# unioned by Overpass inside the (...) block.
BUSINESS_SELECTOR = ";".join([
    'nwr["shop"]',
    'nwr["office"]',
    'nwr["craft"]',
    'nwr["healthcare"]',
    'nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|'
    'bank|bureau_de_change|pharmacy|fuel|charging_station|car_rental|car_repair|'
    'car_wash|cinema|theatre|nightclub|marketplace|veterinary|dentist|doctors|'
    'clinic|childcare|driving_school|coworking_space)$"]',
    'nwr["tourism"~"^(hotel|motel|guest_house|hostel|gallery|attraction|museum)$"]',
    'nwr["leisure"~"^(fitness_centre|sports_centre|bowling_alley|amusement_arcade|'
    'dance|escape_game)$"]',
])


def osm_businesses() -> str:
    q = (f"[out:json][timeout:180][bbox:{S},{W},{N},{E}];({BUSINESS_SELECTOR};);out center tags;")
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers={"User-Agent": UA})
    delay = 5.0
    for attempt in range(5):
        try:
            raw = urllib.request.urlopen(req, timeout=200).read()
            break
        except Exception as exc:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f"    retry in {delay:.0f}s ({exc})", file=sys.stderr)
            time.sleep(delay); delay *= 2
    osm = json.loads(raw)
    feats = []
    for el in osm.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "node":
            lon, lat = el.get("lon"), el.get("lat")
        else:  # way/relation -> use 'center'
            c = el.get("center", {})
            lon, lat = c.get("lon"), c.get("lat")
        if lon is None or lat is None:
            continue
        # derive a coarse category + a display name
        cat = (tags.get("shop") or tags.get("amenity") or tags.get("office")
               or tags.get("craft") or tags.get("tourism") or tags.get("healthcare")
               or tags.get("leisure") or "business")
        feats.append({
            "type": "Feature",
            "id": f"{el['type']}/{el['id']}",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"name": tags.get("name", ""), "category": cat,
                           "osm_id": el["id"], "osm_type": el["type"], **tags},
        })
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, "osm_businesses.geojson")
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    return f"{p}  ({len(feats)} businesses from OpenStreetMap)"


def overture_places(release: str) -> str:
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "overture_places.geojson")
    bbox = f"{W},{S},{E},{N}"

    # Path 1: the official overturemaps CLI (auto-selects latest release).
    from shutil import which
    if which("overturemaps"):
        cmd = ["overturemaps", "download", f"--bbox={bbox}", "-f", "geojson",
               "--type=place", "-o", out]
        print(f"    $ {' '.join(cmd)}", file=sys.stderr)
        subprocess.run(cmd, check=True)
        return f"{out}  (Overture places via overturemaps CLI)"

    # Path 2: DuckDB Python package querying Overture's S3 parquet directly.
    try:
        import duckdb  # type: ignore
    except ImportError:
        msg = (
            "Overture needs the `overturemaps` CLI or the `duckdb` package — neither found.\n"
            "    Install one of:\n"
            "      pipx install overturemaps      # then re-run --overture\n"
            "      pip install duckdb\n"
            "    Or run the DuckDB one-liner from the README. Skipping Overture.")
        print("    " + msg.replace("\n", "\n    "), file=sys.stderr)
        return "SKIPPED (install overturemaps CLI or duckdb)"

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2';")
    src = (f"s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*")
    rows = con.execute(f"""
        SELECT names.primary AS name,
               categories.primary AS category,
               confidence,
               ST_AsGeoJSON(geometry) AS geom
        FROM read_parquet('{src}', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN {W} AND {E}
          AND bbox.ymin BETWEEN {S} AND {N}
    """).fetchall()
    feats = [{"type": "Feature", "geometry": json.loads(g),
              "properties": {"name": nm, "category": cat, "confidence": conf}}
             for nm, cat, conf, g in rows if g]
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    return f"{out}  ({len(feats)} Overture places, release {release})"


def main(argv) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--overture", action="store_true", help="also fetch Overture places")
    ap.add_argument("--overture-only", action="store_true")
    ap.add_argument("--release", default=DEFAULT_OVERTURE_RELEASE,
                    help="Overture release tag for the DuckDB path")
    args = ap.parse_args(argv)

    ok = failed = 0
    try:
        if not args.overture_only:
            print("  > OSM businesses ...", file=sys.stderr)
            print("    " + osm_businesses(), file=sys.stderr); ok += 1
    except Exception as exc:  # noqa: BLE001
        print(f"    ! FAILED osm: {exc}", file=sys.stderr); failed += 1
    if args.overture or args.overture_only:
        try:
            print("  > Overture places ...", file=sys.stderr)
            print("    " + overture_places(args.release), file=sys.stderr); ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED overture: {exc}", file=sys.stderr); failed += 1
    print(f"\nDone. {ok} ok, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
