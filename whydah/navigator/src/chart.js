// chart.js — draw the nautical chart into an SVG element using a projector.
// Each part of the map lives in its own <g> layer so later milestones can add
// a route layer and a ship layer on top without disturbing the basemap.

const SVGNS = "http://www.w3.org/2000/svg";

// Small helper: make an SVG element with attributes, optionally append it.
function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

// A compass direction (degrees) + a length -> screen delta. On screen y grows
// downward, so north (0°) must point up: dy is negative.
function dirToDelta(dirDeg, len) {
  const r = (dirDeg * Math.PI) / 180;
  return { dx: Math.sin(r) * len, dy: -Math.cos(r) * len };
}

// Turn a ring of [lon,lat] points into an SVG path string.
function ringToPath(ring, proj) {
  return (
    ring
      .map(([lon, lat], i) => {
        const p = proj.toPixel(lon, lat);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

function text(g, x, y, str, cls) {
  const t = el("text", { x, y, class: cls }, g);
  t.textContent = str;
  return t;
}

export function drawChart(svg, proj, scenario, coastline, size) {
  // Arrowhead marker, shared by every current/wind arrow.
  const defs = el("defs", {}, svg);
  const marker = el(
    "marker",
    {
      id: "cur-arrow", viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse",
    },
    defs
  );
  el("path", { d: "M0,0 L10,5 L0,10 z", fill: "#2c6fae" }, marker);

  const layers = {};
  for (const name of ["grid", "land", "hazard", "current", "marks", "labels"]) {
    layers[name] = el("g", { class: `layer-${name}` }, svg);
  }

  drawGraticule(layers.grid, proj, scenario.bounds, size);
  drawLand(layers.land, proj, coastline);
  drawHazards(layers.hazard, proj, scenario.hazards || []);
  drawCurrents(layers.current, proj, scenario.currentField.cells);
  drawWind(layers.current, scenario.wind, size);
  drawObjectives(layers.marks, proj, scenario.objectives || []);
  drawLabels(layers.labels, proj, scenario.labels || []);
  return layers;
}

function drawGraticule(g, proj, b, size) {
  for (let lat = Math.ceil(b.south / 2) * 2; lat <= b.north; lat += 2) {
    const a = proj.toPixel(b.west, lat), c = proj.toPixel(b.east, lat);
    el("line", { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: "grid-line" }, g);
    text(g, 5, a.y - 3, `${lat}°N`, "grid-label");
  }
  for (let lon = Math.ceil(b.west / 3) * 3; lon <= b.east; lon += 3) {
    const a = proj.toPixel(lon, b.north), c = proj.toPixel(lon, b.south);
    el("line", { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: "grid-line" }, g);
    text(g, a.x + 4, size.height - 7, `${Math.abs(lon)}°W`, "grid-label");
  }
}

// A GeoJSON geometry can be a Polygon or a MultiPolygon; normalize to a list
// of polygons, each itself a list of rings (outer ring first, then any holes).
function polygonsOf(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function drawLand(g, proj, coastline) {
  for (const f of coastline.features) {
    for (const poly of polygonsOf(f.geometry)) {
      // Draw all rings as one path; even-odd fill turns inner rings into holes.
      const d = poly.map((ring) => ringToPath(ring, proj)).join(" ");
      el("path", { d, class: "land", "fill-rule": "evenodd" }, g);
    }
  }
}

function drawHazards(g, proj, hazards) {
  for (const h of hazards) {
    el("path", { d: ringToPath(h.polygon, proj), class: "hazard" }, g);
  }
}

function drawCurrents(g, proj, cells) {
  for (const c of cells) {
    const p = proj.toPixel(c.lon, c.lat);
    const { dx, dy } = dirToDelta(c.dirDeg, 8 + c.speedKn * 12);
    el(
      "line",
      {
        x1: p.x, y1: p.y, x2: p.x + dx, y2: p.y + dy,
        class: c.speedKn >= 1.5 ? "current strong" : "current",
        "marker-end": "url(#cur-arrow)",
      },
      g
    );
  }
}

function drawWind(g, wind, size) {
  if (!wind) return;
  const ox = size.width - 64, oy = 46;
  const { dx, dy } = dirToDelta(wind.toDeg, 26);
  el("line", { x1: ox, y1: oy, x2: ox + dx, y2: oy + dy, class: "wind", "marker-end": "url(#cur-arrow)" }, g);
  text(g, ox, oy - 16, "wind", "wind-label");
}

// Draw every voyage objective from the data, styled by its type (start / landmark
// / required / bonus / final). Objectives with a radius also get a dashed zone ring.
function drawObjectives(g, proj, objectives) {
  for (const o of objectives) {
    const p = proj.toPixel(o.lon, o.lat);
    if (o.radiusNm) {
      const edge = proj.toPixel(o.lon, o.lat + o.radiusNm / 60); // radiusNm to the north
      const r = Math.hypot(p.x - edge.x, p.y - edge.y);
      el("circle", { cx: p.x, cy: p.y, r: r.toFixed(1), class: `zone zone-${o.type}` }, g);
    }
    el("circle", { cx: p.x, cy: p.y, r: o.type === "landmark" ? 3.5 : 6, class: `obj obj-${o.type}` }, g);
    text(g, p.x + 11, p.y + 4, o.name, `obj-label obj-${o.type}`);
  }
}

// Static place labels (capes, perils) so landmarks read even at this zoom.
function drawLabels(g, proj, labels) {
  for (const lb of labels) {
    const p = proj.toPixel(lb.lon, lb.lat);
    const kind = lb.kind || "mark";
    el("circle", { cx: p.x, cy: p.y, r: 2.6, class: `place place-${kind}` }, g);
    text(g, p.x + 7, p.y + 4, lb.text, `place-label place-${kind}`);
  }
}
