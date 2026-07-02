# Lynn Data Dive

An interactive comparison of **Lynn English High School** against all
**26 Massachusetts Gateway Cities**, spanning demographics, MCAS
performance, ELL pipeline, graduation and college outcomes, district
finance, teacher workforce, discipline, and community context, plus
cross-domain correlation analysis. This directory holds two pieces:
`index.html`, a thin full-bleed iframe wrapper that embeds the
[Streamlit dashboard](https://lynn-data-dive.streamlit.app) (with a
loading spinner and a "best viewed on desktop" note for the dense
chart-heavy layout), and `maps/`, a standalone MapLibre GL choropleth
explorer — ArcGIS-style layer panel, palette/classification controls,
35+ metrics across MA municipalities, school districts, and Lynn census
tracts.

**Data sources:** MassGIS, MA DESE (E2C Hub), and US Census/ACS. `maps/`
is a **vendored copy** synced manually from the private `lehs-data-dive`
repo (not a git submodule) — see `UPSTREAM-NOTES.md` at the repo root for
the sync process and the log of repo-local fixes that must be re-applied
after each resync. The Streamlit dashboard itself lives and deploys from
that same private repo; this directory only embeds it.
