# SESSION S1 — Accountability build-out

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/accountability`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S1:accountability ──`.

## The gap
The whole **Accountability** category is one metric (`pct_targets_met`). DESE runs a
rich district accountability framework that the atlas barely surfaces.

## What to build (proposed — confirm exact columns at the source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `accountability_percentile` | District Accountability Percentile | Accountability | `["district"]` | `PuBuGn` | `num` |
| `pct_schools_needing_support` | % of Schools Requiring Assistance/Intervention | Accountability | `["district"]` | `OrRd` | `pct` |
| `accountability_progress_pct` | Progress Toward Targets (cumulative) | Accountability | `["district"]` | `GnBu` | `pct` |

- `accountability_percentile`: DESE assigns the **percentile to schools**, not
  districts. Two valid paths: (a) pull a district-level accountability dataset if one
  exists, or (b) **roll up from `data/ma_school_metrics.json`** (it already carries a
  per-school accountability percentile) as an enrollment-weighted district mean. Prefer
  (a) if published; otherwise (b) and say so in the docstring + tooltip.
- `pct_schools_needing_support`: share of the district's schools classified in a
  support category — a relatable "how many of my schools are flagged" metric.

## Files you create
- `scripts/fetch_accountability_detail.py`
- `data/ma_district_accountability_detail.json`  (`{ DIST_CODE: {col: val} }`)

## Source
📌 **Base dataset `ppbc-i8t9`** — the DESE district accountability dataset behind the
existing `pct_targets_met` (copy `scripts/fetch_accountability.py`). Inspect its fields
first: it may already carry a percentile/target column. If district-level percentile
isn't there, roll it up from `data/ma_school_metrics.json` (per-school percentile) by
`DIST_CODE`.

DESE accountability data on `educationtocareer.data.mass.gov` (search the Socrata
catalog for "accountability"). Per-school fallback: `data/ma_school_metrics.json`
(roll up by `DIST_CODE`). Categorical "classification" text doesn't choropleth well —
prefer the numeric percentile + the %-of-schools share over a text class.

## Steps
1. Copy `scripts/fetch_accountability.py` as your template (it already pulls
   `pct_targets_met`); extend or parallel it.
2. Resolve the dataset id / or the per-school roll-up; write the fetcher; store `null`
   for non-accountable districts (small/charter/K-8 as DESE reports).
3. Run it; eyeball coverage (expect most operating districts; some excluded by design).
4. Register the data path under the `// ── S1:accountability ──` anchor in the `DATA` map.
5. Append the metric objects under the `// ── S1:accountability ──` anchor in `METRICS`.
6. Verify per AGENTS.md (`node --check app.js`, render, console clean).

## Acceptance
- New category shows 3 metrics that paint and rank correctly.
- Percentile is 1–99 (`num`), not a fraction; share metrics are 0–1 (`pct`).
- Docstring names the dataset/year and whether percentile is direct or rolled-up.

## Risk: Low. Known source family; per-school percentile already in-repo.
