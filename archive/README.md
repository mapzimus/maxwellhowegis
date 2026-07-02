# Archive of unmerged branch content (2026-07-02)

This directory exists only on the tag `archive-unmerged-content-2026-07-02` — it is
NOT part of `main` and is not deployed. It preserves the unique content of six
pull requests whose head branches were deleted during the Round 6 history
cleanup (see `AUDIT.md` §2 on `main`). To revive any item, check out this tag
and copy the files onto a fresh branch off `main`.

| Path | Source PR / branch | What it is |
|---|---|---|
| `field-notes/` | #4 · `claude/laughing-ritchie-bS3Ho` | Field Notes restructure (`fieldnotes.html` → `field-notes/`) plus the full **orthodromes** article draft with inline SVG diagrams. |
| `job-search/` | #15 · `claude/gis-jobs-search-951fc` | GIS job-leads tracker from the 2026-06-01 search (fit-rated table, apply links, tailored blurbs). |
| `open-concord-pkg/` | #17 · `claude/concord-nh-datasets-BaCwS` | **Open Concord**: R package + targets pipeline + PostGIS + Shiny mega-map for Concord, NH open data (R code written but never executed — see its `HANDOVER.md`). |
| `open-concord-extras/` | #17 (same branch) | The GitHub Pages iframe page (`concord-pages-iframe/`), the repo-level `CLAUDE.md` that branch introduced, and `concord-refresh.yml` — the self-hosted-runner ETL workflow, stored HERE (not `.github/workflows/`) so it can never activate accidentally. |
| `population-tiers/` | #48 · `claude/us-pr-towns-population-tiers-f80w4k` | 1,905 US/PR/Canada municipalities ≥25k with population tiers: `towns.csv`, `towns.geojson`, reproducible `build.py`, methodology README. |
| `patches/tappymaps-embed-tools.patch` | #36 · `tappymaps-embed` | Adds a "Try it live" TappyMaps embed section to `tools.html`. Kept as a patch because Round 3 rewrote that page; re-apply by hand against current `tools.html`. |

Not archived: PR #37 (`bugwars-link-update`) — obsolete; the dead `bugwars/`
links it fixed no longer exist after the games-suite restructure on `main`.
