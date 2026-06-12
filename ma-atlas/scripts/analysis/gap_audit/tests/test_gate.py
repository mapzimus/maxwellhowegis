"""CI gate logic — fail only on NEW high/invariant findings; known + triaged pass."""

from scripts.analysis.gap_audit.finding import Finding, RawFinding
from scripts.analysis.gap_audit.gate import gate_violations


def _f(metric, code, sev, status="open"):
    f = Finding.from_raw(RawFinding("district", metric, code, "*", sev, "d", None),
                         "2026-06-06")
    f.status = status
    return f


def test_new_high_finding_fails():
    f = _f("m", "ZERO_ENROLLMENT", "high")
    assert gate_violations([f], set()) == [f]


def test_known_finding_passes():
    f = _f("m", "ZERO_ENROLLMENT", "high")
    assert gate_violations([f], {f.fingerprint}) == []


def test_new_med_non_invariant_passes():
    f = _f("m", "COVERAGE_GAP", "med")
    assert gate_violations([f], set()) == []


def test_new_invariant_flag_fails_even_at_med():
    f = _f("m", "PCT_RANGE", "med")            # PCT_RANGE ∈ NEVER_ACCEPTABLE
    assert gate_violations([f], set()) == [f]


def test_new_but_triaged_benign_passes():
    f = _f("m", "KEY_DUP", "high", status="benign")
    assert gate_violations([f], set()) == []
