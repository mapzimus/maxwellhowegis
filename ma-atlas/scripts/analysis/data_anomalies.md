# MA Education Atlas — Data Anomaly Report

**Generated:** 2026-06-01  
**Script:** `scripts/analysis/audit_data.py`  
**Scope:** 274 academic districts (`ma_academic_districts.geojson`) + 38 side files, 150 non-academic entities (`ma_districts_metrics.geojson`), 351 municipalities.

---

## Top-Level Summary Table

| # | Severity | What | File(s) | Affected | Impact |
|---|----------|------|---------|----------|--------|
| 1 | 🔴 | 6 large regional HS districts entirely absent | Both GeoJSONs | Concord-Carlisle, Lincoln-Sudbury, Nauset, King Philip, Masconomet, Algonquin | Whole districts invisible on map |
| 2 | 🔴 | Gosnold: TOTAL_CNT=0, avg_class_size=0.0 | geojson + outcomes_extra | `01090000` | Zero-not-null artifacts poison all enrollment-derived metrics |
| 3 | 🔴 | 17 Superintendency Union features have NULL ORG8CODE | `ma_districts_metrics.geojson` | 17 Union polygons | Unjoinable — all data fields null, show as grey holes on map |
| 4 | 🔴 | MHI = 250,001 (off-by-one at ACS ceiling) | `ma_district_acs.json` | Carlisle, Wellesley, Weston | Artifact value mis-bins these districts in choropleth |
| 5 | 🔴 | el_exiting_pct: floor-truncated at 0.70 | `ma_district_el.json` | 159 districts (none < 0.70) | Metric silently omits lower-performing districts; appears biased |
| 6 | 🟡 | Grad cohort sums to >1.0 | `ma_district_grad_detail.json` + geojson | Uxbridge (1.088), Amesbury (1.077) | still_enrolled_pct likely double-counts some graduates |
| 7 | 🟡 | NSS ratio metrics displayed as % (up to 428%) | `ma_district_finance.json` | Provincetown, Rowe, Truro, Wellfleet, Up-Island | Technically by design, but 428% confuses users |
| 8 | 🟡 | Specific near-zero MCAS values that may be null artifacts | Multiple MCAS files | Erving, Winchendon, Greenfield | 0.0 where DESE usually suppresses to null |
| 9 | 🟢 | 63+ districts null in AP/Advanced/PostSec/Grad Detail | design-expected | K-8 districts, small charters | These lack HS grades — nulls are correct |
| 10 | 🟢 | 118 munis missing timeseries | `ma_muni_timeseries.json` | 118 single-district-town munis | Expected — timeseries keyed to districts, not standalone munis |

---

## 🔴 Critical / Likely Real Bugs

---

### Bug 1 — Six Large Regional HS Districts Entirely Absent

**What:** The following well-known Massachusetts regional high school districts are absent from both `ma_academic_districts.geojson` (274 academic districts) and `ma_districts_metrics.geojson` (150 non-academic entities):

| District | Approximate Enrollment | Notes |
|---------|------------------------|-------|
| Concord-Carlisle Regional | ~1,300 | Gr 9–12 only; member towns Concord + Carlisle |
| Lincoln-Sudbury Regional | ~1,700 | Gr 9–12 only; Lincoln + Sudbury |
| Nauset Regional | ~1,300 | Gr 7–12; Eastham, Orleans, Wellfleet, Brewster |
| King Philip Regional | ~2,100 | Gr 7–12; Norfolk, Wrentham, Plainville |
| Masconomet Regional | ~1,600 | Gr 7–12; Boxford, Topsfield, Middleton |
| Algonquin (Northborough-Southborough) | ~1,500 | Gr 9–12 |

The member towns (Concord, Carlisle, Sudbury, Lincoln, etc.) ARE present in `ma_academic_districts.geojson`, but as K-8 or K-6 sending districts. Their high-school MCAS, graduation rates, per-pupil spending, and AP metrics are populated from the regional district — but that district's own record is missing.

