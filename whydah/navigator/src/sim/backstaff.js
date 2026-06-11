// backstaff.js — a hands-on celestial sight that presents as the right instrument
// for the hour. By DAY it is a backstaff (Davis quadrant): you stand with your back
// to the sun and bring its shadow to the horizon; latitude = 90 - noon altitude +
// declination. By NIGHT it is a mariner's quadrant with a plumb-line: sight Polaris,
// whose altitude IS your latitude. Drag the arm onto the body, Mark, enter on chart.

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

export function createBackstaff(nav) {
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
  const rad = (d) => (d * Math.PI) / 180;
  let measured = 20;
  let playerLat = null;
  let open = false;
  let mode = "sun";

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
  const arm = el("line", { x1: O.x, y1: O.y, class: "bs-arm" }, svg);
  const handle = el("circle", { r: 13, class: "bs-handle" }, svg);
  el("circle", { cx: O.x, cy: O.y, r: 8, class: "bs-pivot" }, svg);
  // Plumb-line (shown only in the night quadrant).
  const plumb = el("line", { x1: O.x, y1: O.y, x2: O.x, y2: O.y + 86, class: "bs-plumb", visibility: "hidden" }, svg);
  const plumbBob = el("circle", { cx: O.x, cy: O.y + 86, r: 6, class: "bs-plumb-bob", visibility: "hidden" }, svg);

  function colorScene() {
    const night = mode === "star";
    skyRect.setAttribute("fill", night ? "#0b1a2b" : "#a7c6df");
    seaRect.setAttribute("fill", night ? "#08131f" : "#27506b");
    horizonLine.setAttribute("stroke", night ? "#1c3145" : "#0e3047");
    body.setAttribute("class", night ? "bs-star" : "bs-sun");
    glow.setAttribute("class", night ? "bs-star-glow" : "bs-sun-glow");
    plumb.setAttribute("visibility", night ? "visible" : "hidden");
    plumbBob.setAttribute("visibility", night ? "visible" : "hidden");
  }
  function placeBody(altDeg) {
    const x = O.x + Math.cos(rad(altDeg)) * (R - 48);
    const y = O.y - Math.sin(rad(altDeg)) * (R - 48);
    for (const node of [body, glow]) { node.setAttribute("cx", x); node.setAttribute("cy", y); }
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

  markBtn.addEventListener("click", () => {
    const tg = target();
    result.replaceChildren();
    if (tg.mode === "star") {
      playerLat = measured; // Polaris's altitude is your latitude
      line(result, ["Polaris stands ", { b: `${measured.toFixed(1)}°` }, " above the horizon."]);
      line(result, ["Its height is your latitude: ", { b: `${playerLat.toFixed(2)}°N` }]);
      fixBtn.disabled = false;
    } else {
      let reportedAlt;
      if (tg.noon) {
        const aimError = measured - tg.altDeg;
        const meridianAlt = 90 - Math.abs(nav.true.lat - tg.dec);
        reportedAlt = meridianAlt + aimError;
      } else {
        reportedAlt = measured;
      }
      playerLat = 90 - reportedAlt + tg.dec;
      line(result, ["Noon altitude ", { b: `${reportedAlt.toFixed(1)}°` }, " · declination ", { b: `${tg.dec.toFixed(1)}°` }]);
      line(result, ["You reckon your latitude at ", { b: `${playerLat.toFixed(2)}°N` }]);
      if (!tg.noon) line(result, [{ i: "— but the sun is not yet at its noon height; this sight is unreliable." }]);
      fixBtn.disabled = !tg.noon;
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
    if (!v) return;
    const tg = target();
    mode = tg.mode;
    colorScene();
    titleEl.textContent = mode === "star" ? "Shoot Polaris — the quadrant" : "Shoot the sun — the backstaff";
    tipEl.textContent = mode === "star"
      ? "Steady the quadrant's plumb-line on Polaris, low in the north, then Mark. Its height is your latitude."
      : "Stand with your back to the sun and bring its shadow down to the horizon, then Mark. A true fix needs the noon sun.";
    markBtn.textContent = mode === "star" ? "Mark Polaris" : "Mark the sun";
    placeBody(tg.altDeg);
    measured = Math.max(2, tg.altDeg - 12);
    placeArm();
    result.replaceChildren();
    playerLat = null;
    fixBtn.disabled = true;
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
