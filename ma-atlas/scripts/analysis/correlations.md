# MA Education Atlas — District Correlation Analysis

## Methodology

The joined district table is rebuilt exactly as `app.js` paints it: `data/ma_academic_districts.geojson` (274 dissolved operating-district polygons) merged with every `data/ma_district_*.json` side file by the 8-digit district code (`DIST_CODE` == `ORG8CODE`), plus the in-app derived columns (diversity index, 5/10-yr enrollment change, equity gaps) reproduced from `computeDerivedMetrics()`.

- Side files merged: **68**.
- Raw district rows: **281**. After dropping admin/union shells with >50% of core operating columns null, the **effective N = 280** operating districts.
- Eligible metrics = METRICS entries whose `levels` include `district` that exist as real numeric columns with ≥50 values: **369** columns.
- Pairwise **Pearson** and **Spearman** computed for every pair with ≥50 non-null overlap; n recorded per pair.
- scipy available: **True**.

- Candidate ids with no data (excluded): `early_college_pct`, `early_college_g12_pct`, `early_college_participants`, `early_college_credits_per_student`, `early_college_credit_success_pct`.


Tautological / near-duplicate pairs are filtered: a metric vs itself; definitional duplicates (e.g. % low income vs % high needs, SAT subject vs SAT total, attendance vs chronic absence); a subgroup slice vs its all-students base; a gap metric vs an input it is computed from; and any same-category pair with |r| ≥ 0.92. Cross-category pairs are kept even when strong.


## Strongest non-trivial correlations (top 40)

| A | B | Pearson | Spearman | n | cross-cat |
|---|---|---:|---:|---:|:---:|
| Total Enrollment | Kindergarten Enrollment (count) | +0.99 | +0.98 | 271 | ✓ |
| Actual Net School Spending (2022) | Population (2020 Census) | +0.98 | +0.94 | 280 | ✓ |
| AP Exams — % scoring 3+ | % of AP Exams Scoring 3+ | +0.98 | +0.98 | 217 | ✓ |
| Total Enrollment | Foundation Budget (2022) | +0.98 | +0.99 | 280 | ✓ |
| Kindergarten Enrollment (count) | Foundation Budget (2022) | +0.98 | +0.98 | 271 | ✓ |
| Total Enrollment | Required Net School Spending (2022) | +0.98 | +0.99 | 280 | ✓ |
| Kindergarten Enrollment (count) | Required Net School Spending (2022) | +0.98 | +0.98 | 271 | ✓ |
| Required Net School Spending (2022) | Population (2020 Census) | +0.96 | +0.95 | 280 | ✓ |
| Foundation Budget (2022) | Population (2020 Census) | +0.96 | +0.95 | 280 | ✓ |
| Pre-K Enrollment (count) | Foundation Budget (2022) | +0.95 | +0.86 | 262 | ✓ |
| Total Enrollment | Actual Net School Spending (2022) | +0.95 | +0.98 | 280 | ✓ |
| Pre-K Enrollment (count) | Required Net School Spending (2022) | +0.95 | +0.86 | 262 | ✓ |
| Kindergarten Enrollment (count) | Actual Net School Spending (2022) | +0.95 | +0.97 | 271 | ✓ |
| Population (2020 Census) | Required Local Contribution (2026) | +0.95 | +0.92 | 280 | ✓ |
| MCAS Gr3-8 ELA % Meeting/Exceeding | District Accountability Percentile | +0.94 | +0.94 | 273 | ✓ |
| MCAS Gr3-8 Math % Meeting/Exceeding | District Accountability Percentile | +0.94 | +0.94 | 273 | ✓ |
| District Accountability Percentile | MCAS Gr3-8 Math % M+E — Male | +0.93 | +0.94 | 273 | ✓ |
| Kindergarten Enrollment (count) | Population (2020 Census) | +0.93 | +0.96 | 271 | ✓ |
| MCAS Gr10 Math % Meeting/Exceeding | District Accountability Percentile | +0.93 | +0.93 | 218 | ✓ |
| % Low Income | % Persisting to 2nd Year | -0.93 | -0.93 | 218 | ✓ |
| Total Enrollment | Population (2020 Census) | +0.93 | +0.93 | 280 | ✓ |
| District Accountability Percentile | MCAS Gr3-8 ELA % M+E — Female | +0.93 | +0.92 | 273 | ✓ |
| District Accountability Percentile | MCAS Gr3-8 ELA % M+E — Male | +0.92 | +0.93 | 273 | ✓ |
| Pre-K Enrollment (count) | Actual Net School Spending (2022) | +0.92 | +0.84 | 262 | ✓ |
| MCAS Gr10 ELA % Meeting/Exceeding | District Accountability Percentile | +0.92 | +0.91 | 218 | ✓ |
| Students Disciplined Rate | Out-of-School Suspension Rate | +0.91 | +0.92 | 216 |  |
| % 9th Graders Passing All Courses | % Passing 9th-Grade English | +0.91 | +0.90 | 217 |  |
| % Low Income | % of Grads Disconnected (1yr After HS) | +0.91 | +0.91 | 160 | ✓ |
| Total Enrollment | Pre-K Enrollment (count) | +0.91 | +0.85 | 262 | ✓ |
| District Accountability Percentile | MCAS Gr3-8 Math % M+E — Female | +0.91 | +0.91 | 273 | ✓ |
| % of Accountability Targets Met | % of Accountability Targets Met (current year) | +0.91 | +0.89 | 278 |  |
| % Persisting to 2nd Year | % Completing College (6-yr) | +0.91 | +0.92 | 218 |  |
| % High Needs | % Persisting to 2nd Year | -0.91 | -0.91 | 218 | ✓ |
| District Accountability Percentile | MCAS Gr10 Math % M+E — Female | +0.91 | +0.90 | 216 | ✓ |
| % Low Income | % Enrolled in 4-Year College | -0.91 | -0.92 | 217 | ✓ |
| Out-of-School Suspension Rate | Days Lost to Discipline / 100 | +0.91 | +0.93 | 216 |  |
| MCAS Gr3-8 ELA % Not Meeting | % Persisting to 2nd Year | -0.91 | -0.91 | 214 | ✓ |
| % Low Income | % Enrolled in College (16mo) | -0.90 | -0.90 | 217 | ✓ |
| % Low Income | % Completing College (6-yr) | -0.90 | -0.92 | 218 | ✓ |
| % Enrolled in College (16mo) | % Completing College (6-yr) | +0.90 | +0.90 | 217 |  |

