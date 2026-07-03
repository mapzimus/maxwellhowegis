#!/usr/bin/env python3
"""Build the tier-4 "every town" layer for the fantasy transit network.

Source: US Census Bureau Gazetteer Files — Places (national). A single national
tab-delimited file with a name, type, state, GEOID and an internal-point
(centroid) lat/lng for every incorporated place and CDP in the country.

Default output is every incorporated place, every CDP (unincorporated
community), the New England MCD towns, and Guam's villages — ~33k towns as of
the 2024 vintage — written as a minified GeoJSON FeatureCollection of tier-4
nodes to `transit/data/towns.geojson`.

Each incorporated place is joined to the Census **sub-county population
estimates** (SUB-EST, place-level SUMLEV 162) by GEOID; each CDP is joined to
its **2020 Census count** (TIGERweb POP100 — SUB-EST covers incorporated
places only). The `pop` property is null only where neither exists (places
defined after 2020).

    python3 scripts/build_towns.py                 # places + CDPs + New England MCD towns (default)
    python3 scripts/build_towns.py --no-cdp         # incorporated places only
    python3 scripts/build_towns.py --year 2023      # pin a gazetteer vintage
    python3 scripts/build_towns.py --no-pop         # skip the population join (also drops
                                                    # N/B/F consolidated-city records, which
                                                    # need populations to dedupe their shells)

The raw gazetteer + estimates files are cached under scripts/.cache/
(gitignored) so re-runs are offline and fast. Only the derived towns.geojson
is committed.
"""
import argparse, csv, io, json, math, os, sys, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
OUT = os.path.join(ROOT, "transit", "data", "towns.geojson")

TERRITORIES = {"VI", "MP", "AS"}      # PR included; GU seeded manually below

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
    "zona urbana", "comunidad",
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

# Hawaii and Puerto Rico have no incorporated places below the county/municipio
# level — their towns are all CDPs (PR: zonas urbanas + comunidades), so CDPs
# are included for HI + PR. Populations are backfilled one-to-one from Natural
# Earth populated places (pop_min ≈ city proper), since the Census sub-county
# estimates only cover incorporated places.
NE_PLACES = ("ne_10m_populated_places_simple.zip",
             "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places_simple.zip")

# Guam is absent from the national gazetteer entirely. Its 19 villages are
# every "town" on the island — seeded here with 2020 Census populations and
# village-center coordinates.
GUAM_PLACES = [
    ("Dededo", 44943, 13.5183, 144.8391), ("Yigo", 20539, 13.5360, 144.8880),
    ("Tamuning", 19685, 13.4880, 144.7810), ("Mangilao", 15476, 13.4543, 144.8032),
    ("Barrigada", 8875, 13.4708, 144.7999), ("Chalan Pago-Ordot", 7462, 13.4512, 144.7663),
    ("Yona", 6480, 13.4098, 144.7768), ("Mongmong-Toto-Maite", 6393, 13.4804, 144.7590),
    ("Santa Rita", 6084, 13.3861, 144.6739), ("Agat", 4515, 13.3839, 144.6577),
    ("Agana Heights", 3673, 13.4661, 144.7440), ("Talofofo", 3489, 13.3529, 144.7599),
    ("Sinajana", 2592, 13.4665, 144.7514), ("Inarajan", 2464, 13.2736, 144.7484),
    ("Asan", 2011, 13.4715, 144.7150), ("Merizo", 1706, 13.2660, 144.6720),
    ("Piti", 1454, 13.4626, 144.6961), ("Hagåtña", 943, 13.4757, 144.7489),
    ("Umatac", 754, 13.2895, 144.6642),
]


CDP_POP_URL = ("https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/"
               "Places_CouSub_ConCity_SubMCD/MapServer/5/query")


def fetch_cdp_pops():
    """GEOID -> 2020 Census population for every CDP, via the public TIGERweb
    REST layer (the SUB-EST estimates only cover incorporated places, so CDPs
    — 12.8k towns, including 100k+ suburbs like The Woodlands TX or
    Arlington VA — would otherwise have no population at all). Cached."""
    import urllib.parse, urllib.request
    path = os.path.join(CACHE, "cdp_pop2020.json")
    if os.path.exists(path):
        return {k: v for k, v in json.load(open(path)).items()}
    pops, offset = {}, 0
    print("fetching CDP 2020 populations from TIGERweb…", file=sys.stderr)
    while True:
        qs = urllib.parse.urlencode({
            "where": "1=1", "outFields": "GEOID,POP100",
            "returnGeometry": "false", "f": "json",
            "resultOffset": offset, "resultRecordCount": 2000,
        })
        with urllib.request.urlopen(f"{CDP_POP_URL}?{qs}", timeout=180) as r:
            d = json.load(r)
        feats = d.get("features", [])
        for f in feats:
            a = f["attributes"]
            if a.get("POP100"):
                pops[a["GEOID"]] = int(a["POP100"])
        offset += len(feats)
        if not d.get("exceededTransferLimit") or not feats:
            break
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w") as f:
        json.dump(pops, f)
    print(f"CDP populations: {len(pops):,} (2020 Census POP100)", file=sys.stderr)
    return pops