**Evidence:**
```
grep results on name fields — none of these strings appear in DIST_NAME:
  'Concord-Carlisle', 'Lincoln-Sudbury', 'Nauset', 'King Philip',
  'Masconomet', 'Algonquin'
DESE typically publishes 274 unique district codes; our geojson has exactly 274 but
includes three that probably should not be there or has merged Concord+Concord-Carlisle
into the same entry.
```

**Hypothesis:** The pipeline that generates `ma_academic_districts.geojson` filtered on some field (e.g., "operates grades K–12" or "has a physical school building") and excluded pure 7–12 or 9–12 regional districts. Alternatively, DESE's org code lookup was done against a list that excluded regional-only districts.

**Suggested fix:** Download the DESE School and District Profiles for these six codes, add them to the pipeline's inclusion list, regenerate the GeoJSON, and confirm their geometries (polygons of the member towns' combined area, or the school's footprint polygon).

---

### Bug 2 — Gosnold: Zero-Enrollment Metrics Stored as 0 Instead of Null

**What:** District code `01090000` (Gosnold, Cuttyhunk Island) has `TOTAL_CNT = 0.0` in the geojson. All enrollment-based percentage fields (EL_PCT, LI_PCT, HN_PCT, etc.) are stored as `0.0`. In `ma_district_outcomes_extra.json`, `avg_class_size = 0.0`.

**Evidence:**
```
TOTAL_CNT:       0.0   (not null)
EL_PCT:          0.0
LI_PCT:          0.0
WH_PCT:          0.0
avg_class_size:  0.0   ← impossible (no class can have 0 students per teacher)
```
Gosnold is genuinely a tiny/intermittently-operating district (DESE still assigns it a code), but TOTAL_CNT = 0 means enrollment metrics are 0/0 division artifacts — not real rates.

**Hypothesis:** The data pipeline evaluates `0 students classified as EL / 0 total = 0.0` and saves the result instead of returning None for zero-enrollment districts.

**Suggested fix:** Filter out districts with `TOTAL_CNT == 0` before computing ratios, or store `null` for all ratio fields when enrollment is zero. Also store `avg_class_size = null` for Gosnold.

---

### Bug 3 — 17 Superintendency Union Polygons Have NULL ORG8CODE

**What:** In `ma_districts_metrics.geojson`, all 17 "Superintendency Union" features have `ORG8CODE = null`. Every data column (`TOTAL_CNT`, `EL_PCT`, `grad_4yr`, etc.) is also null.

**Evidence:**
```python
null_code_count = 17
sample: {'TYPE': 'Superintendency Union', 'NAME': 'Union 19', 'ORG8CODE': None, ...all null}
```

These boundaries appear on the map as visible polygons but cannot be joined to any data. They render as grey/unmapped areas wherever the layer is visible, which may confuse users who think these are missing data districts.

**Hypothesis:** Superintendency Unions share a DESE district code with a member town, not a unique 8-digit code of their own. The pipeline attempted a join on a code that doesn't exist for these entities.

**Suggested fix:** Either (a) remove these features from `ma_districts_metrics.geojson` entirely since they add no data value, or (b) join them to the underlying member district's data using the `DIST_NAME` field.

---

### Bug 4 — MHI = 250,001 (Off-by-One at ACS $250,000 Ceiling)

**What:** Three districts have `acs_median_household_income = 250001` in `ma_district_acs.json`: Carlisle (`00510000`), Wellesley (`03170000`), and Weston (`03300000`).

**Evidence:**
```
Carlisle:  250,001  (expected: 250,000 or null)
Wellesley: 250,001
Weston:    250,001
```

The ACS top-codes median household income at $250,000. A value of $250,001 means the pipeline added 1 somewhere (likely a weighted average of the cap value across member towns produced 250,000.0, then a rounding/truncation step pushed it to 250,001). This places these districts in a different bin than the true cap value.

**Hypothesis:** The district aggregation script (probably `aggregate_acs_to_districts.py`) computes a population-weighted mean of town-level MHI values. When all member towns are at or near the cap, floating-point arithmetic pushes the result fractionally above 250,000, which then gets rounded to 250,001 or stored as-is.

**Suggested fix:** After aggregation, clamp `acs_median_household_income` to `min(value, 250000)`.

