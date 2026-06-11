// logline.js — a hands-on speed measurement. Heave the log overboard, the sandglass
// runs, and the knots that pay out are your speed. Entered into the reckoning, it's
// the speed dead reckoning uses until you log again.

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
  }
  parent.appendChild(div);
}

export function createLogline(nav, ship) {
  const overlay = document.getElementById("logline-overlay");
  const svg = document.getElementById("log-svg");
  const countEl = document.getElementById("log-count");
  const result = document.getElementById("log-result");
  const heaveBtn = document.getElementById("log-heave");
  const enterBtn = document.getElementById("log-enter");
  const closeBtn = document.getElementById("log-close");

  // Sandglass
  el("polygon", { points: "135,50 265,50 200,150", class: "lg-frame" }, svg);
  el("polygon", { points: "200,150 135,258 265,258", class: "lg-frame" }, svg);
  el("rect", { x: 120, y: 42, width: 160, height: 9, rx: 3, class: "lg-cap" }, svg);
  el("rect", { x: 120, y: 257, width: 160, height: 9, rx: 3, class: "lg-cap" }, svg);
  const topSand = el("path", { class: "lg-sand" }, svg);
  const botSand = el("path", { class: "lg-sand" }, svg);
  const stream = el("line", { x1: 200, y1: 150, x2: 200, y2: 168, class: "lg-stream", visibility: "hidden" }, svg);

  const GLASS_REAL = 5; // real seconds for the (28-second) glass to run
  let open = false, running = false, t0 = 0, measured = null, raf = 0;

  function setGlass(frac) {
    const w = 63 * (1 - frac);
    topSand.setAttribute("d", `M200,150 L${(200 - w).toFixed(1)},52 L${(200 + w).toFixed(1)},52 Z`);
    botSand.setAttribute("d", `M137,256 L263,256 L200,${(256 - 100 * frac).toFixed(1)} Z`);
    stream.setAttribute("visibility", frac > 0 && frac < 1 ? "visible" : "hidden");
  }
  function reset() {
    running = false; cancelAnimationFrame(raf); measured = null;
    countEl.textContent = "0.0"; result.replaceChildren(); enterBtn.disabled = true; setGlass(0);
  }
  function tick() {
    if (!running) return;
    const frac = Math.min(1, (performance.now() - t0) / 1000 / GLASS_REAL);
    setGlass(frac);
    countEl.textContent = (ship.knots * frac).toFixed(1);
    if (frac >= 1) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }
  function finish() {
    running = false;
    measured = Math.round(ship.knots * 2) / 2; // counted to the nearest half-knot
    countEl.textContent = measured.toFixed(1);
    result.replaceChildren();
    line(result, ["The glass runs out — you log ", { b: `${measured.toFixed(1)} knots` }, "."]);
    enterBtn.disabled = false;
  }
  function heave() {
    if (running) return;
    reset(); running = true; t0 = performance.now(); tick();
  }

  heaveBtn.addEventListener("click", heave);
  enterBtn.addEventListener("click", () => {
    if (measured == null) return;
    nav.setReckonedSpeed(measured);
    line(result, [{ b: "Speed entered in your reckoning." }]);
    enterBtn.disabled = true;
  });

  function setOpen(v) {
    open = v;
    overlay.style.display = v ? "flex" : "none";
    if (v) reset();
    else { running = false; cancelAnimationFrame(raf); }
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
