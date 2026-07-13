# First Sail

A browser game for the Whydah unit. Steer the *Whydah* north to Maine, survive what the sea throws at you, and try to beat the storm at the end.

**Play:** open `index.html` on any static host (it is live in the site's Games menu). No build step, no libraries, nothing loaded from the network. Pure Canvas 2D in three files (`index.html`, `game.css`, `game.js`). Runs offline and on Chromebooks.

## How it plays

- **Steer north.** Left and right only (arrow keys, A/D, or the on-screen buttons). The ship sails itself. You dodge rocks and grab coins and repairs.
- **A random voyage.** Every run is a different order of encounters: an enemy ship to fight, a **sea serpent**, and lucky or unlucky events. No two runs are the same.
- **Navigator games for points.** The old instruments are now quick skill games that bank points and do not steer the ship: a sun-sight (backstaff), a depth sounding (lead line), and a speed count (log-line).
- **The storm.** A hard finale off the coast. Lose it and your score is capped. Beat it and a survivor bonus breaks the cap and lifts your rank.

## Controls

Arrow keys or A / D to steer. Space, or the fire button, to fire. 🔇 toggles sound (off by default for the classroom).

## Notes

- Self-contained: no dependencies, no build, no network requests.
- The history behind it: the real Whydah was sailing north when a nor'easter wrecked her off Cape Cod in April 1717. In the game you get the chance her crew never had.
- Rebuilt July 2026, replacing the earlier 3D dead-reckoning simulator.
