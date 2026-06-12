"""Provenance extraction — every finding must be attributable to a refill source."""

import pytest

from scripts.analysis.gap_audit.provenance import manifest as M


@pytest.fixture(scope="module")
def manifest():
    return M.build_manifest()


def test_every_metric_resolves(manifest):
    meta = manifest["_meta"]
    assert meta["metrics_unresolved"] == 0, manifest["unresolved"][:20]
    assert meta["metrics_resolved"] == meta["metrics_total"]


def test_socrata_metric_has_dataset_and_refill(manifest):
    r = M.resolve("mcas_g3_ela_me", manifest)
    assert r["dataset_id"] == "i9w6-niyt"
    assert "fetch_mcas_grades.py" in r["refill_command"]


def test_override_beats_autoseed_for_acs_aggregate(manifest):
    r = M.resolve("acs_median_household_income", manifest)
    assert r["resolution"] == "override"
    assert "aggregate_acs_to_districts.py" in r["refill_command"]


def test_derived_metric_is_computed(manifest):
    r = M.resolve("diversity_index", manifest)
    assert r["resolution"] == "computed"
    assert "recompute" in r["refill_command"].lower()


def test_source_string_is_not_a_template(manifest):
    # docstrings without a Source: line previously leaked f-string URL templates
    r = M.resolve("el_exiting_pct", manifest)
    assert "{" not in (r.get("upstream_source") or "")
    assert r["dataset_id"] == "puw9-zucz"
