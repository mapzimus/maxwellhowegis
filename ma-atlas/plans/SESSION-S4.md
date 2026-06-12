# SESSION S4 — English learners build-out

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/el`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S4:el ──`.

## The gap
**English learners** is 3 metrics, and one (`el_exiting_pct`) is compromised by DESE
suppression (only districts ≥70% appear — see `scripts/analysis/data_anomalies.md`
Bug 5), so it paints a misleadingly rosy map. Missing the program-model and
composition lenses.

## What to build (proposed — confirm exact columns at the source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `el_newcomer_pct` | % of ELs Who Are Newcomers (≤1 yr in US) | English learners | `["district"]` | `BuPu` | `pct` |
| `el_long_term_pct` | % Long-Term English Learners | English learners | `["district"]` | `OrRd` | `pct` |
| `el_dual_language_pct` | % ELs in Dual-Language/Bilingual (vs SEI) | English learners | `["district"]` | `GnBu` | `pct` |
| `el_languages_count` | Distinct First Languages Spoken | English learners | `["district"]` | `YlGnBu` | `num` |

## Also do (small, in your PR)
Add a suppression note to the **existing** `el_exiting_pct` metric's label or tooltip
("~115 districts below DESE's 70% reporting floor show as no data"). This is the metric
object already in `METRICS` (not under your anchor) — a one-field label tweak is fine;
call it out in the PR so reviewers see the cross-edit.

## Files you create
- `scripts/fetch_el_detail.py`
- `data/ma_district_el_detail.json`

## Source
📌 **Base dataset `puw9-zucz`** — DESE EL progress/ACCESS, behind the existing
`el_proficiency_pct` (copy `scripts/fetch_el_progress.py`). Newcomer / long-term-EL /
program-model are likely **separate** datasets — discover via the catalog.

DESE English Learner / LEP reports on `educationtocareer.data.mass.gov` — search
"english learner", "EL", "LEP", "language". `scripts/fetch_el_progress.py` is your
template. Newcomer / long-term-EL / program-model availability varies; ship what's
queryable, document what isn't.

## Steps
1. Copy `scripts/fetch_el_progress.py`; resolve the relevant dataset(s).
2. Write fetcher; `null` for districts with too-few ELs (DESE suppresses heavily here).
3. Register path + metrics under `// ── S4:el ──` anchors; tweak `el_exiting_pct` note.
4. Verify per AGENTS.md.

## Acceptance
- ≥2 new EL metrics paint; coverage caveat documented (EL metrics are sparse by nature).
- `el_exiting_pct` now carries the suppression note.

## Risk: Med. EL composition data is uneven; some proposed metrics may not be published.
