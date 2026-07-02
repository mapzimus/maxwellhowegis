# Salem Photography Walks

An interactive Leaflet map of walkable photography spots around Collins
Middle School in Salem, MA — nature, historic, urban, and train-watching
locations, color-coded by category and each with a walking time/distance
readout from the school. A **walk-shed overlay** (5/10/15-minute isochrone
rings from Collins, via the FOSSGIS Valhalla pedestrian routing API) shows
which spots are realistically reachable on foot versus a stretch pick, and
spots near the edge of the shed are flagged as such. Built for a Collins
Middle School education project, with a toolbar to reset the view and
export the spot list as GeoJSON.

**Data sources:** photo-spot coordinates and metadata are inlined directly
in `index.html` (not fetched at runtime); the walk-shed isochrone comes
live from FOSSGIS's public Valhalla instance. Leaflet 1.9.4 + Tabler Icons
for the map and UI chrome.
