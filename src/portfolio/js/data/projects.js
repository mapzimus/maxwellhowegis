// ===== V2 PROJECT DATA =====
// Unified schema — see v2/js/render.js for the card renderer.
// kind: "project" (full card + detail page) | "lab" (in-dev strip on work.html)
// era:  "current" (post-grad, self-directed) | "school" (Salem State MS GIS, 2023-2025)
// Paths are SITE-ROOT-relative; render.js resolves them via V2.asset().
// NOTE: course codes for lynn-absenteeism (GPH945) and education-wealth (GPH903)
// were corrected from v1 per the F: course archive.
window.V2_DATA = window.V2_DATA || {};
window.V2_DATA.projects = [
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
        "src": "images/projects/lynn/lynn-student-density-grid-150m.png",
        "caption": "Student density grid — counts per 150 m cell"
      },
      {
        "src": "images/gallery/lynn-kde-heatmap.png",
        "caption": "KDE heatmap of geocoded student addresses"
      },
      {
        "src": "images/projects/lynn/lynn-absenteeism-hotspots-lehs.png",
        "caption": "Absenteeism hotspots (≥20%) around LEHS"
      },
      {
        "src": "images/projects/lynn/lynn-absenteeism-hotspots-citywide-hexgrid.png",
        "caption": "Citywide absenteeism hotspots — 100 m hexbins above 20%"
      },
      {
        "src": "images/projects/lynn/lynn-absenteeism-dotmap-central-square.png",
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
    }
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
        "src": "images/projects/salem-pantry/pantry-spatial-analysis-overview.png",
        "caption": "Spatial Analysis Overview"
      },
      {
        "src": "images/projects/salem-pantry/pantry-coverage-analysis.png",
        "caption": "Coverage Analysis"
      },
      {
        "src": "images/projects/salem-pantry/pantry-demographic-breakdown.png",
        "caption": "Demographic Breakdown"
      },
      {
        "src": "images/projects/salem-pantry/pantry-random-forest-results.png",
        "caption": "Random Forest Results"
      },
      {
        "src": "images/projects/salem-pantry/pantry-statewide-similarity.png",
        "caption": "Statewide Similarity Analysis"
      },
      {
        "src": "images/projects/salem-pantry/pantry-final-recommendations.png",
        "caption": "Final Recommendations"
      }
    ],
    "links": {}
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
    "links": {}
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
    "links": {}
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
    "links": {}
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
        "src": "images/projects/central-campus/campus-cad-utility-asbuilt.png",
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
    "links": {}
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
        "src": "images/projects/lynnfield/lynnfield-arcgis-spatial-database.png",
        "caption": "Database and Spatial Features in ArcGIS Pro"
      }
    ],
    "links": {}
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
        "src": "images/projects/evacuation/evacuation-arcpy-route-script.png",
        "caption": "arcpy Evacuation Route Script"
      }
    ],
    "links": {}
  },
  {
    "slug": "appalachians",
    "tier": "featured",
    "visibility": "featured",
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
      }
    ],
    "links": {
      "live": "appalachians/"
    }
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
    "thumb": "quabbin/output/08_hero.png",
    "gallery": [
      {
        "src": "quabbin/output/01_locator.png",
        "caption": "Locator — the Swift River Valley within Massachusetts"
      },
      {
        "src": "quabbin/output/02_dem_hillshade.png",
        "caption": "Terrain — the valley before the flood, DEM hillshade (terra)"
      },
      {
        "src": "quabbin/output/03_reservoir_towns.png",
        "caption": "Four towns under the water — Dana, Enfield, Greenwich & Prescott"
      },
      {
        "src": "quabbin/output/04_watershed.png",
        "caption": "The reservoir and its protected watershed (USGS WBD)"
      },
      {
        "src": "quabbin/output/06_town_lifelines.png",
        "caption": "Four lifelines, one ending — incorporation to 1938 disincorporation"
      },
      {
        "src": "quabbin/output/07_population_decline.png",
        "caption": "Four towns, steadily emptying — decennial census, 1900–1920"
      },
      {
        "src": "quabbin/output/11_crosssection.png",
        "caption": "The drowned valley in cross-section, west to east"
      },
      {
        "src": "quabbin/output/10_aqueduct.png",
        "caption": "The aqueduct carrying the water ~105 km east to Boston"
      },
      {
        "src": "quabbin/output/05_erasure.png",
        "caption": "Erased from the map — how the former town land is divided today"
      },
      {
        "src": "quabbin/output/13_terrain3d.png",
        "caption": "The Swift River Valley in three dimensions"
      },
      {
        "src": "quabbin/output/12_losses.png",
        "caption": "By the numbers — what the project erased"
      },
      {
        "src": "quabbin/output/16_roads.png",
        "caption": "The roads the reservoir drowned — the pre-flood street network beneath the water"
      },
      {
        "src": "quabbin/output/24_prescott_survey.png",
        "caption": "Prescott Peninsula — the best-preserved imprint; roads and foundations legible in 1 m LiDAR"
      },
      {
        "src": "quabbin/output/24_dana_survey.png",
        "caption": "Dana — town map, LiDAR hillshade, and traced roads & cellar holes that stayed above water"
      },
      {
        "src": "quabbin/output/24_enfield_survey.png",
        "caption": "Enfield — the valley seat, now almost entirely beneath the reservoir"
      },
      {
        "src": "quabbin/output/25_prescott_xref.png",
        "caption": "Ground-truth — 1893 USGS roads cross-referenced against the LiDAR traces"
      },
      {
        "src": "quabbin/output/09_floodfill.png",
        "caption": "Filling the reservoir in equal-area stages — schematic synthetic basin (small multiples)"
      },
      {
        "src": "quabbin/output/quabbin_floodfill.gif",
        "caption": "Animation — the reservoir filling to its 1946 full pool (schematic, not surveyed bathymetry)"
      }
    ],
    "links": {
      "live": "quabbin.html",
      "repo": "https://github.com/mapzimus/maxwellhowegis/tree/main/quabbin"
    }
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
    }
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
    "description": "Geopuesto started as a one-line antipode calculator and grew into a full-screen geographic discovery tool. A map click, coordinate, search, or current location produces the antipode and adds context from public services: reference material, imagery, weather, air quality, daylight, earthquakes, volcanoes, aircraft, vessels, satellites, radio, and street-level photos. The Personal Equator module draws the great circle perpendicular to the antipodal axis and finds cities that are approximately equidistant from the selected point and its antipode.",
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
    }
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
    }
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
    "tier": "featured",
    "visibility": "featured",
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
    "description": "TappyMaps is a web-based GIS application built around three pillars: map designer, geography games, and a sharing gallery. The map designer lets users build and style custom maps using geographic data — no desktop GIS software required. Geography games add an educational layer. Finished maps can be exported and shared. Part of the Mapparatus organization umbrella.",
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
        "src": "images/gallery/tappymaps-uninsured-rate.png",
        "caption": "Demo card — US uninsured rate by state (5 quantile bins, 2023 Census), rendered as a shareable TappyMaps card"
      }
    ],
    "links": {
      "live": "https://tappymaps.com"
    }
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
      }
    ],
    "links": {
      "repo": "https://github.com/mapzimus/optitrek"
    }
  },
  {
    "slug": "open-concord",
    "role": "Solo build: I designed the PostGIS schema and layer-tagging model, wrote the {targets} ETL pipeline that acquires and normalizes all 165 layers, built the Shiny/mapgl frontend, and deployed the stack with Docker and Caddy on a self-hosted server.",
    "outcome": "A working single-city geospatial data platform: 165 live layers queryable through one interface, reproducible end to end from public sources. The {targets} pipeline re-syncs the entire database on demand, and the same architecture generalizes to any municipality with open data endpoints.",
    "tier": "additional",
    "visibility": "additional",
    "kind": "project",
    "era": "current",
    "status": "development",
    "title": "Open Concord, NH",
    "category": "GIS Data Platform",
    "type": "map",
    "tags": [
      "R",
      "PostGIS",
      "MapLibre GL",
      "Shiny",
      "targets",
      "ETL Pipeline",
      "165 Layers"
    ],
    "summary": "Full-stack R + PostGIS geospatial data platform for Concord, NH — 165 layers from city ArcGIS, federal, OSM, Census, CDC, EPA, biodiversity, and knowledge APIs, explored through a rich interactive Shiny map.",
    "description": "A complete, self-hosted GIS data platform for Concord, NH built entirely in R. A {targets} ETL pipeline acquires every public dataset — city ArcGIS (~91 layers: parcels, zoning, roads, utilities), federal/state ArcGIS, OpenStreetMap, US Census ACS 2023, CDC PLACES health indicators, EPA FRS, USGS streamgages, GBIF biodiversity, and Wikidata/Wikipedia — loading each into PostGIS tagged as map+db or db. The R Shiny frontend (bslib + mapgl) queries PostGIS live with four panels: a searchable layer accordion, a thematic choropleth picker (ACS income/population/rent, CDC mental health), analysis tools (Nominatim geocoder, SQL filter, draw-to-measure, GeoJSON/CSV export), and a Knowledge tab with Wikidata facts and notable people. Click any feature → right-panel inspector with full attributes and Wikipedia links.",
    "tools": [
      "R",
      "PostGIS",
      "Shiny",
      "bslib",
      "mapgl",
      "MapLibre GL",
      "targets",
      "sf",
      "arcgislayers",
      "tidycensus",
      "osmdata",
      "httr2",
      "Docker",
      "Caddy"
    ],
    "year": "2025–2026",
    "thumb": "images/projects/open-concord-thumb.svg",
    "links": {
      "live": "concord.html",
      "repo": "https://github.com/mapzimus/open-concord-nh"
    }
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
    "visibility": "additional",
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
    "visibility": "additional",
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
    "title": "Where My Ebay Packages Have Travelled",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "MapLibre",
      "3D Globe",
      "Python",
      "Geocoding",
      "Privacy"
    ],
    "summary": "An interactive 3D globe built from 1,009 real North Shore Nostalgia shipments, with city-level geocoding, great-circle journeys, international handoffs, sales records, and a cumulative timeline.",
    "description": "The project turns several years of real eBay orders from North Shore Nostalgia into a public geographic story. A Python pipeline groups orders, generalizes destinations to city level, geocodes each city, calculates approximate great-circle distance, and writes a strict allow-listed public dataset. The MapLibre globe adds filters, expanded sales statistics, a cumulative timeline, and two-stage eBay International Shipping journeys when the source export includes both the Illinois handoff hub and the true destination. Older hub-only records are labeled honestly instead of guessing where they continued.",
    "role": "I designed the privacy model, built the Python data pipeline and tests, and developed the responsive MapLibre globe from real data from my own eBay business.",
    "outcome": "The live map now shows 1,009 packages across 778 destination cities, including recovered international legs, while automated tests prevent names, addresses, order identifiers, tracking numbers, and other customer data from entering the published dataset.",
    "tools": [
      "Python",
      "MapLibre GL JS",
      "Nominatim",
      "GeoJSON",
      "pytest",
      "GitHub Actions"
    ],
    "year": "2026",
    "thumb": "images/projects/where-games-go-thumb.png?v=map-4",
    "links": {
      "live": "https://mapzimus.github.io/where-the-games-go/",
      "repo": "https://github.com/mapzimus/where-the-games-go"
    }
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
    "links": {}
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
    "links": {}
  },
  {
    "slug": "boston-in-motion",
    "tier": "featured",
    "visibility": "featured",
    "role": "I integrated the transit, aircraft, vessel, bike-share, and traffic feeds and designed the client-side MapLibre rendering and update logic.",
    "outcome": "The result is one live, backend-free view of transportation moving through the Boston region.",
    "kind": "project",
    "era": "current",
    "status": "live",
    "title": "Boston in Motion",
    "category": "Web Mapping",
    "type": "map",
    "tags": [
      "MBTA V3 API",
      "MapLibre GL JS",
      "Real-time",
      "ADS-B",
      "AIS"
    ],
    "summary": "One live map of everything moving through Boston — subway, commuter rail, ~150 bus routes, ferries, Amtrak, aircraft over Logan, harbor traffic via AIS, and Bluebikes fill levels — polled or streamed straight into the browser. No backend at all.",
    "year": "2026",
    "thumb": "images/projects/boston-in-motion-preview.png",
    "links": {
      "live": "https://mapzimus.github.io/Motion/",
      "repo": "https://github.com/mapzimus/Motion"
    },
    "description": "A single dark MapLibre map of everything in motion in and around Boston, live. The entire MBTA fleet (~500–900 vehicles) arrives in one /vehicles request every 10 seconds and is classified into layers client-side: subway (with the Silver Line riding alongside, because no Boston rapid-transit map is complete without it), commuter rail, buses, and ferries. Amtrak positions come from the community Amtraker API, aircraft within 30 nm of Logan from airplanes.live ADS-B, live harbor traffic from an aisstream.io WebSocket, Bluebikes station fill from GBFS, and road congestion from TomTom flow tiles. Everything renders in the browser — no backend at all.",
    "tools": [
      "MapLibre GL JS",
      "MBTA V3 API",
      "Amtraker",
      "airplanes.live",
      "aisstream.io",
      "Bluebikes GBFS",
      "TomTom"
    ]
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
    "links": {}
  }
];
