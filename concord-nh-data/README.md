# Concord, NH — GIS Data Catalog & Acquisition Toolkit

A catalog of every Concord, New Hampshire GIS dataset I could find online, plus
scripts that download them to GeoJSON. Standard-library Python 3.7+ only — no
`pip install` required.

```
concord-nh-data/
├── README.md            ← this catalog
├── sources.json         ← machine-readable manifest (edit to add layers)
├── scripts/
│   ├── arcgis_to_geojson.py    reusable ArcGIS REST → GeoJSON (pagination + esri-json fallback)
│   ├── download_concord.py     auto-discovers & downloads ALL ~72 city layers
│   ├── download_external.py    29 federal + state ArcGIS layers, clipped to Concord
│   ├── download_osm.py         OpenStreetMap themes via Overpass
│   ├── download_apis.py        non-ArcGIS APIs (Census, USGS, EPA, CDC, transit, NREL…)
│   └── download_businesses.py  every-business point layer (OSM + Overture)
└── data/                ← output (git-ignored; reproducible from the scripts)
```

## Quick start

```bash
cd concord-nh-data/scripts
python3 download_concord.py      # ~72 city layers      → data/concord_arcgis/
python3 download_external.py     # 29 fed/state ArcGIS   → data/external/
python3 download_osm.py          # OSM themes            → data/osm/
python3 download_apis.py         # Census/USGS/EPA/CDC…  → data/apis/
python3 download_businesses.py   # every business (OSM)  → data/businesses/

# preview without downloading (every script supports --list)
python3 download_external.py --list

# grab one thing / subsets (every script supports --only)
python3 download_external.py --only usa_structures tiger_tracts nhd_flowlines
python3 download_businesses.py --overture        # add Overture places (needs duckdb/overturemaps)
python3 arcgis_to_geojson.py "<any ArcGIS layer URL ending in /<id>>" out.geojson
```

Stdlib only — no `pip install` (the one exception is the optional Overture path,
which needs `duckdb` or the `overturemaps` CLI). Free API keys, when used, are
read from env vars: `CENSUS_API_KEY`, `NREL_API_KEY`, `AIRNOW_API_KEY`,
`PURPLEAIR_API_KEY`.

Concord bounding box used for clipping external sources (WGS84):
`-71.668185, 43.151772, -71.456903, 43.309419`.

---

## 1. City of Concord ArcGIS REST server  ⭐ primary, free, auto-downloaded

**`https://gis.concordnh.gov/arc1061/rest/services`** (ArcGIS 10.61). The public
map services expose ~72 distinct queryable vector layers. `download_concord.py`
crawls the server, de-duplicates layers that appear in multiple services, and
saves each as GeoJSON. Highlights:

| Theme | Layers |
|---|---|
| **Parcels & land** | Property (parcels, ~13,160), Property Lines, Map-Block-Lot, **Zoning**, Conservation, Current Use, Shoreland Protection Zone, Aquifer Protection District, GreenSpace, Pavement |
| **Water utility** | Mains, Service Lines, Valves, Hydrants, Fittings, Service Taps, ShutOffs, + abandoned-infrastructure layers |
| **Sewer** | Sewer Mains, Manholes, Service Laterals, Service Connections, + abandoned |
| **Stormwater** | Drainage Structures, Drainage Pipes (+ abandoned) |
| **Other infrastructure** | Power Poles, Streetlights, Signs, Contours, City Facilities, Bridges |
| **Transportation** | Streets, Street Names, Road Centerlines, Railroads, Interstate Exits, Airport, State Routes, Town Streets |
| **Boundaries / admin** | City, Voting Wards, School Districts, Police Sector Areas, Fire Response Districts, Station Districts, National Fire Reporting Zones, Surrounding Towns |
| **Base / environment** | Buildings, Addresses, Surface Water, Water Bodies, Streams, Community & Non-Community Water Systems |
| **Field ops** (`GSDField`) | Backflow, Irrigation & Utility Inspections, Drain Main Jetting, Sidewalk/School-Route Plowing |

