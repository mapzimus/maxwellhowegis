"""Idempotent GitHub issue mirroring for open high-severity findings.

Linkage is dual and re-derivable: the registry stores `github_issue` (number) AND
each issue body carries a hidden marker ``<!-- gap-audit-fp:<fp> v:<hash> -->``.
So the desired state is recomputed from scratch every run; only the number persists.

Safety: with no GitHub token (or --dry-run) NO network call is made — instead a
`gaps_issues_plan.md` is written describing what *would* happen. Real create/update/
close runs in CI with the default GITHUB_TOKEN.
"""

import hashlib
import json
import os
import re
import subprocess

from . import config

LABEL = "gap-audit"
MARKER_RE = re.compile(r"<!--\s*gap-audit-fp:\s*([0-9a-f]{12})\s+v:([0-9a-f]+)\s*-->")


# ── pure logic (unit-testable, no network) ───────────────────────────────────
def vhash(f):
    """Content hash → detects when an existing issue's body has drifted."""
    basis = f.detail + "|" + str((f.provenance or {}).get("refill_command", ""))
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:6]


def want_set(findings):
    """Findings that deserve a GitHub issue: open/investigating + high severity."""
    return {f.fingerprint: f for f in findings
            if f.severity == "high" and f.status in ("open", "investigating")}


def plan_sync(want, existing):
    """Compute actions. want: {fp: finding}; existing: {fp: {number,vhash,state}}."""
    create, update, close = [], [], []
    for fp, f in want.items():
        ex = existing.get(fp)
        if ex is None:
            create.append(f)
        elif ex["state"] == "closed" or ex["vhash"] != vhash(f):
            update.append((f, ex["number"]))
    for fp, ex in existing.items():
        if fp not in want and ex["state"] == "open":
            close.append(ex["number"])
    return {"create": create, "update": update, "close": close}


def issue_title(f):
    suffix = f" ({f.scope})" if f.scope != "*" else ""
    return f"[gap-audit] {f.flag_code}: {f.metric}{suffix}"


def issue_body(f):
    p = f.provenance or {}
    return (
        f"**{f.severity.upper()}** `{f.flag_code}` on `{f.metric}` (scope `{f.scope}`)\n\n"
        f"{f.detail}\n\n"
        f"- **Source:** {p.get('upstream_source', '—')}\n"
        f"- **Refill:** `{p.get('refill_command', '—')}`\n"
        f"- **Dataset:** {p.get('dataset_id', '—')}  ·  **Vintage:** {p.get('vintage', '—')}\n"
        f"- **Fingerprint:** `{f.fingerprint}`\n\n"
        f"_Auto-managed by gap_audit; closes when the finding is resolved or triaged._\n"
        f"<!-- gap-audit-fp:{f.fingerprint} v:{vhash(f)} -->"
    )


# ── gh CLI plumbing ──────────────────────────────────────────────────────────
def token_available():
    if os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN"):
        return True
    try:
        return subprocess.run(["gh", "auth", "status"],
                              capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def _gh(args, repo, **kw):
    cmd = ["gh"] + args + (["--repo", repo] if repo else [])
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def list_existing(repo=None):
    r = _gh(["issue", "list", "--label", LABEL, "--state", "all", "--limit", "1000",
             "--json", "number,body,state"], repo, check=True)
    existing = {}
    for it in json.loads(r.stdout or "[]"):
        m = MARKER_RE.search(it.get("body") or "")
        if m:
            existing[m.group(1)] = {"number": it["number"], "vhash": m.group(2),
                                    "state": it["state"]}
    return existing


def ensure_label(repo=None):
    """Create the gap-audit label if missing (gh issue create --label fails on a
    nonexistent label). --force makes it idempotent (update-if-exists)."""
    _gh(["label", "create", LABEL, "--color", "B60205", "--force",
         "--description", "Auto-managed by gap_audit (open high-severity data gap)"], repo)


def sync_issues(findings, dry_run=False, repo=None):
    want = want_set(findings)
    if dry_run or not token_available():
        return _write_plan(want, "dry-run" if dry_run else "no GitHub token")

    ensure_label(repo)
    actions = plan_sync(want, list_existing(repo))
    created = failed = 0
    for f in actions["create"]:
        r = _gh(["issue", "create", "--label", LABEL,
                 "--title", issue_title(f), "--body", issue_body(f)], repo)
        m = re.search(r"/issues/(\d+)", r.stdout or "")
        if r.returncode == 0 and m:
            f.github_issue = int(m.group(1))
            created += 1
        else:                                   # report, don't silently claim success
            failed += 1
            print(f"  create failed for {f.fingerprint}: {(r.stderr or '').strip()[:160]}")
    for f, number in actions["update"]:
        _gh(["issue", "edit", str(number), "--body", issue_body(f)], repo)
        _gh(["issue", "reopen", str(number)], repo)        # no-op if already open
        f.github_issue = number
    for number in actions["close"]:
        _gh(["issue", "close", str(number),
             "--comment", "Resolved/triaged by gap_audit — no longer an open high finding."], repo)
    result = {"created": created, "updated": len(actions["update"]),
              "closed": len(actions["close"])}
    if failed:
        result["failed"] = failed
    return result


def _write_plan(want, reason):
    lines = [f"# gap_audit — GitHub issue sync PLAN ({reason})\n",
             f"_Would manage {len(want)} open high-severity finding(s). "
             f"No network calls were made._\n"]
    for f in sorted(want.values(), key=lambda f: f.fingerprint):
        lines.append(f"- **create/update** `{f.fingerprint}` — {issue_title(f)}")
    with open(config.ISSUES_PLAN, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    return {"plan": len(want), "reason": reason, "path": config.ISSUES_PLAN}
