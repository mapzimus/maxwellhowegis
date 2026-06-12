# SESSION S14 — Whole-child & facilities

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/whole-child-facilities`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S14:whole-child-facilities ──`.

## The gap
Two relatable, entirely-absent themes that map directly to the project's "approachable
for normal people" north-star:
1. **Whole-child / well-rounded** — arts, music, world language, PE, athletics, civics.
   ("Does this school have music and sports?" is a top parent question the atlas can't
   answer.)
2. **Facilities & technology (school-side)** — building age/condition, capacity/
   overcrowding, 1:1 devices. (Existing ACS tech metrics measure *households*, never the
   schools.)

## ⚠️ Spike first — highest source-uncertainty session; expect to split
Sources are scattered and some are non-DESE. Spend the first ~45 min confirming what's
queryable at district level, then **ship the feasible subset** and document the rest.
Strong candidate to split into two PRs on this branch:
- **S14a whole-child:** arts/world-language course enrollment (DESE course-taking data),
  athletics (likely **MIAA**, not DESE), civics (MA civics project — may be unpublished).
- **S14b facilities:** building age / capital projects (**MSBA**), capacity/utilization,
  devices (sparse).

## What to build (proposed — keep only the sourced ones)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `arts_enrollment_pct` | % Students Enrolled in Arts | Whole child | `["district"]` | `BuPu` | `pct` |
| `world_language_pct` | % Enrolled in World Language | Whole child | `["district"]` | `BuPu` | `pct` |
| `athletics_participation_pct` | % Participating in Athletics | Whole child | `["district"]` | `GnBu` | `pct` |
| `building_age_median` | Median School Building Age (yrs) | Facilities | `["district"]` | `Oranges` | `num` |
| `capacity_utilization_pct` | Building Capacity Utilization | Facilities | `["district"]` | `RdBu` | `pct` |

## Files you create
- `scripts/fetch_whole_child.py` → `data/ma_district_whole_child.json`
- `scripts/fetch_facilities.py` → `data/ma_district_facilities.json`

## Source
- Course-taking (arts, world language, PE): DESE course enrollment reports on
  `educationtocareer.data.mass.gov`.
- Athletics: MIAA (non-DESE) — confirm a usable district-level dataset exists; if not,
  document and drop.
- Facilities: MSBA capital pipeline + any DESE facility inventory. Likely partial.

## Steps
1. Spike both themes; decide the shippable subset (it's fine if facilities yields little
   — say so explicitly).
2. Write fetcher(s); `null` for unreported; cite each source + year.
3. Register path(s) + metrics under `// ── S14:whole-child-facilities ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- Whatever ships is sourced, dated, and paints correctly under "Whole child" / "Facilities".
- A short "sources checked / not feasible" note in the PR so the gap is documented, not
  silently dropped.

## Risk: High. Treat as exploratory; partial delivery is a success here.
