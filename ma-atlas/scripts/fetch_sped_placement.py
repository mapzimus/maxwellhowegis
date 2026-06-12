"""
Special-education PLACEMENT / educational-environment metrics for MA districts,
pulled from MA DESE's open data (Education-to-Career hub, Socrata) into a join
file keyed by DIST_CODE. These describe the *setting* in which students with
disabilities (SWDs) receive services — distinct from the atlas's existing
SWD_PCT demographic and the grad_4yr__swd outcome slices.

  sped_full_inclusion_pct  <- Special Ed Program Characteristics [n62c-bx65]
                              ind_cat='Placement', ind_desc='Full Inclusion'
                              (SWD in general-ed >=80% of the school day)
  sped_partial_inclusion_pct<- same dataset, ind_desc='Partial Inclusion'
                              (SWD in general-ed 40-79% of the day)
  sped_separate_pct        <- same dataset, ind_desc='Substantially Separate'
                              (SWD in general-ed <40% of the day)
  sped_out_of_district_pct <- same dataset, ind_cat='In District/Out of District',
                              ind_desc='Out-of-District' (placed in a program
                              outside the district: private/collaborative/etc.)

All four are reported at the district level for ~270+/274 of the atlas's
academic districts. We take the latest year published (SY2026). Values arrive
as 0-1 fractions in the DESE source (value_type='Percent', e.g. 0.678) and are
kept as fractions to match the atlas's other *_pct columns.

Output: ``data/ma_district_sped.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_sped_placement.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_sped.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

DATASET = "n62c-bx65"   # Special Education Program Characteristics and Student Demographics
SY = "2026"             # latest published school year


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. Placement pcts arrive as 0.678
    already; guard the percent case anyway. Detect and divide as needed."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def fetch_placement(ind_cat: str, ind_desc: str) -> dict[str, float]:
    """Pull one placement/environment slice (latest SY) keyed by zero-padded
    DIST_CODE -> fraction. Excludes the statewide rollup (dist_code 00000000)."""
    rows = soda(DATASET, {
        "$where": (f"sy='{SY}' AND ind_cat='{ind_cat}' "
                   f"AND ind_desc='{ind_desc}' AND dist_code!='00000000'"),
        "$select": "dist_code,ind_pct",
        "$limit": "2000",
    })
    res: dict[str, float] = {}
    for r in rows:
        dc = norm(r.get("dist_code"))
        v = to_frac(r.get("ind_pct"))
        if v is not None:
            res[dc] = round(v, 4)
    return res


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # column -> (ind_cat, ind_desc) in DESE's Placement / In-Out-of-District cats
    SLICES = {
        "sped_full_inclusion_pct":    ("Placement", "Full Inclusion"),
        "sped_partial_inclusion_pct": ("Placement", "Partial Inclusion"),
        "sped_separate_pct":          ("Placement", "Substantially Separate"),
        "sped_out_of_district_pct":   ("In District/Out of District", "Out-of-District"),
    }

    hits: dict[str, int] = {}
    for col, (cat, desc) in SLICES.items():
        slice_ = fetch_placement(cat, desc)
        n = 0
        for dc, v in slice_.items():
            if dc in out:
                out[dc][col] = v
                n += 1
        hits[col] = n

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col in SLICES:
        print(f"  {col:28s} {hits[col]}/{len(ours)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
