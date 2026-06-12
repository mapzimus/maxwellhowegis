"""Build the entity tables the audit sweeps, exactly as the app paints them.

- district: reused verbatim from ``compute_correlations.build_district_table`` (the
  kept module) — geojson + every ``ma_district_*.json`` side file + derived metrics.
- muni: relocated here from ``audit_quality.build_muni_table`` so the package has no
  live dependency on a script scheduled for retirement.
- school / colleges / private / childcare: new builders over their GeoJSONs.

Every table carries ``_lon``/``_lat`` derived from ``geometry.coordinates`` (falling
back to lon/lat properties) so geometry can be validated on any layer.

``Tables`` is a lazy accessor: each layer is built once, on first request.
"""

import json
import os
import sys

import pandas as pd

from .config import ANALYSIS_DIR, DATA
from .catalog import load_catalog

# Import the kept engine. compute_correlations lives one dir up (scripts/analysis).
if ANALYSIS_DIR not in sys.path:
    sys.path.insert(0, ANALYSIS_DIR)
import compute_correlations as cc  # noqa: E402  (path injected above)


# ── coordinate helper ────────────────────────────────────────────────────────
def _attach_coords(props, feature):
    """Set props['_lon']/['_lat'] from geometry.coordinates, else lon/lat props."""
    coords = (feature.get("geometry") or {}).get("coordinates")
    if isinstance(coords, (list, tuple)) and len(coords) >= 2 \
            and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
        props["_lon"], props["_lat"] = coords[0], coords[1]
    else:
        props["_lon"], props["_lat"] = props.get("lon"), props.get("lat")
    return props


# ── district (reused) ────────────────────────────────────────────────────────
def build_district_table():
    return cc.build_district_table()        # (df indexed by DIST_CODE, side_files)


# ── muni (relocated from audit_quality.build_muni_table) ─────────────────────
def build_muni_table():
    geo = json.load(open(os.path.join(DATA, "ma_municipalities.geojson"), encoding="utf-8"))
    props = {}
    for f in geo["features"]:
        tid = str(f["properties"].get("TOWN_ID", "")).strip()
        if not tid:
            continue
        p = dict(f["properties"])
        pop = p.get("POP2020") or p.get("pop_2020")
        p["_pop_2020"] = pop or None
        try:
            from shapely.geometry import shape
            a = shape(f["geometry"]).area      # deg^2 proxy — just needs to exist
            p["_area_sqmi"] = a if a > 0 else None
            p["_pop_density_per_sqmi"] = (pop / a) if (pop and a > 0) else None
        except Exception:
            p["_area_sqmi"] = None
            p["_pop_density_per_sqmi"] = None
        props[tid] = p

    muni_files = sorted(
        fn for fn in os.listdir(DATA)
        if fn.startswith("ma_muni_") and fn.endswith(".json")
    )
    for fn in muni_files:
        d = json.load(open(os.path.join(DATA, fn), encoding="utf-8"))
        for tid, row in d.items():
            tid = str(tid).strip()
            if tid in props and isinstance(row, dict):
                props[tid].update(row)

    df = pd.DataFrame.from_dict(props, orient="index")
    df.index.name = "TOWN_ID"
    return df, muni_files


# ── public schools ───────────────────────────────────────────────────────────
def build_school_table():
    """SCHID-keyed table: public-school geojson props + merged sch_* metrics.

    Kept as a plain RangeIndex with SCHID as a column so duplicate SCHIDs stay
    visible to the checker (a dict index would silently collapse them).
    """
    geo = json.load(open(os.path.join(DATA, "ma_public_schools.geojson"), encoding="utf-8"))
    metrics = json.load(open(os.path.join(DATA, "ma_school_metrics.json"), encoding="utf-8"))
    rows = []
    for f in geo["features"]:
        p = _attach_coords(dict(f["properties"]), f)
        schid = str(p.get("SCHID", "")).strip()
        p["SCHID"] = schid
        m = metrics.get(schid)
        if isinstance(m, dict):
            p.update(m)                        # union of sch_* fields (varies per record)
        rows.append(p)
    return pd.DataFrame(rows)


# ── reference layers (colleges / private / childcare) ────────────────────────
REFERENCE_LAYERS = {
    "colleges": {"file": "ma_colleges.geojson", "key": "NAME"},
    "private":  {"file": "ma_private_schools.geojson", "key": "PPIN"},
    "childcare": {"file": "ma_childcare.geojson", "key": "NAME"},
}


def build_reference_table(name):
    spec = REFERENCE_LAYERS[name]
    geo = json.load(open(os.path.join(DATA, spec["file"]), encoding="utf-8"))
    rows = [_attach_coords(dict(f["properties"]), f) for f in geo["features"]]
    df = pd.DataFrame(rows)
    df.attrs["key"] = spec["key"]
    df.attrs["file"] = spec["file"]
    return df


# ── lazy accessor ────────────────────────────────────────────────────────────
class Tables:
    """Build each entity table at most once, on first access."""

    def __init__(self):
        self._cat = None
        self._district = None
        self._side = None
        self._muni = None
        self._muni_side = None
        self._school = None
        self._ref = {}

    @property
    def catalog(self):
        if self._cat is None:
            self._cat = load_catalog()
        return self._cat

    def district(self):
        if self._district is None:
            self._district, self._side = build_district_table()
        return self._district

    def side_files(self):
        self.district()
        return self._side

    def muni(self):
        if self._muni is None:
            self._muni, self._muni_side = build_muni_table()
        return self._muni

    def muni_side_files(self):
        self.muni()
        return self._muni_side

    def school(self):
        if self._school is None:
            self._school = build_school_table()
        return self._school

    def reference(self, name):
        if name not in self._ref:
            self._ref[name] = build_reference_table(name)
        return self._ref[name]
