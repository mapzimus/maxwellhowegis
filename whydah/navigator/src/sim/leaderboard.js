// leaderboard.js — a persistent top-20 score table kept in the browser's
// localStorage (no server). Seeded with historical runs so the board itself makes
// the point: the real Black Sam is below the wreck line.

const KEY = "whydah_leaderboard_v1";
const NAME_KEY = "whydah_captain_name";
const SEED = [
  { name: "P. WILLIAMS", score: 1320, outcome: "arrive", note: "1717" },
  { name: "CPU", score: 1140, outcome: "arrive" },
  { name: "CPU", score: 900, outcome: "wreck" },
  { name: "BLACK SAM", score: 612, outcome: "wreck", note: "1717" },
  { name: "CPU", score: 520, outcome: "wreck" },
  { name: "J. JULIAN", score: 360, outcome: "wreck", note: "pilot, survived" },
];

export function createLeaderboard() {
  const overlay = document.getElementById("leaderboard-overlay");
  const titleEl = document.getElementById("lb-title");
  const scoreEl = document.getElementById("lb-score");
  const form = document.getElementById("lb-form");
  const nameInput = document.getElementById("lb-name");
  const saveBtn = document.getElementById("lb-save");
  const listEl = document.getElementById("lb-list");
  const closeBtn = document.getElementById("lb-close");

  let open = false;
  let pending = null; // { score, outcome }
  let onClose = null;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (_) {}
    return SEED.slice();
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20))); } catch (_) {}
  }

  function render(highlightName, highlightScore) {
    const list = load().sort((a, b) => b.score - a.score).slice(0, 20);
    listEl.replaceChildren();
    list.forEach((e, i) => {
      const row = document.createElement("div");
      row.className = "lb-row" + (e.outcome === "arrive" ? " lb-arrive" : " lb-wreck");
      if (highlightName && e.name === highlightName && e.score === highlightScore) row.classList.add("lb-you");
      const rank = document.createElement("span"); rank.className = "lb-rank"; rank.textContent = `${i + 1}.`;
      const nm = document.createElement("span"); nm.className = "lb-name"; nm.textContent = e.name + (e.note ? ` (${e.note})` : "");
      const oc = document.createElement("span"); oc.className = "lb-oc"; oc.textContent = e.outcome === "arrive" ? "reached Maine" : "wrecked";
      const sc = document.createElement("span"); sc.className = "lb-sc"; sc.textContent = e.score;
      row.append(rank, nm, oc, sc);
      listEl.appendChild(row);
    });
  }

  function show() {
    pending = null;
    titleEl.textContent = "The Log Book — Top 20";
    scoreEl.textContent = "";
    form.style.display = "none";
    render();
    overlay.style.display = "flex";
    open = true;
  }

  // End-of-voyage flow: show the score and ask for a name.
  function entry(score, state) {
    pending = { score, outcome: state.outcome };
    titleEl.textContent = state.outcome === "arrive" ? "You raised Maine!" : "Lost off the Cape";
    scoreEl.textContent = `Your score: ${score}`;
    form.style.display = "flex";
    try { nameInput.value = localStorage.getItem(NAME_KEY) || ""; } catch (_) { nameInput.value = ""; }
    render();
    overlay.style.display = "flex";
    open = true;
    setTimeout(() => nameInput.focus(), 50);
  }

  // Direct save with no form — used by the autopilot to log its CPU runs.
  function record(score, outcome, name) {
    const list = load();
    list.push({ name, score, outcome });
    list.sort((a, b) => b.score - a.score);
    persist(list);
  }

  saveBtn.addEventListener("click", () => {
    if (!pending) return;
    const name = (nameInput.value || "???").toUpperCase().replace(/[^A-Z0-9 .'-]/g, "").slice(0, 12) || "???";
    try { localStorage.setItem(NAME_KEY, name); } catch (_) {}
    record(pending.score, pending.outcome, name);
    form.style.display = "none";
    render(name, pending.score);
    pending = null;
  });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); });

  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    open = false;
    if (onClose) onClose();
  });

  return {
    show, entry, record,
    isOpen: () => open,
    set onClose(fn) { onClose = fn; },
  };
}