def ne_backfill_pops():
    """[(name, pop, lat, lng)] for US places from Natural Earth (pop_min)."""
    import struct, urllib.request, zipfile
    fname, url = NE_PLACES
    path = os.path.join(CACHE, fname)
    if not os.path.exists(path):
        print(f"downloading {url}", file=sys.stderr)
        with urllib.request.urlopen(url, timeout=180) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    z = zipfile.ZipFile(path)
    data = z.read([n for n in z.namelist() if n.endswith(".dbf")][0])
    nrec = struct.unpack("<I", data[4:8])[0]
    hlen, rlen = struct.unpack("<HH", data[8:12])
    fields, off = [], 32
    while data[off] != 0x0D:
        fields.append((data[off:off + 11].split(b"\0")[0].decode("latin-1"), data[off + 16]))
        off += 32
    out = []
    for i in range(nrec):
        rec = data[hlen + i * rlen: hlen + (i + 1) * rlen]
        vals, p = {}, 1
        for name, flen in fields:
            vals[name] = rec[p:p + flen].decode("utf-8", "replace").strip(); p += flen
        if vals.get("adm0name") in ("United States of America", "United States", "Puerto Rico"):
            pop = int(float(vals.get("pop_min") or 0)) or int(float(vals.get("pop_max") or 0))
            out.append((vals["name"], pop, float(vals["latitude"]), float(vals["longitude"])))
    return out


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
        raw = z.read(name)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("latin-1")


POP_URL = ("https://www2.census.gov/programs-surveys/popest/datasets/"
           "2020-2024/cities/totals/sub-est2024.csv")

# New England towns are minor civil divisions, not incorporated places — the
# places file has only the region's cities + CDPs (New Hampshire: 13 cities,
# while its 221 towns live in the county-subdivisions file). For these six
# states the MCD *is* the town, so active MCDs are added as towns, deduped
# against same-name places nearby.
COUSUB_STATES = {"CT", "ME", "MA", "NH", "RI", "VT"}


def cousub_url(year):
    return (f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
            f"{year}_Gazetteer/{year}_Gaz_cousubs_national.zip")


def fetch_cousubs(year):
    os.makedirs(CACHE, exist_ok=True)
    zpath = os.path.join(CACHE, f"gaz_cousubs_{year}.zip")
    if not os.path.exists(zpath):
        url = cousub_url(year)
        print(f"downloading {url}", file=sys.stderr)
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
        with open(zpath, "wb") as f:
            f.write(data)
    with zipfile.ZipFile(zpath) as z:
        name = next(n for n in z.namelist() if n.endswith(".txt"))
        raw = z.read(name)
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.decode("latin-1")


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
    pops, mcd_pops = {}, {}
    with open(path, encoding="latin-1", newline="") as f:
        reader = csv.DictReader(f)
        est_col = max(c for c in reader.fieldnames if c.startswith("POPESTIMATE"))
        for row in reader:
            try:
                if row["SUMLEV"] == "162":
                    pops[row["STATE"] + row["PLACE"]] = int(row[est_col])
                elif row["SUMLEV"] == "061":
                    mcd_pops[row["STATE"] + row["COUNTY"] + row["COUSUB"]] = int(row[est_col])
            except (ValueError, KeyError):
                continue
    print(f"population estimates: {len(pops):,} places, {len(mcd_pops):,} MCDs "
          f"({est_col})", file=sys.stderr)
    return pops, mcd_pops


def clean_name(name, is_cdp=False):
    name = name.strip()
    if name.endswith(" (balance)"):
        name = name[: -len(" (balance)")].strip()
    if name.endswith(" CDP"):
        name = name[: -len(" CDP")].strip()
    if is_cdp:
        # a CDP's proper name may legitimately end in "City"/"Village"
        # (Sun City, Grand Canyon Village) — only the " CDP" marker is a
        # type suffix; stripping further corrupts ~240 real names
        return name
    low = name.lower()
    for suf in SUFFIXES:
        if low.endswith(" " + suf):
            return name[: -(len(suf) + 1)].strip()
    return name


