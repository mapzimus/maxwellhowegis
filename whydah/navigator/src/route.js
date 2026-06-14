// route.js — the planned course: an ordered list of legs, each a heading +
// distance, starting from the voyage's start point. It computes the waypoints
// (reusing the same plane-sailing math the ship will sail) and draws the route.

import { headingToComponents, stepPosition } from "./geo.js";

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

export function createRoute(start, proj, layer) {
  const legs = []; // each: { headingDeg, distNm }

  // Walk the legs from the start, producing the list of waypoint positions.
  function waypoints() {
    const pts = [{ lat: start.lat, lon: start.lon }];
    let pos = pts[0];
    for (const leg of legs) {
      const v = headingToComponents(leg.distNm, leg.headingDeg); // nm north/east
      pos = stepPosition(pos, v.north, v.east, 1); // advance one "hour" of nm
      pts.push(pos);
    }
    return pts;
  }

  function end() {
    const pts = waypoints();
    return pts[pts.length - 1];
  }
  function totalNm() {
    return legs.reduce((sum, l) => sum + l.distNm, 0);
  }

  function render() {
    layer.replaceChildren();
    const px = waypoints().map((p) => proj.toPixel(p.lon, p.lat));

    if (px.length > 1) {
      el("polyline", {
        points: px.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
        class: "route-line",
      }, layer);
    }
    // per-leg heading/distance labels at each leg's midpoint
    for (let i = 0; i < legs.length; i++) {
      const a = px[i], b = px[i + 1];
      const t = el("text", { x: (a.x + b.x) / 2 + 6, y: (a.y + b.y) / 2, class: "route-label" }, layer);
      t.textContent = `${String(Math.round(legs[i].headingDeg)).padStart(3, "0")}° · ${Math.round(legs[i].distNm)} nm`;
    }
    // waypoint dots (skip the start, which already has its objective marker)
    px.forEach((p, i) => {
      if (i > 0) el("circle", { cx: p.x, cy: p.y, r: 3.5, class: "route-wp" }, layer);
    });
    // the ship sits at the end of the plotted route
    const last = px[px.length - 1];
    el("circle", { cx: last.x, cy: last.y, r: 5, class: "route-ship" }, layer);
  }

  function addLeg(headingDeg, distNm) {
    legs.push({ headingDeg, distNm });
    render();
  }
  function undo() {
    legs.pop();
    render();
  }
  function clear() {
    legs.length = 0;
    render();
  }

  render();
  return { addLeg, undo, clear, end, totalNm, legs, waypoints };
}
