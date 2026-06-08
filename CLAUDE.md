# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this repo is

Source for **maxwellhowegis.com** — Max Howe's GIS / geospatial-developer
portfolio. It is **two things in one repo**:

1. **A static portfolio website** (plain HTML/CSS/JS, no build step, no framework)
   deployed via **GitHub Pages** from `main` (`.github/workflows/pages.yml`,
   `submodules: recursive`). Custom domain in `CNAME` (maxwellhowegis.com).
2. **The Open Concord data project** (`open-concord/`) — an R package + pipeline
   that builds a Concord, NH geospatial database and a static map served at
   `/concord/`.

Because Pages is **static**, anything dynamic must compile to static assets
(HTML/JS/JSON/PMTiles). There is no server in this repo.

## Layout

| Path | What | Tech |
|---|---|---|
| `/` (`index.html`, `*.html`, `css/`, `js/`, `images/`) | Portfolio shell; gallery cards come from `js/projects.js` (source of truth) | Vanilla JS |
| `geopuesto/`, `ma-atlas/` | **git submodules** (`mapzimus/geopuesto`, `mapzimus/ma-education-atlas`) mounted at subpaths | Leaflet / MapLibre |
| `whydah/`, `bugwars/`, `Lynn-data-dive/` | Standalone sub-apps | MapLibre / vanilla JS |
| `open-concord/` | **R package `openconcord`** (ETL → PostGIS) + `{targets}` pipeline + **R Shiny frontend** (`shiny/app.R`) + Docker/Caddy deploy | R |
| `concord/` | Thin GitHub Pages page that **iframes** the VPS-hosted R Shiny map (maxwellhowegis.com/concord/) | HTML |
| `.github/workflows/` | `pages.yml` (site deploy), `concord-refresh.yml` (data pipeline) | — |

## Conventions

- **Website**: plain HTML/CSS/JS, match the surrounding file's style; no build
  tooling. Edit gallery cards in `js/projects.js`, not the HTML.
- **Submodules**: sub-apps live in their own repos. After changing one, run
  `git submodule update --remote`, commit the pointer bump, push — Pages
  redeploys with the new SHA. Don't vendor submodule code into this repo.
- **Open Concord**: R, idiomatic, leaning on domain packages (`arcgislayers`,
  `tidycensus`, `tigris`, `osmdata`, `rgbif`, `educationdata`, `sf`). All
  functions are `oc_*`, fully-qualified (`pkg::fn`) calls, written to PostGIS.

## Open Concord essentials

- **Two-tier model**: every dataset is `map+db` (geometry → map + PostGIS) or
  `db` (reference/bulk table joined to map layers). Tracked in `public.catalog`.
- **Pipeline**: `targets::tar_make()` (full run) or `openconcord::oc_load_*()`
  (one group). Writes straight to PostGIS; the Shiny app reads it live (no rebuild).
- **Frontend is R Shiny** (`open-concord/shiny/app.R`, leaflet + sf + pool) —
  hosted on the VPS, queries PostGIS directly. The portfolio `/concord/` page just
  iframes it. (`oc_export_web()` is an optional static PMTiles/Parquet snapshot.)
- **DB**: self-hosted PostGIS, localhost-bound (`open-concord/docker-compose.yml`:
  postgis + shiny + caddy; optional `--profile api` adds pg_tileserv/featureserv).
  Full setup in `open-concord/DEPLOY.md`. Architecture + per-dataset validation in
  `open-concord/docs/MEGA_MAP_SPEC.md`; keys in `open-concord/docs/ACCOUNTS_NEEDED.md`.
- **CI**: `concord-refresh.yml` runs on a **self-hosted runner on the VPS** (the
  only thing that can reach the private DB) and re-runs the ETL; the live app follows.

## Commands

```bash
# Website / sub-apps — serve statically (needed for geolocation/CORS apps)
python -m http.server 8001          # then http://localhost:8001

# Open Concord (run on a machine WITH R + a PostGIS — see open-concord/DEPLOY.md)
cd open-concord
Rscript setup.R                     # install deps + renv snapshot
Rscript -e 'targets::tar_make()'    # download -> PostGIS -> concord/data export
```

## Gotchas / notes

- **R is not part of the website build.** Pages only serves static files; the R
  pipeline runs out-of-band (VPS) and commits its export. Don't add R to
  `pages.yml`.
- **Downloaded GIS data is not committed** except the published static export in
  `concord/data/` (PMTiles/Parquet/catalog). Don't commit raw GeoJSON dumps.
- The Open Concord work began as a Python toolkit (`concord-nh-data/`, now
  removed); it lives in git history if you need to diff. R is the current
  implementation, **not yet executed end-to-end in CI** — expect to iterate on
  package-API details on first real `tar_make()`.
- Schools cover **both** districts serving Concord: Concord SD (LEAID 3302460)
  and Merrimack Valley SD (3304760, which serves Penacook) — don't drop MVSD.

## Git

- Active development branch for the Concord work: `claude/concord-nh-datasets-BaCwS`.
- Commit/push only when asked. Never push to `main` without explicit permission.
