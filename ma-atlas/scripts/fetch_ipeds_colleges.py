"""
Build ``data/ma_colleges.geojson`` -- a located-dot reference layer of every
Massachusetts college and university, from the federal IPEDS collection (NCES),
enriched with the headline "college stats" the map popup shows.

SOURCES (public, no key; the IPEDS Data Center serves each survey as a zipped CSV):
  * Directory (HD{year})        INSTNM, CITY, STABBR, SECTOR, LATITUDE, LONGITUD.
        One row per institution -- defines the set of dots and their location.
  * 12-month enrollment (EFFY{year})  EFYTOTLT at EFFYLEV == 1 is the grand-total
        12-month unduplicated headcount.
  * Admissions (DRVADM{year})   DVADM01 = percent admitted, total (acceptance rate).
  * Graduation (DRVGR{year})    GRRTTOT = graduation rate, total cohort, at 150% of
        normal time -- 6 years at a 4-year school, 3 years at a 2-year school.
  * Retention / ratio (DRVEF{year})  RET_PCF = full-time first-year retention rate;
        STUFACR = student-to-faculty ratio.
  * Charges (IC{year}_AY)       CHG2AY3 / CHG3AY3 = published in-state / out-of-state
        tuition + required fees, current academic year.
  * Net price (SFA{yy}{yy})     NPIST2 (public, in-state) or NPGRN2 (private): the
        average net price for students awarded grant or scholarship aid.

HD + EFFY are REQUIRED (they define the institution set + enrollment). The five
enrichment surveys are best-effort: if one can't be downloaded for the chosen
year it's skipped, those fields are left null, and the layer still builds (the
popup hides empty rows). Percent and ratio fields are stored as integers
(e.g. 58 means 58%); tuition and net price as whole dollars.

We keep only Massachusetts institutions (STABBR == "MA") whose IPEDS SECTOR marks
a 4-year or 2-year institution (sectors 1-6). The SECTOR code encodes BOTH control
and level, so both fields come from one lookup::

    1  public 4-year            2  private nonprofit 4-year   3  private for-profit 4-year
    4  public 2-year            5  private nonprofit 2-year   6  private for-profit 2-year

Administrative units (sector 0) and less-than-2-year career schools (sectors 7-9)
are dropped. The enrichment ADDS columns but does not change which institutions
are included, so the per-category counts hard-coded in index.html stay stable
(the script prints the counts + per-field coverage on every run).

Output: ``data/ma_colleges.geojson`` (GeoJSON FeatureCollection of Points).
Run from repo root::  python scripts/fetch_ipeds_colleges.py
Set ``IPEDS_CACHE=/path/to/dir`` to reuse already-downloaded zips across re-runs.
"""
from __future__ import annotations
import csv, io, json, os, time, urllib.error, urllib.request, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "ma_colleges.geojson"
BASE = "https://nces.ed.gov/ipeds/datacenter/data"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
# Optional local zip cache (env var). When set, files are read from / written to
# this dir, so a re-run never re-downloads -- handy given the IPEDS host throttles.
CACHE = Path(os.environ["IPEDS_CACHE"]) if os.environ.get("IPEDS_CACHE") else None

# Newest IPEDS year first; fall back if a file isn't posted yet. Both the
# directory (HD) and the 12-month enrollment (EFFY) file must exist for a year
# to be usable, so the two describe the same cohort. Bumping this list refreshes
# the data -- the per-category counts hard-coded in index.html would then need a
# matching update (the script prints the new counts on every run).
YEARS = [2023, 2022]

# IPEDS SECTOR -> (control, level). Only the 4-year / 2-year sectors are listed;
# any sector not here (0 admin unit, 7-9 less-than-2-year) is skipped.
SECTOR_MAP = {
    "1": ("public",             "4-year"),
    "2": ("private nonprofit",  "4-year"),
    "3": ("private for-profit", "4-year"),
    "4": ("public",             "2-year"),
    "5": ("private nonprofit",  "2-year"),
    "6": ("private for-profit", "2-year"),
}


def fetch_ipeds_csv(filename: str, tries: int = 6, pause: int = 8) -> list[dict] | None:
    """Download (cache-first, with retries) a zipped IPEDS CSV and return its rows
    with whitespace-stripped column names, or None if unavailable (404 / give up).
    IPEDS occasionally posts headers with trailing spaces (e.g. ``STUFACR``)."""
    raw = None
    cached = (CACHE / f"{filename}.zip") if CACHE else None
    if cached and cached.exists() and cached.stat().st_size > 0:
        raw = cached.read_bytes()
    else:
        for _ in range(tries):
            try:
                req = urllib.request.Request(f"{BASE}/{filename}.zip", headers=UA)
                with urllib.request.urlopen(req, timeout=120) as r:
                    raw = r.read()
                if cached:
                    cached.write_bytes(raw)
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                time.sleep(pause)
            except Exception:
                time.sleep(pause)
        if raw is None:
            return None
    zf = zipfile.ZipFile(io.BytesIO(raw))
    inner = sorted(n for n in zf.namelist() if n.lower().endswith(".csv"))[0]
    data = zf.read(inner)
    if data.startswith(b"\xef\xbb\xbf"):   # strip UTF-8 BOM so the first column name is clean
        data = data[3:]
    # IPEDS files are Latin-1 (institution names carry accented characters).
    reader = csv.DictReader(io.StringIO(data.decode("latin-1")))
    return [{(k.strip() if k else k): v for k, v in row.items()} for row in reader]


