#!/usr/bin/env python3
"""
download_knowledge.py
=====================
Concord, NH knowledge base — notable inhabitants, structured facts, and history.
This is mostly DB-tier reference data (text/tables), with an optional point layer
for the mega map.

Outputs (data/knowledge/):
  notable_people.csv        every page in Wikipedia "People from Concord, NH"
                            (+ subcategories) with a short bio + Wikidata id   [db]
  notable_people.geojson    same people as map pins near the city centroid     [map+db]
  wikidata_concord.json     full Wikidata entity for Concord (Q28249), all claims [db]
  wikidata_facts.csv        flattened property/value facts                       [db]
  history.json              full-text Wikipedia extracts for Concord, Penacook,
                            St. Paul's, NHTI, UNH Law, NH State House, etc.       [db]

    python download_knowledge.py
    python download_knowledge.py --only notable_people history
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "data", "knowledge"))

LAT, LON = 43.207, -71.538            # Concord city centroid (for people pins)
CONCORD_QID = "Q28249"               # Wikidata: Concord, New Hampshire
PEOPLE_CATEGORY = "Category:People from Concord, New Hampshire"
HISTORY_PAGES = [
    "Concord, New Hampshire",
    "Penacook, New Hampshire",
    "History of Concord, New Hampshire",
    "Saint Paul's School (New Hampshire)",
    "NHTI – Concord's Community College",
    "University of New Hampshire Franklin Pierce School of Law",
    "New Hampshire State House",
    "New Hampshire State Library",
    "Concord Coach",
]
WP_API = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "open-concord/1.0 (mhowe.gis@gmail.com) educational"}


def _get(url: str, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    delay = 3.0
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(delay); delay *= 2


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# --------------------------------------------------------------------------- #
def _category_pages(category: str, depth: int = 1):
    """Page titles in a category, recursing `depth` levels into subcategories."""
    pages, subcats = [], []
    cont = {}
    while True:
        params = {"action": "query", "list": "categorymembers", "cmtitle": category,
                  "cmlimit": "500", "cmtype": "page|subcat", "format": "json", **cont}
        d = _get(WP_API, params)
        for m in d.get("query", {}).get("categorymembers", []):
            title = m["title"]
            if title.startswith("Category:"):
                subcats.append(title)
            elif not title.startswith("List of"):
                pages.append(title)
        if "continue" in d:
            cont = d["continue"]
        else:
            break
    if depth > 0:
        for sub in subcats:
            pages.extend(_category_pages(sub, depth - 1))
    return sorted(set(pages))


def notable_people() -> str:
    titles = _category_pages(PEOPLE_CATEGORY, depth=1)
    records = []
    for chunk in _chunks(titles, 40):
        d = _get(WP_API, {"action": "query", "prop": "extracts|pageprops|info",
                          "exintro": "1", "explaintext": "1", "exsentences": "2",
                          "ppprop": "wikibase_item", "inprop": "url",
                          "titles": "|".join(chunk), "format": "json"})
        for pg in d.get("query", {}).get("pages", {}).values():
            if "missing" in pg:
                continue
            records.append({
                "name": pg.get("title", ""),
                "bio": (pg.get("extract", "") or "").replace("\n", " ").strip(),
                "wikidata": pg.get("pageprops", {}).get("wikibase_item", ""),
                "url": pg.get("fullurl", ""),
            })
    records.sort(key=lambda r: r["name"])
    # CSV (db)
    with open(os.path.join(OUT, "notable_people.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["name", "bio", "wikidata", "url"])
        w.writeheader(); w.writerows(records)
    # GeoJSON pins near the centroid (map+db) — deterministic jitter so they don't stack
    feats = []
    for i, r in enumerate(records):
        dlon = ((i % 12) - 6) * 0.0009
        dlat = ((i // 12) - 6) * 0.0009
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [LON + dlon, LAT + dlat]},
                      "properties": r})
    with open(os.path.join(OUT, "notable_people.geojson"), "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    return f"notable_people.csv + .geojson  ({len(records)} notable people)"


def history() -> str:
    out = {}
    for chunk in _chunks(HISTORY_PAGES, 10):
        d = _get(WP_API, {"action": "query", "prop": "extracts|info", "explaintext": "1",
                          "inprop": "url", "redirects": "1",
                          "titles": "|".join(chunk), "format": "json"})
        for pg in d.get("query", {}).get("pages", {}).values():
            if "missing" in pg:
                continue
            out[pg["title"]] = {"title": pg["title"], "url": pg.get("fullurl", ""),
                                "extract": pg.get("extract", "")}
    with open(os.path.join(OUT, "history.json"), "w", encoding="utf-8") as f:
        json.dump(list(out.values()), f, indent=2)
    chars = sum(len(v["extract"]) for v in out.values())
    return f"history.json  ({len(out)} articles, ~{chars:,} chars of text)"


def _flatten_claim(prop, claim):
    snak = claim.get("mainsnak", {})
    dv = snak.get("datavalue", {})
    t, v = dv.get("type"), dv.get("value")
    if t == "wikibase-entityid":
        val = v.get("id")
    elif t == "time":
        val = v.get("time")
    elif t == "quantity":
        val = v.get("amount")
    elif t == "globecoordinate":
        val = f"{v.get('latitude')},{v.get('longitude')}"
    elif t == "monolingualtext":
        val = v.get("text")
    else:
        val = v if isinstance(v, str) else json.dumps(v) if v is not None else ""
    return {"property": prop, "type": t, "value": val}


def wikidata_facts() -> str:
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{CONCORD_QID}.json"
    data = _get(url)
    with open(os.path.join(OUT, "wikidata_concord.json"), "w", encoding="utf-8") as f:
        json.dump(data, f)
    entity = data.get("entities", {}).get(CONCORD_QID, {})
    rows = []
    for prop, claims in (entity.get("claims", {}) or {}).items():
        for c in claims:
            rows.append(_flatten_claim(prop, c))
    with open(os.path.join(OUT, "wikidata_facts.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["property", "type", "value"])
        w.writeheader(); w.writerows(rows)
    return (f"wikidata_concord.json + wikidata_facts.csv  ({len(rows)} statements; "
            "property/value are Q/P-ids — resolve labels via wbgetentities if needed)")


TASKS = {"notable_people": notable_people, "history": history, "wikidata_facts": wikidata_facts}


def main(argv) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", choices=list(TASKS))
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args(argv)
    if args.list:
        for k in TASKS:
            print(f"  {k}")
        return 0
    os.makedirs(OUT, exist_ok=True)
    ok = failed = 0
    for k in (args.only or list(TASKS)):
        try:
            print(f"  > {k} ...", file=sys.stderr)
            print(f"    {TASKS[k]()}", file=sys.stderr); ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {k}: {exc}", file=sys.stderr); failed += 1
    print(f"\nDone. {ok} ok, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
