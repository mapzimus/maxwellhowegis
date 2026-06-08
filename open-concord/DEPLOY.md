# Deploying Open Concord (self-hosted PostGIS + static map)

Architecture: the **R pipeline** runs on your **VPS**, writes to a **self-hosted
PostGIS**, and exports **static artifacts** (PMTiles + Parquet + catalog.json) that
the **website** serves at `maxwellhowegis.com/concord/`. The database is never
exposed publicly — only the static export is.

```
 VPS:  targets::tar_make() ──► PostGIS (localhost:5432) ──► oc_export_web()
                                                                  │
                                  concord.pmtiles + *.parquet + catalog.json
                                                                  ▼
                              git push ──► maxwellhowegis repo  /concord/data/
                                                                  ▼
                              GitHub Pages ──► maxwellhowegis.com/concord/  (static)
```

## 1. Stand up PostGIS (VPS)

```bash
cd open-concord
echo "PGPASSWORD=$(openssl rand -hex 24)" > .env   # also set PGUSER if you like
docker compose up -d                                # schema.sql auto-loads on first boot
```

Port 5432 is bound to `127.0.0.1` only. Connect from elsewhere over an SSH tunnel:
`ssh -L 5432:localhost:5432 you@your-vps`.

## 2. Install R + system libraries (VPS, Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y r-base gdal-bin libgdal-dev libgeos-dev libproj-dev \
    libudunits2-dev libpq-dev tippecanoe        # tippecanoe: build from github if no pkg
Rscript -e 'install.packages(c("remotes","sf","DBI","RPostgres","httr2","jsonlite",
  "arcgislayers","tidycensus","tigris","osmdata","rgbif","educationdata",
  "WikidataQueryServiceR","WikipediR","targets","cli","glue","dplyr","purrr","arrow"))'
```

## 3. Configure credentials (env vars)

```bash
export PGHOST=localhost PGPORT=5432 PGDATABASE=openconcord
export PGUSER=openconcord PGPASSWORD=...        # from .env above
export CENSUS_API_KEY=...                        # tidycensus (free)
# optional: NREL_API_KEY, AIRNOW_API_KEY, OPENAQ_API_KEY, PURPLEAIR_API_KEY,
#           FIRMS_MAP_KEY, MAPILLARY_TOKEN  (see docs/ACCOUNTS_NEEDED.md)
```

## 4. Run the pipeline

```r
# from the open-concord/ directory
remotes::install_local(".")        # or devtools::load_all(".")
targets::tar_make()                # download -> PostGIS -> web export
# or pieces:  openconcord::oc_db_init(); openconcord::oc_load_schools()
```

`oc_export_web()` writes `concord.pmtiles`, `*.parquet`, and `catalog.json` into
`../concord/data/` (the website repo). Commit & push that to publish.

## 5. Publish to the site

The map page already lives at `concord/index.html` (repo root → served at
`maxwellhowegis.com/concord/`). After a pipeline run:

```bash
cd ../maxwellhowegis            # the website repo (this repo)
git add concord/data && git commit -m "Refresh Concord mega map data" && git push
```

## 6. Automate (optional)

Cron the whole thing on the VPS (the DB stays private; only static files are pushed):

```cron
# 3am Sundays: refresh data, rebuild tiles, publish
0 3 * * 0  cd /srv/open-concord && Rscript -e 'targets::tar_make()' && \
           cd /srv/maxwellhowegis && git add concord/data && \
           git -c user.name=oc-bot -c user.email=mhowe.gis@gmail.com \
               commit -m "weekly data refresh" && git push
```

## Security notes
- Keep PostGIS bound to localhost / behind the firewall. The public only ever sees
  static PMTiles/Parquet — no live DB connection from the browser.
- Store keys in a `.env` / secrets manager, never in the repo.
- The exported Parquet/PMTiles are public data; review before publishing if you add
  any restricted layer.
