// ===== V2 PROJECT DATA =====
// Unified schema — see js/render.js for the card renderer.
// kind: "project" (full card + detail page) | "lab" (creative / in-progress)
// era:  "current" (post-grad, self-directed) | "school" (Salem State MS GIS, 2023-2025)
// tier + order: professional curation (featured / graduate / additional). Home and Work
// derive grids from these fields — do not hardcode slug lists in page controllers.
// visibility: featured | additional | unlisted | mapzimus | archive | lab
// blurb: optional short card copy; summary stays the full case-study lede.
// Paths are SITE-ROOT-relative; render.js resolves them via V2.asset().
window.V2_DATA = window.V2_DATA || {};
window.V2_DATA.projects = [
  {
    "slug": "african-urbanization",
    "tier": "featured",
    "visibility": "featured",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "The Century of Africa",
    "category": "Scrollytelling Map",
    "type": "map",
    "tags": [
      "MapLibre GL JS",
      "Scrollytelling",
      "GeoJSON",
      "UN WPP",
      "GHSL",
      "Python",
      "Kinshasa",
      "Africa"
    ],
    "summary": "A scroll-driven MapLibre tour of Africa's population century: UN projections to 2100, megacities rising past every Western peer, the corridors they will need, and Kinshasa's growth on the ground from GHSL satellite epochs.",
    "description": "Between now and 2100, most of the world's population growth happens on one continent. The Century of Africa is a four-chapter scrollytelling globe with no backend and no tiles — index.html and app.js drive MapLibre over about 2 MB of committed GeoJSON. Chapter 1 steps a country choropleth from 2025 to 2100 to growth multiple, with an SVG regional-totals chart and computed overtaking years (the year an African country's population passes a Western peer on the UN medium variant). Chapter 2 animates every African agglomeration of a million or more by 2050 as proportional circles against New York, Tokyo, Paris, and London on the same scale, with 2100 outlooks drawn as hollow rings and flagged as academic projections. Chapter 3 layers existing Natural Earth rail and roads, financed lines (China's SGR/BRI railways versus the Lobito Corridor, plus the AU Trans-African Highway network), and a gravity model over the top-30 2050 cities sketching demanded corridors. Chapter 4 drops to Kinshasa: GHSL built-up epochs 1975–2030 stacked as growth-vintage rings over the Malebo Pool, with OSM river and roads. A five-script Python pipeline assembles the layers from Natural Earth, UN WPP/WUP, curated corridor projects, JRC GHS-BUILT-S, and Overpass — and the story states its honesty notes up front: medium-variant paths, schematic corridor geometry, and model-derived built footprints.",
    "tools": [
      "MapLibre GL JS",
      "Vanilla JS",
      "GeoJSON",
      "Python",
      "shapely",
      "rasterio",
      "Natural Earth",
      "UN WPP / WUP",
      "JRC GHSL",
      "OpenStreetMap"
    ],
    "year": "2026",
    "thumb": "images/projects/african-urbanization-thumb.jpg",
    "links": {
      "live": "https://mapzimus.com/lab/african-urbanization/",
      "repo": "https://github.com/mapzimus/lab/tree/main/src/lab/african-urbanization"
    },
    "role": "I scoped the four-chapter story, built the Python data pipeline (countries, cities, corridors, Kinshasa GHSL and OSM context), designed the MapLibre globe layers and scroll-driven camera, and wrote the narrative copy and honesty notes that ship with the piece.",
    "outcome": "A self-contained scrollytelling map that walks from continental population change to megacity growth, infrastructure geopolitics, and street-level Kinshasa fabric — live at mapzimus.com/lab with every layer reproducible from open sources.",
    "gallery": [
      {
        "src": "images/projects/african-urbanization/00-hero.jpg",
        "caption": "Opening frame — The Century of Africa on a dark MapLibre globe"
      },
      {
        "src": "images/projects/african-urbanization/01-population-2025.jpg",
        "caption": "2025 choropleth — Africa holds 1.55 billion people, about one in five alive today"
      },
      {
        "src": "images/projects/african-urbanization/02-megacities-2050.jpg",
        "caption": "2050 megacities — Cairo, Luanda, Lagos, and Dar es Salaam against New York and Tokyo"
      },
      {
        "src": "images/projects/african-urbanization/03-corridors.jpg",
        "caption": "Financed corridors — China-backed SGR/BRI lines, Lobito, and the AU highway network"
      },
      {
        "src": "images/projects/african-urbanization/04-kinshasa.jpg",
        "caption": "Kinshasa 2020 — GHSL built-up footprint stacked as growth-vintage rings over the Malebo Pool"
      }
    ],
    "order": 10,
    "blurb": "Scroll-driven MapLibre tour of Africa's population century — megacities, corridors, and Kinshasa from GHSL epochs."
  },
  {
    "slug": "lidar-site-studies",
    "tier": "featured",
    "visibility": "featured",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Lidar Site Studies",
    "category": "Terrain Intelligence",
    "type": "map",
    "tags": [
      "Lidar",
      "Terrain Analysis",
      "GDAL / WhiteboxTools",
      "Earthwork Modeling",
      "MassGIS",
      "Site Selection"
    ],
    "summary": "Planning-level terrain intelligence for wooded Massachusetts land — four public-data case studies that show what bare-earth lidar reveals under the canopy, and what that changes about siting, drainage, access, and earthwork cost.",
    "description": "A camera sees treetops; lidar sees the ground. On wooded parcels that gap decides the budget, because a surface reconstructed from photographs counts the canopy as dirt. Lidar Site Studies is a four-part demonstration built entirely from public Massachusetts lidar, imagery, parcel records, and mapped wetlands, run through one repeatable screen: bare-earth DTM and canopy-surface DSM hillshades, a canopy height model, flow accumulation and a terrain wetness screen, slope and roughness, viewsheds, access-grade road profiles, and cut/fill earthwork against a conceptual pad. Devens compares the modeled ground against the campus that was actually built there, and shows the canopy hiding $5.6M of earthwork that never existed. Middleborough takes flat-looking wooded land and finds terrain wetness the mapped wetland layers miss, leaving 175 of 441 acres through the screen. Hopkinton places the same 16.3-acre pad three ways on one parcel and prices each — the same building lands $2.5M apart on terrain alone, and the ranking holds across the full $10–$40/yd³ unit-cost range. The I-495 corridor study runs every vacant parcel over ten acres within a mile of the highway across nine towns through the same screen: 54 in, 14 out, before anyone flies anything. The site publishes its method, sources, and limits alongside the results, states plainly that these are planning-level comparisons rather than surveys, delineations, or engineering products, and ships a dependency-free validation script and the scoring code that grades the depression and wetness screens against state vernal pool and DEP wetland data.",
    "tools": [
      "MassGIS Lidar",
      "GDAL",
      "WhiteboxTools",
      "Python",
      "Leaflet",
      "GeoJSON",
      "Vanilla JS"
    ],
    "year": "2026",
    "thumb": "images/projects/lidar-site-studies-thumb.jpg",
    "links": {
      "live": "lidar-test/",
      "repo": "https://github.com/mapzimus/ground-truth"
    },
    "role": "I scoped the service concept, assembled the public lidar and parcel data, built the terrain pipeline (hillshades, canopy height, wetness and depression screens, viewsheds, access profiles, cut/fill), ran the four case studies, and designed and wrote the site that presents them.",
    "outcome": "Four studies that turn terrain into a decision: a canopy-driven $5.6M earthwork error caught at Devens, 441 acres screened down to 175 at Middleborough, a $2.5M pad-siting spread at Hopkinton, and a 54-parcel corridor list cut to 14 — all reproducible from free public data.",
    "gallery": [
      {
        "src": "images/projects/lidar-site-studies/canopy-surface.jpg",
        "caption": "Treetop surface — roughly what a camera reconstructs when leaves hide the ground"
      },
      {
        "src": "images/projects/lidar-site-studies/bare-earth.jpg",
        "caption": "Bare-earth lidar of the same parcel — the ridge, the drainage, and the buildable ground appear"
      },
      {
        "src": "images/projects/lidar-site-studies/devens.jpg",
        "caption": "Devens — canopy height model over the parcel later built as the Commonwealth Fusion campus"
      },
      {
        "src": "images/projects/lidar-site-studies/middleborough.jpg",
        "caption": "Middleborough — terrain wetness against mapped wetlands; 175 of 441 acres survive the screen"
      },
      {
        "src": "images/projects/lidar-site-studies/hopkinton-pads.jpg",
        "caption": "Hopkinton — three candidate pads for one building, each priced by modeled earthwork"
      },
      {
        "src": "images/projects/lidar-site-studies/i495-corridor.jpg",
        "caption": "I-495 corridor — 54 screened parcels across nine towns, 14 worth deeper diligence"
      }
    ],
    "order": 20,
    "blurb": "Four public-data case studies on what bare-earth lidar reveals under canopy — and what that changes about siting and earthwork cost."
  },
  {
    "slug": "lynn-absenteeism",
    "tier": "graduate",
    "visibility": "featured",
    "role": "I designed the capstone question, geocoded student addresses, calculated distance bands, ran the statistical analysis in R, and produced the maps and figures.",
    "outcome": "Distance from school showed only a very slight negative correlation with attendance. The result ruled out a simple explanation and demonstrated why a null finding can still be useful.",
    "kind": "project",
    "era": "school",
    "status": "live",
    "title": "Chronic Absenteeism in Lynn Public Schools",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "R",
      "Geocoding",
      "Statistical Analysis",
      "Leaflet"
    ],
    "summary": "Geocoded student addresses and correlated distance from school with chronic absenteeism rates across Lynn, MA — my capstone project for my MS program.",
    "description": "For my capstone project in the MS program (Project Implementation), I tackled the chronic absenteeism problem in Lynn Public Schools. I wanted to know if the distance a student lives from school has any measurable impact on whether they show up. I geocoded student addresses across the district and correlated each student's distance from school with their absenteeism record. I wrote scripts in R to run the analysis, including scatter plots, violin plots, box plots, and distance band breakdowns (0–0.25 mi, 0.25–0.5 mi, 0.5–1 mi, 1–2 mi, 2–3 mi, 3+ mi). The result was an extremely slight negative correlation — distance alone is not a strong predictor of attendance. The project produced a full suite of thematic maps and statistical visualizations.",
    "tools": [
      "R",
      "ggplot2",
      "Geocoding",
      "ArcGIS Pro",
      "Leaflet",
      "Statistical Analysis"
    ],
    "year": "2025",
    "course": "GPH945 — GIS Project Implementation",
    "thumb": "images/projects/lynn-thumb.png",
    "gallery": [
      {
        "src": "images/gallery/lynn-lps-study-area.jpg",
        "caption": "Study area — every Lynn Public Schools site inside the city boundary"
      },
      {
        "src": "images/gallery/lynn-citywide-absenteeism.png",
        "caption": "Citywide absenteeism — each dot a student address, colored by personal absence rate"
      },
      {
        "src": "images/projects/lynn/student-distribution-citywide.png",
        "caption": "Student address distribution (citywide) — bubble size = students per address"
      },
      {
        "src": "images/projects/lynn/student-distribution-zoomed.jpg",
        "caption": "Student addresses near LEHS — 1-mile zoom"
      },
      {
        "src": "images/projects/lynn/Screenshot 2025-04-23 141302.png",
        "caption": "Student density grid — counts per 150 m cell"
      },
      {
        "src": "images/gallery/lynn-kde-heatmap.png",
        "caption": "KDE heatmap of geocoded student addresses"
      },
      {
        "src": "images/projects/lynn/Screenshot 2025-04-23 141901.png",
        "caption": "Absenteeism hotspots (≥20%) around LEHS"
      },
      {
        "src": "images/projects/lynn/Screenshot 2025-04-23 142700.png",
        "caption": "Citywide absenteeism hotspots — 100 m hexbins above 20%"
      },
      {
        "src": "images/projects/lynn/Screenshot 2025-04-23 142537.png",
        "caption": "Close-up dot map — absence rate around Central Square"
      },
      {
        "src": "images/gallery/lynn-absenteeism-by-grade.png",
        "caption": "Absenteeism by grade level — four-panel small multiples (9–12)"
      },
      {
        "src": "images/gallery/lynn-absenteeism-by-ethnicity.png",
        "caption": "Absenteeism by ethnicity — six-panel small multiples"
      },
      {
        "src": "images/gallery/lynn-absenteeism-ml-status.png",
        "caption": "Absenteeism by Multilingual Learner status — ML vs non-ML"
      },
      {
        "src": "images/projects/lynn/absenteeism-sped-status-hexbin.png",
        "caption": "Absenteeism by SPED status — hexbin comparison"
      }
    ],
    "links": {
      "live": "lynn.html"
    },
    "order": 10
  },
  {
    "slug": "salem-pantry",
    "tier": "graduate",
    "visibility": "featured",
    "role": "As part of a graduate team, I helped clean and analyze more than 150,000 client records, map coverage gaps, and compare similar communities across Massachusetts.",
    "outcome": "Our team presented the findings to the Salem Pantry board to support outreach and expansion decisions.",
    "kind": "project",
    "era": "school",
    "title": "Salem Pantry: Mapping Food Access",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "R",
      "Random Forest",
      "Census ACS",
      "Cluster Analysis"
    ],
    "summary": "Analyzed 150,000 rows of client data for the Salem Pantry using R — identified underserved areas and used random forest modeling to find similar populations statewide.",
    "description": "A group project where our team worked with the Salem Pantry, a non-profit food pantry in Salem, MA, to analyze over 150,000 rows of their client data. The goal was to figure out who's using the pantry, where they're coming from, and where the coverage gaps are. We cleaned and organized all the data, then used R with packages like sf, tmap, tidycensus, tigris, randomForest, ranger, caret, leaflet, and ggplot2 to run the analysis. We mapped dry zones — areas with less pantry coverage — and used random forest analysis and statistical regression to identify other parts of Massachusetts with similar socioeconomic profiles (based on census tract data like income, household size, language, and race). The results were presented to the Salem Pantry board to help guide decisions about outreach and potential expansion.",
    "tools": [
      "R",
      "sf",
      "tmap",
      "tidycensus",
      "randomForest",
      "ArcGIS Pro",
      "Census ACS"
    ],
    "year": "2024",
    "course": "GPH953 — Seminar in GIS Applications",
    "groupProject": true,
    "thumb": "images/projects/salem-pantry-thumb.png",
    "gallery": [
      {
        "src": "images/projects/salem-pantry/image2.png",
        "caption": "Salem Pantry Mobile Locations"
      },
      {
        "src": "images/projects/salem-pantry/image8.png",
        "caption": "Pantry-using Households by Cluster"
      },
      {
        "src": "images/projects/salem-pantry/image10.png",
        "caption": "Pantry Users per Census Block Group"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113405.png",
        "caption": "Spatial Analysis Overview"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113509.png",
        "caption": "Coverage Analysis"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113555.png",
        "caption": "Demographic Breakdown"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113627.png",
        "caption": "Random Forest Results"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113700.png",
        "caption": "Statewide Similarity Analysis"
      },
      {
        "src": "images/projects/salem-pantry/Screenshot 2025-05-30 113723.png",
        "caption": "Final Recommendations"
      }
    ],
    "links": {},
    "order": 20
  },
  {
    "slug": "granite-state",
    "kind": "project",
    "era": "school",
    "title": "Growth in the Granite State",
    "category": "Remote Sensing",
    "type": "remote",
    "tags": [
      "Landsat 8/9",
      "Change Detection",
      "TerrSet"
    ],
    "summary": "Change detection analysis of Concord, Manchester, and Nashua using USGS Landsat imagery to identify shifts in urbanization and land cover.",
    "description": "Change detection analysis of Concord, Manchester, and Nashua, NH using USGS Landsat imagery from two different time periods. I used TerrSet to overlay the images on top of each other as a multitemporal composite — one color shows change, another shows no change. The analysis looked for shifts in urbanization, forestation, and potential river changes. True color composites were built using bands 2, 3, and 4, then pansharpened with the 15m panchromatic band. The overlay revealed notable expansion in Concord and Nashua, while Manchester showed a slight population decline. Straightforward remote sensing work using freely available satellite imagery.",
    "tools": [
      "Landsat 8/9",
      "TerrSet",
      "PANSHARPEN",
      "True Color Composites",
      "Multitemporal Analysis"
    ],
    "year": "2024",
    "course": "GPH910 — Digital Image Processing",
    "thumb": "images/projects/granite-state-thumb.jpg",
    "gallery": [
      {
        "src": "images/projects/granite-state/image1.png",
        "caption": "New Hampshire Fall Foliage — Study Area"
      },
      {
        "src": "images/projects/granite-state/image5.png",
        "caption": "Concord — True Color Composite"
      },
      {
        "src": "images/projects/granite-state/image10.jpg",
        "caption": "Concord — Multitemporal Change Detection"
      },
      {
        "src": "images/projects/granite-state/image14.jpg",
        "caption": "Manchester — Change Detection"
      },
      {
        "src": "images/projects/granite-state/image15.jpg",
        "caption": "Nashua — Change Detection"
      },
      {
        "src": "images/projects/granite-state/landsat-imagery-analysis.png",
        "caption": "Landsat Imagery Analysis"
      },
      {
        "src": "images/projects/granite-state/band-composite-comparison.jpg",
        "caption": "Band Composite Comparison"
      },
      {
        "src": "images/projects/granite-state/pansharpened-imagery.jpg",
        "caption": "Pansharpened Imagery"
      },
      {
        "src": "images/projects/granite-state/urban-expansion-results.png",
        "caption": "Urban Expansion Results"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "ev-charging",
    "kind": "project",
    "era": "school",
    "title": "Optimal EV Charging Station Siting",
    "category": "Research",
    "type": "analysis",
    "tags": [
      "GIS-AHP",
      "MCDM",
      "EV Infrastructure",
      "Literature Review"
    ],
    "summary": "Research paper reviewing GIS methods for deploying EV charging stations globally, with a proposed methodology for Massachusetts.",
    "description": "A research project where I reviewed a large body of scientific literature on using GIS to determine optimal locations for EV charging station deployment across the globe. The paper covers the current EV charging landscape in Massachusetts (as of 2025), examines spatial analytical techniques like Kernel Density Estimation, network analysis, and location-allocation models, and proposes my own methodology for how I would approach the siting problem in MA using Multi-Criteria Decision Making frameworks (AHP, fuzzy DEMATEL). The literature review spans studies from cities like Amsterdam, Birmingham UK, Ottawa, and Qingdao. The research also addresses equity — how historically underserved neighborhoods are disproportionately lacking charging infrastructure.",
    "tools": [
      "ArcGIS Pro",
      "GIS-AHP",
      "KDE",
      "Network Analysis",
      "Location-Allocation",
      "Census Data"
    ],
    "year": "2025",
    "course": "GPH904 — GIS Research",
    "thumb": "images/projects/ev-research.png",
    "gallery": [
      {
        "src": "images/projects/ev-research/Slide1.PNG",
        "caption": "Title Slide"
      },
      {
        "src": "images/projects/ev-research/Slide3.PNG",
        "caption": "Research Overview"
      },
      {
        "src": "images/projects/ev-research/Slide5.PNG",
        "caption": "Literature Review"
      },
      {
        "src": "images/projects/ev-research/Slide7.PNG",
        "caption": "Spatial Optimization Techniques"
      },
      {
        "src": "images/projects/ev-research/Slide10.PNG",
        "caption": "Proposed GIS Methodology for MA"
      },
      {
        "src": "images/projects/ev-research/Slide12.PNG",
        "caption": "Equity Analysis"
      },
      {
        "src": "images/projects/ev-research/Slide14.PNG",
        "caption": "Current MA Landscape"
      },
      {
        "src": "images/projects/ev-research/Slide16.PNG",
        "caption": "Conclusions"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "education-wealth",
    "kind": "project",
    "era": "school",
    "title": "Mapping Education and Wealth in Massachusetts",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "ArcGIS Pro",
      "Census ACS",
      "Bivariate"
    ],
    "summary": "Bivariate mapping of Massachusetts municipalities correlating median household income to educational attainment — my first GIS project.",
    "description": "My first GIS project. A bivariate map of Massachusetts at the municipal level, correlating median household income with educational attainment using American Community Survey data. The maps show clear spatial patterns — towns with higher rates of bachelor's degrees consistently line up with higher median incomes, especially in the Greater Boston suburbs. It's a simple concept but it was where I learned the fundamentals of thematic mapping, data classification, and working with census data in ArcGIS Pro.",
    "tools": [
      "ArcGIS Pro",
      "Census ACS Data",
      "MassGIS",
      "Bivariate Mapping"
    ],
    "year": "2024",
    "course": "GPH903 — Introduction to GIS",
    "thumb": "images/projects/education-thumb.png",
    "gallery": [
      {
        "src": "images/projects/education/image11.png",
        "caption": "Study Area — Massachusetts Municipalities"
      },
      {
        "src": "images/projects/education/image15.png",
        "caption": "% Population with at Least a Bachelor's Degree"
      },
      {
        "src": "images/projects/education/image20.png",
        "caption": "Median Household Income by Municipality"
      },
      {
        "src": "images/projects/education/image25.png",
        "caption": "Bivariate Map — Master's Degree vs. Income"
      },
      {
        "src": "images/projects/education/image26.png",
        "caption": "Bivariate Map — PhD vs. Income"
      },
      {
        "src": "images/projects/education/image27.png",
        "caption": "Scatter Plot — % No High School vs. Income"
      },
      {
        "src": "images/projects/education/image28.png",
        "caption": "Scatter Plot — % High School vs. Income"
      },
      {
        "src": "images/projects/education/image30.png",
        "caption": "Scatter Plot — % Bachelor's vs. Income"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "central-campus",
    "kind": "project",
    "era": "school",
    "title": "Central Campus Mapping",
    "category": "Cartography",
    "type": "map",
    "tags": [
      "ArcGIS Pro",
      "CAD",
      "Drone Imagery",
      "Trimble GPS"
    ],
    "summary": "Surveying project combining CAD files, drone imagery, and Trimble GPS ground verification of Salem State University's central campus.",
    "description": "A surveying and GIS project for Salem State University's central campus. We captured drone imagery of the campus, then overlayed CAD files on top of the aerial photos. Everything was verified on the ground using Trimble GPS devices. The final product is a detailed campus map built from the integration of CAD data, UAV imagery, and GPS ground-truthing — combining traditional surveying methods with modern geospatial technology.",
    "tools": [
      "ArcGIS Pro",
      "CAD",
      "UAV / Drone Imagery",
      "Trimble GPS",
      "Georeferencing"
    ],
    "year": "2024",
    "course": "GPH946 — Computer Cartography",
    "groupProject": true,
    "thumb": "images/projects/central-campus-thumb.jpg",
    "gallery": [
      {
        "src": "images/projects/central-campus/Screenshot 2025-05-30 114432.png",
        "caption": "CAD Utility As-Built Drawing"
      },
      {
        "src": "images/projects/central-campus/drone-orthomosaic.jpg",
        "caption": "Drone Orthomosaic — Central Campus"
      },
      {
        "src": "images/projects/central-campus/drone-arcgis-overlay.png",
        "caption": "Drone Imagery Overlaid in ArcGIS Pro"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "lynnfield-cemetery",
    "kind": "project",
    "era": "school",
    "title": "Lynnfield Cemetery Spatial Database",
    "category": "Database Design",
    "type": "web",
    "tags": [
      "SQL",
      "ArcGIS Pro",
      "Database Design"
    ],
    "summary": "Spatial database for the cemeteries in Lynnfield, MA — digitizing ~4,000 grave cards and ~1,000 lot cards into a queryable GIS system.",
    "description": "Built a spatial database for the Town of Lynnfield's two cemeteries: Forest Hill Cemetery and Willow Cemetery. The town had approximately 4,000 grave cards and 1,000 lot cards in binders that needed to be digitized and made searchable. I designed a SQL database schema to hold burial records, lot ownership, veteran grave data, and deed associations, then linked everything to spatial features in ArcGIS Pro. Historical cemetery maps were georeferenced and digitized. The system replaced paper binders with a queryable GIS database that cemetery staff can actually use to look up and manage plot information.",
    "tools": [
      "SQL",
      "ArcGIS Pro",
      "Geodatabase Design",
      "Georeferencing",
      "OCR"
    ],
    "year": "2024",
    "course": "GPH952 — Spatial Database Design & Analysis",
    "groupProject": true,
    "thumb": "images/projects/lynnfield/CemMap.jpg",
    "gallery": [
      {
        "src": "images/projects/lynnfield/CemMap.jpg",
        "caption": "Lynnfield, MA Cemeteries Overview"
      },
      {
        "src": "images/projects/lynnfield/Screenshot 2025-05-30 115155.png",
        "caption": "Database and Spatial Features in ArcGIS Pro"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "evacuation-routes",
    "kind": "project",
    "era": "school",
    "title": "Emergency Evacuation Route Planning",
    "category": "Web App",
    "type": "web",
    "tags": [
      "Python",
      "arcpy",
      "FEMA",
      "Network Analysis"
    ],
    "summary": "Python-based route planning tool using FEMA flood data to identify evacuation routes in Salem, MA.",
    "description": "Used arcpy to build a route planning tool that looked at FEMA flood water sea-rise data overlayed over Salem, MA. The idea was to reroute someone evacuating Salem in a flood scenario where certain roads couldn't be used. Roads with higher traffic volumes and greater flood risk received higher impedance weights in the network analysis, making them less favorable. The output visualizes the safest and most dangerous evacuation routes from a given starting point.",
    "tools": [
      "Python",
      "arcpy",
      "ArcGIS Pro",
      "MassGIS",
      "FEMA Flood Data",
      "Network Analysis"
    ],
    "year": "2024",
    "course": "GPH960 — Software Design & Programming in GIS",
    "thumb": "images/projects/evacuation-thumb.jpg",
    "gallery": [
      {
        "src": "images/projects/evacuation/flood-zone-traffic-network.jpg",
        "caption": "Flood Zone & Traffic Network Analysis"
      },
      {
        "src": "images/projects/evacuation/Screenshot 2025-05-30 114112.png",
        "caption": "arcpy Evacuation Route Script"
      }
    ],
    "links": {},
    "visibility": "archive"
  },
  {
    "slug": "appalachians",
    "tier": "additional",
    "visibility": "additional",
    "role": "I assembled and simplified the physiographic, trail, summit, and geology data, then designed and built the mobile-first MapLibre application.",
    "outcome": "The finished explorer connects the range's physical geography with its geology in one keyless, shareable web map.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "The Appalachians — Regions Explorer",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "MapLibre GL JS",
      "GeoJSON",
      "USGS Physiography",
      "Appalachian Trail",
      "Geology"
    ],
    "summary": "Interactive map of the entire Appalachian range, Georgia to Newfoundland — its geologic regions, named ranges, summits, and both the Appalachian and International Appalachian Trails. Tap any region or range for its geology, formative orogeny, and highest peak.",
    "description": "An interactive map of the whole Appalachian system, from the Great Smoky Mountains in the south to the Long Range Mountains of Newfoundland in the north. The U.S. regions — Blue Ridge, Ridge & Valley, the Appalachian Plateau, the New England Upland, the Adirondacks, and the Piedmont — are dissolved straight from the USGS Physiographic Divisions (Fenneman & Johnson, 1946); the Canadian Appalachians (Gaspé/Chic-Chocs, the Maritimes, and the Newfoundland Long Range) extend the range across the border. On top sit named ranges (Great Smokies, Shenandoah, Catskills, White Mountains, Chic-Chocs, Cape Breton Highlands and more), notable summits from Mount Mitchell to Gros Morne, and the full Appalachian Trail plus its Canadian continuation, the International Appalachian Trail. Tap a region or range for its dominant rock, age, the orogeny that built it (Grenville, Taconic, Acadian, or Alleghanian), and its highest summit. Six keyless basemaps, a layers panel with per-layer opacity, place search, a measure tool, 3D terrain, and shareable view links. Mobile-first, built as a single self-contained MapLibre page with static GeoJSON — no build step, no API keys.",
    "tools": [
      "MapLibre GL JS",
      "OpenFreeMap",
      "Esri",
      "USGS Physiographic Divisions",
      "NPS Appalachian Trail",
      "mapshaper",
      "GeoJSON"
    ],
    "year": "2026",
    "thumb": "images/projects/appalachians-thumb.png",
    "gallery": [
      {
        "src": "images/projects/appalachians/full-range.png",
        "caption": "The entire range, Georgia to Newfoundland — fourteen geologic regions, major peaks, the Appalachian Trail, and the International Appalachian Trail into Canada"
      },
      {
        "src": "images/projects/appalachians/formation.png",
        "caption": "Formation view — regions recolored by the orogeny that built them, from Grenville basement (~1.1 Ga) to the Alleghanian collision (~300 Ma)"
      },
      {
        "src": "images/projects/appalachians/overview.png",
        "caption": "Full interface — basemaps, layer controls, search, and a clickable legend"
      },
      {
        "src": "images/projects/appalachians/region-card.png",
        "caption": "Tap a region for its geology, formative orogeny, and highest summit"
      },
      {
        "src": "images/projects/appalachians/mobile.png",
        "caption": "Mobile layout — bottom-sheet detail cards and a touch-friendly toolbar"
      },
      {
        "src": "images/projects/figures/appalachians-live.jpg",
        "caption": "Live explorer UI — geologic regions, trails, and mobile-ready layer controls"
      }
    ],
    "links": {
      "live": "appalachians/"
    },
    "order": 10
  },
  {
    "slug": "quabbin",
    "tier": "featured",
    "visibility": "featured",
    "role": "I designed the study, sourced the historical and modern spatial data, built the reproducible R pipeline, and developed the interactive LiDAR explorer.",
    "outcome": "One documented pipeline now regenerates the maps, figures, animation, and web layers while making the surviving landscape evidence readable to a general audience.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "The Quabbin Reservoir and the Lost Towns of the Swift River Valley",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "R",
      "sf",
      "terra",
      "DEM / Hillshade",
      "LiDAR",
      "Leaflet",
      "OpenStreetMap",
      "USGS WBD",
      "Census TIGER",
      "US Census 1920",
      "USGS historical topo",
      "MassGIS LiDAR"
    ],
    "summary": "A reproducible, multi-layer R GIS study of the Quabbin Reservoir and the four Swift River Valley towns (Dana, Enfield, Greenwich, Prescott) disincorporated in 1938 to supply metropolitan Boston. The centerpiece is an interactive LiDAR imprint explorer — the drowned villages' street plans and cellar holes are still readable in 1 m bare-earth LiDAR on the land the water spared — alongside twenty figures: terrain, watershed, decennial census population, a valley cross-section, the aqueduct to Boston, and a schematic reservoir-filling animation. One R pipeline renders it all from open data.",
    "description": "A multi-layer GIS study of how the Quabbin Reservoir was sited and what it replaced, built in R as a reproducible pipeline and shipped with its full analysis code. Between 1938 and 1946 Massachusetts dammed and flooded the Swift River Valley, disincorporating four towns — Dana, Enfield, Greenwich, and Prescott — and relocating about 2,500 residents to supply metropolitan Boston, roughly 105 km east. The pipeline pulls a DEM from AWS Terrain Tiles (elevatr), reprojects it to Massachusetts State Plane and hillshades it with terra; derives the reservoir from MassGIS LiDAR, which resolves the dams and keeps the water contained; adds USGS Watershed Boundary Dataset units for drainage context and US Census TIGER municipalities showing how the former town land is now divided among the surrounding towns. It also assembles decennial US Census counts (1900–1920) for all four towns; a schematic animation of the reservoir filling in equal-area stages to the 1946 full pool (a synthetic basin — modern DEMs capture only today's water surface, not the drowned valley floor); a west-east valley cross-section; a documented 'by the numbers' summary; a 3D terrain view; the aqueduct route carrying the water east to Boston; and MassGIS 1 m bare-earth LiDAR of Dana Common and the Prescott Peninsula, the areas that stayed above water, where the old roads, house lots and cellar holes are still imprinted in the ground — a Local Relief Model makes them readable, ground-truthed against the 1893 USGS survey. These come together in the interactive LiDAR imprint explorer: a full-reservoir 'LiDAR relief' layer for hunting the drowned villages' street plans, with auto-traced roads and walls, the 1893 quadrangle as a fade overlay, an adjustable pool level, per-town census popups, and the aqueduct route. Every layer comes from open data, each network fetch falls back to a documented default if a service is unavailable, and a single `Rscript run_all.R` regenerates the figures, the animation, and the GeoJSON the explorer consumes.",
    "tools": [
      "R",
      "sf",
      "terra",
      "elevatr",
      "osmdata",
      "tigris",
      "ggplot2",
      "Leaflet",
      "ImageMagick",
      "GDAL"
    ],
    "year": "2026",
    "thumb": "images/projects/quabbin/08_hero.png",
    "gallery": [
      {
        "src": "images/projects/quabbin/08_hero.png",
        "caption": "Hero map — Quabbin Reservoir terrain with the four former Swift River Valley towns"
      },
      {
        "src": "images/projects/quabbin/01_locator.png",
        "caption": "Locator — the Swift River Valley within Massachusetts"
      },
      {
        "src": "images/projects/quabbin/03_reservoir_towns.png",
        "caption": "Four towns under the water — Dana, Enfield, Greenwich & Prescott"
      },
      {
        "src": "images/projects/quabbin/07_population_decline.png",
        "caption": "Four towns, steadily emptying — decennial census, 1900–1920"
      },
      {
        "src": "images/projects/quabbin/10_aqueduct.png",
        "caption": "The aqueduct carrying the water ~105 km east to Boston"
      },
      {
        "src": "images/projects/quabbin/14_dana_lidar.jpg",
        "caption": "Dana Common — 1 m bare-earth LiDAR where streets and cellar holes remain above the pool"
      },
      {
        "src": "images/projects/quabbin/15_prescott_lidar.jpg",
        "caption": "Prescott Peninsula — LiDAR imprint of the drowned village street plan"
      },
      {
        "src": "images/projects/quabbin/24_prescott_survey.jpg",
        "caption": "Prescott survey panel — historical street plan ground-truthed against LiDAR relief"
      },
      {
        "src": "images/projects/quabbin/quabbin_floodfill.gif",
        "caption": "Animation — schematic reservoir filling to the 1946 full pool"
      }
    ],
    "links": {
      "live": "quabbin.html",
      "repo": "https://github.com/mapzimus/maxwellhowegis/tree/main/quabbin"
    },
    "order": 40,
    "blurb": "Reproducible R GIS study of the Quabbin Reservoir and four lost Swift River Valley towns, with a LiDAR imprint explorer of the drowned villages."
  },
  {
    "slug": "ma-atlas",
    "tier": "featured",
    "visibility": "featured",
    "role": "I built the academic-district polygons, joined the statewide education and demographic data, and designed the MapLibre interface and classification controls.",
    "outcome": "The atlas provides one interactive view of Massachusetts schools, districts, finance, outcomes, and community context across more than 40 joined measures.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Massachusetts Education Atlas",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "MapLibre GL JS",
      "Vector Tiles",
      "MassGIS",
      "MA DESE",
      "Choropleth",
      "Jenks"
    ],
    "summary": "Statewide interactive web map of every public school and school district in Massachusetts. 351 municipalities, 274 academic districts, 78 charters, 26 regional vocational, 1,700 schools — 40+ joined education and demographic metrics, ArcGIS-style layer panel, palette + classification controls, hover + sticky side panel.",
    "description": "MassGIS publishes charter, vocational, collaborative, and historic-union boundaries, but not the standard town and regional academic districts needed for this map. I built 274 academic district polygons by joining the public-schools point data to municipalities and dissolving towns by their dominant district code. Academic, vocational, and charter districts overlap, so the interface keeps them as independent layers. More than 40 joined measures cover demographics, MCAS, graduation, postsecondary plans, finance, and teacher workforce, with selectable classification and palette controls.",
    "tools": [
      "MapLibre GL JS",
      "OpenFreeMap (vector tiles)",
      "MassGIS",
      "MA DESE E2C Hub",
      "US Census ACS",
      "GeoPandas",
      "Pure JavaScript"
    ],
    "year": "2026",
    "thumb": "images/projects/ma-atlas-preview.png",
    "gallery": [
      {
        "src": "images/projects/figures/ma-atlas-live.jpg",
        "caption": "Live atlas interface — layer panel, classification controls, and sticky detail panel"
      },
      {
        "src": "images/projects/ma-atlas/high-needs.jpg",
        "caption": "% High Needs by town — one of 380+ mapped metrics, Fisher-Jenks natural breaks"
      },
      {
        "src": "images/projects/ma-atlas/graduation-4yr.jpg",
        "caption": "Four-year graduation rate by town"
      },
      {
        "src": "images/projects/ma-atlas/mcas-gr10-ela.jpg",
        "caption": "MCAS Grade 10 ELA — % meeting or exceeding expectations"
      },
      {
        "src": "images/projects/ma-atlas/per-pupil-spending.jpg",
        "caption": "Per-pupil spending by school district (Viridis ramp)"
      },
      {
        "src": "images/projects/ma-atlas/english-learner.jpg",
        "caption": "% English learners by town"
      },
      {
        "src": "images/projects/ma-atlas/college-plans.jpg",
        "caption": "% planning to attend college, rendered on the academic-district polygons"
      }
    ],
    "links": {
      "live": "ma-atlas/",
      "repo": "https://github.com/mapzimus/maxwellhowegis"
    },
    "order": 30,
    "blurb": "Statewide interactive map of every public school and district in Massachusetts — 40+ metrics with ArcGIS-style controls."
  },
  {
    "slug": "geopuesto",
    "tier": "featured",
    "visibility": "featured",
    "role": "I designed the spherical-geometry calculations, integrated the public data services, and built the responsive Leaflet interface.",
    "outcome": "A simple antipode calculator became a working geographic discovery product with live environmental, cultural, and transportation context.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Geopuesto",
    "category": "Web App",
    "type": "tool",
    "tags": [
      "JavaScript",
      "Leaflet",
      "Antipodes",
      "Spherical Geometry",
      "Real-time APIs"
    ],
    "summary": "Antipodal observation system — click anywhere on Earth and see what's on the exact opposite side. Live weather, recent earthquakes, satellites overhead, internet radio playing right now, ISS position, Mapillary photos, and 15+ more data layers. Plus 'Your Personal Equator' — the great circle of cities exactly equidistant from you and your antipode.",
    "description": "Geopuesto started as a one-line antipode calculator and grew into a full-screen geographic discovery tool. A map click, coordinate, search, or current location produces the antipode and adds context from public services: reference material, imagery, weather, air quality, daylight, earthquakes, volcanoes, aircraft, vessels, satellites, radio, and street-level photos. The Personal Equator module draws the great circle perpendicular to the antipodal axis and finds cities that are approximately equidistant from the selected point and its antipode — for Salem, MA that ring samples a 33,000-city dataset down to population centers within 100 km of the equator. A sibling Playground lab exposes the spherical-geometry kernel: two-point orthodromes, polyhedra on the sphere, and curve suites.",
    "tools": [
      "JavaScript",
      "Leaflet",
      "GeoNames",
      "Open-Meteo",
      "NOAA",
      "USGS",
      "OpenSky",
      "AISStream",
      "Mapillary",
      "Sentinel-2 (CDSE)",
      "GitHub Pages"
    ],
    "year": "2025–2026",
    "thumb": "images/projects/geopuesto-thumb.png",
    "links": {
      "live": "geopuesto/",
      "repo": "https://github.com/mapzimus/geopuesto"
    },
    "gallery": [
      {
        "src": "images/projects/figures/geopuesto-overview.jpg",
        "caption": "Landing view — dual-origin/target globe with quick-pick antipodal city pairs"
      },
      {
        "src": "images/projects/figures/geopuesto-active.jpg",
        "caption": "Active observation — Wellington selected; origin and antipode coordinates locked with swap controls"
      },
      {
        "src": "images/gallery/salem-antipodal-ring.png",
        "caption": "Salem's Personal Equator — great-circle ring of cities equidistant from Salem and its Indian Ocean antipode"
      },
      {
        "src": "images/projects/geopuesto-thumb.png",
        "caption": "Earlier interface state with split origin/target map panels"
      }
    ],
    "order": 60,
    "blurb": "Antipodal observation system — click anywhere on Earth and see what's on the opposite side, with weather, quakes, radio, and more."
  },
  {
    "slug": "lynn-data-dive",
    "tier": "featured",
    "visibility": "featured",
    "role": "I joined Massachusetts education, Census, environmental, and community datasets and built the Python dashboard and comparison tools.",
    "outcome": "The dashboard replaces a scattered set of public sources with one place to explore Lynn English and comparable Gateway City schools.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Lynn Data Dive",
    "category": "Web App",
    "type": "viz",
    "tags": [
      "Streamlit",
      "Python",
      "Plotly",
      "MA DESE",
      "Census ACS",
      "Education Data"
    ],
    "summary": "Interactive public dashboard integrating every public dataset that touches Lynn English High School and the 26 MA Gateway Cities. MCAS, enrollment, ELL pipeline, graduation, college outcomes, finance, teacher workforce, discipline, community context, maps, and cross-domain correlation analysis — in one place.",
    "description": "DESE publishes Lynn English data across half a dozen separate Power BI dashboards, statewide bulk downloads, and federal datasets — none of which are joined. The Lynn Data Dive integrates every relevant public source (MA DESE E2C Hub's 22 datasets, US Census ACS, MassGIS, EPA EJScreen, NCES) into a single Streamlit app, then adds a cross-domain Correlation Lab that lets you pick any two metrics and see how they relate across the 26 Gateway City high schools. Sections include School Profile, Academic Performance (MCAS with full E/M/PM/NM distribution), ELL Pipeline (the central narrative thread — Lynn English is ~42% ELL), College & Career Readiness, Success After HS, Teachers & Workforce, Finance, Discipline & Climate, Community Context, Lynn District & Sibling Schools (LEHS vs Lynn Classical, Lynn Tech, etc.), Gateway Peer Comparison, and a Maps section with four tabs (Lynn Schools, Lynn Demographics with tract-level Census ACS, MA Statewide Districts, Gateway Cities). A Catchment Research page embeds the privacy-safe aggregated outputs of the prior chronic absenteeism capstone. The whole pipeline is reproducible — when DESE releases new data each fall, a single refresh command pulls everything and the dashboard auto-redeploys.",
    "tools": [
      "Python",
      "Streamlit",
      "Plotly",
      "Pandas",
      "GeoPandas",
      "MA DESE E2C Hub",
      "US Census ACS",
      "MassGIS"
    ],
    "year": "2026",
    "thumb": "images/projects/lynn-data-dive-thumb.png",
    "links": {
      "live": "/lynndata/"
    },
    "gallery": [
      {
        "src": "images/projects/figures/lynn-data-dive-dashboard.jpg",
        "caption": "Dashboard home — nested School / District / City entry points with headline enrollment and ELL rates"
      },
      {
        "src": "images/projects/figures/lynn-data-dive-maps.jpg",
        "caption": "Lynn Maps — municipality choropleth for % English Learner with every Lynn school pinned"
      },
      {
        "src": "images/projects/lynn-data-dive-thumb.png",
        "caption": "Map explorer with Jenks classification, year animation, and dual-metric comparison controls"
      }
    ],
    "order": 70,
    "blurb": "Public dashboard of every dataset touching Lynn English High School and the 26 MA Gateway Cities — maps, outcomes, and correlations."
  },
  {
    "slug": "geopuesto-playground",
    "tier": "lab",
    "visibility": "mapzimus",
    "kind": "project",
    "era": "current",
    "status": "development",
    "title": "Geopuesto Playground",
    "category": "Web App",
    "type": "tool",
    "tags": [
      "JavaScript",
      "Spherical Geometry",
      "Polyhedra",
      "Geomates",
      "Curves Suite",
      "Sandbox"
    ],
    "summary": "Research-grade sandbox for spherical geometry on Earth's surface. Two-Point Mode (A→B great circle + the four named equidistant points), Polyhedra Suite (Platonic + Archimedean solids wrapped on a sphere with a spin slider), Curves Suite (loxodromes, small-circles-at-distance-d, Fibonacci spheres, geodesics), and the 'Geomates' midpoint pair — the IP showcase.",
    "description": "Geopuesto's sibling app: stripped, instrument-style interface focused on the underlying geometry. Two-Point Mode lets you pick A and B and renders the great-circle (orthodrome), perpendicular bisector, and four named equidistant points (M = midpoint of A→B arc, −M = its antipode, n = north pole of the A–B great circle, −n = its south pole). The 'Geomate' pair (M, −M) is a paired-discovery feature: two surface points each exactly equidistant from A and from B, computed without iteration. Polyhedra Suite wraps Platonic solids (tetra/cube/octa/icosa/dodeca), Archimedean ones (cuboctahedron, truncated icosahedron a.k.a. the soccer ball / C60), and special cases (rhombic triacontahedron, Stella Octangula, geodesic, n-prism / n-antiprism, Fibonacci sphere — 6 to 1000 points) around the sphere with vertex 0 anchored at any point and a 0–360° spin slider that rotates the wireframe in real time. Curves Suite ships small-circle-at-distance-d (the locus of points exactly d km from anchor — a 'ring of cities at d km from here'), loxodromes (constant-bearing rhumb lines, intersected against small circles), with isoazimuthal curves and portolan windroses on deck. Cross-track / along-track / Voronoi readouts. Share-link state encoding (A, B, anchor, shape, spinDeg restore from URL hash) and GeoJSON export of the current configuration.",
    "tools": [
      "JavaScript",
      "Leaflet",
      "Pure-JS spherical math kernel",
      "Three.js–free",
      "GitHub Pages"
    ],
    "year": "2026",
    "thumb": "images/projects/playground-thumb.svg",
    "gallery": [
      {
        "src": "images/gallery/salem-antipodal-ring.png",
        "caption": "Antipodal ring around Salem, MA — every point matched to its exact opposite on the globe (Two-Point / equidistant geometry)"
      }
    ],
    "links": {
      "live": "geopuesto/playground/",
      "repo": "https://github.com/mapzimus/geopuesto"
    }
  },
  {
    "slug": "tappymaps",
    "visibility": "additional",
    "role": "I designed and built the browser-native map editor, export workflow, and supporting map games as an independent product.",
    "outcome": "TappyMaps gives non-GIS users a lightweight way to color, label, and export U.S. state and county maps without desktop software.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "TappyMaps",
    "category": "Web App",
    "type": "tool",
    "tags": [
      "JavaScript",
      "Map Design",
      "Geography Games",
      "GIS App"
    ],
    "summary": "A web-based GIS application for map design — drag, color, and export custom maps. Includes geography games and a sharing gallery. Live at tappymaps.com.",
    "description": "TappyMaps is a browser-native map design and geography-games suite for the United States. The designer lets anyone tap states or counties, build a legend, and export a finished map without desktop GIS software. Companion games — Find the State, Stat Duel, and GeoDraft — turn the same geography into short classroom-friendly challenges. A sharing gallery collects finished cards so maps can travel beyond the editor. Built as an independent product under the Mapparatus umbrella and live at tappymaps.com.",
    "tools": [
      "JavaScript",
      "GeoJSON",
      "Canvas API",
      "Web APIs"
    ],
    "year": "2025–2026",
    "thumb": "images/projects/tappymaps-logo.png",
    "gallery": [
      {
        "src": "images/projects/figures/tappymaps-home.jpg",
        "caption": "tappymaps.com home — Create a map and Play games entry points over a colored US base"
      },
      {
        "src": "images/gallery/tappymaps-uninsured-rate.png",
        "caption": "Demo card — US uninsured rate by state (5 quantile bins, 2023 Census), rendered as a shareable TappyMaps card"
      },
      {
        "src": "images/gallery/us-states.jpg",
        "caption": "Contiguous United States reference map — labeled states with neatline, north arrow, and scale"
      },
      {
        "src": "images/gallery/us-capitals.jpg",
        "caption": "US capitals reference map produced with the same cartographic toolkit"
      }
    ],
    "links": {
      "live": "https://tappymaps.com"
    },
    "tier": "additional",
    "order": 30
  },
  {
    "slug": "optitrek",
    "tier": "additional",
    "visibility": "additional",
    "kind": "project",
    "era": "current",
    "status": "development",
    "title": "Optitrek",
    "category": "Spatial Analysis",
    "type": "tool",
    "tags": [
      "Python",
      "OR-Tools",
      "PostGIS",
      "OSRM",
      "Constrained TSP",
      "In Development"
    ],
    "summary": "An algorithmic U.S. road-trip optimizer using a 400-plus-place National Park Service candidate pool, constrained TSP methods, and self-hosted OSRM routing. The data layer is complete; solver work is ongoing.",
    "description": "Optitrek is an algorithmic road-trip optimizer for the United States. It takes the 2015 Randal Olson 'optimal US road trip' — 50 hand-picked stops, genetic algorithm, Google Maps API — and rebuilds it with 2026 tools. Instead of just ordering hand-picked stops, Optitrek solves both the selection AND the ordering across ~400 NPS units (Tier 1, current) growing to ~100,000 POIs (Tier 2+) using Google OR-Tools constrained TSP, a self-hosted OSRM routing engine on the US-only OSM extract, and a Neon PostGIS spatial database. Three-tier build: Tier 1 proves the algorithm with an NPS-only optimal loop covering all 48 contiguous states + D.C. (planned blog post + interactive map); Tier 2 ships a configurable web app on Railway; Tier 3 is a full consumer product with accounts, Amtrak rail routing, a community trip gallery, and presets. Current status: Phase 1 (data ingest) is running live — 466 NPS units in PostGIS with every required state covered. Phases 2–4 (OSRM distance matrix, OR-Tools solver, Folium visualization) are coded and unit-tested (17 passing), pending end-to-end run on the routing host. First published test case: the Sequential Interstate Challenge — drive every two-digit Interstate end to end — where letting the solver pick segment order and direction cut connector driving time 86% versus strict numerical order (73,360 minutes down to 10,277).",
    "tools": [
      "Python 3.11+",
      "PostGIS / Neon",
      "Google OR-Tools",
      "OSRM (self-hosted, US extract)",
      "Folium",
      "NPS API",
      "Census TIGER",
      "Docker",
      "FastAPI (planned)"
    ],
    "year": "2026",
    "thumb": "images/projects/optitrek-thumb.jpg",
    "gallery": [
      {
        "src": "images/gallery/optitrek-olson-diff.jpg",
        "caption": "Olson 2015 vs OR-Tools 2026 — same 50 landmarks and distance matrix; the new solver shaves ~2.3 hours (44 of 50 edges agree)"
      },
      {
        "src": "images/gallery/optitrek-route-overlay.png",
        "caption": "Four-way route overlay — Olson 2015, OR-Tools capped, uncapped, and the OSRM-routed variant on the same 50 stops"
      },
      {
        "src": "images/gallery/optitrek-osrm-proof.png",
        "caption": "OSRM Western Parks proof — 8 parks, 2,800 mi over 8 legs, routed against a self-hosted US OSRM extract"
      },
      {
        "src": "images/projects/figures/interstate-challenge-live.jpg",
        "caption": "Sequential Interstate Challenge — interactive A-vs-B map comparing numerical order against the Optitrek-optimized route"
      }
    ],
    "links": {
      "repo": "https://github.com/mapzimus/optitrek"
    },
    "role": "I designed the optimization problem, built the PostGIS + OSRM data layer, implemented the OR-Tools constrained TSP solvers, and published the Sequential Interstate Challenge as the first public test case.",
    "outcome": "Phase 1 data ingest is live with 466 NPS units in PostGIS. Solver phases are unit-tested, and the Interstate Challenge test case cut connector driving time 86% versus strict numerical order (73,360 minutes down to 10,277).",
    "order": 20
  },
  {
    "slug": "transit",
    "tier": "lab",
    "visibility": "mapzimus",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "US Fantasy Transit Network",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "Python",
      "Leaflet",
      "Census Data",
      "Generative"
    ],
    "summary": "An \"unlimited funds\" transit network for North America, generated end-to-end from Census data: a four-tier hierarchy of HSR hubs, regional mesh, organic metro systems, and a commuter web linking all 33,288 towns.",
    "description": "What would American transit look like with unlimited funds? This app answers algorithmically: a four-tier North American network — 135 high-speed-rail hubs on a continental spine, 2,266 regional hubs in a connecting mesh, 1,195 organic metro systems grown around big cities (which split into boroughs and districts, each anchoring its own metro), and a ~43,000-link commuter web that guarantees every one of 33,288 Census towns connects to at least two neighbors. The whole network is generated end-to-end by Python-stdlib scripts from Census data, then served as static GeoJSON to a read-only Leaflet viewer with canvas rendering for the dense layers.",
    "tools": [
      "Python",
      "Leaflet",
      "Canvas",
      "US Census",
      "GeoJSON"
    ],
    "year": "2026",
    "thumb": "images/projects/transit-thumb.png",
    "links": {
      "live": "transit/"
    }
  },
  {
    "slug": "interstate-challenge",
    "tier": "lab",
    "visibility": "mapzimus",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "The Sequential Interstate Challenge",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "MapLibre GL JS",
      "OSRM",
      "Route Optimization",
      "Optitrek"
    ],
    "summary": "Drive every two-digit Interstate end to end — comparing strict numerical order against an optimized order and orientation that minimizes connector drive time. An Optitrek test case with an interactive A-vs-B map.",
    "description": "A road-trip thought experiment turned optimization problem: drive every two-digit Interstate highway end to end. Version A follows strict numerical order (I-4, I-5, I-8...). Version B lets the Optitrek solver pick both the order and the direction of each traversal to minimize the connector driving between segment ends. The build pipeline geocodes every Interstate endpoint, computes an OSRM connector matrix, and runs dynamic-programming and local-search solvers, publishing static GeoJSON to an interactive MapLibre comparison map with the headline time and distance saved.",
    "tools": [
      "MapLibre GL JS",
      "Python",
      "OSRM",
      "Nominatim",
      "GeoJSON"
    ],
    "year": "2026",
    "links": {
      "live": "interstate-challenge/"
    }
  },
  {
    "slug": "pockettiles",
    "tier": "additional",
    "visibility": "unlisted",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "PocketTiles Studio",
    "category": "Web App",
    "type": "tool",
    "role": "I designed and built the whole pipeline — drawing, tiling, compression, and a custom in-browser PMTiles writer.",
    "outcome": "GeoJSON becomes a shareable, streaming vector-tile map without a tile server — the archive is assembled entirely in the browser.",
    "tags": [
      "PMTiles",
      "MapLibre GL JS",
      "Vector Tiles",
      "In-Browser"
    ],
    "summary": "Draw or import GeoJSON, bake a PMTiles vector-tile archive entirely in your browser, and share a streaming URL — no tile server, nothing uploaded during tiling.",
    "description": "PocketTiles Studio turns GeoJSON into a PMTiles v3 vector-tile archive without any server: drawing via Terra Draw, tiling via geojson-vt and vt-pbf, gzip via the browser CompressionStream API, and a custom in-browser PMTiles writer assembling the archive — the novel core of the app. Optionally publish the archive to storage for a shareable streaming map URL.",
    "tools": [
      "MapLibre GL JS",
      "Terra Draw",
      "geojson-vt",
      "vt-pbf",
      "PMTiles",
      "Supabase"
    ],
    "year": "2026",
    "links": {
      "live": "pockettiles/"
    }
  },
  {
    "slug": "salem-photo-walk",
    "tier": "additional",
    "visibility": "unlisted",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Salem Photography Walks",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "Leaflet",
      "Isochrones",
      "Valhalla",
      "Education"
    ],
    "summary": "A Leaflet map of walkable photography spots around Collins Middle School in Salem — categorized locations, walk-time readouts, and 5/10/15-minute pedestrian walk-shed isochrones. Built for a LEAP summer enrichment program.",
    "description": "Built for the \"Nature & Urban Photography in Salem\" enrichment program (LEAP for Education, Summer 2026): an interactive map of photography spots within walking distance of Collins Middle School. Spots are categorized (nature, architecture, waterfront, street), each with walk-time readouts, and a 5/10/15-minute pedestrian isochrone overlay computed with the FOSSGIS Valhalla routing API shows exactly how far a class can roam in a session.",
    "tools": [
      "Leaflet",
      "Valhalla",
      "Tabler Icons"
    ],
    "year": "2026",
    "links": {
      "live": "salem-photo-walk/"
    }
  },
  {
    "slug": "ebay-packages",
    "tier": "featured",
    "visibility": "featured",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "North Shore Nostalgia Sales Atlas",
    "category": "Spatial Business Analysis",
    "type": "map",
    "tags": [
      "MapLibre",
      "Globe Maps",
      "Python",
      "Geocoding",
      "Privacy"
    ],
    "summary": "A privacy-conscious spatial business analysis of 1,120 real North Shore Nostalgia orders — 871 destination communities across 63 states and regions and nine countries — combining an interactive globe with shipment, console, temporal, and aggregate sales patterns.",
    "description": "The North Shore Nostalgia Sales Atlas converts several years of eBay order history into a public business-geography case study. A Python pipeline groups orders, generalizes destinations to city and town centroids, geocodes each community, calculates estimated great-circle distance, and writes a strict allow-listed dataset. I rendered the route network with Globe Maps, a custom MapLibre mapping skill I authored for three-dimensional route projects; it shaped the projection, atmosphere, style-load sequencing, densified great-circle geometry, antimeridian handling, selection behavior, and testing approach. The dashboard combines platform, destination, period, and title filters with console rankings, temporal playback, international handoffs, and privacy-safe aggregate sales indicators. A scheduled GitHub Actions workflow refreshes the atlas every six hours through the eBay Fulfillment API's read-only scope: it pulls the rolling order window, generalizes it, runs the privacy tests, and commits only the public JSON and the geocoding cache — and fails visibly rather than reporting a misleading success when credentials are missing. The dataset carries its own coverage metadata beside the headline totals, so a known export gap is stated on the page instead of being papered over; coverage is currently continuous from March 2023 through August 20, 2026. Military mail needs separate handling because eBay records overseas APO/FPO destinations as domestic US addresses — those are matched privately and published only as a broad destination, with the postal code and unit address never entering the public file.",
    "role": "I designed the privacy model, authored the Globe Maps skill, built the Python processing and test pipeline, and developed the responsive MapLibre interface from real data from my own eBay business.",
    "outcome": "The published atlas maps 1,120 orders reaching 871 communities across 63 states and regions and nine countries, roughly 1.36 million estimated route miles, with continuous coverage from March 2023 through August 2026. It reads Nintendo GameCube as the highest-grossing console and PlayStation 2 as the highest-volume at 388 games, Florida as the top spending state at 10.9 percent, and Canada as the leading international market — none of it exposing customer information.",
    "tools": [
      "Python",
      "MapLibre GL JS",
      "Globe Maps",
      "Nominatim",
      "GeoJSON",
      "pytest",
      "GitHub Actions"
    ],
    "year": "2026",
    "thumb": "images/projects/where-games-go-thumb.png",
    "links": {
      "live": "https://mapzimus.github.io/where-the-games-go/",
      "repo": "https://github.com/mapzimus/where-the-games-go"
    },
    "gallery": [
      {
        "src": "images/projects/figures/ebay-packages-globe.jpg",
        "caption": "Interactive 3D globe — estimated routes from Salem to destination communities and international hubs"
      },
      {
        "src": "images/projects/where-games-go-thumb.png",
        "caption": "Globe detail — dispatch origin, order destinations, and eBay processing-hub continuations"
      },
      {
        "src": "images/projects/ebay-packages-preview.png",
        "caption": "Atlas intro — business-geography framing for North Shore Nostalgia sales from Salem, MA"
      }
    ],
    "order": 80,
    "blurb": "Privacy-conscious spatial analysis of 1,120 North Shore Nostalgia orders across 871 communities, with an interactive globe."
  },
  {
    "slug": "concord-war",
    "tier": "lab",
    "visibility": "mapzimus",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Concord Civil War — Scrollytelling Map",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "SvelteKit",
      "MapLibre GL JS",
      "deck.gl",
      "Scrollytelling"
    ],
    "summary": "An interactive scrollytelling web map of an alternate-history civil war splitting Concord, NH along the Merrimack River — East vs West. Companion to a 24×36\" 1860s-style campaign poster built in QGIS.",
    "description": "A scrollytelling + free-explore web map telling the alternate-history \"East Concord vs West Concord\" civil-war story: the Merrimack River as the front line, campaign phases unfolding as you scroll, then a free-exploration mode. Built with SvelteKit, MapLibre GL JS, deck.gl, and scrollama, and a companion to the static ARCH-D campaign poster designed in QGIS in period 1860s style. Both consume authoritative data from the Open Concord NH platform.",
    "tools": [
      "SvelteKit",
      "MapLibre GL JS",
      "deck.gl",
      "scrollama",
      "QGIS"
    ],
    "year": "2026",
    "links": {
      "live": "https://mapzimus.github.io/concord-war/",
      "repo": "https://github.com/mapzimus/concord-war"
    }
  },
  {
    "slug": "calmroute",
    "kind": "lab",
    "era": "current",
    "status": "development",
    "title": "Calm Route",
    "category": "Web App",
    "type": "tool",
    "tags": [
      "OSRM",
      "Crash Data",
      "Route Scoring"
    ],
    "summary": "A safer-route picker for anxious drivers in Massachusetts — scores OSRM route alternatives 0–100 on five years of crash history, winter/ice risk, and live construction, with the math shown.",
    "year": "2026",
    "links": {},
    "visibility": "lab"
  },
  {
    "slug": "gis-jobs-atlas",
    "kind": "lab",
    "era": "current",
    "status": "development",
    "title": "GIS Jobs Atlas",
    "category": "Web App",
    "type": "map",
    "tags": [
      "Web Scraping",
      "Job Search",
      "Interactive Map"
    ],
    "summary": "Scrapes U.S. geospatial job postings, traces each back to its real source on the employer’s own site, scores it for trustworthiness, and maps it all on an interactive USA map.",
    "year": "2026",
    "links": {},
    "visibility": "lab"
  },
  {
    "slug": "new-england-in-motion",
    "tier": "featured",
    "visibility": "featured",
    "role": "I built the whole system: the MapLibre frontend and its region filter, the Cloudflare Worker gateway and separate Vercel aircraft relay, the GTFS/GTFS-realtime normalizers for every agency feed, the build-time route-snapshot pipeline, and the geometry checks that keep a bad feed update from shipping.",
    "outcome": "One live map of movement across all six New England states — live MBTA and regional agency vehicles, estimated Metro-North trains, Amtrak, aircraft, AIS vessels, shared mobility, work zones, incidents, and cameras — filterable to Boston, a single state, or the whole region, with every feature labeled by how much it is actually known.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "New England in Motion",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "MapLibre GL JS",
      "GTFS-realtime",
      "Cloudflare Workers",
      "Real-time",
      "ADS-B",
      "AIS",
      "New England"
    ],
    "summary": "One live map of transportation moving across all six New England states — transit, Amtrak, ferries, aircraft, harbor vessels, shared bikes and scooters, work zones, incidents, and traffic cameras. Start on Boston, switch to a state, or zoom out to the whole region.",
    "year": "2026",
    "thumb": "images/projects/new-england-in-motion-preview.jpg",
    "links": {
      "live": "https://mapzimus.github.io/Motion/",
      "repo": "https://github.com/mapzimus/Motion"
    },
    "description": "Started as Boston in Motion — one dark MapLibre map of the MBTA fleet, aircraft over Logan, and harbor traffic, rendered entirely in the browser. It now covers Connecticut, Maine, Massachusetts, New Hampshire, Rhode Island, and Vermont, and the interesting work was in what expanding honestly required. Region selection is geographic, not nominal: live points are clipped against generalized 2025 Census TIGERweb boundaries, so \"Boston,\" each state, and \"All New England\" are real spatial filters rather than guesses at agency names. Every feature carries a provenance label — live, estimated, scheduled, or reference — so a published timetable never masquerades as a moving vehicle. Live positions come from the MBTA V3 API every 10 seconds and from regional agency GTFS-realtime feeds (CTtransit, HARTransit, Norwalk, River Valley, RIPTA, Portland METRO, Island Explorer, PVTA, Advance Transit, and Vermont's Swiftly-authorized providers) every 20; Metro-North's New Haven, New Canaan, Danbury, and Waterbury trains are interpolated between MTA trip-update predictions and labeled as estimated, because the MTA publishes predictions rather than train GPS. Around that sit Amtrak (official GTFS for schedules, the Amtraker community API for live trains), ADS-B aircraft from ADSB.lol with adsb.fi failover, AISStream harbor and coastal vessels over a protected WebSocket relay, GBFS shared bikes and scooters, WZDx work zones, 511 and CTroads incidents, public traffic cameras, and congestion tiles. A build-time snapshot adds 1,098 bus, rail, ferry, passenger-boat, and air-service routes assembled from 70 GTFS sources and 85 official-service corridors, 53 on-demand and microtransit service markers, 778 FAA landing facilities, 38 Canadian border crossings, TIGERweb primary roads, and the FRA rail network, so an agency that publishes only a timetable still appears instead of looking dead. Where an intercity GTFS file ships only terminal stops, gaps over 20 km are repaired at build time against a cached OSRM road path, labeled approximate, and never fetched from a visitor's browser. Ferry geometry is audited against the full-resolution GSHHG shoreline and TIGERweb hydrography, with coordinate fingerprints locked by a geometry check so no feed update can quietly restore a route that crosses land. The frontend is still plain HTML, CSS, and JavaScript, but \"no backend at all\" no longer holds: both public ADS-B providers block Cloudflare's shared Worker egress and send no browser CORS headers, so aircraft go through a separate Vercel Function relay with stale-while-revalidate caching, while a TypeScript Cloudflare Worker gateway fronts the agency, 511, camera, and AIS feeds and keeps provider keys out of the page entirely.",
    "tools": [
      "MapLibre GL JS",
      "Cloudflare Workers",
      "Vercel Functions",
      "TypeScript",
      "GTFS / GTFS-realtime",
      "MBTA V3 API",
      "MTA GTFS-RT",
      "Amtraker",
      "ADSB.lol",
      "AISStream",
      "GBFS",
      "WZDx",
      "Census TIGERweb",
      "OSRM",
      "Vitest"
    ],
    "gallery": [
      {
        "src": "images/projects/new-england-in-motion/all-new-england.jpg",
        "caption": "All New England — 2,688 live vehicles against 1,287 scheduled routes and 37,303 stops, clipped to Census boundaries"
      },
      {
        "src": "images/projects/new-england-in-motion/maine.jpg",
        "caption": "Maine — 140 scheduled routes carrying 11 live vehicles: rural service stays on the map instead of looking dead"
      },
      {
        "src": "images/projects/new-england-in-motion/connecticut.jpg",
        "caption": "Connecticut — Metro-North branches drawn from MTA trip updates and labeled estimated, with Long Island Sound ferries"
      }
    ],
    "order": 50,
    "blurb": "Live map of transportation across all six New England states — transit, rail, vessels, aircraft, bikes, and traffic cameras."
  },
  {
    "slug": "locomonnector",
    "kind": "lab",
    "era": "current",
    "status": "development",
    "title": "Locomonnector",
    "category": "Spatial Analysis",
    "type": "analysis",
    "tags": [
      "Python",
      "Delaunay",
      "Network Design"
    ],
    "summary": "A fantasy binational (US + Canada) rail network: node classification, Delaunay-pruned trunk edges, a forced Alaska corridor, and self-contained island networks — rendered to an interactive Leaflet map.",
    "year": "2026",
    "links": {},
    "visibility": "lab"
  }
];
