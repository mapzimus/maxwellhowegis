# Concord Mega Map — Layer Validation Checklist

**165 datasets** — **141 `map+db`** (render on the mega map *and* land in the database) · **24 `db`** (database-only reference/bulk tables).

Validate **one layer at a time**: load it on the map (or inspect the table for `db` rows), confirm geometry/placement/attributes (see `MEGA_MAP_SPEC.md` → *Per-dataset validation protocol*), then change `[ ]` → `[x]` and note anything off.

Status legend: `[ ]` pending · `[x]` validated · `[~]` issue (see Notes)

## City of Concord ArcGIS  ·  `download_concord.py`
_91 distinct queryable vector layers._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | 100m USNG Grid (MaxScale=15,000) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | 1,000m USNG Grid | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Abandoned Drainage Pipes | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Abandoned Drainage Structures | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Abandoned Hydrants | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Abandoned Mains | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Abandoned Valves | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Addresses | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Aerial Off | map+db | CityGeneral/WasteCollectionCustomers | city | `data/concord_arcgis/` |  |
| [ ] | Airport | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Aquifer Protection District: Community Water Systems | map+db | Public/PubWebGIS2020 | city | `data/concord_arcgis/` |  |
| [ ] | Bridges | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Buildings | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | City | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | City Facilities | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Community Water Supply Systems | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Conservation | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Construction Linear | map+db | GSDField/UtilityInspection | city | `data/concord_arcgis/` |  |
| [ ] | Construction Point | map+db | GSDField/UtilityInspection | city | `data/concord_arcgis/` |  |
| [ ] | Contours | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | CurrentUseAreas | map+db | CityGeneral/CurrentUse | city | `data/concord_arcgis/` |  |
| [ ] | Drainage Pipes | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Drainage Structures | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Fire Response Districts | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Fittings | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | FittingsCards | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | GreenSpace | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Hidden | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Hydrants | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Interstate Exits | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Labels - 100m USNG Grid (MaxScale=10,000) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Labels - 1,000m USNG Grid | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Leader_Anno100 | map+db | CityGeneral/ParcelDimensions | city | `data/concord_arcgis/` |  |
| [ ] | Leader_Anno200 | map+db | CityGeneral/ParcelDimensions | city | `data/concord_arcgis/` |  |
| [ ] | Leader_Anno50 | map+db | CityGeneral/ParcelDimensions | city | `data/concord_arcgis/` |  |
| [ ] | Lots | map+db | CityGeneral/ParcelDimensions | city | `data/concord_arcgis/` |  |
| [ ] | Mains | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Map-Block-Lot (All Scales) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Miscline | map+db | CityGeneral/ParcelDimensions | city | `data/concord_arcgis/` |  |
| [ ] | National Fire Reporting Zones | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | NE 10m USNG Grid (MaxScale=1,500) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Non-Community Water Systems Non-Transient | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Non-Community Water Systems Transient | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | NW 10m USNG Grid (MaxScale=1,500) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Pavement | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Points | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Police Sector Areas | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | PowerPoles | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Property | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Property Lines (All Scales) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Railroads | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Residential Irrigation | map+db | GSDField/IrrigationInspection | city | `data/concord_arcgis/` |  |
| [ ] | School Districts | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | School Route Plowing | map+db | GSDField/SidewalkPlowing | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.City | map+db | CityGeneral/WasteCollectionCustomers | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.Lots | map+db | CityGeneral/WasteCollectionCustomers | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.Pipes | map+db | GSDField/DrainMainJetting | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.Prop_addresses | map+db | CityGeneral/WasteCollectionCustomers | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.SewerServiceConnection | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.SewerServiceLateral | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | sde.GIS.Util_BackFlowInspection | map+db | GSDField/BackflowInspection | city | `data/concord_arcgis/` |  |
| [ ] | SE 10m USNG Grid (MaxScale=1,500) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | ServiceFittings | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | ServiceLines | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | ServiceTaps | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Sewer Mains | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Sewer Mains Abandoned | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Sewer Manholes | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Sewer Manholes Abandoned | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Shoreland Protection Zone | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | ShutOff | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Sidewalk Plowing | map+db | GSDField/SidewalkPlowing | city | `data/concord_arcgis/` |  |
| [ ] | Signs | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | _Special Investment Fee District: Sewer | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | _Special Investment Fee District: Water | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | State Routes | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Station Districts | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Streams | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Street Names | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Street w Sewer Service | map+db | Public/PubWebGIS2020 | city | `data/concord_arcgis/` |  |
| [ ] | Streetlights | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Streets | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Streets w Public Water | map+db | Public/PubWebGIS2020 | city | `data/concord_arcgis/` |  |
| [ ] | Surrounding Towns | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | SW 10m USNG Grid (MaxScale=1,500) | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Town Streets | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Valves | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | VideoLink | map+db | Public/SewerSystemGISBeta | city | `data/concord_arcgis/` |  |
| [ ] | Voting Wards | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Water Bodies | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |
| [ ] | Zoning | map+db | CityGeneral/WaterSystemGIS | city | `data/concord_arcgis/` |  |

