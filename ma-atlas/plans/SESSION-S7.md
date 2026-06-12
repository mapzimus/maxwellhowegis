# SESSION S7 — Subgroup & outcomes completeness

> Read [AGENTS.md](../AGENTS.md) first. Branch `feat/subgroup-outcomes`.
> Anchor in `app.js` (DATA map + METRICS): `// ── S7:subgroup-outcomes ──`.

## The gap
Two completeness holes outside MCAS (which S6 owns — don't touch MCAS files here):
1. **College-going by subgroup is entirely absent** — a major equity story (who
   actually enrolls/persists in college).
2. **Postsecondary stops at persistence** — no **college completion** or **remediation**.

(Discipline/absence subgroups already cover the groups DESE publishes with usable
coverage; adding Asian/White there is optional and very sparse — do it only if the
source has it. The two items above are the real wins.)

## What to build (proposed — confirm at source)
**College-going by subgroup** (cat `Postsecondary outcomes`, `pct`, `GnBu`):
`college_enroll_low_income`, `college_enroll_swd`, `college_enroll_hispanic`,
`college_enroll_black`, `college_enroll_ell`.

**Postsecondary completion / readiness** (cat `Postsecondary outcomes`):
| id | label | levels | palette | format |
|---|---|---|---|---|
| `college_completion_pct` | % Completing College (6-yr) | `["district"]` | `GnBu` | `pct` |
| `college_remediation_pct` | % Needing Remedial College Coursework | `["district"]` | `OrRd` | `pct` |

## Files you create
- `scripts/fetch_postsec_detail.py`
- `data/ma_district_postsec_detail.json`

## Source
📌 **Base datasets `kgrx-cg4a` + `sg4g-eg2n`** — college enrollment + persistence,
behind the existing all-students postsec metrics (copy `scripts/fetch_postsec_outcomes.py`).
For the subgroup cuts, add a student-group filter to these two. College completion (6-yr)
and remediation are likely **separate** datasets — discover.

DESE post-secondary / NSC-linked reports on `educationtocareer.data.mass.gov` — search
"college enrollment", "persistence", "completion", "remediation", "MassTransfer".
`scripts/fetch_postsec_outcomes.py` is your template (it pulls the all-students
enrollment/persistence already). Subgroup + completion + remediation are sibling
columns/datasets there.

## Steps
1. Copy `scripts/fetch_postsec_outcomes.py`; resolve the subgroup + completion columns.
2. Write fetcher; `null` for suppressed subgroups / non-HS districts (~211 HS districts).
3. Register path + metrics under `// ── S7:subgroup-outcomes ──` anchors.
4. Verify per AGENTS.md.

## Acceptance
- College-going-by-subgroup metrics paint and slot under **Postsecondary outcomes**.
- Completion and/or remediation shipped if a source exists; documented if not.

## Scope note
If this feels like two PRs, it's fine to ship "college-going by subgroup" first and
"completion/remediation" as a fast follow on the same branch. Don't expand into MCAS or
workforce — those are S6/S8.

## Risk: Med. Subgroup college data exists via DESE/NSC; remediation may be thinner.
