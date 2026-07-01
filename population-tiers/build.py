#!/usr/bin/env python3
"""
Build a unified list of US + Puerto Rico + Canada municipalities with population >= 25,000,
tiered:  Tier 1 (>=100,000) and Tier 2 (25,000-99,999).

Sources (all authoritative, government/open):
  US   : Census Bureau Vintage 2024 Subcounty Population Estimates (POPESTIMATE2024)
         - Incorporated places (SUMLEV 162); consolidated cities appear here as their
           "(balance)" place record (the non-overlapping figure; the SUMLEV 170 full
           total is skipped since its sub-cities are listed separately).
         - PLUS New England town-level municipalities (SUMLEV 061, active MCDs) for
           CT, ME, MA, NH, RI, VT, where the "town" IS the general-purpose municipality.
  PR   : 2020 Decennial Census municipio (county-equivalent) populations.
  CA   : Statistics Canada 2021 Census, population & dwelling counts, census subdivisions.
  Coords: US Census 2024 Gazetteer (places, county subdivisions, counties); GeoNames for CA.

Download these into ./data/ before running (no API key needed):
  sub-est2024.csv   https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv
  2024_Gaz_place_national.txt    (from 2024_Gaz_place_national.zip)
  2024_Gaz_cousubs_national.txt  (from 2024_Gaz_cousubs_national.zip)
  2024_Gaz_counties_national.txt (from 2024_Gaz_counties_national.zip)
      https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/
  98100002.csv      from https://www150.statcan.gc.ca/n1/tbl/csv/98100002-eng.zip
  cities15000.txt   from https://download.geonames.org/export/dump/cities15000.zip
"""
import csv, re, json, os

DATA = os.path.join(os.path.dirname(__file__), "data")
OUT  = os.path.dirname(__file__)

def rd(path, enc="latin-1"):
    return list(csv.DictReader(open(os.path.join(DATA, path), encoding=enc)))

# ---------- coordinate lookups ----------
def load_gaz(path, key_fields):
    d = {}
    for row in csv.DictReader(open(os.path.join(DATA, path), encoding="latin-1"), delimiter="\t"):
        row = { (k.strip() if k else k): (v.strip() if isinstance(v, str) else v) for k, v in row.items() }
        gid = row.get("GEOID")
        try:
            lat = float(row["INTPTLAT"]); lon = float(row["INTPTLONG"])
        except (KeyError, ValueError, TypeError):
            continue
        d[gid] = (lat, lon)
    return d

place_coords  = load_gaz("2024_Gaz_place_national.txt", "GEOID")   # 7-digit STATE+PLACE
cousub_coords = load_gaz("2024_Gaz_cousubs_national.txt", "GEOID") # 10-digit STATE+COUNTY+COUSUB
county_coords = load_gaz("2024_Gaz_counties_national.txt", "GEOID")# 5-digit STATE+COUNTY

# county coords keyed by name for PR municipio matching (gazetteer is UTF-8)
pr_county_coords = {}
for row in csv.DictReader(open(os.path.join(DATA, "2024_Gaz_counties_national.txt"), encoding="utf-8"), delimiter="\t"):
    row = { (k.strip() if k else k): (v.strip() if isinstance(v, str) else v) for k, v in row.items() }
    if row.get("USPS") == "PR":
        try:
            lat = float(row["INTPTLAT"]); lon = float(row["INTPTLONG"])
        except (ValueError, KeyError):
            continue
        nm = re.sub(r"\s+Municipio$", "", row["NAME"]).strip()
        pr_county_coords[nm.lower()] = (lat, lon)

STATE_FIPS_ABBR = {
 '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
 '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
 '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT',
 '31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
 '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT',
 '50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY','72':'PR'}

NE = {'09','23','25','33','44','50'}  # New England states
# Census appends exactly one LSAD suffix (lowercase in the NAME field), e.g. "Jersey City city",
# "New York city", "Brookline town". Strip it ONCE and case-sensitively so real name parts like
# the "City" in "Jersey City"/"Kansas City"/"Oklahoma City" are preserved.
SUFFIX = re.compile(r"\s+(city|town|village|borough|municipality|CDP|comunidad|"
                    r"zona urbana)$")

