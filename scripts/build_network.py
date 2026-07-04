#!/usr/bin/env python3
"""Auto-generate the full four-tier fantasy transit network from the towns layer.

Input:  transit/data/towns.geojson  (every US Census town with pop —
        built by scripts/build_towns.py)
Output: transit/data/network.json — the network: tier 1-3 nodes + edges
        transit/data/tier4_links.geojson — the tier-4 commuter web
        (tier-4 town nodes render straight from data/towns.geojson)

Algorithm (all straight-line/great-circle, stdlib only):

  Tier 1 (HSR hubs)      Cities with pop >= T1_MIN_POP, greedy-picked in population
                         order with a T1_SPACING_MI exclusion radius (a hard
                         invariant — no exceptions, even at the Mexican border).
                         Connected by a GABRIEL GRAPH (edge survives if no third
                         hub sits in the circle with the edge as diameter) —
                         connected by construction and ~4 links per hub, so hub
                         groups triangulate instead of chaining. Island hubs keep
                         a single transoceanic link to the biggest mainland hub
                         within 15% of the shortest crossing.
  Tier 2 (regional)      Cities with pop >= T2_MIN_POP, spaced T2_SPACING_MI from
                         all chosen hubs — plus any T2_BIG_POP (100k+) city outside
                         a hub's metro radius (Fort Worth, Baltimore, Mesa…). Then
                         COVERAGE FILL: while any town is farther than COVERAGE_MI
                         from a tier-1/2 hub, promote the most populous uncovered
                         town — guaranteeing every town in the country has a hub
                         within COVERAGE_MI. Connected by an RNG mesh over all
                         tier-1/2 hubs (same lens rule as tier 4), water-tested,
                         dead-ends patched to degree >= 2, island clusters bridged
                         by a single sea link.
  Tier 2b (promoted)     Important cities the spacing rules miss — Salem MA,
                         Concord NH, Nashua NH, Portsmouth NH: pop >= T2B_MIN_POP
                         anywhere, or >= T2B_FAR_MIN_POP when T2B_FAR_MI+ from an
                         HSR hub. Full tier-2 promotion, tagged sub='2b' and
                         drawn lighter; they join the tier-2 RNG mesh like any
                         hub and anchor their own metros when >= 35k.
  Tier 3 (metro/subway)  Gap-driven organic systems (US only; anchors = hubs
                         >= T3_ANCHOR_MIN_POP; stranded 35k+ towns anchor
                         standalone local systems and stay in the tier-4 web).
                         Satellites >= T3_SAT_MIN_POP join the nearest system
                         whose pop-scaled capture radius reaches them over a
                         DRY path (dry_sat — bay-locked towns stay tier 4).
                         A density-scaled jittered land-aware hex grid of infill
                         stations covers each seed city, thinned by a gap test
                         (no station where a town, hub, or earlier station
                         already is). Stations chain into a principal-axis
                         through-line (small systems), balanced bearing sectors
                         (big ones), plus an orbital ring at >= T3_RING_MIN
                         lines.
  Tier 4 (commuter web)  Every remaining town is a node (rendered from
                         data/towns.geojson). Connections are a RELATIVE
                         NEIGHBORHOOD GRAPH over towns + US tier-1/2 hubs +
                         metro satellites: an edge survives only if no third
                         point is closer to both endpoints than they are to
                         each other. RNG ⊇ MST and ⊆ Delaunay, so the web is
                         planar corridors with interior degree 2-4 and no
                         crossings. Edges are densely water-sampled, isolated
                         clusters bridge back over dry hops, and dead-ends get
                         a second link only where one diverges >= 45° — every
                         town connects to >= 2 neighbors except islands/edges.
                         Written to data/tier4_links.geojson.

  Water testing          Every tier's links are sampled along their length
                         (T1/T2 every ~8 mi with ~12-mi coastal side-probes;
                         T3 satellite links every ~3 mi with ~1.5-mi river
                         forgiveness; T4 every ~6 mi). A sample is dry on US
                         Census state polygons or Natural Earth world land
                         (Canada/Mexico), minus the global lake polygons —
                         so nothing crosses a Great Lake, a bay, or a strait,
                         and island links happen only by design.

    python3 scripts/build_network.py

Build order is points-then-lines: every node of every tier is placed first
(hubs, satellites, infill stations, towns), then lines fill in tier by tier
1 -> 4, each pass seeing the complete point field.

Deterministic given towns.geojson; tweak the constants below and re-run.
"""
import json, math, os, sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOWNS = os.path.join(ROOT, "transit", "data", "towns.geojson")
OUT_NET = os.path.join(ROOT, "transit", "data", "network.json")
OUT_T4 = os.path.join(ROOT, "transit", "data", "tier4_links.geojson")

T1_MIN_POP = 175_000
T1_SPACING_MI = 60
T2_MIN_POP = 25_000
T2_SPACING_MI = 30
T2_KNN = 12                # candidate neighbors per hub for the tier-2 RNG
T2_MAX_LINK_MI = 300       # no single tier-2 hop longer than this (bridges except)
T2_BIG_POP = 100_000       # cities this big become hubs even inside the spacing
                           # radius, as long as they're outside a hub's core
                           # (T2_BIG_EXCL_MI) — catches Fort Worth, Baltimore, Mesa…
T2_BIG_EXCL_MI = 18
COVERAGE_MI = 60           # every town ends up within this of a tier-1/2 hub

# tier 2b: important cities the spacing rules miss — the Salems, Concords,
# Nashuas, Portsmouths. Full promotion into tier 2 (tagged sub='2b' and drawn
# lighter): 40k+ anywhere, or 20k+ when >= T2B_FAR_MI from an HSR hub. A small
# mutual spacing keeps inner-core satellites (Somerville, Beverly) inside
# their parent metro instead of splintering it.
T2B_MIN_POP = 40_000
T2B_FAR_MIN_POP = 20_000
T2B_FAR_MI = 40
T2B_SPACING_MI = 3.5       # Salem MA sits 3.67 mi from Lynn — keep it in

