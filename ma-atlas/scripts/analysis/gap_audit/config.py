"""Paths and shared constants for gap_audit.

Every path is derived from this file's location so the package works from any cwd
and on Windows or POSIX.
"""

import os

# ── Directories ──────────────────────────────────────────────────────────────
PKG_DIR = os.path.dirname(os.path.abspath(__file__))             # scripts/analysis/gap_audit
ANALYSIS_DIR = os.path.dirname(PKG_DIR)                          # scripts/analysis
ROOT = os.path.abspath(os.path.join(PKG_DIR, "..", "..", ".."))  # repo root
DATA = os.path.join(ROOT, "data")
APP_JS = os.path.join(ROOT, "app.js")

# ── Output artifacts ─────────────────────────────────────────────────────────
REGISTRY_PATH = os.path.join(ANALYSIS_DIR, "registry.jsonl")
MANIFEST_PATH = os.path.join(PKG_DIR, "provenance_manifest.json")
OVERRIDES_PATH = os.path.join(PKG_DIR, "provenance", "overrides.yml")
GAPS_MD = os.path.join(ANALYSIS_DIR, "gaps.md")
GAPS_CSV = os.path.join(ANALYSIS_DIR, "gaps.csv")
ISSUES_PLAN = os.path.join(ANALYSIS_DIR, "gaps_issues_plan.md")

# ── Triage seed sources (hand-written knowledge to ingest) ───────────────────
DATASETS_LEDGER = os.path.join(ROOT, "plans", "DATASETS-LEDGER.md")
DATA_ANOMALIES = os.path.join(ANALYSIS_DIR, "data_anomalies.md")

# ── Severity weights + the CI invariant gate ─────────────────────────────────
SEVERITY_W = {"high": 9, "med": 4, "low": 1}

# Flags that are NEVER acceptable on an OPEN finding (the hard gate). A by-design
# violation already classified benign/wontfix is exempt — the gate checks status==open.
NEVER_ACCEPTABLE = {
    "PCT_RANGE", "PCT_NEG", "USD_NONPOS", "NUM_SGP_RANGE", "KEY_DUP", "NULL_GEOMETRY",
}

STATUS_VALUES = ("open", "investigating", "benign", "wontfix", "fixed")
DECISION_STATES = ("benign", "wontfix")  # sticky human/rule decisions; survive disappearance
