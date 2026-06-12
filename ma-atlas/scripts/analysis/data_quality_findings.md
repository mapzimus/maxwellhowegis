# MA Education Atlas — Data QUALITY Findings & Triage

**Generated:** 2026-06-05
**Scripts:** `scripts/analysis/audit_quality.py` (reusable scanner) + live MA DESE
Socrata cross-checks.
**Scope:** all **375** catalog metrics, scanned at every level they declare, over
the joined tables the app actually paints — **281** academic districts × 850
columns (geojson + 68 `ma_district_*.json` side files + in-app computed gaps) and
**351** municipalities × 543 columns (`ma_municipalities.geojson` + 11 `ma_muni_*`
files + timeseries) — plus the 418 `<id>__YYYY` year-keyed columns.

This is the **quality** companion to the original coverage-era `data_anomalies.md`.
Coverage only counts non-null presence; a column can pass that and still be broken
(placeholder, all-same, mis-scaled, wrongly joined, stale year, suppression-biased,
or 0-stored-for-null). Every flag below was triaged **legitimate** vs **broken**;
broken-and-fixable items were corrected at the fetcher and regenerated.

---

## Top-line summary

| # | Severity | Finding | Verdict | Action |
|---|----------|---------|---------|--------|
| 1 | 🔴 | `classes_licensed_pct` = **0** for 17 districts incl. Fall River (11,184 students), Malden (6,072) | **BROKEN** (0-for-null) | **FIXED** — fetcher guards on `tchr_cnt>0` |
| 2 | 🔴 | `teacher_retention_pct` rounded to nearest 10% in the geojson (Boston 0.872→0.9); only 10 distinct values statewide | **BROKEN** (precision lost) | **FIXED** — precise DESE value now overrides via side file |
| 3 | 🟡 | `teacher_licensed_pct` & `avg_class_size` = **0** for Gosnold | **BROKEN** (0-for-null) | **FIXED** — guarded to null |
| 4 | 🟢 | `el_exiting_pct` floored at 0.70 (the original report's "Bug 5") | **LEGIT** (correction) | Re-verified at source — *not* a bias; kept |
| 5 | 🟡 | `staff_white_pct` rounded to nearest 10% (144 districts at exactly 1.0) | **BROKEN** (geojson) | Documented for `lehs-data-dive` |
| 6 | 🟡 | `ap_pct_3plus` rounded across all 19 years (≤16 distinct/yr) | **BROKEN** (geojson) | Documented for `lehs-data-dive` |
| 7 | 🟢 | `principal_retention_pct` = 0 for 9 tiny districts | **LEGIT** | Kept (real — `tot_cnt=1`, principal left) |
| 8 | 🟢 | `TOTAL_CNT` = 0 for Gosnold | **LEGIT** (DESE-faithful) | Kept (DESE publishes 0; derived rates nulled) |
| 9 | 🟢 | Finance totals > $10M; `nss_pct_*` > 100%; `acs_median_home_value` > $1M; negative `earnings_gap`; `enroll_change_10yr` > +100% | **LEGIT** | Kept (all real; audit thresholds noted) |

**Core join/scale/year integrity: verified clean** (see §"Live DESE cross-check").
No mis-joined, mis-scaled, or stale-year defects were found in the high-traffic
metrics (enrollment, graduation, MCAS Gr10, per-pupil).

---

## 🔴 Fixed bugs

### Fix 1 — `classes_licensed_pct` stored 0 for 17 districts (0-for-null)

**What.** `classes_licensed_pct` ("% of core classes taught by a licensed teacher")
was a literal **0.0** for 17 academic districts, including large ones where it is
impossible: **Fall River** (11,184 students), **Malden** (6,072), East Bridgewater,
Halifax, Hancock, Leicester, Millbury, Orleans, Plympton, Wellfleet, and the
regionals Hoosac Valley, Lincoln-Sudbury, Nauset, Masconomet, Northboro-Southboro,
Somerset Berkley, plus Gosnold.

**Root cause (confirmed at the live source).** DESE dataset `4684-cw3t`, subject
`Core-All Subjects`, SY2026: for these districts the row carries **`tchr_cnt=0.0`
and `tchr_lic_pct=0`** — i.e. DESE did *not* tabulate the Core-All-Subjects
breakdown for them (85 of 395 statewide rows are like this). It is a **no-data
sentinel, not a real 0%**. The same districts have a fully populated *All Teachers*
row (Fall River: 922.6 teachers @ 84.2% licensed). The fetcher's `to_frac()` turned
the sentinel `0` into a stored `0.0`, painting Fall River as "0% of classes taught
by a licensed teacher" and poisoning the choropleth's low end.

**Fix.** `scripts/fetch_educator_detail.py` now selects `tchr_cnt` and only records
`classes_licensed_pct` / `teacher_licensed_pct` when `tchr_cnt > 0` (new `pos_cnt()`
guard). Regenerated `data/ma_district_educator.json`: 17 `classes_licensed_pct`
zeros and 1 `teacher_licensed_pct` zero (Gosnold) are now **null**; no other value
changed (verified by structured diff against the committed file).

### Fix 2 — `teacher_retention_pct` over-rounded in the geojson (precision lost)

**What.** The painted `teacher_retention_pct` collapsed all 279 districts into
**~10 values** (0.7, 0.8, 0.9, 1.0 …). The geojson rounds it to the nearest 10%.

**Root cause (confirmed at the live source).** DESE dataset `52c5-e56a`,
`staff_desc='Teachers'`, SY2026 publishes this at **full precision** — Boston
0.872, Cambridge 0.881, Lynn 0.834, Brookline 0.923, Springfield 0.807 — but the
geojson copy stores Boston→0.9, Lynn→0.8, etc. The rounded values are wrong by up
to ~4 points and the choropleth was reduced to a handful of bins. This is the *same*
dataset the educator-2 fetcher already queries for `principal_retention_pct`, so the
precise series was one query away.

**Fix.** `scripts/fetch_educator_detail2.py` now also pulls `staff_desc='Teachers'`
`retnd_pct` into `teacher_retention_pct`. Because side files merge **after** the
geojson (`Object.assign`/`update`), the precise value **overrides** the rounded
geojson copy. Regenerated `data/ma_district_educator2.json`: `teacher_retention_pct`
now carries **136 distinct values** over 280 districts (Boston now 0.872). The
fetcher's prior "dropped as a duplicate" note was wrong — the geojson copy was
degraded, not equivalent.

### Fix 3 — Gosnold `avg_class_size` = 0 (0-for-null)

**What.** `avg_class_size = 0.0` for Gosnold (`01090000`). A class cannot average
0 students; DESE reports it because Gosnold's enrollment is 0 this year.
**Fix.** `scripts/fetch_outcomes_extra.py` now stores `avg_class_size` only when
`> 0`. Gosnold is null; no other district changed.

> All three fixes touch **only fetchers + their regenerated `data/*.json`**. The
> affected columns already exist in the `METRICS` catalog and their files are
> already loaded, so **no `app.js` edit and no `?v=` cache-token bump are needed.**

---

## 🟢 Flagged-but-LEGITIMATE (kept, with the reason)

- **`el_exiting_pct` floor at 0.70 — the original report's "Bug 5" is a FALSE
  ALARM (correction).** The floor is in DESE's source (`puw9-zucz` `re3_pct`: n=206,
  min 0.70, none below). Investigated two ways: (a) RE3 is *"% of ELs who exit EL
  classification based on attaining proficiency"* — a **conditional follow-through
  rate** (exits ÷ proficiency-attainers), which naturally floors high, not a share
  of all ELs; (b) the ~113 districts with no value are exactly those with the
  eligible count **`re3_incl < 10`** (standard small-n privacy suppression →
  correctly null), **not** low-performers hidden. So the distribution is genuine and
  the missing districts are properly null. **Kept.** (Optional nicety: a tooltip
  clarifying it is a follow-through rate, since a lay reader may misread "% exiting"
  as a share of all ELs.)
