#!/usr/bin/env python3
# ============================================================
# build_interstate_data.py
# Builds the data for the Sequential Interstate Challenge — an
# Optitrek test case. Drives every two-digit (primary) Interstate
# in the contiguous US end-to-end and compares two strategies:
#
#   Version A — Sequential: locked numerical order; the only
#               freedom is which terminus of the *next* Interstate
#               you start from (orientation). Solved exactly with a
#               2-state DP over orientations.
#   Version B — Optitrek-optimized: free order AND orientation,
#               minimizing the sum of connector miles between
#               traversals. Solved with multi-start nearest-neighbor
#               + 2-opt / Or-opt / orientation-flip local search.
#
# Mainline mileage (~47k mi) is a fixed cost; the objective only
# minimizes connector legs. The headline is the A-vs-B delta.
#
# Pipeline: geocode termini (Nominatim) -> OSRM connector matrix
# (tiled /table, haversine fallback) -> solve A & B -> fetch route
# geometry -> write interstate-challenge/data/*.
#
# Requires: requests. ortools is NOT required (pure-Python solver).
# Run from the repo root:  python3 scripts/build_interstate_data.py
# Network: Nominatim (geocode) + OSRM public demo (routing); both
# results are cached under scripts/.cache/ so re-runs are fast.
# ============================================================
import csv
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "scripts", "interstate_termini.csv")
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUTDIR = os.path.join(ROOT, "interstate-challenge", "data")

NOMINATIM = "https://nominatim.openstreetmap.org/search"
OSRM = "https://router.project-osrm.org"
UA = "maxwellhowegis-interstate-challenge/1.0 (mhowe.gis@gmail.com)"
M_PER_MI = 1609.344
TABLE_TILE = 46  # union of two tiles <= ~92 coords, under the demo's table cap

# Connector metric the solvers minimize: "duration" (drive time) or "distance".
# Distance is still computed and reported either way; only the objective changes.
METRIC = os.environ.get("INTERSTATE_METRIC", "duration").lower()
assert METRIC in ("duration", "distance"), "INTERSTATE_METRIC must be duration|distance"

os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUTDIR, exist_ok=True)


# ----------------------------- small utils -----------------------------
def load_cache(name):
    p = os.path.join(CACHE, name)
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return {}


def save_cache(name, obj):
    with open(os.path.join(CACHE, name), "w") as f:
        json.dump(obj, f)


def http_get(url, tries=4):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (k + 1))
    print(f"   ! request failed ({last}) for {url[:90]}...")
    return None


