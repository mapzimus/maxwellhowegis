// ship.js — the Whydah: a lofted hull, billowing sails, rigging, cannons, and a
// Jolly Roger. Faces +Z (bow forward). Carries heading + speed with momentum and
// rides the swell.

import * as THREE from "three";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAIL_SPEED = [0, 10, 20, 32]; // furled, half, full, full+ (world units/sec)

export function createShip(scene) {
  const ship = new THREE.Group();

  const M = {
    hull: new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }),
    trim: new THREE.MeshStandardMaterial({ color: 0x3a2614, roughness: 0.8, flatShading: true }),
    deck: new THREE.MeshStandardMaterial({ color: 0xa9824e, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
    sail: new THREE.MeshStandardMaterial({ color: 0xefe7d2, emissive: 0x46412f, roughness: 1, side: THREE.DoubleSide, flatShading: true }),
    iron: new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.5, metalness: 0.4, flatShading: true }),
  };

  buildHullAndDeck(ship, M);
  buildRail(ship, M);
  buildCannons(ship, M);

  // Masts + billowing sails + yards
  const masts = [
    { z: 7, h: 30 }, // foremast
    { z: -1, h: 34 }, // mainmast
    { z: -9, h: 26 }, // mizzen
  ];
  for (const m of masts) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, m.h, 7), M.trim);
    mast.position.set(0, 5 + m.h / 2, m.z);
    ship.add(mast);

    addSail(ship, M, m.z, 5 + m.h * 0.30, m.h * 0.34, 13); // course (lower)
    addSail(ship, M, m.z, 5 + m.h * 0.66, m.h * 0.26, 10); // topsail (upper)
  }

  // Bowsprit + jib
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 12, 6), M.trim);
  bowsprit.rotation.x = Math.PI / 2.4;
  bowsprit.position.set(0, 7, 16);
  ship.add(bowsprit);
  const jib = billowedSail(8, 9, 1.0, M.sail);
  jib.rotation.y = Math.PI / 2;
  jib.position.set(0, 10, 13);
  ship.add(jib);

  // Helm wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.16, 8, 18), M.trim);
  wheel.position.set(0, 7, -9);
  ship.add(wheel);

  buildRigging(ship, masts);
  const flag = buildFlag(ship);

  scene.add(ship);

  const state = { heading: 0, speed: 0, target: 0, rudder: 0, sail: 0, wind: 1 };
  const setRudder = (r) => { state.rudder = clamp(r, -1, 1); };
  const setSail = (lvl) => { state.sail = clamp(lvl, 0, 3); };
  const setWindFactor = (f) => { state.wind = clamp(f, 0.2, 1.4); };

  function step(dt, t, waveAt) {
    state.target = SAIL_SPEED[state.sail] * state.wind; // wind scales the target; the easing below glides to it
    const speedFactor = clamp(state.speed / 12, 0, 1) * 0.9 + 0.1;
    state.heading += state.rudder * 0.5 * speedFactor * dt;
    state.speed += clamp(state.target - state.speed, -6 * dt, 5 * dt);

    const fx = Math.sin(state.heading), fz = Math.cos(state.heading);
    ship.position.x += fx * state.speed * dt;
    ship.position.z += fz * state.speed * dt;

    ship.position.y = waveAt(ship.position.x, ship.position.z, t) + 0.4;
    const yF = waveAt(ship.position.x + fx * 13, ship.position.z + fz * 13, t);
    const yA = waveAt(ship.position.x - fx * 13, ship.position.z - fz * 13, t);
    ship.rotation.set(Math.atan2(yF - yA, 26) * 0.7, state.heading, Math.sin(t * 0.6) * 0.03);

    wheel.rotation.z = -state.rudder * 1.3;
    flag.wave(t);
  }

  return {
    group: ship, wheel, setRudder, setSail, setWindFactor, step,
    get headingDeg() { return ((state.heading * 180 / Math.PI) % 360 + 360) % 360; },
    get knots() { return state.speed * 0.4; },
    get sail() { return state.sail; },
    get heading() { return state.heading; },
    get position() { return ship.position; },
  };
}

// --- geometry helpers ---

