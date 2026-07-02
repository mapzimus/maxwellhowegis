# Games Suite

A landing page linking the standalone browser games — real-time strategy,
navigation, geography, and party physics, each installable-free and
running fully client-side. Live entries: **Bug Wars** (`/bugwars/`, an
Age-of-Empires-style RTS commanding an ant or bee colony), **Whydah:
First Sail** (`/whydah/navigator/`, plotting Black Sam Bellamy's 1717
voyage from the Caribbean to Maine), **Flip Game**
([mapzimus.github.io/flipgame](https://mapzimus.github.io/flipgame/), a
bottle-flip party game and installable PWA), and **TappyMaps**
([tappymaps.com](https://tappymaps.com), a tap-to-color US state/county
map designer with built-in geography games). The page itself is a single
`index.html` — a `GAMES` array of cards (title, category, description,
icon, live/external status, stack pills) rendered into the grid, matching
the portfolio's shared nav/CSS tokens.

**Data sources:** none — this is a static links page. Bug Wars is a same-site
git submodule (`/bugwars/`, from `mapzimus/bug-wars`); the Whydah navigator
is a same-site plain directory (`/whydah/navigator/`); Flip Game and
TappyMaps are externally hosted and linked out to.