## Federal & State ArcGIS  ·  `download_external.py`
_Bbox-clipped to Concord._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | nh_granit_parcels | map+db | NH GRANIT statewide parcel mosaic (verify layer id) | bbox | `data/external/nh_granit_parcels.geojson` |  |
| [ ] | fema_flood_zones | map+db | FEMA NFHL Flood Hazard Zones (S_FLD_HAZ_AR) | bbox | `data/external/fema_flood_zones.geojson` |  |
| [ ] | fema_flood_boundaries | map+db | FEMA NFHL Flood Hazard Boundaries (S_FLD_HAZ_LN) | bbox | `data/external/fema_flood_boundaries.geojson` |  |
| [ ] | fema_base_flood_elevations | map+db | FEMA NFHL Base Flood Elevations (S_BFE) | bbox | `data/external/fema_base_flood_elevations.geojson` |  |
| [ ] | fema_firm_panels | map+db | FEMA NFHL FIRM Panel Index (S_FIRM_PAN) | bbox | `data/external/fema_firm_panels.geojson` |  |
| [ ] | tiger_roads | map+db | Census TIGERweb roads (all classes / local) | bbox | `data/external/tiger_roads.geojson` |  |
| [ ] | tiger_railroads | map+db | Census TIGERweb railroads | bbox | `data/external/tiger_railroads.geojson` |  |
| [ ] | tiger_tracts | map+db | Census TIGERweb 2020 census tracts | bbox | `data/external/tiger_tracts.geojson` |  |
| [ ] | tiger_block_groups | map+db | Census TIGERweb 2020 block groups | bbox | `data/external/tiger_block_groups.geojson` |  |
| [ ] | tiger_blocks | map+db | Census TIGERweb 2020 census blocks | bbox | `data/external/tiger_blocks.geojson` |  |
| [ ] | nhd_flowlines | map+db | USGS NHD flowlines (streams/rivers, large scale) | bbox | `data/external/nhd_flowlines.geojson` |  |
| [ ] | nhd_waterbodies | map+db | USGS NHD waterbodies (lakes/ponds, large scale) | bbox | `data/external/nhd_waterbodies.geojson` |  |
| [ ] | nhd_areas | map+db | USGS NHD areas (wide rivers/wetlands, large scale) | bbox | `data/external/nhd_areas.geojson` |  |
| [ ] | nhd_points | map+db | USGS NHD points (gages, dams, springs) | bbox | `data/external/nhd_points.geojson` |  |
| [ ] | nwi_wetlands | map+db | USFWS National Wetlands Inventory | bbox | `data/external/nwi_wetlands.geojson` |  |
| [ ] | usa_structures | map+db | FEMA USA Structures — building footprints WITH height (HEIGHT field, meters) | bbox | `data/external/usa_structures.geojson` |  |
| [ ] | padus_conservation_lands | map+db | Protected/conserved & public lands (USGS PAD-US) | bbox | `data/external/padus_conservation_lands.geojson` |  |
| [ ] | nrhp_historic_points | map+db | National Register of Historic Places — points (NPS) | bbox | `data/external/nrhp_historic_points.geojson` |  |
| [ ] | nrhp_historic_districts | map+db | National Register of Historic Places — polygons/districts (NPS) | bbox | `data/external/nrhp_historic_districts.geojson` |  |
| [ ] | epa_superfund_npl | map+db | EPA Superfund National Priorities List sites (FRS SEMS_NPL) | bbox | `data/external/epa_superfund_npl.geojson` |  |
| [ ] | epa_brownfields_acres | map+db | EPA Brownfields (FRS ACRES) | bbox | `data/external/epa_brownfields_acres.geojson` |  |
| [ ] | epa_tri_facilities | map+db | EPA Toxics Release Inventory facilities (FRS TRI) | bbox | `data/external/epa_tri_facilities.geojson` |  |
| [ ] | epa_rcra_facilities | map+db | EPA RCRA hazardous-waste handlers (FRS RCRAINFO) | bbox | `data/external/epa_rcra_facilities.geojson` |  |
| [ ] | cdc_places_tracts_poly | map+db | CDC PLACES health measures — census-tract polygons (wide format) | bbox | `data/external/cdc_places_tracts_poly.geojson` |  |
| [ ] | nced_easements | map+db | National Conservation Easement Database (USGS-hosted) | bbox | `data/external/nced_easements.geojson` |  |
| [ ] | usace_dams | map+db | USACE National Inventory of Dams (NID) | bbox | `data/external/usace_dams.geojson` |  |
| [ ] | faa_obstructions | map+db | FAA Digital Obstacle File (towers/obstructions, height AGL/AMSL) | bbox | `data/external/faa_obstructions.geojson` |  |
| [ ] | fcc_broadband_block_groups | map+db | FCC National Broadband Map — block groups (BDC June 2022) | bbox | `data/external/fcc_broadband_block_groups.geojson` |  |
| [ ] | ssurgo_soils | map+db | USDA SSURGO soils — map-unit polygons (MUKEY) | bbox | `data/external/ssurgo_soils.geojson` |  |

