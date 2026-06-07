#!/usr/bin/env python3
"""
run_all.py
==========
Run every Concord downloader in sequence, then print a per-layer feature-count
report — a full data pull in one command.

    python run_all.py               # download everything, then report
    python run_all.py --report-only # just tally what's already in data/
    python run_all.py --overture    # include the Overture business layer
    python run_all.py --all-apis    # include key-gated API sources

Each downloader is run as a subprocess so one failure can't abort the rest.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))


def run(cmd: list) -> None:
    print(f"\n=== {' '.join(cmd)} ===", file=sys.stderr)
    try:
        subprocess.run([sys.executable, *cmd], cwd=HERE, check=False)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! runner error: {exc}", file=sys.stderr)


def feature_count(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and d.get("type") == "FeatureCollection":
            return str(len(d.get("features", [])))
        return "—"
    except Exception:  # noqa: BLE001
        return "ERR"


def report() -> None:
    print("\n\n================  FEATURE-COUNT REPORT  ================", file=sys.stderr)
    grand = 0
    for sub in sorted(os.listdir(DATA)) if os.path.isdir(DATA) else []:
        d = os.path.join(DATA, sub)
        if not os.path.isdir(d):
            continue
        files = []
        for root, _, names in os.walk(d):
            for n in sorted(names):
                if n.endswith(".geojson"):
                    files.append(os.path.join(root, n))
        if not files:
            continue
        print(f"\n[{sub}]  {len(files)} layers", file=sys.stderr)
        for fp in files:
            c = feature_count(fp)
            if c.isdigit():
                grand += int(c)
            rel = os.path.relpath(fp, d)
            print(f"   {c:>8}  {rel}", file=sys.stderr)
    print(f"\nTOTAL features across all GeoJSON layers: {grand}", file=sys.stderr)


def main(argv) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report-only", action="store_true")
    ap.add_argument("--overture", action="store_true", help="include Overture business layer")
    ap.add_argument("--all-apis", action="store_true", help="include key-gated API sources")
    args = ap.parse_args(argv)

    if not args.report_only:
        run(["download_concord.py"])
        run(["download_external.py"])
        run(["download_osm.py"])
        run(["download_apis.py"] + (["--all"] if args.all_apis else []))
        run(["download_schools.py"])
        run(["download_knowledge.py"])
        biz = ["download_businesses.py"] + (["--overture"] if args.overture else [])
        run(biz)
        run(["build_layer_index.py"])

    report()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
