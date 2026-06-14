"""Build data/coastline.geojson from real Natural Earth land polygons.

Downloads Natural Earth 1:10m land (public domain), clips every polygon to the
game's bounding box using the Sutherland-Hodgman algorithm (no GIS libraries
needed), and writes a clean GeoJSON the game loads directly.

Re-run any time:
    python data/build_coastline.py

Data source: Natural Earth via the nvkelso/natural-earth-vector mirror.
Natural Earth is in the public domain (no attribution required).
"""

import json
import os
import urllib.request

# Bounds come from scenario.json so the clip region and the game's map are
# guaranteed to cover the exact same rectangle.
_HERE = os.path.dirname(__file__)
with open(os.path.join(_HERE, "scenario.json"), encoding="utf-8") as _fh:
    BOUNDS = json.load(_fh)["bounds"]

# Prefer the most detailed (1:10m) so Cape Cod's hook survives; fall back to 1:50m.
CANDIDATES = [
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson",
]
OUT = os.path.join(os.path.dirname(__file__), "coastline.geojson")


def reachable(url):
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20)
        return True
    except Exception:
        return False


def fetch(url):
    print("Downloading", url)
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)


# --- Sutherland-Hodgman clip of one ring against the axis-aligned rectangle ---
def clip_ring(ring, b):
    def inside(p, edge):
        x, y = p
        return {
            "W": x >= b["west"], "E": x <= b["east"],
            "S": y >= b["south"], "N": y <= b["north"],
        }[edge]

    def crossing(p, q, edge):
        (x1, y1), (x2, y2) = p, q
        if edge in ("W", "E"):
            xe = b["west"] if edge == "W" else b["east"]
            t = (xe - x1) / (x2 - x1)
            return [xe, y1 + t * (y2 - y1)]
        ye = b["south"] if edge == "S" else b["north"]
        t = (ye - y1) / (y2 - y1)
        return [x1 + t * (x2 - x1), ye]

    out = ring
    for edge in ("W", "E", "S", "N"):
        if not out:
            break
        prev_pts, out = out, []
        for i in range(len(prev_pts)):
            cur, prev = prev_pts[i], prev_pts[i - 1]
            cur_in, prev_in = inside(cur, edge), inside(prev, edge)
            if cur_in:
                if not prev_in:
                    out.append(crossing(prev, cur, edge))
                out.append(cur)
            elif prev_in:
                out.append(crossing(prev, cur, edge))
    return out


def overlaps(ring, b):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return not (max(xs) < b["west"] or min(xs) > b["east"] or
                max(ys) < b["south"] or min(ys) > b["north"])


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def main():
    url = next((u for u in CANDIDATES if reachable(u)), None)
    if not url:
        raise SystemExit("No Natural Earth land source reachable.")
    data = fetch(url)

    features = []
    for feat in data.get("features", [data]):
        for poly in polygons(feat["geometry"]):
            outer = poly[0]
            if not overlaps(outer, BOUNDS):
                continue
            clipped = clip_ring(outer, BOUNDS)
            if len(clipped) >= 3:
                features.append({
                    "type": "Feature",
                    "properties": {"kind": "land"},
                    "geometry": {"type": "Polygon", "coordinates": [clipped]},
                })

    out = {
        "type": "FeatureCollection",
        "note": f"Natural Earth land clipped to {BOUNDS}. Source: {url}",
        "features": features,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"Wrote {OUT}: {len(features)} land polygons from {url.rsplit('/', 1)[-1]}")


if __name__ == "__main__":
    main()
