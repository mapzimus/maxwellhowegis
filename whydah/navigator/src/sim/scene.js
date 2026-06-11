// scene.js — a story overlay. Shows a narration card (title + paragraphs) with
// either a single Continue button or branching choices, and pauses the world while
// the player reads and decides.

export function createScene() {
  const overlay = document.getElementById("scene-overlay");
  const titleEl = document.getElementById("scene-title");
  const textEl = document.getElementById("scene-text");
  const btnRow = document.getElementById("scene-buttons");
  let open = false;

  function show(beat) {
    titleEl.textContent = beat.title || "";
    textEl.replaceChildren();
    const paras = Array.isArray(beat.text) ? beat.text : [beat.text || ""];
    for (const para of paras) {
      if (!para) continue;
      const p = document.createElement("p");
      p.textContent = para;
      textEl.appendChild(p);
    }
    btnRow.replaceChildren();
    const choices = beat.choices || [{ label: beat.button || "Continue" }];
    for (const c of choices) {
      const b = document.createElement("button");
      b.textContent = c.label;
      b.addEventListener("click", () => { hide(); if (c.onChoose) c.onChoose(); });
      btnRow.appendChild(b);
    }
    overlay.style.display = "flex";
    open = true;
  }
  function hide() {
    overlay.style.display = "none";
    open = false;
  }
  return { show, hide, isOpen: () => open };
}
