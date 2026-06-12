#!/usr/bin/env python3
"""Backfill DESE figures onto towns that belong to REGIONAL districts.

DESE reports by district, not town, so the muni layer was blank (~118 of 351
towns) for grad / MCAS / absenteeism / spending / etc. — every town that is a
member of a regional district (Mendon -> Mendon-Upton, Lancaster -> Nashoba, …)
rather than its own single-town district.

This maps each blank town to the academic district whose polygon covers it
(point-in-polygon on the town's representative point) and copies that district's
figures onto the town:
  - non-year-keyed columns  -> ma_municipalities.geojson properties
  - year-keyed columns (__YYYY) -> ma_muni_timeseries.json (keyed by TOWN_ID)
Each backfilled town is flagged `_dese_regional: true` + `_dese_source` (the
district's display name) so the UI can say the figures are district-wide.

Idempotent: re-running re-fills towns flagged _dese_regional (or still blank).
Run from the repo root:  python scripts/backfill_muni_regional.py
"""
import json, os, glob
from shapely.geometry import shape
from shapely.prepared import prep

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUNI = os.path.join(ROOT, "data", "ma_municipalities.geojson")
DIST = os.path.join(ROOT, "data", "ma_academic_districts.geojson")
TS   = os.path.join(ROOT, "data", "ma_muni_timeseries.json")

def is_scalar(v):
    return v is None or isinstance(v, (int, float, str, bool))

# Town identity we must never overwrite with district values.
SKIP = {"DIST_CODE", "DIST_NAME", "dist_display", "is_lynn", "is_gateway",
        "TOWN", "TOWN_ID", "TYPE", "COUNTY", "POP2020", "pop_2020",
        "town_display", "is_regional", "is_state_flagged"}

def is_year_keyed(k):
    return len(k) > 6 and k[-6:-4] == "__" and k[-4:].isdigit()

def main():
    munis = json.load(open(MUNI, encoding="utf-8"))
    dists = json.load(open(DIST, encoding="utf-8"))
    ts    = json.load(open(TS, encoding="utf-8")) if os.path.exists(TS) else {}

    # The TRUE muni metric set = columns actually populated for the towns that are
    # their own single-town district (DIST_CODE present, not already backfilled).
    # Only fill those for regional towns, so coverage stays uniform — don't invent
    # columns the muni layer never carried (stu_tchr_ratio, attendance_rate, …).
    geo_schema, ts_schema = set(), set()
    for f in munis["features"]:
        p = f["properties"]
        if not p.get("DIST_CODE") or p.get("_dese_regional"):
            continue
        for k, v in p.items():
            if v is not None and v != "" and not is_year_keyed(k):
                geo_schema.add(k)
        row = ts.get(str(p.get("TOWN_ID")))
        if row:
            for k, v in row.items():
                if v is not None and is_year_keyed(k):
                    ts_schema.add(k)

    # Full per-district figures = academic geojson props + every DIST_CODE-keyed
    # side file (ma_district_*.json), so we capture metrics that aren't baked in
    # the geojson (avg_class_size, chronic_absent_pct, finance/discipline/EL, …).
    dist_all = {}
    for f in dists["features"]:
        code = f["properties"].get("DIST_CODE")
        if code:
            dist_all[code] = {k: v for k, v in f["properties"].items() if is_scalar(v)}
    n_side = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "data", "ma_district_*.json"))):
        try:
            j = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(j, dict):
            continue
        used = False
        for code, vals in j.items():
            if code in dist_all and isinstance(vals, dict):
                for k, v in vals.items():
                    if is_scalar(v) and v is not None:   # non-null side values win
                        dist_all[code][k] = v
                used = True
        n_side += 1 if used else 0

    # Prepared district polygons for fast point-in-polygon, with bbox prefilter.
    dshapes = []
    for f in dists["features"]:
        code = f["properties"].get("DIST_CODE")
        if not code or code not in dist_all:
            continue
        try:
            g = shape(f["geometry"])
        except Exception:
            continue
        dshapes.append((code, g, prep(g), g.bounds))

    filled, no_match = 0, []
    for f in munis["features"]:
        p = f["properties"]
        if p.get("DIST_CODE") and not p.get("_dese_regional"):
            continue  # already mapped to its own (single-town) district
        try:
            tgeom = shape(f["geometry"])
        except Exception:
            continue
        rep = tgeom.representative_point()
        x, y = rep.x, rep.y

        code = None
        for c, g, pg, (minx, miny, maxx, maxy) in dshapes:
            if x < minx or x > maxx or y < miny or y > maxy:
                continue
            if pg.contains(rep):
                code = c; break
        if code is None:  # fallback: largest area overlap
            best, ba = None, 0.0
            for c, g, pg, _ in dshapes:
                try:
                    a = tgeom.intersection(g).area
                except Exception:
                    a = 0.0
                if a > ba:
                    ba, best = a, c
            code = best
        if code is None:
            no_match.append(p.get("town_display") or p.get("TOWN"))
            continue

        # Copy the matched district's full figures onto the town.
        dp = dist_all[code]
        tid = str(p.get("TOWN_ID"))
        ts.setdefault(tid, {})
        for k, v in dp.items():
            if k in SKIP:
                continue
            if is_year_keyed(k):
                if k in ts_schema:
                    ts[tid][k] = v
            elif k in geo_schema:
                p[k] = v
        p["DIST_CODE"] = code
        p["DIST_NAME"] = dp.get("DIST_NAME")
        p["_dese_regional"] = True
        p["_dese_source"] = dp.get("dist_display") or dp.get("DIST_NAME")
        filled += 1

    json.dump(munis, open(MUNI, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(ts, open(TS, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"backfilled {filled} towns from their regional district")
    if no_match:
        print(f"NO district match for {len(no_match)}: {', '.join(no_match)}")

if __name__ == "__main__":
    main()
