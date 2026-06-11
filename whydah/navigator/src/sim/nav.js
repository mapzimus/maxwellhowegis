// nav.js — the navigator's truth and estimate. Advances a TRUE lat/lon (pushed by
// a hidden current, plus the storm's onshore set when it wakes) and a DEAD-RECKONING
// estimate (compass heading + last-logged speed) under a compressed game clock, and
// computes the sun's position for the sky and for sights.

import { headingToComponents, stepPosition, distanceNm } from "../geo.js";

const COMPRESSION = 480; // game-seconds per real-second (~1 day every 3 real minutes)
const DEG = Math.PI / 180;

function declination(dayOfYear) {
  return 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365.24);
}

export function createNav(start, scenario) {
  let truePos = { lat: start.lat, lon: start.lon };
  let drPos = { lat: start.lat, lon: start.lon };
  let reckonedSpeed = null;
  let dayOfYear = 57; // 26 February
  let secondsOfDay = 9 * 3600; // 09:00
  const cells = (scenario.currentField && scenario.currentField.cells) || [];
  const stormCells = (scenario.storm && scenario.storm.cells) || [];
  let stormOn = false;
  const trueTrack = [{ ...truePos }];
  const drTrack = [{ ...drPos }];
  let sinceSample = 0;

  function currentAt(lat, lon) {
    let north = 0, east = 0, wsum = 0;
    const active = stormOn ? cells.concat(stormCells) : cells;
    for (const c of active) {
      const d2 = (c.lat - lat) ** 2 + (c.lon - lon) ** 2 + 0.02;
      const w = 1 / (d2 * d2);
      const v = headingToComponents(c.speedKn, c.dirDeg);
      north += v.north * w;
      east += v.east * w;
      wsum += w;
    }
    return wsum ? { north: north / wsum, east: east / wsum } : { north: 0, east: 0 };
  }

  function advance(dtReal, headingDeg, knots) {
    const gameHours = (dtReal * COMPRESSION) / 3600;
    secondsOfDay += dtReal * COMPRESSION;
    while (secondsOfDay >= 86400) { secondsOfDay -= 86400; dayOfYear++; }

    const drSpeed = reckonedSpeed == null ? knots : reckonedSpeed; // true speed until you've logged
    const boat = headingToComponents(knots, headingDeg);
    const drBoat = headingToComponents(drSpeed, headingDeg);
    const cur = currentAt(truePos.lat, truePos.lon);
    truePos = stepPosition(truePos, boat.north + cur.north, boat.east + cur.east, gameHours);
    drPos = stepPosition(drPos, drBoat.north, drBoat.east, gameHours);

    sinceSample += dtReal;
    if (sinceSample > 0.5) {
      sinceSample = 0;
      trueTrack.push({ ...truePos });
      drTrack.push({ ...drPos });
      if (trueTrack.length > 5000) { trueTrack.shift(); drTrack.shift(); }
    }
  }

  function sun() {
    const dec = declination(dayOfYear) * DEG;
    const lat = truePos.lat * DEG;
    const H = ((secondsOfDay / 86400) * 360 - 180) * DEG;
    const altSin = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, altSin)));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
    return { altDeg: alt / DEG, azDeg: (az / DEG + 360) % 360, decDeg: dec / DEG, hourAngleDeg: H / DEG };
  }

  function nearNoon() {
    const s = sun();
    return s.altDeg > 5 && Math.abs(s.hourAngleDeg) < 8;
  }

  function timeLabel() {
    const h = Math.floor(secondsOfDay / 3600);
    const m = Math.floor((secondsOfDay % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function setDrLatitude(lat) {
    drPos = { lat, lon: drPos.lon };
    drTrack.push({ ...drPos });
  }
  function setReckonedSpeed(knots) { reckonedSpeed = knots; }
  function setStorm(on) { stormOn = on; }

  return {
    advance, sun, nearNoon, timeLabel, setDrLatitude, setReckonedSpeed, setStorm,
    _debugSetTrue(lat, lon) { truePos = { lat, lon }; },
    get true() { return { ...truePos }; },
    get dr() { return { ...drPos }; },
    get reckonedSpeed() { return reckonedSpeed; },
    get stormOn() { return stormOn; },
    get trueTrack() { return trueTrack; },
    get drTrack() { return drTrack; },
    get dayOfYear() { return dayOfYear; },
    driftNm() { return distanceNm(truePos, drPos); },
  };
}
