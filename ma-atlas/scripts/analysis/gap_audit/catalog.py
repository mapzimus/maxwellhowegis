"""Parse the ``const METRICS = [...]`` catalog out of app.js.

Folds the two prior parsers into one pass: ``compute_correlations.parse_metrics_catalog``
(id/label/cat/format/levels/requires) and ``audit_quality.parse_palettes`` (palette).
Returns ``{id: {id,label,cat,format,levels,requires,palette}}`` so downstream code
has a single source of truth and never imports the to-be-retired scripts.
"""

import re

from .config import APP_JS

# Each catalog entry is a single ``{ ... }`` object literal containing an id.
_OBJ_RE = re.compile(r"\{[^{}]*\bid\s*:\s*[\"']([^\"']+)[\"'][^{}]*\}")


def _field(obj, name):
    m = re.search(rf"\b{name}\s*:\s*[\"']([^\"']*)[\"']", obj)
    return m.group(1) if m else None


def load_catalog(path=APP_JS):
    """Return ``{metric_id: {id,label,cat,format,levels,requires,palette}}``."""
    src = open(path, encoding="utf-8").read()
    start = src.index("const METRICS = [")
    end = src.index("\n];", start)          # first array close after the start
    block = src[start:end]

    catalog = {}
    for m in _OBJ_RE.finditer(block):
        obj, mid = m.group(0), m.group(1)
        lv = re.search(r"levels\s*:\s*\[([^\]]*)\]", obj)
        levels = re.findall(r"[\"']([^\"']+)[\"']", lv.group(1)) if lv else []
        catalog[mid] = {
            "id": mid,
            "label": _field(obj, "label"),
            "cat": _field(obj, "cat"),
            "format": _field(obj, "format"),
            "levels": levels,
            "requires": _field(obj, "requires"),
            "palette": _field(obj, "palette"),
        }
    return catalog
