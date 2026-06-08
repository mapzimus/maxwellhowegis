// ===== PROJECT DATA =====
// era: "current"  → post-graduation, self-directed work (shown first)
// era: "school"   → MS GIS coursework at Salem State, 2023–2025
const projects = [
    {
        id: 1,
        era: "school",
        title: "Chronic Absenteeism in Lynn Public Schools",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "Geocoding", "Statistical Analysis", "Leaflet"],
        summary: "Geocoded student addresses and correlated distance from school with chronic absenteeism rates across Lynn, MA — my capstone project for my MS program.",
        description: "For my capstone project in the MS program (Project Implementation), I tackled the chronic absenteeism problem in Lynn Public Schools. I wanted to know if the distance a student lives from school has any measurable impact on whether they show up. I geocoded student addresses across the district and correlated each student's distance from school with their absenteeism record. I wrote scripts in R to run the analysis, including scatter plots, violin plots, box plots, and distance band breakdowns (0–0.25 mi, 0.25–0.5 mi, 0.5–1 mi, 1–2 mi, 2–3 mi, 3+ mi). The result was an extremely slight negative correlation — distance alone is not a strong predictor of attendance. The project produced a full suite of thematic maps and statistical visualizations.",
        tools: ["R", "ggplot2", "Geocoding", "ArcGIS Pro", "Leaflet", "Statistical Analysis"],
        year: "2025",
        course: "GPH955 — GIS Project Implementation",
        thumb: "images/projects/lynn-thumb.png",
        liveUrl: "lynn.html",
        repoUrl: null
    },
    {
        id: 2,
        era: "school",
        title: "Salem Pantry: Mapping Food Access",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "Random Forest", "Census ACS", "Cluster Analysis"],
        summary: "Analyzed 150,000 rows of client data for the Salem Pantry using R — identified underserved areas and used random forest modeling to find similar populations statewide.",
        description: "A group project where our team worked with the Salem Pantry, a non-profit food pantry in Salem, MA, to analyze over 150,000 rows of their client data. The goal was to figure out who's using the pantry, where they're coming from, and where the coverage gaps are. We cleaned and organized all the data, then used R with packages like sf, tmap, tidycensus, tigris, randomForest, ranger, caret, leaflet, and ggplot2 to run the analysis. We mapped dry zones — areas with less pantry coverage — and used random forest analysis and statistical regression to identify other parts of Massachusetts with similar socioeconomic profiles (based on census tract data like income, household size, language, and race). The results were presented to the Salem Pantry board to help guide decisions about outreach and potential expansion.",
        tools: ["R", "sf", "tmap", "tidycensus", "randomForest", "ArcGIS Pro", "Census ACS"],
        year: "2024",
        course: "GPH953 — Seminar in GIS Applications",
        thumb: "images/projects/salem-pantry-thumb.png",
        gallery: [
            { src: "images/projects/salem-pantry/image2.png", caption: "Salem Pantry Mobile Locations" },
            { src: "images/projects/salem-pantry/image8.png", caption: "Pantry-using Households by Cluster" },
            { src: "images/projects/salem-pantry/image10.png", caption: "Pantry Users per Census Block Group" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113405.png", caption: "Spatial Analysis Overview" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113509.png", caption: "Coverage Analysis" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113555.png", caption: "Demographic Breakdown" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113627.png", caption: "Random Forest Results" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113700.png", caption: "Statewide Similarity Analysis" },
            { src: "images/projects/salem-pantry/Screenshot 2025-05-30 113723.png", caption: "Final Recommendations" }
        ],
        groupProject: true,
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 3,
        era: "school",
        title: "Growth in the Granite State",
        category: "Remote Sensing",
        type: "remote",
        tags: ["Landsat 8/9", "Change Detection", "TerrSet"],
        summary: "Change detection analysis of Concord, Manchester, and Nashua using USGS Landsat imagery to identify shifts in urbanization and land cover.",
        description: "Change detection analysis of Concord, Manchester, and Nashua, NH using USGS Landsat imagery from two different time periods. I used TerrSet to overlay the images on top of each other as a multitemporal composite — one color shows change, another shows no change. The analysis looked for shifts in urbanization, forestation, and potential river changes. True color composites were built using bands 2, 3, and 4, then pansharpened with the 15m panchromatic band. The overlay revealed notable expansion in Concord and Nashua, while Manchester showed a slight population decline. Straightforward remote sensing work using freely available satellite imagery.",
        tools: ["Landsat 8/9", "TerrSet", "PANSHARPEN", "True Color Composites", "Multitemporal Analysis"],
        year: "2024",
        course: "GPH910 — Digital Image Processing",
        thumb: "images/projects/granite-state-thumb.png",
        gallery: [
            { src: "images/projects/granite-state/image1.png", caption: "New Hampshire Fall Foliage — Study Area" },
            { src: "images/projects/granite-state/image5.png", caption: "Concord — True Color Composite" },
            { src: "images/projects/granite-state/image10.png", caption: "Concord — Multitemporal Change Detection" },
            { src: "images/projects/granite-state/image14.png", caption: "Manchester — Change Detection" },
            { src: "images/projects/granite-state/image15.png", caption: "Nashua — Change Detection" },
            { src: "images/projects/granite-state/Screenshot 2025-05-30 114843.png", caption: "Landsat Imagery Analysis" },
            { src: "images/projects/granite-state/Screenshot 2025-05-30 114920.png", caption: "Band Composite Comparison" },
            { src: "images/projects/granite-state/Screenshot 2025-05-30 114936.png", caption: "Pansharpened Imagery" },
            { src: "images/projects/granite-state/Screenshot 2025-05-30 115012.png", caption: "Urban Expansion Results" },
            { src: "images/projects/granite-state/Screenshot 2025-05-30 115047.png", caption: "Final Analysis" }
        ],
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 4,
        era: "school",
        title: "Optimal EV Charging Station Siting",
        category: "Research",
        type: "analysis",
        tags: ["GIS-AHP", "MCDM", "EV Infrastructure", "Literature Review"],
        summary: "Research paper reviewing GIS methods for deploying EV charging stations globally, with a proposed methodology for Massachusetts.",
        description: "A research project where I reviewed a large body of scientific literature on using GIS to determine optimal locations for EV charging station deployment across the globe. The paper covers the current EV charging landscape in Massachusetts (as of 2025), examines spatial analytical techniques like Kernel Density Estimation, network analysis, and location-allocation models, and proposes my own methodology for how I would approach the siting problem in MA using Multi-Criteria Decision Making frameworks (AHP, fuzzy DEMATEL). The literature review spans studies from cities like Amsterdam, Birmingham UK, Ottawa, and Qingdao. The research also addresses equity — how historically underserved neighborhoods are disproportionately lacking charging infrastructure.",
        tools: ["ArcGIS Pro", "GIS-AHP", "KDE", "Network Analysis", "Location-Allocation", "Census Data"],
        year: "2025",
        course: "GPH904 — GIS Research",
        thumb: "images/projects/ev-research.png",
        gallery: [
            { src: "images/projects/ev-research/Slide1.PNG", caption: "Title Slide" },
            { src: "images/projects/ev-research/Slide3.PNG", caption: "Research Overview" },
            { src: "images/projects/ev-research/Slide5.PNG", caption: "Literature Review" },
            { src: "images/projects/ev-research/Slide7.PNG", caption: "Spatial Optimization Techniques" },
            { src: "images/projects/ev-research/Slide10.PNG", caption: "Proposed GIS Methodology for MA" },
            { src: "images/projects/ev-research/Slide12.PNG", caption: "Equity Analysis" },
            { src: "images/projects/ev-research/Slide14.PNG", caption: "Current MA Landscape" },
            { src: "images/projects/ev-research/Slide16.PNG", caption: "Conclusions" }
        ],
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 5,
        era: "school",
        title: "Mapping Education and Wealth in Massachusetts",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["ArcGIS Pro", "Census ACS", "Bivariate"],
        summary: "Bivariate mapping of Massachusetts municipalities correlating median household income to educational attainment — my first GIS project.",
        description: "My first GIS project. A bivariate map of Massachusetts at the municipal level, correlating median household income with educational attainment using American Community Survey data. The maps show clear spatial patterns — towns with higher rates of bachelor's degrees consistently line up with higher median incomes, especially in the Greater Boston suburbs. It's a simple concept but it was where I learned the fundamentals of thematic mapping, data classification, and working with census data in ArcGIS Pro.",
        tools: ["ArcGIS Pro", "Census ACS Data", "MassGIS", "Bivariate Mapping"],
        year: "2024",
        course: "GPH952 — Spatial Database Design & Analysis",
        thumb: "images/projects/education-thumb.png",
        gallery: [
            { src: "images/projects/education/image11.png", caption: "Study Area — Massachusetts Municipalities" },
            { src: "images/projects/education/image15.png", caption: "% Population with at Least a Bachelor's Degree" },
            { src: "images/projects/education/image20.png", caption: "Median Household Income by Municipality" },
            { src: "images/projects/education/image25.png", caption: "Bivariate Map — Master's Degree vs. Income" },
            { src: "images/projects/education/image26.png", caption: "Bivariate Map — PhD vs. Income" },
            { src: "images/projects/education/image27.png", caption: "Scatter Plot — % No High School vs. Income" },
            { src: "images/projects/education/image28.png", caption: "Scatter Plot — % High School vs. Income" },
            { src: "images/projects/education/image30.png", caption: "Scatter Plot — % Bachelor's vs. Income" }
        ],
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 6,
        era: "school",
        title: "Central Campus Mapping",
        category: "Cartography",
        type: "map",
        tags: ["ArcGIS Pro", "CAD", "Drone Imagery", "Trimble GPS"],
        summary: "Surveying project combining CAD files, drone imagery, and Trimble GPS ground verification of Salem State University's central campus.",
        description: "A surveying and GIS project for Salem State University's central campus. We captured drone imagery of the campus, then overlayed CAD files on top of the aerial photos. Everything was verified on the ground using Trimble GPS devices. The final product is a detailed campus map built from the integration of CAD data, UAV imagery, and GPS ground-truthing — combining traditional surveying methods with modern geospatial technology.",
        tools: ["ArcGIS Pro", "CAD", "UAV / Drone Imagery", "Trimble GPS", "Georeferencing"],
        year: "2024",
        course: "GPH946 — Computer Cartography",
        thumb: "images/projects/central-campus-thumb.png",
        gallery: [
            { src: "images/projects/central-campus/Screenshot 2025-05-30 114432.png", caption: "CAD Utility As-Built Drawing" },
            { src: "images/projects/central-campus/Screenshot 2025-05-30 114524.png", caption: "Drone Orthomosaic — Central Campus" },
            { src: "images/projects/central-campus/Screenshot 2025-05-30 114605.png", caption: "Drone Imagery Overlaid in ArcGIS Pro" }
        ],
        groupProject: true,
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 7,
        era: "school",
        title: "Lynnfield Cemetery Spatial Database",
        category: "Database Design",
        type: "web",
        tags: ["SQL", "ArcGIS Pro", "Database Design"],
        summary: "Spatial database for the cemeteries in Lynnfield, MA — digitizing ~4,000 grave cards and ~1,000 lot cards into a queryable GIS system.",
        description: "Built a spatial database for the Town of Lynnfield's two cemeteries: Forest Hill Cemetery and Willow Cemetery. The town had approximately 4,000 grave cards and 1,000 lot cards in binders that needed to be digitized and made searchable. I designed a SQL database schema to hold burial records, lot ownership, veteran grave data, and deed associations, then linked everything to spatial features in ArcGIS Pro. Historical cemetery maps were georeferenced and digitized. The system replaced paper binders with a queryable GIS database that cemetery staff can actually use to look up and manage plot information.",
        tools: ["SQL", "ArcGIS Pro", "Geodatabase Design", "Georeferencing", "OCR"],
        year: "2024",
        course: "GPH952 — Spatial Database Design & Analysis",
        thumb: "images/projects/lynnfield/CemMap.png",
        gallery: [
            { src: "images/projects/lynnfield/CemMap.png", caption: "Lynnfield, MA Cemeteries Overview" },
            { src: "images/projects/lynnfield/Screenshot 2025-05-30 115155.png", caption: "Database and Spatial Features in ArcGIS Pro" }
        ],
        groupProject: true,
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 8,
        era: "school",
        title: "Emergency Evacuation Route Planning",
        category: "Web App",
        type: "web",
        tags: ["Python", "arcpy", "FEMA", "Network Analysis"],
        summary: "Python-based route planning tool using FEMA flood data to identify evacuation routes in Salem, MA.",
        description: "Used arcpy to build a route planning tool that looked at FEMA flood water sea-rise data overlayed over Salem, MA. The idea was to reroute someone evacuating Salem in a flood scenario where certain roads couldn't be used. Roads with higher traffic volumes and greater flood risk received higher impedance weights in the network analysis, making them less favorable. The output visualizes the safest and most dangerous evacuation routes from a given starting point.",
        tools: ["Python", "arcpy", "ArcGIS Pro", "MassGIS", "FEMA Flood Data", "Network Analysis"],
        year: "2024",
        course: "GPH960 — Software Design & Programming in GIS",
        thumb: "images/projects/evacuation-thumb.png",
        gallery: [
            { src: "images/projects/evacuation/Screenshot 2025-05-30 114045.png", caption: "Flood Zone & Traffic Network Analysis" },
            { src: "images/projects/evacuation/Screenshot 2025-05-30 114112.png", caption: "arcpy Evacuation Route Script" }
        ],
        liveUrl: null,
        repoUrl: null
    },
    // ─── Current / Active ─────────────────────────────────────────────────────
    {
        id: 17,
        era: "current",
        title: "Quabbin: A Valley Chosen, Four Towns Erased",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "sf", "terra", "DEM / Hillshade", "Leaflet", "OpenStreetMap", "USGS WBD", "Census TIGER", "US Census 1920"],
        summary: "A reproducible multi-layer R GIS study of the Quabbin Reservoir — the four Swift River Valley towns (Dana, Enfield, Greenwich, Prescott) deliberately drowned in 1938 to supply Boston's water. Terrain, reservoir, watershed, modern boundaries, real census population, a flood-fill animation, and the aqueduct to Boston — all from open data, rendered to ten figures plus an interactive Leaflet map by a single R pipeline.",
        description: "The first in a planned series of multi-layer GIS studies of geography-shaped American places — and the first portfolio piece that ships its full analysis code. In 1938 Massachusetts disincorporated four entire towns — Dana, Enfield, Greenwich, and Prescott — and flooded the Swift River Valley to create the Quabbin Reservoir, displacing about 2,500 people so that Boston, 65 miles east, could drink. I built the whole study in R as a reproducible pipeline: a DEM pulled from AWS Terrain Tiles (elevatr), reprojected to Massachusetts State Plane and hillshaded with terra; the reservoir carved straight out of the terrain at its 530-foot full-pool elevation; USGS Watershed Boundary Dataset units for regional drainage context; US Census TIGER municipalities to show how the four towns were erased and their land parcelled out to the survivors that ring the water today; real decennial US Census counts (1900–1920) showing every town already shrinking before the reservoir; a flood-fill animation that raises the water up the DEM from the valley floor to the 1946 full pool; and the Quabbin Aqueduct carrying the water ~100 km east to metropolitan Boston — the city the valley was drowned for. It all comes together in an interactive Leaflet map where you drag a slider to raise the water, read each town's census history, and follow the aqueduct east. Every spatial layer comes from open data, every network fetch degrades gracefully if a service is down, and a single `Rscript run_all.R` regenerates all ten figures, the animation, and the GeoJSON behind the interactive map from scratch. Read together, the layers tell one story — a valley its geography made an obvious basin, and the four towns that vanished to fill it.",
        tools: ["R", "sf", "terra", "elevatr", "osmdata", "tigris", "ggplot2", "Leaflet", "ImageMagick", "GDAL"],
        year: "2026",
        thumb: "quabbin/output/08_hero.png",
        liveUrl: "quabbin.html",
        repoUrl: "https://github.com/mapzimus/maxwellhowegis/tree/main/quabbin"
    },
    {
        id: 16,
        era: "current",
        title: "Massachusetts Education Atlas",
        category: "Web Mapping",
        type: "map",
        tags: ["MapLibre GL JS", "Vector Tiles", "MassGIS", "MA DESE", "Choropleth", "Jenks"],
        summary: "Statewide interactive web map of every public school and school district in Massachusetts. 351 municipalities, 274 academic districts, 78 charters, 26 regional vocational, 1,700 schools — 40+ joined education and demographic metrics, ArcGIS-style layer panel, palette + classification controls, hover + sticky side panel.",
        description: "A standalone GIS portfolio piece — and the only place I've seen Massachusetts academic school district boundaries actually rendered as polygons. MassGIS publishes a 'CCUV' shapefile that contains only charters, vocational, collaboratives, and historic unions — NOT the regular town/regional districts. So I built those: dissolved MA towns by their dominant academic district code (derived from the public-schools point file) to get 274 academic district polygons that no published map shows. Voc-tech and charter districts geographically OVERLAP academic ones (Northeast Metro Voc-Tech covers 9 towns; Boston charters serve city-wide), so all three are independent toggleable layers with distinct styling. Choropleth supports any of 40+ joined metrics — demographics, MCAS, graduation, AP, postsecondary plans, finance per-pupil categories, teacher workforce — with 12 ColorBrewer palettes, Fisher-Jenks natural breaks (default), 3D extrusion, hover tooltips, and a sticky right-side feature-detail panel. Vector tiles via OpenFreeMap (no API key). Data sourced via jsDelivr from the lehs-data-dive repo so refreshes flow automatically.",
        tools: ["MapLibre GL JS", "OpenFreeMap (vector tiles)", "MassGIS", "MA DESE E2C Hub", "US Census ACS", "GeoPandas", "Pure JavaScript"],
        year: "2026",
        thumb: "images/projects/ma-atlas-preview.png",
        liveUrl: "ma-atlas/",
        repoUrl: "https://github.com/mapzimus/maxwellhowegis"
    },
    {
        id: 10,
        era: "current",
        title: "Geopuesto",
        category: "Web App",
        type: "tool",
        tags: ["JavaScript", "Leaflet", "Antipodes", "Spherical Geometry", "Real-time APIs"],
        summary: "Antipodal observation system — click anywhere on Earth and see what's on the exact opposite side. Live weather, recent earthquakes, satellites overhead, internet radio playing right now, ISS position, Mapillary photos, and 15+ more data layers. Plus 'Your Personal Equator' — the great circle of cities exactly equidistant from you and your antipode.",
        description: "Geopuesto started as a one-line antipode calculator and grew into a full-screen Mission Control–style discovery tool. Click a map (or use coordinates / search / 'use my location' / a curated quick-pick), and Geopuesto computes the antipode and assembles 20+ enrichment modules about the place on the other side: Wikipedia, Wikimedia Commons photo gallery, Google Street View embed, recent Sentinel-2 satellite imagery, current weather + air quality, sunrise/sunset, country details, ISS and satellite passes overhead, live aircraft (OpenSky) and vessels (AISStream), recent USGS earthquakes, geomagnetic activity + aurora forecast (NOAA SWPC), active Smithsonian-tracked volcanoes, magnetic declination, internet radio stations in the antipode's country, and Mapillary community street-level photos. The 'Your Personal Equator' module renders the great circle perpendicular to the antipodal axis on both maps and surfaces every GeoNames city within a configurable tolerance band — ~10,007 km from you and from your antipode by construction. Modules priority-sort dynamically: an M5+ quake in the past 24h, aurora visible at the antipode's latitude, an active volcano within 250 km, or the ISS overhead all float to the top automatically. Sibling research-grade geometry tool lives at /geopuesto/playground/.",
        tools: ["JavaScript", "Leaflet", "GeoNames", "Open-Meteo", "NOAA", "USGS", "OpenSky", "AISStream", "Mapillary", "Sentinel-2 (CDSE)", "GitHub Pages"],
        year: "2025–2026",
        thumb: "images/projects/geopuesto-thumb.png",
        liveUrl: "geopuesto/",
        repoUrl: "https://github.com/mapzimus/geopuesto"
    },
    {
        id: 15,
        era: "current",
        title: "Lynn Data Dive",
        category: "Web App",
        type: "viz",
        tags: ["Streamlit", "Python", "Plotly", "MA DESE", "Census ACS", "Education Data"],
        summary: "Interactive public dashboard integrating every public dataset that touches Lynn English High School and the 26 MA Gateway Cities. MCAS, enrollment, ELL pipeline, graduation, college outcomes, finance, teacher workforce, discipline, community context, maps, and cross-domain correlation analysis — in one place.",
        description: "DESE publishes Lynn English data across half a dozen separate Power BI dashboards, statewide bulk downloads, and federal datasets — none of which are joined. The Lynn Data Dive integrates every relevant public source (MA DESE E2C Hub's 22 datasets, US Census ACS, MassGIS, EPA EJScreen, NCES) into a single Streamlit app, then adds a cross-domain Correlation Lab that lets you pick any two metrics and see how they relate across the 26 Gateway City high schools. Sections include School Profile, Academic Performance (MCAS with full E/M/PM/NM distribution), ELL Pipeline (the central narrative thread — Lynn English is ~42% ELL), College & Career Readiness, Success After HS, Teachers & Workforce, Finance, Discipline & Climate, Community Context, Lynn District & Sibling Schools (LEHS vs Lynn Classical, Lynn Tech, etc.), Gateway Peer Comparison, and a Maps section with four tabs (Lynn Schools, Lynn Demographics with tract-level Census ACS, MA Statewide Districts, Gateway Cities). A Catchment Research page embeds the privacy-safe aggregated outputs of the prior chronic absenteeism capstone. The whole pipeline is reproducible — when DESE releases new data each fall, a single refresh command pulls everything and the dashboard auto-redeploys.",
        tools: ["Python", "Streamlit", "Plotly", "Pandas", "GeoPandas", "MA DESE E2C Hub", "US Census ACS", "MassGIS"],
        year: "2026",
        thumb: "images/projects/lynn-data-dive-thumb.png",
        liveUrl: "Lynn-data-dive/",
        repoUrl: "https://github.com/mapzimus/lehs-data-dive"
    },
    {
        id: 12,
        era: "current",
        title: "Geopuesto Playground",
        category: "Web App",
        type: "tool",
        tags: ["JavaScript", "Spherical Geometry", "Polyhedra", "Geomates", "Curves Suite", "Sandbox"],
        summary: "Research-grade sandbox for spherical geometry on Earth's surface. Two-Point Mode (A→B great circle + the four named equidistant points), Polyhedra Suite (Platonic + Archimedean solids wrapped on a sphere with a spin slider), Curves Suite (loxodromes, small-circles-at-distance-d, Fibonacci spheres, geodesics), and the 'Geomates' midpoint pair — the IP showcase.",
        description: "Geopuesto's sibling app: stripped, instrument-style interface focused on the underlying geometry. Two-Point Mode lets you pick A and B and renders the great-circle (orthodrome), perpendicular bisector, and four named equidistant points (M = midpoint of A→B arc, −M = its antipode, n = north pole of the A–B great circle, −n = its south pole). The 'Geomate' pair (M, −M) is a paired-discovery feature: two surface points each exactly equidistant from A and from B, computed without iteration. Polyhedra Suite wraps Platonic solids (tetra/cube/octa/icosa/dodeca), Archimedean ones (cuboctahedron, truncated icosahedron a.k.a. the soccer ball / C60), and special cases (rhombic triacontahedron, Stella Octangula, geodesic, n-prism / n-antiprism, Fibonacci sphere — 6 to 1000 points) around the sphere with vertex 0 anchored at any point and a 0–360° spin slider that rotates the wireframe in real time. Curves Suite ships small-circle-at-distance-d (the locus of points exactly d km from anchor — a 'ring of cities at d km from here'), loxodromes (constant-bearing rhumb lines, intersected against small circles), with isoazimuthal curves and portolan windroses on deck. Cross-track / along-track / Voronoi readouts. Share-link state encoding (A, B, anchor, shape, spinDeg restore from URL hash) and GeoJSON export of the current configuration.",
        tools: ["JavaScript", "Leaflet", "Pure-JS spherical math kernel", "Three.js–free", "GitHub Pages"],
        year: "2026",
        thumb: "images/projects/playground-thumb.svg",
        liveUrl: "geopuesto/playground/",
        repoUrl: "https://github.com/mapzimus/geopuesto",
        status: "development"
    },
    {
        id: 9,
        era: "current",
        title: "TappyMaps",
        category: "Web App",
        type: "tool",
        tags: ["JavaScript", "Map Design", "Geography Games", "GIS App"],
        summary: "A web-based GIS application for map design — drag, color, and export custom maps. Includes geography games and a sharing gallery. Live at tappymaps.com.",
        description: "TappyMaps is a web-based GIS application built around three pillars: map designer, geography games, and a sharing gallery. The map designer lets users build and style custom maps using geographic data — no desktop GIS software required. Geography games add an educational layer. Finished maps can be exported and shared. Part of the Mapparatus organization umbrella.",
        tools: ["JavaScript", "GeoJSON", "Canvas API", "Web APIs"],
        year: "2025–2026",
        thumb: "images/projects/tappymaps-logo.png",
        thumbStyle: "logo",
        liveUrl: "https://tappymaps.com",
        repoUrl: null
    },
    {
        id: 11,
        era: "current",
        title: "Optitrek",
        category: "Spatial Analysis",
        type: "tool",
        tags: ["Python", "OR-Tools", "PostGIS", "OSRM", "Constrained TSP", "In Development"],
        summary: "Algorithmic optimal US road trip — a 2026 redo of Randal Olson's 2015 viral 'optimal road trip' with 8× the candidate pool, a provably-better solver, and self-hosted open-source routing. Tier 1 data layer is live; algorithm in active development.",
        description: "Optitrek is an algorithmic road-trip optimizer for the United States. It takes the 2015 Randal Olson 'optimal US road trip' — 50 hand-picked stops, genetic algorithm, Google Maps API — and rebuilds it with 2026 tools. Instead of just ordering hand-picked stops, Optitrek solves both the selection AND the ordering across ~400 NPS units (Tier 1, current) growing to ~100,000 POIs (Tier 2+) using Google OR-Tools constrained TSP, a self-hosted OSRM routing engine on the US-only OSM extract, and a Neon PostGIS spatial database. Three-tier build: Tier 1 proves the algorithm with an NPS-only optimal loop covering all 48 contiguous states + D.C. (planned blog post + interactive map); Tier 2 ships a configurable web app on Railway; Tier 3 is a full consumer product with accounts, Amtrak rail routing, a community trip gallery, and presets. Current status: Phase 1 (data ingest) is running live — 466 NPS units in PostGIS with every required state covered. Phases 2–4 (OSRM distance matrix, OR-Tools solver, Folium visualization) are coded and unit-tested (17 passing), pending end-to-end run on the routing host.",
        tools: ["Python 3.11+", "PostGIS / Neon", "Google OR-Tools", "OSRM (self-hosted, US extract)", "Folium", "NPS API", "Census TIGER", "Docker", "FastAPI (planned)"],
        year: "2026",
        thumb: "images/projects/optitrek-thumb.png",
        liveUrl: null,
        repoUrl: "https://github.com/mapzimus/optitrek",
        status: "development"
    }
];

// ===== CATEGORY CONFIG =====
const categories = [
    { key: "all", label: "All" },
    { key: "map", label: "Cartography" },
    { key: "analysis", label: "Spatial Analysis" },
    { key: "web", label: "Web App / Database" },
    { key: "tool", label: "Tools" },
    { key: "remote", label: "Remote Sensing" }
];

const typeLabels = {
    map: "MAP",
    analysis: "ANALYSIS",
    viz: "VIZ",
    web: "WEB / DB",
    tool: "TOOL",
    remote: "REMOTE"
};

const typeClasses = {
    map: "type-map",
    analysis: "type-analysis",
    viz: "type-viz",
    web: "type-web",
    tool: "type-tool",
    remote: "type-remote"
};

const typePlaceholders = {
    map: "\u{1F5FA}",
    analysis: "\u{1F4CA}",
    viz: "\u{1F4C8}",
    web: "\u{1F310}",
    tool: "\u{1F527}",
    remote: "\u{1F6F0}"
};
