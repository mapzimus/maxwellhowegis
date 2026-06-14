// main.js — boot the 3D scene and run the sail loop: input -> ship physics ->
// navigation (true vs dead-reckoning, hidden current/storm) -> voyage story &
// outcome -> sun/stars/weather -> camera -> HUD -> render. Instruments, scenes,
// and the leaderboard freeze the world. ?demo=1 starts the watch-the-AI mode.

import * as THREE from "three";
import { createWorld } from "./world.js";
import { createShip } from "./ship.js";
import { createHelm } from "./helm.js";
import { createCameras } from "./cameras.js";
import { createHud } from "./hud.js";
import { createNav } from "./nav.js";
import { createChartTable } from "./chartTable.js";
import { createBackstaff } from "./backstaff.js";
import { createLogline } from "./logline.js";
import { createLeadline } from "./leadline.js";
import { createScene } from "./scene.js";
import { createVoyage } from "./voyage.js";
import { createLeaderboard } from "./leaderboard.js";
import { createAutopilot } from "./autopilot.js";
import { createWeather } from "./weather.js";
import { createEvents } from "./events.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const SAIL_NAMES = ["Furled", "Half sail", "Full sail", "Press of sail"];
const COMPRESSION = 480; // keep in step with nav.js

function dateLabel(dayOfYear) {
  let d = dayOfYear, m = 0;
  while (m < 11 && d > MDAYS[m]) { d -= MDAYS[m]; m++; }
  return `${d} ${MONTHS[m]} 1717`;
}

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status})`);
  return r.json();
}

const typingInField = (e) =>
  e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

(async function main() {
  try {
    const [scenario, coastline] = await Promise.all([
      loadJSON("./data/scenario.json"),
      loadJSON("./data/coastline.geojson"),
    ]);
    const start = scenario.objectives.find((o) => o.type === "start") || { lat: 19.9, lon: -73.7 };
    const demoRequested = new URLSearchParams(location.search).get("demo") === "1";

    const canvas = document.getElementById("scene");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 6000);
    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    const world = createWorld(scene);
    const ship = createShip(scene);
    const helm = createHelm(ship, canvas);
    const cameras = createCameras(camera, ship);
    const hud = createHud(ship);
    const nav = createNav(start, scenario);
    const weather = createWeather();
    const seaState = () => weather.state.seaState;
    const chartTable = createChartTable(scenario, coastline);
    const backstaff = createBackstaff(nav, seaState);
    const logline = createLogline(nav, ship, seaState);
    const leadline = createLeadline(nav, coastline, scenario.hazards || [], seaState);
    const story = createScene();
    const leaderboard = createLeaderboard();
    const voyage = createVoyage(scenario, nav, story, world, leaderboard, weather);
    const autopilot = createAutopilot({ ship, nav, voyage, story, leaderboard, helm, cameras });
    const events = createEvents({ story, voyage, nav, ship, weather });

    const clockEl = document.getElementById("clock");
    const statusEl = document.getElementById("status");
    const weatherEl = document.getElementById("weather-chip");
    const lookoutEl = document.getElementById("lookout");
    const sailStateEl = document.getElementById("hud-sail");
    const sightCue = document.getElementById("sight-cue");
    const speedCue = document.getElementById("speed-cue");

    let fastTime = false;
    const timeScale = () => (autopilot.engaged ? 6 : fastTime ? 6 : 1);

    const anyOpen = () =>
      chartTable.isOpen() || backstaff.isOpen() || logline.isOpen() || leadline.isOpen() ||
      story.isOpen() || leaderboard.isOpen();

    function pressKey(k) {
      if (story.isOpen() || leaderboard.isOpen()) return;
      if (k === "m" && (chartTable.isOpen() || !anyOpen())) chartTable.toggle(nav);
      else if (k === "b" && (backstaff.isOpen() || !anyOpen())) backstaff.toggle();
      else if (k === "l" && (logline.isOpen() || !anyOpen())) logline.toggle();
      else if (k === "f" && (leadline.isOpen() || !anyOpen())) leadline.toggle();
      else if (k === "t") fastTime = !fastTime;
      else if (k === "h" && !anyOpen()) showHelp();
    }

    window.addEventListener("keydown", (e) => {
      if (typingInField(e)) return;
      const k = e.key.toLowerCase();
      if (k === "escape" && autopilot.engaged) { autopilot.disengage(); if (story.isOpen()) story.hide(); return; }
      pressKey(k);
    });

    for (const btn of document.querySelectorAll("#toolbar button")) {
      btn.addEventListener("click", () => { pressKey(btn.dataset.k); btn.blur(); });
    }
    const chartClose = document.getElementById("chart-close");
    if (chartClose) chartClose.addEventListener("click", () => { if (chartTable.isOpen()) chartTable.toggle(nav); });

    function showHelp() {
      story.show({
        title: "How to sail her",
        text: [
          "Steer with A / D (or drag the sea). Set sail with W / S. C swaps the camera; T speeds time sixfold for the long hauls.",
          "Navigate like it's 1717: M opens the chart (your reckoned position — not necessarily the truth). B shoots the noon sun, or Polaris by night, to fix your latitude. L heaves the log to measure speed. F sounds the depth.",
          "Run her north from the Windward Passage to Richmond Island, Maine. The Gulf Stream will bend your reckoning; the Cape will tempt you. Bring your crew home.",
        ],
        button: "Back to the helm",
      });
    }

    function showOpening() {
      story.show({
        title: scenario.title,
        text: scenario.narration.intro,
        choices: [
          { label: "Take the helm" },
          { label: "Watch the crew sail her", onChoose: () => autopilot.engage() },
          { label: "The Log Book", onChoose: () => leaderboard.show() },
        ],
      });
    }
    leaderboard.onClose = () => {
      // If the board was browsed before ever setting sail, return to the menu.
      if (!voyage.ended && !autopilot.engaged && nav.driftNm() < 0.5) showOpening();
    };

    // Prime the world so the opening scene has a real sea behind it.
    const solar0 = nav.sun();
    world.setSun(solar0.altDeg, solar0.azDeg);
    world.setStars(nav.true.lat);
    world.update(0, ship.position);
    cameras.update();

    if (demoRequested) autopilot.engage();
    else showOpening();

    const clock = new THREE.Clock();
    function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      autopilot.update(dt); // runs even while story cards pause the world

      if (!anyOpen()) {
        const ts = timeScale();
        const gameHours = (dt * ts * COMPRESSION) / 3600;
        weather.update(gameHours, dt);
        const wx = weather.state;
        ship.setWindFactor(wx.windFactor);
        world.setWeather(wx);

        helm.update();
        ship.step(dt, t, world.wave);
        nav.advance(dt * ts, ship.headingDeg, ship.knots);
        voyage.update(gameHours);
        events.update(gameHours, dt);

        const solar = nav.sun();
        // Don't let fast time skate past the noon sight window.
        if (fastTime && !autopilot.engaged && nav.nearNoon()) fastTime = false;
        world.setSun(solar.altDeg, solar.azDeg);
        world.setStars(nav.true.lat);
        world.update(t, ship.position);
        cameras.update();
        hud.update();

        if (clockEl) clockEl.textContent =
          `${dateLabel(nav.dayOfYear)} · ${nav.timeLabel()}${ts > 1 ? " · ⏩×6" : ""}`;
        if (sailStateEl) sailStateEl.textContent = SAIL_NAMES[ship.sail];
        if (weatherEl) weatherEl.textContent = `${wx.emoji} ${wx.label}`;
        if (statusEl) statusEl.textContent =
          `Day ${nav.dayOfYear - 56} · Crew ${voyage.state.crew} · Plunder ${voyage.state.plunder}`;
        if (lookoutEl) {
          const seen = voyage.lookout();
          lookoutEl.style.display = seen ? "block" : "none";
          if (seen) lookoutEl.textContent = `🔭 Lookout: ${seen.name}, ${seen.distNm} nm`;
        }
        if (sightCue) {
          const noon = nav.nearNoon();
          sightCue.style.display = noon && !autopilot.engaged ? "block" : "none";
          if (noon) sightCue.textContent = "☀ The sun nears its noon height — press B to take a sight";
        }
        if (speedCue) {
          const stale = nav.reckonedSpeed != null && Math.abs(ship.knots - nav.reckonedSpeed) > 1.2;
          speedCue.style.display = stale && !autopilot.engaged ? "block" : "none";
          if (stale) speedCue.textContent = "Your speed has changed — heave the log (L) to re-measure";
        }
      }

      renderer.render(scene, camera);
    }
    loop();

    window.WHYDAH3D = {
      THREE, scene, camera, ship, world, helm, cameras, nav,
      chartTable, backstaff, logline, leadline, story, voyage, leaderboard, autopilot,
      weather, events, renderer,
    };
  } catch (err) {
    console.error(err);
    const b = document.getElementById("error-banner");
    if (b) { b.style.display = "block"; b.textContent = "⚠ " + err.message; }
  }
})();
