# openconcord (R)

Concord, NH geospatial data → **PostGIS** → a static **MapLibre mega map**, all in
R. A `{targets}` pipeline acquires every public Concord dataset (city ArcGIS,
federal/state ArcGIS, OpenStreetMap, schools incl. **Penacook / Merrimack Valley
SD**, demographics, biodiversity, knowledge), loads each into PostGIS tagged
`map+db` or `db`, and exports a self-hostable web map.

> **Status: R port — the Python toolkit has been removed and fully replaced.**
> R is not installed in the build sandbox, so this code is written against known
> package APIs but **not yet executed end-to-end** — run it locally and iterate.
> The original validated Python lives in git history if you ever need to diff.
>
> **▶ Start here: [`HANDOVER.md`](HANDOVER.md)** — current state, architecture,
> Python→R map, expected counts, and the first-run risk register. Then
> [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) to run it on your machine and
> [`docs/VALIDATION_LOG.md`](docs/VALIDATION_LOG.md) to check off each dataset.

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

## Self-hosting (R end-to-end)

Everything is R: the ETL loads PostGIS and an **R Shiny app** (`shiny/app.R`,
leaflet + sf + pool) is the frontend, querying PostGIS live. Both run on your
**VPS** via `docker compose up -d` (PostGIS + Shiny + Caddy TLS — see
[`DEPLOY.md`](DEPLOY.md)). The app is served at `concord.maxwellhowegis.com` and
embedded at `maxwellhowegis.com/concord/` (GitHub Pages is static, so it iframes
the live app). Optional `--profile api` adds pg_tileserv/pg_featureserv for
vector-tile performance; `oc_export_web()` remains an optional static snapshot.

See [`DEPLOY.md`](DEPLOY.md) for the full VPS + PostGIS + static-publish setup.

## Remaining (next phases)

- ~~Flesh out the `httr2` API sources in `R/apis.R`~~ ✅ done (20 sources, incl.
  key-gated AQI/FIRMS/Mapillary via env vars).
- `roxygen2::roxygenise()` to generate `NAMESPACE`/man pages; `renv::init()` lockfile.
- First live run on the VPS (`targets::tar_make()`) + per-dataset validation
  (flip `catalog.validated`) per `docs/MEGA_MAP_SPEC.md`.
- `mapgl`-based styling per geometry/attribute; choropleths from `db` joins
  (e.g. ACS income on tracts, enrollment on school points).
