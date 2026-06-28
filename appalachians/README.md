# The Appalachians — Regions Explorer

An interactive map of the **entire Appalachian range**, Georgia to Maine: its six
physiographic **regions**, named mountain ranges, notable summits, and the full
Appalachian Trail. Tap any region or range for its geology, formative orogeny, and
highest peak.

Live: [`/appalachians/`](https://maxwellhowegis.com/appalachians/)

## Stack

- **MapLibre GL JS 4** — data-driven region fills, hover, 3D terrain
- **6 keyless basemaps** — OpenFreeMap (vector) + Esri / USGS / Carto raster, switched by
  raster-layer visibility so custom overlays are never wiped
- **AWS Open Data terrain tiles** (terrarium) — hillshade + `setTerrain` 3D
- Static **GeoJSON**, no build step at runtime; mobile-first responsive UI

## Data

| File | What | Source |
|---|---|---|
| `data/regions.geojson` | 6 geologic regions (dissolved polygons) | USGS Physiographic Divisions of the Conterminous U.S. (Fenneman & Johnson, 1946) |
| `data/ranges.geojson` | 13 named ranges (label points) | Hand-curated |
| `data/peaks.geojson` | 10 notable summits | Hand-curated, USGS elevations |
| `data/appalachian_trail.geojson` | Full ANST centerline (GA→ME) | NPS ArcGIS FeatureServer |
| `data/states.geojson` | 17 state outlines | US Census / PublicaMundi |

### Region legend → USGS province

| Region | USGS province |
|---|---|
| Blue Ridge | Blue Ridge |
| Ridge & Valley | Valley and Ridge |
| Appalachian Plateau | Appalachian Plateaus |
| New England Upland | New England (excl. Seaboard Lowland) |
| Adirondacks | Adirondack |
| Piedmont | Piedmont |

All six belong to Fenneman's **Appalachian Highlands** division.

### Regenerating `regions.geojson`

```bash
# from repo root (needs curl, unzip, npx/mapshaper, jq — no GDAL)
bash scripts/build_appalachians_data.sh
```

Fetches the national USGS shapefile, maps the Appalachian Highlands provinces to the six
legend regions, clips to the eastern U.S., simplifies, and dissolves. `ranges.geojson`,
`peaks.geojson`, `appalachian_trail.geojson`, and `states.geojson` are vendored separately.

## Local development

```bash
python -m http.server 8001   # from repo root → http://localhost:8001/appalachians/
```

## Features

- Six keyless basemaps (Minimal / Streets / Satellite / Topo / Relief / Dark)
- Layers panel: per-layer toggles + opacity, region filtering, jump-to menu
- Named ranges, notable summits, region labels, state outlines, Appalachian Trail
- Place search (Nominatim), geolocate, fullscreen, scale, measure-distance
- 3D terrain with exaggeration control; shareable URL-hash (view + basemap + layers)
- Mobile-first: bottom-sheet detail cards, touch-friendly controls
