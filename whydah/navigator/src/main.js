// main.js — load data, draw the chart, and wire up the helm (route plotting).

import { makeProjector, mercatorY } from "./geo.js";
import { drawChart } from "./chart.js";
import { createRoute } from "./route.js";
import { createInstruments } from "./instruments.js";

const DEG = Math.PI / 180;
const SVGNS = "http://www.w3.org/2000/svg";

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
  return res.json();
}

function fmtLatLon(p) {
  const ns = p.lat >= 0 ? "N" : "S";
  const ew = p.lon >= 0 ? "E" : "W";
  return `${Math.abs(p.lat).toFixed(1)}°${ns}, ${Math.abs(p.lon).toFixed(1)}°${ew}`;
}

async function main() {
  const [scenario, coastline] = await Promise.all([
    loadJSON("./data/scenario.json"),
    loadJSON("./data/coastline.geojson"),
  ]);

  // Pick a pixel height that keeps Mercator shapes undistorted for these bounds.
  const b = scenario.bounds;
  const width = 640;
  const height = Math.round(
    (width * (mercatorY(b.north) - mercatorY(b.south))) / ((b.east - b.west) * DEG)
  );
  const size = { width, height };

  const svg = document.getElementById("chart");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const proj = makeProjector(b, width, height);
  drawChart(svg, proj, scenario, coastline, size);

  document.getElementById("game-title").textContent = scenario.title;
  document.getElementById("game-subtitle").textContent = scenario.subtitle;
  document.getElementById("panel-text").textContent = scenario.narration.intro;

  // The route is drawn on its own layer, above the basemap.
  const routeLayer = document.createElementNS(SVGNS, "g");
  routeLayer.setAttribute("class", "layer-route");
  svg.appendChild(routeLayer);

  const start = scenario.objectives.find((o) => o.type === "start");
  const route = createRoute(start, proj, routeLayer);

  function updateReadouts() {
    const e = route.end();
    document.getElementById("pos-readout").textContent = fmtLatLon(e);
    document.getElementById("legs-readout").textContent = String(route.legs.length);
    document.getElementById("total-readout").textContent = Math.round(route.totalNm()) + " nm";
  }
  createInstruments(route, updateReadouts);
  updateReadouts();

  window.WHYDAH = { scenario, coastline, proj, size, svg, route };
}

main().catch((err) => {
  console.error(err);
  const banner = document.getElementById("error-banner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent = "⚠ " + err.message;
  }
});