def num(v):
    """Parse an IPEDS cell into a float, or None when blank/non-numeric."""
    v = (v or "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def pos(v):
    """Positive value as an int, else None. IPEDS uses '.'/blank for suppressed
    or not-applicable, and 0 for not-applicable in these rate/ratio/dollar fields
    (e.g. open-admission schools), so anything non-positive becomes None."""
    n = num(v)
    return int(round(n)) if (n is not None and n > 0) else None


def keyed(rows: list[dict] | None) -> dict:
    """Index rows by UNITID; tolerate a missing (None) survey as an empty join."""
    return {r["UNITID"]: r for r in rows} if rows else {}


def main() -> int:
    hd = effy = None
    year = None
    for y in YEARS:
        hd, effy = fetch_ipeds_csv(f"HD{y}"), fetch_ipeds_csv(f"EFFY{y}")
        if hd and effy:
            year = y
            break
        hd = effy = None
    if not (hd and effy):
        raise SystemExit(f"Could not download IPEDS HD+EFFY for any of {YEARS}")

    # 12-month grand-total headcount keyed by UNITID (EFFYLEV 1 = all students).
    enrollment: dict[str, int] = {}
    for r in effy:
        if r.get("EFFYLEV") == "1":
            tot = num(r.get("EFYTOTLT"))
            if tot is not None:
                enrollment[r["UNITID"]] = int(tot)

    # Best-effort enrichment surveys, year-matched. The SFA financial-aid file is
    # named for its academic year, which ends in `year` (2023 -> SFA2223).
    sfa_name = f"SFA{(year - 1) % 100:02d}{year % 100:02d}"
    adm = keyed(fetch_ipeds_csv(f"DRVADM{year}"))
    grad = keyed(fetch_ipeds_csv(f"DRVGR{year}"))
    ef = keyed(fetch_ipeds_csv(f"DRVEF{year}"))
    ic = keyed(fetch_ipeds_csv(f"IC{year}_AY"))
    sfa = keyed(fetch_ipeds_csv(sfa_name))
    missing = [n for n, d in [(f"DRVADM{year}", adm), (f"DRVGR{year}", grad),
               (f"DRVEF{year}", ef), (f"IC{year}_AY", ic), (sfa_name, sfa)] if not d]

    features = []
    by_sector: dict[str, int] = {}
    by_level: dict[str, int] = {}
    fields = ("enrollment", "admit_rate", "grad_rate", "retention_rate",
              "stu_fac_ratio", "tuition_in", "tuition_out", "net_price")
    cov = {k: 0 for k in fields}
    for r in hd:
        if r.get("STABBR", "").strip() != "MA":
            continue
        mapped = SECTOR_MAP.get((r.get("SECTOR") or "").strip())
        if not mapped:
            continue   # admin unit / less-than-2-year -- outside this layer's taxonomy
        control, level = mapped
        lat, lon = num(r.get("LATITUDE")), num(r.get("LONGITUD"))
        if lat is None or lon is None:
            continue
        uid = r["UNITID"]
        a, g, e, c, s = (adm.get(uid, {}), grad.get(uid, {}), ef.get(uid, {}),
                         ic.get(uid, {}), sfa.get(uid, {}))
        props = {
            "NAME": (r.get("INSTNM") or "").strip(),
            "CITY": (r.get("CITY") or "").strip(),
            "sector": control,
            "level": level,
            "enrollment": enrollment.get(uid),
            "admit_rate": pos(a.get("DVADM01")),       # % admitted, total
            "grad_rate": pos(g.get("GRRTTOT")),        # grad rate, total cohort, 150% time
            "retention_rate": pos(e.get("RET_PCF")),   # full-time first-year retention %
            "stu_fac_ratio": pos(e.get("STUFACR")),    # students per faculty member
            "tuition_in": pos(c.get("CHG2AY3")),       # in-state tuition + fees
            "tuition_out": pos(c.get("CHG3AY3")),      # out-of-state tuition + fees
            "net_price": pos(s.get("NPIST2")) or pos(s.get("NPGRN2")),  # public | private
        }
        for k in fields:
            if props[k] is not None:
                cov[k] += 1
        by_sector[control] = by_sector.get(control, 0) + 1
        by_level[level] = by_level.get(level, 0) + 1
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            "properties": props,
        })

    features.sort(key=lambda f: f["properties"]["NAME"].lower())
    fc = {
        "type": "FeatureCollection",
        "name": "ma_colleges",
        "metadata": {"source": "NCES IPEDS", "year": year,
                     "files": [f"HD{year}", f"EFFY{year}", f"DRVADM{year}", f"DRVGR{year}",
                               f"DRVEF{year}", f"IC{year}_AY", sfa_name]},
        "features": features,
    }
    OUT.write_text(json.dumps(fc, separators=(",", ":")))

    n = len(features)
    print(f"wrote {OUT.relative_to(REPO)}: {n} MA colleges (IPEDS {year})")
    if missing:
        print(f"  WARNING: enrichment surveys unavailable, those fields left null: {missing}")
    print(f"  by sector: {dict(sorted(by_sector.items()))}")
    print(f"  by level:  {dict(sorted(by_level.items()))}")
    print("  field coverage (non-null / total):")
    for k in fields:
        print(f"    {k:15s} {cov[k]}/{n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
