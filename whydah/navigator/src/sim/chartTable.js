// chartTable.js — the navigator's hand-drawn chart. A full-screen parchment you
// visit (press M) showing your DEAD-RECKONED position and track plotted on a
// sketchy coastline. It never shows the truth — only what you've reckoned.

import { makeProjector, mercatorY } from "../geo.js";

const NS = "http://www.w3.org/2000/svg";
const DEG = Math.PI / 180;
const el = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const polysOf = (g) =>
  g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];

export function createChartTable(scenario, coastline) {
  const overlay = document.getElementById("chart-overlay");
  const svg = document.getElementById("chart-svg");
  const b = scenario.bounds;
  const W = 1000;
  const H = Math.round((W * (mercatorY(b.north) - mercatorY(b.south))) / ((b.east - b.west) * DEG));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const proj = makeProjector(b, W, H);

  // Hand-drawn wobble filter applied to the static ink.
  const defs = el("defs", {}, svg);
  const filter = el("filter", { id: "ct-sketch", x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
  el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.012", numOctaves: "2", seed: "7", result: "n" }, filter);
  el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: "6" }, filter);

  const ink = el("g", { filter: "url(#ct-sketch)" }, svg);

  // Latitude/longitude grid
  for (let lat = Math.ceil(b.south / 2) * 2; lat <= b.north; lat += 2) {
    const a = proj.toPixel(b.west, lat), c = proj.toPixel(b.east, lat);
    el("line", { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: "ct-grid" }, ink);
    const tx = el("text", { x: 8, y: a.y - 3, class: "ct-grid-label" }, ink);
    tx.textContent = `${lat}°N`;
  }
  for (let lon = Math.ceil(b.west / 2) * 2; lon <= b.east; lon += 2) {
    const a = proj.toPixel(lon, b.north), c = proj.toPixel(lon, b.south);
    el("line", { x1: a.x, y1: a.y, x2: c.x, y2: c.y, class: "ct-grid" }, ink);
  }

  // Coastline (known) — drawn as sketchy land.
  for (const ft of coastline.features) {
    for (const poly of polysOf(ft.geometry)) {
      const d = poly
        .map((ring) => ring.map(([lo, la], i) => {
          const p = proj.toPixel(lo, la);
          return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }).join(" ") + " Z")
        .join(" ");
      el("path", { d, class: "ct-land", "fill-rule": "evenodd" }, ink);
    }
  }

  // Known landmarks (the named places a chart would show).
  for (const o of scenario.objectives) {
    const p = proj.toPixel(o.lon, o.lat);
    el("circle", { cx: p.x, cy: p.y, r: 3, class: "ct-place" }, ink);
    const tx = el("text", { x: p.x + 6, y: p.y + 3, class: "ct-place-label" }, ink);
    tx.textContent = o.name;
  }

  // Dynamic DR layer (crisp, over the ink).
  const drLayer = el("g", {}, svg);

  function updateDR(nav) {
    drLayer.replaceChildren();
    const track = nav.drTrack;
    if (track.length > 1) {
      const pts = track.map((p) => {
        const q = proj.toPixel(p.lon, p.lat);
        return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      }).join(" ");
      el("polyline", { points: pts, class: "ct-track" }, drLayer);
    }
    const d = nav.dr;
    const q = proj.toPixel(d.lon, d.lat);
    el("circle", { cx: q.x, cy: q.y, r: 6, class: "ct-ship" }, drLayer);
    const tx = el("text", { x: q.x + 10, y: q.y + 4, class: "ct-ship-label" }, drLayer);
    tx.textContent = "where I reckon I am";
  }

  let open = false;
  function toggle(nav) {
    open = !open;
    overlay.style.display = open ? "flex" : "none";
    if (open) updateDR(nav);
    return open;
  }

  return { toggle, updateDR, isOpen: () => open };
}