## OpenStreetMap  ·  `download_osm.py`
_Overpass themes._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | roads | map+db | OSM nwr["highway"] | bbox | `data/osm/roads.geojson` |  |
| [ ] | buildings | map+db | OSM nwr["building"] | bbox | `data/osm/buildings.geojson` |  |
| [ ] | water | map+db | OSM nwr["natural"="water"] | bbox | `data/osm/water.geojson` |  |
| [ ] | waterways | map+db | OSM nwr["waterway"] | bbox | `data/osm/waterways.geojson` |  |
| [ ] | landuse | map+db | OSM nwr["landuse"] | bbox | `data/osm/landuse.geojson` |  |
| [ ] | amenities | map+db | OSM nwr["amenity"] | bbox | `data/osm/amenities.geojson` |  |
| [ ] | leisure | map+db | OSM nwr["leisure"] | bbox | `data/osm/leisure.geojson` |  |
| [ ] | railways | map+db | OSM nwr["railway"] | bbox | `data/osm/railways.geojson` |  |
| [ ] | boundaries | map+db | OSM nwr["boundary"="administrative"] | bbox | `data/osm/boundaries.geojson` |  |
| [ ] | power | map+db | OSM nwr["power"] | bbox | `data/osm/power.geojson` |  |
| [ ] | shops | map+db | OSM nwr["shop"] | bbox | `data/osm/shops.geojson` |  |
| [ ] | addresses | map+db | OSM nwr["addr:housenumber"] | bbox | `data/osm/addresses.geojson` |  |