# explicit friendly names for consolidated-government places
CONSOL_NAMES = {
    "Louisville/Jefferson County metro government": "Louisville",
    "Nashville-Davidson metropolitan government": "Nashville",
    "Augusta-Richmond County consolidated government": "Augusta",
    "Athens-Clarke County unified government": "Athens",
    "Macon-Bibb County": "Macon",
}
def clean(name):
    base = re.sub(r"\s*\(balance\)$", "", name).strip()
    if base in CONSOL_NAMES:
        return CONSOL_NAMES[base]
    return SUFFIX.sub("", base).strip()

def tier(pop):
    return 1 if pop >= 100000 else 2

records = []

# ---------- US ----------
us = rd("sub-est2024.csv")
def pop24(r):
    try: return int(r["POPESTIMATE2024"])
    except: return 0

included_place_names = set()  # (state, cleanname) to dedupe NE towns vs cities

for r in us:
    sl = r["SUMLEV"]; st = r["STATE"]; pop = pop24(r)
    if pop < 25000: continue
    # Incorporated places only (SUMLEV 162). Consolidated cities appear here as the
    # "(balance)" place record, which is the non-overlapping figure (the standard
    # Census/Wikipedia convention) since their semi-independent sub-cities are listed
    # separately; the SUMLEV 170 full-consolidated record is intentionally skipped.
    if sl == "162":
        geoid = st + r["PLACE"]
        coords = place_coords.get(geoid)
        name = clean(r["NAME"])
        included_place_names.add((st, name.lower()))
        is_bal = "(balance)" in r["NAME"]
        records.append({
            "name": name, "raw_name": r["NAME"], "state": STATE_FIPS_ABBR.get(st, st),
            "country": "US", "population": pop, "pop_year": 2024,
            "tier": tier(pop),
            "type": "consolidated city (balance)" if is_bal else "incorporated place",
            "geoid": geoid,
            "lat": coords[0] if coords else None, "lon": coords[1] if coords else None,
        })

# New England towns (active MCDs), deduped against included places
for r in us:
    if r["SUMLEV"] != "061": continue
    st = r["STATE"]
    if st not in NE: continue
    if r["FUNCSTAT"] == "F":  # fictitious MCD coextensive with a city already captured
        continue
    pop = pop24(r)
    if pop < 25000: continue
    name = clean(r["NAME"])
    if (st, name.lower()) in included_place_names:
        continue
    geoid = st + r["COUNTY"] + r["COUSUB"]
    coords = cousub_coords.get(geoid)
    records.append({
        "name": name, "raw_name": r["NAME"], "state": STATE_FIPS_ABBR.get(st, st),
        "country": "US", "population": pop, "pop_year": 2024,
        "tier": tier(pop), "type": "New England town (MCD)",
        "geoid": geoid,
        "lat": coords[0] if coords else None, "lon": coords[1] if coords else None,
    })

# ---------- Puerto Rico (2020 Census municipios) ----------
PR_2020 = {
 "Adjuntas":18020,"Aguada":38136,"Aguadilla":55101,"Aguas Buenas":24223,"Aibonito":24637,
 "Añasco":25596,"Arecibo":87754,"Barceloneta":22657,"Barranquitas":28983,"Bayamón":185187,
 "Cabo Rojo":47158,"Caguas":127244,"Camuy":32827,"Canóvanas":42337,"Carolina":154815,
 "Cataño":23155,"Cayey":41652,"Ciales":16984,"Cidra":39970,"Coamo":34668,"Comerío":18883,
 "Corozal":34571,"Dorado":35879,"Fajardo":32124,"Guánica":13787,"Guayama":36614,
 "Guayanilla":17784,"Guaynabo":89780,"Gurabo":40622,"Hatillo":38486,"Hormigueros":15654,
 "Humacao":50896,"Isabela":42943,"Jayuya":14779,"Juana Díaz":46538,"Juncos":37012,
 "Lajas":23334,"Lares":28105,"Las Marías":8874,"Las Piedras":35180,"Loíza":23693,
 "Luquillo":17781,"Manatí":39492,"Maricao":4755,"Maunabo":10589,"Mayagüez":73077,
 "Moca":37460,"Morovis":28727,"Naguabo":23386,"Naranjito":29241,"Orocovis":21434,
 "Patillas":15985,"Peñuelas":20399,"Ponce":137491,"Quebradillas":23638,"Rincón":15187,
 "Río Grande":47060,"Sabana Grande":22729,"Salinas":25789,"San Germán":31879,
 "San Juan":342259,"San Lorenzo":37693,"San Sebastián":39345,"Santa Isabel":20281,
 "Toa Alta":66852,"Toa Baja":75293,"Trujillo Alto":67740,"Utuado":28287,"Vega Alta":35395,
 "Vega Baja":54414,"Vieques":8249,"Villalba":22093,"Yabucoa":30412,"Yauco":34172,
}
for name, pop in PR_2020.items():
    if pop < 25000: continue
    coords = pr_county_coords.get(name.lower())
    records.append({
        "name": name, "raw_name": name + " Municipio", "state": "PR",
        "country": "US", "population": pop, "pop_year": 2020,
        "tier": tier(pop), "type": "municipio",
        "geoid": None,
        "lat": coords[0] if coords else None, "lon": coords[1] if coords else None,
    })

