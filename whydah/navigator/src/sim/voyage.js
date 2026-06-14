// voyage.js — drives the story and the outcome. Watches the TRUE position: fires a
// beat at each landmark (any order), springs the nor'easter if you enter Cape Cod,
// bleeds crew while the storm blows, wrecks you on the shoals/bars, and at the end
// lays reckoning beside truth, tallies a score, and posts it to the leaderboard.

import { distanceNm } from "../geo.js";

const fmt = (p) =>
  `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? "N" : "S"}, ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? "E" : "W"}`;

// Ray-cast point-in-polygon; poly is an array of [lon, lat].
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function createVoyage(scenario, nav, story, world, leaderboard, weather) {
  const landmarks = scenario.objectives.filter((o) => o.type === "required");
  const final = scenario.objectives.find((o) => o.type === "final");
  const cape = scenario.objectives.find((o) => o.id === "capecod");
  const hazards = scenario.hazards || [];
  const beats = scenario.beats || {};
  const narration = scenario.narration || {};

  const state = {
    crew: scenario.crewStart || 146,
    plunder: 0,
    objectives: 0,
    wentToCape: false,
    stormOn: false,
    ended: false,
    outcome: null,
    _crewFrac: 0,
  };
  const fired = new Set();

  const inZone = (p, o) => distanceNm(p, { lat: o.lat, lon: o.lon }) <= (o.radiusNm || 30);
  const inHazard = (p) => hazards.find((h) => pointInPoly(p, h.polygon));

  function errs() {
    const t = nav.true, d = nav.dr;
    return {
      lat: Math.abs(t.lat - d.lat) * 60,
      lon: Math.abs(t.lon - d.lon) * 60 * Math.cos((t.lat * Math.PI) / 180),
    };
  }

  // Balanced so the historical seeds ring true: a clean arrival ~1450; a greedy
  // arrival that survives the storm a bit more; a wreck lands near Black Sam's 612.
  function score() {
    let s = state.objectives * 100 + Math.round(state.plunder) + state.crew * 3;
    if (state.outcome === "arrive") s += 600 + Math.max(0, 200 - Math.round(errs().lon));
    return Math.max(0, Math.round(s));
  }

  function endVoyage(outcome) {
    if (state.ended) return;
    state.ended = true;
    state.outcome = outcome;
    nav.setStorm(false);
    world.setStorm(false);
    if (weather) weather.setForced(null);

    if (outcome === "arrive") {
      const e = errs();
      const wentClean = !state.wentToCape;
      const finalScore = score();
      story.show({
        title: `Landfall — ${final.name}`,
        text: [
          beats.landfall || "Land lifts grey out of the haze.",
          `Your reckoning placed you at ${fmt(nav.dr)} — but you were truly at ${fmt(nav.true)}: latitude true to within ${Math.round(e.lat)} miles, longitude adrift by ${Math.round(e.lon)} nautical miles. No instrument aboard in 1717 could have told you that.`,
          wentClean ? (narration.successClean || "") : (narration.successStorm || ""),
          `You brought ${state.crew} of 146 souls home.`,
        ],
        choices: [{ label: `Record the voyage (${finalScore})`, onChoose: () => leaderboard.entry(finalScore, state) }],
      });
    } else {
      state.crew = 2;
      const finalScore = score();
      story.show({
        title: "Wreck off Wellfleet",
        text: [
          narration.wreck || "Driven onto the bars, the Whydah breaks up in the surf.",
          'Cyprian Southack would mark this very spot on his 1717 chart — an X off Wellfleet, and the words: "where I buried One Hundred & Two Men Drowned." Barry Clifford used that chart to find her in 1984.',
          "Of 146 souls, two reach shore.",
        ],
        choices: [{ label: `Record the voyage (${finalScore})`, onChoose: () => leaderboard.entry(finalScore, state) }],
      });
    }
  }

  // gameHours: how much voyage time elapsed since the last call.
  function update(gameHours = 0) {
    if (state.ended) return;
    const p = nav.true;

    // The Cape Cod temptation: entering the bonus zone banks plunder but wakes the gale.
    if (cape && !state.wentToCape && inZone(p, cape)) {
      state.wentToCape = true;
      state.plunder += 400;
      state.stormOn = true;
      nav.setStorm(true);
      world.setStorm(true);
      if (weather) weather.setForced("gale");
      story.show({
        title: "Cape Cod",
        text: [narration.plunder || "", "The northeast sky splits open — a nor'easter, and the bars of the outer beach under your lee."],
        button: "Hold on!",
      });
      return;
    }

    // The storm takes men while it blows.
    if (state.stormOn && gameHours > 0) {
      state._crewFrac += 0.9 * gameHours;
      const lost = Math.floor(state._crewFrac);
      if (lost > 0) {
        state._crewFrac -= lost;
        state.crew = Math.max(2, state.crew - lost);
      }
    }

    // Wreck: the shoals and bars take you.
    if (inHazard(p)) { endVoyage("wreck"); return; }

    // Reaching Maine ends the voyage no matter what you skipped on the way.
    if (final && inZone(p, final)) {
      state.objectives++;
      endVoyage("arrive");
      return;
    }

    // Landmark beats fire once each, in any order.
    for (const o of landmarks) {
      if (!fired.has(o.id) && inZone(p, o)) {
        fired.add(o.id);
        state.objectives++;
        story.show({ title: o.name, text: beats[o.id] || `You raise ${o.name}.`, button: "Continue" });
        return;
      }
    }
  }

  // What the masthead lookout can see: the nearest un-visited mark within ~80nm.
  function lookout() {
    if (state.ended) return null;
    const p = nav.true;
    let best = null;
    const candidates = landmarks.filter((o) => !fired.has(o.id)).concat(final ? [final] : []);
    if (cape && !state.wentToCape) candidates.push(cape);
    for (const o of candidates) {
      const d = distanceNm(p, { lat: o.lat, lon: o.lon });
      if (d < 80 && (!best || d < best.distNm)) best = { name: o.name, distNm: Math.round(d) };
    }
    return best;
  }

  return { update, state, score, lookout, get ended() { return state.ended; } };
}
