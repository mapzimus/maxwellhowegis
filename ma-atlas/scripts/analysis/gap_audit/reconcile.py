"""Reconcile this run's raw findings against the prior registry.

The four transitions (keyed by fingerprint):
  PERSIST  (raw ∩ prior): carry status/reason/note/issue; refresh detail/stat/
           severity/provenance; bump last_seen. A `fixed` finding that reappears
           REOPENS (regressions are loud).
  NEW      (raw only): created `open`, then auto-classified (may flip benign/wontfix).
  RESOLVED (prior only): an open/investigating finding that's gone → `fixed`;
           a benign/wontfix decision is sticky and kept untouched (persists if it
           ever returns).

Decisions (benign/wontfix) and human notes are never overwritten — that's the
registry's memory.
"""

from .finding import Finding
from .provenance import manifest as M
from . import classify


def _dedupe(raws):
    """Collapse any duplicate fingerprints, keeping the highest severity."""
    order = {"high": 0, "med": 1, "low": 2}
    by_fp = {}
    for r in raws:
        fp = r.fingerprint()
        cur = by_fp.get(fp)
        if cur is None or order.get(r.severity, 3) < order.get(cur.severity, 3):
            by_fp[fp] = r
    return by_fp


def reconcile(raws, prior, today, manifest=None):
    manifest = manifest or M.load_manifest()
    raw_by = _dedupe(raws)
    prior_by = {f.fingerprint: f for f in prior}

    out = []
    to_classify = []          # NEW + reopened findings get auto-classified
    for fp in set(raw_by) | set(prior_by):
        r = raw_by.get(fp)
        p = prior_by.get(fp)

        if r is not None and p is not None:                 # PERSIST
            p.last_seen = today
            p.detail = r.detail
            p.stat = r.stat
            p.severity = r.severity
            p.provenance = M.resolve_for_finding(r, manifest)
            if p.status == "fixed":                         # REOPEN — regression
                p.status = "open"
                p.add_history(today, "reopened: reappeared after being fixed")
                p.is_new = True
                to_classify.append(p)
            out.append(p)

        elif r is not None:                                 # NEW
            f = Finding.from_raw(r, today, provenance=M.resolve_for_finding(r, manifest))
            f.is_new = True
            to_classify.append(f)
            out.append(f)

        else:                                               # RESOLVED (prior only)
            if p.status in ("benign", "wontfix", "fixed"):
                out.append(p)                               # sticky / already gone — keep as-is
            else:
                p.status = "fixed"
                p.add_history(today, "fixed: no longer raised")
                p.is_resolved = True
                out.append(p)

    classify.apply(to_classify)
    out.sort(key=lambda f: f.fingerprint)   # deterministic order (set-union iteration is PYTHONHASHSEED-dependent)
    return out
