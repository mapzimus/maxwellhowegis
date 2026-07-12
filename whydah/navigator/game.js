/* =====================================================================
   Whydah — First Sail (v2)
   A voyage roguelite. Steer north to Maine. Random encounters, a sea
   serpent, navigator mini-games for points, and a brutal storm finale.
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

  // ---------------------------------------------------------------- rng
  function rand(a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return Math.random() < p; }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------------------------------------------------------------- audio (tiny, muted by default)
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
    good: function () { beep(660, 0.12, "triangle", 0.14); beep(990, 0.14, "triangle", 0.10); },
    bad: function () { beep(140, 0.3, "sawtooth", 0.16); },
    thunder: function () { beep(60, 0.6, "sawtooth", 0.22); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, "triangle", 0.14); }, i * 140); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { beep(f, 0.35, "sawtooth", 0.16); }, i * 200); }); }
  };

  // ---------------------------------------------------------------- input
  var input = { left: false, right: false, fire: false, firePressed: false,
                px: 0, py: 0, pDown: false, pPressed: false, anyPressed: false };

  function keydown(e) {
    var k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { input.left = true; }
    else if (k === "arrowright" || k === "d") { input.right = true; }
    else if (k === " " || k === "spacebar" || k === "enter" || k === "arrowup" || k === "w") { if (!input.fire) input.firePressed = true; input.fire = true; input.anyPressed = true; }
    if ([ "arrowleft","arrowright","arrowup","arrowdown"," ","spacebar" ].indexOf(k) >= 0) e.preventDefault();
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
  canvas.addEventListener("pointerdown", function (e) { canvasPoint(e); input.pDown = true; input.pPressed = true; input.anyPressed = true; if (AC && AC.state === "suspended") AC.resume(); });
  canvas.addEventListener("pointermove", function (e) { if (input.pDown) canvasPoint(e); });
  window.addEventListener("pointerup", function () { input.pDown = false; });

  // on-screen buttons
  function holdBtn(id, prop) {
    var el = document.getElementById(id); if (!el) return;
    var set = function (v) { return function (e) { e.preventDefault(); input[prop] = v; if (v && prop === "fire") { input.firePressed = true; input.anyPressed = true; } el.classList.toggle("held", v); }; };
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

  // detect touch to hide/show steer pads
  var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) document.body.classList.add("hide-touch");

  // ---------------------------------------------------------------- palettes (weather / time of day)
  var PALETTES = [
    { name: "Clear morning", sky: ["#bfe0e8", "#7fb2c0"], sea: ["#2b6c86", "#0f3448"], foam: "#dff1f4", land: "#6f8f5a", tint: "#ffe9b0" },
    { name: "Bright noon",   sky: ["#a9d8ef", "#6fb0d6"], sea: ["#227a9b", "#0c3a52"], foam: "#eafaff", land: "#7a9a5e", tint: "#fff6d6" },
    { name: "Golden dusk",   sky: ["#f4c98a", "#c9718a"], sea: ["#3a5f7a", "#152a3f"], foam: "#ffe6cf", land: "#5f7350", tint: "#ffcf8a" },
    { name: "Grey fog",      sky: ["#c7cdd0", "#9aa7ae"], sea: ["#3d5964", "#182833"], foam: "#e8eef0", land: "#66756a", tint: "#dfe6e6" },
    { name: "Moonlit night", sky: ["#25324a", "#141d30"], sea: ["#1b3a52", "#08182a"], foam: "#bcd6e8", land: "#3f5148", tint: "#9fb6d6" }
  ];
  var STORM_PAL = { sky: ["#3a3c46", "#15161c"], sea: ["#25313b", "#0a1016"], foam: "#c4d2da", land: "#3a473f", tint: "#8ea0b4" };

  // ---------------------------------------------------------------- global state
  var G = null;
  function newGame() {
    G = {
      score: 0, hull: 5, maxHull: 5,
      seq: [], seqIndex: -1,
      progress: 0,               // 0..1 to Maine
      pal: choice(PALETTES),
      shipX: 0.5,                // 0..1 across
      best: loadBest(),
      preStormScore: 0, capped: false, won: false, stormCleared: false,
      rank: "", coins: 0, serpentBeaten: false, shipsBeaten: 0, ended: false
    };
    // Build a randomized voyage: mini-games + events + ship battle(s) + one serpent, then STORM.
    var pool = [];
    var nMini = randInt(2, 3), nEvent = randInt(2, 3), nShip = randInt(1, 2);
    var minis = ["backstaff", "leadline", "logline"];
    shuffle(minis);
    for (var i = 0; i < nMini; i++) pool.push("mini:" + minis[i % minis.length]);
    for (var e = 0; e < nEvent; e++) pool.push("event");
    for (var s = 0; s < nShip; s++) pool.push("battle");
    shuffle(pool);
    // Drop the serpent somewhere in the middle third.
    var mid = clamp(randInt(Math.floor(pool.length / 3), Math.floor(pool.length * 2 / 3)), 1, pool.length);
    pool.splice(mid, 0, "serpent");
    // Weave sailing legs between beats.
    G.seq = [];
    G.seq.push("sail");
    for (var p = 0; p < pool.length; p++) { G.seq.push(pool[p]); G.seq.push("sail"); }
    G.seq.push("storm");
    G.totalBeats = G.seq.length;
  }

  function loadBest() { try { return parseInt(localStorage.getItem("firstsail-best-v2") || "0", 10) || 0; } catch (e) { return 0; } }
  function saveBest(v) { try { if (v > (G.best || 0)) { G.best = v; localStorage.setItem("firstsail-best-v2", String(v)); } } catch (e) {} }

  function addScore(n) { G.score += n; if (G.score < 0) G.score = 0; }
  function damage(n) {
    G.hull -= n; SFX.hit(); shake(6 + n * 2);
    if (G.hull <= 0) { G.hull = 0; endRun(false, true); }
  }
  function repair(n) { G.hull = clamp(G.hull + n, 0, G.maxHull); }

  // ---------------------------------------------------------------- particles + screen shake
  var parts = [];
  function spawn(x, y, opt) {
    parts.push({ x: x, y: y, vx: opt.vx || 0, vy: opt.vy || 0, life: opt.life || 0.6, t: 0,
      r: opt.r || 3, c: opt.c || "#fff", g: opt.g || 0, fade: opt.fade !== false, shape: opt.shape || "dot" });
  }
  function splash(x, y, n, col) { for (var i = 0; i < (n || 8); i++) spawn(x, y, { vx: rand(-70, 70), vy: rand(-160, -40), g: 320, life: rand(0.4, 0.9), r: rand(1.5, 3.5), c: col || "#dff1f4" }); }
  function smoke(x, y, n) { for (var i = 0; i < (n || 6); i++) spawn(x, y, { vx: rand(-25, 25), vy: rand(-40, -10), g: -8, life: rand(0.6, 1.2), r: rand(4, 9), c: "rgba(60,60,66,.6)", shape: "smoke" }); }
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
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      if (p.shape === "smoke") { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.t), 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  var shakeAmt = 0;
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

  // ---------------------------------------------------------------- world / sea rendering
  var seaT = 0, coast = [];
  function seedCoast() {
    coast = [];
    for (var i = 0; i < 40; i++) coast.push({ y: rand(-H, H), side: chance(0.5) ? 0 : 1, w: rand(30, 90), h: rand(50, 130) });
  }
  function drawSea(pal, scroll, stormy) {
    // sky band (top ~22%)
    var skyH = H * 0.2;
    var sg = ctx.createLinearGradient(0, 0, 0, skyH);
    sg.addColorStop(0, pal.sky[0]); sg.addColorStop(1, pal.sky[1]);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, skyH);
    // sea
    var g = ctx.createLinearGradient(0, skyH, 0, H);
    g.addColorStop(0, pal.sea[0]); g.addColorStop(1, pal.sea[1]);
    ctx.fillStyle = g; ctx.fillRect(0, skyH, W, H - skyH);
    // horizon glow
    ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(0, skyH - 2, W, 4);
    // swell lines
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
    // drifting coast on the edges (parallax)
    for (var c = 0; c < coast.length; c++) {
      var o = coast[c];
      o.y += (stormy ? 90 : 55) * 0.016 * (0.6 + (c % 3) * 0.2);
      var yy2 = ((o.y) % (H + 260)) ; if (yy2 < -160) yy2 += H + 260;
      if (yy2 > skyH - 40 && yy2 < H + 40) {
        var cx = o.side === 0 ? -10 + o.w * 0.4 : W + 10 - o.w * 0.4;
        ctx.fillStyle = pal.land;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(cx, yy2, o.w, o.h, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.15)";
        ctx.beginPath(); ctx.ellipse(cx, yy2 + o.h * 0.6, o.w * 1.05, o.h * 0.25, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // weather tint + vignette
    ctx.fillStyle = pal.tint; ctx.globalAlpha = stormy ? 0.05 : 0.045; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
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
    // wake
    if (opt.wake) { ctx.fillStyle = "rgba(223,241,244,.5)"; ctx.beginPath(); ctx.moveTo(-6 * s, 10 * s); ctx.lineTo(6 * s, 10 * s); ctx.lineTo(2 * s, 30 * s); ctx.lineTo(-2 * s, 30 * s); ctx.closePath(); ctx.fill(); }
    // hull
    var hullC = opt.hull || "#5a3a22", deck = opt.deck || "#8a5a34";
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 14 * s, 15 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = hullC;
    ctx.beginPath();
    ctx.moveTo(0, -22 * s); ctx.quadraticCurveTo(15 * s, -6 * s, 12 * s, 12 * s);
    ctx.quadraticCurveTo(0, 20 * s, -12 * s, 12 * s);
    ctx.quadraticCurveTo(-15 * s, -6 * s, 0, -22 * s); ctx.fill();
    ctx.fillStyle = deck; ctx.beginPath();
    ctx.moveTo(0, -16 * s); ctx.quadraticCurveTo(9 * s, -4 * s, 7 * s, 9 * s);
    ctx.quadraticCurveTo(0, 14 * s, -7 * s, 9 * s);
    ctx.quadraticCurveTo(-9 * s, -4 * s, 0, -16 * s); ctx.fill();
    // masts + sails
    ctx.fillStyle = "#f3ead2";
    ctx.strokeStyle = "#3a2414"; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.moveTo(0, 10 * s); ctx.lineTo(0, -20 * s); ctx.stroke();
    var sail = opt.sail || "#f3ead2";
    ctx.fillStyle = sail;
    ctx.beginPath(); ctx.moveTo(-9 * s, -14 * s); ctx.quadraticCurveTo(0, -18 * s, 9 * s, -14 * s); ctx.lineTo(6 * s, -2 * s); ctx.quadraticCurveTo(0, -5 * s, -6 * s, -2 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.stroke();
    // flag
    if (opt.flag) { ctx.fillStyle = opt.flag; ctx.fillRect(0, -22 * s, 9 * s, 5 * s); }
    // damage smoke
    if (opt.dmg) { for (var d = 0; d < opt.dmg; d++) if (chance(0.15)) smoke(x + rand(-8, 8), y - 6, 1); }
    ctx.restore();
  }

  function drawSerpent(seg, headOpen, flash) {
    // seg = array of {x,y}
    ctx.save();
    ctx.strokeStyle = flash ? "#e7ffe0" : "#2f6b4a";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (var i = seg.length - 1; i >= 1; i--) {
      var w = lerp(8, 30, i / seg.length);
      ctx.strokeStyle = flash ? "#d6ffd0" : (i % 2 ? "#2f6b4a" : "#3c7f58");
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(seg[i].x, seg[i].y); ctx.lineTo(seg[i - 1].x, seg[i - 1].y); ctx.stroke();
      // fins
      if (i % 3 === 0) { ctx.fillStyle = "#245239"; ctx.beginPath(); ctx.ellipse(seg[i].x, seg[i].y, w * 0.7, w * 0.35, 0, 0, 7); ctx.fill(); }
    }
    // head
    var hd = seg[0];
    ctx.fillStyle = flash ? "#efffe9" : "#357a55";
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 26, 20, 0, 0, 7); ctx.fill();
    // jaw
    if (headOpen) { ctx.fillStyle = "#7a1f1f"; ctx.beginPath(); ctx.ellipse(hd.x, hd.y + 8, 15, 10, 0, 0, 7); ctx.fill(); }
    // eyes
    ctx.fillStyle = "#f7d84a"; ctx.beginPath(); ctx.arc(hd.x - 9, hd.y - 6, 4.5, 0, 7); ctx.arc(hd.x + 9, hd.y - 6, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(hd.x - 9, hd.y - 6, 2, 0, 7); ctx.arc(hd.x + 9, hd.y - 6, 2, 0, 7); ctx.fill();
    // horns
    ctx.strokeStyle = "#8fae7d"; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(hd.x - 10, hd.y - 16); ctx.lineTo(hd.x - 16, hd.y - 28);
    ctx.moveTo(hd.x + 10, hd.y - 16); ctx.lineTo(hd.x + 16, hd.y - 28); ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD
  function drawHUD() {
    // top-left hull hearts
    var pad = 12, hx = pad, hy = 12;
    for (var i = 0; i < G.maxHull; i++) {
      ctx.font = "20px serif";
      ctx.globalAlpha = i < G.hull ? 1 : 0.25;
      ctx.fillText(i < G.hull ? "♥" : "♡", hx + i * 22, hy + 18);
    }
    ctx.globalAlpha = 1;
    // score
    ctx.font = "bold 20px Georgia, serif"; ctx.textAlign = "right"; ctx.fillStyle = "#f4e7c9";
    ctx.fillText("⚑ " + G.score, W - pad, 30);
    ctx.font = "12px Georgia, serif"; ctx.fillStyle = "rgba(244,231,201,.7)";
    ctx.fillText("Best " + G.best, W - pad, 48);
    ctx.textAlign = "left";
    // progress-to-Maine bar
    var bw = clamp(W * 0.5, 160, 360), bx = (W - bw) / 2, by = 16, bh = 10;
    ctx.fillStyle = "rgba(11,22,32,.55)"; roundRect(bx - 4, by - 4, bw + 8, bh + 8, 8); ctx.fill();
    ctx.fillStyle = "rgba(244,231,201,.25)"; roundRect(bx, by, bw, bh, 5); ctx.fill();
    ctx.fillStyle = "#e0b25c"; roundRect(bx, by, bw * clamp(G.progress, 0, 1), bh, 5); ctx.fill();
    // ship marker + Maine flag
    ctx.font = "14px serif";
    ctx.fillText("⚓", bx + bw * clamp(G.progress, 0, 1) - 6, by + bh + 16);
    ctx.fillStyle = "#f4e7c9"; ctx.font = "11px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("MAINE ⛵", bx + bw + 4, by + 8); ctx.textAlign = "left";
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // panel + text helpers for prompts
  function panel(cx, cy, w, h) {
    ctx.fillStyle = "rgba(20,32,42,.9)";
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
      var test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i] + " "; yy += lh; }
      else line = test;
    }
    ctx.fillText(line, x, yy); ctx.textAlign = "left";
    return yy;
  }

  // ==================================================================
  // SCENES
  // ==================================================================
  var scene = null;
  function setScene(s) { scene = s; if (s.enter) s.enter(); }

  // advance the voyage sequence
  function advance() {
    G.seqIndex++;
    if (G.seqIndex >= G.seq.length) { endRun(true, false); return; }
    G.progress = clamp(G.seqIndex / (G.seq.length - 1), 0, 1);
    var beat = G.seq[G.seqIndex];
    G.curBeat = beat;
    if (beat === "sail") setScene(SailScene());
    else if (beat === "battle") setScene(BattleScene());
    else if (beat === "serpent") setScene(SerpentScene());
    else if (beat === "storm") setScene(StormScene());
    else if (beat === "event") setScene(EventScene());
    else if (beat.indexOf("mini:") === 0) setScene(MiniScene(beat.split(":")[1]));
    else setScene(SailScene());
  }

  // ---- prompt overlay (used to introduce encounters) ----
  function Prompt(title, body, cb) {
    return { t: 0, done: false, update: function (dt) {
        this.t += dt;
        if (this.t > 0.35 && (consumeTap())) { this.done = true; cb(); }
      }, render: function () {
        var w = clamp(W * 0.8, 260, 460), h = 150;
        panel(W / 2, H / 2, w, h);
        text(title, W / 2, H / 2 - 34, 24, "#e0b25c", "center", "bold");
        wrapText(body, W / 2, H / 2 - 4, w - 44, 22, 15, "#f4e7c9");
        text("tap / press SPACE", W / 2, H / 2 + h / 2 - 16, 12, "rgba(244,231,201,.65)");
      } };
  }

  // ---------------------------------------------------------------- TITLE
  function TitleScene() {
    return {
      enter: function () { document.body.classList.remove("playing"); seedCoast(); },
      update: function (dt) {
        seaT += dt;
        if (consumeTap()) { start(); }
      },
      render: function () {
        drawSea(G.pal || PALETTES[1], seaT * 40, false);
        drawShip(W / 2, H * 0.6, 2.2, { wake: true, flag: "#111", sail: "#f3ead2" });
        var w = clamp(W * 0.86, 300, 520);
        panel(W / 2, H * 0.3, w, 172);
        text("FIRST SAIL", W / 2, H * 0.3 - 44, 40, "#e0b25c", "center", "bold");
        wrapText("Steer the Whydah north to Maine. Dodge trouble. Play the navigator games for points. Beat the storm at the end.",
          W / 2, H * 0.3 - 8, w - 46, 22, 15, "#f4e7c9");
        text("← → or A / D to steer  ·  SPACE to fire", W / 2, H * 0.3 + 40, 14, "#cdb98a");
        text("Best voyage: " + G.best, W / 2, H * 0.3 + 62, 13, "rgba(244,231,201,.7)");
        // start button
        var by = H * 0.78;
        ctx.fillStyle = "#96341f"; ctx.strokeStyle = "#e0b25c"; ctx.lineWidth = 2;
        roundRect(W / 2 - 90, by - 26, 180, 52, 26); ctx.fill(); ctx.stroke();
        text("⚓  SET SAIL", W / 2, by + 6, 22, "#f4e7c9", "center", "bold");
        text("tap anywhere to begin", W / 2, by + 44, 12, "rgba(244,231,201,.6)");
      }
    };
  }

  // ---------------------------------------------------------------- SAIL leg (dodge + collect)
  function SailScene() {
    var legTime = rand(6.5, 9.5), t = 0;
    var objs = [];   // hazards + pickups scrolling down
    var spawnT = 0;
    return {
      enter: function () { document.body.classList.add("playing"); if (chance(0.5)) G.pal = choice(PALETTES); },
      update: function (dt) {
        seaT += dt; t += dt;
        // steer
        var sp = 1.15 * dt;
        if (input.left) G.shipX -= sp; if (input.right) G.shipX += sp;
        // pointer steer (drag)
        if (input.pDown && input.py > H * 0.4) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.2);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        // spawn hazards/pickups
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = rand(0.55, 1.15);
          var kind = chance(0.55) ? "hazard" : "pickup";
          var sub;
          if (kind === "hazard") sub = choice(["rock", "ice", "rock", "wood"]);
          else sub = choice(["coin", "coin", "wind", "barrel"]);
          objs.push({ x: rand(0.1, 0.9) * W, y: -40, kind: kind, sub: sub, r: kind === "hazard" ? rand(16, 26) : 15, sp: rand(150, 230), spin: rand(-2, 2), a: 0 });
        }
        // move + collide
        var shipPX = G.shipX * W, shipPY = H * 0.82;
        for (var i = objs.length - 1; i >= 0; i--) {
          var o = objs[i]; o.y += o.sp * dt; o.a += o.spin * dt;
          var d = Math.hypot(o.x - shipPX, o.y - shipPY);
          if (d < o.r + 16) {
            if (o.kind === "hazard") { if (o.sub === "coin") {} splash(o.x, o.y, 8); damage(o.sub === "wood" ? 1 : 1); objs.splice(i, 1); continue; }
            else {
              if (o.sub === "coin") { addScore(15); G.coins++; SFX.point(); for (var c = 0; c < 6; c++) spawn(o.x, o.y, { vx: rand(-40, 40), vy: rand(-90, -20), g: 200, life: 0.6, r: 2.5, c: "#f7d84a" }); }
              else if (o.sub === "wind") { addScore(8); SFX.good(); t += 0.6; }
              else if (o.sub === "barrel") { repair(1); SFX.good(); for (var b = 0; b < 8; b++) spawn(o.x, o.y, { vx: rand(-40, 40), vy: rand(-70, -10), g: 160, life: 0.7, r: 3, c: "#8fd6a0" }); }
              objs.splice(i, 1); continue;
            }
          }
          if (o.y > H + 50) { if (o.kind === "hazard") addScore(2); objs.splice(i, 1); }
        }
        if (t >= legTime) advance();
      },
      render: function () {
        drawSea(G.pal, seaT * 55, false);
        // objects
        for (var i = 0; i < objs.length; i++) {
          var o = objs[i];
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
        drawShip(G.shipX * W, H * 0.82, 1.6, { wake: true, flag: "#111", dmg: G.maxHull - G.hull });
        drawParts();
        drawHUD();
        // hint at leg start
        if (t < 2.2) { ctx.globalAlpha = clamp(2.2 - t, 0, 1); text("Sail on! Grab coins, dodge the rocks.", W / 2, H * 0.5, 18, "#f4e7c9", "center", "bold"); ctx.globalAlpha = 1; }
      }
    };
  }
  function blob(r) { ctx.beginPath(); ctx.moveTo(r, 0); for (var a = 0; a <= 7; a += 0.7) { var rr = r * (0.8 + 0.2 * Math.sin(a * 3)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }

  // ---------------------------------------------------------------- EVENT (fortune card)
  var EVENTS = [
    { t: "Fair winds!", b: "The sails fill and you fly north.", good: true, s: 40, h: 0 },
    { t: "Floating cargo", b: "You haul aboard a lost crate of goods.", good: true, s: 55, h: 0 },
    { t: "Friendly merchant", b: "You trade for coin and fresh water.", good: true, s: 35, h: 1 },
    { t: "A lucky catch", b: "Fish for the whole crew. Spirits rise.", good: true, s: 30, h: 1 },
    { t: "Doldrums", b: "The wind dies. You drift and lose time.", good: false, s: -15, h: 0 },
    { t: "Rats in the hold", b: "They chew the stores. Not good.", good: false, s: -10, h: 1 },
    { t: "Hidden reef", b: "You scrape a reef in the dark.", good: false, s: 0, h: 1 },
    { t: "Ghost lights", b: "Strange lights spook the crew. You waste powder.", good: false, s: -20, h: 0 }
  ];
  function EventScene() {
    var ev = choice(EVENTS), t = 0, applied = false;
    return {
      enter: function () { },
      update: function (dt) {
        seaT += dt; t += dt;
        if (!applied && t > 0.2) {
          applied = true;
          if (ev.s) addScore(ev.s);
          if (ev.h) { if (ev.good) repair(ev.h); else damage(ev.h); }
          if (ev.good) SFX.good(); else SFX.bad();
        }
        if (t > 0.3 && consumeTap()) advance();
      },
      render: function () {
        drawSea(G.pal, seaT * 40, false);
        drawShip(W / 2, H * 0.7, 1.7, { wake: true, dmg: G.maxHull - G.hull });
        drawParts(); drawHUD();
        var w = clamp(W * 0.82, 280, 460);
        panel(W / 2, H * 0.4, w, 168);
        text(ev.good ? "✨ " + ev.t : "☠ " + ev.t, W / 2, H * 0.4 - 40, 24, ev.good ? "#8fd6a0" : "#e08c6a", "center", "bold");
        wrapText(ev.b, W / 2, H * 0.4 - 6, w - 46, 22, 16, "#f4e7c9");
        var line = (ev.s ? (ev.s > 0 ? "+" + ev.s + " points" : ev.s + " points") : "");
        if (ev.h) line += (line ? "   " : "") + (ev.good ? "+" + ev.h + " hull" : "-" + ev.h + " hull");
        text(line, W / 2, H * 0.4 + 34, 16, "#e0b25c", "center", "bold");
        text("tap to continue", W / 2, H * 0.4 + 66, 12, "rgba(244,231,201,.6)");
      }
    };
  }

  // ---------------------------------------------------------------- BATTLE (enemy ship)
  function BattleScene() {
    var phase = "intro";
    var enemy = { x: W * 0.5, y: H * 0.2, hp: 6, max: 6, dir: 1, fireT: 1 };
    var balls = [];      // player shots (up) and enemy shots (down)
    var t = 0, prompt = null, loot = 0;
    return {
      enter: function () { prompt = Prompt("Enemy ship!", "Fire when you can. Dodge their shots. Sink them for loot.", function () { phase = "fight"; }); },
      update: function (dt) {
        seaT += dt; t += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        // steer
        if (input.left) G.shipX -= 1.1 * dt; if (input.right) G.shipX += 1.1 * dt;
        if (input.pDown && input.py > H * 0.5) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.25);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        var shipPX = G.shipX * W, shipPY = H * 0.82;
        // player fire
        if (consumeFire()) { balls.push({ x: shipPX, y: shipPY - 20, vy: -420, own: 1 }); SFX.fire(); smoke(shipPX, shipPY - 18, 3); }
        // enemy move + fire
        enemy.x += enemy.dir * 90 * dt;
        if (enemy.x < W * 0.15 || enemy.x > W * 0.85) enemy.dir *= -1;
        enemy.fireT -= dt;
        if (enemy.fireT <= 0) { enemy.fireT = rand(0.7, 1.4); balls.push({ x: enemy.x, y: enemy.y + 18, vy: 300 + G.shipsBeaten * 30, own: 0 }); }
        // balls
        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i]; b.y += b.vy * dt;
          if (b.own === 1 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 26) { enemy.hp--; splash(b.x, b.y, 8, "#e08c6a"); SFX.hit(); balls.splice(i, 1);
            if (enemy.hp <= 0) { phase = "done"; loot = 60 + randInt(0, 40); addScore(loot); G.shipsBeaten++; SFX.win(); for (var k = 0; k < 24; k++) spawn(enemy.x, enemy.y, { vx: rand(-120, 120), vy: rand(-160, 40), g: 260, life: rand(0.6, 1.2), r: rand(2, 4), c: choice(["#f7d84a", "#e08c6a", "#fff"]) }); }
            continue; }
          if (b.own === 0 && Math.hypot(b.x - shipPX, b.y - shipPY) < 18) { balls.splice(i, 1); damage(1); continue; }
          if (b.y < -30 || b.y > H + 30) balls.splice(i, 1);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 45, false);
        if (phase !== "intro") drawEnemyBars(enemy);
        // enemy ship
        drawShip(enemy.x, enemy.y, 1.7, { rot: Math.PI, flag: "#7a1f1f", hull: "#4a2f2f", deck: "#6a4444", sail: "#e8d3b0", dmg: enemy.max - enemy.hp });
        for (var i = 0; i < balls.length; i++) { var b = balls[i]; ctx.fillStyle = b.own ? "#f4e7c9" : "#e08c6a"; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); }
        drawShip(G.shipX * W, H * 0.82, 1.6, { wake: true, flag: "#111", dmg: G.maxHull - G.hull });
        drawParts(); drawHUD();
        if (phase === "intro") prompt.render();
        if (phase === "done") { var w = clamp(W * 0.7, 240, 380); panel(W / 2, H / 2, w, 120); text("Enemy sunk!", W / 2, H / 2 - 22, 26, "#8fd6a0", "center", "bold"); text("+" + loot + " loot", W / 2, H / 2 + 8, 20, "#e0b25c", "center", "bold"); text("tap to sail on", W / 2, H / 2 + 40, 12, "rgba(244,231,201,.6)"); }
      }
    };
  }
  function drawEnemyBars(e) {
    var bw = 120, bx = e.x - bw / 2, by = 8;
    ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(bx - 2, by - 2, bw + 4, 10, 4); ctx.fill();
    ctx.fillStyle = "#7a1f1f"; roundRect(bx, by, bw * (e.hp / e.max), 6, 3); ctx.fill();
  }

  // ---------------------------------------------------------------- SERPENT
  function SerpentScene() {
    var phase = "intro", prompt = null;
    var seg = []; for (var i = 0; i < 14; i++) seg.push({ x: W * 0.5, y: -60 - i * 24 });
    var hp = 5, max = 5, t = 0, state = "weave", stateT = rand(1.5, 2.5), lungeX = 0, headOpen = false, flashT = 0, balls = [], reward = 0;
    var baseY = H * 0.32;
    return {
      enter: function () { prompt = Prompt("A SEA SERPENT!", "It rears up before it strikes. Dodge the lunge, then fire at its head. Drive it off!", function () { phase = "fight"; }); },
      update: function (dt) {
        seaT += dt; t += dt; if (flashT > 0) flashT -= dt;
        if (phase === "intro") { prompt.update(dt); moveHead(dt, W * 0.5, baseY); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        // steer
        if (input.left) G.shipX -= 1.15 * dt; if (input.right) G.shipX += 1.15 * dt;
        if (input.pDown && input.py > H * 0.55) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.08, 0.92), 0.25);
        G.shipX = clamp(G.shipX, 0.08, 0.92);
        var shipPX = G.shipX * W, shipPY = H * 0.84;
        // player fire (only hurts when head is up/open)
        if (consumeFire()) { balls.push({ x: shipPX, y: shipPY - 20, vy: -460 }); SFX.fire(); }
        // serpent state machine
        stateT -= dt;
        if (state === "weave") {
          headOpen = false;
          var tx = W * 0.5 + Math.sin(t * 1.6) * W * 0.32;
          moveHead(dt, tx, baseY + Math.sin(t * 2) * 20);
          if (stateT <= 0) { state = "rear"; stateT = 0.9; lungeX = shipPX; }
        } else if (state === "rear") {
          headOpen = true;
          moveHead(dt, lungeX, baseY - 30);
          if (stateT <= 0) { state = "lunge"; stateT = 0.45; }
        } else if (state === "lunge") {
          moveHead(dt, lungeX, H * 0.7);
          if (Math.hypot(seg[0].x - shipPX, seg[0].y - shipPY) < 46) { damage(2); state = "recover"; stateT = 1.0; }
          if (stateT <= 0) { state = "recover"; stateT = 0.8; }
        } else if (state === "recover") {
          headOpen = false;
          moveHead(dt, W * 0.5, baseY);
          if (stateT <= 0) { state = "weave"; stateT = rand(1.4, 2.4); }
        }
        // balls hit head when up (weave/rear/recover, not deep lunge)
        for (var i = balls.length - 1; i >= 0; i--) {
          var b = balls[i]; b.y += b.vy * dt;
          if (Math.hypot(b.x - seg[0].x, b.y - seg[0].y) < 30) {
            balls.splice(i, 1); hp--; flashT = 0.12; SFX.hit(); splash(seg[0].x, seg[0].y, 10, "#8fd6a0");
            if (hp <= 0) { phase = "done"; reward = 120; addScore(reward); G.serpentBeaten = true; SFX.win(); for (var k = 0; k < 30; k++) spawn(seg[0].x, seg[0].y, { vx: rand(-140, 140), vy: rand(-160, 60), g: 240, life: rand(0.6, 1.3), r: rand(2, 5), c: choice(["#8fd6a0", "#f7d84a", "#fff"]) }); }
            continue;
          }
          if (b.y < -30) balls.splice(i, 1);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 50, false);
        if (phase !== "intro") { var bw = 160, bx = W / 2 - bw / 2; ctx.fillStyle = "rgba(0,0,0,.4)"; roundRect(bx - 2, 8, bw + 4, 12, 5); ctx.fill(); ctx.fillStyle = "#2f6b4a"; roundRect(bx, 10, bw * (hp / max), 8, 4); ctx.fill(); text("SERPENT", W / 2, 34, 12, "#cdeccf", "center", "bold"); }
        drawSerpent(seg, headOpen, flashT > 0);
        for (var i = 0; i < balls.length; i++) { ctx.fillStyle = "#f4e7c9"; ctx.beginPath(); ctx.arc(balls[i].x, balls[i].y, 5, 0, 7); ctx.fill(); }
        drawShip(G.shipX * W, H * 0.84, 1.6, { wake: true, flag: "#111", dmg: G.maxHull - G.hull });
        drawParts(); drawHUD();
        if (headOpen && phase === "fight") text("FIRE!", seg[0].x, seg[0].y - 40, 16, "#ffd24a", "center", "bold");
        if (phase === "intro") prompt.render();
        if (phase === "done") { var w = clamp(W * 0.72, 240, 400); panel(W / 2, H / 2, w, 120); text("Serpent driven off!", W / 2, H / 2 - 22, 24, "#8fd6a0", "center", "bold"); text("+" + reward + " points", W / 2, H / 2 + 8, 20, "#e0b25c", "center", "bold"); text("tap to sail on", W / 2, H / 2 + 40, 12, "rgba(244,231,201,.6)"); }
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

  // Backstaff: stop the moving sun-shadow inside the horizon band. 3 sights.
  function Backstaff() {
    var phase = "intro", prompt = null, pos = 0, dir = 1, spd = rand(0.85, 1.15), tries = 3, got = 0, res = 0, showT = 0;
    var zone = 0.5, zoneW = 0.16;
    return {
      enter: function () { prompt = Prompt("Take a sun-sight", "The backstaff measures the sun's height. Press SPACE when the shadow sits on the horizon line. Three sights.", function () { phase = "play"; newZone(); }); },
      update: function (dt) {
        seaT += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        if (showT > 0) { showT -= dt; return; }
        pos += dir * spd * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
        if (consumeFire()) {
          var off = Math.abs(pos - zone);
          if (off < zoneW / 2) { var pts = off < 0.03 ? 50 : 30; addScore(pts); got++; res = pts; SFX.point(); }
          else { res = 0; SFX.bad(); }
          showT = 0.8; tries--;
          if (tries <= 0) { setTimeout2(function () { phase = "done"; }, 0.85); }
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 35, false);
        drawParts(); drawHUD();
        // instrument frame
        var cx = W / 2, cy = H * 0.55, w = clamp(W * 0.7, 260, 420), h = 70;
        panel(cx, cy - 90, clamp(W * 0.8, 280, 460), 60);
        text("Sights left: " + tries + "    Good: " + got, cx, cy - 84, 16, "#f4e7c9", "center", "bold");
        // sun arc
        ctx.strokeStyle = "rgba(244,231,201,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - w / 2, cy); ctx.lineTo(cx + w / 2, cy); ctx.stroke();
        // zone (horizon band)
        ctx.fillStyle = "rgba(143,214,160,.35)"; ctx.fillRect(cx - w / 2 + (zone - zoneW / 2) * w, cy - 24, zoneW * w, 48);
        text("horizon", cx - w / 2 + zone * w, cy + 40, 12, "#8fd6a0");
        // moving sun
        var sx = cx - w / 2 + pos * w;
        ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(sx, cy - 24, 12, 0, 7); ctx.fill();
        ctx.strokeStyle = "#ffd24a"; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(sx, cy - 24); ctx.lineTo(sx, cy + 20); ctx.stroke(); ctx.globalAlpha = 1;
        if (phase === "intro") prompt.render();
        else if (showT > 0) text(res > 0 ? "+" + res + (res >= 50 ? "  Dead on!" : "  Good sight") : "Missed", cx, cy - 50, 18, res > 0 ? "#8fd6a0" : "#e08c6a", "center", "bold");
        else text("press SPACE on the horizon band", cx, H * 0.8, 14, "#cdb98a");
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 110); text("Sights logged", cx, H / 2 - 18, 22, "#e0b25c", "center", "bold"); text(got + " of 3 on target", cx, H / 2 + 10, 16, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 12, "rgba(244,231,201,.6)"); }
      }
    };
    function newZone() { zone = rand(0.25, 0.75); }
  }

  // Lead line: drop the lead, stop the depth marker in the sounding band.
  function LeadLine() {
    var phase = "intro", prompt = null, y = 0, falling = false, tries = 3, got = 0, showT = 0, res = 0;
    var band = 0.5, bandW = 0.16, spd = rand(0.7, 1.0);
    return {
      enter: function () { prompt = Prompt("Sound the depth", "The lead line finds how deep the water is. Let it drop, then press SPACE when the mark is in the sounding band. Three drops.", function () { phase = "play"; reset(); }); },
      update: function (dt) {
        seaT += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        if (showT > 0) { showT -= dt; return; }
        y += spd * dt; if (y > 1) { y = 0; }
        if (consumeFire()) {
          var off = Math.abs(y - band);
          if (off < bandW / 2) { var pts = off < 0.03 ? 50 : 30; addScore(pts); got++; res = pts; SFX.point(); }
          else { res = 0; SFX.bad(); }
          showT = 0.8; tries--;
          if (tries <= 0) setTimeout2(function () { phase = "done"; }, 0.85); else band = rand(0.3, 0.75);
        }
      },
      render: function () {
        drawSea(G.pal, seaT * 30, false);
        drawParts(); drawHUD();
        var cx = W / 2, top = H * 0.28, h = clamp(H * 0.42, 200, 380);
        panel(cx, top - 34, clamp(W * 0.8, 280, 460), 46);
        text("Drops left: " + tries + "    Good: " + got, cx, top - 28, 16, "#f4e7c9", "center", "bold");
        // rope channel
        ctx.strokeStyle = "rgba(244,231,201,.3)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top + h); ctx.stroke();
        // sounding band
        ctx.fillStyle = "rgba(143,214,160,.35)"; ctx.fillRect(cx - 60, top + (band - bandW / 2) * h, 120, bandW * h);
        text("sounding", cx + 80, top + band * h + 4, 12, "#8fd6a0");
        // lead weight
        var ly = top + y * h;
        ctx.strokeStyle = "#cdb98a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, ly); ctx.stroke();
        ctx.fillStyle = "#8a8f96"; ctx.beginPath(); ctx.moveTo(cx - 8, ly); ctx.lineTo(cx + 8, ly); ctx.lineTo(cx, ly + 18); ctx.closePath(); ctx.fill();
        if (phase === "intro") prompt.render();
        else if (showT > 0) text(res > 0 ? "+" + res + (res >= 50 ? "  By the mark!" : "  Good") : "Missed", cx, top + h + 30, 18, res > 0 ? "#8fd6a0" : "#e08c6a", "center", "bold");
        else text("press SPACE in the green band", cx, top + h + 30, 14, "#cdb98a");
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 110); text("Depths sounded", cx, H / 2 - 18, 22, "#e0b25c", "center", "bold"); text(got + " of 3 on the mark", cx, H / 2 + 10, 16, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 12, "rgba(244,231,201,.6)"); }
      }
    };
    function reset() { band = rand(0.3, 0.75); y = 0; }
  }

  // Log line: tap each knot as it crosses the mark, in rhythm.
  function LogLine() {
    var phase = "intro", prompt = null, knots = [], spawnT = 0, t = 0, got = 0, missed = 0, total = 8, done2 = 0;
    var markY;
    return {
      enter: function () { prompt = Prompt("Stream the log", "Sailors counted knots on a rope to measure speed. Press SPACE as each knot crosses the line. Catch them all.", function () { phase = "play"; }); },
      update: function (dt) {
        seaT += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "done") { if (consumeTap()) advance(); return; }
        t += dt; markY = H * 0.7;
        spawnT -= dt;
        if (done2 < total && spawnT <= 0) { spawnT = rand(0.55, 0.9); knots.push({ y: -20, hit: false }); done2++; }
        for (var i = knots.length - 1; i >= 0; i--) { var k = knots[i]; k.y += 230 * dt; if (k.y > H + 20) { if (!k.hit) missed++; knots.splice(i, 1); } }
        if (consumeFire()) {
          var best = null, bd = 999;
          for (var j = 0; j < knots.length; j++) { if (knots[j].hit) continue; var d = Math.abs(knots[j].y - markY); if (d < bd) { bd = d; best = knots[j]; } }
          if (best && bd < 40) { best.hit = true; var pts = bd < 14 ? 30 : 18; addScore(pts); got++; SFX.point(); for (var s = 0; s < 5; s++) spawn(W / 2, markY, { vx: rand(-40, 40), vy: rand(-60, -10), g: 160, life: 0.5, r: 2, c: "#f7d84a" }); }
          else { SFX.bad(); }
        }
        if (done2 >= total && knots.length === 0 && phase !== "done") phase = "done";
      },
      render: function () {
        drawSea(G.pal, seaT * 60, false);
        drawParts(); drawHUD();
        var cx = W / 2;
        panel(cx, H * 0.16, clamp(W * 0.8, 280, 460), 46);
        text("Knots caught: " + got + "    Missed: " + missed, cx, H * 0.16 + 6, 16, "#f4e7c9", "center", "bold");
        // rope
        ctx.strokeStyle = "rgba(205,185,138,.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
        // mark line
        ctx.strokeStyle = "#e0b25c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 60, H * 0.7); ctx.lineTo(cx + 60, H * 0.7); ctx.stroke();
        text("press SPACE here", cx + 120, H * 0.7 + 4, 12, "#cdb98a");
        for (var i = 0; i < knots.length; i++) { var k = knots[i]; ctx.fillStyle = k.hit ? "#8fd6a0" : "#f4e7c9"; ctx.beginPath(); ctx.arc(cx, k.y, 9, 0, 7); ctx.fill(); ctx.strokeStyle = "#5a3a22"; ctx.lineWidth = 2; ctx.stroke(); }
        if (phase === "intro") prompt.render();
        if (phase === "done") { var pw = clamp(W * 0.7, 240, 380); panel(cx, H / 2, pw, 110); text("Speed logged", cx, H / 2 - 18, 22, "#e0b25c", "center", "bold"); text(got + " of " + total + " knots", cx, H / 2 + 10, 16, "#f4e7c9"); text("tap to sail on", cx, H / 2 + 38, 12, "rgba(244,231,201,.6)"); }
      }
    };
  }

  // small delayed-callback helper tied to the game loop (avoids setTimeout drift on tab blur)
  var timers = [];
  function setTimeout2(fn, sec) { timers.push({ fn: fn, t: sec }); }
  function updateTimers(dt) { for (var i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { var f = timers[i].fn; timers.splice(i, 1); f(); } } }

  // ---------------------------------------------------------------- STORM finale
  function StormScene() {
    var phase = "intro", prompt = null;
    var t = 0, survive = rand(20, 24), objs = [], spawnT = 0, lightning = 0, waveT = 0, bigWave = null;
    return {
      enter: function () {
        G.preStormScore = G.score;
        prompt = Prompt("THE STORM", "This is it. The nor'easter off the coast. Dodge everything and hold on. Beat it and your score breaks the cap. Most crews sink here.", function () { phase = "play"; });
      },
      update: function (dt) {
        seaT += dt;
        if (phase === "intro") { prompt.update(dt); return; }
        if (phase === "won") { if (consumeTap()) endRun(true, false); return; }
        t += dt;
        G.progress = clamp(0.85 + 0.15 * (t / survive), 0, 1);
        // steer (harder: waves shove you)
        if (input.left) G.shipX -= 1.05 * dt; if (input.right) G.shipX += 1.05 * dt;
        if (input.pDown && input.py > H * 0.4) G.shipX = lerp(G.shipX, clamp(input.px / W, 0.06, 0.94), 0.18);
        G.shipX += Math.sin(t * 1.3) * 0.12 * dt;            // wave push
        G.shipX = clamp(G.shipX, 0.06, 0.94);
        // lightning
        if (lightning > 0) lightning -= dt;
        if (chance(0.006)) { lightning = 0.12; SFX.thunder(); }
        // debris
        spawnT -= dt;
        if (spawnT <= 0) { spawnT = rand(0.3, 0.6); objs.push({ x: rand(0.08, 0.92) * W, y: -30, r: rand(15, 24), sp: rand(230, 320), a: 0, spin: rand(-3, 3), sub: choice(["rock", "wood", "wood"]) }); }
        var shipPX = G.shipX * W, shipPY = H * 0.84;
        for (var i = objs.length - 1; i >= 0; i--) { var o = objs[i]; o.y += o.sp * dt; o.a += o.spin * dt; if (Math.hypot(o.x - shipPX, o.y - shipPY) < o.r + 15) { splash(o.x, o.y, 8); damage(1); objs.splice(i, 1); continue; } if (o.y > H + 40) objs.splice(i, 1); }
        // rogue wave: telegraphed, press SPACE to brace
        waveT -= dt;
        if (!bigWave && waveT <= 0) { bigWave = { warn: 1.4, hit: false }; }
        if (bigWave) {
          bigWave.warn -= dt;
          if (bigWave.warn <= 0 && !bigWave.hit) { bigWave.hit = true; if (!input.fire) { damage(2); shake(16); } else { addScore(20); shake(8); } bigWave = null; waveT = rand(5, 8); }
        }
        // survive spray
        if (chance(0.5)) spawn(rand(0, W), rand(H * 0.2, H), { vx: rand(-40, 40), vy: rand(80, 160), g: 0, life: 0.5, r: rand(1, 2.5), c: "rgba(220,235,240,.7)" });
        if (t >= survive) { phase = "won"; G.stormCleared = true; SFX.win(); }
      },
      render: function () {
        drawSea(STORM_PAL, seaT * 90, true);
        // rain
        ctx.strokeStyle = "rgba(200,220,230,.35)"; ctx.lineWidth = 1;
        for (var r = 0; r < 60; r++) { var rx = (r * 173 + (seaT * 900) % W) % W; var ry = (r * 271 + (seaT * 1400) % H) % H; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 16); ctx.stroke(); }
        for (var i = 0; i < objs.length; i++) { var o = objs[i]; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); if (o.sub === "rock") { ctx.fillStyle = "#4a4740"; blob(o.r); } else { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(-o.r, -5, o.r * 2, 10); } ctx.restore(); }
        drawShip(G.shipX * W, H * 0.84, 1.6, { wake: true, flag: "#111", dmg: G.maxHull - G.hull });
        drawParts(); drawHUD();
        // storm survival bar
        var sw = clamp(W * 0.6, 200, 400), sx = (W - sw) / 2, sy = H - 30;
        text("HOLD ON", W / 2, sy - 10, 14, "#f4e7c9", "center", "bold");
        ctx.fillStyle = "rgba(0,0,0,.5)"; roundRect(sx - 3, sy - 3, sw + 6, 12, 6); ctx.fill();
        ctx.fillStyle = "#e0b25c"; roundRect(sx, sy, sw * clamp(t / survive, 0, 1), 6, 3); ctx.fill();
        // rogue-wave warning
        if (bigWave && phase === "play") { ctx.fillStyle = "rgba(150,52,40," + (0.3 + 0.3 * Math.sin(seaT * 20)) + ")"; ctx.fillRect(0, 0, W, H); text("ROGUE WAVE — hold SPACE to brace!", W / 2, H * 0.5, clamp(W * 0.05, 16, 24), "#ffe1b0", "center", "bold"); }
        if (lightning > 0) { ctx.fillStyle = "rgba(255,255,255," + lightning * 3 + ")"; ctx.fillRect(0, 0, W, H); }
        if (phase === "intro") prompt.render();
        if (phase === "won") { var w = clamp(W * 0.8, 280, 440); panel(W / 2, H / 2, w, 140); text("YOU MADE PORT!", W / 2, H / 2 - 34, 26, "#8fd6a0", "center", "bold"); wrapText("You beat the storm the real Whydah could not. The cap is broken.", W / 2, H / 2 - 2, w - 40, 20, 15, "#f4e7c9"); text("tap to see your voyage", W / 2, H / 2 + 48, 12, "rgba(244,231,201,.6)"); }
      }
    };
  }

  // ---------------------------------------------------------------- END / RESULTS
  function endRun(reachedEnd, sunk) {
    if (G.ended) return; G.ended = true;
    G.won = G.stormCleared;
    if (G.won) { G.score += 200 + G.hull * 40; }        // survivor bonus breaks the cap
    else { G.capped = true; if (G.preStormScore > 0) G.score = Math.min(G.score, G.preStormScore); }
    G.rank = rankFor(G.score, G.won);
    saveBest(G.score);
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
      update: function (dt) { seaT += dt; t += dt; if (t > 0.5 && consumeTap()) { newGame(); setScene(TitleScene()); } },
      render: function () {
        drawSea(G.won ? PALETTES[2] : STORM_PAL, seaT * 40, !G.won);
        drawParts();
        var w = clamp(W * 0.86, 300, 500), h = 300;
        panel(W / 2, H / 2, w, h);
        var title = G.won ? "⚓ VOYAGE COMPLETE" : (sunk ? "☠ YOUR SHIP WENT DOWN" : "☠ LOST TO THE STORM");
        text(title, W / 2, H / 2 - h / 2 + 40, 26, G.won ? "#8fd6a0" : "#e08c6a", "center", "bold");
        text("Rank:  " + G.rank, W / 2, H / 2 - 44, 20, "#e0b25c", "center", "bold");
        text("Score", W / 2, H / 2 - 6, 14, "rgba(244,231,201,.7)");
        text(String(G.score), W / 2, H / 2 + 34, 46, "#f4e7c9", "center", "bold");
        if (G.capped) text("Score capped — you did not clear the storm. Beat it to break the cap!", W / 2, H / 2 + 66, 12.5, "#e08c6a");
        else if (G.won) text("Survivor bonus added. The cap is broken!", W / 2, H / 2 + 66, 13, "#8fd6a0");
        var line = "Ships sunk " + G.shipsBeaten + "   ·   Serpent " + (G.serpentBeaten ? "beaten" : "survived you") + "   ·   Best " + G.best;
        text(line, W / 2, H / 2 + 92, 12.5, "rgba(244,231,201,.75)");
        // sail again button
        var by = H / 2 + h / 2 - 30;
        ctx.fillStyle = "#96341f"; ctx.strokeStyle = "#e0b25c"; ctx.lineWidth = 2; roundRect(W / 2 - 84, by - 22, 168, 44, 22); ctx.fill(); ctx.stroke();
        text("↺  SAIL AGAIN", W / 2, by + 6, 18, "#f4e7c9", "center", "bold");
      }
    };
  }

  // ---------------------------------------------------------------- boot / loop
  function start() { G.seqIndex = -1; advance(); }

  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    updateTimers(dt);
    if (scene && scene.update) scene.update(dt);
    updateParts(dt);
    // render with shake
    ctx.save();
    if (shakeAmt > 0) { ctx.translate(rand(-shakeAmt, shakeAmt), rand(-shakeAmt, shakeAmt)); shakeAmt = Math.max(0, shakeAmt - dt * 40); }
    if (scene && scene.render) scene.render();
    ctx.restore();
    // clear one-frame pressed flags
    input.pPressed = false; input.anyPressed = false; input.firePressed = false;
    if (window.__FS_DEBUG && G) window.__fs = { beat: G.curBeat, score: G.score, hull: G.hull, prog: +Number(G.progress || 0).toFixed(2), seqIndex: G.seqIndex, won: G.won, capped: G.capped, rank: G.rank, best: G.best };
    requestAnimationFrame(loop);
  }

  // mute + help buttons
  var muteBtn = document.getElementById("btn-mute");
  if (muteBtn) muteBtn.addEventListener("click", function () { muted = !muted; muteBtn.textContent = muted ? "🔇" : "🔊"; if (!muted) audio(); });
  var helpBtn = document.getElementById("btn-help");
  if (helpBtn) helpBtn.addEventListener("click", function () { helpOpen = !helpOpen; });
  var helpOpen = false;

  // boot
  resize(); seedCoast(); newGame(); setScene(TitleScene());
  if (window.__FS_DEBUG) {
    window.__fsAPI = {
      state: function () { return G ? { beat: G.curBeat, score: G.score, hull: G.hull, prog: +Number(G.progress || 0).toFixed(2), won: G.won, capped: G.capped, rank: G.rank } : null; },
      start: function () { start(); },
      skip: function () { advance(); },
      toStorm: function () { var i = G.seq.lastIndexOf("storm"); if (i > 0) { G.seqIndex = i - 1; advance(); } },
      hurt: function (n) { damage(n || 1); },
      winStorm: function () { G.stormCleared = true; endRun(true, false); },
      newRun: function () { newGame(); start(); },
      err: function () { return window.__err ? window.__err.slice(0, 6) : []; }
    };
  }
  requestAnimationFrame(loop);

})();
