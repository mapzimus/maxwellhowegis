# Validation log

Validate **one dataset at a time** (protocol: `MEGA_MAP_SPEC.md` → *Per-dataset
validation protocol*). For each: load it (`oc_load_*`), view it on the Shiny map,
check placement / geometry / count / attributes, then set status and, optionally,
`UPDATE public.catalog SET validated = true WHERE schema_name=… AND table_name=…`.

Status: `[ ]` pending · `[x]` validated · `[~]` issue (note it)

## Schools — `oc_load_schools()`  (start here: small + high-signal)

**First validated:** 2026-06-08 (local, R 4.5.2, PostGIS 3.6)
**Fixes applied:** `schools.R` — (1) `st_transform(sd, 4326)` after `tigris::school_districts()` call
(tigris returns NAD83; `st_filter` against WGS84 bbox crashed without this); (2) `enrollment_districts`
now uses `fips=33` + post-filter (Urban Inst. CCD API returns 0 rows for direct `leaid` filter on NH districts).

| ✓ | Layer | Target | Got | Expected | Notes |
|---|---|---|---|---|---|
| [x] | schools.school_districts | map+db | 2 | 2 polygons (Concord SD + MVSD) |  |
| [x] | schools.school_districts_region | map+db | 18 | — | all NH unified districts in regional bbox |
| [x] | schools.public_schools_districts | map+db | 14 | 14 (both districts, incl. Penacook) |  |
| [x] | schools.public_schools_region | map+db | 109 | ~109 |  |
| [x] | schools.private_schools_region | map+db | 38 | 38 (incl. St. Paul's) |  |
| [x] | schools.colleges | map+db | 11 | 11 (NHTI, UNH Law) |  |
| [x] | schools.enrollment_districts | db | 54 rows | Concord SD total 4,037 | 54 = 2 districts × 27 race×sex combos; `SUM WHERE leaid='3302460' AND race=99 AND sex=99` = 4,037 ✅ |
| [x] | schools.enrollment_schools | db | 378 rows | per-school rows | 14 schools × 27 race×sex combos; Concord SD total = 4,025 (~4,037, <0.3% diff = data vintage) |

## Federal & state ArcGIS — `oc_load_external()`

**First validated:** 2026-06-08 (local, R 4.5.2, PostGIS 3.6). **25/28 layers loaded.**
**Fixes applied:** `db.R` — added `oc_flatten_list_cols()` (coerces non-geometry list-columns
to text; `usace_dams` carried an Esri `SE_ANNO_CAD_DATA` blob list-column that crashed
`RPostgres::dbWriteTable`), called from both `oc_write_layer` + `oc_write_table`.
`external.R` — wrapped the per-layer body in `tryCatch` so one failed layer skips instead of
halting the whole group (previously `usace_dams` killed the 3 layers after it).
`arcgis.R` — added `oc_arc_layer_rest()` REST-pagination fallback (httr2, GeoJSON, offset-paged);
`oc_arc_layer` now retries through it when arcgislayers errors and a bbox is set. Recovers
`nwi_wetlands` (3,731), whose FWS MapServer breaks arcgislayers' internal count step.

**HANDOVER geometry-column risk — RESOLVED:** all spatial tables store geometry in a column
named `geometry` with *real* SRID 4326 (verified via `ST_SRID`); only the column *typmod* is
generic (`geometry_columns.srid = 0`). `sf::st_read()` (Shiny `get_layer()`) reads real SRID and
the draw-identify query references `geometry` by name — both match. Generic typmod + no GiST
index is a non-blocking enhancement (only pg_tileserv / large-layer query speed care).

| ✓ | Layer | Target | Got | Expected | Notes |
|---|---|---|---|---|---|
| [x] | external.usa_structures | map+db | 18,576 | 18,576 (has HEIGHT) | exact |
| [x] | external.padus_conservation_lands | map+db | 261 | 261 | exact |
| [x] | external.nrhp_historic_points | map+db | 20 | 20 | exact |
| [x] | external.nrhp_historic_districts | map+db | 11 | polygons | OK |
| [x] | external.usace_dams | map+db | 16 | 16 | exact; flattened `SE_ANNO_CAD_DATA` |
| [x] | external.epa_rcra_facilities | map+db | 919 | 919 | exact |
| [x] | external.epa_tri_facilities | map+db | 22 | 22 | exact |
| [x] | external.epa_brownfields_acres | map+db | 14 | 14 | exact |
| [x] | external.epa_superfund_npl | map+db | 0 | 0 (none in Concord) | OK |
| [x] | external.cdc_places_tracts_poly | map+db | 24 | 24 | exact |
| [~] | external.faa_obstructions | map+db | 564 | 530 | +34 — FAA DOF ~56-day refresh, not a bug |
| [x] | external.fcc_broadband_block_groups | map+db | 52 | 52 | exact |
| [x] | external.tiger_tracts / _block_groups / _blocks | map+db | 24 / 52 / 1077 | 24 / … | OK |
| [x] | external.tiger_roads / _railroads | map+db | 1665 / 5 | — | OK |
| [x] | external.nhd_flowlines/_waterbodies/_areas/_points | map+db | 896 / 618 / 11 / 1 | — | OK |
| [x] | external.nwi_wetlands | map+db | 3,731 | 3,731 | exact; via REST-pagination fallback (arcgislayers count step fails on FWS MapServer). Cols are `Wetlands.*`/`NWI_Wetland_Codes.*` (joined layer) |
| [~] | external.nced_easements | map+db | 0 | flaky host | layer is now a RasterLayer (NCED unmaintained since Jan 2025) |
| [~] | external.ssurgo_soils | map+db | 0 | flaky host | USDA host SSL reset — transient, re-run |
| [~] | external.nh_granit_parcels | map+db | 0 | (verify id) | 404 Service not found — confirm layer id at nhgeodata.unh.edu |
| [x] | external.fema_flood_zones/_boundaries/_bfe/_firm | map+db | 947 / 2698 / 251 / 35 | flaky host | all loaded OK this run |

## City of Concord — `oc_load_concord()`

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | city.* (auto-discovered) | map+db | ~91 layers; Property = 13,160 | confirm table **names** aren't numeric ids |

## APIs — `oc_load_apis()`  (+ `include_keyed = TRUE` for the rest)

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | apis.acs_tracts | map+db | needs CENSUS_API_KEY; drives choropleth |  |
| [ ] | apis.usgs_earthquakes | map+db | 111 |  |
| [ ] | apis.gbif_species | map+db | ~9,000 |  |
| [ ] | apis.inaturalist | map+db | ~3,000 |  |
| [ ] | apis.wikidata_landmarks | map+db | 252 |  |
| [ ] | apis.wikipedia_articles | map+db | 83 |  |
| [ ] | apis.cdc_places | map+db | ~1,560 rows |  |
| [ ] | apis.usgs_streamgages | map+db | 9 |  |
| [ ] | apis.noaa_weather_alerts | map+db | 0+ (varies) |  |
| [ ] | apis.ev_charging_stations | map+db | needs NREL reachable |  |
| [ ] | apis.epa_frs_facilities | db | 2,625 |  |
| [ ] | apis.lodes_wac_2023 | db | NH block rows |  |
| [ ] | apis.airnow/openaq/purpleair/nasa_firms/mapillary | map+db | key-gated |  |

## Knowledge — `oc_load_knowledge()`

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | knowledge.notable_people_pins | map+db | 148 pins |  |
| [ ] | knowledge.notable_people | db | 148 rows |  |
| [ ] | knowledge.history | db | 6 articles |  |
| [ ] | knowledge.wikidata_facts | db | 106 statements |  |

## OSM / Business — `oc_load_osm()`, `oc_load_businesses_osm()`, `oc_load_overture()`

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | osm.* themes | map+db | ⚠️ mixed-geometry rbind — see HANDOVER risk #3 |  |
| [ ] | business.osm_businesses | map+db | ~644 |  |
| [ ] | business.overture_places | map+db | needs duckdb + S3 |  |
