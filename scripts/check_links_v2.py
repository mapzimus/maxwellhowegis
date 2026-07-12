#!/usr/bin/env python3
"""Link audit for the v2 site. Stdlib only.

Checks:
  1. Every local href/src in v2/*.html resolves to a file on disk.
  2. Every thumb/gallery src in the data files resolves (submodule paths -> warning).
  3. Data integrity: slug uniqueness, expected counts, valid status values.
  4. (--external) HEAD-checks every external URL.

Run from repo root:  python scripts/check_links_v2.py [--external]
"""
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "v2"
SUBMODULE_PREFIXES = ("quabbin/", "geopuesto/", "bugwars/", "truescale/")

errors, warnings = [], []
externals = set()


def resolve_local(base_dir: Path, url: str):
    """Return the file a local URL points at (query/hash stripped), or None if external/anchor."""
    if re.match(r"^(https?:)?//|^mailto:|^#|^data:", url):
        if url.startswith(("http://", "https://")):
            externals.add(url)
        return None
    path = url.split("#")[0].split("?")[0]
    if not path:
        return None
    target = (base_dir / path).resolve()
    if path.endswith("/"):
        target = target / "index.html"
    return target


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for attr in ("href", "src"):
            if a.get(attr):
                self.refs.append(a[attr])


# ---- 1. HTML pages ----
pages = sorted(V2.glob("*.html"))
for page in pages:
    p = LinkParser()
    p.feed(page.read_text(encoding="utf-8"))
    for ref in p.refs:
        target = resolve_local(V2, ref)
        if target is None:
            continue
        if not target.exists():
            rel = str(target.relative_to(ROOT)) if target.is_relative_to(ROOT) else str(target)
            if rel.replace("\\", "/").startswith(SUBMODULE_PREFIXES):
                warnings.append(f"{page.name}: submodule (ok in prod): {ref}")
            else:
                errors.append(f"{page.name}: broken local ref: {ref}")

# ---- 2 & 3. Data files ----
def load_data(fname, varname):
    """Evaluate a data JS file with Node and return its array (handles JS object literals)."""
    import subprocess
    script = (
        "const window = {}; const fs = require('fs');"
        f"const src = fs.readFileSync(String.raw`{V2 / 'js' / 'data' / fname}`, 'utf8');"
        "new Function('window', src)(window);"
        f"process.stdout.write(JSON.stringify(window.V2_DATA.{varname}));"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True,
                         encoding="utf-8", check=True)
    return json.loads(out.stdout)

projects = load_data("projects.js", "projects")
tools = load_data("tools.js", "tools")
games = load_data("games.js", "games")
ventures = load_data("ventures.js", "ventures")
gallery = json.loads((V2 / "js" / "data" / "gallery.json").read_text(encoding="utf-8"))

datasets = {"projects": projects, "tools": tools, "games": games, "ventures": ventures}
VALID_STATUS = {"live", "development", "archived", None}

slugs = set()
for name, items in datasets.items():
    for it in items:
        s = it.get("slug")
        if not s:
            errors.append(f"{name}: item missing slug: {it.get('title')}")
        elif s in slugs:
            errors.append(f"{name}: duplicate slug: {s}")
        slugs.add(s)
        if it.get("status") not in VALID_STATUS:
            errors.append(f"{name}/{s}: bad status {it.get('status')!r}")
        for key in ("live", "repo", "writeup"):
            url = (it.get("links") or {}).get(key)
            if url and url.startswith("http"):
                externals.add(url)
            elif url:
                t = resolve_local(ROOT, url)
                if t and not t.exists():
                    rel = url
                    if rel.startswith(SUBMODULE_PREFIXES):
                        warnings.append(f"{name}/{s}: submodule link (ok in prod): {url}")
                    else:
                        errors.append(f"{name}/{s}: broken link: {url}")
        srcs = [it.get("thumb")] + [g.get("src") for g in it.get("gallery", [])]
        for src in filter(None, srcs):
            t = (ROOT / src)
            if not t.exists():
                if src.startswith(SUBMODULE_PREFIXES):
                    warnings.append(f"{name}/{s}: submodule image (ok in prod): {src}")
                else:
                    errors.append(f"{name}/{s}: missing image: {src}")

for i, g in enumerate(gallery):
    if not (ROOT / g["src"]).exists() and not g["src"].startswith(SUBMODULE_PREFIXES):
        errors.append(f"gallery[{i}]: missing image: {g['src']}")

# counts
checks = [
    (len(pages) == 10, f"pages == 10 (got {len(pages)})"),
    (len(projects) == 25, f"projects == 25 (got {len(projects)})"),
    (len(tools) == 25, f"tools == 25 (got {len(tools)})"),
    (len(gallery) == 120, f"gallery == 120 (got {len(gallery)})"),
    (len(games) == 5, f"games == 5 (got {len(games)})"),
    (len(ventures) == 6, f"ventures == 6 (got {len(ventures)})"),
]
for ok, msg in checks:
    if not ok:
        errors.append("count check failed: " + msg)

# noindex present on every page
for page in pages:
    if "noindex" not in page.read_text(encoding="utf-8"):
        errors.append(f"{page.name}: missing noindex meta")

# ---- 4. External URLs (optional) ----
if "--external" in sys.argv:
    print(f"HEAD-checking {len(externals)} external URLs...")
    for url in sorted(externals):
        try:
            req = urllib.request.Request(url, method="HEAD",
                                         headers={"User-Agent": "Mozilla/5.0 (link-audit)"})
            with urllib.request.urlopen(req, timeout=10) as r:
                if r.status >= 400:
                    warnings.append(f"external {r.status}: {url}")
        except Exception as e:
            warnings.append(f"external unreachable: {url} ({e})")

print(f"Checked {len(pages)} pages, {sum(len(v) for v in datasets.values())} data items, "
      f"{len(gallery)} gallery entries, {len(externals)} external URLs collected.")
for w in warnings:
    print("  WARN:", w)
for e in errors:
    print("  ERROR:", e)
print("RESULT:", "FAIL" if errors else "PASS",
      f"({len(errors)} errors, {len(warnings)} warnings)")
sys.exit(1 if errors else 0)
