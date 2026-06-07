#!/usr/bin/env python3
"""
arcgis_to_geojson.py
====================
Download any ArcGIS REST "Feature Layer" / queryable Map Service layer to a
GeoJSON FeatureCollection, handling server-side record caps with pagination.

Standard library only (urllib + json) so it runs on any Python 3.7+ with no
`pip install` step. Import it as a module or run it from the command line:

    python arcgis_to_geojson.py \
        "https://gis.concordnh.gov/arc1061/rest/services/CityGeneral/WaterSystemGIS/MapServer/48" \
        property.geojson

Optional flags:
    --where "ZONE = 'RS'"     SQL filter (default "1=1" = everything)
    --bbox  xmin,ymin,xmax,ymax   spatial filter (WGS84 lon/lat)
    --out-sr 4326             output spatial reference (default 4326 / WGS84)
    --page  1000              requested page size (server may cap it lower)
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional

USER_AGENT = "concord-nh-data/1.0 (+https://github.com/mapzimus/maxwellhowegis)"
TIMEOUT = 120


# --------------------------------------------------------------------------- #
# Low-level HTTP with retry/backoff
# --------------------------------------------------------------------------- #
def _get(url: str, params: Dict[str, Any], retries: int = 4) -> Dict[str, Any]:
    """GET `url?params` and parse JSON, retrying transient failures."""
    query = urllib.parse.urlencode(params)
    full = f"{url}?{query}"
    delay = 2.0
    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                raw = resp.read().decode("utf-8", "replace")
            data = json.loads(raw)
            # ArcGIS reports query errors inside a 200 body
            if isinstance(data, dict) and "error" in data:
                raise RuntimeError(f"ArcGIS error: {data['error']}")
            return data
        except Exception as exc:  # noqa: BLE001 - we want to retry anything transient
            last_err = exc
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
            else:
                raise RuntimeError(f"GET failed after {retries} retries: {full}\n{exc}") from last_err
    raise RuntimeError("unreachable")


# --------------------------------------------------------------------------- #
# Layer metadata
# --------------------------------------------------------------------------- #
def layer_info(layer_url: str) -> Dict[str, Any]:
    """Return the layer's JSON metadata document."""
    return _get(layer_url, {"f": "json"})


def is_downloadable(info: Dict[str, Any]) -> bool:
    """True if the layer is a queryable vector feature layer (not raster/group/annotation)."""
    if info.get("type") not in ("Feature Layer", None):
        # Map services list sublayers as type "Feature Layer"; group/raster differ
        if info.get("type") in ("Group Layer", "Raster Layer", "Annotation Layer"):
            return False
    caps = (info.get("capabilities") or "").lower()
    if "query" not in caps:
        return False
    geom = info.get("geometryType")
    vector_geoms = {
        "esriGeometryPoint",
        "esriGeometryMultipoint",
        "esriGeometryPolyline",
        "esriGeometryPolygon",
    }
    return geom in vector_geoms


def _ring_is_clockwise(ring: List[List[float]]) -> bool:
    """Shoelace sign; Esri exterior rings are clockwise."""
    area = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        area += (x2 - x1) * (y2 + y1)
    return area > 0


def esri_to_geojson_geometry(geom: Dict[str, Any], gtype: str):
    """Convert an Esri JSON geometry to a GeoJSON geometry dict (or None)."""
    if geom is None:
        return None
    if gtype == "esriGeometryPoint":
        if geom.get("x") is None:
            return None
        return {"type": "Point", "coordinates": [geom["x"], geom["y"]]}
    if gtype == "esriGeometryMultipoint":
        return {"type": "MultiPoint", "coordinates": geom.get("points", [])}
    if gtype == "esriGeometryPolyline":
        paths = geom.get("paths", [])
        if len(paths) == 1:
            return {"type": "LineString", "coordinates": paths[0]}
        return {"type": "MultiLineString", "coordinates": paths}
    if gtype == "esriGeometryPolygon":
        rings = geom.get("rings", [])
        polygons: List[List[List[List[float]]]] = []
        for ring in rings:
            if _ring_is_clockwise(ring):
                polygons.append([ring])          # new exterior ring
            elif polygons:
                polygons[-1].append(ring)         # hole on current polygon
            else:
                polygons.append([ring])           # orphan hole -> treat as exterior
        if len(polygons) == 1:
            return {"type": "Polygon", "coordinates": polygons[0]}
        return {"type": "MultiPolygon", "coordinates": polygons}
    return None


