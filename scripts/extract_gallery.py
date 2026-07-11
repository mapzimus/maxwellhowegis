#!/usr/bin/env python3
"""One-time extractor: parse gallery.html's .gallery-brick divs into
v2/js/data/gallery.json so the v2 gallery is data-driven.

Stdlib only (html.parser). Run from repo root:
    python scripts/extract_gallery.py
"""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "gallery.html"
OUT = ROOT / "v2" / "js" / "data" / "gallery.json"


class GalleryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.cur = None          # item being built
        self.depth = 0           # div depth inside current brick
        self.capture = None      # which text field we're capturing
        self.in_link = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "")
        if tag == "div" and cls and cls.split()[0] == "gallery-brick":
            # opening a new brick
            self.cur = {
                "title": a.get("data-title", ""),
                "caption": a.get("data-caption", ""),
                "link": a.get("data-link"),
                "src": "", "alt": "",
                "label": "", "overlayTitle": "", "overlayText": "",
                "tags": [], "cta": None,
            }
            self.depth = 1
            return
        if self.cur is None:
            return
        if tag == "div":
            self.depth += 1
            if "gallery-brick-label" in cls:
                self.capture = "label"
        elif tag == "img":
            self.cur["src"] = a.get("src", "")
            self.cur["alt"] = a.get("alt", "")
        elif tag == "h3":
            self.capture = "overlayTitle"
        elif tag == "p":
            self.capture = "overlayText"
        elif tag == "span" and "gallery-brick-tag" in cls:
            self.capture = "tag"
        elif tag == "a" and "gallery-brick-link" in cls:
            self.cur["cta"] = {"href": a.get("href", ""), "text": ""}
            self.in_link = True

    def handle_endtag(self, tag):
        if self.cur is None:
            return
        if tag == "div":
            self.depth -= 1
            if self.depth == 0:
                self.items.append(self.cur)
                self.cur = None
        elif tag in ("h3", "p", "span"):
            self.capture = None
        elif tag == "a":
            self.in_link = False

    def handle_data(self, data):
        if self.cur is None:
            return
        text = data.strip()
        if not text:
            return
        if self.in_link and self.cur["cta"] is not None:
            self.cur["cta"]["text"] += text
        elif self.capture == "tag":
            self.cur["tags"].append(text)
        elif self.capture in ("label", "overlayTitle", "overlayText"):
            self.cur[self.capture] += (" " if self.cur[self.capture] else "") + text


def main():
    html = SRC.read_text(encoding="utf-8")
    p = GalleryParser()
    p.feed(html)
    items = p.items

    print(f"Extracted {len(items)} bricks")
    problems = []
    for i, it in enumerate(items):
        if not it["title"]:
            problems.append(f"[{i}] missing title")
        if not it["src"]:
            problems.append(f"[{i}] {it['title']!r} missing img src")
        else:
            f = ROOT / it["src"]
            if not f.exists():
                kind = "WARN (submodule)" if it["src"].startswith(("quabbin/", "geopuesto/", "bugwars/", "truescale/")) else "MISSING"
                problems.append(f"[{i}] {it['title']!r} {kind}: {it['src']}")
    for msg in problems:
        print("  " + msg)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes)")

    hard_missing = [m for m in problems if "MISSING" in m]
    sys.exit(1 if hard_missing else 0)


if __name__ == "__main__":
    main()
