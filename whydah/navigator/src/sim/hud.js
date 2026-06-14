// hud.js — keep the on-screen heading + knots readouts in sync with the ship.

export function createHud(ship) {
  const heading = document.getElementById("hud-heading");
  const speed = document.getElementById("hud-speed");

  function update() {
    heading.textContent = String(Math.round(ship.headingDeg)).padStart(3, "0") + "°";
    speed.textContent = ship.knots.toFixed(1);
  }

  return { update };
}
