# Whydah Navigator — 3D Pivot & Phase 1 Spec ("First Sail")

## Context

Pivot from the 2D overhead Mercator chart (see `../../.claude/plans/eager-honking-wilkinson.md`,
now superseded) to a **deep, immersive 3D pirate navigation adventure** that mimics real
1700s navigation with period tools and a hand-drawn chart — *not* an overhead GIS map. Built
**incrementally in playable phases**, from a lightweight 3D helm toward a fuller sim, with a
choose-your-own-adventure story spine.

**Reused foundation:** `src/geo.js` (real nav math), `data/scenario.json` (voyage, history,
objectives, narration, currents, crew/storm), `data/coastline.geojson`, and the no-cache
threaded dev server (`server.py` / `start-game.bat`).

## North star

Sail the Whydah from the Caribbean to Maine in a 3D world, navigating with authentic 1700s
instruments, as the historical story unfolds through scripted scenes and choices (including
the Cape Cod temptation) — greed vs. survival, with your crew on the line.

## Roadmap (each phase independently playable)

- **Phase 1 — First Sail** *(this spec)*: 3D sea + sky + the Whydah + helm; steer across the
  sea. First-person at the wheel, toggle to chase cam.
- **Phase 2 — Real tools**: backstaff (latitude by sun), log-line + sandglass (speed), lead
  line (soundings), traverse board (dead reckoning). True position **hidden**; you estimate it.
- **Phase 3 — Voyage & story**: Caribbean→Maine with scripted scenes and choices (capture,
  Block Island, Cape Cod lure, the storm), crew attrition, cumulative scoring.
- **Phase 4 — Toward the dream**: richer ocean & weather, sail handling, day/night & stars,
  audio, polish.

## Phase 1 design — "First Sail"

**Experience:** stand at the Whydah's wheel and sail her across a living 3D sea; feel a
300-ton ship answer the helm with weight and momentum.

**World (stylized low-poly, built in code — no external 3D assets):**
- *Ocean* — a wide plane with rolling sine-wave swells; clean, painterly shading.
- *Sky* — gradient dome + sun + warm directional light; horizon haze.
- *Ship* — a low-poly Whydah from primitives (hull, three masts, sails, helm wheel) that
  bobs and pitches with the swells.

**Camera:** first-person at the wheel by default (deck and bowsprit ahead, horizon filling
the view); press **C** to toggle to a cinematic chase cam.

**Controls & feel:**
- *Steer* — `A`/`D` or `←`/`→`, or drag the wheel (it visibly rotates to the rudder).
  Heading changes **gradually**, turn rate scaling with speed — momentum.
- *Sail/speed* — `W`/`S` cycles furled → half → full sail → a target speed; the ship
  accelerates and decelerates smoothly.
- *HUD* — compass heading + a knots readout.

**Tech:**
- **Three.js**, vendored at `vendor/three.module.js` (offline-safe), loaded via an import map.
  No build step.
- 3D becomes the new `index.html`; the prior 2D chart is preserved as `chart.html` (it
  becomes the in-game **navigator's chart** in a later phase).
- The ship drives a real **lat/lon** via `geo.js` `stepPosition` from the **Windward Passage**
  start — not surfaced in Phase 1, but wired so Phase 2's instruments just *reveal* it.

**Module structure (new):**
```
src/sim/
  main.js     # bootstrap: renderer, scene, animation loop, wiring
  world.js    # ocean + sky + lights
  ship.js     # build the Whydah; state (heading, speed, lat/lon); bob with waves
  helm.js     # the wheel + steering + sail input
  cameras.js  # first-person + chase rigs and the C toggle
  hud.js      # compass + knots overlay
src/geo.js    # reused position math
vendor/three.module.js
```

**Build order (each step visually verified):**
1. Scene boots — renderer + sky + animated ocean; camera looks out to sea.
2. Ship appears — the low-poly Whydah on the water, gentle bob.
3. It sails — `W`/`S` speed, `A`/`D` heading; movement with momentum.
4. Helm & HUD — the wheel rotates to the rudder; compass + knots.
5. Cameras — first-person at the helm; `C` toggles the chase cam.
6. Feel pass — wave-coupled pitch/roll, horizon haze, sun glint; *(stretch)* sea ambience
   via Web Audio.

**Verification:** run `start-game.bat` (or `python server.py`) → `http://localhost:8000`.
Per step: Playwright screenshot + clean console; programmatic checks (heading changes when
steering, speed changes with sail, camera toggles).

**Out of scope for Phase 1** (later phases): instruments & dead reckoning, story/choices,
currents/wind acting on the hull, crew, scoring, real 3D model assets, multiplayer.
