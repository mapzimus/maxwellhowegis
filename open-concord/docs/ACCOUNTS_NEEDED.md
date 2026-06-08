# Datasets That Need an Account / Key — work these one by one

Most of the toolkit is keyless. These few sources need a **free** account or API
key before we can pull them. Knock them out one at a time: register, set the env
var (or download the file), then re-run the noted command and tick the box.

Set keys as environment variables before running `download_apis.py` (it reads them
automatically):

```bash
export CENSUS_API_KEY=...      NREL_API_KEY=...     AIRNOW_API_KEY=...
export PURPLEAIR_API_KEY=...   OPENAQ_API_KEY=...   FIRMS_MAP_KEY=...
export MAPILLARY_TOKEN=...
```

## A. API keys (env vars) — unlock a script source

| ✓ | Source | Unlocks | Env var | Sign-up | Re-run |
|---|---|---|---|---|---|
| [ ] | **US Census** | ACS demographics per tract (`census_acs`) | `CENSUS_API_KEY` | https://api.census.gov/data/key_signup.html | `download_apis.py --only census_acs` |
| [ ] | **NREL** | EV chargers + PVWatts solar (`nrel_ev`, `pvwatts`) | `NREL_API_KEY` | https://developer.nrel.gov/signup/ | `download_apis.py --only nrel_ev pvwatts` |
| [ ] | **EPA AirNow** | live AQI observations (`airnow`) | `AIRNOW_API_KEY` | https://docs.airnowapi.org/ | `download_apis.py --all --only airnow` |
| [ ] | **OpenAQ** | air-quality monitor locations (`openaq`) | `OPENAQ_API_KEY` | https://openaq.org → API keys | `download_apis.py --all --only openaq` |
| [ ] | **PurpleAir** | citizen PM2.5 sensors (`purpleair`) | `PURPLEAIR_API_KEY` | email contact@purpleair.com | `download_apis.py --all --only purpleair` |
| [ ] | **NASA FIRMS** | active fire/thermal detections (`nasa_firms`) | `FIRMS_MAP_KEY` | https://firms.modaps.eosdis.nasa.gov/api/ | `download_apis.py --all --only nasa_firms` |
| [ ] | **Mapillary** | street-level image points (`mapillary`) | `MAPILLARY_TOKEN` | https://www.mapillary.com/dashboard/developers | `download_apis.py --all --only mapillary` |
| [ ] | **Overture / Foursquare** | densest business POIs (`overture_places`) | _(no key; needs `duckdb` or `overturemaps`)_ | `pipx install overturemaps` | `download_businesses.py --overture` |

## B. Portal accounts / bulk downloads — manual, then drop into `data/`

These have no clean API; you log in / download a file, then we load it.

| ✓ | Source | Gives | Where |
|---|---|---|---|
| [ ] | **Vision Govt Solutions (VGSI)** | full parcel **assessment** records → join to parcels on Map-Block-Lot | https://gis.vgsi.com/concordnh/ (or request bulk from Assessing Dept.) |
| [ ] | **EPA EJScreen** | block-group environmental-justice indicators → join to block groups on GEOID | https://www.epa.gov/ejscreen (download geodatabase/CSV) |
| [ ] | **NH GRANIT (native)** | NH-authoritative parcels, soils, conservation, **LiDAR DEM** | https://www.nhgeodata.unh.edu/ (host has expired TLS — download via browser) |
| [ ] | **NH E911 address points** | authoritative site/structure address points | request from NH DESC / NH GRANIT |
| [ ] | **CNHRPC** | regional transit, traffic counts, trails, Pedestrian Master Plan | email ctufts@cnhrpc.org |
| [ ] | **NHDOT** | AADT traffic counts (TDMS), crash data (SADES) | https://www.nh.gov/dot/ (request — not a public layer) |
| [ ] | **NH DOE iPlatform** | NH-specific school enrollment/assessment detail | https://my.doe.nh.gov/iPlatform/ |
| [ ] | **OpenRouteService** | isochrones / routing for accessibility analysis | https://openrouteservice.org/dev/ (free key) |

## Priority order (suggestion)

1. **Census** (`CENSUS_API_KEY`) — unlocks the demographic backbone for choropleths.
2. **VGSI** — assessment data is the highest-value parcel join.
3. **NREL** — EV + solar, two layers from one key.
4. **EJScreen + NH GRANIT** — environmental + authoritative NH base.
5. **AirNow / OpenAQ / PurpleAir** — the air-quality trio.
6. **FIRMS / Mapillary / ORS** — niche but cool.

Tick each box here and validate the resulting layer per
[`MEGA_MAP_SPEC.md` → Per-dataset validation protocol](MEGA_MAP_SPEC.md).
