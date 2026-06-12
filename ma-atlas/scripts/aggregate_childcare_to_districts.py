"""
Roll the municipal child-care metrics up to the academic districts the atlas paints
in district mode, writing ``data/ma_district_childcare.json`` keyed by DIST_CODE.

Reuses the canonical town→district join from ``aggregate_acs_to_districts.py``
(direct DIST_CODE → DIST_NAME token split → REGIONAL_DISTRICT_MEMBERS manual table,
imported so the two stay in sync). Unlike the ACS roll-up, child-care ratios are
re-derived from SUMMED raw components (seats, programs, grant $, under-5) rather
than population-weighted means of ratios — exact, not approximate.

Inputs:
  data/ma_muni_childcare.json        — childcare_capacity, children_under5 (existing)
  data/ma_muni_childcare_extra.json  — _it_seats/_hs_seats/_subsidy_programs/
                                       _total_programs/_total_capacity/_c3_latest/
                                       _c3_base/children_under5 (new)

Output (district ratios; a real 0 is kept, not nulled):
  childcare_capacity_per_100_u5, childcare_infant_toddler_per_100_u5,
  childcare_subsidy_pct, childcare_headstart_per_100_u5,
  childcare_c3_per_seat, childcare_c3_trend_2yr

Run from repo root::  python scripts/aggregate_childcare_to_districts.py
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))   # import sibling helper
from aggregate_acs_to_districts import REGIONAL_DISTRICT_MEMBERS, norm_name  # noqa: E402

MUNIS = REPO / "data" / "ma_municipalities.geojson"
DISTS = REPO / "data" / "ma_academic_districts.geojson"
CC_BASE = REPO / "data" / "ma_muni_childcare.json"
CC_EXTRA = REPO / "data" / "ma_muni_childcare_extra.json"
OUT = REPO / "data" / "ma_district_childcare.json"

# Raw components summed across member towns (then ratios recomputed).
SUM_FIELDS = ("childcare_capacity", "children_under5", "_it_seats", "_hs_seats",
              "_subsidy_programs", "_total_programs", "_total_capacity",
              "_c3_latest", "_c3_base")


def resolve_member_towns(dists, by_dist_code, by_town_name):
    """Yield (DIST_CODE, [TOWN_IDs]) via the 3-tier join."""
    for f in dists["features"]:
        dc = f["properties"].get("DIST_CODE")
        if not dc:
            continue
        town_ids = by_dist_code.get(dc, [])
        if not town_ids:
            name = f["properties"].get("DIST_NAME") or ""
            tokens = [t.strip() for t in name.replace("/", "-").split("-") if len(t.strip()) > 1]
            town_ids = [by_town_name[norm_name(t)] for t in tokens if norm_name(t) in by_town_name]
        if not town_ids and dc in REGIONAL_DISTRICT_MEMBERS:
            town_ids = [by_town_name[norm_name(t)] for t in REGIONAL_DISTRICT_MEMBERS[dc]
                        if norm_name(t) in by_town_name]
        if town_ids:
            yield dc, town_ids


def main() -> int:
    munis = json.loads(MUNIS.read_text(encoding="utf-8"))
    dists = json.loads(DISTS.read_text(encoding="utf-8"))
    base = json.loads(CC_BASE.read_text(encoding="utf-8"))
    extra = json.loads(CC_EXTRA.read_text(encoding="utf-8"))

    # combined per-town record
    town = {}
    for tid in set(base) | set(extra):
        rec = {}
        rec.update(base.get(tid, {}))
        rec.update(extra.get(tid, {}))
        town[tid] = rec

    by_dist_code, by_town_name = {}, {}
    for f in munis["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID")) if p.get("TOWN_ID") is not None else None
        if not tid:
            continue
        by_town_name[norm_name(p.get("TOWN"))] = tid
        dc = p.get("DIST_CODE")
        if dc:
            by_dist_code.setdefault(dc, []).append(tid)

    out = {}
    for dc, town_ids in resolve_member_towns(dists, by_dist_code, by_town_name):
        s = {k: 0.0 for k in SUM_FIELDS}
        present = False
        for tid in town_ids:
            r = town.get(tid)
            if not r:
                continue
            present = True
            for k in SUM_FIELDS:
                s[k] += r.get(k) or 0
        if not present:
            continue

        row = {}
        u5 = s["children_under5"]
        if u5 > 0:
            if s["childcare_capacity"]:
                row["childcare_capacity_per_100_u5"] = round(s["childcare_capacity"] / u5 * 100, 1)
            row["childcare_infant_toddler_per_100_u5"] = round(s["_it_seats"] / u5 * 100, 1)
            row["childcare_headstart_per_100_u5"] = round(s["_hs_seats"] / u5 * 100, 1)
        if s["_total_programs"] > 0:
            row["childcare_subsidy_pct"] = round(s["_subsidy_programs"] / s["_total_programs"], 3)
        if s["_total_capacity"] > 0 and s["_c3_latest"] > 0:
            row["childcare_c3_per_seat"] = round(s["_c3_latest"] / s["_total_capacity"])
        if s["_c3_base"] > 0:
            row["childcare_c3_trend_2yr"] = round((s["_c3_latest"] - s["_c3_base"]) / s["_c3_base"], 3)
        if row:
            out[dc] = row

    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)} with {len(out)} districts.")
    for m in ("childcare_capacity_per_100_u5", "childcare_infant_toddler_per_100_u5",
              "childcare_subsidy_pct", "childcare_headstart_per_100_u5",
              "childcare_c3_per_seat", "childcare_c3_trend_2yr"):
        n = sum(1 for r in out.values() if m in r)
        print(f"  {m:38s} {n}/{len(out)} districts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