# international extent: Canada gets tier-1/2 hubs (nothing more local), a few
# northern Mexican metros join tier 1, and island hubs (Honolulu, San Juan)
# keep a single mainland HSR link instead of the usual kNN redundancy
MX_T1_MIN_POP = 400_000
MX_LAT_MIN = 25.0
MX_T1_MAX = 8
ISLAND_LINK_MI = 1_000     # hubs whose nearest neighbor is farther get MST only

# tier-3 metros: gap-driven urban systems (US only). Anchors are tier-1/2 hubs
# with pop >= T3_ANCHOR_MIN_POP; 35k+ towns stranded outside every capture
# radius anchor a standalone local system instead (and stay in the tier-4 web
# so they keep a through-connection). Big towns reach farther to join a system
# (T3_REACH), and joining requires a DRY overland path (dry_sat) so bay-locked
# towns never wire across open water. Infill stations fill a land-aware,
# density-scaled, jittered hex grid over each seed city, thinned by a gap
# test — a station only goes where no real town, hub, or already-placed
# station provides coverage (Manhattan packs tight, sprawl spreads out).
T3_ANCHOR_MIN_POP = 35_000
T3_SAT_MIN_POP = 10_000
T3_CAPTURE = ((2_000_000, 22), (1_000_000, 20), (500_000, 16),
              (250_000, 14), (100_000, 12), (0, 8))    # (anchor pop floor, mi)
T3_REACH = ((100_000, 18), (35_000, 12), (0, 0))       # (town pop floor, mi)
T3_GAP_MI = 1.3            # max gap-test distance; scales down with grid spacing
T3_CORE_FRAC = 0.8         # infill field radius as fraction of city land radius
T3_CORE_MIN_MI = 1.2
T3_CORE_MAX_MI = 13.0      # + 1 mi per 1M pop bonus — a one-point NYC still
                           # reaches the Bronx; gap/wet tests trim any overshoot
T3_GRID_MIN_MI = 0.75      # infill grid spacing: density-scaled, NYC-core tight...
T3_GRID_MAX_MI = 2.6       # ...to exurban sprawl wide
T3_SEED_MIN_POP = 35_000   # satellites this big grow their own infill field
T3_SEED_CAP = 300          # max infill per seed (pop / 25k, clamped to 4..this)
T3_STOPS_PER_LINE = 5      # target stations per line -> line count
T3_MAX_LINES = 20
T3_RING_MIN = 8            # sector lines needed before an orbital ring appears

# tier-4 commuter web: a relative neighborhood graph over the remaining towns
# plus the US tier-1/2 hubs. Every town should end up with >= 2 links; only
# islands and edge-of-nowhere towns are allowed to dangle.
T4_KNN = 12                # candidate neighbors per point for the RNG lens test
T4_MAX_LINK_MI = 60        # no single commuter hop longer than this
T4_WATER_TEST_MI = 12      # edges longer than this get midpoint land tests
T4_BRIDGE_MI = 90          # max dry hop when reconnecting isolated clusters
T4_PATCH_MIN_DEG = 45      # a patched 2nd link must diverge this much from the
                           # 1st — peninsula dead-ends end cleanly, no slivers
COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
           "S","SSW","SW","WSW","W","WNW","NW","NNW"]

