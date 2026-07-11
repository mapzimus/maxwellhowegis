/*
 * Black Sam & the Whydah — narrative engine
 *
 * Plain (non-module) script so the game runs by simply opening index.html
 * from the file system — no server, no build step.
 *
 * v2 additions:
 *  - scene.art: key into window.ART, rendered above the title
 *  - scene.minigame: { name, opts, intro, onWin: {to, effects?, set?},
 *    onLose: {to, effects?, set?} } — mounts window.MINIGAMES[name]
 *  - locked choices: choices gated by `requires` render disabled with a
 *    hint instead of vanishing (opt out per-choice with hidden: true)
 *  - sound toggle wired to window.SFX (muted by default)
 *  - minigame scores stored in state.scores[name]
 */
(function () {
  "use strict";

  var SAVE_KEY = "blacksam.save.v2";

  // --- DOM handles ---
  var el = {
    titleCard: document.getElementById("titleCard"),
    sceneCard: document.getElementById("sceneCard"),
    startBtn: document.getElementById("startBtn"),
    continueBtn: document.getElementById("continueBtn"),
    restartBtn: document.getElementById("restartBtn"),
    muteBtn: document.getElementById("muteBtn"),
    art: document.getElementById("sceneArt"),
    chapter: document.getElementById("sceneChapter"),
    title: document.getElementById("sceneTitle"),
    text: document.getElementById("sceneText"),
    choices: document.getElementById("choices"),
    footerNote: document.getElementById("footerNote"),
    statGold: document.getElementById("statGold"),
    statCrew: document.getElementById("statCrew"),
    statMercy: document.getElementById("statMercy"),
    hud: document.getElementById("hud"),
    boardCard: document.getElementById("boardCard"),
    boardBody: document.getElementById("boardBody"),
    boardBtn: document.getElementById("boardBtn"),
    boardBackBtn: document.getElementById("boardBackBtn"),
    boardClearBtn: document.getElementById("boardClearBtn"),
    boardTitle: document.getElementById("boardTitle")
  };

  // The Hall of Fame entry for the run that just ended (so the captain-name
  // field can rename it live).
  var lastRecorded = null;

  // --- Game state ---
  var state = freshState();

  // Handle of the currently-mounted mini-game (if any), so it can be
  // cancelled if the player abandons it (e.g. clicks "Start Over") before
  // it calls back — otherwise a stray timer/listener could fire later and
  // silently mutate an unrelated, freshly-started game (see cancelActiveMinigame).
  var activeMinigame = null;

  function cancelActiveMinigame() {
    if (activeMinigame) {
      activeMinigame.cancel();
      activeMinigame = null;
    }
  }

  function freshState() {
    return {
      scene: window.STORY.start,
      stats: { gold: 0, crew: 0, renown: 0 },
      flags: {},
      scores: {},
      sound: false,
      recorded: false
    };
  }

  // --- Persistence (best-effort; localStorage may be unavailable on file://) ---
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.scene && window.STORY.scenes[data.scene]) {
        data.scores = data.scores || {};
        data.flags = data.flags || {};
        return data;
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  // --- Helpers ---
  // Values in the story may be plain strings/ids or functions of state.
  function resolve(value) {
    return (typeof value === "function") ? value(state) : value;
  }

  function applyEffects(effects) {
    if (!effects) return [];
    var bumped = [];
    for (var key in effects) {
      if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
      if (typeof state.stats[key] === "number") {
        state.stats[key] += effects[key];
        if (state.stats[key] < 0) state.stats[key] = 0;
        bumped.push(key);
      }
    }
    return bumped;
  }

  function setFlags(flags) {
    if (!flags) return;
    for (var i = 0; i < flags.length; i++) state.flags[flags[i]] = true;
  }

  // A choice may require a flag (string) or a predicate function of state.
  function choiceUnlocked(choice) {
    if (choice.requires) {
      if (typeof choice.requires === "function") {
        if (!choice.requires(state)) return false;
      } else if (!state.flags[choice.requires]) {
        return false;
      }
    }
    if (choice.requiresNot && state.flags[choice.requiresNot]) return false;
    return true;
  }

  function sfx(name) {
    if (window.SFX && window.SFX[name]) window.SFX[name]();
  }

  // Footer note is an aria-live region, so setting its text also quietly
  // announces it to screen readers. Guarded: a missing element never throws.
  function setNote(text) {
    if (el.footerNote) el.footerNote.textContent = text;
  }

  // True while a mini-game owns the choices area (they listen for
  // Space/arrows/1-3 themselves, so the engine must stay off the keys).
  function minigameMounted() {
    return !!activeMinigame ||
      !!(el.choices && el.choices.classList.contains("mg-active"));
  }

  // --- Rendering ---
  function renderStats(bumpKeys) {
    if (el.statGold) el.statGold.textContent = state.stats.gold;
    if (el.statCrew) el.statCrew.textContent = state.stats.crew;
    if (el.statMercy) el.statMercy.textContent = state.stats.renown;

    var map = { gold: el.statGold, crew: el.statCrew, renown: el.statMercy };
    (bumpKeys || []).forEach(function (k) {
      var node = map[k];
      if (!node) return;
      node.classList.remove("bump");
      // reflow to restart the animation
      void node.offsetWidth;
      node.classList.add("bump");
      setTimeout(function () { node.classList.remove("bump"); }, 320);
    });
  }

  function renderArt(scene) {
    if (!el.art) return;
    var key = resolve(scene.art);
    if (key && window.ART && window.ART[key]) {
      el.art.innerHTML = window.ART[key]();
      el.art.hidden = false;
      el.art.classList.remove("art-reveal");
      void el.art.offsetWidth;
      el.art.classList.add("art-reveal");
    } else {
      el.art.hidden = true;
      el.art.innerHTML = "";
    }
  }

  function renderScene(bumpKeys) {
    // Defensive: any transition into a new scene means whatever mini-game
    // was previously mounted (if any) is no longer relevant.
    cancelActiveMinigame();
    if (!el.sceneCard || !el.text || !el.choices) return;
    var scene = window.STORY.scenes[state.scene];
    if (!scene) {
      el.text.innerHTML = '<p>The chart ends here. (Missing scene: ' + state.scene + ')</p>';
      el.choices.innerHTML = "";
      return;
    }

    var isEnding = !!scene.ending;
    el.sceneCard.classList.toggle("ending", isEnding);
    if (el.hud) el.hud.style.display = isEnding ? "none" : "";
    if (isEnding) sfx("bell");

    renderArt(scene);
    if (el.chapter) el.chapter.textContent = resolve(scene.chapter) || "";
    if (el.title) el.title.textContent = resolve(scene.title) || "";

    // Body text — array of html paragraphs (each may be a function of state).
    var bodyHtml = "";
    if (scene.badge) {
      bodyHtml += '<span class="ending-badge">' + escapeHtml(resolve(scene.badge)) + "</span>";
    }
    var paras = scene.text || [];
    for (var i = 0; i < paras.length; i++) {
      bodyHtml += resolve(paras[i]);
    }
    if (scene.epilogue) {
      bodyHtml += '<div class="epilogue">' + resolve(scene.epilogue) + "</div>";
    }
    el.text.innerHTML = bodyHtml;

    if (isEnding) renderEndingScore(scene);

    renderChoices(scene, isEnding);
    annotateChoiceKeys();

    // Re-trigger the fade/slide animation on the body.
    el.text.classList.remove("scene-swap");
    void el.text.offsetWidth;
    el.text.classList.add("scene-swap");

    renderStats(bumpKeys);
    focusSceneTitle();
    if (el.sceneCard.scrollIntoView) {
      el.sceneCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Move focus to the scene title on every scene change so screen readers
  // announce the new scene instead of lingering on a button that just
  // vanished. The title carries tabindex="-1" (set here defensively too).
  function focusSceneTitle() {
    if (!el.title || typeof el.title.focus !== "function") return;
    el.title.setAttribute("tabindex", "-1");
    try { el.title.focus({ preventScroll: true }); }
    catch (e) { try { el.title.focus(); } catch (e2) { /* ignore */ } }
  }

  // Tag each enabled, visible choice with a number key (1-9): a subtle
  // visual prefix, an aria-keyshortcuts hint, and a data attribute the
  // keydown handler looks up. Locked (disabled) choices are skipped so the
  // numbers always match what a player can actually press.
  function annotateChoiceKeys() {
    if (!el.choices || !el.choices.querySelectorAll) return;
    var btns = el.choices.querySelectorAll("button.choice");
    var n = 0;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].disabled) continue;
      n++;
      if (n > 9) break;
      btns[i].setAttribute("data-choice-key", String(n));
      btns[i].setAttribute("aria-keyshortcuts", String(n));
      var tag = document.createElement("span");
      tag.setAttribute("aria-hidden", "true");
      tag.style.cssText = "opacity:.45;font-size:.78em;font-weight:normal;margin-right:.55em;";
      tag.textContent = n + ".";
      btns[i].insertBefore(tag, btns[i].firstChild);
    }
  }

  // Score the finished run, log it to the Hall of Fame (once), and show the
  // Legend Score with an editable captain-name field beneath the epilogue.
  function renderEndingScore(scene) {
    if (!window.SCOREBOARD) return;
    var endingId = state.scene;
    var title = resolve(scene.title) || endingId;
    var panel = document.createElement("div");
    panel.className = "score-wrap";

    var scoreObj, rank, totalRuns, entryId, defaultName;
    if (!state.recorded) {
      var board = window.SCOREBOARD.loadBoard();
      defaultName = board.lastName || "Black Sam";
      var rec = window.SCOREBOARD.recordRun(state, endingId, title, defaultName);
      lastRecorded = rec;
      scoreObj = rec.score; rank = rec.rank; totalRuns = rec.totalRuns; entryId = rec.entry.id;
      state.recorded = true;
      save();
    } else {
      // Revisiting an already-logged ending (e.g. reload) — display only.
      scoreObj = window.SCOREBOARD.computeScore(state, endingId);
      rank = 0; totalRuns = 0;
      defaultName = (lastRecorded && lastRecorded.entry && lastRecorded.entry.name) || "Black Sam";
      entryId = lastRecorded && lastRecorded.entry && lastRecorded.entry.id;
    }

    var panelHtml = window.SCOREBOARD.scorePanelHtml(scoreObj, rank || 1, totalRuns || 1);
    panel.innerHTML = panelHtml;

    // Editable captain name (renames the just-logged entry live).
    if (entryId) {
      var nameRow = document.createElement("label");
      nameRow.className = "score-name-row";
      nameRow.innerHTML = '<span>Log this voyage under the name:</span>';
      var input = document.createElement("input");
      input.className = "score-name-input";
      input.type = "text";
      input.maxLength = 24;
      input.value = defaultName;
      input.setAttribute("aria-label", "Captain name for the Hall of Fame");
      input.addEventListener("input", function () {
        window.SCOREBOARD.updateEntryName(entryId, input.value.trim() || "Black Sam");
      });
      nameRow.appendChild(input);
      panel.appendChild(nameRow);
    }

    el.text.appendChild(panel);
  }

  function renderChoices(scene, isEnding) {
    el.choices.innerHTML = "";
    el.choices.classList.remove("mg-active");
    el.choices.setAttribute("aria-label", "Your choices");

    if (isEnding) {
      var again = document.createElement("button");
      again.className = "choice";
      again.innerHTML = "Chart a different destiny." +
        '<span class="choice-note">Begin the voyage anew.</span>';
      again.addEventListener("click", restart);
      el.choices.appendChild(again);

      var hof = document.createElement("button");
      hof.className = "choice choice-board";
      hof.innerHTML = "&#9873; Enter the Hall of Fame." +
        '<span class="choice-note">See how this voyage ranks.</span>';
      hof.addEventListener("click", function () { openBoard(); });
      el.choices.appendChild(hof);

      setNote("An ending — but not the only one.");
      return;
    }

    // Mini-game scene: a "begin" button mounts the game in place of choices.
    if (scene.minigame) {
      var mg = scene.minigame;
      var begin = document.createElement("button");
      begin.className = "choice choice-minigame";
      begin.innerHTML = escapeHtml(resolve(mg.intro) || "Take matters into your own hands.") +
        '<span class="choice-note">A trial of skill awaits.</span>';
      begin.addEventListener("click", function () { startMinigame(mg); });
      el.choices.appendChild(begin);

      // Optional skip: let the crew handle it for a lesser outcome.
      if (mg.skip) {
        el.choices.appendChild(buildChoice(mg.skip));
      }
      setNote("");
      return;
    }

    var choices = scene.choices || [];
    var shown = 0;
    for (var j = 0; j < choices.length; j++) {
      var choice = choices[j];
      var unlocked = choiceUnlocked(choice);
      if (!unlocked && choice.hidden) continue;
      el.choices.appendChild(buildChoice(choice, unlocked));
      shown++;
    }
    setNote(shown === 0 ? "The tide has run out." : "");
  }

  function buildChoice(choice, unlocked) {
    if (unlocked === undefined) unlocked = true;
    var btn = document.createElement("button");
    btn.className = "choice" + (unlocked ? "" : " choice-locked");
    var html = escapeHtml(resolve(choice.text));
    var note = unlocked ? resolve(choice.note) : (choice.lockedNote || "Your legend is not yet great enough for this.");
    if (note) html += '<span class="choice-note">' + escapeHtml(note) + "</span>";
    btn.innerHTML = html;
    if (unlocked) {
      btn.addEventListener("click", function () { sfx("click"); choose(choice); });
    } else {
      btn.disabled = true;
    }
    return btn;
  }

  // --- Mini-games ---
  function startMinigame(mg) {
    cancelActiveMinigame();
    var game = window.MINIGAMES && window.MINIGAMES[mg.name];
    if (!game) {
      console.warn("No such minigame:", mg.name);
      // Fail safe: route as a loss so the story never dead-ends.
      return routeOutcome(mg.onLose, 0, mg.name);
    }
    el.choices.innerHTML = "";
    el.choices.classList.add("mg-active");
    el.choices.setAttribute("aria-label", "A trial of skill — follow the instructions on screen");
    setNote("Steady now…");
    activeMinigame = game.mount(el.choices, resolve(mg.opts) || {}, function (result) {
      activeMinigame = null;
      sfx(result.success ? "victory" : "loss");
      var branch = result.success ? mg.onWin : mg.onLose;
      routeOutcome(branch, result.score || 0, mg.name);
    }) || null;
  }

  function routeOutcome(branch, score, name) {
    if (name) state.scores[name] = score;
    var bumped = [];
    if (branch) {
      bumped = applyEffects(resolve(branch.effects));
      setFlags(branch.set);
    }
    var next = branch && resolve(branch.to);
    if (!next || !window.STORY.scenes[next]) {
      console.warn("Minigame outcome has no scene:", next);
      return;
    }
    state.scene = next;
    save();
    renderScene(bumped);
  }

  // --- Actions ---
  function choose(choice) {
    var bumped = applyEffects(resolve(choice.effects));
    setFlags(choice.set);
    var next = resolve(choice.to);
    if (!next || !window.STORY.scenes[next]) {
      console.warn("No such scene:", next);
      return;
    }
    state.scene = next;
    save();
    renderScene(bumped);
  }

  function startGame(fromSave) {
    cancelActiveMinigame();
    if (!fromSave) {
      var keepSound = state.sound;
      state = freshState();
      state.sound = keepSound;
      save();
    }
    if (el.titleCard) el.titleCard.hidden = true;
    if (el.sceneCard) el.sceneCard.hidden = false;
    // Only spin up the (real-time) ambient audio graph if the player has
    // actually opted into sound — most players leave it off by default,
    // and there's no reason to create a live AudioContext for them.
    if (window.SFX && state.sound) window.SFX.startSea();
    renderScene([]);
  }

  function restart() {
    cancelActiveMinigame();
    var keepSound = state.sound;
    clearSave();
    state = freshState();
    state.sound = keepSound;
    if (el.sceneCard) el.sceneCard.hidden = true;
    if (el.titleCard) el.titleCard.hidden = false;
    refreshContinueButton();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshContinueButton() {
    var saved = load();
    var mid = saved && saved.scene && saved.scene !== window.STORY.start &&
      !(window.STORY.scenes[saved.scene] && window.STORY.scenes[saved.scene].ending);
    if (el.continueBtn) el.continueBtn.hidden = !mid;
  }

  // --- Hall of Fame (scoreboard) ---
  function openBoard() {
    cancelActiveMinigame();
    if (window.SCOREBOARD && el.boardBody) window.SCOREBOARD.renderInto(el.boardBody);
    if (el.titleCard) el.titleCard.hidden = true;
    if (el.sceneCard) el.sceneCard.hidden = true;
    if (el.boardCard) el.boardCard.hidden = false;
    // Focus the board heading so screen readers land on the Hall of Fame.
    if (el.boardTitle && typeof el.boardTitle.focus === "function") {
      el.boardTitle.setAttribute("tabindex", "-1");
      try { el.boardTitle.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeBoard() {
    if (el.boardCard) el.boardCard.hidden = true;
    if (el.sceneCard) el.sceneCard.hidden = true;
    if (el.titleCard) el.titleCard.hidden = false;
    refreshContinueButton();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function clearBoard() {
    if (!window.SCOREBOARD) return;
    var ok = true;
    try { ok = window.confirm("Erase every logged voyage from the Hall of Fame? This cannot be undone."); } catch (e) { /* ignore */ }
    if (!ok) return;
    window.SCOREBOARD.clear();
    lastRecorded = null;
    if (el.boardBody) window.SCOREBOARD.renderInto(el.boardBody);
  }

  // --- Sound toggle ---
  function refreshMuteBtn() {
    if (!el.muteBtn) return;
    el.muteBtn.textContent = state.sound ? "♫ Sound On" : "♪ Sound Off";
    el.muteBtn.setAttribute("aria-pressed", state.sound ? "true" : "false");
  }
  function toggleSound() {
    state.sound = !state.sound;
    if (window.SFX) {
      window.SFX.setMuted(!state.sound);
      if (state.sound) { window.SFX.startSea(); window.SFX.click(); }
    }
    refreshMuteBtn();
    save();
  }

  // --- Escaping ---
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- Wire up ---
  if (el.startBtn) el.startBtn.addEventListener("click", function () { startGame(false); });
  if (el.continueBtn) el.continueBtn.addEventListener("click", function () {
    var saved = load();
    if (saved) {
      state = saved;
      if (window.SFX) window.SFX.setMuted(!state.sound);
      refreshMuteBtn();
      startGame(true);
    } else {
      startGame(false);
    }
  });
  if (el.restartBtn) el.restartBtn.addEventListener("click", restart);
  if (el.muteBtn) el.muteBtn.addEventListener("click", toggleSound);

  // Number keys 1-9 pick the Nth enabled choice. Deliberately inert while a
  // mini-game is mounted (they own Space/arrows/1-3) and while the player is
  // typing in any field (e.g. the captain-name input on an ending screen).
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    var key = e.key;
    if (typeof key !== "string" || key.length !== 1 || key < "1" || key > "9") return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" || t.isContentEditable)) return;
    if (!el.sceneCard || el.sceneCard.hidden) return;
    if (el.boardCard && !el.boardCard.hidden) return;
    if (minigameMounted()) return;
    if (!el.choices) return;
    var btn = el.choices.querySelector('button.choice[data-choice-key="' + key + '"]');
    if (btn && !btn.disabled) {
      e.preventDefault();
      btn.click();
    }
  });
  if (el.boardBtn) el.boardBtn.addEventListener("click", openBoard);
  if (el.boardBackBtn) el.boardBackBtn.addEventListener("click", closeBoard);
  if (el.boardClearBtn) el.boardClearBtn.addEventListener("click", clearBoard);

  // Restore sound preference even before starting.
  (function initSound() {
    var saved = load();
    if (saved && typeof saved.sound === "boolean") state.sound = saved.sound;
    if (window.SFX) window.SFX.setMuted(!state.sound);
    refreshMuteBtn();
  })();

  refreshContinueButton();
})();
