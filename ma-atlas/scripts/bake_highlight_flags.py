"""
Bake highlight-group flags onto ma_academic_districts.geojson:

  - is_regional : the district serves more than one municipality (a regional /
                  multi-town district), via a town-centroid count.
  - is_gateway  : the district is one of the 26 state-designated Gateway Cities
                  (a Gateway municipality's centroid falls inside it).

These power the sidebar "Highlight a group" picker. `_nohs` (no high school) is
computed at runtime in app.js and the Top/Bottom-decile groups are computed from
the active metric, so only these two structural flags need baking.

Idempotent. Run from repo root:  python scripts/bake_highlight_flags.py
"""
from __future__ import annotations
import json
from pathlib import Path
from shapely.geometry import shape
from shapely.strtree import STRtree

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
MUNIS = REPO / "data" / "ma_municipalities.geojson"


def main() -> int:
    gj = json.loads(DISTS.read_text())
    feats = gj["features"]
    dgeom = [shape(f["geometry"]).buffer(0) for f in feats]
    tree = STRtree(dgeom)

    munis = json.loads(MUNIS.read_text())["features"]
    town_count = [0] * len(feats)
    gateway_hit = [False] * len(feats)
    for mf in munis:
        pt = shape(mf["geometry"]).representative_point()
        is_gw = bool(mf["properties"].get("is_gateway"))
        # Count this town for EVERY district whose footprint covers it — not just
        # the first. Secondary regional (7-12 / 9-12) districts are the union of
        # member towns whose polygons also belong to those towns' K-8 elementary
        # districts, so the two overlap. A `break` here assigned each town to only
        # one of them, undercounting the regional to <=1 town and mis-flagging it
        # is_regional=False (e.g. Concord-Carlisle, Somerset Berkley). Counting all
        # containers gives each district its true member-town count; single-town
        # districts still total 1, and is_gateway is unaffected (verified).
        for i in tree.query(pt):           # candidate districts by bbox
            if dgeom[i].contains(pt):       # a district this town sits in
                town_count[i] += 1
                if is_gw:
                    gateway_hit[i] = True

    n_reg = n_gw = 0
    for i, f in enumerate(feats):
        f["properties"]["is_regional"] = town_count[i] > 1
        f["properties"]["is_gateway"] = gateway_hit[i]
        n_reg += town_count[i] > 1
        n_gw += gateway_hit[i]

    DISTS.write_text(json.dumps(gj, separators=(",", ":")))
    print(f"baked flags onto {len(feats)} districts: is_regional={n_reg}, is_gateway={n_gw}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