def build(year, include_cdp, with_pop=True):
    text = fetch(year)
    pops, mcd_pops = fetch_pop() if with_pop else ({}, {})
    cdp_pops = fetch_cdp_pops() if with_pop else {}
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
        if is_cdp and not include_cdp and st not in ("HI", "PR"):
            continue                       # HI/PR towns are all CDPs
        if not is_cdp and func not in FUNCSTAT_OK:   # skip inactive ghost towns etc.
            continue
        geoid_pre = c[idx["GEOID"]]
        if func in ("N", "B", "F") and (not with_pop or geoid_pre not in pops):
            continue      # duplicate nonfunctioning shell (needs pops to dedupe,
                          # so N/B/F records are skipped entirely under --no-pop)
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
        name = clean_name(c[idx["NAME"]], is_cdp)
        kept[ptype if ptype in kept else "other"] += 1
        geoid = c[idx["GEOID"]]
        # incorporated places: SUB-EST 2024 estimates; CDPs: 2020 Census
        # POP100 (SUB-EST is incorporated-only, and an unpopulated dot would
        # also be invisible to the network's tier cuts)
        pop = cdp_pops.get(geoid) if is_cdp else pops.get(geoid)
        if pop is not None:
            joined += 1
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {"kind": "town", "name": name, "type": ptype,
                           "st": st, "geoid": geoid, "tier": 4, "pop": pop,
                           "sqmi": sqmi},
        })

    # New England towns from the county-subdivisions gazetteer
    ne_added = 0
    coord_seen = {tuple(f["geometry"]["coordinates"]) for f in feats}
    by_name_st = {}
    for f in feats:
        p = f["properties"]
        by_name_st.setdefault((p["name"].lower(), p["st"]), []).append(f)
    for line in fetch_cousubs(year).splitlines()[1:]:
        c = [x.strip() for x in line.split("\t")]
        if len(c) < 10 or c[0] not in COUSUB_STATES or c[4] != "A":
            continue
        geoid = c[1]
        pop = mcd_pops.get(geoid) if with_pop else None
        if with_pop and not pop:
            continue                                  # uninhabited grants/gores
        name = clean_name(c[3])
        try:
            lat, lng = round(float(c[-2]), 5), round(float(c[-1]), 5)
        except ValueError:
            continue
        dup = (lng, lat) in coord_seen                # exact-coordinate collision
        for f in by_name_st.get((name.lower(), c[0]), []):
            if dup:
                break
            fl = f["geometry"]["coordinates"]
            if math.hypot((fl[1] - lat) * 69.0, (fl[0] - lng) * 51.0) < 8.0:
                dup = True                            # city/CDP already covers it
                                                      # (8 mi: Jonesport ME's CDP
                                                      # sits 6.6 mi from its MCD)
        if dup:
            continue
        feat = {"type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {"kind": "town", "name": name, "type": "town",
                               "st": c[0], "geoid": geoid, "tier": 4, "pop": pop,
                               "sqmi": None}}
        feats.append(feat)
        coord_seen.add((lng, lat))
        by_name_st.setdefault((name.lower(), c[0]), []).append(feat)
        kept["town"] += 1
        if pop:
            joined += 1
        ne_added += 1
    print(f"New England MCD towns added: {ne_added}", file=sys.stderr)

    # HI/PR population backfill from Natural Earth — one-to-one: each NE place
    # populates only its single nearest unfilled CDP, so a big city's figure
    # can't smear across its neighbors.
    # Guam (absent from the gazetteer): seed its 19 villages — BEFORE the NE
    # backfill below, so its HI/PR/GU island branch can actually see them
    # (their pops are hardcoded, so the backfill treats them as filled)
    for i, (name, pop, lat, lng) in enumerate(GUAM_PLACES, 1):
        kept["village"] += 1
        joined += 1
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lng, 5), round(lat, 5)]},
            "properties": {"kind": "town", "name": name, "type": "village",
                           "st": "GU", "geoid": f"GU{i:03d}", "tier": 4, "pop": pop,
                           "sqmi": None},
        })

    if with_pop:
        cands = feats            # nationwide: big CDPs (Arlington VA, Metairie,
                                 # Paradise NV...) have no Census estimates
        filled = 0
        for name_ne, pop_ne, la, lo in sorted(ne_backfill_pops(), key=lambda x: -x[1]):
            if not pop_ne:
                continue
            # prefer the place whose name MATCHES the NE record ("Honolulu" ->
            # "Urban Honolulu", exact or exact-with-prefix, never substring —
            # substring matching smeared big-city populations onto unrelated
            # neighbors like "West <City>" CDPs). If the named place is already
            # filled, this NE row duplicates a covered city: skip it. The
            # nearest-unfilled fallback only applies on the estimate-less
            # islands (HI/PR/GU), where whole regions lack Census estimates.
            def name_match(cand):
                a, b = cand["properties"]["name"].lower(), name_ne.lower()
                return a == b or a == "urban " + b or a.replace("-", " ") == b.replace("-", " ")
            best, bd, named, named_filled = None, 8.0, None, False
            for f in cands:
                lng, lat = f["geometry"]["coordinates"]
                d = math.hypot((la - lat) * 69.0, (lo - lng) * 63.0)
                if d >= 8.0:
                    continue
                if name_match(f):
                    if f["properties"]["pop"] is not None:
                        named_filled = True
                    elif named is None:
                        named = f
                if (f["properties"]["pop"] is None and d < bd
                        and f["properties"]["st"] in ("HI", "PR", "GU")):
                    best, bd = f, d
            target = named if named is not None else (None if named_filled else best)
            if target is not None:
                target["properties"]["pop"] = pop_ne
                joined += 1
                filled += 1
        print(f"NE population backfill for {filled} estimate-less places (one-to-one)", file=sys.stderr)

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
                           + ", 50 states + DC + PR + GU"),
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
    ap.add_argument("--no-cdp", action="store_true",
                    help="exclude census-designated (unincorporated) places")
    ap.add_argument("--no-pop", action="store_true",
                    help="skip the population-estimates join")
    a = ap.parse_args()
    build(a.year, include_cdp=not a.no_cdp, with_pop=not a.no_pop)
