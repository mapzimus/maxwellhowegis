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

## 2026-07-15 — Sync `whydah/navigator/` to upstream v8

**Files changed**: `whydah/navigator/game.js`, `game.css`, `README.md`
(copied verbatim from `mapzimus/Whydah-Unit@main`), `index.html` (synced
to the upstream structure — adds the v7 pause button — but keeps this
repo's local head: the github.io-only redirect and the inline SVG
favicon, instead of upstream's canonical-host redirect that would bounce
maxwellhowegis.com visitors to whydahstory.com and its `../pics` favicon
paths that don't exist here).

**Why**: The vendored copy was two major versions stale (v6, before the
mission campaign). Upstream v7+v8 added the ten-mission campaign,
resume/port upgrades, mission bosses (incl. the Sharknado), scene
crossfades, merchants, ship liveries, the suggestion box, and the
secret-word INSANE unlock. This copy has no automatic parity with
upstream — re-sync by hand after future Whydah-Unit merges, preserving
the `index.html` head divergence above.

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

---

## 2026-07-02 — `ma-atlas/app.js`: single-burst startup data loading

**Files changed**: `ma-atlas/app.js` (the `map.on("load", ...)` handler,
~lines 2810–3110).

**What**: The startup handler fired its data fetches in three sequential
"waves": a 53-item `Promise.all`, then (only after that fully resolved and
~70 lines of synchronous `enrich*()` processing ran) a second `Promise.all`
of the `EXTRA_DISTRICT_SOURCES` list (~37 fetches), then a third, single
`await fetch(SOURCES.maPrivateSchools)`. All three waves hit static,
hard-coded `SOURCES.*` paths — none of their URLs are derived from another
wave's *results*, only the in-app `enrich*()`/merge processing after wave 1
depends on wave-1 *data*. So there was no correctness reason for waves 2
and 3 to wait on wave 1's network round-trip. The fix restructures the
handler to kick off all three waves' fetch promises up front (`wave1Promise`,
`extraDistrictPromise`, `privateSchoolsPromise`), then `await`/destructure
them in the original order — the destructuring assignment and every
downstream `enrich*()` call, in the original sequence, are byte-for-byte
unchanged. Also added explicit `.ok` checks + a tagged `criticalSource`
error on the two fetches (`academic`, `municipalities`) the app can't
function without, so a failure surfaces a specific message
("academic district boundaries" / "municipality boundaries") in the
existing `#mapLoading` error UI instead of the generic fallback text.

**Why**: Chrome/browsers don't need waves 2 and 3 to be *sequenced* after
wave 1 — they were only sequenced because of how the `await`s were laid
out in the source, not because of any real data dependency. On a route-mocked
local server the first-request-to-last-request-start spread collapsed from
332 ms (with a clear ~193 ms dead gap at the wave-1→wave-2 boundary) to
82 ms (largest gap 16 ms — ordinary connection-queueing jitter, not a wave
boundary); over a real network with non-trivial per-request latency the
absolute savings are larger (one fewer serialized round-trip category
before the whole payload is in flight).

**How to re-apply after the next upstream sync**: if the next sync
overwrites `ma-atlas/app.js` wholesale, reapply by moving the
`EXTRA_DISTRICT_SOURCES` array declaration and the
`fetch(SOURCES.maPrivateSchools)...` promise construction to *before* the
big `Promise.all([...])` literal (assigning each to its own `const
...Promise` instead of awaiting immediately), then replacing the later
`await Promise.all(EXTRA_DISTRICT_SOURCES.map(...))` / `await
fetch(SOURCES.maPrivateSchools)...` call sites with `await
extraDistrictPromise` / `await privateSchoolsPromise` respectively — i.e.
"declare and start every fetch first, await in original order later."
Preserve the `academic`/`municipalities` `.ok`-check + `criticalSource`
tagging and the matching `err.criticalSource` branch in the outer `catch`
block. See the Round 4b PR description for the full before/after diff.

---

## 2026-07-02 — Simplify `ma-atlas/data/ma_academic_districts.geojson` + `ma_municipalities.geojson`

**Files changed**:
- `ma-atlas/data/ma_academic_districts.geojson` (3.92 MB → 3.61 MB, −7.8%)
- `ma-atlas/data/ma_municipalities.geojson` (1.23 MB → 0.98 MB, −20.0%)

