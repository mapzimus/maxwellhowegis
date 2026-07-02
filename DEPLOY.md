# Deployment

This site deploys via **GitHub Actions → GitHub Pages**, not the legacy
"Deploy from a branch" mode. The two Pages modes are mutually exclusive —
if you ever see the site *not* pick up a push, check Settings → Pages →
Source is set to **GitHub Actions**, not **Deploy from a branch**.

## How it actually works

`.github/workflows/pages.yml` runs on every push to `main` (plus manual
`workflow_dispatch`):

1. `actions/checkout@v4` with **`submodules: recursive`** — this is the
   detail that makes the site buildable at all: `geopuesto`, `bugwars`,
   `truescale`, and `quabbin` are git submodules (see `.gitmodules`), and
   without `submodules: recursive` those subpaths would deploy as empty
   directories.
2. `actions/configure-pages@v5` configures the Pages environment.
3. `actions/upload-pages-artifact@v3` uploads the entire checked-out repo
   root (`path: .`) as the Pages artifact — there's no build step; the
   artifact *is* the working tree.
4. `actions/deploy-pages@v4` publishes it.

The job has `contents: read`, `pages: write`, `id-token: write` permissions
and runs in the `github-pages` environment with `concurrency: { group:
pages, cancel-in-progress: false }`, so overlapping pushes queue rather
than race or cancel each other.

To deploy: **push to `main`.** That's it — no manual trigger needed (though
`workflow_dispatch` is there if you want to re-run a deploy without a new
commit, e.g. after flipping a submodule pin or a GitHub-side config change).

## Custom domain

`CNAME` at the repo root contains `maxwellhowegis.com`; GitHub Pages reads
this file on every deploy to (re)configure the custom domain, so it must
ship in the published artifact (it does — the whole tree is uploaded, this
file included). DNS is four `A` records at the registrar pointing at
GitHub Pages' IPs (185.199.108–111.153) plus HTTPS enforced in the repo's
Pages settings; that part is a one-time setup done outside this repo and
isn't re-run by the workflow.

## Submodules

Four subpaths are **git submodules** pinned to a commit SHA in this repo's
tree (`git ls-tree HEAD geopuesto bugwars truescale quabbin` shows the
pins):

| Path | Source |
|---|---|
| `/geopuesto/` | [`mapzimus/geopuesto`](https://github.com/mapzimus/geopuesto) |
| `/bugwars/` | [`mapzimus/bug-wars`](https://github.com/mapzimus/bug-wars) |
| `/truescale/` | [`mapzimus/true-scale`](https://github.com/mapzimus/true-scale) |
| `/quabbin/` | [`mapzimus/quabbin`](https://github.com/mapzimus/quabbin) |

All four **must stay public** — the Pages workflow checks them out with
the default `GITHUB_TOKEN`, which cannot read private repos. A submodule
flipped to private silently breaks that subpath on the next deploy (it'll
check out empty, not fail loudly).

Submodules only publish what's pinned, not what's on their default branch.
After pushing changes inside a submodule's own repo, bump the pointer here:

```bash
git submodule update --remote <path>   # e.g. bugwars, truescale
git add <path>
git commit -m "bump <path> submodule"
git push
```

Until that commit lands, the live site keeps serving the old pinned
commit even though the submodule's upstream repo has moved on.

## Vendored (non-submodule) directories

Two directories are **not** submodules — they're plain committed copies,
manually synced from other private repos:

| Path | Synced from |
|---|---|
| `/ma-atlas/` | private `mapzimus/ma-education-atlas`, via `deploy/sync_public_maps.ps1` in `lehs-data-dive` |
| `/Lynn-data-dive/maps/` | private `mapzimus/lehs-data-dive`, same sync script |

Because these are copies rather than submodule pins, git has no way to
detect drift from upstream — a sync is just a PowerShell copy + a plain
commit, and any repo-local fix applied directly to a vendored file (image
recompression, GeoJSON minification, etc.) will be silently overwritten
the next time that directory is re-synced unless it's re-applied by hand.
See `UPSTREAM-NOTES.md` for the log of such fixes and exactly how to
reapply each one after a resync.

## Gotchas

- **`schedule`-triggered workflows get disabled after 60 days of repo
  inactivity.** `.github/workflows/keep-streamlit-awake.yml` pings the
  Lynn Data Dive Streamlit app every 6 hours via `cron` to keep it warm.
  GitHub automatically disables scheduled workflows on a repo with no
  pushes/commits for 60 days — on a quiet repo the cron will silently stop
  firing and the Streamlit app will go back to cold-starting for visitors.
  Any push to `main` resets the clock; if the workflow shows as disabled
  in the Actions tab, re-enable it manually (Actions → the workflow →
  "Enable workflow") or just push a commit.
- **Submodules must be public.** See above — a private submodule doesn't
  fail the build, it just publishes an empty directory at that path.
- **No build step.** The uploaded artifact is the raw working tree
  (`path: .` in the workflow). Anything committed to `main` ships as-is;
  there's no bundling, minification, or templating to go stale.
- **Vendored directories aren't self-updating.** `ma-atlas/` and
  `Lynn-data-dive/maps/` can silently drift from their source repos —
  nothing in CI checks parity. See `UPSTREAM-NOTES.md`.
- **`concurrency: cancel-in-progress: false`** means back-to-back pushes to
  `main` queue their Pages deploys rather than cancel the in-flight one —
  a deploy triggered by an older commit can finish *after* one triggered by
  a newer commit if they're close together, briefly serving stale content
  before the newer deploy catches up.
