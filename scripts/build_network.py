#!/usr/bin/env python3
"""Auto-generate the full four-tier fantasy transit network from the towns layer.

Input:  transit/data/towns.geojson  (19,465 Census incorporated places with pop —
        built by scripts/build_towns.py)
Output: transit/data/network.json — the network: tier 1-3 nodes + edges
        (tier-4 towns render straight from data/towns.geojson; their
        connecting lines are deferred)

Algorithm (all straight-line/great-circle, stdlib only):

  Tier 1 (HSR hubs)      Cities with pop >= T1_MIN_POP, greedy-picked in population
                         order with a T1_SPACING_MI exclusion radius. Connected by a
                         minimum spanning tree plus each hub's K nearest neighbors —
                         a connected, lightly redundant intercity HSR mesh.
  Tier 2 (regional)      Cities with pop >= T2_MIN_POP, spaced T2_SPACING_MI from all
                         chosen hubs. Then COVERAGE FILL: while any town is farther
                         than COVERAGE_MI from a tier-1/2 hub, promote the most
                         populous uncovered town — guaranteeing every town in the
                         country has a hub within COVERAGE_MI. Each tier-2 links to
                         the nearest already-connected node (chains outward from the
                         tier-1 spine).
  Tier 3 (metro/subway)  Around anchors (tier-1 hubs + tier-2 hubs with pop >=
                         T3_ANCHOR_MIN_POP): every non-hub town with pop >=
                         T3_SAT_MIN_POP within T3_RADIUS_MI becomes a metro node
                         linked to its anchor.
  Tier 4 (town nodes)    Every remaining town is PLOTTED as a node (rendered from
                         data/towns.geojson) — the connecting lines are deferred
                         until a routing approach that reads well is chosen.

    python3 scripts/build_network.py

Deterministic given towns.geojson; tweak the constants below and re-run.
"""
import json, math, os, sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS = os.path.join(ROOT, "transit", "data", "towns.geojson")
OUT_NET = os.path.join(ROOT, "transit", "data", "network.json")

T1_MIN_POP = 175_000
T1_SPACING_MI = 60
T1_KNN = 2                 # extra nearest-neighbor edges per hub on top of the MST
T2_MIN_POP = 25_000
T2_SPACING_MI = 30
T2_BIG_POP = 100_000       # cities this big become hubs even inside the spacing
                           # radius, as long as they're outside a hub's metro
                           # (T3_RADIUS_MI) — catches Fort Worth, Baltimore, Mesa…
COVERAGE_MI = 60           # every town ends up within this of a tier-1/2 hub

# international extent: Canada gets tier-1/2 hubs (nothing more local), a few
# northern Mexican metros join tier 1, and island hubs (Honolulu, San Juan)
# keep a single mainland HSR link instead of the usual kNN redundancy
MX_T1_MIN_POP = 400_000
MX_LAT_MIN = 25.0
MX_T1_MAX = 8
ISLAND_LINK_MI = 1_000     # hubs whose nearest neighbor is farther get MST only
T3_ANCHOR_MIN_POP = 100_000
T3_SAT_MIN_POP = 15_000
T3_RADIUS_MI = 18

# urban-core metro: hubs this big get a radial subway network — 4-10 lines
# with 2-4 stops each (by population) chained outward from the hub, plus a
# circle line where there are enough lines to read as one (>= 8). Station
# placement is LAND-AWARE: candidates are point-in-polygon tested against
# Census state boundaries minus Natural Earth lakes; wet stations pull inward
# or drop. Suburb satellites join at their nearest station (line extensions).
CORE_MIN_POP = 150_000
CORE_R_FRAC = 0.62         # network radius as a fraction of the city's land radius
CORE_R_MIN_MI = 1.5
CORE_R_MAX_MI = 9.0
CORE_SHRINKS = (1.0, 0.72, 0.5, 0.32)   # inward retries for wet stations
COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
           "S","SSW","SW","WSW","W","WNW","NW","NNW"]

