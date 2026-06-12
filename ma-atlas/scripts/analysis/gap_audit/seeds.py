"""Triage seeds — institutional knowledge ingested so the auto-classifier can
pre-stamp findings without a human re-adjudicating every run.

- DATASETS-LEDGER.md "Skip — with reason" section → {dataset_id: reason}. A finding
  whose upstream dataset is on this list is un-fillable (e.g. VOCAL is state-only),
  so it is auto-set to `wontfix`.
- data_anomalies.md's 🟢 "Benign by design" knowledge is encoded as RULES in
  classify.py rather than parsed from prose (prose is not reliably machine-readable,
  and most of those benigns are already handled structurally by the universes /
  partial-class logic).
"""

import os
import re

from . import config

_ID = re.compile(r"`([0-9a-z]{4}-[0-9a-z]{4})`")


def load_ledger_wontfix(path=None):
    """Return {dataset_id: reason} for every dataset under the ledger's Skip section."""
    path = path or config.DATASETS_LEDGER
    out = {}
    if not os.path.exists(path):
        return out
    text = open(path, encoding="utf-8").read()
    m = re.search(r"##\s*Skip[^\n]*\n(.*?)(?:\n##|\Z)", text, re.S)
    if not m:
        return out
    for line in m.group(1).splitlines():
        ids = _ID.findall(line)
        if not ids:
            continue
        label = re.search(r"\*\*([^*]+)\*\*", line)
        reason = (label.group(1).strip() if label else line.strip(" -")).rstrip(":")
        for ds in ids:
            out[ds] = reason
    return out
