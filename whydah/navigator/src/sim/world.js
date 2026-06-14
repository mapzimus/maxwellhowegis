// world.js — sea and sky. A gradient sky dome + a sun the navigator's clock drives
// (day/night), a starfield with Polaris standing due north at altitude = latitude,
// and a wave plane that follows the ship, colored by height (troughs deep, crests
// foaming). Weather drives the scene continuously through setWeather (seaState +
// visibility): seas swell, the sky greys, fog closes in, rain at the worst of it.
// setStorm pins the nor'easter as a locked extreme.

import * as THREE from "three";

let AMP = 1; // storm multiplier on the whole wave field (ship pitch follows free)

export function wave(x, z, t) {
  return AMP * (
    Math.sin(x * 0.012 + t * 0.8) * 3.4 +
    Math.cos(z * 0.016 + t * 0.6) * 2.6 +
    Math.sin((x + z) * 0.007 + t * 1.1) * 1.6 +
    Math.sin(x * 0.05 - z * 0.04 + t * 2.0) * 0.8 // chop
  );
}

export function createWorld(scene) {
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.6);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xdff0ff, 0x2a4658, 0.7);
  scene.add(hemi);
  let gloom = 0; // 0 fair .. 1 filthy; drives every tint below
  let stormLock = false; // setStorm(true) pins the weather until released
  const lerp = (a, b, u) => a + (b - a) * u;

  // Sky dome: a baked vertical gradient, tinted for day/night via material.color.
  const skyGeo = new THREE.SphereGeometry(3000, 24, 16);
  const horizon = new THREE.Color(0xcfe3f0);
  const zenith = new THREE.Color(0x3f7fb5);
  const sc = [];
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i) / 3000;
    sc.push(...horizon.clone().lerp(zenith, Math.max(0, Math.min(1, (y + 0.05) / 0.6))));
  }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(70, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6da, fog: false })
  );
  scene.add(sunMesh);

  // Starfield on the upper dome (fades in at night).
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 1400; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(Math.random());
    const r = 2800;
    starPos.push(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xeef2ff, size: 10, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Polaris — a brighter star due north (azimuth 0 = +Z) at altitude = latitude.
  const polaris = new THREE.Mesh(
    new THREE.SphereGeometry(34, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xf3f7ff, fog: false, transparent: true, opacity: 0 })
  );
  scene.add(polaris);
  const polarisDir = new THREE.Vector3(0, Math.sin(0.45), Math.cos(0.45)).normalize();
  function setStars(latDeg) {
    const a = (latDeg * Math.PI) / 180;
    polarisDir.set(0, Math.sin(a), Math.cos(a));
  }

  // Driving rain (visible only in the storm) — recycled falling points around the ship.
  const RAIN = 500;
  const rainGeo = new THREE.BufferGeometry();
  const rainArr = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    rainArr[i * 3] = (Math.random() - 0.5) * 420;
    rainArr[i * 3 + 1] = Math.random() * 240;
    rainArr[i * 3 + 2] = (Math.random() - 0.5) * 420;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainArr, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xa8c0d4, size: 2.4, transparent: true, opacity: 0.55, depthWrite: false });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  scene.add(rain);

  // Ocean
  const geo = new THREE.PlaneGeometry(6000, 6000, 120, 120);
  geo.rotateX(-Math.PI / 2);
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const ocean = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, flatShading: true }));
  scene.add(ocean);
  const base = Float32Array.from(geo.attributes.position.array);

  const deep = new THREE.Color(0x0a3a57);
  const bright = new THREE.Color(0x2f86b0);
  const stormDeep = new THREE.Color(0x12303d);
  const stormBright = new THREE.Color(0x3e6577);
  const foam = new THREE.Color(0xeef8fa);
  const nightColor = new THREE.Color(0x0a1622);
  const stormHorizon = new THREE.Color(0x6d7d88);
  const tmp = new THREE.Color();
  const dpc = new THREE.Color(), brc = new THREE.Color(); // scratch for the gloom-tinted sea

  scene.fog = new THREE.Fog(horizon.clone(), 450, 2700);
  scene.background = horizon.clone();

  const sunDir = new THREE.Vector3(-0.6, 0.6, 0.5).normalize();

  // Point the sun by altitude/azimuth and tint sky + lights for time of day + weather.
  function setSun(altDeg, azDeg) {
    const alt = (altDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    sunDir.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
    sun.position.copy(sunDir).multiplyScalar(800);

    const day = Math.max(0, Math.min(1, (altDeg + 3) / 12));
    sun.intensity = (0.12 + 1.55 * day) * lerp(1, 0.45, gloom);
    sun.color.setRGB(1, 0.82 + 0.18 * day, 0.62 + 0.33 * day);
    hemi.intensity = (0.22 + 0.55 * day) * lerp(1, 0.7, gloom);
    const g = 0.1 + 0.5 * day; // the grey the sky sinks toward as gloom rises
    skyMat.color.setRGB(
      lerp(0.05 + 0.95 * day, g, gloom),
      lerp(0.07 + 0.93 * day, g * 1.05, gloom),
      lerp(0.15 + 0.85 * day, g * 1.12, gloom)
    );
    // tmp is free here — setSun finishes before update reuses it; never mutate horizon.
    tmp.copy(horizon).lerp(stormHorizon, gloom);
    const hz = nightColor.clone().lerp(tmp, day);
    scene.background.copy(hz);
    scene.fog.color.copy(hz);
    sunMesh.visible = altDeg > -2 && gloom < 0.55;
    sunMesh.material.color.setRGB(1, 0.85 + 0.15 * day, 0.6 + 0.35 * day);

    const night = 1 - day;
    starMat.opacity = night * (1 - gloom);
    stars.visible = starMat.opacity > 0.02;
    polaris.material.opacity = night * (1 - gloom);
    polaris.visible = polaris.material.opacity > 0.05;
  }

  function applyWeather(sea, vis) {
    sea = Math.max(0, Math.min(1, sea));
    vis = Math.max(0, Math.min(1, vis));
    AMP = 1 + sea * 0.9; // seaState 1 = the old storm seas (1.9)
    rain.visible = sea > 0.75;
    const f = Math.max(0, Math.min(1, (1 - vis) / 0.8)); // vis 1 = open sea, 0.2 = closed in
    scene.fog.near = lerp(450, 180, f);
    scene.fog.far = lerp(2700, 900, f);
    gloom = Math.max(0, Math.min(1, Math.max(sea - 0.5, 1 - vis)));
  }
  // The single weather entry point; ignored while the nor'easter lock holds.
  function setWeather(w) { if (!stormLock) applyWeather(w.seaState, w.visibility); }
  // voyage.js still calls this; it outranks setWeather until released.
  function setStorm(on) {
    stormLock = on;
    applyWeather(on ? 1 : 0.1, on ? 0.25 : 1);
  }

  let lastT = 0;
  function update(t, c = { x: 0, z: 0 }) {
    const dt = Math.min(Math.max(t - lastT, 0), 0.1);
    lastT = t;

    ocean.position.set(c.x, 0, c.z);
    sky.position.set(c.x, 0, c.z);
    sunMesh.position.set(c.x + sunDir.x * 2400, sunDir.y * 2400, c.z + sunDir.z * 2400);
    stars.position.set(c.x, 0, c.z);
    polaris.position.set(c.x + polarisDir.x * 2600, polarisDir.y * 2600, c.z + polarisDir.z * 2600);

    if (rain.visible) {
      rain.position.set(c.x, 0, c.z);
      const p = rainGeo.attributes.position;
      for (let i = 0; i < RAIN; i++) {
        let y = p.getY(i) - 190 * dt;
        if (y < 0) y = 240;
        p.setY(i, y);
        p.setX(i, p.getX(i) + 36 * dt * ((i % 3) - 1)); // gusty sideways drift
      }
      p.needsUpdate = true;
    }

    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    const dp = dpc.copy(deep).lerp(stormDeep, gloom);
    const br = brc.copy(bright).lerp(stormBright, gloom);
    const foamFrom = lerp(2.6, 4.2, gloom);
    for (let i = 0; i < pos.count; i++) {
      const h = wave(base[i * 3] + c.x, base[i * 3 + 2] + c.z, t);
      pos.setY(i, h);
      tmp.copy(dp).lerp(br, Math.max(0, Math.min(1, (h + 7 * AMP) / (13 * AMP))));
      const f = Math.max(0, Math.min(1, (h - foamFrom) / 3.0));
      if (f > 0) tmp.lerp(foam, f * 0.95);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return { ocean, sun, update, setSun, setStars, setStorm, setWeather, wave };
}
