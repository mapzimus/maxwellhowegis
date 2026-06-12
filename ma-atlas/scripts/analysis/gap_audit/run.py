"""Orchestrate one audit run: sweep → reconcile against the registry → persist.

Report writing (gaps.md/csv) and issue sync are layered on top by __main__.
"""

from .sweep import collect_raw
from .reconcile import reconcile
from . import registry_io
from .provenance import manifest as M


def run_audit(today=None, write=True):
    """Return (findings, tables, manifest). Writes registry + manifest when write."""
    today = today or registry_io.today_str()
    manifest = M.build_manifest()                 # fresh each run (data may have changed)
    if write:
        M.write_manifest(manifest=manifest)

    raws, tables = collect_raw()
    prior = registry_io.read_registry()
    findings = reconcile(raws, prior, today, manifest=manifest)

    if write:
        registry_io.write_registry(findings)
    return findings, tables, manifest
