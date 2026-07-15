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
    "slug": "weather",
    "kind": "tool",
    "status": "live",
    "title": "Weather",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "⛅",
    "summary": "Current conditions, a 24-hour strip with sparkline, a 7-day forecast and a live precipitation radar for any place — offline caching, °C/°F toggle.",
    "tags": [
      "weather",
      "radar",
      "no key"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/weather.html"
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
    "slug": "moon-calculator",
    "kind": "tool",
    "status": "live",
    "title": "Moon Calculator",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🌙",
    "summary": "Moonrise, moonset, phase and illumination for any place and date, with a live moon disc and a month of phases at a glance.",
    "tags": [
      "astronomy",
      "outdoors",
      "photography"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/moon-calculator.html"
    }
  },
  {
    "slug": "elevation-profiler",
    "kind": "tool",
    "status": "live",
    "title": "Elevation Profiler",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "⛰️",
    "summary": "Draw a route on the map and see the terrain profile under it — distance, climb, descent and steepest grade.",
    "tags": [
      "GIS",
      "hiking",
      "Open-Meteo"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/elevation-profiler.html"
    }
  },
  {
    "slug": "radius-buffer-tool",
    "kind": "tool",
    "status": "live",
    "title": "Radius & Buffer Tool",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "⭕",
    "summary": "Drop a pin and draw accurate distance rings around it — true geodesic circles, not flat-map approximations — then export GeoJSON.",
    "tags": [
      "GIS",
      "buffers",
      "Leaflet"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/radius-buffer-tool.html"
    }
  },
  {
    "slug": "flight-route-plotter",
    "kind": "tool",
    "status": "live",
    "title": "Flight Route Plotter",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "✈️",
    "summary": "Build a multi-leg route between airports and cities, see true great-circle paths with distances and flight times.",
    "tags": [
      "travel",
      "great circle",
      "Leaflet"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/flight-route-plotter.html"
    }
  },
  {
    "slug": "map-projection-explorer",
    "kind": "tool",
    "status": "live",
    "title": "Map Projection Explorer",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🌐",
    "summary": "See the world in 19 map projections, visualize distortion with Tissot's indicatrix, and compare Mercator vs Gall-Peters side by side.",
    "tags": [
      "GIS",
      "projections",
      "D3"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/map-projection-explorer.html"
    }
  },
  {
    "slug": "geojson-diff-viewer",
    "kind": "tool",
    "status": "live",
    "title": "GeoJSON Diff Viewer",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🆚",
    "summary": "Compare two GeoJSON files — added, removed and changed features matched by ID or geometry, shown on a map and in a detail list.",
    "tags": [
      "GIS",
      "GeoJSON",
      "diff"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/geojson-diff-viewer.html"
    }
  },
  {
    "slug": "choropleth-map-builder",
    "kind": "tool",
    "status": "live",
    "title": "Choropleth Map Builder",
    "category": "Maps & GIS",
    "type": "tool",
    "icon": "🗺️",
    "summary": "Paste CSV data keyed by US state or country, fuzzy-match it to real geography, and get a colored choropleth map with a legend — export SVG or PNG.",
    "tags": [
      "GIS",
      "choropleth",
      "D3"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/choropleth-map-builder.html"
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
    "slug": "regex-tester",
    "kind": "tool",
    "status": "live",
    "title": "Regex Tester & Extractor",
    "category": "Data",
    "type": "tool",
    "icon": "🔤",
    "summary": "Write a regex, see live match highlighting and a capture-group table, then replace or extract — with a built-in cheatsheet and example patterns.",
    "tags": [
      "data",
      "regex",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/regex-tester.html"
    }
  },
  {
    "slug": "json-tree-explorer",
    "kind": "tool",
    "status": "live",
    "title": "JSON Tree Explorer",
    "category": "Data",
    "type": "tool",
    "icon": "🌳",
    "summary": "Paste JSON and explore it as a collapsible tree — search keys and values, copy any path, and pluck values out of arrays of objects.",
    "tags": [
      "data",
      "JSON",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/json-tree-explorer.html"
    }
  },
  {
    "slug": "pivot-table-explorer",
    "kind": "tool",
    "status": "live",
    "title": "Pivot Table Explorer",
    "category": "Data",
    "type": "tool",
    "icon": "🧾",
    "summary": "Load a CSV and drag or click fields into Rows, Columns, Values and Filters for a live pivot table — nested groups, subtotals, a quick chart.",
    "tags": [
      "data",
      "CSV",
      "pivot"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/pivot-table-explorer.html"
    }
  },
  {
    "slug": "data-anonymizer",
    "kind": "tool",
    "status": "live",
    "title": "Data Anonymizer",
    "category": "Data",
    "type": "tool",
    "icon": "🕶️",
    "summary": "Mask or fake-replace sensitive CSV columns — shuffle, hash, redact, add noise — with reproducible seeding and a k-anonymity check.",
    "tags": [
      "data",
      "privacy",
      "CSV"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/data-anonymizer.html"
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
    "slug": "favicon-generator",
    "kind": "tool",
    "status": "live",
    "title": "Favicon Generator",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🔖",
    "summary": "Make a complete favicon set from an emoji, letters or an image — real multi-size .ico, all the PNGs, manifest and HTML tags.",
    "tags": [
      "web dev",
      "icons",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/favicon-generator.html"
    }
  },
  {
    "slug": "flag-designer-studio",
    "kind": "tool",
    "status": "live",
    "title": "Flag Designer Studio",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🚩",
    "summary": "Design a flag from real vexillological building blocks and get live feedback against NAVA's \"good flag\" principles. Export SVG or PNG.",
    "tags": [
      "design",
      "flags",
      "SVG"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/flag-designer-studio.html"
    }
  },
  {
    "slug": "pixel-sprite-studio",
    "kind": "tool",
    "status": "live",
    "title": "Pixel Sprite Studio",
    "category": "Design & Media",
    "type": "tool",
    "icon": "👾",
    "summary": "Draw pixel art with retro palettes (Game Boy, NES, PICO-8), animate across frames, and export PNG, sprite sheets or animated GIF.",
    "tags": [
      "pixel art",
      "retro",
      "GIF"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/pixel-sprite-studio.html"
    }
  },
  {
    "slug": "flag-analyzer",
    "kind": "tool",
    "status": "live",
    "title": "Flag Analyzer",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🔍",
    "summary": "Drop in any flag image and get its dominant colors and percentages, aspect ratio, symmetry scores and a NAVA critique — companion to the Flag Designer.",
    "tags": [
      "flags",
      "color",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/flag-analyzer.html"
    }
  },
  {
    "slug": "svg-pattern-generator",
    "kind": "tool",
    "status": "live",
    "title": "SVG Pattern Generator",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🔷",
    "summary": "Design a seamless tileable pattern — dots, stripes, hexagons, waves and more — preview it tiled, then export SVG, CSS or PNG.",
    "tags": [
      "design",
      "SVG",
      "patterns"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/svg-pattern-generator.html"
    }
  },
  {
    "slug": "crt-effect-lab",
    "kind": "tool",
    "status": "live",
    "title": "CRT Effect Lab",
    "category": "Design & Media",
    "type": "tool",
    "icon": "📺",
    "summary": "Apply retro CRT effects — scanlines, curvature, phosphor glow, chromatic aberration — to text or an image, then copy the CSS or export a PNG.",
    "tags": [
      "retro",
      "CSS",
      "effects"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/crt-effect-lab.html"
    }
  },
  {
    "slug": "chiptune-sfx-lab",
    "kind": "tool",
    "status": "live",
    "title": "Chiptune SFX Lab",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🎮",
    "summary": "Design retro 8-bit sound effects — sfxr-style presets, waveform, envelope, slides and bit-crushing — and export a WAV.",
    "tags": [
      "audio",
      "retro",
      "WAV"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/chiptune-sfx-lab.html"
    }
  },
  {
    "slug": "flag-look-alike-finder",
    "kind": "tool",
    "status": "live",
    "title": "Flag Look-Alike Finder",
    "category": "Design & Media",
    "type": "tool",
    "icon": "🏳️",
    "summary": "Design or pick a flag and find its closest real-world matches by color, layout and charges — a similarity score flags \"too close\" designs.",
    "tags": [
      "flags",
      "design",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/flag-look-alike-finder.html"
    }
  },
  {
    "slug": "seating-chart-generator",
    "kind": "tool",
    "status": "live",
    "title": "Seating Chart Generator",
    "category": "Teaching",
    "type": "tool",
    "icon": "🪑",
    "summary": "Paste a roster, pick rows, pods or a U-shape, add constraints — keep these two apart, lock her to the front row — and shuffle until the chart works.",
    "tags": [
      "teaching",
      "constraints",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/seating-chart-generator.html"
    }
  },
  {
    "slug": "probability-lab",
    "kind": "tool",
    "status": "live",
    "title": "Probability Lab",
    "category": "Teaching",
    "type": "tool",
    "icon": "🎲",
    "summary": "Run coins, dice, spinners, cards, urns and the birthday paradox — and watch empirical results converge to the exact theory in live charts.",
    "tags": [
      "teaching",
      "statistics",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/probability-lab.html"
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
  },
  {
    "slug": "soccer-tactics-board",
    "kind": "tool",
    "status": "live",
    "title": "Soccer Tactics Board",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "⚽",
    "summary": "Set up formations on a scale pitch, drag players, draw movement and passing runs, animate a move across frames, then export or share.",
    "tags": [
      "soccer",
      "tactics",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/soccer-tactics-board.html"
    }
  },
  {
    "slug": "tournament-bracket-builder",
    "kind": "tool",
    "status": "live",
    "title": "Tournament Bracket Builder",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "🏆",
    "summary": "Build single- or double-elimination brackets or a round-robin league, enter results, and watch standings and the champion emerge. Works for any contest.",
    "tags": [
      "tournaments",
      "sports",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/tournament-bracket-builder.html"
    }
  },
  {
    "slug": "shot-map-xg",
    "kind": "tool",
    "status": "live",
    "title": "Shot Map & xG Visualizer",
    "category": "Fun & Learning",
    "type": "tool",
    "icon": "⚽",
    "summary": "Click a pitch to log shots and watch Expected Goals compute live from distance and angle — a shot map plus a cumulative xG race chart.",
    "tags": [
      "soccer",
      "xG",
      "no deps"
    ],
    "links": {
      "live": "https://mapzimus.github.io/max/shot-map-xg.html"
    }
  }
];
