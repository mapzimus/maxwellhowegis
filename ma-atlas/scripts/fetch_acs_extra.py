"""
Fetch a SECOND bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py`` and follows the exact same API
call style, TOWN_ID keying, and name normalization. It only adds NEW metrics not
already covered by ``ma_muni_acs.json``.

New variables (ACS 5-year):

  B08012_001E                   Workers 16+ who commute (denominator)
  B08013_001E                   Aggregate travel time to work (minutes)
                                -> acs_median_commute_min = B08013 / B08012
                                   (mean one-way minutes; "median" kept in the
                                   column name for atlas-label consistency but it
                                   is a population mean — see caveat below)
  B28002_001E + B28002_007E     -> acs_broadband_pct = broadband households /
                                   total households (0-1 fraction)
  B01002_001E                   -> acs_median_age (years, raw)
  B25003_001E + B25003_002E     -> acs_owner_occupied_pct = owner-occupied /
                                   occupied units (0-1 fraction)
  B25077_001E                   -> acs_median_home_value (dollars, raw)
  B01003_001E                   total population (used only to pick the town row
                                when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR), which now
REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_basics.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — this is
the documented fallback used for fetch_acs_basics.py. NOTE: the mirror's
``latest`` release is the most recent ACS 5-year vintage (currently ACS 2024
5-year), which may be one year newer than ACS_YEAR. The derived columns are
identical in definition either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra.json``::

    { "<TOWN_ID>": { "acs_median_commute_min": 27.4, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra.py
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra.json"

# Census variable bundle (single query, well under the 50-var soft limit).
VARIABLES = [
    "B01003_001E",                  # total pop (row picker only)
    "B08012_001E",                  # commuting workers (denominator)
    "B08013_001E",                  # aggregate travel time to work (minutes)
    "B28002_001E", "B28002_007E",   # broadband internet
    "B01002_001E",                  # median age
    "B25003_001E", "B25003_002E",   # tenure: owner-occupied
    "B25077_001E",                  # median home value
]

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "B08012", "B08013", "B28002", "B01002", "B25003", "B25077"]
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
    with urllib.request.urlopen(req, timeout=120) as resp:
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
        # Census Reporter keys estimates as e.g. {"B01002": {"estimate":
        # {"B01002001": 49.1, ...}}}. Convert each "B01002_001E" var into its
        # Census Reporter cell key "B01002001".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # B01002_001E -> B01002001
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
    field. Identical to fetch_acs_basics.normalize_name — strips suffixes
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
    as missing. Returns float (these tables include non-integer medians/means)."""
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


def derive_row(rec: dict) -> dict:
    """Compute the friendly metric columns the atlas consumes."""
    pop_total = safe_num(rec["B01003_001E"])

    commute_workers = safe_num(rec["B08012_001E"])
    commute_agg_min = safe_num(rec["B08013_001E"])
    commute_mean = (
        round(commute_agg_min / commute_workers, 2)
        if commute_agg_min is not None and commute_workers else None
    )

    hh_total = safe_num(rec["B28002_001E"])
    hh_broadband = safe_num(rec["B28002_007E"])

    tenure_total = safe_num(rec["B25003_001E"])
    owner_occ = safe_num(rec["B25003_002E"])

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":   int(pop_total) if pop_total is not None else None,
        "acs_median_commute_min":  commute_mean,
        "acs_broadband_pct":       pct(hh_broadband, hh_total),
        "acs_median_age":          safe_num(rec["B01002_001E"]),
        "acs_owner_occupied_pct":  pct(owner_occ, tenure_total),
        "acs_median_home_value":   int(safe_num(rec["B25077_001E"]))
                                   if safe_num(rec["B25077_001E"]) is not None else None,
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
    cols = ["acs_median_commute_min", "acs_broadband_pct", "acs_median_age",
            "acs_owner_occupied_pct", "acs_median_home_value"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
