# SESSION S13 — School climate & safety

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/climate-safety`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S13:climate-safety ──`.

## The gap
The atlas has discipline *rates* but no **climate or safety** lens — a distinct, very
relatable angle ("is this a safe, supportive school?") that's entirely absent.

## ⚠️ Spike first (≤45 min) — this is multi-source and the highest-uncertainty session
Confirm which of these have a queryable, district-level source before building. Ship
what's real; document the rest as "no accessible district-level source." Do not fake.
- **VOCAL** (Views of Climate and Learning) student survey — DESE. May be school-level
  only; check whether district roll-ups are published.
- **Bullying / harassment incidents** — DESE Student Safety / SSDR.
- **Restraint & seclusion** — DESE physical-restraint report.
- **School-based arrests / referrals to law enforcement** — federal CRDC (US DOE Office
  for Civil Rights), a non-DESE source with its own cadence and codes.

## What to build (proposed — keep only the sourced ones)
| id | label | cat | levels | palette | format |
|---|---|---|---|---|---|
| `vocal_safety_index` | School Climate — Safety (VOCAL) | School climate | `["district"]` | `GnBu` | `num` |
| `bullying_per_100` | Bullying/Harassment Incidents per 100 | School climate | `["district"]` | `OrRd` | `num` |
| `restraint_per_100` | Physical Restraints per 100 Students | School climate | `["district"]` | `OrRd` | `num` |
| `law_referral_per_100` | Referrals to Law Enforcement per 100 (CRDC) | School climate | `["district"]` | `OrRd` | `num` |

## Files you create
- `scripts/fetch_climate_safety.py` → `data/ma_district_climate_safety.json`
- (CRDC may warrant its own `scripts/fetch_crdc.py` if the source/cadence differs.)

## Source
DESE (VOCAL, restraint, SSDR) on `educationtocareer.data.mass.gov`; CRDC from the
federal OCR data site. Templates: any existing discipline fetcher
(`fetch_discipline_detail.py`) for the DESE-side shape.

## Steps
1. Spike all four; decide the shippable subset and note coverage/cadence.
2. Write fetcher(s); rates per-100; `null` for suppressed/unreported.
3. Register path(s) + metrics under `// ── S13:climate-safety ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- Every shipped metric is sourced and dated; suppression handled as `null`.
- New "School climate" category reads clearly; CRDC metrics flagged with their year
  (CRDC lags several years behind DESE).

## Risk: High. Multi-source, partial coverage. The spike decides scope — that's expected.
