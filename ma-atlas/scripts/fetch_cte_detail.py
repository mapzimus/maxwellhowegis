"""
Extend the atlas's career / vocational-technical (Chapter 74) coverage beyond the
single existing ``cte_enrollment_pct`` metric. Pulls from MA DESE's Education-to-
Career open-data hub (Socrata) and writes a join file keyed by 8-digit DIST_CODE:

  chapter74_programs   <- Pathways/Programs Enrollment [9p45-t37j]
                          # of DISTINCT Chapter 74 programs a district offers, i.e.
                          the count of District-level program rows under pathway
                          "Career Technical Education (Chapter 74 Programs)" MINUS
                          the per-district roll-up row "Career Technical Education
                          Programs". (Each (district, program) pair is unique.)
                          SY2026. Count -> format "num".

  cte_female_pct       <- Pathways/Programs Enrollment [9p45-t37j]  fe_pct
                          % of the district's CTE (Chapter 74) students who are
                          female -- the demographic composition OF the CTE cohort
                          (denominator = CTE enrollees, not all students). A CTE
                          gender-equity-of-access lens. SY2026 roll-up row. "pct".

  cte_high_needs_pct   <- Pathways/Programs Enrollment [9p45-t37j]  hn_pct
                          % of the district's CTE (Chapter 74) students who are in
                          the High Needs umbrella (low-income / ELL / SWD). SY2026
                          roll-up row. Equity-of-access lens. "pct".

COVERAGE / UNIVERSE
-------------------
CTE is reported only by the in-district Chapter 74 *host* districts; the remaining
academic districts send their students out to regional voc-tech districts (which
live in the overlay geojson, not the academic set) and are correctly absent /
``null`` here -- exactly the same caveat as the existing ``cte_enrollment_pct``.
So the relevant universe for these metrics is the host districts, NOT all 281
academic districts.

All three shipped columns reach every academic-set Chapter 74 host -- the same 61
districts that ``cte_enrollment_pct`` covers (100% of the host universe). The ~95
"hosts" visible in the raw 9p45-t37j feed include ~34 regional voc-tech districts
that live in the OVERLAY geojson (ma_districts_metrics.geojson), not the academic
set; those are filtered out here and reached by the overlay, not this file.

A literal 0.0 in a *_pct composition column (e.g. a tiny single-program district
with no female CTE enrollees) is stored as ``null``, never 0, per the atlas rule
(a 0 poisons choropleths/ranks). Program counts are always >= 1 for a host.

CO-OP / WORK-BASED LEARNING -- FOUND, REAL, BUT BELOW THE COVERAGE BAR (not shipped)
-----------------------------------------------------------------------------------
Advanced Course Completion [ujwr-ux9i] DOES expose a real, district-level Chapter
74 co-op column ``ch74_coop_pct`` (% of grade 11-12 students in a Chapter 74
cooperative-education placement, SY2025, org_type=District, stu_grp="All
Students"). It is genuinely queryable and on-theme. We do NOT ship it because,
once restricted to the academic-district set, only ~18 of the 61 hosts (~30%)
carry a non-zero value -- below the >=40% host-universe coverage bar. The high-
co-op districts are the regional voc-techs (e.g. 08010000), which live in the
overlay geojson, not the academic set, so they are filtered out here. This is a
strong follow-up if/when the overlay voc-techs receive district-style metrics
(see plans/SESSION-S2.md note on the regional voc-techs). Source recorded here so
it is not re-discovered from scratch.

INDUSTRY-RECOGNIZED CREDENTIALS / CTE-COMPLETER OUTCOMES -- NOT SHIPPED (no source)
---------------------------------------------------------------------------------
The brief's wish-list also named: CTE completer 4-yr graduation rate, % of CTE
completers positively placed (employed/enrolled/military), and industry-recognized
credentials earned per 100 CTE students. After auditing the Education-to-Career
Socrata catalog (queries: "vocational", "Chapter 74", "career technical",
"perkins", "industry-recognized credential", "credential", "co-op", "completer",
"work-based learning", "positive placement", "MassCore", "college and career")
there is NO district-level Socrata table that exposes any of those three measures:
  * No table carries CTE-completer counts, a CTE-completer graduation rate, or a
    CTE-completer "positive placement" rate. The College & Career Outcomes table
    (vj54-j4q3) is keyed by district but covers ALL high-school graduates and only
    exposes postsecondary-enrollment / employment outcome_types -- there is no
    Chapter-74 / CTE-completer slice (verified its distinct outcome_type values).
  * No table anywhere on the hub mentions industry-recognized credentials at the
    district level ("industry-recognized credential" + "credential" return only
    educator-licensure datasets).
  * The Crosswalk of CTE Programs to Occupations (8ibc-ffun) is a statewide
    program->occupation reference table with NO district column, so it cannot
    yield a per-district program count (we use 9p45-t37j for that instead).
  * The only Perkins/CTE-reporting hit is a non-tabular "Resource Page" href
    (m43v-328k), not a queryable SODA dataset.
Those three metrics are therefore intentionally omitted rather than fabricated.
The one genuinely new outcome-adjacent measure that DOES exist at district level
is the Chapter 74 co-op rate (ch74_coop_pct, documented above) -- but it falls
below the academic-set coverage bar, so this file ships the three composition /
program-count columns instead.

Output: ``data/ma_district_cte_detail.json`` :: { DIST_CODE: {col: value, ...} },
restricted to DIST_CODEs present in data/ma_academic_districts.geojson.

Run from repo root::  python scripts/fetch_cte_detail.py
"""
from __future__ import annotations
import json, time, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_cte_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