## APIs (Census / EPA / USGS / living data)  ·  `download_apis.py`
_GeoJSON/CSV to data/apis/._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | census_acs | db | key: optional (CENSUS_API_KEY) | varies | `data/apis/` |  |
| [ ] | epa_frs | db | key: none | varies | `data/apis/` |  |
| [ ] | cdc_places | db | key: none | varies | `data/apis/` |  |
| [ ] | usgs_streamgages | db | key: none | varies | `data/apis/` |  |
| [ ] | lodes | db | key: none | varies | `data/apis/` |  |
| [ ] | cat_gtfs | db | key: none | varies | `data/apis/` |  |
| [ ] | nrel_ev | db | key: none (DEMO_KEY) | varies | `data/apis/` |  |
| [ ] | tnm_products | db | key: none | varies | `data/apis/` |  |
| [ ] | pvwatts | db | key: none (DEMO_KEY) | varies | `data/apis/` |  |
| [ ] | noaa_weather_alerts | db | key: none | varies | `data/apis/` |  |
| [ ] | usgs_earthquakes | db | key: none | varies | `data/apis/` |  |
| [ ] | gbif_species | db | key: none | varies | `data/apis/` |  |
| [ ] | inaturalist | db | key: none | varies | `data/apis/` |  |
| [ ] | wikidata_landmarks | db | key: none | varies | `data/apis/` |  |
| [ ] | wikipedia_nearby | db | key: none | varies | `data/apis/` |  |
| [ ] | airnow | db | key: AIRNOW_API_KEY | varies | `data/apis/` |  |
| [ ] | purpleair | db | key: PURPLEAIR_API_KEY | varies | `data/apis/` |  |
| [ ] | openaq | db | key: OPENAQ_API_KEY | varies | `data/apis/` |  |
| [ ] | nasa_firms | db | key: FIRMS_MAP_KEY | varies | `data/apis/` |  |
| [ ] | mapillary | db | key: MAPILLARY_TOKEN | varies | `data/apis/` |  |

## Schools (Concord SD + Merrimack Valley SD)  ·  `download_schools.py`
_Both districts serving Concord, incl. Penacook; + surrounding region._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | school_districts | map+db | Census TIGERweb | districts | `data/schools/school_districts.geojson` |  |
| [ ] | school_districts_region | map+db | Census TIGERweb | region | `data/schools/school_districts_region.geojson` |  |
| [ ] | public_schools_districts | map+db | NCES EDGE | districts | `data/schools/public_schools_districts.geojson` |  |
| [ ] | public_schools_region | map+db | NCES EDGE | region | `data/schools/public_schools_region.geojson` |  |
| [ ] | private_schools_region | map+db | NCES EDGE (incl. St. Paul's) | region | `data/schools/private_schools_region.geojson` |  |
| [ ] | colleges | map+db | NCES IPEDS (NHTI, UNH Law) | region | `data/schools/colleges.geojson` |  |
| [ ] | enrollment_districts | db | Urban Inst. CCD | districts | `data/schools/enrollment_districts.csv` |  |
| [ ] | enrollment_schools | db | Urban Inst. CCD | districts | `data/schools/enrollment_schools.csv` |  |

## Businesses  ·  `download_businesses.py`
_Every-business POIs._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | osm_businesses | map+db | OpenStreetMap | bbox | `data/businesses/osm_businesses.geojson` |  |
| [ ] | overture_places | map+db | Overture Maps (--overture) | bbox | `data/businesses/overture_places.geojson` |  |

## Knowledge (people / facts / history)  ·  `download_knowledge.py`
_Notable inhabitants, Wikidata facts, Wikipedia history._

| ✓ | Layer | Target | Source | Scope | Output | Notes |
|---|---|---|---|---|---|---|
| [ ] | notable_people | map+db | Wikipedia + Wikidata | city | `data/knowledge/notable_people.geojson` |  |
| [ ] | history | db | Wikipedia extracts | city | `data/knowledge/history.json` |  |
| [ ] | wikidata_facts | db | Wikidata Q28249 | city | `data/knowledge/wikidata_facts.csv` |  |

