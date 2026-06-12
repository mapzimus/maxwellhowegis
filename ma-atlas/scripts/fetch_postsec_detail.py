"""
Postsecondary OUTCOMES detail for Massachusetts high-school graduates, two gaps the
existing all-students postsec metrics don't cover (MA DESE Education-to-Career hub,
Socrata). Sibling of ``scripts/fetch_postsec_outcomes.py`` (which ships the
all-students 16-month enrollment + 2nd-year persistence). Written keyed by DIST_CODE.

GAP 1 — College-going BY SUBGROUP (an equity story the atlas was missing entirely).
  Source: Student Progression report ``sg4g-eg2n`` (NSC-linked), indicator
  "...through second year of postsecondary education", cohort 2023. We use its
  IMMEDIATE college-enrollment column (immediateenr_cnt = enrolled the fall right
  after HS), aggregated over the school-level rows per district on the Socrata
  server: sum(immediateenr_cnt)/sum(cohort_cnt) grouped by dist_code. This is the
  only postsec source with usable subgroup coverage for the low-income / SWD /
  Hispanic / Black / EL cuts (the sector-detail enrollment file ``kgrx-cg4a`` does
  NOT publish a Low Income / Econ-Disadvantaged subgroup at all, and its race/EL
  cuts fall well below a mappable coverage bar). All-students "16-month" enrollment
  already lives in the atlas as ``college_enroll_pct``; these are the immediate-
  enrollment subgroup analogues (slightly lower than 16-month by construction —
  immediate = the fall after HS, not a 16-month window).

    college_enroll_low_income  <- stu_grp='Low Income'
    college_enroll_swd         <- stu_grp='Students with Disabilities'
    college_enroll_hispanic    <- stu_grp='Hispanic or Latino'
    college_enroll_black       <- stu_grp='Black or African American'
    college_enroll_ell         <- stu_grp='English Learners'

GAP 2 — College COMPLETION (6-yr). Same dataset ``sg4g-eg2n``, the separate
  indicator "...through postsecondary degree completion", whose latest published
  cohort is 2016 (a 6-year obtain-a-degree window). We aggregate its degree column
  per district: sum(obtaindegree_cnt)/sum(cohort_cnt) grouped by dist_code,
  All Students. DESE's own obtaindegree_pct uses the entering HS cohort as the
  denominator, which we match.

    college_completion_pct     <- All Students, cohort 2016, obtaindegree/cohort

REMEDIATION / remedial-coursework was requested but is NOT PUBLISHED on
``educationtocareer.data.mass.gov`` — a catalog search for "remedial",
"remediation", "developmental education", and "MassTransfer" returns no
district-level dataset, so ``college_remediation_pct`` is intentionally dropped
(documented, not fabricated).

UNITS / FILTERS:
  * sg4g-eg2n is published at the SCHOOL level (no district rollup row), so every
    district rate is built from PUBLISHED COUNTS via the Socrata server (sum/sum
    grouped by dist_code). The state row dist_code='00000000' is excluded.
  * All *_pct outputs are 0-1 fractions to match the atlas's other rate columns.
  * Suppressed / non-HS districts get NO entry (stored null downstream, never 0):
    a district only lands in the file for a column when its summed cohort_cnt > 0
    and the numerator count is present. K-8 districts (no HS cohort) correctly fall
    out → ~211-district HS universe.

Output: ``data/ma_district_postsec_detail.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_postsec_detail.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_postsec_detail.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

DATASET = "sg4g-eg2n"               # Student Progression (NSC-linked)
IND_PERSIST = ("Student progression from high school through second year of "
               "postsecondary education")
IND_COMPLETE = ("Student progression from high school through postsecondary "
                "degree completion")
ENROLL_COHORT = "2023"              # latest progression cohort (immediate enrollment)
COMPLETE_COHORT = "2016"            # latest 6-yr degree-completion cohort

# stu_grp label (exact, verified live) -> output column for immediate enrollment.
SUBGROUPS = {
    "Low Income":                  "college_enroll_low_income",
    "Students with Disabilities":  "college_enroll_swd",
    "Hispanic or Latino":          "college_enroll_hispanic",
    "Black or African American":   "college_enroll_black",
    "English Learners":            "college_enroll_ell",
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def agg_rate(stu_grp: str, indicator: str, cohortyr: str,
             num_col: str) -> list[dict]:
    """Server-side sum(num_col)/sum(cohort_cnt) per district for one student group."""
    return soda(DATASET, {
        "$select": f"dist_code,sum(cohort_cnt) as coh,sum({num_col}) as num",
        "$where": (f"indicator='{indicator}' AND stu_grp='{stu_grp}' "
                   f"AND cohortyr='{cohortyr}' AND dist_code!='00000000'"),
        "$group": "dist_code",
        "$limit": "3000",
    })


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}
    counts: dict[str, int] = {}

    def apply(rows: list[dict], col: str) -> None:
        hits = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            try:
                coh = float(r.get("coh"))
                num = float(r.get("num"))
            except (TypeError, ValueError):
                continue            # suppressed -> leave absent (null downstream)
            if coh > 0:
                out[dc][col] = round(num / coh, 4)
                hits += 1
        counts[col] = hits

    # GAP 1 — immediate college enrollment by subgroup (cohort 2023).
    for stu_grp, col in SUBGROUPS.items():
        apply(agg_rate(stu_grp, IND_PERSIST, ENROLL_COHORT, "immediateenr_cnt"), col)

    # GAP 2 — 6-yr college completion, All Students (cohort 2016).
    apply(agg_rate("All Students", IND_COMPLETE, COMPLETE_COHORT, "obtaindegree_cnt"),
          "college_completion_pct")

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    for col in list(SUBGROUPS.values()) + ["college_completion_pct"]:
        yr = COMPLETE_COHORT if col == "college_completion_pct" else ENROLL_COHORT
        print(f"  {col:28} {counts.get(col, 0):4} districts (cohort {yr})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
