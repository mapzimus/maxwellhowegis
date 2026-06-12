"""Cross-column / structural checker — migrated from ``audit_data.py``.

These are the checks that surface the *real, fillable* bugs the per-column engine
can't see: relationships between columns (cohort sums), join integrity (orphan
codes, value collisions), named-entity presence (missing regional HS districts),
and known artifacts (MHI ceiling off-by-one, zero-enrollment shells).

Findings here are mostly entity-scoped (scope = district code or a named target)
so fixing one district resolves exactly one finding.
"""

import json
import os

from .base import LayerChecker, RawFinding, register
from . import quality_engine as qe
from ..config import DATA

ACADEMIC_GEOJSON = "ma_academic_districts.geojson"

COHORT_FIELDS = [
    "grad_4yr", "dropout_pct", "still_enrolled_pct",
    "ged_pct", "non_grad_completer_pct", "permanently_excluded_pct",
]

# Regional HS districts whose presence is explicitly checked (DESE org names).
REGIONAL_HS_TARGETS = [
    "Concord-Carlisle", "Lincoln-Sudbury", "Nauset", "King Philip",
    "Masconomet", "Northboro-Southboro", "Dover-Sherborn", "Hamilton-Wenham",
    "Dennis-Yarmouth",
]

MHI_FIELD = "acs_median_household_income"
MHI_CAP = 250000        # ACS top-code; a value ABOVE it is a pipeline off-by-one


def _load_side_files():
    """Return {basename: dict} for every ma_district_*.json side file."""
    out = {}
    for fn in sorted(os.listdir(DATA)):
        if fn.startswith("ma_district_") and fn.endswith(".json"):
            with open(os.path.join(DATA, fn), encoding="utf-8") as fh:
                out[fn] = json.load(fh)
    return out


def _load_geojson_props():
    with open(os.path.join(DATA, ACADEMIC_GEOJSON), encoding="utf-8") as fh:
        geo = json.load(fh)
    props = {}
    for f in geo["features"]:
        code = str(f["properties"].get("DIST_CODE", "")).strip()
        if code:
            props[code] = dict(f["properties"])
    return props


def _values_differ(a, b):
    """True if a and b genuinely differ. Numeric values compare with a tiny
    tolerance so float-representation noise (0.736 vs 0.7360000001) is ignored;
    real precision mismatches (0.9 vs 0.869) still count."""
    na, nb = qe.num(a), qe.num(b)
    if na is not None and nb is not None:
        return abs(na - nb) > 1e-9
    return a != b


