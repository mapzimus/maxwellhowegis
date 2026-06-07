#!/usr/bin/env python3
"""
download_concord.py
===================
Auto-discover and download EVERY queryable vector layer published by the City
of Concord, NH ArcGIS REST server to GeoJSON.

It walks the services directory (folders -> services -> layers), skips raster /
group / annotation / non-queryable layers, de-duplicates layers that appear in
multiple map services, and writes one GeoJSON file per layer.

    python download_concord.py                 # download everything
    python download_concord.py --list          # just list layers, no download
    python download_concord.py --overwrite     # re-download existing files
    python download_concord.py --folder Public # restrict to one REST folder

Output: concord-nh-data/data/concord_arcgis/<folder>/<service>__<id>_<name>.geojson
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any, Dict, List, Tuple

import arcgis_to_geojson as a2g

SERVER = "https://gis.concordnh.gov/arc1061/rest/services"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.normpath(os.path.join(HERE, "..", "data", "concord_arcgis"))

# Map services that mirror the same underlying layers. We prefer these richest
# services (in this priority order) and skip the rest to avoid downloading the
# same parcels 5x. Set --all-services to ignore this and crawl everything.
PREFERRED_SERVICES_ORDER = [
    "CityGeneral/WaterSystemGIS",   # ~76 layers: parcels, zoning, utils, admin, base
    "Public/SewerSystemGISBeta",    # sewer + stormwater + abandoned-infra detail
    "Public/PubWebGIS2020",         # public viewer layers
    "CityGeneral/CurrentUse",       # current-use tax program
    "CityGeneral/ParcelDimensions",
    "CityGeneral/RoadCenterlineQuery",
    "CityGeneral/WasteCollectionCustomers",
    "GSDField/BackflowInspection",
    "GSDField/DrainMainJetting",
    "GSDField/IrrigationInspection",
    "GSDField/SidewalkPlowing",
    "GSDField/UtilityInspection",
]
PREFERRED_SERVICES = set(PREFERRED_SERVICES_ORDER)


def slug(text: str) -> str:
    text = re.sub(r"[^A-Za-z0-9]+", "_", str(text)).strip("_")
    return text or "layer"


def list_folders() -> List[str]:
    return a2g._get(SERVER, {"f": "json"}).get("folders", []) or []


def list_services(folder: str) -> List[Dict[str, Any]]:
    url = f"{SERVER}/{folder}" if folder else SERVER
    return a2g._get(url, {"f": "json"}).get("services", []) or []


def list_layers(service_url: str) -> List[Dict[str, Any]]:
    """Return full layer definitions (incl. type + geometryType) for a service.

    The service root (/MapServer?f=json) only lists id/name for MapServers, so we
    hit the /layers endpoint which returns complete definitions for every layer.
    """
    doc = a2g._get(f"{service_url}/layers", {"f": "json"})
    return doc.get("layers", []) or []


def discover(folders=None, all_services=False) -> List[Tuple[str, str, int, str, str]]:
    """Yield (folder, serviceName, layerId, layerName, layerUrl) for downloadable layers."""
    targets: List[Tuple[str, str, int, str, str]] = []
    folders = folders or ([""] + list_folders())
    for folder in folders:
        for svc in list_services(folder):
            name = svc.get("name", "")          # e.g. "CityGeneral/WaterSystemGIS"
            stype = svc.get("type", "")
            if stype not in ("MapServer", "FeatureServer"):
                continue
            if not all_services and name not in PREFERRED_SERVICES:
                continue
            service_url = f"{SERVER}/{name}/{stype}"
            try:
                layers = list_layers(service_url)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! could not read {name}: {exc}", file=sys.stderr)
                continue
            for lyr in layers:
                geom = lyr.get("geometryType")
                if lyr.get("type") in ("Group Layer", "Raster Layer", "Annotation Layer"):
                    continue
                if geom not in (
                    "esriGeometryPoint", "esriGeometryMultipoint",
                    "esriGeometryPolyline", "esriGeometryPolygon",
                ):
                    continue
                lid = lyr["id"]
                targets.append((folder or name.split("/")[0], name, lid,
                                lyr.get("name", f"layer{lid}"),
                                f"{service_url}/{lid}"))
    return targets


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="list layers and exit")
    ap.add_argument("--overwrite", action="store_true", help="re-download existing files")
    ap.add_argument("--folder", action="append", help="restrict to REST folder(s)")
    ap.add_argument("--all-services", action="store_true",
                    help="crawl every service (may duplicate layers)")
    ap.add_argument("--page", type=int, default=1000)
    args = ap.parse_args(argv)

    print(f"Discovering layers on {SERVER} ...", file=sys.stderr)
    targets = discover(folders=args.folder, all_services=args.all_services)
    # Many layers (Property, Zoning, Streets...) appear in several map services.
    # De-duplicate GLOBALLY by layer name, keeping the copy from the highest-
    # priority service so we download each distinct dataset only once.
    priority = {name: i for i, name in enumerate(PREFERRED_SERVICES_ORDER)}
    targets.sort(key=lambda t: (slug(t[3]).lower(), priority.get(t[1], 999)))
    seen = set()
    unique = []
    for t in targets:
        key = slug(t[3]).lower()           # layer-name slug
        if key in seen:
            continue
        seen.add(key)
        unique.append(t)
    targets = sorted(unique, key=lambda t: (t[1], t[2]))

    print(f"Found {len(targets)} downloadable vector layers.\n", file=sys.stderr)
    if args.list:
        for folder, svc, lid, name, url in targets:
            print(f"  [{folder}] {svc}/{lid}  {name}")
        return 0

    ok = skipped = failed = 0
    for folder, svc, lid, name, url in targets:
        svc_slug = slug(svc.split("/")[-1])
        out_dir = os.path.join(OUT_ROOT, slug(folder))
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{svc_slug}__{lid}_{slug(name)}.geojson")
        rel = os.path.relpath(out_path, OUT_ROOT)

        if os.path.exists(out_path) and not args.overwrite:
            print(f"  = skip (exists) {rel}", file=sys.stderr)
            skipped += 1
            continue
        try:
            print(f"  > {name}  ({url})", file=sys.stderr)
            n = a2g.download_to_file(
                url, out_path, page=args.page,
                progress=lambda m: print(m, file=sys.stderr),
            )
            print(f"    wrote {n} features -> {rel}", file=sys.stderr)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {name}: {exc}", file=sys.stderr)
            failed += 1

    print(f"\nDone. {ok} downloaded, {skipped} skipped, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