def haversine_mi(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    R = 3958.7613  # mi
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


# ----------------------------- 1. load seed -----------------------------
def load_edges():
    def end(row, k):
        d = {"name": row[f"{k}_name"], "query": row[f"{k}_query"]}
        lat, lon = row.get(f"{k}_lat", ""), row.get(f"{k}_lon", "")
        if lat.strip() and lon.strip():  # explicit pinned coordinate overrides geocoding
            d["lat"], d["lon"], d["pinned"] = float(lat), float(lon), True
        return d

    edges = []
    with open(SEED, newline="") as f:
        for row in csv.DictReader(f):
            edges.append(
                {
                    "id": int(row["id"]),
                    "number": int(row["number"]),
                    "label": row["label"],
                    "axis": row["axis"],
                    "group": row["group"],
                    "approx_mi": float(row["approx_mi"]),
                    "a": end(row, "a"),
                    "b": end(row, "b"),
                }
            )
    return edges


# ----------------------------- 2. geocode -------------------------------
def geocode_all(edges):
    cache = load_cache("geocode.json")
    n_new = 0
    n_pinned = 0
    for e in edges:
        for end in ("a", "b"):
            if e[end].get("pinned"):  # coordinate pinned in the seed; skip geocoding
                n_pinned += 1
                continue
            q = e[end]["query"]
            if q not in cache:
                params = urllib.parse.urlencode(
                    {"format": "json", "q": q, "limit": 1, "countrycodes": "us"}
                )
                data = http_get(f"{NOMINATIM}?{params}")
                if not data:
                    raise SystemExit(f"geocode failed for {q!r}")
                cache[q] = [float(data[0]["lon"]), float(data[0]["lat"])]
                n_new += 1
                save_cache("geocode.json", cache)
                time.sleep(1.1)  # Nominatim courtesy limit
            e[end]["lon"], e[end]["lat"] = cache[q]
    print(f"   resolved {len(edges) * 2} termini ({n_pinned} pinned, {n_new} geocoded, rest cached)")


# ----------------- 3. connector matrix (OSRM /table) --------------------
def build_matrix(coords):
    """Full NxN driving distance (miles) AND duration (minutes) matrices.
    Tiled OSRM /table; haversine fallback for any cell OSRM can't return."""
    n = len(coords)
    cache = load_cache("connector_matrix.json")
    if cache.get("n") == n and "T" in cache:
        print("   connector matrix (distance + duration) loaded from cache")
        return cache["M"], cache["T"], cache.get("fallbacks", 0)

    M = [[0.0] * n for _ in range(n)]  # miles
    T = [[0.0] * n for _ in range(n)]  # minutes
    fallbacks = 0
    blocks = [list(range(i, min(i + TABLE_TILE, n))) for i in range(0, n, TABLE_TILE)]
    nb = len(blocks)
    print(f"   requesting {nb * nb} table tiles ({nb} blocks of <= {TABLE_TILE})")
    for bi in range(nb):
        for bj in range(nb):
            si, sj = blocks[bi], blocks[bj]
            union = si if bi == bj else si + sj
            pos = {g: k for k, g in enumerate(union)}
            cstr = ";".join(f"{coords[g][0]:.6f},{coords[g][1]:.6f}" for g in union)
            src = ";".join(str(pos[g]) for g in si)
            dst = ";".join(str(pos[g]) for g in sj)
            url = (
                f"{OSRM}/table/v1/driving/{cstr}"
                f"?annotations=distance,duration&sources={src}&destinations={dst}"
            )
            data = http_get(url)
            ok = bool(data) and data.get("code") == "Ok" and "distances" in data
            for a_i, g in enumerate(si):
                for b_i, h in enumerate(sj):
                    dist = dur = None
                    if ok:
                        try:
                            dist = data["distances"][a_i][b_i]
                            dur = data["durations"][a_i][b_i]
                        except (TypeError, IndexError, KeyError):
                            dist = dur = None
                    if dist is None:
                        miles = haversine_mi(coords[g], coords[h]) * 1.2
                        M[g][h] = miles
                        T[g][h] = miles / 60.0 * 60.0  # ~60 mph fallback -> minutes
                        if g != h:
                            fallbacks += 1
                    else:
                        M[g][h] = dist / M_PER_MI
                        T[g][h] = (dur or 0.0) / 60.0
            time.sleep(0.4)
    save_cache("connector_matrix.json", {"n": n, "M": M, "T": T, "fallbacks": fallbacks})
    if fallbacks:
        print(f"   ! {fallbacks} cells used haversine fallback")
    return M, T, fallbacks


# ----------------- 4. Version A: locked-order orientation DP -------------
def solve_version_a(edges_sorted, M):
    """edges_sorted: list of dicts with idxA/idxB (matrix indices).
    state 0 = start at A (exit B); state 1 = start at B (exit A)."""
    n = len(edges_sorted)
    INF = float("inf")
    start = lambda e, s: e["idxA"] if s == 0 else e["idxB"]
    exit_ = lambda e, s: e["idxB"] if s == 0 else e["idxA"]
    dp = [[0.0, 0.0]]
    back = [[-1, -1]]
    for i in range(1, n):
        cur = [INF, INF]
        bk = [-1, -1]
        for s in (0, 1):
            for sp in (0, 1):
                c = dp[i - 1][sp] + M[exit_(edges_sorted[i - 1], sp)][start(edges_sorted[i], s)]
                if c < cur[s]:
                    cur[s] = c
                    bk[s] = sp
        dp.append(cur)
        back.append(bk)
    s_end = 0 if dp[-1][0] <= dp[-1][1] else 1
    states = [0] * n
    states[-1] = s_end
    for i in range(n - 1, 0, -1):
        states[i - 1] = back[i][states[i]]
    seq = [{"edge": edges_sorted[i], "orient": states[i]} for i in range(n)]
    return seq, dp[-1][s_end]


# ----------------- 5. Version B: free order + orientation ---------------
def tour_cost(seq, M):
    start = lambda it: it["edge"]["idxA"] if it["orient"] == 0 else it["edge"]["idxB"]
    exit_ = lambda it: it["edge"]["idxB"] if it["orient"] == 0 else it["edge"]["idxA"]
    return sum(M[exit_(seq[i])][start(seq[i + 1])] for i in range(len(seq) - 1))


def nearest_neighbor(edges, M, start_edge, start_orient):
    used = {start_edge["id"]}
    seq = [{"edge": start_edge, "orient": start_orient}]
    cur_exit = start_edge["idxB"] if start_orient == 0 else start_edge["idxA"]
    while len(seq) < len(edges):
        best = None
        for e in edges:
            if e["id"] in used:
                continue
            for o in (0, 1):
                enter = e["idxA"] if o == 0 else e["idxB"]
                d = M[cur_exit][enter]
                if best is None or d < best[0]:
                    best = (d, e, o)
        _, e, o = best
        seq.append({"edge": e, "orient": o})
        used.add(e["id"])
        cur_exit = e["idxB"] if o == 0 else e["idxA"]
    return seq


def local_search(seq, M):
    """2-opt + Or-opt(1) + orientation flips on the open-path connector cost."""
    improved = True
    n = len(seq)
    while improved:
        improved = False
        base = tour_cost(seq, M)
        # orientation flips
        for i in range(n):
            seq[i]["orient"] ^= 1
            c = tour_cost(seq, M)
            if c + 1e-9 < base:
                base = c
                improved = True
            else:
                seq[i]["orient"] ^= 1
        # 2-opt: reverse [i..j] (also flips orientation of reversed edges)
        for i in range(n - 1):
            for j in range(i + 1, n):
                new = seq[:i] + [
                    {"edge": seq[k]["edge"], "orient": seq[k]["orient"] ^ 1}
                    for k in range(j, i - 1, -1)
                ] + seq[j + 1 :]
                c = tour_cost(new, M)
                if c + 1e-9 < base:
                    seq = new
                    base = c
                    improved = True
        # Or-opt: move a single edge to its best position+orientation
        for i in range(n):
            item = seq[i]
            rest = seq[:i] + seq[i + 1 :]
            best_c, best_seq = base, None
            for p in range(len(rest) + 1):
                for o in (0, 1):
                    cand = rest[:p] + [{"edge": item["edge"], "orient": o}] + rest[p:]
                    c = tour_cost(cand, M)
                    if c + 1e-9 < best_c:
                        best_c, best_seq = c, cand
            if best_seq is not None:
                seq = best_seq
                base = best_c
                improved = True
    return seq, tour_cost(seq, M)


def solve_version_b(edges, M):
    best_seq, best_cost = None, float("inf")
    # several diverse NN starts, then polish the best couple
    seeds = []
    step = max(1, len(edges) // 8)
    for k in range(0, len(edges), step):
        seeds.append((edges[k], 0))
        seeds.append((edges[k], 1))
    for e0, o0 in seeds:
        seq = nearest_neighbor(edges, M, e0, o0)
        c = tour_cost(seq, M)
        if c < best_cost:
            best_cost, best_seq = c, seq
    seq, cost = local_search([dict(x) for x in best_seq], M)
    return seq, cost


# ----------------------------- 6. geometry ------------------------------
def route_geom(c1, c2, cache):
    key = f"{c1[0]:.5f},{c1[1]:.5f};{c2[0]:.5f},{c2[1]:.5f}"
    if key in cache:
        return cache[key]
    url = (
        f"{OSRM}/route/v1/driving/{c1[0]:.6f},{c1[1]:.6f};{c2[0]:.6f},{c2[1]:.6f}"
        f"?overview=simplified&geometries=geojson"
    )
    data = http_get(url)
    if data and data.get("code") == "Ok":
        g = data["routes"][0]["geometry"]["coordinates"]
        d = data["routes"][0]["distance"] / M_PER_MI
        t = data["routes"][0]["duration"] / 60.0
    else:
        g = [list(c1), list(c2)]
        d = haversine_mi(c1, c2) * 1.2
        t = d  # ~60 mph fallback
    cache[key] = {"coords": g, "miles": d, "minutes": t}
    save_cache("geometry.json", cache)
    time.sleep(0.25)
    return cache[key]


def connector_features(seq, M, gcache):
    feats = []
    total_mi = 0.0
    total_min = 0.0
    for i in range(len(seq) - 1):
        a = seq[i]
        b = seq[i + 1]
        c1 = a["edge"]["b"] if a["orient"] == 0 else a["edge"]["a"]
        c2 = b["edge"]["a"] if b["orient"] == 0 else b["edge"]["b"]
        p1 = [c1["lon"], c1["lat"]]
        p2 = [c2["lon"], c2["lat"]]
        g = route_geom(p1, p2, gcache)
        total_mi += g["miles"]
        total_min += g["minutes"]
        feats.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": g["coords"]},
                "properties": {
                    "seq": i + 1,
                    "from": a["edge"]["label"],
                    "to": b["edge"]["label"],
                    "miles": round(g["miles"], 1),
                    "minutes": round(g["minutes"], 1),
                },
            }
        )
    return feats, total_mi, total_min