- **`principal_retention_pct` = 0 for 9 tiny districts** (Clarksburg, Edgartown,
  Erving, Florida, Halifax, Holland, Nahant, Rowe, Truro). Live source confirms
  `tot_cnt=1, retnd_cnt=0` — the single principal genuinely left. **Real 0%, kept**
  (small-denominator noise, not a bug).
- **`TOTAL_CNT` = 0 for Gosnold.** DESE's SY2026 enrollment is literally
  `total_cnt=0` (Cuttyhunk Island has no students enrolled). Faithful to source;
  the *derived* rates it would poison (`avg_class_size`) are now nulled (Fix 3).
- **Finance totals > $10M** (`actual_nss` $1.38B, `foundation_budget`,
  `required_nss`, `required_local_contribution`): these are **district-wide budget
  totals** — Boston's net school spending really is ~$1.3B. Real.
- **`nss_pct_of_required` / `nss_pct_of_foundation` > 100%** (up to 428%): ratios
  by design (a district spending 4.28× its required minimum). Real; display caveat
  already documented in the original report (Issue 7).
- **`acs_median_home_value` > $1M** (Weston $1.59M, Wellesley $1.51M, Up-Island /
  Nantucket ~$1.4M): real ACS values for MA's priciest towns. Not mis-scaled.
- **`earnings_gap_low_income`** goes negative: it is a **diverging dollar gap**
  (low-income grads earning more in some districts). Correct.
- **`enroll_change_10yr` = +1.117**: a district that grew 112% in 10 years — real.
- **`expulsion_pct` (binary 0/0.001)** and **`permanently_excluded_pct` (96% at 0)**:
  genuinely rare events — near-useless on a choropleth but not *wrong* (already
  triaged previously; `expulsion_pct` remains a drop/relabel candidate).
