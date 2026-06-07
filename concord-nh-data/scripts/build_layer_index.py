#!/usr/bin/env python3
"""
build_layer_index.py
====================
Generate the master per-dataset validation checklist for the Concord mega map:

    docs/LAYER_INDEX.md     human checklist — one row per dataset, with a [ ] box
    docs/layer_index.json   machine-readable index (drives the map's layer panel)

It enumerates every dataset the toolkit can produce — city ArcGIS layers
(discovered live), federal/state ArcGIS layers + OSM themes + API sources (from
sources.json / the script registries), and the business layers — and writes a
checklist you tick off one layer at a time as you validate it on the map.

    python build_layer_index.py            # live city discovery (hits the city server)
    python build_layer_index.py --no-city  # skip the live crawl, use a placeholder
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
DOCS = os.path.join(ROOT, "docs")


def load_sources() -> Dict[str, Any]:
    with open(os.path.join(ROOT, "sources.json"), encoding="utf-8") as f:
        return json.load(f)


def city_layers() -> List[Dict[str, Any]]:
    """Live-discover the city ArcGIS vector layers via download_concord."""
    import download_concord as dc
    targets = dc.discover()
    seen, out = set(), []
    priority = {n: i for i, n in enumerate(dc.PREFERRED_SERVICES_ORDER)}
    targets.sort(key=lambda t: (dc.slug(t[3]).lower(), priority.get(t[1], 999)))
    for folder, svc, lid, name, url in targets:
        k = dc.slug(name).lower()
        if k in seen:
            continue
        seen.add(k)
        out.append({"name": name, "folder": folder, "service": svc, "url": url})
    return out


def api_sources() -> List[Dict[str, str]]:
    import download_apis as da
    return [{"key": s["key"], "key_req": s["key_req"]} for s in da.REGISTRY]


# Datasets that are tabular/reference (database-only); everything else with a
# geometry is "map+db" (renders on the mega map AND lands in the database).
DB_ONLY_APIS = {"census_acs", "epa_frs", "lodes", "tnm_products", "pvwatts"}


def target_for(out: str, key: str = "") -> str:
    if key in DB_ONLY_APIS:
        return "db"
    if out.endswith(".geojson") or out.endswith("/"):   # geojson or a dir of geojson
        return "map+db"
    return "db"                                          # .csv / .json / .zip tables


def build_index(no_city: bool) -> Dict[str, Any]:
    src = load_sources()
    groups: List[Dict[str, Any]] = []

    # 1. City
    if no_city:
        city = []
        city_note = "Run `download_concord.py --list` (live crawl) to enumerate ~72 layers."
    else:
        try:
            city = city_layers()
            city_note = f"{len(city)} distinct queryable vector layers."
        except Exception as exc:  # noqa: BLE001
            city, city_note = [], f"(live discovery failed: {exc})"
    groups.append({
        "group": "City of Concord ArcGIS", "script": "download_concord.py",
        "note": city_note,
        "rows": [{"label": c["name"], "source": c["service"], "scope": "city",
                  "out": "data/concord_arcgis/", "target": "map+db", "status": "pending"}
                 for c in city],
    })

    # 2. Federal / state ArcGIS
    groups.append({
        "group": "Federal & State ArcGIS", "script": "download_external.py",
        "note": "Bbox-clipped to Concord.",
        "rows": [{"label": e["key"], "source": e.get("title", ""), "scope": "bbox",
                  "out": f"data/external/{e['key']}.geojson", "target": "map+db",
                  "status": "pending"} for e in src.get("external_arcgis", [])],
    })

    # 3. OpenStreetMap
    groups.append({
        "group": "OpenStreetMap", "script": "download_osm.py", "note": "Overpass themes.",
        "rows": [{"label": t["theme"], "source": f"OSM {t['selector']}", "scope": "bbox",
                  "out": f"data/osm/{t['theme']}.geojson", "target": "map+db",
                  "status": "pending"} for t in src.get("osm_queries", [])],
    })

    # 4. APIs (core + living data)
    try:
        apis = api_sources()
    except Exception:  # noqa: BLE001
        apis = [{"key": s["key"], "key_req": s.get("note", "")}
                for s in src.get("api_sources", []) + src.get("living_data_apis", [])]
    groups.append({
        "group": "APIs (Census / EPA / USGS / living data)", "script": "download_apis.py",
        "note": "GeoJSON/CSV to data/apis/.",
        "rows": [{"label": a["key"], "source": f"key: {a.get('key_req','')}", "scope": "varies",
                  "out": "data/apis/", "target": target_for("", a["key"]),
                  "status": "pending"} for a in apis],
    })

    # 5. Schools (K-12 + colleges + enrollment)
    groups.append({
        "group": "Schools (Concord SD + Merrimack Valley SD)", "script": "download_schools.py",
        "note": "Both districts serving Concord, incl. Penacook; + surrounding region.",
        "rows": [
            {"label": "school_districts", "source": "Census TIGERweb", "scope": "districts",
             "out": "data/schools/school_districts.geojson", "target": "map+db", "status": "pending"},
            {"label": "school_districts_region", "source": "Census TIGERweb", "scope": "region",
             "out": "data/schools/school_districts_region.geojson", "target": "map+db", "status": "pending"},
            {"label": "public_schools_districts", "source": "NCES EDGE", "scope": "districts",
             "out": "data/schools/public_schools_districts.geojson", "target": "map+db", "status": "pending"},
            {"label": "public_schools_region", "source": "NCES EDGE", "scope": "region",
             "out": "data/schools/public_schools_region.geojson", "target": "map+db", "status": "pending"},
            {"label": "private_schools_region", "source": "NCES EDGE (incl. St. Paul's)", "scope": "region",
             "out": "data/schools/private_schools_region.geojson", "target": "map+db", "status": "pending"},
            {"label": "colleges", "source": "NCES IPEDS (NHTI, UNH Law)", "scope": "region",
             "out": "data/schools/colleges.geojson", "target": "map+db", "status": "pending"},
            {"label": "enrollment_districts", "source": "Urban Inst. CCD", "scope": "districts",
             "out": "data/schools/enrollment_districts.csv", "target": "db", "status": "pending"},
            {"label": "enrollment_schools", "source": "Urban Inst. CCD", "scope": "districts",
             "out": "data/schools/enrollment_schools.csv", "target": "db", "status": "pending"},
        ],
    })

    # 6. Businesses
    groups.append({
        "group": "Businesses", "script": "download_businesses.py", "note": "Every-business POIs.",
        "rows": [
            {"label": "osm_businesses", "source": "OpenStreetMap", "scope": "bbox",
             "out": "data/businesses/osm_businesses.geojson", "target": "map+db", "status": "pending"},
            {"label": "overture_places", "source": "Overture Maps (--overture)", "scope": "bbox",
             "out": "data/businesses/overture_places.geojson", "target": "map+db", "status": "pending"},
        ],
    })

    # 7. Knowledge (people, facts, history)
    groups.append({
        "group": "Knowledge (people / facts / history)", "script": "download_knowledge.py",
        "note": "Notable inhabitants, Wikidata facts, Wikipedia history.",
        "rows": [
            {"label": "notable_people", "source": "Wikipedia + Wikidata", "scope": "city",
             "out": "data/knowledge/notable_people.geojson", "target": "map+db", "status": "pending"},
            {"label": "history", "source": "Wikipedia extracts", "scope": "city",
             "out": "data/knowledge/history.json", "target": "db", "status": "pending"},
            {"label": "wikidata_facts", "source": "Wikidata Q28249", "scope": "city",
             "out": "data/knowledge/wikidata_facts.csv", "target": "db", "status": "pending"},
        ],
    })

    total = sum(len(g["rows"]) for g in groups)
    map_db = sum(1 for g in groups for r in g["rows"] if r.get("target") == "map+db")
    return {"total_datasets": total, "map_db_datasets": map_db,
            "db_only_datasets": total - map_db, "groups": groups}


def write_markdown(index: Dict[str, Any]) -> str:
    lines = [
        "# Concord Mega Map — Layer Validation Checklist",
        "",
        f"**{index['total_datasets']} datasets** — "
        f"**{index.get('map_db_datasets', '?')} `map+db`** (render on the mega map *and* "
        f"land in the database) · **{index.get('db_only_datasets', '?')} `db`** "
        "(database-only reference/bulk tables).",
        "",
        "Validate **one layer at a time**: load it on the map (or inspect the table "
        "for `db` rows), confirm geometry/placement/attributes (see "
        "`MEGA_MAP_SPEC.md` → *Per-dataset validation protocol*), then change "
        "`[ ]` → `[x]` and note anything off.",
        "",
        "Status legend: `[ ]` pending · `[x]` validated · `[~]` issue (see Notes)",
        "",
    ]
    for g in index["groups"]:
        lines.append(f"## {g['group']}  ·  `{g['script']}`")
        lines.append(f"_{g['note']}_")
        lines.append("")
        lines.append("| ✓ | Layer | Target | Source | Scope | Output | Notes |")
        lines.append("|---|---|---|---|---|---|---|")
        for r in g["rows"]:
            lines.append(f"| [ ] | {r['label']} | {r.get('target','')} | {r['source']} | "
                         f"{r['scope']} | `{r['out']}` |  |")
        lines.append("")
    return "\n".join(lines) + "\n"


def main(argv) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-city", action="store_true", help="skip live city discovery")
    args = ap.parse_args(argv)

    os.makedirs(DOCS, exist_ok=True)
    index = build_index(args.no_city)
    with open(os.path.join(DOCS, "layer_index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)
    with open(os.path.join(DOCS, "LAYER_INDEX.md"), "w", encoding="utf-8") as f:
        f.write(write_markdown(index))
    print(f"Wrote docs/LAYER_INDEX.md and docs/layer_index.json "
          f"({index['total_datasets']} datasets).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
