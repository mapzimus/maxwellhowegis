"""
Parse a hand-downloaded, town-keyed civic data file (CSV or Excel in data/raw/)
into a muni side file ``data/ma_muni_<metric_id>.json`` keyed by TOWN_ID — the
ingest step for the T4 civic metrics whose sources (DLS, SoS, MBLC) block
automated fetching. Download the file by hand, then run this; aggregate to
districts with scripts/aggregate_civic_to_districts.py.

Usage:
  python scripts/parse_civic.py --file data/raw/overrides.xlsx \
      --town-col "Municipality" --value-col "Result" \
      --metric-id override_count --agg count --zero-fill

If --town-col / --value-col aren't found, the script prints the columns it DID
find so you can correct the names. Town names are matched to TOWN_ID with the same
normalize-name rule the ACS pipeline uses (strips " town"/" city" Census suffixes).

--agg combines multiple rows for one town:
  first  one value per town (default)        count  # of non-empty rows (e.g. overrides)
  sum    add them (e.g. $ across years)       max    largest
--zero-fill: towns in the geojson but absent from the file get 0 (use only when an
  absent town is a genuine 0, e.g. never passed an override — not when it's missing data).
"""
from __future__ import annotations
import argparse
import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MUNI = REPO / "data" / "ma_municipalities.geojson"


def normalize_name(raw: str) -> str:
    if not raw:
        return ""
    name = str(raw).split(",")[0].strip()
    suffixes = (" town", " city", " borough", " plantation", " CDP", " (balance)")
    changed = True
    while changed:
        changed = False
        for s in suffixes:
            if name.lower().endswith(s.lower()):
                name = name[: -len(s)].strip()
                changed = True
                break
    return name.upper()


def load_town_index() -> dict[str, str]:
    g = json.loads(MUNI.read_text(encoding="utf-8"))
    idx = {}
    for f in g["features"]:
        p = f["properties"]
        tid = str(p.get("TOWN_ID"))
        for key in (p.get("TOWN"), p.get("town_display"), p.get("TOWN_DISPLAY")):
            if key:
                idx[normalize_name(key)] = tid
    return idx


def read_rows(path: Path, sheet):
    if path.suffix.lower() in (".xlsx", ".xls"):
        try:
            import pandas as pd
        except ImportError:
            sys.exit("Reading Excel needs pandas + openpyxl:  pip install pandas openpyxl")
        sh = int(sheet) if (sheet and str(sheet).isdigit()) else (sheet or 0)
        df = pd.read_excel(path, sheet_name=sh, dtype=str).fillna("")
        return list(df.columns), df.to_dict("records")
    with open(path, encoding="utf-8-sig", newline="") as fh:
        r = csv.DictReader(fh)
        return (r.fieldnames or []), list(r)


def to_number(v):
    if v is None:
        return None
    s = str(v).strip().replace(",", "").replace("$", "").replace("%", "")
    if s.lower() in ("", "-", "n/a", "na", "none"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--town-col", required=True)
    ap.add_argument("--value-col", required=True)
    ap.add_argument("--metric-id", required=True)
    ap.add_argument("--sheet", default=None, help="Excel sheet index or name")
    ap.add_argument("--agg", choices=["first", "sum", "count", "max"], default="first")
    ap.add_argument("--zero-fill", action="store_true")
    args = ap.parse_args()

    path = REPO / args.file if not Path(args.file).is_absolute() else Path(args.file)
    if not path.exists():
        sys.exit(f"file not found: {path}  (download it into data/raw/ first)")

    cols, rows = read_rows(path, args.sheet)
    missing = [c for c in (args.town_col, args.value_col) if c not in cols]
    if missing:
        print(f"column(s) not found: {missing}\ncolumns in this file:")
        for c in cols:
            print("   ", repr(c))
        return 2

    town_idx = load_town_index()
    agg: dict[str, float | None] = {}
    unmatched: set[str] = set()
    for row in rows:
        tid = town_idx.get(normalize_name(row.get(args.town_col)))
        if not tid:
            if str(row.get(args.town_col) or "").strip():
                unmatched.add(str(row.get(args.town_col)).strip())
            continue
        v = to_number(row.get(args.value_col))
        if args.agg == "count":
            agg[tid] = (agg.get(tid) or 0) + (1 if str(row.get(args.value_col) or "").strip() else 0)
        elif v is None:
            agg.setdefault(tid, None)
        elif args.agg == "sum":
            agg[tid] = (agg.get(tid) or 0) + v
        elif args.agg == "max":
            agg[tid] = v if agg.get(tid) is None else max(agg[tid], v)
        else:  # first
            if agg.get(tid) is None:
                agg[tid] = v

    if args.zero_fill:
        for tid in set(town_idx.values()):
            agg.setdefault(tid, 0)

    out = {tid: {args.metric_id: (round(v, 4) if isinstance(v, float) else v)}
           for tid, v in agg.items() if v is not None}
    out_path = REPO / "data" / f"ma_muni_{args.metric_id}.json"
    out_path.write_text(json.dumps(out, indent=1), encoding="utf-8")

    print(f"wrote {out_path.relative_to(REPO)}: {len(out)} towns "
          f"({100*len(out)//351}% of 351)")
    if unmatched:
        print(f"  {len(unmatched)} unmatched town name(s) — fix these in the file or "
              f"tell me to add aliases: {sorted(unmatched)[:8]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
