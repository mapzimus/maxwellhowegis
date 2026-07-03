# US Fantasy Transit Network

A fantasy "unlimited funds" transit network for North America, built as a **four-tier
hierarchy** and generated end-to-end from Census data. This folder holds the **network viewer** —
a read-only interactive map of the generated network — plus the data it renders, all plain GeoJSON.

Open [`/transit/`](https://maxwellhowegis.com/transit/) (or `transit/index.html` locally) to explore.

## The four tiers

| Tier | Role | What it connects | Color |
|---|---|---|---|
| **1 — HSR Hub** | Major-city high-speed-rail hubs | Tier-1 ↔ tier-1, the intercity spine | `#fbbf24` amber |
| **2 — Regional Hub** | Smaller regional connectors | Bridge tier-1 hubs down to local networks | `#a5b4fc` indigo |
| **3 — Metro / Subway** | Hyper-local neighborhood transit | Hangs off a tier-2 hub | `#34d399` green |
| **4 — Commuter Rail** | Normal-speed rail to *every* town | Reaches the towns off tier-2 hubs | `#38bdf8` sky |

A link's tier is the **less-major** of its two endpoints (`max(fromTier, toTier)`): a tier-1↔tier-1
line is HSR; a tier-1↔tier-2 line is regional; a tier-2↔tier-3 line is metro, and so on.

## Data flow

The network is **generated, not hand-drawn**: `scripts/build_towns.py` derives the towns layer
from Census files, `scripts/build_network.py` derives the four-tier network from the towns, and
the viewer renders the committed results on every visit.

```
  Census/NE sources ─▶ scripts/build_towns.py ─▶ data/towns.geojson
                                                       │
                       scripts/build_network.py ◀──────┘
                          │
                          ├─▶ data/network.json        (tiers 1-3 + edges)
                          └─▶ data/tier4_links.geojson (commuter lines)
                                        │
                                transit/index.html (viewer)
```

To change the network, tweak the constants at the top of `scripts/build_network.py` and re-run it
(~20 s), or hand the GeoJSON to Claude Code — the files in `data/` are the interface.

## Using the viewer

- **T1–T4 buttons** (top) toggle each tier's nodes and lines — a functional legend. Hide metro and
  commuter to see the HSR spine; the sidebar list filters with the map, while the count badges and
  mileage always describe the full network.
- **Layer checkboxes**: the 33k-town base layer and the commuter-web lines are canvas-rendered,
  lazy-loaded reference layers; their on/off preference is remembered.
- **Search** flies to any of the ~33k towns (`Enter` = top hit, ranked by population). Clicking a
  sidebar row or a map marker flies there too.
- **Fit view** reframes the lower 48. On phones the panel is a collapsible bottom sheet — tap the
  handle to expand; tapping a row flies the map and tucks the sheet away.

## The auto-generated network

`scripts/build_network.py` generates the entire four-tier network from the towns layer in ~20 s
(pure stdlib, deterministic — tweak the constants at the top and re-run):

| Tier | Rule | Result |
|---|---|---|
| **1 — HSR** | pop ≥ 175k @ 60 mi spacing; MST + 2-nearest-neighbor mesh. **International**: 12 Canadian metros, 8 northern-Mexico metros (border twins like Tijuana and Ciudad Juárez space only against each other), and island links — Honolulu→Los Angeles, San Juan→Miami, Anchorage→Vancouver — land at the biggest hub within 10% of the shortest crossing | **109 hubs**, 26,666 mi |
| **2 — Regional** | pop ≥ 25k @ 30 mi spacing, **plus** any 100k+ city outside a metro, **plus** 42 Canadian regionals, **plus coverage fill**: promote the biggest uncovered town until *every* town is within 60 mi of a hub (Canada/Mexico stop at tier 2) | **725 hubs**, chained to the spine |
| **3 — Metro** | radial urban-core subways: every 150k+ US hub gets 4–10 compass-named lines with 2–4 chained stops each (by population), and a **circle line only where ≥ 8 lines make it read as one**. Station placement is **land-aware** (Census state polygons minus Natural Earth lakes; wet stations pull inland or drop; collisions with the hub or sibling stations drop). Suburbs ≥ 15k within 18 mi (**1,253**) join at their **nearest station** as line extensions, not by beelining to the hub | **3,043 metro nodes** |
| **4 — Commuter web** | **snaking lines**: each leaves the hub nearest an unclaimed town, hops nearest-unvisited-town to nearest-unvisited-town (≤ 25 mi), and closes into a *different* hub when one comes within 12 mi (or loops home) — every line ends at a hub, every town has degree ≤ 2. Lines are **2-opt uncrossed** (1,200 self-crossings removed) and **render as smooth curves** in the viewer | **2,378 lines / 33,635 segments** (mean segment 7.8 mi), zero dead ends |

The result is one fully connected graph (3,877 nodes / 4,050 edges) written to
`data/network.json` — the viewer loads it directly on every visit. The commuter web renders as
its own toggleable canvas layer.

Notable data fixes made for this: consolidated cities (Washington DC, Indianapolis,
Nashville-Davidson, Louisville/Jefferson, Baton Rouge, Athens, Augusta…) enter via their Census
"(balance)"/nonfunctioning records, and three water-skewed internal points (San Francisco 34 mi
offshore near the Farallons, New Orleans, Corpus Christi) are overridden to downtown coordinates.

## Tier 4 — the "every town" base layer

Tier 4 (normal-speed commuter rail reaching every town) is too large to hand-place, so it's
**auto-seeded** from the US Census, not drawn node by node. `scripts/build_towns.py` pulls the
Census **Gazetteer Places (national)** file and writes every **incorporated place** — city, town,
village, borough — in the 50 states + DC to `transit/data/towns.geojson` as tier-4 GeoJSON points.

- **33,282 towns** (2024 gazetteer): 10,219 cities · 5,271 towns · 3,728 villages · 1,215 boroughs
  · 12,820 CDPs (unincorporated communities, included by default; `--no-cdp` to exclude) · 29 consolidated
  governments and other types · Guam's
  19 villages seeded from the 2020 Census. New England towns come from the **county-subdivisions
  gazetteer** (they're minor civil divisions, not places — New Hampshire alone has 221 MCD towns
  vs. 13 incorporated cities), deduped against same-name places nearby. Big estimate-less places
  (CDPs, HI/PR) get a one-to-one Natural Earth population backfill.
- Every town is **joined to Census population** (SUB-EST 2024 place-level estimates, 100% match by
  GEOID) — the `pop` property drives dot size/opacity in the viewer and search ranking, and is what
  a tier-2 candidate cut (e.g. pop ≥ 100k) will run on.
- Rendered in the viewer as a faint, canvas-drawn, non-interactive dot layer (**sized by
  population**) with a **"Tier-4 towns" toggle** in the sidebar. It's the reference set the
  commuter lines thread through; the search box flies to any of them.
- Rebuild / re-vintage:

  ```bash
  python3 scripts/build_towns.py                 # places + CDPs + NE MCD towns (default)
  python3 scripts/build_towns.py --no-cdp         # incorporated places only
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
API keys. The 33k-point tier-4 town layer is canvas-rendered in its own pane for smooth pan/zoom.
`scripts/build_towns.py` (Python stdlib only) regenerates the town data. Matches the rest of the
site (plain HTML/CSS/JS).

## Status / next steps

- [x] Click-to-place node editor, link/delete modes, GeoJSON import/export, autosave
- [x] Tier-4 "every town" base layer — 33,282 Census towns (`data/towns.geojson`)
- [x] Census population joined to every town (100%); pop-scaled dots
- [x] Town search → fly-to / promote-to-node; undo (Ctrl+Z); auto-parent on cross-tier links;
      live per-tier mileage
- [x] **Auto-generated full network** (`scripts/build_network.py`): 109 HSR + 725 regional +
      3,043 metro (radial land-aware urban-core subways) + 2,378 snaking commuter lines
      through every remaining town, each ≤ 60 mi from a hub
- [ ] Auto-route HSR edges along real corridors instead of straight lines
- [ ] Network stats (reach, coverage: % of population within N mi of each tier)
- [x] Promote to a styled read-only "network map" viewer (editing retired)
- [ ] Add it to the portfolio gallery
