# The Sequential Interstate Challenge

An **Optitrek** test case. Drive every two-digit (primary) Interstate in the contiguous US,
end to end, and compare two strategies:

- **Version A — Sequential.** Visit the Interstates in strict numerical order (I-2, I-4, I-5,
  I-8 … I-99), traversing each fully. The only freedom is which terminus of the *next* Interstate
  you start from. Solved exactly with a 2-state dynamic program over orientations.
- **Version B — Optitrek-optimized.** Same hard constraint (every Interstate driven end to end),
  but the order **and** each route's orientation are free. Optitrek minimizes the total
  **connector** miles between traversals.

Mainline mileage (~43,000 mi — the sum of the seed table's reference lengths; the brief's rough
estimate was ~47,000) is a fixed cost incurred either way, so the objective is purely the sum of
connector legs. The headline is the Version A − Version B delta.

**Result (latest run):** strict numerical order racks up **~67,400 connector mi** — because
numerical adjacency is not geographic adjacency, naive order forces ~20 transcontinental hops
(I-4 FL → I-5 CA, I-40 CA → NC, I-90 WA → MA …). Optimized order + orientation cuts that to
**~9,800 connector mi** — a **~57,700 mi (≈86%)** saving. See `data/summary.json` for exact figures.

## Problem shape

A Rural-Postman / sequential-edge-traversal TSP. Each Interstate is one required edge that must be
driven completely, in one of two orientations (start at terminus X or Y). **69 edges:** the five
reused numbers (I-76, I-84, I-86, I-87, I-88) are split into two physically distinct edges each;
the segmented routes (I-49, I-69, I-74) are one edge each with internal gaps bridged inside the
fixed mainline. The solver chooses (a) the permutation of edges and (b) the orientation of each.

## How it's built

`scripts/build_interstate_data.py` (run from the repo root):

1. **Geocode** the termini in `scripts/interstate_termini.csv` via Nominatim (cached).
2. **Connector matrix** — endpoint-to-endpoint driving distance from the **OSRM public demo**
   (`router.project-osrm.org`), requested as tiled `/table` calls; any unreachable cell falls back
   to haversine × 1.2. Cached.
3. **Version A** — locked numerical order, orientation chosen by DP to minimize connectors.
4. **Version B** — multi-start nearest-neighbor + 2-opt / Or-opt / orientation-flip local search.
5. **Geometry** — OSRM route shapes for the connectors (and a schematic mainline trace per edge).
6. Writes `data/interstates.json`, `data/mainlines.geojson`, `data/version_a.geojson`,
   `data/version_b.geojson`, and `data/summary.json`.

```bash
python3 scripts/build_interstate_data.py     # network + cached; safe to re-run
python3 -m http.server 8001                  # then open /interstate-challenge/
```

The page (`index.html`) is a single self-contained MapLibre GL page — keyless CARTO dark basemap,
the termini, both connector networks, an A/B/both toggle, an itinerary drawer, and the
distance-delta headline. No build step, no API keys.

## Caveats (v1)

- **Connector metric is distance**, not drive time (the doc's v1 default; time is a later swap).
- **Mainline geometry is schematic** — an OSRM A→B trace per Interstate, not a surveyed centerline.
  Mainline *lengths* are the reference values from the challenge table; only connectors are routed
  for the optimization.
- Termini are geocoded at **city/junction level** — fine for connectors that run hundreds of miles,
  but not surveyed terminus coordinates. The residual `[verify]` list from the challenge doc
  (I-22, I-26, I-39, I-76 W/E, I-86 East, I-87 NC, I-99, I-2, I-14) is approximate.
- Routing uses the shared **OSRM public demo**; a self-hosted OSRM (the Optitrek stack) would be the
  production source.

See `scripts/build_interstate_data.py` and `data/summary.json` for the exact run metadata
(build date, routing source, fallback count, solver).
