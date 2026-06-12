"""Worklist rendering — ranking + source/refill must appear on every open finding."""

from scripts.analysis.gap_audit.finding import Finding, RawFinding
from scripts.analysis.gap_audit import report


def _f(metric, code, sev, scope="*", prov=None, status="open"):
    f = Finding.from_raw(RawFinding("district", metric, code, scope, sev,
                                    f"{metric} detail", None),
                         "2026-06-06", provenance=prov)
    f.status = status
    return f


def test_never_acceptable_flags_rank_to_the_top():
    keydup = _f("SCHID", "KEY_DUP", "high", prov={"refill_command": "x"})
    cohort = _f("grad_cohort_sum", "COHORT_SUM", "med", prov={"refill_command": "y"})
    assert report.rank(keydup) >= 100 > report.rank(cohort)


def test_fillability_penalizes_missing_refill_and_wontfix():
    assert report.fillability(_f("m", "X", "high", prov={"refill_command": "z"})) == 1.0
    assert report.fillability(_f("m", "X", "high", prov={})) < 1.0
    assert report.fillability(_f("m", "X", "high", prov={"refill_command": "z"},
                                 status="wontfix")) == 0.05


def test_markdown_carries_source_and_refill():
    md = report.render_md([_f("students_per_social_worker", "COVERAGE_GAP", "med",
                              prov={"upstream_source": "MA DESE",
                                    "refill_command": "python scripts/fetch_support_staff.py"})])
    assert "Source" in md and "Refill" in md
    assert "fetch_support_staff.py" in md and "MA DESE" in md


def test_csv_rows_carry_provenance_columns():
    rows = report.render_csv_rows([_f("m", "COVERAGE_GAP", "med",
                                      prov={"upstream_source": "S", "dataset_id": "d",
                                            "refill_command": "r"})])
    assert rows[0][8:11] == ["source", "dataset_id", "refill_command"]
    assert rows[1][8:11] == ["S", "d", "r"]


def test_report_output_is_order_independent():
    # rank ties must break deterministically (by fingerprint), not by input order,
    # or the worklist churns every run under a different PYTHONHASHSEED.
    fs = [_f(f"m{i}", "COVERAGE_GAP", "med", prov={"refill_command": "x"}) for i in range(6)]
    assert report.render_md(fs) == report.render_md(list(reversed(fs)))
    assert report.render_csv_rows(fs) == report.render_csv_rows(list(reversed(fs)))


def test_benign_appendix_groups_by_reason():
    f = _f("nss_pct_of_required", "PCT_RANGE", "high", status="benign")
    f.reason = "ratio by design"
    md = report.render_md([f])
    assert "Benign by design" in md and "ratio by design" in md
