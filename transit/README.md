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
- **Search & promote** (sidebar box): type any town name — results are ranked by population.
  Click a row to fly there; hit `Enter` or the `＋` to **promote** it into the network as a node
  at the active tier, with its exact Census coordinates, real name, GEOID and population attached.
  This is the precise way to place tier-2/3 hubs on real cities.
- **Link** mode (`L`): click one node, then another, to connect them. Linking **across tiers
  records the hierarchy** — the minor node's `parent` is set to the major hub automatically.
- **Delete** mode (`D`): click a node to remove it (its links go too, and children are orphaned
  cleanly).
- **Undo** — `Ctrl/Cmd+Z` steps back through adds, links, deletes, renames, imports, even Clear all
  (within the session).
- **Add** mode (`A`) is the default. In the sidebar, click a row to fly to it, `✎` to rename,
  `✕` to delete. `Esc` cancels a pending link / closes the import box or search.
- The sidebar shows live **per-tier route mileage** (great-circle) under the node counts.
- **Export / Copy JSON / Import / Fit view / Clear all** live in the sidebar footer.
- Map-click nodes are auto-named from the nearest place via OpenStreetMap's Nominatim reverse
  geocoder (best-effort — falls back to a `Tier N` placeholder offline or when rate-limited; it
  never overwrites a name you set yourself). Promoted nodes already carry their Census name.

## The auto-generated network

`scripts/build_network.py` generates the entire four-tier network from the towns layer in ~2 s
(pure stdlib, deterministic — tweak the constants at the top and re-run):

| Tier | Rule | Result |
|---|---|---|
| **1 — HSR** | pop ≥ 300k, 70 mi spacing; MST + 2-nearest-neighbor HSR mesh | **49 hubs**, 67 lines, 12,918 mi |
| **2 — Regional** | pop ≥ 40k @ 45 mi spacing, **plus** any 100k+ city outside a metro, **plus coverage fill**: promote the biggest uncovered town until *every* town is within 90 mi of a hub | **372 hubs**, chained to the spine |
| **3 — Metro** | towns ≥ 15k within 18 mi of a 100k+ anchor | **1,176 metro nodes** |
| **4 — Commuter web** | every remaining town → nearest network node | **17,881 links** (`data/tier4_links.geojson`, render-only) |

The result is one fully connected graph (1,597 nodes / 1,615 edges) written to
`data/network.json` with a `rev` stamp — the editor adopts a newer committed network over stale
`localStorage` automatically. The commuter web renders as its own toggleable canvas layer.
The network is still fully hand-editable afterwards: move, rename, relink, delete, promote —
then Export/Copy JSON as usual.

Notable data fixes made for this: consolidated cities (Washington DC, Indianapolis,
Nashville-Davidson, Louisville/Jefferson, Baton Rouge, Athens, Augusta…) enter via their Census
"(balance)"/nonfunctioning records, and three water-skewed internal points (San Francisco 34 mi
offshore near the Farallons, New Orleans, Corpus Christi) are overridden to downtown coordinates.

## Tier 4 — the "every town" base layer

Tier 4 (normal-speed commuter rail reaching every town) is too large to hand-place, so it's
**auto-seeded** from the US Census, not drawn node by node. `scripts/build_towns.py` pulls the
Census **Gazetteer Places (national)** file and writes every **incorporated place** — city, town,
village, borough — in the 50 states + DC to `transit/data/towns.geojson` as tier-4 GeoJSON points.

- **19,465 towns** (2024 gazetteer): 10,214 cities · 4,306 towns · 3,709 villages · 1,215 boroughs.
- Every town is **joined to Census population** (SUB-EST 2024 place-level estimates, 100% match by
  GEOID) — the `pop` property drives dot size/opacity in the editor and search ranking, and is what
  a tier-2 candidate cut (e.g. pop ≥ 100k) will run on.
- Rendered in the editor as a faint, canvas-drawn, non-interactive dot layer (**sized by
  population**) with a **"Tier-4 towns" toggle** in the sidebar. It's *reference context* — the
  target set your commuter rail eventually reaches — and is deliberately kept **out of the editable
  network**: it never enters `network.json`, `localStorage`, or an export. You hand-place only the
  hubs (tiers 1–3 and any tier-4 rail hubs), or **promote** towns via search.
- Rebuild / re-vintage:

  ```bash
  python3 scripts/build_towns.py                 # incorporated places, 50 states + DC (default)
  python3 scripts/build_towns.py --include-cdp    # also add census-designated places (~32k total)
  python3 scripts/build_towns.py --year 2023      # pin a gazetteer vintage
  ```

  The raw gazetteer + estimates files are cached under `scripts/.cache/` (gitignored); only
  `towns.geojson` is committed. Each town carries `name`, `type`, `st`, `geoid`, `pop`, `tier:4` —
  enough to auto-route commuter lines from towns to their nearest regional hub later.
  (`--no-pop` skips the population join.)

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
API keys. The 19k-point tier-4 town layer is canvas-rendered in its own pane for smooth pan/zoom.
`scripts/build_towns.py` (Python stdlib only) regenerates the town data. Matches the rest of the
site (plain HTML/CSS/JS).

## Status / next steps

- [x] Click-to-place node editor, link/delete modes, GeoJSON import/export, autosave
- [x] Tier-4 "every town" base layer — 19,478 Census incorporated places (`data/towns.geojson`)
- [x] Census population joined to every town (100%); pop-scaled dots
- [x] Town search → fly-to / promote-to-node; undo (Ctrl+Z); auto-parent on cross-tier links;
      live per-tier mileage
- [x] **Auto-generated full network** (`scripts/build_network.py`): 49 HSR + 372 regional +
      1,176 metro + 17,881-link commuter web, fully connected, every town ≤ 90 mi from a hub
- [ ] Hand-tune the generated network (the editor edits it directly)
- [ ] Auto-route HSR edges along real corridors instead of straight lines
- [ ] Network stats (reach, coverage: % of population within N mi of each tier)
- [ ] Promote to a styled read-only "network map" view and add it to the portfolio gallery
