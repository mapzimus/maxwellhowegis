# SESSION S2 — Career / vocational build-out

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/vocational`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S2:vocational ──`.

## The gap
**Career / vocational** is a single metric (`cte_enrollment_pct`, only 60 districts) —
yet vocational education is a headline MA story and the regional voc-techs are a marquee
feature of the atlas. This is the thinnest category relative to its real-world weight.

## What to build (proposed — confirm exact columns at the source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `cte_completer_grad_pct` | CTE Completer 4-yr Graduation Rate | Career / vocational | `["district"]` | `GnBu` | `pct` |
| `cte_positive_placement_pct` | % CTE Completers Employed/Enrolled/Military | Career / vocational | `["district"]` | `GnBu` | `pct` |
| `cte_credentials_per_100` | Industry Credentials Earned per 100 CTE Students | Career / vocational | `["district"]` | `YlGnBu` | `num` |
| `cte_coop_pct` | % CTE Students in Co-op / Work-Based Learning | Career / vocational | `["district"]` | `YlGnBu` | `pct` |
| `chapter74_programs` | Chapter 74 Programs Offered | Career / vocational | `["district"]` | `YlGnBu` | `num` |

## Files you create
- `scripts/fetch_cte_detail.py`
- `data/ma_district_cte_detail.json`

## Source
📌 **Base dataset `9p45-t37j`** — Chapter 74 CTE enrollment, behind the existing
`cte_enrollment_pct` (copy `scripts/fetch_cte.py`). Completer outcomes / credentials /
co-op placement are **not** in any existing fetcher — discover those via the catalog.

DESE Career/Vocational Technical Education (Chapter 74) + Perkins reporting on
`educationtocareer.data.mass.gov`. Search the catalog for "vocational", "Chapter 74",
"career technical", "perkins", "industry-recognized credential". Coverage will be the
~60 in-district CTE hosts (others send students to regional voc-techs, by design — same
caveat as the existing `cte_enrollment_pct`). Store `null` elsewhere.

## Note on the regional voc-techs
The 26 standalone regional voc-tech districts live in `ma_districts_metrics.geojson`
(overlay), not the academic-district set, so most district metrics don't reach them.
**Do not** try to re-architect that here — keep S2 to district-level CTE metrics. If you
find a clean voc-tech-keyed dataset, note it in the PR as a follow-up.

## Steps
1. Copy `scripts/fetch_cte.py` as your template.
2. Resolve dataset id(s); write fetcher; `null` for non-CTE-host districts.
3. Run; confirm ~60 coverage (or as published).
4. Register path + metrics under the `// ── S2:vocational ──` anchors.
5. Verify per AGENTS.md.

## Acceptance
- ≥3 new vocational metrics paint correctly for the CTE-host districts.
- Rates are `pct` (0–1); counts are `num`. Coverage caveat in docstring + PR.

## Risk: Med. Source exists but column names/coverage need catalog confirmation.