Raster layers (Aerial Photos 2000 / 2005 / Spring 2010) live on the same server
but are imagery, not vector — export them from the MapServer's `export` endpoint
or grab newer orthos from NH GRANIT / USGS NAIP.

Front-end viewer: <https://www.concordnh.gov/897/Interactive-GIS-Viewer>

## 2. Federal & state ArcGIS layers  (auto-downloaded, bbox-clipped)

`download_external.py` pulls these (see `sources.json` to add more):

| Key(s) | Source | Contents |
|---|---|---|
| `nh_granit_parcels` | **NH GRANIT** | statewide parcel mosaic |
| `fema_flood_zones` / `_boundaries` / `_base_flood_elevations` / `_firm_panels` | **FEMA NFHL** | flood hazard zones, BFEs, FIRM panels |
| `tiger_roads`, `tiger_railroads` | **Census TIGERweb** | all-roads & railroads |
| `tiger_tracts`, `tiger_block_groups`, `tiger_blocks` | **Census TIGERweb** | 2020 census geographies (join ACS via GEOID) |
| `nhd_flowlines/_waterbodies/_areas/_points` | **USGS NHD** | hydrography |
| `nwi_wetlands` | **USFWS** | National Wetlands Inventory |
| `usa_structures` ⭐ | **FEMA/ORNL** | ~18.5k building footprints **with height** (LiDAR) |
| `padus_conservation_lands` | **USGS PAD-US** | protected/conserved & public lands |
| `nrhp_historic_points`, `nrhp_historic_districts` | **NPS** | National Register of Historic Places |
| `epa_superfund_npl`, `epa_brownfields_acres`, `epa_tri_facilities`, `epa_rcra_facilities` | **EPA FRS** | contaminated/regulated sites |
| `cdc_places_tracts_poly` | **CDC PLACES** | tract health measures (wide, polygons) |
| `usace_dams` | **USACE NID** | National Inventory of Dams |
| `faa_obstructions` | **FAA** | towers/obstructions w/ heights |
| `fcc_broadband_block_groups` | **FCC** | broadband availability (BDC 2022) |
| `nced_easements` | **USGS/NCED** | conservation easements *(host flaky)* |
| `ssurgo_soils` | **USDA NRCS** | SSURGO soil map units *(host flaky)* |

> ⚠️ **Flaky upstreams (handled gracefully — logged, non-fatal, re-runnable):**
> **FEMA NFHL** (`hazards.fema.gov`) often returns HTTP 500 under load;
> **USDA SSURGO** (`nrcsgeoservices`) and **NCED** (`umesc-gisdb03.er.usgs.gov`)
> intermittently 503/time out. Just re-run `--only <key>` later. The wired-in
> **PAD-US** layer substitutes for NH GRANIT conservation lands because
> `nhgeodata.unh.edu` currently serves an **expired TLS certificate**.

## 3. OpenStreetMap  (auto-downloaded via Overpass)

`download_osm.py` extracts themed layers (roads, buildings, water, waterways,
landuse, amenities, leisure, railways, boundaries, power, shops, addresses) for
the Concord bbox. Great for crowd-sourced POIs, building footprints, and trails
that the city/state layers miss. ODbL-licensed (attribution + share-alike).

## 4. Non-ArcGIS APIs  (`download_apis.py`)

Sources that aren't ArcGIS REST but have clean public APIs — output GeoJSON/CSV
to `data/apis/`:

| Key | Source | Output | Key? |
|---|---|---|---|
| `census_acs` | Census ACS 5-yr (income, pop, housing, age…) per tract | CSV (join to `tiger_tracts`) | free key |
| `cdc_places` | CDC PLACES tract health (long format) | GeoJSON | no |
| `epa_frs` | EPA FRS facilities, Merrimack Co. (de-duped) | CSV (address-only) | no |
| `usgs_streamgages` | USGS NWIS active stream sites + latest flow | GeoJSON | no |
| `lodes` | LEHD LODES8 NH workplace jobs + crosswalk | .csv.gz | no |
| `cat_gtfs` | Concord Area Transit GTFS-Flex feed | zip + stops GeoJSON | no |
| `nrel_ev` | NREL AFDC EV charging stations (25 mi) | GeoJSON | DEMO_KEY |
| `tnm_products` | USGS 3DEP DEM / NAIP / LiDAR download URLs | JSON | no |
| `pvwatts` | NREL PVWatts solar estimate (centroid) | JSON | DEMO_KEY |
| `airnow` | EPA AirNow current AQI | GeoJSON | AIRNOW_API_KEY |
| `purpleair` | PurpleAir sensors in bbox | GeoJSON | PURPLEAIR_API_KEY |

