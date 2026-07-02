# Upstream Notes

`Lynn-data-dive/` (and `ma-atlas/`) are vendored copies manually synced from
other repos — see `ma-atlas/README.md` § *Refreshing data* and
`AUDIT.md` §2/§7 for the sync process (PowerShell copy of GeoJSON output
from the private `lehs-data-dive` pipeline into `maps/data/` / `data/`,
then a plain commit). Nothing in this repo's build enforces parity with
upstream, so any change made directly to a vendored file must be re-applied
by hand (or scripted) the next time that directory is re-synced. This file
is the log of such changes.

---

## 2026-07-02 — Minify `Lynn-data-dive/maps/data/*.geojson`

**Files changed** (all 7 GeoJSON files in the directory):
- `Lynn-data-dive/maps/data/lynn_schools.geojson`
- `Lynn-data-dive/maps/data/lynn_town.geojson`
- `Lynn-data-dive/maps/data/lynn_tracts.geojson`
- `Lynn-data-dive/maps/data/ma_academic_districts.geojson`
- `Lynn-data-dive/maps/data/ma_districts_metrics.geojson`
- `Lynn-data-dive/maps/data/ma_municipalities.geojson`
- `Lynn-data-dive/maps/data/ma_public_schools.geojson`

**What**: Rewrote each file in place as compact JSON (`json.dumps(...,
separators=(",", ":"))`, no pretty-printing/indentation) and rounded all
geometry coordinate values to 6 decimal places (~11 cm precision at MA's
latitude — far below source survey precision). No features were added or
removed, no properties were added, removed, or renamed, and no property
*values* were touched (only `geometry.coordinates`). Sizes went from
13.29 MB total to 9.75 MB (−3.13 MB, ~24%); see the PR description for the
per-file table.

**Why**: The pipeline output committed to this vendored copy was
one-feature-per-line JSON with spaces after `:`/`,` (not full
indent-per-key pretty-printing, but not compact either), inflating repo
weight for no runtime benefit — `Lynn-data-dive/maps/app.js` just does
`fetch(url).then(r => r.json())`, so the browser doesn't care about
formatting. `ma-atlas/data/` already ships several of the same base layers
(`ma_municipalities`, `ma_academic_districts`, `ma_districts_metrics`,
`ma_public_schools`) as compact single-line JSON, confirming this is a
supported/expected format for the same pipeline's output, not a special
transformation of Lynn's data. Lynn's copies were kept as separate,
self-contained files (not repointed at `ma-atlas/data/`) because their
`ma_municipalities.geojson` and `ma_academic_districts.geojson` differ from
the ma-atlas copies in real content (see PR description — Lynn's
`ma_municipalities.geojson` carries ~350 extra year-suffixed property
columns, e.g. `AS_PCT__1994`...`AS_PCT__2026`, that `Lynn-data-dive/maps/app.js`
reads for its Year slider feature and that `ma-atlas/data/ma_municipalities.geojson`
does not have), so the two copies are not interchangeable.

**How to re-apply after the next upstream sync**: after copying fresh
GeoJSON from `lehs-data-dive` into `Lynn-data-dive/maps/data/` (per the
PowerShell steps in `ma-atlas/README.md`), run this against each file
before committing:

```python
# minify_geojson.py <file.geojson> [<file2.geojson> ...]
# Compacts JSON separators and rounds geometry coordinates to 6dp in place.
import json, sys

def round_coords(obj):
    if isinstance(obj, list):
        return [round_coords(x) for x in obj]
    if isinstance(obj, float):
        return round(obj, 6)
    return obj

def round_geometry(geom):
    if geom is None:
        return None
    if geom.get("type") == "GeometryCollection":
        geom["geometries"] = [round_geometry(g) for g in geom.get("geometries", [])]
        return geom
    if "coordinates" in geom:
        geom["coordinates"] = round_coords(geom["coordinates"])
    return geom

for path in sys.argv[1:]:
    with open(path) as f:
        data = json.load(f)
    for feat in data.get("features", []):
        if "geometry" in feat:
            feat["geometry"] = round_geometry(feat["geometry"])
    with open(path, "w") as f:
        f.write(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
```

```bash
python3 minify_geojson.py Lynn-data-dive/maps/data/*.geojson
```

Validate after running: each file still parses as JSON, `len(features)`
matches the pre-sync count, and `sorted(features[0]["properties"].keys())`
is unchanged from before the sync (catches accidental schema drift from
upstream, independent of this minification step).