LAND_SOURCES = [
    ("cb_2023_us_state_500k.zip",
     "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip"),
    ("ne_10m_lakes.zip",
     "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip"),
    ("ne_10m_lakes_north_america.zip",
     "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes_north_america.zip"),
]
CACHE = os.path.join(ROOT, "scripts", ".cache")

TIER_NAME = {1: "HSR Hub", 2: "Regional Hub", 3: "Metro / Subway", 4: "Commuter Rail"}


# ---------------------------------------------------------------------------
# land / water testing (pure stdlib shapefile point-in-polygon)
# ---------------------------------------------------------------------------
def _load_shp_polys(path):
    """Parse polygon records (type 5) from the .shp inside a zip.
    Returns [(record_bbox, [(ring_bbox…, xs, ys), …]), …]."""
    import struct, zipfile
    z = zipfile.ZipFile(path)
    shp = z.read([n for n in z.namelist() if n.endswith(".shp")][0])
    recs, off = [], 100
    while off < len(shp):
        _, clen = struct.unpack(">ii", shp[off:off + 8]); off += 8
        content = shp[off:off + clen * 2]; off += clen * 2
        if struct.unpack("<i", content[:4])[0] != 5:
            continue
        xmin, ymin, xmax, ymax = struct.unpack("<4d", content[4:36])
        nparts, npts = struct.unpack("<2i", content[36:44])
        parts = struct.unpack(f"<{nparts}i", content[44:44 + 4 * nparts])
        pts = struct.unpack(f"<{2 * npts}d", content[44 + 4 * nparts:44 + 4 * nparts + 16 * npts])
        rings = []
        for i in range(nparts):
            s = parts[i]; e = parts[i + 1] if i + 1 < nparts else npts
            xs = pts[2 * s:2 * e:2]; ys = pts[2 * s + 1:2 * e:2]
            rings.append((min(xs), min(ys), max(xs), max(ys), xs, ys))
        recs.append(((xmin, ymin, xmax, ymax), rings))
    return recs


def _in_polys(recs, lat, lng):
    """Even-odd point-in-polygon over multipart records with holes."""
    for (bx0, by0, bx1, by1), rings in recs:
        if not (bx0 <= lng <= bx1 and by0 <= lat <= by1):
            continue
        inside = False
        for (rx0, ry0, rx1, ry1, xs, ys) in rings:
            if ry1 < lat or ry0 > lat or rx1 < lng:
                continue                    # ring can't cross the rightward ray
            n = len(xs)
            for i in range(n):
                j = (i + 1) % n
                if (ys[i] > lat) != (ys[j] > lat):
                    x = xs[i] + (lat - ys[i]) / (ys[j] - ys[i]) * (xs[j] - xs[i])
                    if x > lng:
                        inside = not inside
        if inside:
            return True
    return False


NE_PLACES_ZIP = ("ne_10m_populated_places_simple.zip",
                 "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip")


def ne_intl_places():
    """Canada + Mexico cities from Natural Earth populated places, shaped like
    town dicts (synthetic geoid, country 'CA'/'MX', pop = pop_max metro scale)."""
    import struct, urllib.request, zipfile
    fname, url = NE_PLACES_ZIP
    path = os.path.join(CACHE, fname)
    if not os.path.exists(path):
        print(f"downloading {url}", file=sys.stderr)
        os.makedirs(CACHE, exist_ok=True)
        with urllib.request.urlopen(url, timeout=180) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    z = zipfile.ZipFile(path)
    data = z.read([n for n in z.namelist() if n.endswith(".dbf")][0])
    nrec = struct.unpack("<I", data[4:8])[0]
    hlen, rlen = struct.unpack("<HH", data[8:12])
    fields, off = [], 32
    while data[off] != 0x0D:
        fields.append((data[off:off + 11].split(b"\0")[0].decode("latin-1"), data[off + 16]))
        off += 32
    out = []
    for i in range(nrec):
        rec = data[hlen + i * rlen: hlen + (i + 1) * rlen]
        vals, p = {}, 1
        for name, flen in fields:
            vals[name] = rec[p:p + flen].decode("utf-8", "replace").strip(); p += flen
        adm0 = vals.get("adm0name")
        if adm0 not in ("Canada", "Mexico"):
            continue
        cc = "CA" if adm0 == "Canada" else "MX"
        out.append({"name": vals["name"], "st": "CAN" if cc == "CA" else "MEX", "country": cc,
                    "geoid": "NE" + (vals.get("ne_id") or str(i)),
                    "pop": int(float(vals.get("pop_max") or 0)), "sqmi": 0,
                    "lat": float(vals["latitude"]), "lng": float(vals["longitude"])})
    return out


