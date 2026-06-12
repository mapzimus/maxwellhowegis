# SESSION S6 — MCAS completeness

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/mcas-completeness`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S6:mcas-completeness ──`.

## The gap
The MCAS set has three half-built holes:
1. **Grade grid:** Gr4 and Gr8 have **Math but not ELA** (`mcas_g4_math_me`,
   `mcas_g8_math_me` exist; the ELA twins don't).
2. **Subgroups:** `ma_district_mcas_groups` covers only low-income/SWD/ELL/Black/Hispanic
   — no **Asian / White / Multi-race**.
3. **No Gr10 (high-school) achievement-by-subgroup** at all (subgroup achievement is
   Gr3-8 only).

## What to build (proposed)
**Fill the grade grid:**
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `mcas_g4_ela_me` | MCAS Gr4 ELA % M+E | Academic | `["district"]` | `GnBu` | `pct` |
| `mcas_g8_ela_me` | MCAS Gr8 ELA % M+E | Academic | `["district"]` | `GnBu` | `pct` |

**Add subgroups (Gr3-8 M+E), mirroring the existing `mcas_ela_*`/`mcas_math_*`** — ship
the four with real coverage (skip American Indian / Native Hawaiian, see Source):
`mcas_ela_white`, `mcas_ela_high_needs`, `mcas_ela_multi`, `mcas_ela_asian`,
`mcas_math_white`, `mcas_math_high_needs`, `mcas_math_multi`, `mcas_math_asian`
→ cat `Achievement by group`, `pct`, `GnBu`/`BuPu`. (Grade-grid coverage is solid too:
g4 ELA 269 districts, g8 ELA 238.)

**Add Gr10 achievement-by-subgroup** (high-school gap lens), for low-income/SWD/ELL/
Black/Hispanic at minimum: e.g. `mcas_g10_ela_low_income`, `mcas_g10_math_swd`, … →
new cat `Achievement by group (Gr10)`, `pct`.

## Files you create
- `scripts/fetch_mcas_grades3.py` → `data/ma_district_mcas_grades3.json` (Gr4/Gr8 ELA)
- `scripts/fetch_mcas_groups2.py` → `data/ma_district_mcas_groups2.json` (new subgroups + Gr10-by-group)

(Create **new** files rather than editing the existing `*_grades*`/`*_groups` files, so
your data writes don't overlap anyone else.)

## Source — 📌 confirmed
**Dataset `i9w6-niyt`** ("MCAS Achievement Results", DESE Education-to-Career hub),
`sy='2025'` — the single dataset behind *every* MCAS column in the atlas. Copy
`scripts/fetch_mcas_grades2.py` (grade-level) and `scripts/fetch_mcas_groups.py`
(subgroup) verbatim; change only the `CELLS` rows. Proven query shape:
- `$where`: `org_type='Public School District' AND sy='2025' AND test_grade='<grade>' AND subject_code='<subj>' AND stu_grp='<group>'`
- `$select`: `dist_code,m_plus_e_pct` — value is a **0–1 fraction** (`to_frac()` guards >1).
- `test_grade` tokens are zero-padded strings: `'04' '05' '06' '07' '08'`, `'10'`, `'ALL (03-08)'`.
- `subject_code`: `'ELA' 'MATH' 'STE'`.
- `stu_grp` exact labels (✅ verified live, SY2025) with operating-district coverage:
  existing `'All Students' 'Low Income' 'Students with Disabilities' 'English Learners'
  'Black or African American' 'Hispanic or Latino'`; **new ones to add** —
  `'White'` (287), `'High Needs'` (286), `'Multi-Race, Not Hispanic or Latino'` (238),
  `'Asian'` (185). **Skip as too sparse** —
  `'American Indian or Alaska Native'` (18), `'Native Hawaiian or Other Pacific Islander'`
  (5): a 90%-null choropleth is the suppression trap (anomalies Bug 8). Copy the labels
  exactly — the comma/spelling matters (wrong strings return 0 rows).

Your three jobs reduce to new `CELLS` rows:
- Gr4/Gr8 ELA: `('mcas_g4_ela_me','04','ELA')`, `('mcas_g8_ela_me','08','ELA')`.
- New Gr3-8 subgroups: `test_grade='ALL (03-08)'`, the new `stu_grp` labels, ELA+MATH.
- Gr10-by-subgroup: `test_grade='10'`, each subgroup, ELA+MATH.

Lowest-source-risk session — data, dataset id, and query pattern all already in-repo.

## Steps
1. Copy the two template fetchers; adjust filters for the new grade/subgroup cells.
2. Run; expect Asian/Multi subgroups to be heavily `null` (small n) — that's correct DESE
   suppression; store `null`, never `0` (see anomalies Bug 8).
3. Register both paths + all metrics under the `// ── S6:mcas-completeness ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- Gr4 ELA + Gr8 ELA paint and sit beside their Math twins in **Academic**.
- New subgroup metrics paint where n permits; suppression is `null`.
- `node --check app.js` clean.

## Risk: Low. Known datasets, known query pattern, templates in-repo.
