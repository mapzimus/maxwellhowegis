# AGENTS.md — working in the MA Education Atlas

This repo is a plain static MapLibre site (no build step). Most work is **adding a
metric**: pull a public dataset → write a side-join JSON → register it in `app.js`.
Many agents work this repo **at once** via git worktrees, so the rules below exist
to keep concurrent PRs conflict-free.

---

## The add-a-metric recipe

A metric flows through four places. The first two are **yours alone** (new files,
zero collision); the last two are **shared** and governed by the anchor protocol.

1. **Fetcher** — `scripts/fetch_<theme>.py`. Pulls from a public source and writes a
   side file keyed by 8-digit `DIST_CODE`. Copy an existing fetcher as your template;
   `scripts/fetch_finance.py` and `scripts/fetch_discipline_detail.py` are good models.
   Conventions every fetcher follows:
   - Source is MA DESE open data on Socrata: domain `educationtocareer.data.mass.gov`,
     `/resource/<dataset>.json` with `$select`/`$where`/`$limit` params.
   - `norm(code) = str(code).zfill(8)` — DESE drops leading zeros; the atlas uses
     zero-padded 8-char codes.
   - Restrict to the atlas universe: only keep codes present in
     `data/ma_academic_districts.geojson` (`DIST_CODE`). Drop the `00000000` state row.
   - Store **`null`, never `0`,** for suppressed/missing values (a `0` poisons
     choroputs and ranks — see `scripts/analysis/data_anomalies.md` Bug 2/5/8).
   - Output `data/ma_district_<theme>.json` as `{ DIST_CODE: { col: value, ... } }`,
     dropping districts that got nothing. Print a per-column coverage count at the end.
   - Top-of-file docstring: name the dataset id(s), the school year, the columns, and
     any suppression/coverage caveats.

2. **Data file** — `data/ma_district_<theme>.json`, produced by step 1. Commit it.

3. **Register + load the file** (shared file `app.js` — two anchored one-line edits, so
   concurrent PRs never collide):
   a. **Path** — add `myKey: "data/ma_district_<theme>.json",` under your session's
      `// ── Sx:<slug> ──` anchor in the `SOURCES` map near the top.
   b. **Load** — add `"myKey",` under your `// ── load:Sx:<slug> ──` anchor in the
      `EXTRA_DISTRICT_SOURCES` array (just before `computeDerivedMetrics`). That list is
      fetched + merged onto districts generically — do **not** touch the positional
      `Promise.all`/destructuring. (See S6 for a worked example.)
   Never edit another session's anchor line.

4. **Add the metric(s)** (shared file `app.js`, `METRICS` array): append your
   `{ id, label, cat, levels, palette, format }` objects **under your session's anchor**
   in the METRICS slot block. Field vocabulary:
   - `id` — must match the column name in your data file.
   - `cat` — the category heading in the picker. Reuse an existing one or introduce a
     new one your brief names.
   - `levels` — `["district"]` for district-only; `["district","muni"]` only if you
     also bake the column onto town features (see `scripts/bake_muni_extras.py`).
   - `palette` — a ColorBrewer name from `PALETTES`. Convention: positive-outcome
     metrics use a sequential ramp where dark = good (`GnBu`, `Greens`); "lower is
     better" metrics use `Reds`/`OrRd` (dark = worse); diverging-around-zero uses `RdBu`.
   - `format` — `"pct"` (0–1 → shown as %), `"num"` (raw), or `"usd"`.

**Computed (not fetched) metrics** (e.g. trends, equity gaps, diversity index) skip
steps 1–2 and are derived in `computeDerivedMetrics()` in `app.js` from existing
year-keyed/base columns. Only the session that owns that function may edit it.

---

## Parallel-session protocol

**Branch.** Always branch off `origin/main` into a fresh worktree:
```
git fetch origin
git worktree add ../wt-<slug> -b feat/<slug> origin/main
```

