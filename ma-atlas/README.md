# MA Education Atlas

A statewide MapLibre GL JS web map of Massachusetts education and demographics. 351 municipalities, 280 academic school districts, 78 charters, 26 regional vocational, ~1,700 public schools — all in one ArcGIS-style web map.

| | |
|---|---|
| **Live** | https://maxwellhowegis.com/ma-atlas/ |
| **Portfolio context** | https://maxwellhowegis.com/ |
| **Companion data pipeline** | `mapzimus/lehs-data-dive` (private) |

## Features

- 320+ metrics across MCAS proficiency & growth (SGP), SAT, AP, early education (PreK/K), class size, demographics, attendance, discipline, student mobility, finance, teacher workforce, college outcomes, gender gaps, school climate, whole-child course-taking, school-funding, and Census ACS socioeconomics
- Per-school layer with enrollment, Gr3-8 MCAS, accountability percentile, chronic absenteeism, experienced-teacher share, and 4-yr graduation (high schools) in the click popup
- Multiple classifications (Jenks, quantile, equal-interval, standard-deviation, geometric, pretty, manual, continuous) and 40+ palettes (incl. CVD-safe; diverging palettes auto-center on a meaningful midpoint)
- Semantic color convention — "higher = better" outcomes default to a cool ramp, "higher = worse" rates to a warm one, so color means the same thing across the atlas — plus a **color-vision (color-blind) preview** to check any map
- Texture fills (hatch / dots) mark the "no data" and "no high school" areas so blanks read as *not applicable*, not a low value
- On-map **value labels** (show the metric number on each area) and a **proportional-circle** overlay (bubble size = enrollment) so rate maps don't hide how many students each area represents
- Multiple basemaps incl. a keyless **light-gray minimal** base (data pops) and a labeled reference overlay on satellite
- Bivariate 3×3 mode to compare two metrics on one map
- Change-over-time mode: map any multi-year metric's change between two years on a diverging scale (absolute points or % change), with increased/decreased counts
- Temporal companions to the change map: a **slope chart** and **small-multiple maps** (one mini-choropleth per year, shared scale) in the Explore charts panel, plus a per-place **trajectory sparkline** in the detail panel
- Highlight-by-value filter (dim everything outside a range, with a live match count)
- Statewide rank + percentile in the tooltip and detail panel
- 3D extrusion mode, click-to-inspect side panel with a persistent selection outline
- Year slider with animation slideshow
- Student-group filter (race/ethnicity, ELL, low-income, students with disabilities)
- PNG export (embeds legend + credit), CSV export, and a "Copy link" that reproduces the exact view (level, metric, palette, classification, year, group, camera)
- Search a town, district, or **school** by name and fly to it

## Tech

Plain static site: MapLibre GL JS 4.7, vanilla JavaScript, no build step. Deployed via GitHub Pages as a submodule of [maxwellhowegis](https://github.com/mapzimus/maxwellhowegis).

```
ma-education-atlas/
├── index.html          MapLibre app shell
├── app.js              Main map logic, layers, controls
├── style.css           Atlas-specific styles
├── scripts/            Python fetchers for the DESE/ACS side-join files
└── data/               GeoJSON layers + side-join JSON (built by lehs-data-dive + scripts/)
    ├── ma_academic_districts.geojson
    ├── ma_districts_metrics.geojson      charter / voc-tech / collaborative overlays
    ├── ma_municipalities.geojson
    ├── ma_public_schools.geojson
    ├── ma_district_acs.json              ACS basics, aggregated to districts
    ├── ma_district_acs_extra.json        ACS extras (home value, commute, age, broadband, owner-occ)
    ├── ma_muni_acs.json                  ACS basics, by municipality
    ├── ma_muni_acs_extra.json            ACS extras, by municipality
    ├── ma_district_edu_extra.json        attendance / chronic-absent / teacher cols
    ├── ma_district_discipline.json       students-disciplined / OSS / ISS rates
    ├── ma_district_outcomes_extra.json   SAT / class size / stability / churn
    └── ma_school_metrics.json            per-school enrollment / MCAS / accountability (by SCHID)
```

> Note: the former split-screen *Compare Mode* was retired in favor of the
> lighter bivariate 3×3 mode.

Page chrome (`../css/style.css`, `../images/favicon.svg`, top-nav links) is intentionally relative — those paths resolve through the parent portfolio site when the atlas is mounted as a submodule at `maxwellhowegis.com/ma-atlas/`.

## Refreshing data

GeoJSONs are produced by the `lehs-data-dive` pipeline (private repo). To refresh:

```powershell
# In lehs-data-dive working tree
python scripts/refresh_all.py        # or just step 11_build_lynn_geo.py
cp data/processed/ma_*.geojson    ../maxwellhowegis/ma-atlas/data/
cp data/processed/lynn_*.geojson  ../maxwellhowegis/ma-atlas/data/

# Then commit + push from inside the submodule
cd ../maxwellhowegis/ma-atlas
git add data && git commit -m "Refresh atlas data" && git push

# And bump the parent's submodule pointer
cd ..
git add ma-atlas && git commit -m "Bump ma-atlas submodule" && git push
```

## License

Code: MIT. Data is sourced from public DESE, federal, and state agency datasets — attribution requested when reusing.
