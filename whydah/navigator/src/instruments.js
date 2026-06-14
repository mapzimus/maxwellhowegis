// instruments.js — the helm. A twist-dial compass (drag to set a heading) plus
// a distance control and Add/Undo buttons that extend the route.

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

export function createInstruments(route, onChange) {
  let heading = 0;
  let distNm = 120;

  const dial = buildDial();
  document.getElementById("compass").appendChild(dial.svg);

  const headingOut = document.getElementById("heading-readout");
  const distRange = document.getElementById("dist-range");
  const distOut = document.getElementById("dist-readout");

  function setHeading(h) {
    heading = ((h % 360) + 360) % 360;
    headingOut.textContent = String(Math.round(heading)).padStart(3, "0") + "°";
    dial.setPointer(heading);
  }
  function setDist(d) {
    distNm = d;
    distOut.textContent = `${d} nm`;
  }

  dial.onDrag(setHeading);
  distRange.addEventListener("input", () => setDist(Number(distRange.value)));
  document.getElementById("add-leg").addEventListener("click", () => {
    route.addLeg(heading, distNm);
    onChange();
  });
  document.getElementById("undo-leg").addEventListener("click", () => {
    route.undo();
    onChange();
  });

  setHeading(0);
  setDist(Number(distRange.value));
}

// A self-contained compass rose you can drag to point at a heading.
function buildDial() {
  const size = 170, c = size / 2, r = c - 14;
  const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, class: "dial" });
  el("circle", { cx: c, cy: c, r, class: "dial-face" }, svg);

  for (let d = 0; d < 360; d += 30) {
    const a = (d * Math.PI) / 180;
    el("line", {
      x1: c + Math.sin(a) * (r - 6), y1: c - Math.cos(a) * (r - 6),
      x2: c + Math.sin(a) * r, y2: c - Math.cos(a) * r, class: "dial-tick",
    }, svg);
  }
  for (const [lab, d] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const a = (d * Math.PI) / 180;
    const t = el("text", { x: c + Math.sin(a) * (r - 20), y: c - Math.cos(a) * (r - 20) + 4, class: "dial-card" }, svg);
    t.textContent = lab;
  }
  const pointer = el("line", { x1: c, y1: c, x2: c, y2: c - r + 8, class: "dial-pointer" }, svg);
  el("circle", { cx: c, cy: c, r: 4, class: "dial-hub" }, svg);

  let dragCb = () => {};
  let dragging = false;

  // Pointer position -> compass heading (0 = up/N, 90 = right/E).
  function headingAt(evt) {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * size - c;
    const py = ((evt.clientY - rect.top) / rect.height) * size - c;
    return (Math.atan2(px, -py) * 180 / Math.PI + 360) % 360;
  }

  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragCb(headingAt(e));
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
  });
  svg.addEventListener("pointermove", (e) => { if (dragging) dragCb(headingAt(e)); });
  svg.addEventListener("pointerup", () => { dragging = false; });

  return {
    svg,
    setPointer(h) {
      const a = (h * Math.PI) / 180;
      pointer.setAttribute("x2", c + Math.sin(a) * (r - 8));
      pointer.setAttribute("y2", c - Math.cos(a) * (r - 8));
    },
    onDrag(cb) { dragCb = cb; },
  };
}
