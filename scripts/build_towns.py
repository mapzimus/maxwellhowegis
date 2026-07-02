#!/usr/bin/env python3
"""Build the tier-4 "every town" layer for the fantasy transit network.

Source: US Census Bureau Gazetteer Files — Places (national). A single national
tab-delimited file with a name, type, state, GEOID and an internal-point
(centroid) lat/lng for every incorporated place and CDP in the country.

Default output is every **incorporated place** (FUNCSTAT == 'A') in the 50
states + DC — 19,465 towns as of the 2024 gazetteer — written as a minified
GeoJSON FeatureCollection of tier-4 nodes to `transit/data/towns.geojson`.

Each town is joined to the Census **sub-county population estimates**
(SUB-EST, place-level SUMLEV 162) by GEOID, adding a `pop` property (latest
estimate year; null where no estimate exists, e.g. places incorporated after
the estimates base).

    python3 scripts/build_towns.py                 # incorporated places, 50 states + DC
    python3 scripts/build_towns.py --include-cdp    # add census-designated places (~32k total)
    python3 scripts/build_towns.py --year 2023      # pin a gazetteer vintage
    python3 scripts/build_towns.py --no-pop         # skip the population join

The raw gazetteer + estimates files are cached under scripts/.cache/
(gitignored) so re-runs are offline and fast. Only the derived towns.geojson
is committed.
"""
import argparse, csv, io, json, os, sys, urllib.request, zipfile

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

# FUNCSTAT codes accepted as real towns. Beyond the usual 'A' (active government):
# 'N' nonfunctioning legal entity (Washington DC — governed at district level),
# 'B' partially consolidated (Baton Rouge, Lafayette LA), and 'F' fictitious
# "(balance)" entities — the Census's records for consolidated cities such as
# Indianapolis, Nashville-Davidson, Louisville/Jefferson, Athens-Clarke.
# 'I' (inactive ghost towns) stays excluded. N/B/F records without a population
# match are skipped as duplicate shells (e.g. 'Louisville city' beside the metro
# government record that carries the actual population).
FUNCSTAT_OK = {"A", "N", "B", "F"}

# The gazetteer's internal point sits inside the legal boundary, which for a few
# water-heavy cities is far from the actual city (San Francisco's includes 185 sq mi
# of Pacific around the Farallon Islands, putting its point 34 mi offshore).
# Override the worst (>10 mi error) with downtown coordinates.
COORD_OVERRIDES = {
    "0667000": (37.7793, -122.4193),   # San Francisco, CA
    "2255000": (29.9511, -90.0715),    # New Orleans, LA (Lake Pontchartrain)
    "4817000": (27.7963, -97.3964),    # Corpus Christi, TX (bay annexations)
}


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


POP_URL = ("https://www2.census.gov/programs-surveys/popest/datasets/"
           "2020-2024/cities/totals/sub-est2024.csv")


def fetch_pop():
    """Return {GEOID: population} from the place-level (SUMLEV 162) rows of
    the Census sub-county estimates, using the latest POPESTIMATE column."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, "sub-est2024.csv")
    if not os.path.exists(path):
        print(f"downloading {POP_URL}", file=sys.stderr)
        with urllib.request.urlopen(POP_URL, timeout=180) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    pops = {}
    with open(path, encoding="latin-1", newline="") as f:
        reader = csv.DictReader(f)
        est_col = max(c for c in reader.fieldnames if c.startswith("POPESTIMATE"))
        for row in reader:
            if row["SUMLEV"] != "162":
                continue
            try:
                pops[row["STATE"] + row["PLACE"]] = int(row[est_col])
            except (ValueError, KeyError):
                continue
    print(f"population estimates: {len(pops):,} places ({est_col})", file=sys.stderr)
    return pops


def clean_name(name):
    name = name.strip()
    if name.endswith(" (balance)"):
        name = name[: -len(" (balance)")].strip()
    low = name.lower()
    for suf in SUFFIXES:
        if low.endswith(" " + suf):
            return name[: -(len(suf) + 1)].strip()
    return name


def build(year, include_cdp, with_pop=True):
    text = fetch(year)
    pops = fetch_pop() if with_pop else {}
    lines = text.splitlines()
    header = [h.strip() for h in lines[0].split("\t")]
    idx = {h: i for i, h in enumerate(header)}
    feats = []
    joined = 0
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
        if not is_cdp and func not in FUNCSTAT_OK:   # skip inactive ghost towns etc.
            continue
        geoid_pre = c[idx["GEOID"]]
        if func in ("N", "B", "F") and with_pop and geoid_pre not in pops:
            continue                                  # duplicate nonfunctioning shell
        try:
            lat = round(float(c[idx["INTPTLAT"]]), 5)
            lng = round(float(c[idx["INTPTLONG"]]), 5)
        except ValueError:
            continue
        if geoid_pre in COORD_OVERRIDES:
            lat, lng = COORD_OVERRIDES[geoid_pre]
        try:
            sqmi = round(float(c[idx["ALAND_SQMI"]]), 1)
        except (ValueError, KeyError):
            sqmi = None
        lsad = c[idx["LSAD"]]
        ptype = "cdp" if is_cdp else LSAD_TYPE.get(lsad, "place")
        name = clean_name(c[idx["NAME"]])
        kept[ptype if ptype in kept else "other"] += 1
        geoid = c[idx["GEOID"]]
        pop = pops.get(geoid)
        if pop is not None:
            joined += 1
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {"kind": "town", "name": name, "type": ptype,
                           "st": st, "geoid": geoid, "tier": 4, "pop": pop,
                           "sqmi": sqmi},
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
            "popSource": POP_URL if with_pop else None,
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
    if with_pop:
        print(f"  population joined: {joined:,}/{len(feats):,} "
              f"({100*joined/max(len(feats),1):.1f}%)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--include-cdp", action="store_true",
                    help="also include census-designated (unincorporated) places")
    ap.add_argument("--no-pop", action="store_true",
                    help="skip the population-estimates join")
    a = ap.parse_args()
    build(a.year, a.include_cdp, with_pop=not a.no_pop)
