"""
Roll a town-keyed civic muni file (data/ma_muni_<metric_id>.json, produced by
scripts/parse_civic.py) up to academic districts, writing
data/ma_district_<metric_id>.json. Reuses the canonical town->district join +
population from aggregate_acs_to_districts.py so regional districts resolve to
their member towns.

  --agg sum   total across member towns (counts, e.g. # overrides, total circulation)
  --agg mean  population-weighted mean (rates, e.g. turnout %, per-capita)

Usage:
  python scripts/aggregate_civic_to_districts.py --metric-id override_count --agg sum
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from aggregate_acs_to_districts import REGIONAL_DISTRICT_MEMBERS, norm_name  # noqa: E402

MUNIS = REPO / "data" / "ma_municipalities.geojson"
DISTS = REPO / "data" / "ma_academic_districts.geojson"


def member_towns(dists, by_dist_code, by_town_name):
    for f in dists["features"]:
        dc = f["properties"].get("DIST_CODE")
        if not dc:
            continue
        tids = by_dist_code.get(dc, [])
        if not tids:
            name = f["properties"].get("DIST_NAME") or ""
            toks = [t.strip() for t in name.replace("/", "-").split("-") if len(t.strip()) > 1]
            tids = [by_town_name[norm_name(t)] for t in toks if norm_name(t) in by_town_name]
        if not tids and dc in REGIONAL_DISTRICT_MEMBERS:
            tids = [by_town_name[norm_name(t)] for t in REGIONAL_DISTRICT_MEMBERS[dc]
                    if norm_name(t) in by_town_name]
        if tids:
            yield dc, tids


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--metric-id", required=True)
    ap.add_argument("--agg", choices=["sum", "mean"], default="mean")
    args = ap.parse_args()

    muni_path = REPO / "data" / f"ma_muni_{args.metric_id}.json"
    if not muni_path.exists():
        sys.exit(f"missing {muni_path.relative_to(REPO)} — run scripts/parse_civic.py first")
    muni = json.loads(muni_path.read_text(encoding="utf-8"))
    munis = json.loads(MUNIS.read_text(encoding="utf-8"))
    dists = json.loads(DISTS.read_text(encoding="utf-8"))

    by_dist_code, by_town_name, pop = {}, {}, {}
    for f in munis["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID")) if p.get("TOWN_ID") is not None else None
        if not tid:
            continue
        by_town_name[norm_name(p.get("TOWN"))] = tid
        pop[tid] = p.get("POP2020") or p.get("pop_2020") or 0
        if p.get("DIST_CODE"):
            by_dist_code.setdefault(p["DIST_CODE"], []).append(tid)

    out = {}
    for dc, tids in member_towns(dists, by_dist_code, by_town_name):
        vals = [(muni[t][args.metric_id], pop.get(t, 0)) for t in tids
                if t in muni and args.metric_id in muni[t] and muni[t][args.metric_id] is not None]
        if not vals:
            continue
        if args.agg == "sum":
            v = sum(x for x, _ in vals)
        else:
            wt = sum(w for _, w in vals)
            v = (sum(x * w for x, w in vals) / wt) if wt > 0 else (sum(x for x, _ in vals) / len(vals))
        out[dc] = {args.metric_id: round(v, 4)}

    out_path = REPO / "data" / f"ma_district_{args.metric_id}.json"
    out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"wrote {out_path.relative_to(REPO)}: {len(out)} districts "
          f"({100*len(out)//281}% of 281)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
