// logline.js — a hands-on speed measurement with a timing skill. Heave the log, the
// sandglass drains over ~6 real seconds with an uneven flow (worse in a sea), and the
// knots stream up as the line pays out. The player must cry NIP! the instant the last
// sand falls: measured = trueKnots * (tNip / tGlass), clamped to 0.3x–1.7x and rounded
// to the half-knot — early undercounts, late overcounts. Enter-in-reckoning unchanged.

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

const GLASS_REAL = 6; // nominal real seconds for the (28-second) glass to run
const NIP_TOL = 0.18; // seconds either side of empty that still counts as the mark
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createLogline(nav, ship, getSeaState = () => 0.3) {
  const overlay = document.getElementById("logline-overlay");
  const svg = document.getElementById("log-svg");
  const countEl = document.getElementById("log-count");
  const result = document.getElementById("log-result");
  const heaveBtn = document.getElementById("log-heave");
  const nipBtn = document.getElementById("log-nip");
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
  // Flashes the instant the glass stands empty — the mark you nip on.
  const emptyFlash = el("polygon", { points: "200,150 135,258 265,258", class: "lg-empty-flash", visibility: "hidden" }, svg);

  let open = false, running = false, raf = 0;
  let sea = 0.3;
  let trueKn = 0, measured = null;
  let t0 = 0, frac = 0, lastT = 0, tGlass = GLASS_REAL, tEmpty = null;
  let jAmp = 0.1, jp1 = 0, jp2 = 0;

  // Uneven flow: the sand rate wobbles on two short sines; rougher seas, more wobble.
  const jitter = (t) => jAmp * (0.6 * Math.sin((2 * Math.PI * t) / 0.9 + jp1) +
                                0.4 * Math.sin((2 * Math.PI * t) / 2.3 + jp2));
  const rate = (t) => (1 + jitter(t)) / GLASS_REAL;

  function setGlass(f) {
    const w = 63 * (1 - f);
    topSand.setAttribute("d", `M200,150 L${(200 - w).toFixed(1)},52 L${(200 + w).toFixed(1)},52 Z`);
    botSand.setAttribute("d", `M137,256 L263,256 L200,${(256 - 100 * f).toFixed(1)} Z`);
    stream.setAttribute("visibility", f > 0 && f < 1 ? "visible" : "hidden");
    stream.setAttribute("class", f > 0.86 ? "lg-stream lg-stream-last" : "lg-stream");
  }
  function reset() {
    running = false; measured = null; frac = 0; tEmpty = null;
    countEl.textContent = "0.0"; result.replaceChildren();
    enterBtn.disabled = true; nipBtn.disabled = true; heaveBtn.disabled = false;
    emptyFlash.setAttribute("visibility", "hidden");
    setGlass(0);
  }
  function heave() {
    if (running) return;
    reset();
    running = true;
    trueKn = ship.knots;
    jAmp = 0.06 + 0.5 * sea;
    jp1 = Math.random() * Math.PI * 2;
    jp2 = Math.random() * Math.PI * 2;
    // Walk the flow forward once so we know exactly when this glass will empty.
    let acc = 0, tt = 0;
    while (acc < 1 && tt < GLASS_REAL * 2) { acc += rate(tt) * 0.004; tt += 0.004; }
    tGlass = tt;
    t0 = performance.now() / 1000;
    lastT = t0;
    heaveBtn.disabled = true;
    nipBtn.disabled = false;
  }
  function nip() {
    if (!running) return;
    running = false;
    nipBtn.disabled = true;
    heaveBtn.disabled = false;
    const tNip = performance.now() / 1000 - t0;
    const ratio = clamp(tGlass > 0 ? tNip / tGlass : 1, 0.3, 1.7);
    measured = Math.round(trueKn * ratio * 2) / 2; // counted to the nearest half-knot
    countEl.textContent = measured.toFixed(1);
    result.replaceChildren();
    const dt = tNip - tGlass;
    if (Math.abs(dt) <= NIP_TOL) line(result, [{ b: "Nipped at the mark!" }]);
    else if (dt < 0) line(result, [{ b: "Too soon — the line still ran." }]);
    else line(result, [{ b: "Late — the glass stood empty." }]);
    line(result, ["You log ", { b: `${measured.toFixed(1)} knots` }, "."]);
    enterBtn.disabled = false;
  }

  // The instrument's own animation loop — the main world loop is frozen while open.
  function frame(now) {
    if (!open) { return; }
    const t = now / 1000;
    if (running) {
      const dt = clamp(t - lastT, 0, 0.05);
      const elapsed = t - t0;
      frac = Math.min(1, frac + rate(elapsed) * dt);
      setGlass(frac);
      if (frac >= 1 && tEmpty == null) tEmpty = t;
      // The line keeps paying out whether or not the glass has emptied.
      const shown = clamp(trueKn * (elapsed / tGlass), 0, trueKn * 1.7);
      countEl.textContent = shown.toFixed(1);
    }
    if (tEmpty != null) {
      const a = Math.max(0, 1 - (t - tEmpty) * 2.5);
      emptyFlash.setAttribute("visibility", a > 0 ? "visible" : "hidden");
      emptyFlash.setAttribute("opacity", a.toFixed(2));
    }
    lastT = t;
    raf = requestAnimationFrame(frame);
  }

  heaveBtn.addEventListener("click", heave);
  nipBtn.addEventListener("click", nip);
  enterBtn.addEventListener("click", () => {
    if (measured == null) return;
    nav.setReckonedSpeed(measured);
    line(result, [{ b: "Speed entered in your reckoning." }]);
    enterBtn.disabled = true;
  });

  function setOpen(v) {
    open = v;
    overlay.style.display = v ? "flex" : "none";
    if (v) {
      sea = clamp(getSeaState(), 0, 1);
      reset();
      lastT = performance.now() / 1000;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
      cancelAnimationFrame(raf);
    }
  }
  closeBtn.addEventListener("click", () => setOpen(false));

  return { toggle() { setOpen(!open); return open; }, isOpen: () => open };
}
