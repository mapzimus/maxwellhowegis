// autopilot.js — "watch the crew sail her." An AI helmsman steers the whole voyage
// waypoint by waypoint, ALWAYS detours for the Cape Cod plunder, and then gambles:
// most runs try to claw seaward around the outer bars in the gale (the Whydah's own
// mistake) and wreck; lucky runs duck west into Cape Cod Bay and live. It narrates
// itself with captions, auto-advances story cards, and records its score as CPU.

import { distanceNm } from "../geo.js";

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function bearingTo(from, to) {
  const dLat = to.lat - from.lat;
  const dLon = (to.lon - from.lon) * Math.cos(from.lat * DEG);
  return (Math.atan2(dLon, dLat) / DEG + 360) % 360;
}

export function createAutopilot({ ship, nav, voyage, story, leaderboard, helm, cameras }) {
  const banner = document.getElementById("ai-banner");
  const captionEl = document.getElementById("ai-caption");
  const takeoverBtn = document.getElementById("ai-takeover");

  let engaged = false;
  let luck = "bad";
  let route = [];
  let leg = 0;
  let sceneTimer = 0;
  let endTimer = 0;
  let endHandled = false;

  function caption(text) {
    captionEl.textContent = text;
    captionEl.style.display = text ? "block" : "none";
  }

  function buildRoute() {
    // Waypoints follow the real voyage; captions are the crew talking.
    luck = Math.random() < 0.62 ? "bad" : "good";
    route = [
      { lat: 23.2, lon: -74.3, say: "Mr. Julian lays the course north — full sail, past the Bahamas." },
      { lat: 28.5, lon: -76.5, say: "The Gulf Stream takes her. The log runs fast." },
      { lat: 35.2, lon: -75.5, say: "Hatteras to larboard — the Stream at its fiercest." },
      { lat: 41.15, lon: -71.56, say: "For Block Island, where Williams parts company." },
      { lat: 41.85, lon: -70.25, say: "The men will not be denied — for the Cape, and the prizes behind it!" },
      luck === "good"
        ? { lat: 42.35, lon: -70.4, say: "Hard west into the bay! Shelter and sea-room — she may yet live." }
        : { lat: 42.0, lon: -69.86, say: "She drives for the outer bars to round the Cape — God help us all." },
      { lat: 43.5, lon: -70.15, say: "North for Richmond Island, if the sea allows." },
    ];
    leg = 0;
  }

  function engage() {
    buildRoute();
    engaged = true;
    endHandled = false;
    endTimer = 0;
    sceneTimer = 0;
    helm.setEnabled(false);
    ship.setSail(3);
    cameras.mode = 1; // cinematic chase
    banner.style.display = "flex";
    caption(route[0].say);
  }

  function disengage() {
    engaged = false;
    helm.setEnabled(true);
    cameras.mode = 0;
    banner.style.display = "none";
    caption("");
  }

  takeoverBtn.addEventListener("click", () => {
    disengage();
    if (story.isOpen()) story.hide();
  });

  function endScene() {
    const s = voyage.score();
    const arrived = voyage.state.outcome === "arrive";
    leaderboard.record(s, voyage.state.outcome, "CPU");
    story.show({
      title: "The crew's voyage is done",
      text: [
        arrived
          ? `Against the odds, they carried her to Maine — ${voyage.state.crew} men alive. Score ${s}, entered in the Log Book as CPU.`
          : `The Cape took her, as it took the real Whydah. Score ${s}, entered in the Log Book as CPU.`,
        "Could you do better at the helm — and would you resist the Cape at all?",
      ],
      choices: [
        { label: "Take the helm", onChoose: () => location.assign(location.pathname) },
        { label: "Watch again", onChoose: () => location.assign("?demo=1") },
        { label: "The Log Book", onChoose: () => leaderboard.show() },
      ],
    });
  }

  // Called every frame with REAL dt, even while overlays pause the world.
  function update(dt) {
    if (!engaged) return;

    if (voyage.ended) {
      if (endHandled) return;
      endTimer += dt;
      caption("");
      if (endTimer > 5) {
        endHandled = true;
        engaged = false;
        banner.style.display = "none";
        endScene();
      }
      return;
    }

    // Let story cards breathe, then turn the page ourselves.
    if (story.isOpen()) {
      sceneTimer += dt;
      if (sceneTimer > 3.2) {
        sceneTimer = 0;
        const btn = document.querySelector("#scene-buttons button");
        if (btn) btn.click();
      }
      return;
    }
    sceneTimer = 0;

    // Steer for the current waypoint.
    const target = route[Math.min(leg, route.length - 1)];
    const brg = bearingTo(nav.true, target);
    const diff = ((brg - ship.headingDeg + 540) % 360) - 180;
    ship.setRudder(clamp(diff / 25, -1, 1));

    if (distanceNm(nav.true, target) < 16 && leg < route.length - 1) {
      leg++;
      caption(route[leg].say);
    }
  }

  return { engage, disengage, update, get engaged() { return engaged; } };
}
