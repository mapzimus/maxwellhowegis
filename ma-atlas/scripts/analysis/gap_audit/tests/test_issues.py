"""GitHub issue sync — pure planning logic + marker round-trip (no network)."""

from scripts.analysis.gap_audit.finding import Finding, RawFinding
from scripts.analysis.gap_audit import issues


def _f(metric="m", code="KEY_DUP", sev="high", scope="*", status="open",
       detail="d", prov=None):
    f = Finding.from_raw(RawFinding("school", metric, code, scope, sev, detail, None),
                         "2026-06-06", provenance=prov)
    f.status = status
    return f


def test_want_set_is_high_and_open_or_investigating():
    fs = [_f(metric="a", sev="high", status="open"),
          _f(metric="b", sev="med", status="open"),
          _f(metric="c", sev="high", status="benign"),
          _f(metric="d", sev="high", status="investigating")]
    want = issues.want_set(fs)
    assert len(want) == 2
    assert all(f.severity == "high" and f.status in ("open", "investigating")
               for f in want.values())


def test_issue_body_marker_round_trips():
    f = _f(detail="some detail", prov={"refill_command": "python x.py"})
    m = issues.MARKER_RE.search(issues.issue_body(f))
    assert m and m.group(1) == f.fingerprint and m.group(2) == issues.vhash(f)


def test_vhash_changes_when_content_changes():
    assert issues.vhash(_f(detail="d1")) != issues.vhash(_f(detail="d2"))


def test_plan_sync_create_noop_update_reopen_close():
    f = _f(metric="m1", detail="d1")
    want = {f.fingerprint: f}

    # nothing exists -> create
    a = issues.plan_sync(want, {})
    assert len(a["create"]) == 1 and not a["update"] and not a["close"]

    # same content, open -> idempotent no-op
    a = issues.plan_sync(want, {f.fingerprint: {"number": 7, "vhash": issues.vhash(f), "state": "open"}})
    assert not a["create"] and not a["update"] and not a["close"]

    # stale content -> update
    a = issues.plan_sync(want, {f.fingerprint: {"number": 7, "vhash": "000000", "state": "open"}})
    assert len(a["update"]) == 1

    # wanted but closed -> update (reopen)
    a = issues.plan_sync(want, {f.fingerprint: {"number": 7, "vhash": issues.vhash(f), "state": "closed"}})
    assert len(a["update"]) == 1

    # open issue no longer wanted -> close
    a = issues.plan_sync(want, {"ffffffffffff": {"number": 9, "vhash": "abc", "state": "open"}})
    assert a["close"] == [9] and len(a["create"]) == 1
