# US Fantasy Transit Network

A fantasy "unlimited funds" transit network for the United States, built as a **four-tier
hierarchy** and spec'd out by hand on a map. This folder holds the **node editor** — a
click-to-place tool for laying down and linking the network — plus the network data it reads and
writes as plain GeoJSON.

Open [`/transit/`](https://maxwellhowegis.com/transit/) (or `transit/index.html` locally) to edit.

## The four tiers

| Tier | Role | What it connects | Color |
|---|---|---|---|
| **1 — HSR Hub** | Major-city high-speed-rail hubs | Tier-1 ↔ tier-1, the intercity spine | `#fbbf24` amber |
| **2 — Regional Hub** | Smaller regional connectors | Bridge tier-1 hubs down to local networks | `#a5b4fc` indigo |
| **3 — Metro / Subway** | Hyper-local neighborhood transit | Hangs off a tier-2 hub | `#34d399` green |
| **4 — Commuter Rail** | Normal-speed rail to *every* town | Reaches the towns off tier-2 hubs | `#38bdf8` sky |

A link's tier is the **less-major** of its two endpoints (`max(fromTier, toTier)`): a tier-1↔tier-1
line is HSR; a tier-1↔tier-2 line is regional; a tier-2↔tier-3 line is metro, and so on.

## The editing → Claude Code round-trip

The whole point is that you place nodes visually and hand the result back for further speccing.
The bridge is a **shared GeoJSON file** — `transit/data/network.json` — that the editor, this repo,
QGIS, GitHub's preview, and Claude Code all read.

```
  transit/index.html  ──(you click the map, draw links)──▶  network in the browser
        ▲                                                          │
        │ Claude reads transit/data/network.json                  │  Export  /  Copy JSON
        │                                                          ▼
  Claude Code  ◀────── commit & push  OR  paste into chat ─── network.json (GeoJSON)
```

Two ways to get your edits back to Claude Code:

1. **Commit path (durable).** Click **Export** → the browser downloads `network.json` → save it
   over `transit/data/network.json` → commit & push. Any future session reads the file directly.
   Best for the real network and for version history / diffs.
2. **Paste path (fast).** Click **Copy JSON** → paste it straight into the Claude Code chat. Best
   for quick "spec this out with me" iteration where you don't need a commit yet.

The editor also **autosaves to `localStorage`** as you work, and on load it falls back to
`data/network.json`, so you never lose progress and always boot from the committed network.

## Using the editor

- **Pick a tier** (buttons, or keys `1`–`4`), then **click the map** to drop a node.
- **Link** mode (`L`): click one node, then another, to connect them.
- **Delete** mode (`D`): click a node to remove it (its links go too).
- **Add** mode (`A`) is the default. In the sidebar, click a row to fly to it, `✎` to rename,
  `✕` to delete. `Esc` cancels a pending link / closes the import box.
- **Export / Copy JSON / Import / Fit view / Clear all** live in the sidebar footer.
- New nodes are auto-named from the nearest place via OpenStreetMap's Nominatim reverse geocoder
  (best-effort — falls back to a `Tier N` placeholder offline or when rate-limited; it never
  overwrites a name you set yourself).

## Data schema (`fantasy-transit-v1`)

A single GeoJSON `FeatureCollection`. **Nodes** are `Point` features, **links** are `LineString`
features, distinguished by `properties.kind`:

```jsonc
// node
{ "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [lng, lat] },
  "properties": { "kind": "node", "id": "n1", "name": "New York",
                  "tier": 1, "tierName": "HSR Hub", "parent": null } }

// link
{ "type": "Feature",
  "geometry": { "type": "LineString", "coordinates": [[lng,lat],[lng,lat]] },
  "properties": { "kind": "edge", "id": "e1", "from": "n1", "to": "n3",
                  "tier": 1, "tierName": "HSR Hub" } }
```

`parent` (optional) lets a lower-tier node record which hub it hangs off, if you want the hierarchy
made explicit beyond the drawn links.

## Stack

Single self-contained `index.html` — Leaflet 1.9 + keyless CARTO dark basemap, no build step, no
API keys. Matches the rest of the site (plain HTML/CSS/JS).

## Status / next steps

- [x] Click-to-place node editor, link/delete modes, GeoJSON import/export, autosave
- [x] Seed spine of 12 tier-1 HSR hubs (`data/network.json`)
- [ ] Flesh out tier-2 regional hubs, then tier-3 metro and tier-4 commuter coverage
- [ ] Auto-route HSR edges along real corridors; compute network stats (reach, coverage)
- [ ] Promote to a styled read-only "network map" view and add it to the portfolio gallery
