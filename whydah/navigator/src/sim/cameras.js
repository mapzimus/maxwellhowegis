// cameras.js — two rigs that follow the ship: first-person at the helm (default)
// and a 3/4 chase view. Press C to toggle. Positions ease for a smooth feel.

import * as THREE from "three";

export function createCameras(camera, ship) {
  let mode = 0; // 0 = helm (first person), 1 = chase

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") mode = (mode + 1) % 2;
  });

  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  function update() {
    const p = ship.position;
    fwd.set(Math.sin(ship.heading), 0, Math.cos(ship.heading));

    if (mode === 0) {
      // First-person helm: high at the wheel and just off the centerline, looking
      // forward over the length of the ship to the horizon.
      const rx = fwd.z, rz = -fwd.x; // starboard (right) direction
      eye.set(p.x - fwd.x * 9 + rx * 8, p.y + 11, p.z - fwd.z * 9 + rz * 8);
      camera.position.lerp(eye, 0.25);
      look.set(p.x + fwd.x * 55, p.y + 6, p.z + fwd.z * 55);
      camera.lookAt(look);
    } else {
      // Behind, above, and well off to one side for a cinematic 3/4 profile.
      const rx = fwd.z, rz = -fwd.x;
      eye.set(p.x - fwd.x * 44 + rx * 24, p.y + 22, p.z - fwd.z * 44 + rz * 24);
      camera.position.lerp(eye, 0.12);
      camera.lookAt(p.x + fwd.x * 4, p.y + 8, p.z + fwd.z * 4);
    }
  }

  return { update, get mode() { return mode; }, set mode(m) { mode = m; } };
}
