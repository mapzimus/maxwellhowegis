# Whydah Navigator

A browser game for the Whydah unit: take the helm of the *Whydah* in February 1717 and
run her from the Windward Passage to Richmond Island, Maine — navigating the way her
real crew had to.

**Play:** open `index.html` from any static host, or locally with `python server.py`
(then http://localhost:8000). No build step, no dependencies to install, works offline.

## What's in the game

- A 3D sea, ship, and day/night sky (Three.js, vendored in `vendor/`).
- **Period navigation only** — what was aboard in 1717: compass, backstaff (noon sun),
  mariner's quadrant (Polaris by night), log-line & sandglass, lead line, Mercator
  chart, dead reckoning. No octant (1731), no sextant (1759), no chronometer (1761) —
  so **latitude is findable and longitude is not**, which is the whole lesson.
- The hidden Gulf Stream bends your reckoning; the chart (M) shows where you *think*
  you are; landfall reveals the truth.
- The **Cape Cod temptation**: divert for plunder and the nor'easter wakes — the
  Wellfleet Bars took the real ship on 26 April 1717 (2 survivors of 146).
- **Watch the crew sail her** — an autopilot demo that always takes the Cape bait
  (also at `?demo=1`), records itself as CPU.
- Local **top-20 log book** (browser localStorage), seeded with P. Williams, Black Sam,
  and John Julian's historical outcomes.

## Controls

A/D steer · W/S sail · C camera · T fast time · M chart · B sun/star sight ·
L log-line · F lead line · H help · Esc take over from the demo

## Data & credits

- Coastline: Natural Earth 1:10m (public domain), clipped by `data/build_coastline.py`.
- Engine: Three.js (MIT), vendored at `vendor/three.module.js`.
- History grounded in the Whydah record: Bellamy's run for Maine, Williams's Block
  Island detour, the *Mary Anne* wine prize, the wreck off Wellfleet, and Cyprian
  Southack's 1717 chart ("where I buried One Hundred & Two Men Drowned").
