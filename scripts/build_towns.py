#!/usr/bin/env python3
"""Build the tier-4 "every town" layer for the fantasy transit network.

Source: US Census Bureau Gazetteer Files — Places (national). A single national
tab-delimited file with a name, type, state, GEOID and an internal-point
(centroid) lat/lng for every incorporated place and CDP in the country.

Default output is every **incorporated place** (FUNCSTAT == 'A') in the 50
states + DC — 19,465 towns as of the 2024 gazetteer — written as a minified
GeoJSON FeatureCollection of tier-4 nodes to `transit/data/towns.geojson`.

    python3 scripts/build_towns.py                 # incorporated places, 50 states + DC
    python3 scripts/build_towns.py --include-cdp    # add census-designated places (~32k total)
    python3 scripts/build_towns.py --year 2023      # pin a gazetteer vintage

The raw gazetteer is cached under scripts/.cache/ (gitignored) so re-runs are
offline and fast. Only the derived towns.geojson is committed.
"""
import argparse, io, json, os, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "transit", "data", "towns.geojson")

TERRITORIES = {"PR", "VI", "GU", "MP", "AS"}

# Census LSAD code -> clean place type
LSAD_TYPE = {
    "25": "city", "43": "town", "47": "village", "21": "borough",
    "37": "municipality", "35": "township", "53": "city", "00": "place",
    "UG": "unified government", "CG": "consolidated government",
    "UC": "urban county", "MG": "metro government", "CN": "corporation",
}

# Trailing descriptors to strip from NAME (longest first) to get a clean label.
SUFFIXES = [
    "metropolitan government", "consolidated government", "unified government",
    "metro government", "city and borough", "municipality", "corporation",
    "government", "township", "borough", "village", "city", "town",
]


def gaz_url(year):
    return (f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
            f"{year}_Gazetteer/{year}_Gaz_place_national.zip")


def fetch(year):
    """Return the gazetteer text, downloading + caching the zip if needed."""
    os.makedirs(CACHE, exist_ok=True)
    zpath = os.path.join(CACHE, f"gaz_place_{year}.zip")
    if not os.path.exists(zpath):
        url = gaz_url(year)
        print(f"downloading {url}", file=sys.stderr)
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
        with open(zpath, "wb") as f:
            f.write(data)
    with zipfile.ZipFile(zpath) as z:
        name = next(n for n in z.namelist() if n.endswith(".txt"))
        return z.read(name).decode("latin-1")


def clean_name(name):
    low = name.lower()
    for suf in SUFFIXES:
        if low.endswith(" " + suf):
            return name[: -(len(suf) + 1)].strip()
    return name.strip()


def build(year, include_cdp):
    text = fetch(year)
    lines = text.splitlines()
    header = [h.strip() for h in lines[0].split("\t")]
    idx = {h: i for i, h in enumerate(header)}
    feats = []
    kept = {"city": 0, "town": 0, "village": 0, "borough": 0, "cdp": 0, "other": 0}
    for line in lines[1:]:
        c = [x.strip() for x in line.split("\t")]
        if len(c) < len(header):
            continue
        st = c[idx["USPS"]]
        func = c[idx["FUNCSTAT"]]
        if st in TERRITORIES:
            continue
        is_cdp = func == "S"
        if is_cdp and not include_cdp:
            continue
        if func not in ("A", "S"):        # skip inactive / statistical-other
            continue
        try:
            lat = round(float(c[idx["INTPTLAT"]]), 5)
            lng = round(float(c[idx["INTPTLONG"]]), 5)
        except ValueError:
            continue
        lsad = c[idx["LSAD"]]
        ptype = "cdp" if is_cdp else LSAD_TYPE.get(lsad, "place")
        name = clean_name(c[idx["NAME"]])
        kept[ptype if ptype in kept else "other"] += 1
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {"kind": "town", "name": name, "type": ptype,
                           "st": st, "geoid": c[idx["GEOID"]], "tier": 4},
        })

    fc = {
        "type": "FeatureCollection",
        "name": "US Fantasy Transit — Tier 4 Towns",
        "properties": {
            "generator": "scripts/build_towns.py",
            "schema": "fantasy-transit-towns-v1",
            "source": f"US Census {year} Gazetteer — Places (national)",
            "sourceUrl": gaz_url(year),
            "definition": ("incorporated places (FUNCSTAT=A)"
                           + (" + census-designated places" if include_cdp else "")
                           + ", 50 states + DC"),
            "count": len(feats),
        },
        "features": feats,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(fc, f, separators=(",", ":"))       # minified
    size = os.path.getsize(OUT)
    print(f"wrote {OUT}  ({len(feats):,} towns, {size/1e6:.2f} MB)")
    print("  by type:", {k: v for k, v in kept.items() if v})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--include-cdp", action="store_true",
                    help="also include census-designated (unincorporated) places")
    a = ap.parse_args()
    build(a.year, a.include_cdp)
