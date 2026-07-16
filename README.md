# maxwellhowegis.com

Source for [**maxwellhowegis.com**](https://maxwellhowegis.com) — Max Howe's GIS / geospatial-developer portfolio.

Plain HTML/CSS/JS with a small zero-dependency build script and no framework. The portfolio source lives in `src/portfolio/`; `node scripts/build_portfolio.mjs` generates the domain-root pages, case-study routes, metadata, sitemap, and compatibility redirects. GitHub Pages deploys from `main` with submodules checked out recursively.

## What's here

| Path | What | Tech |
|---|---|---|
| [`/`](https://maxwellhowegis.com) | Professional Web GIS portfolio with eight featured projects, ten full case studies, About, and Contact | Vanilla JS, generated from `src/portfolio/` |
| [`/geopuesto/`](https://maxwellhowegis.com/geopuesto/) | Antipodal observation system — click anywhere on Earth, see what's on the opposite side (weather, photos, satellites, vessels, radio, ISS, quakes, 15+ more layers). Plus "Your Personal Equator" — the great circle of cities equidistant from you and your antipode. | Leaflet + GeoNames + 20 free public APIs (Wikipedia, Open-Meteo, NOAA, USGS, OpenSky, AISStream, Mapillary, etc.) |
| [`/geopuesto/playground/`](https://maxwellhowegis.com/geopuesto/playground/) | Sibling research-grade spherical-geometry sandbox. **Two-Point Mode**: pick A and B, get the orthodrome + perpendicular bisector + the four named equidistant points (M, −M, n, −n), the Geomate-pair IP, cross/along-track readouts, Voronoi assignment. **Polyhedra Suite** (17 shapes): 5 Platonics, 3 Archimedean (cuboctahedron, truncated icosahedron, rhombic triacontahedron), 2 Kepler-Poinsot stellated dodecahedra, Stella Octangula, 2 polyhedral compounds (5-tetrahedra, 5-cubes), 3 parametric families (Fibonacci sphere 6–1000 vertices, geodesic, n-prism/antiprism) — wrapped on the globe with a 0–360° spin slider, vertex-0 anchored at any point, per-vertex GeoNames city enrichment. **Curves Suite** (4 variants): small-circle-at-distance-d, loxodrome (rhumb line), portolan windrose, isoazimuthal heading ring. **Analysis Suite v0**: 4 USGS earthquake feeds + Monte Carlo null-hypothesis test ("is this curve actually correlated with quakes, or could chance explain it?"). Share-link state encoding + GeoJSON export. `?debug=1` opens a runtime invariants battery. | Pure-JS spherical-math kernel, Leaflet |
| [`/ma-atlas/`](https://maxwellhowegis.com/ma-atlas/) | Statewide interactive map of every public school + district in Massachusetts. 351 municipalities, 274 academic districts (dissolved from town-level data — these polygons aren't in any MassGIS layer), 78 charters, 26 regional voc, 1,700 schools, 40+ joined education and demographic metrics. ArcGIS-style layer panel, palette + classification controls, hover + sticky side panel. | MapLibre GL JS, OpenFreeMap vector tiles, MassGIS, MA DESE E2C Hub, ACS |
| [`/whydah/`](https://maxwellhowegis.com/whydah/) | Custom 3D globe flythrough + curriculum dashboard for a middle-school PBL unit on the 1717 Whydah Gally shipwreck. 19 chronological waypoints with photo overlays, slow pans, primary-source quote integration. | MapLibre GL JS, Esri World Imagery, vanilla JS |
| [`/quabbin.html`](https://maxwellhowegis.com/quabbin.html) | The Quabbin Reservoir and the four Swift River Valley towns disincorporated in 1938 to supply Boston — a reproducible R GIS study: terrain, the MassGIS-LiDAR dam-contained reservoir, decennial census decline, a schematic reservoir-filling animation, the aqueduct east to Boston, and an interactive **LiDAR imprint explorer** where the lost villages' street plans, house lots and cellar holes read in 1 m bare-earth relief, ground-truthed against the 1893 USGS survey. | R (sf/terra/ggplot2), Leaflet, MassGIS LiDAR, USGS 3DEP, US Census |
| [`/lynn.html`](https://maxwellhowegis.com/lynn.html) | Chronic absenteeism capstone — geocoded student addresses correlated with distance from school across Lynn, MA. | R, ggplot2, Leaflet |
| [`/interstate-challenge/`](https://maxwellhowegis.com/interstate-challenge/) | **The Sequential Interstate Challenge** — an Optitrek test case. Drive every two-digit Interstate end to end; compare Version A (strict numerical order) against Version B (Optitrek picks order + orientation to minimize connector drive time). Interactive A-vs-B map with the time- and distance-saved headline. Built by `scripts/build_interstate_data.py` (geocode → OSRM connector matrix → DP + local-search solvers → static GeoJSON). | MapLibre GL JS, Python, OSRM, Nominatim, GeoJSON |
| [`/nsn.html`](https://maxwellhowegis.com/nsn.html) | NSN reference page | — |

## Submodules & vendored apps

All submodules must be **public** — the Pages workflow checks them out with the default token, which cannot read private repos.

| Path | How it's served | Source |
|---|---|---|
| `/geopuesto/` | git submodule | [`mapzimus/geopuesto`](https://github.com/mapzimus/geopuesto) |
| `/bugwars/` | git submodule | [`mapzimus/bug-wars`](https://github.com/mapzimus/bug-wars) |
| `/truescale/` | git submodule | [`mapzimus/true-scale`](https://github.com/mapzimus/true-scale) |
| `/quabbin/` | git submodule | [`mapzimus/quabbin`](https://github.com/mapzimus/quabbin) |
| `/ma-atlas/` | vendored copy | private `mapzimus/ma-education-atlas` — sync via `deploy/sync_public_maps.ps1` in `lehs-data-dive` |
| `/Lynn-data-dive/maps/` | vendored copy | private `mapzimus/lehs-data-dive` — same sync script |

After pushing changes inside a submodule, run `git submodule update --remote <path>` here, commit the pointer bump, push.

### Bootstrapping a new submodule (first time)

To promote a subdirectory into its own repo with history, then submodule it back:

```bash
git subtree split --prefix=<dir> -b bootstrap/<name>
git push https://github.com/mapzimus/<repo> bootstrap/<name>:main --force
git branch -D bootstrap/<name>

git rm -r <dir>/
git submodule add https://github.com/mapzimus/<repo> <dir>
git commit -m "convert <dir>/ to submodule"
```

Done so far: `geopuesto` (May 2026), `bug-wars`, `true-scale`, `quabbin` (June 2026). The Whydah Navigator game was extracted the same way to the `feat/navigator-game` branch of [`mapzimus/Whydah-Unit`](https://github.com/mapzimus/Whydah-Unit).

## Local development

Build once, then serve the repository root over HTTP:

```powershell
node scripts/build_portfolio.mjs
python -m http.server 8001
# Then open http://localhost:8001/.
```

Project data in `src/portfolio/js/data/projects.js` is the source of truth. The old root and `/v2/` URLs are generated as compatibility redirects.

This repository's code is licensed under the [MIT License](LICENSE); individual content and data files (imagery, GeoJSON, etc.) may carry their own source attribution — see file/dataset headers or the relevant project README for details.

## Contact

[maxwellhowegis.com/contact/](https://maxwellhowegis.com/contact/) · [@mapzimus](https://github.com/mapzimus) · mhowe.gis@gmail.com
