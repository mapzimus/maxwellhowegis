"""
Fetch a FIFTH bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra4.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py``, ``fetch_acs_extra.py``,
``fetch_acs_extra2.py`` and ``fetch_acs_extra3.py`` and follows the exact same API
call style, TOWN_ID keying, name normalization, and keyless Census Reporter
fallback. It only adds NEW metrics not already covered by ``ma_muni_acs.json``,
``ma_muni_acs_extra.json``, ``ma_muni_acs_extra2.json`` or
``ma_muni_acs_extra3.json``.

New variables (ACS 5-year, round 4 — vintage ACS_YEAR=2023, acs/acs5):

  B28003_002E / B28003_001E       -> acs_has_computer_pct = households with a
                                     computer / total households (0-1 fraction)
  (C16002_004E + _007E + _010E +  -> acs_limited_english_hh_pct = limited
   C16002_013E) / C16002_001E        English-speaking households (Spanish + Other
                                     Indo-European + Asian/Pacific Island + Other
                                     languages) / total households (0-1 fraction)
  B20002_001E                     -> acs_median_earnings = median earnings in the
                                     past 12 months for workers (raw dollars,
                                     NOT a fraction)
  (B25070_007E + _008E + _009E +  -> acs_renter_cost_burden_pct = renter
   B25070_010E) /                    households paying 30%+ of income on gross
   (B25070_001E - B25070_011E)       rent / renter households for whom the ratio
                                     was computed (total minus "not computed").
                                     This is the 30%+ cost-burden threshold,
                                     DISTINCT from the existing SEVERE (50%+)
                                     rent-burden metric. (0-1 fraction)
  B23025_002E / B23025_001E       -> acs_labor_force_pct = population 16+ in the
                                     labor force / total population 16+
                                     (labor force participation rate, 0-1 fraction)

  B01003_001E                     total population (used only to pick the town row
                                  when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR=2023), which
now REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_extra3.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — the
documented fallback used for fetch_acs_extra3.py. NOTE: the mirror's ``latest``
release is the most recent ACS 5-year vintage (currently ACS 2023 5-year), which
may be one year newer than ACS_YEAR. The derived columns are identical in
definition either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra4.json``::

    { "<TOWN_ID>": { "acs_has_computer_pct": 0.95, "acs_median_earnings": 48000, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra4.py
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra4.json"

# Census variable bundle (single query, well under the 50-var soft limit).
VARIABLES = [
    "B01003_001E",                                              # total pop (row picker)
    "B28003_001E", "B28003_002E",                              # households / has a computer
    "C16002_001E", "C16002_004E", "C16002_007E",              # total / limited-English households
    "C16002_010E", "C16002_013E",                            # (Spanish, Indo-Euro, Asian/PI, Other)
    "B20002_001E",                                             # median earnings ($)
    "B25070_001E", "B25070_007E", "B25070_008E",             # renter cost burden buckets
    "B25070_009E", "B25070_010E", "B25070_011E",
    "B23025_001E", "B23025_002E",                            # pop 16+ / in labor force
]

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "B28003", "C16002", "B20002", "B25070", "B23025"]
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
        # Census Reporter keys estimates as e.g. {"B28003": {"estimate":
        # {"B28003001": 42064.0, ...}}}. Convert each "B28003_002E" var into its
        # Census Reporter cell key "B28003002".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # B28003_002E -> B28003002
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
    field. Identical to fetch_acs_extra3.normalize_name — strips suffixes
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

    # % households with a computer.
    comp_total = safe_num(rec["B28003_001E"])
    has_computer = safe_num(rec["B28003_002E"])

    # % limited-English-speaking households (sum of the four language-group
    # limited-English cells) over all households.
    le_total = safe_num(rec["C16002_001E"])
    limited_english = _sum_cells(
        rec, ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"]
    )

    # Median earnings for workers (raw dollars).
    median_earnings = safe_num(rec["B20002_001E"])

    # % renter households cost-burdened 30%+: sum the 30-34.9 / 35-39.9 / 40-49.9
    # / 50%+ buckets, over renter households for whom the ratio was COMPUTED
    # (total minus "not computed").
    cost_burden = _sum_cells(
        rec, ["B25070_007E", "B25070_008E", "B25070_009E", "B25070_010E"]
    )
    renter_total = safe_num(rec["B25070_001E"])
    renter_not_computed = safe_num(rec["B25070_011E"])
    renter_computed = None
    if renter_total is not None:
        renter_computed = max(renter_total - (renter_not_computed or 0.0), 0.0)

    # Labor force participation rate (pop 16+ in labor force / pop 16+).
    lf_total = safe_num(rec["B23025_001E"])
    in_labor_force = safe_num(rec["B23025_002E"])

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":      int(pop_total) if pop_total is not None else None,
        "acs_has_computer_pct":       pct(has_computer, comp_total),
        "acs_limited_english_hh_pct": pct(limited_english, le_total),
        "acs_median_earnings":        int(round(median_earnings)) if median_earnings is not None else None,
        "acs_renter_cost_burden_pct": pct(cost_burden, renter_computed),
        "acs_labor_force_pct":        pct(in_labor_force, lf_total),
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
    cols = ["acs_has_computer_pct", "acs_limited_english_hh_pct", "acs_median_earnings",
            "acs_renter_cost_burden_pct", "acs_labor_force_pct"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