---

### Bug 5 — `el_exiting_pct`: Distribution Floor-Truncated at 0.70

**What:** The column `el_exiting_pct` in `ma_district_el.json` has 159 non-null values. Every single one is ≥ 0.70. The minimum is exactly 0.70; 38 districts (24%) are coded 1.00.

**Evidence:**
```
el_exiting_pct:  n=159, min=0.700, max=1.000, mean=0.938
Values < 0.70:   0  (zero)
```

A genuine EL exit rate distribution for 274 MA districts would show values ranging from ~0.05 (highly English-learner-saturated districts where few students exit) to ~0.95. No real metric has 100% of observations in a 0.70–1.00 window.

**Hypothesis:** DESE's published EL Annual Measurable Achievement metric is only reported when a district meets a minimum n-count for the EL subgroup AND the reported rate is ≥ some threshold (typically ≥ 70% in DESE's English Learner progress framework). Districts below 70% are suppressed. The pipeline ingested the non-suppressed records verbatim, giving the appearance of a complete dataset when it actually contains only the top 42% of districts.

**Consequence:** Any choropleth of `el_exiting_pct` silently omits the ~115 districts with lower exit rates, creating a misleading map that shows only above-average performers.

**Suggested fix:** Either (a) store `null` for suppressed districts (current behavior but misleadingly presented), AND add a note to the metric label/tooltip that "~115 districts with lower rates are suppressed by DESE and shown as no data," or (b) reconsider whether this metric belongs in the atlas given the coverage hole.

---

## 🟡 Worth Checking

---

### Issue 6 — Grad Cohort Sum > 1.0 for Uxbridge and Amesbury

**What:** The four 4-year cohort components (`grad_4yr + dropout_pct + still_enrolled_pct + ged_pct + non_grad_completer_pct + permanently_excluded_pct`) should sum to approximately 1.0. Two districts exceed this:

| District | Code | Sum | grad_4yr | dropout | still_enrolled | ged | other |
|---------|------|-----|----------|---------|---------------|-----|-------|
| Uxbridge | `03040000` | **1.088** | 0.980 | 0.020 | 0.074 | 0.014 | 0.000 |
| Amesbury | `00070000` | **1.077** | 0.897 | 0.009 | 0.149 | 0.015 | 0.007 |

**Hypothesis:** `still_enrolled_pct` and `grad_4yr` are likely from different cohort years or definitions, causing double-counting. For example, if `grad_4yr` uses the 4-year completion cohort and `still_enrolled_pct` comes from a 5-year or longer-window report, some students are counted in both.

**Suggested fix:** Verify that all six components come from the same DESE cohort year and definition. Check whether the fetch scripts for `grad_detail.json` and the `grad_4yr` in the geojson use matching cohort IDs.

---

### Issue 7 — NSS Ratio Metrics Displayed as Percentages > 100%

**What:** `nss_pct_of_required` and `nss_pct_of_foundation` are stored as decimal ratios (e.g., 1.12 = "spending 112% of required"). The `format:"pct"` tag in the METRICS catalog causes the app to multiply by 100 and append "%". This is documented in `app.js` comments ("NSS-vs-target ratios CAN exceed 100%").

However, the displayed values reach extreme levels:

| District | `nss_pct_of_required` | Displayed |
|---------|----------------------|-----------|
| Provincetown | 4.280 | **428%** |
| Rowe | 3.330 | **333%** |
| Truro | 2.990 | **299%** |
| Wellfleet | 2.890 | **289%** |

**Concern:** These are all small Cape Cod/Western MA districts with very low enrollment and high fixed costs. The values are real, but displaying "428%" in a choropleth strongly implies a data error to most users. The legend and tooltip need clear language like "112% = meets requirement; values >100% mean above-minimum spending."

**Suggested fix:** Add the unit annotation "% of required (>100% = above minimum)" to `METRIC_UNITS` in `app.js`. Consider also whether format should be `"num"` with a custom unit, to avoid the "%" suffix which implies a probability.

---

### Issue 8 — Near-Zero MCAS Values That May Be Null Artifacts

