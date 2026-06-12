"""
Build ``data/ma_muni_childcare_extra.json`` — five NEW municipal child-care metrics
mined from the same EEC licensing + C3 grant feeds the dots/access layers already
use, so the rich data we downloaded isn't reduced to a single supply ratio.

Metrics per town (all also rolled to districts by
``scripts/aggregate_childcare_to_districts.py``):
  * childcare_infant_toddler_per_100_u5 — licensed INFANT/TODDLER seats per 100
    children under 5 (the hardest age to place; the binding constraint on parents
    returning to work). Infant/toddler seats = sum of the infant + toddler
    age-band capacity columns (multi-age birth–14 licenses excluded as too broad).
  * childcare_subsidy_pct — % of licensed programs that accept subsidy vouchers
    (affordability for low-income families).
  * childcare_headstart_per_100_u5 — Head Start seats per 100 under-5 (federal
    early-ed intensity; a real 0 = no Head Start, not missing data).
  * childcare_c3_per_seat — town Commonwealth Cares for Children (C3) grant dollars
    (latest FY) per licensed seat.
  * childcare_c3_trend_2yr — 2-year % change in town C3 dollars (program funding
    trajectory; contraction risk where negative).

Universe: all LICENSED programs (Center-based + in-home Family Child Care), matched
to a municipality by point-in-polygon on program lat/lon against
``ma_municipalities.geojson`` (mirrors fetch_childcare_access.py; sidesteps the
Boston-neighborhood program_city labels). A genuine 0 (e.g. no Head Start, no
subsidy program, a child-care desert) is stored as 0, NOT null — these are real
values, not gaps.

Raw numerator/denominator components are stored alongside each ratio (``_``-prefixed)
so the district roll-up sums components and recomputes ratios exactly, rather than
averaging ratios.

SOURCES (public, no key; MA Education-to-Career hub, Socrata/SODA):
  * "Current Licensed and Funded EEC Programs" [iyks-y3g6]
  * "Commonwealth Cares for Children (C3) Funds by Program" [5722-nbhm]
  * Denominator: ACS B01001 under-5 (Census Reporter mirror, keyless).

Output: ``data/ma_muni_childcare_extra.json`` :: { "<TOWN_ID>": { metric: value, ... } }
Run from repo root::  python scripts/fetch_childcare_metrics.py
"""
from __future__ import annotations
import json, statistics, urllib.parse, urllib.request
from pathlib import Path
from shapely.geometry import shape, Point
from shapely import STRtree

REPO = Path(__file__).resolve().parent.parent
MUNI = REPO / "data" / "ma_municipalities.geojson"
OUT = REPO / "data" / "ma_muni_childcare_extra.json"
EEC_DOMAIN = "educationtocareer.data.mass.gov"
LICENSE_DS = "iyks-y3g6"
C3_DS = "5722-nbhm"
C3_LATEST, C3_BASE = 2026, 2024
CENSUS_REPORTER = "https://api.censusreporter.org/1.0/data/show/latest"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# Infant/toddler age-band capacity columns (from EEC schema; the broad
# multi_agegroup_birth14yr license is excluded — it isn't infant/toddler-specific).
INFANT_TODDLER_BANDS = [
    "infant_birth15mo", "infant_toddler_birth33mo",
    "toddler_15mo33mo", "toddler_preschool_15mok",
]


def http_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def soda_all(dataset: str, select: str, where: str) -> list[dict]:
    rows, off, page = [], 0, 5000
    while True:
        url = f"https://{EEC_DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(
            {"$select": select, "$where": where, "$order": "provider_number",
             "$limit": str(page), "$offset": str(off)})
        batch = http_json(url)
        rows.extend(batch)
        if len(batch) < page:
            break
        off += page
    return rows


def normalize_name(raw: str) -> str:
    if not raw:
        return ""
    name = raw.split(",")[0].strip()
    suffixes = (" town", " city", " borough", " plantation", " CDP", " (balance)")
    changed = True
    while changed:
        changed = False
        for s in suffixes:
            if name.lower().endswith(s.lower()):
                name = name[: -len(s)].strip()
                changed = True
                break
    return name.upper()


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def truthy(v) -> bool:
    return str(v).strip().lower() in ("true", "1", "yes", "t")


def fetch_c3() -> dict[str, dict[int, int]]:
    rows = soda_all(C3_DS, "provider_number,fiscal_year,c3_funds",
                    f"fiscal_year in ({C3_BASE},{C3_LATEST})")
    out: dict[str, dict[int, int]] = {}
    for r in rows:
        pid = (r.get("provider_number") or "").strip()
        fy, amt = num(r.get("fiscal_year")), num(r.get("c3_funds"))
        if pid and fy is not None and amt is not None:
            out.setdefault(pid, {})[int(fy)] = int(round(amt))
    return out


