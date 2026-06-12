"""Auto-classifier — benign/wontfix rules fire only where intended; real bugs stay open."""

from scripts.analysis.gap_audit.finding import Finding, RawFinding
from scripts.analysis.gap_audit import classify, seeds


def _f(flag, metric, scope="*", stat=None, prov=None, sev="high"):
    raw = RawFinding("district", metric, flag, scope, sev, "detail", stat)
    return Finding.from_raw(raw, "2026-06-06", provenance=prov)


def test_ledger_seed_has_vocal():
    lw = seeds.load_ledger_wontfix()
    assert "bfp2-2pmt" in lw and "state-level" in lw["bfp2-2pmt"].lower()


def test_nss_ratio_pct_range_is_benign():
    assert classify.auto_status(_f("PCT_RANGE", "nss_pct_of_required"))[0] == "benign"


def test_diverging_trend_pct_range_is_benign():
    assert classify.auto_status(_f("PCT_RANGE", "enroll_change_10yr"))[0] == "benign"


def test_tiny_district_zero_is_benign():
    assert classify.auto_status(_f("TINY_DIST_ZERO", "avg_class_size", scope="01090000"))[0] == "benign"


def test_rare_event_low_variance_is_benign():
    assert classify.auto_status(_f("LOW_VARIANCE", "permanently_excluded_pct"))[0] == "benign"


def test_saturating_ceiling_is_benign():
    assert classify.auto_status(_f("CEIL_TRUNC", "full_day_k_pct", sev="med"))[0] == "benign"


def test_coverage_at_universe_is_benign():
    f = _f("COVERAGE_GAP", "cte_x", sev="med",
           stat={"coverage": 60, "universe_expected": 60, "universe": "cte"})
    assert classify.auto_status(f)[0] == "benign"


def test_real_bugs_stay_open():
    assert classify.auto_status(_f("MHI_CEILING", "acs_median_household_income", scope="00510000")) is None
    assert classify.auto_status(_f("ZERO_ENROLLMENT", "TOTAL_CNT", scope="01090000")) is None
    assert classify.auto_status(_f("COHORT_SUM", "grad_cohort_sum", scope="00070000", sev="med")) is None
    assert classify.auto_status(_f("VALUE_COLLISION", "teacher_retention_pct")) is None


def test_apply_updates_status_and_records_history():
    fs = [_f("PCT_RANGE", "nss_pct_of_required"),
          _f("MHI_CEILING", "acs_median_household_income")]
    n = classify.apply(fs)
    assert n == 1
    assert fs[0].status == "benign"
    assert any("auto-benign" in h["event"] for h in fs[0].history)
    assert fs[1].status == "open"          # real bug untouched
