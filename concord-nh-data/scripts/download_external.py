#!/usr/bin/env python3
"""
download_external.py
====================
Download federal + state ArcGIS REST layers clipped to the Concord, NH bounding
box and save each as GeoJSON. Targets are defined in ../sources.json under the
"external_arcgis" key, so you can add layers without touching this script.

    python download_external.py            # download all configured targets
    python download_external.py --list     # list targets and exit
    python download_external.py --only fema_flood_zones tiger_roads

Output: concord-nh-data/data/external/<key>.geojson
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List

import arcgis_to_geojson as a2g

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.normpath(os.path.join(HERE, "..", "sources.json"))
OUT_ROOT = os.path.normpath(os.path.join(HERE, "..", "data", "external"))

# Concord, NH bounding box (WGS84), from the city boundary layer extent.
CONCORD_BBOX = "-71.668185,43.151772,-71.456903,43.309419"


def load_targets():
    with open(SOURCES, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("external_arcgis", [])


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only", nargs="*", help="download only these target keys")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--bbox", default=CONCORD_BBOX, help="override bbox xmin,ymin,xmax,ymax")
    args = ap.parse_args(argv)

    targets = load_targets()
    if args.only:
        targets = [t for t in targets if t["key"] in set(args.only)]

    if args.list:
        for t in targets:
            print(f"  {t['key']:28s} {t.get('title','')}")
            print(f"      {t['url']}")
        return 0

    os.makedirs(OUT_ROOT, exist_ok=True)
    ok = skipped = failed = 0
    for t in targets:
        key = t["key"]
        out_path = os.path.join(OUT_ROOT, f"{key}.geojson")
        if os.path.exists(out_path) and not args.overwrite:
            print(f"  = skip (exists) {key}", file=sys.stderr)
            skipped += 1
            continue
        bbox = None if t.get("bbox") is False else args.bbox
        where = t.get("where", "1=1")
        try:
            print(f"  > {key}: {t.get('title','')}", file=sys.stderr)
            n = a2g.download_to_file(
                t["url"], out_path, where=where, bbox=bbox,
                progress=lambda m: print(m, file=sys.stderr),
            )
            print(f"    wrote {n} features -> data/external/{key}.geojson", file=sys.stderr)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {key}: {exc}", file=sys.stderr)
            failed += 1

    print(f"\nDone. {ok} downloaded, {skipped} skipped, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
