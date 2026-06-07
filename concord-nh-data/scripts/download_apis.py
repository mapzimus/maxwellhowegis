#!/usr/bin/env python3
"""
download_apis.py
================
Download Concord, NH data from non-ArcGIS public APIs (Census, USGS, EPA, CDC,
NREL, transit GTFS, etc.) and save as GeoJSON / CSV / raw files. Stdlib only.

    python download_apis.py --list           # show all sources + key requirements
    python download_apis.py                   # run every keyless source
    python download_apis.py --only census_acs epa_frs usgs_streamgages
    python download_apis.py --all             # include key-gated sources too

API keys are read from environment variables (all free to obtain):
    CENSUS_API_KEY     https://api.census.gov/data/key_signup.html   (recommended)
    NREL_API_KEY       https://developer.nrel.gov/signup/            (DEMO_KEY works)
    AIRNOW_API_KEY     https://docs.airnowapi.org/                   (required for AQI)
    PURPLEAIR_API_KEY  email contact@purpleair.com                  (required, header)

Output: concord-nh-data/data/apis/
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile
from typing import Any, Callable, Dict, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "data", "apis"))

# Concord / Merrimack County constants
LAT, LON = 43.207, -71.538
BBOX = {"xmin": -71.668185, "ymin": 43.151772, "xmax": -71.456903, "ymax": 43.309419}
STATE_FIPS, COUNTY_FIPS = "33", "013"          # NH, Merrimack
UA = {"User-Agent": "concord-gis/1.0 (+https://github.com/mapzimus/concord)"}


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
def _req(url: str, headers: Optional[Dict[str, str]] = None) -> bytes:
    h = dict(UA)
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def get_json(url: str, headers=None) -> Any:
    return json.loads(_req(url, headers).decode("utf-8", "replace"))


def get_text(url: str, headers=None) -> str:
    return _req(url, headers).decode("utf-8", "replace")


def save_json(obj: Any, name: str) -> str:
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    return p


def save_bytes(data: bytes, name: str) -> str:
    p = os.path.join(OUT, name)
    with open(p, "wb") as f:
        f.write(data)
    return p


def fc(features: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


def pt(lon: float, lat: float, props: Dict[str, Any]) -> Dict[str, Any]:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props}


def env(key: str) -> Optional[str]:
    v = os.environ.get(key)
    return v.strip() if v else None


# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #
def census_acs() -> str:
    """ACS 5-year (2023) selected variables for all Merrimack County tracts -> CSV."""
    k = env("CENSUS_API_KEY")
    if not k:
        return "SKIPPED (Census API now requires a key — set CENSUS_API_KEY)"
    vars_ = {
        "B01003_001E": "total_population",
        "B19013_001E": "median_household_income",
        "B25077_001E": "median_home_value",
        "B25064_001E": "median_gross_rent",
        "B01002_001E": "median_age",
        "B25001_001E": "housing_units",
        "B23025_005E": "unemployed",
        "B15003_022E": "bachelors_degree",
    }
    get = "NAME," + ",".join(vars_)
    # NOTE: the 'in' value is space-separated ("state:33 county:013"); urlencode
    # turns the space into '+' which the Census API expects (a literal '+' breaks it).
    qs = {"get": get, "for": "tract:*",
          "in": f"state:{STATE_FIPS} county:{COUNTY_FIPS}", "key": k}
    url = "https://api.census.gov/data/2023/acs/acs5?" + urllib.parse.urlencode(qs)
    rows = get_json(url)
    header, *data = rows
    # rename ACS codes to friendly labels, keep geography codes
    label = {h: vars_.get(h, h) for h in header}
    out = os.path.join(OUT, "census_acs_tracts.csv")
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([label[h] for h in header] + ["GEOID"])
        for r in data:
            rec = dict(zip(header, r))
            geoid = f"{rec['state']}{rec['county']}{rec['tract']}"
            w.writerow(r + [geoid])
    return f"{out}  ({len(data)} tracts; join to tiger_tracts on GEOID)"


def epa_frs() -> str:
    """EPA FRS regulated facilities in Merrimack County, NH -> CSV.

    The Envirofacts frs_program_facility table is address-only (no lat/lon), so we
    de-duplicate the program rows by registry_id and collect each facility's EPA
    programs (RCRAINFO, NPDES, SEMS=Superfund, TRIS=TRI, ACRES=Brownfields, ...).
    For a point-geometry version use the EPA FRS ArcGIS layer in sources.json.
    """
    base = ("https://data.epa.gov/efservice/frs.frs_program_facility/"
            "county_name/equals/MERRIMACK/state_code/equals/NH/JSON")
    recs = get_json(base)
    facilities: Dict[str, Dict[str, Any]] = {}
    for r in recs if isinstance(recs, list) else []:
        rid = r.get("registry_id")
        if not rid:
            continue
        f = facilities.setdefault(rid, {
            "registry_id": rid,
            "primary_name": r.get("primary_name", ""),
            "address": r.get("location_address", ""),
            "city": r.get("city_name", ""),
            "postal_code": r.get("postal_code", ""),
            "county": r.get("county_name", ""),
            "site_type": r.get("site_type_name", ""),
            "programs": set(),
        })
        if r.get("pgm_sys_acrnm"):
            f["programs"].add(r["pgm_sys_acrnm"])
    out = os.path.join(OUT, "epa_frs_facilities.csv")
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["registry_id", "primary_name", "address", "city", "postal_code",
                    "county", "site_type", "programs"])
        for f in facilities.values():
            w.writerow([f["registry_id"], f["primary_name"], f["address"], f["city"],
                        f["postal_code"], f["county"], f["site_type"],
                        ";".join(sorted(f["programs"]))])
    return f"{out}  ({len(facilities)} unique facilities; address-only, geocode/join for points)"


def cdc_places() -> str:
    """CDC PLACES tract-level health measures for Merrimack County, NH -> GeoJSON."""
    url = ("https://data.cdc.gov/resource/cwsq-ngmh.json?"
           "stateabbr=NH&countyname=Merrimack&$limit=50000")
    recs = get_json(url)
    feats = []
    for r in recs:
        geo = r.get("geolocation") or {}
        coords = geo.get("coordinates")
        if not coords:
            continue
        feats.append(pt(coords[0], coords[1], r))
    p = save_json(fc(feats), "cdc_places_merrimack.geojson")
    return f"{p}  ({len(feats)} measure-rows; long format: one feature per measure per tract)"


def usgs_streamgages() -> str:
    """USGS NWIS active stream sites in Merrimack County + latest flow -> GeoJSON."""
    site_rdb = get_text("https://waterservices.usgs.gov/nwis/site/?format=rdb"
                        f"&countyCd={STATE_FIPS}{COUNTY_FIPS}&siteType=ST&hasDataTypeCd=iv")
    sites: Dict[str, Dict[str, Any]] = {}
    cols: List[str] = []
    for line in site_rdb.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("\t")
        if not cols:
            cols = parts
            continue
        if parts[0] == "5s":          # RDB type row
            continue
        rec = dict(zip(cols, parts))
        try:
            lat = float(rec["dec_lat_va"]); lon = float(rec["dec_long_va"])
        except (KeyError, ValueError):
            continue
        sites[rec["site_no"]] = {"site_no": rec["site_no"],
                                 "name": rec.get("station_nm", ""),
                                 "lat": lat, "lon": lon}
    # attach latest discharge (00060) + gage height (00065)
    try:
        iv = get_json("https://waterservices.usgs.gov/nwis/iv/?format=json"
                      f"&countyCd={STATE_FIPS}{COUNTY_FIPS}&parameterCd=00060,00065&siteStatus=active")
        for ts in iv.get("value", {}).get("timeSeries", []):
            sno = ts["sourceInfo"]["siteCode"][0]["value"]
            pcode = ts["variable"]["variableCode"][0]["value"]
            vals = ts.get("values", [{}])[0].get("value", [])
            if sno in sites and vals:
                key = "discharge_cfs" if pcode == "00060" else "gage_height_ft"
                sites[sno][key] = vals[-1].get("value")
                sites[sno]["as_of"] = vals[-1].get("dateTime")
    except Exception:  # noqa: BLE001 - latest values are a nice-to-have
        pass
    feats = [pt(s["lon"], s["lat"], s) for s in sites.values()]
    p = save_json(fc(feats), "usgs_streamgages.geojson")
    return f"{p}  ({len(feats)} active stream sites)"


def lodes() -> str:
    """LEHD LODES8 workplace-area jobs for NH (2023) + geography crosswalk -> .csv.gz."""
    base = "https://lehd.ces.census.gov/data/lodes/LODES8/nh"
    out = []
    for rel, name in [("wac/nh_wac_S000_JT00_2023.csv.gz", "lodes_nh_wac_2023.csv.gz"),
                      ("nh_xwalk.csv.gz", "lodes_nh_xwalk.csv.gz")]:
        save_bytes(_req(f"{base}/{rel}"), name)
        out.append(name)
    return ("data/apis/" + ", ".join(out) +
            "  (block-level; filter w_geocode starting 33013 for Merrimack)")


def cat_gtfs() -> str:
    """Concord Area Transit GTFS feed: save zip + extract stops & routes -> GeoJSON/CSV."""
    url = ("https://data.trilliumtransit.com/gtfs/concordareatransit-nh-us/"
           "concordareatransit-nh-us--flex-v2.zip")
    raw = _req(url)
    save_bytes(raw, "cat_gtfs.zip")
    z = zipfile.ZipFile(io.BytesIO(raw))
    names = z.namelist()
    msg = ["cat_gtfs.zip"]
    if "stops.txt" in names:
        rows = list(csv.DictReader(io.StringIO(z.read("stops.txt").decode("utf-8", "replace"))))
        feats = []
        for r in rows:
            try:
                feats.append(pt(float(r["stop_lon"]), float(r["stop_lat"]), r))
            except (KeyError, ValueError):
                continue
        save_json(fc(feats), "cat_stops.geojson")
        msg.append(f"cat_stops.geojson ({len(feats)} stops)")
    return "data/apis/" + ", ".join(msg)


def nrel_ev() -> str:
    """NREL AFDC EV charging stations within 25 mi of Concord -> GeoJSON."""
    key = env("NREL_API_KEY") or "DEMO_KEY"
    url = ("https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.geojson?"
           + urllib.parse.urlencode({"api_key": key, "latitude": LAT, "longitude": LON,
                                     "radius": 25, "fuel_type": "ELEC", "limit": 200}))
    data = get_json(url)
    n = len(data.get("features", []))
    p = save_json(data, "ev_charging_stations.geojson")
    return f"{p}  ({n} stations; key={'env' if env('NREL_API_KEY') else 'DEMO_KEY'})"


def tnm_products() -> str:
    """List USGS 3DEP 1m DEM + NAIP downloadable products for the Concord bbox -> JSON."""
    bbox = f"{BBOX['xmin']},{BBOX['ymin']},{BBOX['xmax']},{BBOX['ymax']}"
    out = {}
    for tag, ds in [("dem_1m", "Digital Elevation Model (DEM) 1 meter"),
                    ("naip", "USDA National Agriculture Imagery Program (NAIP)"),
                    ("lidar_lpc", "Lidar Point Cloud (LPC)")]:
        url = ("https://tnmaccess.nationalmap.gov/api/v1/products?"
               + urllib.parse.urlencode({"datasets": ds, "bbox": bbox,
                                         "outputFormat": "JSON", "max": 50}))
        try:
            items = get_json(url).get("items", [])
            out[tag] = [{"title": i.get("title"), "format": i.get("format"),
                         "sizeInBytes": i.get("sizeInBytes"),
                         "downloadURL": i.get("downloadURL")} for i in items]
        except Exception as e:  # noqa: BLE001
            out[tag] = {"error": str(e)}
    p = save_json(out, "tnm_products.json")
    counts = {k: (len(v) if isinstance(v, list) else "err") for k, v in out.items()}
    return f"{p}  (download URLs for raster/LiDAR products: {counts})"


def airnow() -> str:
    """EPA AirNow current AQI near Concord -> GeoJSON. Requires AIRNOW_API_KEY."""
    key = env("AIRNOW_API_KEY")
    if not key:
        return "SKIPPED (set AIRNOW_API_KEY)"
    url = ("https://www.airnowapi.org/aq/observation/latLong/current/?"
           + urllib.parse.urlencode({"format": "application/json", "latitude": LAT,
                                     "longitude": LON, "distance": 25, "API_KEY": key}))
    recs = get_json(url)
    feats = [pt(r.get("Longitude", LON), r.get("Latitude", LAT), r) for r in recs]
    p = save_json(fc(feats), "airnow_aqi.geojson")
    return f"{p}  ({len(feats)} observations)"


def purpleair() -> str:
    """PurpleAir sensors in the Concord bbox -> GeoJSON. Requires PURPLEAIR_API_KEY."""
    key = env("PURPLEAIR_API_KEY")
    if not key:
        return "SKIPPED (set PURPLEAIR_API_KEY)"
    fields = "name,latitude,longitude,pm2.5,pm2.5_60minute,humidity,temperature"
    url = ("https://api.purpleair.com/v1/sensors?"
           + urllib.parse.urlencode({"fields": fields, "nwlng": BBOX["xmin"],
                                     "nwlat": BBOX["ymax"], "selng": BBOX["xmax"],
                                     "selat": BBOX["ymin"]}))
    data = get_json(url, headers={"X-API-Key": key})
    cols = data.get("fields", [])
    li, lo = cols.index("latitude"), cols.index("longitude")
    feats = [pt(row[lo], row[li], dict(zip(cols, row))) for row in data.get("data", [])]
    p = save_json(fc(feats), "purpleair_sensors.geojson")
    return f"{p}  ({len(feats)} sensors)"


def pvwatts() -> str:
    """NREL PVWatts solar production estimate for Concord centroid -> JSON."""
    key = env("NREL_API_KEY") or "DEMO_KEY"
    url = ("https://developer.nrel.gov/api/pvwatts/v8.json?"
           + urllib.parse.urlencode({"api_key": key, "lat": LAT, "lon": LON,
                                     "system_capacity": 4, "azimuth": 180, "tilt": 40,
                                     "array_type": 1, "module_type": 0, "losses": 14}))
    data = get_json(url)
    p = save_json(data, "pvwatts_concord.json")
    ac = data.get("outputs", {}).get("ac_annual")
    return f"{p}  (4kW system ~{ac} kWh/yr at city centroid)"


# --------------------------------------------------------------------------- #
# "Living" / outside-the-box open sources (keyless unless noted)
# --------------------------------------------------------------------------- #
def _wkt_bbox() -> str:
    """Counter-clockwise polygon WKT of the Concord bbox (for GBIF)."""
    w, s, e, n = BBOX["xmin"], BBOX["ymin"], BBOX["xmax"], BBOX["ymax"]
    return f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"


def noaa_weather_alerts() -> str:
    """Active NWS weather alerts for New Hampshire -> GeoJSON (api.weather.gov)."""
    url = "https://api.weather.gov/alerts/active?area=NH"
    data = get_json(url, headers={"Accept": "application/geo+json"})
    feats = data.get("features", []) or []
    p = save_json(fc(feats), "noaa_weather_alerts_nh.geojson")
    return f"{p}  ({len(feats)} active NH alerts; some are zone-based w/ null geometry)"


def usgs_earthquakes() -> str:
    """USGS earthquakes within 100 km of Concord (M2+ since 1900) -> GeoJSON."""
    url = ("https://earthquake.usgs.gov/fdsnws/event/1/query?"
           + urllib.parse.urlencode({"format": "geojson", "latitude": LAT, "longitude": LON,
                                     "maxradiuskm": 100, "minmagnitude": 2,
                                     "starttime": "1900-01-01"}))
    data = get_json(url)
    feats = data.get("features", []) or []
    p = save_json(fc(feats), "usgs_earthquakes.geojson")
    return f"{p}  ({len(feats)} quakes M2+ within 100km)"


def gbif_species() -> str:
    """GBIF species occurrences within the Concord bbox -> GeoJSON (keyless)."""
    feats, offset, limit, cap = [], 0, 300, 9000
    while offset < cap:
        url = ("https://api.gbif.org/v1/occurrence/search?"
               + urllib.parse.urlencode({"geometry": _wkt_bbox(), "hasCoordinate": "true",
                                         "limit": limit, "offset": offset}))
        d = get_json(url)
        for r in d.get("results", []):
            lat, lon = r.get("decimalLatitude"), r.get("decimalLongitude")
            if lat is None or lon is None:
                continue
            feats.append(pt(lon, lat, {
                "species": r.get("species"), "scientificName": r.get("scientificName"),
                "kingdom": r.get("kingdom"), "class": r.get("class"),
                "eventDate": r.get("eventDate"), "basisOfRecord": r.get("basisOfRecord"),
                "datasetName": r.get("datasetName"), "gbifID": r.get("gbifID")}))
        if d.get("endOfRecords") or not d.get("results"):
            break
        offset += limit
    p = save_json(fc(feats), "gbif_species_occurrences.geojson")
    return f"{p}  ({len(feats)} occurrences; capped at {cap})"


def inaturalist() -> str:
    """iNaturalist research-grade observations in the Concord bbox -> GeoJSON (keyless)."""
    feats, page, per = [], 1, 200
    while page <= 15:
        url = ("https://api.inaturalist.org/v1/observations?"
               + urllib.parse.urlencode({"swlat": BBOX["ymin"], "swlng": BBOX["xmin"],
                                         "nelat": BBOX["ymax"], "nelng": BBOX["xmax"],
                                         "geo": "true", "per_page": per, "page": page}))
        d = get_json(url)
        results = d.get("results", [])
        if not results:
            break
        for r in results:
            g = r.get("geojson") or {}
            c = g.get("coordinates")
            if not c:
                continue
            taxon = r.get("taxon") or {}
            feats.append(pt(c[0], c[1], {
                "species": taxon.get("name"), "common": taxon.get("preferred_common_name"),
                "iconic_taxon": taxon.get("iconic_taxon_name"),
                "observed_on": r.get("observed_on"), "quality": r.get("quality_grade"),
                "user": (r.get("user") or {}).get("login"), "uri": r.get("uri")}))
        if len(results) < per:
            break
        page += 1
    p = save_json(fc(feats), "inaturalist_observations.geojson")
    return f"{p}  ({len(feats)} observations)"


def wikidata_landmarks() -> str:
    """Wikidata items with coordinates inside the Concord bbox -> GeoJSON (keyless)."""
    w, s, e, n = BBOX["xmin"], BBOX["ymin"], BBOX["xmax"], BBOX["ymax"]
    sparql = f"""