_LAND = None   # (states, lakes, lakes_na), loaded on first use


def on_dry_land(lat, lng):
    global _LAND
    if _LAND is None:
        import urllib.request
        os.makedirs(CACHE, exist_ok=True)
        loaded = []
        for fname, url in LAND_SOURCES:
            path = os.path.join(CACHE, fname)
            if not os.path.exists(path):
                print(f"downloading {url}", file=sys.stderr)
                with urllib.request.urlopen(url, timeout=180) as r:
                    data = r.read()
                with open(path, "wb") as f:
                    f.write(data)
            loaded.append(_load_shp_polys(path))
        _LAND = tuple(loaded)
    states, lakes, lakes_na = _LAND
    return (_in_polys(states, lat, lng)
            and not _in_polys(lakes, lat, lng)
            and not _in_polys(lakes_na, lat, lng))


def hav(alat, alng, blat, blng):
    d = math.radians
    s = (math.sin(d(blat - alat) / 2) ** 2
         + math.cos(d(alat)) * math.cos(d(blat)) * math.sin(d(blng - alng) / 2) ** 2)
    return 2 * 3958.761 * math.asin(math.sqrt(s))


def tdist(a, b):
    return hav(a["lat"], a["lng"], b["lat"], b["lng"])


class Grid:
    """1-degree spatial hash. CELL_MIN_MI is the worst-case miles spanned by one
    degree of longitude in the dataset (lat ~71 in north Alaska), used as the
    ring-expansion lower bound so nearest() is exact."""
    CELL_MIN_MI = 22.0

    def __init__(self, items):
        self.cells = defaultdict(list)
        for it in items:
            self.add(it)

    @staticmethod
    def key(lat, lng):
        # wrap longitude cells at the antimeridian so Guam (+144°E) measures
        # 58 cells from Hawaii, not 302 raw cells the long way around
        return (math.floor(lat), (math.floor(lng) + 180) % 360 - 180)

    def add(self, it):
        self.cells[self.key(it["lat"], it["lng"])].append(it)

    def _ring(self, base, r):
        by, bx = base
        w = lambda x: (x + 180) % 360 - 180        # antimeridian wrap
        if r == 0:
            yield base
            return
        for x in range(bx - r, bx + r + 1):
            yield (by - r, w(x))
            yield (by + r, w(x))
        for y in range(by - r + 1, by + r):
            yield (y, w(bx - r))
            yield (y, w(bx + r))

    def nearest(self, lat, lng, ok=None):
        base = self.key(lat, lng)
        best, bd = None, float("inf")
        for r in range(0, 400):
            if bd <= (r - 1) * self.CELL_MIN_MI:
                break
            for cell in self._ring(base, r):
                for it in self.cells.get(cell, ()):
                    if ok is not None and not ok(it):
                        continue
                    dd = hav(lat, lng, it["lat"], it["lng"])
                    if dd < bd:
                        best, bd = it, dd
        return best, bd

    def within(self, lat, lng, radius_mi):
        out = []
        rings = int(radius_mi / self.CELL_MIN_MI) + 2
        base = self.key(lat, lng)
        for r in range(0, rings):
            for cell in self._ring(base, r):
                for it in self.cells.get(cell, ()):
                    if hav(lat, lng, it["lat"], it["lng"]) <= radius_mi:
                        out.append(it)
        return out