## Weakest / near-zero cross-category pairs (a sample)

| A | B | Pearson | Spearman | n |
|---|---|---:|---:|---:|
| Dropout Rate — Female | % of HS Students in Schools Offering Chemistry (CRDC 2017-18) | +0.00 | -0.22 | 217 |
| Chapter 70 State Aid per Pupil (2026) | % of Students in Gifted & Talented (CRDC 2017-18) | -0.00 | +0.02 | 279 |
| Grad Gap — SWD (vs all) | MCAS Gr3-8 ELA M+E — Military-Connected | -0.00 | -0.02 | 124 |
| Per-Pupil $ — Materials/Tech (2024) | % Students Enrolled in Music | -0.00 | +0.01 | 278 |
| % Under 18 (ACS) | Chapter 70 State Aid per Pupil (2026) | +0.00 | -0.17 | 280 |
| % Planning 2-yr College | % Teachers 57+ (approaching retirement, 2026) | +0.00 | -0.04 | 235 |
| Grad Gap — Hispanic/Latino (vs all) | % Public-Transit Commuters (ACS) | +0.00 | +0.10 | 197 |
| % Moved From Diff. State (ACS) | MCAS-Alt — % at Progressing | -0.00 | -0.00 | 135 |
| % Teachers in Special Education (2026) | MCAS Gr10 ELA % M+E — Male | -0.00 | -0.01 | 216 |
| % in CTE (Chapter 74) | Dropout Rate (4-yr cohort) | -0.00 | +0.09 | 60 |
| % Outflow (Choice + Charter) | SWD — Sensory Impairment | +0.00 | +0.01 | 192 |
| % Planning Any College | % Teachers 57+ (approaching retirement, 2026) | -0.00 | +0.02 | 235 |
| % of Accountability Targets Met | Required Local Contribution (2026) | +0.00 | -0.03 | 278 |
| Grad Gap — Black/African Am. (vs all) | % Housing Units Vacant (ACS) | -0.00 | +0.14 | 140 |
| % Age 65+ (ACS) | MCAS Gr10 Math M+E — Low Income | -0.00 | +0.03 | 212 |

## Curated presets — Expected / confirming

### Household income × 10th-grade math
- **Median Household Income (ACS)** × **MCAS Gr10 Math % Meeting/Exceeding**
- Pearson +0.83, Spearman +0.81, n=218
- The classic gradient: richer towns post far higher MCAS 10th-grade math pass rates. A clean, strong positive relationship that orients you to the map's main north-south spread.

### Low-income share × grade 3–8 reading
- **% Low Income** × **MCAS Gr3-8 ELA % Meeting/Exceeding**
- Pearson -0.84, Spearman -0.86, n=274
- Districts with more low-income students have markedly lower early-grade ELA proficiency — the single strongest poverty-to-outcome link in the data.

### Adults with degrees × 10th-grade English
- **% Bachelor** × **MCAS Gr10 ELA % Meeting/Exceeding**
- Pearson +0.84, Spearman +0.83, n=218
- Where more adults hold a bachelor's degree, students score higher on 10th-grade ELA. Parental education tracks achievement almost as tightly as income.

