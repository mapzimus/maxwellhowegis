# SESSION S11 — Funding / revenue side of finance

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/funding-revenue`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S11:funding-revenue ──`.

## The gap
All 15 **Finance** metrics are expenditure-side. The revenue/equity story — the
Student Opportunity Act narrative of who pays and who gets state help — is missing.

## ⚠️ Source reality (read `scripts/fetch_finance.py` docstring)
The existing finance fetcher explicitly notes **Chapter 70 state aid is NOT a queryable
Socrata table** — it's a `type=href` link to DESE spreadsheets. So the headline metric
here likely requires downloading and parsing a DESE Chapter 70 / Schedule A spreadsheet
(xlsx/csv), not a SODA query. Equalized valuation (EQV) comes from MA DLS, a different
source. Budget the first 30–45 min to confirm formats and pick the shippable subset.

## What to build (proposed — confirm sources)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `chapter70_per_pupil` | Chapter 70 State Aid per Pupil | Finance | `["district"]` | `Viridis` | `usd` |
| `required_local_contribution` | Required Local Contribution | Finance | `["district"]` | `Viridis` | `usd` |
| `local_share_pct` | % of Foundation Funded Locally | Finance | `["district"]` | `PuOr` | `pct` |
| `eqv_per_pupil` | Equalized Property Value per Pupil | Finance | `["district"]` | `Viridis` | `usd` |

`local_share_pct` (and its state-share complement) is the cleanest "wealth vs aid"
signal and pairs beautifully with the existing `nss_pct_of_foundation`.

## Files you create
- `scripts/fetch_finance_revenue.py`
- `data/ma_district_finance_revenue.json`

## Source
- Chapter 70 / Required Local Contribution: DESE Chapter 70 program spreadsheets
  (download + parse). `required_nss` already in-repo is a related proxy.
- EQV per pupil: MA Dept. of Local Services (DLS) equalized valuation + DESE FTE pupils
  (`enrollment_fte` is already fetched in `data/ma_district_finance.json` but unsurfaced —
  reuse it as the denominator).

## Steps
1. Spike the Ch.70 + EQV source formats; decide the shippable subset.
2. Write the fetcher (may need `openpyxl`/`csv` parsing rather than SODA). Keep raw
   dollars; store `null` for missing. Reuse `enrollment_fte` for per-pupil denominators.
3. Register path + metrics under `// ── S11:funding-revenue ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- ≥2 revenue-side metrics paint with correct `usd`/`pct` formatting and cited sources.
- Any metric that couldn't be sourced is documented in the PR, not faked.

## Risk: Med-High. Primary source is spreadsheets, not Socrata. Spike before committing.