`python3 download_apis.py` runs the keyless ones; add `--all` to include the
key-gated AirNow/PurpleAir. (`developer.nrel.gov` must be reachable for the NREL
sources — some sandboxes block it.)

## 5. "Every business" point layer  (`download_businesses.py`)

- **OpenStreetMap** (default, no deps) — a comprehensive Overpass union across
  `shop` / `office` / `craft` / commercial `amenity` / `tourism` / `healthcare`
  / fitness `leisure` → ~640 businesses → `data/businesses/osm_businesses.geojson`.
- **Overture Maps Places** (`--overture`) — ~60M+ conflated, free, redistributable
  POIs. Uses the `overturemaps` CLI or `duckdb` (auto-detected); prints install
  hints if neither is present.
- **Foursquare OS Places** — documented DuckDB one-liner in `sources.json`.
- Google Places / Yelp are richer but their ToS forbid republishing as a layer.

## 6. Sources that need manual / per-record acquisition

These have no clean bulk GeoJSON API — documented in `sources.json` →
`portals_manual`:

- **Vision Government Solutions (VGSI)** — full assessment/property database,
  <https://gis.vgsi.com/concordnh/>. Tabular; join to the city `Property` layer
  on Map-Block-Lot, or request a bulk export from the Assessing Department.
- **NH GRANIT / NH Geodata Portal** — <https://www.nhgeodata.unh.edu/> and the
  classic clearinghouse <https://granit.unh.edu/data/downloadfreedata/downloaddata.html>:
  100+ statewide layers (SSURGO soils, conservation/public lands, land cover,
  **LiDAR DEM**, orthoimagery) as Shapefile/GeoTIFF, plus WMS/WFS.
- **NH DES Geodata Portal** — wells, contamination/remediation sites, dams,
  watersheds, wetland permits.
- **CNHRPC** (regional planning) — transit routes, traffic counts, trails,
  Concord Pedestrian Master Plan. Contact `ctufts@cnhrpc.org`.
- **NHDOT GIS** — state roads, bridges, signals, transit (`maps.dot.nh.gov`).
  Note: **AADT traffic counts** (TDMS) and **crash data** (SADES) are *not*
  exposed as public ArcGIS layers — pull from the TDMS reports or request from
  NHDOT directly.
- **EPA EJScreen** — block-group environmental-justice indicators. EPA's ArcGIS
  host was unreachable during verification, so no REST layer is wired in;
  download the geodatabase from <https://www.epa.gov/ejscreen> or join the
  EJScreen CSV to `tiger_block_groups` by GEOID.
- **NH E911 / NG911 address points** — authoritative NH site/structure address
  points; not an open feature service, request from NH DESC or NH GRANIT.
- **US Census ACS API**, **USGS National Map / 3DEP** (elevation, NLCD, NAIP),
  **FEMA MSC** — bulk national archives covering Merrimack County.

---

## How the downloader works

`arcgis_to_geojson.py` is the engine the other scripts import:

- Reads layer metadata, paginates with `resultOffset`/`resultRecordCount`
  (falls back to ObjectID windowing if the server lacks pagination).
- Requests native **GeoJSON** when advertised; otherwise requests Esri JSON and
  converts geometry client-side (handles older 10.x services like NWI).
- Reprojects output to WGS84 (`outSR=4326`) and retries transient HTTP failures
  with exponential backoff (2/4/8/16 s).

## Licensing / use

City data carries a "prepared for use by the City of Concord… use at your own
risk" disclaimer — verify currency before authoritative use. Federal data is
public domain; OSM is ODbL; NH GRANIT terms are per-layer on the portal. Always
cite sources.
