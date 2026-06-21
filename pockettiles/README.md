# PocketTiles Studio

Draw features on a map (or import a GeoJSON file), bake them into a **PMTiles v3 archive entirely in the browser**, and share a streaming URL. No tile server. No large local downloads. The viewer fetches only the tiles it needs via HTTP range requests.

## How the bake pipeline works

```
GeoJSON FeatureCollection
    │
    ▼
geojson-vt          — slices features into a tile pyramid (zoom 0–14)
    │                 working in tile coordinate space (0–4096)
    ▼
vt-pbf              — encodes each non-empty tile as Mapbox Vector Tile protobuf
    │
    ▼
CompressionStream   — gzip-compresses each tile (browser-native, no deps)
    │
    ▼
pmtiles-writer.js   — assembles a PMTiles v3 archive:
    │                   • 127-byte header
    │                   • gzip-compressed root directory (Hilbert-ordered tile IDs,
    │                     column-oriented varint encoding, delta-compressed offsets)
    │                   • gzip-compressed metadata JSON
    │                   • tile data section (concatenated gzipped MVT blobs)
    ▼
Blob → Download  or  Upload to Supabase Storage → share link
```

The custom PMTiles v3 writer in `js/pmtiles-writer.js` is the novel core piece — the official `pmtiles` npm package is read-only.

## Cloud publishing (optional)

Fill in `config.js` with your Supabase credentials:

1. Create a project at https://supabase.com
2. Create a **public** Storage bucket (e.g. `pocket-maps`)
3. Add a storage policy: `INSERT` allowed for `anon` role
4. Copy your Project URL and anon key from **Settings → API**

The public bucket URL supports HTTP range requests out of the box, which is all PMTiles needs to stream tiles to MapLibre.

## Validating the output

Open the baked `.pmtiles` file at **https://pmtiles.io** to inspect the archive structure, browse individual tiles, and confirm the bounds/zoom metadata.

You can also test range-request support on a Supabase-hosted archive:

```bash
curl -I -H "Range: bytes=0-126" https://<ref>.supabase.co/storage/v1/object/public/pocket-maps/my-map.pmtiles
# Expect: 206 Partial Content, accept-ranges: bytes
```

## Tech stack

| Layer | Library |
|---|---|
| Map rendering | MapLibre GL JS 4 |
| Drawing | Terra Draw 1 |
| Tile slicing | geojson-vt 4 |
| MVT encoding | vt-pbf 3 |
| Gzip | Browser `CompressionStream` (no deps) |
| PMTiles writer | Custom (this repo — `js/pmtiles-writer.js`) |
| Cloud storage | Supabase Storage (optional) |
| Basemap | OpenFreeMap liberty style |

No build step. All dependencies load as CDN scripts or ESM imports.

## Structure

```
pockettiles/
├── index.html          — Studio UI
├── viewer.html         — Streaming viewer (driven by URL hash)
├── config.js           — Supabase credentials (fill in to enable cloud publish)
├── css/styles.css      — Dark-theme styles
└── js/
    ├── pmtiles-writer.js  — PMTiles v3 writer (Hilbert IDs, varint dirs, header)
    ├── bake.js            — Tiling pipeline (geojson-vt + vt-pbf + gzip)
    ├── studio.js          — Studio UI logic + Terra Draw wiring
    └── viewer.js          — Viewer logic
```
