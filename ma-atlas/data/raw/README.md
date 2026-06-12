# Raw civic-data drop zone (T4)

These civic metrics come from MA agencies that **block automated fetching**
(mass.gov returns 403; the data lives behind interactive dashboards / Excel
downloads). So the flow is split: **you download the file by hand into this folder**,
then the repo's scripts parse → aggregate → register it like any other metric.

Files you drop here are **git-ignored** (only the derived `data/ma_muni_*.json` and
`data/ma_district_*.json` get committed). Excel parsing needs `pip install openpyxl pandas`.

## The three-step workflow (per source)

```bash
# 1) parse the downloaded file into a town-keyed muni side file
python scripts/parse_civic.py --file data/raw/<file> \
    --town-col "<town column>" --value-col "<value column>" \
    --metric-id <metric_id> --agg <first|sum|count|max> [--zero-fill]
#    (if the column names are wrong, it prints the columns it DID find)

# 2) roll the muni metric up to academic districts
python scripts/aggregate_civic_to_districts.py --metric-id <metric_id> --agg <sum|mean>

# 3) tell me the metric_id + label + whether higher=good, and I register it in
#    app.js (SOURCES + load array + METRICS) and coverage-gate it with the gap tool.
```

## Sources to download

### 1. Prop 2½ overrides — the MA gem (DLS Municipal Databank)
- Page: mass.gov → "Division of Local Services Municipal Databank" → Proposition 2½
  Overrides/Underrides/Exclusions open files (or the "Override/Underride" export).
- Save as: `data/raw/overrides.xlsx`
- Likely columns: `Municipality`, `Fiscal Year`, `Type`, `Amount`, `Result` (Pass/Fail).
- Suggested metric: count of **passed** overrides per town across all years →
  `--metric-id override_count --agg count --zero-fill` (a town that never passed one
  is a real 0). Or override $ per capita with `--agg sum` then divide by population.

### 2. Voter turnout (Secretary of the Commonwealth)
- Page: electionstats.state.ma.us (or sec.state.ma.us/elections) → a recent **statewide
  general election** → town-level results with registered voters + ballots cast.
- Save as: `data/raw/turnout.csv`
- Likely columns: `City/Town`, `Registered Voters`, `Total Ballots Cast`.
- Metric: turnout %. Parse both columns to two muni files (or compute the ratio in a
  quick edit), e.g. `--value-col "Total Ballots Cast" --metric-id ballots_cast` and
  `--value-col "Registered Voters" --metric-id registered_voters`, then I derive the %.

### 3. Library circulation per capita (MBLC)
- Page: mblc.state.ma.us → Library Data → ARIS (Annual Report Information Survey) public
  data → per-library circulation + population of legal service area.
- Save as: `data/raw/library.csv`
- Note: a town can have multiple library branches — use `--agg sum` to total circulation
  per town, then divide by population for per-capita.

## The 80% rule still applies
After step 2, run `python -m scripts.analysis.gap_audit --emit-all` — if the new metric
shows up as a `COVERAGE_GAP` it didn't clear 80% of districts (zeros count as filled), and
we either fix the town-name matching or drop it.
