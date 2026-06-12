# DESE open-data ledger — all 91 datasets accounted for

Domain: `educationtocareer.data.mass.gov` (DESE's open-data hub). Goal: tap every dataset
that yields a K-12 **district- or school-level** education metric; assign the rest to the
layer they belong to or mark why they're not usable. Counts as of this expansion pass.

## Summary (91 total)
| Disposition | # | |
|---|--:|---|
| **Used** as district/school metrics | **51** | 39 prior + **12 this pass** |
| → **Colleges layer** (public-postsecondary institution data) | 12 | belongs to the IPEDS colleges layer |
| → **Childcare/EEC layer** (licensing/enrollment of care programs) | 8 | belongs to the EEC child-care layer |
| Educator-prep programs (higher-ed, not K-12) | 5 | not a district metric |
| Skip — legacy / reference / duplicate / state-only / niche | 15 | reasons below |

## ✅ Newly used this pass (12 datasets → +20 metrics + 1 school field)
- `9vfm-6vxq` Earnings by group → **new "Earnings & employment"** category (avg earnings, employment %, low-income earnings).
- `p2yd-4gvj` + `yau2-eqsf` Early College participation/credits → 5 metrics (Advanced coursework).
- `vj54-j4q3` College & Career Outcomes → `grad_pct_employed`, `grad_pct_disconnected` (Postsecondary outcomes).
- `ks7h-2kdy` MCAS-Alt → `mcas_alt_progressing_pct`. `8aww-sugs` SPED in/out → move-in/out. `4as3-w39x` Attrition → `student_attrition_pct`. `cdfp-645n` SWD→postsec → SWD 5-yr grad + persistence.
- `a4b4-k49f` Educators by age → early-career / near-retirement share. `vd2f-ib9q` → `teacher_sped_pct`.
- `i5up-aez6` School Expenditures → **`sch_per_pupil`** on the school popup.
- `cmm7-ttbg` Dropout Report → `dropout_annual_pct` (existing `dropout_pct` relabeled "4-yr cohort").

## → Colleges layer (12 — defer to that layer's owner; not K-12 district)
`j7yp-crt6` `hx2h-9z86` (postsec annual enrollment), `gzpm-dvfd` `v4jy-wi85` (fall enrollment),
`fszq-dme2` `5yjf-27fz` `79yf-3ucb` (degrees conferred), `gamm-8t4n` `ezse-47sq` `73s2-v3nk`
(first-year retention by gender/race/summary), `n8nv-juq7` (institution locations), `3bpk-k8k2`
(tuition & fees). These are MA *public-college* stats → would enrich the existing colleges
point layer + popup, not a district choropleth.

## → Childcare / EEC layer (8 — defer; facility/program-level, not district)
`yvqy-nszj` (children enrolled in formal EEC), `iyks-y3g6` `dn4d-tjbb` `dz9s-eep7` (licensed/funded
programs + openings), `fuam-di5w` (early-childhood workforce), `6vdc-7ggh` (child-care financial-aid
waitlist), `5722-nbhm` (C3 grants), `wfrf-ryb9` (residential/placement programs). These belong with
the EEC child-care points layer + the planned child-care-access town metric.

## Educator-prep programs (5 — higher-ed, not a K-12 district metric)
`8ura-7r8n` `t375-4q57` `tfbb-6vx7` `vrmj-6h37` `xt3e-byts` — about teacher-preparation colleges
(candidate enrollment / completers / staff). No district grain.

## Skip — with reason (15)
- **State-level only (not mappable):** `bfp2-2pmt` + `jqvp-ngaw` **VOCAL climate survey** — only a single `dist_code=00000000` (State) row; DESE does not publish VOCAL per district. (The one genuinely-relatable category we *can't* build.)
- **Legacy/historical:** `ccsh-ajgw` `shzx-cvwg` (legacy MCAS — superseded by current).
- **Reference/crosswalk (not metrics):** `6c8i-436p` (awards meta-major), `8ibc-ffun` (CTE→occupation crosswalk).
- **Duplicates of existing metrics:** `a9ye-ac8e` (MassCore = `masscore_pct`), `37px-xsir` (Plans of HS grads = `pct_any_college` etc.), `cbbr-jpy4` (Non-Public Enrollment = `private_school_pct`, no denominator), `wxc8-6an4` (earnings by industry — too granular), `ky22-vsgr` (licensure by race = `educators_of_color_pct`), `77fu-a6h8` (teachers by grade/subject — no clean denominator).
- **Niche:** `tbch-rmta` (collaborative level of need), `qjx9-arjj` (MTEL educator-exam pass rates), `92x3-2qj9` (SPED placement trajectory — superseded by the placement metrics already shipped).

**Bottom line:** every DESE dataset that yields a district/school K-12 metric is now tapped.
What remains is either another layer's data (colleges, child-care), higher-ed/educator-prep,
or genuinely unusable (state-only VOCAL, legacy, reference, duplicates).
