"""
Aggregate municipal ACS basics + population/density up to the 274 K-12 academic
districts that the atlas renders in district mode, and write the result to
``data/ma_district_acs.json`` keyed by DIST_CODE.

Why this exists
---------------
``data/ma_muni_acs.json`` is keyed by TOWN_ID and provides MHI, foreign-born %,
bachelor's+, etc. at the municipality level only. The atlas's district choropleth
draws from ``data/ma_academic_districts.geojson`` (274 polygons, one per academic
district). To let users compare demographic context against district-level
education outcomes we need the same demographic columns at the district level.

Join strategy
-------------
1. Direct match: each muni feature in ``ma_municipalities.geojson`` already
   carries a DIST_CODE pointing to its primary academic district. Group munis
   by DIST_CODE and aggregate.
2. Name fallback: for districts whose DIST_CODE isn't claimed by any muni
   (typically regional districts like "Acton-Boxborough"), parse the
   ``DIST_NAME`` by splitting on '-' / '/' and look up each token against the
   TOWN column. Combines those munis' stats.

Aggregation rules
-----------------
- ``acs_total_population``: simple sum.
- ``_pop_2020``: simple sum of POP2020 (already on each muni feature).
- ``_pop_density_per_sqmi``: total_pop / total_area_sqmi (area from per-muni
  ``_area_sqmi`` computed elsewhere; we recompute here from polygon area in
  square degrees and convert).
- ``acs_median_household_income``: population-weighted MEAN of the underlying
  muni medians. This is an approximation — a true median-of-medians cannot be
  recovered without per-household microdata — but it's an honest "typical
  household income across the district" answer and is signposted as such in
  the atlas's tooltip.
- All ``*_pct`` columns: population-weighted average of the underlying muni
  rates (weighted by ``acs_total_population``, falling back to POP2020 if ACS
  population is missing).

Output
------
``data/ma_district_acs.json`` :: { DIST_CODE: {col: value, ...}, ... }

Run from repo root::

    python scripts/aggregate_acs_to_districts.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MUNIS_PATH = REPO_ROOT / "data" / "ma_municipalities.geojson"
DISTS_PATH = REPO_ROOT / "data" / "ma_academic_districts.geojson"
MUNI_ACS_PATH = REPO_ROOT / "data" / "ma_muni_acs.json"
OUT_PATH = REPO_ROOT / "data" / "ma_district_acs.json"

PCT_COLS = (
    "acs_foreign_born_pct",
    "acs_bachelors_plus_pct",
    "acs_non_english_pct",
    "acs_child_poverty_pct",
    "acs_severe_rent_burden_pct",
)

# Manual member-town lookup for regional districts whose DIST_NAME is geographic
# (e.g. "Berkshire Hills", "Mount Greylock") and therefore can't be resolved by
# parsing the name. Source: MA DESE published district directories. Names match
# the TOWN column in ma_municipalities.geojson exactly (case-insensitive). Add
# new regional districts here if DESE creates any.
REGIONAL_DISTRICT_MEMBERS: dict[str, list[str]] = {
    # Regional secondary (7-12 / 9-12) districts added in the regional-HS
    # backfill (see scripts/analysis/regional_hs_gap.md). Verified vs DESE.
    "06400000": ["CONCORD", "CARLISLE"],                              # Concord-Carlisle
    "06600000": ["BREWSTER", "EASTHAM", "ORLEANS", "WELLFLEET"],      # Nauset
    "06900000": ["NORFOLK", "WRENTHAM", "PLAINVILLE"],                # King Philip
    "06950000": ["LINCOLN", "SUDBURY"],                               # Lincoln-Sudbury
    "07050000": ["BOXFORD", "TOPSFIELD", "MIDDLETON"],                # Masconomet
    "07300000": ["NORTHBOROUGH", "SOUTHBOROUGH"],                     # Northboro-Southboro (Algonquin)
    "07630000": ["SOMERSET", "BERKLEY"],                              # Somerset Berkley
    "06030000": ["ADAMS", "CHESHIRE"],                                                # Hoosac Valley Regional
    "06160000": ["AYER", "SHIRLEY"],                                                  # Ayer Shirley
    "06180000": ["GREAT BARRINGTON", "STOCKBRIDGE", "WEST STOCKBRIDGE"],              # Berkshire Hills
    "06350000": ["BECKET", "CUMMINGTON", "DALTON", "HINSDALE", "PERU",
                 "WASHINGTON", "WINDSOR"],                                            # Central Berkshire
    "06620000": ["OTIS", "SANDISFIELD"],                                              # Farmington River Reg
    "06720000": ["BLANDFORD", "CHESTER", "HUNTINGTON", "MIDDLEFIELD",
                 "MONTGOMERY", "RUSSELL"],                                            # Gateway
    "06850000": ["CHARLEMONT", "HAWLEY"],                                             # Hawlemont
    "06980000": ["MANCHESTER-BY-THE-SEA", "ESSEX"],                                   # Manchester Essex Regional
    "07120000": ["CHATHAM", "HARWICH"],                                               # Monomoy Regional
    "07150000": ["WILLIAMSTOWN", "LANESBOROUGH"],                                     # Mount Greylock
    "07170000": ["ASHFIELD", "BUCKLAND", "CHARLEMONT", "COLRAIN", "HAWLEY",
                 "HEATH", "PLAINFIELD", "ROWE", "SHELBURNE"],                         # Mohawk Trail
    "07200000": ["TEMPLETON", "PHILLIPSTON"],                                         # Narragansett
    "07250000": ["BOLTON", "LANCASTER", "STOW"],                                      # Nashoba
    "07350000": ["PEPPERELL", "TOWNSEND", "ASHBY"],                                   # North Middlesex
    "07450000": ["GROVELAND", "MERRIMAC", "WEST NEWBURY"],                            # Pentucket
    "07500000": ["BERNARDSTON", "LEYDEN", "NORTHFIELD", "WARWICK"],                   # Pioneer Valley
    "07530000": ["BARRE", "HARDWICK", "HUBBARDSTON", "NEW BRAINTREE", "OAKHAM"],      # Quabbin
    "07650000": ["ALFORD", "EGREMONT", "MONTEREY", "NEW MARLBOROUGH", "SHEFFIELD"],   # Southern Berkshire
    "07700000": ["BRIMFIELD", "BROOKFIELD", "HOLLAND", "STURBRIDGE", "WALES"],        # Tantasqua
    "07730000": ["NEWBURY", "ROWLEY", "SALISBURY"],                                   # Triton
    "07740000": ["AQUINNAH", "CHILMARK", "WEST TISBURY"],                             # Up-Island Regional
    "07750000": ["HOLDEN", "PAXTON", "PRINCETON", "RUTLAND", "STERLING"],             # Wachusett
    "07780000": ["WARREN", "WEST BROOKFIELD"],                                        # Quaboag Regional
}


def polygon_area_sqdeg(coords) -> float:
    """Shoelace area for a (Multi)Polygon ring list. Returns positive area in
    square degrees. Adequate as a relative measure; we convert to sq mi with a
    latitude-correction factor below."""
    def ring_area(ring):
        n = len(ring)
        s = 0.0
        for i in range(n - 1):
            x1, y1 = ring[i][0], ring[i][1]
            x2, y2 = ring[i + 1][0], ring[i + 1][1]
            s += x1 * y2 - x2 * y1
        return abs(s) / 2.0

    if not coords:
        return 0.0
    total = 0.0
    # MultiPolygon: [[[ring]]], Polygon: [[ring]]
    if isinstance(coords[0][0][0], list):
        for poly in coords:
            outer, *holes = poly
            total += ring_area(outer)
            for h in holes:
                total -= ring_area(h)
    else:
        outer, *holes = coords
        total += ring_area(outer)
        for h in holes:
            total -= ring_area(h)
    return total


def sqdeg_to_sqmi(area_sqdeg: float, lat_deg: float) -> float:
    """Convert from sq degrees to sq miles using a latitude-aware factor.
    1 deg lat ≈ 69 mi; 1 deg lon ≈ 69 * cos(lat) mi."""
    lat_rad = math.radians(lat_deg)
    return area_sqdeg * 69.0 * 69.0 * math.cos(lat_rad)


def centroid_lat(coords) -> float:
    """Quick mean-of-vertices latitude; good enough for the lat-correction."""
    pts = []

    def walk(node):
        if isinstance(node, list) and node and isinstance(node[0], (int, float)):
            pts.append(node[1])
        elif isinstance(node, list):
            for c in node:
                walk(c)

    walk(coords)
    return sum(pts) / len(pts) if pts else 42.0


def norm_name(s: str) -> str:
    return (s or "").strip().lower()


def main() -> int:
    munis = json.loads(MUNIS_PATH.read_text(encoding="utf-8"))
    dists = json.loads(DISTS_PATH.read_text(encoding="utf-8"))
    muni_acs = json.loads(MUNI_ACS_PATH.read_text(encoding="utf-8"))

    # Build per-muni record indexed by TOWN_ID
    muni_recs: dict[str, dict] = {}
    by_town_name: dict[str, str] = {}  # TOWN (normalized) -> TOWN_ID
    by_dist_code: dict[str, list[str]] = {}  # DIST_CODE -> [TOWN_IDs]

    for f in munis["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID")) if p.get("TOWN_ID") is not None else None
        if not tid:
            continue
        pop = p.get("POP2020") or p.get("pop_2020") or 0
        # Compute area (sq mi) from polygon
        coords = f["geometry"]["coordinates"]
        lat = centroid_lat(coords)
        area_sqmi = sqdeg_to_sqmi(polygon_area_sqdeg(coords), lat)
        muni_recs[tid] = {
            "pop": pop or 0,
            "area_sqmi": area_sqmi,
            "town": p.get("TOWN") or "",
            "acs": muni_acs.get(tid, {}),
        }
        by_town_name[norm_name(p.get("TOWN"))] = tid
        dc = p.get("DIST_CODE")
        if dc:
            by_dist_code.setdefault(dc, []).append(tid)

    out: dict[str, dict] = {}

    def aggregate(town_ids: list[str]) -> dict:
        rows = [muni_recs[t] for t in town_ids if t in muni_recs]
        if not rows:
            return {}
        # Population: prefer ACS pop, fall back to POP2020
        pops = []
        for r in rows:
            acs = r["acs"] or {}
            p = acs.get("acs_total_population") or r["pop"] or 0
            pops.append(p)
        total_pop = sum(pops) or 0
        total_pop_2020 = sum(r["pop"] for r in rows)
        total_area = sum(r["area_sqmi"] for r in rows)

        # Round derived floats so re-running the script is deterministic and the
        # JSON diff doesn't churn on last-digit FP noise. 4 dp is far finer than
        # the underlying ACS precision.
        agg: dict[str, float] = {
            "acs_total_population": total_pop,
            "_pop_2020": total_pop_2020,
            "_pop_density_per_sqmi": round(total_pop_2020 / total_area, 4) if total_area > 0 else None,
            "_area_sqmi": round(total_area, 6),
            "_member_count": len(rows),
            # Member-town names (Title Case), sorted — surfaced in the atlas's
            # district panel so users see which towns the community stats are
            # rolled up from.
            "_member_towns": sorted(
                (r["town"] or "").title() for r in rows if r["town"]
            ),
        }

        # Population-weighted MHI (approximation; documented in tooltip)
        weighted_sum = 0.0
        weight = 0.0
        for r, p in zip(rows, pops):
            mhi = (r["acs"] or {}).get("acs_median_household_income")
            if mhi is None or p <= 0:
                continue
            weighted_sum += mhi * p
            weight += p
        agg["acs_median_household_income"] = (
            round(weighted_sum / weight) if weight > 0 else None
        )

        # Population-weighted percentages
        for col in PCT_COLS:
            ws = 0.0
            wt = 0.0
            for r, p in zip(rows, pops):
                v = (r["acs"] or {}).get(col)
                if v is None or p <= 0:
                    continue
                ws += v * p
                wt += p
            agg[col] = round(ws / wt, 6) if wt > 0 else None

        return agg

    direct_hits = 0
    name_hits = 0
    manual_hits = 0
    unresolved = []
    for f in dists["features"]:
        p = f["properties"]
        dc = p.get("DIST_CODE")
        if not dc:
            continue

        # Strategy 1: direct DIST_CODE match
        town_ids = by_dist_code.get(dc, [])
        if town_ids:
            direct_hits += 1

        # Strategy 2: parse DIST_NAME, match member town names (Acton-Boxborough, etc.)
        if not town_ids:
            name = p.get("DIST_NAME") or ""
            tokens = [t.strip() for t in name.replace("/", "-").split("-")]
            tokens = [t for t in tokens if t and len(t) > 1]
            town_ids = [by_town_name[norm_name(t)] for t in tokens if norm_name(t) in by_town_name]
            if town_ids:
                name_hits += 1

        # Strategy 3: manual lookup for geographically-named regional districts
        # (Berkshire Hills, Mount Greylock, etc.) where the name doesn't list members.
        if not town_ids and dc in REGIONAL_DISTRICT_MEMBERS:
            members = REGIONAL_DISTRICT_MEMBERS[dc]
            town_ids = [by_town_name[norm_name(t)] for t in members if norm_name(t) in by_town_name]
            missing = [t for t in members if norm_name(t) not in by_town_name]
            if missing:
                print(f"  WARN: {p.get('DIST_NAME')} ({dc}) — these member towns not found in muni file: {missing}")
            if town_ids:
                manual_hits += 1

        if not town_ids:
            unresolved.append(p.get("DIST_NAME"))
            continue

        out[dc] = aggregate(town_ids)

    OUT_PATH.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(REPO_ROOT)} with {len(out)} districts.")
    print(f"  direct DIST_CODE hits: {direct_hits}")
    print(f"  name-fallback hits:    {name_hits}")
    print(f"  manual-lookup hits:    {manual_hits}")
    print(f"  unresolved districts:  {len(unresolved)}")
    if unresolved:
        print("  unresolved:", unresolved)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
