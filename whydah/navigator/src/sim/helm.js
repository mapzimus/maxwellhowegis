// helm.js — steering and sail input. A/D or arrows steer; drag the sea to steer;
// W/S raise/lower sail. Rudder centers when you let go (the ship keeps its turn
// through momentum, not a stuck wheel). Can be disabled (autopilot, text inputs).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const typingInField = (e) =>
  e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

export function createHelm(ship, canvas) {
  let sail = 1;
  let enabled = true;
  ship.setSail(sail); // start at half sail, already making way

  const keys = {};
  let dragging = false;
  let dragRudder = 0;
  let startX = 0;

  window.addEventListener("keydown", (e) => {
    if (!enabled || typingInField(e)) return;
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (k === "w") { sail = Math.min(3, sail + 1); ship.setSail(sail); }
    if (k === "s") { sail = Math.max(0, sail - 1); ship.setSail(sail); }
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled) return;
    dragging = true;
    startX = e.clientX;
  });
  window.addEventListener("pointermove", (e) => {
    if (dragging) dragRudder = clamp((e.clientX - startX) / 220, -1, 1);
  });
  window.addEventListener("pointerup", () => { dragging = false; dragRudder = 0; });

  function update() {
    if (!enabled) return; // leave the rudder to whoever has the conn
    let r = 0;
    if (dragging) {
      r = dragRudder;
    } else {
      if (keys["a"] || keys["arrowleft"]) r -= 1;
      if (keys["d"] || keys["arrowright"]) r += 1;
    }
    ship.setRudder(r);
  }

  function setEnabled(v) {
    enabled = v;
    if (!v) { dragging = false; dragRudder = 0; }
    else { sail = ship.sail; } // resync after the AI had her
  }

  return { update, setEnabled, get enabled() { return enabled; }, get sail() { return sail; } };
}
