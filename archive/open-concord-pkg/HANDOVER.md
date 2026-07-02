# Open Concord — Handover

Everything you need to pick this up locally in R, validate it, and ship it.

## TL;DR

- **Goal**: acquire every public Concord, NH dataset → **PostGIS** → an interactive
  **R Shiny** map, self-hosted on your VPS, embedded at `maxwellhowegis.com/concord/`.
- **Status**: the project was first built and **fully validated in Python** (every
  dataset downloaded live — counts below). It has since been **ported to R**
  (package + `{targets}` + Shiny) per your decision to go R front-to-back. The R
  code is written to known package APIs and delimiter-checked **but not yet
  executed** (no R in the build environment). **Your first local run is the real
  test.**
- **What you do**: stand up local PostGIS, run the ETL, run the Shiny app, and
  validate layers one at a time (see [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) +
  [`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md)). Fix the handful of
  package-API details in the **Risk register** below as you hit them.

## Architecture

```
 openconcord (R)  targets::tar_make()  ──►  PostGIS (local now / VPS later)
                                                  ▲ DBI/sf  (live queries)
                        R Shiny app (shiny/app.R, leaflet) ── the frontend, in R
                                                  ▼ (deploy)
                Caddy TLS → concord.maxwellhowegis.com → iframed at /concord/
```

Every dataset is tagged **`map+db`** (geometry → map + DB) or **`db`**
(reference/bulk table joined to map layers) in `public.catalog`.

## Repo map

| Path | What |
|---|---|
| `open-concord/R/*.R` | the `openconcord` package — ETL functions (`oc_*`) |
| `open-concord/_targets.R` | the pipeline (replaces `run_all.py`) |
| `open-concord/shiny/app.R` | **the frontend** (Shiny + leaflet + sf + pool) |
| `open-concord/inst/sql/schema.sql` | schemas + `public.catalog` |
| `open-concord/Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.example` | deploy |
| `open-concord/setup.R`, `renv.lock`, `NAMESPACE`, `DESCRIPTION` | env/package |
| `open-concord/docs/` | `MEGA_MAP_SPEC`, `ACCOUNTS_NEEDED`, `LAYER_INDEX`, `LOCAL_DEV`, `VALIDATION_LOG` |
| `concord/index.html` | GitHub Pages page that iframes the live Shiny app |
| `.github/workflows/concord-refresh.yml` | self-hosted-runner ETL refresh |

## Python → R map (cross-reference / git history)

The original Python (in git history before commit that removed `concord-nh-data/`)
is the validated reference. Mapping:

| Python | R |
|---|---|
| `arcgis_to_geojson.py` | `R/arcgis.R` `oc_arc_layer()` (via `{arcgislayers}`) |
| `download_concord.py` | `R/concord.R` `oc_load_concord()` |
| `download_external.py` | `R/external.R` `oc_load_external()` |
| `download_osm.py` | `R/osm.R` `oc_load_osm()` / `oc_load_businesses_osm()` |
| `download_apis.py` | `R/apis.R` `oc_load_apis()` + `oc_api_*()` |
| `download_schools.py` | `R/schools.R` `oc_load_schools()` (`{tigris}`, `{educationdata}`) |
| `download_knowledge.py` | `R/knowledge.R` `oc_load_knowledge()` |
| `download_businesses.py` (Overture) | `R/businesses.R` `oc_load_overture()` (`{duckdb}`) |
| `run_all.py` | `_targets.R` |
| `build_layer_index.py` | the live `public.catalog` table |
| (was static JS map) | `shiny/app.R` |

## Expected results (Python ground truth — validate R against these)

| Layer | Expected |
|---|---|
| City: discoverable vector layers | ~91 (`oc_load_concord`) |
| City: `Property` parcels | 13,160 |
| `usa_structures` (buildings w/ height) | 18,576 |
| `padus_conservation_lands` | 261 |
| `nrhp_historic_points` | 20 |
| `usace_dams` | 16 |
| `epa_rcra_facilities` / `_tri` / `_brownfields` | 919 / 22 / 14 |
| `epa_superfund_npl` | 0 (none in Concord — correct) |
| `tiger_tracts` / `cdc_places_tracts_poly` | 24 / 24 |
| `faa_obstructions` / `fcc_broadband_block_groups` | 530 / 52 |
| `nwi_wetlands` | 3,731 |
| Schools: district polygons | 2 (Concord SD 3302460 + MVSD 3304760) |
| Schools: public (by district) / region / private / colleges | 14 / 109 / 38 / 11 |
| Concord SD total enrollment (CCD 2022) | 4,037 |
| Knowledge: notable people / wikidata facts / history articles | 148 / 106 / 6 |
| APIs: earthquakes / gbif / inaturalist / wikidata / wikipedia | 111 / 9,000 / 3,000 / 252 / 83 |
| APIs: usgs gages / epa_frs rows / cdc_places rows | 9 / 2,625 / 1,560 |
| OSM businesses | ~644 |

Flaky upstreams (expect occasional re-runs, not bugs): FEMA NFHL (500s), SSURGO &
NCED (503/timeout), Urban Institute enrollment (slow), `developer.nrel.gov`
(blocked on some networks).

## Risk register — likely first-run fixes (R package-API details)

These are the spots most likely to need a tweak once R actually runs them. Check
each against the installed package version.

1. **`R/arcgis.R` `oc_arc_layer()`** — confirm `arcgislayers::arc_select()` arg
   names (`filter_geom`, `where`, `crs`). If a huge layer truncates, set a page
   size / use `arc_read()`. Smoke test: pull `…/WaterSystemGIS/MapServer/48` →
   expect 13,160.
2. **`R/concord.R` layer naming** — `attr(lyr, "layer_name")` may be absent on the
   returned `sf`; then table names fall back to the numeric layer id. Prefer the
   name from `arcgislayers::arc_open(url)$name` (or the service `/layers` doc) so
   city tables are named (e.g. `property`, not `48`).
3. **`R/osm.R` `oc_osm_combine()`** ⚠️ — `rbind()` of point + line + polygon `sf`
   has **mixed geometry types**; sf will object. Either write one table per
   geometry type (`roads_lines`, etc.), keep only the dominant type, or
   `st_cast()` to a generic `GEOMETRY` column. **Most likely real bug** — fix here.
4. **`R/db.R` / `shiny/app.R` geometry column name** — `sf::st_write()` to PostGIS
   names the geometry column (often `geometry` or `geom`). `app.R`'s draw query
   uses `ST_Intersects(geometry, …)`. Confirm the actual column name and make them
   match (grep for `geometry` in `app.R`).
5. **`R/schools.R`** — confirm `tigris::school_districts(type = "unified",
   year = 2022)` signature/vintage, and `educationdata::get_education_data(...)`
   `filters`/`subtopic` shape. GEOIDs are correct (3302460, 3304760).
6. **`R/apis.R`** — `tidycensus::get_acs(output="wide", geometry=TRUE)` needs
   `CENSUS_API_KEY` and yields `…E`/`…M` columns (the choropleth uses
   `median_household_incomeE`). The `sf::st_read(<geojson url>)` calls (earthquakes,
   NWS, NREL) rely on GDAL reading remote GeoJSON — verify. CDC/`geolocation` and
   Mapillary/iNat nested-JSON parsing may need tweaks per the simplified response.
7. **`shiny/app.R` events** — `input$map_draw_new_feature` (leaflet.extras draw)
   and `st_read()` of the drawn GeoJSON string. Stable APIs, but verify the draw
   payload shape.

## Adding a new dataset (the pattern)

1. ArcGIS layer? add to `data-raw/sources.json` `external_arcgis` — done (handled
   by `oc_load_external`). API source? add an `oc_api_*()` in `R/apis.R` and call
   it from `oc_load_apis()`.
2. Write with `oc_write_layer()` (spatial → `map+db`) or `oc_write_table()`
   (tabular → `db`); the catalog updates itself.
3. Add a `tar_target` in `_targets.R` only for a whole new group.
4. Validate it on the map (see below) and tick it in `VALIDATION_LOG.md`.

## Validate locally → deploy

- **Local**: [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) — Postgres in Docker, run the
  ETL, run Shiny on `localhost:3838`.
- **Per-dataset checklist**: [`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md) —
  validate one layer at a time (protocol in
  [`docs/MEGA_MAP_SPEC.md`](docs/MEGA_MAP_SPEC.md)), flip `catalog.validated`.
- **Deploy**: [`DEPLOY.md`](DEPLOY.md) — VPS PostGIS + Shiny + Caddy.
- **Accounts/keys**: [`docs/ACCOUNTS_NEEDED.md`](docs/ACCOUNTS_NEEDED.md).

## Git

- Branch: `claude/concord-nh-datasets-BaCwS` · PR #17 on `mapzimus/maxwellhowegis`.
- The validated Python lives in history (before the "remove Python" commit) if you
  want to diff behaviour while debugging the R.
- Commit/push only when you intend to; never to `main` without intent.
