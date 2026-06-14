// backstaff.js — a hands-on celestial sight that presents as the right instrument
// for the hour. By DAY it is a backstaff (Davis quadrant): you stand with your back
// to the sun and bring its shadow to the horizon; latitude = 90 - noon altitude +
// declination. By NIGHT it is a mariner's quadrant with a plumb-line: sight Polaris,
// whose altitude IS your latitude. The ship rolls under you: body and horizon sway
// on two summed sines whose amplitude follows the sea state, so the skill is holding
// the arm on a moving mark. Mark captures the instant's aim error:
// reportedAlt = trueMeanAlt + (armAngle - swayedBodyAngleAtMark). Enter on chart.

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent = null) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
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

const SWAY_P1 = 3.1, SWAY_P2 = 5.7; // roll periods (real seconds), deliberately unequal
const STEADY_TOL = 0.8; // degrees inside which the steadiness ring fills
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createBackstaff(nav, getSeaState = () => 0.3) {
  const overlay = document.getElementById("backstaff-overlay");
  const svg = document.getElementById("bs-svg");
  const titleEl = document.getElementById("bs-title");
  const tipEl = document.getElementById("bs-tip");
  const altOut = document.getElementById("bs-alt");
  const result = document.getElementById("bs-result");
  const markBtn = document.getElementById("bs-mark");
  const fixBtn = document.getElementById("bs-fix");
  const closeBtn = document.getElementById("bs-close");

  const O = { x: 150, y: 540 };
  const R = 470;
  const HORIZON = 540;
  const RING_R = 58;
  const RING_C = 2 * Math.PI * RING_R;
  const rad = (d) => (d * Math.PI) / 180;
  let measured = 20;
  let playerLat = null;
  let open = false;
  let mode = "sun";
  let current = null; // target cached at open (the world is frozen while we sight)
  let swayAmp = 0.5; // degrees, set from sea state on open
  let phase1 = 0, phase2 = 0; // randomized each open so the roll can't be memorized
  let bodyAngleNow = 20; // the body's swayed angle this frame — Mark reads this
  let steady = 0;
  let raf = 0, lastT = 0;

  const skyRect = el("rect", { x: 0, y: 0, width: 1000, height: HORIZON }, svg);
  const seaRect = el("rect", { x: 0, y: HORIZON, width: 1000, height: 640 - HORIZON }, svg);
  const horizonLine = el("line", { x1: 0, y1: HORIZON, x2: 1000, y2: HORIZON, "stroke-width": 3 }, svg);
  for (let a = 0; a <= 80; a += 10) {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    el("line", { x1: O.x + c * (R - 4), y1: O.y - s * (R - 4), x2: O.x + c * (R + 14), y2: O.y - s * (R + 14), stroke: "#caa45a", "stroke-width": 2 }, svg);
    const tx = el("text", { x: O.x + c * (R + 34), y: O.y - s * (R + 34) + 5, class: "bs-tick" }, svg);
    tx.textContent = `${a}°`;
  }
  const glow = el("circle", { r: 44 }, svg);
  const body = el("circle", { r: 24 }, svg);
  const ringBg = el("circle", { r: RING_R, class: "bs-steady-ring-bg" }, svg);
  const ring = el("circle", { r: RING_R, class: "bs-steady-ring" }, svg);
  const arm = el("line", { x1: O.x, y1: O.y, class: "bs-arm" }, svg);
  const handle = el("circle", { r: 13, class: "bs-handle" }, svg);
  el("circle", { cx: O.x, cy: O.y, r: 8, class: "bs-pivot" }, svg);
  // Plumb-line (shown only in the night quadrant) — it swings with the roll.
  const plumb = el("line", { x1: O.x, y1: O.y, x2: O.x, y2: O.y + 86, class: "bs-plumb", visibility: "hidden" }, svg);
  const plumbBob = el("circle", { cx: O.x, cy: O.y + 86, r: 6, class: "bs-plumb-bob", visibility: "hidden" }, svg);

  function colorScene() {
    const night = mode === "star";
    skyRect.setAttribute("fill", night ? "#0b1a2b" : "#a7c6df");
    seaRect.setAttribute("fill", night ? "#08131f" : "#27506b");
    horizonLine.setAttribute("stroke", night ? "#1c3145" : "#0e3047");
    body.setAttribute("class", night ? "bs-star" : "bs-sun");
    glow.setAttribute("class", night ? "bs-star-glow" : "bs-sun-glow");
    ring.setAttribute("stroke", night ? "#f0d877" : "#8a2e1c");
    plumb.setAttribute("visibility", night ? "visible" : "hidden");
    plumbBob.setAttribute("visibility", night ? "visible" : "hidden");
  }
  function placeBody(altDeg) {
    const x = O.x + Math.cos(rad(altDeg)) * (R - 48);
    const y = O.y - Math.sin(rad(altDeg)) * (R - 48);
    for (const node of [body, glow, ringBg, ring]) { node.setAttribute("cx", x); node.setAttribute("cy", y); }
    // Spin the ring so its fill grows from twelve o'clock.
    ring.setAttribute("transform", `rotate(-90 ${x.toFixed(1)} ${y.toFixed(1)})`);
  }
  function placeHorizon(swDeg) {
    // The instrument's arc stays fixed; the world heaves behind it.
    const y = HORIZON - swDeg * 4;
    skyRect.setAttribute("height", y);
    seaRect.setAttribute("y", y);
    seaRect.setAttribute("height", 640 - y);
    horizonLine.setAttribute("y1", y);
    horizonLine.setAttribute("y2", y);
  }
  function placeArm() {
    const x = O.x + Math.cos(rad(measured)) * R;
    const y = O.y - Math.sin(rad(measured)) * R;
    arm.setAttribute("x2", x); arm.setAttribute("y2", y);
    handle.setAttribute("cx", x); handle.setAttribute("cy", y);
    altOut.textContent = `${measured.toFixed(1)}°`;
  }
  function angleAt(e) {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 1000;
    const py = ((e.clientY - r.top) / r.height) * 640;
    return Math.max(0, Math.min(80, (Math.atan2(O.y - py, px - O.x) * 180) / Math.PI));
  }

  let dragging = false;
  svg.addEventListener("pointerdown", (e) => { dragging = true; measured = angleAt(e); placeArm(); try { svg.setPointerCapture(e.pointerId); } catch (_) {} });
  svg.addEventListener("pointermove", (e) => { if (dragging) { measured = angleAt(e); placeArm(); } });
  window.addEventListener("pointerup", () => { dragging = false; });

  // Which body is up to shoot right now?
  function target() {
    const s = nav.sun();
    if (s.altDeg < -4) return { mode: "star", altDeg: nav.true.lat };
    return { mode: "sun", altDeg: s.altDeg, dec: s.decDeg, noon: nav.nearNoon() };
  }

  // The roll: two summed sines, amplitude from the sea state (calm ±0.5°, gale ±6°).
  function swayDeg(t) {
    return swayAmp * (0.62 * Math.sin((2 * Math.PI * t) / SWAY_P1 + phase1) +
                      0.38 * Math.sin((2 * Math.PI * t) / SWAY_P2 + phase2));
  }

  // The instrument's own animation loop — the main world loop is frozen while open.
  function frame(now) {
    if (!open) return;
    const t = now / 1000;
    const dt = clamp(t - lastT, 0, 0.05);
    lastT = t;
    const sw = swayDeg(t);
    bodyAngleNow = clamp(current.altDeg + sw, 0, 80);
    placeBody(bodyAngleNow);
    placeHorizon(sw);
    if (mode === "star") {
      const pa = rad(sw * 1.5);
      plumb.setAttribute("x2", O.x + Math.sin(pa) * 86);
      plumb.setAttribute("y2", O.y + Math.cos(pa) * 86);
      plumbBob.setAttribute("cx", O.x + Math.sin(pa) * 86);
      plumbBob.setAttribute("cy", O.y + Math.cos(pa) * 86);
    }
    const err = Math.abs(measured - bodyAngleNow);
    // Glow swells as the arm closes on the body; the ring fills while you hold steady.
    const close = clamp(1 - err / 6, 0, 1);
    glow.setAttribute("r", (30 + 26 * close).toFixed(1));
    glow.setAttribute("opacity", (0.3 + 0.7 * close * close).toFixed(2));
    steady = err <= STEADY_TOL ? Math.min(1, steady + dt / 1.2) : Math.max(0, steady - dt / 0.45);
    ring.setAttribute("stroke-dasharray", `${(RING_C * steady).toFixed(1)} ${RING_C.toFixed(1)}`);
    raf = requestAnimationFrame(frame);
  }

  // How well you held her at the instant of the mark.
  function gradeLine(aimErr) {
    const e = Math.abs(aimErr);
    if (e < 0.3) return "A clean sight — steady hands.";
    if (e < 1) return "Fair.";
    return "She rolled as you marked.";
  }

  markBtn.addEventListener("click", () => {
    if (!current) return;
    const aimErr = measured - bodyAngleNow; // the error you froze into the brass
    result.replaceChildren();
    if (mode === "star") {
      const reportedAlt = current.altDeg + aimErr; // Polaris's altitude IS your latitude
      playerLat = reportedAlt;
      line(result, ["Polaris stands ", { b: `${reportedAlt.toFixed(1)}°` }, " above the horizon."]);
      line(result, ["Its height is your latitude: ", { b: `${playerLat.toFixed(2)}°N` }]);
      line(result, [{ i: gradeLine(aimErr) }]);
      fixBtn.disabled = false;
    } else {
      let reportedAlt;
      if (current.noon) {
        const meridianAlt = 90 - Math.abs(nav.true.lat - current.dec);
        reportedAlt = meridianAlt + aimErr;
      } else {
        reportedAlt = measured;
      }
      playerLat = 90 - reportedAlt + current.dec;
      line(result, ["Noon altitude ", { b: `${reportedAlt.toFixed(1)}°` }, " · declination ", { b: `${current.dec.toFixed(1)}°` }]);
      line(result, ["You reckon your latitude at ", { b: `${playerLat.toFixed(2)}°N` }]);
      if (current.noon) line(result, [{ i: gradeLine(aimErr) }]);
      else line(result, [{ i: "— but the sun is not yet at its noon height; this sight is unreliable." }]);
      fixBtn.disabled = !current.noon;
    }
  });

  fixBtn.addEventListener("click", () => {
    if (playerLat == null) return;
    nav.setDrLatitude(playerLat);
    line(result, [{ b: "Latitude entered on the chart." }]);
    fixBtn.disabled = true;
  });

  function setOpen(v) {
    open = v;
    overlay.style.display = v ? "flex" : "none";
    if (!v) { cancelAnimationFrame(raf); return; }
    const sea = clamp(getSeaState(), 0, 1);
    swayAmp = 0.5 + 5.5 * sea;
    phase1 = Math.random() * Math.PI * 2;
    phase2 = Math.random() * Math.PI * 2;
    current = target();
    mode = current.mode;
    colorScene();
    titleEl.textContent = mode === "star" ? "Shoot Polaris — the quadrant" : "Shoot the sun — the backstaff";
    tipEl.textContent = mode === "star"
      ? "The sea rolls her. Hold the arm on Polaris, low in the north, and Mark when the ring fills. Its height is your latitude."
      : "Stand with your back to the sun. The sea rolls her — hold the arm on the sun and Mark when the ring fills. A true fix needs the noon sun.";
    markBtn.textContent = mode === "star" ? "Mark Polaris" : "Mark the sun";
    bodyAngleNow = clamp(current.altDeg, 0, 80);
    placeBody(bodyAngleNow);
    placeHorizon(0);
    measured = Math.max(2, current.altDeg - 12);
    placeArm();
    result.replaceChildren();
    playerLat = null;
    steady = 0;
    fixBtn.disabled = true;
    lastT = performance.now() / 1000;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