LAND_SOURCES = [
    ("cb_2023_us_state_500k.zip",
     "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip"),
    ("ne_10m_lakes.zip",
     "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip"),
    ("ne_10m_lakes_north_america.zip",
     "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes_north_america.zip"),
    ("ne_50m_land.zip",                     # world land — Canada/Mexico dryness
     "https://naciscdn.org/naturalearth/50m/physical/ne_50m_land.zip"),
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


def _land():
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
    return _LAND


def in_lake(lat, lng):
    """Lake polygons are global (Natural Earth) — valid in Canada/Mexico too,
    unlike the US-only state polygons behind on_dry_land."""
    _states, lakes, lakes_na, _world = _land()
    return _in_polys(lakes, lat, lng) or _in_polys(lakes_na, lat, lng)


_NE_MEMO = {}


def in_ne_land(lat, lng):
    """World land test (Natural Earth 50m) — covers Canada/Mexico, where the
    Census state polygons can't see. Memoized: the big continent rings make
    each raw test ~ms-scale, and edge sampling revisits the same coast."""
    key = (round(lat, 2), round(lng, 2))
    hit = _NE_MEMO.get(key)
    if hit is None:
        _states, _lakes, _lakes_na, world = _land()
        hit = _NE_MEMO[key] = _in_polys(world, lat, lng)
    return hit


def on_dry_land(lat, lng):
    states, lakes, lakes_na, _world = _land()
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


def _dry_point(lat, lng):
    """Land is land, whatever the country: US Census state polygons first
    (fine-grained, fast), then Natural Earth world land for Canada/Mexico —
    minus the global lake polygons either way."""
    if in_lake(lat, lng):
        return False
    return on_dry_land(lat, lng) or in_ne_land(lat, lng)


def dry_mid(a, b, skip_mi):
    """Dense land test for hub-to-hub links: interior samples every ~8 mi
    (a lake can't hide between test points), each probed at the point itself
    and nudged ~12 mi to either side, so a line hugging a coastline
    (Los Angeles-San Diego, Chicago-Milwaukee) counts as dry while a true
    lake/ocean/strait crossing stays wet on all probes. Short hops
    (<= skip_mi) pass untested — those are bridges."""
    d = tdist(a, b)
    if d <= skip_mi:
        return True
    dlng = (b["lng"] - a["lng"] + 180) % 360 - 180
    # unit perpendicular to the segment, in degrees spanning ~12 mi
    coslat = math.cos(math.radians((a["lat"] + b["lat"]) / 2))
    dy, dx = b["lat"] - a["lat"], dlng * coslat
    norm = math.hypot(dx, dy) or 1.0
    plat, plng = (-dx / norm) * (12 / 69.172), (dy / norm) * (12 / 69.172) / max(coslat, 0.2)
    n = max(1, int(d / 8))
    for k in range(1, n + 1):
        f = k / (n + 1)
        lat = a["lat"] + (b["lat"] - a["lat"]) * f
        lng = (a["lng"] + dlng * f + 180) % 360 - 180
        for nlat, nlng in ((lat, lng), (lat + plat, lng + plng), (lat - plat, lng - plng)):
            if _dry_point(nlat, nlng):
                break                                # this sample found dry land
        else:
            return False                             # wet on all three probes
    return True


def dry_sat(a, b):
    """Strict land test for a metro-satellite link (<= 18 mi, both US):
    samples every ~3 mi with only ~1.5-mi side nudges — wide enough to
    forgive a river (the Mississippi), far too narrow to forgive a bay
    (San Francisco Bay, Puget Sound, Mobile Bay)."""
    d = tdist(a, b)
    if d <= 2:
        return True
    dlng = (b["lng"] - a["lng"] + 180) % 360 - 180
    coslat = math.cos(math.radians((a["lat"] + b["lat"]) / 2))
    dy, dx = b["lat"] - a["lat"], dlng * coslat
    norm = math.hypot(dx, dy) or 1.0
    plat, plng = (-dx / norm) * (1.5 / 69.172), (dy / norm) * (1.5 / 69.172) / max(coslat, 0.2)
    n = max(1, int(d / 3))
    for k in range(1, n + 1):
        f = k / (n + 1)
        lat = a["lat"] + (b["lat"] - a["lat"]) * f
        lng = a["lng"] + dlng * f
        for nlat, nlng in ((lat, lng), (lat + plat, lng + plng), (lat - plat, lng - plng)):
            if on_dry_land(nlat, nlng):
                break
        else:
            return False
    return True


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


def hex_pts(r_mi, s_mi):
    """Offset-grid points (dx, dy in planar miles) covering a disc of radius
    r_mi at spacing s_mi, sorted innermost-first."""
    pts, row = [], 0
    y = -r_mi
    while y <= r_mi:
        x = -r_mi + (s_mi / 2 if row % 2 else 0.0)
        while x <= r_mi:
            if x * x + y * y <= r_mi * r_mi:
                pts.append((x, y))
            x += s_mi
        y += s_mi * 0.866
        row += 1
    pts.sort(key=lambda p: p[0] ** 2 + p[1] ** 2)
    return pts


def pca_axis(pts):
    """Unit vector of the principal axis of (x, y) points — the direction the
    cloud is longest in. Falls back to east-west for degenerate clouds."""
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - mx) ** 2 for p in pts)
    syy = sum((p[1] - my) ** 2 for p in pts)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    if abs(sxy) < 1e-9:
        return (1.0, 0.0) if sxx >= syy else (0.0, 1.0)
    lam = (sxx + syy) / 2 + math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2)
    vx, vy = sxy, lam - sxx
    norm = math.hypot(vx, vy)
    return vx / norm, vy / norm


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
    # Mexican metros space against the full hub set — T1_SPACING_MI is a hard
    # invariant with no exceptions, so border twins (Tijuana/San Diego,
    # Juárez/El Paso, Matamoros/Brownsville) collapse into their US hub
    mx_t1 = greedy_spacing(
        [c for c in intl_mx if c["pop"] >= MX_T1_MIN_POP and c["lat"] >= MX_LAT_MIN],
        T1_SPACING_MI, t1 + ca_t1)[:MX_T1_MAX]
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
        if d >= T2_SPACING_MI or (c["pop"] >= T2_BIG_POP and d > T2_BIG_EXCL_MI):
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

    # ---- tier 2b: important cities the spacing rules missed ----------------
    t1_us_grid = Grid([t for t in t1 if t.get("country", "US") == "US"])
    t2b = 0
    for c in by_pop:
        if c["pop"] < T2B_FAR_MIN_POP:
            break
        if c["geoid"] in hub_geoids:
            continue
        _, d_hub = hub_grid.nearest(c["lat"], c["lng"])
        if d_hub < T2B_SPACING_MI:
            continue
        _, d_t1 = t1_us_grid.nearest(c["lat"], c["lng"])
        if c["pop"] >= T2B_MIN_POP or d_t1 >= T2B_FAR_MI:
            c["sub"] = "2b"
            t2.append(c)
            hub_geoids.add(c["geoid"])
            hub_grid.add(c)
            t2b += 1
    print(f"tier 2b: +{t2b} promoted cities (pop >= {T2B_MIN_POP:,}, or "
          f">= {T2B_FAR_MIN_POP:,} beyond {T2B_FAR_MI} mi of HSR)", file=sys.stderr)

    # ---- tier 3 systems: anchors, orphan anchors, satellites ---------------
    # (US only — Canada/Mexico stop at tier 2.) A town is covered by an anchor
    # when their distance is within max(anchor capture radius, town reach) AND
    # a dry overland path exists (dry_sat) — pure nearest-distance wired
    # Redwood City into Hayward straight across San Francisco Bay. 35k+ towns
    # no anchor covers become standalone local-system anchors themselves
    # (biggest first, so a stranded city absorbs its smaller stranded
    # neighbors); bay-locked smaller towns stay tier 4 (the ferry commute).
    def capture_mi(pop):
        return next(r for floor, r in T3_CAPTURE if pop >= floor)

    def reach_mi(pop):
        return next(r for floor, r in T3_REACH if pop >= floor)

    anchors = [t for t in t1 + t2
               if t.get("country", "US") == "US" and t["pop"] >= T3_ANCHOR_MIN_POP]
    anchor_grid = Grid(list(anchors))
    wet_locked = 0

    def covering_anchor(t):
        lim = max(capture_mi(2_000_000), reach_mi(t["pop"]))
        cands = [(tdist(x, t), x) for x in anchor_grid.within(t["lat"], t["lng"], lim)]
        cands = [(d, x) for d, x in cands
                 if d <= max(capture_mi(x["pop"]), reach_mi(t["pop"]))]
        cands.sort(key=lambda z: z[0])
        for d, x in cands:
            if dry_sat(x, t):
                return x
        return None if not cands else "wet"

    orphans = []
    for t in by_pop:
        if t["pop"] < T3_ANCHOR_MIN_POP:
            break
        if t["geoid"] in hub_geoids:
            continue
        if covering_anchor(t) in (None, "wet"):
            orphans.append(t)
            anchor_grid.add(t)
    orphan_geoids = {t["geoid"] for t in orphans}
    systems = {a["geoid"]: {"anchor": a, "sats": []} for a in anchors + orphans}

    t3, t3_anchor = list(orphans), {}
    for t in by_pop:
        if t["pop"] < T3_SAT_MIN_POP:
            break
        if t["geoid"] in hub_geoids or t["geoid"] in orphan_geoids:
            continue
        a = covering_anchor(t)
        if a is None:
            continue
        if a == "wet":
            wet_locked += 1
            continue
        t3.append(t)
        t3_anchor[t["geoid"]] = a["geoid"]
        systems[a["geoid"]]["sats"].append(t)
    print(f"tier 3: {len(systems)} systems ({len(orphans)} standalone), "
          f"{len(t3) - len(orphans)} satellite towns claimed "
          f"({wet_locked} bay-locked towns left to tier 4)", file=sys.stderr)

    # ---- assemble nodes (all points exist before any line is drawn) --------
    nodes, node_by_geoid = [], {}
    for tier, group in ((1, t1), (2, t2), (3, t3)):
        for t in group:
            n = {"id": f"n{len(nodes)+1}", "name": t["name"], "tier": tier,
                 "lat": round(t["lat"], 5), "lng": round(t["lng"], 5),
                 "parent": None, "geoid": t["geoid"], "pop": t["pop"], "st": t["st"],
                 "sqmi": t["sqmi"], "country": t.get("country", "US"),
                 "sub": t.get("sub")}
            nodes.append(n)
            node_by_geoid[t["geoid"]] = n

    # ---- tier 3 station points ---------------------------------------------
    # Infill placement per system, biggest anchor first: a land-aware jittered
    # hex grid covers each seed city (the anchor plus its 35k+ satellites),
    # thinned by the gap test — stations only go where no real town, hub, or
    # already-placed station provides coverage. Names come from each station's
    # bearing off its anchor; lines are drawn later, tier by tier.
    station_grid = Grid([])
    core_count = wet_dropped = gap_dropped = 0
    sys_list = sorted(systems.values(), key=lambda s: -s["anchor"]["pop"])
    for s in sys_list:
        a = s["anchor"]
        a_node = node_by_geoid[a["geoid"]]
        coslat_a = math.cos(math.radians(a_node["lat"]))
        brg = lambda p: math.degrees(
            math.atan2((p["lng"] - a_node["lng"]) * coslat_a,
                       p["lat"] - a_node["lat"])) % 360.0
        stations = []
        for t in s["sats"]:
            n = node_by_geoid[t["geoid"]]
            n["parent"] = a_node["id"]
            stations.append(n)
        lab_counts = defaultdict(int)
        for seed in [a] + [t for t in s["sats"] if t["pop"] >= T3_SEED_MIN_POP]:
            if not seed["sqmi"]:
                continue
            r_city = math.sqrt(seed["sqmi"] / math.pi)
            r_core = min(T3_CORE_MAX_MI,
                         max(T3_CORE_MIN_MI,
                             T3_CORE_FRAC * r_city + seed["pop"] / 1_000_000))
            dens = seed["pop"] / max(seed["sqmi"], 0.1)
            s_mi = min(T3_GRID_MAX_MI,
                       max(T3_GRID_MIN_MI, 2.6 - 0.55 * math.log(max(dens, 50) / 1000)))
            gap_mi = min(T3_GAP_MI, max(0.45, 0.55 * s_mi))
            cap = min(T3_SEED_CAP, max(4, seed["pop"] // 25_000))
            coslat = math.cos(math.radians(seed["lat"]))
            gseed = int(seed["geoid"]) if seed["geoid"].isdigit() else 0
            placed = 0
            for i, (dx, dy) in enumerate(hex_pts(r_core, s_mi)):
                if placed >= cap:
                    break
                # deterministic jitter so cores don't read as a dot lattice
                h = (i * 2654435761 + gseed) & 0xFFFFFFFF
                dx += (h % 997 / 997 - 0.5) * 0.5 * s_mi
                dy += (h // 997 % 997 / 997 - 0.5) * 0.5 * s_mi
                lat = seed["lat"] + dy / 69.172
                lng = seed["lng"] + dx / (69.172 * coslat)
                if (town_grid.within(lat, lng, gap_mi)
                        or station_grid.within(lat, lng, gap_mi)):
                    gap_dropped += 1
                    continue
                if not on_dry_land(lat, lng):
                    wet_dropped += 1
                    continue
                stn = {"lat": round(lat, 5), "lng": round(lng, 5), "synthetic": True}
                lab = COMPASS[round(brg(stn) / 22.5) % 16]
                lab_counts[lab] += 1
                stn.update({"id": f"n{len(nodes) + 1}",
                            "name": f'{a["name"]} Metro {lab} {lab_counts[lab]}',
                            "tier": 3, "parent": a_node["id"], "geoid": None,
                            "pop": None, "st": a_node.get("st"), "sqmi": 0,
                            "country": "US", "sub": None})
                nodes.append(stn)
                stations.append(stn)
                station_grid.add(stn)
                core_count += 1
                placed += 1
        s["stations"] = stations
    print(f"tier 3: +{core_count} infill stations placed "
          f"({gap_dropped} gap-blocked, {wet_dropped} wet)", file=sys.stderr)

    # ---- edges -------------------------------------------------------------
    edges = []
    def add_edge(a, b, tier):
        edges.append({"id": f"e{len(edges)+1}", "from": a["id"], "to": b["id"], "tier": tier})

    # ---- tier-1 HSR mesh: a GABRIEL GRAPH over the mainland hubs -----------
    # An edge p-q survives if no third hub sits inside the circle with p-q as
    # its diameter. Gabriel ⊇ RNG ⊇ MST — connected by construction, but
    # meshes richer (~4 links per hub) than the old MST+2NN, so regional hub
    # groups (California!) triangulate instead of chaining. Island hubs
    # (Honolulu, Anchorage, San Juan) keep a single transoceanic link to the
    # biggest mainland hub within 15% of the shortest crossing.
    t1n = [node_by_geoid[t["geoid"]] for t in t1]
    n1 = len(t1n)
    D1 = [[0.0] * n1 for _ in range(n1)]
    for i in range(n1):
        for j in range(i + 1, n1):
            D1[i][j] = D1[j][i] = tdist(t1n[i], t1n[j])
    remote1 = {i for i in range(n1)
               if min(D1[i][j] for j in range(n1) if j != i) > ISLAND_LINK_MI}
    mainland1 = [i for i in range(n1) if i not in remote1]

    uf1 = list(range(n1))
    def find1(x):
        while uf1[x] != x:
            uf1[x] = uf1[uf1[x]]
            x = uf1[x]
        return x

    t1_wet = 0
    for a_pos, i in enumerate(mainland1):
        for j in mainland1[a_pos + 1:]:
            d2ij = D1[i][j] * D1[i][j]
            if any(D1[i][k] ** 2 + D1[j][k] ** 2 < d2ij
                   for k in mainland1 if k != i and k != j):
                continue                             # a hub sits in the lens circle
            if not dry_mid(t1n[i], t1n[j], 60):
                t1_wet += 1
                continue
            add_edge(t1n[i], t1n[j], 1)
            uf1[find1(i)] = find1(j)
    # water drops could split the mesh — stitch components back together,
    # preferring the shortest DRY cross link (rare; a pure-Gabriel graph is
    # connected); only if every cross pair is wet does the shortest one win
    while True:
        if len({find1(i) for i in mainland1}) <= 1:
            break
        pairs = sorted((D1[i][j], i, j) for i in mainland1 for j in mainland1
                       if i < j and find1(i) != find1(j))
        d, i, j = next(((d, i, j) for d, i, j in pairs
                        if dry_mid(t1n[i], t1n[j], 60)), pairs[0])
        add_edge(t1n[i], t1n[j], 1)
        uf1[find1(i)] = find1(j)
    for i in sorted(remote1):                        # island links
        d_min = min(D1[i][j] for j in mainland1)
        cands = [j for j in mainland1
                 if D1[i][j] <= 1.15 * d_min and (t1n[j]["pop"] or 0) >= 50_000]
        host = (max(cands, key=lambda j: t1n[j]["pop"] or 0) if cands
                else min(mainland1, key=lambda j: D1[i][j]))
        add_edge(t1n[host], t1n[i], 1)
        uf1[find1(i)] = find1(host)
    t1_edges = len(edges)
    print(f"tier 1: {t1_edges} HSR mesh edges — Gabriel graph over {len(mainland1)} "
          f"mainland hubs ({t1_wet} wet drops) + {len(remote1)} island links",
          file=sys.stderr)

    # ---- tier-2 mesh: an RNG over ALL hubs (tier 1 + 2) ---------------------
    # The same lens rule as the tier-4 commuter web, one level up: every
    # regional hub links to its natural neighbors instead of chaining to a
    # single parent, so the regional layer reads as degree->=2 corridors too.
    # A tier-1 hub between two regionals blocks their direct edge — traffic
    # routes through the spine. Isolated clusters (islands, Alaska bush)
    # bridge back with a single sea link, transoceanic hops re-pointed to
    # the biggest hub within 15% (Guam→Honolulu, not Guam→nearest-village).
    t2n = [node_by_geoid[t["geoid"]] for t in t2]
    pts2 = t1n + t2n
    N2 = len(pts2)
    knn2 = []
    for i in range(N2):
        ranked = sorted((tdist(pts2[i], pts2[j]), j) for j in range(N2) if j != i)
        knn2.append([(d, j) for d, j in ranked[:T2_KNN] if d <= T2_MAX_LINK_MI])

    uf2 = list(range(N2))
    def find2(x):
        while uf2[x] != x:
            uf2[x] = uf2[uf2[x]]
            x = uf2[x]
        return x
    for i in range(1, n1):                # the tier-1 layer is one component
        uf2[find2(0)] = find2(i)

    t2_seen, t2_start, t2_wet = set(), len(edges), 0
    deg2c = defaultdict(int)
    def add_t2(i, j):
        t2_seen.add((i, j) if i < j else (j, i))
        add_edge(pts2[i], pts2[j], 2)
        if pts2[i].get("sub") == "2b" or pts2[j].get("sub") == "2b":
            edges[-1]["sub"] = "2b"              # 2b links render lighter
        uf2[find2(i)] = find2(j)
        deg2c[i] += 1
        deg2c[j] += 1

    for i in range(N2):
        for dij, j in knn2[i]:
            if i < n1 and j < n1:
                continue                             # T1-T1 lives in the HSR mesh
            k = (i, j) if i < j else (j, i)
            if k in t2_seen:
                continue
            blocked = False
            for dir_, r in knn2[i]:                  # sorted: r beyond j can't block
                if dir_ >= dij:
                    break
                if tdist(pts2[r], pts2[j]) < dij:
                    blocked = True
                    break
            if blocked:
                continue
            if not dry_mid(pts2[i], pts2[j], 40):
                t2_wet += 1
                continue
            add_t2(i, j)
    rng2 = len(edges) - t2_start
    # dead-end patching: regionals with < 2 tier-2 links take their
    # next-nearest dry candidate (islands/edges may still dangle)
    patched2 = 0
    for i in range(n1, N2):
        if deg2c[i] >= 2:
            continue
        for dij, j in knn2[i]:
            if deg2c[i] >= 2:
                break
            k = (i, j) if i < j else (j, i)
            if k in t2_seen:
                continue
            if not dry_mid(pts2[i], pts2[j], 40):
                continue
            add_t2(i, j)
            patched2 += 1
    # bridge isolated clusters back to the network (sea links allowed)
    bridges2 = 0
    while True:
        comps2 = defaultdict(list)
        for i in range(N2):
            comps2[find2(i)].append(i)
        if len(comps2) <= 1:
            break
        main2 = find2(0)
        for root, members in sorted(comps2.items(), key=lambda kv: len(kv[1])):
            if root == main2 or find2(members[0]) != root:
                continue
            d, bi, bj = min((tdist(pts2[i], pts2[j]), i, j)
                            for i in members for j in range(N2)
                            if find2(j) != root)
            if d > ISLAND_LINK_MI:
                # transoceanic: window anchored on a REAL hub (pop >= 50k) so
                # a tiny nearest waypoint can't exclude the major hub
                others = [j for j in range(N2) if find2(j) != root]
                d_ref = min((tdist(pts2[bi], pts2[j]) for j in others
                             if (pts2[j]["pop"] or 0) >= 50_000), default=d)
                cands = [j for j in others
                         if tdist(pts2[bi], pts2[j]) <= 1.15 * max(d, d_ref)]
                if cands:
                    bj = max(cands, key=lambda j: pts2[j]["pop"] or 0)
            add_t2(bi, bj)
            bridges2 += 1
    t2_dead = sum(1 for i in range(n1, N2) if deg2c[i] < 2)
    print(f"tier 2: {len(edges) - t2_start} mesh links (RNG {rng2}, +{patched2} "
          f"dead-end patches, +{bridges2} island bridges, {t2_wet} wet drops); "
          f"{t2_dead} regionals below 2 links (islands/edges)", file=sys.stderr)
    t1_grid = Grid(t1n)
    for nn in t2n:                                   # informational hierarchy
        host, _ = t1_grid.nearest(nn["lat"], nn["lng"])
        nn["parent"] = host["id"]

    # ---- tier 3 lines: chain each system's stations --------------------------
    # All points already exist — this pass only draws lines. A principal-axis
    # through-line for small systems, balanced bearing sectors chained outward
    # for big ones, plus an orbital ring once a system has T3_RING_MIN lines.
    # (System membership is dry-gated upstream; in-city hops may cross rivers
    # and harbors the way real subways tunnel under them.)
    sys_built = lines_total = rings_total = 0
    for s in sys_list:
        stations = s["stations"]
        if not stations:
            continue
        sys_built += 1
        a_node = node_by_geoid[s["anchor"]["geoid"]]
        coslat = math.cos(math.radians(a_node["lat"]))
        rel = lambda p: ((p["lng"] - a_node["lng"]) * 69.172 * coslat,
                         (p["lat"] - a_node["lat"]) * 69.172)
        brg = lambda p: math.degrees(math.atan2(*rel(p))) % 360.0
        n_st = len(stations)
        k = max(1, min(T3_MAX_LINES, round(n_st / T3_STOPS_PER_LINE)))
        paths = []
        if k == 1 or n_st <= 7:
            # one through-line down the city's principal axis
            xs = [rel(p) for p in stations]
            ax, ay = pca_axis(xs)
            proj = sorted(((x * ax + y * ay, p) for (x, y), p in zip(xs, stations)),
                          key=lambda z: z[0])
            paths.append([p for t_, p in proj if t_ < 0] + [a_node]
                         + [p for t_, p in proj if t_ >= 0])
        else:
            # contiguous bearing sectors, cut at the largest angular gap and
            # balanced by count; each sector chains outward by distance
            srt = sorted(stations, key=brg)
            bs = [brg(p) for p in srt]
            gaps = [(bs[(i + 1) % n_st] - bs[i]) % 360 for i in range(n_st)]
            start = (gaps.index(max(gaps)) + 1) % n_st
            srt = srt[start:] + srt[:start]
            base, extra = divmod(n_st, k)
            idx = 0
            for li in range(k):
                size = base + (1 if li < extra else 0)
                group = sorted(srt[idx:idx + size], key=lambda p: tdist(a_node, p))
                idx += size
                if group:
                    paths.append([a_node] + group)
        lines_total += len(paths)
        for p in paths:
            for j in range(1, len(p)):
                add_edge(p[j - 1], p[j], 3)

        # orbital ring through each line's mid station, in bearing order
        if len(paths) >= T3_RING_MIN and paths[0][0] is a_node:
            ring = []
            for p in paths:
                sts = p[1:]
                tgt = 0.5 * tdist(a_node, sts[-1])
                ring.append(min(sts, key=lambda x: abs(tdist(a_node, x) - tgt)))
            ring.sort(key=brg)
            for i in range(len(ring)):
                add_edge(ring[i], ring[(i + 1) % len(ring)], 3)
            rings_total += 1
    print(f"tier 3: {sys_built} systems — {lines_total} lines, "
          f"{rings_total} rings", file=sys.stderr)

    # ---- tier 4: the commuter web (relative neighborhood graph) ------------
    # Points: every un-promoted town + the US tier-1/2 hubs (Canada/Mexico stop
    # at tier 2, so no commuter lines cross the border). An edge p-q survives
    # the LENS TEST only if no third point r is closer to both p and q than
    # they are to each other — RNG ⊇ MST and ⊆ Delaunay, i.e. planar-looking
    # corridors where interior towns naturally get 2-4 links. Distances use a
    # local equirectangular metric (exact enough under 100 mi, ~10× faster
    # than haversine). The BLOCKER test is complete for any candidate edge —
    # every point closer than the edge partner ranks above it in the same
    # sorted kNN list — but the candidate set itself is kNN-truncated, so a
    # rare RNG edge whose partner ranks beyond K is omitted (~0.5% of edges
    # in the densest metros; they'd only add redundant short local links).
    t4_pts = [t for t in towns if t["geoid"] not in node_by_geoid]
    hub_pts = [n for n in t1n + t2n if n.get("country", "US") == "US"]
    sat_pts = [node_by_geoid[t["geoid"]] for t in t3]   # metro satellites are
    n_t4 = len(t4_pts)                                  # still towns — commuter
    pts = t4_pts + hub_pts + sat_pts                    # rail passes through them
    N = len(pts)
    lats = [p["lat"] for p in pts]
    lngs = [p["lng"] for p in pts]
    coslats = [math.cos(math.radians(la)) for la in lats]

    def t4_d2(i, j):
        dy = (lats[j] - lats[i]) * 69.172
        dx = ((lngs[j] - lngs[i] + 180) % 360 - 180) * 69.172 * coslats[i]
        return dx * dx + dy * dy

    grid4 = Grid([{"lat": lats[i], "lng": lngs[i], "i": i} for i in range(N)])
    cap2 = float(T4_MAX_LINK_MI) ** 2
    nbrs = []
    for i in range(N):
        for r in (12, 30, T4_MAX_LINK_MI):          # adaptive radius: cheap in
            cands = grid4.within(lats[i], lngs[i], r)   # dense areas, wide in sparse
            if len(cands) > T4_KNN or r == T4_MAX_LINK_MI:
                break
        ranked = sorted((t4_d2(i, c["i"]), c["i"]) for c in cands if c["i"] != i)
        nbrs.append([(d2, j) for d2, j in ranked[:T4_KNN] if d2 <= cap2])

    def dry_link(i, j, d_mi):
        """Dense land test (samples every ~6 mi, ~1.5-mi side nudges to
        forgive rivers) — keeps the web off the Great Lakes and open ocean;
        a lake can no longer hide between two sample points."""
        if d_mi <= T4_WATER_TEST_MI:
            return True
        dlng = (lngs[j] - lngs[i] + 180) % 360 - 180
        coslat = coslats[i]
        dy, dx = lats[j] - lats[i], dlng * coslat
        norm = math.hypot(dx, dy) or 1.0
        plat = (-dx / norm) * (1.5 / 69.172)
        plng = (dy / norm) * (1.5 / 69.172) / max(coslat, 0.2)
        n = max(1, int(d_mi / 6))
        for k in range(1, n + 1):
            f = k / (n + 1)
            lat = lats[i] + (lats[j] - lats[i]) * f
            lng = (lngs[i] + dlng * f + 180) % 360 - 180
            for nlat, nlng in ((lat, lng), (lat + plat, lng + plng), (lat - plat, lng - plng)):
                if on_dry_land(nlat, nlng):
                    break
            else:
                return False
        return True

    parent4 = list(range(N))
    def find4(x):
        while parent4[x] != x:
            parent4[x] = parent4[parent4[x]]
            x = parent4[x]
        return x

    t4_links, t4_seen, wet4 = [], set(), 0
    def add_t4(i, j):
        t4_links.append((i, j))
        t4_seen.add((i, j) if i < j else (j, i))
        parent4[find4(i)] = find4(j)

    for i in range(N):
        for d2ij, j in nbrs[i]:
            k = (i, j) if i < j else (j, i)
            if k in t4_seen:
                continue
            blocked = False
            for d2ir, r in nbrs[i]:                 # sorted: r beyond j can't block
                if d2ir >= d2ij:
                    break
                if t4_d2(r, j) < d2ij:
                    blocked = True
                    break
            if blocked:
                continue
            if not dry_link(i, j, hav(lats[i], lngs[i], lats[j], lngs[j])):
                wet4 += 1
                continue
            add_t4(i, j)
    rng_count = len(t4_links)
    print(f"tier 4: {rng_count:,} RNG edges over {n_t4:,} towns + {len(hub_pts)} hubs "
          f"+ {len(sat_pts)} metro satellites ({wet4} dropped in water)", file=sys.stderr)

    # dead-end patching: towns with < 2 links may take their next-nearest dry
    # candidate — but only one that heads in a genuinely DIFFERENT direction
    # (>= T4_PATCH_MIN_DEG from every existing link). A peninsula town whose
    # only other options run nearly parallel to its one link ends cleanly
    # instead of growing a sliver (hubs/satellites are exempt — they have
    # their own tier's network; towns with no candidates are islands/edges)
    deg4 = defaultdict(int)
    adj4 = defaultdict(list)
    for i, j in t4_links:
        deg4[i] += 1
        deg4[j] += 1
        adj4[i].append(j)
        adj4[j].append(i)

    def bearing4(i, j):
        return math.atan2(lats[j] - lats[i],
                          ((lngs[j] - lngs[i] + 180) % 360 - 180) * coslats[i])

    def diverges(i, j):
        bj = bearing4(i, j)
        for e in adj4[i]:
            a = abs(bj - bearing4(i, e)) % (2 * math.pi)
            if min(a, 2 * math.pi - a) < math.radians(T4_PATCH_MIN_DEG):
                return False
        return True

    patched = 0
    for i in range(n_t4):
        if deg4[i] >= 2:
            continue
        for d2ij, j in nbrs[i]:
            if deg4[i] >= 2:
                break
            k = (i, j) if i < j else (j, i)
            if k in t4_seen:
                continue
            if not diverges(i, j):
                continue
            if not dry_link(i, j, math.sqrt(d2ij)):
                continue
            add_t4(i, j)
            deg4[i] += 1
            deg4[j] += 1
            adj4[i].append(j)
            adj4[j].append(i)
            patched += 1

    # bridge isolated clusters back to the web over the shortest dry hop —
    # per-island webs (Hawaii, Puerto Rico…) stay separate by design, tied to
    # the network through their own tier-1/2 hubs instead
    comps = defaultdict(list)
    for i in range(N):
        comps[find4(i)].append(i)
    main4 = max(comps, key=lambda r: len(comps[r]))
    bridges = 0
    merged = True
    while merged:
        merged = False
        for root, members in sorted(comps.items(), key=lambda kv: len(kv[1])):
            if find4(root) == find4(main4) or find4(members[0]) != root:
                continue
            best = None
            for i in members:
                q, d = grid4.nearest(lats[i], lngs[i],
                                     ok=lambda c: find4(c["i"]) != root)
                if q is not None and (best is None or d < best[0]):
                    best = (d, i, q["i"])
            if best and best[0] <= T4_BRIDGE_MI and dry_link(best[1], best[2], best[0]):
                add_t4(best[1], best[2])
                deg4[best[1]] += 1
                deg4[best[2]] += 1
                bridges += 1
                merged = True
        comps = defaultdict(list)
        for i in range(N):
            comps[find4(i)].append(i)
    dead_ends = sum(1 for i in range(n_t4) if deg4[i] == 1)
    isolated = sum(1 for i in range(n_t4) if deg4[i] == 0)
    deg2pct = 100.0 * sum(1 for i in range(n_t4) if deg4[i] >= 2) / max(1, n_t4)
    t4_mi = round(sum(hav(lats[i], lngs[i], lats[j], lngs[j]) for i, j in t4_links))
    print(f"tier 4: +{patched} dead-end patches, +{bridges} cluster bridges → "
          f"{len(t4_links):,} links, {t4_mi:,} mi; {deg2pct:.1f}% of towns have "
          f">= 2 links ({dead_ends} dead ends, {isolated} isolated — islands/edges)",
          file=sys.stderr)

    # ---- stats + write ------------------------------------------------------
    def route_mi(tier):
        tot = 0.0
        nid = {n["id"]: n for n in nodes}
        for e in edges:
            if e["tier"] == tier:
                tot += tdist(nid[e["from"]], nid[e["to"]])
        return round(tot)

    tier4_towns = n_t4

    rev = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stats = {
        "tier1Hubs": len(t1), "tier1CA": len(ca_t1), "tier1MX": len(mx_t1),
        "tier2Hubs": len(t2), "tier2CA": ca_t2, "tier2bHubs": t2b,
        "tier3Sat": len(t3) - len(orphans), "tier3Core": core_count,
        "tier3Nodes": len(t3) + core_count, "tier3Systems": sys_built,
        "tier3Lines": lines_total, "tier3Rings": rings_total,
        "tier3Standalone": len(orphans),
        "tier1Edges": t1_edges, "edges": len(edges),
        "tier1Mi": route_mi(1), "tier2Mi": route_mi(2), "tier3Mi": route_mi(3),
        "tier4Towns": tier4_towns, "tier4Links": len(t4_links), "tier4Mi": t4_mi,
        "tier4Deg2Pct": round(deg2pct, 1),
        "tier4DeadEnds": dead_ends, "tier4Isolated": isolated,
    }
    params = {"T1_MIN_POP": T1_MIN_POP, "T1_SPACING_MI": T1_SPACING_MI,
              "T2_MIN_POP": T2_MIN_POP, "T2_SPACING_MI": T2_SPACING_MI,
              "T2_KNN": T2_KNN, "T2_MAX_LINK_MI": T2_MAX_LINK_MI,
              "COVERAGE_MI": COVERAGE_MI, "T2B_MIN_POP": T2B_MIN_POP,
              "T2B_FAR_MIN_POP": T2B_FAR_MIN_POP, "T2B_FAR_MI": T2B_FAR_MI,
              "T3_ANCHOR_MIN_POP": T3_ANCHOR_MIN_POP,
              "T3_SAT_MIN_POP": T3_SAT_MIN_POP, "T3_GAP_MI": T3_GAP_MI,
              "T3_STOPS_PER_LINE": T3_STOPS_PER_LINE, "T4_KNN": T4_KNN,
              "T4_MAX_LINK_MI": T4_MAX_LINK_MI, "T4_BRIDGE_MI": T4_BRIDGE_MI}

    feats = []
    for n in nodes:
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [n["lng"], n["lat"]]},
                      "properties": {"kind": "node", "id": n["id"], "name": n["name"],
                                     "tier": n["tier"], "tierName": TIER_NAME[n["tier"]],
                                     "parent": n["parent"], "geoid": n["geoid"],
                                     "pop": n["pop"], "st": n.get("st"),
                                     "country": n.get("country", "US"),
                                     "sub": n.get("sub")}})
    nid = {n["id"]: n for n in nodes}
    for e in edges:
        a, b = nid[e["from"]], nid[e["to"]]
        feats.append({"type": "Feature",
                      "geometry": {"type": "LineString",
                                   "coordinates": [[a["lng"], a["lat"]], [b["lng"], b["lat"]]]},
                      "properties": {"kind": "edge", "id": e["id"], "from": e["from"],
                                     "to": e["to"], "tier": e["tier"],
                                     "tierName": TIER_NAME[e["tier"]],
                                     "sub": e.get("sub")}})
    net = {"type": "FeatureCollection", "name": "US Fantasy Transit Network",
           "properties": {"generator": "scripts/build_network.py",
                          "schema": "fantasy-transit-v1", "rev": rev,
                          "params": params, "stats": stats,
                          "nodeCount": len(nodes), "edgeCount": len(edges)},
           "features": feats}
    with open(OUT_NET, "w") as f:
        json.dump(net, f, separators=(",", ":"))

    t4_feats = [{"type": "Feature",
                 "geometry": {"type": "LineString",
                              "coordinates": [[round(lngs[i], 5), round(lats[i], 5)],
                                              [round(lngs[j], 5), round(lats[j], 5)]]},
                 "properties": {"kind": "edge", "tier": 4}}
                for i, j in t4_links]
    t4_gj = {"type": "FeatureCollection", "name": "Tier-4 commuter web",
             "properties": {"generator": "scripts/build_network.py",
                            "schema": "fantasy-transit-v1", "rev": rev,
                            "count": len(t4_links), "routeMi": t4_mi,
                            "deg2Pct": round(deg2pct, 1)},
             "features": t4_feats}
    with open(OUT_T4, "w") as f:
        json.dump(t4_gj, f, separators=(",", ":"))

    print(f"wrote {OUT_NET}  ({os.path.getsize(OUT_NET)/1e6:.2f} MB)")
    print(f"wrote {OUT_T4}  ({os.path.getsize(OUT_T4)/1e6:.2f} MB)")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
