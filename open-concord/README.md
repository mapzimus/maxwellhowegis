# openconcord (R)

Concord, NH geospatial data → **PostGIS** → a static **MapLibre mega map**, all in
R. A `{targets}` pipeline acquires every public Concord dataset (city ArcGIS,
federal/state ArcGIS, OpenStreetMap, schools incl. **Penacook / Merrimack Valley
SD**, demographics, biodiversity, knowledge), loads each into PostGIS tagged
`map+db` or `db`, and exports a self-hostable web map.

> **Status: R port in progress.** This replaces the (validated) Python toolkit.
> R is not installed in the build sandbox, so this code is written against known
> package APIs but **not yet executed end-to-end** — run it locally and iterate.

## Stack

| Concern | Package |
|---|---|
| ArcGIS REST → `sf` | `arcgislayers` |
| Census ACS + TIGER (tracts, **school districts**) | `tidycensus`, `tigris` |
| OpenStreetMap | `osmdata` |
| Biodiversity | `rgbif` (+ `rinat`) |
| School enrollment ("big database") | `educationdata` (Urban Institute) |
| People / facts / history | `WikidataQueryServiceR`, `WikipediR` |
| Spatial + I/O | `sf`, `terra` |
| Misc APIs | `httr2`, `jsonlite` |
| Database | `DBI`, `RPostgres`, `sf` → PostGIS |
| Pipeline | `targets` |
| Map | `mapgl` / MapLibre + PMTiles |

## Two-tier model

Every dataset is `map+db` (geometry → renders on the map **and** stored) or `db`
(reference/bulk table joined to map layers). The `public.catalog` table records
each load + a `validated` flag (flip after the per-dataset visual check).

## Run

```r
# 1. configure PostGIS (Supabase or local) via libpq env vars
Sys.setenv(PGHOST="...", PGDATABASE="openconcord", PGUSER="...", PGPASSWORD="...")
Sys.setenv(CENSUS_API_KEY="...")            # for tidycensus

# 2. install + run the whole pipeline
# install.packages(c("targets", ...)); devtools::load_all(".")
targets::tar_make()                          # download -> PostGIS -> web export

# or run a single group
openconcord::oc_load_schools()
```

## Self-hosting on the website

`oc_export_web()` reads PostGIS and writes, into the site's `concord/data/`:
- `concord.pmtiles` — all `map+db` layers (via `tippecanoe`) for the static map
- `*.parquet` — `db` tables for in-browser DuckDB-WASM querying
- `catalog.json` — drives the map's layer panel

The map (`concord/index.html`, MapLibre + PMTiles) is fully static → lives at
`maxwellhowegis.com/concord/` on GitHub Pages. PostGIS itself is hosted on
Supabase (managed) and is the pipeline's source of truth.

## Remaining (next phases)

- Flesh out the rest of the `httr2` API sources in `R/apis.R` (epa_frs, cdc_places,
  usgs gages, lodes, nrel_ev, inaturalist, wikidata_landmarks, key-gated AQI/FIRMS).
- `roxygen2::roxygenise()` to generate `NAMESPACE`/man pages.
- `mapgl`-based styling per geometry/attribute; choropleths from `db` joins.
- Validation harness writing `catalog.validated`.
