# Concord, NH — GIS Data Catalog & Acquisition Toolkit

A catalog of every Concord, New Hampshire GIS dataset I could find online, plus
scripts that download them to GeoJSON. Standard-library Python 3.7+ only — no
`pip install` required.

```
concord-nh-data/
├── README.md            ← this catalog
├── sources.json         ← machine-readable manifest (edit to add layers)
├── scripts/
│   ├── arcgis_to_geojson.py   reusable ArcGIS REST → GeoJSON (pagination + esri-json fallback)
│   ├── download_concord.py    auto-discovers & downloads ALL city layers
│   ├── download_external.py   federal + state ArcGIS layers, clipped to Concord
│   └── download_osm.py        OpenStreetMap extract via Overpass
└── data/                ← output (git-ignored; reproducible from the scripts)
```

## Quick start

```bash
cd concord-nh-data/scripts
python3 download_concord.py      # ~72 city layers → data/concord_arcgis/
python3 download_external.py     # FEMA, Census, USGS, NWI, NH GRANIT → data/external/
python3 download_osm.py          # OSM themes → data/osm/

# preview without downloading
python3 download_concord.py --list
python3 download_external.py --list
python3 download_osm.py --list

# grab one thing
python3 download_external.py --only tiger_tracts nhd_flowlines
python3 arcgis_to_geojson.py "<any ArcGIS layer URL ending in /<id>>" out.geojson
```

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

| Key | Source | Contents |
|---|---|---|
| `nh_granit_parcels` | **NH GRANIT** | statewide parcel mosaic |
| `fema_flood_zones` / `_boundaries` / `_base_flood_elevations` / `_firm_panels` | **FEMA NFHL** | flood hazard zones, BFEs, FIRM panels |
| `tiger_roads`, `tiger_railroads` | **Census TIGERweb** | all-roads & railroads |
| `tiger_tracts`, `tiger_block_groups`, `tiger_blocks` | **Census TIGERweb** | 2020 census geographies (join ACS demographics via GEOID) |
| `nhd_flowlines`, `nhd_waterbodies`, `nhd_areas`, `nhd_points` | **USGS NHD** | hydrography |
| `nwi_wetlands` | **USFWS** | National Wetlands Inventory |

> ⚠️ **FEMA NFHL** (`hazards.fema.gov`) is frequently overloaded and returns
> HTTP 500. The script retries with backoff and logs a failure without aborting
> the rest — just re-run `--only fema_flood_zones` later, or pull the data from
> the [FEMA Map Service Center](https://msc.fema.gov/portal/home).
>
> ⚠️ **NH GRANIT** (`nhgeodata.unh.edu`) occasionally rate-limits. If a target
> 503s, confirm the layer id by browsing
> <https://nhgeodata.unh.edu/nhgeodata/rest/services>.

## 3. OpenStreetMap  (auto-downloaded via Overpass)

`download_osm.py` extracts themed layers (roads, buildings, water, waterways,
landuse, amenities, leisure, railways, boundaries, power, shops, addresses) for
the Concord bbox. Great for crowd-sourced POIs, building footprints, and trails
that the city/state layers miss. ODbL-licensed (attribution + share-alike).

## 4. Sources that need manual / per-record acquisition

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
