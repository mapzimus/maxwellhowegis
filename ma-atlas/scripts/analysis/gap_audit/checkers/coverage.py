"""District coverage checker — flags catalog metrics that fall short of their
*structural* universe (only all-class and HS-class metrics; partial metrics are
left to the quality engine + triage seeds).

Emits COVERAGE_GAP with the expected universe attached so the auto-classifier can
tell a real fill target (coverage << expected) from a complete one.
"""

import pandas as pd

from .base import LayerChecker, RawFinding, register
from .. import universes as U

# A coverage shortfall is only a clear fill candidate when it drops BELOW the HS
# universe — i.e. it can't be explained by "HS-only" or "single-town" structure.
# (Metrics at ~N_hs..N_op are almost always structurally partial.)
HS_FLOOR_SLACK = 10   # allow a little small-n suppression below N_hs
ABS_FLOOR = 10        # and at least this many districts short of its own universe


@register
class DistrictCoverageChecker(LayerChecker):
    level = "district"

    def check(self, tables):
        df = tables.district()
        cat = tables.catalog
        uni = U.compute_universes(df)
        op = list(uni["op_index"])
        floor = uni["N_hs"] - HS_FLOOR_SLACK

        for mid, meta in cat.items():
            if "district" not in meta["levels"] or mid not in df.columns:
                continue
            uname, expected = U.expected_for(mid, meta, uni)
            if not expected:                      # 'partial' class — not a fill target
                continue
            col = pd.to_numeric(df.loc[op, mid], errors="coerce")
            coverage = int(col.notna().sum())
            missing = expected - coverage
            if coverage < floor and missing >= ABS_FLOOR:
                yield RawFinding(
                    "district", mid, "COVERAGE_GAP", "*", "med",
                    f"covers {coverage}/{expected} {uname} districts "
                    f"({missing} below its universe, under the HS floor of {floor}) "
                    f"— candidate fill target",
                    {"coverage": coverage, "universe_expected": expected,
                     "universe": uname})
