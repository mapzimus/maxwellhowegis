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
    {
        id: 9,
        era: "current",
        title: "The Whydah Gally — A Pirate Story Told Spatially",
        category: "Web Mapping",
        type: "web",
        tags: ["MapLibre GL JS", "Custom Dashboard", "Primary-Source Research", "Curriculum Design", "3D Globe Tour"],
        summary: "A custom 19-stop 3D globe flythrough and curriculum dashboard for a 5-week middle-school PBL unit on the 1717 Whydah Gally pirate shipwreck. Built end-to-end in vanilla JS.",
        description: "Built for the LEAP4Ed Summer 2026 program in Salem, MA — a comprehensive teaching dashboard for 7th-graders on the Whydah Gally story (slave ship, pirate flagship, wreck, modern recovery). Includes a custom 3D globe flythrough built with MapLibre GL JS that flies between 19 chronological waypoints with photo and caption overlays plus a 15-second slow pan at each location. Other features: primary-source quote integration from the 1718 Trials of Eight Persons (Davis, Hoof, Dunavan depositions); the Hanna counter-thesis on colonial 'pirate nests' alongside the Rediker working-class reading; live USGS coastal-cam embeds at the Marconi Beach wreck site; the Salem Witch Trials -> Whydah trial connection; and a researched cast of period figures (Bellamy, Williams, Lebous, Crumpstey, Mather, Sewall, Auchmuty, Harding). The whole stack is open-source: MapLibre GL JS + Esri World Imagery, no API keys, no build step, vanilla HTML/CSS/JS. Designed so students can edit the waypoints array as a research extension.",
        tools: ["MapLibre GL JS", "Esri World Imagery", "Vanilla JavaScript", "USGS Coastal Cams", "Primary-Source Research", "Curriculum Design"],
        year: "2026",
        course: "LEAP4Ed Summer 2026 — Whydah PBL Curriculum",
        thumb: "images/projects/whydah-thumb.png",
        liveUrl: "whydah/",
        repoUrl: "https://github.com/mapzimus/Whydah-Unit"
    },
    {
        id: 10,
        era: "current",
        title: "African Urbanization Project",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "sf", "tmap", "terra", "UN Data", "WorldPop"],
        summary: "GIS analysis tracing African continental population projections from emerging megacity clusters down to a Kinshasa case study. Built in R using UN World Urbanization Prospects and WorldPop data.",
        description: "A self-directed spatial analysis examining urbanization patterns across Africa. Starting from continental population projections (UN World Urbanization Prospects), the project identifies emerging megacity clusters, then zooms into Kinshasa as a case study for accelerated urban growth dynamics. Built in R using sf for spatial data handling, terra for raster processing, and tmap for cartographic output. The analysis spans continental, regional, and city-scale lenses — a multi-resolution approach to understanding one of the fastest urbanizing regions on Earth.",
        tools: ["R", "sf", "terra", "tmap", "UN World Urbanization Prospects", "WorldPop"],
        year: "2025–2026",
        thumb: null,
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 11,
        era: "current",
        title: "Zillow / MHI Near Commuter Rail",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "Zillow", "MBTA", "Housing Data", "Transit"],
        summary: "R-based spatial analysis comparing Zillow housing prices and median household income to MBTA commuter rail stop proximity across Eastern Massachusetts.",
        description: "A spatial analysis combining three datasets — Zillow home value data, Census median household income (ACS), and MBTA commuter rail stop locations — to understand how proximity to commuter rail correlates with housing costs and income levels across Eastern Massachusetts. Built in R using sf, tidycensus, and tidyverse. The analysis reveals clear spatial patterns: stops near Boston show strong price premiums that fade with distance, while some outer stops show weaker correlation — suggesting the MBTA's reach as an economic driver has real geographic limits.",
        tools: ["R", "sf", "tidycensus", "Zillow Data", "MBTA GTFS", "Census ACS"],
        year: "2025–2026",
        thumb: null,
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 12,
        era: "current",
        title: "TappyMaps",
        category: "Web App",
        type: "tool",
        tags: ["JavaScript", "Map Design", "Geography Games", "GIS App"],
        summary: "A lightweight GIS application for map design — drag, color, and export custom maps. Includes geography games and a sharing gallery. Live at tappymaps.com.",
        description: "TappyMaps is a web-based GIS application built around three pillars: map designer, geography games, and a sharing gallery. The map designer lets users build and style custom maps using geographic data — no desktop GIS software required. Geography games add an educational layer. Finished maps can be exported and shared. Part of the Mapparatus organization umbrella.",
        tools: ["JavaScript", "GeoJSON", "Canvas API", "Web APIs"],
        year: "2025–2026",
        thumb: null,
        liveUrl: "https://tappymaps.com",
        repoUrl: null
    },
    {
        id: 13,
        era: "current",
        title: "Geopuesto",
        category: "Web App",
        type: "tool",
        tags: ["JavaScript", "Leaflet", "Geo Utility"],
        summary: "Antipodal point calculator — enter any location and find its exact geographic opposite on Earth. Clean, focused geo-utility tool.",
        description: "Geopuesto calculates antipodal points — the geographic opposite of any location on Earth's surface. Enter coordinates or click a map, and Geopuesto computes and displays the antipode with coordinates and a split-view map. A focused, single-purpose geo-utility.",
        tools: ["JavaScript", "Leaflet", "GitHub Pages"],
        year: "2025–2026",
        thumb: null,
        liveUrl: "geopuesto/",
        repoUrl: null
    },
    {
        id: 14,
        era: "current",
        title: "OptiTrek",
        category: "Web App",
        type: "tool",
        tags: ["Route Optimization", "GIS", "In Development"],
        summary: "Road trip optimization tool applying geospatial route planning algorithms. Currently in active development.",
        description: "OptiTrek is a road trip planning tool that applies geospatial route optimization to the problem of visiting multiple destinations efficiently. Currently in development.",
        tools: ["Route Optimization", "Geospatial APIs", "JavaScript"],
        year: "2026",
        thumb: null,
        liveUrl: null,
        repoUrl: null,
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
