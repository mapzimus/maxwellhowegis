"""
Build the atlas's PRIVATE-school point layer (``data/ma_private_schools.geojson``)
from the NCES Private School Survey (PSS), 2021-22 public-use file — the most
recent PSS release. These are a REFERENCE layer only: private schools do not
report to MA DESE, so they have NO MCAS / accountability / graduation metrics.
We carry just the directory facts PSS publishes:

  NAME        <- PINST                 institution name
  ENROLLMENT  <- NUMSTUDS              total students (PSS headcount)
  GRADES      <- LOGR2022 / HIGR2022   lowest/highest grade -> a span like "PK-8"
  LEVEL_DESC  <- LEVEL                 Elementary / Secondary / Combined
  AFFILIATION <- ORIENT                specific orientation (e.g. "Roman Catholic")
  RELIG_CAT   <- RELIG                 coarse 3-way (Catholic / Other religious / Nonsectarian)
  TOWN/ADDRESS/ZIP/COUNTY <- PCITY / PADDRS / PZIP / PCNTNM

Coordinates
-----------
The 2021-22 PSS public-use file already ships NCES-geocoded coordinates
(LATITUDE22 / LONGITUDE22), populated for 100% of MA schools and produced by the
authoritative NCES EDGE pipeline — so those are what we SHIP. As a cross-check we
also batch-geocode the street addresses through the free U.S. Census Geocoder
(geocoding.geo.census.gov, no API key) and report (a) the geocoding hit-rate and
(b) how often the Census match agrees with the NCES point within 150 m. Census is
used as a *fallback* only if an NCES coordinate is ever missing or lands outside
Massachusetts. If the Census service is unreachable the script still produces the
file from NCES coordinates and reports geocoding as unavailable.

Output: ``data/ma_private_schools.geojson`` — a FeatureCollection of Point
features, each tagged ``SECTOR="Private"`` and ``REFERENCE_ONLY=true``.

Run from repo root::  python scripts/fetch_private_schools.py
"""
from __future__ import annotations
import csv, io, json, math, re, urllib.request, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "ma_private_schools.geojson"

PSS_URL = "https://nces.ed.gov/surveys/pss/zip/pss2122_pu_csv.zip"
PSS_YEAR = "2021-22"
CENSUS_BATCH = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
CENSUS_BENCHMARK = "Public_AR_Current"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

STATE = "MA"
# Massachusetts bounding box (a generous envelope) for a coordinate sanity check.
MA_BOX = (-73.55, 41.18, -69.85, 42.92)  # minlon, minlat, maxlon, maxlat
AGREE_M = 150  # NCES vs Census "agreement" threshold, metres
CHUNK = 250    # addresses per Census batch request

# ── PSS codebook value labels (from the 2021-22 SAS format catalog) ──────────
GRADE = {
    "1": "Ungraded", "2": "PK", "3": "K", "4": "TK", "5": "T1", "6": "1",
    "7": "2", "8": "3", "9": "4", "10": "5", "11": "6", "12": "7", "13": "8",
    "14": "9", "15": "10", "16": "11", "17": "12",
}
LEVEL = {"1": "Elementary", "2": "Secondary", "3": "Combined"}
RELIG_CAT = {"1": "Catholic", "2": "Other religious", "3": "Nonsectarian"}
ORIENT = {
    "1": "Roman Catholic", "2": "African Methodist Episcopal", "3": "Amish",
    "4": "Assembly of God", "5": "Baptist", "6": "Brethren", "7": "Calvinist",
    "8": "Christian (no specific denomination)", "9": "Church of Christ",
    "10": "Church of God", "11": "Church of God in Christ",
    "12": "Church of the Nazarene", "13": "Disciples of Christ", "14": "Episcopal",
    "15": "Friends", "16": "Greek Orthodox", "17": "Islamic", "18": "Jewish",
    "19": "Latter Day Saints", "20": "Lutheran Church - Missouri Synod",
    "21": "Evangelical Lutheran Church in America",
    "22": "Wisconsin Evangelical Lutheran Synod", "23": "Other Lutheran",
    "24": "Mennonite", "25": "Methodist", "26": "Pentecostal",
    "27": "Presbyterian", "28": "Seventh-Day Adventist", "29": "Other religious",
    "30": "Nonsectarian",
}

# Tokens to keep upper-cased after title-casing PSS's ALL-CAPS strings.
ACRONYMS = {"STEM", "STEAM", "YMCA", "YMHA", "JCC", "SDA", "II", "III", "IV", "USA"}


