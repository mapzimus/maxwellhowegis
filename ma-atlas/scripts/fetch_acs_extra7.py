"""
Fetch an EIGHTH bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra7.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py``, ``fetch_acs_extra.py`` …
``fetch_acs_extra6.py`` and follows the exact same API call style, TOWN_ID
keying, name normalization, and keyless Census Reporter fallback. It only adds
NEW metrics not already covered by ``ma_muni_acs.json`` and the extra1-extra6
files.

New variables (ACS 5-year, round 7 — vintage ACS_YEAR=2023, acs/acs5). All
five derived columns are 0-1 fractions:

  (B01001_020E + _021E + _022E +   -> acs_age65_plus_pct = population age 65 and
   _023E + _024E + _025E +            over (sum of all male+female 65+ age
   _044E + _045E + _046E +            buckets) / total population. DISTINCT from
   _047E + _048E + _049E) /           the existing % under-18 and median-age
   B01001_001E                        metrics. (0-1 fraction)

  (B01001_004E + _005E + _006E +   -> acs_school_age_pct = population age 5-17
   _028E + _029E + _030E) /           (male+female 5-9, 10-14, 15-17 buckets) /
   B01001_001E                        total population — a school-age share, not a
                                      ratio of under-18. DISTINCT from % under-18,
                                      which includes 0-4. (0-1 fraction)

  B25002_003E / B25002_001E        -> acs_vacancy_pct = vacant housing units /
                                      total housing units (occupancy-status
                                      universe). DISTINCT from the existing
                                      owner-occupied metric, which is a share of
                                      OCCUPIED units only. (0-1 fraction)

  B08301_010E / B08301_001E        -> acs_public_transit_pct = workers 16+ who
                                      commute by public transportation (excluding
                                      taxicab) / total workers 16+. DISTINCT from
                                      the existing drove-alone and WFH commute
                                      metrics. (0-1 fraction)

  B11001_002E / B11001_001E        -> acs_family_hh_pct = family households /
                                      total households. DISTINCT from the existing
                                      single-parent and avg-household-size metrics.
                                      (0-1 fraction)

  B01003_001E                      total population (used only to pick the town row
                                   when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR=2023), which
now REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_extra6.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — the
documented fallback used for fetch_acs_extra6.py. NOTE: the mirror's ``latest``
release is the most recent ACS 5-year vintage (currently ACS 2023 5-year), which
may be one year newer than ACS_YEAR. The derived columns are identical in
definition either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra7.json``::

    { "<TOWN_ID>": { "acs_age65_plus_pct": 0.18, "acs_school_age_pct": 0.15, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra7.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import urllib.request
import urllib.parse


ACS_YEAR = 2023
STATE_FIPS = "25"  # Massachusetts
API_BASE = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"
API_KEY = os.environ.get("CENSUS_API_KEY", "").strip()
USER_AGENT = "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"

REPO_ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = REPO_ROOT / "data" / "ma_municipalities.geojson"
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra7.json"

# Census variable bundle (single query, well under the 50-var soft limit).
AGE65_CELLS = [
    "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",  # male 65+
    "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E",  # female 65+
]
SCHOOL_AGE_CELLS = [
    "B01001_004E", "B01001_005E", "B01001_006E",  # male 5-9, 10-14, 15-17
    "B01001_028E", "B01001_029E", "B01001_030E",  # female 5-9, 10-14, 15-17
]
VARIABLES = (
    [
        "B01003_001E",  # total pop (row picker)
        "B01001_001E",  # total pop (sex-by-age universe / denominator)
    ]
    + AGE65_CELLS
    + SCHOOL_AGE_CELLS
    + [
        "B25002_001E", "B25002_003E",  # housing units universe / vacant
        "B08301_001E", "B08301_010E",  # workers 16+ / public transit
        "B11001_001E", "B11001_002E",  # households / family households
    ]
)

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "B01001", "B25002", "B08301", "B11001"]
CR_RELEASE = "latest"
CR_BASE = "https://api.censusreporter.org/1.0/data/show"


def fetch_cousub_census_api() -> list[dict]:
    """Official Census API path (requires CENSUS_API_KEY). Returns list of
    {VAR: value, 'NAME': ...} dicts."""
    params = {
        "get": ",".join(["NAME"] + VARIABLES),
        "for": "county subdivision:*",
        "in": f"state:{STATE_FIPS}",
        "key": API_KEY,
    }
    url = f"{API_BASE}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"GET {url.split('&key=')[0]}&key=…")
    with urllib.request.urlopen(req, timeout=60) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        body = resp.read().decode("utf-8")
    if body.lstrip().startswith("<"):
        sys.exit(
            "Census API returned HTML (likely a bad key or rate limit). "
            f"First 200 chars:\n{body[:200]}"
        )
    rows = json.loads(body)
    header, *records = rows
    return [dict(zip(header, r)) for r in records]


def fetch_cousub_census_reporter() -> list[dict]:
    """Keyless fallback via the Census Reporter mirror. Flattens each geography's
    nested estimates into the same {VAR_E: value, 'NAME': ...} shape the
    derive_row logic expects."""
    url = (
        f"{CR_BASE}/{CR_RELEASE}"
        f"?table_ids={','.join(CR_TABLES)}&geo_ids=060|04000US{STATE_FIPS}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"GET {url}  (no CENSUS_API_KEY — using Census Reporter mirror)")
    with urllib.request.urlopen(req, timeout=180) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        payload = json.loads(resp.read().decode("utf-8"))

    release = payload.get("release", {}).get("name", "unknown")
    print(f"Census Reporter release: {release}")
    data = payload.get("data", {})
    geo = payload.get("geography", {})

    out: list[dict] = []
    for geo_id, tables in data.items():
        rec: dict = {"NAME": geo.get(geo_id, {}).get("name", "")}
        # Census Reporter keys estimates as e.g. {"B01001": {"estimate":
        # {"B01001001": 42064.0, ...}}}. Convert each "B01001_020E" var into its
        # Census Reporter cell key "B01001020".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # B01001_020E -> B01001020
            est = tables.get(table, {}).get("estimate", {})
            rec[var] = est.get(cell)
        out.append(rec)
    return out


def fetch_cousub() -> list[dict]:
    if API_KEY:
        return fetch_cousub_census_api()
    print(
        "CENSUS_API_KEY not set — falling back to the keyless Census Reporter "
        "mirror (documented fallback; see module docstring)."
    )
    return fetch_cousub_census_reporter()


def normalize_name(raw: str) -> str:
    """Strip Census suffixes and normalize for matching against the MA DESE TOWN
    field. Identical to fetch_acs_extra6.normalize_name — strips suffixes
    repeatedly to handle doubled-suffix names like "Braintree Town city"."""
    if not raw:
        return ""
    name = raw.split(",")[0].strip()
    suffixes = (" town", " city", " borough", " plantation", " CDP", " (balance)")
    changed = True
    while changed:
        changed = False
        for suffix in suffixes:
            if name.lower().endswith(suffix.lower()):
                name = name[: -len(suffix)].strip()
                changed = True
                break
    return name.upper()


def safe_num(v) -> float | None:
    """Parse a Census numeric value, treating jam/sentinel codes and negatives
    as missing."""
    if v is None or v == "" or v in ("-", "N", "(X)", "*", "**", "***", "*****"):
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    # Census uses large negative jam values (e.g. -666666666) for missing.
    if n < 0:
        return None
    return n


def _sum_cells(rec: dict, keys: list[str]) -> float | None:
    """Sum a list of cells, treating all-missing as None but missing-among-some
    as 0 (matches the basics aggregator's `safe_int(...) or 0` style)."""
    vals = [safe_num(rec.get(k)) for k in keys]
    if all(v is None for v in vals):
        return None
    return sum(v or 0.0 for v in vals)


def derive_row(rec: dict) -> dict:
    """Compute the friendly metric columns the atlas consumes."""
    pop_total = safe_num(rec["B01003_001E"])

    # Sex-by-age universe (B01001_001E == total population).
    age_universe = safe_num(rec["B01001_001E"])
    age65 = _sum_cells(rec, AGE65_CELLS)
    school_age = _sum_cells(rec, SCHOOL_AGE_CELLS)

    # Housing-unit occupancy status: vacant / total units.
    units_total = safe_num(rec["B25002_001E"])
    vacant = safe_num(rec["B25002_003E"])

    # Workers 16+ commuting by public transit / total workers 16+.
    workers_total = safe_num(rec["B08301_001E"])
    public_transit = safe_num(rec["B08301_010E"])

    # Family households / total households.
    hh_total = safe_num(rec["B11001_001E"])
    family_hh = safe_num(rec["B11001_002E"])

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":   int(pop_total) if pop_total is not None else None,
        "acs_age65_plus_pct":      pct(age65, age_universe),
        "acs_school_age_pct":      pct(school_age, age_universe),
        "acs_vacancy_pct":         pct(vacant, units_total),
        "acs_public_transit_pct":  pct(public_transit, workers_total),
        "acs_family_hh_pct":       pct(family_hh, hh_total),
    }


