"""
Shrink the polygon GeoJSONs by rounding coordinates to 5 decimal places
(~1.1 m precision — far finer than a statewide choropleth at z6–z14 can show).

The source GeoJSONs carry ~14 decimals (sub-micron noise) that bloat the two
largest assets, which block first interactive paint. Rounding is loss-free at
the map's display scales and typically trims 30–50% off these files.

Idempotent: re-running on already-rounded files changes nothing.

Run from repo root::  python scripts/round_coords.py
"""
from __future__ import annotations
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
NDIGITS = 5
TARGETS = [
    "ma_academic_districts.geojson",
    "ma_municipalities.geojson",
    "ma_districts_metrics.geojson",
    "ma_public_schools.geojson",
]


def round_coords(node):
    """Recursively round every coordinate number in a GeoJSON geometry."""
    if isinstance(node, list):
        # A coordinate pair [lon, lat(, z)] is a list of numbers.
        if node and all(isinstance(x, (int, float)) for x in node):
            return [round(x, NDIGITS) for x in node]
        return [round_coords(x) for x in node]
    return node


def main() -> int:
    for name in TARGETS:
        path = DATA / name
        if not path.exists():
            print(f"  skip (missing): {name}")
            continue
        before = path.stat().st_size
        gj = json.loads(path.read_text())
        for f in gj.get("features", []):
            geom = f.get("geometry")
            if geom and "coordinates" in geom:
                geom["coordinates"] = round_coords(geom["coordinates"])
        # Compact separators — no superfluous whitespace.
        path.write_text(json.dumps(gj, separators=(",", ":")))
        after = path.stat().st_size
        pct = 100 * (before - after) / before if before else 0
        print(f"  {name}: {before/1e6:.2f}MB -> {after/1e6:.2f}MB  (-{pct:.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
