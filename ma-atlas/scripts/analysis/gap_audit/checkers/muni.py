"""Muni-level full flag-engine checker.

Mirrors ``audit_quality.main`` for level=muni: per-metric flags, plus MUNI_BLANK
when a metric declares the muni level but the column is absent (high), all-null
(high), or thinly populated with n<30 (med).
"""

from .base import LayerChecker, RawFinding, register, slim_stat
from . import quality_engine as qe


@register
class MuniChecker(LayerChecker):
    level = "muni"

    def check(self, tables):
        df = tables.muni()
        cat = tables.catalog

        for mid, meta in cat.items():
            if "muni" not in meta["levels"]:
                continue
            if mid not in df.columns:
                yield RawFinding("muni", mid, "MUNI_BLANK", "*", "high",
                                 "declared level 'muni' but no such column at muni level", None)
                continue
            st = qe.col_stats(df[mid])
            palette = meta.get("palette") or ""
            if st is None:
                yield RawFinding("muni", mid, "MUNI_BLANK", "*", "high",
                                 "declared level 'muni' but column has 0 numerics", None)
                continue
            for code, sev, detail in qe.flags_for(mid, meta, palette, "muni", st):
                yield RawFinding("muni", mid, code, "*", sev, detail, slim_stat(st))
            if st["n"] < 30:
                yield RawFinding("muni", mid, "MUNI_BLANK", "*", "med",
                                 f"muni column has only n={st['n']} numerics", None)
