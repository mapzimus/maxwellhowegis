// ===== V2 TOOLS DATA =====
// The 22 standalone client-side tools from the mapzimus/max repo,
// generated from its index by scripts (source of truth: mapzimus.github.io/max/).
window.V2_DATA = window.V2_DATA || {};
window.V2_DATA.tools = [
  {
    "slug": "truescale",
    "kind": "tool",
    "status": "live",
    "title": "True Scale",
    "category": "Full Apps",
    "type": "tool",
    "tags": [
      "Leaflet",
      "Turf.js",
      "Mercator",
      "Map Projections"
    ],
    "summary": "Drag any country or state across the map and watch it resize — revealing how much the Mercator projection distorts area. Greenland looks as big as Africa; it is 14× smaller.",
    "description": "An interactive explainer for Web Mercator area distortion. Pick any country, state, or province and drag it across the map: the shape continuously rescales to show its true relative size at each latitude. Side-by-side comparisons and a latitude grid make the classic distortions vivid — Greenland vs Africa, Alaska vs Brazil, Canada vs the contiguous US.",
    "tools": [
      "Leaflet",
      "Turf.js",
      "Natural Earth",
      "OpenStreetMap"
    ],
    "year": "2026",
    "links": {
      "live": "truescale/",
      "repo": "https://github.com/mapzimus/true-scale"
    },
    "icon": "🌍"
  },
  {
    "slug": "smartpicker",
    "kind": "tool",
    "status": "live",
    "category": "Full Apps",
    "type": "tool",
    "icon": "🎯",
    "title": "SmartPicker",
    "summary": "Fair, no-fuss cold-calling for the classroom — a smarter popsicle-stick jar that remembers who’s spoken, favors quieter kids, skips absent students, and exports participation records to CSV. Every roster lives in your own browser; nothing is ever uploaded.",
    "tags": [
      "Classroom",
      "Privacy-first",
      "Single-file"
    ],
    "links": {
      "live": "https://mapzimus.github.io/smartpicker/"
    }
  },
  {
    "slug": "pockettiles",
    "kind": "tool",
    "status": "live",
    "title": "PocketTiles Studio",
    "category": "Full Apps",
    "type": "tool",
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
    },
    "icon": "🧳"
  },
  {
    "slug": "coordinate-converter",
    "kind": "tool",
    "status": "live",
    "title": "Coordinate Converter",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🧭",
    "summary": "Convert live between Decimal Degrees, DMS, UTM, MGRS and Geohash, with an interactive map. Click or drag the marker to set a location.",
    "tags": [
      "maps",
      "GIS",
      "Leaflet"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/coordinate-converter.html"
    }
  },
  {
    "slug": "geojson-viewer",
    "kind": "tool",
    "status": "live",
    "title": "GeoJSON Viewer & Editor",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🗾",
    "summary": "Paste, drop or load GeoJSON, see it on a map, click features to edit their properties, validate, and re-export.",
    "tags": [
      "GIS",
      "GeoJSON",
      "Leaflet"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/geojson-viewer.html"
    }
  },
  {
    "slug": "bounding-box-picker",
    "kind": "tool",
    "status": "live",
    "title": "Bounding Box Picker",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🔲",
    "summary": "Draw or type a geographic bounding box and copy it in the five formats APIs want — CSV, WKT, GeoJSON, Leaflet and Overpass.",
    "tags": [
      "GIS",
      "bbox",
      "Leaflet"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/bounding-box-picker.html"
    }
  },
  {
    "slug": "static-map-generator",
    "kind": "tool",
    "status": "live",
    "title": "Static Map Generator",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🖼️",
    "summary": "Compose a map view with pins, then export a ready-to-use PNG image or an OpenStreetMap embed snippet. No API keys.",
    "tags": [
      "maps",
      "PNG",
      "embed"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/static-map-generator.html"
    }
  },
  {
    "slug": "batch-geocoder",
    "kind": "tool",
    "status": "live",
    "title": "Batch Geocoder",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "📍",
    "summary": "Paste a list of addresses or place names and get coordinates for all of them — on a map and as CSV or GeoJSON.",
    "tags": [
      "geocoding",
      "OSM",
      "CSV"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/batch-geocoder.html"
    }
  },
  {
    "slug": "spatial-data-scraper",
    "kind": "tool",
    "status": "live",
    "title": "Spatial Data Scraper",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🗺️",
    "summary": "Extract locations from a URL or pasted page text — addresses, cities, landmarks — geocode them, preview on a map, and export JSON, CSV or GeoJSON.",
    "tags": [
      "GIS",
      "scraping",
      "NER"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/spatial-data-scraper.html"
    }
  },
  {
    "slug": "sun-calculator",
    "kind": "tool",
    "status": "live",
    "title": "Sun Calculator",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "☀️",
    "summary": "Sunrise, sunset, twilight and golden hour for any place and date, with a sun-path chart. NOAA-accurate math, no libraries.",
    "tags": [
      "solar",
      "outdoors",
      "photography"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/sun-calculator.html"
    }
  },
  {
    "slug": "weather-app",
    "kind": "tool",
    "status": "live",
    "title": "Weather App",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🌤️",
    "summary": "Search any city for live current temperature and a 5-day forecast in clean cards, with hardcoded fallback if the API is unavailable.",
    "tags": [
      "weather",
      "Open-Meteo",
      "no key"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/weather-app.html"
    }
  },
  {
    "slug": "photo-location-viewer",
    "kind": "tool",
    "status": "live",
    "title": "Photo Location Viewer",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "📷",
    "summary": "See where your photos were taken from their hidden EXIF GPS data, map them, and save clean copies with the metadata stripped.",
    "tags": [
      "privacy",
      "EXIF",
      "maps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/photo-location-viewer.html"
    }
  },
  {
    "slug": "quick-chart-maker",
    "kind": "tool",
    "status": "live",
    "title": "Quick Chart Maker",
    "category": "Data",
    "type": "tool",
    "icon": "📊",
    "summary": "Type or paste data and export a chart — bar, line, pie, doughnut or scatter. Edit as a table or raw CSV/TSV, then download a PNG.",
    "tags": [
      "data",
      "charts",
      "PNG export"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/quick-chart-maker.html"
    }
  },
  {
    "slug": "csv-explorer",
    "kind": "tool",
    "status": "live",
    "title": "CSV Explorer",
    "category": "Data",
    "type": "tool",
    "icon": "🔎",
    "summary": "Open a CSV without a spreadsheet: sort, filter, per-column stats and histograms — then clean it up and re-export.",
    "tags": [
      "data",
      "CSV",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/csv-explorer.html"
    }
  },
  {
    "slug": "csv-json-converter",
    "kind": "tool",
    "status": "live",
    "title": "CSV ↔ JSON Converter",
    "category": "Data",
    "type": "tool",
    "icon": "🔁",
    "summary": "Convert between CSV and JSON in either direction with live preview, delimiter auto-detect, type detection and nested-JSON flattening.",
    "tags": [
      "data",
      "CSV",
      "JSON"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/csv-json-converter.html"
    }
  },
  {
    "slug": "data-generator",
    "kind": "tool",
    "status": "live",
    "title": "Data Generator",
    "category": "Data",
    "type": "tool",
    "icon": "🧪",
    "summary": "Set up your columns and generate realistic fake data — names, emails, dates, prices and more — then export as CSV or JSON. Same seed = same data every time.",
    "tags": [
      "data",
      "testing",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/data-generator.html"
    }
  },
  {
    "slug": "color-palette-generator",
    "kind": "tool",
    "status": "live",
    "title": "Color Palette Generator",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🎨",
    "summary": "Generate palettes with harmony rules, lock and edit swatches, extract colors from an image, check WCAG contrast and color-blind safety.",
    "tags": [
      "design",
      "color",
      "a11y"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/color-palette-generator.html"
    }
  },
  {
    "slug": "css-playground",
    "kind": "tool",
    "status": "live",
    "title": "CSS Playground",
    "category": "Design & Media",
    "type": "tool",
    "icon": "✨",
    "summary": "Visually build gradients, layered shadows and border-radius blobs, then copy production-ready CSS.",
    "tags": [
      "design",
      "CSS",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/css-playground.html"
    }
  },
  {
    "slug": "image-converter",
    "kind": "tool",
    "status": "live",
    "title": "Image Converter & Resizer",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🎞️",
    "summary": "Convert, resize and compress images right in your browser — nothing is uploaded, and private EXIF data is stripped along the way.",
    "tags": [
      "images",
      "privacy",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/image-converter.html"
    }
  },
  {
    "slug": "qr-code-generator",
    "kind": "tool",
    "status": "live",
    "title": "QR Code Generator",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🔳",
    "summary": "Make QR codes for links, Wi-Fi, email, phone or text with custom colors and sizes; download as PNG or SVG.",
    "tags": [
      "QR",
      "PNG/SVG",
      "sharing"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/qr-code-generator.html"
    }
  },
  {
    "slug": "markdown-previewer",
    "kind": "tool",
    "status": "live",
    "title": "Markdown Previewer",
    "category": "Design & Media",
    "type": "tool",
    "icon": "📝",
    "summary": "Write Markdown with a live side-by-side preview and export clean HTML — drafts autosave as you type.",
    "tags": [
      "writing",
      "markdown",
      "export"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/markdown-previewer.html"
    }
  },
  {
    "slug": "equation-solver",
    "kind": "tool",
    "status": "live",
    "title": "Equation Solver",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "🧮",
    "summary": "Solve linear and quadratic equations step by step, with every move explained like a patient teacher — and the answer checked at the end.",
    "tags": [
      "teaching",
      "math",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/equation-solver.html"
    }
  },
  {
    "slug": "unit-converter",
    "kind": "tool",
    "status": "live",
    "title": "Unit Converter",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "📏",
    "summary": "Convert length, area, temperature, running pace and more across 12 categories — including the GIS units nobody remembers.",
    "tags": [
      "units",
      "GIS",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/unit-converter.html"
    }
  },
  {
    "slug": "vacation-selector",
    "kind": "tool",
    "status": "live",
    "title": "Vacation Selector",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "🏝️",
    "summary": "A short, adaptive survey — each page tailored to your last answers — matches you to travel destinations from a curated set of ~85 places worldwide, with shareable results.",
    "tags": [
      "travel",
      "quiz",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/vacation-selector.html"
    }
  },
  {
    "slug": "decision-wheel",
    "kind": "tool",
    "status": "live",
    "title": "Decision Wheel",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "🎡",
    "summary": "Can't decide? Type your options and spin the wheel — confetti included. Share a link so the group can't blame you.",
    "tags": [
      "fun",
      "random",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/decision-wheel.html"
    }
  }
];
