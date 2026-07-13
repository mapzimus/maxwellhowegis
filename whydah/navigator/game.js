/* =====================================================================
   Whydah — First Sail (v3)
   A voyage roguelite that mirrors the real story. February 1717: the
   crew has taken the Whydah near the Bahamas. Run her north for Maine.
   Random events from a 40-card pool, ship battles, a sea serpent (a
   yarn, and tagged as one), navigator mini-games for points, gold that
   banks between runs, a Harbor refit shop, and the nor'easter finale.
   Self-contained: pure Canvas 2D, no libraries, no external assets.
   ===================================================================== */
(function () {
  "use strict";

  // ---------------------------------------------------------------- canvas
  var canvas = document.getElementById("scene");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", function () { setTimeout(resize, 250); });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- rng + helpers
  function rand(a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return Math.random() < p; }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------------------------------------------------------------- audio (muted by default)
  var AC = null, muted = true;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } return AC; }
  function beep(freq, dur, type, vol) {
    if (muted) return; var ac = audio(); if (!ac) return;
    try {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.value = (vol || 0.15);
      o.connect(g); g.connect(ac.destination);
      var t = ac.currentTime; o.start(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.15));
      o.stop(t + (dur || 0.15) + 0.02);
    } catch (e) {}
  }
  var SFX = {
    fire: function () { beep(220, 0.18, "square", 0.10); },
    hit: function () { beep(90, 0.25, "sawtooth", 0.18); },
    point: function () { beep(880, 0.10, "triangle", 0.12); },
    coin: function () { beep(1180, 0.08, "triangle", 0.10); },
    good: function () { beep(660, 0.12, "triangle", 0.14); beep(990, 0.14, "triangle", 0.10); },
    bad: function () { beep(140, 0.3, "sawtooth", 0.16); },
    buy: function () { beep(520, 0.1, "triangle", 0.12); beep(780, 0.12, "triangle", 0.1); },
    thunder: function () { beep(60, 0.6, "sawtooth", 0.22); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, "triangle", 0.14); }, i * 140); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { beep(f, 0.35, "sawtooth", 0.16); }, i * 200); }); }
  };

  // ---------------------------------------------------------------- input
  var input = { left: false, right: false, fire: false, firePressed: false,
                leftPressed: false, rightPressed: false,
                px: 0, py: 0, pDown: false, pPressed: false };

  function keydown(e) {
    var k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { if (!input.left) input.leftPressed = true; input.left = true; }
    else if (k === "arrowright" || k === "d") { if (!input.right) input.rightPressed = true; input.right = true; }
    else if (k === " " || k === "spacebar" || k === "enter" || k === "arrowup" || k === "w") { if (!input.fire) input.firePressed = true; input.fire = true; }
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "spacebar"].indexOf(k) >= 0) e.preventDefault();
  }
  function keyup(e) {
    var k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") input.left = false;
    else if (k === "arrowright" || k === "d") input.right = false;
    else if (k === " " || k === "spacebar" || k === "enter" || k === "arrowup" || k === "w") input.fire = false;
  }
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    input.px = t.clientX - r.left; input.py = t.clientY - r.top;
  }
  canvas.addEventListener("pointerdown", function (e) { canvasPoint(e); input.pDown = true; input.pPressed = true; if (AC && AC.state === "suspended") AC.resume(); });
  canvas.addEventListener("pointermove", function (e) { if (input.pDown) canvasPoint(e); });
  window.addEventListener("pointerup", function () { input.pDown = false; });

  function holdBtn(id, prop) {
    var el = document.getElementById(id); if (!el) return;
    var set = function (v) { return function (e) { e.preventDefault(); input[prop] = v; if (v && prop === "fire") input.firePressed = true; el.classList.toggle("held", v); }; };
    el.addEventListener("pointerdown", set(true));
    el.addEventListener("pointerup", set(false));
    el.addEventListener("pointerleave", set(false));
    el.addEventListener("pointercancel", set(false));
  }
  holdBtn("btn-left", "left");
  holdBtn("btn-right", "right");
  holdBtn("btn-fire", "fire");

  function consumeFire() { var f = input.firePressed; input.firePressed = false; return f; }
  function consumeTap() { var p = input.pPressed || input.firePressed; input.pPressed = false; input.firePressed = false; return p; }
  // canvas tap-button: draw + hit-test in one call
  function uiButton(x, y, w, h, label, opts) {
    opts = opts || {};
    var on = !opts.disabled;
    ctx.fillStyle = opts.disabled ? "rgba(60,70,78,.7)" : (opts.color || "#96341f");
    ctx.strokeStyle = opts.disabled ? "rgba(150,150,150,.4)" : "#e0b25c"; ctx.lineWidth = 2;
    roundRect(x, y, w, h, Math.min(14, h / 2)); ctx.fill(); ctx.stroke();
    text(label, x + w / 2, y + h / 2 + (opts.size || 15) * 0.36, opts.size || 15, opts.disabled ? "rgba(230,230,230,.5)" : "#f4e7c9", "center", "bold");
    if (opts.sub) text(opts.sub, x + w / 2, y + h + 14, 11, "rgba(244,231,201,.65)", "center");
    if (on && input.pPressed && input.px >= x && input.px <= x + w && input.py >= y && input.py <= y + h) {
      input.pPressed = false; return true;
    }
    return false;
  }

  var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) document.body.classList.add("hide-touch");

  // ---------------------------------------------------------------- persistence
  var SAVE = { bank: 0, best: 0, wins: 0, runs: 0, upg: { hull: 0, pumps: 0, shot: 0, nest: 0, helm: 0, charm: 0 } };
  function loadSave() {
    try {
      var raw = localStorage.getItem("firstsail-save-v3");
      if (raw) { var s = JSON.parse(raw); for (var k in SAVE) if (s[k] !== undefined) SAVE[k] = s[k]; if (s.upg) for (var u in SAVE.upg) if (s.upg[u] !== undefined) SAVE.upg[u] = s.upg[u]; }
      else { var oldBest = parseInt(localStorage.getItem("firstsail-best-v2") || "0", 10) || 0; SAVE.best = oldBest; }
    } catch (e) {}
  }
  function persist() { try { localStorage.setItem("firstsail-save-v3", JSON.stringify(SAVE)); } catch (e) {} }
  loadSave();

  // ---------------------------------------------------------------- upgrades
  var UPG = [
    { id: "hull",  icon: "🛡", name: "Oak Timbers",  desc: "Thicker hull. One more heart per level.",            max: 3, cost: [120, 260, 450] },
    { id: "pumps", icon: "🪣", name: "Bilge Pumps",  desc: "Crew shrugs off storm hits. 25% per level.",         max: 3, cost: [100, 220, 400] },
    { id: "shot",  icon: "⛓",  name: "Chain Shot",   desc: "Cannonballs can strike double. 25% per level.",      max: 3, cost: [90, 200, 360] },
    { id: "nest",  icon: "🔭", name: "Crow's Nest",  desc: "Longer warnings before waves and lunges.",           max: 3, cost: [80, 180, 320] },
    { id: "helm",  icon: "☸",  name: "Weather Helm", desc: "She answers the wheel faster.",                      max: 2, cost: [110, 260] },
    { id: "charm", icon: "🧿", name: "Lucky Charm",  desc: "Bad luck sometimes passes you by.",                  max: 2, cost: [70, 160] }
  ];
  function upgLvl(id) { return SAVE.upg[id] || 0; }
  function steerSpeed() { return 1.05 + upgLvl("helm") * 0.18; }
  function shotBonus() { return upgLvl("shot") * 0.25; }
  function stormShrug() { return upgLvl("pumps") * 0.25; }
  function warnBonus() { return upgLvl("nest") * 0.4; }

  // ---------------------------------------------------------------- the 40-event pool
  // tag: "record" = from the real Whydah story · "yarn" = a sea story · "" = life at sea
  // w: draw weight (3 common, 2 uncommon, 1 rare). fx: {s: score, g: gold, h: hull}
  // mod: run modifier flag. choice: [{l: label, fx, r: result line}]
  var EVENTS = [
    { id: "prize",     w: 3, tag: "record", t: "A prize strikes her colors", b: "A sloop gives up without a fight. Bellamy's way: take the goods, spare the crew.", fx: { g: 35, s: 25 } },
    { id: "golddust",  w: 2, tag: "record", t: "Gold dust in the hold", b: "The Whydah was a trading ship before you took her. Her hold still carries gold and ivory.", fx: { g: 50 } },
    { id: "julian",    w: 2, tag: "record", t: "Julian reads the shoals", b: "John Julian, your Miskito pilot, steers you clear of hidden sandbars. He knows these waters.", fx: { s: 35 } },
    { id: "king",      w: 2, tag: "record", t: "The boy pirate", b: "John King is aboard. He was about nine when he chose to join the crew. The men look out for him.", fx: { s: 20 } },
    { id: "williams",  w: 2, tag: "record", t: "Williams turns for Block Island", b: "Paulsgrave Williams takes his sloop to visit his family. Your consort is gone. You sail alone now.", fx: { s: -10 } },
    { id: "maryanne",  w: 2, tag: "record", t: "The Mary Anne's wine", b: "You take a ship full of Madeira wine. The crew celebrates hard. Too hard.", fx: { g: 40, s: -10 } },
    { id: "careen",    w: 2, tag: "record", t: "Careening", b: "You beach her at low tide and scrape the weed off her hull. Slow work. Good work.", fx: { h: 1 } },
    { id: "council",   w: 2, tag: "record", t: "Council on deck", b: "The crew votes on the next course. Every man gets a say. That was the pirate way.", fx: { s: 25 } },
    { id: "shares",    w: 2, tag: "record", t: "Equal shares", b: "The loot is counted and split. One share for every man, no matter where he was born.", fx: { g: 25, s: 15 } },
    { id: "articles",  w: 2, tag: "record", t: "New hands sign on", b: "Sailors from a prize choose to sign your articles. More hands make her stronger.", fx: { h: 1, s: 10 } },
    { id: "drill",     w: 2, tag: "record", t: "Gun drill", b: "The Whydah carries over two dozen guns. The crew drills until the smoke stings.", fx: { s: 10 }, mod: "drill" },
    { id: "capestorm", w: 2, tag: "record", t: "Storm off the Capes", b: "A gale slams the ship near Virginia. The real crew survived one here too. Barely.", fx: { h: -1, s: 15 } },
    { id: "freeship",  w: 2, tag: "record", t: "What this ship was", b: "The Whydah carried enslaved people before you took her. Some of your crew were enslaved once. Now they are free men aboard her. Nobody says much. Everybody knows.", fx: { s: 30 } },
    { id: "chase",     w: 2, tag: "record", t: "Three day chase", b: "That is how Bellamy caught this very ship. The old hands tell it again. The new hands listen.", fx: { s: 15 } },
    { id: "chart",     w: 2, tag: "record", t: "A better chart", b: "A captured navigator hands over his charts. Now you can see trouble coming.", fx: { s: 15 }, mod: "chart" },
    { id: "freeprince",w: 1, tag: "yarn",   t: "The Free Prince", b: "They say Bellamy made a grand speech about robbing the rich. It comes from a book written years later. The crew likes the story anyway.", fx: { s: 20 } },
    { id: "navysail",  w: 2, tag: "record", t: "A King's ship on the horizon", b: "Man-of-war. Big guns. The crew waits on your word.", choice: [
        { l: "Fight her", r: "You turn to fight. Bold. Maybe too bold.", fx: { s: 30 }, mod: "navy" },
        { l: "Run north", r: "You crowd on sail and slip away in the dark.", fx: { s: 10 } } ] },
    { id: "scurvy",    w: 2, tag: "",       t: "Scurvy signs", b: "Gums bleeding. Old sailors know what comes next without fresh food.", choice: [
        { l: "Buy fresh stores (20 gold)", r: "Limes and greens from a fishing town. The crew mends.", fx: { g: -20 } },
        { l: "Sail on", r: "You push on. Some of the crew get weaker.", fx: { h: -1 } } ] },
    { id: "derelict",  w: 2, tag: "",       t: "A ghost ship drifts past", b: "Sails ragged. Nobody at the wheel. Nobody anywhere.", choice: [
        { l: "Board her", r: "You find a sea chest of coin. And a smell you will not forget.", fx: { g: 45, s: 10 } },
        { l: "Let her pass", r: "Some doors are better left shut. The crew agrees.", fx: { s: 10 } } ] },
    { id: "leaks",     w: 3, tag: "",       t: "Working the pumps", b: "She takes water at the seams. All hands pump through the night.", fx: { s: -10 } },
    { id: "rats",      w: 3, tag: "",       t: "Rats in the bread room", b: "They got into the stores. The cook is furious.", fx: { g: -10 } },
    { id: "doldrums",  w: 3, tag: "",       t: "Dead calm", b: "No wind. The sails hang like laundry. You drift and wait.", fx: { s: -10 } },
    { id: "fog",       w: 2, tag: "record", t: "Fog on the water", b: "A grey wall rolls in. These coasts are famous for it. Sail careful.", fx: { s: 5 }, mod: "fog" },
    { id: "waterspout",w: 2, tag: "",       t: "Waterspout", b: "A twisting rope of sea and sky crosses your bow. The helmsman earns his pay.", fx: { h: -1, s: 20 } },
    { id: "barnacle",  w: 2, tag: "",       t: "Barnacles", b: "Her bottom is fouled and she drags. She will answer the helm slower.", fx: { s: -5 }, mod: "slow" },
    { id: "fishcatch", w: 3, tag: "",       t: "Cod on every line", b: "The Grand Banks feed you well tonight. A fed crew is a strong crew.", fx: { h: 1 } },
    { id: "bilgefire", w: 2, tag: "",       t: "Fire below!", b: "The cook's fire gets loose. Buckets fly. You douse it, but she is scorched.", fx: { h: -1 } },
    { id: "bottle",    w: 2, tag: "",       t: "A bottle in the swell", b: "Inside: half a chart and three coins. Somebody's whole fortune, once.", fx: { g: 20 } },
    { id: "deserter",  w: 2, tag: "",       t: "Navy deserter", b: "He climbs aboard half drowned. He knows how the King's ships fight.", fx: { s: 10 }, mod: "navyintel" },
    { id: "gullthief", w: 3, tag: "",       t: "Gull overboard", b: "A gull steals the lookout's biscuit right out of his hand. The whole watch laughs.", fx: { s: 5 } },
    { id: "dolphins",  w: 3, tag: "",       t: "Dolphins on the bow", b: "They ride your bow wave for a mile. Sailors call it good luck.", fx: { s: 15 } },
    { id: "whale",     w: 2, tag: "",       t: "A whale sounds", b: "A right whale rises beside the hull, breathes, and is gone. The sea goes quiet.", fx: { s: 20 } },
    { id: "sharks",    w: 2, tag: "",       t: "Sharks astern", b: "Fins follow the galley scraps. The fishing lines come in empty. And shorter.", fx: { g: -5 } },
    { id: "turtle",    w: 2, tag: "",       t: "Sea turtle", b: "The old navigator nods at it. Turtles mean land is near, he says.", fx: { s: 10 } },
    { id: "stelmo",    w: 1, tag: "",       t: "St. Elmo's fire", b: "Cold blue flame dances on the mast tops. No heat. No sound. The crew goes quiet.", fx: { s: 20 } },
    { id: "kraken",    w: 1, tag: "yarn",   t: "The old salt's kraken", b: "He swears an arm as thick as the mainmast passed under the keel. It was probably an eel.", fx: { s: 10 } },
    { id: "mermaid",   w: 1, tag: "yarn",   t: "Mermaid off the bow", b: "The new hand spots a mermaid. It is a seal. He will not live this down.", fx: { s: 10 } },
    { id: "dutchman",  w: 1, tag: "yarn",   t: "A sail that glows", b: "A ship crosses the moon with all canvas set and no crew on deck. The watch will not look at her.", fx: { s: 15 } },
    { id: "petrel",    w: 1, tag: "yarn",   t: "Mother Carey's chicken", b: "A storm petrel lands on the rail. Sailors say it carries the souls of drowned men. It stares at you.", fx: { s: 15 } },
    { id: "treasure",  w: 1, tag: "yarn",   t: "A map with an X", b: "Folded in a stolen coat: a map of the Maine islands with a cross in walnut ink. Probably nothing. Probably.", fx: { g: 60 } },
    { id: "warning",   w: 1, tag: "record", t: "The fisherman's warning", b: "An old dory man trades you cod and news. Weather is building to the northeast, he says. Big weather.", fx: { s: 10 }, mod: "warned" }
  ];

  // ---------------------------------------------------------------- voyage stages (the real route north)
  var STAGES = ["Windward Passage", "Florida Straits", "Carolina Coast", "Virginia Capes", "Long Island Sound", "Rhode Island Sound", "Cape Cod"];
  function stageFor(p) { return STAGES[clamp(Math.floor(p * (STAGES.length - 1)), 0, STAGES.length - 1)]; }

  // ---------------------------------------------------------------- palettes
  var PALETTES = [
    { name: "Clear morning", sky: ["#bfe0e8", "#7fb2c0"], sea: ["#2b6c86", "#0f3448"], foam: "#dff1f4", land: "#6f8f5a", tint: "#ffe9b0" },
    { name: "Bright noon",   sky: ["#a9d8ef", "#6fb0d6"], sea: ["#227a9b", "#0c3a52"], foam: "#eafaff", land: "#7a9a5e", tint: "#fff6d6" },
    { name: "Golden dusk",   sky: ["#f4c98a", "#c9718a"], sea: ["#3a5f7a", "#152a3f"], foam: "#ffe6cf", land: "#5f7350", tint: "#ffcf8a" },
    { name: "Grey fog",      sky: ["#c7cdd0", "#9aa7ae"], sea: ["#3d5964", "#182833"], foam: "#e8eef0", land: "#66756a", tint: "#dfe6e6" },
    { name: "Moonlit night", sky: ["#25324a", "#141d30"], sea: ["#1b3a52", "#08182a"], foam: "#bcd6e8", land: "#3f5148", tint: "#9fb6d6" }
  ];
  var STORM_PAL = { sky: ["#3a3c46", "#15161c"], sea: ["#25313b", "#0a1016"], foam: "#c4d2da", land: "#3a473f", tint: "#8ea0b4" };

  // ---------------------------------------------------------------- run state
  var G = null;
  function isBad(ev) { if (ev.choice) return false; var f = ev.fx || {}; return (f.s || 0) < 0 || (f.g || 0) < 0 || (f.h || 0) < 0; }
  function pickEvents(n) {
    var pool = EVENTS.slice(), out = [];
    function draw() {
      var tot = 0, i; for (i = 0; i < pool.length; i++) tot += pool[i].w;
      var r = Math.random() * tot;
      for (i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) break; }
      return pool.splice(Math.min(i, pool.length - 1), 1)[0];
    }
    while (out.length < n && pool.length) {
      var ev = draw();
      if (isBad(ev) && chance(upgLvl("charm") * 0.3) && pool.length) {
        var ev2 = draw();
        out.push(ev2);                      // the charm turns the bad card face down
      } else out.push(ev);
    }
    return out;
  }

  function newGame() {
    var maxH = 4 + upgLvl("hull");
    G = {
      score: 0, gold: 0, hull: maxH, maxHull: maxH,
      seq: [], seqIndex: -1, progress: 0,
      pal: choice(PALETTES), shipX: 0.5,
      preStormScore: 0, capped: false, won: false, stormCleared: false, ended: false, banked: false,
      rank: "", serpentBeaten: false, shipsBeaten: 0, battleNum: 0,
      mods: {}, curBeat: "title", events: []
    };
    // Build the voyage: events + battles + minis + serpent, shuffled; storm last.
    var evs = pickEvents(randInt(4, 6));
    G.events = evs.map(function (e) { return e.id; });
    var pool = evs.map(function (e) { return { kind: "event", ev: e }; });
    var nBattle = randInt(2, 3), nMini = randInt(2, 3);
    var minis = shuffle(["backstaff", "leadline", "logline"]);
    for (var b = 0; b < nBattle; b++) pool.push({ kind: "battle" });
    for (var m = 0; m < nMini; m++) pool.push({ kind: "mini", which: minis[m % 3] });
    shuffle(pool);
    var mid = clamp(randInt(Math.floor(pool.length / 3), Math.floor(pool.length * 2 / 3)), 1, pool.length);
    pool.splice(mid, 0, { kind: "serpent" });
    G.seq = [{ kind: "sail" }];
    for (var p = 0; p < pool.length; p++) { G.seq.push(pool[p]); G.seq.push({ kind: "sail" }); }
    G.seq.push({ kind: "storm" });
  }

  function addScore(n) { G.score += n; if (G.score < 0) G.score = 0; }
  function addGold(n) { G.gold += n; if (G.gold < 0) G.gold = 0; }
  function damage(n) {
    G.hull -= n; SFX.hit(); shake(6 + n * 2);
    if (G.hull <= 0) { G.hull = 0; endRun(false, true); }
  }
  function repair(n) { G.hull = clamp(G.hull + n, 0, G.maxHull); }

  // ---------------------------------------------------------------- particles + shake
  var parts = [];
  function spawn(x, y, opt) {
    parts.push({ x: x, y: y, vx: opt.vx || 0, vy: opt.vy || 0, life: opt.life || 0.6, t: 0,
      r: opt.r || 3, c: opt.c || "#fff", g: opt.g || 0, fade: opt.fade !== false, shape: opt.shape || "dot" });
  }
  function splash(x, y, n, col) { for (var i = 0; i < (n || 8); i++) spawn(x, y, { vx: rand(-70, 70), vy: rand(-160, -40), g: 320, life: rand(0.4, 0.9), r: rand(1.5, 3.5), c: col || "#dff1f4" }); }
  function smoke(x, y, n) { for (var i = 0; i < (n || 6); i++) spawn(x, y, { vx: rand(-25, 25), vy: rand(-40, -10), g: -8, life: rand(0.6, 1.2), r: rand(4, 9), c: "rgba(60,60,66,.6)", shape: "smoke" }); }
  function coinBurst(x, y) { for (var c = 0; c < 6; c++) spawn(x, y, { vx: rand(-40, 40), vy: rand(-90, -20), g: 200, life: 0.6, r: 2.5, c: "#f7d84a" }); }
  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t += dt;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) parts.splice(i, 1);
    }
  }
  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a = p.fade ? clamp(1 - p.t / p.life, 0, 1) : 1;
      ctx.globalAlpha = a; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.shape === "smoke" ? p.r * (1 + p.t) : p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  var shakeAmt = 0;
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

  // ---------------------------------------------------------------- sea + ambient life
  var seaT = 0, coast = [], gulls = [];
  function seedCoast() {
    coast = [];
    for (var i = 0; i < 40; i++) coast.push({ y: rand(-H, H), side: chance(0.5) ? 0 : 1, w: rand(30, 90), h: rand(50, 130) });
  }
  function spawnGull() {
    var fromLeft = chance(0.5);
    gulls.push({ x: fromLeft ? -20 : W + 20, y: rand(H * 0.03, H * 0.16), vx: (fromLeft ? 1 : -1) * rand(28, 55), ph: rand(0, 6), s: rand(0.7, 1.15) });
  }
  function updateGulls(dt) {
    if (gulls.length < 3 && chance(0.004)) spawnGull();
    for (var i = gulls.length - 1; i >= 0; i--) {
      var g = gulls[i]; g.x += g.vx * dt; g.ph += dt * 9; g.y += Math.sin(g.ph * 0.3) * 6 * dt;
      if (g.x < -40 || g.x > W + 40) gulls.splice(i, 1);
    }
  }
  function drawGulls(pal) {
    ctx.strokeStyle = pal.sky[1] === "#141d30" ? "rgba(200,215,230,.7)" : "rgba(40,50,60,.75)";
    ctx.lineWidth = 2; ctx.lineCap = "round";
    for (var i = 0; i < gulls.length; i++) {
      var g = gulls[i], f = Math.sin(g.ph) * 4 * g.s, s = 7 * g.s;
      ctx.beginPath();
      ctx.moveTo(g.x - s, g.y + f); ctx.quadraticCurveTo(g.x - s * 0.4, g.y - 3 * g.s, g.x, g.y);
      ctx.quadraticCurveTo(g.x + s * 0.4, g.y - 3 * g.s, g.x + s, g.y + f);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }
  function drawSea(pal, scroll, stormy) {
    var skyH = H * 0.2;
    var sg = ctx.createLinearGradient(0, 0, 0, skyH);
    sg.addColorStop(0, pal.sky[0]); sg.addColorStop(1, pal.sky[1]);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, skyH);
    var g = ctx.createLinearGradient(0, skyH, 0, H);
    g.addColorStop(0, pal.sea[0]); g.addColorStop(1, pal.sea[1]);
    ctx.fillStyle = g; ctx.fillRect(0, skyH, W, H - skyH);
    ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(0, skyH - 2, W, 4);
    ctx.strokeStyle = pal.foam;
    for (var r = 0; r < 22; r++) {
      var y = skyH + ((r * 46 + (scroll % 46)) % (H - skyH));
      var depth = (y - skyH) / (H - skyH);
      ctx.globalAlpha = 0.05 + depth * 0.12;
      ctx.lineWidth = 1 + depth * 1.6;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 24) {
        var yy = y + Math.sin((x * 0.02) + seaT * (stormy ? 4 : 1.6) + r) * (2 + depth * (stormy ? 10 : 5));
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    for (var c = 0; c < coast.length; c++) {
      var o = coast[c];
      o.y += (stormy ? 90 : 55) * 0.016 * (0.6 + (c % 3) * 0.2);
      var yy2 = (o.y % (H + 260)); if (yy2 < -160) yy2 += H + 260;
      if (yy2 > skyH - 40 && yy2 < H + 40) {
        var cx = o.side === 0 ? -10 + o.w * 0.4 : W + 10 - o.w * 0.4;
        ctx.fillStyle = pal.land; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(cx, yy2, o.w, o.h, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.15)";
        ctx.beginPath(); ctx.ellipse(cx, yy2 + o.h * 0.6, o.w * 1.05, o.h * 0.25, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    drawGulls(pal);
    ctx.fillStyle = pal.tint; ctx.globalAlpha = stormy ? 0.05 : 0.045; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (G && G.mods.fogNow) { ctx.fillStyle = "rgba(200,208,212,.32)"; ctx.fillRect(0, 0, W, H); }
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- sprites
  function drawShip(x, y, s, opt) {
    opt = opt || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(opt.rot || 0);
    var bob = Math.sin(seaT * 2 + (opt.phase || 0)) * 2;
    ctx.translate(0, bob);
    if (opt.wake) { ctx.fillStyle = "rgba(223,241,244,.5)"; ctx.beginPath(); ctx.moveTo(-6 * s, 10 * s); ctx.lineTo(6 * s, 10 * s); ctx.lineTo(2 * s, 30 * s); ctx.lineTo(-2 * s, 30 * s); ctx.closePath(); ctx.fill(); }
    var hullC = opt.hull || "#5a3a22", deck = opt.deck || "#8a5a34";
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 14 * s, 15 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = hullC;
    ctx.beginPath();
    ctx.moveTo(0, -22 * s); ctx.quadraticCurveTo(15 * s, -6 * s, 12 * s, 12 * s);
    ctx.quadraticCurveTo(0, 20 * s, -12 * s, 12 * s);
    ctx.quadraticCurveTo(-15 * s, -6 * s, 0, -22 * s); ctx.fill();
    if (opt.trim) { ctx.strokeStyle = opt.trim; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(-11 * s, 6 * s); ctx.quadraticCurveTo(0, 12 * s, 11 * s, 6 * s); ctx.stroke(); }
    ctx.fillStyle = deck; ctx.beginPath();
    ctx.moveTo(0, -16 * s); ctx.quadraticCurveTo(9 * s, -4 * s, 7 * s, 9 * s);
    ctx.quadraticCurveTo(0, 14 * s, -7 * s, 9 * s);
    ctx.quadraticCurveTo(-9 * s, -4 * s, 0, -16 * s); ctx.fill();
    ctx.strokeStyle = "#3a2414"; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.moveTo(0, 10 * s); ctx.lineTo(0, -20 * s); ctx.stroke();
    ctx.fillStyle = opt.sail || "#f3ead2";
    ctx.beginPath(); ctx.moveTo(-9 * s, -14 * s); ctx.quadraticCurveTo(0, -18 * s, 9 * s, -14 * s); ctx.lineTo(6 * s, -2 * s); ctx.quadraticCurveTo(0, -5 * s, -6 * s, -2 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.stroke();
    if (opt.flag) { ctx.fillStyle = opt.flag; ctx.fillRect(0, -22 * s, 9 * s, 5 * s); }
    if (opt.dmg) { for (var d = 0; d < opt.dmg; d++) if (chance(0.15)) smoke(x + rand(-8, 8), y - 6, 1); }
    ctx.restore();
  }
  function playerShipOpts(extra) {
    var lvls = upgLvl("hull") + upgLvl("pumps") + upgLvl("shot") + upgLvl("nest") + upgLvl("helm") + upgLvl("charm");
    var o = { wake: true, flag: "#111", dmg: G ? (G.maxHull - G.hull) : 0 };
    if (lvls >= 3) o.trim = "#e0b25c";
    if (lvls >= 6) o.sail = "#fdf6e0";
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function drawSerpent(seg, headOpen, flash) {
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (var i = seg.length - 1; i >= 1; i--) {
      var w = lerp(8, 30, i / seg.length);
      ctx.strokeStyle = flash ? "#d6ffd0" : (i % 2 ? "#2f6b4a" : "#3c7f58");
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(seg[i].x, seg[i].y); ctx.lineTo(seg[i - 1].x, seg[i - 1].y); ctx.stroke();
      if (i % 3 === 0) { ctx.fillStyle = "#245239"; ctx.beginPath(); ctx.ellipse(seg[i].x, seg[i].y, w * 0.7, w * 0.35, 0, 0, 7); ctx.fill(); }
    }
    var hd = seg[0];
    ctx.fillStyle = flash ? "#efffe9" : "#357a55";
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 26, 20, 0, 0, 7); ctx.fill();
    if (headOpen) { ctx.fillStyle = "#7a1f1f"; ctx.beginPath(); ctx.ellipse(hd.x, hd.y + 8, 15, 10, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#f7d84a"; ctx.beginPath(); ctx.arc(hd.x - 9, hd.y - 6, 4.5, 0, 7); ctx.arc(hd.x + 9, hd.y - 6, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(hd.x - 9, hd.y - 6, 2, 0, 7); ctx.arc(hd.x + 9, hd.y - 6, 2, 0, 7); ctx.fill();
    ctx.strokeStyle = "#8fae7d"; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(hd.x - 10, hd.y - 16); ctx.lineTo(hd.x - 16, hd.y - 28);
    ctx.moveTo(hd.x + 10, hd.y - 16); ctx.lineTo(hd.x + 16, hd.y - 28); ctx.stroke();
    ctx.restore();
  }
  function drawFin(x, y, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = "#33454e";
    ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(0, -16, 8, 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(223,241,244,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, 5); ctx.lineTo(12, 5); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD + panel text
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function panel(cx, cy, w, h) {
    ctx.fillStyle = "rgba(20,32,42,.92)";
    ctx.strokeStyle = "rgba(224,178,92,.8)"; ctx.lineWidth = 2;
    roundRect(cx - w / 2, cy - h / 2, w, h, 14); ctx.fill(); ctx.stroke();
  }
  function text(str, x, y, size, col, align, weight) {
    ctx.font = (weight || "") + " " + (size || 16) + "px Georgia, serif";
    ctx.fillStyle = col || "#f4e7c9"; ctx.textAlign = align || "center";
    ctx.fillText(str, x, y);
    ctx.textAlign = "left";
  }
  function wrapText(str, x, y, maxW, lh, size, col) {
    ctx.font = size + "px Georgia, serif"; ctx.fillStyle = col || "#f4e7c9"; ctx.textAlign = "center";
    var words = str.split(" "), line = "", yy = y;
    for (var i = 0; i < words.length; i++) {
      var t = line + words[i] + " ";
      if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i] + " "; yy += lh; }
      else line = t;
    }
    ctx.fillText(line, x, yy); ctx.textAlign = "left";
    return yy;
  }
  function drawHUD() {
    var pad = 12;
    for (var i = 0; i < G.maxHull; i++) {
      ctx.font = "18px serif";
      ctx.globalAlpha = i < G.hull ? 1 : 0.25;
      ctx.fillStyle = "#e05c5c";
      ctx.fillText(i < G.hull ? "♥" : "♡", pad + i * 20, 28);
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 19px Georgia, serif"; ctx.textAlign = "right"; ctx.fillStyle = "#f4e7c9";
    ctx.fillText("⚑ " + G.score, W - pad, 26);
    ctx.fillStyle = "#f7d84a";
    ctx.fillText("🪙 " + G.gold, W - pad, 48);
    ctx.textAlign = "left";
    var bw = clamp(W * 0.44, 140, 340), bx = (W - bw) / 2, by = 14, bh = 9;
    ctx.fillStyle = "rgba(11,22,32,.55)"; roundRect(bx - 4, by - 4, bw + 8, bh + 8, 8); ctx.fill();
    ctx.fillStyle = "rgba(244,231,201,.25)"; roundRect(bx, by, bw, bh, 5); ctx.fill();
    ctx.fillStyle = "#e0b25c"; roundRect(bx, by, bw * clamp(G.progress, 0, 1), bh, 5); ctx.fill();
    ctx.font = "13px serif"; ctx.fillStyle = "#f4e7c9";
    ctx.fillText("⚓", bx + bw * clamp(G.progress, 0, 1) - 6, by + bh + 14);
    text("MAINE", bx + bw + 26, by + 9, 10, "#cdeccf", "center", "bold");
    text(stageFor(G.progress), W / 2, by + bh + 26, 11.5, "rgba(244,231,201,.85)", "center");
  }

  // ==================================================================
  // SCENES
  // ==================================================================
  var scene = null;
  function setScene(s) { scene = s; if (s.enter) s.enter(); }

  function advance() {
    G.seqIndex++;
    if (G.seqIndex >= G.seq.length) { endRun(true, false); return; }
    G.progress = clamp(G.seqIndex / (G.seq.length - 1), 0, 1);
    var beat = G.seq[G.seqIndex];
    G.curBeat = beat.kind + (beat.which ? ":" + beat.which : "") + (beat.ev ? ":" + beat.ev.id : "");
    if (beat.kind === "sail") setScene(SailScene());
    else if (beat.kind === "battle") setScene(BattleScene());
    else if (beat.kind === "serpent") setScene(SerpentScene());
    else if (beat.kind === "storm") setScene(StormScene());
    else if (beat.kind === "event") setScene(EventScene(beat.ev));
    else if (beat.kind === "mini") setScene(MiniScene(beat.which));
    else setScene(SailScene());
  }

  function Prompt(title, body, cb, tagline) {
    return { t: 0, update: function (dt) {
        this.t += dt;
        if (this.t > 0.35 && consumeTap()) cb();
      }, render: function () {
        var w = clamp(W * 0.84, 260, 470), h = tagline ? 178 : 156;
        panel(W / 2, H / 2, w, h);
        text(title, W / 2, H / 2 - h / 2 + 34, 23, "#e0b25c", "center", "bold");
        var yy = wrapText(body, W / 2, H / 2 - h / 2 + 62, w - 44, 21, 14.5, "#f4e7c9");
        if (tagline) text(tagline, W / 2, yy + 26, 12, "#9fb6d6", "center", "bold");
        text("tap or press SPACE", W / 2, H / 2 + h / 2 - 14, 11.5, "rgba(244,231,201,.6)");
      } };
  }

  // ---------------------------------------------------------------- TITLE
  function TitleScene() {
    return {
      enter: function () { document.body.classList.remove("playing"); seedCoast(); if (!G) newGame(); },
      update: function (dt) { seaT += dt; updateGulls(dt); },
      render: function () {
        drawSea(G.pal || PALETTES[1], seaT * 40, false);
        drawShip(W / 2, H * 0.62, 2.2, playerShipOpts({ dmg: 0 }));
        var w = clamp(W * 0.88, 300, 540);
        panel(W / 2, H * 0.3, w, 196);
        text("FIRST SAIL", W / 2, H * 0.3 - 58, 38, "#e0b25c", "center", "bold");
        wrapText("February 1717. The crew took the Whydah after a three day chase. Sam Bellamy is captain. Run her north. Make Maine. Beat the storm the real crew never did.",
          W / 2, H * 0.3 - 24, w - 46, 20, 14, "#f4e7c9");
        text("steer with ← → or A / D  ·  SPACE fires", W / 2, H * 0.3 + 62, 13, "#cdb98a");
        text("Best " + SAVE.best + "  ·  Bank 🪙 " + SAVE.bank + "  ·  Voyages " + SAVE.runs, W / 2, H * 0.3 + 84, 12, "rgba(244,231,201,.7)");
        var bw = clamp(W * 0.36, 130, 172), by = H * 0.8;
        if (uiButton(W / 2 - bw - 10, by - 26, bw, 52, "⚓ SET SAIL", { size: 17 })) { startRun(); }
        if (uiButton(W / 2 + 10, by - 26, bw, 52, "⚒ HARBOR", { size: 17, color: "#1f4a5e" })) { setScene(HarborScene(false)); }
        if (consumeTap()) startRun();
      }
    };
  }

  // ---------------------------------------------------------------- SAIL leg
  function SailScene() {
    var legTime = rand(5.5, 8.5), t = 0;
    var objs = [], spawnT = 0;
    var slow = G.mods.slow ? 0.75 : 1; G.mods.slow = false;
    G.mods.fogNow = !!G.mods.fog; G.mods.fog = false;
    var hazMul = 1 + warnBonus() * 0.22;   // crow's nest: hazards spread out
    return {
      enter: function () { document.body.classList.add("playing"); if (chance(0.5)) G.pal = choice(PALETTES); if (chance(0.6)) spawnGull(); },
      update: function (dt) {
        seaT += dt; t += dt; updateGulls(dt);
        var sp = steerSpeed() * slow * dt;
        if (input.left) G.shipX -= sp; if (input.right) G.shipX += sp;
        if (input.pDown && input.py > H * 0.4) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.2);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = rand(0.55, 1.15) * hazMul;
          var roll = Math.random(), o;
          if (roll < 0.42) o = { kind: "hazard", sub: choice(["rock", "ice", "rock", "wood"]), r: rand(16, 26), sp: rand(150, 230) };
          else if (roll < 0.52) o = { kind: "fin", sub: "fin", r: 15, sp: rand(90, 130), drift: rand(-40, 40) };
          else o = { kind: "pickup", sub: choice(["coin", "coin", "coin", "wind", "barrel"]), r: 15, sp: rand(150, 230) };
          o.x = rand(0.1, 0.9) * W; o.y = -40; o.a = 0; o.spin = rand(-2, 2);
          objs.push(o);
        }
        var shipPX = G.shipX * W, shipPY = H * 0.82;
        for (var i = objs.length - 1; i >= 0; i--) {
          var o = objs[i]; o.y += o.sp * dt; o.a += o.spin * dt;
          if (o.kind === "fin") o.x += (o.drift || 0) * dt;
          var d = Math.hypot(o.x - shipPX, o.y - shipPY);
          if (d < o.r + 16) {
            if (o.kind === "hazard") { splash(o.x, o.y, 8); damage(1); objs.splice(i, 1); continue; }
            if (o.kind === "fin") { splash(o.x, o.y, 6, "#9fb6c9"); addScore(-5); SFX.bad(); objs.splice(i, 1); continue; }
            if (o.sub === "coin") { addScore(10); addGold(5); SFX.coin(); coinBurst(o.x, o.y); }
            else if (o.sub === "wind") { addScore(8); SFX.good(); t += 0.6; }
            else if (o.sub === "barrel") { repair(1); SFX.good(); for (var b2 = 0; b2 < 8; b2++) spawn(o.x, o.y, { vx: rand(-40, 40), vy: rand(-70, -10), g: 160, life: 0.7, r: 3, c: "#8fd6a0" }); }
            objs.splice(i, 1); continue;
          }
          if (o.y > H + 50) { if (o.kind === "hazard") addScore(2); objs.splice(i, 1); }
        }
        if (t >= legTime) advance();
      },
      render: function () {
        drawSea(G.pal, seaT * 55, false);
        for (var i = 0; i < objs.length; i++) {
          var o = objs[i];
          if (o.kind === "fin") { drawFin(o.x, o.y, (o.drift || 1) >= 0 ? 1 : -1); continue; }
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a);
          if (o.kind === "hazard") {
            if (o.sub === "rock") { ctx.fillStyle = "#5b5750"; blob(o.r); ctx.fillStyle = "rgba(255,255,255,.12)"; blob(o.r * 0.6); }
            else if (o.sub === "ice") { ctx.fillStyle = "#cfe9f2"; blob(o.r); ctx.fillStyle = "rgba(255,255,255,.5)"; blob(o.r * 0.5); }
            else { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(-o.r, -5, o.r * 2, 10); }
          } else {
            if (o.sub === "coin") { ctx.fillStyle = "#f7d84a"; ctx.beginPath(); ctx.arc(0, 0, o.r, 0, 7); ctx.fill(); ctx.fillStyle = "#b98f20"; ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.fillText("$", 0, 5); ctx.textAlign = "left"; }
            else if (o.sub === "wind") { ctx.strokeStyle = "#eafaff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, o.r, 0.6, 5.2); ctx.stroke(); }
            else { ctx.fillStyle = "#8a5a34"; ctx.fillRect(-o.r * 0.7, -o.r, o.r * 1.4, o.r * 2); ctx.strokeStyle = "#5a3a22"; ctx.lineWidth = 2; ctx.strokeRect(-o.r * 0.7, -o.r, o.r * 1.4, o.r * 2); }
          }
          ctx.restore();
        }
        drawShip(G.shipX * W, H * 0.82, 1.6, playerShipOpts());
        drawParts();
        drawHUD();
        if (t < 2.0) { ctx.globalAlpha = clamp(2.0 - t, 0, 1); text(stageFor(G.progress) + ". Coins feed the war chest. Dodge the rest.", W / 2, H * 0.5, 16, "#f4e7c9", "center", "bold"); ctx.globalAlpha = 1; }
      }
    };
  }
  function blob(r) { ctx.beginPath(); ctx.moveTo(r, 0); for (var a = 0; a <= 7; a += 0.7) { var rr = r * (0.8 + 0.2 * Math.sin(a * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  // ---------------------------------------------------------------- EVENT card
  function EventScene(ev) {
    var t = 0, applied = false, picked = -1, resultLine = "";
    function apply(fx) {
      fx = fx || {};
      if (fx.s) addScore(fx.s);
      if (fx.g) addGold(fx.g);
      if (fx.h) { if (fx.h > 0) repair(fx.h); else damage(-fx.h); }
      var good = (fx.s || 0) >= 0 && (fx.g || 0) >= 0 && (fx.h || 0) >= 0;
      if (good) SFX.good(); else SFX.bad();
    }
    function applyMod(m) {
      if (!m) return;
      if (m === "fog") G.mods.fog = true;
      else if (m === "drill") G.mods.drill = true;
      else if (m === "chart") G.mods.chart = true;
      else if (m === "slow") G.mods.slow = true;
      else if (m === "warned") G.mods.warned = true;
      else if (m === "navyintel") G.mods.navyintel = true;
      else if (m === "navy") G.mods.navyNext = true;
    }
    function fxLine(fx) {
      fx = fx || {}; var bits = [];
      if (fx.s) bits.push((fx.s > 0 ? "+" : "") + fx.s + " points");
      if (fx.g) bits.push((fx.g > 0 ? "+" : "") + fx.g + " gold");
      if (fx.h) bits.push((fx.h > 0 ? "+" : "") + fx.h + " hull");
      return bits.join("   ");
    }
    return {
      debugChoose: function (i) { if (ev.choice && picked < 0) { picked = i; var c = ev.choice[i]; apply(c.fx); applyMod(c.mod); resultLine = c.r; } },
      update: function (dt) {
        seaT += dt; t += dt; updateGulls(dt);
        if (!ev.choice && !applied && t > 0.2) { applied = true; apply(ev.fx); applyMod(ev.mod); }
        if (ev.choice && picked < 0) {
          if (input.leftPressed) this.debugChoose(0);
          else if (input.rightPressed) this.debugChoose(1);
          return;
        }
        if (t > 0.3 && consumeTap()) advance();
      },
      render: function () {
        drawSea(G.pal, seaT * 40, false);
        drawShip(W / 2, H * 0.74, 1.7, playerShipOpts());
        drawParts(); drawHUD();
        var w = clamp(W * 0.86, 290, 480);
        var isChoice = !!ev.choice && picked < 0;
        var h = isChoice ? 236 : 196;
        var cy = H * 0.42;
        panel(W / 2, cy, w, h);
        var tagTxt = ev.tag === "record" ? "⚓ FROM THE RECORD" : (ev.tag === "yarn" ? "🌀 SEA YARN" : "LIFE AT SEA");
        var tagCol = ev.tag === "record" ? "#8fd6a0" : (ev.tag === "yarn" ? "#9fb6d6" : "#cdb98a");
        text(tagTxt, W / 2, cy - h / 2 + 24, 11, tagCol, "center", "bold");
        text(ev.t, W / 2, cy - h / 2 + 50, 21, "#e0b25c", "center", "bold");
        var yy = wrapText(ev.b, W / 2, cy - h / 2 + 76, w - 46, 20, 14, "#f4e7c9");
        if (isChoice) {
          var bw = (w - 60) / 2, by = cy + h / 2 - 58;
          for (var i = 0; i < 2; i++) {
            if (uiButton(W / 2 - w / 2 + 20 + i * (bw + 20), by, bw, 44, ev.choice[i].l, { size: 13.5, color: i === 0 ? "#96341f" : "#1f4a5e" })) this.debugChoose(i);
          }
          text("or press ← for the first, → for the second", W / 2, cy + h / 2 - 4, 10.5, "rgba(244,231,201,.55)");
        } else {
          if (picked >= 0 && resultLine) wrapText(resultLine, W / 2, yy + 24, w - 60, 18, 13, "#cdeccf");
          var line = fxLine(picked >= 0 ? ev.choice[picked].fx : ev.fx);
          if (line) text(line, W / 2, cy + h / 2 - 34, 15, "#e0b25c", "center", "bold");
          text("tap to sail on", W / 2, cy + h / 2 - 12, 11.5, "rgba(244,231,201,.6)");
        }
      }
    };
  }

  // ---------------------------------------------------------------- BATTLE
  var ENEMY_TYPES = [
    { id: "sloop", name: "Pirate hunter sloop", hp: 5, speed: 120, fire: [0.8, 1.5], gold: [30, 50], score: 45, hull: "#4a2f2f", deck: "#6a4444", flag: "#7a1f1f", sail: "#e8d3b0" },
    { id: "brig",  name: "Armed merchant brig", hp: 7, speed: 80,  fire: [0.7, 1.3], gold: [50, 80], score: 60, hull: "#3d3a2f", deck: "#5e5a44", flag: "#b98f20", sail: "#efe6cc" },
    { id: "navy",  name: "King's man-of-war",   hp: 9, speed: 100, fire: [0.55, 1.0], gold: [70, 110], score: 90, hull: "#2f3a4a", deck: "#48586e", flag: "#e8e8f0", sail: "#f5f2ea" }
  ];
  function BattleScene() {
    G.battleNum++;
    var tier = G.battleNum + (G.mods.navyNext ? 1 : 0); G.mods.navyNext = false;
    var type = ENEMY_TYPES[clamp(tier - 1, 0, 2)];
    if (tier === 2 && chance(0.35)) type = ENEMY_TYPES[0];
    var phase = "intro";
    var enemy = { x: W * 0.5, y: H * 0.2, hp: type.hp, max: type.hp, dir: 1, fireT: 1.2 };
    var fireMod = (G.mods.navyintel ? 0.3 : 0); G.mods.navyintel = false;
    var dmgBonus = G.mods.drill ? 1 : 0; G.mods.drill = false;
    var balls = [], t = 0, prompt = null, loot = 0;
    return {
      enter: function () { prompt = Prompt(type.name + "!", "She wants your ship at the bottom. Fire when you can. Dodge her shot. Sink her for gold.", function () { phase = "fight"; }); },
      update: function (dt) {
        seaT += dt; t += dt; updateGulls(dt);
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        var sp = steerSpeed() * dt;
        if (input.left) G.shipX -= sp; if (input.right) G.shipX += sp;
        if (input.pDown && input.py > H * 0.5) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.25);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        var shipPX = G.shipX * W, shipPY = H * 0.82;
        if (consumeFire()) { balls.push({ x: shipPX, y: shipPY - 20, vy: -420, own: 1 }); SFX.fire(); smoke(shipPX, shipPY - 18, 3); }
        enemy.x += enemy.dir * type.speed * dt;
        if (enemy.x < W * 0.15 || enemy.x > W * 0.85) enemy.dir *= -1;
        enemy.fireT -= dt;
        if (enemy.fireT <= 0) { enemy.fireT = rand(type.fire[0], type.fire[1]) + fireMod; balls.push({ x: enemy.x, y: enemy.y + 18, vy: 300 + tier * 25, own: 0 }); }
        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i]; b.y += b.vy * dt;
          if (b.own === 1 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 26) {
            var dmg = 1 + dmgBonus + (chance(shotBonus()) ? 1 : 0);
            enemy.hp -= dmg; splash(b.x, b.y, 8, "#e08c6a"); SFX.hit(); balls.splice(i, 1);
            if (enemy.hp <= 0) {
              phase = "done"; loot = randInt(type.gold[0], type.gold[1]); addGold(loot); addScore(type.score); G.shipsBeaten++;
              SFX.win();
              for (var k = 0; k < 24; k++) spawn(enemy.x, enemy.y, { vx: rand(-120, 120), vy: rand(-160, 40), g: 260, life: rand(0.6, 1.2), r: rand(2, 4), c: choice(["#f7d84a", "#e08c6a", "#fff"]) });
            }
            continue;
          }
          if (b.own === 0 && Math.hypot(b.x - shipPX, b.y - shipPY) < 18) { balls.splice(i, 1); damage(1); continue; }
          if (b.y < -30 || b.y > H + 30) balls.splice(i, 1);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 45, false);
        if (phase !== "intro") {
          var bw = 120, bx = enemy.x - bw / 2;
          ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(bx - 2, 6, bw + 4, 10, 4); ctx.fill();
          ctx.fillStyle = "#7a1f1f"; roundRect(bx, 8, bw * (enemy.hp / enemy.max), 6, 3); ctx.fill();
        }
        drawShip(enemy.x, enemy.y, 1.7, { rot: Math.PI, flag: type.flag, hull: type.hull, deck: type.deck, sail: type.sail, dmg: enemy.max - enemy.hp });
        for (var i = 0; i < balls.length; i++) { var b = balls[i]; ctx.fillStyle = b.own ? "#f4e7c9" : "#e08c6a"; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); }
        drawShip(G.shipX * W, H * 0.82, 1.6, playerShipOpts());
        drawParts(); drawHUD();
        if (phase === "intro") prompt.render();
        if (phase === "done") { var w = clamp(W * 0.72, 240, 390); panel(W / 2, H / 2, w, 126); text("She strikes her colors!", W / 2, H / 2 - 24, 22, "#8fd6a0", "center", "bold"); text("+" + loot + " gold   +" + type.score + " points", W / 2, H / 2 + 8, 17, "#e0b25c", "center", "bold"); text("tap to sail on", W / 2, H / 2 + 42, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
  }

  // ---------------------------------------------------------------- SERPENT (a yarn, and says so)
  function SerpentScene() {
    var phase = "intro", prompt = null;
    var seg = []; for (var i = 0; i < 14; i++) seg.push({ x: W * 0.5, y: -60 - i * 24 });
    var hp = 5, max = 5, t = 0, state = "weave", stateT = rand(1.5, 2.5), lungeX = 0, headOpen = false, flashT = 0, balls = [];
    var baseY = H * 0.32, rearTime = 0.9 + warnBonus() * 0.35;
    return {
      enter: function () { prompt = Prompt("A SEA SERPENT!", "Sailors in 1717 swore these waters hid monsters. This one is a sea story. Dodge the lunge, then fire at its head.", function () { phase = "fight"; }, "🌀 SEA YARN"); },
      update: function (dt) {
        seaT += dt; t += dt; if (flashT > 0) flashT -= dt;
        if (phase === "intro") { prompt.update(dt); moveHead(dt, W * 0.5, baseY); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        var sp = steerSpeed() * dt;
        if (input.left) G.shipX -= sp; if (input.right) G.shipX += sp;
        if (input.pDown && input.py > H * 0.55) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.25);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        var shipPX = G.shipX * W, shipPY = H * 0.84;
        if (consumeFire()) { balls.push({ x: shipPX, y: shipPY - 20, vy: -460 }); SFX.fire(); }
        stateT -= dt;
        if (state === "weave") {
          headOpen = false;
          moveHead(dt, W * 0.5 + Math.sin(t * 1.6) * W * 0.32, baseY + Math.sin(t * 2) * 20);
          if (stateT <= 0) { state = "rear"; stateT = rearTime; lungeX = shipPX; }
        } else if (state === "rear") {
          headOpen = true;
          moveHead(dt, lungeX, baseY - 30);
          if (stateT <= 0) { state = "lunge"; stateT = 0.45; }
        } else if (state === "lunge") {
          moveHead(dt, lungeX, H * 0.7);
          if (Math.hypot(seg[0].x - shipPX, seg[0].y - shipPY) < 46) { damage(2); state = "recover"; stateT = 1.0; }
          if (stateT <= 0) { state = "recover"; stateT = 0.8; }
        } else {
          headOpen = false;
          moveHead(dt, W * 0.5, baseY);
          if (stateT <= 0) { state = "weave"; stateT = rand(1.4, 2.4); }
        }
        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i]; b.y += b.vy * dt;
          if (Math.hypot(b.x - seg[0].x, b.y - seg[0].y) < 30) {
            balls.splice(i, 1); hp--; flashT = 0.12; SFX.hit(); splash(seg[0].x, seg[0].y, 10, "#8fd6a0");
            if (hp <= 0) {
              phase = "done"; addScore(120); addGold(80); G.serpentBeaten = true; SFX.win();
              for (var k = 0; k < 30; k++) spawn(seg[0].x, seg[0].y, { vx: rand(-140, 140), vy: rand(-160, 60), g: 240, life: rand(0.6, 1.3), r: rand(2, 5), c: choice(["#8fd6a0", "#f7d84a", "#fff"]) });
            }
            continue;
          }
          if (b.y < -30) balls.splice(i, 1);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 50, false);
        if (phase !== "intro") { var bw = 160, bx = W / 2 - bw / 2; ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(bx - 2, 6, bw + 4, 12, 5); ctx.fill(); ctx.fillStyle = "#2f6b4a"; roundRect(bx, 8, bw * (hp / max), 8, 4); ctx.fill(); text("SERPENT", W / 2, 32, 11, "#cdeccf", "center", "bold"); }
        drawSerpent(seg, headOpen, flashT > 0);
        for (var i = 0; i < balls.length; i++) { ctx.fillStyle = "#f4e7c9"; ctx.beginPath(); ctx.arc(balls[i].x, balls[i].y, 5, 0, 7); ctx.fill(); }
        drawShip(G.shipX * W, H * 0.84, 1.6, playerShipOpts());
        drawParts(); drawHUD();
        if (headOpen && phase === "fight") text("FIRE!", seg[0].x, seg[0].y - 40, 16, "#ffd24a", "center", "bold");
        if (phase === "intro") prompt.render();
        if (phase === "done") { var w = clamp(W * 0.72, 240, 400); panel(W / 2, H / 2, w, 126); text("Serpent driven off!", W / 2, H / 2 - 24, 23, "#8fd6a0", "center", "bold"); text("+120 points   +80 gold", W / 2, H / 2 + 8, 17, "#e0b25c", "center", "bold"); text("tap to sail on", W / 2, H / 2 + 42, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
    function moveHead(dt, tx, ty) {
      seg[0].x = lerp(seg[0].x, tx, clamp(6 * dt, 0, 1));
      seg[0].y = lerp(seg[0].y, ty, clamp(6 * dt, 0, 1));
      for (var i = 1; i < seg.length; i++) {
        seg[i].x = lerp(seg[i].x, seg[i - 1].x, clamp(12 * dt, 0, 1));
        seg[i].y = lerp(seg[i].y, seg[i - 1].y + 16, clamp(12 * dt, 0, 1));
      }
    }
  }

  // ---------------------------------------------------------------- NAV MINI-GAMES
  function MiniScene(kind) {
    if (kind === "backstaff") return Backstaff();
    if (kind === "leadline") return LeadLine();
    return LogLine();
  }
  function Backstaff() {
    var phase = "intro", prompt = null, pos = 0, dir = 1, spd = rand(0.85, 1.15), tries = 3, got = 0, res = 0, showT = 0;
    var zone = rand(0.25, 0.75), zoneW = 0.16;
    return {
      enter: function () { prompt = Prompt("Take a sun-sight", "The backstaff finds your latitude from the sun. Real crews used one on this ship. Press SPACE when the sun sits on the horizon band. Three sights.", function () { phase = "play"; }, "⚓ FROM THE RECORD"); },
      update: function (dt) {
        seaT += dt; updateGulls(dt);
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        if (showT > 0) { showT -= dt; return; }
        pos += dir * spd * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
        if (consumeFire()) {
          var off = Math.abs(pos - zone);
          if (off < zoneW / 2) { var pts = off < 0.03 ? 50 : 30; addScore(pts); addGold(10); got++; res = pts; SFX.point(); }
          else { res = 0; SFX.bad(); }
          showT = 0.8; tries--; zone = rand(0.25, 0.75);
          if (tries <= 0) setTimeout2(function () { phase = "done"; }, 0.85);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 35, false);
        drawParts(); drawHUD();
        var cx = W / 2, cy = H * 0.55, w = clamp(W * 0.7, 250, 420);
        panel(cx, cy - 90, clamp(W * 0.8, 270, 460), 56);
        text("Sights left: " + tries + "    Good: " + got, cx, cy - 84, 15, "#f4e7c9", "center", "bold");
        ctx.strokeStyle = "rgba(244,231,201,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx + w / 2, cy); ctx.stroke();
        ctx.fillStyle = "rgba(143,214,160,.35)"; ctx.fillRect(cx - w / 2 + (zone - zoneW / 2) * w, cy - 24, zoneW * w, 48);
        text("horizon", cx - w / 2 + zone * w, cy + 40, 11, "#8fd6a0");
        var sx = cx - w / 2 + pos * w;
        ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(sx, cy - 24, 12, 0, 7); ctx.fill();
        ctx.strokeStyle = "#ffd24a"; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(sx, cy - 24); ctx.lineTo(sx, cy + 20); ctx.stroke(); ctx.globalAlpha = 1;
        if (phase === "intro") prompt.render();
        else if (showT > 0) text(res > 0 ? "+" + res + (res >= 50 ? "  Dead on!" : "  Good sight") : "Missed", cx, cy - 50, 17, res > 0 ? "#8fd6a0" : "#e08c6a", "center", "bold");
        else text("SPACE or 🔥 on the green band", cx, H * 0.8, 13, "#cdb98a");
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 112); text("Sights logged", cx, H / 2 - 18, 21, "#e0b25c", "center", "bold"); text(got + " of 3 on target", cx, H / 2 + 10, 15, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
  }
  function LeadLine() {
    var phase = "intro", prompt = null, y = 0, tries = 3, got = 0, showT = 0, res = 0;
    var band = rand(0.3, 0.75), bandW = 0.16, spd = rand(0.7, 1.0);
    return {
      enter: function () { prompt = Prompt("Sound the depth", "A lead weight on a marked rope. It told the crew how much water was under the keel. Press SPACE when the lead is in the band. Three drops.", function () { phase = "play"; }, "⚓ FROM THE RECORD"); },
      update: function (dt) {
        seaT += dt; updateGulls(dt);
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        if (showT > 0) { showT -= dt; return; }
        y += spd * dt; if (y > 1) y = 0;
        if (consumeFire()) {
          var off = Math.abs(y - band);
          if (off < bandW / 2) { var pts = off < 0.03 ? 50 : 30; addScore(pts); addGold(10); got++; res = pts; SFX.point(); }
          else { res = 0; SFX.bad(); }
          showT = 0.8; tries--; band = rand(0.3, 0.75);
          if (tries <= 0) setTimeout2(function () { phase = "done"; }, 0.85);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 30, false);
        drawParts(); drawHUD();
        var cx = W / 2, top = H * 0.28, h = clamp(H * 0.42, 190, 380);
        panel(cx, top - 34, clamp(W * 0.8, 270, 460), 44);
        text("Drops left: " + tries + "    Good: " + got, cx, top - 28, 15, "#f4e7c9", "center", "bold");
        ctx.strokeStyle = "rgba(244,231,201,.3)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top + h); ctx.stroke();
        ctx.fillStyle = "rgba(143,214,160,.35)"; ctx.fillRect(cx - 60, top + (band - bandW / 2) * h, 120, bandW * h);
        text("sounding", cx + 84, top + band * h + 4, 11, "#8fd6a0");
        var ly = top + y * h;
        ctx.strokeStyle = "#cdb98a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, ly); ctx.stroke();
        ctx.fillStyle = "#8a8f96"; ctx.beginPath(); ctx.moveTo(cx - 8, ly); ctx.lineTo(cx + 8, ly); ctx.lineTo(cx, ly + 18); ctx.closePath(); ctx.fill();
        if (phase === "intro") prompt.render();
        else if (showT > 0) text(res > 0 ? "+" + res + (res >= 50 ? "  By the mark!" : "  Good") : "Missed", cx, top + h + 30, 17, res > 0 ? "#8fd6a0" : "#e08c6a", "center", "bold");
        else text("SPACE or 🔥 in the green band", cx, top + h + 30, 13, "#cdb98a");
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 112); text("Depths sounded", cx, H / 2 - 18, 21, "#e0b25c", "center", "bold"); text(got + " of 3 on the mark", cx, H / 2 + 10, 15, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
  }
  function LogLine() {
    var phase = "intro", prompt = null, knots = [], spawnT = 0, got = 0, missed = 0, total = 8, done2 = 0;
    return {
      enter: function () { prompt = Prompt("Stream the log", "A rope with knots tied at even spaces. Count the knots and you know your speed. That is why ships still measure speed in knots. Press SPACE as each knot crosses the line.", function () { phase = "play"; }, "⚓ FROM THE RECORD"); },
      update: function (dt) {
        seaT += dt; updateGulls(dt);
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        var markY = H * 0.7;
        spawnT -= dt;
        if (done2 < total && spawnT <= 0) { spawnT = rand(0.55, 0.9); knots.push({ y: -20, hit: false }); done2++; }
        for (var i = knots.length - 1; i >= 0; i--) { var k = knots[i]; k.y += 230 * dt; if (k.y > H + 20) { if (!k.hit) missed++; knots.splice(i, 1); } }
        if (consumeFire()) {
          var best = null, bd = 999;
          for (var j = 0; j < knots.length; j++) { if (knots[j].hit) continue; var d = Math.abs(knots[j].y - markY); if (d < bd) { bd = d; best = knots[j]; } }
          if (best && bd < 40) { best.hit = true; var pts = bd < 14 ? 30 : 18; addScore(pts); addGold(5); got++; SFX.point(); for (var s = 0; s < 5; s++) spawn(W / 2, markY, { vx: rand(-40, 40), vy: rand(-60, -10), g: 160, life: 0.5, r: 2, c: "#f7d84a" }); }
          else SFX.bad();
        }
        if (done2 >= total && knots.length === 0) phase = "done";
      },
      render: function () {
        drawSea(G.pal, seaT * 60, false);
        drawParts(); drawHUD();
        var cx = W / 2;
        panel(cx, H * 0.16, clamp(W * 0.8, 270, 460), 44);
        text("Knots caught: " + got + "    Missed: " + missed, cx, H * 0.16 + 5, 15, "#f4e7c9", "center", "bold");
        ctx.strokeStyle = "rgba(205,185,138,.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
        ctx.strokeStyle = "#e0b25c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 60, H * 0.7); ctx.lineTo(cx + 60, H * 0.7); ctx.stroke();
        text("press here", cx + 108, H * 0.7 + 4, 11, "#cdb98a");
        for (var i = 0; i < knots.length; i++) { var k = knots[i]; ctx.fillStyle = k.hit ? "#8fd6a0" : "#f4e7c9"; ctx.beginPath(); ctx.arc(cx, k.y, 9, 0, 7); ctx.fill(); ctx.strokeStyle = "#5a3a22"; ctx.lineWidth = 2; ctx.stroke(); }
        if (phase === "intro") prompt.render();
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 112); text("Speed logged", cx, H / 2 - 18, 21, "#e0b25c", "center", "bold"); text(got + " of " + total + " knots", cx, H / 2 + 10, 15, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
  }

  var timers = [];
  function setTimeout2(fn, sec) { timers.push({ fn: fn, t: sec }); }
  function updateTimers(dt) { for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } } }

  // ---------------------------------------------------------------- STORM finale
  function StormScene() {
    var phase = "intro", prompt = null;
    var t = 0, survive = rand(20, 24) - (G.mods.warned ? 3 : 0), objs = [], spawnT = 0, lightning = 0, waveT = rand(3, 5), bigWave = null;
    var warnLen = 1.4 + warnBonus();
    return {
      enter: function () {
        G.preStormScore = G.score;
        prompt = Prompt("THE NOR'EASTER", "Cape Cod. The same storm that sank the real Whydah on April 26, 1717. Dodge the wreckage. Brace for the great waves. Hold on and make Maine.", function () { phase = "play"; }, "⚓ FROM THE RECORD");
      },
      update: function (dt) {
        seaT += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "won") { if (consumeTap()) endRun(true, false); return; }
        t += dt;
        G.progress = clamp(0.86 + 0.14 * (t / survive), 0, 1);
        var sp = steerSpeed() * dt;
        if (input.left) G.shipX -= sp; if (input.right) G.shipX += sp;
        if (input.pDown && input.py > H * 0.4) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.06, 0.94), 0.18);
        G.shipX += Math.sin(t * 1.3) * 0.12 * dt;
        G.shipX = clamp(G.shipX, 0.06, 0.94);
        if (lightning > 0) lightning -= dt;
        if (chance(0.006)) { lightning = 0.12; SFX.thunder(); }
        spawnT -= dt;
        if (spawnT <= 0) { spawnT = rand(0.3, 0.6); objs.push({ x: rand(0.08, 0.92) * W, y: -30, r: rand(15, 24), sp: rand(230, 320), a: 0, spin: rand(-3, 3), sub: choice(["rock", "wood", "wood"]) }); }
        var shipPX = G.shipX * W, shipPY = H * 0.84;
        for (var i = objs.length - 1; i >= 0; i--) {
          var o = objs[i]; o.y += o.sp * dt; o.a += o.spin * dt;
          if (Math.hypot(o.x - shipPX, o.y - shipPY) < o.r + 15) {
            splash(o.x, o.y, 8);
            if (chance(stormShrug())) { addScore(5); SFX.good(); }   // the pumps hold
            else damage(1);
            objs.splice(i, 1); continue;
          }
          if (o.y > H + 40) objs.splice(i, 1);
        }
        waveT -= dt;
        if (!bigWave && waveT <= 0) bigWave = { warn: warnLen, hit: false };
        if (bigWave) {
          bigWave.warn -= dt;
          if (bigWave.warn <= 0 && !bigWave.hit) {
            bigWave.hit = true;
            if (!input.fire) { if (chance(stormShrug())) { shake(8); } else { damage(2); shake(16); } }
            else { addScore(20); shake(8); }
            bigWave = null; waveT = rand(5, 8);
          }
        }
        if (chance(0.5)) spawn(rand(0, W), rand(H * 0.2, H), { vx: rand(-40, 40), vy: rand(80, 160), g: 0, life: 0.5, r: rand(1, 2.5), c: "rgba(220,235,240,.7)" });
        if (t >= survive) { phase = "won"; G.stormCleared = true; SFX.win(); }
      },
      render: function () {
        drawSea(STORM_PAL, seaT * 90, true);
        ctx.strokeStyle = "rgba(200,220,230,.35)"; ctx.lineWidth = 1;
        for (var r = 0; r < 60; r++) { var rx = (r * 173 + (seaT * 900) % W) % W; var ry = (r * 271 + (seaT * 1400) % H) % H; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 16); ctx.stroke(); }
        for (var i = 0; i < objs.length; i++) { var o = objs[i]; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); if (o.sub === "rock") { ctx.fillStyle = "#4a4740"; blob(o.r); } else { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(-o.r, -5, o.r * 2, 10); } ctx.restore(); }
        drawShip(G.shipX * W, H * 0.84, 1.6, playerShipOpts());
        drawParts(); drawHUD();
        var sw = clamp(W * 0.6, 200, 400), sx = (W - sw) / 2, sy = H - 28;
        text("HOLD ON", W / 2, sy - 10, 13, "#f4e7c9", "center", "bold");
        ctx.fillStyle = "rgba(0,0,0,.5)"; roundRect(sx - 3, sy - 3, sw + 6, 12, 6); ctx.fill();
        ctx.fillStyle = "#e0b25c"; roundRect(sx, sy, sw * clamp(t / survive, 0, 1), 6, 3); ctx.fill();
        if (bigWave && phase === "play") { ctx.fillStyle = "rgba(150,52,40," + (0.3 + 0.3 * Math.sin(seaT * 20)) + ")"; ctx.fillRect(0, 0, W, H); text("ROGUE WAVE. Hold SPACE or 🔥 to brace!", W / 2, H * 0.5, clamp(W * 0.045, 15, 23), "#ffe1b0", "center", "bold"); }
        if (lightning > 0) { ctx.fillStyle = "rgba(255,255,255," + lightning * 3 + ")"; ctx.fillRect(0, 0, W, H); }
        if (phase === "intro") prompt.render();
        if (phase === "won") { var w = clamp(W * 0.82, 280, 450); panel(W / 2, H / 2, w, 148); text("YOU MADE PORT!", W / 2, H / 2 - 38, 25, "#8fd6a0", "center", "bold"); wrapText("You beat the storm the real Whydah could not. The score cap is broken.", W / 2, H / 2 - 8, w - 40, 19, 14, "#f4e7c9"); text("tap to see your voyage", W / 2, H / 2 + 52, 11.5, "rgba(244,231,201,.6)"); }
      }
    };
  }

  // ---------------------------------------------------------------- END / RESULTS / HARBOR
  function endRun(reachedEnd, sunk) {
    if (G.ended) return; G.ended = true;
    G.won = G.stormCleared;
    if (G.won) { G.score += 200 + G.hull * 40; addGold(50); }
    else { G.capped = true; G.score = Math.min(G.score, G.preStormScore > 0 ? G.preStormScore : G.score); }
    G.rank = rankFor(G.score, G.won);
    // bank the gold: full if you reached the storm, half if you sank on the way
    var banked = (sunk && G.preStormScore === 0) ? Math.floor(G.gold / 2) : G.gold;
    G.bankedGold = banked;
    SAVE.bank += banked;
    SAVE.runs++;
    if (G.won) SAVE.wins++;
    if (G.score > SAVE.best) SAVE.best = G.score;
    persist();
    G.curBeat = G.won ? "win" : "gameover";
    if (G.won) SFX.win(); else SFX.lose();
    setScene(ResultScene(sunk));
  }
  function rankFor(s, won) {
    if (won) { if (s >= 900) return "Legend of the Whydah"; if (s >= 650) return "Master Mariner"; return "Storm-Beater"; }
    if (s >= 500) return "Navigator";
    if (s >= 300) return "Able Seaman";
    if (s >= 150) return "Deckhand";
    return "Cabin Boy";
  }
  function ResultScene(sunk) {
    var t = 0;
    return {
      enter: function () { document.body.classList.remove("playing"); },
      update: function (dt) { seaT += dt; t += dt; updateGulls(dt); },
      render: function () {
        drawSea(G.won ? PALETTES[2] : STORM_PAL, seaT * 40, !G.won);
        drawParts();
        var w = clamp(W * 0.88, 300, 520), h = 330;
        panel(W / 2, H / 2, w, h);
        var title = G.won ? "⚓ VOYAGE COMPLETE" : (sunk ? "☠ YOUR SHIP WENT DOWN" : "☠ LOST TO THE STORM");
        text(title, W / 2, H / 2 - h / 2 + 38, 24, G.won ? "#8fd6a0" : "#e08c6a", "center", "bold");
        if (G.won) wrapText("You made Maine. The real crew never did. The storm took the Whydah at Cape Cod. Remember them.", W / 2, H / 2 - h / 2 + 64, w - 50, 18, 12.5, "#cdeccf");
        else if (!sunk) wrapText("The real Whydah sank right here. April 26, 1717. 146 aboard. Two men survived. Refit your ship and try again.", W / 2, H / 2 - h / 2 + 64, w - 50, 18, 12.5, "#e8c1ae");
        else wrapText("The sea keeps what it takes. Half your gold washes ashore. Refit and sail again.", W / 2, H / 2 - h / 2 + 64, w - 50, 18, 12.5, "#e8c1ae");
        text("Rank:  " + G.rank, W / 2, H / 2 - 26, 19, "#e0b25c", "center", "bold");
        text(String(G.score), W / 2, H / 2 + 22, 42, "#f4e7c9", "center", "bold");
        if (G.capped) text("Score capped at the storm. Beat it to break the cap.", W / 2, H / 2 + 48, 12, "#e08c6a");
        else if (G.won) text("Survivor bonus added. The cap is broken!", W / 2, H / 2 + 48, 12.5, "#8fd6a0");
        text("🪙 +" + (G.bankedGold || 0) + " banked   ·   Bank " + SAVE.bank + "   ·   Best " + SAVE.best, W / 2, H / 2 + 74, 13, "#f7d84a", "center", "bold");
        var bw = clamp(W * 0.34, 128, 168), by = H / 2 + h / 2 - 46;
        if (uiButton(W / 2 - bw - 8, by, bw, 42, "⚒ HARBOR", { size: 15, color: "#1f4a5e" })) setScene(HarborScene(true));
        if (uiButton(W / 2 + 8, by, bw, 42, "↺ SAIL AGAIN", { size: 15 })) startRun();
        if (t > 0.6 && consumeTap()) setScene(HarborScene(true));
      }
    };
  }
  function HarborScene(fromRun) {
    var msg = "";
    return {
      enter: function () { document.body.classList.remove("playing"); },
      update: function (dt) { seaT += dt; updateGulls(dt); },
      render: function () {
        drawSea(PALETTES[2], seaT * 25, false);
        drawShip(W * 0.5, H * 0.87, 1.9, playerShipOpts({ dmg: 0 }));
        var w = clamp(W * 0.92, 300, 560);
        var rows = UPG.length, rowH = clamp(H * 0.075, 44, 56);
        var h = 120 + rows * rowH;
        h = Math.min(h, H * 0.78);
        var top = clamp(H * 0.08, 10, 60);
        panel(W / 2, top + h / 2, w, h);
        text("⚒  THE HARBOR", W / 2, top + 34, 22, "#e0b25c", "center", "bold");
        text("Bank: 🪙 " + SAVE.bank + (msg ? "   " + msg : ""), W / 2, top + 58, 14, "#f7d84a", "center", "bold");
        var ry = top + 76;
        for (var i = 0; i < UPG.length; i++) {
          var u = UPG[i], lvl = upgLvl(u.id), maxed = lvl >= u.max, cost = maxed ? 0 : u.cost[lvl];
          var rx = W / 2 - w / 2 + 16;
          text(u.icon + " " + u.name, rx + 4, ry + 16, 14, "#f4e7c9", "left", "bold");
          // pips
          for (var p = 0; p < u.max; p++) { ctx.fillStyle = p < lvl ? "#e0b25c" : "rgba(244,231,201,.2)"; ctx.beginPath(); ctx.arc(rx + 8 + p * 14, ry + 30, 5, 0, 7); ctx.fill(); }
          ctx.font = "11px Georgia, serif"; ctx.fillStyle = "rgba(244,231,201,.7)"; ctx.textAlign = "left";
          var dw = w - 300; if (dw > 120) ctx.fillText(u.desc.length > dw / 5.4 ? u.desc.slice(0, Math.floor(dw / 5.4)) + "…" : u.desc, rx + 110, ry + 31);
          ctx.textAlign = "left";
          var bx = W / 2 + w / 2 - 118, bw2 = 102, bh2 = rowH - 14;
          if (maxed) { uiButton(bx, ry + 2, bw2, bh2, "MAXED", { disabled: true, size: 12.5 }); }
          else if (uiButton(bx, ry + 2, bw2, bh2, "🪙 " + cost, { size: 13.5, color: SAVE.bank >= cost ? "#2c5e38" : "#5a4030" })) {
            if (SAVE.bank >= cost) { SAVE.bank -= cost; SAVE.upg[u.id] = lvl + 1; persist(); SFX.buy(); msg = u.name + " improved!"; }
            else { msg = "Not enough gold."; SFX.bad(); }
          }
          ry += rowH;
        }
        var sy = top + h + 14;
        if (sy + 48 > H) sy = H - 54;
        if (uiButton(W / 2 - 90, sy, 180, 46, "⚓ SET SAIL", { size: 17 })) startRun();
      }
    };
  }

  // ---------------------------------------------------------------- boot / loop
  function startRun() { newGame(); G.seqIndex = -1; advance(); }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    updateTimers(dt);
    if (scene && scene.update) scene.update(dt);
    updateParts(dt);
    ctx.save();
    if (shakeAmt > 0) { ctx.translate(rand(-shakeAmt, shakeAmt), rand(-shakeAmt, shakeAmt)); shakeAmt = Math.max(0, shakeAmt - dt * 40); }
    if (scene && scene.render) scene.render();
    ctx.restore();
    input.pPressed = false; input.firePressed = false; input.leftPressed = false; input.rightPressed = false;
    requestAnimationFrame(loop);
  }

  var muteBtn = document.getElementById("btn-mute");
  if (muteBtn) muteBtn.addEventListener("click", function () { muted = !muted; muteBtn.textContent = muted ? "🔇" : "🔊"; if (!muted) audio(); });

  // boot
  resize(); seedCoast(); newGame(); setScene(TitleScene());

  // ---------------------------------------------------------------- debug API (inert unless the page sets __FS_DEBUG)
  if (window.__FS_DEBUG) {
    window.__fsAPI = {
      state: function () { return G ? { beat: G.curBeat, score: G.score, gold: G.gold, hull: G.hull, maxHull: G.maxHull, prog: +Number(G.progress || 0).toFixed(2), won: G.won, capped: G.capped, rank: G.rank, bank: SAVE.bank, events: G.events } : null; },
      start: function () { startRun(); },
      skip: function () { advance(); },
      toStorm: function () { for (var i = G.seq.length - 1; i >= 0; i--) if (G.seq[i].kind === "storm") { G.seqIndex = i - 1; advance(); return; } },
      hurt: function (n) { damage(n || 1); },
      winStorm: function () { G.stormCleared = true; endRun(true, false); },
      newRun: function () { startRun(); },
      buildSeq: function () { newGame(); return G.seq.map(function (b) { return b.kind + (b.ev ? ":" + b.ev.id : "") + (b.which ? ":" + b.which : ""); }); },
      choose: function (i) { if (scene && scene.debugChoose) scene.debugChoose(i); },
      gold: function (n) { SAVE.bank += n; persist(); },
      buy: function (id) { var lvl = upgLvl(id); var u = null; for (var i = 0; i < UPG.length; i++) if (UPG[i].id === id) u = UPG[i]; if (!u || lvl >= u.max) return "no"; SAVE.bank -= u.cost[lvl]; SAVE.upg[id] = lvl + 1; persist(); return SAVE.upg[id]; },
      save: function () { return JSON.parse(JSON.stringify(SAVE)); },
      wipe: function () { try { localStorage.removeItem("firstsail-save-v3"); } catch (e) {} SAVE = { bank: 0, best: 0, wins: 0, runs: 0, upg: { hull: 0, pumps: 0, shot: 0, nest: 0, helm: 0, charm: 0 } }; },
      toHarbor: function () { setScene(HarborScene(false)); },
      err: function () { return window.__err ? window.__err.slice(0, 6) : []; }
    };
  }

  requestAnimationFrame(loop);

})();