# ---------- Canada (2021 Census subdivisions) ----------
PRUID = {'10':'NL','11':'PE','12':'NS','13':'NB','24':'QC','35':'ON','46':'MB','47':'SK',
         '48':'AB','59':'BC','60':'YT','61':'NT','62':'NU'}
ca_rows = list(csv.reader(open(os.path.join(DATA, "98100002.csv"), encoding="utf-8-sig")))
ca_records = []
for r in ca_rows[1:]:
    if len(r) < 5: continue
    geo, dg = r[1], r[2]
    if not dg.startswith("2021A0005"):  # CSD schema
        continue
    try: pop = int(r[4])
    except: continue
    if pop < 25000: continue
    sgc = dg[len("2021A0005"):]          # 7-digit SGC: PR(2)+CD(2)+CSD(3)
    prov = PRUID.get(sgc[:2], sgc[:2])
    ca_records.append({
        "name": geo, "raw_name": geo, "state": prov, "country": "CA",
        "population": pop, "pop_year": 2021, "tier": tier(pop),
        "type": "census subdivision", "geoid": sgc,
        "lat": None, "lon": None, "_prov": prov,
    })

# join Canada coords from GeoNames (by name + admin1 province code) if available
geo_path = os.path.join(DATA, "cities15000.txt")
GN_ADMIN1 = {'01':'AB','02':'BC','03':'MB','04':'NB','05':'NL','07':'NS','08':'ON','09':'PE',
             '10':'QC','11':'SK','12':'YT','13':'NT','14':'NU'}
gn = {}
if os.path.exists(geo_path):
    for line in open(geo_path, encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 15 or f[8] != "CA": continue
        name = f[1]; asci = f[2]; lat = f[4]; lon = f[5]; admin1 = f[10]
        prov = GN_ADMIN1.get(admin1)
        for nm in {name, asci}:
            gn[(nm.lower(), prov)] = (float(lat), float(lon))
def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())
gn_norm = { (norm(k[0]), k[1]): v for k, v in gn.items() }
for rec in ca_records:
    key = (rec["name"].lower(), rec["_prov"])
    coords = gn.get(key) or gn_norm.get((norm(rec["name"]), rec["_prov"]))
    if coords:
        rec["lat"], rec["lon"] = coords
    rec.pop("_prov", None)
records.extend(ca_records)

