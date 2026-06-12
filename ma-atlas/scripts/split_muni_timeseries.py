"""
Split the municipality time-series out of the GeoJSON.

~75% of ma_municipalities.geojson is year-keyed columns (e.g. grad_4yr__2025,
AS_PCT__1994) — 3.3MB of the 4.4MB file — yet the atlas opens at DISTRICT level
and most sessions never switch to municipality level. This moves every
``<base>__<YYYY>`` column into a side file keyed by TOWN_ID, which the app
lazy-loads only when the user enters municipality level. The slimmed GeoJSON
keeps geometry + base/group columns (incl. the flat ``grad_4yr`` and the 2020
census ``POP2020``/``pop_2020``, which are NOT year-keyed).

Idempotent: re-running on an already-split file finds no year columns and
leaves both files unchanged.

Run from repo root::  python scripts/split_muni_timeseries.py
"""
from __future__ import annotations
import json, re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GEO = REPO / "data" / "ma_municipalities.geojson"
OUT = REPO / "data" / "ma_muni_timeseries.json"
# A year-keyed column ends in __YYYY (1900–2099). This is exactly the pattern
# buildYearKeyedIndex() recognizes, so the split and the app stay in agreement.
YEAR_COL = re.compile(r"__(?:19|20)\d{2}$")


def main() -> int:
    gj = json.loads(GEO.read_text())
    feats = gj.get("features", [])
    ts: dict[str, dict] = {}
    moved_cols = 0
    moved_cells = 0

    for f in feats:
        props = f.get("properties", {})
        tid = str(props.get("TOWN_ID"))
        year_keys = [k for k in props if YEAR_COL.search(k)]
        if not year_keys:
            continue
        row = {}
        for k in year_keys:
            v = props.pop(k)
            moved_cols += 1
            if v is not None and v != "":
                row[k] = v          # omit nulls — that's where the size goes
                moved_cells += 1
        if row:
            ts[tid] = row

    if moved_cols == 0:
        print("No year-keyed columns found — already split. Nothing to do.")
        return 0

    before = GEO.stat().st_size
    GEO.write_text(json.dumps(gj, separators=(",", ":")))
    OUT.write_text(json.dumps(ts, separators=(",", ":")))
    after = GEO.stat().st_size
    print(f"moved {moved_cols} year-column cells ({moved_cells} non-null) "
          f"from {len(feats)} municipalities")
    print(f"  {GEO.name}: {before/1e6:.2f}MB -> {after/1e6:.2f}MB")
    print(f"  {OUT.name}: {OUT.stat().st_size/1e6:.2f}MB (lazy-loaded on muni level)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
