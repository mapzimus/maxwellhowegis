// ===== PROJECT DATA =====
// To update: edit this file, add screenshots to /images/projects/
const projects = [
    {
        id: 1,
        title: "Chronic Absenteeism in Lynn Public Schools",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "Geocoding", "Statistical Analysis", "Leaflet"],
        summary: "Geocoded student addresses and correlated distance from school with chronic absenteeism rates across Lynn, MA — my capstone project for my MS program.",
        description: "For my capstone project in the MS program (Project Implementation), I tackled the chronic absenteeism problem in Lynn Public Schools. I wanted to know if the distance a student lives from school has any measurable impact on whether they show up. I geocoded student addresses across the district and correlated each student's distance from school with their absenteeism record. I wrote scripts in R to run the analysis, including scatter plots, violin plots, box plots, and distance band breakdowns (0–0.25 mi, 0.25–0.5 mi, 0.5–1 mi, 1–2 mi, 2–3 mi, 3+ mi). The result was an extremely slight negative correlation — distance alone is not a strong predictor of attendance. The project produced a full suite of thematic maps and statistical visualizations.",
        tools: ["R", "ggplot2", "Geocoding", "ArcGIS Pro", "Leaflet", "Statistical Analysis"],
        year: "2025",
        course: "GPH955 — GIS Project Implementation",
        thumb: "images/projects/lynn.png",
        liveUrl: "lynn.html",
        repoUrl: null
    },
    {
        id: 2,
        title: "Salem Pantry: Mapping Food Access",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["R", "Random Forest", "Census ACS", "Cluster Analysis"],
        summary: "Analyzed 150,000 rows of client data for the Salem Pantry using R — identified underserved areas and used random forest modeling to find similar populations statewide.",
        description: "I worked with the Salem Pantry, a non-profit food pantry in Salem, MA, to analyze over 150,000 rows of their client data. The goal was to figure out who's using the pantry, where they're coming from, and where the coverage gaps are. I cleaned and organized all the data, then used R with packages like sf, tmap, tidycensus, tigris, randomForest, ranger, caret, leaflet, and ggplot2 to run the analysis. I mapped dry zones — areas with less pantry coverage — and used random forest analysis and statistical regression to identify other parts of Massachusetts with similar socioeconomic profiles (based on census tract data like income, household size, language, and race). The results were presented to the Salem Pantry board to help guide decisions about outreach and potential expansion.",
        tools: ["R", "sf", "tmap", "tidycensus", "randomForest", "ArcGIS Pro", "Census ACS"],
        year: "2024",
        course: "GPH953 — Seminar in GIS Applications",
        thumb: "images/projects/salem-pantry.png",
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 3,
        title: "Growth in the Granite State",
        category: "Remote Sensing",
        type: "remote",
        tags: ["Landsat 8/9", "Change Detection", "TerrSet"],
        summary: "Change detection analysis of Concord, Manchester, and Nashua using USGS Landsat imagery to identify shifts in urbanization and land cover.",
        description: "Change detection analysis of Concord, Manchester, and Nashua, NH using USGS Landsat imagery from two different time periods. I used TerrSet to overlay the images on top of each other as a multitemporal composite — one color shows change, another shows no change. The analysis looked for shifts in urbanization, forestation, and potential river changes. True color composites were built using bands 2, 3, and 4, then pansharpened with the 15m panchromatic band. The overlay revealed notable expansion in Concord and Nashua, while Manchester showed a slight population decline. Straightforward remote sensing work using freely available satellite imagery.",
        tools: ["Landsat 8/9", "TerrSet", "PANSHARPEN", "True Color Composites", "Multitemporal Analysis"],
        year: "2024",
        course: "GPH910 — Digital Image Processing",
        thumb: "images/projects/change-analysis.png",
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 4,
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
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 5,
        title: "Mapping Education and Wealth in Massachusetts",
        category: "Spatial Analysis",
        type: "analysis",
        tags: ["ArcGIS Pro", "Census ACS", "Bivariate"],
        summary: "Bivariate mapping of Massachusetts municipalities correlating median household income to educational attainment — my first GIS project.",
        description: "My first GIS project. A bivariate map of Massachusetts at the municipal level, correlating median household income with educational attainment using American Community Survey data. The maps show clear spatial patterns — towns with higher rates of bachelor's degrees consistently line up with higher median incomes, especially in the Greater Boston suburbs. It's a simple concept but it was where I learned the fundamentals of thematic mapping, data classification, and working with census data in ArcGIS Pro.",
        tools: ["ArcGIS Pro", "Census ACS Data", "MassGIS", "Bivariate Mapping"],
        year: "2024",
        course: "GPH952 — Spatial Database Design & Analysis",
        thumb: "images/projects/education.png",
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 6,
        title: "Central Campus Mapping",
        category: "Cartography",
        type: "map",
        tags: ["ArcGIS Pro", "CAD", "Drone Imagery", "Trimble GPS"],
        summary: "Surveying project combining CAD files, drone imagery, and Trimble GPS ground verification of Salem State University's central campus.",
        description: "A surveying and GIS project for Salem State University's central campus. We captured drone imagery of the campus, then overlayed CAD files on top of the aerial photos. Everything was verified on the ground using Trimble GPS devices. The final product is a detailed campus map built from the integration of CAD data, UAV imagery, and GPS ground-truthing — combining traditional surveying methods with modern geospatial technology.",
        tools: ["ArcGIS Pro", "CAD", "UAV / Drone Imagery", "Trimble GPS", "Georeferencing"],
        year: "2024",
        course: "GPH946 — Computer Cartography",
        thumb: "images/projects/central-campus.png",
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 7,
        title: "Lynnfield Cemetery Spatial Database",
        category: "Database Design",
        type: "web",
        tags: ["SQL", "ArcGIS Pro", "Database Design"],
        summary: "Spatial database for the cemeteries in Lynnfield, MA — digitizing ~4,000 grave cards and ~1,000 lot cards into a queryable GIS system.",
        description: "Built a spatial database for the Town of Lynnfield's two cemeteries: Forest Hill Cemetery and Willow Cemetery. The town had approximately 4,000 grave cards and 1,000 lot cards in binders that needed to be digitized and made searchable. I designed a SQL database schema to hold burial records, lot ownership, veteran grave data, and deed associations, then linked everything to spatial features in ArcGIS Pro. Historical cemetery maps were georeferenced and digitized. The system replaced paper binders with a queryable GIS database that cemetery staff can actually use to look up and manage plot information.",
        tools: ["SQL", "ArcGIS Pro", "Geodatabase Design", "Georeferencing", "OCR"],
        year: "2024",
        course: "GPH952 — Spatial Database Design & Analysis",
        thumb: "images/projects/lynnfield.png",
        liveUrl: null,
        repoUrl: null
    },
    {
        id: 8,
        title: "Emergency Evacuation Route Planning",
        category: "Web App",
        type: "web",
        tags: ["Python", "arcpy", "FEMA", "Network Analysis"],
        summary: "Python-based route planning tool using FEMA flood data to identify evacuation routes in Salem, MA.",
        description: "Used arcpy to build a route planning tool that looked at FEMA flood water sea-rise data overlayed over Salem, MA. The idea was to reroute someone evacuating Salem in a flood scenario where certain roads couldn't be used. Roads with higher traffic volumes and greater flood risk received higher impedance weights in the network analysis, making them less favorable. The output visualizes the safest and most dangerous evacuation routes from a given starting point.",
        tools: ["Python", "arcpy", "ArcGIS Pro", "MassGIS", "FEMA Flood Data", "Network Analysis"],
        year: "2024",
        course: "GPH960 — Software Design & Programming in GIS",
        thumb: "images/projects/salem-evacuation.png",
        liveUrl: null,
        repoUrl: null
    }
];

// ===== CATEGORY CONFIG =====
const categories = [
    { key: "all", label: "All" },
    { key: "map", label: "Cartography" },
    { key: "analysis", label: "Spatial Analysis" },
    { key: "web", label: "Web App / Database" },
    { key: "remote", label: "Remote Sensing" }
];

const typeLabels = {
    map: "MAP",
    analysis: "ANALYSIS",
    viz: "VIZ",
    web: "WEB / DB",
    remote: "REMOTE"
};

const typeClasses = {
    map: "type-map",
    analysis: "type-analysis",
    viz: "type-viz",
    web: "type-web",
    remote: "type-remote"
};

const typePlaceholders = {
    map: "\u{1F5FA}",
    analysis: "\u{1F4CA}",
    viz: "\u{1F4C8}",
    web: "\u{1F310}",
    remote: "\u{1F6F0}"
};