def esri_features_to_geojson(esri: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert an Esri query JSON response (features[]) to GeoJSON features."""
    gtype = esri.get("geometryType", "")
    out: List[Dict[str, Any]] = []
    for f in esri.get("features", []) or []:
        out.append({
            "type": "Feature",
            "properties": f.get("attributes", {}),
            "geometry": esri_to_geojson_geometry(f.get("geometry"), gtype),
        })
    return out


def _bbox_geometry(bbox: str) -> Dict[str, Any]:
    xmin, ymin, xmax, ymax = (float(v) for v in bbox.split(","))
    return {
        "geometry": json.dumps(
            {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax,
             "spatialReference": {"wkid": 4326}}
        ),
        "geometryType": "esriGeometryEnvelope",
        "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects",
    }


# --------------------------------------------------------------------------- #
# Feature download (paginated)
# --------------------------------------------------------------------------- #
def feature_count(layer_url: str, where: str = "1=1", bbox: Optional[str] = None) -> int:
    params: Dict[str, Any] = {"where": where, "returnCountOnly": "true", "f": "json"}
    if bbox:
        params.update(_bbox_geometry(bbox))
    return int(_get(f"{layer_url}/query", params).get("count", 0))


def download_features(
    layer_url: str,
    where: str = "1=1",
    bbox: Optional[str] = None,
    out_sr: int = 4326,
    page: int = 1000,
    info: Optional[Dict[str, Any]] = None,
    progress=lambda msg: None,
) -> Dict[str, Any]:
    """Download all matching features as a GeoJSON FeatureCollection dict."""
    if info is None:
        info = layer_info(layer_url)

    max_rc = int(info.get("maxRecordCount") or page)
    page = min(page, max_rc) if max_rc else page
    supports_pagination = bool(
        (info.get("advancedQueryCapabilities") or {}).get("supportsPagination")
    )

    # Use native GeoJSON when the server advertises it; otherwise request Esri
    # JSON and convert client-side (older 10.x services, some federal layers).
    fmts = (info.get("supportedQueryFormats") or "geoJSON").lower()
    fmt = "geojson" if "geojson" in fmts else "json"

    def _extract(resp: Dict[str, Any]) -> List[Dict[str, Any]]:
        if fmt == "geojson":
            return resp.get("features", []) or []
        return esri_features_to_geojson(resp)

    base: Dict[str, Any] = {
        "where": where,
        "outFields": "*",
        "outSR": out_sr,
        "f": fmt,
        "returnGeometry": "true",
    }
    if bbox:
        base.update(_bbox_geometry(bbox))

    features: List[Dict[str, Any]] = []

    if supports_pagination:
        offset = 0
        while True:
            params = dict(base, resultOffset=offset, resultRecordCount=page)
            fc = _get(f"{layer_url}/query", params)
            batch = _extract(fc)
            features.extend(batch)
            progress(f"      +{len(batch)} (total {len(features)})")
            if len(batch) < page:
                break
            offset += page
    else:
        # Fallback: window by ObjectID for servers without pagination support
        oid_field = info.get("objectIdField") or "OBJECTID"
        ids = _get(f"{layer_url}/query",
                   dict(base, returnIdsOnly="true", f="json")).get("objectIds") or []
        ids.sort()
        for i in range(0, len(ids), page):
            chunk = ids[i:i + page]
            where_ids = f"{oid_field} IN ({','.join(str(x) for x in chunk)})"
            params = dict(base, where=where_ids)
            params.pop("resultOffset", None)
            fc = _get(f"{layer_url}/query", params)
            batch = _extract(fc)
            features.extend(batch)
            progress(f"      +{len(batch)} (total {len(features)})")

    return {"type": "FeatureCollection", "features": features}


def download_to_file(
    layer_url: str,
    out_path: str,
    where: str = "1=1",
    bbox: Optional[str] = None,
    out_sr: int = 4326,
    page: int = 1000,
    progress=lambda msg: None,
) -> int:
    info = layer_info(layer_url)
    fc = download_features(layer_url, where=where, bbox=bbox, out_sr=out_sr,
                           page=page, info=info, progress=progress)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(fc, fh)
    return len(fc["features"])


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _main(argv: List[str]) -> int:
    import argparse

    ap = argparse.ArgumentParser(description="Download an ArcGIS REST layer to GeoJSON.")
    ap.add_argument("layer_url", help="Full layer URL ending in /<layerId>")
    ap.add_argument("out_path", help="Output .geojson path")
    ap.add_argument("--where", default="1=1")
    ap.add_argument("--bbox", default=None, help="xmin,ymin,xmax,ymax in WGS84")
    ap.add_argument("--out-sr", type=int, default=4326)
    ap.add_argument("--page", type=int, default=1000)
    args = ap.parse_args(argv)

    n = download_to_file(
        args.layer_url, args.out_path, where=args.where, bbox=args.bbox,
        out_sr=args.out_sr, page=args.page, progress=lambda m: print(m, file=sys.stderr),
    )
    print(f"Wrote {n} features -> {args.out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
