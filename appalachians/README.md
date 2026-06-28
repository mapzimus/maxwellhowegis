# Northeast Appalachians — Physiographic Province Explorer

An interactive recreation of the classic "Northeast Appalachians" diagram: the six
physiographic **provinces** of New York and New England as colored polygons, plus the
named **subranges** within them as lettered badges. Click any province or range for its
geology, formative orogeny, and highest peak.

Live: [`/appalachians/`](https://maxwellhowegis.com/appalachians/)

## Stack

- **MapLibre GL JS 4** — data-driven province fills, hover state, optional 3D terrain
- **OpenFreeMap** (`positron` style) — keyless vector basemap
- **AWS Open Data terrain tiles** (terrarium) — keyless hillshade + `setTerrain` 3D (toggle)
- Static **GeoJSON**, no build step at runtime

## Data

| File | What | Source |
|---|---|---|
| `data/provinces.geojson` | 6 legend provinces (dissolved polygons) | USGS Physiographic Divisions of the Conterminous U.S. (Fenneman & Johnson, 1946) |
| `data/subranges.geojson` | 9 named ranges (lettered label points) | Hand-curated |
| `data/peaks.geojson` | Highest summit per range | Hand-curated, USGS elevations |

### Province legend → USGS unit

| Legend | USGS province / section |
|---|---|
| Adirondack Mountains | Adirondack Province |
| White Mountains | New England → White Mountain section |
| Green Mountains | New England → Green Mountain section |
| Taconic Mountains | New England → Taconic section |
| Allegheny Plateau | Appalachian Plateaus → Catskill + Southern New York sections |
| Ridge and Valley | Valley and Ridge → Hudson Valley + Middle sections |

### Regenerating `provinces.geojson`

```bash
# from repo root (needs curl, unzip, npx/mapshaper, jq — no GDAL)
bash scripts/build_appalachians_data.sh
```

The script fetches the national USGS shapefile, maps PROVINCE/SECTION attributes to the six
poster legend groups, clips to the Northeast (bbox `-80.5,39.8,-69.2,45.7`), simplifies, and
dissolves. `subranges.geojson` and `peaks.geojson` are hand-curated and not regenerated.

## Local development

```bash
python -m http.server 8001   # from repo root
# → http://localhost:8001/appalachians/
```
