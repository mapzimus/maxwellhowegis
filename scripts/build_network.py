#!/usr/bin/env python3
"""Auto-generate the full four-tier fantasy transit network from the towns layer.

Input:  transit/data/towns.geojson  (19,465 Census incorporated places with pop —
        built by scripts/build_towns.py)
Output: transit/data/network.json         — editable network: tier 1-3 nodes + edges
        transit/data/tier4_links.geojson  — the "every town" commuter web: one
                                            LineString from each remaining town to
                                            its nearest network node (render-only)

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
  Tier 4 (commuter web)  Every town not already in the network gets a link to its
                         nearest network node.

    python3 scripts/build_network.py

Deterministic given towns.geojson; tweak the constants below and re-run.
"""
import json, math, os, sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS = os.path.join(ROOT, "transit", "data", "towns.geojson")
OUT_NET = os.path.join(ROOT, "transit", "data", "network.json")
OUT_WEB = os.path.join(ROOT, "transit", "data", "tier4_links.geojson")

T1_MIN_POP = 300_000
T1_SPACING_MI = 70
T1_KNN = 2                 # extra nearest-neighbor edges per hub on top of the MST
T2_MIN_POP = 40_000
T2_SPACING_MI = 45
T2_BIG_POP = 100_000       # cities this big become hubs even inside the spacing
                           # radius, as long as they're outside a hub's metro
                           # (T3_RADIUS_MI) — catches Fort Worth, Baltimore, Mesa…
COVERAGE_MI = 90           # every town ends up within this of a tier-1/2 hub
T3_ANCHOR_MIN_POP = 100_000
T3_SAT_MIN_POP = 15_000
T3_RADIUS_MI = 18

TIER_NAME = {1: "HSR Hub", 2: "Regional Hub", 3: "Metro / Subway", 4: "Commuter Rail"}


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
        return (math.floor(lat), math.floor(lng))

    def add(self, it):
        self.cells[self.key(it["lat"], it["lng"])].append(it)

    def _ring(self, base, r):
        by, bx = base
        if r == 0:
            yield base
            return
        for x in range(bx - r, bx + r + 1):
            yield (by - r, x)
            yield (by + r, x)
        for y in range(by - r + 1, by + r):
            yield (y, bx - r)
            yield (y, bx + r)

    def nearest(self, lat, lng):
        base = self.key(lat, lng)
        best, bd = None, float("inf")
        for r in range(0, 400):
            if bd <= (r - 1) * self.CELL_MIN_MI:
                break
            for cell in self._ring(base, r):
                for it in self.cells.get(cell, ()):
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
        "lng": f["geometry"]["coordinates"][0], "lat": f["geometry"]["coordinates"][1],
    } for f in gj["features"]]
    by_pop = sorted(towns, key=lambda t: -t["pop"])

    # ---- tier 1 ----------------------------------------------------------
    t1 = greedy_spacing([t for t in by_pop if t["pop"] >= T1_MIN_POP], T1_SPACING_MI, [])
    print(f"tier 1: {len(t1)} HSR hubs", file=sys.stderr)

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

    # ---- tier 3 satellites ------------------------------------------------
    anchors = t1 + [t for t in t2 if t["pop"] >= T3_ANCHOR_MIN_POP]
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
                 "parent": None, "geoid": t["geoid"], "pop": t["pop"], "st": t["st"]}
            nodes.append(n)
            node_by_geoid[t["geoid"]] = n

    # ---- edges -------------------------------------------------------------
    edges = []
    def add_edge(a, b, tier):
        edges.append({"id": f"e{len(edges)+1}", "from": a["id"], "to": b["id"], "tier": tier})

    t1n = [node_by_geoid[t["geoid"]] for t in t1]
    seen = set()
    for i, j in mst_edges(t1n):
        seen.add(frozenset((t1n[i]["id"], t1n[j]["id"])))
        add_edge(t1n[i], t1n[j], 1)
    for a in t1n:                                   # kNN augmentation
        near = sorted((b for b in t1n if b is not a), key=lambda b: tdist(a, b))[:T1_KNN]
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
    for n in order:
        host, _ = conn_grid.nearest(n["lat"], n["lng"])
        add_edge(host, n, 2)
        n["parent"] = host["id"]
        conn_grid.add(n)

    for t in t3:
        n = node_by_geoid[t["geoid"]]
        a = node_by_geoid[t3_anchor[t["geoid"]]]
        add_edge(a, n, 3)
        n["parent"] = a["id"]

    # ---- tier 4 web ---------------------------------------------------------
    net_grid = Grid(nodes)
    web, web_mi, web_max = [], 0.0, 0.0
    for t in towns:
        if t["geoid"] in node_by_geoid:
            continue
        host, d = net_grid.nearest(t["lat"], t["lng"])
        web_mi += d
        web_max = max(web_max, d)
        web.append({
            "type": "Feature",
            "geometry": {"type": "LineString",
                         "coordinates": [[round(t["lng"], 5), round(t["lat"], 5)],
                                         [host["lng"], host["lat"]]]},
            "properties": {"from": t["geoid"], "to": host["id"], "mi": round(d, 1)},
        })

    # ---- stats + write ------------------------------------------------------
    def route_mi(tier):
        tot = 0.0
        nid = {n["id"]: n for n in nodes}
        for e in edges:
            if e["tier"] == tier:
                tot += tdist(nid[e["from"]], nid[e["to"]])
        return round(tot)

    rev = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stats = {
        "tier1Hubs": len(t1), "tier2Hubs": len(t2), "tier3Nodes": len(t3),
        "tier1Edges": t1_edges, "edges": len(edges),
        "tier1Mi": route_mi(1), "tier2Mi": route_mi(2), "tier3Mi": route_mi(3),
        "tier4Links": len(web), "tier4Mi": round(web_mi),
        "tier4MeanMi": round(web_mi / max(len(web), 1), 1), "tier4MaxMi": round(web_max, 1),
    }
    params = {"T1_MIN_POP": T1_MIN_POP, "T1_SPACING_MI": T1_SPACING_MI, "T1_KNN": T1_KNN,
              "T2_MIN_POP": T2_MIN_POP, "T2_SPACING_MI": T2_SPACING_MI,
              "COVERAGE_MI": COVERAGE_MI, "T3_ANCHOR_MIN_POP": T3_ANCHOR_MIN_POP,
              "T3_SAT_MIN_POP": T3_SAT_MIN_POP, "T3_RADIUS_MI": T3_RADIUS_MI}

    feats = []
    for n in nodes:
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [n["lng"], n["lat"]]},
                      "properties": {"kind": "node", "id": n["id"], "name": n["name"],
                                     "tier": n["tier"], "tierName": TIER_NAME[n["tier"]],
                                     "parent": n["parent"], "geoid": n["geoid"],
                                     "pop": n["pop"]}})
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

    webfc = {"type": "FeatureCollection", "name": "US Fantasy Transit — Tier 4 Commuter Web",
             "properties": {"generator": "scripts/build_network.py",
                            "schema": "fantasy-transit-web-v1", "rev": rev,
                            "count": len(web), "totalMi": round(web_mi),
                            "meanMi": stats["tier4MeanMi"], "maxMi": stats["tier4MaxMi"]},
             "features": web}
    with open(OUT_WEB, "w") as f:
        json.dump(webfc, f, separators=(",", ":"))

    print(f"wrote {OUT_NET}  ({os.path.getsize(OUT_NET)/1e6:.2f} MB)")
    print(f"wrote {OUT_WEB}  ({os.path.getsize(OUT_WEB)/1e6:.2f} MB)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