def sequence_summary(seq):
    out = []
    for i, it in enumerate(seq):
        e = it["edge"]
        start = e["a"] if it["orient"] == 0 else e["b"]
        end = e["b"] if it["orient"] == 0 else e["a"]
        out.append(
            {
                "order": i + 1,
                "number": e["number"],
                "label": e["label"],
                "start": start["name"],
                "end": end["name"],
                "mainline_mi": e["approx_mi"],
            }
        )
    return out


# ------------------------------- main -----------------------------------
def main():
    print("Sequential Interstate Challenge — build")
    edges = load_edges()
    print(f"1. loaded {len(edges)} required Interstate edges")

    print("2. geocoding termini ...")
    geocode_all(edges)

    # matrix-index endpoints: edge k -> A at 2k, B at 2k+1
    coords = []
    for k, e in enumerate(edges):
        e["idxA"] = 2 * k
        e["idxB"] = 2 * k + 1
        coords.append((e["a"]["lon"], e["a"]["lat"]))
        coords.append((e["b"]["lon"], e["b"]["lat"]))

    print("3. building connector matrix (OSRM /table, distance + duration) ...")
    M, T, fallbacks = build_matrix(coords)
    obj = T if METRIC == "duration" else M  # the matrix the solvers minimize
    print(f"   solving on metric: {METRIC} ({'minutes' if METRIC=='duration' else 'miles'})")

    fixed_mainline = sum(e["approx_mi"] for e in edges)

    print("4. Version A — locked numerical order (orientation DP) ...")
    edges_sorted = sorted(edges, key=lambda e: e["number"])  # stable: ties keep CSV order
    seq_a, conn_a = solve_version_a(edges_sorted, obj)

    print("5. Version B — free order + orientation (local search) ...")
    seq_b, conn_b = solve_version_b(edges, obj)

    # integrity checks
    assert sorted(it["edge"]["id"] for it in seq_a) == sorted(e["id"] for e in edges)
    assert sorted(it["edge"]["id"] for it in seq_b) == sorted(e["id"] for e in edges)
    assert conn_b <= conn_a + 1e-6, "Version B should never beat-by-losing Version A"

    print("6. fetching route geometry (mainlines + connectors) ...")
    gcache = load_cache("geometry.json")
    # mainlines (schematic: OSRM A->B per edge). Mainline length stays the table
    # reference value; mainline TIME is the routed duration of that schematic trace.
    mainline_feats = []
    fixed_mainline_min = 0.0
    for e in edges:
        g = route_geom([e["a"]["lon"], e["a"]["lat"]], [e["b"]["lon"], e["b"]["lat"]], gcache)
        fixed_mainline_min += g["minutes"]
        mainline_feats.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": g["coords"]},
                "properties": {
                    "number": e["number"],
                    "label": e["label"],
                    "approx_mi": e["approx_mi"],
                    "group": e["group"],
                },
            }
        )
    feats_a, geom_conn_a, geom_conn_a_min = connector_features(seq_a, obj, gcache)
    feats_b, geom_conn_b, geom_conn_b_min = connector_features(seq_b, obj, gcache)

    # ------------------------------ write -------------------------------
    interstates = [
        {
            "id": e["id"],
            "number": e["number"],
            "label": e["label"],
            "axis": e["axis"],
            "group": e["group"],
            "approx_mi": e["approx_mi"],
            "a": {"name": e["a"]["name"], "lon": e["a"]["lon"], "lat": e["a"]["lat"]},
            "b": {"name": e["b"]["name"], "lon": e["b"]["lon"], "lat": e["b"]["lat"]},
        }
        for e in edges
    ]
    write_json("interstates.json", interstates)
    write_json("mainlines.geojson", {"type": "FeatureCollection", "features": mainline_feats})
    write_json("version_a.geojson", {"type": "FeatureCollection", "features": feats_a})
    write_json("version_b.geojson", {"type": "FeatureCollection", "features": feats_b})

    total_a_mi = fixed_mainline + geom_conn_a
    total_b_mi = fixed_mainline + geom_conn_b
    total_a_min = fixed_mainline_min + geom_conn_a_min
    total_b_min = fixed_mainline_min + geom_conn_b_min
    pct = lambda a, b: round(100 * (a - b) / a, 1) if a else 0
    summary = {
        "build_date": time.strftime("%Y-%m-%d"),
        "routing_source": "OSRM public demo (router.project-osrm.org)",
        "primary_metric": "duration" if METRIC == "duration" else "distance",
        "metric": "drive time (duration)" if METRIC == "duration" else "distance (driving miles)",
        "matrix_fallback_cells": fallbacks,
        "version_b_solver": "multi-start NN + 2-opt/Or-opt local search",
        "n_interstates": len(edges),
        "fixed_mainline_mi": round(fixed_mainline),
        "fixed_mainline_min": round(fixed_mainline_min),
        "version_a": {
            "connector_mi": round(geom_conn_a),
            "connector_min": round(geom_conn_a_min),
            "total_mi": round(total_a_mi),
            "total_min": round(total_a_min),
            "sequence": sequence_summary(seq_a),
        },
        "version_b": {
            "connector_mi": round(geom_conn_b),
            "connector_min": round(geom_conn_b_min),
            "total_mi": round(total_b_mi),
            "total_min": round(total_b_min),
            "sequence": sequence_summary(seq_b),
        },
        "connector_delta_mi": round(geom_conn_a - geom_conn_b),
        "connector_delta_min": round(geom_conn_a_min - geom_conn_b_min),
        "total_delta_mi": round(total_a_mi - total_b_mi),
        "total_delta_min": round(total_a_min - total_b_min),
        "pct_connector_saved": pct(geom_conn_a, geom_conn_b),           # distance %
        "pct_connector_time_saved": pct(geom_conn_a_min, geom_conn_b_min),  # time %
    }
    write_json("summary.json", summary)

    def hrs(m):
        return f"{m/60:,.0f} h"

    print("\n=== RESULT ===")
    print(f"  Interstates (edges):     {len(edges)}   (optimizing on {METRIC})")
    print(f"  Fixed mainline:          {fixed_mainline:>8,.0f} mi   {hrs(fixed_mainline_min):>9}")
    print(
        f"  Version A connectors:    {geom_conn_a:>8,.0f} mi   {hrs(geom_conn_a_min):>9}"
        f"   total {total_a_mi:>9,.0f} mi / {hrs(total_a_min)}"
    )
    print(
        f"  Version B connectors:    {geom_conn_b:>8,.0f} mi   {hrs(geom_conn_b_min):>9}"
        f"   total {total_b_mi:>9,.0f} mi / {hrs(total_b_min)}"
    )
    print(
        f"  Delta (A - B):           {total_a_mi - total_b_mi:>8,.0f} mi   "
        f"{hrs(total_a_min - total_b_min):>9}   "
        f"(time {summary['pct_connector_time_saved']}% / dist {summary['pct_connector_saved']}% of connectors)"
    )
    print(f"  data -> {os.path.relpath(OUTDIR, ROOT)}/")


def write_json(name, obj):
    with open(os.path.join(OUTDIR, name), "w") as f:
        json.dump(obj, f)


if __name__ == "__main__":
    sys.exit(main())
