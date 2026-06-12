"""
Fetch a SEVENTH bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra6.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py``, ``fetch_acs_extra.py`` …
``fetch_acs_extra5.py`` and follows the exact same API call style, TOWN_ID
keying, name normalization, and keyless Census Reporter fallback. It only adds
NEW metrics not already covered by ``ma_muni_acs.json`` and the extra1-extra5
files.

New variables (ACS 5-year, round 6 — vintage ACS_YEAR=2023, acs/acs5):

  B19301_001E                      -> acs_per_capita_income = per-capita income in
                                      the past 12 months, raw 2023 inflation-
                                      adjusted dollars (NOT a fraction). DISTINCT
                                      from the existing median HH income / median
                                      earnings metrics — this is income per person.
  B17001_002E / B17001_001E        -> acs_poverty_pct = persons (all ages) with
                                      income below the poverty level / persons for
                                      whom poverty status is determined. DISTINCT
                                      from the existing CHILD poverty metric, which
                                      covers under-18 only. (0-1 fraction)
  B08301_003E / B08301_001E        -> acs_drove_alone_pct = workers 16+ who commute
                                      by car/truck/van driving alone / total
                                      workers 16+. (0-1 fraction)
  B08301_021E / B08301_001E        -> acs_work_from_home_pct = workers 16+ who
                                      worked from home / total workers 16+.
                                      (0-1 fraction)
  (B25014_005E + _006E + _007E +   -> acs_crowded_housing_pct = occupied housing
   _011E + _012E + _013E) /           units with more than 1.0 occupants per room
   B25014_001E                        (owner + renter, all >1.00 buckets) / total
                                      occupied units. A household-crowding proxy.
                                      (0-1 fraction)

  B01003_001E                      total population (used only to pick the town row
                                   when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR=2023), which
now REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_extra5.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — the
documented fallback used for fetch_acs_extra5.py. NOTE: the mirror's ``latest``
release is the most recent ACS 5-year vintage (currently ACS 2023 5-year), which
may be one year newer than ACS_YEAR. The derived columns are identical in
definition either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra6.json``::

    { "<TOWN_ID>": { "acs_per_capita_income": 48210, "acs_poverty_pct": 0.07, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra6.py
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra6.json"

# Census variable bundle (single query, well under the 50-var soft limit).
VARIABLES = [
    "B01003_001E",                                              # total pop (row picker)
    "B19301_001E",                                             # per-capita income
    "B17001_001E", "B17001_002E",                             # poverty universe / below poverty
    "B08301_001E", "B08301_003E", "B08301_021E",              # workers / drove alone / WFH
    "B25014_001E",                                            # total occupied units
    "B25014_005E", "B25014_006E", "B25014_007E",             # owner-occ crowded buckets (>1.00/room)
    "B25014_011E", "B25014_012E", "B25014_013E",             # renter-occ crowded buckets (>1.00/room)
]

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "B19301", "B17001", "B08301", "B25014"]
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
        # Census Reporter keys estimates as e.g. {"B17001": {"estimate":
        # {"B17001001": 42064.0, ...}}}. Convert each "B17001_002E" var into its
        # Census Reporter cell key "B17001002".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # B17001_002E -> B17001002
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
    field. Identical to fetch_acs_extra5.normalize_name — strips suffixes
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

    # Per-capita income (raw 2023 dollars).
    per_capita_income = safe_num(rec["B19301_001E"])

    # % persons (all ages) below the poverty level over the poverty universe.
    pov_universe = safe_num(rec["B17001_001E"])
    pov_below = safe_num(rec["B17001_002E"])

    # % workers 16+ driving alone / working from home over total workers 16+.
    workers_total = safe_num(rec["B08301_001E"])
    drove_alone = safe_num(rec["B08301_003E"])
    work_from_home = safe_num(rec["B08301_021E"])

    # % occupied units with >1.0 occupants/room (owner + renter crowding buckets)
    # over total occupied units.
    occ_units_total = safe_num(rec["B25014_001E"])
    crowded = _sum_cells(
        rec,
        ["B25014_005E", "B25014_006E", "B25014_007E",
         "B25014_011E", "B25014_012E", "B25014_013E"],
    )

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":   int(pop_total) if pop_total is not None else None,
        "acs_per_capita_income":  int(round(per_capita_income)) if per_capita_income is not None else None,
        "acs_poverty_pct":        pct(pov_below, pov_universe),
        "acs_drove_alone_pct":    pct(drove_alone, workers_total),
        "acs_work_from_home_pct": pct(work_from_home, workers_total),
        "acs_crowded_housing_pct": pct(crowded, occ_units_total),
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
    cols = ["acs_per_capita_income", "acs_poverty_pct", "acs_drove_alone_pct",
            "acs_work_from_home_pct", "acs_crowded_housing_pct"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
