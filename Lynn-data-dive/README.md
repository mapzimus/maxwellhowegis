# Lynn Data Dive

An interactive comparison of **Lynn English High School** against all
**26 Massachusetts Gateway Cities**, spanning demographics, MCAS
performance, ELL pipeline, graduation and college outcomes, district
finance, teacher workforce, discipline, and community context, plus
cross-domain correlation analysis. The public dashboard lives at
[maxwellhowegis.com/lynndata/](https://maxwellhowegis.com/lynndata/), where
a full-bleed iframe wrapper embeds the always-on Railway-hosted Streamlit
backend. This legacy directory preserves the old URL with a redirect and
contains `maps/`, a standalone MapLibre GL choropleth
explorer — ArcGIS-style layer panel, palette/classification controls,
35+ metrics across MA municipalities, school districts, and Lynn census
tracts.

**Data sources:** MassGIS, MA DESE (E2C Hub), and US Census/ACS. `maps/`
is a **vendored copy** synced manually from the private `lehs-data-dive`
repo (not a git submodule) — see `UPSTREAM-NOTES.md` at the repo root for
the sync process and the log of repo-local fixes that must be re-applied
after each resync. The Streamlit dashboard itself lives in and deploys to
Railway from that same private repo.
