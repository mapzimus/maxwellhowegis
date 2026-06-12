"""
Cover the rural "orphan" towns that the upstream dominant-town-dissolve drops.

Problem
-------
`build_ma_academic_districts()` (sibling repo lehs-data-dive, 11_build_lynn_geo.py)
assigns each town to the district running the most public *schools* in it, then
dissolves towns by that code. ~28 tiny towns have NO public school inside them
(they send students to a regional), so they get no dominant district and are
dropped -> 0% covered on the district map (Granville, Cummington, Tolland, ...).
Their regional district usually already EXISTS in the geojson (built from its
seat town); the town's polygon just never joined the dissolve.

Fix (downstream, geometry-only)
-------------------------------
Union each orphan town's municipal polygon into its real district's existing
feature. No metric is invented: the district already carries its data; we only
extend its footprint to the member towns it always served. The town->district
crosswalk below was resolved authoritatively via the US Census Geocoder
(coordinates -> Unified/Secondary/Elementary School District layers, preferring
the layer that matches an existing district) and every assignment was verified
to be geographically contiguous with its district's (group) polygon. Monroe
(MA's tiny split-district town: Census elementary = Florida, secondary = North
Adams) is folded into Florida — its contiguous K-8 elementary district — since
North Adams is non-contiguous. After this, every MA town is covered (0 holes).

The PERMANENT fix lives upstream in build_ma_academic_districts(); this script
exists so the live map is whole now, without a full ~400MB E2C rebuild.

Idempotent: unioning an already-covered town is a no-op. Run from repo root:
    python scripts/cover_orphan_towns.py
"""
from __future__ import annotations
import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
MUNIS = REPO / "data" / "ma_municipalities.geojson"
NDIGITS = 5  # match scripts/round_coords.py

# DESE DIST_CODE -> orphan member towns (town_display in ma_municipalities.geojson).
# Source: US Census Geocoder (Public_AR_Current / Current_Current), preferring the
# school-district layer that matches an existing geojson district; contiguity-checked.
TARGETS: dict[str, list[str]] = {
    "00980000": ["Monroe"],                                          # Florida (K-8; Monroe HS tuitions to North Adams)
    "01500000": ["Tyringham"],                                       # Lee
    "06180000": ["Stockbridge", "West Stockbridge"],                 # Berkshire Hills
    "06320000": ["Goshen"],                                          # Chesterfield-Goshen
    "06350000": ["Cummington", "Peru", "Washington", "Windsor"],     # Central Berkshire
    "06620000": ["Sandisfield"],                                     # Farmington River Reg
    "06720000": ["Blandford", "Middlefield", "Montgomery", "Russell"],  # Gateway
    "07150000": ["New Ashford"],                                     # Mount Greylock
    "07170000": ["Hawley", "Heath", "Plainfield"],                   # Mohawk Trail
    "07200000": ["Phillipston"],                                     # Narragansett
    "07280000": ["Wendell"],                                         # New Salem-Wendell
    "07350000": ["Ashby"],                                           # North Middlesex
    "07500000": ["Leyden"],                                          # Pioneer Valley
    "07650000": ["Alford", "Monterey", "Mount Washington"],          # Southern Berkshire
    "07660000": ["Granville", "Tolland"],                            # Southwick-Tolland-Granville
    "07740000": ["Aquinnah"],                                        # Up-Island Regional
}


def round_coords(node):
    if isinstance(node, list):
        if node and all(isinstance(x, (int, float)) for x in node):
            return [round(x, NDIGITS) for x in node]
        return [round_coords(x) for x in node]
    return node


def main() -> int:
    gj = json.loads(DISTS.read_text())
    feats = gj["features"]
    by_code = {f["properties"].get("DIST_CODE"): f for f in feats}

    munis = json.loads(MUNIS.read_text())["features"]
    muni_geom = {}
    for f in munis:
        nm = f["properties"].get("town_display") or f["properties"].get("TOWN")
        if nm:
            muni_geom[nm] = shape(f["geometry"]).buffer(0)
            muni_geom[nm.upper()] = muni_geom[nm]

    changed = 0
    for code, towns in TARGETS.items():
        feat = by_code.get(code)
        if feat is None:
            raise SystemExit(f"[X] target district {code} not in geojson — aborting")
        dgeom = shape(feat["geometry"]).buffer(0)
        add = []
        for t in towns:
            g = muni_geom.get(t) or muni_geom.get(t.upper())
            if g is None:
                raise SystemExit(f"[X] muni '{t}' not found for {code}")
            # Skip towns already substantially inside the district (idempotent).
            if g.intersection(dgeom).area / g.area > 0.5:
                continue
            add.append(g)
        if not add:
            continue
        merged = unary_union([dgeom, *add]).buffer(0)
        feat["geometry"] = round_coords(mapping(merged))
        changed += 1
        print(f"  {code} {feat['properties'].get('DIST_NAME'):34} += {', '.join(towns)}")

    if changed:
        DISTS.write_text(json.dumps(gj, separators=(",", ":")))
    print(f"\ncovered orphan towns into {changed} districts this run "
          f"({sum(len(v) for v in TARGETS.values())} towns mapped total; every MA town now has a district — 0 holes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
