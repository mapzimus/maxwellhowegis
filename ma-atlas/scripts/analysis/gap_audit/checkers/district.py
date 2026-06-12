"""District-level full flag-engine checker.

Mirrors the per-(metric, level) loop of ``audit_quality.main`` for level=district,
plus the two targeted district checks (tiny-district 0-for-null, year-keyed latest
gap). Catalog metrics with no district column are silently skipped — matching the
original, which recorded them as ``missing_cols`` but emitted no district flag.
"""

from .base import LayerChecker, RawFinding, register, slim_stat
from . import quality_engine as qe


@register
class DistrictChecker(LayerChecker):
    level = "district"

    def check(self, tables):
        df = tables.district()
        cat = tables.catalog

        # 1) per-metric quality flags
        for mid, meta in cat.items():
            if "district" not in meta["levels"]:
                continue
            if mid not in df.columns:
                continue                       # silent (parity with audit_quality)
            st = qe.col_stats(df[mid])
            palette = meta.get("palette") or ""
            if st is None:
                yield RawFinding("district", mid, "EMPTY", "*", "high",
                                 "declared level 'district' but column has 0 numerics", None)
                continue
            for code, sev, detail in qe.flags_for(mid, meta, palette, "district", st):
                yield RawFinding("district", mid, code, "*", sev, detail, slim_stat(st))

        # 2) targeted: tiny non-operating district stores 0 (not null) for a ratio
        for code, name, col, label in qe.tiny_district_zero_check(df, cat):
            yield RawFinding("district", col, "TINY_DIST_ZERO", code, "high",
                             f"{name} ({code}) stores 0 (not null) for '{label}'", None)

        # 3) targeted: year-keyed family whose latest year is far sparser than peak
        _, yk_flags = qe.year_family_check(df, cat)
        for base, latest, latest_n, peak, _years in yk_flags:
            yield RawFinding("district", base, "YEAR_LATEST_GAP", "*", "med",
                             f"latest year {latest} has n={latest_n} vs peak n={peak} "
                             f"→ latest SY may be incomplete/placeholder", None)
