# Local development & validation

Run the whole thing on your machine — no VPS, no Caddy, no domain. You need
**Docker** (for local PostGIS) and **R ≥ 4.2** with the system geospatial libs.

## 0. System libraries (once)

- **macOS**: `brew install gdal geos proj udunits libpq`
- **Debian/Ubuntu**: `sudo apt-get install -y gdal-bin libgdal-dev libgeos-dev libproj-dev libudunits2-dev libpq-dev`
- **Windows**: install R + Rtools; `sf`/`terra` ship binaries from CRAN.

## 1. Local PostGIS (Docker)

```bash
cd open-concord
cp .env.example .env          # set PGPASSWORD (APP_DOMAIN is unused locally)
docker compose up -d postgis  # just the database — not shiny/caddy
```

PostGIS is now on `localhost:5432`, db `openconcord`, with `schema.sql` loaded.

## 2. R dependencies

```bash
cd open-concord
Rscript setup.R               # installs deps + the openconcord package + renv snapshot
```

If `setup.R` is heavy, you can install piecemeal and `devtools::load_all(".")`
instead of installing the package.

## 3. Environment

```bash
export PGHOST=localhost PGPORT=5432 PGDATABASE=openconcord \
       PGUSER=openconcord PGPASSWORD=...     # from .env
export CENSUS_API_KEY=...                    # required for the ACS layer (free key)
# optional API keys: NREL_API_KEY, AIRNOW_API_KEY, OPENAQ_API_KEY, FIRMS_MAP_KEY, MAPILLARY_TOKEN
```

## 4. Run the ETL — one group at a time (recommended for first validation)

Don't run the whole pipeline blind. Load and eyeball each group:

```r
library(openconcord)           # or devtools::load_all(".")
con <- oc_connect()
oc_db_init(con)

oc_load_schools(con)           # start small + high-signal (2 districts, 14 schools)
oc_load_external(con)          # federal/state ArcGIS (usa_structures 18,576 ...)
oc_load_concord(con)           # the big city crawl (~91 layers)
oc_load_apis(con)              # census/usgs/epa/gbif/...   (needs CENSUS_API_KEY)
oc_load_knowledge(con)         # people/facts/history
oc_load_osm(con); oc_load_businesses_osm(con)

DBI::dbGetQuery(con, "SELECT schema_name, table_name, target, n_features
                      FROM public.catalog ORDER BY 1,2")   # what landed
```

Cross-check counts against the table in [`../HANDOVER.md`](../HANDOVER.md). Or run
everything: `targets::tar_make()`.

> `{tigris}`/`{tidycensus}` cache downloads; first run is slower. Set
> `options(tigris_use_cache = TRUE)`.

## 5. Run the Shiny frontend locally

```bash
cd open-concord
PGHOST=localhost PGUSER=openconcord PGPASSWORD=... \
  Rscript -e 'shiny::runApp("shiny", host="127.0.0.1", port=3838, launch.browser=TRUE)'
```

Open <http://localhost:3838>. Toggle a layer, click a feature, draw a polygon to
identify, try a server-side filter. Iterate on `shiny/app.R` and reload.

## 6. Debugging tips

- **A layer is empty / errors**: load it directly — `oc_arc_layer("<url>")` or
  `oc_load_external(con)` — and read the `cli` message. See the Risk register in
  `HANDOVER.md` for the usual suspects (geometry column name, OSM mixed geometry,
  `arc_select` args, ACS key).
- **Map draws nothing**: check `public.catalog` has `map+db` rows and the geometry
  column name in PostGIS matches what `app.R` queries (`geometry`).
- **Reset the DB**: `docker compose down -v && docker compose up -d postgis`.

When a layer looks right, flip its row in
[`VALIDATION_LOG.md`](VALIDATION_LOG.md) and (optionally)
`UPDATE public.catalog SET validated = true WHERE …`.
