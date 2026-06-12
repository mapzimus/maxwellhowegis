# SESSION S12 — School-choice landscape ("where else do kids go")

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/school-choice-landscape`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S12:school-choice-landscape ──`.

## The gap
**Enrollment flow** is outflow-only (`school_choice_out_pct`, `charter_out_pct`,
`enrollment_out_pct`). The receiving side and the non-public landscape are missing, so
you can't see which districts *gain* students or how many families opt out of public
school entirely.

## What to build (proposed — confirm at source)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `choice_in_pct` | % Enrollment Received via School Choice | Enrollment flow | `["district"]` | `GnBu` | `pct` |
| `choice_net_pct` | Net School Choice (in − out) | Enrollment flow | `["district"]` | `RdBu` | `pct` |
| `private_school_pct` | % of School-Age in Private/Parochial | Enrollment flow | `["district","muni"]` | `Purples` | `pct` |
| `homeschool_pct` | % Homeschooled | Enrollment flow | `["district"]` | `Oranges` | `pct` |

`choice_net_pct` is diverging (`RdBu`): blue = net receiver, red = net loser — a great
relatable map.

## Note — a fetcher for this was started before
There's an orphan `scripts/__pycache__/fetch_private_schools.cpython-313.pyc` with no
surviving `.py` source — a private-schools fetcher was written and run once, then lost.
That means a workable source probably exists. Don't try to decompile the `.pyc`; just
re-find the source (DESE private school enrollment report) and rewrite cleanly.

## Files you create
- `scripts/fetch_choice_inflow.py` → `data/ma_district_choice_inflow.json`
- `scripts/fetch_private_schools.py` → `data/ma_private_schools.json` (revive)

## Source
- Choice inflow / charter inflow: DESE School Choice + charter enrollment reports on
  `educationtocareer.data.mass.gov`. `scripts/fetch_school_choice.py` (outflow) is your
  template — the inflow columns are siblings.
- Private/parochial: DESE non-public / private school enrollment report (by town).
- Homeschool: DESE homeschool counts if published (may be sparse — document if not).

## Steps
1. Copy `scripts/fetch_school_choice.py`; add inflow + net.
2. Rebuild the private-schools fetcher (by town → map to district/muni); `null` where none.
3. Register paths + metrics under `// ── S12:school-choice-landscape ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- Inflow + net-choice paint; net is diverging around 0.
- Private-school share paints at muni level (and district if cleanly aggregable).

## Risk: Med. Inflow is low-risk (sibling of existing outflow); private/homeschool vary.