### Income × four-year-college enrollment
- **Median Household Income (ACS)** × **% Enrolled in 4-Year College**
- Pearson +0.82, Spearman +0.88, n=217
- Wealthier districts send a much larger share of graduates straight to four-year colleges — opportunity compounds with income.

### Low income × chronic absenteeism
- **% Low Income** × **Chronic Absenteeism Rate**
- Pearson +0.81, Spearman +0.80, n=280
- Chronic absence rises steeply with the low-income share — poverty shows up as missed school days, not just lower test scores.

### Early reading × graduation rate
- **MCAS Gr3-8 ELA % Meeting/Exceeding** × **4-yr Graduation Rate**
- Pearson +0.69, Spearman +0.71, n=216
- Districts that get more kids reading proficiently by grade 8 graduate more of them on time. Early literacy is an early-warning signal you can see on the map.

### Educated towns × AP enrollment
- **% Bachelor** × **% Jr/Sr Taking AP/IB Course**
- Pearson +0.69, Spearman +0.70, n=218
- More college-educated communities push more juniors and seniors into AP/IB courses — a confirming signal of how expectations scale with adult education.

### Income × showing up to school
- **Median Household Income (ACS)** × **Attendance Rate**
- Pearson +0.58, Spearman +0.66, n=280
- Higher-income districts have higher daily attendance. A simple, intuitive pairing that makes the wealth gradient tangible.


## Curated presets — Surprising / worth a look

### Spending per pupil × math scores
- **Per-Pupil $ (Total)** × **MCAS Gr10 Math % Meeting/Exceeding**
- Pearson +0.13, Spearman +0.08, n=217
- Surprising: total per-pupil spending barely tracks 10th-grade math achievement. The highest-spending districts are NOT the highest-scoring — money and outcomes decouple, partly because high-need districts spend more by design.

### Teacher pay × student growth
- **Avg Teacher Salary (2024)** × **MCAS Math — Avg Growth (SGP)**
- Pearson +0.11, Spearman +0.22, n=273
- Counterintuitive: districts paying the highest average teacher salaries do not show faster student growth (SGP). Salary tracks local cost-of-living more than how much kids improve year to year.

### Diversity × student growth
- **Student Diversity Index** × **MCAS ELA — Avg Growth (SGP)**
- Pearson +0.05, Spearman +0.06, n=273
- Worth a look: student racial diversity is essentially uncorrelated with academic growth. Diverse districts span the full range of growth — a useful counter to the assumption that demographics determine progress.

### Commute time × math scores
- **Mean Commute to Work (min, ACS)** × **MCAS Gr10 Math % Meeting/Exceeding**
- Pearson +0.26, Spearman +0.24, n=218
- Unexpected angle: longer average commutes weakly track higher math scores — a proxy for affluent, car-dependent suburbs that send parents far to work and post strong results.

### Home values × discipline rate
- **Median Home Value (ACS)** × **Students Disciplined Rate**
- Pearson -0.41, Spearman -0.40, n=280
- Pricey-housing districts discipline a smaller share of students. Housing cost — a wealth proxy — maps onto who gets suspended, a sobering cross-domain pattern.

### Students leaving × math scores
- **% Leaving via School Choice** × **MCAS Gr3-8 Math % Meeting/Exceeding**
- Pearson -0.34, Spearman -0.58, n=227
- Districts losing more resident students to school choice tend to have lower math proficiency — families voting with their feet, visible as an outflow-vs-outcomes pattern on the map.

### Counselor caseload × graduation
- **Students per Counselor** × **4-yr Graduation Rate**
- Pearson +0.04, Spearman +0.13, n=220
- Surprising how weak it is: the number of students per guidance counselor barely predicts graduation rates. Staffing ratios alone don't tell the outcome story people expect.

### Income × separate special-ed placement
- **Median Household Income (ACS)** × **% SWD Substantially Separate**
- Pearson -0.50, Spearman -0.50, n=251
- Counterintuitive: wealthier districts place FEWER students with disabilities in substantially-separate settings. Lower-income districts lean on segregated placements more — inclusion tracks money, not need.

### Class crowding × math scores
- **Student : Teacher Ratio** × **MCAS Gr10 Math % Meeting/Exceeding**
- Pearson +0.05, Spearman +0.06, n=217
- Surprising non-result: the number of students per teacher is essentially unrelated to 10th-grade math scores. Bigger classes don't mean worse outcomes here — a caution against reading the ratio as a quality signal.

### Work-from-home × college-going
- **Worked From Home (ACS)** × **% Enrolled in 4-Year College**
- Pearson +0.76, Spearman +0.79, n=217
- An odd but real proxy: districts with more remote workers send more grads to four-year colleges — remote work concentrates in the same educated, higher-income communities.