Three data points where a `pct` metric is stored as `0.0` instead of `null`:

| District | Code | Metric | Value | Context |
|---------|------|--------|-------|---------|
| Erving | — | `mcas_g5_math_me` | 0.0 | Very small district; likely suppressed |
| Winchendon | — | `mcas_ela_black` | 0.0 | Black subgroup; 0% M+E is statistically possible but DESE usually suppresses small n |
| Greenfield | — | `mcas_ela_black` | 0.0 | Same — check whether DESE published 0 or suppressed |

**Note:** A genuine score of 0% "Meeting/Exceeding" at the grade-3–8 level exists for some subgroups in struggling districts. However, DESE applies a minimum-n suppression rule (typically n < 10), so a 0.0 may be a "missing coded as zero" artifact from the fetch script. Winchendon and Greenfield both have non-zero Black enrollment, so this is worth verifying against the raw DESE file.

---

### Issue 9 — `expulsion_pct` Has Only Two Distinct Values (0.0 and 0.001)

**What:** The column `expulsion_pct` in `ma_district_discipline_detail.json` is effectively binary: 209 non-null entries, all either `0.0` or `0.001`.

**Evidence:**
```
expulsion_pct: min=0.0000, max=0.0010, n=209
Distinct values: {0.0, 0.001}
```

**Hypothesis:** DESE either (a) rounds to 3 decimal places for this extremely rare event (expulsions are sub-1-per-thousand statewide), creating a near-binary outcome, or (b) the fetch script used a threshold and snapped values. Either way, this column adds no meaningful geographic variation for a choropleth.

**Suggested fix:** Consider dropping this metric from the atlas or displaying it as a binary indicator ("has had an expulsion: yes/no") rather than a continuous choropleth.

---

### Issue 10 — `students_per_librarian` and `students_per_social_worker` Extreme Outliers

Five districts with `students_per_librarian` > 10,000:

| District | Value |
|---------|-------|
| Whitman-Hanson | 17,115 |
| Brockton | 16,269 |
| Lawrence | 12,955 |
| Fall River | 11,184 |
| Somerset | 15,240 |

These values are plausible if those districts have 0 or 1 FTE librarians for their total enrollment, but they may also reflect an FTE reporting change or zero-denominator issue in the DESE support staff data. Cross-check against the DESE Educators report.

For `students_per_social_worker`, Hopkinton shows 10,608 — a district of ~6,000 students with effectively zero social worker FTEs. This is a real staffing gap, not a pipeline bug, but worth labeling distinctly (e.g., "effectively no social worker on staff").

---

### Issue 11 — Melrose `students_per_nurse` = 3,730

Melrose has 3,730 students per nurse — roughly 10× the median (≈340). Melrose had ~5,000 total enrollment, implying 1.3 FTE nurses total. This could be real but is an extreme outlier that inflates the choropleth range for all other districts. Verify against source.

---

### Issue 12 — Provincetown `avg_teacher_salary` = $164,619 (Outlier)

The IQR fence for `avg_teacher_salary` is [$22k, $160k]; Provincetown at $164,619 just clears it. This is plausible (very small staff, senior-heavy workforce, high cost-of-living area), but worth noting as a display outlier on the salary choropleth.

---

## 🟢 Benign by Design (Expected Nulls / Gaps)

---

### Benign 1 — 63 Districts Null in AP, PostSec, Grad Detail, and Advanced Coursework

**Why expected:** These 63 districts are K-8, K-6, or PreK-6 feeder districts that send students to a regional high school. They have no HS grades and therefore genuinely have no MCAS Gr10 data, no AP program, no graduation cohort, and no CTE program. The pipeline correctly omits them from these files. Coverage of exactly 211 districts (274 − 63) is consistent with the ~211 districts that operate grades 9–12 in Massachusetts.

---

### Benign 2 — 48 Districts Null in `ma_district_el.json` (`el_proficiency_pct`, etc.)

**Why expected:** Districts with very few English Learners (n < 10 in the ACCESS for ELLs test) are suppressed by DESE. 48 null districts is consistent with the roughly 40–50 very small/rural districts that have near-zero EL enrollment.

