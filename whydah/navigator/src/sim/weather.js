// weather.js — the voyage's moods. Weather lives as a "spell": a kind held 4–12
// game-hours, whose numeric targets the live values chase over 1–3 game-hours,
// so a gale builds rather than arrives.

const KINDS = {
  calm:   { label: "Becalmed",     emoji: "🌤️", wind: [0.25, 0.4],  sea: [0.05, 0.15], vis: [0.9, 1] },
  light:  { label: "Light airs",   emoji: "🌬️", wind: [0.6, 0.8],   sea: [0.2, 0.3],   vis: [0.9, 1] },
  fresh:  { label: "Fresh breeze", emoji: "💨", wind: [0.95, 1.15], sea: [0.45, 0.6],  vis: [0.9, 1] },
  gale:   { label: "Strong gale",  emoji: "🌊", wind: [1.2, 1.35],  sea: [0.9, 1],     vis: [0.55, 0.65] },
  squall: { label: "Black squall", emoji: "⛈️", wind: [1.1, 1.3],   sea: [0.8, 1],     vis: [0.45, 0.55] },
  fog:    { label: "Fog bank",     emoji: "🌫️", wind: [0.5, 0.7],   sea: [0.15, 0.25], vis: [0.15, 0.3] },
};
// Long-run mix: light/fresh dominate; each drama kind ~10%.
const WEIGHTS = { calm: 0.12, light: 0.27, fresh: 0.33, gale: 0.09, squall: 0.09, fog: 0.10 };
// Jumps that would read false even with a slow build.
const VETO = { calm: ["gale", "squall"], gale: ["calm"], squall: ["calm"] };

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createWeather() {
  let kind = Math.random() < 0.5 ? "light" : "fresh";
  const cur = { windFactor: 1, seaState: 0, visibility: 1 };
  const tgt = { windFactor: 1, seaState: 0, visibility: 1 };
  let holdLeft = 0; // game-hours left at this kind
  let tau = 1; // easing time-constant; the move is ~95% done in 3 tau
  let forced = null; // a forced kind holds until released

  // Weighted draw; re-roll repeats and vetoed jumps, settle for fresh.
  function pickWeighted() {
    for (let i = 0; i < 8; i++) {
      const r = Math.random();
      let acc = 0, draw = "fresh";
      for (const k in WEIGHTS) { acc += WEIGHTS[k]; if (r < acc) { draw = k; break; } }
      if (draw === kind) continue;
      if (VETO[kind] && VETO[kind].includes(draw)) continue;
      return draw;
    }
    return "fresh";
  }

  function beginSpell(name, hours) {
    kind = name;
    const k = KINDS[name];
    tgt.windFactor = rand(k.wind[0], k.wind[1]);
    tgt.seaState = rand(k.sea[0], k.sea[1]);
    tgt.visibility = rand(k.vis[0], k.vis[1]);
    holdLeft = rand(4, 12);
    tau = (hours || rand(1, 3)) / 3;
  }

  // The voyage opens already settled into its first spell.
  beginSpell(kind);
  cur.windFactor = tgt.windFactor;
  cur.seaState = tgt.seaState;
  cur.visibility = tgt.visibility;

  // gameHours: voyage time elapsed this frame (same convention as voyage.update).
  // realDt is accepted for signature stability; the easing runs on game time.
  function update(gameHours, realDt) {
    const dh = clamp(gameHours || 0, 0, 1); // a stalled tab must not dump hours at once
    if (!forced) {
      holdLeft -= dh;
      if (holdLeft <= 0) beginSpell(pickWeighted());
    }
    // Exponential approach: never snaps, stable at fast-time x6.
    const k = 1 - Math.exp(-dh / tau);
    cur.windFactor += (tgt.windFactor - cur.windFactor) * k;
    cur.seaState += (tgt.seaState - cur.seaState) * k;
    cur.visibility += (tgt.visibility - cur.visibility) * k;
  }

  function setForced(kindOrNull) {
    if (kindOrNull && KINDS[kindOrNull]) {
      forced = kindOrNull;
      beginSpell(kindOrNull, 0.75); // the nor'easter breaks fast but still glides
    } else {
      forced = null;
      holdLeft = rand(1, 4); // the current kind lingers briefly, then normal drift
    }
  }

  // Unknown kinds are ignored; known ones jump instantly (testing only).
  function _debugSet(k) {
    if (!KINDS[k]) return;
    beginSpell(k);
    cur.windFactor = tgt.windFactor;
    cur.seaState = tgt.seaState;
    cur.visibility = tgt.visibility;
  }

  return {
    update, setForced, _debugSet,
    // kind flips at spell start while the numbers glide — the breeze "freshens".
    get state() {
      return {
        kind,
        label: KINDS[kind].label,
        emoji: KINDS[kind].emoji,
        windFactor: cur.windFactor,
        seaState: cur.seaState,
        visibility: cur.visibility,
      };
    },
  };
}
