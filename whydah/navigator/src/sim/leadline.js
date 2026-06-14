// leadline.js — heave the lead to sound the depth. The reading comes from your TRUE
// position's distance to land, so the bottom shoals as you near a coast — both a
// collision warning and the clue that betrays your hidden longitude. The cast is a
// skill: hold Heave to swing (an oscillating power meter — sea state speeds it),
// release to cast, then watch the line pay out with its marks streaming past. When
// the lead strikes, the line falls slack and the marks stop — call the mark within
// half a second and the sounding is true; stand too long and the drift over-reads it.

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
    else if (p.i != null) { const i = document.createElement("i"); i.textContent = p.i; div.appendChild(i); }
  }
  parent.appendChild(div);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const MARKS = [2, 3, 5, 7, 10, 13, 15, 17, 20]; // leather/cloth marks on a real lead line
const BOTTOMS = ["soft grey mud", "fine white sand", "coarse sand and shells", "sticky black ooze", "rock and weed", "red coral sand"];
const SURFACE = 60;
const SCALE_MAX = 40; // fathoms shown on the scale
const NO_GROUND = 100; // fathoms of line aboard — past this there is no bottom to find
const CALL_TRUE = 0.5; // seconds after bottom-touch within which the call is accurate
const CALL_LATE = 1.5; // beyond this the call is badly off

