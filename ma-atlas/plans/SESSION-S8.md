# SESSION S8 — Workforce completeness

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/workforce`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S8:workforce ──`.

## The gap
**Workforce** (13 metrics) has specific holes: staff race covers white/hispanic/black
but **no Asian** (so the race set is incomplete and shares don't reconcile), and there's
no teacher-credential-depth or staffing-structure lens.

## What to build (proposed — confirm at source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `staff_asian_pct` | % Staff — Asian | Workforce | `["district"]` | `Blues` | `pct` |
| `teacher_masters_plus_pct` | % Teachers with Master's+ | Workforce | `["district"]` | `Greens` | `pct` |
| `students_per_admin` | Students per Administrator | Workforce | `["district"]` | `Reds` | `num` |
| `para_per_100_students` | Paraprofessionals per 100 Students | Workforce | `["district"]` | `PuBuGn` | `num` |

- `staff_asian_pct` completes the existing white/hispanic/black/`educators_of_color`
  family — highest-value, lowest-risk item here.
- `students_per_admin` mirrors the existing `students_per_*` support-staff ratios
  (remember: **lower is better**, so use a `Reds` ramp where dark = higher = worse, like
  the Student-support metrics).

## Files you create
- `scripts/fetch_educator3.py`
- `data/ma_district_educator3.json`

## Source
📌 **Base datasets (educator family):** `2hei-cc7k`, `4684-cw3t`, `er3w-dyti` (via
`fetch_educator_detail.py`) and `52c5-e56a`, `fz9c-2g33` (via `fetch_educator_detail2.py`).
Staff race/ethnicity + teacher-degree + FTE-by-role columns live in this family — inspect
these first (start with the educator2 pair) before looking elsewhere.

DESE Educator / Staffing data on `educationtocareer.data.mass.gov` — search "staff",
"educator", "teacher", "race", "degree", "FTE". `scripts/fetch_educator_detail.py` and
`fetch_educator_detail2.py` are your templates (salary/licensure/retention/diversity
come from this family). Staff-by-race and FTE-by-role are sibling columns.

## Steps
1. Copy `scripts/fetch_educator_detail2.py`; resolve the staff-race + degree + FTE columns.
2. Write fetcher; `null` where unreported. Watch for `0`-FTE → store `null`, not a huge
   ratio (see anomalies Issue 10/11 for the support-staff version of this trap).
3. Register path + metrics under `// ── S8:workforce ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- `staff_asian_pct` paints and the four staff-race shares now read as a complete set.
- Ratio metrics use `num` + the "lower is better" `Reds` convention.

## Risk: Low-Med. Staff race is straightforward; degree/FTE columns to confirm.
