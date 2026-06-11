// leadline.js — heave the lead to sound the depth. The reading comes from your TRUE
// position's distance to land, so the bottom shoals as you near a coast — both a
// collision warning and the clue that betrays your hidden longitude.

import { distanceNm } from "../geo.js";

const NS = "http://www.w3.org/2000/svg";
const el = (t, a = {}, p = null) => {
  const n = document.createElementNS(NS, t);
  for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
  if (p) p.appendChild(n);
  return n;
};
function line(parent, parts) {
  const div = document.createElement("div");
  for (const p of parts) {
    if (typeof p === "string") div.appendChild(document.createTextNode(p));
    else if (p.b != null) { const b = document.createElement("b"); b.textContent = p.b; div.appendChild(b); }
  }
  parent.appendChild(div);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const MARKS = [2, 3, 5, 7, 10, 13, 15, 17, 20]; // leather/cloth marks on a real lead line
const BOTTOMS = ["soft grey mud", "fine white sand", "coarse sand and shells", "sticky black ooze", "rock and weed", "red coral sand"];
const SURFACE = 60;
const SCALE_MAX = 40; // fathoms shown on the scale

export function createLeadline(nav, coastline, hazards) {
  const overlay = document.getElementById("leadline-overlay");
  const svg = document.getElementById("lead-svg");
  const result = document.getElementById("lead-result");
  const heaveBtn = document.getElementById("lead-heave");
  const closeBtn = document.getElementById("lead-close");

  // Flatten coastline vertices for a cheap distance-to-land.
  const verts = [];
  for (const f of coastline.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) for (const c of ring) verts.push({ lon: c[0], lat: c[1] });
  }

  // Visual: a water column with a fathom scale and a sinking lead.
  el("rect", { x: 0, y: 0, width: 300, height: SURFACE, fill: "#cfe0ec" }, svg);
  el("rect", { x: 0, y: SURFACE, width: 300, height: 420 - SURFACE, fill: "#1f5b7d" }, svg);
  el("line", { x1: 0, y1: SURFACE, x2: 300, y2: SURFACE, stroke: "#0e3047", "stroke-width": 2 }, svg);
  for (let fa = 5; fa <= SCALE_MAX; fa += 5) {
    const y = SURFACE + (fa / SCALE_MAX) * 340;
    el("line", { x1: 246, y1: y, x2: 266, y2: y, stroke: "#bcd2e0", "stroke-width": 1.5 }, svg);
    const tx = el("text", { x: 270, y: y + 4, class: "lead-tick" }, svg);
    tx.textContent = fa;
  }
  const rope = el("line", { x1: 150, y1: 16, x2: 150, y2: SURFACE, class: "lead-rope" }, svg);
  const lead = el("path", { class: "lead-weight" }, svg);
  function setLead(y) {
    rope.setAttribute("y2", y);
    lead.setAttribute("d", `M150,${y} l-7,-13 l14,0 z`);
  }
  setLead(SURFACE);

  let open = false, running = false, raf = 0;

  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function nearestNm(p) {
    let m = Infinity;
    for (const v of verts) { const d = distanceNm(p, v); if (d < m) m = d; }
    return m;
  }
  function sound() {
    const p = nav.true;
    if (hazards.some((h) => pointInPoly(p, h.polygon))) {
      return { depth: 2 + Math.floor(Math.random() * 4), danger: true, bottom: pick(BOTTOMS) };
    }
    const d = nearestNm(p);
    if (d > 50) return { depth: null };
    const depth = Math.max(3, Math.round(d * 1.4));
    return { depth, danger: depth < 7, bottom: pick(BOTTOMS) };
  }

  function finish(s) {
    running = false;
    result.replaceChildren();
    if (s.depth == null) {
      line(result, [{ b: "No ground at a hundred fathoms." }]);
      line(result, ["Only the deep — you are well offshore."]);
      return;
    }
    const call = MARKS.includes(s.depth) ? "By the mark" : "By the deep";
    line(result, [{ b: `${call}, ${s.depth}!` }, ` — ${s.bottom}.`]);
    if (s.danger) line(result, [{ b: "Shoal water — haul off!" }]);
  }
  function heave() {
    if (running) return;
    running = true;
    result.replaceChildren();
    const s = sound();
    const targetY = s.depth == null ? 404 : SURFACE + (Math.min(s.depth, SCALE_MAX) / SCALE_MAX) * 340;
    const t0 = performance.now();
    (function anim() {
      const f = Math.min(1, (performance.now() - t0) / 1200);
      setLead(SURFACE + (targetY - SURFACE) * f);
      if (f < 1) raf = requestAnimationFrame(anim);
      else finish(s);
    })();
  }

  heaveBtn.addEventListener("click", heave);
  function setOpen(v) {
    open = v;
    overlay.style.display = v ? "flex" : "none";
    if (v) { result.replaceChildren(); setLead(SURFACE); }
    else { running = false; cancelAnimationFrame(raf); }
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
