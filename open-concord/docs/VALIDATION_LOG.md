# Validation log

Validate **one dataset at a time** (protocol: `MEGA_MAP_SPEC.md` → *Per-dataset
validation protocol*). For each: load it (`oc_load_*`), view it on the Shiny map,
check placement / geometry / count / attributes, then set status and, optionally,
`UPDATE public.catalog SET validated = true WHERE schema_name=… AND table_name=…`.

Status: `[ ]` pending · `[x]` validated · `[~]` issue (note it)

## Schools — `oc_load_schools()`  (start here: small + high-signal)

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | schools.school_districts | map+db | 2 polygons (Concord SD + MVSD) |  |
| [ ] | schools.public_schools_districts | map+db | 14 (both districts, incl. Penacook) |  |
| [ ] | schools.public_schools_region | map+db | ~109 |  |
| [ ] | schools.private_schools_region | map+db | 38 (incl. St. Paul's) |  |
| [ ] | schools.colleges | map+db | 11 (NHTI, UNH Law) |  |
| [ ] | schools.enrollment_districts | db | Concord SD total 4,037 |  |
| [ ] | schools.enrollment_schools | db | per-school rows |  |

## Federal & state ArcGIS — `oc_load_external()`

| ✓ | Layer | Target | Expected | Notes |
|---|---|---|---|---|
| [ ] | external.usa_structures | map+db | 18,576 (has HEIGHT) |  |
| [ ] | external.padus_conservation_lands | map+db | 261 |  |
| [ ] | external.nrhp_historic_points | map+db | 20 |  |
| [ ] | external.nrhp_historic_districts | map+db | polygons |  |
| [ ] | external.usace_dams | map+db | 16 |  |
| [ ] | external.epa_rcra_facilities | map+db | 919 |  |
| [ ] | external.epa_tri_facilities | map+db | 22 |  |
| [ ] | external.epa_brownfields_acres | map+db | 14 |  |
| [ ] | external.epa_superfund_npl | map+db | 0 (none in Concord — OK) |  |
| [ ] | external.cdc_places_tracts_poly | map+db | 24 |  |
| [ ] | external.faa_obstructions | map+db | 530 |  |
| [ ] | external.fcc_broadband_block_groups | map+db | 52 |  |
| [ ] | external.tiger_tracts / _block_groups / _blocks | map+db | 24 / … |  |
| [ ] | external.tiger_roads / _railroads | map+db | — |  |
| [ ] | external.nhd_flowlines/_waterbodies/_areas/_points | map+db | — |  |
| [ ] | external.nwi_wetlands | map+db | 3,731 |  |
| [ ] | external.nced_easements | map+db | flaky host — re-run |  |
| [ ] | external.ssurgo_soils | map+db | flaky host — re-run |  |
| [ ] | external.fema_flood_zones/_boundaries/_bfe/_firm | map+db | flaky host — re-run |  |

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
