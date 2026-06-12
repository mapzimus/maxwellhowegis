"""
Fill the 2015–2021 hole in the district low-income enrollment timeseries
(LI_PCT__YYYY) that drives the atlas year slider. DESE renamed "Low Income"
to "Economically Disadvantaged" for SY2015–2021, so the pipeline's `li_pct`
column is NULL those years while `ecd_pct` carries the (near-equivalent)
value. The slider therefore jumps 2014 -> 2022 with a 7-year gap.

This pulls `ecd_pct` (a 0-1 fraction) from MA DESE open data (Education-to-
Career hub, Socrata) for each year 2015–2021 and BAKES LI_PCT__2015 …
LI_PCT__2021 onto data/ma_academic_districts.geojson features by DIST_CODE —
the same column family the surrounding years use, so the slider fills with no
app change. The "Economically Disadvantaged" caveat for these years is
surfaced via METRIC_NOTES['LI_PCT'] in app.js.

  LI_PCT__2015 … LI_PCT__2021  <- Enrollment: ... [t8td-gens]  ecd_pct
                                  (org_type='District', one query per year)

ecd_pct is suppressed for very small districts; we bake only the
years/districts DESE publishes and leave the rest absent — we never fabricate.
Verified live: Abington 00010000 2015=0.172, 2021=0.297; Andover 00090000
2017=0.063.

Writes ma_academic_districts.geojson in place with compact separators
(matching scripts/round_coords.py), so only the new LI_PCT__YYYY keys change.

Run from repo root::  python scripts/fetch_li_pct_gap.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

YEARS = range(2015, 2022)  # the gap: SY2015–2021 inclusive ("Economically Disadvantaged")


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros; atlas uses zero-padded 8-char DIST_CODE."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0-1 fraction. ecd_pct comes as a fraction (0.172) already;
    divide only if a value looks like a percent."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def main() -> int:
    gj = json.loads(DISTS.read_text())
    feats = gj["features"]
    # DIST_CODE -> the live properties dict (mutating it mutates the feature).
    by_code = {f["properties"]["DIST_CODE"]: f["properties"] for f in feats}

    hits = {y: 0 for y in YEARS}
    for y in YEARS:
        rows = soda("t8td-gens", {
            "$where": f"org_type='District' AND sy='{y}' AND ecd_pct IS NOT NULL",
            "$select": "dist_code,ecd_pct",
            "$limit": "5000",
        })
        col = f"LI_PCT__{y}"
        for r in rows:
            props = by_code.get(norm(r.get("dist_code")))
            if props is None:
                continue
            v = to_frac(r.get("ecd_pct"))
            if v is not None:
                props[col] = round(v, 3); hits[y] += 1

    DISTS.write_text(json.dumps(gj, separators=(",", ":")))
    total = len(feats)
    print(f"baked LI_PCT__2015..2021 onto {DISTS.relative_to(REPO)} ({total} districts)")
    for y in YEARS:
        print(f"  LI_PCT__{y}: {hits[y]:>3}/{total}  (ecd_pct, org_type='District')")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
