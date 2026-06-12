"""
Bake a handful of DISTRICT-level outcome columns down onto the MUNICIPALITY
GeoJSON so they can be mapped at town level, the same way grad_4yr / per_pupil
already are.

The atlas resolves a muni-level metric value by reading it as a flat property on
each town feature in ``ma_municipalities.geojson`` (see getValuesForLevel /
activeColumn in app.js). Most education columns live only on district features,
so a metric is district-only until its value is physically present on the town
features. This script copies the following district columns onto each town by
the town's ``DIST_CODE`` (the same key the existing flat muni columns use):

  chronic_absent_pct  <- ma_district_edu_extra.json
  avg_class_size      <- ma_district_outcomes_extra.json
  class_size_ela      <- ma_district_class_size.json
  class_size_math     <- ma_district_class_size.json
  class_size_science  <- ma_district_class_size.json

Attribution model (matches the rest of the atlas): only the 233 towns that carry
a DIST_CODE — i.e. single-town districts — receive a value. The ~118 towns that
belong to multi-town regional districts have DIST_CODE = null and are left blank,
exactly as grad_4yr / dropout already behave. We do NOT broadcast a regional
district's value across its member towns; the atlas deliberately doesn't do that.

These are single-year (SY2025) columns, NOT year-keyed (__YYYY), so they are
written as flat properties and are picked up immediately — split_muni_timeseries
won't move them, and the bare-column fallback in activeColumn resolves them.

Idempotent: re-running just rewrites the same values. Run AFTER the district
fetch scripts (their JSON is the source) and serialize exactly like
round_coords.py / split_muni_timeseries.py (compact, no whitespace) so the diff
is only the added properties, never a geometry reformat.

Run from repo root::  python scripts/bake_muni_extras.py
"""
from __future__ import annotations
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
GEO = DATA / "ma_municipalities.geojson"

# Output column on the town feature  ->  (source file, source column).
SOURCES = {
    "chronic_absent_pct": ("ma_district_edu_extra.json", "chronic_absent_pct"),
    "avg_class_size":     ("ma_district_outcomes_extra.json", "avg_class_size"),
    "class_size_ela":     ("ma_district_class_size.json", "class_size_ela"),
    "class_size_math":    ("ma_district_class_size.json", "class_size_math"),
    "class_size_science": ("ma_district_class_size.json", "class_size_science"),
}

# Columns sourced from the DISTRICT GeoJSON's current-year (flat) base values,
# mirroring how grad_4yr / EL_PCT / per_pupil are already baked onto towns. These
# were declared muni-capable in the METRICS catalog (levels include "muni") but were
# never baked, so they rendered blank at town level. Baking the flat base value here
# fixes the default-year town view (the year slider still reads ma_muni_timeseries
# where available). Single-town districts only (DIST_CODE present), same as the rest.
DISTRICT_GEO = DATA / "ma_academic_districts.geojson"
DGEO_COLS = [
    "HL_PCT", "BAA_PCT", "AS_PCT", "WH_PCT", "SWD_PCT", "FLNE_PCT",  # race / disability shares
    "mcas_g10_ela_me", "mcas_g10_math_me", "mcas_g10_sci_me",        # Gr10 MCAS % M+E
    "ap_pct_3plus", "dropout_pct",                                    # AP 3+, dropout
    "per_pupil_teachers",                                             # per-pupil teachers split
]


def main() -> int:
    # Load each distinct source file once, keyed by DIST_CODE.
    files = {fn for fn, _ in SOURCES.values()}
    loaded = {fn: json.loads((DATA / fn).read_text()) for fn in files}

    # District GeoJSON base (flat, current-year) values, keyed by DIST_CODE.
    dgeo = json.loads(DISTRICT_GEO.read_text())
    dprops = {f["properties"].get("DIST_CODE"): f["properties"]
              for f in dgeo.get("features", []) if f["properties"].get("DIST_CODE")}

    gj = json.loads(GEO.read_text())
    feats = gj.get("features", [])

    towns_with_code = 0
    hits = {col: 0 for col in list(SOURCES) + DGEO_COLS}
    for f in feats:
        props = f.get("properties", {})
        dc = props.get("DIST_CODE")
        if not dc:
            continue  # regional-district member town — left blank, as grad_4yr is
        towns_with_code += 1
        for col, (fn, src_col) in SOURCES.items():
            rec = loaded[fn].get(dc)
            if isinstance(rec, dict):
                v = rec.get(src_col)
                if v is not None:
                    props[col] = v
                    hits[col] += 1
        drec = dprops.get(dc)
        if isinstance(drec, dict):
            for col in DGEO_COLS:
                v = drec.get(col)
                if v is not None:
                    props[col] = v
                    hits[col] += 1

    # Match the repo's other geojson writers exactly: compact, default encoding.
    GEO.write_text(json.dumps(gj, separators=(",", ":")))

    print(f"baked muni extras onto {GEO.relative_to(REPO)}")
    print(f"  towns with a DIST_CODE (eligible): {towns_with_code}/{len(feats)}")
    for col in list(SOURCES) + DGEO_COLS:
        print(f"  {col:20s} {hits[col]:>3}/{towns_with_code} towns")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