// Loft a hull from bow-to-stern "stations" (cross-section ribs) and skin it.
function buildHullAndDeck(group, M) {
  const Z0 = -14, Z1 = 16, NSTAT = 14, SEC = 5;
  const stations = [];
  for (let s = 0; s <= NSTAT; s++) {
    const along = s / NSTAT; // 0 = stern, 1 = bow
    let hb = 4.3 * Math.sin(Math.PI * (0.15 + 0.8 * along)); // beam
    if (along > 0.82) hb *= 1 - (along - 0.82) / 0.18; // taper to a point at the bow
    hb = Math.max(hb, along < 0.12 ? 2.0 : 0.22); // keep a transom at the stern
    const ends = Math.pow(Math.abs(along - 0.5) * 2, 1.6);
    const top = 4.2 + 2.2 * ends; // sheer rises fore and aft
    const bot = -2.6 + 1.7 * Math.pow(Math.abs(along - 0.5) * 2, 2.2); // rocker
    const z = Z0 + along * (Z1 - Z0);
    const sec = [];
    for (let k = SEC; k >= 1; k--) { const u = k / SEC; sec.push([-hb * u ** 0.7, bot + (top - bot) * u, z]); }
    sec.push([0, bot, z]);
    for (let k = 1; k <= SEC; k++) { const u = k / SEC; sec.push([hb * u ** 0.7, bot + (top - bot) * u, z]); }
    stations.push(sec);
  }

  const hullPos = [], deckPos = [];
  const cols = stations[0].length;
  for (let s = 0; s < stations.length - 1; s++) {
    for (let k = 0; k < cols - 1; k++) {
      const a = stations[s][k], b = stations[s][k + 1], c = stations[s + 1][k + 1], d = stations[s + 1][k];
      hullPos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    // deck: span the two gunwales, dropped slightly to suggest bulwarks
    const pP = stations[s][0], pS = stations[s][cols - 1];
    const nP = stations[s + 1][0], nS = stations[s + 1][cols - 1];
    const drop = ([x, y, z]) => [x * 0.92, y - 0.9, z];
    const [Ap, Sp, An, Sn] = [drop(pP), drop(pS), drop(nP), drop(nS)];
    deckPos.push(...Ap, ...Sp, ...Sn, ...Ap, ...Sn, ...An);
  }

  // Cap the stern and bow so we don't see into the open hull.
  const capStation = (sec) => {
    const keel = sec[Math.floor(sec.length / 2)];
    for (let k = 0; k < sec.length - 1; k++) hullPos.push(...keel, ...sec[k], ...sec[k + 1]);
  };
  capStation(stations[0]);
  capStation(stations[stations.length - 1]);

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute("position", new THREE.Float32BufferAttribute(hullPos, 3));
  hullGeo.computeVertexNormals();
  group.add(new THREE.Mesh(hullGeo, M.hull));

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute("position", new THREE.Float32BufferAttribute(deckPos, 3));
  deckGeo.computeVertexNormals();
  group.add(new THREE.Mesh(deckGeo, M.deck));

  // Stern castle (raised aft deck)
  const castle = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.4, 6), M.hull);
  castle.position.set(0, 6.2, -10.5);
  group.add(castle);
}

// A simple bulwark rail along both gunwales.
function buildRail(group, M) {
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 24), M.trim);
    rail.position.set(side * 3.7, 5.3, 1);
    group.add(rail);
  }
}

function buildCannons(group, M) {
  for (const side of [-1, 1]) {
    for (const z of [6, 0, -6]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 3, 8), M.iron);
      c.rotation.z = Math.PI / 2;
      c.position.set(side * 4.1, 5.2, z);
      group.add(c);
    }
  }
}

// Bulge a plane into a wind-filled sail (belly toward +Z, the bow).
function billowedSail(w, h, belly, mat) {
  const g = new THREE.PlaneGeometry(w, h, 8, 5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const fx = 1 - (2 * p.getX(i) / w) ** 2;
    const fy = 1 - (2 * p.getY(i) / h) ** 2;
    p.setZ(i, belly * Math.max(0, fx) * Math.max(0, fy));
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function addSail(group, M, z, y, h, w) {
  const sail = billowedSail(w, h, 1.6, M.sail);
  sail.position.set(0, y, z - 0.6);
  group.add(sail);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, w + 2, 5), M.trim);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, y + h / 2, z);
  group.add(yard);
}

// Stays (fore/aft) and shrouds (to the sides) as dark lines.
function buildRigging(group, masts) {
  const pts = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const m of masts) {
    const top = 5 + m.h;
    pts.push(v(0, top, m.z), v(0, 7, m.z + 14)); // forestay
    pts.push(v(0, top, m.z), v(0, 6.5, m.z - 12)); // backstay
    pts.push(v(0, top, m.z), v(3.4, 5.3, m.z)); // shroud stbd
    pts.push(v(0, top, m.z), v(-3.4, 5.3, m.z)); // shroud port
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1c130a })));
}

function buildFlag(group) {
  const tex = jollyRoger();
  const W = 7;
  const geo = new THREE.PlaneGeometry(W, 4.2, 12, 1);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x333333, emissiveMap: tex }));
  flag.position.set(3.6, 40.5, -1); // atop the mainmast, streaming to starboard
  group.add(flag);
  const base = Float32Array.from(geo.attributes.position.array);
  return {
    wave(t) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const fx = (base[i * 3] + W / 2) / W; // 0..1 along the fly
        p.setZ(i, Math.sin(fx * 6 + t * 6) * 0.8 * fx);
      }
      p.needsUpdate = true;
    },
  };
}

// A little Jolly Roger drawn to a canvas.
function jollyRoger() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 80;
  const x = c.getContext("2d");
  x.fillStyle = "#0e0e0e"; x.fillRect(0, 0, 128, 80);
  x.fillStyle = "#efeadf";
  x.beginPath(); x.arc(64, 32, 15, 0, Math.PI * 2); x.fill();
  x.fillRect(55, 40, 18, 9);
  x.fillStyle = "#0e0e0e";
  x.beginPath(); x.arc(58, 31, 4, 0, Math.PI * 2); x.arc(70, 31, 4, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#efeadf"; x.lineWidth = 6; x.lineCap = "round";
  x.beginPath(); x.moveTo(42, 58); x.lineTo(86, 72); x.moveTo(86, 58); x.lineTo(42, 72); x.stroke();
  return new THREE.CanvasTexture(c);
}
