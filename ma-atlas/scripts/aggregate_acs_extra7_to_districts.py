"""
Aggregate the EIGHTH municipal ACS bundle (data/ma_muni_acs_extra7.json) up to
the 274 K-12 academic districts the atlas renders in district mode, and write the
result to ``data/ma_district_acs_extra7.json`` keyed by DIST_CODE.

This is a companion to ``aggregate_acs_to_districts.py`` …
``aggregate_acs_extra6_to_districts.py`` and reuses the exact same
muni->district join strategy (direct DIST_CODE, DIST_NAME token parse, and the
manual regional-district member table) plus the same population-weighted mean
aggregation. It only handles the NEW columns from ma_muni_acs_extra7.json:

  acs_age65_plus_pct       -> population-weighted mean
  acs_school_age_pct       -> population-weighted mean
  acs_vacancy_pct          -> population-weighted mean
  acs_public_transit_pct   -> population-weighted mean
  acs_family_hh_pct        -> population-weighted mean

Weighting note: population weights come from acs_total_population in the BASICS
file (ma_muni_acs.json), falling back to POP2020 from the muni geojson — exactly
as in aggregate_acs_extra6_to_districts.py. The extra7 file intentionally carries
no population column of its own.

Caveat: the rate columns are population-weighted means of member-town rates, a
sound approximation of the district-wide rate (exact only when each town's
denominator is proportional to total population). For housing-unit and
worker-based shares (vacancy, public transit) the proportionality is approximate.

Run from repo root::

    python scripts/aggregate_acs_extra7_to_districts.py
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MUNIS_PATH = REPO_ROOT / "data" / "ma_municipalities.geojson"
DISTS_PATH = REPO_ROOT / "data" / "ma_academic_districts.geojson"
MUNI_ACS_PATH = REPO_ROOT / "data" / "ma_muni_acs.json"          # basics (for pop weights)
MUNI_ACS_EXTRA7_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra7.json"
OUT_PATH = REPO_ROOT / "data" / "ma_district_acs_extra7.json"

# Columns to population-weight.
MEAN_COLS = (
    "acs_age65_plus_pct",
    "acs_school_age_pct",
    "acs_vacancy_pct",
    "acs_public_transit_pct",
    "acs_family_hh_pct",
)

# Round to a column-appropriate number of decimals on output so re-running is
# deterministic and the JSON diff doesn't churn on FP noise. All columns are
# 0–1 fractions (6 decimals).
COL_ROUND = {
    "acs_age65_plus_pct": 6,
    "acs_school_age_pct": 6,
    "acs_vacancy_pct": 6,
    "acs_public_transit_pct": 6,
    "acs_family_hh_pct": 6,
}

# Manual member-town lookup for regional districts whose DIST_NAME is geographic.
# Copied verbatim from aggregate_acs_to_districts.py — keep the set in sync.
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
    "06030000": ["ADAMS", "CHESHIRE"],
    "06160000": ["AYER", "SHIRLEY"],
    "06180000": ["GREAT BARRINGTON", "STOCKBRIDGE", "WEST STOCKBRIDGE"],
    "06350000": ["BECKET", "CUMMINGTON", "DALTON", "HINSDALE", "PERU",
                 "WASHINGTON", "WINDSOR"],
    "06620000": ["OTIS", "SANDISFIELD"],
    "06720000": ["BLANDFORD", "CHESTER", "HUNTINGTON", "MIDDLEFIELD",
                 "MONTGOMERY", "RUSSELL"],
    "06850000": ["CHARLEMONT", "HAWLEY"],
    "06980000": ["MANCHESTER-BY-THE-SEA", "ESSEX"],
    "07120000": ["CHATHAM", "HARWICH"],
    "07150000": ["WILLIAMSTOWN", "LANESBOROUGH"],
    "07170000": ["ASHFIELD", "BUCKLAND", "CHARLEMONT", "COLRAIN", "HAWLEY",
                 "HEATH", "PLAINFIELD", "ROWE", "SHELBURNE"],
    "07200000": ["TEMPLETON", "PHILLIPSTON"],
    "07250000": ["BOLTON", "LANCASTER", "STOW"],
    "07350000": ["PEPPERELL", "TOWNSEND", "ASHBY"],
    "07450000": ["GROVELAND", "MERRIMAC", "WEST NEWBURY"],
    "07500000": ["BERNARDSTON", "LEYDEN", "NORTHFIELD", "WARWICK"],
    "07530000": ["BARRE", "HARDWICK", "HUBBARDSTON", "NEW BRAINTREE", "OAKHAM"],
    "07650000": ["ALFORD", "EGREMONT", "MONTEREY", "NEW MARLBOROUGH", "SHEFFIELD"],
    "07700000": ["BRIMFIELD", "BROOKFIELD", "HOLLAND", "STURBRIDGE", "WALES"],
    "07730000": ["NEWBURY", "ROWLEY", "SALISBURY"],
    "07740000": ["AQUINNAH", "CHILMARK", "WEST TISBURY"],
    "07750000": ["HOLDEN", "PAXTON", "PRINCETON", "RUTLAND", "STERLING"],
    "07780000": ["WARREN", "WEST BROOKFIELD"],
}


def norm_name(s: str) -> str:
    return (s or "").strip().lower()


def main() -> int:
    munis = json.loads(MUNIS_PATH.read_text(encoding="utf-8"))
    dists = json.loads(DISTS_PATH.read_text(encoding="utf-8"))
    muni_acs = json.loads(MUNI_ACS_PATH.read_text(encoding="utf-8"))
    muni_acs_extra7 = json.loads(MUNI_ACS_EXTRA7_PATH.read_text(encoding="utf-8"))

    muni_recs: dict[str, dict] = {}
    by_town_name: dict[str, str] = {}
    by_dist_code: dict[str, list[str]] = {}

    for f in munis["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID")) if p.get("TOWN_ID") is not None else None
        if not tid:
            continue
        pop = p.get("POP2020") or p.get("pop_2020") or 0
        muni_recs[tid] = {
            "pop": pop or 0,
            "town": p.get("TOWN") or "",
            "acs": muni_acs.get(tid, {}),            # for population weight
            "extra": muni_acs_extra7.get(tid, {}),   # the new metrics
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
        # Population weights: prefer ACS total pop (basics), fall back to POP2020.
        pops = []
        for r in rows:
            acs = r["acs"] or {}
            p = acs.get("acs_total_population") or r["pop"] or 0
            pops.append(p)

        agg: dict[str, float | int | None] = {"_member_count": len(rows)}

        for col in MEAN_COLS:
            ws = 0.0
            wt = 0.0
            for r, p in zip(rows, pops):
                v = (r["extra"] or {}).get(col)
                if v is None or p <= 0:
                    continue
                ws += v * p
                wt += p
            if wt <= 0:
                agg[col] = None
                continue
            mean = ws / wt
            nd = COL_ROUND[col]
            agg[col] = round(mean, nd) if nd > 0 else int(round(mean))

        return agg

    direct_hits = name_hits = manual_hits = 0
    unresolved = []
    for f in dists["features"]:
        p = f["properties"]
        dc = p.get("DIST_CODE")
        if not dc:
            continue

        town_ids = by_dist_code.get(dc, [])
        if town_ids:
            direct_hits += 1

        if not town_ids:
            name = p.get("DIST_NAME") or ""
            tokens = [t.strip() for t in name.replace("/", "-").split("-")]
            tokens = [t for t in tokens if t and len(t) > 1]
            town_ids = [by_town_name[norm_name(t)] for t in tokens if norm_name(t) in by_town_name]
            if town_ids:
                name_hits += 1

        if not town_ids and dc in REGIONAL_DISTRICT_MEMBERS:
            members = REGIONAL_DISTRICT_MEMBERS[dc]
            town_ids = [by_town_name[norm_name(t)] for t in members if norm_name(t) in by_town_name]
            missing = [t for t in members if norm_name(t) not in by_town_name]
            if missing:
                print(f"  WARN: {p.get('DIST_NAME')} ({dc}) — member towns not found: {missing}")
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
    for col in MEAN_COLS:
        n = sum(1 for r in out.values() if r.get(col) is not None)
        print(f"  {col}: {n}/{len(out)} non-null")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