**Anchors.** `app.js` has labeled slots (`// ── Sx:<slug> ──`) in both the `DATA`
map and the `METRICS` array. Insert **only under your own anchor**. Because each
session writes a different line range, git auto-merges all the PRs.

**Single-owner shared spots** (do not touch unless they're yours):
| Spot | Owner |
|---|---|
| `computeDerivedMetrics()` | **S9 (Trends)** |
| `KNOWN_GROUPS` + group-column resolver (`__<grp>` suffix logic) | **S10 (Gender)** |

**Stage explicit paths — never `git add -A`.** Other worktrees may have live edits in
the shared tree. Stage exactly your files:
```
git add scripts/fetch_<theme>.py data/ma_district_<theme>.json app.js plans/SESSION-Sx.md
```

**One session = one branch = one PR.** Keep your brief's scope; don't fix unrelated
things in the same PR (flag them separately).

---

## Verify before you open the PR

1. **Syntax:** `node --check app.js` (must pass — a stray comma in METRICS breaks the app).
2. **Render:** serve the folder (`python -m http.server 8000`) and load it; switch to
   your new category, confirm the choropleth paints and the legend/tooltip read right.
   Check the browser console for errors.
3. **Coverage sanity:** your fetcher's printed coverage count should match expectations
   (e.g. ~211 for HS-only metrics, ~274 for all-district). Note suppression in the PR.
4. **No `0`-for-null artifacts.** Spot-check a tiny district (Gosnold `01090000`) and a
   small subgroup didn't get stored as `0`.

---

## Finding & filling data gaps

The **`scripts/analysis/gap_audit`** package is the one tool for finding, triaging, and
fixing data gaps. It supersedes the old `audit_data.py` / `audit_coverage.py` /
`audit_quality.py` scripts (retired). Run:

```
python -m scripts.analysis.gap_audit --emit-all
```

This sweeps every entity layer (district, muni, school, colleges, private, childcare),
reconciles findings against a persistent registry, and writes:

- **`scripts/analysis/gaps.md`** — the ranked **fix worklist**. Every open row names what's
  wrong, the **upstream source**, and the exact **refill command** (e.g.
  `python scripts/fetch_support_staff.py`). This is where you go to fill gaps.
- **`scripts/analysis/registry.jsonl`** — per-finding memory. Each finding has a stable
  fingerprint and a status: `open → investigating → benign | wontfix | fixed`. To triage,
  edit a finding's `status`/`reason`/`note` — the decision is **sticky** across runs, so a
  finding you mark `benign` never nags again. `fixed` is auto-detected when a finding stops
  being raised; it auto-reopens if it returns.
- **`scripts/analysis/gap_audit/provenance_manifest.json`** — metric → source + refill map,
  auto-built from fetch-script docstrings + `plans/DATASETS-LEDGER.md`. Add aggregate/
  multi-output overrides in `gap_audit/provenance/overrides.yml`.

The fill loop: read `gaps.md` → run a row's refill command → re-run `--emit-all` → the
finding moves to **Resolved this run**. Un-fillable gaps (e.g. VOCAL, state-only) are
auto-set to `wontfix` from the datasets ledger and stay out of the worklist.

CI (`.github/workflows/gap-audit.yml`) runs the sweep and **fails on any NEW high-severity
or invariant finding** since the last commit, so a data refresh can't silently introduce a
gap. Tests live in `gap_audit/tests/` (`python -m pytest scripts/analysis/gap_audit/tests`).

---

## Merge & deploy cadence

`main` **auto-deploys to the live Pages site on merge** (SSH deploy key). So:
- Merge PRs **one at a time**, rebasing each on the latest `main` first.
- With anchors, rebases are clean. Resolve the rare `DATA`/`METRICS` adjacency conflict
  by keeping both blocks.
- Stagger the **S9** and **S10** merges (the two real-shared-logic PRs) so they review
  cleanly.
