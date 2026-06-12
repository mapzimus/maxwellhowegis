"""
Fetch a THIRD bundle of statewide MA Census ACS 5-year variables at the County
Subdivision (COUSUB) level — one row per municipality — and write them as
``data/ma_muni_acs_extra2.json`` keyed by MA Department of Revenue (DOR) town ID,
so the atlas can join them onto ma_municipalities.geojson at load time.

This is a companion to ``fetch_acs_basics.py`` and ``fetch_acs_extra.py`` and
follows the exact same API call style, TOWN_ID keying, name normalization, and
keyless Census Reporter fallback. It only adds NEW metrics not already covered by
``ma_muni_acs.json`` or ``ma_muni_acs_extra.json``.

New variables (ACS 5-year, round 2):

  B23025_003E + B23025_005E     -> acs_unemployment_pct = unemployed /
                                   civilian labor force (0-1 fraction)
  B27001_001E + 18 no-coverage  -> acs_uninsured_pct = pop with no health
                                   insurance / civilian noninstitutionalized pop
                                   (0-1 fraction)
  B18101_001E + 12 with-disab   -> acs_disability_pct = pop with a disability /
                                   civilian noninstitutionalized pop (0-1 fraction)
  B09001_001E + B01003_001E     -> acs_under18_pct = population under 18 /
                                   total population (0-1 fraction)
  B25044_001E + _003E + _010E   -> acs_no_vehicle_pct = (owner + renter) occupied
                                   households with no vehicle available / total
                                   occupied households (0-1 fraction)

  B01003_001E                   total population (used only to pick the town row
                                when multiple COUSUB/CDP rows share a TOWN_ID)

Data source / vintage
----------------------
Primary path: the official Census API (``acs/acs5`` for ACS_YEAR=2023), which
now REQUIRES a free key (set ``CENSUS_API_KEY``). Pulled in a single round trip,
same as fetch_acs_basics.py / fetch_acs_extra.py.

No-key fallback: when ``CENSUS_API_KEY`` isn't set, the same tables are pulled
keyless from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — the
documented fallback used for fetch_acs_extra.py. NOTE: the mirror's ``latest``
release is the most recent ACS 5-year vintage (currently ACS 2024 5-year), which
is one year newer than ACS_YEAR. The derived columns are identical in definition
either way; the script prints the actual release used.

Output file: ``data/ma_muni_acs_extra2.json``::

    { "<TOWN_ID>": { "acs_unemployment_pct": 0.041, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_extra2.py
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs_extra2.json"

# B27001 "No health insurance coverage" cells, summed across every age/sex bucket.
B27001_NO_INS = [
    "B27001_005E", "B27001_008E", "B27001_011E", "B27001_014E", "B27001_017E",
    "B27001_020E", "B27001_023E", "B27001_026E", "B27001_029E", "B27001_033E",
    "B27001_036E", "B27001_039E", "B27001_042E", "B27001_045E", "B27001_048E",
    "B27001_051E", "B27001_054E", "B27001_057E",
]

# B18101 "With a disability" cells, summed across every age/sex bucket.
B18101_WITH_DISAB = [
    "B18101_004E", "B18101_007E", "B18101_010E", "B18101_013E", "B18101_016E",
    "B18101_019E", "B18101_023E", "B18101_026E", "B18101_029E", "B18101_032E",
    "B18101_035E", "B18101_038E",
]

# Census variable bundle (single query, well under the 50-var soft limit).
VARIABLES = [
    "B01003_001E",                  # total pop (row picker + under-18 denom)
    "B23025_003E", "B23025_005E",   # civilian labor force / unemployed
    "B27001_001E", *B27001_NO_INS,  # health insurance: total + no-coverage cells
    "B18101_001E", *B18101_WITH_DISAB,  # disability: total + with-disability cells
    "B09001_001E",                  # population under 18
    "B25044_001E", "B25044_003E", "B25044_010E",  # vehicles available
]

# Census Reporter table IDs corresponding to the variables above.
CR_TABLES = ["B01003", "B23025", "B27001", "B18101", "B09001", "B25044"]
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
        # Census Reporter keys estimates as e.g. {"B23025": {"estimate":
        # {"B23025001": 42064.0, ...}}}. Convert each "B23025_003E" var into its
        # Census Reporter cell key "B23025003".
        for var in VARIABLES:
            table = var.split("_")[0]
            cell = var.replace("_", "").rstrip("E")  # B23025_003E -> B23025003
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
    field. Identical to fetch_acs_extra.normalize_name — strips suffixes
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

    civ_labor = safe_num(rec["B23025_003E"])
    unemployed = safe_num(rec["B23025_005E"])

    ins_total = safe_num(rec["B27001_001E"])
    no_ins = _sum_cells(rec, B27001_NO_INS)

    disab_total = safe_num(rec["B18101_001E"])
    with_disab = _sum_cells(rec, B18101_WITH_DISAB)

    under18 = safe_num(rec["B09001_001E"])

    hh_total = safe_num(rec["B25044_001E"])
    no_veh = _sum_cells(rec, ["B25044_003E", "B25044_010E"])

    def pct(num, denom):
        if num is None or not denom:
            return None
        return round(num / denom, 6)

    return {
        "_acs_total_population":   int(pop_total) if pop_total is not None else None,
        "acs_unemployment_pct":    pct(unemployed, civ_labor),
        "acs_uninsured_pct":       pct(no_ins, ins_total),
        "acs_disability_pct":      pct(with_disab, disab_total),
        "acs_under18_pct":         pct(under18, pop_total),
        "acs_no_vehicle_pct":      pct(no_veh, hh_total),
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
    cols = ["acs_unemployment_pct", "acs_uninsured_pct", "acs_disability_pct",
            "acs_under18_pct", "acs_no_vehicle_pct"]
    for c in cols:
        n = sum(1 for r in out.values() if r.get(c) is not None)
        print(f"  {c}: {n}/{len(out)} non-null")

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
