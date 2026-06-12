"""Auto-classifier — pre-stamps obvious benign / un-fillable findings so the open
worklist is the genuine residual (≈ the real bugs), not a wall of by-design noise.

Each rule is conservative and tied to a documented reason. A finding that matches no
rule stays `open` for a human. Decisions are sticky: once a human (or rule) sets
benign/wontfix, reconciliation never reverts it.
"""

import re

from . import seeds

# Ratio metrics that legitimately exceed 1.0 (NSS-vs-target spending ratios).
_RATIO_METRICS = {"nss_pct_of_required", "nss_pct_of_foundation"}

# Sub-per-thousand rare events: near-binary / near-constant is expected, not a bug.
_RARE_EVENT = ("expulsion", "permanently_excluded", "emergency_removal",
               "restraint", "arrest", "law_referral")

# Near-universal completion / access / licensure rates: a pile at ~1.0 is real
# saturation, not ceiling suppression.
_SATURATING = ("_access_pct", "licensed_pct", "full_day_k", "_retention_pct",
               "masscore", "staff_white_pct", "el_exiting", "school_police_pct")

_DIVERGING_OK = re.compile(r"(?:^|_)(change|gap|net|trend)(?:_|$)")


def _ledger():
    if not hasattr(_ledger, "_v"):
        _ledger._v = seeds.load_ledger_wontfix()
    return _ledger._v


def auto_status(f):
    """Return (status, reason) to stamp on a NEW finding, or None to leave it open.

    `f` is a Finding (has .flag_code, .metric, .scope, .level, .stat, .provenance).
    """
    code, mid = f.flag_code, f.metric

    # R1 — upstream dataset is documented un-fillable (ledger Skip section).
    ds = (f.provenance or {}).get("dataset_id")
    if ds and ds in _ledger():
        return ("wontfix", f"DATASETS-LEDGER: {_ledger()[ds]} (not fillable at this grain)")

    # R2 — pct-range that is correct by design.
    if code == "PCT_RANGE":
        if mid in _RATIO_METRICS:
            return ("benign", "ratio metric; >1.0 = above the required/foundation "
                              "minimum spending, by design")
        if _DIVERGING_OK.search(mid):
            return ("benign", "diverging trend/gap legitimately exceeds ±100%")

    # R3 — coverage exactly at the structural universe (not a real shortfall).
    if code == "COVERAGE_GAP" and f.stat:
        cov, exp = f.stat.get("coverage"), f.stat.get("universe_expected")
        if cov is not None and exp and abs(cov - exp) <= 2:
            return ("benign", f"coverage matches the {f.stat.get('universe')} "
                              f"structural universe ({cov}/{exp})")

    # R4 — tiny/intermittently-operating district stores 0 in a shell column.
    if code == "TINY_DIST_ZERO":
        return ("benign", "tiny/intermittently-operating district stores 0 in a "
                          "near-empty shell; negligible map impact")

    # R5 — rare-event discipline metric is near-binary / near-constant by nature.
    if code in ("DISTINCT_LE2", "LOW_VARIANCE") and any(s in mid for s in _RARE_EVENT):
        return ("benign", "sub-per-thousand rare event; near-binary/low-variance is "
                          "expected (data_anomalies Issue 9)")

    # R6 — ceiling pile at ~1.0 for a near-universal completion/access/licensure rate.
    if code == "CEIL_TRUNC" and any(s in mid for s in _SATURATING):
        return ("benign", "pile at ~1.0 is real saturation for a near-universal "
                          "completion/access/licensure metric")

    return None


def apply(findings):
    """In-place: stamp benign/wontfix on any OPEN finding an auto rule matches.

    Returns the count of findings auto-classified. Records a history event.
    """
    n = 0
    for f in findings:
        if f.status != "open":
            continue
        verdict = auto_status(f)
        if verdict:
            status, reason = verdict
            f.status, f.reason = status, reason
            f.add_history(f.last_seen, f"auto-{status}: {reason}")
            n += 1
    return n
