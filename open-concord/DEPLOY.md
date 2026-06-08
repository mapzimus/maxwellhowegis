# Deploying Open Concord (R Shiny frontend + self-hosted PostGIS)

Everything is R end-to-end: the R **ETL** loads **PostGIS**, and an R **Shiny app**
(the frontend) queries it live and renders the interactive map. Both run on your
**VPS**. The portfolio page at `maxwellhowegis.com/concord/` embeds the app.

```
 VPS:  targets::tar_make() (R) ──► PostGIS (private, localhost)
                                          ▲ DBI/sf
                       Shiny app (R, leaflet) ──► Caddy (TLS) ──► concord.maxwellhowegis.com
                                                                         ▲ iframe
                       maxwellhowegis.com/concord/  (GitHub Pages) ──────┘
```

## 1. DNS
Point an A record for the app subdomain at the VPS, e.g.
`concord.maxwellhowegis.com → <vps-ip>`. (The portfolio page stays on GitHub Pages
and embeds it.)

## 2. Bring up PostGIS + the Shiny app

```bash
cd open-concord
cp .env.example .env          # set PGPASSWORD, APP_DOMAIN
docker compose up -d          # postgis + shiny (built from Dockerfile) + caddy (auto-TLS)
```

`schema.sql` auto-loads; Caddy gets a Let's Encrypt cert for `APP_DOMAIN` and
reverse-proxies the Shiny app (WebSockets included). Postgres stays on localhost.

## 3. Install R + system libs for the ETL (VPS)

```bash
sudo apt-get update && sudo apt-get install -y r-base gdal-bin libgdal-dev \
  libgeos-dev libproj-dev libudunits2-dev libpq-dev
cd open-concord && Rscript setup.R     # R deps + renv snapshot
```

(The Shiny container already has its R deps baked in via `Dockerfile`.)

## 4. Load the data

```bash
export PGHOST=localhost PGPORT=5432 PGDATABASE=openconcord \
       PGUSER=openconcord PGPASSWORD=...      # from .env
export CENSUS_API_KEY=...                     # tidycensus; others optional (docs/ACCOUNTS_NEEDED.md)
Rscript -e 'targets::tar_make()'              # download -> PostGIS
```

The Shiny app reads `public.catalog` and renders every `map+db` layer live — no
rebuild step. Re-run the ETL and the app reflects it.

## 5. Frontend

- The app **is** `shiny/app.R` (R + leaflet + leaflet.extras + sf + pool): layer
  toggles, click-popups, a **draw toolbar** (draw → live `ST_Intersects` count),
  and **server-side attribute filtering**.
- `concord/index.html` on GitHub Pages just **embeds** `concord.maxwellhowegis.com`
  so the map appears at `maxwellhowegis.com/concord/`. Update the `APP_URL` there
  if your subdomain differs.
- Swap leaflet for `{mapgl}` (MapLibre in R) inside `app.R` if you want
  vector-tile performance for the big layers (parcels/buildings).

## 6. Refresh on a schedule
`.github/workflows/concord-refresh.yml` (self-hosted runner on the VPS) re-runs the
ETL; the live app follows automatically. Or cron:
`0 3 * * 0 cd /srv/open-concord && Rscript -e 'targets::tar_make()'`.

## Optional: tile/feature API
For vector-tile performance or an external API, `docker compose --profile api up -d`
adds pg_tileserv (MVT) + pg_featureserv (GeoJSON/CQL). The Shiny app does **not**
require them.

## Security
- Postgres stays on localhost/firewalled. Only the Shiny app (and optional API) is
  public, behind Caddy TLS.
- For write-back / auth, use Shiny modules + DB roles, or add PostgREST.
- Keep secrets in `.env`, never in the repo.
