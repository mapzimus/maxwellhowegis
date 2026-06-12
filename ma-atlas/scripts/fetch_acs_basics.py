"""
Fetch statewide MA Census ACS 5-year basics at the County Subdivision (COUSUB)
level — i.e. one row per municipality — and write them as
``data/ma_muni_acs.json`` keyed by MA Department of Revenue (DOR) town ID so the
atlas can join them onto ma_municipalities.geojson at load time.

Variables pulled (ACS 2023 5-year — covers 2019–2023):

  B01003_001E                   Total population
  B19013_001E                   Median household income
  B05002_001E + B05002_013E     Foreign-born share
  B15003_001E + B15003_022-025E Bachelor's degree or higher (pop 25+)
  C16001_001E + C16001_002E     % speaks non-English at home (pop 5+)
  B17001_001E + B17001_002E     Total poverty rate (proxy for child poverty
                                until B17001 child cells are added later)
  B25070_001E + B25070_007–010E % severely rent-burdened (>=30%)

The Census API accepts unkeyed requests for small queries, so this script will
work without a key — but if you have one (free signup, instant), set
``CENSUS_API_KEY`` in your environment for higher rate limits.

Output file: ``data/ma_muni_acs.json``::

    { "<TOWN_ID>": { "acs_median_household_income": 75432, ... }, ... }

Run from the repo root::

    python scripts/fetch_acs_basics.py

Keying note: the script joins Census COUSUB (state+county+cousub FIPS) onto MA
DOR town IDs via a name-match (NAME field from Census vs. TOWN field on the
muni geojson). Names are normalized (lowercase, strip "city"/"town"/"CDP").

Doubled-suffix caveat: several MA municipalities are legally "cities known as
the Town of X" and Census labels them with a doubled suffix, e.g.
"Braintree Town city". ``normalize_name`` strips suffixes repeatedly so these
match the TOWN field; a single-strip version silently dropped 17 towns
(Braintree, Amherst, Methuen, Weymouth, Watertown, …) from the join.

No-key fallback: the official Census API now requires a key for all requests.
When a key isn't available, the same ACS table bundle can be pulled keyless
from the Census Reporter mirror (api.censusreporter.org, geo_ids
"060|04000US25") and run through the identical ``derive_row`` logic — this is
how the 17 doubled-suffix towns were backfilled.
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
OUT_PATH = REPO_ROOT / "data" / "ma_muni_acs.json"

# Census variable bundles. Kept under the 50-variable-per-query soft limit so
# everything fits in one HTTP round trip.
VARIABLES = [
    "B01003_001E",                                          # total pop
    "B19013_001E",                                          # median household income
    "B05002_001E", "B05002_013E",                           # foreign-born
    "B15003_001E", "B15003_022E", "B15003_023E",
    "B15003_024E", "B15003_025E",                           # bachelor's+
    "C16001_001E", "C16001_002E",                           # non-English at home
    "B17001_001E", "B17001_002E",                           # poverty
    "B25070_001E", "B25070_007E", "B25070_008E",
    "B25070_009E", "B25070_010E",                           # rent burden
]


def fetch_cousub() -> list[list[str]]:
    """Pull one row per MA county subdivision (~351 munis incl. CDP variants)."""
    if not API_KEY:
        sys.exit(
            "CENSUS_API_KEY not set. Get a free key (instant signup, email-only) at\n"
            "  https://api.census.gov/data/key_signup.html\n"
            "then run:\n"
            "  PowerShell:  $env:CENSUS_API_KEY = 'YOUR_KEY'\n"
            "  Bash:        export CENSUS_API_KEY=YOUR_KEY\n"
            "and re-run this script."
        )
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
        sys.exit(f"Census API returned HTML (likely a bad key or rate limit). First 200 chars:\n{body[:200]}")
    return json.loads(body)


def normalize_name(raw: str) -> str:
    """Strip Census suffixes and normalize for matching against MA DESE TOWN field.

    Census labels several MA municipalities that are legally "cities known as
    the Town of X" with a doubled suffix, e.g. "Braintree Town city",
    "Amherst Town city", "Methuen Town city". Stripping only one suffix leaves
    a trailing " Town"/" City" that never matches the TOWN field, which silently
    dropped 17 towns (Braintree, Amherst, Methuen, Weymouth, Watertown, …) from
    the ACS join. Strip suffixes repeatedly to handle the doubled case.
    """
    if not raw:
        return ""
    # Census NAME format: "Acton town, Middlesex County, Massachusetts" or
    # "Boston city, Suffolk County, Massachusetts"
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


def safe_int(v: str | None) -> int | None:
    if v is None or v == "" or v in ("-", "N", "(X)"):
        return None
    try:
        n = int(v)
        return None if n < 0 else n
    except ValueError:
        try:
            return int(float(v))
        except ValueError:
            return None


def derive_row(rec: dict) -> dict:
    """Compute the friendly metric columns the atlas consumes."""
    pop_total = safe_int(rec["B05002_001E"])
    foreign = safe_int(rec["B05002_013E"])
    edu_total = safe_int(rec["B15003_001E"])
    bach_or_higher = sum(
        safe_int(rec[k]) or 0
        for k in ("B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E")
    )
    lang_total = safe_int(rec["C16001_001E"])
    eng_only = safe_int(rec["C16001_002E"])
    pov_total = safe_int(rec["B17001_001E"])
    pov_below = safe_int(rec["B17001_002E"])
    rent_total = safe_int(rec["B25070_001E"])
    burden = sum(
        safe_int(rec[k]) or 0
        for k in ("B25070_007E", "B25070_008E", "B25070_009E", "B25070_010E")
    )

    def pct(num: int | None, denom: int | None) -> float | None:
        if num is None or not denom:
            return None
        return num / denom

    return {
        "acs_total_population":         pop_total,
        "acs_median_household_income":  safe_int(rec["B19013_001E"]),
        "acs_foreign_born_pct":         pct(foreign, pop_total),
        "acs_bachelors_plus_pct":       pct(bach_or_higher, edu_total),
        "acs_non_english_pct":          pct(
            (lang_total - eng_only) if (lang_total is not None and eng_only is not None) else None,
            lang_total,
        ),
        "acs_child_poverty_pct":        pct(pov_below, pov_total),
        "acs_severe_rent_burden_pct":   pct(burden, rent_total),
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

    rows = fetch_cousub()
    header, *records = rows
    print(f"got {len(records)} COUSUB rows from Census")

    town_lookup = build_lookup_by_town_id()
    print(f"resolved {len(town_lookup)} town -> TOWN_ID mappings from geojson")

    out: dict[str, dict] = {}
    skipped = 0
    for r in records:
        rec = dict(zip(header, r))
        norm = normalize_name(rec["NAME"])
        town_id = town_lookup.get(norm)
        if not town_id:
            skipped += 1
            continue
        derived = derive_row(rec)
        # If we already have a row for this TOWN_ID (e.g. multiple CDPs in same
        # town), prefer the one with the larger population (= the actual town).
        prior = out.get(town_id)
        if prior and (prior.get("acs_total_population") or 0) >= (derived.get("acs_total_population") or 0):
            continue
        out[town_id] = derived

    print(f"matched {len(out)} towns ({skipped} COUSUB rows skipped — usually CDPs without a TOWN_ID match)")
    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"wrote {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