def greedy_spacing(cands, spacing_mi, existing):
    """Pick candidates in order, skipping any within spacing_mi of a prior pick
    (or of `existing`). Uses a Grid over picks for speed."""
    picked = []
    grid = Grid(list(existing))
    for c in cands:
        _, d = grid.nearest(c["lat"], c["lng"])
        if d >= spacing_mi:
            picked.append(c)
            grid.add(c)
    return picked


def mst_edges(nodes):
    """Prim's MST over the complete great-circle graph. Returns index pairs."""
    n = len(nodes)
    in_tree = [False] * n
    best = [float("inf")] * n
    link = [-1] * n
    best[0] = 0.0
    edges = []
    for _ in range(n):
        u = min((i for i in range(n) if not in_tree[i]), key=lambda i: best[i])
        in_tree[u] = True
        if link[u] >= 0:
            edges.append((link[u], u))
        for v in range(n):
            if not in_tree[v]:
                d = tdist(nodes[u], nodes[v])
                if d < best[v]:
                    best[v], link[v] = d, u
    return edges


def main():
    gj = json.load(open(TOWNS))
    towns = [{
        "name": f["properties"]["name"], "st": f["properties"]["st"],
        "geoid": f["properties"]["geoid"], "pop": f["properties"]["pop"] or 0,
        "sqmi": f["properties"].get("sqmi") or 0, "country": "US",
        "lng": f["geometry"]["coordinates"][0], "lat": f["geometry"]["coordinates"][1],
    } for f in gj["features"]]
    by_pop = sorted(towns, key=lambda t: -t["pop"])
    intl = ne_intl_places()
    intl_ca = sorted((c for c in intl if c["country"] == "CA"), key=lambda c: -c["pop"])
    intl_mx = sorted((c for c in intl if c["country"] == "MX"), key=lambda c: -c["pop"])

    # ---- tier 1 ----------------------------------------------------------
    t1 = greedy_spacing([t for t in by_pop if t["pop"] >= T1_MIN_POP], T1_SPACING_MI, [])
    ca_t1 = greedy_spacing([c for c in intl_ca if c["pop"] >= T1_MIN_POP], T1_SPACING_MI, t1)
    # Mexican metros space only against each other — border twins (Tijuana/San
    # Diego, Juárez/El Paso) are distinct hubs despite their proximity
    mx_t1 = greedy_spacing(
        [c for c in intl_mx if c["pop"] >= MX_T1_MIN_POP and c["lat"] >= MX_LAT_MIN],
        T1_SPACING_MI, [])[:MX_T1_MAX]
    t1 = t1 + ca_t1 + mx_t1
    print(f"tier 1: {len(t1)} HSR hubs ({len(ca_t1)} Canadian, {len(mx_t1)} Mexican: "
          f"{', '.join(c['name'] for c in mx_t1)})", file=sys.stderr)

    # ---- tier 2: population picks + coverage fill ------------------------
    hub_geoids = {t["geoid"] for t in t1}
    hub_grid = Grid(list(t1))
    t2 = []
    for c in by_pop:
        if c["pop"] < T2_MIN_POP:
            break
        if c["geoid"] in hub_geoids:
            continue
        _, d = hub_grid.nearest(c["lat"], c["lng"])
        if d >= T2_SPACING_MI or (c["pop"] >= T2_BIG_POP and d > T3_RADIUS_MI):
            t2.append(c)
            hub_geoids.add(c["geoid"])
            hub_grid.add(c)
    print(f"tier 2: {len(t2)} regional hubs from population cut", file=sys.stderr)
    ca_t2 = 0
    for c in intl_ca:
        if c["pop"] < T2_MIN_POP or c["geoid"] in hub_geoids:
            continue
        _, d = hub_grid.nearest(c["lat"], c["lng"])
        if d >= T2_SPACING_MI:
            t2.append(c)
            hub_geoids.add(c["geoid"])
            hub_grid.add(c)
            ca_t2 += 1
    print(f"tier 2: +{ca_t2} Canadian regional hubs", file=sys.stderr)
    dist_to_hub = {}
    for t in towns:
        _, d = hub_grid.nearest(t["lat"], t["lng"])
        dist_to_hub[t["geoid"]] = d
    town_grid = Grid(towns)
    fills = 0
    while True:
        uncovered = [t for t in towns if dist_to_hub[t["geoid"]] > COVERAGE_MI]
        if not uncovered:
            break
        pick = max(uncovered, key=lambda t: t["pop"])
        t2.append(pick)
        hub_geoids.add(pick["geoid"])
        hub_grid.add(pick)
        fills += 1
        for t in town_grid.within(pick["lat"], pick["lng"], COVERAGE_MI):
            d = tdist(pick, t)
            if d < dist_to_hub[t["geoid"]]:
                dist_to_hub[t["geoid"]] = d
    print(f"tier 2: +{fills} coverage-fill hubs (every town now within "
          f"{COVERAGE_MI} mi of a hub) → {len(t2)} total", file=sys.stderr)

    # ---- tier 3 satellites (US only — Canada/Mexico stop at tier 2) --------
    anchors = ([t for t in t1 if t.get("country", "US") == "US"]
               + [t for t in t2 if t.get("country", "US") == "US"
                  and t["pop"] >= T3_ANCHOR_MIN_POP])
    t3, t3_anchor = [], {}
    for t in by_pop:
        if t["pop"] < T3_SAT_MIN_POP:
            break
        if t["geoid"] in hub_geoids:
            continue
        a = min(anchors, key=lambda x: tdist(x, t))
        if tdist(a, t) <= T3_RADIUS_MI:
            t3.append(t)
            t3_anchor[t["geoid"]] = a["geoid"]
    print(f"tier 3: {len(t3)} metro nodes around {len(anchors)} anchors", file=sys.stderr)

    # ---- assemble nodes ----------------------------------------------------
    nodes, node_by_geoid = [], {}
    for tier, group in ((1, t1), (2, t2), (3, t3)):
        for t in group:
            n = {"id": f"n{len(nodes)+1}", "name": t["name"], "tier": tier,
                 "lat": round(t["lat"], 5), "lng": round(t["lng"], 5),
                 "parent": None, "geoid": t["geoid"], "pop": t["pop"], "st": t["st"],
                 "sqmi": t["sqmi"], "country": t.get("country", "US")}
            nodes.append(n)
            node_by_geoid[t["geoid"]] = n

    # ---- edges -------------------------------------------------------------
    edges = []
    def add_edge(a, b, tier):
        edges.append({"id": f"e{len(edges)+1}", "from": a["id"], "to": b["id"], "tier": tier})

    t1n = [node_by_geoid[t["geoid"]] for t in t1]
    seen = set()
    for i, j in mst_edges(t1n):
        a, b = t1n[i], t1n[j]
        d = tdist(a, b)
        if d > ISLAND_LINK_MI:
            # transoceanic link: land it at the biggest hub within 10% of the
            # shortest crossing (San Francisco over Santa Rosa, etc.)
            island = a if min(tdist(a, c) for c in t1n if c is not a) > ISLAND_LINK_MI else b
            other = b if island is a else a
            cands = [c for c in t1n if c is not island and tdist(island, c) <= 1.1 * d]
            best = max(cands, key=lambda c: c["pop"] or 0) if cands else other
            a, b = island, best
        k = frozenset((a["id"], b["id"]))
        if k in seen:
            continue
        seen.add(k)
        add_edge(a, b, 1)
    for a in t1n:                                   # kNN augmentation
        near = sorted((b for b in t1n if b is not a), key=lambda b: tdist(a, b))[:T1_KNN]
        if near and tdist(a, near[0]) > ISLAND_LINK_MI:
            continue                                 # island hub: one MST link only
        for b in near:
            k = frozenset((a["id"], b["id"]))
            if k not in seen:
                seen.add(k)
                add_edge(a, b, 1)
    t1_edges = len(edges)

    # tier-2 chain: connect each t2 (closest-to-spine first) to the nearest
    # already-connected tier-1/2 node
    t2n = [node_by_geoid[t["geoid"]] for t in t2]
    t1_grid = Grid(t1n)
    order = sorted(t2n, key=lambda n: t1_grid.nearest(n["lat"], n["lng"])[1])
    conn_grid = Grid(t1n)
    conn_list = list(t1n)
    for n in order:
        host, d = conn_grid.nearest(n["lat"], n["lng"])
        if d > ISLAND_LINK_MI:
            # transoceanic link: land at the biggest hub within 15% of the
            # shortest crossing to a REAL hub (pop >= 50k) — anchoring the
            # window on whatever tiny waypoint happens to be nearest (an
            # Aleutian village) could exclude the major hub entirely
            d_ref = min((tdist(n, c) for c in conn_list if (c["pop"] or 0) >= 50_000),
                        default=d)
            cands = [c for c in conn_list if tdist(n, c) <= 1.15 * max(d, d_ref)]
            if cands:
                host = max(cands, key=lambda c: c["pop"] or 0)
        add_edge(host, n, 2)
        n["parent"] = host["id"]
        conn_grid.add(n)
        conn_list.append(n)

    # ---- tier 3 urban core: radial in-city metro around big hubs -----------
    # L radial lines (by pop) with S chained stops each, land-aware placement;
    # a circle line only where there are enough lines to read as one (>= 8).
    core_count = wet_shrunk = wet_dropped = 0
    core_by_hub = defaultdict(list)
    for h in [n for n in nodes if n["tier"] <= 2 and (n["pop"] or 0) >= CORE_MIN_POP
              and n.get("country", "US") == "US"]:
        r_city = math.sqrt(h["sqmi"] / math.pi) if h.get("sqmi") else 3.0
        radius = min(CORE_R_MAX_MI, max(CORE_R_MIN_MI, CORE_R_FRAC * r_city))
        n_lines = min(10, max(4, 3 + round(h["pop"] / 200_000)))
        n_stops = min(4, max(2, 2 + (h["pop"] or 0) // 400_000))
        rot = (int(h["geoid"]) % 997) / 997 * (360.0 / n_lines)   # per-city star rotation
        inner_ring = []
        for i in range(n_lines):
            brg = (rot + 360.0 * i / n_lines) % 360.0
            label = COMPASS[round(brg / 22.5) % 16]
            prev, survivors = h, []
            for j in range(1, n_stops + 1):
                r_j = radius * j / n_stops
                placed = None
                for f in CORE_SHRINKS:
                    r_try = r_j * f
                    lat = h["lat"] + (r_try / 69.172) * math.cos(math.radians(brg))
                    lng = h["lng"] + (r_try / (69.172 * math.cos(math.radians(h["lat"])))) * math.sin(math.radians(brg))
                    if on_dry_land(lat, lng):
                        placed = (round(lat, 5), round(lng, 5))
                        if f < 1.0:
                            wet_shrunk += 1
                        break
                if placed is None:
                    wet_dropped += 1
                    continue
                # skip stops that shrank onto the predecessor, the hub, or a
                # sibling station
                too_close = hav(placed[0], placed[1], prev["lat"], prev["lng"]) < 0.5 if survivors else False
                if not too_close:
                    for other in [h] + core_by_hub[h["id"]]:
                        if hav(placed[0], placed[1], other["lat"], other["lng"]) < 0.6:
                            too_close = True
                            break
                if too_close:
                    wet_dropped += 1
                    continue
                n = {"id": f"n{len(nodes)+1}",
                     "name": f'{h["name"]} Metro {label} {len(survivors) + 1}',
                     "tier": 3, "lat": placed[0], "lng": placed[1],
                     "parent": h["id"], "geoid": None, "pop": None, "sqmi": 0}
                nodes.append(n)
                core_count += 1
                core_by_hub[h["id"]].append(n)
                add_edge(prev, n, 3)                 # chain outward along the line
                survivors.append(n)
                prev = n
            if survivors:
                inner_ring.append(survivors[len(survivors) // 2])   # mid-line stop
        # a circle line only where it actually reads as a circle
        if n_lines >= 8 and len(inner_ring) >= 8:
            for i in range(len(inner_ring)):
                add_edge(inner_ring[i], inner_ring[(i + 1) % len(inner_ring)], 3)
    print(f"tier 3: +{core_count} urban-core metro stations "
          f"({wet_shrunk} pulled inland off water, {wet_dropped} dropped)", file=sys.stderr)

    # satellites join the metro at their nearest station (line extensions),
    # not by beelining to the hub center
    for t in t3:
        n = node_by_geoid[t["geoid"]]
        a = node_by_geoid[t3_anchor[t["geoid"]]]
        target = min(core_by_hub.get(a["id"], []) + [a], key=lambda s: tdist(s, n))
        add_edge(target, n, 3)
        n["parent"] = a["id"]

    # ---- stats + write ------------------------------------------------------
    def route_mi(tier):
        tot = 0.0
        nid = {n["id"]: n for n in nodes}
        for e in edges:
            if e["tier"] == tier:
                tot += tdist(nid[e["from"]], nid[e["to"]])
        return round(tot)

    tier4_towns = sum(1 for t in towns if t["geoid"] not in node_by_geoid)
    print(f"tier 4: {tier4_towns:,} town nodes plotted (connections deferred — "
          f"nodes first, lines later)", file=sys.stderr)

    rev = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stats = {
        "tier1Hubs": len(t1), "tier1CA": len(ca_t1), "tier1MX": len(mx_t1),
        "tier2Hubs": len(t2), "tier2CA": ca_t2,
        "tier3Sat": len(t3), "tier3Core": core_count, "tier3Nodes": len(t3) + core_count,
        "tier1Edges": t1_edges, "edges": len(edges),
        "tier1Mi": route_mi(1), "tier2Mi": route_mi(2), "tier3Mi": route_mi(3),
        "tier4Towns": tier4_towns,
    }
    params = {"T1_MIN_POP": T1_MIN_POP, "T1_SPACING_MI": T1_SPACING_MI, "T1_KNN": T1_KNN,
              "T2_MIN_POP": T2_MIN_POP, "T2_SPACING_MI": T2_SPACING_MI,
              "COVERAGE_MI": COVERAGE_MI, "T3_ANCHOR_MIN_POP": T3_ANCHOR_MIN_POP,
              "T3_SAT_MIN_POP": T3_SAT_MIN_POP, "T3_RADIUS_MI": T3_RADIUS_MI,
              "CORE_MIN_POP": CORE_MIN_POP}

    feats = []
    for n in nodes:
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [n["lng"], n["lat"]]},
                      "properties": {"kind": "node", "id": n["id"], "name": n["name"],
                                     "tier": n["tier"], "tierName": TIER_NAME[n["tier"]],
                                     "parent": n["parent"], "geoid": n["geoid"],
                                     "pop": n["pop"], "st": n.get("st"),
                                     "country": n.get("country", "US")}})
    nid = {n["id"]: n for n in nodes}
    for e in edges:
        a, b = nid[e["from"]], nid[e["to"]]
        feats.append({"type": "Feature",
                      "geometry": {"type": "LineString",
                                   "coordinates": [[a["lng"], a["lat"]], [b["lng"], b["lat"]]]},
                      "properties": {"kind": "edge", "id": e["id"], "from": e["from"],
                                     "to": e["to"], "tier": e["tier"],
                                     "tierName": TIER_NAME[e["tier"]]}})
    net = {"type": "FeatureCollection", "name": "US Fantasy Transit Network",
           "properties": {"generator": "scripts/build_network.py",
                          "schema": "fantasy-transit-v1", "rev": rev,
                          "params": params, "stats": stats,
                          "nodeCount": len(nodes), "edgeCount": len(edges)},
           "features": feats}
    with open(OUT_NET, "w") as f:
        json.dump(net, f, separators=(",", ":"))

    print(f"wrote {OUT_NET}  ({os.path.getsize(OUT_NET)/1e6:.2f} MB)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