SELECT ?item ?itemLabel ?coord ?typeLabel WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?coord.
    bd:serviceParam wikibase:cornerSouthWest "Point({w} {s})"^^geo:wktLiteral.
    bd:serviceParam wikibase:cornerNorthEast "Point({e} {n})"^^geo:wktLiteral.
  }}
  OPTIONAL {{ ?item wdt:P31 ?type. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}"""
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode(
        {"query": sparql, "format": "json"})
    d = get_json(url, headers={"Accept": "application/sparql-results+json"})
    feats = []
    for b in d.get("results", {}).get("bindings", []):
        wkt = b.get("coord", {}).get("value", "")
        if not wkt.startswith("Point("):
            continue
        lon, lat = (float(x) for x in wkt[6:-1].split())
        feats.append(pt(lon, lat, {
            "wikidata": b.get("item", {}).get("value"),
            "label": b.get("itemLabel", {}).get("value"),
            "type": b.get("typeLabel", {}).get("value")}))
    p = save_json(fc(feats), "wikidata_landmarks.geojson")
    return f"{p}  ({len(feats)} geotagged Wikidata items)"


def wikipedia_nearby() -> str:
    """Geotagged Wikipedia articles within 10km of Concord -> GeoJSON (keyless)."""
    url = ("https://en.wikipedia.org/w/api.php?"
           + urllib.parse.urlencode({"action": "query", "list": "geosearch",
                                     "gscoord": f"{LAT}|{LON}", "gsradius": 10000,
                                     "gslimit": 500, "format": "json"}))
    d = get_json(url)
    feats = []
    for r in d.get("query", {}).get("geosearch", []):
        feats.append(pt(r["lon"], r["lat"], {
            "title": r.get("title"), "pageid": r.get("pageid"),
            "dist_m": r.get("dist"),
            "url": "https://en.wikipedia.org/?curid=" + str(r.get("pageid"))}))
    p = save_json(fc(feats), "wikipedia_articles.geojson")
    return f"{p}  ({len(feats)} geotagged articles within 10km)"


def openaq() -> str:
    """OpenAQ air-quality monitoring locations in the Concord bbox -> GeoJSON.

    OpenAQ v3 requires a free API key (header X-API-Key). Set OPENAQ_API_KEY.
    """
    key = env("OPENAQ_API_KEY")
    if not key:
        return "SKIPPED (OpenAQ v3 needs a free key — set OPENAQ_API_KEY)"
    bbox = f"{BBOX['xmin']},{BBOX['ymin']},{BBOX['xmax']},{BBOX['ymax']}"
    url = "https://api.openaq.org/v3/locations?" + urllib.parse.urlencode(
        {"bbox": bbox, "limit": 1000})
    d = get_json(url, headers={"X-API-Key": key})
    feats = []
    for r in d.get("results", []):
        c = r.get("coordinates") or {}
        if c.get("latitude") is None:
            continue
        feats.append(pt(c["longitude"], c["latitude"], r))
    p = save_json(fc(feats), "openaq_locations.geojson")
    return f"{p}  ({len(feats)} monitoring locations)"


def nasa_firms() -> str:
    """NASA FIRMS active fire/thermal detections (last 7 days) -> GeoJSON.

    Requires a free MAP_KEY. Set FIRMS_MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/).
    """
    key = env("FIRMS_MAP_KEY")
    if not key:
        return "SKIPPED (set FIRMS_MAP_KEY)"
    area = f"{BBOX['xmin']},{BBOX['ymin']},{BBOX['xmax']},{BBOX['ymax']}"
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_SNPP_NRT/{area}/7"
    text = get_text(url)
    rows = list(csv.DictReader(io.StringIO(text)))
    feats = []
    for r in rows:
        try:
            feats.append(pt(float(r["longitude"]), float(r["latitude"]), r))
        except (KeyError, ValueError):
            continue
    p = save_json(fc(feats), "nasa_firms_fires.geojson")
    return f"{p}  ({len(feats)} thermal detections, last 7 days)"


def mapillary() -> str:
    """Mapillary street-level image points in the Concord bbox -> GeoJSON.

    Requires a free client token. Set MAPILLARY_TOKEN (https://mapillary.com/dashboard/developers).
    """
    tok = env("MAPILLARY_TOKEN")
    if not tok:
        return "SKIPPED (set MAPILLARY_TOKEN)"
    bbox = f"{BBOX['xmin']},{BBOX['ymin']},{BBOX['xmax']},{BBOX['ymax']}"
    url = ("https://graph.mapillary.com/images?"
           + urllib.parse.urlencode({"access_token": tok, "bbox": bbox,
                                     "fields": "id,captured_at,compass_angle,geometry",
                                     "limit": 2000}))
    d = get_json(url)
    feats = []
    for r in d.get("data", []):
        g = r.get("geometry") or {}
        c = g.get("coordinates")
        if not c:
            continue
        feats.append(pt(c[0], c[1], {"id": r.get("id"), "captured_at": r.get("captured_at"),
                                     "compass_angle": r.get("compass_angle")}))
    p = save_json(fc(feats), "mapillary_images.geojson")
    return f"{p}  ({len(feats)} street-level image points)"


# --------------------------------------------------------------------------- #
# Registry / CLI
# --------------------------------------------------------------------------- #
Source = Dict[str, Any]
REGISTRY: List[Source] = [
    {"key": "census_acs",        "fn": census_acs,        "key_req": "optional (CENSUS_API_KEY)"},
    {"key": "epa_frs",           "fn": epa_frs,           "key_req": "none"},
    {"key": "cdc_places",        "fn": cdc_places,        "key_req": "none"},
    {"key": "usgs_streamgages",  "fn": usgs_streamgages,  "key_req": "none"},
    {"key": "lodes",             "fn": lodes,             "key_req": "none"},
    {"key": "cat_gtfs",          "fn": cat_gtfs,          "key_req": "none"},
    {"key": "nrel_ev",           "fn": nrel_ev,           "key_req": "none (DEMO_KEY)"},
    {"key": "tnm_products",      "fn": tnm_products,      "key_req": "none"},
    {"key": "pvwatts",           "fn": pvwatts,           "key_req": "none (DEMO_KEY)"},
    # "living" / outside-the-box open data
    {"key": "noaa_weather_alerts", "fn": noaa_weather_alerts, "key_req": "none"},
    {"key": "usgs_earthquakes",    "fn": usgs_earthquakes,    "key_req": "none"},
    {"key": "gbif_species",        "fn": gbif_species,        "key_req": "none"},
    {"key": "inaturalist",         "fn": inaturalist,         "key_req": "none"},
    {"key": "wikidata_landmarks",  "fn": wikidata_landmarks,  "key_req": "none"},
    {"key": "wikipedia_nearby",    "fn": wikipedia_nearby,    "key_req": "none"},
    # key-gated
    {"key": "airnow",            "fn": airnow,            "key_req": "AIRNOW_API_KEY"},
    {"key": "purpleair",         "fn": purpleair,         "key_req": "PURPLEAIR_API_KEY"},
    {"key": "openaq",            "fn": openaq,            "key_req": "OPENAQ_API_KEY"},
    {"key": "nasa_firms",        "fn": nasa_firms,        "key_req": "FIRMS_MAP_KEY"},
    {"key": "mapillary",         "fn": mapillary,         "key_req": "MAPILLARY_TOKEN"},
]
KEY_GATED = {"airnow", "purpleair", "openaq", "nasa_firms", "mapillary"}


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--all", action="store_true", help="include key-gated sources")
    args = ap.parse_args(argv)

    if args.list:
        for s in REGISTRY:
            print(f"  {s['key']:18s} key: {s['key_req']}")
        return 0

    os.makedirs(OUT, exist_ok=True)
    selected = REGISTRY
    if args.only:
        want = set(args.only)
        selected = [s for s in REGISTRY if s["key"] in want]
    elif not args.all:
        selected = [s for s in REGISTRY if s["key"] not in KEY_GATED]

    ok = failed = 0
    for s in selected:
        try:
            print(f"  > {s['key']} ...", file=sys.stderr)
            msg = s["fn"]()
            print(f"    {msg}", file=sys.stderr)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"    ! FAILED {s['key']}: {exc}", file=sys.stderr)
            failed += 1
    print(f"\nDone. {ok} ok, {failed} failed.", file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