@register
class CrossColumnChecker(LayerChecker):
    level = "district"

    def check(self, tables):
        df = tables.district()

        # ── 1) 4-year cohort sum should be ~1.0 ──────────────────────────────
        for code in df.index:
            vals = [qe.num(df.at[code, f]) if f in df.columns else None
                    for f in COHORT_FIELDS]
            if all(v is not None for v in vals):
                total = sum(vals)
                if abs(total - 1.0) > 0.05:
                    name = df.at[code, "DIST_NAME"] if "DIST_NAME" in df.columns else code
                    yield RawFinding(
                        "district", "grad_cohort_sum", "COHORT_SUM", code, "med",
                        f"{name} ({code}): 4-yr cohort components sum to {total:.3f} "
                        f"(should be ~1.0) — likely still_enrolled/grad cohort overlap",
                        {"sum": round(total, 4)})

        # ── 2) college enrollment total ~= 4yr + 2yr ─────────────────────────
        for code in df.index:
            total = qe.num(df.at[code, "college_enroll_pct"]) if "college_enroll_pct" in df.columns else None
            yr4 = qe.num(df.at[code, "college_enroll_4yr_pct"]) if "college_enroll_4yr_pct" in df.columns else None
            yr2 = qe.num(df.at[code, "college_enroll_2yr_pct"]) if "college_enroll_2yr_pct" in df.columns else None
            if None not in (total, yr4, yr2) and abs(total - (yr4 + yr2)) > 0.05:
                yield RawFinding(
                    "district", "college_enroll_sum", "COLLEGE_SUM", code, "med",
                    f"{code}: college total {total:.3f} != 4yr+2yr ({yr4 + yr2:.3f})",
                    {"diff": round(total - (yr4 + yr2), 4)})

        # ── 3) MHI off-by-one above the ACS $250k cap ────────────────────────
        if MHI_FIELD in df.columns:
            for code in df.index:
                mhi = qe.num(df.at[code, MHI_FIELD])
                if mhi is not None and mhi > MHI_CAP:
                    name = df.at[code, "DIST_NAME"] if "DIST_NAME" in df.columns else code
                    yield RawFinding(
                        "district", MHI_FIELD, "MHI_CEILING", code, "high",
                        f"{name} ({code}): MHI={mhi:,.0f} exceeds the ACS ${MHI_CAP:,} "
                        f"cap — clamp to {MHI_CAP:,} (off-by-one mis-bins the choropleth)",
                        {"value": mhi})

        # ── 4) zero-enrollment shells (TOTAL_CNT == 0, not null) ─────────────
        if "TOTAL_CNT" in df.columns:
            for code in df.index:
                if qe.num(df.at[code, "TOTAL_CNT"]) == 0.0:
                    name = df.at[code, "DIST_NAME"] if "DIST_NAME" in df.columns else code
                    acs = df.at[code, "avg_class_size"] if "avg_class_size" in df.columns else None
                    yield RawFinding(
                        "district", "TOTAL_CNT", "ZERO_ENROLLMENT", code, "high",
                        f"{name} ({code}): TOTAL_CNT=0 (not null) — all enrollment-derived "
                        f"ratios become 0/0 artifacts (avg_class_size={acs})", None)

        # ── 5) named regional HS districts that are entirely absent ──────────
        names = [str(v).lower() for v in
                 (df["DIST_NAME"].tolist() if "DIST_NAME" in df.columns else []) if v]
        for target in REGIONAL_HS_TARGETS:
            if not any(target.lower() in n for n in names):
                yield RawFinding(
                    "district", "regional_hs", "REGIONAL_HS_ABSENT", target, "high",
                    f"Regional HS district '{target}' is absent from the academic "
                    f"geojson — its HS metrics populate member towns but it has no "
                    f"record of its own", None)

        # ── 6) join integrity: orphan side-file codes + value collisions ─────
        props = _load_geojson_props()
        valid = set(props.keys())
        side = _load_side_files()

        for fn, data in side.items():
            for orphan in sorted(set(data.keys()) - valid):
                yield RawFinding(
                    "district", fn, "ORPHAN_CODE", orphan, "med",
                    f"{fn}: key '{orphan}' matches no academic district code", None)

        # A column written by two sources with disagreeing values is ONE structural
        # problem (merge order decides what the app paints), not one bug per district
        # — aggregate by column so a systematic mismatch is a single finding.
        collisions = {}   # col -> {count, files:set, example}
        merged = {c: dict(p) for c, p in props.items()}
        merged_src = {}   # (code, col) -> source filename that set the current value
        for fn, data in side.items():
            for code, vals in data.items():
                if code not in merged or not isinstance(vals, dict):
                    continue
                for col, val in vals.items():
                    cur = merged[code].get(col)
                    if cur is not None and val is not None and _values_differ(cur, val):
                        c = collisions.setdefault(col, {"count": 0, "files": set(), "example": None})
                        c["count"] += 1
                        c["files"].update({merged_src.get((code, col), "geojson"), fn})
                        if c["example"] is None:
                            c["example"] = f"{code}: {cur!r} vs {val!r}"
                    elif val is not None:
                        merged[code][col] = val
                        merged_src[(code, col)] = fn

        for col, info in sorted(collisions.items()):
            files = ", ".join(sorted(info["files"]))
            yield RawFinding(
                "district", col, "VALUE_COLLISION", "*", "high",
                f"{col}: {info['count']} districts disagree across sources ({files}); "
                f"merge order decides what the map paints — e.g. {info['example']}",
                {"count": info["count"]})
