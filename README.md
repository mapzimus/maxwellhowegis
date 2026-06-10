# maxwellhowegis.com

Source for [**maxwellhowegis.com**](https://maxwellhowegis.com) — Max Howe's GIS / geospatial-developer portfolio.

Plain HTML/CSS/JS, no build step, no framework. Deployed via GitHub Pages from `main` with `actions/checkout@v4 ... submodules: recursive` so sub-app submodules render at their own subpaths.

## What's here

| Path | What | Tech |
|---|---|---|
| [`/`](https://maxwellhowegis.com) | Portfolio shell — landing, project gallery, about, contact | Vanilla JS, dynamic card grid from `js/projects.js` |
| [`/geopuesto/`](https://maxwellhowegis.com/geopuesto/) | Antipodal observation system — click anywhere on Earth, see what's on the opposite side (weather, photos, satellites, vessels, radio, ISS, quakes, 15+ more layers). Plus "Your Personal Equator" — the great circle of cities equidistant from you and your antipode. | Leaflet + GeoNames + 20 free public APIs (Wikipedia, Open-Meteo, NOAA, USGS, OpenSky, AISStream, Mapillary, etc.) |
| [`/geopuesto/playground/`](https://maxwellhowegis.com/geopuesto/playground/) | Sibling research-grade spherical-geometry sandbox. **Two-Point Mode**: pick A and B, get the orthodrome + perpendicular bisector + the four named equidistant points (M, −M, n, −n), the Geomate-pair IP, cross/along-track readouts, Voronoi assignment. **Polyhedra Suite** (17 shapes): 5 Platonics, 3 Archimedean (cuboctahedron, truncated icosahedron, rhombic triacontahedron), 2 Kepler-Poinsot stellated dodecahedra, Stella Octangula, 2 polyhedral compounds (5-tetrahedra, 5-cubes), 3 parametric families (Fibonacci sphere 6–1000 vertices, geodesic, n-prism/antiprism) — wrapped on the globe with a 0–360° spin slider, vertex-0 anchored at any point, per-vertex GeoNames city enrichment. **Curves Suite** (4 variants): small-circle-at-distance-d, loxodrome (rhumb line), portolan windrose, isoazimuthal heading ring. **Analysis Suite v0**: 4 USGS earthquake feeds + Monte Carlo null-hypothesis test ("is this curve actually correlated with quakes, or could chance explain it?"). Share-link state encoding + GeoJSON export. `?debug=1` opens a runtime invariants battery. | Pure-JS spherical-math kernel, Leaflet |
| [`/ma-atlas/`](https://maxwellhowegis.com/ma-atlas/) | Statewide interactive map of every public school + district in Massachusetts. 351 municipalities, 274 academic districts (dissolved from town-level data — these polygons aren't in any MassGIS layer), 78 charters, 26 regional voc, 1,700 schools, 40+ joined education and demographic metrics. ArcGIS-style layer panel, palette + classification controls, hover + sticky side panel. | MapLibre GL JS, OpenFreeMap vector tiles, MassGIS, MA DESE E2C Hub, ACS |
| [`/whydah/`](https://maxwellhowegis.com/whydah/) | Custom 3D globe flythrough + curriculum dashboard for a middle-school PBL unit on the 1717 Whydah Gally shipwreck. 19 chronological waypoints with photo overlays, slow pans, primary-source quote integration. | MapLibre GL JS, Esri World Imagery, vanilla JS |
| [`/quabbin.html`](https://maxwellhowegis.com/quabbin.html) | The Quabbin Reservoir and the four Swift River Valley towns disincorporated in 1938 to supply Boston — a reproducible R GIS study: terrain, the MassGIS-LiDAR dam-contained reservoir, decennial census decline, a schematic reservoir-filling animation, the aqueduct east to Boston, and an interactive **LiDAR imprint explorer** where the lost villages' street plans, house lots and cellar holes read in 1 m bare-earth relief, ground-truthed against the 1893 USGS survey. | R (sf/terra/ggplot2), Leaflet, MassGIS LiDAR, USGS 3DEP, US Census |
| [`/lynn.html`](https://maxwellhowegis.com/lynn.html) | Chronic absenteeism capstone — geocoded student addresses correlated with distance from school across Lynn, MA. | R, ggplot2, Leaflet |
| [`/nsn.html`](https://maxwellhowegis.com/nsn.html) | NSN reference page | — |

## Submodules

Sub-apps live in their own GitHub repos and are mounted here as git submodules:

- [`mapzimus/geopuesto`](https://github.com/mapzimus/geopuesto) — `/geopuesto/` + `/geopuesto/playground/`. Promoted out of this repo in May 2026 (via `git filter-repo --subdirectory-filter` preserving 14 commits of history) so the antipode app + geometry sandbox have their own README, stars, and issue tracker.
- [`mapzimus/ma-education-atlas`](https://github.com/mapzimus/ma-education-atlas) — `/ma-atlas/`. The MassGIS-academic-districts dissolve work lives here; the standalone repo is what gets cited.

GitHub Pages handles submodule fetch via `submodules: recursive` in `.github/workflows/pages.yml`. After pushing changes inside a submodule, run `git submodule update --remote` here, commit the pointer bump, push — the Pages workflow re-deploys with the new submodule SHA.

## Local development

Each page is plain HTML; just open `index.html` in a browser. For sub-apps that need a real HTTP origin (Geolocation API, CORS, Google Maps embed):

```powershell
# From repo root
python -m http.server 8001
# Then http://localhost:8001 for the portfolio, /geopuesto/ for the antipode app, /geopuesto/playground/ for the sandbox.
```

Editing project data: `js/projects.js` is the source of truth for the gallery cards. See `DEPLOY.md` for the full first-time deploy walkthrough (DNS setup, custom domain pointed at GitHub Pages, etc.).

## Contact

[maxwellhowegis.com/contact.html](https://maxwellhowegis.com/contact.html) · [@mapzimus](https://github.com/mapzimus) · mhowe.gis@gmail.com
