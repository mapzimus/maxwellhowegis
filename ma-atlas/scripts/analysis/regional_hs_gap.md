# Scope: Six missing regional high-school districts

**Status: RESOLVED (2026-06-02).** All six are now in `ma_academic_districts.geojson`
(280 districts total) with full baked metrics, and every district side-join file
has backfilled them. ACS was refreshed from the Census API in the same pass.

**Original status:** Root-caused. Fix is **upstream** in the `lehs-data-dive` pipeline (out of this repo's reach); this repo's fetchers will backfill automatically once the geojson includes them.

## Resolution (2026-06-02)

Root cause confirmed: `build_ma_academic_districts()` in
`lehs-data-dive/scripts/11_build_lynn_geo.py` assigns each town to its single
*dominant* district (most public schools) and dissolves by that code. A regional
*secondary* (7-12 / 9-12) district shares every member town with that town's K-8
district, which has more schools — so it wins no town and gets no polygon. (K-12
regionals like Nashoba survive because their towns have no separate elementary
district.)

Fixes: (1) upstream builder now appends these via `REGIONAL_SECONDARY_MEMBERS`
(member-town union); (2) the six were materialised into the geojson without a
full e2c re-download by fetching only their rows from DESE Socrata and running
the real metric builder (verified against a baked control district); (3) the
nine `aggregate_acs*_to_districts.py` got the six member-town lists so ACS rolls
up; (4) all district fetch/aggregate scripts were re-run; (5) `audit_data.py`
§15 now reports all six PRESENT. Northboro-Southboro carries a `dist_display`
alias of "Northboro-Southboro (Algonquin)" so both names are searchable.

Correct DESE codes (an earlier hand-off had four wrong — 07350000/06650000/
07120000/07250000 belong to North Middlesex/Freetown-Lakeville/Monomoy/Nashoba):
Concord-Carlisle 06400000 · Lincoln-Sudbury 06950000 · Nauset 06600000 ·
King Philip 06900000 · Masconomet 07050000 · Northboro-Southboro 07300000.

## The gap

Six well-known MA regional high-school districts (~9,500 students combined) are absent from `data/ma_academic_districts.geojson` and therefore from **every** side-join file and the live map. Their member towns appear as K–8 *sending* districts, so the high-school-only metrics (MCAS Gr10, graduation, AP, per-pupil) for these communities are simply missing.

All six are confirmed present in DESE's own data — I queried the SODA grad-rate dataset (`educationtocareer.data.mass.gov`, `n2xa-p822`, SY2025) and got back live records:

| District | DESE `org_code` | SY2025 4-yr grad | Member towns | Grades |
|---|---|---|---|---|
| Concord-Carlisle | `06400000` | 0.968 | Concord, Carlisle | 9–12 |
| Lincoln-Sudbury | `06950000` | 0.980 | Lincoln, Sudbury | 9–12 |
| Nauset | `06600000` | 0.961 | Eastham, Orleans, Wellfleet, Brewster | 7–12 |
| King Philip | `06900000` | 0.953 | Norfolk, Wrentham, Plainville | 7–12 |
| Masconomet | `07050000` | 0.969 | Boxford, Topsfield, Middleton | 7–12 |
| Northboro-Southboro (Algonquin) | `07300000` | 0.977 | Northborough, Southborough | 9–12 |

(These are the **regional district** org codes, distinct from the member-town K–8 codes already in the atlas. The names above are DESE's exact `org_name` strings.)

## Root cause

The district universe is defined by **`ma_academic_districts.geojson`**, which is built by the companion pipeline **[`lehs-data-dive`](https://github.com/mapzimus/lehs-data-dive)** (per README). Every side-file fetcher in `scripts/` then **intersects** DESE data against that geojson's code set — e.g. `scripts/fetch_grad_detail.py:78`:

```python
ours = {f["properties"]["DIST_CODE"] for f in
        json.loads(DISTS.read_text())["features"]}
# ... only rows whose org_code is in `ours` are kept
```

So DESE *does* publish these six districts, but because their codes aren't in the geojson, the fetchers drop them from every side file. The audit confirmed this: "no orphan codes in any side file" — i.e. side files are strictly a subset of the geojson's 274 codes. The omission therefore originates **once**, in the geojson builder, and propagates everywhere downstream.

Most likely the `lehs-data-dive` builder filters the DESE district directory on something like *"operates an elementary grade"* or *"is a single-town district,"* which excludes pure 7–12 / 9–12 regional districts.

## Fix (where it has to happen)

1. **In `lehs-data-dive`** (the geojson builder): add the six `org_code`s above to the inclusion list, and supply each one a **geometry** — the dissolved union of its member towns' polygons (member towns listed above), or the school-site footprint. Pull base properties (enrollment, demographics) from the same DESE profile feeds the builder already uses.
2. **In this repo:** nothing structural — once the six rows exist in `ma_academic_districts.geojson` with correct `DIST_CODE`s, re-running the fetchers backfills all their side metrics automatically:
   ```bash
   python scripts/refresh_all.py     # or the individual fetch_*.py / aggregate_*.py
   ```
3. **Verify** afterward with the audit script:
   ```bash
   python scripts/analysis/audit_data.py   # the regional-HS check should report 0 missing
   ```

## Why it's worth doing

These are six of the highest-performing districts in the state (grad rates 0.95–0.98). Their absence biases the map's high-end: affluent regional-HS communities look like data holes precisely where outcomes are strongest, and any statewide distribution or correlation silently excludes ~9,500 students at the top of the achievement range.

## Caveat

I confirmed the codes and grad rates by live SODA query, but I **cannot reach `lehs-data-dive` from this session** (scope is limited to `ma-education-atlas`). The geometry-construction step (dissolving member-town polygons) lives there and needs to be done in that repo.