- **CRDC course-access ceilings** (`algebra2/chemistry/physics/calculus_access_pct`,
  `school_police_pct`) and **`full_day_k_pct`**, **`teacher_licensed_pct`**: piles
  near 1.0 are real (near-universal access / licensure), not suppression.

---

## 🟡 Geojson-baked issues — for the sibling `lehs-data-dive` pipeline

These are baked into `ma_academic_districts.geojson` (built by `lehs-data-dive`,
not by an atlas fetcher), so they are flagged here rather than fixed in this repo.
`teacher_retention_pct` was in this class too but was fixable from the atlas side
via side-file override (Fix 2); the rest are not (e.g. year-keyed series live only
on the geojson).

- **`staff_white_pct` rounded to nearest 10%** — 144 districts read exactly "100%
  white staff," 103 at "90%." Same round-vs-precise signature as the old
  `teacher_retention_pct`. Recommend sourcing all-staff race at full precision
  (DESE `fz9c-2g33`, weighted across the 5 `job_class_grp` values) or dropping the
  metric. *(Not fixable via side-file override here: it's an all-staff denominator
  that would need a new weighted-aggregation fetcher.)*
- **`ap_pct_3plus` rounded across all 19 years** (≤16 distinct values per year,
  2007–2025). A side-file override could only correct the current-year base, not the
  year-keyed series the slider reads, so this needs the pipeline fix in
  `lehs-data-dive`.
- **`masscore_pct` = 0 for Northampton** — already documented in
  `fetch_whole_child.py` ("Northampton does not formally track MassCore"). Consider
  storing null rather than 0 in the geojson.
- **`per_pupil` latest is FY2024** — internally consistent (base == `__2024`), but
  confirm FY2025 isn't yet published by DESE on the next geojson rebuild (possible
  one-year-stale).

---

## Live DESE cross-check (join · scale · year)

Five named districts + Springfield, checked against the live MA DESE Socrata
datasets that build the geojson. **All match exactly** — confirming the geojson is
correctly joined (right district), correctly scaled (0–1), and current-year.

| District | Code | Enroll (atlas/DESE SY26) | Grad (atlas/DESE SY25 ACGR) | MCAS Gr10 ELA (atlas/DESE SY25) |
|---|---|---|---|---|
| Boston | 00350000 | 44,416 / 44,416 | 0.868 / 0.868 | 0.40 / 0.40 |
| Cambridge | 00490000 | 6,960 / 6,960 | 0.927 / 0.927 | 0.56 / 0.56 |
| Lowell | 01600000 | 14,387 / 14,387 | 0.827 / 0.827 | 0.30 / 0.30 |
| Lynn | 01630000 | 15,877 / 15,877 | 0.822 / 0.822 | 0.28 / 0.28 |
| Brookline | 00460000 | 6,948 / 6,948 | 0.966 / 0.966 | 0.83 / 0.83 |
| Springfield | 02810000 | 23,574 / 23,574 | 0.846 / 0.846 | 0.28 / 0.28 |

Notes:
- **`grad_4yr` is DESE's *4-Year Adjusted Cohort Graduation Rate* (ACGR)**, the
  standard federal metric — *not* the plain "4-Year Graduation Rate" (which runs
  ~1–7 pts lower). The atlas uses the right, official definition.
- The audit also incidentally confirmed a **labeling trap**: the code `01600000`
  is **Lowell**, not Lynn (Lynn is `01630000`). The atlas labels both correctly.
- Latest published school years all match the atlas base columns: enrollment SY2026,
  graduation SY2025, MCAS Gr10 SY2025; every base column equals its latest
  `__YYYY` year-keyed column (no stale-base defect).

---

## Reusable scanner

`scripts/analysis/audit_quality.py` rebuilds both tables (reusing
`compute_correlations.build_district_table` + a parallel `build_muni_table`), parses
the `METRICS` catalog, and emits per-(metric, level) flags to `audit_quality.csv` /
`audit_quality.md` with codes: `DISTINCT_LE2`, `LOW_VARIANCE`, `LOW_PRECISION`,
`PCT_RANGE`, `PCT_NEG`, `USD_NONPOS`, `USD_ABSURD`, `NUM_SGP_RANGE`, `ZERO_CLUSTER`,
`FLOOR_TRUNC`, `CEIL_TRUNC`, `TINY_DIST_ZERO`, `YEAR_LATEST_GAP`, `MUNI_BLANK`. It is
diverging-aware (gaps/trends), per-unit-aware (dollar gaps vs district totals), and
computes the runtime muni `_pop/_area/_density` columns so they aren't false-flagged.
Re-run after any pipeline change: `python scripts/analysis/audit_quality.py`.
