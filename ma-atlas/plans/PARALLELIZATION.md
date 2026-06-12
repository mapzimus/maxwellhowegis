# Parallel metric build — master plan

Closing the metric-coverage gaps from the June 2026 category audit, fanned out across
independent Claude Code sessions. **Read [AGENTS.md](../AGENTS.md) first.**

## How it works
- One session = one theme = one worktree = one branch = one PR.
- Each session creates its **own** `scripts/fetch_*.py` + `data/*.json` (no collision)
  and appends to `app.js` **only under its `// ── Sx:<slug> ──` anchor**.
- The only hard dependency is this scaffold (anchors + briefs), already on `main`.
- Two sessions own real shared logic and must not be doubled up:
  **S9 → `computeDerivedMetrics()`**, **S10 → `KNOWN_GROUPS`/group resolver**.

## Launch a session
```
git fetch origin
git worktree add ../wt-<slug> -b feat/<slug> origin/main
# open a Claude Code session in ../wt-<slug>, then:
#   "Read plans/SESSION-Sx.md and AGENTS.md, then implement it end to end and open a PR."
```

## The 14 sessions

| # | Theme | Slug | Wave | Source risk | Owns shared logic? |
|---|---|---|---|---|---|
| S1 | Accountability build-out | `accountability` | 1 | Low | — |
| S2 | Career / vocational build-out | `vocational` | 1 | Med | — |
| S3 | Special education build-out | `sped` | 1 | Med | — |
| S4 | English learners build-out | `el` | 1 | Med | — |
| S5 | Progression | `progression` | 1 | Med (spike) | — |
| S6 | MCAS completeness | `mcas-completeness` | 1 | Low | — |
| S7 | Subgroup & outcomes completeness | `subgroup-outcomes` | 1 | Med | — |
| S8 | Workforce completeness | `workforce` | 1 | Low-Med | — |
| S9 | Trends (computed) | `trends` | 2 | Low | **computeDerivedMetrics** |
| S10 | Gender dimension | `gender` | 2 | Low-Med | **KNOWN_GROUPS / group resolver** |
| S11 | Funding / revenue side | `funding-revenue` | 2 | Med-High (not Socrata) | — |
| S12 | School-choice landscape | `school-choice-landscape` | 2 | Med | — |
| S13 | School climate & safety | `climate-safety` | 2 | High (spike) | — |
| S14 | Whole-child & facilities | `whole-child-facilities` | 2 | High (spike) | — |

**Wave 1** (S1–S8) are known-DESE-source, pure-additive — safe to run all at once after
this scaffold merges. **Wave 2** (S9–S14) either own shared logic or need a
source-availability spike; stage them with a little more care.

## Known overlaps to reconcile first
- **S9 (Trends)** overlaps the in-flight `claude/year-over-year-change` branch. Check
  that branch before starting — absorb or rebase onto it rather than duplicating.
- `wt-gapfill` (on `main`) and `claude/null-handling-audit` are also active — if a
  Wave-1 session finds its target already added, downscope and note it in the PR.

## Sequencing
Only `S0 scaffold → all`. Everything else is concurrent. Merge PRs one at a time
(rebase on latest `main`); `main` auto-deploys on merge. Stagger S9 and S10 merges.
