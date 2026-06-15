# Open Concord map — Shiny frontend v2 design ("light studio")

- Date: 2026-06-12
- Status: approved (light-studio direction; full-v2 scope)
- Scope: `open-concord/shiny/app.R` and a small config; **no ETL / PostGIS changes**

## Goal
Replace the v1 Shiny map with a polished, fast, portfolio-grade map UI over the
same live PostGIS database.

## Problems in v1 (`shiny/app.R`)
- `get_layer()` runs `SELECT *` (all rows + columns) and Leaflet renders every
  feature client-side → 100k-feature layers (`osm.roads` 103k, `osm.buildings`
  88k) choke the browser ("takes forever").
- Legend lists all 71 layers by raw slug, including empties, with no counts, no
  human names, minimal styling ("sloppy and unorganized").

## Constraints
- This machine has **no Docker** → `pg_tileserv` via `docker-compose` can't run
  locally as-is.
- Keep working features: draw-to-identify, server-side attribute filter.
- Data unchanged: geometry column is `geometry`, real SRID 4326; counts live in
  `public.catalog.n_features`.

## Architecture / stack
- Replace `{leaflet}` with `{mapgl}` (MapLibre GL JS via htmlwidgets): WebGL
  rendering, basemap styles, smooth pan/zoom.
- Reactive layer management via `maplibre_proxy()` — add/clear sources + layers
  as toggles change.

## Performance (phased — not blocked on Docker)
- **Phase 1 (this build, no new infra):** `get_layer()` applies `st_simplify`
  (tolerance scaled to zoom) + `ST_Intersects` bbox-clip to the current map
  viewport; shown layers refetch (debounced) on pan/zoom. Big layers only ever
  ship what's in view, simplified.
- **Phase 2 (optional, documented future — OUT OF SCOPE here):** run
  `pg_tileserv` as a standalone Windows binary (no Docker), serve heavy layers as
  MVT vector tiles consumed directly by MapLibre for instant any-zoom rendering.

## Legend (left sidebar, catalog-driven)
- Group `map+db` layers by category; per-group **and** per-layer feature counts
  (from `public.catalog`); human names via a slug→label config map; **hide
  0-feature layers**; collapsible sections; layer **search**; toggle-all per
  group; colored category dots.

## Map & interaction
- Basemap switcher: Light (Carto Positron), Dark (Carto Dark Matter), Satellite.
- Curated popups: per-layer key fields (config: `popup_fields`), styled card;
  fallback to first N fields.
- Draw-to-identify (MapLibre draw control → live PostGIS `ST_Intersects` count of
  shown layers in the drawn polygon) — retained from v1.
- Server-side filter: pick a layer + SQL WHERE, re-query + highlight — retained.

## Layout
- Top bar (title, layer search, basemap switcher, draw + filter); persistent
  collapsible left sidebar (legend + filter); full-bleed map. Flat, clean, light.

## Files
- Rewrite `shiny/app.R` (v2); copy v1 to `shiny/app-leaflet-v1.R` as a fallback.
- Add config: slug→label map + per-layer popup fields (top of `app.R` or
  `shiny/labels.R`).
- New dependency: `{mapgl}` (add to DESCRIPTION Suggests).

## Verification
Launch locally on :3838 with PG creds; screenshot; confirm legend is
grouped/named/counted/searchable and hides empties; basemap switch works;
toggling a big layer (roads) loads fast (viewport-clipped); curated popup;
draw-identify and filter work.