export function createLeadline(nav, coastline, hazards, getSeaState = () => 0.3) {
  const overlay = document.getElementById("leadline-overlay");
  const svg = document.getElementById("lead-svg");
  const result = document.getElementById("lead-result");
  const heaveBtn = document.getElementById("lead-heave");
  const callBtn = document.getElementById("lead-call");
  const closeBtn = document.getElementById("lead-close");

  // Flatten coastline vertices for a cheap distance-to-land.
  const verts = [];
  for (const f of coastline.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) for (const c of ring) verts.push({ lon: c[0], lat: c[1] });
  }

  // Visual: a water column with a fathom scale, a swing meter, and a sinking lead.
  el("rect", { x: 0, y: 0, width: 300, height: SURFACE, fill: "#cfe0ec" }, svg);
  el("rect", { x: 0, y: SURFACE, width: 300, height: 420 - SURFACE, fill: "#1f5b7d" }, svg);
  el("line", { x1: 0, y1: SURFACE, x2: 300, y2: SURFACE, stroke: "#0e3047", "stroke-width": 2 }, svg);
  for (let fa = 5; fa <= SCALE_MAX; fa += 5) {
    const y = SURFACE + (fa / SCALE_MAX) * 340;
    el("line", { x1: 246, y1: y, x2: 266, y2: y, stroke: "#bcd2e0", "stroke-width": 1.5 }, svg);
    const tx = el("text", { x: 270, y: y + 4, class: "lead-tick" }, svg);
    tx.textContent = fa;
  }
  // Swing meter — fill rises and falls while you hold; let go in the green.
  const meterFrame = el("rect", { x: 30, y: 14, width: 240, height: 14, rx: 4, class: "lead-meter-frame", visibility: "hidden" }, svg);
  const meterZone = el("rect", { x: 30 + 240 * 0.7, y: 16, width: 240 * 0.3 - 2, height: 10, rx: 3, class: "lead-meter-zone", visibility: "hidden" }, svg);
  const meterFill = el("rect", { x: 32, y: 16, width: 0, height: 10, rx: 3, class: "lead-meter-fill", visibility: "hidden" }, svg);
  const rope = el("path", { class: "lead-rope", fill: "none" }, svg);
  // One tag per mark on the line; they ride down with the lead as it pays out.
  const tags = MARKS.map((m) => {
    const g = { tick: el("line", { x1: 139, x2: 161, class: "lead-mark-tag", visibility: "hidden" }, svg),
                label: el("text", { x: 166, class: "lead-mark-label", visibility: "hidden" }, svg), m };
    g.label.textContent = m;
    return g;
  });
  const lead = el("path", { class: "lead-weight" }, svg);

  function leadY(depth) { return SURFACE + (Math.min(depth, SCALE_MAX) / SCALE_MAX) * 340; }
  function setLead(y, slack) {
    rope.setAttribute("d", slack
      ? `M150,16 L150,${(y - 30).toFixed(1)} C141,${(y - 20).toFixed(1)} 159,${(y - 10).toFixed(1)} 150,${y.toFixed(1)}`
      : `M150,16 L150,${y.toFixed(1)}`);
    lead.setAttribute("d", `M150,${y.toFixed(1)} l-7,-13 l14,0 z`);
  }
  function setTags(depth, show) {
    for (const g of tags) {
      const above = depth - g.m; // each mark rides that many fathoms above the lead
      const y = SURFACE + (above / SCALE_MAX) * 340;
      const vis = show && above >= 0 && y <= 400 ? "visible" : "hidden";
      g.tick.setAttribute("visibility", vis);
      g.label.setAttribute("visibility", vis);
      if (vis === "visible") {
        g.tick.setAttribute("y1", y.toFixed(1));
        g.tick.setAttribute("y2", y.toFixed(1));
        g.label.setAttribute("y", (y + 3.5).toFixed(1));
      }
    }
  }
  setLead(SURFACE, false);

  let open = false, raf = 0, lastT = 0;
  let sea = 0.3;
  // idle -> swing (holding) -> paying (line runs) -> settled (bottom felt) -> done
  let phase = "idle";
  let tSwing = 0, power = 0, weak = false;
  let s = null, depthNow = 0, vel = 0, tBottom = 0;

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

  function showMeter(v) {
    for (const node of [meterFrame, meterZone, meterFill]) node.setAttribute("visibility", v ? "visible" : "hidden");
  }
  function endCast() {
    phase = "done";
    callBtn.disabled = true;
    heaveBtn.disabled = false;
  }
  // withBottom: only a lead that truly struck brings up what the tallow held.
  function report(reported, note, withBottom) {
    result.replaceChildren();
    const call = MARKS.includes(reported) ? "By the mark" : "By the deep";
    line(result, [{ b: `${call}, ${reported}!` }, withBottom ? ` — ${s.bottom}.` : ""]);
    if (note) line(result, [{ i: note }]);
    if (weak) line(result, [{ i: "A short cast — the line trailed astern." }]);
    if (withBottom && reported < 7) line(result, [{ b: "Shoal water — haul off!" }]);
    endCast();
  }
  function noGround() {
    result.replaceChildren();
    line(result, [{ b: "No ground at a hundred fathoms." }]);
    line(result, ["Only the deep — you are well offshore."]);
    endCast();
  }

  function startSwing(e) {
    if (phase !== "idle" && phase !== "done") return;
    phase = "swing";
    tSwing = performance.now() / 1000;
    result.replaceChildren();
    setLead(SURFACE, false);
    setTags(0, false);
    showMeter(true);
    try { heaveBtn.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function release() {
    if (phase !== "swing") return;
    showMeter(false);
    if (power < 0.35) {
      phase = "idle";
      result.replaceChildren();
      line(result, [{ i: "The lead falls short. Swing her full, and let go at the top." }]);
      return;
    }
    weak = power < 0.6; // the line trails astern and over-reads by a fathom
    s = sound();
    depthNow = 0;
    vel = 0;
    phase = "paying";
    heaveBtn.disabled = true;
    callBtn.disabled = false;
  }
  function callMark() {
    if (phase === "paying") {
      // Called before the lead struck: you read whatever mark was at the rail.
      const reported = Math.max(1, Math.round(depthNow)) + (weak ? 1 : 0);
      report(reported, "The lead had not yet struck — your call falls short.", false);
      return;
    }
    if (phase !== "settled") return;
    const r = performance.now() / 1000 - tBottom;
    if (r <= CALL_TRUE) {
      report(s.depth + (weak ? 1 : 0), weak ? null : "A clean call — the line came up and down.", true);
    } else if (r <= CALL_LATE) {
      const over = 1 + Math.round((r - CALL_TRUE) * 2);
      report(s.depth + over + (weak ? 1 : 0), "The line drifts — your call is doubtful.", true);
    } else {
      const over = 4 + Math.min(8, Math.round((r - CALL_LATE) * 4));
      report(s.depth + over + (weak ? 1 : 0), "You stood too long — the line drifts far. The call is badly off.", true);
    }
  }

  // The instrument's own animation loop — the main world loop is frozen while open.
  function frame(now) {
    if (!open) return;
    const t = now / 1000;
    const dt = clamp(t - lastT, 0, 0.05);
    lastT = t;
    if (phase === "swing") {
      const period = 1.6 - 0.8 * sea; // a heavy sea hurries the swing
      power = (1 - Math.cos((2 * Math.PI * (t - tSwing)) / period)) / 2;
      meterFill.setAttribute("width", (236 * power).toFixed(1));
    } else if (phase === "paying") {
      // Fathoms per second — the sea hurries the pay-out, and past soundings the
      // line runs free so a no-bottom cast does not drag on.
      const vmax = 9 * (1 + 1.1 * sea) * (depthNow > SCALE_MAX ? 3 : 1);
      vel = Math.min(vmax, vel + 16 * (1 + sea) * dt);
      depthNow += vel * dt;
      if (s.depth != null && depthNow >= s.depth) {
        depthNow = s.depth;
        phase = "settled";
        tBottom = t;
        setLead(leadY(depthNow), true); // the line kinks slack — the only cue you get
      } else if (s.depth == null && depthNow >= NO_GROUND) {
        setTags(0, false);
        noGround();
      } else {
        setLead(leadY(depthNow), false);
      }
      if (phase !== "done") setTags(depthNow, true);
    }
    raf = requestAnimationFrame(frame);
  }

  heaveBtn.addEventListener("pointerdown", startSwing);
  heaveBtn.addEventListener("pointerup", release);
  heaveBtn.addEventListener("pointercancel", release);
  callBtn.addEventListener("click", callMark);

  function setOpen(v) {
    open = v;
    overlay.style.display = v ? "flex" : "none";
    if (v) {
      sea = clamp(getSeaState(), 0, 1);
      phase = "idle";
      result.replaceChildren();
      setLead(SURFACE, false);
      setTags(0, false);
      showMeter(false);
      heaveBtn.disabled = false;
      callBtn.disabled = true;
      lastT = performance.now() / 1000;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } else {
      phase = "idle";
      cancelAnimationFrame(raf);
    }
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
