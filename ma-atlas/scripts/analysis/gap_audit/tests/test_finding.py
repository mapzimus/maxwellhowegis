"""Fingerprint stability + record round-trip — the registry's correctness core."""

import hashlib
import os
import subprocess
import sys

from scripts.analysis.gap_audit.finding import (
    Finding, RawFinding, make_fingerprint,
)

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


def test_fingerprint_matches_sha1_definition():
    fp = make_fingerprint("district", "el_exiting_pct", "FLOOR_TRUNC", "*")
    expect = hashlib.sha1(
        "district\x1fel_exiting_pct\x1fFLOOR_TRUNC\x1f*".encode("utf-8")
    ).hexdigest()[:12]
    assert fp == expect
    assert len(fp) == 12


def test_fingerprint_whitespace_invariant():
    assert make_fingerprint(" district ", "m", "C", " * ") == \
           make_fingerprint("district", "m", "C", "*")


def test_fingerprint_distinguishes_each_component():
    base = make_fingerprint("district", "m", "C", "*")
    assert make_fingerprint("muni", "m", "C", "*") != base
    assert make_fingerprint("district", "m2", "C", "*") != base
    assert make_fingerprint("district", "m", "C2", "*") != base
    assert make_fingerprint("district", "m", "C", "01090000") != base


def test_fingerprint_stable_across_pythonhashseed():
    """The digest must NOT depend on PYTHONHASHSEED (rules out builtin hash())."""
    code = (
        "import sys; sys.path.insert(0, r'%s');"
        "from scripts.analysis.gap_audit.finding import make_fingerprint;"
        "print(make_fingerprint('district','el_exiting_pct','FLOOR_TRUNC','*'))"
    ) % _ROOT
    outs = []
    for seed in ("0", "1", "12345"):
        env = dict(os.environ, PYTHONHASHSEED=seed)
        r = subprocess.run([sys.executable, "-c", code],
                           capture_output=True, text=True, env=env)
        assert r.returncode == 0, r.stderr
        outs.append(r.stdout.strip())
    assert len(set(outs)) == 1, f"fingerprint varied across hashseeds: {outs}"
    assert outs[0] == make_fingerprint("district", "el_exiting_pct", "FLOOR_TRUNC", "*")


def test_from_raw_then_record_roundtrip():
    raw = RawFinding("district", "el_exiting_pct", "FLOOR_TRUNC", "*",
                     "high", "pct floor at 0.70", {"n": 159, "min": 0.7})
    f = Finding.from_raw(raw, "2026-06-06", provenance={"dataset_id": "x"})
    assert f.fingerprint == raw.fingerprint()
    assert f.verify_fingerprint()
    assert f.status == "open"
    assert f.history == [{"date": "2026-06-06", "event": "opened"}]

    rec = f.to_record()
    assert list(rec.keys())[0] == "fingerprint"   # canonical ordering
    f2 = Finding.from_record(rec)
    assert f2.to_record() == rec                   # lossless round-trip


def test_no_collisions_across_varied_inputs():
    seen = {}
    for lvl in ("district", "muni", "school", "colleges", "private", "childcare"):
        for met in ("a", "b", "el_exiting_pct", "mcas_g3_ela_me", "TOTAL_CNT"):
            for code in ("FLOOR_TRUNC", "ZERO_CLUSTER", "PCT_RANGE", "COVERAGE_GAP"):
                for scope in ("*", "01090000", "00730030"):
                    fp = make_fingerprint(lvl, met, code, scope)
                    key = (lvl, met, code, scope)
                    assert seen.get(fp, key) == key, f"collision: {key} vs {seen.get(fp)}"
                    seen[fp] = key
