# SESSION S9 — Trends (computed)

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/trends`.
> Anchor in `app.js` METRICS: `// ── S9:trends ──`. **You own `computeDerivedMetrics()`.**

## ⚠️ Reconcile first — known overlap
There is an in-flight branch **`claude/year-over-year-change`** (worktree `wt-yearchange`).
It very likely overlaps this work. **Before writing anything:**
```
git log origin/claude/year-over-year-change --oneline
git diff origin/main...origin/claude/year-over-year-change -- app.js
```
If it already adds trend metrics, **absorb/rebase onto it** instead of duplicating —
this session may reduce to "extend what's there." Coordinate, don't collide.

## The gap
**Trends** is 2 metrics, both enrollment (`enroll_change_5yr/10yr`). The atlas has a year
slider and year-keyed columns but no metric answers the most basic parent question:
**"is this district improving?"**

## What to build — computed, no new data file
These are derived in `computeDerivedMetrics(districts)` (app.js ~line 1022) from
existing **year-keyed** columns (the `<metric>__<year>` pattern; `enroll_change_*` is your
exact template — copy its structure). Diverging-around-zero → `RdBu`, `format:"pct"`
(point change) or `num`.

| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `mcas_g10_math_change_5yr` | Gr10 Math M+E — 5-yr Change | Trends | `["district"]` | `RdBu` | `pct` |
| `mcas_g10_ela_change_5yr` | Gr10 ELA M+E — 5-yr Change | Trends | `["district"]` | `RdBu` | `pct` |
| `grad_4yr_change_5yr` | 4-yr Graduation — 5-yr Change | Trends | `["district"]` | `RdBu` | `pct` |
| `low_income_change_5yr` | Low-Income Share — 5-yr Change | Trends | `["district"]` | `RdBu` | `pct` |

Only build a trend where the underlying metric is genuinely year-keyed with enough
history; check which columns carry `__<year>` variants before promising a metric.

## app.js edits (all yours)
1. Add the derivation logic inside `computeDerivedMetrics()`, next to the existing
   `enroll_change_5yr/10yr` block (same null-handling: need both endpoints, else `null`).
2. Append the metric objects under `// ── S9:trends ──` in `METRICS`.
3. No `DATA` map entry (nothing fetched).

## Steps
1. Reconcile with `claude/year-over-year-change` (above).
2. Identify year-keyed source columns; implement derivations mirroring `enroll_change_*`.
3. Add metrics under your anchor; verify per AGENTS.md (slider + console clean).

## Acceptance
- Each trend metric paints diverging around 0 (red=decline, blue=gain) and is `null`
  where an endpoint year is missing.
- No regression to existing enrollment-change metrics.

## Risk: Low on data (already in-repo); the real risk is duplicating the in-flight branch.
