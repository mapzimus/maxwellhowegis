"""Extract provenance from the repo's own code + data.

Two independent signals are combined in manifest.py:
  - column_to_file(): AUTHORITATIVE metric -> file map, by loading every side file
    and recording which file's records carry each column.
  - scan_scripts(): per fetch/aggregate script, the upstream attribution
    (dataset id, source, vintage, refill command) + the output file(s) it writes,
    parsed from the module docstring and body. This supplies the file -> source half.
"""

import ast
import json
import os
import re

# Socrata dataset id like [i9w6-niyt]; or a body constant DATASET = "i9w6-niyt".
_DATASET_ID = re.compile(r'\[([0-9a-z]{4}-[0-9a-z]{4})\]')
_DATASET_CONST = re.compile(r'\bDATASET\w*\s*=\s*["\']([0-9a-z]{4}-[0-9a-z]{4})["\']')
_SOURCE_LINE = re.compile(r'^\s*Source\s*:\s*(.+)$', re.I | re.M)
_VINTAGE = re.compile(r'\b(SY\s?20\d{2}|FY\s?20\d{2}|20\d{2}\s?[–\-]\s?20\d{2}|ACS\s?20\d{2})\b')
_RUN = re.compile(r'Run[^\n]*?::\s*(python[^\n]+)', re.I)
_URL = re.compile(r'(https?://[^\s)"\'`]+)')
# A filename on a line that is clearly a WRITE (so inputs aren't mistaken for outputs).
_WRITE_CTX = re.compile(
    r'^[^\n]*(?:OUT_PATH|OUTFILE|\bOUT\b|\.dump|write_text|Output|DEST|'
    r'results? to|writes? to)[^\n]*?["\'`/](ma_[\w]+\.(?:json|geojson))',
    re.I | re.M)


def parse_script(path):
    name = os.path.basename(path)
    try:
        src = open(path, encoding="utf-8").read()
    except Exception:
        return None
    try:
        doc = ast.get_docstring(ast.parse(src)) or ""
    except Exception:
        doc = ""
    did = _DATASET_ID.search(doc) or _DATASET_CONST.search(src)
    dataset_id = did.group(1) if did else None
    srcm = _SOURCE_LINE.search(doc)
    # Real URLs only — skip f-string templates like https://{DOMAIN}/resource/{dataset}.
    urls = [u for u in (_URL.findall(doc) + _URL.findall(src)) if "{" not in u]
    vin = _VINTAGE.search(doc)
    run = _RUN.search(doc)
    source = srcm.group(1).strip() if srcm else (urls[0] if urls else None)
    if not source and dataset_id:                 # Socrata 4-4 id ⇒ the DESE hub
        source = "MA DESE Education-to-Career hub (Socrata)"
    if source and len(source) > 160:
        source = source[:157] + "..."
    return {
        "name": name,
        "writes": set(_WRITE_CTX.findall(src)),
        "dataset_id": dataset_id,
        "source": source,
        "vintage": vin.group(1).strip() if vin else None,
        "refill": run.group(1).strip() if run else f"python scripts/{name}",
        "has_docstring": bool(doc.strip()),
    }


def scan_scripts(scripts_dir):
    out = {}
    for fn in sorted(os.listdir(scripts_dir)):
        if not fn.endswith(".py"):
            continue
        if fn.startswith(("fetch_", "aggregate_", "bake_", "backfill_")) or fn in (
                "cover_orphan_towns.py", "add_somerset_berkley.py", "split_muni_timeseries.py"):
            p = parse_script(os.path.join(scripts_dir, fn))
            if p:
                out[fn] = p
    return out


def column_to_file(data_dir):
    """{column: [files]} from every district/muni side file (authoritative)."""
    c2f = {}
    for fn in sorted(os.listdir(data_dir)):
        if not (fn.startswith(("ma_district_", "ma_muni_")) and fn.endswith(".json")):
            continue
        try:
            d = json.load(open(os.path.join(data_dir, fn), encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        cols = set()
        for v in list(d.values())[:400]:        # sample is enough to learn the schema
            if isinstance(v, dict):
                cols.update(v.keys())
        for c in cols:
            c2f.setdefault(c, []).append(fn)
    return c2f


def geojson_columns(data_dir):
    """Columns baked directly into the geojsons by the external pipeline."""
    cols = set()
    for fn in ("ma_academic_districts.geojson", "ma_municipalities.geojson",
               "ma_districts_metrics.geojson"):
        p = os.path.join(data_dir, fn)
        if not os.path.exists(p):
            continue
        try:
            g = json.load(open(p, encoding="utf-8"))
        except Exception:
            continue
        for feat in g.get("features", []):
            cols.update((feat.get("properties") or {}).keys())
    return cols
