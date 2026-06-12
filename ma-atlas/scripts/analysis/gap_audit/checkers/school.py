"""Public-school checker — coverage + light quality over the sch_* metric fields.

Schools are a reference/popup layer (not a choropleth), so this runs a trimmed set
of quality flags (PCT_RANGE, ZERO_CLUSTER, DISTINCT_LE2) plus key-uniqueness,
geometry, and a "schools with no metrics row" coverage signal.
"""

import pandas as pd

from .base import LayerChecker, RawFinding, register, slim_stat
from . import quality_engine as qe


def _sch_format(field):
    low = field.lower()
    if "per_pupil" in low:
        return "usd"
    if "pctile" in low:                          # a 0-100 percentile, NOT a 0-1 share
        return "num"
    if low.endswith("_pct") or low.endswith("_me") or "low_income" in low:
        return "pct"
    return "num"          # enrollment, class_size, accountability_pctile


def _light_flags(field, fmt, st):
    out = []
    if fmt == "pct" and (st["max"] > 1.0001 or st["min"] < -1e-6):
        out.append(("PCT_RANGE", "high",
                    f"pct range [{st['min']:.4g}, {st['max']:.4g}] outside [0,1]"))
    if qe.zero_is_implausible(field) and st["zero_share"] > 0.02 and st["exact_zero"] >= 2:
        out.append(("ZERO_CLUSTER", "high",
                    f"{st['exact_zero']} exact-0 ({st['zero_share']*100:.0f}%) "
                    f"where 0 is implausible → likely 0-for-null"))
    if st["distinct"] <= 2:
        out.append(("DISTINCT_LE2", "high",
                    f"only {st['distinct']} distinct value(s)"))
    return out


@register
class SchoolChecker(LayerChecker):
    level = "school"

    def applicable(self, tables):
        try:
            return tables.school() is not None
        except Exception:
            return False

    def check(self, tables):
        df = tables.school()

        # key uniqueness (SCHID is a true id — a dup is a real join bug)
        kv = df["SCHID"].astype(str)
        for schid in sorted(set(kv[kv.duplicated() & (kv.str.strip() != "")])):
            yield RawFinding("school", "SCHID", "KEY_DUP", schid, "high",
                             f"SCHID {schid} appears on multiple school features", None)

        # geometry
        nogeo = int((df["_lon"].isna() | df["_lat"].isna()).sum())
        if nogeo:
            yield RawFinding("school", "geometry", "NULL_GEOMETRY", "*", "high",
                             f"{nogeo} schools missing coordinates", {"count": nogeo})

        # schools present on the map but with no metrics row
        if "sch_enrollment" in df.columns:
            nom = int(pd.to_numeric(df["sch_enrollment"], errors="coerce").isna().sum())
            if nom:
                yield RawFinding("school", "sch_metrics", "SCHOOLS_NO_METRICS", "*", "med",
                                 f"{nom} schools have no metrics row (no sch_enrollment) "
                                 f"— popup shows blank fields", {"count": nom})

        # light quality on the numeric sch_* fields
        for field in [c for c in df.columns if c.startswith("sch_")]:
            st = qe.col_stats(df[field])
            if st is None:
                continue
            for code, sev, detail in _light_flags(field, _sch_format(field), st):
                yield RawFinding("school", field, code, "*", sev, detail, slim_stat(st))
