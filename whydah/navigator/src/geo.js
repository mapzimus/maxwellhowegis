// geo.js — convert between geographic coordinates (lat/lon) and screen pixels,
// plus the small bits of navigation math the game needs. Pure functions only:
// same inputs always give the same outputs, with no side effects.

const DEG = Math.PI / 180;
const EARTH_RADIUS_NM = 3440.065; // nautical miles (1 nm = 1 minute of latitude)

// Mercator stretches latitude through this vertical scale so that a course held
// at a constant compass bearing draws as a straight line — the reason real
// nautical charts use this projection.
export function mercatorY(latDeg) {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * DEG) / 2));
}

// Build a projector bound to a geographic window (bounds) and a pixel size.
// Returns { toPixel(lon,lat) -> {x,y}, toGeo(x,y) -> {lon,lat} }.
export function makeProjector(bounds, width, height) {
  const yNorth = mercatorY(bounds.north);
  const ySouth = mercatorY(bounds.south);
  const lonSpan = bounds.east - bounds.west;
  const ySpan = yNorth - ySouth;

  return {
    toPixel(lon, lat) {
      return {
        x: ((lon - bounds.west) / lonSpan) * width,
        y: ((yNorth - mercatorY(lat)) / ySpan) * height,
      };
    },
    toGeo(x, y) {
      const lon = bounds.west + (x / width) * lonSpan;
      const yMerc = yNorth - (y / height) * ySpan;
      const lat = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) / DEG;
      return { lon, lat };
    },
  };
}

// --- Navigation math (speeds in knots = nautical miles per hour) ---

// Split a speed + compass heading into north/east velocity components.
// Heading is degrees clockwise from north: 0 = N, 90 = E, 180 = S, 270 = W.
export function headingToComponents(speed, headingDeg) {
  const h = headingDeg * DEG;
  return { north: speed * Math.cos(h), east: speed * Math.sin(h) };
}

// Recombine north/east components into { speed, headingDeg } (for read-outs).
export function componentsToHeading(north, east) {
  const speed = Math.hypot(north, east);
  let headingDeg = Math.atan2(east, north) / DEG;
  if (headingDeg < 0) headingDeg += 360;
  return { speed, headingDeg };
}

// Advance a position by north/east velocity (knots) over a time step (hours).
// "Plane sailing" approximation — accurate for the small steps the sim takes.
export function stepPosition(pos, north, east, hours) {
  const dLat = (north * hours) / 60; // 60 nm per degree of latitude
  const dLon = (east * hours) / (60 * Math.cos(pos.lat * DEG)); // lon shrinks with lat
  return { lat: pos.lat + dLat, lon: pos.lon + dLon };
}

// Great-circle distance between two {lat,lon} points, in nautical miles (haversine).
export function distanceNm(a, b) {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(s));
}

// Initial great-circle bearing from a to b, in compass degrees (0-360).
export function bearingDeg(a, b) {
  const dLon = (b.lon - a.lon) * DEG;
  const y = Math.sin(dLon) * Math.cos(b.lat * DEG);
  const x =
    Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) -
    Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}
