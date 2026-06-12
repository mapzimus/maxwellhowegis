"""
Special-education DISABILITY-CATEGORY prevalence for MA districts, pulled from
MA DESE's open data (Education-to-Career hub, Socrata) into a join file keyed by
DIST_CODE. These describe *which primary disability* the district's students with
disabilities (SWDs) are classified under — the prevalence-by-disability lens that
complements the atlas's existing placement-setting SpEd metrics
(inclusion / separate / out-of-district, see fetch_sped_placement.py).

‼ DENOMINATOR IS SWD, NOT ALL STUDENTS. Every column here is a share of the
district's *students with disabilities* (DESE field tot_cnt = "Total Students
with Disabilities"), so the eleven shares sum to ~1.0 within a district. They are
NOT a share of total enrollment. The metric labels say "SWD —" to make the
denominator explicit to users.

Source dataset: Special Education Program Characteristics and Student Demographics
[n62c-bx65], the same dataset behind the placement metrics. We use the
ind_cat='Disability Type All' breakdown (the fully itemized primary-disability
classification) rather than 'Disability Type' (which collapses the long tail into
a single "Other Disability" bucket and suppresses smaller categories far more
aggressively — e.g. Intellectual reported for 3 districts vs 330). Both report the
*primary* disability and each sums to 1.0 per district; 'All' is just the
un-collapsed, higher-coverage view. Latest published year SY2026.

Columns written (ind_desc under ind_cat='Disability Type All', SY2026 atlas
coverage in parens — all clear the ≥40%-of-districts bar):
  sped_specific_learning_pct <- 'Specific Learning Disabilities'  (99%)
  sped_communication_pct     <- 'Communication Disability'        (100%)
  sped_autism_pct            <- 'Autism'                          (99%)
  sped_health_pct            <- 'Health Impairment' (incl. ADHD)  (98%)
  sped_developmental_pct     <- 'Developmental Delay'             (96%)
  sped_emotional_pct         <- 'Emotional Disability'            (94%)
  sped_neurological_pct      <- 'Neurological Disability'         (93%)
  sped_intellectual_pct      <- 'Intellectual Disability'         (86%)
  sped_sensory_pct           <- 'Sensory Impairment'              (82%)
  sped_multiple_pct          <- 'Multiple Disabilities'           (74%)
  sped_physical_pct          <- 'Physical Impairment'             (59%)

Values arrive as 0-1 fractions (value_type='Percent', e.g. 0.233) and are kept as
fractions to match the atlas's other *_pct columns.

Suppression / null handling:
  - A district with no published row for a category gets NO key (never 0).
  - DESE publishes ind_pct to 3 decimals, so a real but tiny category (a single
    student, ind_cnt=1) can round to ind_pct='0.0'. Storing that 0 would poison
    the choropleth/ranks (see scripts/analysis/data_anomalies.md). Where ind_pct
    rounds to 0 but ind_cnt>=1, we recompute the honest fraction ind_cnt/tot_cnt
    (~0.0005) instead — a real positive value, not a fabricated or suppressed one.
    (Affects 2 rows in SY2026: Newton/Multiple, Quincy/Physical.)

NOT INCLUDED — special-education evaluation-timeliness / IEP-compliance:
  The S3 brief asked for an on-time-evaluation / compliance metric "if queryable".
  n62c-bx65 has no such dimension (its ind_cat values are Disability Type[/All],
  Placement, In/Out of District, Enrollment, Grade Span, Gender, Race/Ethnicity,
  EL/Low-Income, and FTEs-per-100-SWDs — no evaluation-timeline field). A catalog
  search of educationtocareer.data.mass.gov for a sibling DESE special-ed
  evaluation/IEP-compliance open dataset surfaced none (only cross-domain
  federated noise). Dropped and documented per the brief; nothing fabricated.

Output: ``data/ma_district_sped_detail.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_sped_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_sped_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

DATASET = "n62c-bx65"          # Special Education Program Characteristics & Demographics
IND_CAT = "Disability Type All"  # itemized primary-disability classification
SY = "2026"                    # latest published school year

# atlas column  ->  DESE ind_desc value
SLICES = {
    "sped_specific_learning_pct": "Specific Learning Disabilities",
    "sped_communication_pct":     "Communication Disability",
    "sped_autism_pct":            "Autism",
    "sped_health_pct":            "Health Impairment",
    "sped_developmental_pct":     "Developmental Delay",
    "sped_emotional_pct":         "Emotional Disability",
    "sped_neurological_pct":      "Neurological Disability",
    "sped_intellectual_pct":      "Intellectual Disability",
    "sped_sensory_pct":           "Sensory Impairment",
    "sped_multiple_pct":          "Multiple Disabilities",
    "sped_physical_pct":          "Physical Impairment",
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def share(ind_pct, ind_cnt, tot_cnt):
    """Return a 0-1 fraction, or None for suppressed/missing.

    Shares arrive as 0-1 fractions already. A genuinely small category (a single
    student) can round to '0.0' in DESE's 3-decimal pct; storing 0 would poison
    ranks, so when ind_pct rounds to 0 we recompute ind_cnt/tot_cnt to keep the
    real (tiny, positive) value. A truly empty/negative value is None."""
    if ind_pct is None or ind_pct == "":
        return None
    try:
        f = float(ind_pct)
    except ValueError:
        return None
    if f < 0:
        return None
    if f > 1.0:           # guard the percent-form case, just like the placement fetcher
        f /= 100.0
    if f == 0.0:          # rounded-to-zero: recover the honest fraction from counts
        try:
            c, t = float(ind_cnt), float(tot_cnt)
        except (TypeError, ValueError):
            return None
        if c >= 1 and t > 0:
            return c / t
        return None       # a real 0 (no students) — drop, never store 0
    return f


def fetch_slice(ind_desc: str) -> dict[str, float]:
    """Pull one disability-category slice (latest SY) keyed by zero-padded
    DIST_CODE -> fraction-of-SWD. Excludes the statewide rollup (00000000)."""
    rows = soda(DATASET, {
        "$where": (f"sy='{SY}' AND ind_cat='{IND_CAT}' "
                   f"AND ind_desc='{ind_desc}' AND dist_code!='00000000'"),
        "$select": "dist_code,ind_pct,ind_cnt,tot_cnt",
        "$limit": "2000",
    })
    res: dict[str, float] = {}
    for r in rows:
        dc = norm(r.get("dist_code"))
        v = share(r.get("ind_pct"), r.get("ind_cnt"), r.get("tot_cnt"))
        if v is not None:
            res[dc] = round(v, 4)
    return res


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    hits: dict[str, int] = {}
    for col, desc in SLICES.items():
        slice_ = fetch_slice(desc)
        n = 0
        for dc, v in slice_.items():
            if dc in out:
                out[dc][col] = v
                n += 1
        hits[col] = n

    # Drop districts that got nothing, keep file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(SY{SY}, ind_cat='{IND_CAT}')")
    for col in SLICES:
        print(f"  {col:28s} {hits[col]:3d}/{len(ours)} "
              f"({100*hits[col]/len(ours):4.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