# ---------- GeoNames coordinate fallback for anything still missing ----------
# Index GeoNames cities by normalized name within a country group.
def norm2(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())
gn_by_country = {}  # country2 -> {normname: (pop, lat, lon)}
if os.path.exists(geo_path):
    for line in open(geo_path, encoding="utf-8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 15: continue
        cc = f[8]
        try:
            lat = float(f[4]); lon = float(f[5]); gpop = int(f[14])
        except ValueError:
            continue
        d = gn_by_country.setdefault(cc, {})
        names = {f[1], f[2]}
        names.update(a for a in f[3].split(",") if a)   # alternate names
        for nm in names:
            k = norm2(nm)
            if k and (k not in d or gpop > d[k][0]):
                d[k] = (gpop, lat, lon)

def gn_fallback(rec):
    ccs = ["CA"] if rec["country"] == "CA" else ["US", "PR"]
    n = rec["name"]
    cand_names = [n,
                  n.split("/")[0].strip(),
                  re.split(r"\s+(?:County|Municipality|metro|metropolitan|consolidated|"
                           r"unified|government)\b", n, 1)[0].strip(),
                  n.split("-")[0].strip()]
    seen = set()
    for cc in ccs:
        d = gn_by_country.get(cc, {})
        for nm in cand_names:
            k = norm2(nm)
            if not k or k in seen: continue
            seen.add(k)
            hit = d.get(k)
            if hit:
                return hit[1], hit[2]
    return None

# tag existing coord sources
for r in records:
    if r.get("coord_source"):
        continue
    r["coord_source"] = "census_gazetteer" if r["lat"] is not None else ""

filled = 0
for r in records:
    if r["lat"] is None:
        c = gn_fallback(r)
        if c:
            r["lat"], r["lon"] = c
            r["coord_source"] = "geonames"
            filled += 1
print("geonames fallback filled:", filled)

# Curated administrative-seat coordinates for Canadian amalgamated / rural municipalities
# whose official census-subdivision name has no matching populated place (approximate).
CA_APPROX = {
 ("Clarington","ON"):(43.9120,-78.6880), ("Strathcona County","AB"):(53.5350,-113.2960),
 ("Cape Breton","NS"):(46.1351,-60.1831), ("Kawartha Lakes","ON"):(44.3550,-78.7420),
 ("Wood Buffalo","AB"):(56.7264,-111.3810), ("Haldimand County","ON"):(42.9500,-79.8500),
 ("Georgina","ON"):(44.2340,-79.4660), ("New Tecumseth","ON"):(44.1520,-79.8660),
 ("Bradford West Gwillimbury","ON"):(44.1140,-79.5630), ("Rocky View County","AB"):(51.2100,-114.2000),
 ("Lakeshore","ON"):(42.2930,-82.7080), ("Parkland County","AB"):(53.5200,-114.3300),
 ("Centre Wellington","ON"):(43.7060,-80.3770), ("King","ON"):(43.9250,-79.5280),
 ("Fort Saskatchewan","AB"):(53.7128,-113.2140), ("Woolwich","ON"):(43.5990,-80.5570),
 ("Lincoln","ON"):(43.1680,-79.4780), ("Lunenburg","NS"):(44.3780,-64.5220),
}
cur = 0
for r in records:
    if r["lat"] is None:
        c = CA_APPROX.get((r["name"], r["state"]))
        if c:
            r["lat"], r["lon"] = c
            r["coord_source"] = "approx_seat"
            cur += 1
print("curated approx filled:", cur)

# disambiguate the two BC name collisions (City vs District/Township are distinct CSDs)
BC_DISAMBIG = {  # (name, state, population) -> suffix
    ("Langley","BC"): {"larger":" (Township)","smaller":" (City)"},
    ("North Vancouver","BC"): {"larger":" (District)","smaller":" (City)"},
}
for key, suf in BC_DISAMBIG.items():
    grp = [r for r in records if (r["name"],r["state"])==key]
    if len(grp)==2:
        grp.sort(key=lambda r:-r["population"])
        grp[0]["name"] += suf["larger"]
        grp[1]["name"] += suf["smaller"]

# ---------- output ----------
records.sort(key=lambda x: (-x["population"], x["name"]))
cols = ["name","official_name","state","country","population","pop_year","tier","type","geoid","lat","lon","coord_source"]
for r in records:
    r["official_name"] = r.get("raw_name", r["name"])
with open(os.path.join(OUT, "towns.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in records:
        w.writerow(r)

# GeoJSON (points) for mapping / clustering work
features = []
for r in records:
    if r["lat"] is None:
        continue
    features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [round(r["lon"],6), round(r["lat"],6)]},
        "properties": {k: r[k] for k in
            ["name","official_name","state","country","population","pop_year","tier","type","geoid","coord_source"]},
    })
with open(os.path.join(OUT, "towns.geojson"), "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False)

# summary
from collections import Counter
by_ct = Counter(r["country"] for r in records)
by_tier = Counter((r["country"], r["tier"]) for r in records)
missing_coords = sum(1 for r in records if r["lat"] is None)
print("TOTAL:", len(records))
print("by country:", dict(by_ct))
for k in sorted(by_tier): print("  ", k, by_tier[k])
print("missing coords:", missing_coords)
print("  missing by country:", dict(Counter(r["country"] for r in records if r["lat"] is None)))
