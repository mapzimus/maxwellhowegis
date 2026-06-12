"""
Add EL *composition* metrics — the make-up of a district's English Learners, beyond
the existing ACCESS progress/proficiency/exiting outcomes — by pulling DESE's ACCESS
for ELLs Composite Proficiency Level results from MA DESE's open data (Education-to-
Career hub, Socrata) and writing a side join file keyed by DIST_CODE:

  el_avg_proficiency_level  <- ACCESS Composite Proficiency Level [72n5-hu3e]  avg_ovrall_comp_lvl
  el_avg_years_in_state     <- ACCESS Composite Proficiency Level [72n5-hu3e]  avg_year_ma
  el_beginner_pct           <- [72n5-hu3e]  level_1_pct + level_2_pct  (WIDA 1-2)
  el_high_proficiency_pct   <- [72n5-hu3e]  level_5_pct + level_6_pct  (WIDA 5-6)

These describe WHO the ELs are, not how they are progressing (puw9-zucz, the existing
el_making_progress / el_proficiency / el_exiting columns). All rows are the district
"Overall Score" composite domain (the across-domain WIDA composite), latest year.

Columns, from the WIDA ACCESS composite proficiency scale (levels 1=Entering …
6=Reaching):
  avg_ovrall_comp_lvl  — district mean overall composite proficiency level (1.0-6.0).
                         Higher = ELs are, on average, further along in English.
  avg_year_ma          — district mean number of years the tested ELs have been
                         enrolled in MA public schools. A tenure lens: high values
                         flag a long-term-EL population; low values a newcomer-heavy
                         one. (DESE does not publish a discrete "newcomer (≤1 yr)" or
                         "long-term EL" district count, so this mean is the available
                         proxy — see the search note in the PR.)
  el_beginner_pct      — share of tested ELs scoring at WIDA levels 1-2 (Entering /
                         Emerging): the early-stage, most-service-intensive ELs. A
                         newcomer-intensity proxy; higher → more beginners.
  el_high_proficiency_pct — share at WIDA levels 5-6 (Bridging / Reaching): ELs at or
                         near English proficiency.
The six level_*_pct columns are published as 0-1 fractions and sum to ~1.0 per row;
we add the relevant pair so the published rounding is preserved.

Coverage: ELs are unevenly distributed, so this is an EL-universe metric, not an
all-274 one. DESE suppresses small-N districts (min tested cell), which surface as
absent rows -> stored as nothing (district dropped), never 0. Operating-district
coverage after filtering to the atlas universe is printed at the end (~225-230).

We take the latest published year (SY2025; the source spans 2022..2025) for the
district-level (org_type='District') Overall Score domain.

Output: ``data/ma_district_el_detail.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_el_detail.py
"""
from __future__ import annotations
import json, time, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_el_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "72n5-hu3e"
SY = "2025"  # latest year published in 72n5-hu3e (2022..2025)


def soda(dataset: str, params: dict, tries: int = 4) -> list[dict]:
    """GET with a small retry: the Education-to-Career host occasionally resets the
    TLS connection on rapid sequential requests."""
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2.5)
    return []  # unreachable


def norm(code) -> str:
    """DESE codes may drop leading zeros; atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def num(v):
    """Parse a numeric value; reject blanks/negatives -> None (never 0-for-missing)."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def frac_sum(*vals):
    """Sum a set of 0-1 fraction columns (e.g. level_1_pct+level_2_pct). Returns None
    only if every input is missing; treats a present-but-blank cell as 0 contribution
    so a district that simply has nobody at those levels reads as 0.0, which is real."""
    present = [num(v) for v in vals]
    if all(p is None for p in present):
        return None
    return sum(p for p in present if p is not None)


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # ACCESS Composite Proficiency Level — latest SY, District-level, Overall Score
    # (the across-domain WIDA composite, distinct from Literacy/Oral/Comprehension).
    rows = soda(DATASET, {
        "$where": (f"org_type='District' AND composite_domain='Overall Score' "
                   f"AND sy='{SY}'"),
        "$select": ("dist_code,avg_ovrall_comp_lvl,avg_year_ma,"
                    "level_1_pct,level_2_pct,level_5_pct,level_6_pct"),
        "$limit": "5000",
    })

    hits = {c: 0 for c in
            ("el_avg_proficiency_level", "el_avg_years_in_state",
             "el_beginner_pct", "el_high_proficiency_pct")}
    for r in rows:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        vals = {
            "el_avg_proficiency_level": num(r.get("avg_ovrall_comp_lvl")),
            "el_avg_years_in_state":    num(r.get("avg_year_ma")),
            "el_beginner_pct":          frac_sum(r.get("level_1_pct"), r.get("level_2_pct")),
            "el_high_proficiency_pct":  frac_sum(r.get("level_5_pct"), r.get("level_6_pct")),
        }
        for col, v in vals.items():
            if v is not None:
                out[dc][col] = round(v, 4)
                hits[col] += 1

    # Drop districts that got nothing, keep file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts  (SY{SY})")
    for col, n in hits.items():
        print(f"  {col:26s}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
