# Repository Audit & Improvement Plan

**Audited:** 2026-07-02 · **Scope:** this repository (`mapzimus/maxwellhowegis`) only.
The four submodule repos (`geopuesto`, `bug-wars`, `true-scale`, `quabbin`) were not audited and are good candidates for their own audit sessions.

Snapshot at audit time: working tree **211 MB**, git pack **~169 MB**, 34 HTML pages, ~150 PNGs, 29 GeoJSON files. Each item below is a checkbox so this file can double as a punch list; items are grouped by theme and roughly ordered by value within each group.

---

## 1. Broken things (fix first)

- [x] **`index.html` is corrupted: 1,103 NUL (`\0`) bytes after `</html>`, and it's the only page with CRLF line endings.** Verified byte-for-byte. Browsers tolerate it, but grep/tooling treat the homepage as binary and it's served as-is. Truncate at `</html>`, re-save as UTF-8/LF, and add a `.gitattributes` with `*.html text eol=lf` to prevent recurrence. *(~5 min)*
- [x] **`concord.html` `og:image` points to `images/projects/open-concord-thumb.png`, which doesn't exist** — only the `.svg` exists, and OG images generally must be raster anyway. Export a PNG thumb and fix the path. *(~10 min)*
- [ ] **17 image references point into the `quabbin/` submodule** (`quabbin/output/*.png/.gif` in `gallery.html`, `quabbin.html`, plus quabbin's `og:image`). The Pages workflow does check out submodules, so prod likely works, but the site is broken for any plain clone and correctness is pinned to the submodule commit. Verify the pinned commit actually contains those paths, or vendor the ~17 display images into `images/`. *(~30 min)*

## 2. Repo weight (~211 MB → ~100 MB possible)

- [ ] **Delete ~80 orphaned images (~74 MB, ~44% of `images/`).** Referenced by no HTML/JS/CSS: the 19 MB `images/projects/granite-state/image2.png`, all `ev-research/Slide1–17.PNG`, `granite-state/Screenshot 2025-*.png` and `image1/6/7/8…`, `central-campus/Screenshot*.png`, `evacuation/Screenshot*.png`, plus `nsn-banner.png`, `cakemapper-preview.png`, `ideaboard-preview.png`, `bugwars-preview.jpg`, `change-analysis.png`, `gallery/1.png`, and more. Re-run a reference scan before deleting each. *(~1 hr, biggest single win)*
- [x] **Recompress the in-use heavyweights (~10–14 MB savings):** `images/projects/lynnfield/CemMap.png` (11.5 MB → ~1 MB at display size), `images/nsn-logo.png` (2 MB for a logo), `images/gallery/q3.png` (2.2 MB), and the camera-roll-named screenshots (`Screenshot 2025-05-30 114936.png`, 3.3 MB). Downscale to display resolution; consider WebP. Rename screenshots to meaningful names while at it. *(~1 hr)*
- [x] **`Lynn-data-dive/maps/data/` duplicates `ma-atlas/data/` at 4–5× the size (~13 MB).** e.g. `ma_municipalities.geojson` is 5.1 MB pretty-printed there vs 1.2 MB minified in ma-atlas. Point Lynn at the ma-atlas copies or replace with minified/simplified versions (~7–8 MB saved). Note: README documents these as vendored via a manual PowerShell sync from another repo — decide on one canonical copy. *(~30 min)*
- [x] **`whydah/navigator/vendor/three.module.js` is the full 1.27 MB un-minified Three.js dev build.** Swap for the minified build or a pinned CDN import. *(~15 min)*
- [ ] **After the deletions above, rewrite history to actually shrink clones.** The pack (~169 MB) is as big as the tree, and e.g. `transit/data/towns.geojson` (3.7 MB) is committed 3×. `git filter-repo` (or BFG) to purge deleted large blobs, then force-push. Estimated clone-size reduction: 60–90 MB. **Do this last, deliberately — it rewrites history for anyone with a clone.** *(~1 hr, coordinate first)*
- [ ] Small cleanups: `whydah/navigator/server.py` + `start-game.bat` are local dev helpers published to the live site (move/ignore); `salem-photo-walk/data/*.geojson` is orphaned — the page inlines all its data — so either fetch it at runtime or delete the dir; audit `whydah/pics/` (3.7 MB) for unreferenced images.

## 3. Performance of the map apps

- [ ] **ma-atlas: flatten the three-wave fetch waterfall.** `ma-atlas/app.js:2821` fires 53 fetches, a second `Promise.all` of ~15 more only starts at `:3009` after the first fully resolves, then a third await at `:3021`. Merge into one `Promise.allSettled`, or better: lazy-load the ~48 small attribute JSONs per metric group on first selection. *(~2 hr)*
- [ ] **ma-atlas: simplify the eager polygon payloads.** `data/ma_academic_districts.geojson` (3.9 MB) + `ma_municipalities.geojson` (1.2 MB) load on first paint. Run through mapshaper (topology-preserving simplify + `precision=0.00001`) — typically 50–70% smaller with no visible change. Longer-term: PMTiles (you already built pockettiles for exactly this). *(~1 hr)*
- [ ] **transit: don't eagerly download 6.6 MB of reference-only geometry.** `transit/index.html:846` unconditionally loads `towns.geojson` (3.7 MB) + `tier4_links.geojson` (2.9 MB) at startup. Gate each behind its existing layer toggle (fetch on first enable). Also consider a compact coordinate-array format for tier4_links instead of full GeoJSON. *(~1 hr)*
- [x] **appalachians: `data/appalachian_trail.geojson` stores ~13-decimal coordinates** (nanometer precision). Round to 5–6 decimals (~halves the 389 KB file). *(~10 min)*
- [ ] **transit: `network.json` is fetched with `cache:'no-store'` every visit (703 KB) and can clobber local edits** — `transit/index.html:830,840-843` replaces the localStorage-persisted network with the committed one, toasting only after the fact. Compare versions/timestamps before overwriting, or prompt; drop `no-store` in favor of a version query param. *(~45 min)*
- [x] **transit: debounce the town search.** `transit/index.html:742` runs an unthrottled linear scan of 19,465 towns per keystroke. Copy the ~120 ms debounce pattern already in `appalachians/index.html:485`. *(~15 min)*

## 4. Security & hardening

- [ ] **Add SRI hashes to all CDN `<script>`/`<link>` tags — currently zero across all four map apps** (`appalachians/index.html:219`, `transit/index.html:10`, `ma-atlas/index.html:1076`, `interstate-challenge/index.html:119`). Versions are already pinned, so `integrity="sha384-…"` + `crossorigin="anonymous"` is a one-time addition. Standardize on one CDN (jsdelivr) while at it. *(~30 min)*
- [ ] **Nominatim usage policy:** appalachians (`index.html:492`) and transit (`index.html:604`) call `nominatim.openstreetmap.org` directly from the browser. Requests are debounced/on-demand (OK), but attribution/identification is thin — add a documented referer expectation, keep rates ≤1 req/s, or proxy through a keyed geocoder if traffic grows.
- [ ] Optional: pin GitHub Actions to commit SHAs instead of `@v4`-style tags (first-party actions, low risk — hardening only).
- [x] ~~Secrets scan~~ — **clean.** No API keys/tokens anywhere; `pockettiles/config.js` ships empty Supabase config with a correct "anon key is safe" note; the only exposed email is intentional (Nominatim UA in `scripts/build_interstate_data.py:45` — the policy asks for contact info, so fine as-is).

## 5. Maintainability

- [ ] **Nav/footer are hand-duplicated across all 15 top-level pages and have already drifted.** Nav order differs on `gallery.html`/`side-projects.html`; footer link counts range 4–11 across pages (~500 duplicated lines total). Since `js/main.js` already loads on every page, inject shared nav/footer partials from JS (or adopt a minimal build step). This single change prevents the whole class of drift. *(~2 hr)*
- [ ] **`gallery.html` (145 KB, 2,095 lines) hand-codes 119 gallery bricks.** No base64 — pure repeated markup. Drive it from a JS data array the way `portfolio.html` uses `js/projects.js` (~10× smaller, no more copy-paste). Images already lazy-load (good). *(~2 hr)*
- [ ] **`ma-atlas/app.js` is an 11,020-line / 660 KB monolith.** Split into ES modules along its natural seams (data loading, classification/palette, layers, UI, export studio) via `<script type="module">`; lazy-import the export studio. *(~4+ hr, do incrementally)*
- [ ] **Factor a shared `js/mapkit.js`.** CARTO basemap configs, `toast()`, retrying `fetchJSON`, and Nominatim helpers are re-implemented in appalachians (`:253,302,491,509`), transit (`:234,394,604`), and interstate-challenge (`:143`). ma-atlas already imports shared `../js/main.js`, so the pattern exists. *(~2 hr)*
- [ ] **Move `nsn.html`'s 255-line inline `<style>` block** (lines 12–266 — the only page with page-specific inline CSS) into a stylesheet; fold the scattered inline `style=` attributes (concord 70, about 23, mapzimus 16…) into shared classes over time.
- [ ] **`nsn.html` hotlinks 37 `i.ebayimg.com` images + 40 eBay listing links** that expire when listings end — the page will silently rot. Mirror images locally or add graceful fallbacks.
- [ ] Spot-check `js/main.js` for console errors on the 13 pages that lack the modal markup it wires up.

## 6. SEO, meta & accessibility

- [ ] **Add a default `og:image` + `twitter:card` site-wide.** The homepage — the most-shared URL — has `og:title`/`og:description` but no image; 9 of 15 pages have no `og:*` at all; no Twitter cards anywhere. Best done as part of the shared-partial work in §5. *(~1 hr)*
- [ ] **Add `robots.txt`, `sitemap.xml` (15 static URLs), and per-page canonical tags** — currently none of the three exist. *(~30 min)*
- [x] **Favicon fallbacks:** SVG-only today; add a 32×32 `favicon.ico` and a 180×180 `apple-touch-icon`. *(~15 min)*
- [x] **`about.html` heading order skips a level** (`h1 → h3…` with no `h2`) — breaks the screen-reader outline. Other pages are clean; every page has exactly one `h1` and viewport meta (good). Verify the two `alt=""` images in `lynn.html`/`quabbin.html` are truly decorative. Alt coverage is otherwise excellent (119/119 gallery, 38/38 nsn).

## 7. Docs & housekeeping

- [ ] **Rewrite `DEPLOY.md` — it documents the wrong deploy mode.** It says "Deploy from a branch → main /root," but the site actually deploys via the `pages.yml` Actions workflow (mutually exclusive Pages modes). Its file-structure listing also names images that don't exist and omits submodules entirely. Update or fold into README. *(~30 min)*
- [x] **Add a root `LICENSE`** — the repo defaults to all-rights-reserved (ma-atlas carries its own; the root has none). MIT or CC-BY is typical for a portfolio.
- [x] **Expand `.gitignore`** beyond `scripts/.cache/`: `.DS_Store`, `Thumbs.db`, `__pycache__/`, `*.pyc`, `.venv/`, editor dirs.
- [x] **`scripts/requirements.txt` pins only `requests>=2.31`** while three screenshot scripts import `playwright` (undeclared). Add it and pin exact versions. Also fix `scripts/capture_thumbs.py`, which hardcodes `D:\maxwellhowegis\…` — derive from `__file__` like `screenshot_atlas.py` does.
- [ ] **Add short READMEs to `salem-photo-walk/`, `Lynn-data-dive/`, and `games/`** (purpose, data sources, how to run). The four map apps, pockettiles, and whydah/navigator already have good ones.
- [ ] **Bump stale submodule pins:** `bugwars` and `truescale` haven't been updated since the initial submodule conversion (2026-06-12), unlike geopuesto/quabbin. Check upstream and `git submodule update --remote` if there's anything new.
- [ ] **Add `.nojekyll`** at root (cheap insurance if the deploy mode ever changes) and note in README that `keep-streamlit-awake.yml`'s cron gets auto-disabled by GitHub after 60 days without commits — a gotcha on a quiet repo.
- [ ] Consider automating (or CI-checking) the manual PowerShell sync that vendors `ma-atlas/` and `Lynn-data-dive/maps/` from another repo — currently nothing guarantees parity.

---

## What's already in good shape

- **No leaked secrets anywhere** — scripts, JS, configs, and workflows are clean.
- **Both GitHub workflows are sound:** correct Pages permissions/concurrency, current action versions, `submodules: recursive` (so submodule content does publish), and the Streamlit keep-alive has real error handling.
- **`interstate-challenge/` is the model app** — small, single-file, proper `Promise.all` with `!r.ok` throws, loading state, tiny data files. Use it as the template when refactoring the others.
- **Library hygiene:** MapLibre pinned to 4.7.1 in three apps, Leaflet to 1.9.4; all four map-app READMEs are substantive (ma-atlas and transit especially).
- **Accessibility basics:** viewport meta on all pages, one `h1` per page, near-perfect alt-text coverage, lazy-loaded gallery images.
- **`pockettiles/`** demonstrates exactly the client-side PMTiles pipeline that could later solve the ma-atlas/transit payload problems.

## Suggested sequencing

1. **Quick wins (one sitting):** §1 all three; trail precision; transit debounce; `.gitignore`; `.nojekyll`; favicon fallbacks; three.js minified swap.
2. **Weight purge:** orphan-image deletion + recompression + Lynn geojson dedupe → then the history rewrite as a single deliberate step.
3. **Shared partials refactor** (nav/footer/head), which unlocks the OG/canonical/SEO items almost for free.
4. **App performance passes:** ma-atlas fetch/simplification first (biggest payload), then transit lazy layers.
5. **Ongoing:** ma-atlas modularization, shared mapkit.js, gallery data-driving.
