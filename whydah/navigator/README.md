# First Sail

A browser game for the Whydah unit. Live the whole voyage: dive a Spanish wreck off Florida, chase down and board the *Whydah*, then run her north to Maine through ten missions of escalating legend, hazard, and history — and try to beat the storm the real crew never did.

**Play:** open `index.html` on any static host (it is live in the site's Games menu). No build step, no libraries, nothing loaded from the network. Pure Canvas 2D in three files (`index.html`, `game.css`, `game.js`). Runs offline and on Chromebooks.

## The campaign

Ten missions, each its own leg of the real 1716–1717 voyage, each escalating in theme and difficulty:

1. **The Wreck Diver** *(1716, Florida)* — before the pirate life. A side-view dive: steer a diver instead of a ship, mind the breath bar, grab gold among the wreck timbers, and keep clear of slow patrol sharks.
2. **The Three-Day Chase** *(February 1717)* — stay on the fleeing *Whydah*'s stern across three narrowing days of pursuit. Clear it and **she becomes your ship** for the rest of the campaign.
3. **Windward Passage** — the island maze. Thread the narrows; the **Kraken** rises from below in telegraphed lanes.
4. **Florida Straits** — ride the Gulf Stream, then **the fork**: hug the shore or stand out to sea. Each route plays differently the rest of the way north.
5. **Carolina Coast** — fog rolls in as a real visibility mask, and the **mooncusser's** false light tries to lure you onto the rocks at the narrows.
6. **Virginia Capes** — a squall leg, with wandering waterspouts to dodge.
7. **Long Island Sound** — the hunting ground: more ship battles, tougher privateers.
8. **Rhode Island Sound** — the Ghost Light stretch: night falls, and the **Palatine Light**, a burning ghost ship, crosses your bow.
9. **Cape Cod** — Goody Hallett's shore. Leave an offering or sail on — the choice follows you into the finale. Then the **sea serpent**.
10. **The Nor'easter** — the wolf pack, the storm that sank the real Whydah, an optional fight with the three-headed **Grandfather Serpent**, and **the Old Sow** — the real giant whirlpool off Eastport, Maine, guarding the harbor mouth.

**Between every mission but the last, you put in at port**: the run's gold banks (a death only ever costs what's been earned since the last port), and you can spend the bank on upgrades before sailing on. **A death never wipes the afternoon** — the title screen remembers the furthest mission reached and offers to resume there, and the two prologue missions (the dive and the chase) become skippable — with a small score stipend — once you've cleared them once.

## Legends and myths

Pirate history is full of stories half the crew believed. First Sail plays a lot of them straight — some as flavor cards, some as things you actually sail through:

- **The Kraken**, **the Palatine Light**, and **the Old Sow** are full encounters (missions 3, 8, and 10).
- **Goody Hallett's curse** is a real choice at Cape Cod, with a real consequence at the storm.
- **Davy Jones' Locker**, **Fiddler's Green**, **a Jonah aboard**, **the Klabautermann**, **a selkie**, **the island that swims away (Aspidochelone)**, tavern talk of **Blackbeard**, and word of **Anne Bonny and Mary Read** are all logbook cards, weighted to surface near where they belong.
- The **📖 Tales Logbook** on the title screen collects every card you've found — 69 in all, tagged **⚓ FROM THE RECORD** (real Whydah history), **🌀 SEA YARN** (the stories sailors told), or **🤯 MULTIVERSE** (insane mode only).
- Win your first career voyage and the title screen and logbook both pick up a permanent line: 1984, Barry Clifford finds the wreck.

## Whirlpools

Small whirlpools start appearing from Long Island Sound onward — a force field on top of the helm: the pull grows toward the center, and you can out-row it at the rim but not the core. **The Old Sow**, at the very end of the run, is the same physics at full screen size — the real whirlpool that guards Eastport's harbor mouth.

## Sharks — reworked

The old version put breaching sharks everywhere, and playtesters hated it. Now real sharks only show up in two places: **slow, readable patrols** during the Wreck Diver dive, and **the open-sea route** of the three "hunting ground" missions (Carolina through Long Island) — the fork warns you first, so choosing the open sea is choosing sharks. Where they do appear, the stalk telegraphs longer, you can shoot the fin before it ever leaps, and the leap itself is slower and shorter-range. Everywhere else, what used to be a shark fin is now a harmless jellyfish bloom.

## How it plays

