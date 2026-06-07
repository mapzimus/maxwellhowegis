#!/usr/bin/env python3
"""
download_schools.py
===================
Pull comprehensive school data for the Concord, NH area — and crucially BOTH
districts that serve the city:

  * Concord School District (SAU 8)          GEOID/LEAID 3302460
  * Merrimack Valley School District (SAU 46) GEOID/LEAID 3304760
    — serves Penacook (northern Concord) plus Boscawen, Loudon, Salisbury, Webster

Because MVSD extends beyond the city, schools are pulled BY DISTRICT (full
coverage) as well as by a wider regional bbox (so surrounding-town schools and
neighboring districts show up "to a small extent").

Outputs (data/schools/):
  school_districts.geojson           the two district boundary polygons
  school_districts_region.geojson    all unified districts intersecting the region
  public_schools_districts.geojson   every public school in CSD + MVSD (by LEAID)
  public_schools_region.geojson      public schools across the wider region
  private_schools_region.geojson     private schools across the wider region
  enrollment_districts.csv           CCD district enrollment (Urban Institute API)
  enrollment_schools.csv             CCD per-school enrollment (the "big" table)

    python download_schools.py
    python download_schools.py --only public_schools_districts enrollment
    python download_schools.py --year 2022
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import urllib.parse
import urllib.request

import arcgis_to_geojson as a2g

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "data", "schools"))

# The two districts serving Concord (NCES LEAID == TIGER GEOID).
CONCORD_SD = "3302460"
MERRIMACK_VALLEY_SD = "3304760"
LEAIDS = [CONCORD_SD, MERRIMACK_VALLEY_SD]

# Wider "region" bbox: Concord + surrounding towns (Penacook, Boscawen, Loudon,
# Bow, Hopkinton, Canterbury, Pembroke, Chichester…).
REGION_BBOX = "-71.95,42.95,-71.30,43.50"

TIGER_SCHOOL = ("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
                "School/MapServer")
NCES_PUBLIC = ("https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/"
               "Public_School_Locations_Current/FeatureServer/0")
NCES_PRIVATE = ("https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/"
                "Private_School_Locations_Current/FeatureServer/0")
NCES_POSTSEC = ("https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/"
                "Postsecondary_School_Locations_Current/FeatureServer/0")
URBAN = "https://educationdata.urban.org/api/v1"
UA = {"User-Agent": "open-concord/1.0 (mhowe.gis@gmail.com)"}


def _progress(m):
    print(m, file=sys.stderr)


def school_districts() -> str:
    where = f"GEOID IN ('{CONCORD_SD}','{MERRIMACK_VALLEY_SD}')"
    n = a2g.download_to_file(f"{TIGER_SCHOOL}/0", os.path.join(OUT, "school_districts.geojson"),
                             where=where, progress=_progress)
    return f"school_districts.geojson  ({n} district polygons: Concord SD + MVSD)"


def school_districts_region() -> str:
    n = a2g.download_to_file(f"{TIGER_SCHOOL}/0",
                             os.path.join(OUT, "school_districts_region.geojson"),
                             bbox=REGION_BBOX, progress=_progress)
    return f"school_districts_region.geojson  ({n} unified districts in region)"


def public_schools_districts() -> str:
    where = f"LEAID IN ('{CONCORD_SD}','{MERRIMACK_VALLEY_SD}')"
    n = a2g.download_to_file(NCES_PUBLIC,
                             os.path.join(OUT, "public_schools_districts.geojson"),
                             where=where, progress=_progress)
    return f"public_schools_districts.geojson  ({n} public schools in CSD + MVSD)"


def public_schools_region() -> str:
    n = a2g.download_to_file(NCES_PUBLIC,
                             os.path.join(OUT, "public_schools_region.geojson"),
                             bbox=REGION_BBOX, progress=_progress)
    return f"public_schools_region.geojson  ({n} public schools in region)"


def private_schools_region() -> str:
    n = a2g.download_to_file(NCES_PRIVATE,
                             os.path.join(OUT, "private_schools_region.geojson"),
                             bbox=REGION_BBOX, progress=_progress)
    return f"private_schools_region.geojson  ({n} private schools in region; incl. St. Paul's)"


def colleges() -> str:
    """Postsecondary institutions (NHTI, UNH Franklin Pierce Law…) in the region."""
    n = a2g.download_to_file(NCES_POSTSEC,
                             os.path.join(OUT, "colleges.geojson"),
                             bbox=REGION_BBOX, progress=_progress)
    return f"colleges.geojson  ({n} colleges/universities in region)"


# --------------------------------------------------------------------------- #
# Urban Institute Education Data API (CCD enrollment) — the "big database"
# --------------------------------------------------------------------------- #
def _urban_paged(url: str, cap_pages: int = 60):
    """Follow Urban Institute API pagination, retrying its frequent slow/timeouts."""
    import time
    rows, page = [], 0
    while url and page < cap_pages:
        delay = 3.0
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=180) as r:
                    d = json.loads(r.read().decode("utf-8", "replace"))
                break
            except Exception:  # noqa: BLE001 - API is slow; retry with backoff
                if attempt == 3:
                    raise
                time.sleep(delay)
                delay *= 2
        rows.extend(d.get("results", []))
        url = d.get("next")
        page += 1
    return rows


def _write_csv(rows, name) -> int:
    if not rows:
        return 0
    keys = sorted({k for r in rows for k in r.keys()})
    with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    return len(rows)


def enrollment(year: int = 2022) -> str:
    out = []
    # District-level enrollment (grade-99 = all grades; broken out by race & sex)
    drows = []
    for leaid in LEAIDS:
        url = f"{URBAN}/school-districts/ccd/enrollment/{year}/grade-99/?leaid={leaid}"
        try:
            drows += _urban_paged(url)
        except Exception as exc:  # noqa: BLE001
            _progress(f"    (district enrollment {leaid} failed: {exc})")
    out.append(f"enrollment_districts.csv ({_write_csv(drows, 'enrollment_districts.csv')} rows)")
    # School-level enrollment for every school in the two districts (the big table)
    srows = []
    for leaid in LEAIDS:
        url = f"{URBAN}/schools/ccd/enrollment/{year}/grade-99/?fips=33&leaid={leaid}"
        try:
            srows += _urban_paged(url)
        except Exception as exc:  # noqa: BLE001
            _progress(f"    (school enrollment {leaid} failed: {exc})")
    out.append(f"enrollment_schools.csv ({_write_csv(srows, 'enrollment_schools.csv')} rows)")
    return f"CCD enrollment {year}: " + ", ".join(out)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
TASKS = {
    "school_districts": school_districts,
    "school_districts_region": school_districts_region,
    "public_schools_districts": public_schools_districts,
    "public_schools_region": public_schools_region,
    "private_schools_region": private_schools_region,
    "colleges": colleges,
    "enrollment": enrollment,
}


def main(argv) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", choices=list(TASKS))
    ap.add_argument("--year", type=int, default=2022, help="CCD enrollment year")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args(argv)

    if args.list:
        for k in TASKS:
            print(f"  {k}")
        return 0

    os.makedirs(OUT, exist_ok=True)
    selected = args.only or list(TASKS)
    ok = failed = 0
    for k in selected:
        try:
            print(f"  > {k} ...", file=sys.stderr)
            msg = TASKS[k](args.year) if k == "enrollment" else TASKS[k]()
            print(f"    {msg}", file=sys.stderr)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {k}: {exc}", file=sys.stderr)
            failed += 1
    print(f"\nDone. {ok} ok, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