def build_lookup_by_town_id() -> dict[str, str]:
    """Read TOWN -> TOWN_ID mapping straight from the muni geojson."""
    raw = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    mapping: dict[str, str] = {}
    for feat in raw["features"]:
        props = feat["properties"]
        town = (props.get("TOWN") or props.get("town_display") or "").upper().strip()
        tid = props.get("TOWN_ID")
        if town and tid is not None:
            mapping[town] = str(tid)
    return mapping


def main() -> None:
    if not GEOJSON_PATH.exists():
        sys.exit(f"missing {GEOJSON_PATH} — rebuild the atlas data first")

    records = fetch_cousub()
    print(f"got {len(records)} COUSUB rows")

    town_lookup = build_lookup_by_town_id()
    print(f"resolved {len(town_lookup)} town -> TOWN_ID mappings from geojson")

    out: dict[str, dict] = {}
    skipped = 0
    for rec in records:
        norm = normalize_name(rec.get("NAME", ""))
        town_id = town_lookup.get(norm)
        if not town_id:
            skipped += 1
            continue
        derived = derive_row(rec)
        # If we already have a row for this TOWN_ID (multiple CDPs in same town),
        # prefer the one with the larger population (= the actual town).
        prior = out.get(town_id)
        if prior and (prior.get("_acs_total_population") or 0) >= (derived.get("_acs_total_population") or 0):
            continue
        out[town_id] = derived

    # Drop the internal population helper from the final payload; it's only used
    # for row de-duplication above (acs_total_population already lives in the
    # basics file).
    for row in out.values():
        row.pop("_acs_total_population", None)

    print(f"matched {len(out)} towns ({skipped} COUSUB rows skipped — usually CDPs without a TOWN_ID match)")

    # Coverage per column
    cols = ["acs_age65_plus_pct", "acs_school_age_pct", "acs_vacancy_pct",
            "acs_public_transit_pct", "acs_family_hh_pct"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