def smart_title(s: str) -> str:
    """Title-case an ALL-CAPS PSS string while keeping known acronyms upper."""
    if not s:
        return ""
    out = []
    for tok in s.strip().split():
        up = tok.upper()
        if up in ACRONYMS:
            out.append(up)
        elif up.startswith("MC") and len(up) > 2:        # McCarthy
            out.append("Mc" + tok[2:].capitalize())
        elif "'" in tok:                                  # O'Brien, D'Angelo
            out.append("'".join(p.capitalize() for p in tok.split("'")))
        else:
            out.append(tok.capitalize())
    return " ".join(out)


def grade_span(logr: str, higr: str):
    lo, hi = GRADE.get((logr or "").strip()), GRADE.get((higr or "").strip())
    if lo and hi:
        return lo if lo == hi else f"{lo}–{hi}"   # en dash
    return lo or hi or None


def to_int(v):
    try:
        n = int(round(float(v)))
        return n if n >= 0 else None
    except (TypeError, ValueError):
        return None


def haversine_m(lon1, lat1, lon2, lat2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def in_ma(lon, lat) -> bool:
    return (lon is not None and lat is not None
            and MA_BOX[0] <= lon <= MA_BOX[2] and MA_BOX[1] <= lat <= MA_BOX[3])


# ── 1) Pull + filter the PSS public-use file to Massachusetts ────────────────
def fetch_ma_rows() -> list[dict]:
    req = urllib.request.Request(PSS_URL, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
    text = z.read(name).decode("latin-1")
    rows = list(csv.DictReader(io.StringIO(text)))
    return [r for r in rows if (r.get("PSTABB") or "").strip().upper() == STATE]


# ── 2) Census batch geocoder (stdlib multipart POST) ─────────────────────────
def _multipart(fields: dict, file_field: str, filename: str, file_bytes: bytes):
    boundary = "----maeduatlasPSS7f3b1c9d"
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; "
                     f'name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; "
        f'name="{file_field}"; filename="{filename}"\r\n'
        f"Content-Type: text/csv\r\n\r\n".encode()
        + file_bytes + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    return body, f"multipart/form-data; boundary={boundary}"


def geocode_chunk(rows: list[dict]) -> dict:
    """POST one chunk of addresses; return {PPIN: (lon, lat)} for Match rows."""
    buf = io.StringIO()
    w = csv.writer(buf)
    for r in rows:
        w.writerow([r["PPIN"], r["ADDRESS"], r["TOWN"], STATE, r["ZIP"]])
    body, ctype = _multipart(
        {"benchmark": CENSUS_BENCHMARK}, "addressFile",
        "addresses.csv", buf.getvalue().encode("utf-8"))
    req = urllib.request.Request(CENSUS_BATCH, data=body,
                                 headers={**UA, "Content-Type": ctype})
    with urllib.request.urlopen(req, timeout=180) as resp:
        out = resp.read().decode("utf-8", "replace")
    hits = {}
    for rec in csv.reader(io.StringIO(out)):
        if len(rec) >= 6 and rec[2] == "Match" and rec[5]:
            try:
                lon_s, lat_s = rec[5].split(",")
                hits[rec[0]] = (float(lon_s), float(lat_s))
            except ValueError:
                pass
    return hits


def geocode_all(recs: list[dict]) -> tuple[dict, str | None]:
    hits: dict = {}
    err = None
    for i in range(0, len(recs), CHUNK):
        chunk = recs[i:i + CHUNK]
        for attempt in range(3):
            try:
                hits.update(geocode_chunk(chunk))
                break
            except Exception as e:                      # noqa: BLE001 (resilient)
                err = f"{type(e).__name__}: {e}"
        print(f"  geocoded {min(i + CHUNK, len(recs))}/{len(recs)} "
              f"addresses (matched so far: {len(hits)})")
    return hits, (None if hits else err)


def main() -> int:
    rows = fetch_ma_rows()
    print(f"PSS {PSS_YEAR}: {len(rows)} private schools in {STATE}")

    # Build clean records carrying NCES coordinates.
    recs = []
    for r in rows:
        try:
            nlat = float(r.get("LATITUDE22"))
            nlon = float(r.get("LONGITUDE22"))
        except (TypeError, ValueError):
            nlat = nlon = None
        recs.append({
            "PPIN": (r.get("PPIN") or "").strip(),
            "NAME": smart_title(r.get("PINST", "")),
            "ENROLLMENT": to_int(r.get("NUMSTUDS")),
            "GRADES": grade_span(r.get("LOGR2022"), r.get("HIGR2022")),
            "LEVEL_DESC": LEVEL.get((r.get("LEVEL") or "").strip()),
            "AFFILIATION": ORIENT.get((r.get("ORIENT") or "").strip()),
            "RELIG_CAT": RELIG_CAT.get((r.get("RELIG") or "").strip()),
            "TOWN": smart_title(r.get("PCITY", "")),
            "ADDRESS": smart_title(r.get("PADDRS", "")),
            "ZIP": (r.get("PZIP") or "").strip().zfill(5),
            "nces_lon": nlon, "nces_lat": nlat,
        })

    # Census batch geocode (cross-check + fallback only).
    print(f"Cross-checking {len(recs)} addresses via Census batch geocoder...")
    hits, geo_err = geocode_all(recs)
    n_match = len(hits)
    if geo_err and not hits:
        print(f"  ! Census geocoder unavailable ({geo_err}); "
              f"shipping NCES coordinates only.")

    # Choose shipped coordinates: NCES primary, Census fallback when NCES is
    # missing or out-of-state. Tally agreement for the in-both set.
    feats, n_nces, n_census, n_dropped = [], 0, 0, 0
    agree_dists = []
    for rec in recs:
        c = hits.get(rec["PPIN"])
        n, nlon, nlat = rec, rec["nces_lon"], rec["nces_lat"]
        if c and in_ma(n["nces_lon"], n["nces_lat"]):
            agree_dists.append(haversine_m(nlon, nlat, c[0], c[1]))

        if in_ma(nlon, nlat):
            lon, lat, src = nlon, nlat, "nces"; n_nces += 1
        elif c and in_ma(c[0], c[1]):
            lon, lat, src = c[0], c[1], "census"; n_census += 1
        else:
            n_dropped += 1
            continue

        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "PPIN": rec["PPIN"],
                "NAME": rec["NAME"],
                "SECTOR": "Private",
                "TYPE_DESC": "Private school",
                "LEVEL_DESC": rec["LEVEL_DESC"],
                "GRADES": rec["GRADES"],
                "AFFILIATION": rec["AFFILIATION"],
                "RELIG_CAT": rec["RELIG_CAT"],
                "ENROLLMENT": rec["ENROLLMENT"],
                "TOWN": rec["TOWN"],
                "ADDRESS": rec["ADDRESS"],
                "ZIP": rec["ZIP"],
                "COORD_SOURCE": src,
                "REFERENCE_ONLY": True,
                "DATA_SOURCE": f"NCES PSS {PSS_YEAR}",
                "lon": round(lon, 6), "lat": round(lat, 6),
            },
        })

    fc = {
        "type": "FeatureCollection",
        "metadata": {
            "source": f"NCES Private School Survey {PSS_YEAR} (public-use file)",
            "url": PSS_URL,
            "note": "Reference layer only — private schools do not report to MA "
                    "DESE and have no MCAS / accountability / graduation data.",
            "coordinates": "NCES EDGE (LATITUDE22/LONGITUDE22); Census geocoder "
                           "used as cross-check + fallback.",
        },
        "features": feats,
    }
    OUT.write_text(json.dumps(fc), encoding="utf-8")

    # ── Report ───────────────────────────────────────────────────────────────
    total = len(recs)
    enr = sum(1 for f in feats if f["properties"]["ENROLLMENT"] is not None)
    grd = sum(1 for f in feats if f["properties"]["GRADES"])
    aff = sum(1 for f in feats if f["properties"]["AFFILIATION"])
    rel = {}
    for f in feats:
        k = f["properties"]["RELIG_CAT"] or "Unknown"
        rel[k] = rel.get(k, 0) + 1
    agree_dists.sort()
    within = sum(1 for d in agree_dists if d <= AGREE_M)

    print(f"\nwrote {OUT.relative_to(REPO)} — {len(feats)} features")
    print(f"  coordinate source:   {n_nces} NCES, {n_census} Census-fallback, "
          f"{n_dropped} dropped (no valid coordinate)")
    print(f"  geocoding hit-rate:  {n_match}/{total} "
          f"({100*n_match/total:.1f}%) addresses matched by Census")
    if agree_dists:
        med = agree_dists[len(agree_dists)//2]
        print(f"  NCES<->Census agree: {within}/{len(agree_dists)} "
              f"({100*within/len(agree_dists):.1f}%) within {AGREE_M} m; "
              f"median offset {med:.0f} m")
    print(f"  enrollment present:  {enr}/{len(feats)}")
    print(f"  grade span present:  {grd}/{len(feats)}")
    print(f"  affiliation present: {aff}/{len(feats)}")
    print(f"  affiliation (3-way): " + ", ".join(f"{k} {v}" for k, v in
          sorted(rel.items(), key=lambda kv: -kv[1])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
