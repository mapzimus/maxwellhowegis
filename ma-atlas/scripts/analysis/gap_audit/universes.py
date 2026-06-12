"""Expected-coverage universes — formalizes audit_coverage.py's ad-hoc operating /
HS proxies into per-metric expected denominators.

A coverage shortfall is only a *fillable* gap when the metric is one that should be
near-complete. Most low-coverage metrics are structurally partial (subgroups
suppressed by small-n, CTE only in ~60 hosts, early-college, equity gaps) — those
are classified "partial" and never flagged as coverage gaps.
"""

import re

import pandas as pd

# Same core-operating columns + null-rate threshold as compute_correlations, so the
# operating universe matches what the app/correlations treat as a real district.
CORE_COLS = ["TOTAL_CNT", "grad_4yr", "mcas_g38_ela_me", "mcas_g38_math_me",
             "attendance_rate", "per_pupil", "EL_PCT", "LI_PCT"]
NULL_RATE_DROP = 0.50

# A subgroup slice (suppressed by small-n) — structurally partial.
_SUBGROUP_SUFFIX = (
    "_black", "_hispanic", "_asian", "_multi", "_white", "_ell", "_swd",
    "_low_income", "_lowincome", "_high_needs", "_foster", "_homeless",
    "_military", "_female", "_male",
)
_PARTIAL_CATS = {
    "Achievement by group", "Achievement by group (Gr10)",
    "Achievement by group (other)", "Equity gaps", "Discipline by group",
    "Absenteeism by group", "English learners", "Career / vocational",
}
# Metrics that exist only where a high school operates (≈ districts with a grad rate).
_HS_CATS = {"Advanced coursework", "Postsecondary", "Postsecondary outcomes"}
_HS_ID_RE = re.compile(
    r"^(grad_|grad$|dropout|masscore|mcas_g10_|ap_|sat_|adv_course|"
    r"college_enroll|college_persist|pct_any_college|pct_\w+_college|"
    r"pct_work_after|pct_military|pct_4yr|pct_2yr)"
)
# Whole-cohort outcome components — reported only by HS-operating districts.
_HS_COHORT_IDS = {
    "still_enrolled_pct", "ged_pct", "non_grad_completer_pct",
    "permanently_excluded_pct", "masscore_pct", "dropout_pct", "dropout_annual_pct",
}


def operating_index(df):
    core = [c for c in CORE_COLS if c in df.columns]
    if not core:
        return set(df.index)
    null_rate = df[core].apply(pd.to_numeric, errors="coerce").isna().mean(axis=1)
    return set(df.index[null_rate <= NULL_RATE_DROP])


def compute_universes(df):
    op = operating_index(df)
    hs = set()
    if "grad_4yr" in df.columns:
        grad = pd.to_numeric(df["grad_4yr"], errors="coerce")
        hs = {c for c in op if pd.notna(grad.get(c))}
    return {"op_index": op, "N_op": len(op), "hs_index": hs, "N_hs": len(hs)}


def metric_class(mid, meta):
    """Return 'all' | 'hs' | 'partial'. Order matters: partial wins first."""
    cat = (meta.get("cat") or "")
    # ── structurally partial (never a fillable coverage gap) ─────────────────
    if cat in _PARTIAL_CATS or cat == "Enrollment flow":
        return "partial"
    if any(mid.endswith(s) for s in _SUBGROUP_SUFFIX):
        return "partial"
    if re.search(r"(?:^|_)gap(?:_|$)", mid):
        return "partial"
    if mid.startswith(("cte_", "chapter74", "early_college", "el_", "seda")):
        return "partial"
    if re.match(r"^mcas_g[3-8]_", mid):          # individual tested grade (grade-served)
        return "partial"
    # ── high-school-only ─────────────────────────────────────────────────────
    if mid in _HS_COHORT_IDS or "sgp_g10" in mid:
        return "hs"
    if cat in _HS_CATS or _HS_ID_RE.match(mid):
        return "hs"
    return "all"


def expected_for(mid, meta, uni):
    """Return (universe_name, expected_count_or_None) for a district metric."""
    cls = metric_class(mid, meta)
    if cls == "all":
        return ("operating", uni["N_op"])
    if cls == "hs":
        return ("hs", uni["N_hs"])
    return ("partial", None)