- **Steer the whole sea.** Full 2D helm: left/right AND forward/back (arrow keys, WASD, drag, or the on-screen buttons — SPACE fires). Steering is eased — a quick tap is a small precise nudge, holding crosses at full speed, and letting go stops fast.
- **Pausable.** A ⏸ button next to the mute toggle, or Escape/P — freezes the run with a RESUME / QUIT TO TITLE panel. The tab auto-pauses when it's hidden, so a mid-class interruption never costs a run.
- **Four difficulties.** **EASY** (an extra heart, gentler seas), **HARD** (the classic tuning), **EXTREME** (tougher ships, a longer storm, a score bonus), and **🌀 INSANE** — locked until you beat EXTREME.
- **Ship battles.** Pirate hunter sloops, armed merchant brigs, a King's man-of-war, and the wolf pack before the storm.
- **Navigator games.** A sun-sight (backstaff), a depth sounding (lead line), and a speed count (log-line) — quick skill checks for points and gold.
- **Gold banks at every port**, spendable on eight upgrades: Oak Timbers, Bilge Pumps, Chain Shot, Crow's Nest, Weather Helm, Lucky Charm, Full Canvas, Long Nines. Buying Oak Timbers mid-run raises your hull cap immediately.
- **The nor'easter.** Targeted lightning, telegraphed gusts, rogue waves you brace with a well-timed tap. Beat it and the win locks in — make for port, or turn and fight the Grandfather Serpent that followed you out. Either way, the Old Sow is waiting.

## v8 — the depth pass

- **Real prologues.** The Wreck Diver is three descending dive sites (shallow wreck → gun deck → treasure hold) with eels, air pockets, falling timbers, and a graded haul. The Three-Day Chase now requires sailing: close the distance meter inside her weaving wake, survive escalating stern-chaser fire and powder kegs, and finish with a grapple flurry — do nothing and she escapes.
- **A boss for every mission.** New: THE MOONCUSSER (a false-light narrows gauntlet with a shootable shore battery), THE SHARKNADO (yes, really — telegraphed shark volleys, shoot the eye when it opens), and THE HUNTER'S FLAGSHIP (a three-phase man-of-war duel with broadside sweeps and ramming runs).
- **No more quick cuts.** Scenes crossfade; sail legs wind down — spawns stop early, leftover coins sweep to the ship, hazards fade, and a LEG CLEAR banner plays you out.
- **Merchant hails.** Mid-campaign, a trading brig may heave to: repairs, powder, weather gossip, mystery crates, and tea/spice cargo that pays double at your next port (if you live to reach it).
- **Ship liveries.** Nine unlockable paint schemes earned by feats — win a voyage, beat each boss, witness the ghost light untouched, speak the secret word. Pick yours in the Harbor.
- **A suggestion box.** The 📮 IDEAS button in the Harbor logs student suggestions (with an ✉ export for the teacher).
- **The secret word.** INSANE mode no longer unlocks by beating EXTREME — a certain word, typed on the title screen, is the only way in.
- Faster on Chromebooks (particle caps, cheaper whirlpool/sea rendering), and the multiverse traded its brainrot for the Great Meme Reset of 2026.

## INSANE mode

Beat EXTREME once and the multiverse opens up. Every run draws **two random mutators** (coins as cheese wheels, watching gulls, big head mode, everything's bouncier) and every leg spins a chaos modifier (low gravity, a speed run, a tiny ship, mirrored steering, disco seas, upside-down gulls, everything's legally a crab, sudden night). The enemy fleet stops being ships entirely — battles and squadrons roll a **Colossal Rubber Duck**, **a Belligerent Toaster**, **a Furious Snowman** (it melts as it takes damage), **the Garden Gnome Flotilla**, **a Haunted Grand Piano**, or **Crab With A Sword** — same hp and fire rate as the ship they replace, just funnier. The sea serpent becomes **the Sea Pug** (tennis-ball venom, a "BOOP!" when it lunges), and the final boss becomes **PUGNAROK, the three-headed good boy**. Ten multiverse-only logbook cards round it out. Hard/Easy/Extreme visuals are completely untouched — the chaos is opt-in.

## Controls

Arrow keys or WASD to steer in all four directions, or drag on the sea. Space (or Enter, or the fire button) to fire — hold for a rolling broadside. On event choices, tap a button or press ← / →. Escape or P pauses. 🔇 toggles sound (off by default for the classroom). Works on phones and Chromebook touchscreens.

## Notes

- Self-contained: no dependencies, no build, no network requests.
- The history behind it: Sam Bellamy took the *Whydah* in a three-day chase in February 1717, then sailed her north until a nor'easter wrecked her off Cape Cod that April. In the game you get the chance her crew never had. Barry Clifford found the wreck in 1984 — the bell still reads THE WHYDAH GALLY 1716, the first pirate ship ever proven authentic.
- v7 ("The Voyage"): rebuilt around a ten-mission campaign with a resumable, mission-scoped save, port-to-port ship upgrades, a reworked and confined shark encounter, new legend/myth event cards, whirlpools, and a full INSANE-mode comedy rebuild. July 2026.