**What**: Ran both files through `mapshaper` with topology-preserving
Visvalingam simplification at 50% point retention, `keep-shapes` (guarantees
no polygon collapses to nothing), and 5-decimal coordinate precision:

```bash
npx -y mapshaper ma-atlas/data/ma_academic_districts.geojson \
    -simplify 50% keep-shapes \
    -o ma-atlas/data/ma_academic_districts.geojson precision=0.00001 format=geojson

npx -y mapshaper ma-atlas/data/ma_municipalities.geojson \
    -simplify 50% keep-shapes \
    -o ma-atlas/data/ma_municipalities.geojson precision=0.00001 format=geojson
```

Only `geometry.coordinates` was touched — feature counts (281 districts,
351 municipalities) and every feature's `properties` dict were verified
byte-identical before/after (Python comparator matched features on
`DIST_CODE` / `TOWN_ID` and diffed the full sorted property set; see the
Round 4b PR description).

**Why**: The task's default starting point (15% retention, the more
aggressive end) visibly degraded the Boston-area coastline/harbor boundary
detail on screenshot diff (~6.5% of map-canvas pixels differed at a
Boston-zoom screenshot, and the loss was visible by eye in cropped
side-by-side comparisons) — Boston Harbor's many small
inlets/peninsulas need more vertices than a generic town boundary to read
cleanly at in-app zoom levels. Retention was raised in steps (15% → 40% →
50% → 60% → 75%) until the statewide, Boston-zoom, and Lynn-zoom screenshots
matched the unsimplified original with no visible difference; 50% was the
lowest retention in the "clean" range, so it was kept for the larger file
savings. Note the modest savings vs. the ~50-70% estimated in AUDIT.md:
`ma_academic_districts.geojson` is dominated by non-geometry payload — of
its pre-simplification 3.92 MB, only ~0.67 MB was `geometry` JSON (the rest
is ~280 districts × several hundred year-suffixed metric columns in
`properties`), so simplifying geometry alone cannot approach a 50-70%
reduction on that file; `ma_municipalities.geojson` is closer to an even
geometry/property split (~0.65 MB / ~0.67 MB) and saved proportionally more
(20%).

**How to re-apply after the next upstream sync**: after the next PowerShell
sync overwrites these two files, re-run the two `mapshaper` commands above
against the freshly-synced files, then re-validate: feature counts
unchanged (281 / 351) and every feature's `properties` dict unchanged
(match on `DIST_CODE` / `TOWN_ID`). If either file's shape has changed
upstream (new districts/towns, redrawn boundaries), re-run the visual check
described in the Round 4b PR (statewide + Boston-zoom + Lynn-zoom
screenshots, before/after) before trusting 50% retention again — a
materially different source geometry could need a different retention
level to stay clean.

---

## 2026-07-05 — Sync `whydah/` vendored copy to upstream Whydah-Unit @33a39b4

**What**: Copied from `mapzimus/Whydah-Unit` main: `whydah-dashboard.html`,
`curriculum-guide.html`, `handouts.html`, `unit-at-a-glance.html`,
`flythrough.html`, `navigator/` (recursive), `pics/` (recursive). This brings
in the July 2026 curriculum state (confirmed 3-trip schedule, S11 Wreck +
survivor coda, in-class Synthesis Studio, 12 final-project formats, Boston
Harbor panel, and the July research-audit fact corrections) plus the June
navigator improvements (dynamic weather/events/instruments) that had never
been synced here.

**Deliberate divergence preserved**: `whydah/index.html` is this repo's own
branded meta-refresh page (anchor favicon + "Navigating Piracy" title) and is
NOT overwritten from upstream — upstream's plain index.html should not be
copied over it on future syncs.

**Upstream redirect**: every upstream page now carries a conditional
`canonical-host redirect` script that bounces `*.github.io` visitors to
`https://maxwellhowegis.com/whydah/...`. The script ships in this vendored
copy too but is inert here (hostname check) — do not strip it on sync.

**How to re-sync**: repeat the copy above (everything except
`whydah/index.html`), then plain commit — Pages deploys via Actions on push
to main.
