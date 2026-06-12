"""Reconciliation state machine: new / persist / resolve / sticky-benign / reopen."""

from scripts.analysis.gap_audit.finding import RawFinding
from scripts.analysis.gap_audit.reconcile import reconcile

EMPTY = {"by_metric": {}, "by_file": {}}        # provenance resolves to None


def _raw(metric, code="ZERO_CLUSTER", scope="*", sev="high"):
    return RawFinding("district", metric, code, scope, sev, "detail", None)


def test_new_finding_opens_and_is_marked_new():
    out = reconcile([_raw("m1")], [], "2026-06-06", manifest=EMPTY)
    assert len(out) == 1 and out[0].status == "open" and out[0].is_new


def test_new_finding_is_auto_classified():
    out = reconcile([_raw("nss_pct_of_required", "PCT_RANGE")], [], "2026-06-06", manifest=EMPTY)
    assert out[0].status == "benign"


def test_persist_keeps_decision_and_note_bumps_last_seen():
    prior = reconcile([_raw("m1")], [], "2026-06-01", manifest=EMPTY)
    prior[0].status, prior[0].reason, prior[0].note = "benign", "human ok", "ticket-42"
    out = reconcile([_raw("m1")], prior, "2026-06-06", manifest=EMPTY)
    f = out[0]
    assert f.status == "benign" and f.note == "ticket-42"
    assert f.first_seen == "2026-06-01" and f.last_seen == "2026-06-06"


def test_persist_refreshes_detail_and_severity():
    prior = reconcile([_raw("m1", sev="high")], [], "2026-06-01", manifest=EMPTY)
    out = reconcile([RawFinding("district", "m1", "ZERO_CLUSTER", "*", "med", "new detail", None)],
                    prior, "2026-06-06", manifest=EMPTY)
    assert out[0].severity == "med" and out[0].detail == "new detail"


def test_resolved_open_becomes_fixed():
    prior = reconcile([_raw("m1")], [], "2026-06-01", manifest=EMPTY)
    out = reconcile([], prior, "2026-06-06", manifest=EMPTY)
    assert out[0].status == "fixed" and out[0].is_resolved


def test_benign_is_sticky_and_untouched_when_it_disappears():
    prior = reconcile([_raw("m1")], [], "2026-06-01", manifest=EMPTY)
    prior[0].status = "benign"
    out = reconcile([], prior, "2026-06-06", manifest=EMPTY)
    assert out[0].status == "benign"               # NOT fixed
    assert out[0].last_seen == "2026-06-01"         # not bumped (wasn't raised)


def test_fixed_reopens_loudly_on_reappearance():
    prior = reconcile([_raw("m1")], [], "2026-06-01", manifest=EMPTY)
    fixed = reconcile([], prior, "2026-06-02", manifest=EMPTY)
    assert fixed[0].status == "fixed"
    out = reconcile([_raw("m1")], fixed, "2026-06-06", manifest=EMPTY)
    assert out[0].status == "open" and out[0].is_new
    assert any("reopened" in h["event"] for h in out[0].history)
    assert out[0].first_seen == "2026-06-01"         # history preserved
