# Phase 2 — Real navigation (dead reckoning, the chart table, hands-on tools)

## The loop

While sailing the 3D ship, the game stops telling you where you are. You keep a
**dead-reckoning (DR) estimate** from compass heading + speed. A **hidden current** (the
Gulf Stream) pushes your **true** position off that estimate. You correct what you can with
period instruments and plot it on a **hand-drawn chart you visit**. Latitude is fixable (sun
sight); longitude is not (no chronometer) — so east–west error rots until landfall, exactly
as it did for the Whydah.

## Systems

- **`sim/nav.js`** — the truth backbone (built first):
  - `truePos` and `drPos` (lat/lon), starting at the Windward Passage.
  - A **compressed clock** (~1 day per 3 real minutes) advancing a date/time from 26 Feb 1717.
  - `advance(dt, heading, knots)`: TRUE moves by boat velocity **+ current**; DR moves by boat
    velocity **only**. Current sampled (inverse-distance) from `scenario.currentField.cells`.
  - `sun()`: real solar **altitude/azimuth** from time-of-day, true latitude, and date
    declination — drives the 3D sky **and** the backstaff sight.
  - `applyLatitudeSight(err)`: snap DR latitude to the truth (± small instrument error).
- **Moving sun** (`world.js`): the directional light + sun disc follow `nav.sun()`; sky and
  light color shift with altitude (dawn/day/dusk/night).
- **Chart table** (`sim/chartTable.js`): a full-screen **hand-drawn parchment** chart you
  toggle (key **M** / "go to the table"). Shows your **DR** position + track and latitude
  lines — *not* the truth. Reuses the coastline data, restyled sketchy/sepia.
- **Hands-on instruments** (each its own overlay), in order:
  1. **Backstaff** — slide the vane to bring the sun down to the horizon; read the altitude.
     At local noon → latitude → correct DR.
  2. **Log line** — heave the log, count knots paying out against a 30-sand sandglass → speed.
  3. **Lead line** — heave the lead in shallow water → depth + bottom sample (shoal warning).

## Time / scale model

Heading + sail come from the 3D ship (Phase 1). Navigation advances in **lat/lon** from
**knots × game-hours**, decoupled from the decorative 3D world units but moving in step.
Compression ≈ 480× (tunable): a day ≈ 3 min, the whole voyage ≈ 20–30 min.

## Build slices (each verified)

- **A1 — Foundation:** `nav.js` (clock, true/DR position, current, solar position) wired into
  the loop; the **sun moves** across the sky; dev HUD shows time + DR/true for checking. *(now)*
- **A2 — Chart table:** toggle the hand-drawn chart; plot the DR track; latitude lines.
- **A3 — Backstaff:** hands-on sun-altitude sight → latitude → correct DR; see N–S error
  collapse while E–W (longitude) error remains.
- **B — More tools:** log line (speed), lead line (soundings); landfall reveal of true error.

## Verification

Run `start-game.bat` → `localhost:8000`. A1 checks: the sun rises/sets as the clock runs;
`true` and `dr` start equal and **diverge** as the current acts; `nav.sun().altDeg` peaks at
local noon and the peak tracks latitude. Programmatic via `window.WHYDAH3D.nav`.
