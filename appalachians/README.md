# The Appalachians — Regions Explorer

An interactive map of the **entire Appalachian range**, Georgia to Newfoundland: its fourteen
physiographic **regions** (twelve in the U.S. at USGS section level, two in Canada), named
mountain ranges, notable summits, and both the Appalachian Trail and its Canadian continuation,
the International Appalachian Trail. Tap any region or range for its geology, formative orogeny,
and highest peak.

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
| `data/regions.geojson` | 8 geologic regions (dissolved polygons) | USGS Physiographic Divisions (U.S.) + Natural Resources Canada "Appalachian Uplands" physiographic region (Canada) |
| `data/ranges.geojson` | 18 named ranges (label points) | Hand-curated |
| `data/peaks.geojson` | 15 notable summits | Hand-curated, USGS/NRCan elevations |
| `data/appalachian_trail.geojson` | Full ANST centerline (GA→ME) | NPS ArcGIS FeatureServer |
| `data/iat.geojson` | International Appalachian Trail (ME→Gaspé→Newfoundland) | OpenStreetMap (Overpass) |
| `data/states.geojson` | 22 state & province outlines | US Census / PublicaMundi + Natural Earth (Canada) |

### Region legend → physiographic province

| Region | USGS province · section | Source |
|---|---|---|
| White Mountains | New England · White Mountain | USGS |
| Green Mountains | New England · Green Mountain | USGS |
| Taconic Mountains | New England · Taconic | USGS |
| New England Upland | New England · New England Upland | USGS |
| Adirondacks | Adirondack | USGS |
| Catskills | Appalachian Plateaus · Catskill | USGS |
| Allegheny Plateau | Appalachian Plateaus · Allegheny/Kanawha/Southern NY/Mohawk | USGS |
| Cumberland Plateau | Appalachian Plateaus · Cumberland | USGS |
| Ridge & Valley | Valley and Ridge | USGS |
| Northern Blue Ridge | Blue Ridge · Northern | USGS |
| Southern Blue Ridge | Blue Ridge · Southern | USGS |
| Piedmont | Piedmont | USGS |
| Gaspé & Maritimes | Appalachian Uplands (Gaspé, NB, NS) | NRCan |
| Newfoundland Highlands | Appalachian Uplands (Long Range Mtns) | NRCan |

The twelve U.S. regions are USGS **sections** within Fenneman's **Appalachian Highlands**
division (the New England province split into White/Green/Taconic/Upland, the Plateau into
Catskill/Allegheny/Cumberland, the Blue Ridge into Northern/Southern); the two Canadian regions
come from the NRCan **Appalachian Uplands** physiographic region, split at the Cabot Strait.

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

- **Formation view** — a second legend mode that recolors the 14 regions by their primary
  formative event (Grenville ~1.1 Ga → Taconic ~450 Ma → Acadian ~375 Ma → Alleghanian
  ~300 Ma → unfolded plateaus), telling the how-the-range-formed story at a glance; legend
  rows toggle whole orogeny groups, and the mode persists in share links

- Six keyless basemaps (Minimal / Streets / Satellite / Topo / Relief / Dark)
- Layers panel: per-layer toggles + opacity, region filtering, jump-to menu
- Named ranges, notable summits, region labels, state outlines, Appalachian Trail
- Place search (Nominatim), geolocate, fullscreen, scale, measure-distance
- 3D terrain with exaggeration control; shareable URL-hash (view + basemap + layers)
- Mobile-first: bottom-sheet detail cards, touch-friendly controls
