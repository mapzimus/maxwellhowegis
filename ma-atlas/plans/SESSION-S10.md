# SESSION S10 — Gender dimension

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/gender`.
> Anchors: `// ── S10:gender ──` (DATA + METRICS). **You own `KNOWN_GROUPS` + the
> group-column resolver.** This is the most architecturally distinct session — read all
> of it before starting.

## The gap
**Gender/sex is absent from the entire atlas** — no male/female anything (enrollment,
MCAS, graduation, dropout, discipline). DESE reports nearly all of these by gender, and
the student-group filter already has the machinery for exactly this kind of split.

## Approach — extend the student-group axis (preferred)
The app already filters metrics by subgroup via `KNOWN_GROUPS`
(`["hl","baa","as","wh","ell","fmrell","li","swd","hn"]`, app.js ~692) and a resolver
that reads `<metricId>__<grp>` columns (~app.js 788). **Add `male` and `female` as two
new groups**, then bake `__male`/`__female` columns onto a set of headline metrics so the
existing group dropdown can split them by sex.

Headline metrics to gender-split (where DESE publishes by gender): `grad_4yr`,
`dropout_pct`, `mcas_g10_ela_me`, `mcas_g10_math_me`, `mcas_g38_ela_me`,
`mcas_g38_math_me`, `disc_students_pct`. (Start with grad + the two Gr10 MCAS; expand if
time allows.)

## Your edits (all the shared group-logic is yours)
1. **Fetcher** `scripts/fetch_gender_splits.py` → writes `<metric>__male`/`__female`
   columns into a side file `data/ma_district_gender.json` (or bakes onto the geojson —
   match however the existing `__<grp>` columns are stored; check where e.g.
   `mcas_g10_math_me__li` lives and mirror it).
2. **`KNOWN_GROUPS`** — add `"male","female"` (app.js ~692).
3. **Group `<select>` options** — add "Male" and "Female" to the student-group dropdown
   (find where the existing groups populate the selector; mirror the labels).
4. **DATA map** — register the side file under `// ── S10:gender ──`.
5. Likely **no new METRICS entries** — gender rides existing metrics via the filter. If
   you prefer standalone gendered metrics instead, add them under the METRICS anchor;
   pick one approach and state it in the PR.

## Source
📌 ✅ **Confirmed live:** the MCAS dataset `i9w6-niyt` carries `stu_grp='Female'` and
`stu_grp='Male'` (285 districts each, SY2025) — so MCAS gender splits need **no new
source**, just the existing MCAS fetch pattern with a gender `stu_grp` filter (produce
`<metric>__male`/`__female` columns). Grad/dropout/discipline datasets have their own
gender/sex field — confirm the token per dataset (DESE usually uses `'Male'`/`'Female'`).

DESE — most achievement/grad/discipline reports have a Gender/Sex field. Reuse the
fetch pattern from whichever existing fetcher produced the metric you're splitting
(e.g. the grad and MCAS fetchers) and add the gender dimension to the query.

## Steps
1. Find how an existing `__<grp>` column is produced and stored; mirror it for `__male`/
   `__female`.
2. Wire `KNOWN_GROUPS` + the dropdown options.
3. Verify per AGENTS.md: pick a metric, switch the group filter to Male then Female,
   confirm the map repaints with different values and the tooltip notes the group.

## Acceptance
- Group dropdown offers Male/Female; selecting them repaints supported metrics.
- Unsupported metrics gracefully fall back to "all" (existing behavior — don't break it).
- `node --check app.js` clean; no console errors on group switch.

## Risk: Low-Med data; the care is in the shared group-resolver edits — keep them surgical.