---

### Benign 3 — 214 Districts Null in `ma_district_cte.json`

**Why expected:** Only 60 districts report Chapter 74 (CTE) enrollment in-house; the other 214 districts send CTE students to regional vocational-technical schools (which are separate entities not in this academic dataset per the design note in `app.js`).

---

### Benign 4 — High Null Rate for Subgroup MCAS/AP/Discipline Metrics (50–93%)

**Why expected:** Racial/ethnic subgroup metrics (`mcas_g10_ela_me__ell`, `ap_pct_3plus__baa`, `oss_black`, etc.) are suppressed when the subgroup has n < 10 in the tested population. The 65–93% null rate for rare subgroups (ELL test-takers in MCAS Gr10, Black/Asian AP takers) in predominantly white small-town districts is correct DESE suppression behavior.

---

### Benign 5 — 45 Districts Null in School Choice File

**Why expected:** School choice outflow is only reported for single-town sending districts. Multi-town regional districts and collaboratives don't have a "resident enrollment" concept for inter-district choice. 229 coverage (274 − 45) is consistent with the number of single-town operational districts.

---

### Benign 6 — 17 Superintendency Union Polygons in Non-Academic GeoJSON with All-Null Data

*(Also listed as Bug 3 above for the ORG8CODE = null issue)*  
The underlying reason these polygons have no data is structural: Superintendency Unions are administrative arrangements (shared superintendent), not enrollment entities. They don't report enrollment, test scores, or finances to DESE independently. The polygons exist in the spatial data for geographic reference.

---

### Benign 7 — MHI $250,000 Ceiling Values (Multiple Wealthy Towns)

Districts like Weston ($250,001, see Bug 4), Sherborn, and Dover have ACS-published MHI at or near the $250,000 ACS censoring threshold. This is a known ACS limitation for very high-income communities, not a pipeline problem.

---

### Benign 8 — 118 Municipalities Missing from `ma_muni_timeseries.json`

**Why expected:** The timeseries data is district-keyed (DIST_CODE). The 351 municipalities → 274 districts mapping is many-to-one; single-town districts appear in the timeseries while multi-town union members may not have their own entries. 233/351 = 66% coverage is approximately correct.

---

### Benign 9 — `prek_per_k_ratio` Values > 1.0

`prek_per_k_ratio` ranges from 0.14 to **2.43**. Values > 1.0 mean the district enrolls more Pre-K students than Kindergarteners. This is real and possible for districts that host regional early-childhood programs (e.g., METCO-connected suburban districts with large community preschools). It is labeled as a ratio (`format:"num"`), not a percentage, so there is no display issue.

---

### Benign 10 — `el_proficiency_pct` = 0.0 for Several Districts

Berkley, Sunderland, Provincetown, Ware, and Tantasqua each show `el_proficiency_pct = 0.0`. DESE's ACCESS test proficiency rate can genuinely be 0% for small EL populations in a given year. These districts have EL_PCT > 0 so ELs exist; 0% proficiency (not null) is consistent with DESE reporting a real rate of 0.

---

## Appendix: Column Coverage Summary

| Side File | Entries | Missing |
|-----------|---------|---------|
| ma_district_acs.json | 274 | 0 |
| ma_district_educator.json | 274 | 0 |
| ma_district_outcomes_extra.json | 274 | 0 |
| ma_district_discipline.json | 273 | 1 |
| ma_district_finance.json | 273 | 1 (Gosnold) |
| ma_district_sped.json | 273 | 1 |
| ma_district_growth.json | 270 | 4 |
| ma_district_advanced.json | 211 | 63 (K-8 districts — expected) |
| ma_district_postsec.json | 211 | 63 (K-8 districts — expected) |
| ma_district_cte.json | 60 | 214 (non-CTE hosts — expected) |
| ma_district_discipline_detail.json | 209 | 65 |
| ma_district_discipline_groups.json | 197 | 77 |

No orphan codes were found in any side file (all keys match a valid `DIST_CODE`).  
No value collisions were found when merging side files (no duplicate column writes with differing values).
