# SESSION S5 — Progression

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/progression`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S5:progression ──`.

## The gap
**Progression** is one metric (`grade_retention_pct`). Missing the early-warning
indicators that predict dropout and read intuitively to parents — the "is my kid on
track" lens.

## ⚠️ Start with a source spike (≤30 min)
9th-grade-on-track and course-pass/fail rates are **not always published at district
level on Socrata**. Before building, confirm what exists on
`educationtocareer.data.mass.gov` (search "on track", "ninth grade", "course pass",
"credits", "promotion", "retention"). Build the metrics that have a real source; for
the rest, write a one-paragraph "no accessible district-level source" note in the PR and
move on. Do not fabricate.

## What to build (proposed — keep only the ones with a source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `ninth_grade_on_track_pct` | % 9th Graders On Track | Progression | `["district"]` | `GnBu` | `pct` |
| `course_fail_pct` | % Course Failures (secondary) | Progression | `["district"]` | `OrRd` | `pct` |
| `over_age_grade_pct` | % Students Over-Age for Grade | Progression | `["district"]` | `OrRd` | `pct` |

## Files you create
- `scripts/fetch_progression.py`
- `data/ma_district_progression.json`

## Source
📌 **Base dataset `c8ur-ajfv`** — DESE grade retention, behind the existing
`grade_retention_pct` (copy `scripts/fetch_retention.py`). 9th-grade-on-track /
course-pass-fail / over-age are **not** in any existing fetcher and may not be on Socrata
at all — that's exactly what the spike above resolves. Don't fabricate if absent.

## Steps
1. Spike the source; decide the shippable subset.
2. Copy `scripts/fetch_retention.py`; write fetcher; `null` for suppressed/non-HS.
3. Register path + metrics under `// ── S5:progression ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- Every shipped metric has a real, cited source; coverage documented.
- If only 1 is feasible, that's fine — ship it and document the rest as unavailable.

## Risk: Med. The metrics are valuable but district-level sourcing is the open question.