def main() -> int:
    muni = json.loads(MUNI.read_text(encoding="utf-8"))
    polys, tids, town_to_tid = [], [], {}
    for f in muni["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID"))
        polys.append(shape(f["geometry"]))
        tids.append(tid)
        t = (p.get("TOWN") or p.get("town_display") or "").upper().strip()
        if t:
            town_to_tid[t] = tid
    tree = STRtree(polys)

    # per-town accumulators
    agg = {tid: {"_it_seats": 0, "_hs_seats": 0, "_subsidy_programs": 0,
                 "_total_programs": 0, "_total_capacity": 0,
                 "_c3_latest": 0, "_c3_base": 0} for tid in tids}

    c3 = fetch_c3()
    select = ("provider_number,program_latitude,program_longitude,licensed_capacity,"
              "head_start,voucher_contract," + ",".join(INFANT_TODDLER_BANDS))
    matched = unmatched = 0
    for r in soda_all(LICENSE_DS, select, "licensed_funded='Licensed'"):
        lat, lon = num(r.get("program_latitude")), num(r.get("program_longitude"))
        if lat is None or lon is None:
            continue
        pt = Point(lon, lat)
        tid = None
        for idx in tree.query(pt):
            if polys[int(idx)].contains(pt):
                tid = tids[int(idx)]
                break
        if tid is None:
            unmatched += 1
            continue
        matched += 1
        a = agg[tid]
        a["_total_programs"] += 1
        cap = num(r.get("licensed_capacity")) or 0
        a["_total_capacity"] += cap
        if truthy(r.get("voucher_contract")):
            a["_subsidy_programs"] += 1
        if truthy(r.get("head_start")):
            a["_hs_seats"] += cap
        a["_it_seats"] += sum(num(r.get(b)) or 0 for b in INFANT_TODDLER_BANDS)
        funds = c3.get((r.get("provider_number") or "").strip(), {})
        a["_c3_latest"] += funds.get(C3_LATEST, 0)
        a["_c3_base"] += funds.get(C3_BASE, 0)

    # under-5 denominator (Census Reporter, keyless) — same as fetch_childcare_access
    cr = http_json(CENSUS_REPORTER + "?" + urllib.parse.urlencode(
        {"table_ids": "B01001", "geo_ids": "060|04000US25"}))
    release = cr.get("release", {}).get("name", "ACS 5-year")
    u5: dict[str, int] = {}
    for gid, d in cr["data"].items():
        est = d["B01001"]["estimate"]
        val = int((est.get("B01001003") or 0) + (est.get("B01001027") or 0))
        tid = town_to_tid.get(normalize_name(cr["geography"].get(gid, {}).get("name", "")))
        if tid is not None and val > u5.get(tid, -1):
            u5[tid] = val

    out: dict[str, dict] = {}
    for tid, a in agg.items():
        if a["_total_programs"] == 0 and u5.get(tid) is None:
            continue                                  # truly no childcare data for this town
        row = dict(a)
        under5 = u5.get(tid)
        if under5:
            row["children_under5"] = under5
            row["childcare_infant_toddler_per_100_u5"] = round(a["_it_seats"] / under5 * 100, 1)
            row["childcare_headstart_per_100_u5"] = round(a["_hs_seats"] / under5 * 100, 1)
        if a["_total_programs"] > 0:
            row["childcare_subsidy_pct"] = round(a["_subsidy_programs"] / a["_total_programs"], 3)
        if a["_total_capacity"] > 0 and a["_c3_latest"] > 0:
            row["childcare_c3_per_seat"] = round(a["_c3_latest"] / a["_total_capacity"])
        if a["_c3_base"] > 0:
            row["childcare_c3_trend_2yr"] = round((a["_c3_latest"] - a["_c3_base"]) / a["_c3_base"], 3)
        out[tid] = row

    OUT.write_text(json.dumps(out, separators=(",", ":")))

    def cov(metric):
        return sum(1 for r in out.values() if metric in r)
    print(f"wrote {OUT.relative_to(REPO)}: {len(out)} towns  (denominator: {release})")
    print(f"  programs PIP-matched: {matched}  unmatched (off-map): {unmatched}")
    for m in ("childcare_infant_toddler_per_100_u5", "childcare_subsidy_pct",
              "childcare_headstart_per_100_u5", "childcare_c3_per_seat",
              "childcare_c3_trend_2yr"):
        vals = sorted(r[m] for r in out.values() if m in r)
        if vals:
            print(f"  {m:38s} n={cov(m):3d}  median={statistics.median(vals):.3g}  "
                  f"min={vals[0]:.3g} max={vals[-1]:.3g}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
