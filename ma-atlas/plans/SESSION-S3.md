# SESSION S3 — Special education build-out

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/sped`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S3:sped ──`.

## The gap
**Special education** is 4 metrics, all about placement setting (inclusion / separate /
out-of-district). Missing the prevalence-by-disability and compliance lenses DESE
publishes. (`SWD_PCT` prevalence lives in Demographics; SWD outcomes live in Equity gaps.)

## What to build (proposed — confirm exact columns at the source)
% of a district's students-with-disabilities in each primary disability category:
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `sped_specific_learning_pct` | SWD — Specific Learning Disability | Special education | `["district"]` | `BuPu` | `pct` |
| `sped_communication_pct` | SWD — Communication | Special education | `["district"]` | `BuPu` | `pct` |
| `sped_autism_pct` | SWD — Autism | Special education | `["district"]` | `BuPu` | `pct` |
| `sped_health_pct` | SWD — Health (incl. ADHD) | Special education | `["district"]` | `BuPu` | `pct` |
| `sped_emotional_pct` | SWD — Emotional | Special education | `["district"]` | `BuPu` | `pct` |
| `sped_eval_ontime_pct` | % Special-Ed Evaluations On Time | Special education | `["district"]` | `GnBu` | `pct` |

Pick the categories DESE actually publishes (the five above are the largest; add
"Intellectual", "Neurological", "Sensory" if the source has them and coverage is decent).

## Files you create
- `scripts/fetch_sped_detail.py`
- `data/ma_district_sped_detail.json`

## Source
📌 **Base dataset `n62c-bx65`** — DESE SpEd placement, behind the existing
inclusion/separate/out-of-district metrics (copy `scripts/fetch_sped_placement.py`).
Disability-category prevalence may be a different breakdown of the same dataset or a
sibling — inspect `n62c-bx65`'s distinct dimension fields first, then discover if needed.

DESE Special Education reports on `educationtocareer.data.mass.gov` — search
"special education", "disability", "students with disabilities by disability". The
existing `scripts/fetch_sped_placement.py` (placement settings) is your template and
likely points at a sibling dataset. Evaluation-timeline / compliance may be a separate
report; include it if queryable, else drop and note.

## Steps
1. Copy `scripts/fetch_sped_placement.py`.
2. Resolve dataset; write fetcher; `null` for suppressed small subgroups.
3. Run; confirm category percentages are shares of SWD (not of all students) — label
   accordingly.
4. Register path + metrics under `// ── S3:sped ──` anchors.
5. Verify per AGENTS.md.

## Acceptance
- Disability-category metrics paint; each is a share of SWD, labeled clearly.
- Small-cell suppression stored as `null`, noted in docstring/PR.

## Risk: Med. Disability-category data exists; exact granularity/coverage to confirm.