PATHWAY_CH74 = "Career Technical Education (Chapter 74 Programs)"
ROLLUP = "Career Technical Education Programs"  # per-district summary row


def soda(dataset: str, params: dict) -> list[dict]:
    """GET a SODA resource with a small retry loop (the hub intermittently resets
    TLS connections on Windows)."""
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - transient TLS/connection resets
            last = e
            time.sleep(2 + attempt)
    raise RuntimeError(f"SODA fetch failed for {dataset}: {last}")


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 50000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def frac(v):
    """Normalize to a 0-1 fraction or None. Source *_pct ship as 0.41 already;
    divide only if a stray percent (>1) shows up. Negatives -> None."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # ── 9p45-t37j : all District-level Chapter 74 rows (SY2026) ──────────────
    # One row per (district, program). The roll-up row "Career Technical
    # Education Programs" carries the cohort counts + demographic composition;
    # every other program row is one distinct Chapter 74 program offered.
    ch74 = soda("9p45-t37j", {
        "$where": f"org_type='District' AND sy='2026' AND pathway='{PATHWAY_CH74}'",
        "$select": "dist_code,program,fe_pct,hn_pct",
        "$limit": "10000",
    })
    prog_counts: dict[str, int] = {}
    fe_hits = hn_hits = 0
    for r in ch74:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        if r.get("program") == ROLLUP:
            # demographic composition of the CTE cohort; a literal 0 share is
            # stored as null (never 0) per the atlas rule.
            if (v := frac(r.get("fe_pct"))) is not None and v > 0:
                out[dc]["cte_female_pct"] = round(v, 4); fe_hits += 1
            if (v := frac(r.get("hn_pct"))) is not None and v > 0:
                out[dc]["cte_high_needs_pct"] = round(v, 4); hn_hits += 1
        else:
            # a distinct Chapter 74 program offering
            prog_counts[dc] = prog_counts.get(dc, 0) + 1

    prog_hits = 0
    for dc, n in prog_counts.items():
        if n > 0:  # never store a 0 (a host always has >=1 program row anyway)
            out[dc]["chapter74_programs"] = n; prog_hits += 1

    # Drop districts that got nothing; keep the file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  chapter74_programs : {prog_hits} (SY2026, # distinct Ch74 programs)")
    print(f"  cte_female_pct     : {fe_hits} (SY2026, female share of CTE cohort)")
    print(f"  cte_high_needs_pct : {hn_hits} (SY2026, High Needs share of CTE cohort)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
