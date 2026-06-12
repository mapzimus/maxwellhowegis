/* ============================================================================
   MA Education Atlas
   MapLibre GL JS · OpenFreeMap vector tiles · MassGIS polygons · MA DESE data

   Standalone statewide tool — every public school + school district in MA,
   40+ joined metrics, palettes, classification methods, hover, side panel.

   Architecture:
     - Always-on reference layers (muni borders, district borders, town labels)
     - One configurable CHOROPLETH layer (target = muni | district)
     - 40+ metrics across demographics, academic, outcomes, finance, workforce
     - 12 color palettes (ColorBrewer-style sequential + diverging)
     - 4 classification methods: Jenks (default) / quantile / equal-interval / continuous
     - Click any polygon → sticky right-side detail panel
   ============================================================================ */

// ─── DATA SOURCES (same-origin, slim simplified GeoJSON) ─────────────────────
const SOURCES = {
    academic:      "data/ma_academic_districts.geojson",   // dissolved town polygons (~250)
    ccuv:          "data/ma_districts_metrics.geojson",    // charter/voc-tech/collab (150)
    municipalities:"data/ma_municipalities.geojson",
    maSchools:     "data/ma_public_schools.geojson",       // all MA public + charter schools (~1700)
    maPrivateSchools: "data/ma_private_schools.geojson",    // NCES PSS private schools (507) — reference only, no DESE data
    maColleges:    "data/ma_colleges.geojson",             // MA colleges/universities (IPEDS, ~110) — reference layer
    maChildcare:   "data/ma_childcare.geojson",            // EEC licensed child care / daycare (~8,900) — lazy reference layer
    muniAcs:       "data/ma_muni_acs.json",                 // optional ACS basics (MHI, attainment, etc.)
    muniChildcare: "data/ma_muni_childcare.json",          // child-care capacity per child under 5 (EEC licensing + ACS), by TOWN_ID
    muniChildcareExtra: "data/ma_muni_childcare_extra.json", // child-care: infant/toddler, subsidy, Head Start, C3 grant metrics (EEC), by TOWN_ID
    districtChildcare:  "data/ma_district_childcare.json",  // all child-care metrics rolled up to academic districts
    districtComposites: "data/ma_district_composites.json",  // composite indices (cost-of-living, livability, opportunity) — z-score blends of existing metrics
    districtAcs:   "data/ma_district_acs.json",             // ACS aggregated up to academic districts
    districtEduExtra: "data/ma_district_edu_extra.json",    // attendance/chronic-absent/teacher cols from DESE
    districtDiscipline: "data/ma_district_discipline.json", // students-disciplined / OSS / ISS rates (DESE, SY2025)
    districtOutcomes:   "data/ma_district_outcomes_extra.json", // SAT / class size / stability / churn (DESE, SY2025)
    muniAcsExtra:       "data/ma_muni_acs_extra.json",      // ACS extras (home value, commute, age, broadband, owner-occ)
    districtAcsExtra:   "data/ma_district_acs_extra.json",  // ACS extras aggregated up to districts
    schoolMetrics:      "data/ma_school_metrics.json",      // per-school enrollment / MCAS / accountability (by SCHID)
    muniTimeseries:     "data/ma_muni_timeseries.json",     // muni year-keyed columns, lazy-loaded on muni level
    districtPostsec:    "data/ma_district_postsec.json",    // actual college enrollment + persistence (NSC/DESE)
    districtEL:         "data/ma_district_el.json",         // English-learner progress (ACCESS, DESE)
    districtEducator:   "data/ma_district_educator.json",   // teacher salary / licensure / attendance (DESE)
    districtFinance:    "data/ma_district_finance.json",    // Chapter 70 / NSS / foundation budget (DESE)
    muniAcsExtra2:      "data/ma_muni_acs_extra2.json",     // ACS round 2 (unemployment, uninsured, disability, …)
    districtAcsExtra2:  "data/ma_district_acs_extra2.json", // ACS round 2 aggregated up to districts
    districtSped:       "data/ma_district_sped.json",       // special-ed placement/inclusion (DESE)
    districtAdvanced:   "data/ma_district_advanced.json",   // advanced course completion + AP/IB participation (DESE)
    districtMcasGrades: "data/ma_district_mcas_grades.json", // grade-3/4/8 MCAS % Meeting/Exceeding (DESE)
    districtSupport:    "data/ma_district_support.json",    // students-per support-staff FTE ratios (DESE)
    muniAcsExtra3:      "data/ma_muni_acs_extra3.json",     // ACS round 3 (rent, SNAP, veterans, mobility, single-parent)
    districtAcsExtra3:  "data/ma_district_acs_extra3.json", // ACS round 3 aggregated up to districts
    districtEarlyEd:    "data/ma_district_early_ed.json",   // full-day K + pre-K access (DESE)
    districtCte:        "data/ma_district_cte.json",        // Chapter 74 CTE enrollment (DESE)
    districtDiscDetail: "data/ma_district_discipline_detail.json", // expulsion / emergency-removal / days lost (DESE)
    muniAcsExtra4:      "data/ma_muni_acs_extra4.json",     // ACS round 4 (computer, limited-English, earnings, …)
    districtAcsExtra4:  "data/ma_district_acs_extra4.json", // ACS round 4 aggregated up to districts
    districtGrowth:        "data/ma_district_growth.json",         // MCAS Gr3-8 student growth percentile (DESE)
    districtMcasLevels:    "data/ma_district_mcas_levels.json",    // MCAS % Exceeding / % Not Meeting (DESE)
    districtChoice:        "data/ma_district_choice.json",         // resident-student outflow via choice/charter (DESE)
    districtAccountability:"data/ma_district_accountability.json", // % of accountability targets met (DESE)
    muniAcsExtra5:         "data/ma_muni_acs_extra5.json",         // ACS round 5 (grad degree, gini, housing age, …)
    districtAcsExtra5:     "data/ma_district_acs_extra5.json",     // ACS round 5 aggregated up to districts
    districtMcasGrades2:   "data/ma_district_mcas_grades2.json",   // grade-5/6/7 MCAS % Meeting/Exceeding (DESE)
    districtRetention:     "data/ma_district_retention.json",      // student grade-retention rate (DESE)
    districtGradDetail:    "data/ma_district_grad_detail.json",    // 4-yr cohort: still-enrolled/GED/non-grad/excluded (DESE)
    districtDropoutAnnual: "data/ma_district_dropout_annual.json", // ANNUAL (single-year) grades 9-12 dropout rate (DESE cmm7-ttbg) — distinct from the cohort dropout_pct
    districtEducator2:     "data/ma_district_educator2.json",      // educators of color + principal retention (DESE)
    muniAcsExtra6:         "data/ma_muni_acs_extra6.json",         // ACS round 6 (per-capita income, poverty, commute mode, …)
    districtAcsExtra6:     "data/ma_district_acs_extra6.json",     // ACS round 6 aggregated up to districts
    districtMcasG10Sci:    "data/ma_district_mcas_g10_sci.json",   // Gr10 MCAS levels + Gr5/8 science (DESE)
    districtDiscGroups:    "data/ma_district_discipline_groups.json", // OSS rate by student subgroup (DESE)
    districtClassSize:     "data/ma_district_class_size.json",     // class size by subject (DESE)
    districtFinanceDetail: "data/ma_district_finance_detail.json", // per-pupil spending categories (DESE)
    districtFinanceCategories: "data/ma_district_finance_categories.json", // more per-pupil functional categories: PD, other teaching (DESE er3w-dyti)
    districtTransport:     "data/ma_district_transport.json",     // per-pupil transportation (in/out-of-district) + food spending: total $ by function (DESE cnfs-edqq) ÷ FTE
    muniAcsExtra7:         "data/ma_muni_acs_extra7.json",         // ACS round 7 (age 65+, school-age, transit, …)
    districtAcsExtra7:     "data/ma_district_acs_extra7.json",     // ACS round 7 aggregated up to districts
    districtAbsenceGroups: "data/ma_district_absence_groups.json", // chronic absence by student subgroup (DESE)
    districtMcasGroups:    "data/ma_district_mcas_groups.json",    // MCAS Gr3-8 % Meeting/Exceeding by student subgroup (DESE)
    districtApDetail:      "data/ma_district_ap_detail.json",      // AP exam intensity/breadth (DESE)
    muniAcsExtra8:         "data/ma_muni_acs_extra8.json",         // ACS round 8 (occupation, rooms, mobility, …)
    districtAcsExtra8:     "data/ma_district_acs_extra8.json",     // ACS round 8 aggregated up to districts
    // Underserved subgroups (feat/underserved-subgroups): MCAS Gr3-8 % M+E for
    // military-connected / foster-care / homeless families — small DESE-suppressed
    // populations the atlas could not show. (Migrant skipped — only 4 districts.)
    districtMcasGroupsOther: "data/ma_district_mcas_groups_other.json", // Gr3-8 ELA+Math % M+E: Military/Foster/Homeless (DESE i9w6-niyt, SY2025)
    // Early college + HS-graduate outcomes (feat/early-college-outcomes)
    districtEarlyCollege:  "data/ma_district_early_college.json",  // Early College participation rate + senior share + credits earned/per-student + credit-success (DESE p2yd-4gvj SY2024 / yau2-eqsf SY2023, ÷ enrollment t8td-gens)
    districtGradOutcomes:  "data/ma_district_grad_outcomes.json",  // actual HS-grad outcomes 1yr out: % employed, % disconnected ("Total Missing") (DESE vj54-j4q3, grad2020→2021)

    // ══════════════════════════════════════════════════════════════════════════
    // PARALLEL-SESSION DATA SLOTS — see plans/SESSION-S*.md and AGENTS.md.
    // Each session adds its data-file path on the line DIRECTLY AFTER its own anchor.
    // Never edit another session's anchor line — distinct insert points keep
    // concurrent PRs auto-mergeable (git merges non-overlapping hunks cleanly).
    // ── S1:accountability ──
    districtAcctDetail:    "data/ma_district_accountability_detail.json", // pctile (school roll-up) + curr-yr targets + %schools needing support (DESE ppbc-i8t9)
    // ── S2:vocational ──
    districtCteDetail:     "data/ma_district_cte_detail.json", // Ch74 programs offered, CTE cohort female/High-Needs share (DESE)
    // ── S3:sped ──
    districtSpedDetail:    "data/ma_district_sped_detail.json", // primary-disability shares of SWD (DESE n62c-bx65)
    // ── S4:el ──
    districtElDetail:      "data/ma_district_el_detail.json", // EL composition: avg WIDA level, years in MA, beginner/high shares (DESE)
    // ── S5:progression ──
    districtProgression:   "data/ma_district_progression.json", // 9th-grade course passing + student mobility (DESE)
    // ── S6:mcas-completeness ──
    districtMcasGrades3:   "data/ma_district_mcas_grades3.json", // Gr4 + Gr8 ELA % M+E (DESE)
    districtMcasGroups2:   "data/ma_district_mcas_groups2.json", // Gr3-8 +subgroups & Gr10-by-subgroup % M+E (DESE)
    // ── S7:subgroup-outcomes ──
    districtPostsecDetail: "data/ma_district_postsec_detail.json", // college-going by subgroup + 6-yr completion (DESE sg4g-eg2n)
    // ── S8:workforce ──
    districtEducator3:     "data/ma_district_educator3.json", // staff Asian % + admin/para staffing ratios (DESE j5ue-xkfn)
    // ── S9:trends ── (computed in-app — usually no new data file)
    // ── S10:gender ──
    districtGender:        "data/ma_district_gender.json", // MCAS Gr3-8 & Gr10 % M+E, 4-yr grad + dropout, split Male/Female (DESE i9w6-niyt + n2xa-p822)
    // ── S11:funding-revenue ──
    districtFinanceRevenue: "data/ma_district_finance_revenue.json", // Ch.70 state aid per pupil, required local contribution, local share of foundation (DESE Ch.70 summary chart FY2026)
    // ── S12:school-choice-landscape ──
    districtChoiceInflow:  "data/ma_district_choice_inflow.json", // School-Choice INFLOW + net (DESE 8xyg-59b2 receiving / vxt3-k35x sending)
    districtPrivate:       "data/ma_district_private.json", // % school-age in private/parochial + homeschool by town (DESE rdxw-mfv3)
    // ── S13:climate-safety ──
    districtClimateSafety: "data/ma_district_climate_safety.json", // bullying/restraint/law-referral per-100 (DESE 2kca-w7rq + 3ss8-pnvb, SY2025)
    // ── S14:whole-child-facilities ──
    districtWholeChild:    "data/ma_district_whole_child.json", // whole-child course-taking: arts/music enrollment, MassCore, advanced & DLCS coursework (DESE w3f3-phkq/a9ye-ac8e/ujwr-ux9i/fbdq-3q4d, SY2025)
    // ── earnings-outcomes (feat/earnings-outcomes) ──
    districtEarnings:      "data/ma_district_earnings.json", // post-grad earnings + employment of HS grads: avg earnings (All + Econ-Disadv) & employment rate (DESE 9vfm-6vxq, grad-2016 cohort observed in earnings-yr 2021, ~5yrs out)
    // ── feat/sped-assessment ──
    districtSpedDynamics:  "data/ma_district_sped_dynamics.json", // MCAS-Alt % Progressing + SpEd move in/out + student attrition + SWD 5-yr grad / 2nd-yr college persistence (DESE ks7h-2kdy/8aww-sugs/4as3-w39x/cdfp-645n)
    // ── teacher-workforce ──
    districtTeacherWorkforce: "data/ma_district_teacher_workforce.json", // teacher age profile (early-career <33 / approaching-retirement 57+) + SPED program share (DESE a4b4-k49f age groups + vd2f-ib9q program area, SY2026)
    // ── crdc-federal (feat/crdc-federal) ──
    districtCrdc:          "data/ma_district_crdc.json", // FEDERAL Civil Rights Data Collection 2020-21 (US ED/OCR, via Urban Institute API): interscholastic-athletics participation rate/count + girls' share — equity data DESE doesn't publish. Crosswalk: CCD state_leaid 'MA-XXXX' → DIST_CODE 'XXXX0000'.
    // ── seda-national (feat/seda-national) ──
    districtSeda:          "data/ma_district_seda.json", // Stanford Education Data Archive v6.0 — NATIONAL grade-equivalent benchmark: avg score vs U.S. average, learning rate, trend. Crosswalk via CCD leaid → DIST_CODE.
    // ── crdc-equity (feat/crdc-equity) ──
    districtCrdcEquity:    "data/ma_district_crdc_equity.json", // FEDERAL CRDC 2017-18 (last pre-COVID, US ED/OCR via Urban Institute API): % of students in a Gifted & Talented program + % in a school with a sworn law-enforcement officer — both wholly absent from DESE. Same CCD state_leaid 'MA-XXXX' → DIST_CODE 'XXXX0000' crosswalk. See scripts/fetch_crdc_equity.py.
    // ── seda-gaps (feat/seda-gaps) ──
    districtSedaGaps:      "data/ma_district_seda_gaps.json", // Stanford SEDA v6.0 SUBGROUP file — NATIONAL-scale achievement gaps in grade levels (white−Black, white−Hispanic, non-poor−poor), directly comparable across the U.S. unlike the MA-relative DESE gaps. Published gap rows (race/wbg, race/whg, ecd/neg); EB means pooled across math+rla. Crosswalk via CCD leaid → DIST_CODE. See scripts/fetch_seda_gaps.py.
    // ── crdc-courses (feat/crdc-courses) ──
    districtCrdcCourses:   "data/ma_district_crdc_courses.json", // FEDERAL CRDC 2017-18 (US ED/OCR via Urban Institute API): "does the HS OFFER it?" — % of high-school students in schools offering Calculus / Physics / Chemistry / Algebra II (num_classes_<subject> > 0). DESE publishes course-TAKING + AP scores but NOT whether these core advanced courses are OFFERED. HS = CCD school_level==3. Same CCD state_leaid 'MA-XXXX' → DIST_CODE 'XXXX0000' crosswalk. See scripts/fetch_crdc_courses.py.
    districtMobility:      "data/ma_district_mobility.json", // Opportunity Atlas (Raj Chetty / Opportunity Insights): ECONOMIC MOBILITY — predicted adult income rank + incarceration for low-income kids who GREW UP here (children born ~1978-83, outcomes ~2014-15). Tract→district via centroid point-in-polygon (shapely), unweighted tract mean. See scripts/fetch_mobility.py.
};

// Cache-bust the data files on each deploy so returning visitors don't get a
// stale layer when data/ is refreshed. Keep DATA_V in step with the app.js /
// style.css ?v= token in index.html (bump all together on deploy).
const DATA_V = "20260602o";
for (const k in SOURCES) SOURCES[k] += (SOURCES[k].includes("?") ? "&" : "?") + "v=" + DATA_V;

// ─── COLOR PALETTES (ColorBrewer-style) ──────────────────────────────────────
const PALETTES = {
    // Sequential
    Blues:   { type: "seq", colors: ["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"] },
    Greens:  { type: "seq", colors: ["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"] },
    Reds:    { type: "seq", colors: ["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"] },
    Oranges: { type: "seq", colors: ["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"] },
    Purples: { type: "seq", colors: ["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"] },
    Greys:   { type: "seq", colors: ["#ffffff","#f0f0f0","#d9d9d9","#bdbdbd","#969696","#737373","#525252","#252525","#000000"] },
    Viridis: { type: "seq", colors: ["#440154","#482878","#3e4a89","#31688e","#26828e","#1f9e89","#35b779","#6dcd59","#b4de2c","#fde725"] },
    Plasma:  { type: "seq", colors: ["#0d0887","#5402a3","#8b0aa5","#b83289","#db5c68","#f48849","#febc2a","#f0f921"] },
    Inferno: { type: "seq", colors: ["#000004","#1b0c41","#4a0c6b","#781c6d","#a52c60","#cf4446","#ed6925","#fb9b06","#f7d13d","#fcffa4"] },
    Magma:   { type: "seq", colors: ["#000004","#180f3d","#440f76","#721f81","#9e2f7f","#cd4071","#f1605d","#fd9567","#feca8d","#fcfdbf"] },
    Cividis: { type: "seq", colors: ["#00224e","#123570","#3b496c","#575d6d","#707173","#8a8779","#a59c74","#c3b369","#e1cc55","#fee838"] },
    Turbo:   { type: "seq", colors: ["#30123b","#4145ab","#4675ed","#39a2fc","#1bcfd4","#24eca6","#61fc6c","#a4fc3b","#d1e834","#f3c63a","#fe9b2d","#f36315","#d93806","#b11901","#7a0402"] },
    Mako:    { type: "seq", colors: ["#0b0405","#2c1e3d","#403891","#3a5fa9","#3585b5","#34b0bd","#56c9c0","#9adcc6","#dbf4ee"] },
    Rocket:  { type: "seq", colors: ["#03051a","#3b0f3f","#6a1c5f","#9a2865","#c43c4e","#e35d32","#f3812e","#f8ad5d","#facb9b","#faebdd"] },
    YlGnBu:  { type: "seq", colors: ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"] },
    YlOrRd:  { type: "seq", colors: ["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"] },
    GnBu:    { type: "seq", colors: ["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"] },
    PuRd:    { type: "seq", colors: ["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"] },
    BuPu:    { type: "seq", colors: ["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"] },
    // Diverging
    RdBu:    { type: "div", colors: ["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"] },
    RdYlGn:  { type: "div", colors: ["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"] },
    RdYlBu:  { type: "div", colors: ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"] },
    Spectral:{ type: "div", colors: ["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"] },
    BrBG:    { type: "div", colors: ["#543005","#8c510a","#bf812d","#dfc27d","#f6e8c3","#f5f5f5","#c7eae5","#80cdc1","#35978f","#01665e","#003c30"] },
    PiYG:    { type: "div", colors: ["#8e0152","#c51b7d","#de77ae","#f1b6da","#fde0ef","#f7f7f7","#e6f5d0","#b8e186","#7fbc41","#4d9221","#276419"] },
    PuOr:    { type: "div", colors: ["#7f3b08","#b35806","#e08214","#fdb863","#fee0b6","#f7f7f7","#d8daeb","#b2abd2","#8073ac","#542788","#2d004b"] },
    RdGy:    { type: "div", colors: ["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#ffffff","#e0e0e0","#bababa","#878787","#4d4d4d","#1a1a1a"] },
    PRGn:    { type: "div", colors: ["#40004b","#762a83","#9970ab","#c2a5cf","#e7d4e8","#f7f7f7","#d9f0d3","#a6dba0","#5aae61","#1b7837","#00441b"] },
    Coolwarm:{ type: "div", colors: ["#3b4cc0","#6788ee","#9abbff","#c9d7f0","#edd1c2","#f7a889","#e26952","#b40426"] },
    // More sequential ramps
    BuGn:    { type: "seq", colors: ["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"] },
    PuBu:    { type: "seq", colors: ["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"] },
    PuBuGn:  { type: "seq", colors: ["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"] },
    OrRd:    { type: "seq", colors: ["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"] },
    OrRd_r:  { type: "seq", colors: ["#7f0000","#b30000","#d7301f","#ef6548","#fc8d59","#fdbb84","#fdd49e","#fee8c8","#fff7ec"] },   // reversed OrRd — dark red at the LOW end, for "lower = worse" maps (e.g. child-care deserts)
    RdPu:    { type: "seq", colors: ["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"] },
    YlGn:    { type: "seq", colors: ["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"] },
    Teal:    { type: "seq", colors: ["#d7f9f5","#a9ece6","#7bd5d0","#4fc3c0","#2a9d9b","#147c7e","#085f63","#024247","#00282d"] },
    Sunset:  { type: "seq", colors: ["#fcde9c","#faa476","#f0746e","#e34f6f","#dc3977","#b9257a","#7c1d6f"] },
    Browns:  { type: "seq", colors: ["#fdf3e7","#f5e0c3","#e8c79a","#d6a86b","#bd8546","#9c6630","#7a4a20","#553013","#33190a"] },
    // Categorical / qualitative (distinct hues, no inherent order)
    Set1:    { type: "cat", colors: ["#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00","#ffff33","#a65628","#f781bf","#999999"] },
    Set2:    { type: "cat", colors: ["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"] },
    Set3:    { type: "cat", colors: ["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd"] },
    Dark2:   { type: "cat", colors: ["#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#666666"] },
    Paired:  { type: "cat", colors: ["#a6cee3","#1f78b4","#b2df8a","#33a02c","#fb9a99","#e31a1c","#fdbf6f","#ff7f00","#cab2d6","#6a3d9a"] },
    Accent:  { type: "cat", colors: ["#7fc97f","#beaed4","#fdc086","#ffff99","#386cb0","#f0027f","#bf5b17","#666666"] },
    Tableau: { type: "cat", colors: ["#4e79a7","#f28e2b","#e15759","#76b7b2","#59a14f","#edc948","#b07aa1","#ff9da7","#9c755f","#bab0ac"] },
};

// 3×3 bivariate palettes (Stevens). Colors are flat-indexed: row = metric A
// tertile (0=low, 2=high), col = metric B tertile (0=low, 2=high), so
// colors[tA*3 + tB]. Low/low is the lightest corner; high/high is the darkest.
const BIVAR_PALETTES = {
    pinkblue:  { name: "Pink × Blue",   colors: ["#e8e8e8","#b0d5df","#64acbe","#e4acac","#ad9ea5","#627f8c","#c85a5a","#985356","#574249"] },
    greenblue: { name: "Green × Blue",  colors: ["#e8e8e8","#b8d6be","#73ae80","#b5c0da","#90b2b3","#5a9178","#6c83b5","#567994","#2a5a5b"] },
    purpleorange:{name: "Purple × Orange", colors:["#e8e8e8","#e4c0a8","#c8865d","#c0a4c2","#a98876","#8e6e57","#7b4f88","#6a4974","#4a3a47"] },
    purpleteal: { name: "Purple × Teal", colors: ["#e8e8e8","#ace4e4","#5ac8c8","#dfb0d6","#a5add3","#5698b9","#be64ac","#8c62aa","#3b4994"] },
    purplegold: { name: "Purple × Gold", colors: ["#e8e8e8","#e4d9ac","#c8b35a","#cbb8d7","#c8ada0","#af8e53","#9972af","#976b82","#804d36"] },
    redgreen:    { name: "Red × Green",    colors: ["#e8e8e8","#bcd1c2","#91ba9c","#dec0bc","#b3a996","#879270","#d49891","#a9816b","#675738"] },
    blueyellow:  { name: "Blue × Yellow",  colors: ["#e8e8e8","#e0d6b8","#d8c588","#bbc3d1","#b3b2a1","#aba070","#8e9eba","#868c8a","#676549"] },
    tealmagenta: { name: "Teal × Magenta", colors: ["#e8e8e8","#dcbed2","#cf94bc","#bad2d0","#ada8ba","#a17ea4","#8cbcb9","#7f92a3","#5e5573"] },
};

// ─── FEATURED BIVARIATE PAIRINGS ─────────────────────────────────────────────
// Curated two-metric pairs for the "Featured pairings" picker. Picking one flips
// bivariate mode on and sets metric A (`a`) and metric B (`b`). Every id is a
// district-level metric in the METRICS catalog. `r` is the Pearson correlation
// across operating districts (n) — sourced from scripts/analysis/correlations.md.
// Two groups: "expected" (intuitive, orienting) and "surprising" (counterintuitive).
const BIVAR_PRESETS = {
    expected: [
        { a:"acs_median_household_income", b:"mcas_g10_math_me", r:0.83,  n:218, title:"Household income × 10th-grade math",
          blurb:"The classic gradient: richer towns post far higher MCAS 10th-grade math pass rates." },
        { a:"LI_PCT", b:"mcas_g38_ela_me", r:-0.84, n:274, title:"Low-income share × grade 3–8 reading",
          blurb:"More low-income students, markedly lower early-grade ELA proficiency — the strongest poverty-to-outcome link in the data." },
        { a:"acs_bachelors_plus_pct", b:"mcas_g10_ela_me", r:0.84, n:218, title:"Adults with degrees × 10th-grade English",
          blurb:"Where more adults hold a bachelor's degree, students score higher on 10th-grade ELA — parental education tracks achievement almost as tightly as income." },
        { a:"acs_median_household_income", b:"college_enroll_4yr_pct", r:0.82, n:217, title:"Income × four-year-college enrollment",
          blurb:"Wealthier districts send a much larger share of graduates straight to four-year colleges — opportunity compounds with income." },
        { a:"LI_PCT", b:"chronic_absent_pct", r:0.81, n:280, title:"Low income × chronic absenteeism",
          blurb:"Chronic absence rises steeply with the low-income share — poverty shows up as missed school days, not just lower scores." },
        { a:"mcas_g38_ela_me", b:"grad_4yr", r:0.69, n:216, title:"Early reading × graduation rate",
          blurb:"Districts that get more kids reading proficiently by grade 8 graduate more of them on time — early literacy as an early-warning signal." },
        { a:"acs_bachelors_plus_pct", b:"ap_participation_pct", r:0.69, n:218, title:"Educated towns × AP enrollment",
          blurb:"More college-educated communities push more juniors and seniors into AP/IB courses — expectations scale with adult education." },
        { a:"acs_median_household_income", b:"attendance_rate", r:0.58, n:280, title:"Income × showing up to school",
          blurb:"Higher-income districts have higher daily attendance — a simple pairing that makes the wealth gradient tangible." },
        { a:"LI_PCT", b:"college_persist_pct", r:-0.93, n:218, title:"Low income × college persistence",
          blurb:"Low-income districts don't just enroll fewer grads in college — the ones who go are less likely to make it to year two. Poverty's reach extends well past the front door." },
        { a:"mcas_g38_math_me", b:"college_enroll_4yr_pct", r:0.88, n:213, title:"Early math × four-year college",
          blurb:"Districts strong in grade 3–8 math send far more graduates to four-year colleges — early math proficiency is a long-range signal you can read a decade out." },
        { a:"pct_4yr_college", b:"college_enroll_4yr_pct", r:0.90, n:217, title:"College plans × actual enrollment",
          blurb:"Where more seniors say they're headed to a four-year college, more actually enroll — aspiration and access line up tightly across the state." },
        { a:"FLNE_PCT", b:"acs_non_english_pct", r:0.90, n:280, title:"Home language: school vs. Census",
          blurb:"The schools' 'first language not English' share and the Census 'speaks a non-English language at home' share track almost perfectly — two independent sources confirming the same communities." },
        { a:"mcas_g38_ela_me", b:"accountability_percentile", r:0.94, n:273, title:"State rating × actual reading",
          blurb:"The state's official accountability percentile closely tracks how many kids actually read proficiently by grade 8 — reassuring if you've wondered whether the headline rating reflects classroom results (proficiency is one of its biggest inputs)." },
    ],
    surprising: [
        { a:"per_pupil", b:"mcas_g10_math_me", r:0.13, n:217, title:"Spending per pupil × math scores",
          blurb:"Surprising: total per-pupil spending barely tracks 10th-grade math. The highest-spending districts aren't the highest-scoring — high-need districts spend more by design." },
        { a:"avg_teacher_salary", b:"mcas_math_sgp", r:0.11, n:273, title:"Teacher pay × student growth",
          blurb:"Counterintuitive: top-salary districts don't show faster student growth (SGP). Salary tracks cost-of-living more than how much kids improve year to year." },
        { a:"diversity_index", b:"mcas_ela_sgp", r:0.05, n:273, title:"Diversity × student growth",
          blurb:"Student racial diversity is essentially uncorrelated with academic growth — diverse districts span the full range, a counter to the idea that demographics determine progress." },
        { a:"acs_median_commute_min", b:"mcas_g10_math_me", r:0.26, n:218, title:"Commute time × math scores",
          blurb:"Unexpected angle: longer average commutes weakly track higher math scores — a proxy for affluent, car-dependent suburbs." },
        { a:"acs_median_home_value", b:"disc_students_pct", r:-0.41, n:280, title:"Home values × discipline rate",
          blurb:"Pricier-housing districts discipline a smaller share of students — housing cost, a wealth proxy, maps onto who gets suspended." },
        { a:"school_choice_out_pct", b:"mcas_g38_math_me", r:-0.34, n:227, title:"Students leaving × math scores",
          blurb:"Districts losing more resident students to school choice tend to have lower math proficiency — families voting with their feet." },
        { a:"students_per_counselor", b:"grad_4yr", r:0.04, n:220, title:"Counselor caseload × graduation",
          blurb:"Surprising how weak it is: students-per-counselor barely predicts graduation. Staffing ratios alone don't tell the outcome story people expect." },
        { a:"acs_median_household_income", b:"sped_separate_pct", r:-0.50, n:251, title:"Income × separate special-ed placement",
          blurb:"Counterintuitive: wealthier districts place FEWER students with disabilities in substantially-separate settings — inclusion tracks money, not need." },
        { a:"stu_tchr_ratio", b:"mcas_g10_math_me", r:0.05, n:217, title:"Class crowding × math scores",
          blurb:"Surprising non-result: students-per-teacher is essentially unrelated to 10th-grade math — a caution against reading the ratio as a quality signal." },
        { a:"acs_work_from_home_pct", b:"college_enroll_4yr_pct", r:0.76, n:217, title:"Work-from-home × college-going",
          blurb:"An odd but real proxy: districts with more remote workers send more grads to four-year colleges — remote work concentrates in the same educated, higher-income communities." },
        { a:"sped_separate_pct", b:"acs_multiunit_pct", r:0.44, n:251, title:"Separate special-ed × apartment density",
          blurb:"Districts with more multi-unit (apartment) housing place more students with disabilities in separate settings — an urban placement pattern, not a needs-based one." },
        { a:"dropout_pct", b:"acs_uninsured_pct", r:0.51, n:219, title:"Dropouts × uninsured residents",
          blurb:"Dropout rates rise where more residents lack health insurance — two faces of the same community economic distress, surfacing together on the map." },
        { a:"avg_class_size", b:"per_pupil_admin", r:-0.45, n:278, title:"Class size × administrative spending",
          blurb:"Counterintuitive: districts with bigger classes spend less per pupil on administration. Both move with district scale and wealth, not with each other directly." },
        { a:"grade_retention_pct", b:"acs_bachelors_plus_pct", r:-0.45, n:280, title:"Holding kids back × educated towns",
          blurb:"Grade retention is rarer in more college-educated communities — whether a student repeats a grade tracks the town's adult education level as much as the student." },
        { a:"ap_subjects_offered", b:"_pop_density_per_sqmi", r:0.43, n:215, title:"AP variety × population density",
          blurb:"Denser, more urban districts offer a wider menu of AP subjects — course access scales with population, a quiet rural-urban equity gap (Spearman is stronger still, +0.57)." },
        { a:"mcas_math_low_income", b:"acs_mgmt_occ_pct", r:0.45, n:275, title:"Low-income kids' math × professional town",
          blurb:"Even low-income students post higher math scores where more adults work professional/management jobs — a neighborhood spillover that reaches beyond a family's own income." },
        { a:"ap_participation_pct", b:"grade_retention_pct", r:-0.45, n:218, title:"AP access × holding kids back",
          blurb:"Worth a look: districts that push more juniors and seniors into AP/IB courses hold back fewer students in the earlier grades. Both move with a district's overall academic press, not with each other directly." },
        { a:"churn_pct", b:"el_proficiency_pct", r:-0.45, n:230, title:"Student churn × English-learner progress",
          blurb:"Where students move in and out mid-year more often, a smaller share of English learners reach proficiency — instability in the student body shows up first in the kids who can least afford a disrupted year." },
        { a:"mcas_g6_ela_me", b:"student_attrition_pct", r:-0.45, n:260, title:"Middle-grade reading × students leaving",
          blurb:"Districts with stronger 6th-grade reading lose fewer students to attrition — whether families stay tracks how well the middle grades are working, a quiet vote of confidence you can read on the map." },
    ],
};

// ─── METRIC CATALOG ──────────────────────────────────────────────────────────
const METRICS = [
    // Demographics
    { id:"TOTAL_CNT",  label:"Total Enrollment",            cat:"Demographics", levels:["district","muni"], palette:"Blues",   format:"num" },
    { id:"EL_PCT",     label:"% English Learner",           cat:"Demographics", levels:["district","muni"], palette:"Greens",  format:"pct" },
    { id:"LI_PCT",     label:"% Low Income",                cat:"Demographics", levels:["district","muni"], palette:"Reds",    format:"pct" },
    { id:"HN_PCT",     label:"% High Needs",                cat:"Demographics", levels:["district","muni"], palette:"Purples", format:"pct" },
    { id:"HL_PCT",     label:"% Hispanic / Latino",         cat:"Demographics", levels:["district","muni"], palette:"Oranges", format:"pct" },
    { id:"BAA_PCT",    label:"% Black / African Am.",       cat:"Demographics", levels:["district","muni"], palette:"Purples", format:"pct" },
    { id:"AS_PCT",     label:"% Asian",                     cat:"Demographics", levels:["district","muni"], palette:"Blues",   format:"pct" },
    { id:"WH_PCT",     label:"% White",                     cat:"Demographics", levels:["district","muni"], palette:"Greys",   format:"pct" },
    { id:"SWD_PCT",    label:"% Students w/ Disabilities",  cat:"Demographics", levels:["district","muni"], palette:"Purples", format:"pct" },
    { id:"FLNE_PCT",   label:"% First Lang Not English",    cat:"Demographics", levels:["district","muni"], palette:"Greens",  format:"pct" },
    // Computed in-app: student racial diversity (Gini–Simpson index, 0–1, higher = more diverse).
    { id:"diversity_index", label:"Student Diversity Index",  cat:"Demographics", levels:["district"], palette:"BuPu", format:"num" },
    { id:"FE_PCT",     label:"% Formerly English Learner",  cat:"Demographics", levels:["district"],        palette:"Greens",  format:"pct" },

    // Academic
    // mcas_g38_* live only on district features (no muni-level join); restricted accordingly
    { id:"mcas_g10_ela_me",  label:"MCAS Gr10 ELA % Meeting/Exceeding",   cat:"Academic", levels:["district","muni"], palette:"Viridis", format:"pct" },
    { id:"mcas_g10_math_me", label:"MCAS Gr10 Math % Meeting/Exceeding",  cat:"Academic", levels:["district","muni"], palette:"Viridis", format:"pct" },
    { id:"mcas_g10_sci_me",  label:"MCAS Gr10 Science % Meeting/Exceeding",   cat:"Academic", levels:["district","muni"], palette:"Viridis", format:"pct" },
    { id:"mcas_g38_ela_me",  label:"MCAS Gr3-8 ELA % Meeting/Exceeding",  cat:"Academic", levels:["district"],        palette:"Viridis", format:"pct" },
    { id:"mcas_g38_math_me", label:"MCAS Gr3-8 Math % Meeting/Exceeding", cat:"Academic", levels:["district"],        palette:"Viridis", format:"pct" },
    { id:"mcas_g38_sci_me",  label:"MCAS Gr3-8 Science % Meeting/Exceeding",  cat:"Academic", levels:["district"],        palette:"Viridis", format:"pct" },
    // Grade-level MCAS (DESE, SY2025) — early literacy/numeracy + algebra readiness.
    { id:"mcas_g3_ela_me",   label:"MCAS Gr3 ELA % Meeting/Exceeding",    cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g3_math_me",  label:"MCAS Gr3 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g4_math_me",  label:"MCAS Gr4 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g8_math_me",  label:"MCAS Gr8 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g5_ela_me",   label:"MCAS Gr5 ELA % Meeting/Exceeding",    cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g5_math_me",  label:"MCAS Gr5 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g6_ela_me",   label:"MCAS Gr6 ELA % Meeting/Exceeding",    cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g6_math_me",  label:"MCAS Gr6 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g7_ela_me",   label:"MCAS Gr7 ELA % Meeting/Exceeding",    cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"mcas_g7_math_me",  label:"MCAS Gr7 Math % Meeting/Exceeding",   cat:"Academic", levels:["district"],        palette:"GnBu",    format:"pct" },
    // MCAS achievement-level tails (DESE, SY2025) — top (Exceeding) and bottom
    // (Not Meeting) of the distribution, distinct from the combined Meeting/Exceeding rate.
    { id:"mcas_g38_ela_exceeding",    label:"MCAS Gr3-8 ELA % Exceeding",    cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g38_ela_not_meeting",  label:"MCAS Gr3-8 ELA % Not Meeting",  cat:"Academic", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"mcas_g38_math_exceeding",   label:"MCAS Gr3-8 Math % Exceeding",   cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g38_math_not_meeting", label:"MCAS Gr3-8 Math % Not Meeting", cat:"Academic", levels:["district"], palette:"OrRd", format:"pct" },

    // Growth (MCAS SGP) — avg Gr3-8 student growth percentile (DESE, SY2025).
    // Scale is 1–99 (≈50 = average growth), NOT a percentage. Measures progress
    // independent of starting achievement level.
    { id:"mcas_ela_sgp",  label:"MCAS ELA — Avg Growth (SGP)",  cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    { id:"mcas_math_sgp", label:"MCAS Math — Avg Growth (SGP)", cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    // Grade-10 growth (the high-school slice) + the SWD equity-of-growth lens —
    // the only subgroup DESE breaks SGP out by. Same 1–99 scale, format "num".
    { id:"mcas_ela_sgp_g10",  label:"MCAS Gr10 ELA — Avg Growth (SGP)",   cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    { id:"mcas_math_sgp_g10", label:"MCAS Gr10 Math — Avg Growth (SGP)",  cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    { id:"mcas_ela_sgp_swd",  label:"MCAS Gr3-8 ELA Growth — SWD (SGP)",  cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    { id:"mcas_math_sgp_swd", label:"MCAS Gr3-8 Math Growth — SWD (SGP)", cat:"Growth (MCAS SGP)", levels:["district"], palette:"PuBuGn", format:"num" },
    // AP % scoring 3+ — now populated in the source (2007–2025 series + student-
    // group slices) at both muni and district levels, so the year slider and the
    // student-group filter both light up for it.
    { id:"ap_pct_3plus",     label:"AP Exams — % scoring 3+", cat:"Academic", levels:["district","muni"], palette:"YlGnBu", format:"pct" },

    // Advanced coursework — participation/completion (DESE), distinct from AP score.
    { id:"adv_course_completion_pct", label:"% Completing Advanced Course", cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"pct" },
    { id:"ap_participation_pct",      label:"% Jr/Sr Taking AP/IB Course",  cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"pct" },
    // AP exam intensity / breadth (DESE, SY2025), distinct from the AP-score metric.
    { id:"ap_exams_per_taker",       label:"AP Exams per Test-Taker",      cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"num" },
    { id:"ap_subjects_offered",      label:"Distinct AP Subjects Taken",   cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"num" },
    { id:"ap_tests_per_100",         label:"AP Exams per 100 Students",    cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"num" },
    { id:"ap_pct_score_3plus_exams", label:"% of AP Exams Scoring 3+",     cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"pct" },

    // Achievement by subgroup — MCAS Gr3-8 % Meeting/Exceeding per student group (DESE, SY2025),
    // the achievement-gap lens. Heavily suppressed for small subgroups.
    { id:"mcas_ela_low_income",  label:"MCAS Gr3-8 ELA Meeting/Exceeding — Low Income",            cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_swd",         label:"MCAS Gr3-8 ELA Meeting/Exceeding — SWD",                   cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_ell",         label:"MCAS Gr3-8 ELA Meeting/Exceeding — English Learners",      cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_black",       label:"MCAS Gr3-8 ELA Meeting/Exceeding — Black/African Am.",     cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_hispanic",    label:"MCAS Gr3-8 ELA Meeting/Exceeding — Hispanic/Latino",       cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_low_income", label:"MCAS Gr3-8 Math Meeting/Exceeding — Low Income",           cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_swd",        label:"MCAS Gr3-8 Math Meeting/Exceeding — SWD",                  cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_ell",        label:"MCAS Gr3-8 Math Meeting/Exceeding — English Learners",     cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_black",      label:"MCAS Gr3-8 Math Meeting/Exceeding — Black/African Am.",    cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_hispanic",   label:"MCAS Gr3-8 Math Meeting/Exceeding — Hispanic/Latino",      cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },

    // Equity GAPS (computed in-app). Achievement gaps = all-students − subgroup
    // (positive = subgroup trails the district average); discipline/absence gaps
    // = subgroup − all-students (positive = subgroup higher). All in percentage
    // points; the percent formatter shows them as %, including negatives.
    { id:"grad_gap_low_income",      label:"Grad Gap — Low Income (vs all)",       cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"grad_gap_swd",             label:"Grad Gap — SWD (vs all)",              cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_ela_gap_low_income",  label:"MCAS ELA Gap — Low Income (vs all)",   cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_math_gap_low_income", label:"MCAS Math Gap — Low Income (vs all)",  cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_ela_gap_swd",         label:"MCAS ELA Gap — SWD (vs all)",          cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_math_gap_swd",        label:"MCAS Math Gap — SWD (vs all)",         cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"oss_gap_low_income",       label:"Suspension Gap — Low Income (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"chronic_gap_low_income",   label:"Absence Gap — Low Income (vs all)",    cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"grad_gap_ell",             label:"Grad Gap — English Learners (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"grad_gap_hispanic",        label:"Grad Gap — Hispanic/Latino (vs all)",  cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"grad_gap_black",           label:"Grad Gap — Black/African Am. (vs all)",cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_ela_gap_ell",         label:"MCAS ELA Gap — English Learners (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_ela_gap_hispanic",    label:"MCAS ELA Gap — Hispanic/Latino (vs all)",  cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_ela_gap_black",       label:"MCAS ELA Gap — Black/African Am. (vs all)",cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_math_gap_ell",        label:"MCAS Math Gap — English Learners (vs all)",cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_math_gap_hispanic",   label:"MCAS Math Gap — Hispanic/Latino (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"mcas_math_gap_black",      label:"MCAS Math Gap — Black/African Am. (vs all)",cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"oss_gap_swd",              label:"Suspension Gap — SWD (vs all)",        cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"oss_gap_black",            label:"Suspension Gap — Black/African Am. (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"oss_gap_hispanic",         label:"Suspension Gap — Hispanic/Latino (vs all)",   cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"chronic_gap_swd",          label:"Absence Gap — SWD (vs all)",           cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"chronic_gap_ell",          label:"Absence Gap — English Learners (vs all)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },
    { id:"teacher_rep_gap",          label:"Teacher Representation Gap (students − educators of color)", cat:"Equity gaps", levels:["district"], palette:"PuOr", format:"pct" },

    // Enrollment trend (computed in-app from year-keyed TOTAL_CNT). Diverging
    // around 0: decline = red, growth = blue.
    { id:"enroll_change_5yr",  label:"Enrollment Change — 5-Year",  cat:"Trends", levels:["district"], palette:"RdBu", format:"pct" },
    { id:"enroll_change_10yr", label:"Enrollment Change — 10-Year", cat:"Trends", levels:["district"], palette:"RdBu", format:"pct" },
    // Career / vocational — Chapter 74 CTE enrollment (DESE, SY2026). Only the 60
    // comprehensive districts that host in-house CTE report; standalone regional
    // voc-tech districts (≈100% CTE) aren't in the academic-district set.
    { id:"cte_enrollment_pct",        label:"% in CTE (Chapter 74)",        cat:"Career / vocational", levels:["district"], palette:"YlGnBu", format:"pct" },
    // SAT means — DESE SY2025, district-level only (single year), raw mean → "num".
    { id:"sat_total_mean",   label:"SAT Total (mean)",        cat:"Academic", levels:["district"], palette:"Viridis", format:"num" },
    { id:"sat_ebrw_mean",    label:"SAT EBRW (mean)",         cat:"Academic", levels:["district"], palette:"Viridis", format:"num" },
    { id:"sat_math_mean",    label:"SAT Math (mean)",         cat:"Academic", levels:["district"], palette:"Viridis", format:"num" },
    // (Class-size metrics moved to the Workforce / "Teachers & Staff" group — they
    // measure teacher load, alongside Student:Teacher Ratio, not achievement.)
    // MCAS Gr10 achievement-level tails + grade-level Science (DESE, SY2025).
    { id:"mcas_g10_ela_exceeding",    label:"MCAS Gr10 ELA % Exceeding",    cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_not_meeting",  label:"MCAS Gr10 ELA % Not Meeting",  cat:"Academic", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"mcas_g10_math_exceeding",   label:"MCAS Gr10 Math % Exceeding",   cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_math_not_meeting", label:"MCAS Gr10 Math % Not Meeting", cat:"Academic", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"mcas_g5_sci_me",            label:"MCAS Gr5 Science % Meeting/Exceeding",       cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g8_sci_me",            label:"MCAS Gr8 Science % Meeting/Exceeding",       cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },

    // Outcomes — graduation / dropout / cohort completion. grad_5yr / masscore_pct
    // only exist on district features. (Attendance + student-mobility rates moved to
    // their own groups: "Attendance & Absence" and "Enrollment Changes".)
    { id:"grad_4yr",            label:"4-yr Graduation Rate",        cat:"Outcomes", levels:["district","muni"], palette:"GnBu",    format:"pct" },
    { id:"grad_5yr",            label:"5-yr Graduation Rate",        cat:"Outcomes", levels:["district"],        palette:"GnBu",    format:"pct" },
    { id:"dropout_pct",         label:"Dropout Rate (4-yr cohort)",  cat:"Outcomes", levels:["district","muni"], palette:"Reds",    format:"pct" },
    // ANNUAL dropout rate (DESE "Dropout Report" cmm7-ttbg, SY2025): share of
    // grades 9-12 students who dropped out in ONE year. Distinct from the cohort
    // rate above (which tracks one 9th-grade cohort over four years) — across MA
    // districts the two differ by ~2pp on average. District-only (HS districts);
    // ~218 districts report. See scripts/fetch_dropout_annual.py.
    { id:"dropout_annual_pct",  label:"Dropout Rate (annual, Gr 9-12)", cat:"Outcomes", levels:["district"],     palette:"Reds",    format:"pct" },
    { id:"masscore_pct",        label:"MassCore Completion",         cat:"Outcomes", levels:["district"],        palette:"Greens",  format:"pct" },
    // 4-year cohort detail (DESE, SY2025) — the non-graduate outcomes that, with
    // grad_4yr + dropout_pct, complete the cohort to 100%.
    { id:"still_enrolled_pct",       label:"% Still Enrolled (4-yr cohort)",      cat:"Outcomes", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"ged_pct",                  label:"% Earned GED (4-yr cohort)",          cat:"Outcomes", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"non_grad_completer_pct",   label:"% Non-Grad Completer (4-yr cohort)",  cat:"Outcomes", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"permanently_excluded_pct", label:"% Permanently Excluded (4-yr cohort)",cat:"Outcomes", levels:["district"], palette:"BuPu", format:"pct" },

    // Progression — student grade-retention rate (DESE, SY2026; low statewide).
    { id:"grade_retention_pct",  label:"Grade Retention Rate",        cat:"Progression", levels:["district"], palette:"OrRd", format:"pct" },

    // District accountability — DESE ESSA cumulative % of targets met (SY2025).
    // (DESE assigns an accountability percentile to schools, not districts.)
    { id:"pct_targets_met",     label:"% of Accountability Targets Met", cat:"Accountability", levels:["district"], palette:"GnBu", format:"pct" },

    // Enrollment flow — resident students leaving via inter-district School Choice
    // or Commonwealth charters (DESE, SY2026; single-town districts only).
    { id:"school_choice_out_pct", label:"% Leaving via School Choice",  cat:"Enrollment flow", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"charter_out_pct",       label:"% Leaving to Charter Schools", cat:"Enrollment flow", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"enrollment_out_pct",    label:"% Outflow (Choice + Charter)", cat:"Enrollment flow", levels:["district"], palette:"OrRd", format:"pct" },
    // Student mobility — DESE Student Mobility Rate (SY2025), district-level only.
    // In-year churn / stability, grouped here with the other enrollment-change rates.
    { id:"stability_rate",      label:"Student Stability Rate",      cat:"Enrollment flow", levels:["district"], palette:"Greens", format:"pct" },
    { id:"churn_pct",           label:"Student Churn Rate",          cat:"Enrollment flow", levels:["district"], palette:"Reds",   format:"pct" },

    // Discipline — DESE Student Discipline (SY2025), All Students, district-level only.
    // disc_students_pct is computed from counts (disciplined / enrolled); OSS/ISS are
    // published rates. Suspension rates are small-cell suppressed for low-discipline
    // districts (≈209/274 coverage) while the disciplined rate covers ≈273/274.
    { id:"disc_students_pct",   label:"Students Disciplined Rate",     cat:"Discipline", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"disc_oss_pct",        label:"Out-of-School Suspension Rate", cat:"Discipline", levels:["district"], palette:"Reds", format:"pct" },
    { id:"disc_iss_pct",        label:"In-School Suspension Rate",     cat:"Discipline", levels:["district"], palette:"OrRd", format:"pct" },
    // Discipline detail (DESE, SY2025). Expulsions are near-zero statewide.
    { id:"expulsion_pct",         label:"Expulsion Rate",                cat:"Discipline", levels:["district"], palette:"Reds", format:"pct" },
    { id:"emergency_removal_pct", label:"Emergency Removal Rate",        cat:"Discipline", levels:["district"], palette:"Reds", format:"pct" },
    { id:"days_lost_per_100",     label:"Days Lost to Discipline / 100", cat:"Discipline", levels:["district"], palette:"Reds", format:"num" },

    // Attendance — all-students attendance + its chronic-absence twin (DESE Student
    // Attendance, SY2025; backfilled into data/ma_district_edu_extra.json).
    // chronic_absent_pct is also baked onto town features (bake_muni_extras.py) so it
    // maps at muni level; attendance_rate stays district-only. Sits in the Discipline
    // & Attendance tile, directly above the by-subgroup absence breakdowns below.
    { id:"attendance_rate",     label:"Attendance Rate",             cat:"Attendance", levels:["district"],        palette:"Greens",  format:"pct" },
    { id:"chronic_absent_pct",  label:"Chronic Absenteeism Rate",    cat:"Attendance", levels:["district","muni"], palette:"Reds",    format:"pct" },

    // Chronic absenteeism by subgroup — DESE SY2025, equity lens.
    { id:"chronic_low_income", label:"Chronic Absence — Low Income",         cat:"Absenteeism by group", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"chronic_swd",        label:"Chronic Absence — SWD",                cat:"Absenteeism by group", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"chronic_ell",        label:"Chronic Absence — English Learners",   cat:"Absenteeism by group", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"chronic_black",      label:"Chronic Absence — Black/African Am.",  cat:"Absenteeism by group", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"chronic_hispanic",   label:"Chronic Absence — Hispanic/Latino",    cat:"Absenteeism by group", levels:["district"], palette:"OrRd", format:"pct" },

    // Discipline by subgroup — out-of-school suspension rate per student group
    // (DESE, SY2025). An equity lens; heavily suppressed so coverage is lower.
    { id:"oss_low_income", label:"OSS Rate — Low Income",               cat:"Discipline by group", levels:["district"], palette:"Reds", format:"pct" },
    { id:"oss_swd",        label:"OSS Rate — Students w/ Disabilities",  cat:"Discipline by group", levels:["district"], palette:"Reds", format:"pct" },
    { id:"oss_ell",        label:"OSS Rate — English Learners",          cat:"Discipline by group", levels:["district"], palette:"Reds", format:"pct" },
    { id:"oss_black",      label:"OSS Rate — Black/African American",    cat:"Discipline by group", levels:["district"], palette:"Reds", format:"pct" },
    { id:"oss_hispanic",   label:"OSS Rate — Hispanic/Latino",           cat:"Discipline by group", levels:["district"], palette:"Reds", format:"pct" },

    // Postsecondary plans — only joined onto district features
    { id:"pct_any_college",     label:"% Planning Any College",      cat:"Postsecondary", levels:["district"], palette:"Viridis", format:"pct" },
    { id:"pct_4yr_college",     label:"% Planning 4-yr College",     cat:"Postsecondary", levels:["district"], palette:"Viridis", format:"pct" },
    { id:"pct_2yr_college",     label:"% Planning 2-yr College",     cat:"Postsecondary", levels:["district"], palette:"BuPu",    format:"pct" },
    { id:"pct_work_after_hs",   label:"% Planning to Work after HS", cat:"Postsecondary", levels:["district"], palette:"Oranges", format:"pct" },
    { id:"pct_military",        label:"% Planning Military",         cat:"Postsecondary", levels:["district"], palette:"Greys",   format:"pct" },

    // Postsecondary OUTCOMES — actual college enrollment + persistence (NSC/DESE,
    // SY2023), distinct from the self-reported "plans" above. District-only.
    { id:"college_enroll_pct",     label:"% Enrolled in College (16mo)", cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_4yr_pct", label:"% Enrolled in 4-Year College", cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_2yr_pct", label:"% Enrolled in 2-Year College", cat:"Postsecondary outcomes", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"college_persist_pct",    label:"% Persisting to 2nd Year",     cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },

    // English learners — ACCESS progress toward proficiency (DESE, SY2025). District-only.
    { id:"el_making_progress_pct", label:"% ELs Making Progress",     cat:"English learners", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"el_proficiency_pct",     label:"% ELs Reaching Proficiency", cat:"English learners", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"el_exiting_pct",         label:"% ELs Exiting EL Status",    cat:"English learners", levels:["district"], palette:"GnBu", format:"pct" },

    // Special education — placement setting / least-restrictive-environment (DESE,
    // SY2026). Distinct from SWD_PCT (prevalence) and the SWD outcome slices.
    { id:"sped_full_inclusion_pct",    label:"% SWD in Full Inclusion",      cat:"Special education", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"sped_partial_inclusion_pct", label:"% SWD in Partial Inclusion",   cat:"Special education", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"sped_separate_pct",          label:"% SWD Substantially Separate", cat:"Special education", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"sped_out_of_district_pct",   label:"% SWD Placed Out of District", cat:"Special education", levels:["district"], palette:"OrRd", format:"pct" },

    // Early education — DESE, SY2026. Full-day K is near-universal in MA (low variation).
    { id:"full_day_k_pct",   label:"% in Full-Day Kindergarten",        cat:"Early education", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"prek_per_k_ratio", label:"Pre-K Enrollment per Kindergartner", cat:"Early education", levels:["district"], palette:"BuPu", format:"num" },
    // Absolute PK/K headcounts (intuitive "how big is the program"; track district
    // size, so best read in the panel) + a low-income share of PK (equity rate).
    { id:"prek_enrollment",         label:"Pre-K Enrollment (count)",        cat:"Early education", levels:["district"], palette:"BuPu", format:"num" },
    // Muni-level child-care access: EEC licensed capacity ÷ ACS children under 5.
    // Capacity counts seats of all ages over an under-5 denominator (a supply
    // proxy, not an under-5-only ratio); very low / 0 = likely child-care desert.
    // Built by scripts/fetch_childcare_access.py (spatial join + Census Reporter).
    { id:"childcare_capacity_per_100_u5", label:"Child-Care Seats per 100 Children Under 5", cat:"Early education", levels:["muni","district"], palette:"OrRd_r", format:"num" },
    // ── childcare deep-dive (scripts/fetch_childcare_metrics.py + aggregate_childcare_to_districts.py).
    // EEC licensing + C3 grants; a real 0 (e.g. no Head Start, child-care desert) is kept, not nulled.
    { id:"childcare_infant_toddler_per_100_u5", label:"Infant/Toddler Child-Care Seats per 100 Under 5", cat:"Early education", levels:["muni","district"], palette:"OrRd_r", format:"num" },
    { id:"childcare_subsidy_pct",   label:"% of Child-Care Programs Accepting Subsidy", cat:"Early education", levels:["muni","district"], palette:"GnBu", format:"pct" },
    { id:"childcare_headstart_per_100_u5", label:"Head Start Seats per 100 Children Under 5", cat:"Early education", levels:["muni","district"], palette:"BuPu", format:"num" },
    { id:"childcare_c3_per_seat",   label:"C3 Grant $ per Licensed Seat", cat:"Early education", levels:["muni","district"], palette:"Viridis", format:"usd" },
    { id:"childcare_c3_trend_2yr",  label:"C3 Grant $ — 2-Year Change", cat:"Early education", levels:["muni","district"], palette:"RdBu", format:"pct" },
    { id:"kindergarten_enrollment", label:"Kindergarten Enrollment (count)", cat:"Early education", levels:["district"], palette:"GnBu", format:"num" },
    { id:"prek_low_income_pct",     label:"% of Pre-K that is Low Income",    cat:"Early education", levels:["district"], palette:"Reds", format:"pct" },

    // ── Composite indices (scripts/bake_composites.py): equal-weight z-score blends of
    // existing metrics, centered on the state average (0 = average; ± = standard deviations).
    { id:"cost_of_living_index",       label:"Cost-of-Living Index (housing pressure)", cat:"Composite indices", levels:["district"], palette:"PuOr",   format:"num" },
    { id:"livability_index",           label:"Livability Index",                        cat:"Composite indices", levels:["district"], palette:"RdYlGn", format:"num" },
    { id:"opportunity_to_learn_index", label:"Opportunity-to-Learn Index (HS access)",  cat:"Composite indices", levels:["district"], palette:"RdBu",   format:"num" },

    // Finance — per_pupil totals exist at both levels; the breakdowns are district-only
    { id:"per_pupil",                  label:"Per-Pupil $ (Total)",         cat:"Finance", levels:["district","muni"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_teachers",         label:"Per-Pupil $ — Teachers",      cat:"Finance", levels:["district","muni"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_admin",            label:"Per-Pupil $ — Administration",cat:"Finance", levels:["district"],        palette:"Viridis", format:"usd" },
    { id:"per_pupil_pupil_services",   label:"Per-Pupil $ — Pupil Services",cat:"Finance", levels:["district"],        palette:"Viridis", format:"usd" },
    // Per-pupil spending categories (DESE, SY2024) — additional functional splits.
    { id:"per_pupil_operations",       label:"Per-Pupil $ — Operations (2024)",       cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_instr_leadership", label:"Per-Pupil $ — Instr. Leadership (2024)", cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_instr_materials",  label:"Per-Pupil $ — Materials/Tech (2024)",    cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_guidance",         label:"Per-Pupil $ — Guidance (2024)",          cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_insurance_other",  label:"Per-Pupil $ — Insurance/Other (2024)",   cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    // More per-pupil functional categories (DESE er3w-dyti, SY2024). Professional
    // Development and Other Teaching Services are the remaining non-duplicate
    // subcats; Transportation/Food Services aren't published per-pupil and
    // employee benefits are folded into Insurance/Other above (not duplicated).
    { id:"per_pupil_prof_dev",         label:"Per-Pupil $ — Professional Dev. (2024)", cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_other_teaching",   label:"Per-Pupil $ — Other Teaching (2024)",    cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    // State-aid / net-school-spending (DESE; NSS+foundation SY2022, per-pupil SY2024).
    // NSS-vs-target ratios can exceed 100% (a district spending above its target).
    { id:"in_district_pp_exp",     label:"In-District Per-Pupil (2024)",  cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"foundation_budget",      label:"Foundation Budget (2022)",      cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"required_nss",           label:"Required Net School Spending (2022)", cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"actual_nss",             label:"Actual Net School Spending (2022)",   cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"nss_pct_of_required",    label:"NSS vs Required (2022)",        cat:"Finance", levels:["district"], palette:"PuBuGn", format:"pct" },
    { id:"nss_pct_of_foundation",  label:"NSS vs Foundation (2022)",      cat:"Finance", levels:["district"], palette:"PuBuGn", format:"pct" },

    // Workforce — staff race/ethnicity shares are populated for all 274 districts.
    // teacher_experienced_pct (SY2023) and teacher_infield_pct (SY2022, DESE's
    // last published year) are backfilled from DESE open data into
    // data/ma_district_edu_extra.json. Most workforce metrics are district-only;
    // the class-size rates also map at municipality level (baked by bake_muni_extras.py).
    { id:"stu_tchr_ratio",         label:"Student : Teacher Ratio",   cat:"Workforce", levels:["district"], palette:"Reds",    format:"num" },
    // Class size — DESE SY2025, raw counts → "num". A teacher-load measure grouped
    // with Student:Teacher Ratio; also baked onto town features so these map at muni level.
    { id:"avg_class_size",   label:"Average Class Size",      cat:"Workforce", levels:["district","muni"], palette:"Oranges", format:"num" },
    { id:"class_size_ela",     label:"Avg Class Size — ELA",     cat:"Workforce", levels:["district","muni"], palette:"Oranges", format:"num" },
    { id:"class_size_math",    label:"Avg Class Size — Math",    cat:"Workforce", levels:["district","muni"], palette:"Oranges", format:"num" },
    { id:"class_size_science", label:"Avg Class Size — Science", cat:"Workforce", levels:["district","muni"], palette:"Oranges", format:"num" },
    { id:"teacher_retention_pct",  label:"Teacher Retention Rate",    cat:"Workforce", levels:["district"], palette:"Greens",  format:"pct" },
    { id:"teacher_experienced_pct",label:"% Experienced Teachers (2023)", cat:"Workforce", levels:["district"], palette:"Greens",  format:"pct" },
    { id:"teacher_infield_pct",    label:"% Teachers In-Field (2022)",    cat:"Workforce", levels:["district"], palette:"Blues",   format:"pct" },
    { id:"staff_white_pct",        label:"% Staff — White",           cat:"Workforce", levels:["district"], palette:"Greys",   format:"pct" },
    { id:"staff_hispanic_pct",     label:"% Staff — Hispanic/Latino", cat:"Workforce", levels:["district"], palette:"Oranges", format:"pct" },
    { id:"staff_black_pct",        label:"% Staff — Black/African Am.",cat:"Workforce",levels:["district"], palette:"Purples", format:"pct" },
    // Educator detail — salary (SY2024, raw $), licensure + attendance (DESE).
    { id:"avg_teacher_salary",     label:"Avg Teacher Salary (2024)",       cat:"Workforce", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"teacher_licensed_pct",   label:"% Teachers Licensed (2026)",      cat:"Workforce", levels:["district"], palette:"Greens",  format:"pct" },
    { id:"classes_licensed_pct",   label:"% Core Classes, Licensed Tchr (2026)", cat:"Workforce", levels:["district"], palette:"Greens", format:"pct" },
    { id:"teacher_attendance_pct", label:"Teacher Attendance Rate (2025)",  cat:"Workforce", levels:["district"], palette:"Greens",  format:"pct" },
    { id:"educators_of_color_pct", label:"% Educators of Color (2023)",     cat:"Workforce", levels:["district"], palette:"PuBuGn", format:"pct" },
    { id:"principal_retention_pct",label:"Principal Retention Rate (2026)", cat:"Workforce", levels:["district"], palette:"Greens",  format:"pct" },

    // Student support — students per support-staff FTE (DESE, SY2026). NOTE: lower
    // is better (fewer students per counselor/nurse = more support); the Reds ramp
    // shades worse (higher) ratios darker.
    { id:"students_per_counselor",     label:"Students per Counselor",     cat:"Student support", levels:["district"], palette:"Reds", format:"num" },
    { id:"students_per_nurse",         label:"Students per Nurse",         cat:"Student support", levels:["district"], palette:"Reds", format:"num" },
    { id:"students_per_psychologist",  label:"Students per Psychologist",  cat:"Student support", levels:["district"], palette:"Reds", format:"num" },
    { id:"students_per_social_worker", label:"Students per Social Worker", cat:"Student support", levels:["district"], palette:"Reds", format:"num" },
    { id:"students_per_librarian",     label:"Students per Librarian",     cat:"Student support", levels:["district"], palette:"Reds", format:"num" },

    // Population (from POP2020) + density (computed at load time from polygon area)
    // Available at both levels — district values aggregated by aggregate_acs_to_districts.py
    { id:"_pop_2020",                label:"Population (2020 Census)",         cat:"Population", levels:["muni","district"], palette:"Blues",   format:"num" },
    { id:"_pop_density_per_sqmi",    label:"Population Density (per sq mi)",   cat:"Population", levels:["muni","district"], palette:"YlGnBu", format:"num" },
    { id:"_area_sqmi",               label:"Area (sq mi)",                     cat:"Population", levels:["muni","district"], palette:"Greys",   format:"num" },

    // Census ACS basics — joined at muni level, aggregated to district level.
    // District-level MHI is population-weighted (approximation — true median-
    // of-medians needs household microdata); pcts are population-weighted means.
    { id:"acs_median_household_income", label:"Median Household Income (ACS)", cat:"Census ACS",  levels:["muni","district"], palette:"Viridis", format:"usd", requires:"acs" },
    { id:"acs_bachelors_plus_pct",      label:"% Bachelor's degree or higher", cat:"Census ACS",  levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_foreign_born_pct",        label:"% Foreign-born",                cat:"Census ACS",  levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_non_english_pct",         label:"% Speaks non-English at home",  cat:"Census ACS",  levels:["muni","district"], palette:"Greens",  format:"pct", requires:"acs" },
    { id:"acs_child_poverty_pct",       label:"% Children in poverty",         cat:"Census ACS",  levels:["muni","district"], palette:"Reds",    format:"pct", requires:"acs" },
    { id:"acs_severe_rent_burden_pct",  label:"% Severely rent-burdened",      cat:"Census ACS",  levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    // ACS extras (data/ma_*_acs_extra.json). District medians are population-weighted
    // means of town medians (same approximation as MHI above) — read as "typical".
    { id:"acs_median_home_value",       label:"Median Home Value (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"Viridis", format:"usd", requires:"acs" },
    { id:"acs_median_commute_min",      label:"Mean Commute to Work (min, ACS)",cat:"Census ACS", levels:["muni","district"], palette:"Magma",   format:"num", requires:"acs" },
    { id:"acs_median_age",              label:"Median Age (ACS)",               cat:"Census ACS", levels:["muni","district"], palette:"Cividis", format:"num", requires:"acs" },
    { id:"acs_broadband_pct",           label:"% Households w/ Broadband (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_owner_occupied_pct",      label:"% Owner-Occupied Housing (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"Greens",  format:"pct", requires:"acs" },
    // ACS round 2 (data/ma_*_acs_extra2.json)
    { id:"acs_unemployment_pct", label:"% Unemployed (ACS)",               cat:"Census ACS", levels:["muni","district"], palette:"Reds",    format:"pct", requires:"acs" },
    { id:"acs_uninsured_pct",    label:"% Without Health Insurance (ACS)",  cat:"Census ACS", levels:["muni","district"], palette:"Reds",    format:"pct", requires:"acs" },
    { id:"acs_disability_pct",   label:"% With a Disability (ACS)",         cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_under18_pct",      label:"% Under 18 (ACS)",                  cat:"Census ACS", levels:["muni","district"], palette:"Greens",  format:"pct", requires:"acs" },
    { id:"acs_no_vehicle_pct",   label:"% Households w/o Vehicle (ACS)",    cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    // ACS round 3 (data/ma_*_acs_extra3.json)
    { id:"acs_median_gross_rent",   label:"Median Gross Rent (ACS)",      cat:"Census ACS", levels:["muni","district"], palette:"Viridis", format:"usd", requires:"acs" },
    { id:"acs_single_parent_pct",   label:"% Single-Parent Families (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"OrRd",   format:"pct", requires:"acs" },
    { id:"acs_snap_pct",            label:"% Households on SNAP (ACS)",    cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    { id:"acs_veteran_pct",         label:"% Veterans, 18+ (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_moved_last_year_pct", label:"% Moved in Last Year (ACS)",   cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    // ACS round 4 (data/ma_*_acs_extra4.json)
    { id:"acs_has_computer_pct",       label:"% Households w/ a Computer (ACS)",          cat:"Census ACS", levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_limited_english_hh_pct", label:"% Limited-English Households (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_median_earnings",        label:"Median Earnings, Workers (ACS)",            cat:"Census ACS", levels:["muni","district"], palette:"Viridis", format:"usd", requires:"acs" },
    { id:"acs_renter_cost_burden_pct", label:"% Renters Cost-Burdened 30%+ (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"OrRd",    format:"pct", requires:"acs" },
    { id:"acs_labor_force_pct",        label:"Labor Force Participation (ACS)",           cat:"Census ACS", levels:["muni","district"], palette:"YlGn",    format:"pct", requires:"acs" },
    // ACS round 5 (data/ma_*_acs_extra5.json)
    { id:"acs_grad_degree_pct",     label:"% Graduate/Professional Degree (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_gini",                label:"Income Inequality (Gini, ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"OrRd",    format:"num", requires:"acs" },
    { id:"acs_pre1960_housing_pct", label:"% Housing Built Pre-1960 (ACS)",       cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    { id:"acs_multiunit_pct",       label:"% Housing in 5+ Unit Buildings (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"BuPu",    format:"pct", requires:"acs" },
    { id:"acs_avg_hh_size",         label:"Average Household Size (ACS)",         cat:"Census ACS", levels:["muni","district"], palette:"Greens",  format:"num", requires:"acs" },
    // ACS round 6 (data/ma_*_acs_extra6.json)
    { id:"acs_per_capita_income",   label:"Per-Capita Income (ACS)",       cat:"Census ACS", levels:["muni","district"], palette:"Viridis", format:"usd", requires:"acs" },
    { id:"acs_poverty_pct",         label:"Poverty Rate, All Ages (ACS)",  cat:"Census ACS", levels:["muni","district"], palette:"OrRd",    format:"pct", requires:"acs" },
    { id:"acs_drove_alone_pct",     label:"Commute: Drove Alone (ACS)",    cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    { id:"acs_work_from_home_pct",  label:"Worked From Home (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"BuGn",    format:"pct", requires:"acs" },
    { id:"acs_crowded_housing_pct", label:"Crowded Housing >1/room (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"PuRd",    format:"pct", requires:"acs" },
    // ACS round 7 (data/ma_*_acs_extra7.json)
    { id:"acs_age65_plus_pct",     label:"% Age 65+ (ACS)",                 cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_school_age_pct",     label:"% School-Age 5–17 (ACS)",         cat:"Census ACS", levels:["muni","district"], palette:"Greens",  format:"pct", requires:"acs" },
    { id:"acs_vacancy_pct",        label:"% Housing Units Vacant (ACS)",    cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    { id:"acs_public_transit_pct", label:"% Public-Transit Commuters (ACS)",cat:"Census ACS", levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_family_hh_pct",      label:"% Family Households (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"Teal",    format:"pct", requires:"acs" },
    // ACS round 8 (data/ma_*_acs_extra8.json)
    { id:"acs_mgmt_occ_pct",        label:"% Mgmt/Biz/Science/Arts Occ. (ACS)", cat:"Census ACS", levels:["muni","district"], palette:"Purples", format:"pct", requires:"acs" },
    { id:"acs_median_rooms",        label:"Median Rooms per Home (ACS)",        cat:"Census ACS", levels:["muni","district"], palette:"Greens",  format:"num", requires:"acs" },
    { id:"acs_moved_diff_state_pct",label:"% Moved From Diff. State (ACS)",     cat:"Census ACS", levels:["muni","district"], palette:"Oranges", format:"pct", requires:"acs" },
    { id:"acs_govt_worker_pct",     label:"% Government Workers (ACS)",         cat:"Census ACS", levels:["muni","district"], palette:"Blues",   format:"pct", requires:"acs" },
    { id:"acs_born_in_state_pct",   label:"% Born In State (ACS)",             cat:"Census ACS", levels:["muni","district"], palette:"YlGnBu", format:"pct", requires:"acs" },

    // ══════════════════════════════════════════════════════════════════════════
    // PARALLEL-SESSION METRIC SLOTS — see plans/SESSION-S*.md and AGENTS.md.
    // Each session appends its { id:... } metric objects UNDER ITS OWN anchor below.
    // Keep the anchor comment; insert new lines after it. Never edit another
    // session's anchor line — that is what keeps concurrent PRs conflict-free.
    // ── S1:accountability ──
    // District accountability detail (DESE ppbc-i8t9, SY2025). Percentile is an
    // ENROLLMENT-WEIGHTED roll-up of the per-school 1-99 accountability percentile
    // (DESE assigns the percentile to schools, not districts); it is a 1-99 number,
    // not a fraction. The two share metrics are 0-1; "needing support" keeps a genuine
    // 0.0 (most districts have zero flagged schools) and is null only where a district
    // has no determinately-classified school.
    { id:"accountability_percentile",    label:"District Accountability Percentile",            cat:"Accountability", levels:["district"], palette:"PuBuGn", format:"num" },
    { id:"curr_year_tgt_pct",            label:"% of Accountability Targets Met (current year)", cat:"Accountability", levels:["district"], palette:"GnBu",   format:"pct" },
    { id:"pct_schools_needing_support",  label:"% of Schools Requiring Assistance/Intervention", cat:"Accountability", levels:["district"], palette:"OrRd",   format:"pct" },
    // ── S2:vocational ──
    // Career/vocational build-out beyond the existing cte_enrollment_pct. All from
    // DESE Education-to-Career (Socrata); universe = the ~61 in-district Chapter 74
    // host districts (others send students to regional voc-techs and are null —
    // same caveat as cte_enrollment_pct). Suppressed/zero shares stored as null.
    { id:"chapter74_programs", label:"Chapter 74 CTE Programs Offered", cat:"Career / vocational", levels:["district"], palette:"YlGnBu", format:"num" },
    { id:"cte_female_pct",     label:"CTE Students Who Are Female (% of CTE cohort)",     cat:"Career / vocational", levels:["district"], palette:"YlGnBu", format:"pct" },
    { id:"cte_high_needs_pct", label:"CTE Students Who Are High Needs (% of CTE cohort)", cat:"Career / vocational", levels:["district"], palette:"YlGnBu", format:"pct" },
    // ── S3:sped ──
    // Prevalence-by-disability: each district's students-with-disabilities (SWD)
    // broken out by PRIMARY disability category. Denominator is SWD (not all
    // students) — labels lead with "SWD —" so that reads clearly. Shares of SWD
    // within a district sum to ~1. Source: DESE n62c-bx65, ind_cat='Disability
    // Type All', SY2026; 0-1 fractions; suppressed/missing stored as null.
    { id:"sped_specific_learning_pct", label:"SWD — Specific Learning Disability", cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_communication_pct",     label:"SWD — Communication Disability",     cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_autism_pct",            label:"SWD — Autism",                       cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_health_pct",            label:"SWD — Health Impairment (incl. ADHD)",cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_developmental_pct",     label:"SWD — Developmental Delay",          cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_emotional_pct",         label:"SWD — Emotional Disability",         cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_neurological_pct",      label:"SWD — Neurological Disability",      cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_intellectual_pct",      label:"SWD — Intellectual Disability",      cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_sensory_pct",           label:"SWD — Sensory Impairment",           cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_multiple_pct",          label:"SWD — Multiple Disabilities",        cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_physical_pct",          label:"SWD — Physical Impairment",          cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    // ── S4:el ──
    // EL composition — WHO a district's English Learners are, from DESE's ACCESS
    // Composite Proficiency Level (72n5-hu3e, SY2025), complementing the existing
    // ACCESS progress/proficiency/exiting outcomes. EL-universe metrics (~230
    // districts with enough ELs to report); small-EL districts are honestly absent.
    { id:"el_avg_proficiency_level", label:"Avg English Proficiency Level (WIDA 1–6)", cat:"English learners", levels:["district"], palette:"GnBu", format:"num" },
    { id:"el_avg_years_in_state",    label:"Avg Years in MA Schools (ELs)",           cat:"English learners", levels:["district"], palette:"BuPu", format:"num" },
    { id:"el_beginner_pct",          label:"% of ELs at Beginner Level (WIDA 1–2)",   cat:"English learners", levels:["district"], palette:"OrRd", format:"pct" },
    { id:"el_high_proficiency_pct",  label:"% of ELs at Advanced Level (WIDA 5–6)",   cat:"English learners", levels:["district"], palette:"GnBu", format:"pct" },
    // ── S5:progression ──
    // Early-warning / "is my kid on track" metrics. 9th-grade course passing is one of
    // the strongest research-backed predictors of on-time graduation.
    // DESE Grade Nine Course Passing Report 4sut-78p8, SY2025.
    // (HS-only: covers the ~217 districts that operate grade 9.)
    { id:"g9_pass_all_pct",       label:"% 9th Graders Passing All Courses", cat:"Progression", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"g9_pass_ela_pct",       label:"% Passing 9th-Grade English",       cat:"Progression", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"g9_pass_math_pct",      label:"% Passing 9th-Grade Math",          cat:"Progression", levels:["district"], palette:"GnBu", format:"pct" },
    // ── S6:mcas-completeness ──
    // Grade-grid completion: Gr4 + Gr8 ELA (the only single-grade ELA cells missing
    // next to their existing Math twins). DESE i9w6-niyt, SY2025.
    { id:"mcas_g4_ela_me", label:"MCAS Gr4 ELA % M+E", cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g8_ela_me", label:"MCAS Gr8 ELA % M+E", cat:"Academic", levels:["district"], palette:"GnBu", format:"pct" },
    // Gr3-8 % M+E for the subgroups not previously shipped (White / Asian / Multiracial
    // and the High Needs umbrella). Completes the race set + adds the High-Needs slice.
    { id:"mcas_ela_white",       label:"MCAS Gr3-8 ELA M+E — White",        cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_asian",       label:"MCAS Gr3-8 ELA M+E — Asian",        cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_multi",       label:"MCAS Gr3-8 ELA M+E — Multiracial",  cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_high_needs",  label:"MCAS Gr3-8 ELA M+E — High Needs",   cat:"Achievement by group", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_white",      label:"MCAS Gr3-8 Math M+E — White",       cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_asian",      label:"MCAS Gr3-8 Math M+E — Asian",       cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_multi",      label:"MCAS Gr3-8 Math M+E — Multiracial", cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_high_needs", label:"MCAS Gr3-8 Math M+E — High Needs",  cat:"Achievement by group", levels:["district"], palette:"BuPu", format:"pct" },
    // Gr10 (high-school) % M+E by subgroup — a brand-new lens; the atlas had no
    // subgroup achievement at grade 10. Sparser groups are honestly null-suppressed.
    { id:"mcas_g10_ela_low_income",  label:"MCAS Gr10 ELA M+E — Low Income",        cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_swd",         label:"MCAS Gr10 ELA M+E — SWD",               cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_ell",         label:"MCAS Gr10 ELA M+E — English Learners",  cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_black",       label:"MCAS Gr10 ELA M+E — Black/African Am.", cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_hispanic",    label:"MCAS Gr10 ELA M+E — Hispanic/Latino",   cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_white",       label:"MCAS Gr10 ELA M+E — White",             cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_asian",       label:"MCAS Gr10 ELA M+E — Asian",             cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_multi",       label:"MCAS Gr10 ELA M+E — Multiracial",       cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_high_needs",  label:"MCAS Gr10 ELA M+E — High Needs",        cat:"Achievement by group (Gr10)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_math_low_income", label:"MCAS Gr10 Math M+E — Low Income",       cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_swd",        label:"MCAS Gr10 Math M+E — SWD",              cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_ell",        label:"MCAS Gr10 Math M+E — English Learners", cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_black",      label:"MCAS Gr10 Math M+E — Black/African Am.",cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_hispanic",   label:"MCAS Gr10 Math M+E — Hispanic/Latino",  cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_white",      label:"MCAS Gr10 Math M+E — White",            cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_asian",      label:"MCAS Gr10 Math M+E — Asian",            cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_multi",      label:"MCAS Gr10 Math M+E — Multiracial",      cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_high_needs", label:"MCAS Gr10 Math M+E — High Needs",       cat:"Achievement by group (Gr10)", levels:["district"], palette:"BuPu", format:"pct" },
    // ── S7:subgroup-outcomes ──
    // College-going BY SUBGROUP — immediate college enrollment (fall after HS) for
    // the equity groups, the analogue to all-students college_enroll_pct which the
    // atlas only had for All Students. DESE sg4g-eg2n (NSC-linked), cohort 2023.
    { id:"college_enroll_low_income", label:"Immediate College Enrollment — Low Income",       cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_swd",        label:"Immediate College Enrollment — SWD",              cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_hispanic",   label:"Immediate College Enrollment — Hispanic/Latino",  cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_black",      label:"Immediate College Enrollment — Black/African Am.", cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"college_enroll_ell",        label:"Immediate College Enrollment — English Learners", cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    // College COMPLETION — % of the entering HS cohort that obtained a postsecondary
    // degree within ~6 years. DESE sg4g-eg2n degree-completion indicator, cohort 2016
    // (latest with a full 6-yr window). (Remediation/remedial-coursework requested but
    // not published on the DESE open-data domain — dropped, see fetch_postsec_detail.py.)
    { id:"college_completion_pct",    label:"% Completing College (6-yr)",                     cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    // ── S8:workforce ──
    // Completes the all-staff race set (White/Hispanic/Black already shipped from the
    // same DESE staffing dataset j5ue-xkfn) — Asian was the missing slice, so the four
    // shares now reconcile. Genuine 0 kept; null only when a district has 0 total FTE.
    { id:"staff_asian_pct",          label:"% Staff — Asian",                  cat:"Workforce", levels:["district"], palette:"Blues",  format:"pct" },
    // Staffing-structure ratios (DESE j5ue-xkfn FTE-by-role, SY2026). students_per_admin:
    // LOWER is better (fewer students per administrator) → Reds shades worse (higher)
    // darker, like the Student-support ratios. para_per_100_students: HIGHER is more
    // support. Zero-FTE / zero-enrollment districts are null, never a 0/huge ratio.
    { id:"students_per_admin",       label:"Students per Administrator",       cat:"Workforce", levels:["district"], palette:"Reds",   format:"num" },
    { id:"para_per_100_students",    label:"Paraprofessionals per 100 Students", cat:"Workforce", levels:["district"], palette:"PuBuGn", format:"num" },
    // ── teacher-workforce ──
    // Teacher workforce DEPTH (DESE a4b4-k49f age groups + vd2f-ib9q program area, SY2026,
    // district-level Teacher rows). Neutral composition shares (no "good"/"bad" direction)
    // → BuPu per the age-profile convention; SPED share uses Purples to read distinctly.
    // Age bands break at 56/57, so the near-retirement cut is an honest "57+", not "55+".
    // Districts with 0 teacher FTE (e.g. Gosnold) are null, never a 0/huge share.
    { id:"teacher_under32_pct",      label:"% Teachers Under 32 (early-career, 2026)",       cat:"Workforce", levels:["district"], palette:"BuPu",    format:"pct" },
    { id:"teacher_57plus_pct",       label:"% Teachers 57+ (approaching retirement, 2026)",  cat:"Workforce", levels:["district"], palette:"BuPu",    format:"pct" },
    { id:"teacher_sped_pct",         label:"% Teachers in Special Education (2026)",          cat:"Workforce", levels:["district"], palette:"Purples", format:"pct" },
    // ── S9:trends ──
    // ── S10:gender ── (also owns KNOWN_GROUPS + the group resolver — see brief)
    // Gender was entirely absent from the atlas — these are STANDALONE gendered
    // metrics (additive; the shared KNOWN_GROUPS student-group axis is untouched).
    // MCAS % Meeting+Exceeding by sex, SY2025 (DESE i9w6-niyt): ELA=GnBu, Math=BuPu
    // (dark = higher achievement). Gr3-8 aggregate ~98% coverage, Gr10 ~77%.
    { id:"mcas_ela_male",        label:"MCAS Gr3-8 ELA % M+E — Male",      cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_ela_female",      label:"MCAS Gr3-8 ELA % M+E — Female",    cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_male",       label:"MCAS Gr3-8 Math % M+E — Male",     cat:"By gender", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_math_female",     label:"MCAS Gr3-8 Math % M+E — Female",   cat:"By gender", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_ela_male",    label:"MCAS Gr10 ELA % M+E — Male",       cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_ela_female",  label:"MCAS Gr10 ELA % M+E — Female",     cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_g10_math_male",   label:"MCAS Gr10 Math % M+E — Male",      cat:"By gender", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_g10_math_female", label:"MCAS Gr10 Math % M+E — Female",    cat:"By gender", levels:["district"], palette:"BuPu", format:"pct" },
    // 4-yr graduation + dropout by sex, SY2025 (DESE n2xa-p822). grad: dark=good
    // (GnBu, matches grad_4yr); dropout: lower is better so Reds shades worse
    // darker (matches dropout_pct). ~78% coverage (HS-cohort districts only).
    { id:"grad_4yr_male",        label:"4-yr Graduation Rate — Male",      cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"grad_4yr_female",      label:"4-yr Graduation Rate — Female",    cat:"By gender", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"dropout_male",         label:"Dropout Rate — Male",              cat:"By gender", levels:["district"], palette:"Reds", format:"pct" },
    { id:"dropout_female",       label:"Dropout Rate — Female",            cat:"By gender", levels:["district"], palette:"Reds", format:"pct" },
    // ── S11:funding-revenue ──
    // Revenue / equity side of Ch.70 (DESE FY2026 summary chart; 280/281 districts).
    // The "who pays" story: chapter70_per_pupil = state aid / foundation enrollment;
    // required_local_contribution is the dollars member towns must raise;
    // local_share_pct = required local contribution / foundation budget (0-1; state
    // share is its complement). High-need Gateway Cities sit near 0.05 (state funds
    // ~95%); wealthy low-enrollment towns hit the SOA's 0.825 local-share cap. Non-
    // operating districts (e.g. Gosnold) are null, not 0. EQV-per-pupil was scoped but
    // not shipped — EQV is a MA DLS source, absent from the DESE Socrata catalog.
    { id:"chapter70_per_pupil",          label:"Chapter 70 State Aid per Pupil (2026)", cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"required_local_contribution",  label:"Required Local Contribution (2026)",    cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"local_share_pct",              label:"% of Foundation Funded Locally (2026)", cat:"Finance", levels:["district"], palette:"PuOr",    format:"pct" },
    // ── S12:school-choice-landscape ──
    // Receiving side + non-public landscape — complements the outflow metrics
    // above. choice_in_pct: enrolled base (DESE 8xyg-59b2), ~280 districts incl.
    // regionals. choice_net_pct: in − out on the resident base (reconciles with
    // school_choice_out_pct), diverging around 0 — blue = net receiver, red = net
    // loser; single-town districts (~229). private_school_pct / homeschool_pct:
    // share of a town's school-age children non-public (DESE rdxw-mfv3),
    // single-town districts (~229); regionals blank (no town→regional crosswalk).
    { id:"choice_in_pct",       label:"% Enrollment Received via School Choice", cat:"Enrollment flow", levels:["district"], palette:"GnBu",    format:"pct" },
    { id:"choice_net_pct",      label:"Net School Choice (in − out)",            cat:"Enrollment flow", levels:["district"], palette:"RdBu",    format:"pct" },
    { id:"private_school_pct",  label:"% of School-Age in Private/Parochial",    cat:"Enrollment flow", levels:["district"], palette:"Purples", format:"pct" },
    { id:"homeschool_pct",      label:"% Homeschooled",                          cat:"Enrollment flow", levels:["district"], palette:"Oranges", format:"pct" },
    // ── S13:climate-safety ──
    // A safety/climate lens distinct from the existing discipline RATES. All three
    // are per-100-students counts where HIGHER = worse (OrRd). DESE SY2025; values
    // are null (absent), never 0, where DESE suppressed/did not report — except a
    // district that filed a report with no incidents, which keeps a genuine 0.
    // bullying_per_100: students DISCIPLINED for bullying (not all reported
    // incidents) per 100 enrolled — Student Discipline 2kca-w7rq, offense='Bullying'.
    { id:"bullying_per_100",     label:"Bullying — Disciplined per 100 Students", cat:"School climate", levels:["district"], palette:"OrRd", format:"num" },
    // restraint_per_100: distinct students physically restrained per 100 enrolled —
    // Student Restraints 3ss8-pnvb (school rows aggregated to district / SY2025 enrollment).
    { id:"restraint_per_100",    label:"Physical Restraints per 100 Students",    cat:"School climate", levels:["district"], palette:"OrRd", format:"num" },
    // law_referral_per_100: referrals to law enforcement per 100 enrolled — DESE
    // Student Discipline 2kca-w7rq lawenf_ref_pct (used in place of federal CRDC, which
    // is the same measure but lags years behind; DESE gives it cleanly at SY2025).
    { id:"law_referral_per_100", label:"Referrals to Law Enforcement per 100 Students", cat:"School climate", levels:["district"], palette:"OrRd", format:"num" },
    // ── S14:whole-child-facilities ──
    // Whole-child / well-rounded course-taking — answers the "is this a well-rounded
    // school?" parent questions the atlas couldn't before (arts, music, a well-rounded
    // diploma, advanced & digital-literacy coursework). All are % of students enrolled
    // (0-1), district roll-up, DESE open data SY2025; dark = more access (positive).
    // Reported 0s are stored null, not 0 (structural/non-reporting — see fetch_whole_child.py).
    // Sources: Arts Course Taking [w3f3-phkq], MassCore Completion [a9ye-ac8e],
    // Advanced Course Completion [ujwr-ux9i], DLCS Course Taking [fbdq-3q4d].
    // World-language %, PE %, athletics (MIAA) and facilities/MSBA had NO queryable
    // district-level open dataset — documented in fetch_whole_child.py, not shipped.
    { id:"arts_enrollment_pct",     label:"% Students Enrolled in Arts",        cat:"Whole child", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"arts_music_pct",          label:"% Students Enrolled in Music",       cat:"Whole child", levels:["district"], palette:"Purples", format:"pct" },
    { id:"dlcs_course_pct",         label:"% Enrolled in Digital Lit / CS",     cat:"Whole child", levels:["district"], palette:"PuBu", format:"pct" },
    // Underserved subgroups (feat/underserved-subgroups) — MCAS Gr3-8 % M+E for
    // small DESE-suppressed populations the atlas could not show: military-connected,
    // foster-care, and homeless families. Own category to keep them distinct from the
    // main race/income groups. ELA=GnBu, Math=BuPu (dark = higher achievement).
    // DESE i9w6-niyt SY2025. Coverage (districts): Military 130/130, Homeless 100/102,
    // Foster 60/60 ELA/Math — sparse by nature (these ARE small groups). Suppressed
    // districts are absent (no-data); genuine measured 0s (a real cohort where none
    // reached M+E) are kept, not nulled. Migrant skipped (only 4 districts).
    { id:"mcas_ela_military",   label:"MCAS Gr3-8 ELA M+E — Military-Connected", cat:"Achievement by group (other)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_military",  label:"MCAS Gr3-8 Math M+E — Military-Connected",cat:"Achievement by group (other)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_ela_foster",     label:"MCAS Gr3-8 ELA M+E — Foster Care",        cat:"Achievement by group (other)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_foster",    label:"MCAS Gr3-8 Math M+E — Foster Care",       cat:"Achievement by group (other)", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"mcas_ela_homeless",   label:"MCAS Gr3-8 ELA M+E — Homeless",           cat:"Achievement by group (other)", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"mcas_math_homeless",  label:"MCAS Gr3-8 Math M+E — Homeless",          cat:"Achievement by group (other)", levels:["district"], palette:"BuPu", format:"pct" },
    // ── transport-spending (feat/transport-spending) — answers "how much do we
    // spend on buses / food?". DESE publishes these only as TOTAL $ by function
    // ("District Expenditures by Function Code" cnfs-edqq, SY2024), NOT as
    // per-pupil categories, so each is normalized: total function $ ÷
    // enrollment_fte (Total FTE Pupils, from ma_district_finance.json). See
    // scripts/fetch_transport_spending.py for the full derivation. Coverage
    // (districts): transportation 280, out-of-district transport 260, food 277.
    // transportation = in-district func 3300 (yellow-bus); _ood = ODTR category
    // (busing to out-of-district/charter/special-ed placements).
    { id:"per_pupil_transportation",     label:"Per-Pupil $ — Transportation (2024)",          cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_transportation_ood", label:"Per-Pupil $ — Out-of-District Transport (2024)", cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    { id:"per_pupil_food",               label:"Per-Pupil $ — Food Services (2024)",           cat:"Finance", levels:["district"], palette:"Viridis", format:"usd" },
    // ── earnings-outcomes (feat/earnings-outcomes) — a brand-new, highly relatable
    // category: what a district's HS graduates actually EARN and how many are working
    // a few years out. DESE "Average Earnings of High School Graduates by Student
    // Group" [9vfm-6vxq]. Cohort choice: HS-grad year 2016 observed in earnings year
    // 2021 (~5 years out — most recent cohort with a full 5-year maturity window).
    // HS-only universe (~216 of 281 districts); K-8 districts have no HS grads and are
    // correctly null. Suppressed values are null, never 0. See scripts/fetch_earnings.py.
    // grad_avg_earnings: mean annual earnings of all grads (usd, Viridis = darker more).
    { id:"grad_avg_earnings",           label:"Avg Earnings of HS Grads (~5 yrs out)",      cat:"Earnings & employment", levels:["district"], palette:"Viridis", format:"usd" },
    // grad_employment_pct: employed_count / grad_count — share of grads with an
    // in-state wage record that year (0-1; observed ~0.31-0.63 across districts).
    { id:"grad_employment_pct",         label:"% of HS Grads Employed (~5 yrs out)",        cat:"Earnings & employment", levels:["district"], palette:"GnBu",    format:"pct" },
    // Equity slice: same earnings measure for low-income (Economically Disadvantaged)
    // grads — pair with grad_avg_earnings to read the earnings gap (statewide ~$36k
    // all vs ~$31k low-income). 209 districts (a few small low-income cohorts suppressed).
    { id:"grad_avg_earnings_lowincome", label:"Avg Earnings — Low-Income HS Grads (~5 yrs out)", cat:"Earnings & employment", levels:["district"], palette:"Viridis", format:"usd" },
    // ── early-college + HS-graduate outcomes (feat/early-college-outcomes) ──
    // EARLY COLLEGE (DESE p2yd-4gvj participation SY2024 + yau2-eqsf credits SY2023):
    // HS students earning real college credit via a designated program. Low coverage
    // by nature — only ~31 districts run a designated Early College program, so most
    // districts are no-data (absent), NOT zero. Filed under "Advanced coursework"
    // (it IS advanced course-taking). Dark = more access. See fetch_early_college.py
    // for the multi-partner double-count caveat on the participation count/rate.
    { id:"early_college_pct",                 label:"% in Early College (grades 9–12)",   cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"early_college_g12_pct",             label:"% of Seniors in Early College",      cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"early_college_participants",        label:"Early College Participants",         cat:"Advanced coursework", levels:["district"], palette:"BuGn", format:"num" },
    { id:"early_college_credits_per_student", label:"College Credits Earned per Student", cat:"Advanced coursework", levels:["district"], palette:"BuGn", format:"num" },
    { id:"early_college_credit_success_pct",  label:"% of Registered College Credits Earned", cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    // HS-GRADUATE OUTCOMES, ~1 year out (DESE vj54-j4q3, grad2020 → outcome2021).
    // ACTUAL outcomes of graduates — distinct from the existing self-reported *plans*
    // (pct_work_after_hs / pct_military) and the NSC enrollment metrics. Buckets are
    // mutually exclusive & sum to the cohort; college-enrollment buckets are skipped
    // (already in the atlas as college_enroll_*). No "military" outcome exists here.
    { id:"grad_pct_employed",     label:"% of Grads Employed (1yr After HS)",     cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"grad_pct_disconnected", label:"% of Grads Disconnected (1yr After HS)", cat:"Postsecondary outcomes", levels:["district"], palette:"OrRd", format:"pct" },
    // ── feat/sped-assessment — special-ed dynamics + alternate assessment +
    // attrition + SWD post-secondary outcomes (DESE, data/ma_district_sped_dynamics.json).
    // (1) MCAS-Alt: % at Progressing (top level) for students taking the alternate
    // assessment, count-weighted over ELA+Math, district roll-up (ks7h-2kdy, SY2025;
    // 48% — only the ~half of districts with an MCAS-Alt cohort). dark = higher.
    { id:"mcas_alt_progressing_pct", label:"MCAS-Alt — % at Progressing",      cat:"Special education", levels:["district"], palette:"GnBu", format:"pct" },
    // (2) Special-ed roster CHURN — share of the district's SpEd students who newly
    // entered / left services this year (÷ sped_tot, the SpEd population) (8aww-sugs,
    // SY2025). Move-in is neutral churn (BuPu); move-out shaded as a loss (OrRd).
    { id:"sped_movein_pct",          label:"% of SWD Newly Entering Services",  cat:"Special education", levels:["district"], palette:"BuPu", format:"pct" },
    { id:"sped_moveout_pct",         label:"% of SWD Exiting Services",         cat:"Special education", levels:["district"], palette:"OrRd", format:"pct" },
    // (3) Student ATTRITION — DESE's all-grade district summary: share of students
    // enrolled in a grade who are gone the next year (4as3-w39x, SY2026). Lower is
    // better → OrRd (dark = more attrition). A value rounding to 0 is null, not 0.
    { id:"student_attrition_pct",    label:"Student Attrition Rate",            cat:"Outcomes", levels:["district"], palette:"OrRd", format:"pct" },
    // (4) SWD post-secondary outcomes the atlas lacked for students-with-disabilities:
    // 5-year graduation + 2nd-year college persistence (cdfp-645n, cohort 2023; 78%/76%).
    // (Immediate college enrollment for SWD is already `college_enroll_swd` — not re-shipped.)
    { id:"swd_grad_5yr_pct",         label:"5-yr Graduation — SWD",             cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"swd_college_persist_pct",  label:"% Persisting to 2nd Year — SWD",    cat:"Postsecondary outcomes", levels:["district"], palette:"GnBu", format:"pct" },
    // ── Computed equity gaps (derived in computeDerivedMetrics from existing
    // columns; no new data source). Disadvantage gaps use Reds (dark = wider
    // gap = worse); gender gap is diverging (RdBu). Earnings gap is in dollars.
    { id:"earnings_gap_low_income",  label:"Earnings Gap — Low Income (vs all grads)",        cat:"Equity gaps", levels:["district"], palette:"Reds", format:"usd" },
    { id:"college_gap_low_income",   label:"College-Going Gap — Low Income (vs all)",         cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"college_gap_black",        label:"College-Going Gap — Black/African Am. (vs all)",  cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"college_gap_hispanic",     label:"College-Going Gap — Hispanic/Latino (vs all)",    cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"college_gap_swd",          label:"College-Going Gap — SWD (vs all)",                cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"college_gap_ell",          label:"College-Going Gap — English Learners (vs all)",   cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"mcas_ela_gap_high_needs",  label:"MCAS ELA Gap — High Needs (vs all)",              cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"mcas_math_gap_high_needs", label:"MCAS Math Gap — High Needs (vs all)",             cat:"Equity gaps", levels:["district"], palette:"Reds", format:"pct" },
    { id:"mcas_ela_gender_gap",      label:"MCAS ELA Gender Gap (girls − boys)",              cat:"Equity gaps", levels:["district"], palette:"RdBu", format:"pct" },
    { id:"mcas_math_gender_gap",     label:"MCAS Math Gender Gap (girls − boys)",             cat:"Equity gaps", levels:["district"], palette:"RdBu", format:"pct" },
    // ── crdc-federal (feat/crdc-federal) — FEDERAL Civil Rights Data Collection
    // 2020-21 (U.S. Dept. of Education, Office for Civil Rights), served via the
    // Urban Institute Education Data API. Fills the interscholastic-ATHLETICS gap
    // the atlas couldn't answer ("does this district have sports / how many kids
    // play?") — there is NO MA DESE open dataset for it (see fetch_whole_child.py).
    // School-level CRDC "offerings" aggregated up to the district; crosswalk =
    // CCD state_leaid 'MA-XXXX' → DIST_CODE 'XXXX0000' (all 281 districts reachable).
    // Filed under "Whole child" (well-rounded-education opportunity). dark = more.
    // 2020-21 was a COVID year — athletics rosters reported here may reflect a
    // disrupted season for some districts (CRDC arrests/referrals DID collapse and
    // were NOT shipped; athletics values are plausible and ARE shipped). See
    // scripts/fetch_crdc.py. Coverage (districts): rate 200, count 205, girls' share 205.
    // athletics_participation_pct: participations ÷ TOTAL district enrollment, so it
    // reads as athletic participations per enrolled student (CRDC counts slots, not
    // heads → a sports-opportunity index; large K-12 districts read low by design).
    { id:"athletics_participation_pct", label:"Athletic Participations per Student (CRDC 2020-21)", cat:"Whole child", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"athletics_participants",      label:"Students Playing Interscholastic Sports (CRDC 2020-21)", cat:"Whole child", levels:["district"], palette:"BuGn", format:"num" },
    // girls' share of athletics participations; ~0.47 statewide (parity = 0.50).
    // Sequential (dark = more girls' participation) — a diverging ramp would center
    // on the data mean here, not on parity, so it would misread; kept sequential.
    { id:"athletics_girls_share",       label:"Girls' Share of Sports Participation (CRDC 2020-21)", cat:"Whole child", levels:["district"], palette:"BuPu", format:"pct" },
    // ── seda-national: U.S.-relative achievement benchmark (Stanford SEDA v6.0, grade-equivalent) ──
    { id:"seda_achievement",    label:"Avg Score vs U.S. (grade levels)",   cat:"National benchmark", levels:["district"], palette:"RdBu", format:"num" },
    { id:"seda_learning_rate",  label:"Learning Rate (grades gained / yr)", cat:"National benchmark", levels:["district"], palette:"GnBu", format:"num" },
    { id:"seda_trend",          label:"Score Trend (grade levels / yr)",    cat:"National benchmark", levels:["district"], palette:"RdBu", format:"num" },
    // ── FEDERAL CRDC 2017-18 equity (US ED/OCR via Urban API; see scripts/fetch_crdc_equity.py) ──
    // gifted_enrollment_pct: share of district students in a Gifted & Talented program.
    // DESE publishes NOTHING on gifted/talented, so this is wholly new. Only ~21 of 281
    // MA districts run any formal G&T program — every other district is a *measured* 0.0
    // (CRDC's gifted indicator is non-suppressed for all MA schools, so 0 = "no program",
    // not missing), and that scarcity is itself the finding. "Advanced coursework" →
    // semanticPalette auto-promotes to the GOOD ramp (dark = more access). Coverage 280/281
    // (Peabody's CRDC enrollment is fully suppressed → correctly null). 0-1 fraction.
    { id:"gifted_enrollment_pct", label:"% of Students in Gifted & Talented (CRDC 2017-18)", cat:"Advanced coursework", levels:["district"], palette:"YlGnBu", format:"pct" },
    // school_police_pct: enrollment-weighted share of students attending a school that
    // has a sworn law-enforcement officer (CRDC teachers-staff law_enforcement_ind). New
    // vs DESE (DESE has law-REFERRAL counts, not officer PRESENCE). OrRd scrutiny ramp to
    // match law_referral_per_100 (dark = more students under a school-based officer);
    // "School climate" isn't a SEM_CONCERN cat, so this declared palette is kept as-is.
    // Coverage 280/281. 0-1 fraction; statewide median ~0.31.
    { id:"school_police_pct",     label:"% in a School with a Police Officer (CRDC 2017-18)", cat:"School climate", levels:["district"], palette:"OrRd", format:"pct" },
    // ── seda-gaps: NATIONAL-scale achievement gaps in grade levels (Stanford SEDA v6.0 subgroup file) ──
    // Unlike every other gap in "Equity gaps" (which is MA-relative), these are on
    // SEDA's absolute U.S. grade-level scale, so a district's gap is directly
    // comparable to districts anywhere in the country. Positive = the advantaged
    // group is that many U.S. grade levels ahead. Sequential Reds (bigger gap =
    // worse / less equitable), matching the other absolute "…gap" metrics here.
    // Sparser coverage by design (a gap exists only where SEDA observed enough of
    // BOTH groups): white–Black 192/281, white–Hispanic 232/281, econ 264/281.
    { id:"seda_gap_white_black",    label:"White–Black Gap vs U.S. (grade levels)",    cat:"Equity gaps", levels:["district"], palette:"Reds", format:"num" },
    { id:"seda_gap_white_hispanic", label:"White–Hispanic Gap vs U.S. (grade levels)", cat:"Equity gaps", levels:["district"], palette:"Reds", format:"num" },
    { id:"seda_gap_econ",           label:"Non-Poor–Poor Gap vs U.S. (grade levels)",  cat:"Equity gaps", levels:["district"], palette:"Reds", format:"num" },
    // ── FEDERAL CRDC 2017-18 course ACCESS — "does the HS actually OFFER it?" (US ED/OCR
    // via Urban API; see scripts/fetch_crdc_courses.py). DESE publishes course-TAKING +
    // AP scores but NOT whether these core advanced courses are OFFERED, so this answers
    // a question — "does this district's high school even offer Calculus / Physics?" —
    // that has no DESE answer today. Each metric is "% of high-school students in schools
    // that offer the course" = Σ HS enrollment of schools running ≥1 section of the
    // subject (CRDC num_classes_<subject> > 0) ÷ Σ HS enrollment of schools with a known
    // offering status. DENOMINATOR: HIGH SCHOOLS ONLY (CCD school_level==3) — these are HS
    // courses, so a K-8/middle school is excluded (a stray g9 flag would otherwise drag a
    // district down). Coverage 217/281; the other 64 are K-8 districts with no high school
    // → correctly null (never 0). "Advanced coursework" → semanticPalette auto-promotes to
    // the GOOD ramp (dark = more access). 0-1 fraction; most HS districts near 1.0, with a
    // real tail of small / alternative / vocational HSs below 1.0 or at 0.0 (no offering).
    // Computer-science access was DROPPED — Urban exposes no CS field on any CRDC 2017
    // endpoint (would be fabricated). See the fetcher docstring for the full skip list.
    { id:"calculus_access_pct",  label:"% of HS Students in Schools Offering Calculus (CRDC 2017-18)",   cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"physics_access_pct",   label:"% of HS Students in Schools Offering Physics (CRDC 2017-18)",    cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"chemistry_access_pct", label:"% of HS Students in Schools Offering Chemistry (CRDC 2017-18)",  cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    { id:"algebra2_access_pct",  label:"% of HS Students in Schools Offering Algebra II (CRDC 2017-18)", cat:"Advanced coursework", levels:["district"], palette:"GnBu", format:"pct" },
    // ── economic-mobility: Opportunity Atlas (Chetty / Opportunity Insights) — do kids who GREW UP here move up? ──
    { id:"mobility_kfr_p25",  label:"Upward Mobility — Adult Income Rank, Low-Income Kids (0-100, Opportunity Atlas)", cat:"Economic mobility", levels:["district"], palette:"GnBu", format:"num" },
    { id:"mobility_jail_p25", label:"Incarceration Rate — Low-Income Kids Raised Here (Opportunity Atlas)",            cat:"Economic mobility", levels:["district"], palette:"OrRd", format:"pct" },
];

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
    level: "district",
    metric: "TOTAL_CNT",  // opens on enrollment: 100% statewide coverage so the map
                          // is fully colored on load. (Grad rate, the prior default,
                          // is blank for the ~60 K-8 districts that have no high
                          // school — a confusing first impression. Users still reach
                          // grad rate via "Most used".) Swap to LI_PCT / HN_PCT /
                          // per_pupil here for a different landing metric.
    year: 2025,           // latest year with broad coverage across year-keyed metrics
    palette: "BuPu",      // dark = high: positive-outcome default reads intuitively
    classify: "jenks",    // Fisher-Jenks natural breaks — standard cartographic default
    manualBreaks: "",     // comma-separated cut points, used when classify === "manual"
    extrude3d: false,
    bivariate: false,
    bivarMetricB: "acs_median_household_income",  // 2nd metric in bivariate mode
    bivarPalette: "pinkblue",
    changeMode: false,    // "Change over time" — paint a metric's year-over-year delta
    changeFrom: null,     // start year (int), clamped to the metric's available years
    changeTo: null,       // end year (int)
    changeRel: false,     // false = absolute difference (pts/$); true = % change
    reversePalette: false,          // flip the palette direction (light↔dark)
    townLabels: true,
    districtLabels: true,           // district name labels — ON by default (reveal at zoom ≥ 8)
    valueLabels: false,             // show the active metric's number on each polygon — off by default
    propCircles: false,             // proportional enrollment circles over the choropleth — off by default
    showMuniOutline: true,
    showAcademicOutline: true,
    showVoctechOverlay: false,
    showCharterOverlay: false,
    showAllMaSchools: false,
    showPrivateSchools: false,      // NCES PSS private-school reference dots (off by default)
    schoolStatus: "all",            // schools-layer DESE filter: all | recognition | needs
    showAllMaColleges: false,       // IPEDS colleges reference layer — off by default
    showAllMaChildcare: false,      // EEC child-care reference layer — off by default (lazy-loaded)
    childcareColorMode: "capacity", // child-care centers dot color: capacity | c3 (grant per seat)
    highlightGroup: "none",         // sidebar "Highlight a group" picker (district-level overlay)
    showNonOpTowns: true,           // on by default — labels the remaining "no district" holes
    studentGroup: "all",
    basemap: "lightgray",           // default: light-gray CARTO (no baked labels) so our data + labels pop. Also: streets (Positron vector) | satellite | dark | white
    fillOpacity: 0.85,              // choropleth fill opacity — 85% default so the light base reads through a touch
    exportScope: "state",           // current | state | selection | search — default to whole-MA framing
    lastSelected: null,             // { kind, feature } for "export selected feature"
    selected: null,                 // { source, id } currently highlighted feature on the map
    compareMode: false,             // multi-select "comparison set" mode active
    compareKind: "place",           // "place" (follows state.level) | "school" — one kind per set
    compareSet: [],                 // ordered members (max PICK_COLORS.length):
                                    //   { key, kind, source, id, idx, properties, geometry, name }
    graphScope: "all",              // "all" = whole level · "set" = the comparison set only
    graphSchoolMetric: null,        // active sch_* metric id when charting a school set (X)
    graphSchoolMetricB: null,       // scatter Y metric for a school set
    threshold: { active: false, lo: null, hi: null }, // highlight-filter on the active metric
    hasAcs: false,                  // set true if data/ma_muni_acs.json loaded successfully
};

let GEO_DATA = null;  // populated after load
let SCHOOLS_FC = null;  // enriched MA public schools FeatureCollection (for school comparisons)
let BASEMAP_LAYER_IDS = [];  // Positron's own layer IDs, captured pre-addLayers()

// Categorical accent palette for the comparison set — one stable color per
// member, used identically on the map ring, the table column, and every chart
// series. The array length is the set cap (8). Colors are medium-dark so they
// read as thin rings, bars, and label text on white, kept distinct from the
// choropleth palettes, and ordered so the first few slots are maximally
// separable (most comparisons are 2–4 places). Mirrored in CSS as --pick-0..7.
const PICK_COLORS = [
    "#2c7fb8", // blue
    "#e8883a", // amber
    "#2e9e5b", // green
    "#7a5195", // purple
    "#d6446b", // rose
    "#17a2b8", // teal
    "#8c6d31", // bronze
    "#5566c9", // indigo
];
// MapLibre paint expression mapping feature-state pickIdx → PICK_COLORS[idx].
// Built once in addLayers() (needs PICK_COLORS) and shared by the place rings
// and the school pick-ring so every layer resolves a member to the same color.
let PICK_COLOR_EXPR = null;
// Color for an accent slot (defensive modulo so an out-of-range idx still maps).
function pickColor(idx) {
    const n = PICK_COLORS.length;
    return PICK_COLORS[(((+idx || 0) % n) + n) % n];
}
// Lowest free accent slot, or -1 when the set is full. Freed slots are reused so
// a member keeps its color for as long as it's in the set.
function nextPickSlot() {
    const used = new Set(state.compareSet.map(m => m.idx));
    for (let i = 0; i < PICK_COLORS.length; i++) if (!used.has(i)) return i;
    return -1;
}
// Stable identity for dedup across a session. generateId map ids aren't stable,
// so members are keyed by their real identifier.
function memberKey(kind, props) {
    if (kind === "school")   return `school:${String(props.SCHID || "").trim()}`;
    if (kind === "district") return `district:${String(props.DIST_CODE || props.dist_display || props.DIST_NAME || "").trim()}`;
    return `muni:${String(props.TOWN || props.town_display || "").trim()}`;
}

// The Positron streets basemap carries its OWN settlement labels (label_city,
// label_town, …). Cap them at the lowest zoom OUR labels turn on so names never
// double up: district labels (on by default) start at z8; if those are off,
// town labels start at z11. Below the cap, the basemap's graded place names show
// for orientation; above it, they hand off to our single centered labels. Only
// relevant on the streets basemap (the raster bases have their own/no labels),
// but the zoom range persists harmlessly through basemap visibility toggles.
const POSITRON_PLACE_LABEL_IDS = ["label_city_capital", "label_city", "label_town", "label_village", "label_other"];
function syncBasemapLabelCap() {
    const cap = state.districtLabels ? 8 : 11;
    POSITRON_PLACE_LABEL_IDS.forEach(id => {
        if (map.getLayer(id)) map.setLayerZoomRange(id, 0, cap);
    });
}

// Switch the basemap. Raster bases (light-gray/dark/satellite) each show for
// their own mode and hide the Positron vector layers; "streets" shows Positron;
// "white" hides everything over a white page for clean print/PNG output. Our
// town/district labels are OUR layers (not the basemap), so they survive every
// mode and stay under the user's label toggles.
function applyBasemap(kind) {
    state.basemap = kind;
    // Positron vector layers show only for "streets". Raster bases (sat/dark)
    // each show for their own mode. "white" hides everything over a white page.
    const showStreets = kind === "streets";
    BASEMAP_LAYER_IDS.forEach(id => {
        if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", showStreets ? "visible" : "none");
        }
    });
    const setRaster = (id, on) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    setRaster("sat-base",       kind === "satellite");
    setRaster("dark-base",      kind === "dark");
    setRaster("lightgray-base", kind === "lightgray");
    setRaster("sat-ref",        kind === "satellite");   // boundaries+places over imagery

    // The light-gray base only "reads" if the choropleth lets it show through, so
    // the first time it's chosen at full opacity, ease fills to 85% (the user can
    // still override with the slider).
    if (kind === "lightgray" && (state.fillOpacity == null || state.fillOpacity >= 1)) {
        state.fillOpacity = 0.85;
        const oR = document.getElementById("fillOpacityRange");
        const oN = document.getElementById("fillOpacityNote");
        if (oR) oR.value = "85";
        if (oN) oN.textContent = "85% — basemap shows through the colors.";
        ["muni-fill", "district-fill"].forEach(layerId => {
            if (map.getLayer(layerId)) map.setPaintProperty(layerId, "fill-opacity",
                fillOpacityExpr(activeColumn(state.metric, state.year, state.level)));
        });
    }

    // Page behind the (transparent) canvas: white for the blank base, near-black
    // for dark, light gray for the gray base, so any gaps read on-theme.
    const container = map.getContainer();
    if (container) container.style.background =
        kind === "white" ? "#ffffff" : kind === "dark" ? "#0b0b0d"
        : kind === "lightgray" ? "#ebedf0" : "";

    // On dark/satellite, our text labels need a light fill + dark halo to stay
    // legible. These are all symbol layers we control: town/district exist from
    // load, school-labels rides with the schools toggle, and collab/union are
    // lazy-added when those overlays are first enabled — so each block is
    // getLayer-guarded and is simply a no-op until its layer exists.
    const onDarkish = kind === "dark" || kind === "satellite";
    if (map.getLayer("town-labels")) {
        map.setPaintProperty("town-labels", "text-color", onDarkish ? "#ffffff" : "#0A1F44");
        map.setPaintProperty("town-labels", "text-halo-color", onDarkish ? "#000000" : "#ffffff");
    }
    if (map.getLayer("district-labels")) {
        map.setPaintProperty("district-labels", "text-color", onDarkish ? "#ffe082" : "#3E2723");
        map.setPaintProperty("district-labels", "text-halo-color", onDarkish ? "#000000" : "#ffffff");
    }
    if (map.getLayer("school-labels")) {
        map.setPaintProperty("school-labels", "text-color", onDarkish ? "#ECEFF1" : "#37474F");
        map.setPaintProperty("school-labels", "text-halo-color", onDarkish ? "#0b0b0d" : "#ffffff");
    }
    if (map.getLayer("collab-label")) {
        map.setPaintProperty("collab-label", "text-color", onDarkish ? "#F48FB1" : "#AD1457");
        map.setPaintProperty("collab-label", "text-halo-color", onDarkish ? "#000000" : "#ffffff");
    }
    if (map.getLayer("union-label")) {
        map.setPaintProperty("union-label", "text-color", onDarkish ? "#BCAAA4" : "#4E342E");
        map.setPaintProperty("union-label", "text-halo-color", onDarkish ? "#000000" : "#ffffff");
    }
}

// Year-keyed schema introspection. After load, for each (level, baseMetric)
// pair we record which years actually have data — drives the slider availability
// and lets us fall back to latest when a metric isn't year-keyed.
const YEAR_KEYED_INDEX = {
    /* level: { baseMetric: Set<int years> } */
    muni: {}, district: {},
};
// Extended to 1994 so enrollment can show the long view; metrics without
// older year-keyed columns gracefully gray those years out via per-metric
// availability lookups in availableYears().
const YEAR_KEYED_RANGE = (function () {
    const arr = [];
    for (let y = 1994; y <= 2026; y++) arr.push(y);
    return arr;
})();

function buildYearKeyedIndex() {
    for (const level of ["muni", "district"]) {
        const fc = GEO_DATA[level];
        if (!fc || !fc.features.length) continue;
        const sample = fc.features[0].properties;
        const idx = {};
        for (const key of Object.keys(sample)) {
            const m = key.match(/^(.+)__(\d{4})$/);
            if (!m) continue;
            const base = m[1], year = parseInt(m[2], 10);
            if (!idx[base]) idx[base] = new Set();
            idx[base].add(year);
        }
        YEAR_KEYED_INDEX[level] = idx;
    }
}

// Track group-keyed schema after data loads: { level: { baseMetric: Set<group_code> } }
const GROUP_KEYED_INDEX = { muni: {}, district: {} };
const KNOWN_GROUPS = new Set(["hl","baa","as","wh","ell","fmrell","li","swd","hn"]);

// Show/hide the year slider, student-group filter, and Style section based
// on whether they apply to the active metric and mode. Prevents the previous
// behavior where users could scrub a year slider that did nothing, or pick
// a student group that wasn't available for the current metric.
function updateMetricGating() {
    // Keep the sidebar metric-picker button label in sync with state.metric.
    // This runs on every metric-change path (picker change handler, URL restore,
    // featured pairing, level change), so the button can't go stale — the old
    // code only refreshed it on init + level change, so picking a new metric left
    // the button showing the previous one.
    updateMetricPickerCurrent();
    // Keep the "Highlight a group" overlay in sync — the Top/Bottom-decile groups
    // depend on the active metric/year, and the picker row hides at muni level.
    if (typeof applyHighlightGroup === "function") applyHighlightGroup();

    const yrEl = document.getElementById("yearControls");
    const grpEl = document.getElementById("groupControls");
    const styleEl = document.getElementById("styleSection");
    const bivar = state.bivariate;

    // Change-over-time needs ≥2 years of the active metric. A single-year metric
    // can't support it, so auto-exit (and uncheck) rather than paint nothing.
    const yrKeyed = isYearKeyed(state.metric, state.level);
    const yrs = yrKeyed ? availableYears(state.metric, state.level) : [];
    const changeOk = yrKeyed && yrs.length >= 2;
    if (state.changeMode && !changeOk) {
        state.changeMode = false;
        const ctog = document.getElementById("changeToggle"); if (ctog) ctog.checked = false;
        syncPaletteForMetric();
    }
    const change = state.changeMode;

    // The "Change over time" toggle is only meaningful for multi-year metrics.
    const changeTog = document.getElementById("changeToggle");
    if (changeTog) changeTog.disabled = !changeOk;
    const changeCtl = document.getElementById("changeControls");
    if (changeCtl) changeCtl.style.display = change ? "" : "none";
    if (change) syncChangeYears();   // keep From/To in sync with the active metric

    // Style section: hidden in bivariate mode (bivariate has its own palette).
    // Change mode keeps it — palette & classification still apply to the delta.
    if (styleEl) styleEl.style.display = bivar ? "none" : "";

    // Year slider: hidden if metric is not year-keyed OR if bivariate/change is on
    // (bivariate paints from latest values; change has its own two-year picker).
    if (yrEl) yrEl.style.display = (yrKeyed && !bivar && !change) ? "" : "none";

    // If visible, also clamp the slider to the actual available year range
    // for this metric — no more dragging through years that don't exist.
    if (yrKeyed && !bivar && !change) {
        const yrs = availableYears(state.metric, state.level);
        if (yrs.length) {
            const slider = document.getElementById("yearSlider");
            const label = document.getElementById("yearLabel");
            const minY = yrs[0], maxY = yrs[yrs.length - 1];
            if (slider) {
                slider.min = String(minY);
                slider.max = String(maxY);
                // If state.year falls outside the available range for this metric,
                // snap to the latest available year.
                if (state.year < minY || state.year > maxY || !yrs.includes(state.year)) {
                    state.year = maxY;
                }
                slider.value = String(state.year);
            }
            if (label) label.textContent = `${state.year}  (${minY}–${maxY})`;
        }
    }

    // Student-group filter: hidden in bivariate mode, or when the active metric
    // has no group-keyed columns at all.
    const gIdx = GROUP_KEYED_INDEX[state.level] || {};
    const hasGroupData = Boolean(gIdx[state.metric] && gIdx[state.metric].size);
    if (grpEl) grpEl.style.display = (hasGroupData && !bivar && !change) ? "" : "none";
    // Reset to "all" if we just hid the picker — otherwise stale group state
    // would silently filter the next time the picker reappears.
    if (!hasGroupData && state.studentGroup !== "all") {
        state.studentGroup = "all";
        const gs = document.getElementById("groupSelect");
        if (gs) gs.value = "all";
    }

    // One inline note explaining why the year/group controls just disappeared,
    // so their absence reads as intentional rather than a layout glitch.
    const gateNote = document.getElementById("metricGatingNote");
    if (gateNote) {
        if (change) {
            gateNote.textContent = `Change mode: mapping how ${getMetric(state.metric).label} shifted between two years, on a diverging scale.`;
        } else if (bivar) {
            gateNote.textContent = "Bivariate mode: palette, classification, year and group are set by the 3×3 key below.";
        } else {
            const bits = [];
            if (!isYearKeyed(state.metric, state.level)) bits.push("single year (no time slider)");
            if (!hasGroupData) bits.push("no student-group breakdown");
            gateNote.textContent = bits.length
                ? `This metric has ${bits.join(" · ")}.`
                : "";
        }
    }
    updateTimelapseBtn();
}

// Whether the current view can be animated into a time-lapse: a year-keyed metric
// with ≥2 years, in plain single-metric mode (not bivariate / change).
function canTimelapse() {
    const years = availableYears(state.metric, state.level);
    return !state.bivariate && !changeActive(state.metric, state.level) && years && years.length >= 2;
}
// Reactively enable/disable the side-panel "Record time-lapse" button + its hint,
// based on the current metric. Called from updateMetricGating() on every change.
function updateTimelapseBtn() {
    const btn = document.getElementById("timelapseBtn");
    const hint = document.getElementById("timelapseHint");
    if (!btn) return;
    const ok = canTimelapse();
    btn.disabled = !ok;
    btn.style.opacity = ok ? "" : "0.55";
    btn.style.cursor = ok ? "" : "not-allowed";
    if (hint) hint.textContent = ok
        ? "Animate this metric year by year into a shareable video."
        : "Pick a metric with multiple years (and exit bivariate/change mode) to record a time-lapse.";
}

// Updates the helper note under the student-group dropdown to tell the
// user whether the active metric supports group filtering or will fall
// back to All Students.
function updateGroupNote() {
    const noteEl = document.getElementById("groupNote");
    if (!noteEl) return;
    if (state.studentGroup === "all") {
        noteEl.textContent = "Select a group to filter outcomes (MCAS, graduation, AP, chronic absent).";
        return;
    }
    const grp = state.studentGroup.toLowerCase();
    const gIdx = GROUP_KEYED_INDEX[state.level] || {};
    const supported = gIdx[state.metric] && gIdx[state.metric].has(grp);
    if (supported) {
        noteEl.textContent = `✓ Showing ${getMetric(state.metric).label} for the ${state.studentGroup} student group only.`;
    } else {
        noteEl.textContent = `⚠ The active metric isn't group-sliced. Falling back to All Students. (Group filter works on MCAS, graduation, AP, and chronic absent metrics.)`;
    }
}

function buildGroupKeyedIndex() {
    for (const level of ["muni", "district"]) {
        const fc = GEO_DATA[level];
        if (!fc || !fc.features.length) continue;
        const sample = fc.features[0].properties;
        const idx = {};
        for (const key of Object.keys(sample)) {
            const m = key.match(/^(.+)__([a-z]+)$/);
            if (!m) continue;
            const base = m[1], code = m[2];
            if (!KNOWN_GROUPS.has(code)) continue;  // skip year suffixes (numeric)
            if (!idx[base]) idx[base] = new Set();
            idx[base].add(code);
        }
        GROUP_KEYED_INDEX[level] = idx;
    }
}

// Resolve the active column name for state.metric + state.year + state.studentGroup.
// Precedence: group-keyed > year-keyed > base column.
// (Combined year × group isn't stored — too many columns for too little gain.)
function activeColumn(metricId = state.metric, year = state.year, level = state.level) {
    // Change-over-time mode overrides the active metric with a synthetic delta
    // column (materialized on demand). Only the active metric is delta-ified, so
    // the panel's other fixed outcome rows still read their own year columns.
    if (state.changeMode && metricId === state.metric) {
        const cc = ensureChangeColumn(metricId, level);
        if (cc) return cc;
    }
    // Group filter — overrides year (group-keyed columns are latest-year only).
    // HTML option values are uppercase (ELL, HL); data suffixes are lowercase
    // (__ell, __hl). Normalize before lookup.
    const grp = (state.studentGroup || "all").toLowerCase();
    if (grp !== "all") {
        const gIdx = GROUP_KEYED_INDEX[level] || {};
        if (gIdx[metricId] && gIdx[metricId].has(grp)) {
            return `${metricId}__${grp}`;
        }
        // Group requested but no group-keyed data — fall through to year/base
    }
    // Year-keyed lookup
    const idx = YEAR_KEYED_INDEX[level] || {};
    const years = idx[metricId];
    if (years && years.has(year)) return `${metricId}__${year}`;
    return metricId;
}

// Is the active metric year-keyed for the active level?
function isYearKeyed(metricId = state.metric, level = state.level) {
    const idx = YEAR_KEYED_INDEX[level] || {};
    return Boolean(idx[metricId] && idx[metricId].size > 0);
}

// Available years for the active metric/level. Returns an array.
function availableYears(metricId = state.metric, level = state.level) {
    const idx = YEAR_KEYED_INDEX[level] || {};
    const set = idx[metricId];
    return set ? [...set].sort((a, b) => a - b) : [];
}

// ─── CHANGE OVER TIME (year-over-year delta) ─────────────────────────────────
// A display mode (mutually exclusive with bivariate) that paints the CHANGE in a
// year-keyed metric between two years on a diverging scale centered at zero.
// Implementation: materialize a per-feature delta under a synthetic column whose
// name encodes (level, metric, from, to, abs|rel); activeColumn() then hands that
// column to the whole paint / classify / legend / no-data pipeline unchanged.
const CHANGE_PALETTE = "RdBu";              // diverging default: decrease=red, increase=blue
const _changeMaterialized = new Set();       // synthetic columns already written onto features

function changeColName(metricId, level) {
    return `__chg|${level}|${metricId}|${state.changeFrom}|${state.changeTo}|${state.changeRel ? "rel" : "abs"}`;
}

// The raw year-keyed column for a metric at a specific year (no group, no change
// indirection), or null if that year isn't available.
function yearColumn(metricId, year, level) {
    const idx = YEAR_KEYED_INDEX[level] || {};
    const years = idx[metricId];
    return (years && years.has(year)) ? `${metricId}__${year}` : null;
}

// Materialize (once per param set) the delta onto every feature; returns the
// synthetic column name, or null if it can't be computed for this metric/level.
function ensureChangeColumn(metricId = state.metric, level = state.level) {
    if (!state.changeMode || !GEO_DATA) return null;
    const fc = GEO_DATA[level];
    if (!fc || !fc.features) return null;
    const { changeFrom: yFrom, changeTo: yTo, changeRel: rel } = state;
    if (yFrom == null || yTo == null || yFrom === yTo) return null;
    const colFrom = yearColumn(metricId, yFrom, level);
    const colTo   = yearColumn(metricId, yTo,   level);
    if (!colFrom || !colTo) return null;
    const col = changeColName(metricId, level);
    if (_changeMaterialized.has(col)) return col;
    fc.features.forEach(f => {
        const p = f.properties;
        const a = p[colFrom], b = p[colTo];
        let d = null;
        if (a != null && b != null && isFinite(+a) && isFinite(+b)) {
            const na = +a, nb = +b;
            // Relative change is undefined when the baseline is 0; keep it blank.
            d = rel ? (na === 0 ? null : (nb - na) / Math.abs(na)) : (nb - na);
        }
        p[col] = d;
    });
    _changeMaterialized.add(col);
    return col;
}

// True when change mode is genuinely paintable for the active metric/level.
function changeActive(metricId = state.metric, level = state.level) {
    return state.changeMode && !state.bivariate && availableYears(metricId, level).length >= 2;
}

// Populate + clamp the From/To dropdowns against the active metric's real years.
function syncChangeYears() {
    const fromSel = document.getElementById("changeFromSelect");
    const toSel   = document.getElementById("changeToSelect");
    const yrs = availableYears(state.metric, state.level);
    if (yrs.length < 2) {
        if (fromSel) fromSel.innerHTML = "";
        if (toSel)   toSel.innerHTML = "";
        state.changeFrom = state.changeTo = null;
        return;
    }
    // Default to the full span; otherwise keep prior picks if still valid.
    if (state.changeFrom == null || !yrs.includes(state.changeFrom)) state.changeFrom = yrs[0];
    if (state.changeTo == null   || !yrs.includes(state.changeTo))   state.changeTo = yrs[yrs.length - 1];
    if (state.changeFrom === state.changeTo) { state.changeFrom = yrs[0]; state.changeTo = yrs[yrs.length - 1]; }
    const opts = yrs.map(y => `<option value="${y}">${y}</option>`).join("");
    if (fromSel) { fromSel.innerHTML = opts; fromSel.value = String(state.changeFrom); }
    if (toSel)   { toSel.innerHTML   = opts; toSel.value   = String(state.changeTo); }
}

// Keep the palette sensible when the metric changes: each metric carries a
// default sequential palette, but change mode needs a diverging one to center
// on zero. Centralized so the metric picker and populateMetricSelect agree.
// Semantic palette convention — make color *meaning* consistent across the atlas
// so a quick read works without decoding each legend. "Higher = better" outcomes
// get one cool "good" ramp (BuPu); "higher = worse" rates get a warm "concern"
// ramp (OrRd) — blue-vs-red being the most color-blind-distinguishable pairing.
// Demographics, ACS, finance, SpEd, counts, etc. stay NEUTRAL (no good/bad
// framing imposed); gaps & trends keep their diverging ramps. This sets the
// DEFAULT on metric switch — the user can still pick any palette manually.
const SEM_GOOD = "BuPu", SEM_CONCERN = "OrRd";
const SEM_GOOD_CATS = new Set(["Academic", "Achievement by group", "Achievement by group (Gr10)",
    "Achievement by group (other)",
    "Growth (MCAS SGP)", "Advanced coursework", "Postsecondary", "Postsecondary outcomes",
    "Progression", "Early education", "Accountability", "Outcomes"]);
const SEM_CONCERN_CATS = new Set(["Discipline", "Discipline by group", "Absenteeism by group"]);
const SEM_CONCERN_RE = /dropout|chronic|absent|not_meeting|churn|grade_retention|exclud|needing_support|disconnect/i;
// Lower-is-better or purely contextual metrics that happen to sit in an otherwise
// "good" category (e.g. class size in "Academic") — keep them NEUTRAL so we don't
// imply "bigger class = good" or moralize a demographic share.
const SEM_NEUTRAL_RE = /class_size|prek_low_income/i;
// Lower-is-better support ratios (students per staff member). DESE files them under
// "Student support" with no good/bad cue, so the semantic classifier would call them
// neutral — but fewer students per counselor/nurse/psychologist/social worker is
// unambiguously better access. Keyed by id (not category) so we DON'T reroute the
// palette: semanticPalette still returns each metric's own ramp. This list only
// informs polarity — the legend caption and the statewide-standing direction.
const LOWER_IS_BETTER_IDS = new Set([
    "students_per_counselor", "students_per_nurse",
    "students_per_psychologist", "students_per_social_worker",
]);
// Optional "good thing" noun for the statewide-standing sentence ("bottom 2% for
// counselor access"). Metrics without an entry render the bare "top/bottom N%".
const STANDING_NOUN = {
    students_per_counselor:     "counselor access",
    students_per_nurse:         "nurse access",
    students_per_psychologist:  "psychologist access",
    students_per_social_worker: "social worker access",
};
function semanticPalette(m) {
    if (!m) return SEM_GOOD;
    if (m.cat === "Equity gaps" || m.cat === "Trends") return m.palette;        // keep diverging
    // Child-care access is a "lower = worse" desert lens: keep its reversed-red
    // ramp (low / 0 = dark red) instead of the category's cool "good" ramp, so
    // the under-served towns pop instead of receding.
    if (m.id.startsWith("childcare_")) return m.palette;
    if (SEM_NEUTRAL_RE.test(m.id)) return m.palette;                            // contextual — keep own
    if (SEM_CONCERN_RE.test(m.id) || SEM_CONCERN_CATS.has(m.cat)) return SEM_CONCERN;
    if (SEM_GOOD_CATS.has(m.cat)) return SEM_GOOD;
    return m.palette;                                                           // neutral — keep own
}
// A metric's inherent direction, independent of the user's chosen palette:
// "good" (higher = better), "concern" (higher = worse), or "neutral" (no value
// judgment). Mirrors semanticPalette's classification — used for the plain-
// language legend caption so it can honestly say "darker is better/worse".
function metricPolarity(m) {
    if (!m) return "neutral";
    if (m.cat === "Equity gaps" || m.cat === "Trends") return "neutral";
    if (SEM_NEUTRAL_RE.test(m.id)) return "neutral";
    if (LOWER_IS_BETTER_IDS.has(m.id)) return "concern";   // support ratios: fewer per staffer = better
    if (SEM_CONCERN_RE.test(m.id) || SEM_CONCERN_CATS.has(m.cat)) return "concern";
    if (SEM_GOOD_CATS.has(m.cat)) return "good";
    return "neutral";
}
// Better-direction sign for a metric: +1 higher-is-better, −1 lower-is-better,
// 0 neutral. Read from the same polarity that drives the legend caption, so the
// map's color story and the statewide-standing line can never disagree.
function metricDir(metricId) {
    const pol = metricPolarity(getMetric(metricId));
    return pol === "good" ? 1 : pol === "concern" ? -1 : 0;
}
// "1st", "2nd", "264th" … for the standing sentence.
function ordinalNum(n) {
    const v = n % 100, s = ["th", "st", "nd", "rd"];
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// One plain-language sentence describing how to read the active color ramp:
// which way is "higher", and (where the metric has a clear direction) whether
// darker is better or worse. Empty for bivariate (its own legend explains it).
function legendCaptionText() {
    const m = getMetric(state.metric);
    if (state.bivariate) return "";
    if (changeActive(state.metric, state.level)) return "Darker = a bigger change between the two years.";
    const darkIsHigh = !state.reversePalette;          // default ramp paints high = dark
    let s = darkIsHigh ? "Darker = higher values" : "Darker = lower values";
    const pol = metricPolarity(m);                     // good | concern | neutral
    if (pol !== "neutral") {
        const goodHigh = pol === "good";
        const darkIsGood = (goodHigh === darkIsHigh);  // is the dark end the "good" end?
        s += darkIsGood ? " — darker is better" : " — darker is worse";
    }
    return s + ".";
}

function syncPaletteForMetric() {
    if (state.changeMode) {
        if (!PALETTES[state.palette] || PALETTES[state.palette].type !== "div") state.palette = CHANGE_PALETTE;
    } else {
        state.palette = semanticPalette(getMetric(state.metric));
    }
    const ps = document.getElementById("paletteSelect");
    if (ps) ps.value = state.palette;
}

// Turn change mode on/off (toggle handler). Mutually exclusive with the two
// compare modes, and forces a diverging palette so the scale reads around zero.
function setChangeMode(on) {
    state.changeMode = on;
    if (on) {
        if (state.bivariate) {
            state.bivariate = false;
            const bt = document.getElementById("bivariateToggle"); if (bt) bt.checked = false;
            const bc = document.getElementById("bivarControls");   if (bc) bc.style.display = "none";
        }
        if (state.compareMode) exitCompareMode();
        resetThreshold();   // a static range is meaningless on a delta scale
        syncChangeYears();
        syncPaletteForMetric();
    } else {
        // Restore the metric's own palette on exit.
        syncPaletteForMetric();
    }
    const cc = document.getElementById("changeControls");
    if (cc) cc.style.display = on ? "" : "none";
    updateMetricGating();
    applyChoropleth();
    updateLegend();
    updateMetricSummary();
}

// Signed delta formatter for change mode. Percent metrics show percentage POINTS
// (pts) for absolute change; relative mode always shows a % change. (Distinct
// from fmtDelta(d, format) used by Compare A↔B mode.)
function fmtChangeDelta(value, m) {
    if (value == null || !isFinite(value)) return "—";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
    const a = Math.abs(value);
    if (state.changeRel) return `${sign}${(a * 100).toFixed(1)}%`;
    if (m.format === "pct") return `${sign}${(a * 100).toFixed(1)} pts`;
    if (m.format === "usd") return `${sign}$${Math.round(a).toLocaleString()}`;
    return `${sign}${(Math.round(a * 10) / 10).toLocaleString()}`;
}

// Legend subtitle describing the delta units + span (e.g. "change in percentage
// points, 2021→2025").
function changeUnitLabel(m) {
    const span = `${state.changeFrom}→${state.changeTo}`;
    if (state.changeRel)      return `% change, ${span}`;
    if (m.format === "pct")   return `change in percentage points, ${span}`;
    if (m.format === "usd")   return `change in dollars, ${span}`;
    return `change, ${span}`;
}

// MapLibre sub-expressions for the change paint, computed inline from the two
// real year columns (which exist on the rendered source — the synthetic delta
// column does NOT). `valid` = both endpoints present (and non-zero baseline for
// % change); `value` = the delta. Returns null if either year column is absent.
function changeYearExprs(level) {
    const colF = yearColumn(state.metric, state.changeFrom, level);
    const colT = yearColumn(state.metric, state.changeTo, level);
    if (!colF || !colT) return null;
    const from = ["to-number", ["get", colF]], to = ["to-number", ["get", colT]];
    const bothNum = ["all",
        ["==", ["typeof", ["get", colF]], "number"],
        ["==", ["typeof", ["get", colT]], "number"]];
    const valid = state.changeRel ? ["all", bothNum, ["!=", from, 0]] : bothNum;
    const value = state.changeRel ? ["/", ["-", to, from], ["abs", from]] : ["-", to, from];
    return { valid, value };
}

// Paint for change mode — mirrors paintExpression() but the classified value is
// the inline year-over-year delta, and the breaks come from the JS-side delta
// distribution (getValuesForLevel reads the materialized synthetic column).
function changePaintExpression(level) {
    const e = changeYearExprs(level);
    if (!e) return NO_DATA_COLOR;
    const palette = state.palette, classify = state.classify;
    const colors = palColors(palette);
    const values = getValuesForLevel(level, state.metric);
    if (classify === "continuous") {
        if (values.length < 2) return ["case", e.valid, colors[colors.length - 1], NO_DATA_COLOR];
        const min = Math.min(...values), max = Math.max(...values);
        const stops = sampleColors(colors, 5);
        const expr = ["interpolate", ["linear"], e.value];
        for (let i = 0; i < stops.length; i++) expr.push(min + (max - min) * i / (stops.length - 1), stops[i]);
        return ["case", e.valid, expr, NO_DATA_COLOR];
    }
    const n = classCount(classify, values);
    const breaks = computeBreaksCached(level, state.metric, values, classify, n);
    const cleanBreaks = []; let prev = -Infinity;
    breaks.forEach(b => { const v = Number(b); if (isFinite(v) && v > prev) { cleanBreaks.push(v); prev = v; } });
    const stops = stopsForClasses(palette, cleanBreaks, values);
    if (cleanBreaks.length === 0) return ["case", e.valid, stops[Math.floor(stops.length / 2)], NO_DATA_COLOR];
    const expr = ["step", e.value, stops[0]];
    cleanBreaks.forEach((b, i) => { expr.push(b, stops[Math.min(i + 1, stops.length - 1)]); });
    return ["case", e.valid, expr, NO_DATA_COLOR];
}

// ─── YEAR ANIMATION (slideshow) ──────────────────────────────────────────────
let _yearAnimTimer = null;
const YEAR_ANIM_INTERVAL_MS = 900;

// While the year slideshow plays we FREEZE the class breaks so a district's color
// means the same thing in every frame. Otherwise Jenks/quantile (and continuous's
// min–max) recompute from each year's distribution and the whole map re-colors —
// which makes a place look like it changed when only the scale moved, defeating
// the point of watching it over time. We pool every year's values once and derive
// one shared set of breaks (the same trick the time-lapse exporter uses).
let _lockedBreaks = null;  // { metric, level, classify, breaks, pooled } | null

// Pool all available years for the current metric/level into one fixed set of
// breaks. Returns null when locking doesn't apply (bivariate, change-over-time,
// manual breaks — already fixed —, or <2 years / no data).
function buildLockedYearBreaks() {
    if (state.bivariate || changeActive(state.metric, state.level) || state.classify === "manual") return null;
    const level = state.level, metric = state.metric;
    const years = availableYears(metric, level);
    if (!years || years.length < 2) return null;
    const fc = GEO_DATA && GEO_DATA[level];
    if (!fc) return null;
    const pooled = [];
    years.forEach(y => {
        const c = yearColumn(metric, y, level);
        if (c) fc.features.forEach(f => { const v = f.properties[c]; if (v != null && isFinite(+v)) pooled.push(+v); });
    });
    if (pooled.length < 2) return null;
    let breaks = [];
    if (state.classify !== "continuous") {           // continuous fixes its min–max via pooled values alone
        const n = classCount(state.classify, pooled);
        const raw = computeBreaks(pooled, state.classify, n);
        let prev = -Infinity;
        raw.forEach(b => { const v = +b; if (isFinite(v) && v > prev) { breaks.push(v); prev = v; } });
    }
    return { metric, level, classify: state.classify, breaks, pooled };
}

// Does the active frozen-break set apply to this paint/legend call? `col` may be a
// resolved year column (metric__YYYY) — compare on the base metric. classify must
// match too, so changing the method mid-play falls back to live breaks gracefully.
function lockedBreaksFor(col, classify, level) {
    const lk = _lockedBreaks;
    if (!lk || lk.level !== level || lk.classify !== classify) return null;
    if (lk.metric !== String(col).split("__")[0]) return null;
    return lk;
}

function startYearAnimation() {
    if (state.playing) return;
    const years = availableYears();
    if (years.length < 2) return;
    state.playing = true;
    // Freeze the breaks across all years before the first frame, then repaint so
    // the legend immediately reflects the pooled scale.
    _lockedBreaks = buildLockedYearBreaks();
    applyChoropleth();
    updateLegend();
    const btn = document.getElementById("yearPlay");
    if (btn) { btn.textContent = "⏸"; btn.classList.add("playing"); btn.title = "Pause slideshow"; }
    _yearAnimTimer = setInterval(() => {
        const yrs = availableYears();
        if (yrs.length < 2) { stopYearAnimation(); return; }
        const idx = yrs.indexOf(state.year);
        const nextIdx = (idx + 1) % yrs.length;
        state.year = yrs[nextIdx];
        const slider = document.getElementById("yearSlider");
        if (slider) slider.value = state.year;
        const label = document.getElementById("yearLabel");
        if (label) label.textContent = state.year;
        applyChoropleth();
        updateLegend();
        updateMetricSummary();
    }, YEAR_ANIM_INTERVAL_MS);
}

function stopYearAnimation() {
    const wasLocked = _lockedBreaks != null;
    state.playing = false;
    if (_yearAnimTimer) { clearInterval(_yearAnimTimer); _yearAnimTimer = null; }
    // Release the frozen breaks and repaint so the stopped-on year shows its own
    // natural classification again.
    _lockedBreaks = null;
    if (wasLocked) { applyChoropleth(); updateLegend(); }
    const btn = document.getElementById("yearPlay");
    if (btn) { btn.textContent = "▶"; btn.classList.remove("playing"); btn.title = "Play slideshow"; }
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
function fmt(value, kind) {
    if (value == null || !isFinite(value)) return "—";
    if (kind === "pct") return `${(value * 100).toFixed(1)}%`;
    if (kind === "usd") return `$${Math.round(value).toLocaleString()}`;
    return Math.round(value).toLocaleString();
}

function getMetric(id) { return METRICS.find(m => m.id === id) || METRICS[0]; }

// Human-readable unit, shown as a legend subtitle. Percent/dollar formats
// already carry their symbol via fmt(), so the ambiguous "num" metrics
// (counts, ratios, scores, minutes, years, per-area) are the ones that need it.
const METRIC_UNITS = {
    TOTAL_CNT: "students enrolled",
    _pop_2020: "people (2020)",
    _pop_density_per_sqmi: "people per sq mi",
    _area_sqmi: "square miles",
    stu_tchr_ratio: "students per teacher",
    avg_class_size: "students per class",
    sch_enrollment: "students enrolled",
    diversity_index: "0–1 (higher = more diverse)",
    sat_total_mean: "scaled score (400–1600)",
    sat_ebrw_mean: "scaled score (200–800)",
    sat_math_mean: "scaled score (200–800)",
    acs_median_commute_min: "minutes (one-way)",
    acs_median_age: "years",
    // Growth (SGP) metrics are a 1–99 percentile, NOT a percentage — spell it out
    // so the legend's bare number explains itself to a non-expert.
    mcas_ela_sgp:      "growth percentile · 1–99 (50 ≈ a typical year)",
    mcas_math_sgp:     "growth percentile · 1–99 (50 ≈ a typical year)",
    mcas_ela_sgp_g10:  "growth percentile · 1–99 (50 ≈ a typical year)",
    mcas_math_sgp_g10: "growth percentile · 1–99 (50 ≈ a typical year)",
    mcas_ela_sgp_swd:  "growth percentile · 1–99 (50 ≈ a typical year)",
    mcas_math_sgp_swd: "growth percentile · 1–99 (50 ≈ a typical year)",
    prek_per_k_ratio:  "Pre-K students per Kindergartner",
};
function metricUnit(m) {
    if (METRIC_UNITS[m.id]) return METRIC_UNITS[m.id];
    if (m.format === "usd") return "US dollars";
    if (m.format === "pct") return "percent";
    return "";
}

// Metric-specific caveats surfaced under the legend (audit follow-ups; see
// scripts/analysis/data_anomalies.md). Shown when the metric is the active one.
const METRIC_NOTES = {
    LI_PCT: "2015-2021 uses DESE's 'Economically Disadvantaged' measure (a near-equivalent that replaced 'Low Income' those years); 1994-2014 and 2022+ are 'Low Income'.",
    el_exiting_pct: "DESE only reports districts at/above ~70%, so ~115 lower-rate districts appear as no-data — this map shows only above-threshold districts.",
    nss_pct_of_required: "100% = meets the required Net School Spending target; above 100% means spending over the minimum (small districts can far exceed it).",
    nss_pct_of_foundation: "100% = spending at the foundation budget; above 100% means spending above it (common for small, high-fixed-cost districts).",
};

// ─── GEOMETRY HELPERS ────────────────────────────────────────────────────────
// Signed area (shoelace) of a ring, in coordinate units².
function ringArea(r) {
    let a = 0;
    for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    return a / 2;
}
// Area-weighted centroid of a ring (falls back to vertex mean for degenerate rings).
function ringCentroid(r) {
    let x = 0, y = 0, a = 0;
    for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
        const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
        x += (r[j][0] + r[i][0]) * f; y += (r[j][1] + r[i][1]) * f; a += f;
    }
    if (a === 0) { let sx = 0, sy = 0; r.forEach(p => { sx += p[0]; sy += p[1]; }); return [sx / r.length, sy / r.length]; }
    a *= 3; return [x / a, y / a];
}
// A guaranteed-interior "representative point" for one polygon part (rings =
// [exterior, ...holes]): take the centroid's latitude, scan across the polygon at
// that latitude, and return the midpoint of the WIDEST interior span. Always lands
// inside (even for concave shapes like Boston, where the plain centroid sits in
// the harbor), and reads as centered.
function labelPointForPart(rings) {
    const ext = rings[0];
    const [cx, cy] = ringCentroid(ext);
    const xs = [];
    rings.forEach(ring => {
        for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
            const a = ring[j], b = ring[i];
            if ((a[1] > cy) !== (b[1] > cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
    });
    if (xs.length < 2) return [cx, cy];
    xs.sort((p, q) => p - q);
    let bestMid = cx, bestLen = -1;
    for (let i = 0; i + 1 < xs.length; i += 2) { const len = xs[i + 1] - xs[i]; if (len > bestLen) { bestLen = len; bestMid = (xs[i] + xs[i + 1]) / 2; } }
    return [bestMid, cy];
}
// Build a point FeatureCollection of label anchors — one interior point per
// polygon part — so a name is placed ONCE per piece instead of once per internal
// vector tile the polygon spans (the "LYNN LYNN LYNN" duplication on the polygon
// source). Single-polygon features get one label; genuine multi-part features get
// one per part, skipping slivers/islands under 12% of the largest part's area.
function buildLabelPoints(fc, getName) {
    const feats = [];
    (fc.features || []).forEach(f => {
        const g = f.geometry; if (!g) return;
        const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
        if (!polys.length) return;
        const name = getName(f.properties);
        if (name == null || name === "") return;
        const parts = polys.map(rings => ({ rings, area: Math.abs(ringArea(rings[0])) }));
        const maxArea = Math.max(...parts.map(p => p.area)) || 0;
        parts.forEach(p => {
            if (maxArea > 0 && p.area < maxArea * 0.12) return;   // skip slivers / small islands
            const pt = labelPointForPart(p.rings);
            feats.push({ type: "Feature", properties: { label: name }, geometry: { type: "Point", coordinates: pt } });
        });
    });
    return { type: "FeatureCollection", features: feats };
}

// Bounding box of a GeoJSON geometry: [west, south, east, north]
function geomBbox(geom) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function walk(coords) {
        if (typeof coords[0] === "number") {
            if (coords[0] < minX) minX = coords[0];
            if (coords[1] < minY) minY = coords[1];
            if (coords[0] > maxX) maxX = coords[0];
            if (coords[1] > maxY) maxY = coords[1];
            return;
        }
        coords.forEach(walk);
    }
    if (!geom || !geom.coordinates) return null;
    walk(geom.coordinates);
    if (!isFinite(minX)) return null;
    return [minX, minY, maxX, maxY];
}

// Spherical polygon area in square meters — turf-area equivalent. Used to
// compute population density (per sq mi) at load time.
const _EARTH_R_M = 6378137;
function _ringAreaSqM(ring) {
    let total = 0;
    const len = ring.length;
    if (len < 3) return 0;
    for (let i = 0; i < len; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[(i + 1) % len];
        total += (lon2 - lon1) * Math.PI / 180 *
                 (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
    }
    return Math.abs(total * _EARTH_R_M * _EARTH_R_M / 2);
}
function _polygonAreaSqM(rings) {
    const outer = _ringAreaSqM(rings[0] || []);
    let holes = 0;
    for (let i = 1; i < rings.length; i++) holes += _ringAreaSqM(rings[i]);
    return Math.max(0, outer - holes);
}
function polygonAreaSqM(geom) {
    if (!geom) return 0;
    if (geom.type === "Polygon") return _polygonAreaSqM(geom.coordinates);
    if (geom.type === "MultiPolygon") {
        return geom.coordinates.reduce((tot, poly) => tot + _polygonAreaSqM(poly), 0);
    }
    return 0;
}

// ─── ENRICHMENT (runs once at load) ──────────────────────────────────────────
// - Computes _area_sqmi and _pop_density_per_sqmi for every municipality
// - Merges optional ACS basics file (data/ma_muni_acs.json) onto matching munis
//   keyed by TOWN_ID. ACS file shape: { "TOWN_ID": { col: val, ... }, ... }
function enrichMunicipalities(munis, acs) {
    const SQM_PER_SQMI = 2_589_988.110336;
    munis.features.forEach(f => {
        const areaSqM = polygonAreaSqM(f.geometry);
        const areaSqMi = areaSqM / SQM_PER_SQMI;
        f.properties._area_sqmi = areaSqMi;
        const pop = f.properties.POP2020 || f.properties.pop_2020;
        f.properties._pop_2020 = pop || null;
        f.properties._pop_density_per_sqmi = (pop && areaSqMi > 0) ? pop / areaSqMi : null;
        if (acs) {
            const key = String(f.properties.TOWN_ID || f.properties.MUNI_ID || f.properties.TOWN || "").trim();
            const row = acs[key] || acs[key.toUpperCase()] || acs[key.toLowerCase()];
            if (row) Object.assign(f.properties, row);
        }
    });
}

// Merge the aggregated district ACS file onto the academic district features,
// keyed by DIST_CODE. Mirrors enrichMunicipalities but for the 274 academic
// districts. Run scripts/aggregate_acs_to_districts.py to refresh.
function enrichAcademicDistricts(districts, distAcs) {
    if (!distAcs) return;
    districts.features.forEach(f => {
        const key = String(f.properties.DIST_CODE || "").trim();
        const row = distAcs[key];
        if (row) Object.assign(f.properties, row);
    });
}

// Merge per-school metrics (enrollment / MCAS / accountability percentile,
// data/ma_school_metrics.json) onto the schools point layer, keyed by SCHID.
function enrichSchools(schools, metrics) {
    if (!schools || !metrics) return;
    schools.features.forEach(f => {
        const key = String(f.properties.SCHID || "").trim();
        const row = metrics[key];
        if (row) Object.assign(f.properties, row);
    });
}

// Derived metrics computed in-app from columns already loaded onto district
// features (no fetch). Run AFTER all enrichment so the side-file inputs exist.
// District-level only. Adds: a student racial diversity index, 5/10-year
// enrollment trends, and equity GAP metrics (subgroup vs. all-students).
function computeDerivedMetrics(districts) {
    if (!districts || !districts.features) return;
    const num = v => (v != null && isFinite(+v)) ? +v : null;
    const r3 = v => Math.round(v * 1000) / 1000;
    districts.features.forEach(f => {
        const p = f.properties;

        // ── Data hygiene (audit fixes; see scripts/analysis/data_anomalies.md) ──
        // Zero-enrollment districts (e.g. Gosnold, 01090000) store 0/0 ratio
        // results as 0 instead of null, which paints them as a real low value and
        // poisons every derived metric below. Null those out when enrollment is 0.
        if (num(p.TOTAL_CNT) === 0) {
            ["EL_PCT","LI_PCT","HN_PCT","HL_PCT","BAA_PCT","AS_PCT","WH_PCT",
             "SWD_PCT","FLNE_PCT","FE_PCT","avg_class_size","stu_tchr_ratio"]
                .forEach(k => { if (p[k] === 0) p[k] = null; });
        }
        // ACS top-codes median household income at $250,000; the population-
        // weighted district aggregation overshoots to $250,001 for the wealthiest
        // towns (Carlisle, Wellesley, Weston), creating a false outlier bin.
        if (p.acs_median_household_income != null && +p.acs_median_household_income > 250000) {
            p.acs_median_household_income = 250000;
        }

        // Student racial diversity (Gini–Simpson): 1 − Σ(share²) over the
        // reported race shares plus an "other" remainder. Higher = more diverse.
        const shares = ["WH_PCT", "BAA_PCT", "HL_PCT", "AS_PCT"].map(k => num(p[k])).filter(v => v != null);
        if (shares.length) {
            const known = shares.reduce((a, b) => a + b, 0);
            const parts = shares.slice();
            const other = 1 - known;
            if (other > 0.001) parts.push(other);
            p.diversity_index = Math.max(0, r3(1 - parts.reduce((a, b) => a + b * b, 0)));
        }

        // Enrollment trend — % change over 5 and 10 years ending at the latest
        // year that has data (TOTAL_CNT is year-keyed).
        const series = [];
        for (let y = 1994; y <= 2026; y++) {
            const v = num(p[`TOTAL_CNT__${y}`]);
            if (v != null && v > 0) series.push([y, v]);
        }
        if (series.length) {
            const [ly, lv] = series[series.length - 1];
            const at = back => { const hit = series.find(([y]) => y === ly - back); return hit ? hit[1] : null; };
            const c5 = at(5), c10 = at(10);
            if (c5) p.enroll_change_5yr = r3((lv - c5) / c5);
            if (c10) p.enroll_change_10yr = r3((lv - c10) / c10);
        }

        // Equity GAPS. Achievement (higher = better): all-students − subgroup,
        // so a positive gap = the subgroup trails the district average.
        const gapAchieve = (allCol, subCol, out) => {
            const a = num(p[allCol]), s = num(p[subCol]);
            if (a != null && s != null) p[out] = r3(a - s);
        };
        gapAchieve("grad_4yr", "grad_4yr__li", "grad_gap_low_income");
        gapAchieve("grad_4yr", "grad_4yr__swd", "grad_gap_swd");
        gapAchieve("mcas_g38_ela_me", "mcas_ela_low_income", "mcas_ela_gap_low_income");
        gapAchieve("mcas_g38_math_me", "mcas_math_low_income", "mcas_math_gap_low_income");
        gapAchieve("mcas_g38_ela_me", "mcas_ela_swd", "mcas_ela_gap_swd");
        gapAchieve("mcas_g38_math_me", "mcas_math_swd", "mcas_math_gap_swd");
        // Race / EL achievement gaps.
        gapAchieve("grad_4yr", "grad_4yr__ell", "grad_gap_ell");
        gapAchieve("grad_4yr", "grad_4yr__hl", "grad_gap_hispanic");
        gapAchieve("grad_4yr", "grad_4yr__baa", "grad_gap_black");
        gapAchieve("mcas_g38_ela_me", "mcas_ela_ell", "mcas_ela_gap_ell");
        gapAchieve("mcas_g38_ela_me", "mcas_ela_hispanic", "mcas_ela_gap_hispanic");
        gapAchieve("mcas_g38_ela_me", "mcas_ela_black", "mcas_ela_gap_black");
        gapAchieve("mcas_g38_math_me", "mcas_math_ell", "mcas_math_gap_ell");
        gapAchieve("mcas_g38_math_me", "mcas_math_hispanic", "mcas_math_gap_hispanic");
        gapAchieve("mcas_g38_math_me", "mcas_math_black", "mcas_math_gap_black");

        // Discipline / absence (higher = worse): subgroup − all-students, so a
        // positive gap = the subgroup is suspended / chronically absent more.
        const gapBurden = (subCol, allCol, out) => {
            const a = num(p[allCol]), s = num(p[subCol]);
            if (a != null && s != null) p[out] = r3(s - a);
        };
        gapBurden("oss_low_income", "disc_oss_pct", "oss_gap_low_income");
        gapBurden("oss_swd", "disc_oss_pct", "oss_gap_swd");
        gapBurden("oss_black", "disc_oss_pct", "oss_gap_black");
        gapBurden("oss_hispanic", "disc_oss_pct", "oss_gap_hispanic");
        gapBurden("chronic_low_income", "chronic_absent_pct", "chronic_gap_low_income");
        gapBurden("chronic_swd", "chronic_absent_pct", "chronic_gap_swd");
        gapBurden("chronic_ell", "chronic_absent_pct", "chronic_gap_ell");

        // Earnings gap (higher = worse for the subgroup): all grads − low-income
        // grads, in raw dollars, so a positive gap = low-income grads earn less.
        gapAchieve("grad_avg_earnings", "grad_avg_earnings_lowincome", "earnings_gap_low_income");

        // College-going gaps (achievement, higher = worse for the subgroup):
        // all-students immediate college enrollment − each subgroup's, so a
        // positive gap = the subgroup enrolls at a lower rate than the district.
        gapAchieve("college_enroll_pct", "college_enroll_low_income", "college_gap_low_income");
        gapAchieve("college_enroll_pct", "college_enroll_black", "college_gap_black");
        gapAchieve("college_enroll_pct", "college_enroll_hispanic", "college_gap_hispanic");
        gapAchieve("college_enroll_pct", "college_enroll_swd", "college_gap_swd");
        gapAchieve("college_enroll_pct", "college_enroll_ell", "college_gap_ell");

        // High-Needs achievement gap (higher = worse): all-students Gr3-8 MCAS
        // M+E − the high-needs subgroup, so a positive gap = high-needs students
        // trail the district average.
        gapAchieve("mcas_g38_ela_me", "mcas_ela_high_needs", "mcas_ela_gap_high_needs");
        gapAchieve("mcas_g38_math_me", "mcas_math_high_needs", "mcas_math_gap_high_needs");

        // Gender achievement gap (diverging): female − male Gr3-8 MCAS M+E, so a
        // positive gap = girls ahead, negative = boys ahead.
        gapAchieve("mcas_ela_female", "mcas_ela_male", "mcas_ela_gender_gap");
        gapAchieve("mcas_math_female", "mcas_math_male", "mcas_math_gender_gap");

        // Teacher representation gap: share of students who are of color minus
        // share of educators who are of color (positive = students more diverse
        // than the educator workforce).
        const studColor = num(p.WH_PCT) != null ? 1 - num(p.WH_PCT) : null;
        const eduColor = num(p.educators_of_color_pct);
        if (studColor != null && eduColor != null) p.teacher_rep_gap = r3(studColor - eduColor);
    });
}

// ─── PLACE-NAME DATALIST (powers the search-and-fly input) ───────────────────
const PLACE_INDEX = { items: [] };   // [{ name, type, bbox, center?, props? }, ...]
function populatePlaceList(munis, districts, schools, colleges) {
    const items = [];
    munis.features.forEach(f => {
        const name = f.properties.town_display || f.properties.TOWN;
        if (!name) return;
        const bbox = geomBbox(f.geometry);
        if (bbox) items.push({ name, type: "muni", bbox });
    });
    districts.features.forEach(f => {
        const name = f.properties.dist_display || f.properties.DIST_NAME;
        if (!name) return;
        const bbox = geomBbox(f.geometry);
        if (bbox) items.push({ name: `${name} (district)`, type: "district", bbox });
    });
    // Schools — find a specific school by name and fly to its point. The label
    // disambiguates duplicate school names by town.
    if (schools && schools.features) {
        schools.features.forEach(f => {
            const p = f.properties;
            const lon = +p.lon, lat = +p.lat;
            if (!p.NAME || !isFinite(lon) || !isFinite(lat)) return;
            const d = 0.02;   // ~2km framing box around the point
            items.push({
                name: `${p.NAME} — ${p.TOWN || ""} (school)`.replace(" ()", ""),
                type: "school",
                bbox: [lon - d, lat - d, lon + d, lat + d],
                center: [lon, lat],
                props: p,
            });
        });
    }
    // Colleges/universities (incl. branch campuses) — fly to the point + pop its card.
    if (colleges && colleges.features) {
        colleges.features.forEach(f => {
            const p = f.properties, c = f.geometry && f.geometry.coordinates;
            if (!p.NAME || !c || !isFinite(+c[0]) || !isFinite(+c[1])) return;
            const d = 0.03;
            items.push({
                name: `${p.NAME} (college)`,
                type: "college",
                bbox: [+c[0] - d, +c[1] - d, +c[0] + d, +c[1] + d],
                center: [+c[0], +c[1]],
                props: p,
            });
        });
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    PLACE_INDEX.items = items;
    const dl = document.getElementById("placeList");
    if (!dl) return;
    dl.innerHTML = "";
    items.forEach(it => {
        const opt = document.createElement("option");
        opt.value = it.name;
        dl.appendChild(opt);
    });
}
function findPlace(query) {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    return PLACE_INDEX.items.find(it => it.name.toLowerCase() === q)
        || PLACE_INDEX.items.find(it => it.name.toLowerCase().startsWith(q))
        || PLACE_INDEX.items.find(it => it.name.toLowerCase().includes(q));
}

// ─── ADDRESS / ZIP GEOCODING ─────────────────────────────────────────────────
// When the search text isn't a known place NAME but looks like an address/ZIP,
// geocode it to a point and fly there with a dropped pin. Primary: the keyless
// US Census onelineaddress geocoder (US-only, great for MA addresses/ZIPs).
// Fallback: OSM Nominatim, biased to the MA bounding box. Both are best-effort —
// a miss just shows a gentle inline hint.
let _searchMarker = null;
function clearSearchMarker() { if (_searchMarker) { _searchMarker.remove(); _searchMarker = null; } }
function dropSearchMarker(lng, lat, label) {
    clearSearchMarker();
    _searchMarker = new maplibregl.Marker({ color: "#0A1F44" }).setLngLat([lng, lat]);
    if (label) _searchMarker.setPopup(new maplibregl.Popup({ offset: 26, closeButton: true }).setText(label));
    _searchMarker.addTo(map);
}
function flashSearchHint(msg) {
    const el = document.getElementById("searchHint");
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(flashSearchHint._t);
    flashSearchHint._t = setTimeout(() => { el.hidden = true; }, 4500);
}
async function geocodeAndFly(q) {
    const land = (lng, lat, label) => {
        if (!isFinite(lng) || !isFinite(lat)) return false;
        map.flyTo({ center: [lng, lat], zoom: 13, duration: 900, essential: true });
        dropSearchMarker(lng, lat, label);
        return true;
    };
    // 1) US Census geocoder (keyless; US addresses + ZIPs).
    try {
        const u = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
        const r = await fetch(u);
        if (r.ok) {
            const j = await r.json();
            const hit = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
            if (hit && hit.coordinates && land(+hit.coordinates.x, +hit.coordinates.y, hit.matchedAddress || q)) return;
        }
    } catch (e) { /* CORS or network — fall through to Nominatim */ }
    // 2) OSM Nominatim fallback, biased to the Massachusetts bounding box.
    try {
        const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&viewbox=-73.51,42.89,-69.93,41.24&q=${encodeURIComponent(q)}`;
        const r = await fetch(u, { headers: { Accept: "application/json" } });
        if (r.ok) {
            const j = await r.json();
            if (j && j[0] && land(+j[0].lon, +j[0].lat, j[0].display_name || q)) return;
        }
    } catch (e) { /* ignore */ }
    flashSearchHint("Couldn’t find that address — try a ZIP code, “street, town”, or a place name.");
}

// ─── CLASSIFICATION & PAINT BUILDERS ─────────────────────────────────────────
// A single repaint calls getValuesForLevel + the chosen classifier up to ~4×
// (paint, legend, summary, threshold) for the *same* level/column. Memoize both
// so a palette change (which doesn't alter the data) doesn't rescan all 351
// features or recompute O(n²) Jenks. GEO_DATA is immutable after load, and the
// active column encodes year + student group, so the cache key is exact.
let _valuesCache = { key: null, values: null };
function getValuesForLevel(level, metricId) {
    if (!GEO_DATA) return [];
    const fc = GEO_DATA[level];
    if (!fc || !fc.features) return [];
    // Year-aware: read year-keyed column when available, else fall back to latest.
    const col = activeColumn(metricId, state.year, level);
    const key = `${level}|${col}`;
    if (_valuesCache.key === key) return _valuesCache.values;
    const values = fc.features.map(f => f.properties[col])
                        .filter(v => v != null && isFinite(+v))
                        .map(v => +v);
    // Don't cache an EMPTY read. On a cold deep-link, the level/metric/year are
    // restored from the URL and can be queried before GEO_DATA finishes merging
    // the side-join columns — caching [] here would poison the cache for that
    // key and never recover, so the map shows "Not enough variation to classify"
    // forever even after the data loads. Cache only once values are present.
    if (values.length) _valuesCache = { key, values };
    return values;
}

let _breaksCache = { key: null, breaks: null };
function computeBreaksCached(level, metricId, values, classify, n) {
    const col = activeColumn(metricId, state.year, level);
    const key = `${level}|${col}|${classify}|${n}|${classify === "manual" ? state.manualBreaks : ""}`;
    if (_breaksCache.key === key) return _breaksCache.breaks;
    const breaks = computeBreaks(values, classify, n);
    // Same guard as getValuesForLevel: a pre-merge call (no values yet) must not
    // poison the cache with empty breaks, or the legend reads "Not enough
    // variation to classify" permanently for that key (hit via cold deep-links /
    // shared links). Only memoize once there's real data to classify.
    if (values.length) _breaksCache = { key, breaks };
    return breaks;
}

function quantileBreaks(values, n) {
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length < n) return sorted.slice(0, -1);
    const breaks = [];
    for (let i = 1; i < n; i++) {
        breaks.push(sorted[Math.floor(sorted.length * i / n)]);
    }
    return breaks;
}

function equalIntervalBreaks(values, n) {
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / n;
    return Array.from({ length: n - 1 }, (_, i) => min + step * (i + 1));
}

// Fisher-Jenks natural breaks — minimizes within-class variance, maximizes
// between-class variance. The standard cartographic choice for thematic maps.
// Runs O(n² · k) which is fine for n < 500 polygons.
function jenksBreaks(values, n) {
    if (values.length <= n) return values.slice(0, -1);
    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    // Lower class limits and variance combinations matrices
    const lc = Array.from({ length: len + 1 }, () => new Array(n + 1).fill(0));
    const vc = Array.from({ length: len + 1 }, () => new Array(n + 1).fill(0));
    for (let j = 1; j <= n; j++) {
        lc[1][j] = 1;
        vc[1][j] = 0;
        for (let i = 2; i <= len; i++) vc[i][j] = Infinity;
    }

    for (let l = 2; l <= len; l++) {
        let s1 = 0, s2 = 0, w = 0;
        for (let m = 1; m <= l; m++) {
            const i3 = l - m + 1;
            const val = sorted[i3 - 1];
            s2 += val * val;
            s1 += val;
            w++;
            const v = s2 - (s1 * s1) / w;
            const i4 = i3 - 1;
            if (i4 !== 0) {
                for (let j = 2; j <= n; j++) {
                    if (vc[l][j] >= v + vc[i4][j - 1]) {
                        lc[l][j] = i3;
                        vc[l][j] = v + vc[i4][j - 1];
                    }
                }
            }
        }
        lc[l][1] = 1;
        vc[l][1] = s2 - (s1 * s1) / w;
    }

    // Walk back through lc[] to recover the class boundaries
    const kclass = new Array(n + 1).fill(0);
    kclass[n] = sorted[len - 1];
    kclass[0] = sorted[0];
    let k = len;
    for (let countNum = n; countNum > 1; countNum--) {
        const id = lc[k][countNum] - 1;
        kclass[countNum - 1] = sorted[id];
        k = lc[k][countNum] - 1;
    }
    // Return only the inner breaks (n - 1 of them)
    return kclass.slice(1, -1);
}

// Standard-deviation breaks — classes at mean ± k·σ. Returns n-1 inner breaks
// centered on the mean, clamped to the data range. Pairs naturally with
// diverging palettes (the middle class straddles the mean).
function stdDevBreaks(values, n) {
    if (values.length < 2) return [];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);
    if (sd === 0) return [];
    const min = Math.min(...values), max = Math.max(...values);
    // For n classes we need n-1 cuts. Spread them symmetrically about the mean
    // in half-σ steps: e.g. n=5 → mean ±0.5σ, mean ±1.5σ.
    const cuts = [];
    const half = (n - 1) / 2;
    for (let i = 0; i < n - 1; i++) {
        const k = (i - half + 0.5);          // …,-1.5,-0.5,0.5,1.5,…
        const v = mean + k * sd;
        if (v > min && v < max) cuts.push(v);
    }
    return cuts;
}

// Geometric-interval breaks — class widths grow by a constant ratio. Good for
// right-skewed data (income, enrollment) where a few big values dominate.
function geometricBreaks(values, n) {
    if (values.length === 0) return [];
    let min = Math.min(...values), max = Math.max(...values);
    if (max === min) return [];
    // Geometric progression needs positive values; shift if the series includes
    // zero or negatives so ratios stay defined.
    const shift = min <= 0 ? (1 - min) : 0;
    min += shift; max += shift;
    const ratio = Math.pow(max / min, 1 / n);
    const breaks = [];
    for (let i = 1; i < n; i++) breaks.push(min * Math.pow(ratio, i) - shift);
    return breaks;
}

// "Pretty" / rounded breaks — equal-interval cuts snapped to human-friendly
// round numbers (1, 2, 2.5, 5 × 10ⁿ) so the legend reads cleanly.
function prettyBreaks(values, n) {
    if (values.length === 0) return [];
    const min = Math.min(...values), max = Math.max(...values);
    if (max === min) return [];
    const rawStep = (max - min) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const step = niceNorm * mag;
    const start = Math.ceil(min / step) * step;
    const breaks = [];
    for (let v = start; v < max - step * 0.001; v += step) {
        // Avoid an opening class identical to the minimum
        if (v > min) breaks.push(Number(v.toFixed(10)));
    }
    return breaks;
}

// Parse the user's manual-break string ("0.2, 0.4, 0.6") into a sorted numeric
// array. Returns null when nothing usable was entered (callers fall back).
function parseManualBreaks(str) {
    if (!str) return null;
    const nums = String(str).split(/[, \t\n;]+/)
        .map(s => parseFloat(s)).filter(v => isFinite(v))
        .sort((a, b) => a - b);
    return nums.length ? nums : null;
}

// Central dispatcher — every break-based classifier flows through here so the
// paint expression and the legend always agree. `n` is the number of CLASSES;
// the returned array holds the n-1 interior cut points.
function computeBreaks(values, classify, n) {
    switch (classify) {
        case "quantile":  return quantileBreaks(values, n);
        case "equal":     return equalIntervalBreaks(values, n);
        case "jenks":     return jenksBreaks(values, n);
        case "stddev":    return stdDevBreaks(values, n);
        case "geometric": return geometricBreaks(values, n);
        case "pretty":    return prettyBreaks(values, n);
        case "manual":    return parseManualBreaks(state.manualBreaks) || jenksBreaks(values, n);
        default:          return jenksBreaks(values, n);
    }
}

// Number of classes for a given classification. Manual breaks define their own
// class count (#cuts + 1); everything else uses a fixed 5.
function classCount(classify, values) {
    if (classify === "manual") {
        const b = parseManualBreaks(state.manualBreaks);
        if (b) return b.length + 1;
    }
    return 5;
}

// Pick N evenly-spaced colors from a palette
// Single accessor for a named palette's color ramp, honoring the user's
// "reverse colors" toggle. Routing every color read through here means flipping
// state.reversePalette flips the choropleth, the legend, and the export legend
// in one place — for both sequential and diverging palettes.
function palColors(paletteName) {
    const p = PALETTES[paletteName] || PALETTES.Viridis;
    return state.reversePalette ? p.colors.slice().reverse() : p.colors;
}

function sampleColors(palette, n) {
    if (n <= 1) return [palette[0]];
    if (palette.length === n) return palette;
    if (palette.length < n) return palette;
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(palette[Math.floor(i * (palette.length - 1) / (n - 1))]);
    }
    return out;
}

// N class colors for a named palette. Categorical palettes take their first N
// distinct hues (no interpolation); sequential/diverging get evenly sampled.
function classColors(paletteName, n) {
    const p = PALETTES[paletteName];
    if (!p) return sampleColors(PALETTES.Viridis.colors, n);
    const colors = palColors(paletteName);
    if (p.type === "cat") return colors.slice(0, n);
    return sampleColors(colors, n);
}

// Diverging palettes must diverge around a meaningful midpoint, otherwise the
// neutral middle color lands on an arbitrary class boundary and the map reads
// as misleading. Color each class by its midpoint's position relative to a
// center (0 when the data straddles zero, else the mean): t=0.5 → neutral, so
// equal magnitudes above/below the center get mirror-image colors.
function divergingStops(paletteName, breaks, values) {
    const colors = palColors(paletteName);
    const nClasses = breaks.length + 1;
    if (!values.length) return sampleColors(colors, nClasses);
    const min = Math.min(...values), max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const center = (min < 0 && max > 0) ? 0 : mean;
    const maxAbs = Math.max(Math.abs(min - center), Math.abs(max - center)) || 1;
    const bounds = [min, ...breaks, max];
    const stops = [];
    for (let i = 0; i < bounds.length - 1; i++) {
        const rep = (bounds[i] + bounds[i + 1]) / 2;            // class midpoint
        let t = 0.5 + 0.5 * (rep - center) / maxAbs;            // 0..1, 0.5 = neutral
        t = Math.max(0, Math.min(1, t));
        stops.push(colors[Math.round(t * (colors.length - 1))]);
    }
    return stops;
}

// Single source of truth for class → color so the paint expression and the
// legend always agree, including the diverging-centering above.
function stopsForClasses(paletteName, breaks, values) {
    const p = PALETTES[paletteName];
    if (p && p.type === "div") return divergingStops(paletteName, breaks, values);
    return classColors(paletteName, breaks.length + 1);
}

// Statewide rank + percentile of a value within the active level's distribution.
// rank 1 = highest. Returns null when there isn't enough data to rank.
function rankInfo(level, metricId, value) {
    if (value == null || !isFinite(+value)) return null;
    const vals = getValuesForLevel(level, metricId);
    if (vals.length < 2) return null;
    const v = +value, total = vals.length;
    const higher = vals.filter(x => x > v).length;     // places with a higher value
    const lower  = vals.filter(x => x < v).length;     // places with a lower value
    const rank = higher + 1;                            // legacy: 1 = highest value
    const pctile = Math.round(100 * vals.filter(x => x <= v).length / total);
    return { rank, total, pctile, higher, lower, fromTop: higher + 1, fromBottom: lower + 1 };
}

// Direction-aware "where this place stands statewide", e.g. for a high students-per-
// counselor district: "6th-highest of 269 · bottom 2% for counselor access". Names
// the value position from the nearer end, then which tail of the GOOD direction the
// place sits in — so a bad standing can't masquerade as a flattering low "#6".
// Returns null for neutral metrics (no clear better-direction); callers then fall
// back to the plain "rank N of T · Pth percentile". Forms: "full" (with noun),
// "mid" (top/bottom % but no noun, for tight spots), "short" (ordinal only).
function standingPhrase(metricId, rk, form) {
    form = form || "full";
    const dir = metricDir(metricId);
    if (!dir || !rk) return null;
    const N = rk.total;
    const ord = rk.fromTop <= rk.fromBottom
        ? `${ordinalNum(rk.fromTop)}-highest of ${N}`
        : `${ordinalNum(rk.fromBottom)}-lowest of ${N}`;
    if (form === "short") return ord;
    const better = dir < 0 ? rk.lower  : rk.higher;    // strictly better in the good direction
    const worse  = dir < 0 ? rk.higher : rk.lower;     // strictly worse
    const nearGood = better <= worse;
    const k = Math.max(1, Math.min(99, Math.round(100 * ((nearGood ? better : worse) + 1) / N)));
    let tail = `${nearGood ? "top" : "bottom"} ${k}%`;
    const noun = STANDING_NOUN[metricId];
    if (form === "full" && noun) tail += ` for ${noun}`;
    return `${ord} · ${tail}`;
}

// Explicit "no data" color — distinct from any palette stop, slightly warm
// off-white. We also style its outline differently (dashed) for clarity.
const NO_DATA_COLOR = "#f0eee8";

// "No high school here" color — for K-8/elementary districts on a high-school
// metric (grad rate, Gr10 MCAS, college-going…). These aren't missing data:
// the district structurally has no 9–12 program, so the measure doesn't apply.
// A light slate (cooler/greyer than the warm cream NO_DATA_COLOR, lighter than
// the "no district" grey #9aa1ad) so the three blank states read as distinct.
const NO_HS_COLOR = "#ccd2dc";

function paintExpression(metricId, paletteName, classify, level) {
    const colors = palColors(paletteName);
    // During year-play the breaks are frozen across all years (see _lockedBreaks):
    // paint from the pooled value pool so continuous min–max and diverging centering
    // also stay put, and reuse the pre-computed shared breaks below.
    const lock = lockedBreaksFor(metricId, classify, level);
    const values = lock ? lock.pooled : getValuesForLevel(level, metricId);

    const valid = ["case",
        ["==", ["typeof", ["get", metricId]], "number"], true,
        false
    ];

    // Blank color for features with no value. On a high-school-outcome metric at
    // district level, K-8 districts (flagged _nohs at load) get the distinct
    // "no high school here" color instead of generic no-data cream — the value
    // doesn't apply rather than being missing. metricId here is the resolved
    // column (e.g. grad_4yr__2025), so strip any __year/__group suffix to test
    // the base metric.
    const baseMetric = String(metricId).split("__")[0];
    const blank = (level === "district" && HS_OUTCOME_METRICS.has(baseMetric))
        ? ["case", ["==", ["get", "_nohs"], true], NO_HS_COLOR, NO_DATA_COLOR]
        : NO_DATA_COLOR;

    if (classify === "continuous") {
        if (values.length < 2) return ["case", valid, colors[colors.length - 1], blank];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const stops = sampleColors(colors, 5);
        const expr = ["interpolate", ["linear"], ["to-number", ["get", metricId]]];
        for (let i = 0; i < stops.length; i++) {
            expr.push(min + (max - min) * i / (stops.length - 1), stops[i]);
        }
        return ["case", valid, expr, blank];
    }

    const n = classCount(classify, values);
    const breaks = lock ? lock.breaks : computeBreaksCached(level, metricId, values, classify, n);
    // Ensure breaks are strictly increasing for MapLibre's step expression.
    // Jenks/quantile can return duplicates when the data has ties.
    const cleanBreaks = [];
    let prev = -Infinity;
    breaks.forEach(b => {
        const v = Number(b);
        if (isFinite(v) && v > prev) {
            cleanBreaks.push(v);
            prev = v;
        }
    });
    // Colors derived from the *cleaned* breaks so diverging centering and the
    // step expression line up exactly.
    const stops = stopsForClasses(paletteName, cleanBreaks, values);
    if (cleanBreaks.length === 0) {
        return ["case", valid, stops[Math.floor(stops.length / 2)], blank];
    }
    const expr = ["step", ["to-number", ["get", metricId]], stops[0]];
    cleanBreaks.forEach((b, i) => { expr.push(b, stops[Math.min(i + 1, stops.length - 1)]); });
    return ["case", valid, expr, blank];
}

// ─── BIVARIATE PAINT ─────────────────────────────────────────────────────────
// Returns 2 tertile breakpoints (33rd & 66th percentile) so a values array can
// be split into 3 roughly-equal-count tiers.
function tertileBreaks(values) {
    if (!values || values.length < 3) return [0, 1];
    const sorted = [...values].sort((a, b) => a - b);
    const b1 = sorted[Math.floor(sorted.length / 3)];
    const b2 = sorted[Math.floor((sorted.length * 2) / 3)];
    return [b1, b2];
}

// Build a bivariate (3×3) paint expression that colors each feature by the
// combination of its A and B metric tertiles. Polygons missing data on either
// metric fall back to NO_DATA_COLOR.
//
// Returns { expr, breaksA, breaksB, palette } so the legend renderer can show
// the user the actual cutpoints used.
function bivariatePaintExpression(metricA, metricB, paletteKey, level) {
    const pal = BIVAR_PALETTES[paletteKey] || BIVAR_PALETTES.pinkblue;
    const colors = pal.colors;
    const valuesA = getValuesForLevel(level, metricA);
    const valuesB = getValuesForLevel(level, metricB);
    const [a1, a2] = tertileBreaks(valuesA);
    const [b1, b2] = tertileBreaks(valuesB);

    const colA = activeColumn(metricA, state.year, level);
    const colB = activeColumn(metricB, state.year, level);

    // tierA: 0 if < a1, 1 if < a2, else 2
    const tierA = ["step", ["to-number", ["get", colA]], 0, a1, 1, a2, 2];
    const tierB = ["step", ["to-number", ["get", colB]], 0, b1, 1, b2, 2];
    const idx = ["+", ["*", tierA, 3], tierB];

    const matchExpr = ["match", idx];
    for (let i = 0; i < 9; i++) matchExpr.push(i, colors[i]);
    matchExpr.push(colors[0]);  // fallback (should never hit since 0-8 cover all)

    const bothValid = ["all",
        ["==", ["typeof", ["get", colA]], "number"],
        ["==", ["typeof", ["get", colB]], "number"],
    ];
    const expr = ["case", bothValid, matchExpr, NO_DATA_COLOR];
    return { expr, breaksA: [a1, a2], breaksB: [b1, b2], palette: pal };
}

// Custom MapLibre control: a "reset to the whole Massachusetts view" home button,
// styled to match the native zoom/fullscreen controls. Flies to VIEWS.ma (defined
// later; resolved at click time) so it tracks the canonical statewide framing.
class HomeControl {
    onAdd(m) {
        this._map = m;
        const c = document.createElement("div");
        c.className = "maplibregl-ctrl maplibregl-ctrl-group";
        const b = document.createElement("button");
        b.type = "button";
        b.className = "maplibregl-ctrl-home";
        b.title = "Reset to the whole of Massachusetts";
        b.setAttribute("aria-label", "Reset map to the whole of Massachusetts");
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
            '<path d="M3 11l9-8 9 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M5 10v10h5v-6h4v6h5V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        b.addEventListener("click", () => {
            const v = (typeof VIEWS !== "undefined" && VIEWS.ma) ? VIEWS.ma : { center: [-71.7, 42.25], zoom: 7.6 };
            m.flyTo({ ...v, duration: 1000, essential: true });
            if (typeof setActiveView === "function") setActiveView("ma");
        });
        c.appendChild(b);
        this._container = c;
        return c;
    }
    onRemove() { if (this._container) this._container.remove(); this._map = undefined; }
}

// On-map shortcut to the charts explorer. "Explore charts" is otherwise buried at
// the bottom of the (collapsed-by-default) "Compare, Select & Highlight" panel
// section, so a persistent map control makes this flagship feature reachable
// without digging. Click mirrors the panel button (whole-state scope).
class ChartsControl {
    onAdd(m) {
        this._map = m;
        const c = document.createElement("div");
        c.className = "maplibregl-ctrl maplibregl-ctrl-group";
        const b = document.createElement("button");
        b.type = "button";
        b.className = "maplibregl-ctrl-charts";
        b.title = "Explore charts — distributions, scatter & rankings";
        b.setAttribute("aria-label", "Explore charts");
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
            '<path d="M2 20h20M6 20v-6M12 20v-10M18 20v-14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        b.addEventListener("click", () => {
            state.graphScope = "all";
            if (typeof openGraphModal === "function") openGraphModal();
        });
        c.appendChild(b);
        this._container = c;
        return c;
    }
    onRemove() { if (this._container) this._container.remove(); this._map = undefined; }
}

// ─── MAP INITIALIZATION ──────────────────────────────────────────────────────
// Smooth choropleth color cross-fade when the metric/year changes (applied via
// the fill layers' paint transitions). Off for users who prefer reduced motion.
const PREFERS_REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const FILL_XFADE_MS = PREFERS_REDUCED_MOTION ? 0 : 260;
const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [-71.7, 42.25],   // Statewide opening view
    zoom: 7.6,
    minZoom: 6,
    maxZoom: 18,
    attributionControl: false,
    preserveDrawingBuffer: true,  // required for PNG export via toDataURL()
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new ChartsControl(), "top-right");   // flagship charts entry — just below zoom
// Standard map controls users expect, stacked under the zoom buttons (top-right):
// jump back to the whole-state view, locate themselves, and go fullscreen.
map.addControl(new HomeControl(), "top-right");
map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    // trackUserLocation makes the control a TOGGLE: click to show your location
    // (the blue dot), click the now-active button again to turn it off and remove
    // the dot. With it false there was no way to clear the dot once placed.
    trackUserLocation: true,
    showUserLocation: true,
}), "top-right");
// Fullscreen the whole app shell (#main-content / .maps-main), not just the map
// canvas. Without { container }, FullscreenControl fullscreens the map element
// alone — which hides the control panel, legend, and modals, since they're
// siblings of #map, not descendants. Targeting their shared ancestor keeps the
// entire UI visible and interactive in fullscreen.
map.addControl(
    new maplibregl.FullscreenControl({ container: document.getElementById("main-content") }),
    "top-right"
);
// Entering/leaving fullscreen changes the popover's containing block, so close the
// metric picker on the transition (it re-portals to the right target on reopen)
// and let the map re-fit its new size.
document.addEventListener("fullscreenchange", () => {
    closeMetricPicker();
    map.resize();
});
// Scale bar floats bottom-left, just right of the panel. The credit is a
// always-visible pill centered along the bottom edge (see #mapCredit in the
// HTML) rather than MapLibre's collapsible attribution button.
map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: "imperial" }), "bottom-left");

map.on("load", async () => {
    try {
        const [academic, munis, maSchools, acs, distAcs, distEdu,
               distDisc, distOutcomes, acsExtra, distAcsExtra, schoolMetrics,
               distPostsec, distEL, distEducator, distFinance, acsExtra2, distAcsExtra2,
               distSped, distAdvanced, distMcasGrades, distSupport, acsExtra3, distAcsExtra3,
               distEarlyEd, distCte, distDiscDetail, acsExtra4, distAcsExtra4,
               distGrowth, distMcasLevels, distChoice, distAccount, acsExtra5, distAcsExtra5,
               distMcasGrades2, distRetention, distGradDetail, distEducator2, acsExtra6, distAcsExtra6,
               distMcasG10Sci, distDiscGroups, distClassSize, distFinanceDetail, acsExtra7, distAcsExtra7,
               distAbsenceGroups, distMcasGroups, distApDetail, acsExtra8, distAcsExtra8,
               maColleges, muniChildcare, muniChildcareExtra] = await Promise.all([
            fetch(SOURCES.academic).then(r => r.json()),
            fetch(SOURCES.municipalities).then(r => r.json()),
            fetch(SOURCES.maSchools).then(r => r.json()).catch(() => ({ type: "FeatureCollection", features: [] })),
            fetch(SOURCES.muniAcs).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcs).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtEduExtra).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtDiscipline).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtOutcomes).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.schoolMetrics).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtPostsec).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtEL).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtEducator).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtFinance).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra2).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra2).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtSped).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAdvanced).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtMcasGrades).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtSupport).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra3).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra3).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtEarlyEd).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtCte).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtDiscDetail).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra4).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra4).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtGrowth).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtMcasLevels).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtChoice).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAccountability).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra5).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra5).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtMcasGrades2).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtRetention).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtGradDetail).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtEducator2).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra6).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra6).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtMcasG10Sci).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtDiscGroups).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtClassSize).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtFinanceDetail).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra7).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra7).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAbsenceGroups).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtMcasGroups).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtApDetail).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniAcsExtra8).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.districtAcsExtra8).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.maColleges).then(r => r.json()).catch(() => ({ type: "FeatureCollection", features: [] })),
            fetch(SOURCES.muniChildcare).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(SOURCES.muniChildcareExtra).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        // Compute area + population density for each municipality, and merge
        // optional ACS basics if data/ma_muni_acs.json was loaded.
        enrichMunicipalities(munis, acs);
        enrichMunicipalities(munis, acsExtra);
        enrichMunicipalities(munis, muniChildcare);   // child-care seats per child under 5 (EEC + ACS)
        enrichMunicipalities(munis, muniChildcareExtra); // child-care: infant/toddler, subsidy, Head Start, C3 (EEC)
        enrichAcademicDistricts(academic, distAcs);
        // Merge attendance / chronic-absent / teacher columns sourced from DESE
        // open data (data/ma_district_edu_extra.json), keyed by DIST_CODE.
        enrichAcademicDistricts(academic, distEdu);
        // Merge the new DESE / ACS district extras (discipline, SAT/class-size/
        // mobility, and ACS home-value/commute/age/broadband/owner-occupied).
        enrichAcademicDistricts(academic, distDisc);
        enrichAcademicDistricts(academic, distOutcomes);
        enrichAcademicDistricts(academic, distAcsExtra);
        // Round 1 additions: actual postsecondary outcomes, EL progress, educator
        // salary/licensure, school finance, and ACS round 2 (muni + district).
        enrichAcademicDistricts(academic, distPostsec);
        enrichAcademicDistricts(academic, distEL);
        enrichAcademicDistricts(academic, distEducator);
        enrichAcademicDistricts(academic, distFinance);
        enrichAcademicDistricts(academic, distAcsExtra2);
        enrichMunicipalities(munis, acsExtra2);
        // Round 2 additions: special-ed placement, advanced coursework, grade-level
        // MCAS, support-staff ratios, and ACS round 3 (muni + district).
        enrichAcademicDistricts(academic, distSped);
        enrichAcademicDistricts(academic, distAdvanced);
        enrichAcademicDistricts(academic, distMcasGrades);
        enrichAcademicDistricts(academic, distSupport);
        enrichAcademicDistricts(academic, distAcsExtra3);
        enrichMunicipalities(munis, acsExtra3);
        // Round 3 additions: early education, CTE, discipline detail, ACS round 4.
        enrichAcademicDistricts(academic, distEarlyEd);
        enrichAcademicDistricts(academic, distCte);
        enrichAcademicDistricts(academic, distDiscDetail);
        enrichAcademicDistricts(academic, distAcsExtra4);
        enrichMunicipalities(munis, acsExtra4);
        // Round 4 additions: MCAS growth (SGP), achievement-level tails, enrollment
        // flow (choice/charter), district accountability, and ACS round 5.
        enrichAcademicDistricts(academic, distGrowth);
        enrichAcademicDistricts(academic, distMcasLevels);
        enrichAcademicDistricts(academic, distChoice);
        enrichAcademicDistricts(academic, distAccount);
        enrichAcademicDistricts(academic, distAcsExtra5);
        enrichMunicipalities(munis, acsExtra5);
        // Round 5 additions: MCAS grades 5-7, grade retention, graduation cohort
        // detail, educator diversity/principal retention, and ACS round 6.
        enrichAcademicDistricts(academic, distMcasGrades2);
        enrichAcademicDistricts(academic, distRetention);
        enrichAcademicDistricts(academic, distGradDetail);
        enrichAcademicDistricts(academic, distEducator2);
        enrichAcademicDistricts(academic, distAcsExtra6);
        enrichMunicipalities(munis, acsExtra6);
        // Round 6 additions: MCAS Gr10 levels + science, discipline by subgroup,
        // class size by subject, per-pupil spending categories, and ACS round 7.
        enrichAcademicDistricts(academic, distMcasG10Sci);
        enrichAcademicDistricts(academic, distDiscGroups);
        enrichAcademicDistricts(academic, distClassSize);
        enrichAcademicDistricts(academic, distFinanceDetail);
        enrichAcademicDistricts(academic, distAcsExtra7);
        enrichMunicipalities(munis, acsExtra7);
        // Round 7 additions: chronic absence by subgroup, MCAS Gr3-8 by subgroup,
        // AP exam detail, and ACS round 8.
        enrichAcademicDistricts(academic, distAbsenceGroups);
        enrichAcademicDistricts(academic, distMcasGroups);
        enrichAcademicDistricts(academic, distApDetail);
        enrichAcademicDistricts(academic, distAcsExtra8);
        enrichMunicipalities(munis, acsExtra8);
        // ── Parallel-session district side-files ─────────────────────────────
        // Each Sx session appends its SOURCES key(s) on the line UNDER its own
        // load-anchor, so concurrent PRs never touch the same line. Every file is
        // shaped {DIST_CODE:{col:val}} and merges generically here. See AGENTS.md.
        const EXTRA_DISTRICT_SOURCES = [
            // ── load:S1:accountability ──
            "districtAcctDetail",
            // ── load:S2:vocational ──
            "districtCteDetail",
            // ── load:S3:sped ──
            "districtSpedDetail",
            // ── load:S4:el ──
            "districtElDetail",
            // ── load:S5:progression ──
            "districtProgression",
            // ── load:S6:mcas-completeness ──
            "districtMcasGrades3", "districtMcasGroups2",
            // ── load:S7:subgroup-outcomes ──
            "districtPostsecDetail",
            // ── load:S8:workforce ──
            "districtEducator3",
            // ── load:S10:gender ──
            "districtGender",
            // ── load:S11:funding-revenue ──
            "districtFinanceRevenue",
            // ── load:finance-categories (per-pupil PD / other teaching) ──
            "districtFinanceCategories",
            // ── load:transport-spending (per-pupil transportation + food, DESE cnfs-edqq ÷ FTE) ──
            "districtTransport",
            // ── load:dropout-annual (single-year grades 9-12 dropout rate, DESE cmm7-ttbg; ≠ cohort dropout_pct) ──
            "districtDropoutAnnual",
            // ── load:S12:school-choice-landscape ──
            "districtChoiceInflow", "districtPrivate",
            // ── load:S13:climate-safety ──
            "districtClimateSafety",
            // ── load:S14:whole-child-facilities ──
            "districtWholeChild",
            // Underserved subgroups (feat/underserved-subgroups)
            "districtMcasGroupsOther",
            // ── load:earnings-outcomes (post-grad earnings + employment, DESE 9vfm-6vxq) ──
            "districtEarnings",
            // Early college + HS-graduate outcomes (feat/early-college-outcomes)
            "districtEarlyCollege", "districtGradOutcomes",
            // ── load:feat/sped-assessment ──
            "districtSpedDynamics",
            // ── load:teacher-workforce ──
            "districtTeacherWorkforce",
            // ── load:crdc-federal (federal CRDC 2020-21 athletics, US ED/OCR via Urban API) ──
            "districtCrdc",
            // ── load:seda-national (Stanford SEDA v6.0 national benchmark) ──
            "districtSeda",
            // ── load:crdc-equity (federal CRDC 2017-18 gifted access + school policing, US ED/OCR via Urban API) ──
            "districtCrdcEquity",
            // ── load:seda-gaps (Stanford SEDA v6.0 national-scale achievement gaps) ──
            "districtSedaGaps",
            // ── load:crdc-courses (federal CRDC 2017-18 course access: HS offers Calculus/Physics/Chemistry/Algebra II, US ED/OCR via Urban API) ──
            "districtCrdcCourses",
            "districtMobility",
            // ── load:childcare-deep-dive (infant/toddler, subsidy, Head Start, C3 — muni→district) ──
            "districtChildcare",
            // ── load:composite-indices (z-score blends of existing metrics; bake via scripts/bake_composites.py) ──
            "districtComposites",
        ];
        (await Promise.all(EXTRA_DISTRICT_SOURCES.map(k =>
            fetch(SOURCES[k]).then(r => r.ok ? r.json() : null).catch(() => null)
        ))).forEach(d => { if (d) enrichAcademicDistricts(academic, d); });
        // Derived (computed in-app, no fetch): diversity index, enrollment
        // trends, and equity gaps — must run after all the enrich() inputs.
        computeDerivedMetrics(academic);
        // Merge per-school metrics onto the schools point layer, keyed by SCHID.
        enrichSchools(maSchools, schoolMetrics);
        SCHOOLS_FC = maSchools;   // global handle for school comparison stats + scatter cloud
        // Private schools (NCES PSS) — an independent REFERENCE layer, fetched
        // separately (small + optional). Falls back to an empty collection on any
        // error so a missing file never blocks the rest of the map.
        const privateSchools = await fetch(SOURCES.maPrivateSchools)
            .then(r => r.ok ? r.json() : { type: "FeatureCollection", features: [] })
            .catch(() => ({ type: "FeatureCollection", features: [] }));
        state.hasAcs = Boolean(acs && Object.keys(acs).length)
                   && Boolean(distAcs && Object.keys(distAcs).length);

        GEO_DATA = { district: academic, muni: munis };
        // Flag districts with no high school (no 9–12 program). Drives the distinct
        // "no high school here" choropleth color + legend row on HS-outcome metrics,
        // so those blanks read as "doesn't apply" not "missing data". Same HS-signal
        // test as blankReason() — keep the two in sync.
        for (const f of academic.features) {
            const pr = f.properties;
            pr._nohs = !HS_SIGNALS.some(k => pr[k] != null && isFinite(+pr[k]));
        }
        buildYearKeyedIndex();
        buildGroupKeyedIndex();

        // Sub-collections of CCUV (charter / voc-tech overlays) are lazy-loaded
        // on first toggle — see ensureCcuvLayers(). They default off, so this
        // keeps ~1MB off the initial critical path.

        // generateId: true assigns a numeric feature ID so setFeatureState works
        map.addSource("districts",      { type: "geojson", data: academic,  generateId: true });
        map.addSource("municipalities", { type: "geojson", data: munis,     generateId: true });
        // Precomputed interior label anchors — one point per polygon piece — so
        // town/district NAME labels are placed once per piece, not once per
        // internal tile the polygon spans (fixes "LYNN LYNN LYNN" duplication).
        map.addSource("district-label-pts", { type: "geojson", data: buildLabelPoints(academic, p => p.dist_display || p.DIST_NAME) });
        map.addSource("muni-label-pts",     { type: "geojson", data: buildLabelPoints(munis,    p => p.town_display || p.TOWN) });
        map.addSource("ma-schools",     { type: "geojson", data: maSchools, generateId: true });
        map.addSource("ma-private-schools", { type: "geojson", data: privateSchools, generateId: true });
        map.addSource("ma-colleges",    { type: "geojson", data: maColleges, generateId: true });

        // Capture the basemap's own layer IDs *before* we add our data layers,
        // so the "white / blank base" toggle can hide just the streets/labels
        // without touching our choropleth + reference layers.
        BASEMAP_LAYER_IDS = map.getStyle().layers.map(l => l.id);

        // Cap the basemap's own place labels so they hand off to ours instead of
        // doubling names (see syncBasemapLabelCap). Re-run when the district-label
        // toggle flips. Survives basemap visibility toggles (zoom range persists).
        syncBasemapLabelCap();

        addLayers();
        wireUI();
        // Apply the default basemap now (lightgray) — the raster bases load hidden
        // and Positron's vector layers load visible, so without this the map would
        // open on streets regardless of state.basemap.
        applyBasemap(state.basemap);
        populatePlaceList(munis, academic, maSchools, maColleges);
        updateMetricGating();   // gate year slider + group filter on first paint
        applyChoropleth();
        updateLegend();
        // Re-render the guided questions now that district data is loaded, so the
        // coverage guard (districtCoverage) can prune any sparse-data question.
        renderStartQuestions();
        document.getElementById("mapLoading").classList.add("hidden");
    } catch (err) {
        console.error("Map load failed:", err);
        document.getElementById("mapLoading").innerHTML =
            "<div>Sorry — the map data couldn't load. Please refresh the page, or try again in a moment.</div>";
    }
});

// Lazy-load the charter / voc-tech overlay source (ma_districts_metrics.geojson,
// ~1MB) and its four layers only when the user first toggles one of those
// reference layers on. They default off, so this keeps ~1MB off the initial
// critical path. Idempotent and concurrency-safe.
let _ccuvLoaded = false;
let _ccuvLoading = null;
function ensureCcuvLayers() {
    if (_ccuvLoaded) return Promise.resolve();
    if (_ccuvLoading) return _ccuvLoading;
    _ccuvLoading = fetch(SOURCES.ccuv).then(r => r.json()).then(ccuv => {
        const sub = type => ({
            type: "FeatureCollection",
            features: ccuv.features.filter(f => f.properties.TYPE === type),
        });
        if (!map.getSource("ccuv-voctech"))
            map.addSource("ccuv-voctech", { type: "geojson", data: sub("Vocational"), generateId: true });
        if (!map.getSource("ccuv-charter"))
            map.addSource("ccuv-charter", { type: "geojson", data: sub("Charter"), generateId: true });
        // Insert beneath the town labels so labels stay on top.
        const before = map.getLayer("town-labels") ? "town-labels" : undefined;
        const add = cfg => { if (!map.getLayer(cfg.id)) map.addLayer(cfg, before); };
        add({ id: "voctech-fill", type: "fill", source: "ccuv-voctech",
              paint: { "fill-color": "#6a1b9a", "fill-opacity": 0.08 }, layout: { visibility: "none" } });
        add({ id: "voctech-outline", type: "line", source: "ccuv-voctech",
              paint: { "line-color": "#6a1b9a", "line-width": 1.8, "line-opacity": 0.85, "line-dasharray": [4, 2] },
              layout: { visibility: "none" } });
        add({ id: "charter-fill", type: "fill", source: "ccuv-charter",
              paint: { "fill-color": "#00897B", "fill-opacity": 0.08 }, layout: { visibility: "none" } });
        add({ id: "charter-outline", type: "line", source: "ccuv-charter",
              paint: { "line-color": "#00695C", "line-width": 1.3, "line-opacity": 0.85, "line-dasharray": [1, 2] },
              layout: { visibility: "none" } });
        // Education Collaboratives + Superintendency Unions share this file but
        // have no metrics, so they render as a dashed outline + a name label
        // only. Labels go ON TOP (added without `before`) so the region name
        // stays legible when toggled on.
        if (!map.getSource("ccuv-collab"))
            map.addSource("ccuv-collab", { type: "geojson", data: sub("Collaborative"), generateId: true });
        if (!map.getSource("ccuv-union"))
            map.addSource("ccuv-union", { type: "geojson", data: sub("Superintendency Union"), generateId: true });
        add({ id: "collab-outline", type: "line", source: "ccuv-collab",
              paint: { "line-color": "#C2185B", "line-width": 1.6, "line-opacity": 0.85, "line-dasharray": [2, 2] },
              layout: { visibility: "none" } });
        add({ id: "union-outline", type: "line", source: "ccuv-union",
              paint: { "line-color": "#5D4037", "line-width": 1.6, "line-opacity": 0.85, "line-dasharray": [6, 3] },
              layout: { visibility: "none" } });
        const addLabel = cfg => { if (!map.getLayer(cfg.id)) map.addLayer(cfg); };
        const labelLayout = () => ({
            "text-field": ["coalesce", ["get", "NAME"], ["get", "DIST_NAME"]],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 11, 13],
            "text-letter-spacing": 0.02,
            visibility: "none",
        });
        addLabel({ id: "collab-label", type: "symbol", source: "ccuv-collab",
                   layout: labelLayout(),
                   paint: { "text-color": "#AD1457", "text-halo-color": "#ffffff", "text-halo-width": 1.4 } });
        addLabel({ id: "union-label", type: "symbol", source: "ccuv-union",
                   layout: labelLayout(),
                   paint: { "text-color": "#4E342E", "text-halo-color": "#ffffff", "text-halo-width": 1.4 } });
        _ccuvLoaded = true;
    }).catch(err => {
        console.error("Failed to load charter/voc-tech overlay:", err);
        _ccuvLoading = null;   // allow a retry on the next toggle
    });
    return _ccuvLoading;
}

// Lazy-load the municipality time-series (the year-keyed columns split out of
// ma_municipalities.geojson, ~2MB) the first time the user enters muni level.
// The default district view never needs it, so this keeps ~3.3MB off the
// initial load. On arrival it merges the columns back onto the muni features,
// pushes them to the live source, and rebuilds the muni year index from the
// union of all towns' columns. Idempotent and concurrency-safe.
let _muniTsLoaded = false;
let _muniTsLoading = null;
function ensureMuniTimeseries() {
    if (_muniTsLoaded) return Promise.resolve();
    if (_muniTsLoading) return _muniTsLoading;
    _muniTsLoading = fetch(SOURCES.muniTimeseries).then(r => r.ok ? r.json() : null).then(ts => {
        if (!ts || !GEO_DATA || !GEO_DATA.muni) { _muniTsLoaded = true; return; }
        GEO_DATA.muni.features.forEach(f => {
            const row = ts[String(f.properties.TOWN_ID)];
            if (row) Object.assign(f.properties, row);
        });
        // Rebuild the muni year index from the union of all towns' columns —
        // a single feature may be missing some (nulls were dropped on split).
        const idx = {};
        for (const tid in ts) {
            for (const col in ts[tid]) {
                const m = col.match(/^(.+)__(\d{4})$/);
                if (m) { if (!idx[m[1]]) idx[m[1]] = new Set(); idx[m[1]].add(parseInt(m[2], 10)); }
            }
        }
        YEAR_KEYED_INDEX.muni = idx;
        const src = map.getSource("municipalities");
        if (src) src.setData(GEO_DATA.muni);
        _valuesCache = { key: null, values: null };   // drop stale (pre-merge) values
        _muniTsLoaded = true;
    }).catch(err => {
        console.error("Failed to load municipality time-series:", err);
        _muniTsLoading = null;   // allow a retry on next entry
    });
    return _muniTsLoading;
}

// ─── NON-OPERATING ("no district") TOWNS ─────────────────────────────────────
// Seven MA towns belong to no academic-district polygon, so at district level
// they'd render as blank "holes." Four are genuine non-operating "tuition towns"
// (too small to run schools — residents attend neighboring districts via tuition
// agreements or the state School Choice program); three are members of a regional
// district whose dissolved geometry isn't in our districts source yet (a data
// gap). We shade all seven with a neutral gray + dashed outline so they read as
// "explained," not "missing." Single source of truth: the keys drive the map
// filter; the values drive the click-popup note.
// Towns with NO operating, contiguous academic district on the map. Now EMPTY:
// every MA town is covered by a district polygon (the ~28 rural "orphan" towns the
// upstream dissolve dropped are folded into their real districts by
// scripts/cover_orphan_towns.py — including Monroe, MA's tiny split-district town,
// merged into Florida, its contiguous K-8 elementary district). The overlay
// machinery below is kept so a town can be re-listed here if a future data gap
// ever reopens a hole — list a town ONLY while it genuinely has no district under
// it, else the grey overlay paints over a real, colored district.
const NONOP_TOWNS = {};
const NONOP_TOWN_NAMES = Object.keys(NONOP_TOWNS);

// Body for the non-operating-town click popup — tuition towns get the generic
// "doesn't operate schools" note; regional-member towns name their district.
function nonOpNoteHtml(name) {
    const info = NONOP_TOWNS[name] || { type: "tuition" };
    const body = info.type === "regional"
        ? `Member of <strong>${info.district}</strong> — not yet in our district geometry (data gap).`
        : `This town doesn't operate its own schools; residents attend neighboring districts via tuition agreements or school choice.`;
    return `<div class="popup-title">${name}</div>`
        + `<div class="nonop-popup-tag">No operating district</div>`
        + `<div class="nonop-popup-body">${body}</div>`;
}

// Keep the non-operating-town overlay (+ its legend entry) in sync with the
// current view. Only visible at DISTRICT level — at muni level these towns are
// individually colored — and only when the reference toggle is on.
function updateNonOpLayer() {
    const has = NONOP_TOWN_NAMES.length > 0;
    const show = state.level === "district" && state.showNonOpTowns && has;
    ["nonop-fill", "nonop-outline"].forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    });
    const legEl = document.getElementById("legendNonOp");
    if (legEl) legEl.hidden = !show;
    // The "No-district towns" reference toggle is only meaningful when such towns
    // exist. They currently all map to a district (0 holes), so hide the row; it
    // re-appears with a live count if a future data gap ever re-lists a town in
    // NONOP_TOWNS.
    const rowEl = document.getElementById("ref-nonop-row");
    if (rowEl) rowEl.hidden = !has;
    const nameEl = document.getElementById("ref-nonop-name");
    if (nameEl && has) nameEl.textContent = `No-district towns (${NONOP_TOWN_NAMES.length})`;
}

// Drive the "Highlight a group" overlay from state.highlightGroup. One group at a
// time, district-level only (the groups are district concepts; the picker row
// hides at muni level). Sets a filter on the districts-source highlight layers:
//   gateway / regional   -> baked is_gateway / is_regional flags
//   nohs                 -> the _nohs flag baked at load
//   top10 / bottom10     -> >= 90th / <= 10th percentile of the ACTIVE metric,
//                           so it re-computes whenever the metric or year changes.
function applyHighlightGroup() {
    const rowEl = document.getElementById("highlight-group-row");
    const districtLevel = state.level === "district";
    if (rowEl) rowEl.style.display = districtLevel ? "" : "none";

    const g = state.highlightGroup;
    let filter = null;
    if (districtLevel && g && g !== "none") {
        if (g === "gateway")        filter = ["==", ["get", "is_gateway"], true];
        else if (g === "regional")  filter = ["==", ["get", "is_regional"], true];
        else if (g === "nohs")      filter = ["==", ["get", "_nohs"], true];
        else if (g === "stateflag") filter = ["==", ["get", "is_state_flagged"], true];
        else if (g === "top10" || g === "bottom10") {
            const vals = getValuesForLevel(state.level, state.metric);
            if (vals.length >= 10) {
                const sorted = [...vals].sort((a, b) => a - b);
                const col = activeColumn();
                const hasNum = ["==", ["typeof", ["get", col]], "number"];
                if (g === "top10") {
                    const thr = sorted[Math.floor(sorted.length * 0.9)];
                    filter = ["all", hasNum, [">=", ["to-number", ["get", col]], thr]];
                } else {
                    const thr = sorted[Math.max(0, Math.ceil(sorted.length * 0.1) - 1)];
                    filter = ["all", hasNum, ["<=", ["to-number", ["get", col]], thr]];
                }
            }
        }
    }
    const show = Boolean(filter);
    ["highlight-fill", "highlight-line"].forEach(id => {
        if (!map.getLayer(id)) return;
        if (filter) map.setFilter(id, filter);
        map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    });
}

// All-MA-schools symbology: one source of truth for the circle layer (below)
// and the sidebar legend/filter chips, so dot colors and the legend stay in
// sync. enrichSchools() has already merged the per-school metrics onto each
// feature's properties (sch_enrollment, sch_accountability_pctile, ...).
const SCHOOL_LEVELS = [
    { key: "elementary", label: "Elementary", color: "#1976D2", types: ["Public Elementary"] },
    { key: "middle",     label: "Middle",     color: "#F57C00", types: ["Public Middle"] },
    { key: "high",       label: "High",       color: "#C62828", types: ["Public Secondary"] },
    { key: "voc",        label: "Voc/Tech",   color: "#6a1b9a", types: ["Public Voc/Tech/Ag Reg'l HS"] },
    { key: "charter",    label: "Charter",    color: "#00897B", types: ["Charter"] },
    { key: "other",      label: "Other",      color: "#455A64", types: ["Public Other", "Public Unknown"] },
];
// circle-color when coloring by school level (matches the legend swatches).
const SCHOOL_COLOR_BY_LEVEL = [
    "match", ["get", "TYPE_DESC"],
    "Charter",                     "#00897B",
    "Public Voc/Tech/Ag Reg'l HS", "#6a1b9a",
    "Public Elementary",           "#1976D2",
    "Public Middle",               "#F57C00",
    "Public Secondary",            "#C62828",
    "#455A64",
];
// circle-color when coloring by accountability percentile (1-99); null -> grey.
const SCHOOL_COLOR_BY_ACCT = [
    "case",
    ["==", ["coalesce", ["get", "sch_accountability_pctile"], -1], -1], "#b8c2cc",
    [
        "interpolate", ["linear"],
        ["to-number", ["coalesce", ["get", "sch_accountability_pctile"], 0]],
        1, "#d73027", 25, "#fc8d59", 50, "#fee08b", 75, "#91cf60", 99, "#1a9850",
    ],
];
// circle-radius grows with BOTH zoom and enrollment (bigger school -> bigger
// dot); schools with no enrollment fall back to a small-medium dot.
const SCHOOL_RADIUS = [
    "interpolate", ["linear"], ["zoom"],
    8,  ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 1.2, 300, 2,   1200, 3.5, 3000, 5],
    11, ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 2,   300, 3.5, 1200, 6,   3000, 9],
    14, ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 3,   300, 5,   1200, 8.5, 3000, 13],
];

// Pick-ring radius = SCHOOL_RADIUS + 3.5 px at every zoom/enrollment stop. The
// +3.5 is folded into each inner output stop instead of wrapping SCHOOL_RADIUS in
// ["+", …, 3.5]: that wrapper nests SCHOOL_RADIUS's zoom interpolate, which
// MapLibre rejects ("zoom expression may only be used as input to a top-level
// step/interpolate"). Keep these stops in sync with SCHOOL_RADIUS (each = +3.5).
const SCHOOL_PICK_RING_RADIUS = [
    "interpolate", ["linear"], ["zoom"],
    8,  ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 4.7, 300, 5.5, 1200, 7,    3000, 8.5],
    11, ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 5.5, 300, 7,   1200, 9.5,  3000, 12.5],
    14, ["interpolate", ["linear"], ["coalesce", ["get", "sch_enrollment"], 250], 0, 6.5, 300, 8.5, 1200, 12,   3000, 16.5],
];

// Proportional-symbol radius for the district/town ENROLLMENT overlay (circles
// on top of the rate choropleth, to counter area-bias). Area ∝ enrollment ⇒
// radius ∝ sqrt(enrollment); grows with zoom, with a floor so small districts
// stay visible. enroll runs ~50–55,000 (Boston).
const PROP_RADIUS = [
    "interpolate", ["linear"], ["zoom"],
    7,  ["max", 1.5, ["*", 0.09, ["sqrt", ["to-number", ["get", "enroll"]]]]],
    9,  ["max", 2,   ["*", 0.16, ["sqrt", ["to-number", ["get", "enroll"]]]]],
    12, ["max", 3,   ["*", 0.38, ["sqrt", ["to-number", ["get", "enroll"]]]]],
];

// Sync the level-filter chips to the schools circle layer (chips double as the
// legend). All checked -> no filter; otherwise show only the checked levels.
function applySchoolLevelFilter() {
    if (!map.getLayer("ma-schools-circles")) return;
    const boxes = document.querySelectorAll("#school-chips input[type=checkbox][data-level]");
    if (!boxes.length) return;
    const allowed = [];
    let allOn = true;
    boxes.forEach(b => {
        const lvl = SCHOOL_LEVELS.find(l => l.key === b.dataset.level);
        if (!lvl) return;
        if (b.checked) allowed.push(...lvl.types);
        else allOn = false;
    });
    // Combine the level-chip filter with the DESE status filter (Recognition /
    // needs-assistance) — both must hold, so AND them into one expression.
    const parts = [];
    if (!allOn) parts.push(["in", ["get", "TYPE_DESC"], ["literal", allowed]]);
    if (state.schoolStatus === "recognition") parts.push(["==", ["get", "is_school_recognition"], true]);
    else if (state.schoolStatus === "needs")  parts.push(["==", ["get", "is_school_needs_assistance"], true]);
    const filter = parts.length === 0 ? null : (parts.length === 1 ? parts[0] : ["all", ...parts]);
    map.setFilter("ma-schools-circles", filter);
    // Keep the name labels in lock-step with the dots (same filter), so hiding
    // e.g. "Elementary" or non-Recognition schools hides both dots and labels.
    if (map.getLayer("school-labels")) map.setFilter("school-labels", filter);
}

// Public/private filter. Shows/hides the public (ma-schools-circles) and private
// (ma-private-schools-circles) point layers from the two Sector chips, all gated
// on the master "MA schools (points)" toggle being on. Public defaults on, the
// private reference dots default off. Also reveals the reference-only caveat note
// whenever private dots are visible.
function applySchoolSectorFilter() {
    const master = document.getElementById("ref-all-ma-schools");
    const masterOn = master ? master.checked : false;
    const pub  = document.getElementById("school-sector-public");
    const priv = document.getElementById("school-sector-private");
    const showPub  = masterOn && (pub  ? pub.checked  : true);
    const showPriv = masterOn && (priv ? priv.checked : false);
    if (map.getLayer("ma-schools-circles"))
        map.setLayoutProperty("ma-schools-circles", "visibility", showPub ? "visible" : "none");
    // School-name labels (added in #38) ride with the public dots.
    if (map.getLayer("school-labels"))
        map.setLayoutProperty("school-labels", "visibility", showPub ? "visible" : "none");
    // The comparison-set pick ring rides with the public dots too, so picked
    // schools show their accent halo whenever the schools layer is on.
    if (map.getLayer("school-pick-ring"))
        map.setLayoutProperty("school-pick-ring", "visibility", showPub ? "visible" : "none");
    if (map.getLayer("ma-private-schools-circles"))
        map.setLayoutProperty("ma-private-schools-circles", "visibility", showPriv ? "visible" : "none");
    const note = document.getElementById("schools-private-note");
    if (note) note.hidden = !showPriv;
    state.showPrivateSchools = showPriv;
}
// Switch schools dot color between the level palette and the accountability ramp.
function setSchoolColorMode(mode) {
    if (!map.getLayer("ma-schools-circles")) return;
    map.setPaintProperty("ma-schools-circles", "circle-color",
        mode === "acct" ? SCHOOL_COLOR_BY_ACCT : SCHOOL_COLOR_BY_LEVEL);
    const grad = document.getElementById("schools-acct-legend");
    if (grad) grad.hidden = mode !== "acct";
    const chips = document.getElementById("school-chips");
    if (chips) chips.classList.toggle("by-acct", mode === "acct");
}

// Graduated-dot SIZE legend for the schools layer. Mirrors SCHOOL_RADIUS so the
// key dots match the on-map dots at the current zoom (recomputed on zoom). Fill
// is a neutral grey — this key is about size, not the level/accountability color.
const SCHOOL_SIZE_LEGEND_ENROLLMENTS = [250, 1000, 2500];
function schoolDotRadius(enrollment, zoom) {
    // enrollment -> radius at one zoom anchor's stop table (piecewise-linear, clamped)
    const atAnchor = stops => {
        if (enrollment <= stops[0][0]) return stops[0][1];
        for (let i = 1; i < stops.length; i++) {
            if (enrollment <= stops[i][0]) {
                const [x0, y0] = stops[i - 1], [x1, y1] = stops[i];
                return y0 + (y1 - y0) * (enrollment - x0) / (x1 - x0);
            }
        }
        return stops[stops.length - 1][1];
    };
    // The three zoom anchors below mirror SCHOOL_RADIUS exactly.
    const r8  = atAnchor([[0, 1.2], [300, 2],   [1200, 3.5], [3000, 5]]);
    const r11 = atAnchor([[0, 2],   [300, 3.5], [1200, 6],   [3000, 9]]);
    const r14 = atAnchor([[0, 3],   [300, 5],   [1200, 8.5], [3000, 13]]);
    if (zoom <= 8)  return r8;
    if (zoom <= 11) return r8  + (r11 - r8)  * (zoom - 8)  / 3;
    if (zoom <= 14) return r11 + (r14 - r11) * (zoom - 11) / 3;
    return r14;
}
function renderSchoolsSizeLegend() {
    const el = document.getElementById("schools-size-legend");
    if (!el || !map.getLayer("ma-schools-circles")) return;
    if (!el.childElementCount) {
        el.innerHTML = SCHOOL_SIZE_LEGEND_ENROLLMENTS.map(e =>
            `<span class="ssl-item"><span class="ssl-dot-wrap"><span class="ssl-dot"></span></span>` +
            `<span class="ssl-label">${e.toLocaleString()}</span></span>`
        ).join("");
    }
    const z = map.getZoom();
    const dias = SCHOOL_SIZE_LEGEND_ENROLLMENTS.map(e => Math.max(4, Math.round(schoolDotRadius(e, z) * 2)));
    el.style.setProperty("--ssl-h", Math.max(...dias) + "px");
    el.querySelectorAll(".ssl-dot").forEach((dot, i) => {
        dot.style.width = dias[i] + "px";
        dot.style.height = dias[i] + "px";
    });
}

// ── MA COLLEGES (IPEDS) reference layer ──────────────────────────────────────
// Mirrors the schools layer: located dots sized by enrollment and colored by
// sector, with sector + level filter chips and a graduated-dot size legend.
// Data is the self-contained data/ma_colleges.geojson (see
// scripts/fetch_ipeds_colleges.py); no per-feature enrichment is needed.
// Reference-only — there is no student-flow / outcomes visualization here.
const COLLEGE_SECTORS = [
    { key: "public",             label: "Public",            color: "#2E7D32" },
    { key: "private nonprofit",  label: "Private nonprofit", color: "#5E35B1" },
    { key: "private for-profit", label: "For-profit",        color: "#EF6C00" },
];
// circle-color by sector (matches the chip swatches); unknown -> grey.
const COLLEGE_COLOR_BY_SECTOR = [
    "match", ["get", "sector"],
    "public",             "#2E7D32",
    "private nonprofit",  "#5E35B1",
    "private for-profit", "#EF6C00",
    "#607D8B",
];
// circle-radius grows with BOTH zoom and enrollment, like SCHOOL_RADIUS, but the
// enrollment stops span the college range (~18 .. ~46,000). Colleges with no
// reported enrollment (rare) fall back to a small-medium dot.
//
// The zoom interpolate MUST be the single top-level expression — MapLibre rejects
// a second zoom-based subexpression in the same property — so the satellite vs
// main-campus split is branched per zoom stop, not via two separate zoom interps.
// Branch/satellite campuses are hand-placed with no campus-level enrollment, so
// they take a fixed modest size (3 / 4.5 / 6 px across zoom, not enrollment-
// scaled), paired with the hollow fill below ("hollow dot = reference/secondary").
const COLLEGE_RADIUS = [
    "interpolate", ["linear"], ["zoom"],
    8,  ["case", ["==", ["get", "is_satellite"], true], 3,
         ["interpolate", ["linear"], ["coalesce", ["get", "enrollment"], 1000], 0, 1.5, 1000, 2.5, 5000, 4,   20000, 6,    45000, 7.5]],
    11, ["case", ["==", ["get", "is_satellite"], true], 4.5,
         ["interpolate", ["linear"], ["coalesce", ["get", "enrollment"], 1000], 0, 2.5, 1000, 4,   5000, 6.5, 20000, 10,   45000, 12]],
    14, ["case", ["==", ["get", "is_satellite"], true], 6,
         ["interpolate", ["linear"], ["coalesce", ["get", "enrollment"], 1000], 0, 3.5, 1000, 5.5, 5000, 9,   20000, 13.5, 45000, 16]],
];

// Filter the colleges layer to the checked SECTOR and LEVEL chips (intersection).
// Each chip dimension contributes an ["in", value, [literal]] test; unchecking
// every chip in a dimension yields an empty list, which hides all dots — the
// intuitive result of an empty selection.
function applyCollegeFilter() {
    if (!map.getLayer("ma-colleges-circles")) return;
    const values = attr => Array.from(
        document.querySelectorAll(`#colleges-controls input[type=checkbox][${attr}]:checked`)
    ).map(b => b.getAttribute(attr));
    map.setFilter("ma-colleges-circles", [
        "all",
        ["in", ["get", "sector"], ["literal", values("data-sector")]],
        ["in", ["get", "level"],  ["literal", values("data-level")]],
    ]);
}

// Quick-filter presets for the colleges layer. "community" isolates public
// 2-year institutions (Massachusetts' 15 community colleges); "all" restores
// every chip. Both just set the existing sector/level chips, then re-filter —
// note IPEDS plots one dot per institution at its MAIN campus, so e.g. North
// Shore Community College shows in Danvers, not at its Lynn satellite.
function setCollegePreset(preset) {
    const sectors = document.querySelectorAll("#college-sector-chips input[data-sector]");
    const levels = document.querySelectorAll("#college-level-chips input[data-level]");
    if (preset === "community") {
        sectors.forEach(b => { b.checked = b.getAttribute("data-sector") === "public"; });
        levels.forEach(b => { b.checked = b.getAttribute("data-level") === "2-year"; });
    } else {   // "all"
        sectors.forEach(b => { b.checked = true; });
        levels.forEach(b => { b.checked = true; });
    }
    applyCollegeFilter();
}

// Graduated-dot SIZE legend for the colleges layer. Mirrors COLLEGE_RADIUS so
// the key dots match the on-map dots at the current zoom (recomputed on zoom).
// Fill is a neutral grey — this key is about size (enrollment), not sector color.
const COLLEGE_SIZE_LEGEND_ENROLLMENTS = [1000, 5000, 20000];
function collegeDotRadius(enrollment, zoom) {
    // enrollment -> radius at one zoom anchor's stop table (piecewise-linear, clamped)
    const atAnchor = stops => {
        if (enrollment <= stops[0][0]) return stops[0][1];
        for (let i = 1; i < stops.length; i++) {
            if (enrollment <= stops[i][0]) {
                const [x0, y0] = stops[i - 1], [x1, y1] = stops[i];
                return y0 + (y1 - y0) * (enrollment - x0) / (x1 - x0);
            }
        }
        return stops[stops.length - 1][1];
    };
    // The three zoom anchors below mirror COLLEGE_RADIUS exactly.
    const r8  = atAnchor([[0, 1.5], [1000, 2.5], [5000, 4],   [20000, 6],    [45000, 7.5]]);
    const r11 = atAnchor([[0, 2.5], [1000, 4],   [5000, 6.5], [20000, 10],   [45000, 12]]);
    const r14 = atAnchor([[0, 3.5], [1000, 5.5], [5000, 9],   [20000, 13.5], [45000, 16]]);
    if (zoom <= 8)  return r8;
    if (zoom <= 11) return r8  + (r11 - r8)  * (zoom - 8)  / 3;
    if (zoom <= 14) return r11 + (r14 - r11) * (zoom - 11) / 3;
    return r14;
}
function renderCollegesSizeLegend() {
    const el = document.getElementById("colleges-size-legend");
    if (!el || !map.getLayer("ma-colleges-circles")) return;
    if (!el.childElementCount) {
        el.innerHTML = COLLEGE_SIZE_LEGEND_ENROLLMENTS.map(e =>
            `<span class="ssl-item"><span class="ssl-dot-wrap"><span class="ssl-dot"></span></span>` +
            `<span class="ssl-label">${e.toLocaleString()}</span></span>`
        ).join("");
    }
    const z = map.getZoom();
    const dias = COLLEGE_SIZE_LEGEND_ENROLLMENTS.map(e => Math.max(4, Math.round(collegeDotRadius(e, z) * 2)));
    el.style.setProperty("--ssl-h", Math.max(...dias) + "px");
    el.querySelectorAll(".ssl-dot").forEach((dot, i) => {
        dot.style.width = dias[i] + "px";
        dot.style.height = dias[i] + "px";
    });
}

// ── MA CHILD CARE CENTERS (EEC) + C3 GRANT SCRUTINY ──────────────────────────
// Lazy-loaded dots for every licensed child-care CENTER (data/ma_childcare.geojson,
// ~0.8MB — see scripts/fetch_childcare.py). In-home Family Child Care is excluded
// (those are individuals at home addresses). Two color modes: a neutral "capacity"
// view, and a "C3 grant per seat" view that ramps each center by the public
// Commonwealth Cares for Children grant dollars it drew per licensed seat and
// rings the statistical outliers. The grant view is an OVERSIGHT/TRIAGE aid — an
// outlier is a prompt to look, NOT evidence of wrongdoing (C3 is capacity/cost-
// based; no public data exposes a program's enrollment or billing). Off by
// default; ~0.8MB source fetched only on first toggle (ensureChildcareLayer).
const CHILDCARE_BASE_COLOR = "#C2185B";   // neutral "capacity" color mode
// "C3 grant per seat" ramp: grey when no grant on record, else green→amber→red as
// $/seat climbs. Stops track the FY2026 center distribution (median ~1,500,
// Q3 ~2,450, IQR fence ~4,800 — see the fetcher's printed stats).
const CHILDCARE_COLOR_BY_C3 = [
    "case",
    ["==", ["coalesce", ["get", "c3_per_seat"], -1], -1], "#b8c2cc",
    [
        "interpolate", ["linear"], ["to-number", ["coalesce", ["get", "c3_per_seat"], 0]],
        500, "#1a9850", 1500, "#91cf60", 2500, "#fee08b", 3500, "#fc8d59", 4800, "#d73027",
    ],
];
// circle-radius grows with zoom + licensed capacity (centers run ~3..468 seats,
// median ~54). Centers with no capacity fall back to a small-medium dot.
const CHILDCARE_RADIUS = [
    "interpolate", ["linear"], ["zoom"],
    7,  ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 30], 0, 1.6, 30, 2.6, 80, 3.6, 150, 4.8, 470, 7],
    11, ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 30], 0, 2.4, 30, 3.8, 80, 5.2, 150, 7.5, 470, 10],
    14, ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 30], 0, 3.4, 30, 5,   80, 7,   150, 10,  470, 14],
];

// C3 $/seat outlier threshold (IQR upper fence), computed from the loaded data so
// it tracks refreshes; used to ring outliers in the grant view.
let _childcareC3Fence = Infinity;
function computeC3Fence(features) {
    const vals = features.map(f => f.properties && f.properties.c3_per_seat)
        .filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
    if (vals.length < 8) return Infinity;
    const q = p => vals[Math.floor(vals.length * p)];
    const q1 = q(0.25), q3 = q(0.75);
    return q3 + 1.5 * (q3 - q1);
}

// Switch the centers layer between the neutral capacity view and the C3 grant
// ramp. In grant mode the centers above the IQR fence get a heavy navy ring so the
// handful of statistical outliers stand out, and the grant legend is revealed.
function setChildcareColorMode(mode) {
    state.childcareColorMode = mode;
    const leg = document.getElementById("childcare-c3-legend");
    if (leg) leg.hidden = mode !== "c3";
    if (!map.getLayer("ma-childcare-circles")) return;
    const grant = mode === "c3";
    const isOutlier = [">", ["coalesce", ["get", "c3_per_seat"], 0], _childcareC3Fence];
    const hover = ["boolean", ["feature-state", "hover"], false];
    map.setPaintProperty("ma-childcare-circles", "circle-color",
        grant ? CHILDCARE_COLOR_BY_C3 : CHILDCARE_BASE_COLOR);
    map.setPaintProperty("ma-childcare-circles", "circle-stroke-color",
        grant ? ["case", isOutlier, "#0A1F44", hover, "#0A1F44", "#ffffff"]
              : ["case", hover, "#0A1F44", "#ffffff"]);
    map.setPaintProperty("ma-childcare-circles", "circle-stroke-width",
        grant ? ["case", isOutlier, 2.6, hover, 2, 0.7]
              : ["case", hover, 2, 0.7]);
}

// Graduated-dot SIZE legend for the childcare layer (size = licensed capacity).
// Mirrors the colleges size legend; recomputed on zoom so the key matches the map.
const CHILDCARE_SIZE_LEGEND_CAPS = [30, 100, 250];
function childcareDotRadius(cap, zoom) {
    const atAnchor = stops => {
        if (cap <= stops[0][0]) return stops[0][1];
        for (let i = 1; i < stops.length; i++) {
            if (cap <= stops[i][0]) {
                const [x0, y0] = stops[i - 1], [x1, y1] = stops[i];
                return y0 + (y1 - y0) * (cap - x0) / (x1 - x0);
            }
        }
        return stops[stops.length - 1][1];
    };
    const r7  = atAnchor([[0, 1.6], [30, 2.6], [80, 3.6], [150, 4.8], [470, 7]]);
    const r11 = atAnchor([[0, 2.4], [30, 3.8], [80, 5.2], [150, 7.5], [470, 10]]);
    const r14 = atAnchor([[0, 3.4], [30, 5],   [80, 7],   [150, 10],  [470, 14]]);
    if (zoom <= 7)  return r7;
    if (zoom <= 11) return r7  + (r11 - r7)  * (zoom - 7)  / 4;
    if (zoom <= 14) return r11 + (r14 - r11) * (zoom - 11) / 3;
    return r14;
}
function renderChildcareSizeLegend() {
    const el = document.getElementById("childcare-size-legend");
    if (!el || !map.getLayer("ma-childcare-circles")) return;
    if (!el.childElementCount) {
        el.innerHTML = CHILDCARE_SIZE_LEGEND_CAPS.map(c =>
            `<span class="ssl-item"><span class="ssl-dot-wrap"><span class="ssl-dot"></span></span>` +
            `<span class="ssl-label">${c}</span></span>`
        ).join("");
    }
    const z = map.getZoom();
    const dias = CHILDCARE_SIZE_LEGEND_CAPS.map(c => Math.max(4, Math.round(childcareDotRadius(c, z) * 2)));
    el.style.setProperty("--ssl-h", Math.max(...dias) + "px");
    el.querySelectorAll(".ssl-dot").forEach((dot, i) => {
        dot.style.width = dias[i] + "px";
        dot.style.height = dias[i] + "px";
    });
}

// Popup for a child-care center. Reference-only directory facts + the public C3
// grant trajectory (FY24→26) and grant-per-seat. Statistical outliers get an
// explicit "prompt to review, not evidence of wrongdoing" caveat — the data can
// only surface unusual grant intensity, never prove misuse. Rows hide when empty.
function childcarePopupHtml(p) {
    const row = (label, value) => (value == null || value === "")
        ? "" : `<div class="popup-row"><span class="label">${label}</span><span class="value">${cmpEsc(value)}</span></div>`;
    const cap = p.capacity != null && p.capacity !== "" ? Math.round(+p.capacity).toLocaleString() : null;
    const usd = v => (v == null || v === "") ? null : `$${Math.round(+v).toLocaleString()}`;
    const yrs = [["FY24", p.c3_2024], ["FY25", p.c3_2025], ["FY26", p.c3_2026]].filter(y => y[1] != null);
    const trend = yrs.length ? yrs.map(y => `${y[0]} ${usd(y[1])}`).join("  ·  ") : null;
    const perSeat = p.c3_per_seat != null ? `${usd(p.c3_per_seat)} / licensed seat` : null;
    const flagged = p.c3_per_seat != null && p.c3_per_seat > _childcareC3Fence;
    return `
        <div class="popup-title">${cmpEsc(p.NAME)}</div>
        <div class="popup-note">Licensed child-care center — reference only (no DESE outcomes).</div>
        <div class="popup-row"><span class="label">Type</span><span class="value">Center-based care</span></div>
        ${row("Ages served", p.ages)}
        ${row("Licensed capacity", cap)}
        ${row("Town", p.CITY)}
        ${row("Head Start", p.head_start ? "Yes" : null)}
        ${row("Accepts subsidy", p.subsidy ? "Yes (voucher / contract)" : null)}
        ${trend ? `<div class="popup-row"><span class="label">C3 grant</span><span class="value">${cmpEsc(trend)}</span></div>` : ""}
        ${row("C3 per seat", perSeat)}
        ${flagged ? `<div class="popup-note popup-note--flag">Grant per seat is a statistical outlier — a prompt to review, not evidence of wrongdoing.</div>` : ""}
        <div class="popup-source">Sources: MA EEC licensing + C3 grants (oversight reference)</div>`;
}

// Lazy-load the childcare source (~0.8MB) and its circle layer only when the
// user first toggles the layer on. Idempotent + concurrency-safe (mirrors
// ensureCcuvLayers). Click/hover handlers are registered once, here.
let _childcareLoaded = false;
let _childcareLoading = null;
function ensureChildcareLayer() {
    if (_childcareLoaded) return Promise.resolve();
    if (_childcareLoading) return _childcareLoading;
    _childcareLoading = fetch(SOURCES.maChildcare).then(r => r.json()).then(cc => {
        _childcareC3Fence = computeC3Fence(cc.features || []);
        if (!map.getSource("ma-childcare"))
            map.addSource("ma-childcare", { type: "geojson", data: cc, generateId: true });
        if (!map.getLayer("ma-childcare-circles")) {
            map.addLayer({
                id: "ma-childcare-circles", type: "circle", source: "ma-childcare",
                paint: {
                    "circle-radius": CHILDCARE_RADIUS,
                    "circle-color": CHILDCARE_BASE_COLOR,
                    "circle-stroke-color": ["case", ["boolean", ["feature-state", "hover"], false], "#0A1F44", "#ffffff"],
                    "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2, 0.7],
                    "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.82],
                },
                layout: { visibility: "none" },
                minzoom: 7,
            });
            // Click → reference popup.
            map.on("click", "ma-childcare-circles", e => {
                if (!e.features.length) return;
                new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
                    .setLngLat(e.lngLat)
                    .setHTML(childcarePopupHtml(e.features[0].properties))
                    .addTo(map);
            });
            // Hover: pointer cursor + navy ring via feature-state (generateId ids).
            let _ccHoverId = null;
            const clearCcHover = () => {
                if (_ccHoverId !== null && map.getSource("ma-childcare"))
                    map.setFeatureState({ source: "ma-childcare", id: _ccHoverId }, { hover: false });
                _ccHoverId = null;
            };
            map.on("mousemove", "ma-childcare-circles", e => {
                map.getCanvas().style.cursor = "pointer";
                if (!e.features.length) return;
                if (_ccHoverId !== e.features[0].id) clearCcHover();
                _ccHoverId = e.features[0].id;
                map.setFeatureState({ source: "ma-childcare", id: _ccHoverId }, { hover: true });
            });
            map.on("mouseleave", "ma-childcare-circles", () => {
                map.getCanvas().style.cursor = "";
                clearCcHover();
            });
        }
        setChildcareColorMode(state.childcareColorMode || "capacity");
        _childcareLoaded = true;
    }).catch(err => {
        console.error("Failed to load childcare layer:", err);
        _childcareLoading = null;   // allow a retry on the next toggle
    });
    return _childcareLoading;
}

// Register two canvas-drawn textures for the blank states (no static sprite, no
// build step): a faint 45° hatch for generic "no data" and a dot grid for "no
// high school". Both tile seamlessly. fill-pattern is data-driven but ignores
// feature-state — fine, blank-ness isn't hover-dependent.
function addNoDataPatterns() {
    const make = draw => {
        const N = 8, c = document.createElement("canvas"); c.width = c.height = N;
        const ctx = c.getContext("2d"); draw(ctx, N);
        return ctx.getImageData(0, 0, N, N);
    };
    if (!map.hasImage("tex-hatch")) {
        map.addImage("tex-hatch", make((ctx, N) => {
            ctx.strokeStyle = "rgba(70,70,70,0.40)"; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(N, N);
            ctx.moveTo(N / 2, 0); ctx.lineTo(N, N / 2);
            ctx.moveTo(0, N / 2); ctx.lineTo(N / 2, N);
            ctx.stroke();
        }));
    }
    if (!map.hasImage("tex-dots")) {
        map.addImage("tex-dots", make((ctx, N) => {
            ctx.fillStyle = "rgba(70,80,100,0.50)";
            ctx.beginPath(); ctx.arc(N / 2, N / 2, 1.3, 0, 2 * Math.PI); ctx.fill();
        }));
    }
}

function addLayers() {
    // ── RASTER BASEMAPS ──────────────────────────────────────────────────────
    // Satellite + dark tiles added as raster layers that sit ABOVE the Positron
    // vector basemap but BELOW our choropleth (nothing of ours has been added
    // yet, so they land on top of Positron's layers). Hidden by default; the
    // basemap switch toggles their visibility. Added here (after
    // BASEMAP_LAYER_IDS was captured) so the white-base toggle never touches
    // them. Keyless public tile sources.
    if (!map.getSource("sat-tiles")) {
        map.addSource("sat-tiles", {
            type: "raster", tileSize: 256,
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
        });
    }
    if (!map.getSource("dark-tiles")) {
        map.addSource("dark-tiles", {
            type: "raster", tileSize: 256,
            tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            attribution: "© OpenStreetMap contributors, © CARTO",
        });
    }
    // Muted light-gray base WITHOUT labels (CARTO light_nolabels, keyless) — the
    // textbook "make the choropleth pop" backdrop: just enough geography (coast,
    // major roads) while our own labels and the data colors carry the map.
    if (!map.getSource("lightgray-tiles")) {
        map.addSource("lightgray-tiles", {
            type: "raster", tileSize: 256,
            tiles: [
                "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
            ],
            attribution: "© OpenStreetMap contributors, © CARTO",
        });
    }
    // Esri boundaries + place-names reference, shown ONLY over satellite imagery
    // so bare aerial isn't disorienting (which blob is my town?). Keyless legacy
    // MapServer, same provider as the imagery.
    if (!map.getSource("sat-ref-tiles")) {
        map.addSource("sat-ref-tiles", {
            type: "raster", tileSize: 256,
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
            attribution: "Labels © Esri",
        });
    }
    map.addLayer({ id: "sat-base",       type: "raster", source: "sat-tiles",       layout: { visibility: "none" } });
    map.addLayer({ id: "dark-base",      type: "raster", source: "dark-tiles",      layout: { visibility: "none" } });
    map.addLayer({ id: "lightgray-base", type: "raster", source: "lightgray-tiles", layout: { visibility: "none" } });
    // sat-ref sits ABOVE the imagery but below the choropleth (added next).
    map.addLayer({ id: "sat-ref",        type: "raster", source: "sat-ref-tiles",   layout: { visibility: "none" } });

    // ── CHOROPLETH LAYERS (one visible at a time based on state.level) ───────
    // Use feature-state for hover highlights without re-styling
    map.addLayer({
        id: "muni-fill", type: "fill", source: "municipalities",
        paint: {
            "fill-color": NO_DATA_COLOR,
            "fill-color-transition": { duration: FILL_XFADE_MS, delay: 0 },
            "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false], 0.92,
                0.78
            ],
            "fill-opacity-transition": { duration: FILL_XFADE_MS, delay: 0 },
        },
        layout: { visibility: state.level === "muni" ? "visible" : "none" },
    });
    map.addLayer({
        id: "district-fill", type: "fill", source: "districts",
        paint: {
            "fill-color": NO_DATA_COLOR,
            "fill-color-transition": { duration: FILL_XFADE_MS, delay: 0 },
            "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false], 0.92,
                0.78
            ],
            "fill-opacity-transition": { duration: FILL_XFADE_MS, delay: 0 },
        },
        layout: { visibility: state.level === "district" ? "visible" : "none" },
    });

    // ── PROPORTIONAL ENROLLMENT CIRCLES — translucent bubbles sized by student
    // count, drawn over the rate choropleth so "how many students this affects"
    // reads at a glance (a deep-red 200-kid district vs. deep-red Boston). Off by
    // default; the centroid point source is (re)built per repaint in
    // refreshPropCircles().
    map.addSource("prop-circles", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
        id: "prop-circles", type: "circle", source: "prop-circles",
        layout: { visibility: "none" },
        paint: {
            "circle-radius": PROP_RADIUS,
            "circle-color": "#0A1F44",
            "circle-opacity": 0.16,
            "circle-stroke-color": "#0A1F44",
            "circle-stroke-width": 1,
            "circle-stroke-opacity": 0.7,
        },
    });

    // Per-source hover-outline layers — each invisible by default, only the
    // hovered feature gets gold edges. Cheaper than re-adding the layer on
    // every mousemove.
    ["municipalities", "districts"].forEach(src => {
        // White casing under the gold ring so hover stays legible over dark
        // palette stops (Viridis/Inferno darks) where a bare gold line vanishes.
        map.addLayer({
            id: `hover-casing-${src}`, type: "line", source: src,
            paint: {
                "line-color": "#ffffff",
                "line-width": 6,
                "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0],
            },
        });
        const cfg = {
            id: `hover-outline-${src}`, type: "line", source: src,
            paint: {
                "line-color": "#FFB81C",
                "line-width": 3.5,
                "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
            },
        };
        map.addLayer(cfg);
    });

    // Texture overlays for the blank states — a faint hatch over generic "no
    // data" and dots over "no high school" K-8 districts, so blanks read as "not
    // applicable" (and survive grayscale / PNG export) instead of a low value.
    // Filtered + toggled alongside the no-data outline in applyChoropleth().
    addNoDataPatterns();
    ["municipalities", "districts"].forEach(src => {
        map.addLayer({
            id: `nodata-texture-${src}`, type: "fill", source: src,
            paint: {
                "fill-pattern": ["case", ["==", ["coalesce", ["get", "_nohs"], false], true], "tex-dots", "tex-hatch"],
                "fill-opacity": 0.9,
            },
            filter: ["==", "x", "y"],
            layout: { visibility: "none" },
        });
    });

    // No-data outline — a distinct dashed hairline on polygons whose active
    // metric is missing, so blank (cream) cells read as "no data" rather than a
    // low value. The filter is set to the active column in applyChoropleth().
    ["municipalities", "districts"].forEach(src => {
        map.addLayer({
            id: `nodata-outline-${src}`, type: "line", source: src,
            paint: {
                "line-color": "#9b8e77",
                "line-width": 0.9,
                "line-dasharray": [2, 2],
                "line-opacity": 0.85,
            },
            filter: ["==", "x", "y"],   // matches nothing until applyChoropleth() sets it
            layout: { visibility: "none" },
        });
    });

    // Persistent selected-feature outline — the clicked polygon keeps a navy
    // ring (via feature-state "selected") so you don't lose your place once the
    // cursor moves off it.
    ["municipalities", "districts"].forEach(src => {
        map.addLayer({
            id: `selected-outline-${src}`, type: "line", source: src,
            paint: {
                "line-color": "#0A1F44",
                "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 0],
                "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0],
            },
        });
    });

    // Multi-pick comparison rings — every member of the comparison set gets a
    // DISTINCT accent ring (a white casing under an accent line) via feature-state
    // { picked:true, pickIdx:i }, so up to 8 places stay legible on any choropleth
    // and for colorblind users. The accent color is chosen per slot from
    // PICK_COLORS by matching pickIdx — the SAME color the member gets in the
    // comparison table and the charts. Added after selected-outline so picks draw
    // above the single-selection ring. PICK_COLOR_EXPR is reused for schools too.
    PICK_COLOR_EXPR = ["match", ["to-number", ["coalesce", ["feature-state", "pickIdx"], 0]]];
    PICK_COLORS.forEach((c, i) => PICK_COLOR_EXPR.push(i, c));
    PICK_COLOR_EXPR.push(PICK_COLORS[0]);   // fallback (never hit; pickIdx is 0..7)
    ["municipalities", "districts"].forEach(src => {
        map.addLayer({
            id: `pick-casing-${src}`, type: "line", source: src,
            paint: {
                "line-color": "#ffffff",
                "line-width": ["case", ["boolean", ["feature-state", "picked"], false], 7, 0],
                "line-opacity": ["case", ["boolean", ["feature-state", "picked"], false], 1, 0],
            },
        });
        map.addLayer({
            id: `pick-outline-${src}`, type: "line", source: src,
            paint: {
                "line-color": PICK_COLOR_EXPR,
                "line-width": ["case", ["boolean", ["feature-state", "picked"], false], 4, 0],
                "line-opacity": ["case", ["boolean", ["feature-state", "picked"], false], 1, 0],
            },
        });
    });

    // ── ALWAYS-ON REFERENCE BORDERS ──────────────────────────────────────────
    // Municipality borders
    map.addLayer({
        id: "muni-outline", type: "line", source: "municipalities",
        paint: {
            "line-color": "#78909c",
            "line-width": [
                "interpolate", ["linear"], ["zoom"],
                7, 0.35,
                10, 0.7,
                12, 1.0,
            ],
            "line-opacity": 0.75,
        },
    });
    // Academic district borders (dissolved town boundaries — ~250 districts)
    map.addLayer({
        id: "academic-outline", type: "line", source: "districts",
        paint: {
            "line-color": "#1a3a6b",
            "line-width": [
                "interpolate", ["linear"], ["zoom"],
                7, 0.6,
                10, 0.9,
                12, 1.2,
            ],
            "line-opacity": 0.7,
        },
        layout: { visibility: state.showAcademicOutline ? "visible" : "none" },
    });

    // Regional voc-tech + charter OVERLAYS are lazy-added by ensureCcuvLayers()
    // on first toggle (they default off), so their ~1MB source stays off the
    // initial load.

    // ── HIGHLIGHT A GROUP (purple fill+outline over a subset of districts) ────
    // Driven by the sidebar "Highlight a group" picker via applyHighlightGroup():
    // one group at a time (Gateway, Regional, K-8/no-HS, Top/Bottom decile of the
    // active metric). District-level only. Starts hidden; the picker sets a filter.
    map.addLayer({
        id: "highlight-fill", type: "fill", source: "districts",
        paint: { "fill-color": "#9C27B0", "fill-opacity": 0.18 },
        layout: { visibility: "none" },
    });
    map.addLayer({
        id: "highlight-line", type: "line", source: "districts",
        paint: { "line-color": "#6a1b9a", "line-width": 2.2, "line-opacity": 0.95 },
        layout: { visibility: "none" },
    });

    // ── NON-OPERATING ("no district") TOWNS ──────────────────────────────────
    // Any towns with no academic-district polygon (currently none): a neutral gray
    // fill + dashed outline so the district-level map shows them as "explained,"
    // not as blank holes. Filtered from the municipalities source by town_display.
    // Visible only at district level (see updateNonOpLayer); added below town-labels
    // so town names still render on top. `in` (not match) so an empty NONOP_TOWN_NAMES
    // is a valid "matches nothing" filter rather than an illegal empty match.
    const nonOpFilter = ["in", ["get", "town_display"], ["literal", NONOP_TOWN_NAMES]];
    const nonOpVisible = state.level === "district" && state.showNonOpTowns && NONOP_TOWN_NAMES.length > 0;
    map.addLayer({
        id: "nonop-fill", type: "fill", source: "municipalities",
        filter: nonOpFilter,
        paint: { "fill-color": "#9aa1ad", "fill-opacity": 0.5 },
        layout: { visibility: nonOpVisible ? "visible" : "none" },
    });
    map.addLayer({
        id: "nonop-outline", type: "line", source: "municipalities",
        filter: nonOpFilter,
        paint: {
            "line-color": "#4b5563",
            "line-width": 1.6,
            "line-dasharray": [3, 2],
            "line-opacity": 0.9,
        },
        layout: { visibility: nonOpVisible ? "visible" : "none" },
    });

    // ── STATEWIDE TOWN LABELS (driven by municipalities source) ──────────────
    map.addLayer({
        id: "town-labels", type: "symbol", source: "muni-label-pts",
        layout: {
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"],
            // Tier 2 of the label hierarchy (district > town > school). minzoom
            // raised 10 -> 11 so the busy 10-12 band shows district names only;
            // town names join one zoom step later. Wider padding spaces them out.
            "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 13, 12, 16, 13.5],
            "text-letter-spacing": 0.05,
            "text-max-width": 8,
            "text-padding": 4,
            "text-allow-overlap": false,
            "visibility": state.townLabels ? "visible" : "none",
        },
        paint: {
            "text-color": "#0A1F44",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.8,
        },
        minzoom: 11,
    });

    // District name labels — one per academic district, placed at the polygon
    // centroid. Off by default (town labels are on); toggled independently.
    // Slightly bolder/darker than town labels so the two layers stay
    // distinguishable when both are on.
    map.addLayer({
        id: "district-labels", type: "symbol", source: "district-label-pts",
        layout: {
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"],
            // Tier 1 (highest priority): regional district names. Largest type +
            // widest tracking + biggest halo. Stays ABOVE town-labels in the layer
            // stack, so it wins collisions (MapLibre places top-of-stack first).
            "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14.5, 16, 16],
            "text-letter-spacing": 0.05,
            "text-max-width": 8,
            "text-allow-overlap": false,
            "text-padding": 6,
            "visibility": state.districtLabels ? "visible" : "none",
        },
        paint: {
            "text-color": "#3E2723",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.2,
        },
        minzoom: 8,
    });

    // ── VALUE LABELS — the active metric's NUMBER on each polygon (off by
    // default). text-field is set per repaint in applyChoropleth(); bigger
    // polygons win collisions via a symbol-sort-key on area, and a zoom floor
    // keeps the statewide view from becoming a wall of numbers.
    [["municipalities", "muni-value-labels", 10], ["districts", "district-value-labels", 8.5]].forEach(([src, id, mz]) => {
        map.addLayer({
            id, type: "symbol", source: src,
            minzoom: mz,
            layout: {
                "text-field": "",
                "text-font": ["Noto Sans Bold"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 13, 16, 15],
                "text-allow-overlap": false,
                "text-padding": 2,
                "symbol-sort-key": ["-", 0, ["coalesce", ["to-number", ["get", "_area_sqmi"]], 0]],
                "visibility": "none",
            },
            paint: {
                "text-color": "#15233b",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.8,
            },
        });
    });

    // ── ALL MA PUBLIC SCHOOLS (~1700) — toggleable, small markers ────────────
    map.addLayer({
        id: "ma-schools-circles", type: "circle", source: "ma-schools",
        paint: {
            "circle-radius": SCHOOL_RADIUS,
            "circle-color": [
                "match", ["get", "TYPE_DESC"],
                "Charter",                       "#00897B",
                "Public Voc/Tech/Ag Reg'l HS",   "#6a1b9a",
                "Public Elementary",             "#1976D2",
                "Public Middle",                 "#F57C00",
                "Public Secondary",              "#C62828",
                "#455A64",
            ],
            // navy ring + full opacity on hover for clear point feedback
            "circle-stroke-color": ["case", ["boolean", ["feature-state", "hover"], false], "#0A1F44", "#ffffff"],
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.2, 0.8],
            "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.85],
        },
        layout: { visibility: state.showAllMaSchools ? "visible" : "none" },
        minzoom: 7,
    });

    // Comparison-set ring for picked schools — a hollow accent halo drawn just
    // outside the dot (feature-state { picked, pickIdx }), the same accent color
    // as the place rings / table / charts. Deliberately UNFILTERED by level or
    // status so a picked school keeps its ring even when the chips would hide its
    // dot. Visibility tracks the schools master toggle (compare mode turns it on).
    map.addLayer({
        id: "school-pick-ring", type: "circle", source: "ma-schools",
        paint: {
            "circle-radius": SCHOOL_PICK_RING_RADIUS,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": PICK_COLOR_EXPR,
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "picked"], false], 2.6, 0],
            "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "picked"], false], 1, 0],
        },
        layout: { visibility: state.showAllMaSchools ? "visible" : "none" },
        minzoom: 7,
    });

    // ── SCHOOL NAME LABELS (Tier 3, lowest priority) ─────────────────────────
    // Names for the individual school dots. minzoom 13 so they appear only once
    // you've zoomed into a town — never carpeting the statewide view. Inserted
    // BELOW town-labels (the `before` arg) so town/district names win any
    // collision; among themselves, bigger schools are placed first via
    // symbol-sort-key. Visibility tracks the schools toggle (off by default).
    map.addLayer({
        id: "school-labels", type: "symbol", source: "ma-schools",
        layout: {
            "text-field": ["coalesce", ["get", "NAME"], ""],
            "text-font": ["Noto Sans Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 16, 12.5, 18, 14],
            "text-letter-spacing": 0.01,
            "text-max-width": 8,
            "text-padding": 2,
            "text-allow-overlap": false,
            "text-variable-anchor": ["top", "bottom", "left", "right"],
            "text-radial-offset": 0.7,
            "text-justify": "auto",
            "symbol-sort-key": ["-", 0, ["coalesce", ["get", "sch_enrollment"], 0]],
            "visibility": state.showAllMaSchools ? "visible" : "none",
        },
        paint: {
            "text-color": "#37474F",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.4,
            "text-halo-blur": 0.5,
        },
        minzoom: 13,
    }, map.getLayer("town-labels") ? "town-labels" : undefined);

    // ── MA PRIVATE SCHOOLS (NCES PSS, 507) — reference-only sibling layer ─────
    // Hollow slate dots, deliberately distinct from the colored/enrollment-sized
    // public dots: private schools carry NO DESE/MCAS data, so a neutral uniform
    // marker reads as "reference, not analytical." Inserted BENEATH the public
    // layer so the data-rich dots stay on top when both sectors are shown. Off
    // until the user enables the Private sector chip.
    map.addLayer({
        id: "ma-private-schools-circles", type: "circle", source: "ma-private-schools",
        paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2, 11, 3.2, 14, 5],
            "circle-color": "#ECEFF1",
            "circle-stroke-color": ["case", ["boolean", ["feature-state", "hover"], false], "#0A1F44", "#546E7A"],
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.2, 1.1],
            "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.9],
        },
        layout: { visibility: "none" },
        minzoom: 7,
    }, "ma-schools-circles");

    // ── ALL MA COLLEGES (IPEDS, ~110) — toggleable reference dots ─────────────
    map.addLayer({
        id: "ma-colleges-circles", type: "circle", source: "ma-colleges",
        paint: {
            // Branch/satellite campuses (is_satellite) render hollow + fixed-size;
            // main IPEDS campuses stay solid, sector-colored, enrollment-scaled.
            "circle-radius": COLLEGE_RADIUS,
            "circle-color": ["case", ["==", ["get", "is_satellite"], true], "#ffffff", COLLEGE_COLOR_BY_SECTOR],
            // navy ring on hover; otherwise sector-colored ring for satellites, white for main campuses
            "circle-stroke-color": [
                "case",
                ["boolean", ["feature-state", "hover"], false], "#0A1F44",
                ["==", ["get", "is_satellite"], true], COLLEGE_COLOR_BY_SECTOR,
                "#ffffff"
            ],
            "circle-stroke-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false], 2.2,
                ["==", ["get", "is_satellite"], true], 2,
                1
            ],
            "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.88],
        },
        layout: { visibility: state.showAllMaColleges ? "visible" : "none" },
        minzoom: 6,
    });

    // ── CLICK HANDLERS ───────────────────────────────────────────────────────
    map.on("click", "muni-fill",     e => showPopup(e, "muni"));
    map.on("click", "district-fill", e => showPopup(e, "district"));

    // ── HOVER HIGHLIGHT + TOOLTIP ────────────────────────────────────────────
    const sourceForLevel = { muni: "municipalities", district: "districts" };
    let hoverState = { source: null, id: null };

    function setHover(source, id) {
        if (hoverState.source && hoverState.id != null) {
            map.setFeatureState({ source: hoverState.source, id: hoverState.id }, { hover: false });
        }
        if (source && id != null) {
            map.setFeatureState({ source, id }, { hover: true });
        }
        hoverState = { source, id };
    }

    const tooltip = document.getElementById("mapTooltip");
    function showTooltip(e, feat) {
        const m = getMetric(state.metric);
        const v = feat.properties[activeColumn()];
        const hasVal = v != null && isFinite(+v);
        const name = feat.properties.town_display
            || feat.properties.TOWN
            || feat.properties.DIST_NAME
            || "Feature";
        const rk = (state.bivariate || !hasVal) ? null : rankInfo(state.level, state.metric, v);
        const standing = (rk && !changeActive(state.metric, state.level)) ? standingPhrase(state.metric, rk, "mid") : null;
        const rankHtml = rk
            ? `<div class="tooltip-rank">${standing || `Rank ${rk.rank} of ${rk.total} · ${rk.pctile}th percentile`}</div>`
            : "";
        // A no-data polygon must read as "No data" with a plain-language reason —
        // never a coerced $0 (+null === 0 would otherwise slip past fmt()), matching
        // the detail panel instead of contradicting it.
        const valueHtml = hasVal
            ? `<div class="tooltip-value">${m.label}: <strong>${fmt(+v, m.format)}</strong></div>`
            : `<div class="tooltip-value">${m.label}: <strong class="tooltip-nodata">No data</strong></div>`
              + `<div class="tooltip-nodata-reason">${blankReason(feat.properties, state.metric, m.format)}</div>`;
        tooltip.innerHTML = `
            <div class="tooltip-name">${name}</div>
            ${valueHtml}
            ${rankHtml}
        `;
        tooltip.style.display = "block";
        // Clamp to the map container so the tooltip never runs off-screen.
        const rect = map.getContainer().getBoundingClientRect();
        const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
        let x = e.point.x + 14, y = e.point.y + 14;
        if (x + tw > rect.width)  x = e.point.x - tw - 14;
        if (y + th > rect.height) y = e.point.y - th - 14;
        tooltip.style.left = Math.max(4, x) + "px";
        tooltip.style.top  = Math.max(4, y) + "px";
    }
    function hideTooltip() { tooltip.style.display = "none"; }

    ["muni-fill", "district-fill"].forEach(layerId => {
        const lvl = layerId.split("-")[0];
        const src = sourceForLevel[lvl];
        map.on("mousemove", layerId, e => {
            map.getCanvas().style.cursor = "pointer";
            if (!e.features.length) return;
            const feat = e.features[0];
            setHover(src, feat.id);
            showTooltip(e, feat);
        });
        map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
            setHover(null, null);
            hideTooltip();
        });
    });

    // MA-wide schools click → simple popup with school info. In compare mode
    // (school kind), a click instead toggles the school in/out of the set.
    map.on("click", "ma-schools-circles", e => {
        if (!e.features.length) return;
        const feat = e.features[0];
        if (state.compareMode && state.compareKind === "school") {
            toggleMember("school", "ma-schools", feat);
            return;
        }
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
            .setLngLat(e.lngLat)
            .setHTML(schoolPopupHtml(feat.properties))
            .addTo(map);
        // Wire the popup's "Add to comparison" button to this exact school.
        const el = popup.getElement();
        const btn = el && el.querySelector(".school-add-compare");
        if (btn) btn.addEventListener("click", () => {
            const key = memberKey("school", feat.properties);
            if (state.compareKind === "school" && inCompareSet(key)) {
                removeMember(key); renderComparison(); updateModeBar();
            } else {
                addSchoolToCompare(feat);
            }
            popup.remove();
        });
    });
    map.on("mouseenter", "ma-schools-circles", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "ma-schools-circles", () => map.getCanvas().style.cursor = "");

    // ── NON-OPERATING TOWNS: hover tooltip + click note ──────────────────────
    // These 7 towns are holes in the district layer, so clicks/hovers there land
    // on nonop-fill. Reuse the shared #mapTooltip for a one-line hover label and
    // open a small popup with the full explanation on click.
    const nonOpTip = document.getElementById("mapTooltip");
    map.on("mousemove", "nonop-fill", e => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features.length || !nonOpTip) return;
        const nm = e.features[0].properties.town_display || "This town";
        nonOpTip.innerHTML =
            `<div class="tooltip-name">${nm}</div>` +
            `<div class="tooltip-value">No operating district — click for details</div>`;
        nonOpTip.style.display = "block";
        const rect = map.getContainer().getBoundingClientRect();
        const tw = nonOpTip.offsetWidth, th = nonOpTip.offsetHeight;
        let x = e.point.x + 14, y = e.point.y + 14;
        if (x + tw > rect.width)  x = e.point.x - tw - 14;
        if (y + th > rect.height) y = e.point.y - th - 14;
        nonOpTip.style.left = Math.max(4, x) + "px";
        nonOpTip.style.top  = Math.max(4, y) + "px";
    });
    map.on("mouseleave", "nonop-fill", () => {
        map.getCanvas().style.cursor = "";
        if (nonOpTip) nonOpTip.style.display = "none";
    });
    map.on("click", "nonop-fill", e => {
        if (!e.features.length) return;
        const nm = e.features[0].properties.town_display || "This town";
        new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(nonOpNoteHtml(nm))
            .addTo(map);
    });

    // Hover: pointer cursor + a navy ring via feature-state (generateId gives ids).
    let _schoolHoverId = null;
    const clearSchoolHover = () => {
        if (_schoolHoverId !== null && map.getSource("ma-schools"))
            map.setFeatureState({ source: "ma-schools", id: _schoolHoverId }, { hover: false });
        _schoolHoverId = null;
    };
    map.on("mousemove", "ma-schools-circles", e => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features.length) return;
        if (_schoolHoverId !== e.features[0].id) clearSchoolHover();
        _schoolHoverId = e.features[0].id;
        map.setFeatureState({ source: "ma-schools", id: _schoolHoverId }, { hover: true });
    });
    map.on("mouseleave", "ma-schools-circles", () => {
        map.getCanvas().style.cursor = "";
        clearSchoolHover();
    });

    // Private schools: click → reference popup; hover → navy ring (own tracker).
    map.on("click", "ma-private-schools-circles", e => {
        if (!e.features.length) return;
        new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
            .setLngLat(e.lngLat)
            .setHTML(privateSchoolPopupHtml(e.features[0].properties))
            .addTo(map);
    });
    let _privHoverId = null;
    const clearPrivHover = () => {
        if (_privHoverId !== null && map.getSource("ma-private-schools"))
            map.setFeatureState({ source: "ma-private-schools", id: _privHoverId }, { hover: false });
        _privHoverId = null;
    };
    map.on("mousemove", "ma-private-schools-circles", e => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features.length) return;
        if (_privHoverId !== e.features[0].id) clearPrivHover();
        _privHoverId = e.features[0].id;
        map.setFeatureState({ source: "ma-private-schools", id: _privHoverId }, { hover: true });
    });
    map.on("mouseleave", "ma-private-schools-circles", () => {
        map.getCanvas().style.cursor = "";
        clearPrivHover();
    });

    // MA colleges click → simple popup with institution info (reference only).
    map.on("click", "ma-colleges-circles", e => {
        if (!e.features.length) return;
        new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
            .setLngLat(e.lngLat)
            .setHTML(collegePopupHtml(e.features[0].properties))
            .addTo(map);
    });
    // Hover: pointer cursor + a navy ring via feature-state (generateId gives ids).
    let _collegeHoverId = null;
    const clearCollegeHover = () => {
        if (_collegeHoverId !== null && map.getSource("ma-colleges"))
            map.setFeatureState({ source: "ma-colleges", id: _collegeHoverId }, { hover: false });
        _collegeHoverId = null;
    };
    map.on("mousemove", "ma-colleges-circles", e => {
        map.getCanvas().style.cursor = "pointer";
        if (!e.features.length) return;
        if (_collegeHoverId !== e.features[0].id) clearCollegeHover();
        _collegeHoverId = e.features[0].id;
        map.setFeatureState({ source: "ma-colleges", id: _collegeHoverId }, { hover: true });
    });
    map.on("mouseleave", "ma-colleges-circles", () => {
        map.getCanvas().style.cursor = "";
        clearCollegeHover();
    });
}

// Shared school popup body — used by the schools-layer click handler and the
// place-search "fly to a named school" path.
function schoolPopupHtml(p) {
    const row = (label, value) => value == null || value === ""
        ? "" : `<div class="popup-row"><span class="label">${label}</span><span class="value">${cmpEsc(value)}</span></div>`;
    const pctile = p.sch_accountability_pctile;
    const metricsHtml = [
        row("Enrollment", p.sch_enrollment != null ? Math.round(+p.sch_enrollment).toLocaleString() : null),
        row("MCAS Gr3-8 ELA % Meeting/Exceeding",  p.sch_mcas_ela_me  != null ? `${(+p.sch_mcas_ela_me  * 100).toFixed(0)}%` : null),
        row("MCAS Gr3-8 ELA — low-income",  p.sch_mcas_ela_low_income  != null ? `${(+p.sch_mcas_ela_low_income  * 100).toFixed(0)}%` : null),
        row("MCAS Gr3-8 Math % Meeting/Exceeding", p.sch_mcas_math_me != null ? `${(+p.sch_mcas_math_me * 100).toFixed(0)}%` : null),
        row("MCAS Gr3-8 Math — low-income", p.sch_mcas_math_low_income != null ? `${(+p.sch_mcas_math_low_income * 100).toFixed(0)}%` : null),
        row("MCAS Gr3-8 Science % Meeting/Exceeding", p.sch_mcas_sci_me != null ? `${(+p.sch_mcas_sci_me * 100).toFixed(0)}%` : null),
        row("MCAS Gr10 ELA % Meeting/Exceeding",   p.sch_mcas_g10_ela_me  != null ? `${(+p.sch_mcas_g10_ela_me  * 100).toFixed(0)}%` : null),
        row("MCAS Gr10 Math % Meeting/Exceeding",  p.sch_mcas_g10_math_me != null ? `${(+p.sch_mcas_g10_math_me * 100).toFixed(0)}%` : null),
        row("AP % scoring 3+",      p.sch_ap_pct_3plus            != null ? `${(+p.sch_ap_pct_3plus            * 100).toFixed(0)}%` : null),
        row("Accountability percentile", pctile != null ? `${Math.round(+pctile)} of 99` : null),
        row("Avg class size",       p.sch_class_size              != null ? `${(+p.sch_class_size).toFixed(1)}` : null),
        row("Students disciplined", p.sch_disciplined_pct         != null ? `${(+p.sch_disciplined_pct         * 100).toFixed(0)}%` : null),
        row("Chronic absenteeism",  p.sch_chronic_absent_pct      != null ? `${(+p.sch_chronic_absent_pct      * 100).toFixed(0)}%` : null),
        row("Experienced teachers", p.sch_teacher_experienced_pct != null ? `${(+p.sch_teacher_experienced_pct * 100).toFixed(0)}%` : null),
        row("4-yr graduation",      p.sch_grad_4yr                != null ? `${(+p.sch_grad_4yr                * 100).toFixed(0)}%` : null),
        row("Per-pupil spending",   p.sch_per_pupil               != null ? `$${Math.round(+p.sch_per_pupil).toLocaleString()}` : null),
    ].join("");
    return `
        <div class="popup-title">${cmpEsc(p.NAME)}</div>
        <div class="popup-row"><span class="label">Type</span><span class="value">${cmpEsc(p.TYPE_DESC || "—")}</span></div>
        <div class="popup-row"><span class="label">Grades</span><span class="value">${cmpEsc(p.GRADES || "—")}</span></div>
        <div class="popup-row"><span class="label">Town</span><span class="value">${cmpEsc(p.TOWN || "—")}</span></div>
        <div class="popup-row"><span class="label">District</span><span class="value">${cmpEsc(p.DIST_NAME || "—")}</span></div>
        ${metricsHtml}
        <button type="button" class="school-add-compare">${
            (state.compareMode && state.compareKind === "school" && inCompareSet(memberKey("school", p)))
                ? "✓ In comparison — remove" : "➕ Add to comparison"
        }</button>`;
}

// Add a school to the comparison set from its popup — switching the set to school
// kind (clearing any place set, after confirm) and entering compare mode.
function addSchoolToCompare(feat) {
    if (state.compareKind !== "school") setCompareKind("school");
    if (!state.compareMode) { state.compareMode = true; syncCompareToggle(true); }
    ensureSchoolsVisibleForCompare();
    addMember("school", "ma-schools", feat.id, feat.properties, null);
    hideFeaturePanel();
    openComparePanel();
    updateCompareKindUI();
    renderComparison();
    updateModeBar();
}

// Private-school popup. These come from the NCES Private School Survey and are
// REFERENCE-ONLY: private schools don't report to MA DESE, so there is
// deliberately NO MCAS / accountability / graduation block — only directory
// facts (affiliation, grade span, enrollment, address). The note + source line
// make the "no state metrics" caveat explicit so the UI never implies otherwise.
function privateSchoolPopupHtml(p) {
    const row = (label, value) => value == null || value === ""
        ? "" : `<div class="popup-row"><span class="label">${label}</span><span class="value">${cmpEsc(value)}</span></div>`;
    const enroll = p.ENROLLMENT != null && p.ENROLLMENT !== ""
        ? Math.round(+p.ENROLLMENT).toLocaleString() : null;
    const addr = [p.ADDRESS, p.ZIP].filter(Boolean).join(", ");
    return `
        <div class="popup-title">${cmpEsc(p.NAME || "Private school")}</div>
        <div class="popup-note">Private school — reference only. Not a DESE district/school, so no MCAS, accountability, or graduation data.</div>
        <div class="popup-row"><span class="label">Type</span><span class="value">Private${p.LEVEL_DESC ? " · " + cmpEsc(p.LEVEL_DESC) : ""}</span></div>
        ${row("Affiliation", p.AFFILIATION)}
        ${row("Grades", p.GRADES)}
        ${row("Enrollment", enroll)}
        ${row("Town", p.TOWN)}
        ${row("Address", addr)}
        <div class="popup-source">Source: NCES Private School Survey 2021-22</div>`;
}

// College popup body — used by the colleges-layer click handler. Shows the
// "real college" IPEDS stats (admissions, graduation, retention, faculty ratio,
// price) in a layout distinct from the K-12 school popup: directory facts are
// condensed into one subtitle line, and every stat row hides itself when the
// value is missing — so open-admission community colleges (no acceptance rate)
// and sparsely-reported schools degrade cleanly instead of showing blanks.
// Enriched fields (admit_rate, grad_rate, retention_rate, stu_fac_ratio,
// tuition_in/out, net_price) are integer percents / whole dollars from IPEDS,
// baked onto each feature by scripts/fetch_ipeds_colleges.py.
function collegePopupHtml(p) {
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    const num = v => (v == null || v === "") ? null : +v;
    const row = (label, value) => (value == null || value === "")
        ? "" : `<div class="popup-row"><span class="label">${label}</span><span class="value">${cmpEsc(value)}</span></div>`;
    const pct = v => { const n = num(v); return n == null ? null : `${Math.round(n)}%`; };
    const usd = v => { const n = num(v); return n == null ? null : `$${Math.round(n).toLocaleString()}`; };
    const enroll = num(p.enrollment) != null ? Math.round(num(p.enrollment)).toLocaleString() : null;
    const ratio = num(p.stu_fac_ratio) != null ? `${Math.round(num(p.stu_fac_ratio))} : 1` : null;
    // IPEDS graduation rate is 150% of normal time: 6 yrs at a 4-year school,
    // 3 yrs at a 2-year school. Label it to match the institution's level.
    const gradLabel = p.level === "2-year" ? "Graduation rate (3-yr)" : "Graduation rate (6-yr)";
    // Tuition: in- vs out-of-state shown separately when they differ (publics);
    // collapsed to one row when equal (privates charge everyone the same).
    const tin = num(p.tuition_in), tout = num(p.tuition_out);
    const tuitionRows = (tin != null && tout != null && tin !== tout)
        ? row("Tuition & fees, in-state", usd(tin)) + row("Tuition & fees, out-of-state", usd(tout))
        : row("Tuition & fees", usd(tin != null ? tin : tout));
    const sub = [cap(p.sector), p.level, p.CITY].filter(Boolean).join(" · ");
    // Branch/satellite campuses carry their parent college's IPEDS stats (there is
    // no campus-level breakdown), so flag that clearly and relabel the headline.
    const noteHtml = p.is_satellite
        ? `<div class="popup-note">${p.site_type === "instructional"
              ? `Instructional site of ${cmpEsc(p.parent)} — a teaching location, not a full campus.`
              : `Branch campus of ${cmpEsc(p.parent)}.`} IPEDS doesn't break out figures by campus, so the stats below are for the whole college, not this site alone.</div>`
        : "";
    const enrollLabel = p.is_satellite ? "College-wide enrollment" : "Total enrollment";
    const srcHtml = p.is_satellite
        ? `<div class="popup-source">Campus location hand-placed · stats: NCES IPEDS 2023 (college-wide)</div>`
        : `<div class="popup-source">Source: NCES IPEDS 2023</div>`;
    return `
        <div class="popup-title">${cmpEsc(p.NAME)}</div>
        ${sub ? `<div class="popup-sub">${cmpEsc(sub)}</div>` : ""}
        ${noteHtml}
        ${row(enrollLabel, enroll)}
        ${row("Acceptance rate", pct(p.admit_rate))}
        ${row(gradLabel, pct(p.grad_rate))}
        ${row("First-year retention", pct(p.retention_rate))}
        ${row("Students per faculty", ratio)}
        ${tuitionRows}
        ${row("Avg net price (with aid)", usd(p.net_price))}
        ${srcHtml}`;
}

// ─── FEATURE DETAIL — STICKY SIDE PANEL (replaces popup) ─────────────────────
// Persist a "selected" feature-state so the clicked polygon keeps its navy ring
// (drawn by the selected-outline-* layers) until another is clicked or closed.
function setSelectedFeature(source, id) {
    const prev = state.selected;
    if (prev && prev.id != null && map.getSource(prev.source)) {
        map.setFeatureState({ source: prev.source, id: prev.id }, { selected: false });
    }
    if (source && id != null) {
        map.setFeatureState({ source, id }, { selected: true });
        state.selected = { source, id };
    } else {
        state.selected = null;
    }
}
function clearSelectedFeature() { setSelectedFeature(null, null); }

// Comparison set: paint (or clear) a member's accent ring via feature-state
// { picked, pickIdx }. Independent of the single-selection "selected" ring, so a
// normal click highlight and the comparison picks can coexist. Works for places
// (pick-outline-* line layers) and schools (school-pick-ring circle layer) — both
// read the same feature-state. Pass idx=null to clear.
function setPickState(source, id, idx) {
    if (!source || id == null || !map.getSource(source)) return;
    if (idx == null) map.setFeatureState({ source, id }, { picked: false });
    else             map.setFeatureState({ source, id }, { picked: true, pickIdx: idx });
}

function showPopup(e, kind) {
    if (!e.features.length) return;
    const feat = e.features[0];
    // Compare-mode intercept: clicking a place toggles it in/out of the
    // comparison set (when the set is in "place" mode), without opening the
    // single-feature panel. Clicking the wrong kind gets a gentle hint.
    if (state.compareMode) {
        const cSource = kind === "muni" ? "municipalities" : "districts";
        if (state.compareKind === "place") toggleMember(kind, cSource, feat);
        else flashCompareNote("You're comparing schools — click a school dot, or switch to Places above.");
        return;
    }
    setSelectedFeature(kind === "muni" ? "municipalities" : "districts", feat.id);
    // Remember the last clicked feature so the "Selected feature" export scope
    // has something to fit to. Mapbox/MapLibre click features sometimes omit
    // geometry — pull it from the source data by id when that happens.
    let geometry = feat.geometry;
    if (!geometry && GEO_DATA) {
        const src = kind === "muni" ? GEO_DATA.muni : kind === "district" ? GEO_DATA.district : null;
        if (src) {
            const match = src.features.find(ff => ff.id === feat.id);
            if (match) geometry = match.geometry;
        }
    }
    state.lastSelected = { kind, properties: feat.properties, geometry };
    openFeaturePanel(feat.properties, kind);
}

function openFeaturePanel(p, kind) {
    const panel = document.getElementById("featurePanel");
    const title = document.getElementById("featurePanelTitle");
    const body = document.getElementById("featurePanelBody");
    title.textContent = featureName(p, kind);
    body.innerHTML = buildPanelHtml(p, kind);
    body.scrollTop = 0;   // reset scroll when reusing the panel for a new feature
    // "Add to comparison" only applies to districts/towns here (schools add from
    // their own popup). Reflect whether this place is already in the set.
    const cmpBtn = document.getElementById("compareStartBtn");
    if (cmpBtn) {
        const show = kind === "district" || kind === "muni";
        cmpBtn.style.display = show ? "" : "none";
        const inSet = state.compareKind === "place" && inCompareSet(memberKey(kind, p));
        cmpBtn.textContent = inSet ? "✓ In comparison — remove" : "➕ Add to comparison";
    }
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `${featureName(p, kind)} — details`);
    // Move focus to the close button so keyboard/SR users land in the panel.
    const cb = document.getElementById("featurePanelClose");
    if (cb) cb.focus();

    // On mobile, the control drawer would cover the bottom-sheet detail
    // panel — auto-close it so the detail panel has room
    if (window.matchMedia("(max-width: 768px)").matches) {
        const ctrl = document.getElementById("controlPanel");
        const bd   = document.getElementById("panelBackdrop");
        if (ctrl) ctrl.classList.remove("open");
        if (bd)   bd.classList.remove("open");
    }
}

function closeFeaturePanel() {
    const panel = document.getElementById("featurePanel");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    clearSelectedFeature();
}

// ─────────────────────────────────────────────────────────────────────────
// COMPARISON SET (compare 2+ places OR 2+ schools)
// The user builds an ordered set of up to PICK_COLORS.length members, all of one
// kind. A side-by-side panel shows key metrics across every member (one column
// each), crowning the leader where a metric has a clear "good" direction. Each
// member carries an accent color (its pick slot) reused on the map ring and in
// the charts. Values reuse panelValue()/getMetric()/fmt() so places track the
// map's active year + level; schools read their flat sch_* fields.
// ─────────────────────────────────────────────────────────────────────────

// Headline set for the PLACE comparison table (districts/towns). Rows whose
// metric isn't offered at the active level are skipped, as are rows blank for
// every member.
const COMPARE_METRICS = [
    "TOTAL_CNT", "grad_4yr", "dropout_pct",
    "mcas_g10_ela_me", "mcas_g10_math_me", "mcas_ela_sgp",
    "chronic_absent_pct", "ap_pct_3plus",
    "avg_class_size", "stu_tchr_ratio", "per_pupil",
    "LI_PCT", "EL_PCT", "diversity_index",
    "acs_median_household_income", "acs_bachelors_plus_pct",
];

// SCHOOL comparison metrics — the sch_* vocabulary merged onto each school point
// by enrichSchools(). { id, label, format } where format feeds fmt(); sch_* pct
// fields are 0–1 fractions, the percentile and class size are plain numbers.
const SCHOOL_COMPARE_METRICS = [
    { id: "sch_enrollment",              label: "Enrollment",                  format: "num" },
    { id: "sch_accountability_pctile",   label: "Accountability %ile (of 99)", format: "num" },
    { id: "sch_mcas_ela_me",             label: "MCAS Gr3-8 ELA % M/E",        format: "pct" },
    { id: "sch_mcas_math_me",            label: "MCAS Gr3-8 Math % M/E",       format: "pct" },
    { id: "sch_mcas_sci_me",             label: "MCAS Gr3-8 Science % M/E",    format: "pct" },
    { id: "sch_mcas_g10_ela_me",         label: "MCAS Gr10 ELA % M/E",         format: "pct" },
    { id: "sch_mcas_g10_math_me",        label: "MCAS Gr10 Math % M/E",        format: "pct" },
    { id: "sch_ap_pct_3plus",            label: "AP % scoring 3+",             format: "pct" },
    { id: "sch_grad_4yr",                label: "4-yr graduation",             format: "pct" },
    { id: "sch_teacher_experienced_pct", label: "Experienced teachers",        format: "pct" },
    { id: "sch_chronic_absent_pct",      label: "Chronic absenteeism",         format: "pct" },
    { id: "sch_disciplined_pct",         label: "Students disciplined",        format: "pct" },
    { id: "sch_class_size",              label: "Avg class size",              format: "num" },
];

// Metric polarity for crowning the "leader" in each comparison row. Only clear
// academic outcomes / clear negatives are crowned; debatable ones (enrollment,
// spending, % low-income, class size, diversity, income) get NO crown so the
// table never implies a value judgment the data doesn't support.
const COMPARE_BETTER_HIGH = new Set([
    "grad_4yr", "grad_5yr", "masscore_pct", "ap_pct_3plus",
    "mcas_g10_ela_me", "mcas_g10_math_me", "mcas_g10_sci_me",
    "mcas_g38_ela_me", "mcas_g38_math_me", "mcas_ela_sgp", "mcas_math_sgp",
    "pct_any_college", "pct_4yr_college",
    "sch_grad_4yr", "sch_ap_pct_3plus", "sch_accountability_pctile",
    "sch_mcas_ela_me", "sch_mcas_math_me", "sch_mcas_sci_me",
    "sch_mcas_g10_ela_me", "sch_mcas_g10_math_me", "sch_teacher_experienced_pct",
]);
const COMPARE_BETTER_LOW = new Set([
    "dropout_pct", "chronic_absent_pct", "oss_pct",
    "sch_chronic_absent_pct", "sch_disciplined_pct",
]);
// Crown direction for a metric id: +1 high-is-better, −1 low-is-better, 0 none.
function compareDir(id) {
    if (COMPARE_BETTER_HIGH.has(id)) return 1;
    if (COMPARE_BETTER_LOW.has(id))  return -1;
    return 0;
}

function cmpEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Click features sometimes omit geometry; recover it from the source data by id.
function resolveFeatureGeometry(kind, feat) {
    let geometry = feat.geometry;
    if (!geometry && GEO_DATA) {
        const gsrc = kind === "muni" ? GEO_DATA.muni : kind === "district" ? GEO_DATA.district : null;
        if (gsrc) {
            const match = gsrc.features.find(ff => ff.id === feat.id);
            if (match) geometry = match.geometry;
        }
    }
    return geometry;
}

function syncCompareToggle(on) {
    const t = document.getElementById("compareToggle");
    if (t) t.checked = !!on;
}

function openComparePanel() {
    const panel = document.getElementById("comparePanel");
    if (!panel) return;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    if (window.matchMedia("(max-width: 768px)").matches) {
        const ctrl = document.getElementById("controlPanel");
        const bd = document.getElementById("panelBackdrop");
        if (ctrl) ctrl.classList.remove("open");
        if (bd) bd.classList.remove("open");
    }
}

function closeComparePanel() {
    const panel = document.getElementById("comparePanel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
}

// Hide the single-feature panel WITHOUT clearing the map selection, so A keeps
// its navy ring when we switch into the compare view.
function hideFeaturePanel() {
    const panel = document.getElementById("featurePanel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
}

// Plain-language noun for what the set currently holds.
function compareNoun(plural) {
    if (state.compareKind === "school") return plural ? "schools" : "school";
    if (state.level === "muni") return plural ? "towns" : "town";
    return plural ? "districts" : "district";
}

function enterCompareMode() {
    // Compare and bivariate (two metrics on one map) are mutually exclusive
    // views — leaving both on produces a confusing combined state.
    if (state.bivariate) {
        state.bivariate = false;
        const bt = document.getElementById("bivariateToggle");
        if (bt) bt.checked = false;
        const bc = document.getElementById("bivarControls");
        if (bc) bc.style.display = "none";
        applyChoropleth();
        updateLegend();
    }
    state.compareMode = true;
    syncCompareToggle(true);
    // Seed the set with the currently-selected place, if one is selected and it
    // matches a place comparison (schools have no single-selection ring).
    if (state.compareKind === "place" && !state.compareSet.length &&
        state.selected && state.lastSelected &&
        (state.lastSelected.kind === "district" || state.lastSelected.kind === "muni")) {
        addMember(state.lastSelected.kind, state.selected.source, state.selected.id,
                  state.lastSelected.properties, state.lastSelected.geometry);
    }
    if (state.compareKind === "school") ensureSchoolsVisibleForCompare();
    hideFeaturePanel();
    openComparePanel();
    updateCompareKindUI();
    renderComparison();
    updateModeBar();
}

function exitCompareMode() {
    clearCompareSet();          // free every pick's ring
    state.compareMode = false;
    syncCompareToggle(false);
    closeComparePanel();
    updateCompareKindUI();
    updateModeBar();
}

function toggleCompareMode() {
    if (state.compareMode) exitCompareMode();
    else enterCompareMode();
}

// ── Comparison set operations ────────────────────────────────────────────────
function inCompareSet(key) { return state.compareSet.some(m => m.key === key); }
function findMember(key)    { return state.compareSet.find(m => m.key === key); }

// Add a feature to the set. No-op (returns false) if it's already in, the set is
// full, or its kind doesn't match the set's kind. Assigns the lowest free accent
// slot and paints the member's ring.
function addMember(kind, source, id, properties, geometry) {
    const setWantsSchool = state.compareKind === "school";
    if ((kind === "school") !== setWantsSchool) {
        flashCompareNote(`You're comparing ${compareNoun(true)} — switch the picker above to add a ${kind === "school" ? "school" : "place"}.`);
        return false;
    }
    const key = memberKey(kind, properties);
    if (inCompareSet(key)) return false;
    const idx = nextPickSlot();
    if (idx < 0) { flashCompareNote(`That's the most you can compare at once (${PICK_COLORS.length}). Remove one to add another.`); return false; }
    state.compareSet.push({
        key, kind, source, id, idx,
        properties, geometry: geometry || null,
        name: featureName(properties, kind),
    });
    setPickState(source, id, idx);
    return true;
}

// Remove by key; frees its accent slot and clears its ring.
function removeMember(key) {
    const i = state.compareSet.findIndex(m => m.key === key);
    if (i < 0) return;
    const m = state.compareSet[i];
    setPickState(m.source, m.id, null);
    state.compareSet.splice(i, 1);
}

// Toggle a clicked feature in/out of the set, then refresh the panel + mode bar.
function toggleMember(kind, source, feat) {
    const key = memberKey(kind, feat.properties);
    if (inCompareSet(key)) removeMember(key);
    else addMember(kind, source, feat.id, feat.properties, resolveFeatureGeometry(kind, feat));
    renderComparison();
    updateModeBar();
    // Keep the open charts modal in sync if it's scoped to the set.
    if (document.getElementById("graphModal")?.classList.contains("open") && state.graphScope === "set") renderGraph();
}

// Clear the whole set (free every ring).
function clearCompareSet() {
    state.compareSet.forEach(m => setPickState(m.source, m.id, null));
    state.compareSet = [];
}

// Switch between comparing places and schools. A set holds one kind only, so a
// non-empty set is cleared first (after confirm).
function setCompareKind(kind) {
    if (kind !== "place" && kind !== "school") return;
    if (kind === state.compareKind) return;
    if (state.compareSet.length &&
        !window.confirm(`Start a new ${kind === "school" ? "school" : "place"} comparison? This clears your current ${state.compareSet.length} ${compareNoun(state.compareSet.length !== 1)}.`)) {
        updateCompareKindUI();   // revert the control to the current kind
        return;
    }
    clearCompareSet();
    state.compareKind = kind;
    if (kind === "school") ensureSchoolsVisibleForCompare();
    updateCompareKindUI();
    renderComparison();
    updateModeBar();
}

// Comparing schools needs the school dots clickable — turn the schools layer on
// (master + public sector) and sync its checkboxes.
function ensureSchoolsVisibleForCompare() {
    state.showAllMaSchools = true;
    const master = document.getElementById("ref-all-ma-schools");
    if (master) master.checked = true;
    const pub = document.getElementById("school-sector-public");
    if (pub) pub.checked = true;
    applySchoolSectorFilter();
}

// Add the place whose detail panel is open to the comparison set — switching the
// set to place kind (clearing a school set, after confirm) and entering compare
// mode. Driven by the detail panel's "➕ Add to comparison" button.
function addCurrentPlaceToCompare() {
    const ls = state.lastSelected;
    if (!ls || (ls.kind !== "district" && ls.kind !== "muni")) return;
    if (state.compareKind !== "place") setCompareKind("place");
    if (!state.compareMode) { state.compareMode = true; syncCompareToggle(true); }
    const source = ls.kind === "muni" ? "municipalities" : "districts";
    const id = (state.selected && state.selected.source === source) ? state.selected.id : null;
    if (id != null) addMember(ls.kind, source, id, ls.properties, ls.geometry);
    hideFeaturePanel();
    openComparePanel();
    updateCompareKindUI();
    renderComparison();
    updateModeBar();
}

// Sync the Places|Schools segmented control + its visibility to compare state.
function updateCompareKindUI() {
    const wrap = document.getElementById("compareKindWrap");
    if (wrap) wrap.hidden = !state.compareMode;
    document.querySelectorAll("#compareKindWrap [data-cmpkind]").forEach(b => {
        const on = b.dataset.cmpkind === state.compareKind;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
    });
}

// Transient one-line note in the compare panel (wrong kind clicked / set full).
let _compareNoteTimer = null;
function flashCompareNote(msg) {
    const el = document.getElementById("compareMaxNote");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    if (_compareNoteTimer) clearTimeout(_compareNoteTimer);
    _compareNoteTimer = setTimeout(() => { el.hidden = true; }, 3600);
}

// Signed A−B gap, formatted by metric type (pct → percentage points).
function fmtDelta(d, format) {
    const sign = d > 0 ? "+" : d < 0 ? "−" : "";
    const mag = Math.abs(d);
    if (format === "pct") return `${sign}${(mag * 100).toFixed(1)} pts`;
    if (format === "usd") return `${sign}$${Math.round(mag).toLocaleString()}`;
    return `${sign}${Math.round(mag).toLocaleString()}`;
}

// Collect the comparison rows for the current set: [{ label, format, cells }]
// where cells aligns 1:1 with state.compareSet and each cell is { v, leader }.
// Kind-aware: places read panelValue() (active year); schools read sch_* flat.
function compareRowData() {
    const set = state.compareSet;
    const out = [];
    const addRow = (label, format, vals, dir) => {
        const nums = vals.map(v => (v != null && isFinite(+v)) ? +v : null);
        if (nums.every(v => v == null)) return;   // blank for everyone → drop the row
        let best = null;
        if (dir) {
            const present = nums.filter(v => v != null);
            if (present.length > 1) best = dir > 0 ? Math.max(...present) : Math.min(...present);
        }
        out.push({
            label, format,
            cells: nums.map(v => ({ v, leader: best != null && v != null && v === best })),
        });
    };
    if (state.compareKind === "school") {
        SCHOOL_COMPARE_METRICS.forEach(sm =>
            addRow(sm.label, sm.format, set.map(m => m.properties[sm.id]), compareDir(sm.id)));
    } else {
        const level = state.level;
        COMPARE_METRICS.forEach(id => {
            const m = getMetric(id);
            if (!m || m.id !== id) return;   // skip ids not in METRICS
            if (Array.isArray(m.levels) && !m.levels.includes(level)) return;
            addRow(m.label, m.format, set.map(mem => panelValue(mem.properties, id)), compareDir(id));
        });
    }
    return out;
}

function renderComparison() {
    const body = document.getElementById("comparePanelBody");
    const title = document.getElementById("comparePanelTitle");
    if (!body) return;
    const set = state.compareSet;
    const noun = compareNoun(false), nounP = compareNoun(true);
    if (title) title.textContent = set.length
        ? `Comparing ${set.length} ${compareNoun(set.length !== 1)}`
        : `Compare ${nounP}`;

    // Member chips (always shown so picks are visible/removable). Click a name to
    // fly to it on the map; the × removes it.
    const chips = set.map(m =>
        `<span class="compare-chip">` +
        `<span class="compare-chip-sw" style="background:${pickColor(m.idx)}"></span>` +
        `<button type="button" class="compare-chip-nm" data-flykey="${cmpEsc(m.key)}" title="Zoom to ${cmpEsc(m.name)}">${cmpEsc(m.name)}</button>` +
        `<button type="button" class="compare-chip-x" data-rmkey="${cmpEsc(m.key)}" aria-label="Remove ${cmpEsc(m.name)}">×</button>` +
        `</span>`).join("");
    const actions = set.length
        ? `<div class="compare-actions-row">` +
          `<button type="button" id="compareChartsBtn" class="compare-act-btn primary">📊 Charts</button>` +
          `<button type="button" id="compareClearBtn" class="compare-act-btn">Clear all</button>` +
          `</div>`
        : "";
    const header =
        `<div class="compare-chips">${chips || `<span class="compare-chips-empty">No ${nounP} picked yet</span>`}</div>` +
        actions;

    if (set.length < 2) {
        const tip = set.length === 0
            ? `Click ${nounP} on the map to add them${state.compareKind === "school" ? " (the school dots)" : ""}, or use “➕ Add to comparison” from a place’s details. Pick <strong>2 or more</strong> to compare.`
            : `Add at least one more ${noun} to compare side by side.`;
        body.innerHTML = header + `<div class="compare-prompt">${tip}</div>`;
        body.scrollTop = 0;
        return;
    }

    const rows = compareRowData();
    const colTemplate = `minmax(124px, 1.25fr) ` + set.map(() => "minmax(72px, 1fr)").join(" ");
    const headCells = set.map(m =>
        `<button type="button" class="c-col c-colhead" data-flykey="${cmpEsc(m.key)}" style="--pc:${pickColor(m.idx)}" title="Zoom to ${cmpEsc(m.name)}">${cmpEsc(m.name)}</button>`).join("");
    let grid = `<div class="compare-grid" style="grid-template-columns:${colTemplate}">`;
    grid += `<span class="c-col c-metric c-thead">Metric</span>${headCells}`;
    rows.forEach(r => {
        grid += `<span class="c-col c-metric" title="${cmpEsc(r.label)}">${cmpEsc(r.label)}</span>`;
        r.cells.forEach(c => {
            grid += `<span class="c-col c-val${c.leader ? " win" : ""}">` +
                (c.v == null ? '<span class="c-na">—</span>' : cmpEsc(fmt(c.v, r.format))) +
                (c.leader ? ' <span class="c-best" title="Best of the group on this metric">★</span>' : "") +
                `</span>`;
        });
    });
    grid += `</div>`;
    const yearNote = state.compareKind === "school"
        ? `Latest reported year · ★ marks the group leader where a metric has a clear better direction.`
        : `Current year (${state.year}) · ★ marks the group leader where a metric has a clear better direction.`;
    body.innerHTML = header + `<div class="compare-note">${yearNote}</div>` +
        (rows.length ? grid : `<div class="compare-empty">No shared metrics available for these ${nounP} at the current level.</div>`);
    body.scrollTop = 0;
}

// Fly the map to a set member by key (used by chips, column heads, chart marks).
function flyToMember(key) {
    const m = findMember(key);
    if (!m) return;
    if (m.kind === "school" && m.properties.lon != null) {
        map.flyTo({ center: [+m.properties.lon, +m.properties.lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
        return;
    }
    const bbox = m.geometry ? geomBbox(m.geometry) : null;
    if (bbox) map.fitBounds(bbox, { padding: 80, duration: 700 });
}

function featureName(p, kind) {
    if (kind === "school")   return p.NAME || "School";
    if (kind === "muni")     return p.town_display || p.TOWN || "Municipality";
    if (kind === "district") return p.dist_display || p.DIST_NAME || "District";
    return "Feature";
}

function fpSection(title, rowsHtml) {
    return rowsHtml.trim()
        ? `<div class="feature-panel-section"><h3>${title}</h3>${rowsHtml}</div>`
        : "";
}

function fpRow(label, value, kind = "num", highlight = false) {
    const v = fmt(+value, kind);
    if (value == null || !isFinite(+value)) return "";
    return `<div class="feature-panel-row"><span class="label">${label}</span><span class="value${highlight ? ' highlight' : ''}">${v}</span></div>`;
}

// Footnote for the district community section: explains that the Census stats
// are aggregated up from the district's member towns, and lists them. Single-
// town districts get a simpler one-liner; multi-town (regional) districts also
// note that median income is a population-weighted approximation.
function fpRollupNote(p) {
    const towns = Array.isArray(p._member_towns) ? p._member_towns : [];
    const n = p._member_count || towns.length;
    if (!n) return "";
    if (n === 1) {
        return `<div class="feature-panel-note">Census figures are for ${towns[0] || "the district's town"}.</div>`;
    }
    const list = towns.length ? towns.join(", ") : `${n} member towns`;
    return `<div class="feature-panel-note">Aggregated from <strong>${n} member towns</strong>: ${list}. ` +
        `Median household income is a population-weighted estimate across these towns.</div>`;
}

// Like fpRow, but instead of hiding a blank value it renders a muted "—" with
// a plain-language reason ("why is this blank?"). Used for the headline
// outcomes so a grey/blank district explains itself instead of looking broken.
function fpRowExplained(label, value, kind, reason, highlight = false) {
    if (value != null && isFinite(+value)) {
        return fpRow(label, value, kind, highlight);
    }
    return `<div class="feature-panel-row"><span class="label">${label}</span>` +
        `<span class="value value-nodata" title="${reason}">— <span class="nodata-reason">${reason}</span></span></div>`;
}

// Plain-language explanation for why a given outcome value is blank for a
// district/muni. Distinguishes the common cases so users stop reading "blank"
// as "missing/broken data". Order matters: most specific first.
//   - HS-completion metrics (grad/dropout/MCAS-10/AP) blank + no high-school
//     enrollment → district doesn't operate a high school (tuitions students out)
//   - tiny cohort → DESE small-N suppression
//   - year-keyed metric with no value for the active year → not reported that year
//   - otherwise → not reported
// High-school-only outcome metrics: a K-8 district structurally can't have these,
// so on these metrics the ~61 K-8 districts get the honest "No high school here"
// treatment (distinct slate color + legend split + blankReason), not a misleading
// "No data / suppressed". MAINTAINER: any NEW grade 9–12 / graduation / dropout /
// college / Gr10-MCAS metric — INCLUDING subgroup or detail breakdowns — must be
// listed here, or its K-8 blanks will read as "missing" instead of "no high school".
const HS_OUTCOME_METRICS = new Set([
    "grad_4yr", "grad_5yr", "dropout_pct", "masscore_pct", "ap_pct_3plus",
    "mcas_g10_ela_me", "mcas_g10_math_me", "mcas_g10_sci_me",
    "mcas_ela_sgp_g10", "mcas_math_sgp_g10",
    "pct_any_college", "pct_4yr_college", "pct_2yr_college",
    "pct_work_after_hs", "pct_military",
    // Subgroup / detail HS metrics added in the metric-gap waves (#69, #79):
    "grad_4yr_female", "grad_4yr_male", "dropout_female", "dropout_male",
    "g9_pass_all_pct", "g9_pass_ela_pct", "g9_pass_math_pct",
    "college_completion_pct", "college_enroll_black", "college_enroll_ell",
    "college_enroll_hispanic", "college_enroll_low_income", "college_enroll_swd",
    "mcas_g10_ela_asian", "mcas_g10_ela_black", "mcas_g10_ela_ell",
    "mcas_g10_ela_female", "mcas_g10_ela_high_needs", "mcas_g10_ela_hispanic",
    "mcas_g10_ela_low_income", "mcas_g10_ela_male", "mcas_g10_ela_multi",
    "mcas_g10_ela_swd", "mcas_g10_ela_white",
    "mcas_g10_math_asian", "mcas_g10_math_black", "mcas_g10_math_ell",
    "mcas_g10_math_female", "mcas_g10_math_high_needs", "mcas_g10_math_hispanic",
    "mcas_g10_math_low_income", "mcas_g10_math_male", "mcas_g10_math_multi",
    "mcas_g10_math_swd", "mcas_g10_math_white",
    // Early college + HS-graduate outcomes (feat/early-college-outcomes) — all
    // grade 9–12 / post-HS, so K-8 districts get "No high school here", not "missing".
    "early_college_pct", "early_college_g12_pct", "early_college_participants",
    "early_college_credits_per_student", "early_college_credit_success_pct",
    "grad_pct_employed", "grad_pct_disconnected",
    // ── More HS-grade metrics (SAT, AP detail, Gr10 tails, college/dropout
    //    outcomes, CTE/Chapter-74, athletics, course access). Auto-curated:
    //    blank on ~all 61 no-high-school districts, so their K-8 blanks read
    //    "No high school here" (distinct color + reason) not generic "No data".
    "adv_course_completion_pct", "algebra2_access_pct", "ap_exams_per_taker", "ap_participation_pct",
    "ap_pct_score_3plus_exams", "ap_subjects_offered", "ap_tests_per_100", "athletics_girls_share",
    "athletics_participants", "athletics_participation_pct", "calculus_access_pct", "chapter74_programs",
    "chemistry_access_pct", "college_enroll_2yr_pct", "college_enroll_4yr_pct", "college_enroll_pct",
    "college_persist_pct", "cte_enrollment_pct", "cte_female_pct", "cte_high_needs_pct",
    "dropout_annual_pct", "ged_pct", "grad_avg_earnings", "grad_avg_earnings_lowincome",
    "grad_employment_pct", "mcas_g10_ela_exceeding", "mcas_g10_ela_not_meeting", "mcas_g10_math_exceeding",
    "mcas_g10_math_not_meeting", "non_grad_completer_pct", "opportunity_to_learn_index", "permanently_excluded_pct",
    "physics_access_pct", "sat_ebrw_mean", "sat_math_mean", "sat_total_mean",
    "still_enrolled_pct", "swd_college_persist_pct", "swd_grad_5yr_pct",
]);
// Core high-school signals: if a district reports NONE of these it almost
// certainly has no 9–12 program (K-8/elementary). Used both at load to bake
// _nohs (for the distinct choropleth color) and here in blankReason — keep the
// two uses in sync via this one list.
const HS_SIGNALS = ["grad_4yr", "grad_5yr", "dropout_pct",
    "mcas_g10_ela_me", "mcas_g10_math_me"];
function blankReason(p, metricId, kind) {
    const enroll = +p.TOTAL_CNT;
    const small = isFinite(enroll) && enroll > 0 && enroll < 30;
    if (HS_OUTCOME_METRICS.has(metricId)) {
        // Does this district report ANY high-school-grade signal? If every
        // grad/HS metric is blank, it almost certainly has no 9–12 program.
        const hasAnyHs = HS_SIGNALS.some(k => p[k] != null && isFinite(+p[k]));
        if (!hasAnyHs) return "No high school — students tuition out to another district";
        if (small) return "Suppressed — cohort too small to report (privacy)";
        return "Not reported for the selected year";
    }
    if (small) return "Suppressed — group too small to report (privacy)";
    if (isYearKeyed(metricId)) return "Not reported for the selected year";
    return "Not reported";
}

// Resolve the value the MAP is currently painting for a base metric on this
// feature — i.e. respect the active year (and student group). Falls back to the
// flat field. This keeps the detail panel's headline outcomes in agreement with
// the choropleth instead of showing a stale all-time value (e.g. Provincetown's
// 2013 grad rate while the 2025 map cell is blank).
function panelValue(p, baseMetric) {
    const col = activeColumn(baseMetric);
    if (p[col] != null && isFinite(+p[col])) return +p[col];
    // If the active-year column is explicitly null, surface that (blank), not
    // the stale flat value — the map shows blank, so should the panel.
    if (Object.prototype.hasOwnProperty.call(p, col)) return null;
    return p[baseMetric];
}

// One headline outcome row that stays in sync with the map's active year and
// explains itself when blank.
function fpOutcome(p, label, baseMetric, kind = "pct") {
    const val = panelValue(p, baseMetric);
    return fpRowExplained(label, val, kind, blankReason(p, baseMetric, kind));
}

// Statewide rank + percentile of this feature on the active metric.
function fpRankRow(p) {
    const rk = state.bivariate ? null : rankInfo(state.level, state.metric, p[activeColumn()]);
    if (!rk) return "";
    const isChange = changeActive(state.metric, state.level);
    const standing = isChange ? null : standingPhrase(state.metric, rk, "full");
    const label = isChange ? "Rank by change" : standing ? "Statewide standing" : "Statewide rank";
    const text = standing || `${rk.rank} of ${rk.total} · ${rk.pctile}th percentile`;
    return `<div class="feature-panel-row"><span class="label">${label}</span>` +
        `<span class="value">${text}</span></div>`;
}

// Change-mode "Active metric" section: both endpoint values + the signed delta,
// plus the rank (by amount of change). Reads the raw year columns directly so
// the endpoints are exact, not the materialized delta.
function fpChangeRow(p) {
    const m = getMetric(state.metric), level = state.level;
    const colF = yearColumn(state.metric, state.changeFrom, level);
    const colT = yearColumn(state.metric, state.changeTo, level);
    const av = (colF && p[colF] != null && isFinite(+p[colF])) ? +p[colF] : null;
    const bv = (colT && p[colT] != null && isFinite(+p[colT])) ? +p[colT] : null;
    const has = av != null && bv != null;
    return [
        `<div class="feature-panel-row"><span class="label">${state.changeFrom}</span><span class="value">${av != null ? fmt(av, m.format) : "—"}</span></div>`,
        `<div class="feature-panel-row"><span class="label">${state.changeTo}</span><span class="value">${bv != null ? fmt(bv, m.format) : "—"}</span></div>`,
        `<div class="feature-panel-row"><span class="label">Change</span><span class="value"><strong>${has ? fmtChangeDelta(p[activeColumn()], m) : "—"}</strong></span></div>`,
        fpRankRow(p),
    ].join("");
}

// Inline trajectory sparkline for the selected feature on the active metric —
// one line across all available years (calendar/heatmap-style "one place over
// time"). Colored by net direction (up=blue, down=red) to echo the change map.
// Returns "" when the metric isn't year-keyed or the feature has <2 data points.
function fpTrendSparkline(p) {
    const m = getMetric(state.metric), level = state.level;
    const yrs = availableYears(state.metric, level);
    if (yrs.length < 2) return "";
    const pts = yrs.map(y => { const c = yearColumn(state.metric, y, level); const v = c ? p[c] : null; return { y, v: (v != null && isFinite(+v)) ? +v : null }; });
    const have = pts.filter(d => d.v != null);
    if (have.length < 2) return "";
    const vals = have.map(d => d.v);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi) { lo -= 1; hi += 1; }
    const y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const W = 248, H = 52, pl = 5, pr = 5, pt = 7, pb = 13;
    const sx = y => pl + (y - y0) / ((y1 - y0) || 1) * (W - pl - pr);
    const sy = v => H - pb - (v - lo) / (hi - lo) * (H - pt - pb);
    const line = have.map(d => `${sx(d.y).toFixed(1)},${sy(d.v).toFixed(1)}`).join(" ");
    const first = have[0], last = have[have.length - 1];
    const col = last.v > first.v ? "#2166ac" : last.v < first.v ? "#b2182b" : "#888";
    const ends = [first, last].map(d => `<circle cx="${sx(d.y).toFixed(1)}" cy="${sy(d.v).toFixed(1)}" r="2.6" fill="${col}"/>`).join("");
    return `<div class="fp-spark">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${gEsc(m.label)} trend, ${first.y} to ${last.y}">
            <polyline points="${line}" fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
            ${ends}
            <text x="${pl}" y="${H - 2}" class="fp-spark-tick">${first.y}</text>
            <text x="${W - pr}" y="${H - 2}" text-anchor="end" class="fp-spark-tick">${last.y}</text>
        </svg>
        <div class="fp-spark-cap">${fmt(first.v, m.format)} → ${fmt(last.v, m.format)} <span class="fp-spark-yrs">(${have.length} yrs)</span></div>
    </div>`;
}

// Bottom "Active metric" section of the feature panel — swaps to a from→to→Δ
// readout when change mode is on, else the usual single value + rank. Both
// append the trajectory sparkline when the metric has multiple years.
function fpActiveMetricSection(p) {
    if (changeActive(state.metric, state.level)) {
        return fpSection(`${getMetric(state.metric).label} · change ${state.changeFrom}→${state.changeTo}`, fpChangeRow(p) + fpTrendSparkline(p));
    }
    return fpSection("Active metric", [
        fpRow(getMetric(state.metric).label, p[activeColumn()], getMetric(state.metric).format, true),
        fpRankRow(p)
    ].join("") + fpTrendSparkline(p));
}

// Focused "College outcomes" card for the district panel (district kind only):
// a mini stacked bar of where a district's graduates actually landed —
// four-year / two-year / not enrolled — plus the year-1 persistence rate.
//
// HONEST FRAMING: every figure is an AGGREGATE rate for the whole graduating
// class (MA DESE · National Student Clearinghouse, Class of 2023), NOT a
// per-student flow. Per-high-school -> per-college matriculation isn't public,
// so this is "what share of grads did X", never "which students went where".
// The 4yr/2yr shares are mutually-exclusive shares of all grads and sum to the
// total college-going rate, so "not enrolled" is just the remainder. Persistence
// comes from a separate progression dataset (share of grads who started college
// and came back for a 2nd year), so it's shown on its own line, not as a slice
// of the bar. Source/vintage: scripts/fetch_postsec_outcomes.py (SY2023).
function fpCollegeOutcomes(p) {
    const fourYr  = +p.college_enroll_4yr_pct;
    const twoYr   = +p.college_enroll_2yr_pct;
    const enroll  = +p.college_enroll_pct;
    const persist = +p.college_persist_pct;
    const hasSplit = isFinite(fourYr) && isFinite(twoYr);
    // Elementary-only / tuition-out districts have no high-school grads here —
    // show nothing rather than an empty card.
    if (!hasSplit && !isFinite(enroll) && !isFinite(persist)) return "";

    let breakdown = "";
    if (hasSplit) {
        const notEnrolled = Math.max(0, 1 - fourYr - twoYr);
        const w = v => (Math.max(0, v) * 100).toFixed(1);
        const ariaLabel = `Of graduates: ${fmt(fourYr, "pct")} four-year college, `
            + `${fmt(twoYr, "pct")} two-year college, ${fmt(notEnrolled, "pct")} not enrolled in college`;
        breakdown = `
            <div class="co-bar" role="img" aria-label="${ariaLabel}">
                <span class="co-seg co-seg--4yr"  style="width:${w(fourYr)}%"></span>
                <span class="co-seg co-seg--2yr"  style="width:${w(twoYr)}%"></span>
                <span class="co-seg co-seg--none" style="width:${w(notEnrolled)}%"></span>
            </div>
            <div class="feature-panel-row"><span class="label"><span class="co-sw co-sw--4yr"></span>Four-year college</span><span class="value">${fmt(fourYr, "pct")}</span></div>
            <div class="feature-panel-row"><span class="label"><span class="co-sw co-sw--2yr"></span>Two-year college</span><span class="value">${fmt(twoYr, "pct")}</span></div>
            <div class="feature-panel-row"><span class="label"><span class="co-sw co-sw--none"></span>Not enrolled in college</span><span class="value">${fmt(notEnrolled, "pct")}</span></div>`;
    } else if (isFinite(enroll)) {
        // Rare: total college-going rate present but no 4yr/2yr split to draw.
        breakdown = fpRow("Enrolled in college", enroll, "pct");
    }

    const persistBlock = isFinite(persist)
        ? `<div class="co-persist"><div class="feature-panel-row"><span class="label">Still enrolled a year later</span><span class="value">${fmt(persist, "pct")}</span></div></div>`
        : "";
    const persistNote = isFinite(persist)
        ? ` "Still enrolled a year later" is the share of grads who started college and came back for a second year.`
        : "";

    return `
        <div class="feature-panel-section college-outcomes">
            <h3>College outcomes</h3>
            <div class="co-subhead">Of the Class of 2023 graduates:</div>
            ${breakdown}
            ${persistBlock}
            <div class="feature-panel-note">Aggregate rates for the whole graduating class (MA DESE · National Student Clearinghouse) — the share of grads enrolled in college within 16 months of finishing high school. This is <strong>not</strong> a tally of which colleges students attend; individual student paths aren't public.${persistNote}</div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────
// PANEL MINI-CHARTS
// Dependency-free visuals for the detail panel, in the same pure-HTML/CSS
// spirit as fpCollegeOutcomes() above — so they render fresh for every feature
// with nothing to duplicate by hand. Each builder returns a full
// .feature-panel-section, or "" when a feature has no data for it (so the panel
// never shows an empty card). Reminder on units (see fmt()): percentages are
// 0–1 fractions, finance is whole dollars, growth (SGP) is a 1–99 percentile.
// ─────────────────────────────────────────────────────────────────────────

// Statewide median of a metric at the given level, honoring the active year/
// column (the same values the choropleth paints). null if data isn't loaded or
// the metric has <2 values — callers then simply omit the reference tick.
function fpStatMedian(level, metricId) {
    const vals = getValuesForLevel(level, metricId);
    if (!vals || vals.length < 2) return null;
    const s = [...vals].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Horizontal bars for percentage rows (values are 0–1 fractions). Each row:
//   { label, value, color, ref }
// color is a .cpal-* class; ref (optional, 0–1) draws a dotted statewide-median
// tick plus a muted median readout. Blank rows are skipped.
function fpPctBars(rows) {
    return rows.map(r => {
        const v = +r.value;
        if (!isFinite(v)) return "";
        const w = (Math.max(0, Math.min(1, v)) * 100).toFixed(1);
        let tick = "", refNum = "";
        if (isFinite(+r.ref)) {
            const rp = (Math.max(0, Math.min(1, +r.ref)) * 100).toFixed(1);
            tick = `<span class="fp-bar-ref" style="left:${rp}%" title="Statewide median: ${fmt(+r.ref, "pct")}"></span>`;
            refNum = `<span class="fp-bar-refnum" title="Statewide median">┊ ${fmt(+r.ref, "pct")}</span>`;
        }
        return `<div class="fp-bar-row">` +
            `<span class="fp-bar-label" title="${r.label}">${r.label}</span>` +
            `<span class="fp-bar-track"><span class="fp-bar-fill ${r.color || "cpal-blue"}" style="width:${w}%"></span>${tick}</span>` +
            `<span class="fp-bar-val">${fmt(v, "pct")}</span>${refNum}` +
            `</div>`;
    }).join("");
}

// Stacked single bar + inline-swatch legend — the generalized fpCollegeOutcomes
// bar. segs: [{ label, frac (0–1 share of the bar), color, valueText }].
function fpStackBar(segs, ariaLabel) {
    const bar = segs.map(s =>
        `<span class="co-seg ${s.color}" style="width:${(Math.max(0, s.frac) * 100).toFixed(1)}%" title="${s.label}: ${s.valueText}"></span>`
    ).join("");
    const legend = segs.map(s =>
        `<div class="feature-panel-row"><span class="label"><span class="co-sw ${s.color}"></span>${s.label}</span><span class="value">${s.valueText}</span></div>`
    ).join("");
    return `<div class="co-bar" role="img" aria-label="${ariaLabel}">${bar}</div>${legend}`;
}

// Centered "growth" bars for SGP (1–99; 50 = a typical year). The fill runs from
// the 50 midline out to the value — green above 50, amber below. rows:{label,value}.
function fpGrowthBars(rows) {
    return rows.map(r => {
        const v = +r.value;
        if (!isFinite(v)) return "";
        const c = Math.max(1, Math.min(99, v));
        const up = c >= 50;
        const left = Math.min(50, c);
        const width = Math.abs(c - 50);
        return `<div class="fp-bar-row">` +
            `<span class="fp-bar-label" title="${r.label}">${r.label}</span>` +
            `<span class="fp-bar-track fp-gauge"><span class="fp-gauge-mid"></span>` +
            `<span class="fp-gauge-fill ${up ? "fp-gauge-fill--up" : "fp-gauge-fill--down"}" style="left:${left}%;width:${width}%"></span></span>` +
            `<span class="fp-bar-val">${Math.round(v)}</span>` +
            `</div>`;
    }).join("");
}

// Student composition: race/ethnicity bars (when present) + student-group bars
// (High Needs, Low Income, EL, SWD). Used for districts, towns, and schools.
//   opts.race  — include the race/ethnicity group (towns don't carry it)
//   opts.title — section heading
//   opts.lead  — extra row HTML rendered above the bars (e.g. a town's enrollment)
function fpCompositionChart(p, opts = {}) {
    const title = opts.title || "Student composition";
    const race = opts.race !== false ? fpPctBars([
        { label: "Hispanic/Latino",   value: p.HL_PCT,  color: "cpal-purple" },
        { label: "White",             value: p.WH_PCT,  color: "cpal-teal" },
        { label: "Black/African Am.", value: p.BAA_PCT, color: "cpal-blue" },
        { label: "Asian",             value: p.AS_PCT,  color: "cpal-green" },
    ]) : "";
    const needs = fpPctBars([
        { label: "High Needs",        value: p.HN_PCT,  color: "cpal-amber" },
        { label: "Low Income",        value: p.LI_PCT,  color: "cpal-blue" },
        { label: "English Learner",   value: p.EL_PCT,  color: "cpal-teal" },
        { label: "Students w/ Disab.",value: p.SWD_PCT, color: "cpal-purple" },
    ]);
    if (!race && !needs && !opts.lead) return "";
    const raceBlock = race ? `<div class="co-subhead">Race / ethnicity</div>${race}` : "";
    const needsHead = race && needs ? `<div class="co-subhead" style="margin-top:8px;">Student groups</div>` : "";
    const needsBlock = needs ? `${needsHead}${needs}` : "";
    return `<div class="feature-panel-section">
        <h3>${title}</h3>
        ${opts.lead || ""}${raceBlock}${needsBlock}
    </div>`;
}

// MCAS Grade 10 proficiency (% Meeting/Exceeding) as bars with a dotted
// statewide-median tick. district: ELA/Math/Science; town: ELA/Math. Honors the
// active year via panelValue(); a blank subject explains itself instead of
// vanishing, and the whole card hides only when no subject reports (no HS).
function fpMcasChart(p, level) {
    const subjects = [
        { label: "ELA",     metric: "mcas_g10_ela_me",  color: "cpal-blue" },
        { label: "Math",    metric: "mcas_g10_math_me", color: "cpal-purple" },
    ];
    if (level !== "muni") subjects.push({ label: "Science", metric: "mcas_g10_sci_me", color: "cpal-teal" });
    let anyVal = false;
    const rows = subjects.map(s => {
        const v = panelValue(p, s.metric);
        if (v == null || !isFinite(+v)) {
            const why = blankReason(p, s.metric, "pct");
            return `<div class="fp-bar-row"><span class="fp-bar-label">${s.label}</span>` +
                `<span class="value value-nodata" title="${why}">— <span class="nodata-reason">${why}</span></span></div>`;
        }
        anyVal = true;
        return fpPctBars([{ label: s.label, value: +v, color: s.color, ref: fpStatMedian("district", s.metric) }]);
    }).join("");
    if (!anyVal) return "";
    return `<div class="feature-panel-section">
        <h3>MCAS Grade 10 · % Meeting or Exceeding</h3>
        <div class="co-subhead">Bars vs. ┊ statewide median (${state.year})</div>
        ${rows}
    </div>`;
}

// Postsecondary plans: a stacked bar of what graduating seniors plan to do next
// (4-year / 2-year / Work / Military), with an "Other / undecided" remainder so
// the bar always reads as a whole. A visual companion to the College outcomes
// card (plans vs. what actually happened).
function fpPostsecPlansChart(p) {
    const defs = [
        { label: "4-year college", value: +p.pct_4yr_college,   color: "cpal-blue" },
        { label: "2-year college", value: +p.pct_2yr_college,   color: "cpal-purple" },
        { label: "Work",           value: +p.pct_work_after_hs, color: "cpal-amber" },
        { label: "Military",       value: +p.pct_military,      color: "cpal-green" },
    ].filter(s => isFinite(s.value));
    if (!defs.length) return "";
    const sum = defs.reduce((a, s) => a + Math.max(0, s.value), 0);
    const denom = Math.max(sum, 1);
    const segs = defs.map(s => ({ label: s.label, frac: Math.max(0, s.value) / denom, color: s.color, valueText: fmt(s.value, "pct") }));
    const other = Math.max(0, 1 - sum);
    if (other > 0.005) segs.push({ label: "Other / undecided", frac: other / denom, color: "cpal-grey", valueText: fmt(other, "pct") });
    const aria = "Senior plans: " + segs.map(s => `${s.valueText} ${s.label}`).join(", ");
    return `<div class="feature-panel-section">
        <h3>Postsecondary plans</h3>
        <div class="co-subhead">What graduating seniors plan to do next:</div>
        ${fpStackBar(segs, aria)}
        <div class="feature-panel-note">Self-reported plans of the graduating class (MA DESE). Shares may not total 100% — "Other / undecided" is the remainder.</div>
    </div>`;
}

// Finance: a stacked bar of where each per-pupil dollar goes (Teachers / Pupil
// services / Administration), with "Other" filling out the total. Falls back to
// plain rows if there's no total to scale against.
function fpFinanceChart(p) {
    const total = +p.per_pupil;
    const parts = [
        { label: "Teachers",       value: +p.per_pupil_teachers,       color: "cpal-blue" },
        { label: "Pupil services", value: +p.per_pupil_pupil_services, color: "cpal-teal" },
        { label: "Administration", value: +p.per_pupil_admin,          color: "cpal-purple" },
    ].filter(s => isFinite(s.value) && s.value > 0);
    if (!isFinite(total) || total <= 0) {
        if (!parts.length) return "";
        return `<div class="feature-panel-section"><h3>Finance — per-pupil $</h3>${parts.map(s => fpRow(s.label, s.value, "usd")).join("")}</div>`;
    }
    const named = parts.reduce((a, s) => a + s.value, 0);
    const other = Math.max(0, total - named);
    const segs = parts.map(s => ({ label: s.label, frac: s.value / total, color: s.color, valueText: fmt(s.value, "usd") }));
    if (other > 0) segs.push({ label: "Other", frac: other / total, color: "cpal-grey", valueText: fmt(other, "usd") });
    const aria = `Per-pupil spending ${fmt(total, "usd")}: ` + segs.map(s => `${s.valueText} ${s.label}`).join(", ");
    return `<div class="feature-panel-section">
        <h3>Finance — per-pupil $</h3>
        <div class="co-subhead">Where each per-pupil dollar goes · ${fmt(total, "usd")} total</div>
        ${fpStackBar(segs, aria)}
        <div class="feature-panel-note">Reported per-pupil categories (MA DESE). "Other" is total spending minus the three named categories — instructional support, operations, benefits, and more.</div>
    </div>`;
}

// Student growth (SGP) as centered gauges around the 50 midline.
function fpGrowthChart(p) {
    const body = fpGrowthBars([
        { label: "MCAS ELA",       value: p.mcas_ela_sgp },
        { label: "MCAS Math",      value: p.mcas_math_sgp },
        { label: "MCAS Gr10 ELA",  value: p.mcas_ela_sgp_g10 },
        { label: "MCAS Gr10 Math", value: p.mcas_math_sgp_g10 },
        { label: "ELA — SWD",      value: p.mcas_ela_sgp_swd },
        { label: "Math — SWD",     value: p.mcas_math_sgp_swd },
    ]);
    if (!body.trim()) return "";
    return `<div class="feature-panel-section">
        <h3>Student growth · SGP</h3>
        <div class="co-subhead">1–99 growth percentile · the ┊ 50 midline is a typical year</div>
        <div class="fp-gauge-axis"><span>← less growth</span><span>more growth →</span></div>
        ${body}
    </div>`;
}

// ─── PEER (SIMILAR-DISTRICT) COMPARISON ───────────────────────────────────────
// DESE-DART-style "districts like this one": the nearest districts by size and
// student mix, so a value reads against fair peers, not just the whole state.
// K-8 districts peer with K-8, high-school districts with high-school districts.
const PEER_FEATURES = ["TOTAL_CNT", "LI_PCT", "EL_PCT", "SWD_PCT"];
function similarDistricts(p, n = 8) {
    const fc = GEO_DATA && GEO_DATA.district;
    if (!fc) return [];
    const vec = (props) => {
        const out = [];
        for (const k of PEER_FEATURES) {
            let v = +props[k];
            if (!isFinite(v)) return null;
            if (k === "TOTAL_CNT") v = Math.log10(Math.max(1, v));  // size spans orders of magnitude
            out.push(v);
        }
        return out;
    };
    const self = vec(p);
    if (!self) return [];
    // Candidates: other districts of the same high-school class, with full data.
    const pool = [];
    for (const f of fc.features) {
        if (f.properties.DIST_CODE === p.DIST_CODE) continue;
        if (Boolean(f.properties._nohs) !== Boolean(p._nohs)) continue;
        const v = vec(f.properties);
        if (v) pool.push({ f, v });
    }
    if (pool.length < 3) return [];
    // z-score each feature across the pool so no single axis dominates distance.
    const mean = PEER_FEATURES.map((_, i) => pool.reduce((a, o) => a + o.v[i], 0) / pool.length);
    const std = PEER_FEATURES.map((_, i) =>
        Math.sqrt(pool.reduce((a, o) => a + (o.v[i] - mean[i]) ** 2, 0) / pool.length) || 1);
    const z = (v) => v.map((x, i) => (x - mean[i]) / std[i]);
    const sz = z(self);
    return pool
        .map(o => ({ f: o.f, d: z(o.v).reduce((a, x, i) => a + (x - sz[i]) ** 2, 0) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, n)
        .map(o => o.f);
}

// Panel section: the peer list + where this district stands among them on the
// active metric. District level only (peers are a district concept).
function fpPeersSection(p) {
    if (state.level !== "district" || state.bivariate) return "";
    const peers = similarDistricts(p, 8);
    if (peers.length < 3) return "";
    const m = getMetric(state.metric), col = activeColumn();
    const valOf = (props) => { const v = +props[col]; return isFinite(v) ? v : null; };
    const selfVal = valOf(p);
    // Rank among peers (incl. self) that have a value, highest value first.
    const withVal = [p, ...peers.map(f => f.properties)].map(valOf).filter(v => v != null);
    let rankNote = "";
    if (selfVal != null && withVal.length >= 3) {
        const rank = withVal.filter(v => v > selfVal).length + 1;
        rankNote = `<div class="feature-panel-row"><span class="label">Among ${withVal.length} similar districts</span>` +
            `<span class="value"><strong>#${rank} of ${withVal.length}</strong> on ${m.label}</span></div>`;
    }
    const row = (props, self) => {
        const name = featureName(props, "district");
        const v = valOf(props);
        const vTxt = v != null ? fmt(v, m.format) : "—";
        if (self) return `<div class="feature-panel-row peer-self"><span class="label">${name} <em>(this district)</em></span><span class="value highlight">${vTxt}</span></div>`;
        return `<div class="feature-panel-row peer-row" role="button" tabindex="0" data-peer-code="${props.DIST_CODE}" title="Open ${name}"><span class="label">${name}</span><span class="value">${vTxt}</span></div>`;
    };
    const rows = row(p, true) + peers.map(f => row(f.properties, false)).join("");
    const note = `<div class="feature-panel-note">Most similar by enrollment & student mix (% low income, English learners, students with disabilities). Click a peer to open it.</div>`;
    return fpSection(`Similar districts · ${m.label}`, note + rankNote + rows);
}

// Fly to + open a district by code (used by the clickable peer rows).
function navigateToDistrict(code) {
    const fc = GEO_DATA && GEO_DATA.district;
    if (!fc) return;
    const feat = fc.features.find(f => f.properties.DIST_CODE === code);
    if (!feat) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = (c) => {
        if (typeof c[0] === "number") {
            minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
            minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
        } else c.forEach(walk);
    };
    if (feat.geometry && feat.geometry.coordinates) walk(feat.geometry.coordinates);
    if (isFinite(minX)) map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, duration: 700, essential: true });
    openFeaturePanel(feat.properties, "district");
}

// Status tags shown at the top of the district panel (what kind of district it is
// + whether the state has flagged it). Mirror the "Highlight a group" categories.
function fpDistrictTags(p) {
    const tags = [];
    const tag = (label, bg) => `<span class="feature-panel-tag" style="background:${bg};margin-right:5px;">${label}</span>`;
    if (p.is_gateway)       tags.push(tag("Gateway City", "#E1BEE7"));
    if (p.is_regional)      tags.push(tag("Regional district", "#E3F2FD"));
    if (p._nohs)            tags.push(tag("K-8 · no high school", "#E4E8F0"));
    if (p.is_state_flagged) tags.push(tag("State-flagged", "#FBD9D9"));
    return tags.length ? `<div class="feature-panel-tags">${tags.join("")}</div>` : "";
}

// "State accountability" row — DESE's ESSA classification (+ the granular reason),
// merged onto the feature from the accountability side file.
function fpAccountabilityRow(p) {
    const cls = p.accountability_class;
    if (!cls) return "";
    const rsn = p.accountability_reason && p.accountability_reason !== cls
        ? ` <span style="opacity:.65;font-weight:400;">(${p.accountability_reason})</span>` : "";
    return `<div class="feature-panel-row"><span class="label">State accountability</span><span class="value">${cls}${rsn}</span></div>`;
}

// Plain-language note for K-8 districts on why high-school metrics are blank.
function fpNoHsNote(p) {
    if (!p._nohs) return "";
    return `<div class="feature-panel-note">This is a <strong>K-8 district</strong> — it has no high school, so its students attend high school in another district. High-school measures (graduation, Gr10 MCAS, AP) are therefore blank here.</div>`;
}

function buildPanelHtml(p, kind) {
    if (kind === "school") {
        return `
            <div class="feature-panel-section">
                <div class="feature-panel-row"><span class="label">Type</span><span class="value">${p.TYPE_DESC || "—"}</span></div>
                <div class="feature-panel-row"><span class="label">Grades</span><span class="value">${p.GRADES || "—"}</span></div>
                ${fpRow("Enrollment", p.TOTAL_CNT, "num")}
            </div>
            ${fpCompositionChart(p, { race: true })}
        `;
    }
    if (kind === "muni") {
        const tagHtml = p.is_gateway
            ? '<div class="feature-panel-tag" style="background:#E1BEE7;">Gateway City</div>'
            : "";
        return `
            ${tagHtml}
            <div class="feature-panel-section">
                <div class="feature-panel-row"><span class="label">County</span><span class="value">${p.COUNTY || "—"}</span></div>
                ${fpRow("Population (2020)", p.POP2020 || p.pop_2020, "num")}
                ${fpRow("Density (per sq mi)", p._pop_density_per_sqmi, "num")}
                ${p.DIST_NAME ? `<div class="feature-panel-row"><span class="label">${p._dese_regional ? "Served by" : "Matched district"}</span><span class="value">${p.DIST_NAME}</span></div>` : ""}
            </div>
            ${p._dese_regional ? `<div class="feature-panel-note">${cmpEsc(p.town_display || p.TOWN)} belongs to the <strong>${cmpEsc(p._dese_source || p.DIST_NAME)}</strong> regional district, so the school figures below are reported <strong>district-wide</strong> (DESE doesn't break them out by town). Open <strong>district view</strong> for the full district.</div>` : ""}
            ${fpSection("Census ACS basics", [
                fpRow("Median household income", p.acs_median_household_income, "usd"),
                fpRow("% Bachelor's or higher", p.acs_bachelors_plus_pct, "pct"),
                fpRow("% Foreign-born", p.acs_foreign_born_pct, "pct"),
                fpRow("% non-English at home", p.acs_non_english_pct, "pct"),
                fpRow("% Children in poverty", p.acs_child_poverty_pct, "pct"),
                fpRow("% Severely rent-burdened", p.acs_severe_rent_burden_pct, "pct"),
            ].join(""))}
            ${fpCompositionChart(p, { race: false, title: "District composition", lead: fpRow("Enrollment", p.TOTAL_CNT, "num") })}
            ${fpSection(`District outcomes (${state.year})`, [
                fpOutcome(p, "4-yr Graduation", "grad_4yr"),
                fpOutcome(p, "Dropout", "dropout_pct"),
                fpRow("Chronic absent", p.chronic_absent_pct, "pct"),
            ].join(""))}
            ${fpMcasChart(p, "muni")}
            ${fpSection("Class size (avg students per class)", [
                fpRow("Overall", p.avg_class_size, "num"),
                fpRow("ELA", p.class_size_ela, "num"),
                fpRow("Math", p.class_size_math, "num"),
                fpRow("Science", p.class_size_science, "num"),
            ].join(""))}
            ${fpSection("Finance", [
                fpRow("Per-pupil $", p.per_pupil, "usd"),
            ].join(""))}
            ${fpActiveMetricSection(p)}
        `;
    }
    if (kind === "district") {
        // Student-support staffing ratios (attached at runtime from
        // ma_district_support.json). DESE omits a role entirely when its FTE is
        // 0 or unreported, and we can't tell those apart from the side-file — so
        // a missing value is labeled the truthful "Not separately reported"
        // rather than a fabricated ratio. Section is hidden if a district has no
        // support data at all (rather than showing five blank rows).
        const supportRows = [
            fpRowExplained("Students per counselor",     p.students_per_counselor,     "num", "Not separately reported"),
            fpRowExplained("Students per social worker",  p.students_per_social_worker, "num", "Not separately reported"),
            fpRowExplained("Students per psychologist",   p.students_per_psychologist,  "num", "Not separately reported"),
            fpRowExplained("Students per nurse",          p.students_per_nurse,         "num", "Not separately reported"),
            fpRowExplained("Students per librarian",      p.students_per_librarian,     "num", "Not separately reported"),
        ].join("");
        const hasSupport = [p.students_per_counselor, p.students_per_social_worker, p.students_per_psychologist, p.students_per_nurse, p.students_per_librarian]
            .some(v => v != null && isFinite(+v));
        const supportSection = hasSupport
            ? fpSection("Student support · students per staff member (lower = more support)", supportRows)
            : "";
        return `
            ${fpDistrictTags(p)}
            <div class="feature-panel-section">
                <div class="feature-panel-row"><span class="label">District code</span><span class="value">${p.DIST_CODE || "—"}</span></div>
                ${fpRow("Enrollment", p.TOTAL_CNT, "num")}
            </div>
            ${fpSection("At a glance", [
                fpOutcome(p, "4-yr graduation", "grad_4yr"),
                fpOutcome(p, "MCAS Gr10 ELA", "mcas_g10_ela_me"),
                fpOutcome(p, "MCAS Gr10 Math", "mcas_g10_math_me"),
                fpRow("Avg class size", p.avg_class_size, "num"),
                fpRow("Per-pupil spending", p.per_pupil, "usd"),
                fpRow("% Low income", p.LI_PCT, "pct"),
                fpAccountabilityRow(p),
            ].join(""))}
            ${fpNoHsNote(p)}
            ${fpPeersSection(p)}
            ${fpSection("Community — population & socioeconomics (Census ACS)", [
                fpRow("Population (2020)", p._pop_2020 || p.acs_total_population, "num"),
                fpRow("Population density (/sq mi)", p._pop_density_per_sqmi, "num"),
                fpRow("Area (sq mi)", p._area_sqmi, "num"),
                fpRow("Median household income", p.acs_median_household_income, "usd"),
                fpRow("% Bachelor's or higher", p.acs_bachelors_plus_pct, "pct"),
                fpRow("% Foreign-born", p.acs_foreign_born_pct, "pct"),
                fpRow("% Non-English at home", p.acs_non_english_pct, "pct"),
                fpRow("% Children in poverty", p.acs_child_poverty_pct, "pct"),
                fpRow("% Severely rent-burdened", p.acs_severe_rent_burden_pct, "pct"),
                fpRollupNote(p),
            ].join(""))}
            ${fpCompositionChart(p, { race: true })}
            ${fpSection("Early education (PreK / Kindergarten)", [
                fpRow("% in Full-Day Kindergarten", p.full_day_k_pct, "pct"),
                fpRow("Pre-K per Kindergartner", p.prek_per_k_ratio, "num"),
                fpRow("Pre-K enrollment", p.prek_enrollment, "num"),
                fpRow("Kindergarten enrollment", p.kindergarten_enrollment, "num"),
                fpRow("% of Pre-K low-income", p.prek_low_income_pct, "pct"),
            ].join(""))}
            ${fpMcasChart(p, "district")}
            ${fpSection(`Academic outcomes (${state.year})`, [
                fpOutcome(p, "4-yr Graduation", "grad_4yr"),
                fpOutcome(p, "5-yr Graduation", "grad_5yr"),
                fpOutcome(p, "Dropout", "dropout_pct"),
                fpRow("Attendance", p.attendance_rate, "pct"),
                fpRow("Chronic absent", p.chronic_absent_pct, "pct"),
                fpRow("MassCore completion", p.masscore_pct, "pct"),
                fpOutcome(p, "AP % scoring 3+", "ap_pct_3plus"),
            ].join(""))}
            ${fpGrowthChart(p)}
            ${fpSection("Class size (avg students per class)", [
                fpRow("Overall", p.avg_class_size, "num"),
                fpRow("ELA", p.class_size_ela, "num"),
                fpRow("Math", p.class_size_math, "num"),
                fpRow("Science", p.class_size_science, "num"),
            ].join(""))}
            ${fpPostsecPlansChart(p)}
            ${fpCollegeOutcomes(p)}
            ${fpFinanceChart(p)}
            ${fpSection("Workforce", [
                fpRow("Student : Teacher", p.stu_tchr_ratio, "num"),
                fpRow("% Experienced teachers", p.teacher_experienced_pct, "pct"),
                fpRow("% Teachers in-field", p.teacher_infield_pct, "pct"),
                fpRow("Teacher retention", p.teacher_retention_pct, "pct"),
                fpRow("% Staff: White", p.staff_white_pct, "pct"),
                fpRow("% Staff: Hispanic", p.staff_hispanic_pct, "pct"),
                fpRow("% Staff: Black", p.staff_black_pct, "pct"),
            ].join(""))}
            ${supportSection}
            ${fpActiveMetricSection(p)}
        `;
    }
    return `<div class="feature-panel-section">Click a feature on the map.</div>`;
}

// Wire close button + help modal (added once on load)
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.getElementById("featurePanelClose");
    if (closeBtn) closeBtn.addEventListener("click", closeFeaturePanel);

    // Clickable peer rows in the "Similar districts" section (event-delegated,
    // since the panel body is rebuilt as innerHTML on every selection).
    const fpBody = document.getElementById("featurePanelBody");
    if (fpBody) {
        const go = el => { const c = el.getAttribute("data-peer-code"); if (c) navigateToDistrict(c); };
        fpBody.addEventListener("click", e => {
            const el = e.target.closest("[data-peer-code]"); if (el) go(el);
        });
        fpBody.addEventListener("keydown", e => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const el = e.target.closest("[data-peer-code]");
            if (el) { e.preventDefault(); go(el); }
        });
    }

    // First-run orientation hint over the map (shown once; dismissal persists).
    const mapHint = document.getElementById("mapHint");
    const mapHintClose = document.getElementById("mapHintClose");
    let hintSeen = false;
    try { hintSeen = localStorage.getItem("ma-atlas-hint-seen") === "1"; } catch (e) {}
    if (mapHint && !hintSeen) mapHint.hidden = false;
    const dismissHint = () => {
        if (mapHint) mapHint.hidden = true;
        try { localStorage.setItem("ma-atlas-hint-seen", "1"); } catch (e) {}
    };
    if (mapHintClose) mapHintClose.addEventListener("click", dismissHint);

    // Comparison set: the feature-panel footer button adds the open place; the
    // top-level toggle enters/leaves the mode; the Places|Schools control picks
    // the kind; the compare panel's Reset/× exit, and a delegated handler runs
    // the per-member chips + Clear all + Charts.
    const compareStartBtn = document.getElementById("compareStartBtn");
    if (compareStartBtn) compareStartBtn.addEventListener("click", () => {
        const p = state.lastSelected;
        if (p && state.compareKind === "place" && inCompareSet(memberKey(p.kind, p.properties))) {
            removeMember(memberKey(p.kind, p.properties));
            renderComparison(); updateModeBar();
            openFeaturePanel(p.properties, p.kind);   // refresh the button label
        } else {
            addCurrentPlaceToCompare();
        }
    });
    const compareToggle = document.getElementById("compareToggle");
    if (compareToggle) compareToggle.addEventListener("change", toggleCompareMode);
    const compareKindWrap = document.getElementById("compareKindWrap");
    if (compareKindWrap) compareKindWrap.addEventListener("click", e => {
        const b = e.target.closest("[data-cmpkind]"); if (b) setCompareKind(b.dataset.cmpkind);
    });
    const compareResetBtn = document.getElementById("compareResetBtn");
    if (compareResetBtn) compareResetBtn.addEventListener("click", exitCompareMode);
    const compareCloseBtn = document.getElementById("compareCloseBtn");
    if (compareCloseBtn) compareCloseBtn.addEventListener("click", exitCompareMode);
    // Delegated actions inside the (re-rendered) compare panel body.
    const comparePanelEl = document.getElementById("comparePanel");
    if (comparePanelEl) comparePanelEl.addEventListener("click", e => {
        const rm = e.target.closest("[data-rmkey]");
        if (rm) { removeMember(rm.dataset.rmkey); renderComparison(); updateModeBar();
                  if (document.getElementById("graphModal")?.classList.contains("open") && state.graphScope === "set") renderGraph();
                  return; }
        const fly = e.target.closest("[data-flykey]");
        if (fly) { flyToMember(fly.dataset.flykey); return; }
        if (e.target.closest("#compareClearBtn")) { clearCompareSet(); renderComparison(); updateModeBar(); return; }
        if (e.target.closest("#compareChartsBtn")) { state.graphScope = "set"; openGraphModal(); return; }
    });

    // Escape exits compare mode if its panel is open, else closes the feature
    // detail panel (the help modal has its own Escape handler below).
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        const cp = document.getElementById("comparePanel");
        if (cp && cp.classList.contains("open")) { exitCompareMode(); return; }
        const fp = document.getElementById("featurePanel");
        if (fp && fp.classList.contains("open")) closeFeaturePanel();
    });

    // ── Help & guides hub — opens via the labeled pill. Three tabs (the map
    //    controls cheat-sheet by default, a plain-language how-to, and a
    //    glossary) plus a button that launches the interactive guided tour.
    //    Opt-in only; we never auto-open it (an unprompted popup ate screen
    //    space and confused desktop visitors).
    const helpBtn     = document.getElementById("helpButton");
    const helpModal   = document.getElementById("helpModal");
    const helpClose   = document.getElementById("helpModalClose");
    const helpDone    = document.getElementById("helpGotIt");
    const helpTourBtn = document.getElementById("helpStartTour");

    function markHelpSeen() {
        try { localStorage.setItem("ma-atlas-help-seen", "1"); } catch (e) {}
        if (helpBtn) helpBtn.classList.remove("pulse");
    }

    if (helpModal) {
        let _helpReturnFocus = null;
        const openHelp = () => {
            _helpReturnFocus = document.activeElement;
            helpModal.classList.add("open");
            helpModal.setAttribute("aria-hidden", "false");
            markHelpSeen();
            if (helpClose) helpClose.focus();
        };
        const closeHelp = () => {
            helpModal.classList.remove("open");
            helpModal.setAttribute("aria-hidden", "true");
            if (_helpReturnFocus && _helpReturnFocus.focus) _helpReturnFocus.focus();
        };

        // Tab switching within the hub.
        const tabs  = Array.from(helpModal.querySelectorAll(".help-tab"));
        const panes = Array.from(helpModal.querySelectorAll(".help-pane"));
        const hbody = helpModal.querySelector(".help-body");
        function selectTab(name) {
            tabs.forEach(t => {
                const on = t.dataset.helpTab === name;
                t.classList.toggle("active", on);
                t.setAttribute("aria-selected", on ? "true" : "false");
            });
            panes.forEach(p => {
                const on = p.dataset.helpPane === name;
                p.classList.toggle("active", on);
                p.hidden = !on;
            });
            if (hbody) hbody.scrollTop = 0;
        }
        tabs.forEach((t, i) => {
            t.addEventListener("click", () => selectTab(t.dataset.helpTab));
            // Left/right arrows move between tabs (a11y).
            t.addEventListener("keydown", e => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const nx = tabs[(i + dir + tabs.length) % tabs.length];
                nx.focus();
                selectTab(nx.dataset.helpTab);
            });
        });

        // Trap Tab within the modal while it's open (skip controls in hidden panes).
        helpModal.addEventListener("keydown", e => {
            if (e.key !== "Tab" || !helpModal.classList.contains("open")) return;
            const all = helpModal.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])");
            const f = Array.from(all).filter(el => el.offsetParent !== null);
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });

        if (helpBtn)   helpBtn.addEventListener("click", openHelp);
        if (helpClose) helpClose.addEventListener("click", closeHelp);
        if (helpDone)  helpDone.addEventListener("click", () => { markHelpSeen(); closeHelp(); });
        if (helpTourBtn) helpTourBtn.addEventListener("click", () => {
            markHelpSeen();
            closeHelp();
            startGuidedTour();
        });
        helpModal.addEventListener("click", e => {
            if (e.target === helpModal) closeHelp();   // click backdrop
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && helpModal.classList.contains("open")) closeHelp();
        });

        // First-visit discoverability: a subtle one-time pulse on the pill (no
        // popup). It stops the moment the visitor opens help.
        try {
            if (helpBtn && !localStorage.getItem("ma-atlas-help-seen")) {
                helpBtn.classList.add("pulse");
            }
        } catch (e) {}
    }

    // ── Interactive guided tour ──────────────────────────────────────────────
    // A spotlight overlay that points at the real controls, one step at a time.
    // Self-contained: it drives the panel + accordions directly so each step's
    // target is actually on screen (works on desktop and the mobile drawer).
    function startGuidedTour() {
        const tour     = document.getElementById("tour");
        const spot     = document.getElementById("tourSpotlight");
        const coach    = document.getElementById("tourCoach");
        const elStep   = document.getElementById("tourStep");
        const elTitle  = document.getElementById("tourTitle");
        const elBody   = document.getElementById("tourBody");
        const elDots   = document.getElementById("tourDots");
        const btnBack  = document.getElementById("tourBack");
        const btnNext  = document.getElementById("tourNext");
        const btnSkip  = document.getElementById("tourSkip");
        const btnClose = document.getElementById("tourClose");
        if (!tour || !coach) return;

        const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

        function openPanel() {
            const p = document.getElementById("controlPanel");
            if (!p) return;
            p.classList.add("open");
            p.classList.remove("collapsed");
            const bd = document.getElementById("panelBackdrop");
            if (isMobile() && bd) bd.classList.add("open");
        }
        function closePanel() {
            const p = document.getElementById("controlPanel");
            if (!p) return;
            p.classList.remove("open");
            if (isMobile()) p.classList.add("collapsed");
            const bd = document.getElementById("panelBackdrop");
            if (bd) bd.classList.remove("open");
        }
        function setAccordion(label, open) {
            document.querySelectorAll(".accordion-header").forEach(h => {
                const t = h.querySelector(".panel-h2");
                if (t && t.textContent.trim().toLowerCase() === label.toLowerCase()) {
                    h.setAttribute("aria-expanded", open ? "true" : "false");
                }
            });
        }

        const steps = [
            {
                title: "Welcome 👋",
                body: "This is the Massachusetts Education Atlas — every public school and district in the state on one map. Here's the 1-minute tour.",
                before: () => closePanel(),
            },
            {
                target: "#controlPanel",
                title: "Your control panel",
                body: "Everything you can do lives here: choose what to map, find places, compare them, restyle the map, and export.",
                before: () => openPanel(),
            },
            {
                target: "#placeSearch",
                title: "Find any place",
                body: "Search a town, district, or school by name — or open “jump to a region” for a quick hop around the state.",
                before: () => { openPanel(); setAccordion("New? Start Here.", true); },
            },
            {
                target: "#metricPickerButton",
                title: "Pick what to map",
                body: "This is the heart of the atlas. Choose a topic and every place is shaded by it — from MCAS scores to per-pupil spending.",
                before: () => { openPanel(); setAccordion("What to map", true); },
            },
            {
                target: "#graphOpenBtn",
                title: "Dig deeper",
                body: "Open Explore charts for distributions, scatter plots, and ranked leaderboards. Right here you can also compare two districts or highlight a whole group.",
                before: () => { openPanel(); setAccordion("What to map", true); },
            },
            {
                target: "#map",
                title: "Click for the full story",
                body: "Click any town or district on the map to open its profile — scores, trends over time, demographics, and finances.",
                before: () => closePanel(),
            },
            {
                target: "#legend",
                title: "Read the colors",
                body: "The legend explains what the shading means. It updates automatically whenever you change the topic.",
                before: () => closePanel(),
            },
            {
                target: "#helpButton",
                title: "That's it! 🎉",
                body: "Come back to this Help button anytime — for how-tos, the controls cheat-sheet, or to retake this tour.",
                before: () => closePanel(),
            },
        ];

        let idx = 0;
        const returnFocus = document.activeElement;

        // Build the progress dots.
        elDots.innerHTML = "";
        const dots = steps.map(() => {
            const d = document.createElement("span");
            d.className = "tour-dot";
            elDots.appendChild(d);
            return d;
        });

        function measure(sel) {
            if (!sel) return null;
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return null;   // not visible
            return r;
        }

        function placeSpotlight(rect) {
            if (!rect) {
                // No hole: collapse to an off-screen point so the 9999px shadow
                // dims the whole viewport and the gold ring stays out of sight.
                spot.style.width = "0px";
                spot.style.height = "0px";
                spot.style.top = "-100px";
                spot.style.left = "-100px";
                return;
            }
            const pad = 6;
            spot.style.top    = Math.max(0, rect.top - pad) + "px";
            spot.style.left   = Math.max(0, rect.left - pad) + "px";
            spot.style.width  = (rect.width + pad * 2) + "px";
            spot.style.height = (rect.height + pad * 2) + "px";
        }

        function placeCoach(rect) {
            const vw = window.innerWidth, vh = window.innerHeight;
            const cw = coach.offsetWidth, ch = coach.offsetHeight, m = 14;
            let top, left;
            if (!rect) {
                top = (vh - ch) / 2;
                left = (vw - cw) / 2;
            } else {
                const tall = rect.height > vh * 0.55;
                const rightRoom = rect.right + m + cw <= vw;
                const leftRoom  = rect.left - m - cw >= 0;
                if (tall && (rightRoom || leftRoom)) {
                    left = rightRoom ? rect.right + m : rect.left - m - cw;
                    top  = Math.min(Math.max(m, rect.top), vh - ch - m);
                } else if (rect.bottom + m + ch <= vh) {
                    top = rect.bottom + m;
                    left = rect.left + rect.width / 2 - cw / 2;
                } else if (rect.top - m - ch >= 0) {
                    top = rect.top - m - ch;
                    left = rect.left + rect.width / 2 - cw / 2;
                } else {
                    top = (vh - ch) / 2;
                    left = (vw - cw) / 2;
                }
            }
            coach.style.left = Math.min(Math.max(m, left), vw - cw - m) + "px";
            coach.style.top  = Math.min(Math.max(m, top), vh - ch - m) + "px";
        }

        function reposition() {
            const rect = measure(steps[idx].target);
            placeSpotlight(rect);
            placeCoach(rect);
        }

        function render() {
            const step = steps[idx];
            elStep.textContent = `Step ${idx + 1} of ${steps.length}`;
            elTitle.textContent = step.title;
            elBody.textContent = step.body;
            dots.forEach((d, i) => d.classList.toggle("on", i === idx));
            btnBack.disabled = idx === 0;
            btnNext.textContent = idx === 0 ? "Start →"
                                : idx === steps.length - 1 ? "Done"
                                : "Next →";
            btnSkip.style.visibility = idx === steps.length - 1 ? "hidden" : "visible";

            if (step.before) { try { step.before(); } catch (e) {} }

            const target = step.target ? document.querySelector(step.target) : null;
            if (target && target.scrollIntoView) {
                try { target.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
            }
            // Place now, then again after layout + transitions settle.
            reposition();
            setTimeout(reposition, 230);
            setTimeout(() => { reposition(); btnNext.focus(); }, 380);
        }

        function go(n) { idx = Math.min(Math.max(0, n), steps.length - 1); render(); }
        function next() { if (idx >= steps.length - 1) end(); else go(idx + 1); }

        function end() {
            tour.classList.remove("open");
            tour.setAttribute("aria-hidden", "true");
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onResize, true);
            window.removeEventListener("keydown", onKey, true);
            if (isMobile()) closePanel();   // tidy the drawer we may have opened
            if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) {} }
        }

        const onResize = () => reposition();
        const onKey = (e) => {
            if (e.key === "Escape")          { e.preventDefault(); e.stopPropagation(); end(); }
            else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
            else if (e.key === "ArrowLeft")  { e.preventDefault(); go(idx - 1); }
            else if (e.key === "Tab") {
                const f = Array.from(coach.querySelectorAll("button:not([disabled])"))
                    .filter(el => el.offsetParent !== null && el.style.visibility !== "hidden");
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        // Wire controls with onclick so re-running the tour never stacks listeners.
        btnNext.onclick  = next;
        btnBack.onclick  = () => go(idx - 1);
        btnSkip.onclick  = end;
        btnClose.onclick = end;

        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onResize, true);
        window.addEventListener("keydown", onKey, true);

        tour.classList.add("open");
        tour.setAttribute("aria-hidden", "false");
        go(0);
    }

    // PNG export — the "Export image…" button opens the Export Studio modal
    // (openExportModal, below), where the user sets the title, combines legends,
    // chooses framing + resolution, and previews before downloading. Framing
    // scopes (current / state / selection / search) resolve to a bbox in
    // resolveExportBbox(); state.exportScope holds the last-used framing.

    // Build the legend entries (color + label rows) that match what's drawn in
    // the on-screen legend, so the PNG carries its own key.
    function legendEntriesForExport() {
        const { level, metric, palette, classify } = state;
        const m = getMetric(metric);
        const values = getValuesForLevel(level, metric);
        if (state.bivariate || values.length === 0) return null;
        // Carry the no-data count so the exported PNG's key explains its cream
        // polygons, just like the on-screen legend does.
        const totalF = GEO_DATA[level] ? GEO_DATA[level].features.length : values.length;
        const nodata = Math.max(0, totalF - values.length);
        // In change mode the values are deltas — format with sign + pts/$/%.
        const inChange = changeActive(metric, level);
        const vf = inChange ? (x => fmtChangeDelta(x, m)) : (x => fmt(x, m.format));

        if (classify === "continuous") {
            const min = Math.min(...values), max = Math.max(...values);
            const stops = sampleColors(palColors(palette), 5);
            return {
                continuous: true, colors: stops,
                minLabel: vf(min), maxLabel: vf(max), nodata,
            };
        }
        const n = classCount(classify, values);
        const breaks = computeBreaks(values, classify, n);
        if (!breaks.length) return null;
        const stops = stopsForClasses(palette, breaks, values);
        const rows = [{ color: stops[0], label: `< ${vf(breaks[0])}` }];
        for (let i = 0; i < breaks.length - 1; i++) {
            rows.push({ color: stops[i + 1], label: `${vf(breaks[i])} – ${vf(breaks[i + 1])}` });
        }
        rows.push({ color: stops[breaks.length], label: `≥ ${vf(breaks[breaks.length - 1])}` });
        return { continuous: false, rows, nodata };
    }

    // Auto-generated title, centered along the top of the export. The metric
    // label is the headline; a subtitle adds geography + classification context.
    const CLASSIFY_LABELS = {
        jenks: "Jenks natural breaks", quantile: "Quantiles", equal: "Equal interval",
        stddev: "Standard deviation", geometric: "Geometric interval",
        pretty: "Pretty breaks", continuous: "Continuous", manual: "Manual breaks",
    };
    function exportTitleText(m) {
        if (state.bivariate) return `${m.label}  ×  ${getMetric(state.bivarMetricB).label}`;
        // Change mode: name the span instead of a single year.
        if (changeActive(state.metric, state.level)) return `${m.label} — change ${state.changeFrom}→${state.changeTo}`;
        let title = m.label;
        // Append the active year for year-keyed metrics whose label has no year.
        if (isYearKeyed(state.metric, state.level) && !/\(\d{4}\)/.test(title)) title += ` (${state.year})`;
        return title;
    }
    // Default subtitle line: geography + (student group) + classification. Used to
    // pre-fill the Export Studio's subtitle field; the user can edit or clear it.
    function exportSubtitleText(m) {
        const levelNoun = state.level === "muni" ? "municipalities" : "school districts";
        const group = state.studentGroup && state.studentGroup !== "all" ? ` · ${state.studentGroup}` : "";
        return `Massachusetts ${levelNoun}${group} · ${CLASSIFY_LABELS[state.classify] || state.classify}`;
    }
    // Header pill (title + optional subtitle), centered along the top. Both strings
    // are supplied by the Export Studio (user-editable); empty strings are skipped.
    function drawExportHeader(ctx, W, title, subtitle) {
        title = (title || "").trim();
        subtitle = (subtitle || "").trim();
        if (!title && !subtitle) return;
        ctx.textAlign = "center";
        ctx.font = "bold 24px Inter, sans-serif";
        const tW = title ? ctx.measureText(title).width : 0;
        ctx.font = "13px Inter, sans-serif";
        const sW = subtitle ? ctx.measureText(subtitle).width : 0;
        const pillW = Math.max(tW, sW) + 44;
        const pillH = (title && subtitle) ? 58 : (title ? 44 : 36);
        const cx = W / 2, py = 16;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(10,31,68,0.12)";
        ctx.lineWidth = 1;
        roundRect(ctx, cx - pillW / 2, py, pillW, pillH, 10); ctx.fill(); ctx.stroke();
        if (title) {
            ctx.fillStyle = "#0A1F44";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.fillText(title, cx, py + 29);
        }
        if (subtitle) {
            ctx.fillStyle = "#566873";
            ctx.font = "13px Inter, sans-serif";
            ctx.fillText(subtitle, cx, title ? py + 48 : py + 23);
        }
        ctx.textAlign = "left";
    }
    // Optional free-text caption pill, centered just above the credit chip.
    function drawExportCaption(ctx, W, H, caption) {
        caption = (caption || "").trim();
        if (!caption) return;
        ctx.font = "13px Inter, sans-serif";
        const cw = ctx.measureText(caption).width;
        const chipW = Math.min(W - 32, cw + 24), chipH = 24;
        const x = (W - chipW) / 2, y = H - 22 - 14 - chipH - 6;   // just above the credit chip
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(10,31,68,0.12)";
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, chipW, chipH, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#37474F";
        ctx.textAlign = "center";
        ctx.fillText(clipExportText(ctx, caption, chipW - 18), W / 2, y + 16);
        ctx.textAlign = "left";
    }
    // Shared single-line clipper (… ellipsis) used by the header/caption/legend.
    function clipExportText(ctx, s, max) {
        if (ctx.measureText(s).width <= max) return s;
        let t = s;
        while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
        return t + "…";
    }

    // Credit chip — centered along the bottom edge, always drawn. Mirrors the
    // always-visible on-map credit (#mapCredit).
    function drawExportCredit(ctx, W, H) {
        ctx.font = "12px Inter, sans-serif";
        const credit = "© Maxwell Howe · MA DESE · US Census · MassGIS · OpenFreeMap";
        const cw = ctx.measureText(credit).width;
        const chipW = cw + 20, chipH = 22, x = (W - chipW) / 2, y = H - chipH - 14;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(10,31,68,0.15)";
        ctx.lineWidth = 1;
        roundRect(ctx, x, y, chipW, chipH, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#37474F";
        ctx.textAlign = "left";
        ctx.fillText(credit, x + 10, y + 15);
    }

    // Auto-dodge the legend: scale bar takes a bottom corner, north arrow a top
    // corner, both on the side OPPOSITE the legend. The title pill (top-centre)
    // and credit chip (bottom-centre) are always centred, so corners stay clear.
    function overlayCorners(legendCorner) {
        const onLeft = (legendCorner || "bl").indexOf("l") >= 0;
        return { scale: onLeft ? "br" : "bl", arrow: onLeft ? "tr" : "tl" };
    }

    // Scale bar — imperial (matches the on-map ScaleControl). Picks a nice round
    // distance for the captured zoom; drawn in a legend-dodging bottom corner,
    // lifted above the centred credit chip.
    function drawScaleBar(ctx, W, H, base, opts) {
        if (opts.scaleBar === false || !base || !base.metersPerPx) return;
        const mpp = base.metersPerPx;
        const niceRound = d => { const p = Math.pow(10, Math.floor(Math.log10(d))); const f = d / p; return p * (f >= 10 ? 10 : f >= 5 ? 5 : f >= 3 ? 3 : f >= 2 ? 2 : 1); };
        const maxMeters = 130 * mpp;
        let label, distMeters;
        if (maxMeters / 1609.344 >= 1) { const mi = niceRound(maxMeters / 1609.344); label = mi + (mi === 1 ? " mile" : " miles"); distMeters = mi * 1609.344; }
        else { const ft = niceRound(maxMeters / 0.3048); label = ft.toLocaleString() + " ft"; distMeters = ft * 0.3048; }
        const barPx = distMeters / mpp;
        ctx.font = "12px Inter, sans-serif";
        const chipPad = 7, barH = 6, textH = 13;
        const chipW = Math.max(barPx, ctx.measureText(label).width) + chipPad * 2;
        const chipH = chipPad * 2 + textH + 5 + barH;
        const margin = 16;
        const x = overlayCorners(opts.corner).scale.indexOf("r") >= 0 ? W - chipW - margin : margin;
        const y = H - chipH - 44;                // above the centred credit chip
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(10,31,68,0.15)"; ctx.lineWidth = 1;
        roundRect(ctx, x, y, chipW, chipH, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#37474F"; ctx.textAlign = "left";
        ctx.fillText(label, x + chipPad, y + chipPad + 10);
        const bx = x + chipPad, by = y + chipPad + textH + 4;
        ctx.fillStyle = "#0A1F44"; ctx.fillRect(bx, by, barPx, barH);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(bx + 1, by + 1, Math.max(0, barPx / 2 - 1), barH - 2);
    }

    // North arrow — "N" + triangle in a legend-dodging top corner. The triangle
    // rotates with the captured map bearing (0 for every region preset).
    function drawNorthArrow(ctx, W, H, base, opts) {
        if (opts.northArrow === false) return;
        const size = 34, margin = 16;
        const x = overlayCorners(opts.corner).arrow.indexOf("r") >= 0 ? W - size - margin : margin;
        const y = margin + ((opts.title || opts.subtitle) ? 64 : 0);
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.strokeStyle = "rgba(10,31,68,0.15)"; ctx.lineWidth = 1;
        roundRect(ctx, x, y, size, size, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#0A1F44"; ctx.font = "bold 11px Inter, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("N", x + size / 2, y + 13);
        ctx.save();
        ctx.translate(x + size / 2, y + 24);
        ctx.rotate(-((base && base.bearing) || 0) * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(5, 7); ctx.lineTo(0, 4); ctx.lineTo(-5, 7); ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.textAlign = "left";
    }

    // Optional callout label, placed by clicking the preview. A red marker dot at
    // the chosen point with a leader to a navy text chip — for pointing at "your"
    // district on a board slide. Position is normalised (0-1) so it survives the
    // preview->download resolution jump. Drawn last so it sits on top of everything.
    function drawAnnotation(ctx, W, H, opts) {
        const a = opts.annotation;
        if (!a || !a.text || !a.text.trim()) return;
        const text = a.text.trim();
        const px = Math.max(0, Math.min(1, a.x)) * W;
        const py = Math.max(0, Math.min(1, a.y)) * H;
        ctx.font = "bold 13px Inter, sans-serif";
        const padX = 9, chipH = 24;
        const chipW = ctx.measureText(text).width + padX * 2;
        let cx = px + 16, cy = py - 34;
        if (cx + chipW > W - 8) cx = px - 16 - chipW;   // flip left near the right edge
        if (cy < 8) cy = py + 16;                       // flip down near the top edge
        ctx.strokeStyle = "#0A1F44"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(cx < px ? cx + chipW : cx, cy + chipH / 2); ctx.stroke();
        ctx.fillStyle = "rgba(10,31,68,0.94)";
        roundRect(ctx, cx, cy, chipW, chipH, 5); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(text, cx + padX, cy + 16);
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#C8102E"; ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = "left";
    }

    // Big year badge for the time-lapse video — a video/GIF has no slider, so the
    // year must live IN the frame. Sits in the legend's vertical-flip corner (same
    // side, opposite top/bottom): that's the one corner left clear of the legend,
    // the scale bar (opposite-bottom), the north arrow (opposite-top), and the
    // centred title/credit.
    function drawExportYearBadge(ctx, W, H, year) {
        const txt = String(year);
        ctx.font = "bold 40px Inter, sans-serif";
        const tw = ctx.measureText(txt).width;
        const bw = tw + 36, bh = 60, margin = 16;
        const oppo = { bl: "tl", br: "tr", tl: "bl", tr: "br" }[(exportStudio.opts.corner || "bl")] || "tl";
        const x = oppo.indexOf("r") >= 0 ? W - bw - margin : margin;
        const y = oppo.indexOf("t") >= 0 ? margin + 64 : H - bh - margin;   // clear the title pill if on top
        ctx.fillStyle = "rgba(10,31,68,0.86)";
        roundRect(ctx, x, y, bw, bh, 10); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(txt, x + bw / 2, y + bh / 2 + 2);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }

    // Draw the legend card into the BOTTOM-LEFT of the export canvas (clear of
    // the bottom-right credit chip). Always drawn when there's data to show.
    // ── Combined legend stack ────────────────────────────────────────────────
    // The exported PNG carries ONE legend card that auto-combines a block for
    // every visible layer: the choropleth metric (or the bivariate grid), the
    // school dots, the college dots, and reference overlays. Each block measures
    // itself ({ key, width, height, draw }) in logical px so drawLegendStack()
    // can stack the blocks in a single card, place it in any corner, and fall
    // back to two columns (then a shrink) when the stack is tall.
    const LEG = { pad: 12, divGap: 9, colGap: 14, headH: 17, rowH: 19, sw: 15 };

    // A layer is "on the map" only if it exists AND isn't visibility:none — this
    // is the source of truth for what the captured bitmap actually shows.
    function layerVisible(id) {
        return !!map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none";
    }

    const HIGHLIGHT_LABELS = {
        gateway: "Gateway Cities", regional: "Regional / multi-town", nohs: "K-8 / no high school",
        stateflag: "State-flagged (needs assistance)", top10: "Highest 10% — current metric",
        bottom10: "Lowest 10% — current metric",
    };
    // Visible reference overlays → [{ color, label, line, dash }]. Shared by the
    // modal's checkbox detector AND the reference legend block, so they agree.
    function referenceItems() {
        const items = [];
        const addLine = (id, label, dash) => {
            if (layerVisible(id)) items.push({ color: map.getPaintProperty(id, "line-color"), label, line: true, dash });
        };
        addLine("voctech-outline", "Regional Vocational", true);
        addLine("charter-outline", "Charter districts", true);
        addLine("collab-outline", "Education Collaboratives", true);
        addLine("union-outline", "Superintendency Unions", true);
        if (state.level === "district" && layerVisible("nonop-fill"))
            items.push({ color: map.getPaintProperty("nonop-fill", "fill-color"), label: "No operating district", line: false });
        if (layerVisible("highlight-line"))
            items.push({ color: map.getPaintProperty("highlight-line", "line-color"), label: HIGHLIGHT_LABELS[state.highlightGroup] || "Highlighted group", line: true });
        return items;
    }

    // Which legend blocks exist for the CURRENT map (drives the modal's "Legends
    // to include" checkboxes). Returns [{ key, label }].
    function availableLegendBlocks() {
        const out = [];
        if (state.bivariate && _lastBivar) out.push({ key: "metric", label: "Two-variable key" });
        else if (legendEntriesForExport()) out.push({ key: "metric", label: getMetric(state.metric).label });
        if (layerVisible("ma-schools-circles") || layerVisible("ma-private-schools-circles")) out.push({ key: "schools", label: "Schools" });
        if (layerVisible("ma-colleges-circles")) out.push({ key: "colleges", label: "Colleges" });
        if (referenceItems().length) out.push({ key: "reference", label: "Reference layers" });
        return out;
    }

    // Block primitives (all assume a logical-px ctx; each sets its own font before
    // measuring/drawing, since a previous block leaves the font state dirty).
    function legTextW(ctx, s, font) { ctx.font = font; return ctx.measureText(s).width; }
    function legHeading(ctx, text, x, y, w) {
        ctx.fillStyle = "#0A1F44"; ctx.font = "bold 12px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(clipExportText(ctx, text, w), x, y + 12);
    }
    function legSwatchRow(ctx, x, y, color, label) {
        const sw = LEG.sw;
        ctx.fillStyle = color || "#fff";
        roundRect(ctx, x, y, sw, sw, 3); ctx.fill();
        ctx.strokeStyle = "rgba(10,31,68,0.30)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#0A1F44"; ctx.font = "12px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(label, x + sw + 8, y + sw - 3);
    }
    function legDotRow(ctx, x, y, color, label, stroke) {
        const r = 6, cy = y + LEG.sw / 2;
        ctx.beginPath(); ctx.arc(x + r, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color || "#fff"; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
        ctx.fillStyle = "#0A1F44"; ctx.font = "12px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(label, x + r * 2 + 8, y + LEG.sw - 3);
    }
    function legLineRow(ctx, x, y, color, label, dash) {
        const cy = y + LEG.sw / 2;
        ctx.strokeStyle = color || "#0A1F44"; ctx.lineWidth = 2.4;
        if (dash) ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + LEG.sw + 4, cy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#0A1F44"; ctx.font = "12px Inter, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(label, x + LEG.sw + 12, y + LEG.sw - 3);
    }

    // Build a block from a row spec. Measuring and drawing iterate the SAME rows
    // with the same height rules, so measured height always matches what's drawn.
    // Row kinds: swatch | dot | line | bar | sizedots.
    function makeLegBlock(ctx, key, spec) {
        const rows = spec.rows || [];
        let w = spec.heading ? legTextW(ctx, spec.heading, "bold 12px Inter, sans-serif") : 0;
        if (spec.sublabel) w = Math.max(w, legTextW(ctx, spec.sublabel, "11px Inter, sans-serif"));
        let h = (spec.heading ? LEG.headH : 0) + (spec.sublabel ? 13 : 0);
        rows.forEach(r => {
            if (r.kind === "bar") { w = Math.max(w, 150); h += 30; }
            else if (r.kind === "sizedots") {
                const dia = r.dots.reduce((mx, d) => Math.max(mx, d.d), 0);
                let rw = 0; r.dots.forEach(d => { rw += Math.max(d.d, legTextW(ctx, d.label, "10px Inter, sans-serif")) + 12; });
                w = Math.max(w, rw); h += Math.max(dia, 14) + 14;
            } else {
                const indent = r.kind === "dot" ? 20 : LEG.sw + (r.kind === "line" ? 12 : 8);
                w = Math.max(w, indent + legTextW(ctx, r.label, "12px Inter, sans-serif")); h += LEG.rowH;
            }
        });
        return {
            key, width: Math.ceil(w), height: Math.ceil(h),
            draw(ctx, x, y, cw) {
                let ry = y;
                if (spec.heading) { legHeading(ctx, spec.heading, x, ry, cw); ry += LEG.headH; }
                if (spec.sublabel) {
                    ctx.fillStyle = "#607D8B"; ctx.font = "11px Inter, sans-serif"; ctx.textAlign = "left";
                    ctx.fillText(clipExportText(ctx, spec.sublabel, cw), x, ry + 9); ry += 13;
                }
                rows.forEach(r => {
                    if (r.kind === "bar") {
                        const grad = ctx.createLinearGradient(x, 0, x + cw, 0);
                        r.colors.forEach((c, i) => grad.addColorStop(i / (r.colors.length - 1), c));
                        ctx.fillStyle = grad; ctx.fillRect(x, ry, cw, 13);
                        ctx.strokeStyle = "rgba(10,31,68,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x, ry, cw, 13);
                        ctx.fillStyle = "#37474F"; ctx.font = "11px Inter, sans-serif";
                        ctx.textAlign = "left"; ctx.fillText(r.min, x, ry + 26);
                        ctx.textAlign = "right"; ctx.fillText(r.max, x + cw, ry + 26); ctx.textAlign = "left";
                        ry += 30;
                    } else if (r.kind === "sizedots") {
                        const dia = r.dots.reduce((mx, d) => Math.max(mx, d.d), 0);
                        const base = ry + dia; let dx = x;
                        r.dots.forEach(d => {
                            const cell = Math.max(d.d, legTextW(ctx, d.label, "10px Inter, sans-serif")) + 12;
                            ctx.beginPath(); ctx.arc(dx + d.d / 2, base - d.d / 2, d.d / 2, 0, Math.PI * 2);
                            ctx.fillStyle = "rgba(120,134,148,0.55)"; ctx.fill();
                            ctx.strokeStyle = "#607D8B"; ctx.lineWidth = 1; ctx.stroke();
                            ctx.fillStyle = "#37474F"; ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "center";
                            ctx.fillText(d.label, dx + d.d / 2, base + 11); ctx.textAlign = "left";
                            dx += cell;
                        });
                        ry += Math.max(dia, 14) + 14;
                    } else if (r.kind === "line") { legLineRow(ctx, x, ry, r.color, r.label, r.dash); ry += LEG.rowH; }
                    else if (r.kind === "dot") { legDotRow(ctx, x, ry, r.color, r.label, r.stroke); ry += LEG.rowH; }
                    else { legSwatchRow(ctx, x, ry, r.color, r.label); ry += LEG.rowH; }
                });
            },
        };
    }

    function measureChoroplethBlock(ctx, opts) {
        // opts.animLegend (timelapse) supplies a fixed legend so colors mean the
        // same thing in every frame; otherwise recompute from the current view.
        const leg = (opts && opts.animLegend) ? opts.animLegend : legendEntriesForExport();
        if (!leg) return null;
        const m = getMetric(state.metric);
        const unit = changeActive(state.metric, state.level) ? changeUnitLabel(m) : metricUnit(m);
        const rows = [];
        if (leg.continuous) rows.push({ kind: "bar", colors: leg.colors, min: leg.minLabel, max: leg.maxLabel });
        else leg.rows.forEach(r => rows.push({ kind: "swatch", color: r.color, label: r.label }));
        // No-data: stills show a live count; timelapse uses a count-less label
        // because the missing-data set changes year to year.
        if (leg.nodataLabel) rows.push({ kind: "swatch", color: NO_DATA_COLOR, label: leg.nodataLabel });
        else if (leg.nodata) rows.push({ kind: "swatch", color: NO_DATA_COLOR, label: `No data (${leg.nodata.toLocaleString()})` });
        return makeLegBlock(ctx, "metric", { heading: m.label, sublabel: unit || "", rows });
    }

    // 3×3 bivariate grid block — special-cased (not a row kind). Mirrors the
    // on-screen grid: row 0 = high A (top), col 2 = high B (right).
    function measureBivariateBlock(ctx) {
        if (!(state.bivariate && _lastBivar)) return null;
        const m = getMetric(state.metric), mB = getMetric(state.bivarMetricB);
        const colors = (_lastBivar.palette && _lastBivar.palette.colors) || [];
        if (colors.length < 9) return null;
        const cells = [6, 7, 8, 3, 4, 5, 0, 1, 2];
        const cell = 22, grid = cell * 3, axisL = 16, axisB = 15;
        const lvl = state.level, fcb = GEO_DATA[lvl], totalb = fcb ? fcb.features.length : 0;
        const cA = activeColumn(state.metric, state.year, lvl), cB = activeColumn(state.bivarMetricB, state.year, lvl);
        let bothb = 0;
        if (fcb) fcb.features.forEach(f => { const a = f.properties[cA], b = f.properties[cB]; if (a != null && isFinite(+a) && b != null && isFinite(+b)) bothb++; });
        const ndb = Math.max(0, totalb - bothb);
        const uA = metricUnit(m), uB = metricUnit(mB);
        const labA = `${m.label}${uA ? ` (${uA})` : ""} →`, labB = `${mB.label}${uB ? ` (${uB})` : ""} →`;
        const heading = "Two-variable key";
        const w = Math.max(legTextW(ctx, heading, "bold 12px Inter, sans-serif"), axisL + grid);
        const height = LEG.headH + grid + axisB + (ndb ? 16 : 0);
        return {
            key: "metric", width: Math.ceil(w), height: Math.ceil(height),
            draw(ctx, x, y, cw) {
                legHeading(ctx, heading, x, y, cw);
                const gx = x + axisL, gy = y + LEG.headH;
                cells.forEach((ci, idx) => {
                    const r = Math.floor(idx / 3), c = idx % 3;
                    ctx.fillStyle = colors[ci]; ctx.fillRect(gx + c * cell, gy + r * cell, cell, cell);
                    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1; ctx.strokeRect(gx + c * cell, gy + r * cell, cell, cell);
                });
                ctx.fillStyle = "#37474F"; ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "left";
                ctx.fillText(clipExportText(ctx, labB, grid + axisL), gx, gy + grid + 12);
                ctx.save(); ctx.translate(x + 10, gy + grid); ctx.rotate(-Math.PI / 2);
                ctx.textAlign = "left"; ctx.fillText(clipExportText(ctx, labA, grid), 0, 0); ctx.restore();
                if (ndb) {
                    const ny = gy + grid + axisB + 8;
                    ctx.fillStyle = NO_DATA_COLOR; roundRect(ctx, gx, ny - 9, 11, 11, 2); ctx.fill();
                    ctx.strokeStyle = "rgba(10,31,68,0.25)"; ctx.lineWidth = 1; ctx.stroke();
                    ctx.fillStyle = "#37474F"; ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "left";
                    ctx.fillText(`No data (${ndb.toLocaleString()})`, gx + 15, ny);
                }
            },
        };
    }

    function measureSchoolsBlock(ctx) {
        const pub = layerVisible("ma-schools-circles"), priv = layerVisible("ma-private-schools-circles");
        if (!pub && !priv) return null;
        const mode = (document.querySelector('input[name="school-color-mode"]:checked') || {}).value || "level";
        const rows = [];
        if (pub && mode === "level") {
            const checked = Array.from(document.querySelectorAll('#school-chips input[type=checkbox][data-level]:checked')).map(b => b.dataset.level);
            const show = checked.length ? checked : SCHOOL_LEVELS.map(l => l.key);
            SCHOOL_LEVELS.filter(l => show.includes(l.key)).forEach(l => rows.push({ kind: "dot", color: l.color, label: l.label }));
        } else if (pub && mode === "acct") {
            rows.push({ kind: "bar", colors: ["#d73027", "#fc8d59", "#fee08b", "#91cf60", "#1a9850"], min: "Low (1)", max: "High (99)" });
            rows.push({ kind: "dot", color: "#b8c2cc", label: "No accountability data" });
        }
        if (priv) rows.push({ kind: "dot", color: "#ECEFF1", label: "Private (reference)", stroke: "#546E7A" });
        const z = map.getZoom();
        const dots = SCHOOL_SIZE_LEGEND_ENROLLMENTS.map(e => ({ d: Math.max(6, Math.round(schoolDotRadius(e, z) * 2)), label: e.toLocaleString() }));
        rows.push({ kind: "sizedots", dots });
        return makeLegBlock(ctx, "schools", { heading: "Schools", sublabel: "dot size = enrollment", rows });
    }

    function measureCollegesBlock(ctx) {
        if (!layerVisible("ma-colleges-circles")) return null;
        const rows = [];
        const checked = Array.from(document.querySelectorAll('#college-sector-chips input[type=checkbox][data-sector]:checked')).map(b => b.getAttribute("data-sector"));
        const show = checked.length ? checked : COLLEGE_SECTORS.map(s => s.key);
        COLLEGE_SECTORS.filter(s => show.includes(s.key)).forEach(s => rows.push({ kind: "dot", color: s.color, label: s.label }));
        const z = map.getZoom();
        const dots = COLLEGE_SIZE_LEGEND_ENROLLMENTS.map(e => ({ d: Math.max(6, Math.round(collegeDotRadius(e, z) * 2)), label: e.toLocaleString() }));
        rows.push({ kind: "sizedots", dots });
        return makeLegBlock(ctx, "colleges", { heading: "Colleges", sublabel: "dot size = enrollment", rows });
    }

    function measureReferenceBlock(ctx) {
        const items = referenceItems();
        if (!items.length) return null;
        const rows = items.map(it => it.line
            ? { kind: "line", color: it.color, label: it.label, dash: it.dash }
            : { kind: "swatch", color: it.color, label: it.label });
        return makeLegBlock(ctx, "reference", { heading: "Reference", rows });
    }

    function buildLegendBlocks(ctx, opts) {
        const en = (opts && opts.blocksEnabled) || {};
        const on = k => en[k] !== false;   // blocks default to enabled
        const blocks = [];
        if (on("metric")) {
            const b = (state.bivariate && _lastBivar) ? measureBivariateBlock(ctx) : measureChoroplethBlock(ctx, opts);
            if (b) blocks.push(b);
        }
        if (on("schools")) { const b = measureSchoolsBlock(ctx); if (b) blocks.push(b); }
        if (on("colleges")) { const b = measureCollegesBlock(ctx); if (b) blocks.push(b); }
        if (on("reference")) { const b = measureReferenceBlock(ctx); if (b) blocks.push(b); }
        return blocks;
    }

    // Lay the blocks into one card: single column, or two columns when the stack
    // is taller than availH. Returns { cardW, cardH, paint(ctx, ox, oy) }.
    function layoutLegend(blocks, availH) {
        const { pad, divGap, colGap } = LEG;
        const colW = Math.max(120, blocks.reduce((mx, b) => Math.max(mx, b.width), 0));
        const stackH = list => list.reduce((s, b, i) => s + b.height + (i ? divGap : 0), 0);
        let columns = [blocks];
        if (blocks.length > 1 && pad * 2 + stackH(blocks) > availH) {
            const target = stackH(blocks) / 2;
            const c1 = [], c2 = []; let acc = 0;
            blocks.forEach(b => { if (c1.length === 0 || acc < target) { c1.push(b); acc += b.height + divGap; } else c2.push(b); });
            if (c2.length) columns = [c1, c2];
        }
        const cardW = pad * 2 + colW * columns.length + (columns.length - 1) * colGap;
        const cardH = pad * 2 + Math.max(...columns.map(stackH));
        return {
            cardW, cardH,
            paint(ctx, ox, oy) {
                columns.forEach((col, ci) => {
                    const cx = ox + pad + ci * (colW + colGap);
                    let cy = oy + pad;
                    col.forEach((b, i) => {
                        if (i) {
                            ctx.strokeStyle = "rgba(10,31,68,0.10)"; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(cx, cy - divGap / 2 + 0.5); ctx.lineTo(cx + colW, cy - divGap / 2 + 0.5); ctx.stroke();
                        }
                        b.draw(ctx, cx, cy, colW);
                        cy += b.height + divGap;
                    });
                });
            },
        };
    }

    // Draw the auto-combined legend card. opts.corner ∈ bl|br|tl|tr (default bl);
    // opts.blocksEnabled toggles individual blocks.
    function drawLegendStack(ctx, W, H, opts) {
        const blocks = buildLegendBlocks(ctx, opts);
        if (!blocks.length) return;
        const margin = 16;
        const availH = Math.max(120, H - margin * 2 - 70);   // headroom for the title pill
        const lay = layoutLegend(blocks, availH);
        const k = Math.min(1, (H - margin * 2) / lay.cardH, (W * 0.55) / lay.cardW);
        const w = lay.cardW * k, h = lay.cardH * k;
        const corner = (opts && opts.corner) || "bl";
        let x = margin, y = H - h - margin;
        if (corner.indexOf("r") >= 0) x = W - w - margin;
        if (corner.indexOf("t") >= 0) y = margin + 64;       // clear the title pill
        ctx.save();
        ctx.translate(x, y); ctx.scale(k, k);
        ctx.fillStyle = "rgba(255,255,255,0.94)"; ctx.strokeStyle = "rgba(10,31,68,0.18)"; ctx.lineWidth = 1;
        roundRect(ctx, 0, 0, lay.cardW, lay.cardH, 8); ctx.fill(); ctx.stroke();
        lay.paint(ctx, 0, 0);
        ctx.restore();
    }

    // (The bivariate 3×3 grid now renders as measureBivariateBlock above, so the
    //  exported key combines it with school/college/reference blocks like any other.)

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ── Export Studio: capture-once, re-render-many ──────────────────────────
    // The WebGL map canvas is captured to a cached "base bitmap" only when the
    // modal opens or scope/resolution change; tweaking the title/legends/position
    // just re-draws overlays onto that bitmap (instant, no map re-render), and
    // Download composites a fresh full-resolution canvas from it.
    const exportStudio = {
        opts: { title: "", subtitle: "", caption: "", scope: "state", resolution: 1, corner: "bl", northArrow: true, scaleBar: true, annotation: { text: "", x: 0.5, y: 0.5 }, blocksEnabled: {} },
        base: null,                       // { bitmap, logicalW, logicalH }
        capturing: false, pending: false, token: 0,
    };

    // scope → { bbox } or { error }. Reuses the same place/selection lookups the
    // legacy one-click handler used.
    function resolveExportBbox(scope) {
        if (scope === "current") return { bbox: null };
        if (scope === "state") return { bbox: MA_BOUNDS };
        if (scope === "selection") {
            const sel = state.lastSelected;
            if (!sel || !sel.geometry) return { error: "Click a municipality or district on the map first, then choose ‘Selected feature’." };
            return { bbox: geomBbox(sel.geometry) };
        }
        if (scope === "search") {
            const q = (document.getElementById("placeSearch") || {}).value || "";
            const hit = findPlace(q);
            if (!hit) return { error: `No place matched “${q}”. Type a town or district name in the search box, then re-open Export.` };
            return { bbox: hit.bbox };
        }
        return { bbox: null };
    }

    // Frame the map per scope, optionally bump pixel ratio for hi-res, wait for
    // tiles to settle, snapshot the canvas, then ALWAYS restore camera + ratio.
    async function captureBaseBitmap() {
        const token = ++exportStudio.token;
        const scope = exportStudio.opts.scope || "current";
        const mult = exportStudio.opts.resolution || 1;
        const res = resolveExportBbox(scope);
        if (res.error) return { error: res.error };
        const container = map.getContainer();
        const logicalW = container.clientWidth, logicalH = container.clientHeight;
        const origDpr = (typeof map.getPixelRatio === "function") ? map.getPixelRatio() : (window.devicePixelRatio || 1);
        const saved = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        let hiRes = false, clamped = false;
        try {
            const needFit = scope !== "current" && res.bbox;
            if (needFit) map.fitBounds(res.bbox, { padding: 40, animate: false, duration: 0 });
            if (mult > 1 && typeof map.setPixelRatio === "function") {
                // Guard against exceeding the browser's canvas size / area limits.
                const longest = Math.max(logicalW, logicalH) * origDpr * mult;
                const area = (logicalW * origDpr * mult) * (logicalH * origDpr * mult);
                if (longest <= 16000 && area <= 250e6) { map.setPixelRatio(origDpr * mult); hiRes = true; }
                else clamped = true;
            }
            // Wait for tiles when we moved the camera or changed the buffer size,
            // else half the labels render as blank tiles (idle, not render).
            if (needFit || hiRes || map.isMoving()) {
                await Promise.race([
                    new Promise(r => map.once("idle", r)),
                    new Promise(r => setTimeout(r, 2500)),
                ]);
            }
            if (token !== exportStudio.token) return { stale: true };   // superseded by a newer request
            const canvas = map.getCanvas();
            const bmp = document.createElement("canvas");
            bmp.width = canvas.width; bmp.height = canvas.height;
            bmp.getContext("2d").drawImage(canvas, 0, 0);
            // Record the framed view's scale (metres per CSS px) + bearing so the
            // scale bar and north arrow stay correct after the camera is restored.
            const vlat = map.getCenter().lat, vzoom = map.getZoom();
            const metersPerPx = 156543.03392804096 * Math.cos(vlat * Math.PI / 180) / Math.pow(2, vzoom);
            return { bitmap: bmp, logicalW, logicalH, clamped, metersPerPx, bearing: map.getBearing() };
        } finally {
            if (hiRes) map.setPixelRatio(origDpr);
            map.jumpTo(saved);
        }
    }

    // Composite the cached base bitmap + overlays onto any target canvas. Overlays
    // are drawn in logical CSS px and scaled to the target, so they stay crisp at
    // small preview size AND at full download resolution.
    function renderExport(target, opts) {
        const base = exportStudio.base;
        if (!base || !target.width) return;
        const ctx = target.getContext("2d");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, target.width, target.height);
        ctx.drawImage(base.bitmap, 0, 0, base.bitmap.width, base.bitmap.height, 0, 0, target.width, target.height);
        const W = base.logicalW, H = base.logicalH, s = target.width / W;
        ctx.save(); ctx.scale(s, s);
        drawExportHeader(ctx, W, opts.title, opts.subtitle);
        drawLegendStack(ctx, W, H, opts);
        drawScaleBar(ctx, W, H, base, opts);
        drawNorthArrow(ctx, W, H, base, opts);
        drawExportCaption(ctx, W, H, opts.caption);
        drawExportCredit(ctx, W, H);
        if (opts.animYear != null) drawExportYearBadge(ctx, W, H, opts.animYear);
        drawAnnotation(ctx, W, H, opts);
        ctx.restore();
    }

    // Re-render only the in-modal preview canvas (fast — no map re-capture).
    function renderExportPreview() {
        const base = exportStudio.base;
        const cv = document.getElementById("exportPreview");
        if (!cv || !base) return;
        const frame = cv.parentElement;
        const availW = Math.max(220, (frame ? frame.clientWidth : 540) - 4);
        const cssW = Math.min(availW, base.logicalW);
        const cssH = cssW * base.logicalH / base.logicalW;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.style.width = cssW + "px"; cv.style.height = cssH + "px";
        cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
        renderExport(cv, exportStudio.opts);
        const busy = document.getElementById("exportPreviewBusy"); if (busy) busy.hidden = true;
    }

    // Serialized capture: one in flight at a time; the latest request wins.
    async function refreshExportCapture() {
        if (exportStudio.capturing) { exportStudio.pending = true; return; }
        exportStudio.capturing = true;
        const busy = document.getElementById("exportPreviewBusy");
        const errEl = document.getElementById("exportPreviewError");
        if (busy) busy.hidden = false;
        if (errEl) errEl.hidden = true;
        let res;
        try { res = await captureBaseBitmap(); }
        finally { exportStudio.capturing = false; }
        if (res && res.error) {
            if (errEl) { errEl.textContent = res.error; errEl.hidden = false; }
            if (busy) busy.hidden = true;
            exportStudio.base = null;
        } else if (res && !res.stale) {
            exportStudio.base = res;
            renderExportPreview();
            const note = document.getElementById("exportResNote");
            if (note) note.hidden = !res.clamped;
        }
        if (exportStudio.pending) { exportStudio.pending = false; refreshExportCapture(); }
    }

    function exportFilename() {
        const scopeSlug = exportStudio.opts.scope === "current" ? "view" : exportStudio.opts.scope;
        const mult = exportStudio.opts.resolution > 1 ? `_${exportStudio.opts.resolution}x` : "";
        return `ma-atlas_${state.metric}_${state.level}_${scopeSlug}${mult}_${new Date().toISOString().slice(0, 10)}.png`;
    }
    function downloadExport() {
        const base = exportStudio.base;
        if (!base) return;
        const out = document.createElement("canvas");
        out.width = base.bitmap.width; out.height = base.bitmap.height;
        renderExport(out, exportStudio.opts);
        const slug = exportFilename();
        const finish = (url, revoke) => {
            const a = document.createElement("a");
            a.href = url; a.download = slug;
            document.body.appendChild(a); a.click(); a.remove();
            if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        // toBlob keeps peak memory low for large (2×/3×) exports; fall back if absent.
        if (out.toBlob) out.toBlob(b => { b ? finish(URL.createObjectURL(b), true) : finish(out.toDataURL("image/png"), false); }, "image/png");
        else finish(out.toDataURL("image/png"), false);
    }

    // ── Time-lapse: animate the year slider into a WebM video ────────────────
    // Records the choropleth advancing through every available year. Colors are
    // LOCKED across years (breaks pooled over all years, like the small-multiples
    // view) so a color means the same thing every frame; the year is baked into
    // each frame as a badge. Reuses the Studio's renderExport pipeline per frame.
    let _tlRecording = false, _tlRecorder = null, _tlCancel = false, _tlVideoUrl = null;

    // Pool every year's values, classify ONCE → fixed breaks/stops + a fixed
    // legend object. Returns null when the view can't animate.
    function buildTimelapseBreaks() {
        if (state.bivariate || changeActive(state.metric, state.level)) return null;
        const level = state.level, m = getMetric(state.metric);
        const years = availableYears(state.metric, level);
        if (!years || years.length < 2) return null;
        const fc = GEO_DATA[level]; if (!fc) return null;
        const pooled = [];
        years.forEach(y => { const c = yearColumn(state.metric, y, level); if (c) fc.features.forEach(f => { const v = f.properties[c]; if (v != null && isFinite(+v)) pooled.push(+v); }); });
        if (!pooled.length) return null;
        const palette = state.palette;
        const classify = (state.classify === "continuous" || state.classify === "manual") ? "quantile" : state.classify;
        const n = classCount(classify, pooled);
        const raw = computeBreaks(pooled, classify, n);
        const cb = []; let prev = -Infinity;
        raw.forEach(b => { const v = +b; if (isFinite(v) && v > prev) { cb.push(v); prev = v; } });
        const stops = stopsForClasses(palette, cb, pooled);
        const vf = x => fmt(x, m.format);
        let legend;
        if (!cb.length) {
            legend = { continuous: false, rows: [{ color: stops[0], label: "All values" }], nodataLabel: "No data" };
        } else {
            const rows = [{ color: stops[0], label: `< ${vf(cb[0])}` }];
            for (let i = 0; i < cb.length - 1; i++) rows.push({ color: stops[i + 1], label: `${vf(cb[i])} – ${vf(cb[i + 1])}` });
            rows.push({ color: stops[cb.length], label: `≥ ${vf(cb[cb.length - 1])}` });
            legend = { continuous: false, rows, nodataLabel: "No data" };
        }
        return { years, cb, stops, legend, level };
    }

    // Inline year-column step expression with FIXED breaks (mirrors paintExpression's
    // blank/valid shape; the change-over-time rule — paint from the real year column).
    function fixedYearPaint(col, cb, stops) {
        const baseMetric = String(state.metric).split("__")[0];
        const blank = (state.level === "district" && HS_OUTCOME_METRICS.has(baseMetric))
            ? ["case", ["==", ["get", "_nohs"], true], NO_HS_COLOR, NO_DATA_COLOR]
            : NO_DATA_COLOR;
        const valid = ["==", ["typeof", ["get", col]], "number"];
        if (!cb.length) return ["case", valid, stops[stops.length - 1] || NO_DATA_COLOR, blank];
        const expr = ["step", ["to-number", ["get", col]], stops[0]];
        cb.forEach((b, i) => { expr.push(b, stops[Math.min(i + 1, stops.length - 1)]); });
        return ["case", valid, expr, blank];
    }

    function timelapseMime() {
        if (!window.MediaRecorder) return null;
        return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
            .find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || null;
    }
    function timelapseSupported() {
        return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && timelapseMime());
    }
    function timelapseFilename() {
        return `ma-atlas_${state.metric}_${state.level}_timelapse_${new Date().toISOString().slice(0, 10)}.webm`;
    }

    // Record the year-by-year animation to a WebM. Frames are pushed manually via
    // a 0-fps capture stream + track.requestFrame() so each frame is grabbed only
    // AFTER the map finishes repainting that year (no blank frames); the wall-clock
    // gap between frames sets the playback speed.
    async function recordTimelapse() {
        if (_tlRecording) return;
        const tl = buildTimelapseBreaks();
        const mime = timelapseMime();
        if (!tl || !mime) return;
        _tlRecording = true; _tlCancel = false;
        const btn = document.getElementById("tlRecordBtn");
        const prog = document.getElementById("tlProgress");
        const bar = document.getElementById("tlBar");
        const speed = parseFloat((document.getElementById("tlSpeed") || {}).value) || 0.8;
        const perYearMs = Math.round(speed * 1000);
        if (btn) { btn.disabled = true; btn.textContent = "Recording…"; }
        if (prog) prog.hidden = false; if (bar) bar.style.width = "0%";

        // The time-lapse runs standalone (no export modal), so it builds its OWN
        // opts: auto title/subtitle, all legends on, scale bar + north arrow,
        // bottom-left legend; speed/framing/resolution come from this modal.
        const m = getMetric(state.metric);
        const tlOpts = {
            title: exportTitleText(m), subtitle: exportSubtitleText(m), caption: "",
            corner: "bl", scaleBar: true, northArrow: true, blocksEnabled: {},
            scope: (document.getElementById("tlScope") || {}).value || "state",
            resolution: parseInt((document.querySelector('input[name="tlRes"]:checked') || {}).value, 10) || 1,
        };

        const fillLayer = state.level === "muni" ? "muni-fill" : "district-fill";
        const origDpr = (typeof map.getPixelRatio === "function") ? map.getPixelRatio() : (window.devicePixelRatio || 1);
        const mult = tlOpts.resolution || 1;
        const saved = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        const container = map.getContainer();
        const idle = (ms) => Promise.race([new Promise(r => map.once("idle", r)), new Promise(r => setTimeout(r, ms))]);
        let hiRes = false, track = null, rec = null;
        const chunks = [];
        try {
            const res = resolveExportBbox(tlOpts.scope || "state");
            if (res.bbox) map.fitBounds(res.bbox, { padding: 40, animate: false, duration: 0 });
            if (mult > 1 && typeof map.setPixelRatio === "function") {
                const longest = Math.max(container.clientWidth, container.clientHeight) * origDpr * mult;
                if (longest <= 16000) { map.setPixelRatio(origDpr * mult); hiRes = true; }
            }
            await idle(3000);
            const cvMap = map.getCanvas();
            const logicalW = container.clientWidth, logicalH = container.clientHeight;
            // Capture the framed view's scale + bearing ONCE so the video's scale
            // bar / north arrow (from PR #119) render on every frame.
            const vlat = map.getCenter().lat, vzoom = map.getZoom();
            const metersPerPx = 156543.03392804096 * Math.cos(vlat * Math.PI / 180) / Math.pow(2, vzoom);
            const bearing = map.getBearing();
            const out = document.createElement("canvas"); out.width = cvMap.width; out.height = cvMap.height;
            const bmp = document.createElement("canvas"); bmp.width = cvMap.width; bmp.height = cvMap.height;
            const bctx = bmp.getContext("2d");
            const stream = out.captureStream(0);
            track = stream.getVideoTracks()[0];
            rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
            _tlRecorder = rec;
            rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
            const stopped = new Promise(r => { rec.onstop = r; });
            rec.start();
            for (let i = 0; i < tl.years.length; i++) {
                if (_tlCancel) break;
                const y = tl.years[i], col = yearColumn(state.metric, y, state.level);
                map.setPaintProperty(fillLayer, "fill-color", fixedYearPaint(col, tl.cb, tl.stops));
                map.setPaintProperty(fillLayer, "fill-opacity", fillOpacityExpr(col));
                await idle(1500);
                if (_tlCancel) break;
                bctx.clearRect(0, 0, bmp.width, bmp.height); bctx.drawImage(map.getCanvas(), 0, 0);
                exportStudio.base = { bitmap: bmp, logicalW, logicalH, metersPerPx, bearing };
                renderExport(out, Object.assign({}, tlOpts, { animYear: y, animLegend: tl.legend }));
                track.requestFrame();
                if (bar) bar.style.width = Math.round((i + 1) / tl.years.length * 100) + "%";
                await new Promise(r => setTimeout(r, perYearMs));
            }
            if (!_tlCancel) { track.requestFrame(); await new Promise(r => setTimeout(r, perYearMs)); }
            if (rec.state !== "inactive") rec.stop();
            await stopped;
        } catch (e) {
            console.error("time-lapse record failed:", e);
        } finally {
            if (hiRes && typeof map.setPixelRatio === "function") map.setPixelRatio(origDpr);
            map.jumpTo(saved);
            applyChoropleth();              // restore the normal current-year paint
            exportStudio.base = null;
            _tlRecording = false; _tlRecorder = null;
            if (btn) { btn.disabled = false; btn.textContent = "● Record video (WebM)"; }
            if (prog) prog.hidden = true; if (bar) bar.style.width = "0%";
        }
        if (_tlCancel || !chunks.length) return;
        const blob = new Blob(chunks, { type: "video/webm" });
        if (_tlVideoUrl) { try { URL.revokeObjectURL(_tlVideoUrl); } catch (e) {} }
        _tlVideoUrl = URL.createObjectURL(blob);
        const wrap = document.getElementById("tlVideoWrap");
        const vid = document.getElementById("tlVideo");
        if (vid) { vid.src = _tlVideoUrl; }
        if (wrap) wrap.hidden = false;
        const dl = document.getElementById("tlDownload");
        if (dl) dl.onclick = () => { const a = document.createElement("a"); a.href = _tlVideoUrl; a.download = timelapseFilename(); document.body.appendChild(a); a.click(); a.remove(); };
    }

    // Open the standalone time-lapse recorder modal (separate from the Export
    // Studio). Resets any prior clip and shows the year span for the metric.
    function openTimelapseModal() {
        if (!GEO_DATA || !canTimelapse()) return;
        const modal = document.getElementById("timelapseModal"); if (!modal) return;
        const years = availableYears(state.metric, state.level);
        // reset any prior recording
        const wrap = document.getElementById("tlVideoWrap"); if (wrap) wrap.hidden = true;
        const vid = document.getElementById("tlVideo");
        if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute("src"); }
        if (_tlVideoUrl) { try { URL.revokeObjectURL(_tlVideoUrl); } catch (e) {} _tlVideoUrl = null; }
        const prog = document.getElementById("tlProgress"); if (prog) prog.hidden = true;
        const bar = document.getElementById("tlBar"); if (bar) bar.style.width = "0%";
        const m = getMetric(state.metric);
        const yrEl = document.getElementById("tlYears");
        if (yrEl) yrEl.textContent = `${m.label} · ${years.length} years (${years[0]}–${years[years.length - 1]})`;
        const supported = timelapseSupported();
        const recBtn = document.getElementById("tlRecordBtn");
        if (recBtn) { recBtn.disabled = !supported; recBtn.textContent = "● Record video (WebM)"; }
        const note = document.getElementById("tlNote");
        if (note) { note.hidden = supported; if (!supported) note.textContent = "Video recording isn't supported in this browser — try Chrome, Edge, or Firefox."; }
        modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
        const c = document.getElementById("timelapseClose"); if (c) c.focus();
    }
    function closeTimelapseModal() {
        const modal = document.getElementById("timelapseModal"); if (!modal) return;
        if (_tlRecording) { _tlCancel = true; try { if (_tlRecorder && _tlRecorder.state !== "inactive") _tlRecorder.stop(); } catch (e) {} }
        const vid = document.getElementById("tlVideo"); if (vid) { try { vid.pause(); } catch (e) {} }
        if (_tlVideoUrl) { try { URL.revokeObjectURL(_tlVideoUrl); } catch (e) {} _tlVideoUrl = null; }
        modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    }

    // ── Export Studio modal: open / close / wiring ───────────────────────────
    // Keep the scope in sync across state, the side-panel select, and the modal.
    function syncExportScope(scope) {
        exportStudio.opts.scope = scope;
        state.exportScope = scope;
        const side = document.getElementById("exportScope");
        if (side && side.value !== scope) side.value = scope;
        const inModal = document.getElementById("exportModalScope");
        if (inModal && inModal.value !== scope) inModal.value = scope;
    }
    // Build the "Legends to include" checkboxes from whatever's visible right now.
    function buildExportLegendToggles() {
        const wrap = document.getElementById("exportLegendToggles");
        if (!wrap) return;
        const blocks = availableLegendBlocks();
        exportStudio.opts.blocksEnabled = {};
        if (!blocks.length) { wrap.innerHTML = `<div class="export-empty">No legends to add for this view.</div>`; return; }
        wrap.innerHTML = blocks.map(b =>
            `<label class="export-toggle"><input type="checkbox" data-block="${b.key}" checked><span>${b.label}</span></label>`
        ).join("");
        wrap.querySelectorAll("input[data-block]").forEach(cb => {
            cb.addEventListener("change", e => {
                exportStudio.opts.blocksEnabled[e.target.dataset.block] = e.target.checked;
                renderExportPreview();
            });
        });
    }
    // Mirror the side-panel "Quick views" as buttons inside the export modal, so
    // you can re-frame the export (e.g. to North Shore) without leaving it. Built
    // once from the existing .view-btn elements so the labels never drift.
    function buildExportViewButtons() {
        const wrap = document.getElementById("exportViewBtns");
        if (!wrap || wrap.childElementCount) return;
        document.querySelectorAll(".view-btn").forEach(srcBtn => {
            if (srcBtn.closest("#exportViewBtns")) return;
            const b = document.createElement("button");
            b.type = "button";
            b.className = "export-region-btn";
            b.dataset.view = srcBtn.dataset.view;
            b.textContent = srcBtn.textContent;
            b.addEventListener("click", () => selectExportView(srcBtn.dataset.view));
            wrap.appendChild(b);
        });
    }
    // Jump the map to a region preset and re-capture, so the export preview shows
    // the new framing. Sets scope to "current" (we're exporting the framed view).
    function selectExportView(view) {
        if (!VIEWS[view]) return;
        setActiveView(view);
        document.querySelectorAll("#exportViewBtns .export-region-btn").forEach(b =>
            b.classList.toggle("active", b.dataset.view === view));
        syncExportScope("current");
        const busy = document.getElementById("exportPreviewBusy"); if (busy) busy.hidden = false;
        map.jumpTo({ ...VIEWS[view], duration: 0 });
        // Wait for the new region's tiles to settle before capturing, else the
        // export can grab half-loaded (blank) tiles.
        Promise.race([
            new Promise(r => map.once("idle", r)),
            new Promise(r => setTimeout(r, 2500)),
        ]).then(() => refreshExportCapture());
    }
    function openExportModal() {
        if (!GEO_DATA) return;
        const modal = document.getElementById("exportModal");
        if (!modal) return;
        const m = getMetric(state.metric);
        exportStudio.opts = {
            title: exportTitleText(m),
            subtitle: exportSubtitleText(m),
            caption: "",
            scope: state.exportScope || "state",
            resolution: 1,
            corner: "bl",
            northArrow: true,
            scaleBar: true,
            annotation: { text: "", x: 0.5, y: 0.5 },
            blocksEnabled: {},
        };
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        set("exportTitleInput", exportStudio.opts.title);
        set("exportSubtitleInput", exportStudio.opts.subtitle);
        set("exportCaptionInput", "");
        set("exportAnnotInput", "");
        set("exportModalScope", exportStudio.opts.scope);
        set("exportLegendCorner", "bl");
        const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
        setChk("exportScaleToggle", true); setChk("exportNorthToggle", true);
        const r1 = modal.querySelector('input[name="exportRes"][value="1"]'); if (r1) r1.checked = true;
        const note = document.getElementById("exportResNote"); if (note) note.hidden = true;
        buildExportLegendToggles();
        modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
        const busy = document.getElementById("exportPreviewBusy"); if (busy) busy.hidden = false;
        const c = document.getElementById("exportModalClose"); if (c) c.focus();
        refreshExportCapture();
    }
    function closeExportModal() {
        const modal = document.getElementById("exportModal");
        if (!modal) return;
        modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
        exportStudio.base = null;   // free the captured bitmap
    }

    const exportBtn = document.getElementById("exportPngBtn");
    if (exportBtn) exportBtn.addEventListener("click", openExportModal);

    const exportModalEl = document.getElementById("exportModal");
    if (exportModalEl) {
        const closeBtn = document.getElementById("exportModalClose");
        const cancelBtn = document.getElementById("exportCancelBtn");
        const dlBtn = document.getElementById("exportDownloadBtn");
        if (closeBtn) closeBtn.addEventListener("click", closeExportModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeExportModal);
        exportModalEl.addEventListener("click", e => { if (e.target === exportModalEl) closeExportModal(); });
        document.addEventListener("keydown", e => { if (e.key === "Escape" && exportModalEl.classList.contains("open")) closeExportModal(); });
        const onText = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("input", e => { exportStudio.opts[key] = e.target.value; renderExportPreview(); });
        };
        onText("exportTitleInput", "title");
        onText("exportSubtitleInput", "subtitle");
        onText("exportCaptionInput", "caption");
        const annotInput = document.getElementById("exportAnnotInput");
        if (annotInput) annotInput.addEventListener("input", e => {
            exportStudio.opts.annotation.text = e.target.value;
            renderExportPreview();
        });
        // Click the preview to (re)place the callout — only when a label is set.
        const previewCv = document.getElementById("exportPreview");
        if (previewCv) previewCv.addEventListener("click", e => {
            const a = exportStudio.opts.annotation;
            if (!a || !a.text || !a.text.trim()) return;
            const rect = previewCv.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            a.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            a.y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            renderExportPreview();
        });
        const scopeSel = document.getElementById("exportModalScope");
        if (scopeSel) scopeSel.addEventListener("change", e => { syncExportScope(e.target.value); refreshExportCapture(); });
        const cornerSel = document.getElementById("exportLegendCorner");
        if (cornerSel) cornerSel.addEventListener("change", e => { exportStudio.opts.corner = e.target.value; renderExportPreview(); });
        exportModalEl.querySelectorAll('input[name="exportRes"]').forEach(r =>
            r.addEventListener("change", e => { if (e.target.checked) { exportStudio.opts.resolution = parseInt(e.target.value, 10) || 1; refreshExportCapture(); } }));
        const scaleTog = document.getElementById("exportScaleToggle");
        if (scaleTog) scaleTog.addEventListener("change", e => { exportStudio.opts.scaleBar = e.target.checked; renderExportPreview(); });
        const northTog = document.getElementById("exportNorthToggle");
        if (northTog) northTog.addEventListener("change", e => { exportStudio.opts.northArrow = e.target.checked; renderExportPreview(); });
        buildExportViewButtons();
        if (dlBtn) dlBtn.addEventListener("click", downloadExport);
        window.addEventListener("resize", () => { if (exportModalEl.classList.contains("open")) renderExportPreview(); });
    }

    // Standalone time-lapse recorder — its own side-panel button + dedicated modal.
    const timelapseBtn = document.getElementById("timelapseBtn");
    if (timelapseBtn) timelapseBtn.addEventListener("click", () => { if (!timelapseBtn.disabled) openTimelapseModal(); });
    const timelapseModalEl = document.getElementById("timelapseModal");
    if (timelapseModalEl) {
        const tlClose = document.getElementById("timelapseClose");
        if (tlClose) tlClose.addEventListener("click", closeTimelapseModal);
        timelapseModalEl.addEventListener("click", e => { if (e.target === timelapseModalEl) closeTimelapseModal(); });
        document.addEventListener("keydown", e => { if (e.key === "Escape" && timelapseModalEl.classList.contains("open")) closeTimelapseModal(); });
        const tlRec = document.getElementById("tlRecordBtn");
        if (tlRec) tlRec.addEventListener("click", recordTimelapse);
    }

    // Place-search input: flying-to on Enter or datalist-pick. Doesn't trigger
    // a download — that's the export-scope = "search" behavior. Plain pan-to.
    const placeInput = document.getElementById("placeSearch");
    if (placeInput) {
        const flyToQuery = (q) => {
            q = (q || "").trim();
            if (!q) return;
            const hit = findPlace(q);
            if (!hit) {
                // Not a known place NAME — if it looks like an address/ZIP, geocode it.
                if (/\d/.test(q)) geocodeAndFly(q);
                return;
            }
            clearSearchMarker();   // a named match supersedes any dropped pin
            if (hit.type === "school" && hit.center) {
                // Make sure the schools layer is on, fly in, and pop the school.
                const cb = document.getElementById("ref-all-ma-schools");
                if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
                map.flyTo({ center: hit.center, zoom: 13, duration: 800, essential: true });
                new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
                    .setLngLat(hit.center)
                    .setHTML(schoolPopupHtml(hit.props || {}))
                    .addTo(map);
                return;
            }
            if (hit.type === "college" && hit.center) {
                // Make sure the colleges layer is on, fly in, and pop the college card.
                const cb = document.getElementById("ref-all-ma-colleges");
                if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
                map.flyTo({ center: hit.center, zoom: 11, duration: 800, essential: true });
                new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
                    .setLngLat(hit.center)
                    .setHTML(collegePopupHtml(hit.props || {}))
                    .addTo(map);
                return;
            }
            map.fitBounds(hit.bbox, { padding: 60, duration: 800 });
        };
        placeInput.addEventListener("change", e => flyToQuery(e.target.value));
        placeInput.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); flyToQuery(e.target.value); }
        });
    }

    // URL state — read on load, write on every state change
    async function applyUrlState() {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const level    = params.get("level");
        const metric   = params.get("metric");
        const palette  = params.get("palette");
        const classify = params.get("classify");
        const view     = params.get("view");
        let dirty = false;
        if (level && ["muni", "district"].includes(level)) {
            state.level = level;
            const sel = document.getElementById("levelSelect");
            if (sel) sel.value = level;
            dirty = true;
        }
        if (metric && METRICS.find(m => m.id === metric && m.levels.includes(state.level))) {
            state.metric = metric;
            const sel = document.getElementById("metricSelect");
            if (sel) sel.value = metric;
            dirty = true;
        }
        if (palette && PALETTES[palette]) {
            state.palette = palette;
            const sel = document.getElementById("paletteSelect");
            if (sel) sel.value = palette;
            dirty = true;
        }
        if (classify && ["continuous", "quantile", "equal", "jenks", "stddev", "geometric", "pretty", "manual"].includes(classify)) {
            state.classify = classify;
            const cs = document.getElementById("classifySelect");
            if (cs) cs.value = classify;
            dirty = true;
        }
        if (params.get("rev") === "1") {
            state.reversePalette = true;
            const rt = document.getElementById("reversePaletteToggle");
            if (rt) rt.checked = true;
            dirty = true;
        }
        const year = parseInt(params.get("year"), 10);
        if (isFinite(year)) {
            state.year = year;
            const yl = document.getElementById("yearSlider"), yt = document.getElementById("yearLabel");
            if (yl) yl.value = String(year);
            if (yt) yt.textContent = String(year);
            dirty = true;
        }
        const group = params.get("group");
        if (group) {
            state.studentGroup = group;
            const gs = document.getElementById("groupSelect");
            if (gs) gs.value = group;
            dirty = true;
        }
        const breaks = params.get("breaks");
        if (breaks) {
            state.manualBreaks = breaks;
            const mi = document.getElementById("manualBreaksInput");
            if (mi) mi.value = breaks;
        }
        if (params.get("bivar") === "1") {
            state.bivariate = true;
            const bt = document.getElementById("bivariateToggle");
            if (bt) bt.checked = true;
            const bc = document.getElementById("bivarControls");
            if (bc) bc.style.display = "";
            const bB = params.get("bivarB");
            if (bB && getMetric(bB)) state.bivarMetricB = bB;
            const bP = params.get("bivarPal");
            if (bP && BIVAR_PALETTES[bP]) state.bivarPalette = bP;
            dirty = true;
        }
        if (params.get("chg") === "1") {
            state.changeMode = true;
            const ct = document.getElementById("changeToggle"); if (ct) ct.checked = true;
            const cc = document.getElementById("changeControls"); if (cc) cc.style.display = "";
            const cf = parseInt(params.get("chgFrom"), 10);
            const cto = parseInt(params.get("chgTo"), 10);
            if (isFinite(cf)) state.changeFrom = cf;
            if (isFinite(cto)) state.changeTo = cto;
            state.changeRel = params.get("chgRel") === "1";
            const crt = document.getElementById("changeRelToggle"); if (crt) crt.checked = state.changeRel;
            // A shared change link should still center on zero even if the palette
            // param was sequential.
            if (!PALETTES[state.palette] || PALETTES[state.palette].type !== "div") {
                state.palette = CHANGE_PALETTE;
                const ps = document.getElementById("paletteSelect"); if (ps) ps.value = state.palette;
            }
            dirty = true;
        }
        if (view && VIEWS[view]) {
            map.flyTo({ ...VIEWS[view], duration: 0 });
        }
        const at = params.get("at");
        if (at) {
            const [lng, lat, z] = at.split(",").map(Number);
            if (isFinite(lng) && isFinite(lat) && isFinite(z)) {
                map.jumpTo({ center: [lng, lat], zoom: z });
            }
        }
        // A muni-level shared link needs the lazy time-series before painting.
        if (state.level === "muni") await ensureMuniTimeseries();
        if (dirty && typeof applyChoropleth === "function") {
            populateMetricSelect();
            updateMetricGating();
            applyChoropleth();
            updateLegend();
            if (typeof updateMetricSummary === "function") updateMetricSummary();
        }
    }
    function writeUrlState() {
        const params = new URLSearchParams();
        params.set("level", state.level);
        params.set("metric", state.metric);
        params.set("palette", state.palette);
        params.set("classify", state.classify);
        if (state.reversePalette) params.set("rev", "1");
        if (state.year) params.set("year", String(state.year));
        if (state.studentGroup && state.studentGroup !== "all") params.set("group", state.studentGroup);
        if (state.classify === "manual" && state.manualBreaks) params.set("breaks", state.manualBreaks);
        if (state.bivariate) {
            params.set("bivar", "1");
            params.set("bivarB", state.bivarMetricB);
            params.set("bivarPal", state.bivarPalette);
        }
        if (state.changeMode) {
            params.set("chg", "1");
            if (state.changeFrom != null) params.set("chgFrom", String(state.changeFrom));
            if (state.changeTo != null)   params.set("chgTo", String(state.changeTo));
            if (state.changeRel) params.set("chgRel", "1");
        }
        // Camera so a shared link reproduces the framing the sender saw.
        const c = map.getCenter();
        params.set("at", `${c.lng.toFixed(4)},${c.lat.toFixed(4)},${map.getZoom().toFixed(2)}`);
        const hash = "#" + params.toString();
        if (window.location.hash !== hash) {
            history.replaceState(null, "", hash);
        }
    }
    // Apply URL state on initial load (after a tick so app is wired)
    setTimeout(applyUrlState, 50);
    // Write on user changes — every control that affects the shared view.
    ["levelSelect", "metricSelect", "paletteSelect", "reversePaletteToggle", "groupSelect", "yearSlider",
     "bivariateToggle", "bivarMetricSelect", "bivarPaletteSelect", "manualBreaksInput", "legendClassify", "classifySelect",
     "changeToggle", "changeFromSelect", "changeToSelect", "changeRelToggle"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", () => setTimeout(writeUrlState, 10));
    });
    // Persist the camera after the user stops moving the map (debounced).
    let _camTimer = null;
    map.on("moveend", () => { clearTimeout(_camTimer); _camTimer = setTimeout(writeUrlState, 250); });

    // "Copy link" — writes the current state to the URL, then copies it.
    const copyBtn = document.getElementById("copyLinkBtn");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            writeUrlState();
            const url = window.location.href;
            try {
                await navigator.clipboard.writeText(url);
                const old = copyBtn.textContent;
                copyBtn.textContent = "✓ Link copied";
                setTimeout(() => { copyBtn.textContent = old; }, 1800);
            } catch (e) {
                window.prompt("Copy this shareable link:", url);
            }
        });
    }

    // Compare mode was previously here — removed in favor of bivariate mode,
    // which expresses the same "compare two metrics" idea in a single map and
    // is less mentally heavy than two synchronized side-by-side maps.
});

// ─── CHOROPLETH APPLY ────────────────────────────────────────────────────────
// Cached most-recent bivariate breakpoints so updateLegend() can label the
// 3×3 grid with the actual cutpoints used during the last paint.
let _lastBivar = null;

// Text-field expression for on-map value labels — the active metric's number,
// formatted to mirror fmt() (whole % / $ / count); non-numeric (no-data)
// features show nothing. Reads the same real column the fill paints, so the
// number on the map always matches the color.
function valueLabelExpr(col, m) {
    const num = ["to-number", ["get", col]];
    let text;
    if (m.format === "pct")      text = ["concat", ["to-string", ["round", ["*", num, 100]]], "%"];
    else if (m.format === "usd") text = ["concat", "$", ["number-format", num, { "max-fraction-digits": 0 }]];
    else                         text = ["number-format", num, { "max-fraction-digits": 0 }];
    return ["case", ["==", ["typeof", ["get", col]], "number"], text, ""];
}

// (Re)build the proportional-circle centroid source for the active level + year
// and toggle its visibility. Sized by enrollment (TOTAL_CNT for the active year),
// one point at each polygon's bbox center. Independent overlay — pairs with any
// single-metric fill regardless of mode.
function refreshPropCircles() {
    const src = map.getSource && map.getSource("prop-circles");
    if (!src) return;
    const on = state.propCircles && GEO_DATA && GEO_DATA[state.level];
    if (map.getLayer("prop-circles")) map.setLayoutProperty("prop-circles", "visibility", on ? "visible" : "none");
    if (!on) { src.setData({ type: "FeatureCollection", features: [] }); return; }
    const fc = GEO_DATA[state.level];
    const enrollCol = (typeof yearColumn === "function" && yearColumn("TOTAL_CNT", state.year, state.level)) || "TOTAL_CNT";
    const feats = [];
    fc.features.forEach(f => {
        const v = f.properties[enrollCol];
        if (v == null || !isFinite(+v) || +v <= 0) return;
        const b = geomBbox(f.geometry);
        if (!b) return;
        feats.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] },
            properties: { enroll: +v, name: featureName(f.properties, state.level) },
        });
    });
    src.setData({ type: "FeatureCollection", features: feats });
}

// Nested-circle size key for the enrollment overlay (classic proportional-symbol
// legend), shown only while the overlay is on. Radii mirror PROP_RADIUS at ~z9.
function renderPropCircleLegend() {
    const el = document.getElementById("propCircleLegend");
    if (!el) return;
    if (!state.propCircles) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    const refs = [40000, 10000, 1000];
    const r = v => Math.max(2, 0.16 * Math.sqrt(v));   // mirror PROP_RADIUS @ z9
    const maxR = r(refs[0]);
    const W = maxR * 2 + 78, H = maxR * 2 + 6, cx = maxR + 1, baseY = H - 3;
    let svg = "";
    refs.forEach(v => {
        const rr = r(v), topY = baseY - 2 * rr;
        svg += `<circle cx="${cx}" cy="${(baseY - rr).toFixed(1)}" r="${rr.toFixed(1)}" fill="none" stroke="#0A1F44" stroke-opacity="0.85"/>`;
        svg += `<line x1="${cx}" y1="${topY.toFixed(1)}" x2="${(maxR * 2 + 6).toFixed(1)}" y2="${topY.toFixed(1)}" stroke="#b0b8c1" stroke-width="0.5"/>`;
        svg += `<text x="${(maxR * 2 + 9).toFixed(1)}" y="${(topY + 3).toFixed(1)}" font-size="10" fill="#566873">${v.toLocaleString()}</text>`;
    });
    el.innerHTML = `<div class="prop-circle-legend-title">Students (circle size)</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${svg}</svg>`;
}

function applyChoropleth() {
    const { level, metric, palette, classify } = state;
    const m = getMetric(metric);
    // Year-aware: paint uses year-keyed column when available
    const col = activeColumn(metric, state.year, level);

    const inChange = !state.bivariate && changeActive(metric, level);
    let paint;
    if (state.bivariate) {
        const result = bivariatePaintExpression(metric, state.bivarMetricB, state.bivarPalette, level);
        paint = result.expr;
        _lastBivar = result;
    } else if (inChange) {
        // The delta lives only on GEO_DATA (for breaks/legend), NOT on MapLibre's
        // ingested source — so the paint computes it inline from the two real year
        // columns, which ARE in the source.
        paint = changePaintExpression(level);
        _lastBivar = null;
    } else {
        paint = paintExpression(col, palette, classify, level);
        _lastBivar = null;
    }

    const layerMap = { muni: "muni-fill", district: "district-fill" };
    Object.entries(layerMap).forEach(([lvl, layerId]) => {
        if (!map.getLayer(layerId)) return;
        map.setLayoutProperty(layerId, "visibility", lvl === level ? "visible" : "none");
        if (lvl === level) {
            map.setPaintProperty(layerId, "fill-color", paint);
            map.setPaintProperty(layerId, "fill-opacity", fillOpacityExpr(col));
            // Overlapping districts: a regional 9-12 district shares ground with its
            // member towns' K-8 districts, and both live in this single fill layer.
            // Draw whichever has a value for the ACTIVE metric on top, so a no-data
            // polygon never greys out the data-bearing one beneath it. Flips per
            // metric (HS metric → regional on top; grade 3-8 → member towns on top)
            // and makes click/popup hit the district actually being shown.
            if (layerId === "district-fill") {
                map.setLayoutProperty(layerId, "fill-sort-key",
                    ["case", ["==", ["typeof", ["get", col]], "number"], 1, 0]);
            }
        }
    });

    // No-data outline: dash polygons with no value. Bivariate dashes where EITHER
    // metric is missing; change mode dashes where a missing endpoint year leaves
    // the delta undefined (inline validity test — the synthetic delta column isn't
    // on the rendered source). Otherwise dash where the active metric is missing.
    const changeExprs = inChange ? changeYearExprs(level) : null;
    ["municipalities", "districts"].forEach(src => {
        const active = (src === "municipalities" && level === "muni")
                    || (src === "districts" && level === "district");
        let ndFilter = null;
        if (active) {
            if (state.bivariate) {
                const cA = activeColumn(metric, state.year, level);
                const cB = activeColumn(state.bivarMetricB, state.year, level);
                ndFilter = ["any",
                    ["!=", ["typeof", ["get", cA]], "number"],
                    ["!=", ["typeof", ["get", cB]], "number"]];
            } else if (inChange && changeExprs) {
                ndFilter = ["!", changeExprs.valid];
            } else {
                ndFilter = ["!=", ["typeof", ["get", col]], "number"];
            }
        }
        // The dashed outline and the texture overlay share the same no-data filter.
        [`nodata-outline-${src}`, `nodata-texture-${src}`].forEach(id => {
            if (!map.getLayer(id)) return;
            if (ndFilter) {
                map.setFilter(id, ndFilter);
                map.setLayoutProperty(id, "visibility", "visible");
            } else {
                map.setLayoutProperty(id, "visibility", "none");
            }
        });
    });

    // Value labels — the active metric's number on each polygon. Only in plain
    // single-metric mode (bivariate has no single value; change mode's delta is a
    // synthetic column that isn't on the rendered source).
    const showValues = state.valueLabels && !state.bivariate && !inChange;
    ["muni-value-labels", "district-value-labels"].forEach(id => {
        if (!map.getLayer(id)) return;
        const isActive = (id === "muni-value-labels" && level === "muni")
                      || (id === "district-value-labels" && level === "district");
        if (isActive && showValues) {
            map.setLayoutProperty(id, "text-field", valueLabelExpr(col, m));
            map.setLayoutProperty(id, "visibility", "visible");
        } else {
            map.setLayoutProperty(id, "visibility", "none");
        }
    });

    // Proportional enrollment circles overlay (independent toggle).
    refreshPropCircles();

    // Keep the non-operating-town overlay (district-level only) in sync with the
    // current level + toggle.
    updateNonOpLayer();
    updateModeBar();
    updateStatusChip();   // on-map context (when the panel is hidden)
    if (typeof renderListView === "function") renderListView();   // "places in view" list

    if (state.extrude3d) toggle3D();
}

// Floating "you are in X mode" bar with a one-click exit — so bivariate / change
// / compare modes always have an obvious way back to the plain single-metric map
// (rather than hunting for the checkbox that turned them on).
function updateModeBar() {
    const bar = document.getElementById("modeBar"); if (!bar) return;
    const label = document.getElementById("modeBarLabel");
    let txt = null;
    if (state.changeMode && changeActive()) txt = `📈 Change over time · ${state.changeFrom} → ${state.changeTo}`;
    else if (state.bivariate) txt = "▦ Comparing two metrics (bivariate)";
    else if (state.compareMode) {
        const n = state.compareSet.length;
        txt = n ? `⇄ Comparing ${n} ${compareNoun(n !== 1)} — click to add or remove`
                : `⇄ Comparison mode — click ${compareNoun(true)} to add them`;
    }
    if (txt) { if (label) label.textContent = txt; bar.hidden = false; }
    else bar.hidden = true;
}

// Plain-language labels for the status chip / legend caption / list view.
const GROUP_LABELS = { all: "All students", ELL: "English learners", LI: "Low income", SWD: "Students w/ disabilities" };
function levelLabel(level = state.level, plural = false) {
    if (level === "muni") return plural ? "Towns" : "Town";
    return plural ? "School districts" : "District";
}

// On-map "current view" chip — what the map is showing (level · metric · year ·
// group). Shown only while the left panel is HIDDEN (collapsed on desktop, drawer
// closed on mobile), so the map keeps its context once the panel is tucked away.
function updateStatusChip() {
    const chip = document.getElementById("statusChip");
    if (!chip) return;
    const panel = document.getElementById("controlPanel");
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const hidden = !!panel && (isMobile ? !panel.classList.contains("open") : panel.classList.contains("collapsed"));
    if (!hidden) { chip.hidden = true; return; }
    const m = getMetric(state.metric);
    const parts = [levelLabel(state.level, true)];
    if (state.changeMode && changeActive()) parts.push(`${m.label} · change ${state.changeFrom}→${state.changeTo}`);
    else if (state.bivariate) parts.push(`${m.label} × ${getMetric(state.bivarMetricB).label}`);
    else {
        parts.push(m.label);
        if (isYearKeyed(state.metric, state.level) && state.year) parts.push(String(state.year));
    }
    if (state.studentGroup && state.studentGroup !== "all") parts.push(GROUP_LABELS[state.studentGroup] || state.studentGroup);
    chip.innerHTML = parts.map((p, i) =>
        `<span class="status-chip-part${i === 0 ? " status-chip-lead" : ""}">${cmpEsc(p)}</span>`
    ).join('<span class="status-chip-sep">·</span>');
    chip.hidden = false;
}

// Exit whichever special mode is active, back to the normal single-metric map.
function exitActiveMode() {
    if (state.changeMode) {
        const t = document.getElementById("changeToggle"); if (t) t.checked = false;
        setChangeMode(false);
    } else if (state.bivariate) {
        // Flip state directly (don't dispatch a synthetic event — more reliable).
        state.bivariate = false;
        const t = document.getElementById("bivariateToggle"); if (t) t.checked = false;
        const bc = document.getElementById("bivarControls"); if (bc) bc.style.display = "none";
        if (typeof clearBivarPresetSelection === "function") clearBivarPresetSelection();
        applyChoropleth(); updateLegend(); updateMetricGating();
    } else if (state.compareMode) {
        exitCompareMode();
    }
    updateModeBar();
}

// Reset the DATA VIEW back to the landing defaults — metric, year, student group,
// classification, palette direction, highlight filter/group, and any special mode
// (bivariate / change / compare). Deliberately leaves the current LEVEL, basemap,
// theme, and label toggles alone (those are "how it looks", not "what's shown").
function resetAll() {
    // Leave any special mode first (each restores its own controls).
    if (state.compareMode) exitCompareMode();
    if (state.changeMode) { const t = document.getElementById("changeToggle"); if (t) t.checked = false; setChangeMode(false); }
    if (state.bivariate) {
        state.bivariate = false;
        const bt = document.getElementById("bivariateToggle"); if (bt) bt.checked = false;
        const bc = document.getElementById("bivarControls"); if (bc) bc.style.display = "none";
        if (typeof clearBivarPresetSelection === "function") clearBivarPresetSelection();
    }
    resetThreshold();
    // Highlight-a-group overlay → off.
    state.highlightGroup = "none";
    const hg = document.getElementById("highlightGroupSelect"); if (hg) hg.value = "none";
    if (typeof applyHighlightGroup === "function") applyHighlightGroup();
    // Core data view → landing defaults.
    state.metric = "TOTAL_CNT";
    state.studentGroup = "all";
    state.classify = "jenks";
    state.reversePalette = false;
    const grp = document.getElementById("groupSelect"); if (grp) grp.value = "all";
    const rev = document.getElementById("reversePaletteToggle"); if (rev) rev.checked = false;
    syncClassifyControls();      // reflect classify=jenks onto the panel + legend dropdowns
    syncPaletteForMetric();      // palette → the metric's semantic default
    populateMetricSelect();      // sync the hidden select + picker label to state.metric
    updateMetricGating();        // year slider / group availability for the new metric
    // Year → latest available for the reset metric.
    const yrs = availableYears(state.metric, state.level);
    if (yrs.length) state.year = yrs[yrs.length - 1];
    const ys = document.getElementById("yearSlider"); if (ys) ys.value = String(state.year);
    const yl = document.getElementById("yearLabel"); if (yl) yl.textContent = String(state.year);
    applyChoropleth();
    updateLegend();
    updateMetricSummary();
    updateModeBar();
}

// ─── MAP ⇄ LIST COMPANION VIEW ───────────────────────────────────────────────
// A slide-in list of the places currently ON SCREEN, ranked by the active metric.
// Mirrors the "find a place" pattern of school-finder apps. Synced to the map via
// moveend while open; re-rendered by applyChoropleth() when the metric/year/level
// changes. Reuses queryRenderedFeatures (exactly what's visible) + panelValue/fmt.
let _listSync = null;
function viewportFeatures() {
    const layerId = state.level === "muni" ? "muni-fill" : "district-fill";
    if (!map.getLayer(layerId)) return [];
    let feats;
    try { feats = map.queryRenderedFeatures({ layers: [layerId] }); } catch (e) { return []; }
    const seen = new Set(), out = [];
    feats.forEach(f => {
        const key = f.id != null ? f.id : featureName(f.properties, state.level);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(f);
    });
    return out;
}
function renderListView() {
    const panel = document.getElementById("listPanel");
    if (!panel || !panel.classList.contains("open")) return;
    const body = document.getElementById("listPanelBody");
    const titleEl = document.getElementById("listPanelTitle");
    const m = getMetric(state.metric);
    const nounP = levelLabel(state.level, true);
    if (titleEl) titleEl.textContent = `${nounP} in view`;
    const rows = viewportFeatures().map(f => {
        const v = panelValue(f.properties, state.metric);
        return { name: featureName(f.properties, state.level), v: (v != null && isFinite(+v)) ? +v : null };
    });
    // value desc, nulls last, then name
    rows.sort((a, b) => (a.v == null) - (b.v == null) || (b.v - a.v) || a.name.localeCompare(b.name));
    const withVal = rows.filter(r => r.v != null).map(r => r.v);
    const lo = withVal.length ? Math.min(0, ...withVal) : 0;
    const hi = withVal.length ? Math.max(...withVal) : 1;
    const span = (hi - lo) || 1;
    const head = `<div class="lst-head">${rows.length} ${nounP.toLowerCase()} in view · by ${gEsc(m.label)}${isYearKeyed(state.metric, state.level) ? " (" + state.year + ")" : ""}</div>`;
    const items = rows.map((r, i) => {
        const w = r.v == null ? 0 : Math.max(1.5, (r.v - lo) / span * 100);
        const val = r.v == null ? '<span class="lst-na">—</span>' : gEsc(fmt(r.v, m.format));
        return `<button type="button" class="lst-row" data-lname="${gEsc(r.name)}">` +
            `<span class="lst-rank">${i + 1}</span>` +
            `<span class="lst-name" title="${gEsc(r.name)}">${gEsc(r.name)}</span>` +
            `<span class="lst-track"><span class="lst-bar" style="width:${w.toFixed(1)}%"></span></span>` +
            `<span class="lst-val">${val}</span></button>`;
    }).join("");
    body.innerHTML = head + (rows.length
        ? `<div class="lst-list">${items}</div>`
        : `<div class="lst-empty">Pan or zoom out to bring ${nounP.toLowerCase()} into view.</div>`);
}
// Click a list row → select that place, fly to it, open its detail panel.
function selectPlaceByName(name) {
    const fc = GEO_DATA && GEO_DATA[state.level];
    if (!fc) return;
    const idx = fc.features.findIndex(f => featureName(f.properties, state.level) === name);
    if (idx < 0) return;
    const f = fc.features[idx];
    setSelectedFeature(state.level === "muni" ? "municipalities" : "districts", idx);
    state.lastSelected = { kind: state.level, properties: f.properties, geometry: f.geometry };
    const bbox = geomBbox(f.geometry);
    if (bbox) map.fitBounds(bbox, { padding: 80, duration: 700 });
    openFeaturePanel(f.properties, state.level);
}
function openListView() {
    const panel = document.getElementById("listPanel");
    if (!panel) return;
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    const btn = document.getElementById("listToggleBtn"); if (btn) btn.classList.add("active");
    if (!_listSync) { _listSync = () => renderListView(); map.on("moveend", _listSync); }
    renderListView();
}
function closeListView() {
    const panel = document.getElementById("listPanel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    const btn = document.getElementById("listToggleBtn"); if (btn) btn.classList.remove("active");
    if (_listSync) { map.off("moveend", _listSync); _listSync = null; }
}
function toggleListView() {
    const panel = document.getElementById("listPanel");
    (panel && panel.classList.contains("open") ? closeListView : openListView)();
}

// ─── THEME (light / dark UI chrome) ──────────────────────────────────────────
// Flips a [data-theme] attribute on <html>; the CSS does the rest via tokens.
// Dark chrome pairs with the dark BASEMAP, so toggling also switches the map base
// (remembering the prior one to restore on the way back to light).
let _themePrevBasemap = null;
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
function syncThemeButton() {
    const dark = currentTheme() === "dark";
    const btn = document.getElementById("themeToggle");
    if (btn) {
        btn.setAttribute("aria-pressed", dark ? "true" : "false");
        btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
    document.querySelectorAll("[data-theme-ico]").forEach(el => {
        el.style.display = ((el.dataset.themeIco === "dark") === dark) ? "" : "none";
    });
}
function applyTheme(theme, opts = {}) {
    const dark = theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    syncThemeButton();
    if (!opts.skipBasemap && map && map.getLayer && map.getLayer("dark-base") && typeof applyBasemap === "function") {
        if (dark) {
            if (state.basemap !== "dark") _themePrevBasemap = state.basemap;
            applyBasemap("dark");
        } else {
            applyBasemap(_themePrevBasemap || "lightgray");
        }
        const sel = document.getElementById("basemapSelect"); if (sel) sel.value = state.basemap;
    }
    try { localStorage.setItem("ma-atlas-theme", dark ? "dark" : "light"); } catch (e) {}
}
function toggleTheme() { applyTheme(currentTheme() === "dark" ? "light" : "dark"); }
// Run at module load (DOM is parsed; map not yet). Sets the chrome from saved
// pref / OS setting and, when dark, flips state.basemap so the FIRST paint of the
// choropleth layers already renders over the dark base (no light flash).
function initTheme() {
    let t = null;
    try { t = localStorage.getItem("ma-atlas-theme"); } catch (e) {}
    if (t !== "dark" && t !== "light") {
        t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", t);
    if (t === "dark") { _themePrevBasemap = state.basemap; state.basemap = "dark"; }
}
initTheme();

// Fill-opacity expression: hover-brightened by default; when the highlight
// filter is active, polygons outside the [lo, hi] range on the active column
// are dimmed so the matching set pops. Bivariate mode keeps the flat opacity.
function fillOpacityExpr(col) {
    // Resting opacity is user-controlled (default 1 = solid, so basemap labels
    // don't bleed through). Hover nudges brighter, capped at 1; when already
    // solid the gold hover outline carries the emphasis instead.
    const rest = state.fillOpacity != null ? state.fillOpacity : 1;
    const hover = Math.min(1, rest + 0.14);
    const base = ["case", ["boolean", ["feature-state", "hover"], false], hover, rest];
    const t = state.threshold;
    if (!t || !t.active || state.bivariate) return base;
    const within = ["all", ["==", ["typeof", ["get", col]], "number"]];
    if (t.lo != null) within.push([">=", ["to-number", ["get", col]], t.lo]);
    if (t.hi != null) within.push(["<=", ["to-number", ["get", col]], t.hi]);
    return ["case", within, base, 0.06];
}

// Count features matching the active highlight-filter, for the live readout.
function thresholdMatchCount() {
    const t = state.threshold;
    if (!t || !t.active || !GEO_DATA) return { n: 0, total: 0 };
    const vals = getValuesForLevel(state.level, state.metric);
    const n = vals.filter(v => (t.lo == null || v >= t.lo) && (t.hi == null || v <= t.hi)).length;
    return { n, total: vals.length };
}

// Read the two threshold inputs in DISPLAY units and convert to native units
// (percent metrics are stored as 0–1 fractions, so "90" → 0.9).
function readThreshold() {
    const m = getMetric(state.metric);
    const conv = el => {
        const n = parseFloat(el && el.value);
        if (!isFinite(n)) return null;
        return m.format === "pct" ? n / 100 : n;
    };
    state.threshold.lo = conv(document.getElementById("thresholdLo"));
    state.threshold.hi = conv(document.getElementById("thresholdHi"));
}
function updateThresholdCount() {
    const el = document.getElementById("thresholdCount");
    if (!el) return;
    if (!state.threshold.active) { el.textContent = ""; return; }
    const { n, total } = thresholdMatchCount();
    const noun = state.level === "muni" ? "municipalities" : "districts";
    el.textContent = `${n} of ${total} ${noun} match.`;
}
function applyThreshold() {
    readThreshold();
    applyChoropleth();
    updateThresholdCount();
}
// Clear the filter — called when the metric/level changes, since a numeric
// range is meaningless across metrics on different scales.
function resetThreshold() {
    state.threshold = { active: false, lo: null, hi: null };
    const tog = document.getElementById("thresholdToggle");
    const ctl = document.getElementById("thresholdControls");
    const lo = document.getElementById("thresholdLo");
    const hi = document.getElementById("thresholdHi");
    if (tog) tog.checked = false;
    if (ctl) ctl.style.display = "none";
    if (lo) lo.value = "";
    if (hi) hi.value = "";
    updateThresholdCount();
}

// ─── LEGEND ──────────────────────────────────────────────────────────────────
function buildHistogram(values, breaks, palette) {
    // 24-bin mini histogram, colored according to which class each bin falls in
    if (values.length < 5) return "";
    const min = Math.min(...values), max = Math.max(...values);
    if (max === min) return "";
    const nBins = 24;
    const bins = Array(nBins).fill(0);
    const binWidth = (max - min) / nBins;
    values.forEach(v => {
        let idx = Math.floor((v - min) / binWidth);
        if (idx >= nBins) idx = nBins - 1;
        if (idx < 0) idx = 0;
        bins[idx]++;
    });
    const peak = Math.max(...bins);
    const colorForBin = (binVal) => {
        if (!breaks || breaks.length === 0) {
            // Continuous — interpolate position into palette
            const ratio = (binVal - min) / (max - min);
            const idx = Math.min(palette.length - 1, Math.max(0, Math.floor(ratio * palette.length)));
            return palette[idx];
        }
        for (let i = 0; i < breaks.length; i++) {
            if (binVal < breaks[i]) return palette[i];
        }
        return palette[breaks.length];
    };
    let html = '<div class="hist">';
    bins.forEach((count, i) => {
        const center = min + (i + 0.5) * binWidth;
        const h = Math.max(2, Math.round(28 * count / peak));
        html += `<span class="hist-bar" style="height:${h}px; background:${colorForBin(center)};" title="${count} polygon${count !== 1 ? 's' : ''}"></span>`;
    });
    html += '</div>';
    return html;
}

// Assigned by setupLegendCustomization(); lets updateLegend() re-clamp a moved
// or resized legend after its content (and thus height) changes. Null until wired.
let _legendClamp = null;

// One-line plain-language summary under the legend: the average across places
// plus the highest/lowest named place. Helps a non-GIS reader orient instantly.
function buildLegendInsight(level, metric, values, vf, inChange) {
    if (!values || values.length < 2) return "";
    const fc = GEO_DATA[level];
    if (!fc) return "";
    const col = activeColumn(metric, state.year, level);
    let lo = null, hi = null, sum = 0, cnt = 0;
    fc.features.forEach(f => {
        const raw = f.properties[col];
        if (raw == null || !isFinite(+raw)) return;
        const v = +raw, name = featureName(f.properties, level);
        sum += v; cnt++;
        if (!lo || v < lo.v) lo = { v, name };
        if (!hi || v > hi.v) hi = { v, name };
    });
    if (cnt < 2) return "";
    const esc = s => String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const word = level === "muni" ? "town" : "district";
    const avgLabel = inChange ? `${word} avg change` : `${word} average`;
    return `${avgLabel} <strong>${vf(sum / cnt)}</strong> · ` +
        `high ${esc(hi.name)} <strong>${vf(hi.v)}</strong> · ` +
        `low ${esc(lo.name)} <strong>${vf(lo.v)}</strong>`;
}

// ─── CLASSIFICATION CONTROL (shared) ─────────────────────────────────────────
// Classification (Jenks / quantile / …) can be changed from two places now: the
// quick "Color grouping" dropdown on the map legend, and the full dropdown in
// the Appearance panel. Both route through setClassify so they — plus the
// manual-breaks input — stay in lockstep. syncClassifyControls() reflects the
// current state.classify onto every control (used by reset + URL restore too).
function syncClassifyControls() {
    const cs = document.getElementById("classifySelect");
    if (cs && cs.value !== state.classify) cs.value = state.classify;
    const ls = document.getElementById("legendClassify");
    if (ls) ls.value = state.classify;
    const manualWrap = document.getElementById("manualBreaksWrap");
    if (manualWrap) manualWrap.style.display = state.classify === "manual" ? "" : "none";
}
function setClassify(value) {
    const changed = value && value !== state.classify;
    if (changed) state.classify = value;
    syncClassifyControls();
    // If the slideshow is playing, re-freeze breaks for the newly chosen method so
    // the lock keeps applying (lockedBreaksFor matches on classify).
    if (changed && state.playing) _lockedBreaks = buildLockedYearBreaks();
    if (changed) { applyChoropleth(); updateLegend(); }
}

function updateLegend() {
    const { level, metric, palette, classify } = state;
    const m = getMetric(metric);
    const palObj = PALETTES[palette];
    const titleEl = document.getElementById("legendTitle");
    const unitEl = document.getElementById("legendUnit");
    const stopsEl = document.getElementById("legendStops");
    const metaEl = document.getElementById("legendMeta");
    const capEl = document.getElementById("legendCaption");
    if (capEl) capEl.hidden = true;   // re-shown for the normal classed/continuous legend
    const insightEl = document.getElementById("legendInsight");
    if (insightEl) insightEl.innerHTML = "";
    // Keep the legend's quick "Color grouping" dropdown in sync, and hide it in
    // bivariate mode (the 3×3 key has no single classification to switch).
    const legendClassifyRow = document.getElementById("legendClassifyRow");
    if (legendClassifyRow) legendClassifyRow.style.display = state.bivariate ? "none" : "";
    const legendClassifySel = document.getElementById("legendClassify");
    if (legendClassifySel && legendClassifySel.value !== state.classify) legendClassifySel.value = state.classify;
    const inChange = changeActive(metric, level);
    titleEl.textContent = m.label;
    if (unitEl) unitEl.textContent = state.bivariate ? "" : (inChange ? changeUnitLabel(m) : metricUnit(m));
    // Delta-aware value formatter — signed pts / $ / % when in change mode.
    const vf = inChange ? (x => fmtChangeDelta(x, m)) : (x => fmt(x, m.format));

    // ── Bivariate legend takes over the panel when bivariate mode is on ──────
    if (state.bivariate && _lastBivar) {
        const mB = getMetric(state.bivarMetricB);
        const { breaksA, breaksB, palette: pal } = _lastBivar;
        const colors = pal.colors;
        titleEl.textContent = `${m.label}  ×  ${mB.label}`;
        const cell = (i) => `<span class="bivar-cell" style="background:${colors[i]};"></span>`;
        // Grid is rendered with [0,0] in bottom-left (low/low) like a scatter plot:
        // row 0 (top) = high A, row 2 (bottom) = low A.
        const grid = `
            ${cell(6)}${cell(7)}${cell(8)}
            ${cell(3)}${cell(4)}${cell(5)}
            ${cell(0)}${cell(1)}${cell(2)}
        `;
        stopsEl.innerHTML = `
            <div class="bivar-wrap">
                <div class="bivar-ylabel">${m.label}${metricUnit(m) ? ` (${metricUnit(m)})` : ""} →</div>
                <div class="bivar-grid">${grid}</div>
                <div class="bivar-xlabel">${mB.label}${metricUnit(mB) ? ` (${metricUnit(mB)})` : ""} →</div>
            </div>
            <div class="bivar-cuts">
                <div><b>${m.label}</b> in thirds (low → high): &lt; ${fmt(breaksA[0], m.format)}, &lt; ${fmt(breaksA[1], m.format)}, ≥ ${fmt(breaksA[1], m.format)}</div>
                <div><b>${mB.label}</b> in thirds (low → high): &lt; ${fmt(breaksB[0], mB.format)}, &lt; ${fmt(breaksB[1], mB.format)}, ≥ ${fmt(breaksB[1], mB.format)}</div>
            </div>
        `;
        // No-data treatment for bivariate: a polygon missing EITHER metric is
        // painted cream (NO_DATA_COLOR) just like univariate, but the 3×3 key has
        // no slot for it — so show the same swatch + count here, otherwise blank
        // cells look mysterious (and easily confused with the low/low corner).
        const fcBV = GEO_DATA[level];
        const totalBV = fcBV ? fcBV.features.length : 0;
        const colA = activeColumn(metric, state.year, level);
        const colB = activeColumn(state.bivarMetricB, state.year, level);
        let bothBV = 0;
        if (fcBV) fcBV.features.forEach(f => {
            const a = f.properties[colA], b = f.properties[colB];
            if (a != null && isFinite(+a) && b != null && isFinite(+b)) bothBV++;
        });
        const nullBV = Math.max(0, totalBV - bothBV);
        metaEl.innerHTML = nullBV
            ? `<span class="legend-null"><span class="legend-null-swatch"></span>No data — <strong>${nullBV.toLocaleString()}</strong> of ${totalBV.toLocaleString()} polygons (missing ${m.label} or ${mB.label})</span>`
            : "";
        return;
    }

    const values = getValuesForLevel(level, metric);
    const totalFeatures = GEO_DATA[level] ? GEO_DATA[level].features.length : 0;
    const nullCount = Math.max(0, totalFeatures - values.length);
    // While year-play freezes the breaks, the legend's range labels + class colors
    // come from the pooled (all-years) scale, so they don't shift frame to frame.
    // The histogram still uses this year's `values`, showing how the current year
    // distributes within those fixed classes.
    const lock = lockedBreaksFor(metric, classify, level);
    const domainVals = lock ? lock.pooled : values;

    if (values.length === 0) {
        stopsEl.innerHTML = '<div class="legend-row" style="color:#90A4AE;">No data at this level for this metric.</div>';
        metaEl.innerHTML = `<span class="legend-null"><span class="legend-null-swatch"></span>No data — ${nullCount.toLocaleString()} of ${totalFeatures.toLocaleString()}</span>`;
        return;
    }

    if (insightEl) insightEl.innerHTML = buildLegendInsight(level, metric, values, vf, inChange);

    let breaks = null;
    let stops = classColors(palette, 5);

    if (classify === "continuous") {
        const min = Math.min(...domainVals), max = Math.max(...domainVals);
        const colors9 = sampleColors(palColors(palette), 9);
        const bar = colors9.map(c => `<span class="legend-bar-stop" style="background:${c};"></span>`).join("");
        stopsEl.innerHTML = `
            ${buildHistogram(values, null, colors9)}
            <div class="legend-bar">${bar}</div>
            <div class="legend-axis">
                <span>${vf(min)}</span>
                <span>${vf(max)}</span>
            </div>
        `;
    } else {
        const n = classCount(classify, domainVals);
        breaks = lock ? lock.breaks : computeBreaksCached(level, metric, values, classify, n);
        stops = stopsForClasses(palette, breaks, domainVals);
        if (breaks.length === 0) {
            stopsEl.innerHTML = `<div class="legend-row" style="color:#90A4AE;">${classify === "manual" ? "Enter break values above to classify." : "Not enough variation to classify."}</div>`;
        } else {
            const ranges = [`&lt; ${vf(breaks[0])}`];
            for (let i = 0; i < breaks.length - 1; i++) {
                ranges.push(`${vf(breaks[i])} – ${vf(breaks[i+1])}`);
            }
            ranges.push(`≥ ${vf(breaks[breaks.length-1])}`);
            let html = buildHistogram(values, breaks, stops);
            for (let i = 0; i < ranges.length; i++) {
                html += `<div class="legend-class"><span class="legend-class-swatch" style="background:${stops[i]};"></span><span class="legend-class-range">${ranges[i]}</span></div>`;
            }
            stopsEl.innerHTML = html;
        }
    }

    // Blank-cell legend: explain WHY polygons go blank. On a high-school metric at
    // district level, split the distinct "no high school here" districts (where the
    // value structurally doesn't apply) from genuine "no data" (suppressed / not
    // reported), so each blank color in the map is accounted for.
    const isOutcome = HS_OUTCOME_METRICS.has(metric);
    const nohsCount = (isOutcome && level === "district" && GEO_DATA[level])
        ? GEO_DATA[level].features.filter(f => f.properties._nohs).length
        : 0;
    const otherNull = Math.max(0, nullCount - nohsCount);
    // In change mode a polygon goes blank if EITHER endpoint year is missing.
    const yearPhrase = inChange ? `${state.changeFrom} or ${state.changeTo}` : `${state.year}`;
    let nullHtml = "";
    if (nohsCount > 0) {
        nullHtml += `<span class="legend-null"><span class="legend-null-swatch" style="background:${NO_HS_COLOR};background-image:none;border-color:#9aa1ad;"></span>No high school here — <strong>${nohsCount.toLocaleString()}</strong> ${nohsCount === 1 ? "district" : "districts"}</span>`
            + `<span class="legend-null-note">K-8 districts with no 9–12 grades; their students attend high school in another district, so this measure doesn't apply.</span>`;
    }
    if (otherNull > 0 || nohsCount === 0) {
        const ndCount = nohsCount > 0 ? otherNull : nullCount;
        const ndPct = totalFeatures ? Math.round(100 * ndCount / totalFeatures) : 0;
        const ndNote = isOutcome
            ? `Blank = cohort suppressed for privacy, or not reported for ${yearPhrase}.`
            : `Blank = not reported${inChange || isYearKeyed(metric, level) ? ` for ${yearPhrase}` : ""} or suppressed for privacy.`;
        nullHtml += `<span class="legend-null"><span class="legend-null-swatch"></span>No data — <strong>${ndCount.toLocaleString()}</strong> of ${totalFeatures.toLocaleString()} polygons (${ndPct}%)</span>`
            + `<span class="legend-null-note">${ndNote}</span>`;
    }
    metaEl.innerHTML = nullHtml;
    // Metric-specific caveat (e.g. suppression gaps, ratio-vs-percent meaning).
    if (METRIC_NOTES[metric]) {
        metaEl.insertAdjacentHTML("beforeend", `<span class="legend-null-note">⚠ ${METRIC_NOTES[metric]}</span>`);
    }
    // Plain-language "how to read the colors" caption.
    if (capEl) {
        const cap = legendCaptionText();
        capEl.textContent = cap;
        capEl.hidden = !cap;
    }
    // A moved/resized legend may now be a different height — keep it on-screen.
    if (_legendClamp) _legendClamp();
}

// ─── METRIC TAXONOMY (command-palette picker) ────────────────────────────────
// Two-level navigation over the full metric catalog: top-level DOMAINS, each holding
// existing `cat` values as subgroups. Purely a presentation layer over the flat
// METRICS array — nothing in the data model changes.
// Topics shown as tiles on the picker's home screen, in rough student-journey
// order (early education → scores → gaps → graduation → students → climate →
// money → community). Rebalanced from the old 5-domain grouping into 8 plain-
// language topics so no single tile dumps a wall of options on a non-expert
// visitor; Early Education is its own front-of-line tile rather than buried
// under Graduation.
const METRIC_DOMAINS = [
    { key:"early", icon:"🧸", label:"Early Education", desc:"PreK & Kindergarten access",
      cats:["Early education"] },
    { key:"scores", icon:"📊", label:"Test Scores & Growth", desc:"MCAS proficiency & student growth",
      cats:["Academic","Growth (MCAS SGP)","National benchmark"] },
    { key:"gaps", icon:"⚖️", label:"Gaps Between Groups", desc:"Differences by income, race, language",
      cats:["Equity gaps","Achievement by group","Achievement by group (Gr10)","Achievement by group (other)"] },
    { key:"grad", icon:"🎓", label:"Graduation & College", desc:"Graduation, AP, what comes next",
      cats:["Outcomes","Postsecondary","Postsecondary outcomes","Advanced coursework",
            "Progression","Career / vocational","Accountability","Economic mobility"] },
    { key:"students", icon:"👥", label:"Students", desc:"Demographics & special populations",
      cats:["Demographics","Special education","English learners","Enrollment flow","Trends"] },
    { key:"climate", icon:"🚸", label:"Discipline & Attendance", desc:"Suspensions, absence, support staff",
      cats:["Discipline","Discipline by group","Attendance","Absenteeism by group","Student support"] },
    { key:"money", icon:"💵", label:"Spending & Staff", desc:"Per-pupil dollars and teachers",
      cats:["Finance","Workforce"] },
    { key:"community", icon:"🏘️", label:"Community Context", desc:"Census income, housing & population",
      cats:["Census ACS","Population"] },
];
const DOMAIN_OTHER = { key:"other", icon:"📊", label:"Other", desc:"" };

// The handful of metrics a typical visitor reaches for first — surfaced under
// "Most used" at the top of the picker so most people never have to browse the
// full 220+ catalog. Only those available at the current level are shown.
const STARTER_METRICS = [
    "TOTAL_CNT", "grad_4yr", "mcas_g10_ela_me", "mcas_g10_math_me", "chronic_absent_pct",
    "mcas_ela_sgp", "avg_class_size", "per_pupil", "stu_tchr_ratio", "LI_PCT", "EL_PCT", "ap_pct_3plus",
];

// ── Start-here guided questions ──────────────────────────────────────────────
// The "Start here" tab's middle block: the plain-language questions a parent or
// resident actually asks, grouped into a few friendly themes. Each routes to ONE
// well-covered, neutrally-framed metric through the normal picker path (so the
// map, legend, year slider and panel all update as if picked from the catalog),
// then shows a one-line "what you're seeing" readout. Loaded / demographically
// fraught metrics (incarceration, by-race gaps) are deliberately NOT surfaced
// here — they stay fully available in the catalog and search.
const START_THEMES = [
    { icon:"📚", label:"Learning & results", qs:[
        { icon:"📖", label:"Strong reading scores?",            metric:"mcas_g38_ela_me" },
        { icon:"🔢", label:"Strong math scores?",               metric:"mcas_g38_math_me" },
        { icon:"📈", label:"Strong math growth?",               metric:"mcas_math_sgp" },
        { icon:"🏅", label:"Statewide ranking?",                metric:"accountability_percentile" },
    ]},
    { icon:"🏫", label:"Everyday experience", qs:[
        { icon:"👥", label:"Small class sizes?",                metric:"avg_class_size" },
        { icon:"📆", label:"How's attendance?",                 metric:"chronic_absent_pct" },
        { icon:"💬", label:"Enough counselors & support?",      metric:"students_per_counselor" },
        { icon:"🍎", label:"Experienced teachers?",             metric:"teacher_experienced_pct" },
    ]},
    { icon:"🎨", label:"Opportunities", qs:[
        { icon:"🎵", label:"Arts & music?",                     metric:"arts_music_pct" },
        { icon:"💻", label:"Spent on materials & tech?",        metric:"per_pupil_instr_materials" },
        { icon:"🔄", label:"Do families transfer in?",          metric:"choice_in_pct" },
        { icon:"🤝", label:"Inclusive special ed?",             metric:"sped_full_inclusion_pct" },
    ]},
    { icon:"💵", label:"People & money", qs:[
        { icon:"💰", label:"Spending per student?",             metric:"per_pupil" },
        { icon:"🌎", label:"Compared to the U.S.?",             metric:"seda_achievement" },
        { icon:"🧒", label:"Child poverty?",                    metric:"acs_child_poverty_pct" },
        { icon:"🪜", label:"Do low-income kids move up?",        metric:"mobility_kfr_p25" },
    ]},
];

// Curated, tone-screened correlations for the "See how two things connect" block.
// Each pair is already in BIVAR_PRESETS, so we reuse its vetted title / blurb /
// r-value and the existing applyBivarPreset() machinery. Resolved by metric pair
// (not array index) so it survives edits to BIVAR_PRESETS. A mix of confirming
// and counterintuitive pairings — and none of the fraught ones.
const START_CORRELATIONS = [
    ["acs_median_household_income", "mcas_g10_math_me"],  // expected: the classic income gradient
    ["pct_4yr_college", "college_enroll_4yr_pct"],        // expected: plans vs. actual enrollment
    ["FLNE_PCT", "acs_non_english_pct"],                  // expected: two sources confirm the same communities
    ["mcas_g38_ela_me", "grad_4yr"],                      // expected: early reading → graduation
    ["ap_subjects_offered", "_pop_density_per_sqmi"],     // surprising: a rural–urban AP-access gap
    ["mcas_math_low_income", "acs_mgmt_occ_pct"],         // surprising: a neighborhood spillover effect
];

// Share of DISTRICTS that actually carry a value for this metric (year-aware:
// uses the latest year-keyed column when the metric is a time series). Returns
// null when the data isn't loaded yet, so callers can fail open. Drives the
// guided questions' "majority coverage" rule below.
function districtCoverage(metricId) {
    if (!GEO_DATA || !GEO_DATA.district) return null;
    const feats = GEO_DATA.district.features;
    if (!feats.length) return null;
    const yrs = availableYears(metricId, "district");
    const col = (yrs && yrs.length) ? `${metricId}__${Math.max(...yrs)}` : metricId;
    let n = 0;
    for (const f of feats) { const v = f.properties[col]; if (v != null && isFinite(+v)) n++; }
    return n / feats.length;
}

// Coverage cache + "limited data" flag for the metric picker. Metrics reported for
// fewer than ~2/3 of districts (DESE suppresses small groups for privacy) get a
// badge so a half-blank map is never a surprise. HS-grade metrics are excluded —
// their blanks are the structural "no high school" set, explained on the map itself.
const LIMITED_DATA_THRESHOLD = 0.65;
const _covCache = new Map();
function districtCoverageCached(metricId) {
    if (_covCache.has(metricId)) return _covCache.get(metricId);
    const c = districtCoverage(metricId);
    if (c != null) _covCache.set(metricId, c);   // only cache once the data has loaded
    return c;
}
function isLimitedData(metricId) {
    if (state.level !== "district") return false;        // the patchy subgroups are district-only
    if (HS_OUTCOME_METRICS.has(metricId)) return false;  // structural HS blanks, explained elsewhere
    const c = districtCoverageCached(metricId);
    return c != null && c < LIMITED_DATA_THRESHOLD;
}

// A guided question / correlation only ever lands you on DISTRICT-level data, so
// auto-switch to districts if needed (mirrors applyBivarPreset) — otherwise a tap
// from the town view would silently no-op.
const START_MIN_COVERAGE = 0.5;
function ensureDistrictLevel() {
    if (state.level === "district") return;
    const lvlSel = document.getElementById("levelSelect");
    if (lvlSel) { lvlSel.value = "district"; lvlSel.dispatchEvent(new Event("change")); }
}

// Render the themed guided questions into #startQuestions. Each theme with at
// least one well-covered metric becomes a small labelled group; sparse-data
// metrics are pruned so a tap can never land on a mostly-blank map. (No-op-safe
// until data loads — fails open, then the load handler re-renders pruned.)
function renderStartQuestions() {
    const host = document.getElementById("startQuestions");
    if (!host) return;
    host.innerHTML = "";
    let shown = 0;
    let displayedThemes = 0;
    START_THEMES.forEach((theme, ti) => {
        const avail = theme.qs.filter(q => {
            if (!getMetric(q.metric)) return false;        // metric removed from catalog
            const cov = districtCoverage(q.metric);        // null = data not loaded yet → show
            return cov == null || cov >= START_MIN_COVERAGE;
        });
        if (!avail.length) return;
        // Each theme is collapsible so the full question list doesn't make the panel
        // overwhelming. First shown theme starts open; the rest start collapsed.
        const collapsed = displayedThemes > 0;
        displayedThemes++;
        const listId = `start-theme-list-${ti}`;
        const grp = document.createElement("div");
        grp.className = "start-theme" + (collapsed ? " collapsed" : "");
        const h = document.createElement("button");
        h.type = "button";
        h.className = "start-theme-h";
        h.setAttribute("aria-expanded", String(!collapsed));
        h.setAttribute("aria-controls", listId);
        h.innerHTML = `<span class="start-theme-ico" aria-hidden="true">${theme.icon}</span>` +
                      `<span class="start-theme-label">${theme.label}</span>` +
                      `<svg class="start-theme-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        h.addEventListener("click", () => {
            const nowCollapsed = grp.classList.toggle("collapsed");
            h.setAttribute("aria-expanded", String(!nowCollapsed));
        });
        grp.appendChild(h);
        const list = document.createElement("div");
        list.className = "concern-list";                   // reuse the contrast-safe list/button styles
        list.id = listId;
        list.setAttribute("role", "list");
        avail.forEach(q => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "concern-btn start-q";
            b.setAttribute("role", "listitem");
            b.innerHTML =
                `<span class="concern-ico" aria-hidden="true">${q.icon}</span>` +
                `<span class="concern-txt"><span class="concern-q">${q.label}</span></span>`;
            b.addEventListener("click", () => selectStartMetric(q));
            list.appendChild(b);
            shown++;
        });
        grp.appendChild(list);
        host.appendChild(grp);
    });
    if (!shown) host.innerHTML = `<p class="start-sub" style="margin:0;">Loading questions…</p>`;
}

// Leave any two-variable / delta / compare mode so a guided question always lands on
// a plain single-metric choropleth. Without this, tapping a question right after a
// "See how two things connect" correlation keeps state.bivariate on, so the map stays
// bivariate and updateLegend() keeps drawing the 3×3 key instead of the color ramp.
function exitToSingleMetricView() {
    if (state.compareMode) exitCompareMode();
    if (state.changeMode) {
        const ct = document.getElementById("changeToggle"); if (ct) ct.checked = false;
        setChangeMode(false);
    }
    if (state.bivariate) {
        state.bivariate = false;
        const bt = document.getElementById("bivariateToggle"); if (bt) bt.checked = false;
        const bc = document.getElementById("bivarControls"); if (bc) bc.style.display = "none";
        clearBivarPresetSelection();
    }
}

// Tap a guided question: switch to districts if needed, drop any bivariate/change/
// compare mode, set the metric through the normal picker path, and explain what's
// now on the map.
function selectStartMetric(q) {
    ensureDistrictLevel();
    exitToSingleMetricView();
    selectMetricFromPalette(q.metric);
    showStartReadout(q);
}

// One plain-language line under the questions: what's mapped, how to read the
// color ramp (good/bad direction via legendCaptionText), and — if the visitor
// has a place selected at this level — where that place ranks on it.
function showStartReadout(q) {
    const el = document.getElementById("startReadout");
    if (!el) return;
    const corr = document.getElementById("startCorrReadout");
    if (corr) corr.hidden = true;                          // only one readout at a time
    const m = getMetric(state.metric);
    if (!m) { el.hidden = true; return; }
    const cap = legendCaptionText();
    let html = `<div class="start-readout-h"><span class="start-readout-kicker">Now showing</span> ${q ? q.label : m.label}</div>` +
               `<div class="start-readout-sub">${m.label}${cap ? ` · ${cap}` : ""}</div>`;
    const ls = state.lastSelected;
    if (ls && ls.kind === state.level && (ls.kind === "district" || ls.kind === "muni") && ls.properties) {
        const col = activeColumn();
        const v = (col && ls.properties[col] != null && isFinite(+ls.properties[col])) ? +ls.properties[col] : null;
        const nm = featureName(ls.properties, ls.kind);
        if (v != null) {
            const rk = rankInfo(state.level, state.metric, v);
            const standing = (rk && !changeActive(state.metric, state.level)) ? standingPhrase(state.metric, rk, "mid") : null;
            html += `<div class="start-readout-you"><strong>${nm}:</strong> ${fmt(v, m.format)}` +
                    (rk ? ` · ${standing || `ranks #${rk.rank} of ${rk.total}`}` : "") + `</div>`;
        } else {
            html += `<div class="start-readout-tip">No data here for ${nm} on this measure.</div>`;
        }
    } else {
        html += `<div class="start-readout-tip">Tip: search your town above to see where it ranks.</div>`;
    }
    el.innerHTML = html;
    el.hidden = false;
}

// Look up a curated correlation in BIVAR_PRESETS by its metric pair.
function findBivarPreset(a, b) {
    for (const group of ["expected", "surprising"]) {
        const preset = (BIVAR_PRESETS[group] || []).find(p => p.a === a && p.b === b);
        if (preset) return { group, preset };
    }
    return null;
}

// Render the "See how two things connect" chips into #startCorrelations. Each
// chip fires the existing applyBivarPreset() (switches to districts, turns on
// bivariate, sets both metrics) and shows the vetted blurb inline.
function renderStartCorrelations() {
    const host = document.getElementById("startCorrelations");
    if (!host) return;
    host.innerHTML = "";
    START_CORRELATIONS.forEach(([a, b]) => {
        const found = findBivarPreset(a, b);
        if (!found) return;
        const { group, preset } = found;
        const mA = getMetric(a), mB = getMetric(b);
        if (!mA || !mB || !mA.levels.includes("district") || !mB.levels.includes("district")) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "start-corr";
        chip.title = preset.blurb;
        chip.innerHTML =
            `<span class="start-corr-tag start-corr-tag--${group}">${group === "surprising" ? "Surprising" : "As expected"}</span>` +
            `<span class="start-corr-title">${preset.title}</span>`;
        chip.addEventListener("click", () => { applyBivarPreset(preset); showCorrReadout(group, preset); });
        host.appendChild(chip);
    });
}

// Explain a correlation inline after a chip is tapped (the full controls + this
// same blurb also live in "Compare & highlight").
function showCorrReadout(group, preset) {
    const el = document.getElementById("startCorrReadout");
    if (!el) return;
    const main = document.getElementById("startReadout");
    if (main) main.hidden = true;                          // only one readout at a time
    const sign = preset.r > 0 ? "+" : "";
    el.innerHTML =
        `<div class="start-readout-h"><span class="start-readout-kicker">${group === "surprising" ? "Surprising" : "As expected"}</span> ${preset.title}</div>` +
        `<div class="start-readout-sub">${preset.blurb} <span style="white-space:nowrap; opacity:.7;">(r&nbsp;=&nbsp;${sign}${preset.r.toFixed(2)}, n&nbsp;=&nbsp;${preset.n})</span></div>` +
        `<div class="start-readout-tip">Each area is shaded by both at once. Open <strong>Compare &amp; highlight</strong> to switch or fine-tune the pairing.</div>`;
    el.hidden = false;
}

// Mini-dashboard tuning knobs (easy to tweak):
//  • TOP_PER_CARD     — quick-pick metrics shown on each topic card before "+N more".
//  • STARTER_CARD_MAX — cap for the leading "Most used" card.
// To hand-curate a card, add `top: ["id1","id2",…]` to its METRIC_DOMAINS entry;
// those win, then any STARTER_METRICS that live in the topic, then catalog order.
const TOP_PER_CARD = 3;
const STARTER_CARD_MAX = 8;

// Plain-language headings shown in place of the raw `cat` strings (de-jargoned).
const SUBGROUP_LABELS = {
    "Academic": "MCAS Proficiency",
    "Growth (MCAS SGP)": "Student Growth (SGP)",
    "Equity gaps": "Achievement & Opportunity Gaps",
    "Achievement by group": "Scores by Student Group (Gr 3–8)",
    "Achievement by group (Gr10)": "Scores by Student Group (Gr 10)",
    "Achievement by group (other)": "Scores — Military, Foster, Homeless",
    "Outcomes": "Graduation & Dropout",
    "Postsecondary": "College Enrollment",
    "Postsecondary outcomes": "After Graduation",
    "Advanced coursework": "AP & Advanced Courses",
    "Progression": "Grade Progression",
    "Career / vocational": "Career & Vocational",
    "Accountability": "State Accountability",
    "Early education": "Early Education (PreK/K)",
    "Demographics": "Student Demographics",
    "Special education": "Special Education",
    "English learners": "English Learners",
    "Enrollment flow": "Enrollment Changes",
    "Trends": "Trends Over Time",
    "Finance": "School Spending",
    "Workforce": "Teachers & Staff",
    "Discipline": "Discipline & Suspensions",
    "Discipline by group": "Discipline by Student Group",
    "Attendance": "Attendance & Absence",
    "Absenteeism by group": "Chronic Absence by Group",
    "Student support": "Counselors, Nurses & Support",
    "Census ACS": "Census (income, housing, work)",
    "Population": "Population",
};
// Which screen the picker shows: "home" (starters + topic tiles) or a domain
// key (drilled into one topic). Pure UI state — not persisted to the URL.
let metricPickerView = "home";
// cat → domain lookup, built once.
const CAT_TO_DOMAIN = (() => {
    const map = {};
    METRIC_DOMAINS.forEach(d => d.cats.forEach(c => { map[c] = d; }));
    return map;
})();
function metricDomainFor(cat) { return CAT_TO_DOMAIN[cat] || DOMAIN_OTHER; }
function metricSubgroupLabel(cat) { return SUBGROUP_LABELS[cat] || cat; }

// Update the picker button to show the current metric + its domain/subgroup.
function updateMetricPickerCurrent() {
    const el = document.getElementById("metricPickerCurrent");
    if (!el) return;
    const m = getMetric(state.metric);
    const dom = metricDomainFor(m.cat);
    el.innerHTML =
        `<span class="mp-cur-label">${m.label}</span>` +
        `<span class="mp-cur-sub">${dom.icon} ${metricSubgroupLabel(m.cat)}</span>`;
}

// Render the picker body: the home screen (starters + topic tiles), a drilled-in
// topic, or flat search results. Progressive disclosure keeps the 220+ catalog
// from hitting the visitor all at once. Pure UI state lives in metricPickerView.
function renderMetricPalette(term = "") {
    const list = document.getElementById("metricPickerList");
    if (!list) return;
    const t = term.trim().toLowerCase();
    const avail = m =>
        m.levels.includes(state.level) &&
        (m.requires !== "acs" || state.hasAcs);
    list.innerHTML = "";
    // Search & drill-in are option lists (listbox); the home dashboard overrides
    // this to a labelled "group" of card groups below, so the listbox never ends
    // up wrapping the cards' header/"+N more" buttons.
    list.setAttribute("role", "listbox");

    // 1) SEARCH — flat results across every topic, ignoring the current screen.
    // Ranked so a direct name match (0) beats a topic/sub match (1) beats a
    // broad domain-name match (2) — so "graduation" surfaces the grad-rate
    // metric before the rest of the Graduation & College topic. sort() is
    // stable, so ties keep catalog order.
    if (t) {
        const scored = [];
        METRICS.forEach(m => {
            if (!avail(m)) return;
            let score = -1;
            if (m.label.toLowerCase().includes(t)) score = 0;
            else if (m.cat.toLowerCase().includes(t) ||
                     metricSubgroupLabel(m.cat).toLowerCase().includes(t)) score = 1;
            else if (metricDomainFor(m.cat).label.toLowerCase().includes(t)) score = 2;
            if (score >= 0) scored.push({ m, score });
        });
        if (!scored.length) {
            list.innerHTML = `<div class="mp-empty">No metrics match “${term}”.</div>`;
            return;
        }
        scored.sort((a, b) => a.score - b.score);
        scored.forEach(({ m }) => list.appendChild(mpMetricItem(m, true)));
        return;
    }

    // 2) DRILLED-IN TOPIC — back button, topic title, metrics sub-grouped.
    const dom = METRIC_DOMAINS.find(d => d.key === metricPickerView);
    if (dom) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "mp-back";
        back.innerHTML = `<span class="mp-back-arrow" aria-hidden="true">‹</span> All topics`;
        back.addEventListener("click", () => { metricPickerView = "home"; renderMetricPalette(""); document.getElementById("metricSearch")?.focus(); });
        list.appendChild(back);

        const title = document.createElement("div");
        title.className = "mp-domain-title";
        title.innerHTML = `<span class="mp-domain-icon">${dom.icon}</span>${dom.label}`;
        list.appendChild(title);

        const inDom = METRICS.filter(m => avail(m) && metricDomainFor(m.cat).key === dom.key);
        const present = [...new Set(inDom.map(m => m.cat))];
        const ordered = (dom.cats || []).filter(c => present.includes(c))
            .concat(present.filter(c => !(dom.cats || []).includes(c)));
        ordered.forEach(cat => {
            const sub = document.createElement("div");
            sub.className = "mp-sub";
            const sh = document.createElement("div");
            sh.className = "mp-sub-head";
            sh.textContent = metricSubgroupLabel(cat);
            sub.appendChild(sh);
            inDom.filter(m => m.cat === cat).forEach(m => sub.appendChild(mpMetricItem(m, false)));
            list.appendChild(sub);
        });
        return;
    }

    // 3) HOME — a scannable "mini dashboard": one card per topic, each showing a
    // few quick-pick metrics as one-click chips plus a "+N more" that drills into
    // the full topic (the existing view in branch 2). A full-width "Most used"
    // card leads. This keeps the 220+ catalog calm on open — quick picks up front,
    // full browse one tap away — instead of a long stack of plain topic tiles.

    // The home dashboard is a set of labelled card groups, not an option list.
    list.setAttribute("role", "group");

    // Lead card (full width, above the grid): the cross-topic metrics most
    // visitors reach for first.
    const starters = STARTER_METRICS
        .map(id => METRICS.find(m => m.id === id))
        .filter(m => m && avail(m))
        .slice(0, STARTER_CARD_MAX);
    if (starters.length) {
        const card = document.createElement("div");
        card.className = "mp-card mp-card--wide";
        card.setAttribute("role", "group");
        card.setAttribute("aria-label", "Most used");
        const head = document.createElement("div");
        head.className = "mp-card-head mp-card-head--static";
        head.innerHTML = `<span class="mp-card-icon" aria-hidden="true">⭐</span>` +
                         `<span class="mp-card-title">Most used</span>`;
        card.appendChild(head);
        const picks = document.createElement("div");
        picks.className = "mp-picks mp-picks--wide";
        starters.forEach(m => picks.appendChild(mpPick(m)));
        card.appendChild(picks);
        list.appendChild(card);
    }

    // Topic cards in a responsive grid below the lead card.
    const cards = document.createElement("div");
    cards.className = "mp-cards";
    METRIC_DOMAINS.forEach(d => {
        const inDom = METRICS.filter(m => avail(m) && metricDomainFor(m.cat).key === d.key);
        if (!inDom.length) return;
        const top = topMetricsForDomain(d, inDom);
        const hasMore = inDom.length > top.length;   // anything beyond the quick-picks?

        const card = document.createElement("div");
        card.className = "mp-card";
        card.setAttribute("role", "group");
        card.setAttribute("aria-label", d.label);

        // Card head drills into the full topic — unless every metric is already a
        // chip here, in which case it's a plain (non-interactive) heading so there
        // is no dead-end drill-in (matters at the muni level / small topics).
        const head = document.createElement(hasMore ? "button" : "div");
        head.className = "mp-card-head" + (hasMore ? "" : " mp-card-head--static");
        head.innerHTML =
            `<span class="mp-card-icon" aria-hidden="true">${d.icon}</span>` +
            `<span class="mp-card-title"></span>` +
            `<span class="mp-card-count">${inDom.length}</span>`;
        head.querySelector(".mp-card-title").textContent = d.label;
        if (hasMore) {
            head.type = "button";
            head.title = d.desc ? `${d.label} — ${d.desc}` : `Browse all ${inDom.length} ${d.label} metrics`;
            head.addEventListener("click", () => drillIntoTopic(d.key));
        } else if (d.desc) {
            head.title = `${d.label} — ${d.desc}`;
        }
        card.appendChild(head);

        const picks = document.createElement("div");
        picks.className = "mp-picks";
        top.forEach(m => picks.appendChild(mpPick(m)));
        card.appendChild(picks);

        if (hasMore) {
            const more = document.createElement("button");
            more.type = "button";
            more.className = "mp-more";
            more.innerHTML = `+${inDom.length - top.length} more ` +
                             `<span class="mp-more-arrow" aria-hidden="true">›</span>`;
            more.addEventListener("click", () => drillIntoTopic(d.key));
            card.appendChild(more);
        }
        cards.appendChild(card);
    });

    list.appendChild(cards);
}

// Open a topic's full list (the drilled-in view) and keep keyboard focus inside
// the popover by landing on the back button (renderMetricPalette wipes the list,
// which would otherwise drop focus to <body>).
function drillIntoTopic(key) {
    metricPickerView = key;
    renderMetricPalette("");
    document.querySelector("#metricPickerList .mp-back")?.focus();
}

// Choose the quick-pick metrics shown on a topic card. Priority: an explicit
// curated `top:[ids]` on the domain, then any STARTER_METRICS that live in this
// topic (already hand-picked as most-used), then catalog order — capped at
// TOP_PER_CARD. `inDom` is the pre-filtered, available-at-this-level metric list.
function topMetricsForDomain(d, inDom) {
    const pick = [];
    const add = id => {
        if (pick.length >= TOP_PER_CARD) return;
        const m = inDom.find(x => x.id === id);
        if (m && !pick.includes(m)) pick.push(m);
    };
    (d.top || []).forEach(add);
    STARTER_METRICS.forEach(add);
    inDom.forEach(m => { if (pick.length < TOP_PER_CARD && !pick.includes(m)) pick.push(m); });
    return pick;
}

// One quick-pick chip inside a dashboard card — a compact, full-width button so
// long metric names stay readable (pills would truncate). Selecting it runs the
// same cascade as any other picker row via selectMetricFromPalette.
function mpPick(m) {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "mp-pick" + (m.id === state.metric ? " active" : "");
    pick.dataset.id = m.id;
    // Home chips are buttons in a labelled card group (not listbox options), so
    // mark the active one with aria-current rather than aria-selected.
    if (m.id === state.metric) pick.setAttribute("aria-current", "true");
    pick.textContent = m.label;
    pick.title = m.label;
    pick.addEventListener("click", () => selectMetricFromPalette(m.id));
    return pick;
}

// One metric row in the picker. `withTopic` appends a muted topic caption,
// used in flat search results so each hit keeps its context.
function mpMetricItem(m, withTopic) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mp-item" + (m.id === state.metric ? " active" : "") + (withTopic ? " has-sub" : "");
    item.dataset.id = m.id;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", m.id === state.metric ? "true" : "false");
    item.textContent = m.label;
    if (isLimitedData(m.id)) {
        const lim = document.createElement("span");
        lim.className = "mp-item-limited";
        lim.textContent = "limited data";
        lim.title = "Reported for under ~2/3 of districts — DESE suppresses small groups for privacy.";
        item.appendChild(lim);
    }
    if (withTopic) {
        const sub = document.createElement("span");
        sub.className = "mp-item-sub";
        sub.textContent = `${metricDomainFor(m.cat).icon} ${metricSubgroupLabel(m.cat)}`;
        item.appendChild(sub);
    }
    item.addEventListener("click", () => selectMetricFromPalette(m.id));
    return item;
}

// Pick a metric from the palette: drive the (hidden) canonical <select> so the
// existing change cascade (palette reset, bivariate sync, repaint, URL) runs.
function selectMetricFromPalette(id) {
    const sel = document.getElementById("metricSelect");
    if (sel) { sel.value = id; sel.dispatchEvent(new Event("change")); }
    closeMetricPicker();
}
function openMetricPicker() {
    const pop = document.getElementById("metricPickerPop");
    const btn = document.getElementById("metricPickerButton");
    const search = document.getElementById("metricSearch");
    if (!pop) return;
    // Portal the popover to <body> so the widened card grid can break out over the
    // map. The control panel clips (overflow) and its backdrop-filter would pin a
    // fixed child to the panel box, so the popover must not live inside it. Done
    // once and idempotent; open/close/keyboard wiring keys off ids, not nesting.
    // Normally <body>, but in fullscreen <body> sits outside the fullscreened
    // element (#main-content) and would not render — so re-home the popover into
    // the active fullscreen element when there is one.
    const portalTarget = document.fullscreenElement || document.body;
    if (pop.parentElement !== portalTarget) portalTarget.appendChild(pop);
    pop.hidden = false;
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (search) search.value = "";
    metricPickerView = "home";   // always reopen on the home screen
    renderMetricPalette("");
    positionMetricPickerPop();
    if (search) search.focus();
}
// Place the (body-portaled, position:fixed) popover under its button on desktop,
// sized to break out over the map for the card grid and height-clamped to the
// viewport (its list scrolls). On ≤768px the stylesheet takes over as a near-
// fullscreen sheet, so we strip the inline geometry and let CSS win.
function positionMetricPickerPop() {
    const pop = document.getElementById("metricPickerPop");
    const btn = document.getElementById("metricPickerButton");
    if (!pop || pop.hidden || !btn) return;
    if (window.matchMedia("(max-width: 768px)").matches) {
        pop.style.left = pop.style.top = pop.style.width = pop.style.maxHeight = "";
        return;
    }
    const r = btn.getBoundingClientRect();
    const margin = 12;
    const topMin = 68;                                    // clear the 64px site nav
    const width = Math.max(300, Math.min(560, window.innerWidth - r.left - margin));
    let top = r.bottom + 4;
    let maxH = window.innerHeight - top - margin;
    if (maxH < 300) {
        // Button sits low in a tall panel — rise up so the grid keeps a usable
        // height, overlapping the button rather than squishing against the edge.
        maxH = Math.min(560, window.innerHeight - topMin - margin);
        top = Math.max(topMin, window.innerHeight - margin - maxH);
    } else {
        maxH = Math.min(560, maxH);
    }
    pop.style.width = width + "px";
    pop.style.left = Math.round(r.left) + "px";
    pop.style.top = Math.round(top) + "px";
    pop.style.maxHeight = Math.round(maxH) + "px";
}
function closeMetricPicker() {
    const pop = document.getElementById("metricPickerPop");
    const btn = document.getElementById("metricPickerButton");
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
}
function toggleMetricPicker() {
    const pop = document.getElementById("metricPickerPop");
    if (pop && pop.hidden) openMetricPicker(); else closeMetricPicker();
}

// ─── UI WIRING ───────────────────────────────────────────────────────────────
function populateMetricSelect(searchTerm = "", mutateState = true) {
    const sel = document.getElementById("metricSelect");
    const term = searchTerm.trim().toLowerCase();
    const matches = m =>
        m.levels.includes(state.level) &&
        (m.requires !== "acs" || state.hasAcs) &&
        (!term || m.label.toLowerCase().includes(term) || m.cat.toLowerCase().includes(term));
    const candidates = METRICS.filter(matches);
    const categories = [...new Set(candidates.map(m => m.cat))];
    sel.innerHTML = "";
    if (candidates.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = `No metrics match "${searchTerm}"`;
        opt.disabled = true;
        sel.appendChild(opt);
        return;
    }
    categories.forEach(cat => {
        const grp = document.createElement("optgroup");
        grp.label = cat;
        candidates.filter(m => m.cat === cat).forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.label;
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });
    const availIds = candidates.map(m => m.id);
    // When filtering via the search box (mutateState=false) we only narrow the
    // visible options — the map keeps painting the current metric until the user
    // actually picks one, so a half-typed query never switches the map.
    if (mutateState) {
        if (!availIds.includes(state.metric)) state.metric = availIds[0];
        sel.value = state.metric;
        syncPaletteForMetric();   // change mode keeps a diverging palette; else metric default
        updateMetricSummary();
    } else if (availIds.includes(state.metric)) {
        sel.value = state.metric;
    }
    updateMetricPickerCurrent();
}

// Palettes considered color-vision-deficiency (CVD) safe — flagged for users
// who need them. Viridis-family use perceptually-uniform luminance so they
// remain interpretable for protanopia/deuteranopia/tritanopia.
const CVD_SAFE = new Set(["Viridis", "Inferno", "Magma", "Plasma", "Cividis", "Mako", "Rocket", "YlGnBu", "BuPu"]);

function populatePaletteSelect() {
    const sel = document.getElementById("paletteSelect");
    sel.innerHTML = "";
    const allNames = Object.keys(PALETTES);
    // Rainbow / perceptually-non-uniform ramps: legitimate but easy to misuse
    // (false boundaries, red↔green confusion). Surfaced in a "use with care"
    // group so non-experts don't grab them by default.
    const RAINBOW = new Set(["Turbo", "Spectral", "RdYlGn"]);
    const cvd = allNames.filter(n => CVD_SAFE.has(n));
    const seq = allNames.filter(n => PALETTES[n].type === "seq" && !CVD_SAFE.has(n) && !RAINBOW.has(n));
    const div = allNames.filter(n => PALETTES[n].type === "div" && !CVD_SAFE.has(n) && !RAINBOW.has(n));
    const cat = allNames.filter(n => PALETTES[n].type === "cat");
    const care = allNames.filter(n => RAINBOW.has(n));

    const addGroup = (label, names) => {
        if (!names.length) return;
        const grp = document.createElement("optgroup");
        grp.label = label;
        names.forEach(n => {
            const o = document.createElement("option");
            o.value = n; o.textContent = n;
            grp.appendChild(o);
        });
        sel.appendChild(grp);
    };
    addGroup("Color-blind safe (perceptually uniform)", cvd);
    addGroup("Sequential", seq);
    addGroup("Diverging", div);
    addGroup("Categorical (distinct hues)", cat);
    addGroup("Use with care — not color-blind safe", care);
    sel.value = state.palette;
}

// Populate the bivariate metric + palette pickers. Filtered by the active level
// (only metrics that exist at state.level qualify) and excludes the metric
// currently selected as the primary, so the user doesn't pair a metric with itself.
function populateBivarMetricSelect() {
    const sel = document.getElementById("bivarMetricSelect");
    if (!sel) return;
    const lvl = state.level;
    const candidates = METRICS.filter(m =>
        m.levels.includes(lvl) &&
        m.id !== state.metric &&
        (m.requires !== "acs" || state.hasAcs)
    );
    sel.innerHTML = "";
    // Group by category for readability
    const groups = {};
    candidates.forEach(m => {
        (groups[m.cat] = groups[m.cat] || []).push(m);
    });
    Object.entries(groups).forEach(([cat, list]) => {
        const grp = document.createElement("optgroup");
        grp.label = cat;
        list.forEach(m => {
            const o = document.createElement("option");
            o.value = m.id; o.textContent = m.label;
            grp.appendChild(o);
        });
        sel.appendChild(grp);
    });
    // Restore the selected value if it's still valid, else pick first
    if (candidates.find(m => m.id === state.bivarMetricB)) {
        sel.value = state.bivarMetricB;
    } else if (candidates.length) {
        state.bivarMetricB = candidates[0].id;
        sel.value = state.bivarMetricB;
    }
}

function populateBivarUI() {
    const palSel = document.getElementById("bivarPaletteSelect");
    if (palSel) {
        palSel.innerHTML = "";
        Object.entries(BIVAR_PALETTES).forEach(([key, pal]) => {
            const o = document.createElement("option");
            o.value = key; o.textContent = pal.name;
            palSel.appendChild(o);
        });
        palSel.value = state.bivarPalette;
    }
    populateBivarMetricSelect();
}

// ─── FEATURED PAIRINGS (bivariate presets) ───────────────────────────────────
// Fill the "Featured pairings" dropdown from BIVAR_PRESETS, grouped into
// expected vs surprising. Each option value encodes "group:index".
function populateBivarPresetSelect() {
    const sel = document.getElementById("bivarPresetSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">Pick a correlation to explore…</option>';
    const labels = { expected: "Expected — confirms the pattern", surprising: "Surprising — worth a look" };
    ["expected", "surprising"].forEach(group => {
        const list = BIVAR_PRESETS[group] || [];
        const grp = document.createElement("optgroup");
        grp.label = labels[group];
        list.forEach((p, i) => {
            // Only offer pairings whose metrics both exist at district level.
            const mA = getMetric(p.a), mB = getMetric(p.b);
            if (!mA || !mB || !mA.levels.includes("district") || !mB.levels.includes("district")) return;
            const o = document.createElement("option");
            o.value = `${group}:${i}`;
            o.textContent = p.title;
            grp.appendChild(o);
        });
        if (grp.children.length) sel.appendChild(grp);
    });
}

function getBivarPreset(key) {
    if (!key) return null;
    const [group, i] = key.split(":");
    return (BIVAR_PRESETS[group] || [])[+i] || null;
}

// Apply a featured pairing: ensure district level, set metric A, turn bivariate
// on, set metric B, repaint once, and show the blurb + correlation stat.
function applyBivarPreset(p) {
    if (!p) return;
    if (state.level !== "district") {
        const lvlSel = document.getElementById("levelSelect");
        if (lvlSel) { lvlSel.value = "district"; lvlSel.dispatchEvent(new Event("change")); }
    }
    if (getMetric(p.a)) state.metric = p.a;
    // Featured pairing turns on bivariate — exit Compare mode if it was active.
    if (state.compareMode) exitCompareMode();
    state.bivariate = true;
    state.bivarMetricB = p.b;
    const tog = document.getElementById("bivariateToggle");
    if (tog) tog.checked = true;
    const ctrls = document.getElementById("bivarControls");
    if (ctrls) ctrls.style.display = "";
    populateMetricSelect();        // syncs metric A: hidden select, palette, summary, picker label
    populateBivarMetricSelect();   // rebuilds B options (excludes A) and restores B = p.b
    updateMetricGating();
    applyChoropleth();
    updateLegend();
    setBivarPresetBlurb(p);
}

function setBivarPresetBlurb(p) {
    const el = document.getElementById("bivarPresetBlurb");
    if (!el) return;
    if (!p) { el.textContent = ""; return; }
    const sign = p.r > 0 ? "+" : "";
    el.innerHTML = `${p.blurb} <span style="white-space:nowrap; opacity:.75;">(r&nbsp;=&nbsp;${sign}${p.r.toFixed(2)}, n&nbsp;=&nbsp;${p.n})</span>`;
}

// When the user hand-picks metric A or B (or leaves bivariate mode) the chosen
// pairing no longer matches — clear the dropdown + blurb so it can't mislead.
function clearBivarPresetSelection() {
    const sel = document.getElementById("bivarPresetSelect");
    if (sel) sel.value = "";
    setBivarPresetBlurb(null);
}

// ─── GRAPH / CHARTS MODE ─────────────────────────────────────────────────────
// A modal with three cross-linked views of the current metric(s): a distribution
// histogram, an A×B scatter (Pearson r + least-squares fit line), and a ranked
// list. Hovering a point/row highlights the matching feature on the map; clicking
// flies to it and opens its profile. Feature ids equal the feature's index in
// GEO_DATA[level].features (MapLibre generateId assigns ids in feature order).

function graphSourceName() { return state.level === "muni" ? "municipalities" : "districts"; }

// Pull [{idx,name,a,b}] for the current level. needB drops rows missing metric B.
function graphRows(metricA, metricB, needB) {
    const fc = GEO_DATA && GEO_DATA[state.level];
    if (!fc) return [];
    const colA = activeColumn(metricA, state.year, state.level);
    const colB = metricB ? activeColumn(metricB, state.year, state.level) : null;
    const rows = [];
    fc.features.forEach((f, idx) => {
        const av = f.properties[colA];
        if (av == null || !isFinite(+av)) return;
        let bv = null;
        if (colB) {
            const raw = f.properties[colB];
            if (raw == null || !isFinite(+raw)) { if (needB) return; }
            else bv = +raw;
        }
        rows.push({ idx, name: featureName(f.properties, state.level), a: +av, b: bv });
    });
    return rows;
}

function pearson(xs, ys) {
    const n = xs.length; if (n < 2) return NaN;
    let sx=0, sy=0, sxx=0, syy=0, sxy=0;
    for (let i=0;i<n;i++){ const x=xs[i], y=ys[i]; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y; }
    const cov=sxy-sx*sy/n, vx=sxx-sx*sx/n, vy=syy-sy*sy/n;
    const d=Math.sqrt(vx*vy); return d ? cov/d : NaN;
}

function gEsc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

// Honest footnote for the Explore charts: nulls are dropped from every chart
// (never plotted as 0), so disclose how many of the level's places aren't shown.
function graphOmittedNote(shown, reason){
    const fc = GEO_DATA && GEO_DATA[state.level];
    const total = fc ? fc.features.length : shown;
    const omitted = Math.max(0, total - shown);
    if (!omitted) return "";
    const noun = state.level === "muni" ? "towns" : "districts";
    return `<div class="graph-note">${omitted.toLocaleString()} of ${total.toLocaleString()} ${noun} not shown — ${reason}.</div>`;
}

function renderScatterSVG(rows, mA, mB) {
    if (rows.length < 2) return `<div class="graph-empty">Not enough districts have both metrics at this level to draw a scatter.</div>`;
    const W=560, H=380, pl=64, pr=22, pt=22, pb=54;
    const xs=rows.map(r=>r.a), ys=rows.map(r=>r.b);
    let xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
    if (xmin===xmax){ xmin-=1; xmax+=1; } if (ymin===ymax){ ymin-=1; ymax+=1; }
    const sx=v=>pl+(v-xmin)/(xmax-xmin)*(W-pl-pr);
    const sy=v=>H-pb-(v-ymin)/(ymax-ymin)*(H-pt-pb);
    const r=pearson(xs,ys);
    const n=xs.length, mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
    let num=0, den=0; for(let i=0;i<n;i++){ num+=(xs[i]-mx)*(ys[i]-my); den+=(xs[i]-mx)**2; }
    const slope=den?num/den:0, intc=my-slope*mx;
    const selIdx = (state.selected && state.selected.source === graphSourceName()) ? state.selected.id : null;
    const mkPt = d => {
        const vals = `${fmt(d.a, mA.format)} · ${fmt(d.b, mB.format)}`;
        const cls = d.idx === selIdx ? "gscatter-pt gscatter-sel" : "gscatter-pt";
        return `<circle class="${cls}" data-idx="${d.idx}" data-name="${gEsc(d.name)}" data-vals="${gEsc(vals)}" cx="${sx(d.a).toFixed(1)}" cy="${sy(d.b).toFixed(1)}" r="3.4"/>`;
    };
    // Draw the selected point last so its highlight ring sits above the crowd.
    const ordered = selIdx == null ? rows : rows.filter(d => d.idx !== selIdx).concat(rows.filter(d => d.idx === selIdx));
    const pts = ordered.map(mkPt).join("");
    const uA=metricUnit(mA), uB=metricUnit(mB);
    return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Scatter plot of ${gEsc(mA.label)} versus ${gEsc(mB.label)}">
      <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H-pb}" class="gaxis"/>
      <line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" class="gaxis"/>
      <line x1="${sx(xmin).toFixed(1)}" y1="${sy(slope*xmin+intc).toFixed(1)}" x2="${sx(xmax).toFixed(1)}" y2="${sy(slope*xmax+intc).toFixed(1)}" class="gfit"/>
      ${pts}
      <text x="${pl}" y="${H-pb+16}" class="gtick">${gEsc(fmt(xmin,mA.format))}</text>
      <text x="${W-pr}" y="${H-pb+16}" text-anchor="end" class="gtick">${gEsc(fmt(xmax,mA.format))}</text>
      <text x="${pl-8}" y="${H-pb}" text-anchor="end" class="gtick">${gEsc(fmt(ymin,mB.format))}</text>
      <text x="${pl-8}" y="${pt+8}" text-anchor="end" class="gtick">${gEsc(fmt(ymax,mB.format))}</text>
      <text x="${(pl+W-pr)/2}" y="${H-12}" text-anchor="middle" class="gaxis-label">${gEsc(mA.label)}${uA?` (${gEsc(uA)})`:""}</text>
      <text transform="translate(16 ${(pt+H-pb)/2}) rotate(-90)" text-anchor="middle" class="gaxis-label">${gEsc(mB.label)}${uB?` (${gEsc(uB)})`:""}</text>
      <text x="${W-pr}" y="${pt+2}" text-anchor="end" class="gstat">r = ${isFinite(r)?(r>0?"+":"")+r.toFixed(2):"—"} · n = ${n}</text>
    </svg>` + graphOmittedNote(rows.length, "missing one or both metrics");
}

function renderDistributionSVG(rows, mA) {
    if (!rows.length) return `<div class="graph-empty">No data for this metric at this level.</div>`;
    const vals=rows.map(r=>r.a).sort((a,b)=>a-b);
    const n=vals.length, min=vals[0], max=vals[n-1];
    const mean=vals.reduce((a,b)=>a+b,0)/n, median=vals[Math.floor(n/2)];
    const W=560, H=360, pl=22, pr=22, pt=26, pb=46;
    const BINS=24, span=(max-min)||1, bw=span/BINS;
    const counts=new Array(BINS).fill(0);
    vals.forEach(v=>{ let b=Math.floor((v-min)/bw); if(b>=BINS)b=BINS-1; if(b<0)b=0; counts[b]++; });
    const peak=Math.max(...counts), plotW=W-pl-pr, plotH=H-pt-pb;
    const bars=counts.map((c,i)=>{
        const x=pl+i/BINS*plotW, w=plotW/BINS-1.5, h=peak?c/peak*plotH:0, y=H-pb-h;
        return `<rect class="gbar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"><title>${gEsc(fmt(min+i*bw,mA.format))} – ${gEsc(fmt(min+(i+1)*bw,mA.format))}: ${c}</title></rect>`;
    }).join("");
    const meanX=pl+(mean-min)/span*plotW;
    const noun=state.level==="muni"?"towns":"districts";
    return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Distribution of ${gEsc(mA.label)}">
      ${bars}
      <line x1="${meanX.toFixed(1)}" y1="${pt}" x2="${meanX.toFixed(1)}" y2="${H-pb}" class="gmean"/>
      <text x="${meanX.toFixed(1)}" y="${pt-8}" text-anchor="middle" class="gstat">mean ${gEsc(fmt(mean,mA.format))}</text>
      <line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" class="gaxis"/>
      <text x="${pl}" y="${H-pb+18}" class="gtick">${gEsc(fmt(min,mA.format))}</text>
      <text x="${W-pr}" y="${H-pb+18}" text-anchor="end" class="gtick">${gEsc(fmt(max,mA.format))}</text>
      <text x="${(pl+W-pr)/2}" y="${H-6}" text-anchor="middle" class="gaxis-label">${gEsc(mA.label)} — ${n} ${noun} (median ${gEsc(fmt(median,mA.format))})</text>
    </svg>` + graphOmittedNote(n, "no data for this metric");
}

function renderRankedHTML(rows, mA) {
    if (!rows.length) return `<div class="graph-empty">No data for this metric at this level.</div>`;
    const sorted=[...rows].sort((a,b)=>b.a-a.a);
    const lo=Math.min(0, ...sorted.map(r=>r.a)), hi=Math.max(...sorted.map(r=>r.a)), span=(hi-lo)||1;
    const noun=state.level==="muni"?"towns":"districts";
    const items=sorted.map((d,i)=>{
        const w=Math.max(1.5,(d.a-lo)/span*100);
        return `<div class="grank-row" data-idx="${d.idx}"><span class="grank-rank">${i+1}</span><span class="grank-name" title="${gEsc(d.name)}">${gEsc(d.name)}</span><span class="grank-track"><span class="grank-bar" style="width:${w.toFixed(1)}%"></span></span><span class="grank-val">${gEsc(fmt(d.a,mA.format))}</span></div>`;
    }).join("");
    return `<div class="grank-head">${gEsc(mA.label)} — ${sorted.length} ${noun}, high to low</div><div class="grank-list">${items}</div>`
        + graphOmittedNote(sorted.length, "no data for this metric");
}

// ─── SLOPE CHART (two years, connected lines) ────────────────────────────────
// The chart form of the change map: one line per feature from yFrom to yTo, so
// you read direction, rate, crossings, and convergence — not just the net color.
// Reuses change mode's two years as the default, with its own pickers.
function graphSlopeRows(yFrom, yTo) {
    const fc = GEO_DATA && GEO_DATA[state.level]; if (!fc) return [];
    const cf = yearColumn(state.metric, yFrom, state.level);
    const ct = yearColumn(state.metric, yTo, state.level);
    if (!cf || !ct) return [];
    const rows = [];
    fc.features.forEach((f, idx) => {
        const a = f.properties[cf], b = f.properties[ct];
        if (a == null || !isFinite(+a) || b == null || !isFinite(+b)) return;
        rows.push({ idx, name: featureName(f.properties, state.level), a: +a, b: +b });
    });
    return rows;
}

function populateGraphYearSelects(yrs) {
    const opts = yrs.map(y => `<option value="${y}">${y}</option>`).join("");
    ["graphSlopeFrom", "graphSlopeTo"].forEach((id, i) => {
        const sel = document.getElementById(id); if (!sel) return;
        sel.innerHTML = opts;
        sel.value = String(i === 0 ? state.graphSlopeFrom : state.graphSlopeTo);
    });
}

function renderSlopeSVG(rows, m, yFrom, yTo) {
    if (rows.length < 2) return `<div class="graph-empty">Need two years of ${gEsc(m.label)} with data to draw a slope chart.</div>`;
    const W = 560, H = 400, pl = 78, pr = 78, pt = 28, pb = 40;
    const vals = []; rows.forEach(r => { vals.push(r.a, r.b); });
    let ymin = Math.min(...vals), ymax = Math.max(...vals); if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const xL = pl, xR = W - pr;
    const sy = v => H - pb - (v - ymin) / (ymax - ymin) * (H - pt - pb);
    const selIdx = (state.selected && state.selected.source === graphSourceName()) ? state.selected.id : null;
    const mk = d => {
        const up = d.b > d.a, flat = d.b === d.a;
        const col = flat ? "#9bbb59" : up ? "#2166ac" : "#c0504d";
        const vals = `${yFrom}: ${fmt(d.a, m.format)} → ${yTo}: ${fmt(d.b, m.format)}`;
        const cls = d.idx === selIdx ? "gslope-line gslope-sel" : "gslope-line";
        return `<line class="${cls}" data-idx="${d.idx}" data-name="${gEsc(d.name)}" data-vals="${gEsc(vals)}" x1="${xL}" y1="${sy(d.a).toFixed(1)}" x2="${xR}" y2="${sy(d.b).toFixed(1)}" stroke="${col}"/>`;
    };
    const ordered = selIdx == null ? rows : rows.filter(d => d.idx !== selIdx).concat(rows.filter(d => d.idx === selIdx));
    const lines = ordered.map(mk).join("");
    const up = rows.filter(r => r.b > r.a).length, down = rows.filter(r => r.b < r.a).length;
    const noun = state.level === "muni" ? "towns" : "districts";
    return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Slope chart of ${gEsc(m.label)} from ${yFrom} to ${yTo}">
      <line x1="${xL}" y1="${pt}" x2="${xL}" y2="${H - pb}" class="gaxis"/>
      <line x1="${xR}" y1="${pt}" x2="${xR}" y2="${H - pb}" class="gaxis"/>
      ${lines}
      <text x="${xL}" y="${H - pb + 18}" text-anchor="middle" class="gaxis-label">${yFrom}</text>
      <text x="${xR}" y="${H - pb + 18}" text-anchor="middle" class="gaxis-label">${yTo}</text>
      <text x="${xL - 8}" y="${(sy(ymax) + 4).toFixed(1)}" text-anchor="end" class="gtick">${gEsc(fmt(ymax, m.format))}</text>
      <text x="${xL - 8}" y="${(sy(ymin)).toFixed(1)}" text-anchor="end" class="gtick">${gEsc(fmt(ymin, m.format))}</text>
      <text x="${W / 2}" y="${pt - 8}" text-anchor="middle" class="gstat">▲ ${up} up · ▼ ${down} down · n = ${rows.length} ${noun}</text>
    </svg>`;
}

// ─── SMALL-MULTIPLE MAPS (one mini-choropleth per year) ───────────────────────
// The map, repeated per year, on a shared color scale — read spatial change by
// scanning the row. Drawn to <canvas> (hundreds of polygons × many years), with
// geometry projected once per level and cached.
function geomRings(geom) {
    if (!geom) return [];
    const out = [];
    const polys = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
    polys.forEach(poly => poly.forEach(ring => out.push(ring)));
    return out;
}

let _smProj = { level: null, feats: null, wn: 1, hn: 1 };
function ensureSmallMultProjection(level) {
    if (_smProj.level === level && _smProj.feats) return _smProj;
    const fc = GEO_DATA && GEO_DATA[level];
    if (!fc) return null;
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    fc.features.forEach(f => { const b = geomBbox(f.geometry); if (!b) return; if (b[0] < minLon) minLon = b[0]; if (b[1] < minLat) minLat = b[1]; if (b[2] > maxLon) maxLon = b[2]; if (b[3] > maxLat) maxLat = b[3]; });
    const midLat = (minLat + maxLat) / 2, lonScale = Math.cos(midLat * Math.PI / 180);
    const effLon = (maxLon - minLon) * lonScale || 1, latSpan = (maxLat - minLat) || 1;
    const s = 1 / Math.max(effLon, latSpan);
    const wn = effLon * s, hn = latSpan * s;
    const feats = fc.features.map((f, idx) => ({
        idx,
        rings: geomRings(f.geometry).map(ring => {
            const proj = []; let px = null, py = null;
            for (const c of ring) {
                const nx = (c[0] - minLon) * lonScale * s, ny = (maxLat - c[1]) * s;
                if (px === null || Math.abs(nx - px) > 0.004 || Math.abs(ny - py) > 0.004) { proj.push([nx, ny]); px = nx; py = ny; }
            }
            return proj;
        }).filter(r => r.length > 2)
    }));
    _smProj = { level, feats, wn, hn };
    return _smProj;
}

function pickYears(yrs, max) {
    if (yrs.length <= max) return yrs.slice();
    const out = [], n = yrs.length;
    for (let i = 0; i < max; i++) out.push(yrs[Math.round(i * (n - 1) / (max - 1))]);
    return [...new Set(out)];
}

function colorForValue(v, breaks, stops) {
    if (v == null || !isFinite(+v)) return NO_DATA_COLOR;
    v = +v;
    for (let i = 0; i < breaks.length; i++) { if (v < breaks[i]) return stops[i]; }
    return stops[breaks.length] || stops[stops.length - 1];
}

function smLegendHTML(breaks, stops, m) {
    if (!breaks.length) return "";
    const lab = i => i === 0 ? `&lt; ${fmt(breaks[0], m.format)}`
        : i === breaks.length ? `≥ ${fmt(breaks[breaks.length - 1], m.format)}`
        : `${fmt(breaks[i - 1], m.format)} – ${fmt(breaks[i], m.format)}`;
    let out = "";
    for (let i = 0; i < stops.length; i++) out += `<span class="sm-leg-item"><span class="sm-leg-sw" style="background:${stops[i]}"></span>${lab(i)}</span>`;
    return out;
}

function renderSmallMultiplesShell(m, years, total) {
    const cap = total > years.length ? ` · showing ${years.length} of ${total} years` : "";
    const figs = years.map(y => `<figure class="sm-figure" data-year="${y}" title="Show ${y} on the main map"><canvas class="sm-canvas" data-year="${y}" width="160" height="120"></canvas><figcaption>${y}</figcaption></figure>`).join("");
    return `<div class="sm-head">${gEsc(m.label)} — by year, shared color scale${cap}</div>
      <div class="sm-grid">${figs}</div>
      <div class="sm-legend" id="smLegend"></div>
      <div class="sm-foot">Lighter→darker uses one scale across all years, so colors are comparable. Click a year to show it on the main map.</div>`;
}

function drawSmallMultiples(years, level, m) {
    const proj = ensureSmallMultProjection(level); if (!proj) return;
    const fc = GEO_DATA[level];
    const cols = {}; const pooled = [];
    years.forEach(y => { const c = yearColumn(m.id, y, level); cols[y] = c; if (c) fc.features.forEach(f => { const v = f.properties[c]; if (v != null && isFinite(+v)) pooled.push(+v); }); });
    if (!pooled.length) return;
    // Shared scale: the metric's own (sequential) palette, even if the map is in
    // change mode (RdBu); classified on the pooled distribution across all years.
    const smPalette = state.changeMode ? getMetric(m.id).palette : state.palette;
    const classify = (state.classify === "continuous" || state.classify === "manual") ? "quantile" : state.classify;
    const n = classCount(classify, pooled);
    const rawBreaks = computeBreaks(pooled, classify, n);
    const cb = []; let prev = -Infinity;
    rawBreaks.forEach(b => { const v = +b; if (isFinite(v) && v > prev) { cb.push(v); prev = v; } });
    const stops = stopsForClasses(smPalette, cb, pooled);
    document.querySelectorAll("#graphCanvas .sm-canvas").forEach(canvas => {
        const yr = +canvas.dataset.year, col = cols[yr];
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 160, cssH = canvas.clientHeight || 120;
        canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
        const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
        const box = Math.min(cssW / proj.wn, cssH / proj.hn);
        const ox = (cssW - proj.wn * box) / 2, oy = (cssH - proj.hn * box) / 2;
        proj.feats.forEach(pf => {
            const v = col ? fc.features[pf.idx].properties[col] : null;
            ctx.beginPath();
            pf.rings.forEach(ring => { ring.forEach((pt, i) => { const x = ox + pt[0] * box, y = oy + pt[1] * box; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.closePath(); });
            ctx.fillStyle = colorForValue(v, cb, stops); ctx.fill();
            ctx.lineWidth = 0.3; ctx.strokeStyle = "rgba(120,120,120,0.35)"; ctx.stroke();
        });
    });
    const legEl = document.getElementById("smLegend");
    if (legEl) legEl.innerHTML = smLegendHTML(cb, stops, m);
}

function populateGraphMetricB() {
    const sel=document.getElementById("graphMetricB"); if(!sel) return;
    const cands=METRICS.filter(m=>m.levels.includes(state.level) && m.id!==state.metric && (m.requires!=="acs"||state.hasAcs));
    sel.innerHTML="";
    const groups={}; cands.forEach(m=>{ (groups[m.cat]=groups[m.cat]||[]).push(m); });
    Object.entries(groups).forEach(([cat,list])=>{
        const g=document.createElement("optgroup"); g.label=cat;
        list.forEach(m=>{ const o=document.createElement("option"); o.value=m.id; o.textContent=m.label; g.appendChild(o); });
        sel.appendChild(g);
    });
    if(!state.graphMetricB || !cands.find(m=>m.id===state.graphMetricB))
        state.graphMetricB = cands.find(m=>m.id===state.bivarMetricB) ? state.bivarMetricB : (cands[0] && cands[0].id);
    if(state.graphMetricB) sel.value=state.graphMetricB;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON-SET CHARTS — the same data four ways, scoped to state.compareSet
// (places or schools), each member drawn in its accent color. Distinct from the
// whole-state "all" charts above, which stay unchanged.
// ═══════════════════════════════════════════════════════════════════════════

// A member's value for a metric id: places track the active year (panelValue),
// schools read their flat sch_* field. Returns a finite number or null.
function compareMemberValue(member, id) {
    if (member.kind === "school") {
        const v = member.properties[id];
        return (v != null && isFinite(+v)) ? +v : null;
    }
    const v = panelValue(member.properties, id);
    return (v != null && isFinite(+v)) ? +v : null;
}

// [{ member, v }] for set members that have a finite value on this metric.
function compareRows(id) {
    return state.compareSet
        .map(member => ({ member, v: compareMemberValue(member, id) }))
        .filter(r => r.v != null);
}

// {id,label,format} for the X / Y metric of a set chart (school vs place).
function setMetricMetaX() {
    if (state.compareKind === "school") {
        const sm = SCHOOL_COMPARE_METRICS.find(s => s.id === state.graphSchoolMetric) || SCHOOL_COMPARE_METRICS[0];
        return { id: sm.id, label: sm.label, format: sm.format };
    }
    const m = getMetric(state.metric);
    return { id: state.metric, label: m.label, format: m.format };
}
function setMetricMetaY() {
    if (state.compareKind === "school") {
        const sm = SCHOOL_COMPARE_METRICS.find(s => s.id === state.graphSchoolMetricB)
                || SCHOOL_COMPARE_METRICS[1] || SCHOOL_COMPARE_METRICS[0];
        return { id: sm.id, label: sm.label, format: sm.format };
    }
    const m = getMetric(state.graphMetricB);
    return { id: state.graphMetricB, label: m.label, format: m.format };
}

// Statewide {mean, median, n} for a metric — the reference lines on the bar
// chart. Places: the active-year level values; schools: across all enriched
// schools.
function metricStatsForSet(id) {
    let values = [];
    if (state.compareKind === "school") {
        if (SCHOOLS_FC) SCHOOLS_FC.features.forEach(f => { const v = f.properties[id]; if (v != null && isFinite(+v)) values.push(+v); });
    } else {
        values = getValuesForLevel(state.level, id) || [];
    }
    if (!values.length) return { mean: NaN, median: NaN, n: 0 };
    const s = [...values].sort((a, b) => a - b);
    return { mean: s.reduce((a, b) => a + b, 0) / s.length, median: s[Math.floor(s.length / 2)], n: s.length };
}

// All (x,y) pairs in the population, for the faded scatter cloud + regression.
function setPopulationPairs(xid, yid) {
    const out = [];
    if (state.compareKind === "school") {
        if (!SCHOOLS_FC) return out;
        SCHOOLS_FC.features.forEach(f => {
            const a = f.properties[xid], b = f.properties[yid];
            if (a != null && isFinite(+a) && b != null && isFinite(+b)) out.push([+a, +b]);
        });
    } else {
        const fc = GEO_DATA && GEO_DATA[state.level]; if (!fc) return out;
        const cx = activeColumn(xid, state.year, state.level), cy = activeColumn(yid, state.year, state.level);
        fc.features.forEach(f => {
            const a = f.properties[cx], b = f.properties[cy];
            if (a != null && isFinite(+a) && b != null && isFinite(+b)) out.push([+a, +b]);
        });
    }
    return out;
}

// 1) GROUPED BAR — one accent bar per member on the active metric, sorted high
// to low, with statewide mean + median reference ticks.
function renderGroupBarHTML(rows, meta, stats) {
    const nounP = compareNoun(true);
    if (rows.length < 1) return `<div class="graph-empty">None of the selected ${nounP} report “${gEsc(meta.label)}”.</div>`;
    const sorted = [...rows].sort((a, b) => b.v - a.v);
    const vals = sorted.map(r => r.v);
    const refs = [];
    if (stats && isFinite(stats.mean)) refs.push(stats.mean);
    if (stats && isFinite(stats.median)) refs.push(stats.median);
    const lo = Math.min(0, ...vals, ...refs), hi = Math.max(...vals, ...refs), span = (hi - lo) || 1;
    const pct = v => (v - lo) / span * 100;
    const meanPct = (stats && isFinite(stats.mean)) ? pct(stats.mean) : null;
    const medianPct = (stats && isFinite(stats.median)) ? pct(stats.median) : null;
    const refMarks =
        (meanPct != null ? `<span class="cbar-ref cbar-mean" style="left:${meanPct.toFixed(1)}%" title="State mean ${gEsc(fmt(stats.mean, meta.format))}"></span>` : "") +
        (medianPct != null ? `<span class="cbar-ref cbar-median" style="left:${medianPct.toFixed(1)}%" title="State median ${gEsc(fmt(stats.median, meta.format))}"></span>` : "");
    const items = sorted.map(r => {
        const w = Math.max(2, pct(r.v)), c = pickColor(r.member.idx);
        return `<div class="cbar-row" data-flykey="${cmpEsc(r.member.key)}" data-msrc="${r.member.source}" data-mid="${r.member.id}" data-name="${gEsc(r.member.name)}" data-vals="${gEsc(meta.label + ": " + fmt(r.v, meta.format))}">` +
            `<span class="cbar-name" style="color:${c}" title="${gEsc(r.member.name)}">${gEsc(r.member.name)}</span>` +
            `<span class="cbar-track">${refMarks}<span class="cbar-fill" style="width:${w.toFixed(1)}%;background:${c}"></span></span>` +
            `<span class="cbar-val">${gEsc(fmt(r.v, meta.format))}</span></div>`;
    }).join("");
    const omitted = state.compareSet.length - rows.length;
    const omNote = omitted > 0 ? `<div class="graph-note">${omitted} selected ${omitted === 1 ? compareNoun(false) : nounP} not shown — no “${gEsc(meta.label)}” reported.</div>` : "";
    const refLegend = (meanPct != null || medianPct != null)
        ? `<div class="cbar-legend">${meanPct != null ? '<span class="cbar-leg cbar-leg-mean">state mean</span>' : ""}${medianPct != null ? '<span class="cbar-leg cbar-leg-median">state median</span>' : ""}</div>`
        : "";
    return `<div class="cbar-head">${gEsc(meta.label)} — selected ${nounP}, vs statewide</div>${refLegend}<div class="cbar-list">${items}</div>${omNote}`;
}

// 2) PROFILE PANELS — a mini bar panel per metric, members scaled within the set
// so the spread shows. The whole-place profile at a glance.
function renderProfilePanels() {
    const set = state.compareSet;
    const list = state.compareKind === "school"
        ? SCHOOL_COMPARE_METRICS.map(s => ({ id: s.id, label: s.label, format: s.format }))
        : COMPARE_METRICS.map(id => {
            const m = getMetric(id);
            return (m && m.id === id && (!Array.isArray(m.levels) || m.levels.includes(state.level)))
                ? { id, label: m.label, format: m.format } : null;
          }).filter(Boolean);
    const legend = set.map(m => `<span class="cprof-leg"><span class="cprof-sw" style="background:${pickColor(m.idx)}"></span>${gEsc(m.name)}</span>`).join("");
    const panels = list.map(meta => {
        const vals = set.map(m => compareMemberValue(m, meta.id));
        if (vals.every(v => v == null)) return "";
        const present = vals.filter(v => v != null);
        let lo = Math.min(...present), hi = Math.max(...present);
        if (lo === hi) { lo = Math.min(0, lo); if (lo === hi) hi = lo + 1; }
        const bars = set.map((m, i) => {
            const v = vals[i];
            const w = v == null ? 0 : Math.max(2, (v - lo) / ((hi - lo) || 1) * 100);
            return `<div class="cprof-bar-row" data-flykey="${cmpEsc(m.key)}" data-msrc="${m.source}" data-mid="${m.id}" data-name="${gEsc(m.name)}" data-vals="${gEsc(meta.label + ": " + (v == null ? "—" : fmt(v, meta.format)))}">` +
                `<span class="cprof-bar-track"><span class="cprof-bar-fill" style="width:${w.toFixed(1)}%;background:${pickColor(m.idx)}"></span></span>` +
                `<span class="cprof-bar-val">${v == null ? "—" : gEsc(fmt(v, meta.format))}</span></div>`;
        }).join("");
        return `<figure class="cprof-panel"><figcaption>${gEsc(meta.label)}</figcaption>${bars}</figure>`;
    }).join("");
    return `<div class="cprof-legend">${legend}</div><div class="cprof-grid">${panels}</div>` +
        `<div class="graph-note">Each panel is scaled to the selected ${compareNoun(true)} (not statewide), so small differences stand out.</div>`;
}

// 3) LABELED SCATTER — the full-state cloud faded for context, members as large
// named accent dots; regression + r computed over the whole population.
function renderSetScatterSVG(mX, mY) {
    const set = state.compareSet;
    const cloud = setPopulationPairs(mX.id, mY.id);
    const mpts = set.map(m => ({ m, x: compareMemberValue(m, mX.id), y: compareMemberValue(m, mY.id) }))
                    .filter(p => p.x != null && p.y != null);
    if (mpts.length < 1) return `<div class="graph-empty">The selected ${compareNoun(true)} don't have both “${gEsc(mX.label)}” and “${gEsc(mY.label)}”.</div>`;
    const xs = [], ys = [];
    cloud.forEach(p => { xs.push(p[0]); ys.push(p[1]); });
    mpts.forEach(p => { xs.push(p.x); ys.push(p.y); });
    let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    if (xmin === xmax) { xmin -= 1; xmax += 1; } if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const W = 560, H = 400, pl = 64, pr = 24, pt = 22, pb = 54;
    const sx = v => pl + (v - xmin) / (xmax - xmin) * (W - pl - pr);
    const sy = v => H - pb - (v - ymin) / (ymax - ymin) * (H - pt - pb);
    let fit = "", r = NaN;
    if (cloud.length >= 2) {
        const cx = cloud.map(p => p[0]), cy = cloud.map(p => p[1]);
        r = pearson(cx, cy);
        const n = cx.length, mx = cx.reduce((a, b) => a + b, 0) / n, my = cy.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (cx[i] - mx) * (cy[i] - my); den += (cx[i] - mx) ** 2; }
        const slope = den ? num / den : 0, intc = my - slope * mx;
        fit = `<line x1="${sx(xmin).toFixed(1)}" y1="${sy(slope * xmin + intc).toFixed(1)}" x2="${sx(xmax).toFixed(1)}" y2="${sy(slope * xmax + intc).toFixed(1)}" class="gfit"/>`;
    }
    const cloudDots = cloud.map(p => `<circle class="gscatter-bg" cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="2"/>`).join("");
    const memDots = mpts.map(p => {
        const c = pickColor(p.m.idx), cx = sx(p.x), cy = sy(p.y);
        const right = cx < W - 96;
        return `<g class="gset-pt" data-flykey="${cmpEsc(p.m.key)}" data-msrc="${p.m.source}" data-mid="${p.m.id}" data-name="${gEsc(p.m.name)}" data-vals="${gEsc(fmt(p.x, mX.format) + " · " + fmt(p.y, mY.format))}">` +
            `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${c}" stroke="#fff" stroke-width="1.6"/>` +
            `<text x="${(right ? cx + 9 : cx - 9).toFixed(1)}" y="${(cy - 8).toFixed(1)}" text-anchor="${right ? "start" : "end"}" class="gset-lbl" fill="${c}">${gEsc(p.m.name)}</text></g>`;
    }).join("");
    const uX = metricUnit(mX), uY = metricUnit(mY);
    const rTxt = isFinite(r) ? `r = ${(r > 0 ? "+" : "") + r.toFixed(2)} · n = ${cloud.length} all ${compareNoun(true)}` : `n = ${cloud.length}`;
    return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Scatter of ${gEsc(mX.label)} versus ${gEsc(mY.label)} for the selected ${compareNoun(true)}">
      <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H - pb}" class="gaxis"/>
      <line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" class="gaxis"/>
      ${fit}${cloudDots}${memDots}
      <text x="${pl}" y="${H - pb + 16}" class="gtick">${gEsc(fmt(xmin, mX.format))}</text>
      <text x="${W - pr}" y="${H - pb + 16}" text-anchor="end" class="gtick">${gEsc(fmt(xmax, mX.format))}</text>
      <text x="${pl - 8}" y="${H - pb}" text-anchor="end" class="gtick">${gEsc(fmt(ymin, mY.format))}</text>
      <text x="${pl - 8}" y="${pt + 8}" text-anchor="end" class="gtick">${gEsc(fmt(ymax, mY.format))}</text>
      <text x="${(pl + W - pr) / 2}" y="${H - 12}" text-anchor="middle" class="gaxis-label">${gEsc(mX.label)}${uX ? ` (${gEsc(uX)})` : ""}</text>
      <text transform="translate(16 ${(pt + H - pb) / 2}) rotate(-90)" text-anchor="middle" class="gaxis-label">${gEsc(mY.label)}${uY ? ` (${gEsc(uY)})` : ""}</text>
      <text x="${W - pr}" y="${pt + 2}" text-anchor="end" class="gstat">${gEsc(rTxt)}</text>
    </svg>`;
}

// 4) TREND OVER TIME — one accent line per member across every available year,
// with a dashed statewide-mean line for context. Places only (school data is
// single-year).
function renderTrendSVG(meta) {
    const set = state.compareSet, level = state.level;
    const yrs = availableYears(meta.id, level);
    if (yrs.length < 2) return `<div class="graph-empty">“${gEsc(meta.label)}” has only one year of data — no trend to chart. Try Bars or Profile.</div>`;
    const series = set.map(m => {
        const pts = [];
        yrs.forEach(y => { const col = yearColumn(meta.id, y, level); const v = col ? m.properties[col] : null; if (v != null && isFinite(+v)) pts.push([y, +v]); });
        return { m, pts };
    }).filter(s => s.pts.length);
    if (!series.length) return `<div class="graph-empty">None of the selected ${compareNoun(true)} report “${gEsc(meta.label)}” over time.</div>`;
    const fc = GEO_DATA[level], meanPts = [];
    yrs.forEach(y => {
        const col = yearColumn(meta.id, y, level); if (!col) return;
        let s = 0, n = 0; fc.features.forEach(f => { const v = f.properties[col]; if (v != null && isFinite(+v)) { s += +v; n++; } });
        if (n) meanPts.push([y, s / n]);
    });
    const allV = []; series.forEach(s => s.pts.forEach(p => allV.push(p[1]))); meanPts.forEach(p => allV.push(p[1]));
    let ymin = Math.min(...allV), ymax = Math.max(...allV); if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const W = 600, H = 400, pl = 64, pr = 128, pt = 24, pb = 44;
    const y0 = yrs[0], y1 = yrs[yrs.length - 1];
    const sx = y => pl + (y - y0) / ((y1 - y0) || 1) * (W - pl - pr);
    const sy = v => H - pb - (v - ymin) / ((ymax - ymin) || 1) * (H - pt - pb);
    const meanLine = meanPts.length >= 2
        ? `<polyline class="gtrend-mean" fill="none" points="${meanPts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")}"/>` +
          `<text x="${(sx(meanPts[meanPts.length - 1][0]) + 6).toFixed(1)}" y="${(sy(meanPts[meanPts.length - 1][1])).toFixed(1)}" class="gtick">MA avg</text>`
        : "";
    const lines = series.map(s => {
        const c = pickColor(s.m.idx);
        const pts = s.pts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
        const dots = s.pts.map(p => `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="2.6" fill="${c}"/>`).join("");
        const last = s.pts[s.pts.length - 1];
        return `<g class="gtrend-line" data-flykey="${cmpEsc(s.m.key)}" data-msrc="${s.m.source}" data-mid="${s.m.id}" data-name="${gEsc(s.m.name)}" data-vals="${gEsc(meta.label + " " + y0 + "–" + y1)}">` +
            `<polyline fill="none" stroke="${c}" points="${pts}"/>${dots}` +
            `<text x="${(sx(last[0]) + 6).toFixed(1)}" y="${(sy(last[1]) + 3).toFixed(1)}" class="gtrend-lbl" fill="${c}">${gEsc(s.m.name)}</text></g>`;
    }).join("");
    return `<svg class="gsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Trend of ${gEsc(meta.label)} for the selected ${compareNoun(true)}">
      <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H - pb}" class="gaxis"/>
      <line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" class="gaxis"/>
      ${meanLine}${lines}
      <text x="${pl}" y="${H - pb + 18}" class="gtick">${y0}</text>
      <text x="${(W - pr).toFixed(1)}" y="${H - pb + 18}" text-anchor="end" class="gtick">${y1}</text>
      <text x="${pl - 8}" y="${(sy(ymax) + 4).toFixed(1)}" text-anchor="end" class="gtick">${gEsc(fmt(ymax, meta.format))}</text>
      <text x="${pl - 8}" y="${(sy(ymin)).toFixed(1)}" text-anchor="end" class="gtick">${gEsc(fmt(ymin, meta.format))}</text>
    </svg>`;
}

// Dispatch the right set chart for the active tab.
function renderSetChart(tab) {
    const nounP = compareNoun(true);
    if (state.compareSet.length < 2)
        return `<div class="graph-empty">Pick at least 2 ${nounP} on the map to chart them. You have ${state.compareSet.length}.</div>`;
    const mX = setMetricMetaX();
    if (tab === "groupbar") return renderGroupBarHTML(compareRows(mX.id), mX, metricStatsForSet(mX.id));
    if (tab === "profile")  return renderProfilePanels();
    if (tab === "scatter")  return renderSetScatterSVG(mX, setMetricMetaY());
    if (tab === "trend") {
        if (state.compareKind === "school")
            return `<div class="graph-empty">School data is a single year, so there's no trend to chart. Try Bars, Profile, or Scatter.</div>`;
        return renderTrendSVG(mX);
    }
    return "";
}

// Show/hide tabs valid for the current scope/kind; keep state.graphTab valid.
function syncGraphTabsForScope() {
    const valid = state.graphScope === "set"
        ? (state.compareKind === "school" ? ["groupbar", "profile", "scatter"] : ["groupbar", "profile", "scatter", "trend"])
        : ["distribution", "scatter", "ranked", "slope", "overtime"];
    document.querySelectorAll(".graph-tab").forEach(b => {
        b.style.display = valid.includes(b.dataset.tab) ? "" : "none";
    });
    if (!valid.includes(state.graphTab)) state.graphTab = valid[0];
    document.querySelectorAll(".graph-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === state.graphTab));
}

// Update the All ↔ Comparison-set switch labels + active state.
function syncGraphScopeUI() {
    const setN = state.compareSet.length;
    const allBtn = document.querySelector('#graphScopeWrap [data-scope="all"]');
    const setBtn = document.querySelector('#graphScopeWrap [data-scope="set"]');
    if (allBtn) allBtn.textContent = `All ${state.level === "muni" ? "towns" : "districts"}`;
    if (setBtn) setBtn.textContent = setN ? `Comparison set (${setN})` : "Comparison set";
    document.querySelectorAll("#graphScopeWrap [data-scope]").forEach(b =>
        b.classList.toggle("active", b.dataset.scope === state.graphScope));
}

// Populate the school X/Y metric pickers (set-scope, school kind).
function populateGraphSchoolMetrics() {
    const opts = SCHOOL_COMPARE_METRICS.map(s => `<option value="${s.id}">${gEsc(s.label)}</option>`).join("");
    const x = document.getElementById("graphSchoolMetric");
    const y = document.getElementById("graphSchoolMetricB");
    if (!state.graphSchoolMetric)  state.graphSchoolMetric  = SCHOOL_COMPARE_METRICS[1].id; // accountability %ile
    if (!state.graphSchoolMetricB) state.graphSchoolMetricB = SCHOOL_COMPARE_METRICS[2].id; // MCAS ELA
    if (x) { x.innerHTML = opts; x.value = state.graphSchoolMetric; }
    if (y) { y.innerHTML = opts; y.value = state.graphSchoolMetricB; }
}

function renderGraph() {
    const canvas=document.getElementById("graphCanvas"); if(!canvas) return;
    const mA=getMetric(state.metric);
    syncGraphTabsForScope();
    syncGraphScopeUI();
    const scope=state.graphScope, tab=state.graphTab;
    const schoolSet = scope==="set" && state.compareKind==="school";

    // Control visibility by scope/tab/kind.
    const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.style.display = on ? "" : "none"; };
    show("graphBWrap",            tab==="scatter" && !schoolSet);                 // place Y-metric picker
    show("graphYearsWrap",        scope==="all" && tab==="slope");                // slope years (all only)
    show("graphSchoolMetricWrap", schoolSet && (tab==="groupbar" || tab==="scatter"));
    show("graphSchoolMetricBWrap",schoolSet && tab==="scatter");

    const titleEl=document.getElementById("graphModalTitle");
    if(titleEl){
        if(scope==="set"){
            const n=state.compareSet.length, nounP=compareNoun(true);
            const mX=setMetricMetaX();
            titleEl.textContent = tab==="profile"
                ? `Compare ${n} ${nounP} — full profile`
                : `Compare ${n} ${nounP} — ${mX.label}`;
        } else {
            titleEl.textContent = `Explore charts — ${mA.label}`;
        }
    }

    let html, drawSM = false, smYears = null;
    if(scope==="set"){
        html = renderSetChart(tab);
    } else {
        const yrs = availableYears(state.metric, state.level);
        if(tab==="scatter"){
            const mB=getMetric(state.graphMetricB);
            html=renderScatterSVG(graphRows(state.metric, state.graphMetricB, true), mA, mB);
        } else if(tab==="ranked"){
            html=renderRankedHTML(graphRows(state.metric, null, false), mA);
        } else if(tab==="slope"){
            if(yrs.length<2){ html=`<div class="graph-empty">${gEsc(mA.label)} has only one year of data — a slope chart needs two.</div>`; }
            else {
                if(!state.graphSlopeFrom || !yrs.includes(state.graphSlopeFrom)) state.graphSlopeFrom = (state.changeFrom && yrs.includes(state.changeFrom)) ? state.changeFrom : yrs[0];
                if(!state.graphSlopeTo   || !yrs.includes(state.graphSlopeTo))   state.graphSlopeTo   = (state.changeTo   && yrs.includes(state.changeTo))   ? state.changeTo   : yrs[yrs.length-1];
                if(state.graphSlopeFrom===state.graphSlopeTo){ state.graphSlopeFrom=yrs[0]; state.graphSlopeTo=yrs[yrs.length-1]; }
                populateGraphYearSelects(yrs);
                html=renderSlopeSVG(graphSlopeRows(state.graphSlopeFrom, state.graphSlopeTo), mA, state.graphSlopeFrom, state.graphSlopeTo);
            }
        } else if(tab==="overtime"){
            if(yrs.length<2){ html=`<div class="graph-empty">${gEsc(mA.label)} has only one year of data — nothing to show over time.</div>`; }
            else { smYears = pickYears(yrs, 12); drawSM = true; html=renderSmallMultiplesShell(mA, smYears, yrs.length); }
        } else {
            html=renderDistributionSVG(graphRows(state.metric, null, false), mA);
        }
    }
    canvas.innerHTML=html;
    if(drawSM && smYears) drawSmallMultiples(smYears, state.level, mA);
    hideGraphTip();
    const hoverable = scope==="set" ? (tab!=="profile") : (tab==="scatter"||tab==="slope");
    const hint=document.getElementById("graphHint"); if(hint) hint.style.display = hoverable ? "" : "none";
}

let _graphHoverId=null;
function graphHoverMap(idx){
    const src=graphSourceName();
    if(_graphHoverId!=null && map.getSource(src)) map.setFeatureState({source:src,id:_graphHoverId},{hover:false});
    if(idx!=null && map.getSource(src)) map.setFeatureState({source:src,id:idx},{hover:true});
    _graphHoverId=idx;
}
// Generic hover for set-member chart elements (any source: places or schools).
let _graphHoverFS=null;
function graphHoverFeature(source,id){
    if(_graphHoverFS && map.getSource(_graphHoverFS.source)) map.setFeatureState(_graphHoverFS,{hover:false});
    if(source && id!=null && map.getSource(source)){ map.setFeatureState({source,id},{hover:true}); _graphHoverFS={source,id}; }
    else _graphHoverFS=null;
}
function graphGoToFeature(idx){
    const fc=GEO_DATA&&GEO_DATA[state.level]; if(!fc) return;
    const f=fc.features[idx]; if(!f) return;
    setSelectedFeature(graphSourceName(), idx);
    closeGraphModal();
    const bbox=geomBbox(f.geometry);
    if(bbox) map.fitBounds(bbox,{padding:80,duration:800});
    state.lastSelected={ kind:state.level, properties:f.properties, geometry:f.geometry };
    openFeaturePanel(f.properties, state.level);
}

// Click a small-multiple thumbnail → show that year on the main map (leaving
// change mode if it was on, so a single year is painted).
function jumpToYear(year){
    if(state.changeMode){
        state.changeMode=false;
        const ct=document.getElementById("changeToggle"); if(ct) ct.checked=false;
        const cc=document.getElementById("changeControls"); if(cc) cc.style.display="none";
        syncPaletteForMetric();
    }
    state.year=year;
    const slider=document.getElementById("yearSlider"); if(slider) slider.value=String(year);
    const label=document.getElementById("yearLabel"); if(label) label.textContent=String(year);
    updateMetricGating();
    applyChoropleth();
    updateLegend();
    updateMetricSummary();
    closeGraphModal();
}

function openGraphModal(tab){
    if(!GEO_DATA) return;
    const m=document.getElementById("graphModal"); if(!m) return;
    if(typeof tab==="string") state.graphTab=tab;   // optional deep-link (e.g. "ranked")
    // Default scope: when opened from the compare panel a non-empty set scopes to
    // "set" (caller sets state.graphScope); otherwise show the whole state.
    if(state.graphScope==="set" && state.compareSet.length<2) state.graphScope="all";
    if(!state.graphTab) state.graphTab = state.graphScope==="set" ? "groupbar" : "scatter";
    populateGraphMetricB();
    populateGraphSchoolMetrics();
    renderGraph();
    m.classList.add("open"); m.setAttribute("aria-hidden","false");
    const c=document.getElementById("graphModalClose"); if(c) c.focus();
}
function closeGraphModal(){
    const m=document.getElementById("graphModal"); if(!m) return;
    m.classList.remove("open"); m.setAttribute("aria-hidden","true");
    graphHoverMap(null);
    graphHoverFeature(null,null);
    hideGraphTip();
}

// Instant hover tooltip for scatter points: feature name + both values, placed
// next to the cursor and clamped to the viewport (fixed-positioned, so it isn't
// clipped by the modal's scroll container).
function showGraphTip(el, clientX, clientY){
    const tip=document.getElementById("graphTip"); if(!tip) return;
    tip.querySelector(".gt-name").textContent = el.dataset.name || "";
    tip.querySelector(".gt-vals").textContent = el.dataset.vals || "";
    tip.hidden=false;
    const pad=14, tw=tip.offsetWidth, th=tip.offsetHeight;
    let left=clientX+pad, top=clientY+pad;
    if(left+tw > window.innerWidth-6)  left=clientX-tw-pad;
    if(top+th  > window.innerHeight-6) top =clientY-th-pad;
    tip.style.left=Math.max(6,left)+"px";
    tip.style.top =Math.max(6,top)+"px";
}
function hideGraphTip(){ const tip=document.getElementById("graphTip"); if(tip) tip.hidden=true; }

function wireGraphMode(){
    const openBtn=document.getElementById("graphOpenBtn");
    if(openBtn) openBtn.addEventListener("click", ()=>{ state.graphScope="all"; openGraphModal(); });
    // Sidebar shortcut: open Explore charts straight to the Ranked tab for the
    // current metric (the ranking already lives there; this just surfaces it).
    const rankBtn=document.getElementById("rankShortcutBtn");
    if(rankBtn) rankBtn.addEventListener("click", ()=>{ state.graphScope="all"; openGraphModal("ranked"); });
    const closeBtn=document.getElementById("graphModalClose");
    if(closeBtn) closeBtn.addEventListener("click", closeGraphModal);
    const modal=document.getElementById("graphModal");
    if(modal) modal.addEventListener("click", e=>{ if(e.target===modal) closeGraphModal(); });
    document.querySelectorAll(".graph-tab").forEach(b=>b.addEventListener("click", ()=>{
        if(b.style.display==="none") return;   // tab hidden for this scope
        state.graphTab=b.dataset.tab;
        document.querySelectorAll(".graph-tab").forEach(t=>t.classList.toggle("active", t===b));
        renderGraph();
    }));
    // Scope switch: whole state vs the comparison set.
    const scopeWrap=document.getElementById("graphScopeWrap");
    if(scopeWrap) scopeWrap.addEventListener("click", e=>{
        const b=e.target.closest("[data-scope]"); if(!b) return;
        if(b.dataset.scope==="set" && state.compareSet.length<2){
            flashCompareNote(`Pick at least 2 ${compareNoun(true)} first (compare mode).`);
            return;
        }
        state.graphScope=b.dataset.scope;
        renderGraph();
    });
    const bSel=document.getElementById("graphMetricB");
    if(bSel) bSel.addEventListener("change", e=>{ state.graphMetricB=e.target.value; renderGraph(); });
    // School metric pickers (set scope, school kind).
    const sx=document.getElementById("graphSchoolMetric");
    if(sx) sx.addEventListener("change", e=>{ state.graphSchoolMetric=e.target.value; renderGraph(); });
    const sy=document.getElementById("graphSchoolMetricB");
    if(sy) sy.addEventListener("change", e=>{ state.graphSchoolMetricB=e.target.value; renderGraph(); });
    // Slope-chart year pickers (guard against From === To).
    ["graphSlopeFrom","graphSlopeTo"].forEach(id=>{
        const s=document.getElementById(id); if(!s) return;
        s.addEventListener("change", e=>{
            const v=parseInt(e.target.value,10);
            if(id==="graphSlopeFrom") state.graphSlopeFrom=v; else state.graphSlopeTo=v;
            if(state.graphSlopeFrom===state.graphSlopeTo){
                const alt=availableYears(state.metric,state.level).filter(y=>y!==v);
                if(alt.length){ if(id==="graphSlopeFrom") state.graphSlopeTo=alt[alt.length-1]; else state.graphSlopeFrom=alt[0]; }
            }
            renderGraph();
        });
    });
    // Small-multiple thumbnail → jump the main map to that year.
    const gc0=document.getElementById("graphCanvas");
    if(gc0) gc0.addEventListener("click", e=>{ const fig=e.target.closest(".sm-figure[data-year]"); if(fig) jumpToYear(+fig.dataset.year); });
    const canvas=document.getElementById("graphCanvas");
    if(canvas){
        // Hover/click work for both "all"-scope marks (data-idx, level source) and
        // set-member marks (data-mid + data-msrc, any source; data-flykey to zoom).
        canvas.addEventListener("mouseover", e=>{
            const sm=e.target.closest("[data-mid]");
            if(sm){ graphHoverFeature(sm.dataset.msrc, +sm.dataset.mid); if(sm.dataset.name) showGraphTip(sm, e.clientX, e.clientY); return; }
            const el=e.target.closest("[data-idx]"); if(!el) return;
            graphHoverMap(+el.dataset.idx); if(el.dataset.name) showGraphTip(el, e.clientX, e.clientY);
        });
        canvas.addEventListener("mousemove", e=>{ const el=e.target.closest("[data-name]"); if(el && el.dataset.name) showGraphTip(el, e.clientX, e.clientY); });
        canvas.addEventListener("mouseout",  e=>{
            const sm=e.target.closest("[data-mid]"); if(sm){ graphHoverFeature(null,null); hideGraphTip(); return; }
            const el=e.target.closest("[data-idx]"); if(el){ graphHoverMap(null); hideGraphTip(); }
        });
        canvas.addEventListener("click", e=>{
            const fly=e.target.closest("[data-flykey]");
            if(fly){ flyToMember(fly.dataset.flykey); return; }   // keep the modal open
            const el=e.target.closest("[data-idx]"); if(el) graphGoToFeature(+el.dataset.idx);
        });
    }
    document.addEventListener("keydown", e=>{
        if(e.key==="Escape"){ const gm=document.getElementById("graphModal"); if(gm && gm.classList.contains("open")) closeGraphModal(); }
    });
}

function updateMetricSummary() {
    const m = getMetric(state.metric);
    const values = GEO_DATA ? getValuesForLevel(state.level, state.metric) : [];
    const el = document.getElementById("metricSummary");
    if (!values.length) {
        el.innerHTML = `<em>No data for ${m.label} at this level.</em>`;
        return;
    }
    const min = Math.min(...values), max = Math.max(...values);
    const mean = values.reduce((a,b)=>a+b,0) / values.length;
    const inChange = changeActive(state.metric, state.level);
    const vf = inChange ? (x => fmtChangeDelta(x, m)) : (x => fmt(x, m.format));
    // Honest denominator: min/max/mean exclude nulls — say how many were excluded.
    const total = (GEO_DATA && GEO_DATA[state.level]) ? GEO_DATA[state.level].features.length : values.length;
    const missing = Math.max(0, total - values.length);
    // In change mode, which way places moved is the headline. Neutral wording —
    // "increased" ≠ "improved" for every metric.
    let extra = "";
    if (inChange) {
        const up = values.filter(v => v > 0).length;
        const down = values.filter(v => v < 0).length;
        const noun = state.level === "muni" ? "towns" : "districts";
        extra = `
        <div class="summary-row"><span>Increased ↑</span><strong>${up} ${noun}</strong></div>
        <div class="summary-row"><span>Decreased ↓</span><strong>${down} ${noun}</strong></div>`;
    }
    el.innerHTML = `
        <div class="summary-row"><span>${inChange ? "Lowest" : "Min"}</span><strong>${vf(min)}</strong></div>
        <div class="summary-row"><span>${inChange ? "Average" : "Mean"}</span><strong>${vf(mean)}</strong></div>
        <div class="summary-row"><span>${inChange ? "Highest" : "Max"}</span><strong>${vf(max)}</strong></div>${extra}
        <div class="summary-row"><span>N (with data)</span><strong>${values.length.toLocaleString()} of ${total.toLocaleString()}</strong></div>
        ${missing ? `<div class="summary-row summary-row-nodata"><span>No data</span><strong>${missing.toLocaleString()}</strong></div>` : ""}
    `;
}

// ── Legend customization: drag to move, resize to scale ─────────────────────
// The legend defaults to a CSS-anchored bottom-right card. The first time the
// user drags its header, pulls the corner grip, or clicks −/+, we "detach" to
// JS-managed absolute left/top (relative to .maps-main) plus a --legend-scale
// multiplier, then keep both clamped on-screen and mirrored to localStorage so
// the choice survives reloads and updateLegend() rebuilds. Desktop-only: below
// the 768px breakpoint the legend docks full-width, the controls hide, and the
// responsive CSS stays in charge.
const LEGEND_LS_KEY      = "ma-atlas-legend";
const LEGEND_MIN_SCALE   = 0.7;
const LEGEND_MAX_SCALE   = 1.8;
const LEGEND_EDGE        = 8;     // min gap (px) between the card and the map edge
const LEGEND_DESKTOP_MIN = 769;  // matches the app's 768px mobile breakpoint

function setupLegendCustomization() {
    const legend = document.getElementById("legend");
    const header = document.getElementById("legendHeader");
    const grip   = document.getElementById("legendResize");
    const main   = document.querySelector(".maps-main");
    if (!legend || !header || !main) return;

    const st = { custom: false, left: 0, top: 0, scale: 1 };
    const isDesktop  = () => window.innerWidth >= LEGEND_DESKTOP_MIN;
    const clampScale = s => Math.min(LEGEND_MAX_SCALE, Math.max(LEGEND_MIN_SCALE, s));

    function save() {
        try {
            localStorage.setItem(LEGEND_LS_KEY, JSON.stringify({
                left: Math.round(st.left), top: Math.round(st.top), scale: st.scale,
            }));
        } catch (e) {}
    }

    // Seed left/top from the card's current spot, then hand positioning to JS.
    function detach() {
        if (st.custom) return;
        const lr = legend.getBoundingClientRect();
        const mr = main.getBoundingClientRect();
        st.left = lr.left - mr.left;
        st.top  = lr.top  - mr.top;
        st.custom = true;
    }

    // Write scale + position, then clamp using the rendered (scaled) box so the
    // card can never be pushed off the map.
    function place() {
        if (!st.custom) return;
        legend.style.right  = "auto";
        legend.style.bottom = "auto";
        legend.style.setProperty("--legend-scale", String(st.scale));
        legend.style.left = st.left + "px";
        legend.style.top  = st.top  + "px";
        const mr = main.getBoundingClientRect();
        const lr = legend.getBoundingClientRect();   // scaled box (transform applied)
        const maxLeft = Math.max(LEGEND_EDGE, mr.width  - lr.width  - LEGEND_EDGE);
        const maxTop  = Math.max(LEGEND_EDGE, mr.height - lr.height - LEGEND_EDGE);
        st.left = Math.min(Math.max(LEGEND_EDGE, st.left), maxLeft);
        st.top  = Math.min(Math.max(LEGEND_EDGE, st.top),  maxTop);
        legend.style.left = st.left + "px";
        legend.style.top  = st.top  + "px";
    }

    // Restore default CSS anchoring (bottom-right) and forget the saved layout.
    function reset() {
        st.custom = false; st.left = 0; st.top = 0; st.scale = 1;
        legend.style.removeProperty("--legend-scale");
        legend.style.left = legend.style.top = legend.style.right = legend.style.bottom = "";
        try { localStorage.removeItem(LEGEND_LS_KEY); } catch (e) {}
    }

    function bump(delta) {
        if (!isDesktop()) return;
        detach();
        st.scale = clampScale(+(st.scale + delta).toFixed(2));
        place();
        save();
    }

    // ── Pointer drag: move (grab the header) ─────────────────────────────────
    let drag = null;
    header.addEventListener("pointerdown", e => {
        if (!isDesktop() || (e.button !== undefined && e.button !== 0)) return;
        if (e.target.closest(".legend-tool")) return;   // clicks on −/+/⟲ aren't drags
        detach();
        drag = { x: e.clientX, y: e.clientY, l: st.left, t: st.top };
        try { header.setPointerCapture(e.pointerId); } catch (_) {}
        document.body.classList.add("legend-busy");
        document.body.style.cursor = "move";
        e.preventDefault();
    });
    header.addEventListener("pointermove", e => {
        if (!drag) return;
        st.left = drag.l + (e.clientX - drag.x);
        st.top  = drag.t + (e.clientY - drag.y);
        place();
    });
    function endDrag(e) {
        if (!drag) return;
        drag = null;
        try { header.releasePointerCapture(e.pointerId); } catch (_) {}
        document.body.classList.remove("legend-busy");
        document.body.style.cursor = "";
        save();
    }
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);

    // Keyboard nudge while the header is focused (arrows = 10px, Shift = 1px).
    header.addEventListener("keydown", e => {
        if (!isDesktop()) return;
        const step = e.shiftKey ? 1 : 10;
        let dx = 0, dy = 0;
        if      (e.key === "ArrowLeft")  dx = -step;
        else if (e.key === "ArrowRight") dx =  step;
        else if (e.key === "ArrowUp")    dy = -step;
        else if (e.key === "ArrowDown")  dy =  step;
        else return;
        e.preventDefault();
        detach();
        st.left += dx; st.top += dy;
        place();
        save();
    });

    // ── Pointer drag: resize (corner grip) ───────────────────────────────────
    let rez = null;
    if (grip) {
        grip.addEventListener("pointerdown", e => {
            if (!isDesktop() || (e.button !== undefined && e.button !== 0)) return;
            detach();
            const lr = legend.getBoundingClientRect();
            rez = { x: e.clientX, y: e.clientY, s: st.scale, w: lr.width };
            try { grip.setPointerCapture(e.pointerId); } catch (_) {}
            document.body.classList.add("legend-busy");
            document.body.style.cursor = "nwse-resize";
            e.preventDefault();
            e.stopPropagation();
        });
        grip.addEventListener("pointermove", e => {
            if (!rez) return;
            // Average of horizontal + vertical drag drives a uniform scale.
            const d = ((e.clientX - rez.x) + (e.clientY - rez.y)) / 2;
            st.scale = clampScale(rez.s * ((rez.w + d) / rez.w));
            place();
        });
        const endRez = e => {
            if (!rez) return;
            rez = null;
            try { grip.releasePointerCapture(e.pointerId); } catch (_) {}
            document.body.classList.remove("legend-busy");
            document.body.style.cursor = "";
            save();
        };
        grip.addEventListener("pointerup", endRez);
        grip.addEventListener("pointercancel", endRez);
    }

    // ── Buttons: −/+ scale, ⟲ reset ──────────────────────────────────────────
    const smaller  = document.getElementById("legendSmaller");
    const larger   = document.getElementById("legendLarger");
    const resetBtn = document.getElementById("legendReset");
    if (smaller)  smaller.addEventListener("click",  () => bump(-0.1));
    if (larger)   larger.addEventListener("click",   () => bump(+0.1));
    if (resetBtn) resetBtn.addEventListener("click", reset);

    // Re-clamp on viewport change; hand back to the docked CSS when narrow.
    let rzTimer;
    window.addEventListener("resize", () => {
        clearTimeout(rzTimer);
        rzTimer = setTimeout(() => {
            if (!st.custom) return;
            if (isDesktop()) {
                place();
            } else {
                legend.style.removeProperty("--legend-scale");
                legend.style.left = legend.style.top = legend.style.right = legend.style.bottom = "";
            }
        }, 150);
    });

    // Let updateLegend() re-clamp after a content (height) change.
    _legendClamp = () => { if (st.custom && isDesktop()) place(); };

    // Restore a saved layout (desktop only); clamp absorbs viewport differences.
    try {
        const saved = JSON.parse(localStorage.getItem(LEGEND_LS_KEY) || "null");
        if (saved && isDesktop()) {
            detach();
            if (typeof saved.left  === "number") st.left  = saved.left;
            if (typeof saved.top   === "number") st.top   = saved.top;
            if (typeof saved.scale === "number") st.scale = clampScale(saved.scale);
            place();
        }
    } catch (e) {}
}

function wireUI() {
    populatePaletteSelect();
    populateMetricSelect();
    populateBivarUI();
    populateBivarPresetSelect();

    const bivarPresetSel = document.getElementById("bivarPresetSelect");
    if (bivarPresetSel) {
        bivarPresetSel.addEventListener("change", e => {
            const p = getBivarPreset(e.target.value);
            if (p) applyBivarPreset(p); else setBivarPresetBlurb(null);
        });
    }

    wireGraphMode();

    document.getElementById("levelSelect").addEventListener("change", async e => {
        state.level = e.target.value;
        clearSelectedFeature();   // feature ids differ between levels
        // A place comparison is tied to its level (district vs town are different
        // universes, with different feature ids) — leave compare mode on a switch.
        // A school comparison isn't level-bound, so it survives.
        if (state.compareMode && state.compareKind === "place") exitCompareMode();
        resetThreshold();
        // Municipality year-keyed columns live in a lazy side file — load + merge
        // them before painting so the year slider and ap/MCAS metrics work.
        if (state.level === "muni") await ensureMuniTimeseries();
        populateMetricSelect();
        populateBivarMetricSelect();
        updateMetricGating();
        applyChoropleth();
        updateLegend();
    });
    document.getElementById("metricSelect").addEventListener("change", e => {
        state.metric = e.target.value;
        syncPaletteForMetric();   // change mode keeps a diverging palette; else metric default
        resetThreshold();   // a numeric range doesn't carry across metrics
        populateBivarMetricSelect();
        updateMetricGating();
        applyChoropleth();
        updateLegend();
        updateMetricSummary();
        clearBivarPresetSelection();   // hand-picking metric A breaks the featured pairing
        // The active metric is the X axis of the place set charts — refresh if open.
        if (document.getElementById("graphModal")?.classList.contains("open") && state.graphScope === "set" && state.compareKind === "place") renderGraph();
    });

    // Highlight-by-value filter
    const thToggle = document.getElementById("thresholdToggle");
    const thControls = document.getElementById("thresholdControls");
    if (thToggle) {
        thToggle.addEventListener("change", e => {
            state.threshold.active = e.target.checked;
            if (thControls) thControls.style.display = e.target.checked ? "" : "none";
            applyThreshold();
        });
    }
    ["thresholdLo", "thresholdHi"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", applyThreshold);
    });
    document.getElementById("metricSearch").addEventListener("input", e => {
        // Live-filter the command palette. The map only switches metric when the
        // user clicks a result (selectMetricFromPalette), so a half-typed query
        // never repaints.
        renderMetricPalette(e.target.value);
    });
    // Command-palette open/close wiring.
    const mpButton = document.getElementById("metricPickerButton");
    if (mpButton) mpButton.addEventListener("click", toggleMetricPicker);
    const mpClose = document.getElementById("metricPickerClose");
    if (mpClose) mpClose.addEventListener("click", () => { closeMetricPicker(); mpButton && mpButton.focus(); });
    const mpSearch = document.getElementById("metricSearch");
    if (mpSearch) {
        mpSearch.addEventListener("keydown", e => {
            if (e.key === "Escape") { closeMetricPicker(); mpButton && mpButton.focus(); }
            if (e.key === "Enter") {
                // Enter selects the first visible result — a search hit, or on the
                // home dashboard the first quick-pick chip.
                const first = document.querySelector("#metricPickerList .mp-item, #metricPickerList .mp-pick");
                if (first) { e.preventDefault(); selectMetricFromPalette(first.dataset.id); }
            }
        });
    }
    // Click-away closes the popover. The button stays in #metricPicker while the
    // popover is portaled to <body>, so a click counts as "inside" if it lands in
    // either one.
    document.addEventListener("click", e => {
        const wrap = document.getElementById("metricPicker");
        const pop = document.getElementById("metricPickerPop");
        // Ignore a click whose target was removed from the DOM mid-event. Drilling
        // into a topic (card head / "+N more") and the "‹ All topics" back button
        // re-render the list via innerHTML, detaching the clicked node before this
        // bubbled handler runs. Such a target is no longer "inside" the popover, so
        // the contains() test below would misread it as an outside click and close
        // the popover instead of letting it expand. A genuine outside click leaves
        // its target in the document, so this only skips the re-render case.
        if (!e.target || !document.contains(e.target)) return;
        if (pop && !pop.hidden &&
            !(wrap && wrap.contains(e.target)) && !pop.contains(e.target)) {
            closeMetricPicker();
        }
    });
    // Keep the fixed, body-portaled popover glued to its button as the viewport
    // changes or the control panel scrolls (capture catches the panel's own
    // scroll), and re-sync desktop⇄mobile geometry across the breakpoint.
    const repositionPicker = () => {
        const pop = document.getElementById("metricPickerPop");
        if (pop && !pop.hidden) positionMetricPickerPop();
    };
    window.addEventListener("resize", repositionPicker);
    window.addEventListener("scroll", repositionPicker, true);
    updateMetricPickerCurrent();
    // Year slider — live wired to year-keyed geojson columns.
    const yearSlider = document.getElementById("yearSlider");
    const yearLabel  = document.getElementById("yearLabel");
    yearSlider.addEventListener("input", e => {
        state.year = parseInt(e.target.value, 10);
        yearLabel.textContent = e.target.value;
        // Stop animation if user manually drags
        if (state.playing) stopYearAnimation();
        applyChoropleth();
        updateLegend();
        updateMetricSummary();
        // Keep an open place comparison (table + set charts) on the active year.
        if (state.compareMode && state.compareKind === "place") {
            renderComparison();
            if (document.getElementById("graphModal")?.classList.contains("open") && state.graphScope === "set") renderGraph();
        }
    });

    // Year animation (play / pause)
    const playBtn = document.getElementById("yearPlay");
    if (playBtn) {
        playBtn.addEventListener("click", () => {
            if (state.playing) stopYearAnimation();
            else startYearAnimation();
        });
    }
    // Student-group filter — repaints choropleth using the metric__group
    // column when available. Falls back to base column if the active metric
    // doesn't have group-sliced data (a hint shows under the dropdown).
    document.getElementById("groupSelect").addEventListener("change", e => {
        state.studentGroup = e.target.value;
        applyChoropleth();
        updateLegend();
        updateMetricSummary();
        updateGroupNote();
    });
    document.getElementById("paletteSelect").addEventListener("change", e => {
        state.palette = e.target.value;
        applyChoropleth();
        updateLegend();
    });
    const reverseToggle = document.getElementById("reversePaletteToggle");
    if (reverseToggle) {
        reverseToggle.checked = state.reversePalette;
        reverseToggle.addEventListener("change", e => {
            state.reversePalette = e.target.checked;
            applyChoropleth();
            updateLegend();
        });
    }
    const manualInput = document.getElementById("manualBreaksInput");
    // Classification can be set from the Appearance dropdown OR the legend's quick
    // "Color grouping" dropdown — both funnel through setClassify (which keeps the
    // other control + the manual-breaks input in sync, then repaints).
    const classifySel = document.getElementById("classifySelect");
    if (classifySel) classifySel.addEventListener("change", e => setClassify(e.target.value));
    const legendClassifySel = document.getElementById("legendClassify");
    if (legendClassifySel) {
        legendClassifySel.value = state.classify;
        legendClassifySel.addEventListener("change", e => setClassify(e.target.value));
    }
    syncClassifyControls();
    if (manualInput) {
        manualInput.value = state.manualBreaks;
        const applyManual = () => {
            state.manualBreaks = manualInput.value;
            if (state.classify === "manual") { applyChoropleth(); updateLegend(); }
        };
        manualInput.addEventListener("input", applyManual);
        manualInput.addEventListener("change", applyManual);
    }

    // Bivariate mode — combines two metrics into one map via a 3×3 palette.
    const bivarToggle = document.getElementById("bivariateToggle");
    const bivarControls = document.getElementById("bivarControls");
    if (bivarToggle) {
        bivarToggle.addEventListener("change", e => {
            state.bivariate = e.target.checked;
            // Mutually exclusive with Compare (A vs B) and Change-over-time modes.
            if (e.target.checked && state.compareMode) exitCompareMode();
            if (e.target.checked && state.changeMode) {
                state.changeMode = false;
                const ct = document.getElementById("changeToggle"); if (ct) ct.checked = false;
                const cc = document.getElementById("changeControls"); if (cc) cc.style.display = "none";
                syncPaletteForMetric();
            }
            if (bivarControls) bivarControls.style.display = e.target.checked ? "" : "none";
            populateBivarMetricSelect();
            applyChoropleth();
            updateLegend();
            updateMetricGating();
            clearBivarPresetSelection();   // manual toggle no longer matches a preset
        });
    }
    const bivarMetricSel = document.getElementById("bivarMetricSelect");
    if (bivarMetricSel) {
        bivarMetricSel.addEventListener("change", e => {
            state.bivarMetricB = e.target.value;
            applyChoropleth();
            updateLegend();
            clearBivarPresetSelection();   // hand-picking metric B breaks the featured pairing
        });
    }
    const bivarPaletteSel = document.getElementById("bivarPaletteSelect");
    if (bivarPaletteSel) {
        bivarPaletteSel.addEventListener("change", e => {
            state.bivarPalette = e.target.value;
            applyChoropleth();
            updateLegend();
        });
    }

    // Change-over-time — paints how a year-keyed metric shifted between two years.
    const repaintChange = () => { applyChoropleth(); updateLegend(); updateMetricSummary(); };
    const changeToggleEl = document.getElementById("changeToggle");
    if (changeToggleEl) {
        changeToggleEl.addEventListener("change", e => setChangeMode(e.target.checked));
    }
    const changeFromSel = document.getElementById("changeFromSelect");
    if (changeFromSel) {
        changeFromSel.addEventListener("change", e => {
            state.changeFrom = parseInt(e.target.value, 10);
            if (state.changeFrom === state.changeTo) {   // never compare a year to itself
                const alt = availableYears(state.metric, state.level).filter(y => y !== state.changeFrom);
                if (alt.length) { state.changeTo = alt[alt.length - 1]; const ts = document.getElementById("changeToSelect"); if (ts) ts.value = String(state.changeTo); }
            }
            repaintChange();
        });
    }
    const changeToSel = document.getElementById("changeToSelect");
    if (changeToSel) {
        changeToSel.addEventListener("change", e => {
            state.changeTo = parseInt(e.target.value, 10);
            if (state.changeTo === state.changeFrom) {
                const alt = availableYears(state.metric, state.level).filter(y => y !== state.changeTo);
                if (alt.length) { state.changeFrom = alt[0]; const fs = document.getElementById("changeFromSelect"); if (fs) fs.value = String(state.changeFrom); }
            }
            repaintChange();
        });
    }
    const changeRelTog = document.getElementById("changeRelToggle");
    if (changeRelTog) {
        changeRelTog.addEventListener("change", e => { state.changeRel = e.target.checked; repaintChange(); });
    }
    // One-click exit from any special view mode (bivariate / change / compare).
    const modeBarExit = document.getElementById("modeBarExit");
    if (modeBarExit) modeBarExit.addEventListener("click", exitActiveMode);

    // Reference layer toggles — these layers exist from load.
    const ref = {
        "ref-muni-outline":      ["muni-outline"],
        "ref-academic-outline":  ["academic-outline"],
        // ref-all-ma-schools is handled below: it's the master switch for the
        // public + private school point layers AND the public school-name labels
        // (see applySchoolSectorFilter).
        "ref-all-ma-colleges":   ["ma-colleges-circles"],
    };
    Object.entries(ref).forEach(([id, layers]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", e => {
            layers.forEach(l => {
                if (map.getLayer(l))
                    map.setLayoutProperty(l, "visibility", e.target.checked ? "visible" : "none");
            });
        });
    });

    // Non-operating ("no district") towns — district-level overlay, on by
    // default. Wired separately from the generic ref toggles because its
    // visibility is also gated on the map being at district level (see
    // updateNonOpLayer).
    const nonOpToggle = document.getElementById("ref-nonop-towns");
    if (nonOpToggle) {
        nonOpToggle.checked = state.showNonOpTowns;
        nonOpToggle.addEventListener("change", e => {
            state.showNonOpTowns = e.target.checked;
            updateNonOpLayer();
        });
    }

    // "Highlight a group" picker (district-level overlay; see applyHighlightGroup).
    const hlSelect = document.getElementById("highlightGroupSelect");
    if (hlSelect) {
        hlSelect.value = state.highlightGroup;
        hlSelect.addEventListener("change", e => {
            state.highlightGroup = e.target.value;
            applyHighlightGroup();
        });
    }
    applyHighlightGroup();   // set initial state now that the layers exist

    // Charter / voc-tech overlays are lazy-loaded (their ~1MB source isn't
    // fetched until first enabled). Build the layers on demand, then show them.
    const lazyRef = {
        "ref-voctech-overlay": ["voctech-fill", "voctech-outline"],
        "ref-charter-overlay": ["charter-fill", "charter-outline"],
        "ref-collaboratives":  ["collab-outline", "collab-label"],
        "ref-unions":          ["union-outline", "union-label"],
    };
    Object.entries(lazyRef).forEach(([id, layers]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", async e => {
            const vis = e.target.checked ? "visible" : "none";
            if (e.target.checked) await ensureCcuvLayers();
            layers.forEach(l => {
                if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", vis);
            });
            // collab/union labels are created fresh by ensureCcuvLayers(); if a
            // dark/satellite basemap is active, re-apply it so they pick up the
            // right text/halo colors immediately (no-op for label-less overlays).
            if (e.target.checked) applyBasemap(state.basemap);
        });
    });

    // All-MA-schools sub-controls: level filter chips + color mode. The block is
    // revealed only while the schools layer is on (off by default).
    const schoolsToggle = document.getElementById("ref-all-ma-schools");
    const schoolsControls = document.getElementById("schools-controls");
    if (schoolsToggle && schoolsControls) {
        schoolsToggle.addEventListener("change", e => {
            schoolsControls.hidden = !e.target.checked;
            applySchoolSectorFilter();   // master switch for both public + private layers
            if (e.target.checked) renderSchoolsSizeLegend();
        });
        // Keep the size-key dots matched to the on-map dots as zoom changes.
        map.on("zoom", () => { if (!schoolsControls.hidden) renderSchoolsSizeLegend(); });
        if (!schoolsControls.hidden) renderSchoolsSizeLegend();
    }
    document.querySelectorAll("#school-chips input[type=checkbox][data-level]")
        .forEach(b => b.addEventListener("change", applySchoolLevelFilter));
    // Public/private sector chips — toggle each school-point layer's visibility.
    document.querySelectorAll("#school-sector input[type=checkbox]")
        .forEach(b => b.addEventListener("change", applySchoolSectorFilter));
    document.querySelectorAll("input[name=school-color-mode]")
        .forEach(r => r.addEventListener("change", e => { if (e.target.checked) setSchoolColorMode(e.target.value); }));
    // DESE status filter (Schools of Recognition / requiring assistance).
    const schoolStatusSel = document.getElementById("school-status-select");
    if (schoolStatusSel) {
        schoolStatusSel.value = state.schoolStatus;
        schoolStatusSel.addEventListener("change", e => {
            state.schoolStatus = e.target.value;
            applySchoolLevelFilter();
        });
    }

    // All-MA-colleges sub-controls: sector + level filter chips and a size key.
    // The block is revealed only while the colleges layer is on (off by default).
    const collegesToggle = document.getElementById("ref-all-ma-colleges");
    const collegesControls = document.getElementById("colleges-controls");
    if (collegesToggle && collegesControls) {
        collegesToggle.addEventListener("change", e => {
            collegesControls.hidden = !e.target.checked;
            if (e.target.checked) renderCollegesSizeLegend();
        });
        // Keep the size-key dots matched to the on-map dots as zoom changes.
        map.on("zoom", () => { if (!collegesControls.hidden) renderCollegesSizeLegend(); });
        if (!collegesControls.hidden) renderCollegesSizeLegend();
    }
    document.querySelectorAll("#colleges-controls input[type=checkbox][data-sector], #colleges-controls input[type=checkbox][data-level]")
        .forEach(b => b.addEventListener("change", applyCollegeFilter));
    document.querySelectorAll("#college-presets button[data-preset]")
        .forEach(b => b.addEventListener("click", () => setCollegePreset(b.getAttribute("data-preset"))));

    // Child care centers layer. Its ~0.8MB source is lazy-loaded on first enable
    // (ensureChildcareLayer); the sub-controls block + size key are revealed only
    // while the layer is on (off by default).
    const childcareToggle = document.getElementById("ref-all-ma-childcare");
    const childcareControls = document.getElementById("childcare-controls");
    if (childcareToggle) {
        childcareToggle.addEventListener("change", async e => {
            const on = e.target.checked;
            state.showAllMaChildcare = on;
            if (childcareControls) childcareControls.hidden = !on;
            if (on) await ensureChildcareLayer();
            if (map.getLayer("ma-childcare-circles"))
                map.setLayoutProperty("ma-childcare-circles", "visibility", on ? "visible" : "none");
            if (on) renderChildcareSizeLegend();
        });
        // Keep the size-key dots matched to the on-map dots as zoom changes.
        map.on("zoom", () => { if (childcareControls && !childcareControls.hidden) renderChildcareSizeLegend(); });
    }
    document.querySelectorAll("input[name=childcare-color-mode]")
        .forEach(r => r.addEventListener("change", e => { if (e.target.checked) setChildcareColorMode(e.target.value); }));

    // 3D extrusion
    document.getElementById("toggle-3d").addEventListener("change", e => {
        state.extrude3d = e.target.checked;
        toggle3D();
    });

    document.getElementById("toggle-town-labels").addEventListener("change", e => {
        state.townLabels = e.target.checked;
        if (map.getLayer("town-labels"))
            map.setLayoutProperty("town-labels", "visibility", e.target.checked ? "visible" : "none");
    });

    const distLabelsToggle = document.getElementById("toggle-district-labels");
    if (distLabelsToggle) {
        distLabelsToggle.checked = state.districtLabels;
        distLabelsToggle.addEventListener("change", e => {
            state.districtLabels = e.target.checked;
            if (map.getLayer("district-labels"))
                map.setLayoutProperty("district-labels", "visibility", e.target.checked ? "visible" : "none");
            syncBasemapLabelCap();   // district off → let basemap labels run up to z11 (town's floor)
        });
    }

    const valueLabelsToggle = document.getElementById("toggle-value-labels");
    if (valueLabelsToggle) {
        valueLabelsToggle.checked = state.valueLabels;
        valueLabelsToggle.addEventListener("change", e => {
            state.valueLabels = e.target.checked;
            applyChoropleth();   // sets the value-label layer's text-field + visibility
        });
    }

    const propCirclesToggle = document.getElementById("toggle-prop-circles");
    if (propCirclesToggle) {
        propCirclesToggle.checked = state.propCircles;
        propCirclesToggle.addEventListener("change", e => {
            state.propCircles = e.target.checked;
            refreshPropCircles();
            renderPropCircleLegend();
        });
    }

    // Basemap switch — streets vs. white/blank base
    const basemapSel = document.getElementById("basemapSelect");
    if (basemapSel) {
        basemapSel.value = state.basemap;
        basemapSel.addEventListener("change", e => applyBasemap(e.target.value));
    }

    // Color-vision-deficiency preview — apply an SVG color-matrix filter to the
    // whole map area (map + legend) so authors can check a palette still reads.
    const cvdSel = document.getElementById("cvdSelect");
    if (cvdSel) {
        cvdSel.addEventListener("change", e => {
            const v = e.target.value;
            const wrap = document.getElementById("mapsWrap") || (map && map.getContainer());
            if (wrap) wrap.style.filter = v ? `url(#cvd-${v})` : "";
        });
    }

    // Fill-opacity slider — lets the user go from solid (default) to semi-
    // transparent so the basemap can show through.
    const opacityRange = document.getElementById("fillOpacityRange");
    const opacityNote = document.getElementById("fillOpacityNote");
    function describeOpacity(pct) {
        if (pct >= 100) return "Solid (100%) — basemap hidden under the colors.";
        return `${pct}% — basemap shows through the colors.`;
    }
    if (opacityRange) {
        opacityRange.value = Math.round((state.fillOpacity ?? 1) * 100);
        if (opacityNote) opacityNote.textContent = describeOpacity(+opacityRange.value);
        opacityRange.addEventListener("input", e => {
            const pct = +e.target.value;
            state.fillOpacity = pct / 100;
            if (opacityNote) opacityNote.textContent = describeOpacity(pct);
            ["muni-fill", "district-fill"].forEach(layerId => {
                if (map.getLayer(layerId)) {
                    map.setPaintProperty(layerId, "fill-opacity",
                        fillOpacityExpr(activeColumn(state.metric, state.year, state.level)));
                }
            });
        });
    }

    // Quick views
    document.querySelectorAll(".view-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setActiveView(btn.dataset.view);
            const v = VIEWS[btn.dataset.view];
            if (v) map.flyTo({ ...v, duration: 1200, essential: true });
        });
    });
    // Clear the highlighted quick-view once the user moves the map themselves,
    // so the active button never lies about what's on screen. Programmatic
    // flyTo (from a quick-view click) has no originalEvent, so it's preserved.
    const clearActiveViews = () => document.querySelectorAll(".view-btn.active")
        .forEach(b => b.classList.remove("active"));
    map.on("dragstart", clearActiveViews);
    map.on("zoomstart", e => { if (e.originalEvent) clearActiveViews(); });

    // Panel open/close — supports both desktop (.collapsed slide-out, reopened
    // via the floating tab) and mobile (.open slide-in drawer with backdrop).
    const panel    = document.getElementById("controlPanel");
    const fab      = document.getElementById("panelFab");
    const toggle   = document.getElementById("panelToggle");
    const reopen   = document.getElementById("panelReopen");
    const backdrop = document.getElementById("panelBackdrop");
    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

    // Show the desktop reopen tab only while the panel is collapsed, and keep the
    // on-map status chip in sync (it shows whenever the panel is hidden).
    function syncReopen() {
        if (reopen) {
            const collapsed = panel.classList.contains("collapsed") && !isMobile();
            reopen.classList.toggle("visible", collapsed);
        }
        if (typeof updateStatusChip === "function") updateStatusChip();
    }

    function openPanel() {
        panel.classList.add("open");
        panel.classList.remove("collapsed");
        if (backdrop) backdrop.classList.add("open");
        syncReopen();
    }
    function closePanel() {
        panel.classList.remove("open");
        if (isMobile()) panel.classList.add("collapsed");
        if (backdrop) backdrop.classList.remove("open");
        syncReopen();
    }
    function togglePanel() {
        if (isMobile()) {
            (panel.classList.contains("open") ? closePanel : openPanel)();
        } else {
            panel.classList.toggle("collapsed");
            syncReopen();
        }
    }

    if (toggle)   toggle.addEventListener("click", togglePanel);
    if (fab)      fab.addEventListener("click", togglePanel);
    if (reopen)   reopen.addEventListener("click", openPanel);
    if (backdrop) backdrop.addEventListener("click", closePanel);
    window.addEventListener("resize", syncReopen);

    // Theme (dark / light) toggle — sync its initial state, then wire the click.
    syncThemeButton();
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    // Reset filters & view to the landing defaults.
    const resetBtn = document.getElementById("resetAllBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetAll);

    // Map ⇄ list companion view: toggle button, close button, row clicks.
    const listBtn = document.getElementById("listToggleBtn");
    if (listBtn) listBtn.addEventListener("click", toggleListView);
    const listClose = document.getElementById("listPanelClose");
    if (listClose) listClose.addEventListener("click", closeListView);
    const listPanelEl = document.getElementById("listPanel");
    if (listPanelEl) listPanelEl.addEventListener("click", e => {
        const row = e.target.closest("[data-lname]");
        if (row) selectPlaceByName(row.dataset.lname);
    });

    // On mobile, after a quick-view button or a layer toggle, auto-close
    // the drawer so the user actually sees the map move
    document.querySelectorAll(".view-btn").forEach(b => {
        b.addEventListener("click", () => { if (isMobile()) closePanel(); });
    });

    // Accordion sections — click a header to expand/collapse its body. Link
    // each header to its body for assistive tech, and scroll a freshly-opened
    // section into view within the panel.
    document.querySelectorAll(".accordion-header").forEach((header, i) => {
        const bodyEl = header.nextElementSibling;
        if (bodyEl && !bodyEl.id) bodyEl.id = `accordion-body-${i}`;
        if (bodyEl) header.setAttribute("aria-controls", bodyEl.id);
        header.addEventListener("click", () => {
            const expanded = header.getAttribute("aria-expanded") === "true";
            header.setAttribute("aria-expanded", String(!expanded));
            if (!expanded) {
                requestAnimationFrame(() =>
                    header.scrollIntoView({ block: "nearest", behavior: "smooth" }));
            }
        });
    });

    // Legend drag-to-move + resize controls (desktop).
    setupLegendCustomization();
}

function setActiveView(view) {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    const el = document.querySelector(`.view-btn[data-view="${view}"]`);
    if (el) el.classList.add("active");
}

const VIEWS = {
    ma:                 { center: [-71.70, 42.25], zoom: 7.6,  pitch: 0, bearing: 0 },
    "boston-metro":     { center: [-71.07, 42.34], zoom: 9.2,  pitch: 0, bearing: 0 },
    "metrowest":        { center: [-71.42, 42.30], zoom: 9.8,  pitch: 0, bearing: 0 },
    "495-corridor":     { center: [-71.45, 42.30], zoom: 8.6,  pitch: 0, bearing: 0 },
    "north-shore":      { center: [-70.85, 42.55], zoom: 9.5,  pitch: 0, bearing: 0 },
    "merrimack-valley": { center: [-71.20, 42.70], zoom: 9.6,  pitch: 0, bearing: 0 },
    "south-shore":      { center: [-70.80, 42.05], zoom: 9.3,  pitch: 0, bearing: 0 },
    "south-coast":      { center: [-70.95, 41.65], zoom: 9.5,  pitch: 0, bearing: 0 },
    "central-ma":       { center: [-71.85, 42.30], zoom: 8.8,  pitch: 0, bearing: 0 },
    "pioneer-valley":   { center: [-72.58, 42.30], zoom: 9.3,  pitch: 0, bearing: 0 },
    "western-ma":       { center: [-72.85, 42.35], zoom: 8.5,  pitch: 0, bearing: 0 },
    "berkshires":       { center: [-73.20, 42.45], zoom: 9.0,  pitch: 0, bearing: 0 },
    "cape":             { center: [-70.20, 41.70], zoom: 8.8,  pitch: 0, bearing: 0 },
};

// Bounding box of the entire state in [west, south, east, north] order — used
// for the "fit whole state" export scope. Sourced from MassGIS BOUNDARY_POLY.
const MA_BOUNDS = [-73.508, 41.237, -69.928, 42.886];

// 3D extrusion — replaces the flat choropleth fill with extruded polygons
function toggle3D() {
    const { level, metric } = state;
    const m = getMetric(metric);
    const flatLayer = { muni: "muni-fill", district: "district-fill" }[level];
    const extrudeLayerId = `${level}-3d`;
    const sourceId = { muni: "municipalities", district: "districts" }[level];

    // Remove any prior 3D layers
    ["muni-3d","district-3d"].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });

    if (!state.extrude3d) {
        map.setLayoutProperty(flatLayer, "visibility", "visible");
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
        return;
    }

    // Build height expression — values × scalar; for $ scale by 0.05 (so $30k = 1500m)
    const heightScalar = m.format === "usd" ? 0.05 : 8000;
    const col = activeColumn(metric, state.year, level);
    const paint = paintExpression(col, state.palette, state.classify, level);
    const layerCfg = {
        id: extrudeLayerId, type: "fill-extrusion", source: sourceId,
        paint: {
            "fill-extrusion-color": paint,
            "fill-extrusion-height": [
                "case",
                ["==", ["typeof", ["get", col]], "number"],
                ["*", ["to-number", ["get", col]], heightScalar],
                0,
            ],
            "fill-extrusion-opacity": 0.85,
            "fill-extrusion-base": 0,
        },
    };
    // No TYPE filter: the academic districts source (ma_academic_districts.geojson)
    // doesn't use the "Operating District" label — leaving the filter in place
    // matched zero features and silently broke 3D mode at district level.
    map.addLayer(layerCfg);
    map.setLayoutProperty(flatLayer, "visibility", "none");
    map.easeTo({ pitch: 55, bearing: -20, duration: 900 });
}

// ─── CSV EXPORT ──────────────────────────────────────────────────────────────
// Export the currently-active layer's features (with the active metric column
// + all year-keyed variants where applicable) as a CSV the user can open in
// Excel / Google Sheets.

function _csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function featuresToCsv(features, primaryMetric) {
    if (!features || !features.length) return "";
    // Build column set: prioritize identity cols, then primary metric, then everything else
    const idCols = ["DIST_CODE", "DIST_NAME", "dist_display",
                     "ORG8CODE", "ORG_NAME", "TOWN", "town_display",
                     "GEOID", "NAMELSAD", "TYPE", "NAME"];
    const seen = new Set();
    const cols = [];
    idCols.forEach(c => {
        if (features[0].properties && c in features[0].properties && !seen.has(c)) {
            cols.push(c); seen.add(c);
        }
    });
    if (primaryMetric && !seen.has(primaryMetric)) {
        cols.push(primaryMetric); seen.add(primaryMetric);
    }
    // Append all remaining property keys
    const otherKeys = new Set();
    features.forEach(f => {
        if (!f.properties) return;
        Object.keys(f.properties).forEach(k => { if (!seen.has(k)) otherKeys.add(k); });
    });
    [...otherKeys].sort().forEach(k => { cols.push(k); seen.add(k); });

    const lines = [cols.join(",")];
    features.forEach(f => {
        const p = f.properties || {};
        lines.push(cols.map(c => _csvEscape(p[c])).join(","));
    });
    return lines.join("\n");
}

function downloadCurrentLayerCsv() {
    if (typeof GEO_DATA !== "object" || !GEO_DATA) return;
    const lvl = state.level;
    const fc = GEO_DATA[lvl];
    if (!fc || !fc.features || !fc.features.length) return;
    const metricCol = (typeof activeColumn === "function")
        ? activeColumn(state.metric, state.year, lvl)
        : state.metric;
    const csv = featuresToCsv(fc.features, metricCol);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ma-atlas_${lvl}_${state.metric}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Export ONLY the currently selected feature (the place shown in the detail
// panel — e.g. the "Lynn" window) as a readable profile CSV: one row per metric
// exactly as the panel renders it, grouped by the panel's section headings. We
// scrape the rendered panel DOM rather than re-deriving from METRICS so the CSV
// always matches what the user is looking at (active year/group, rank rows, the
// community ACS section, everything).
function downloadSelectedFeatureCsv() {
    const body = document.getElementById("featurePanelBody");
    const titleEl = document.getElementById("featurePanelTitle");
    if (!body || !body.querySelector(".feature-panel-row")) return; // nothing selected
    const place = ((titleEl && titleEl.textContent) || "selection").trim();

    const rows = [["Section", "Metric", "Value"]];
    body.querySelectorAll(".feature-panel-row").forEach(r => {
        const label = r.querySelector(".label");
        if (!label) return;
        const labelTxt = label.textContent.trim();
        // Prefer the .value span; fall back to "everything in the row that isn't
        // the label" so rows with custom inner markup (e.g. the rank +
        // percentile row) still export rather than getting dropped.
        const valueEl = r.querySelector(".value");
        let valueTxt = valueEl
            ? valueEl.textContent.trim()
            : r.textContent.replace(labelTxt, "").trim();
        valueTxt = valueTxt.replace(/\s+/g, " ");
        const sec = r.closest(".feature-panel-section");
        const h = sec ? sec.querySelector("h3") : null;
        rows.push([h ? h.textContent.trim() : "", labelTxt, valueTxt]);
    });
    if (rows.length < 2) return;

    const csv = rows.map(cols => cols.map(_csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ma-atlas_${place.replace(/[^\w-]+/g, "_")}_profile.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.addEventListener("DOMContentLoaded", function () {
    // Keep the stated metric count in sync with the catalog automatically, so it
    // never goes stale as metrics are added. Drives the panel stats line + the
    // metric-search placeholder from the live METRICS length.
    const mc = document.getElementById("metricCount");
    if (mc) mc.textContent = String(METRICS.length);
    const ms = document.getElementById("metricSearch");
    if (ms) ms.placeholder = `Search ${METRICS.length} metrics…`;
    // "Start here" tab — guided questions + curated correlation teasers.
    renderStartQuestions();
    renderStartCorrelations();
    const btn = document.getElementById("exportCsvBtn");
    if (btn) btn.addEventListener("click", downloadCurrentLayerCsv);
    const placeBtn = document.getElementById("exportPlaceBtn");
    if (placeBtn) placeBtn.addEventListener("click", downloadSelectedFeatureCsv);
    // Print / save-as-PDF the open feature's panel as a one-page report card.
    // The @media print stylesheet hides the app chrome and lays the panel out flat.
    const printBtn = document.getElementById("printReportBtn");
    if (printBtn) printBtn.addEventListener("click", () => window.print());
});
