"""
Fetch a NINTH bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra8.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py``, ``fetch_acs_extra.py`` …
``fetch_acs_extra7.py`` and follows the exact same API call style, TOWN_ID
keying, name normalization, and keyless Census Reporter fallback. It only adds
NEW metrics not already covered by ``ma_muni_acs.json`` and the extra1-extra7
files.

New variables (ACS 5-year, round 8 — vintage ACS_YEAR=2023, acs/acs5). Four
derived columns are 0-1 fractions; one (median rooms) is a raw count:

  (C24010_003E + C24010_039E) /    -> acs_mgmt_occ_pct = civilians 16+ employed in
   C24010_001E                        management, business, science, and arts
                                      occupations (male + female) / total employed
                                      civilians 16+. DISTINCT from the existing
                                      labor-force/unemployed and education metrics.
                                      (0-1 fraction)

  B25018_001E                      -> acs_median_rooms = median number of rooms in
                                      housing units (raw count, not a fraction).
                                      DISTINCT from median home value / gross rent /
                                      crowded-housing metrics. (raw number)

  B07003_013E / B07003_001E        -> acs_moved_diff_state_pct = population 1 year+
                                      who moved from a DIFFERENT STATE in the last
                                      year / total population 1 year+ (geographic
                                      mobility universe). DISTINCT from the existing
                                      moved-last-year metric, which counts ALL
                                      movers. (0-1 fraction)

  (B24080_007E + _008E + _009E +   -> acs_govt_worker_pct = government workers
   B24080_017E + _018E + _019E) /     (local + state + federal, male + female) /
   B24080_001E                        total employed (class-of-worker universe).
                                      DISTINCT from the existing occupation/labor
                                      metrics. (0-1 fraction)

  B05002_003E / B05002_001E        -> acs_born_in_state_pct = native population born
                                      in their state of residence / total population
                                      — a "rootedness" measure. DISTINCT from the
                                      existing foreign-born metric (this counts
                                      in-state natives, not the foreign-born share).
                                      (0-1 fraction)

  B01003_001E                      total population (used only to pick the town row
                                   when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR=2023), which
now REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_extra7.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — the
documented fallback used for fetch_acs_extra7.py. NOTE: the mirror's ``latest``
release is the most recent ACS 5-year vintage (currently ACS 2023 5-year), which
may be one year newer than ACS_YEAR. The derived columns are identical in
definition either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra8.json``::

    { "<TOWN_ID>": { "acs_mgmt_occ_pct": 0.52, "acs_median_rooms": 6.3, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra8.py
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra8.json"

# Census variable bundle (single query, well under the 50-var soft limit).
MGMT_OCC_CELLS = [
    "C24010_003E",  # male, mgmt/business/science/arts occupations
    "C24010_039E",  # female, mgmt/business/science/arts occupations
]
GOVT_WORKER_CELLS = [
    "B24080_007E", "B24080_008E", "B24080_009E",  # male local/state/federal govt
    "B24080_017E", "B24080_018E", "B24080_019E",  # female local/state/federal govt
]
VARIABLES = (
    [
        "B01003_001E",  # total pop (row picker)
        "C24010_001E",  # total employed civilians 16+ (occupation universe)
    ]
    + MGMT_OCC_CELLS
    + [
        "B25018_001E",  # median number of rooms (raw)
        "B07003_001E", "B07003_013E",  # geographic mobility universe / moved diff state
        "B24080_001E",  # total employed (class-of-worker universe)
    ]
    + GOVT_WORKER_CELLS
    + [
        "B05002_001E", "B05002_003E",  # total pop / native born in state of residence
    ]
)

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "C24010", "B25018", "B07003", "B24080", "B05002"]
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
        # Census Reporter keys estimates as e.g. {"C24010": {"estimate":
        # {"C24010001": 42064.0, ...}}}. Convert each "C24010_003E" var into its
        # Census Reporter cell key "C24010003".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # C24010_003E -> C24010003
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
    field. Identical to fetch_acs_extra7.normalize_name — strips suffixes
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

    # Management/business/science/arts occupations / total employed civilians 16+.
    occ_universe = safe_num(rec["C24010_001E"])
    mgmt_occ = _sum_cells(rec, MGMT_OCC_CELLS)

    # Median number of rooms (raw, not a ratio).
    median_rooms = safe_num(rec["B25018_001E"])

    # Moved from a different state in the last year / total pop 1 year+.
    mobility_universe = safe_num(rec["B07003_001E"])
    moved_diff_state = safe_num(rec["B07003_013E"])

    # Government workers (local + state + federal) / total employed.
    cow_universe = safe_num(rec["B24080_001E"])
    govt_workers = _sum_cells(rec, GOVT_WORKER_CELLS)

    # Native born in state of residence / total population.
    nativity_universe = safe_num(rec["B05002_001E"])
    born_in_state = safe_num(rec["B05002_003E"])

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":     int(pop_total) if pop_total is not None else None,
        "acs_mgmt_occ_pct":          pct(mgmt_occ, occ_universe),
        "acs_median_rooms":          round(median_rooms, 1) if median_rooms is not None else None,
        "acs_moved_diff_state_pct":  pct(moved_diff_state, mobility_universe),
        "acs_govt_worker_pct":       pct(govt_workers, cow_universe),
        "acs_born_in_state_pct":     pct(born_in_state, nativity_universe),
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
    cols = ["acs_mgmt_occ_pct", "acs_median_rooms", "acs_moved_diff_state_pct",
            "acs_govt_worker_pct", "acs_born_in_state_pct"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
