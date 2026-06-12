"""
WHOLE-CHILD / WELL-ROUNDED course-taking for MA districts, pulled from MA DESE's
open data (Education-to-Career hub, Socrata) into a join file keyed by DIST_CODE.

These answer the "is this a well-rounded school?" questions the atlas previously
could not touch (arts, music, a well-rounded diploma, advanced & digital-literacy
coursework) — a direct fit for the project's "approachable for normal people"
north-star ("Does this school have music?" is a top parent question).

All five columns are SHARES OF STUDENTS (0-1 fractions, value as DESE publishes
it), at the DISTRICT roll-up (org_type='District', stu_grp='All Students'), latest
published school year SY2025.

Columns written (atlas coverage of the 281-district academic universe in parens):
  arts_enrollment_pct   <- Arts Course Taking [w3f3-phkq], art_subj='All Subjects',
                           all_grds_pct = % of K-12 students enrolled in ANY arts
                           course (visual, music, theatre, dance, media, general). (99%)
  arts_music_pct        <- Arts Course Taking [w3f3-phkq], art_subj='Music',
                           all_grds_pct = % enrolled in a MUSIC course specifically. (99%)
  (MassCore completion and advanced-course completion were considered but DROPPED as
   duplicates of the atlas's existing masscore_pct (Outcomes) and
   adv_course_completion_pct (Advanced coursework, same dataset ujwr-ux9i).)
  dlcs_course_pct       <- Digital Literacy & Computer Science (DLCS) Course Taking
                           [fbdq-3q4d], subj='All Subjects', all_grades_pct =
                           % of K-12 students enrolled in a digital-literacy/CS
                           course. (~90% after zero-handling)

Value form: every source field is already a 0-1 fraction (e.g. 0.872). Kept as a
fraction to match the atlas's other *_pct columns. Sanity-checked: across all five,
observed max is exactly 1.0 and none exceed it.

Suppression / null handling (follows scripts/fetch_sped_detail.py + AGENTS.md
"null, never 0"):
  - A district with NO published row for a metric gets NO key (never 0).
  - A reported value of exactly 0 is stored as **null, not 0**. A bare 0 poisons the
    choropleth floor and ranks (scripts/analysis/data_anomalies.md Bug 2/5/8). The
    handful of reported zeros here are structural / non-reporting, not "lots of kids
    taking zero art":
      * MassCore 0.0 -> Northampton (does not formally track MassCore), Boston Day &
        Evening Academy, Libertas Academy (3 districts). These reflect non-reporting
        of the credential, not an absence of well-rounded coursework, so null is the
        honest paint.
      * DLCS 0.0 -> ~25 small districts with no CS/digital-literacy course offering.
        Genuinely a "CS desert", but a 0 at the floor would dominate the low end and
        read as a data value rather than "not offered"; stored as null and noted here.
    (Whether a 0 means "real none" vs "not reported" is not separable in these feeds,
    so null is the conservative, rank-safe choice the atlas convention prescribes.)

THEMES SEARCHED BUT NOT FEASIBLE on the DESE Socrata domain
(educationtocareer.data.mass.gov) — documented so the gap is explicit, not silently
dropped; NOTHING fabricated:
  - World language % and Physical-Education %: NO dedicated course-taking dataset
    exists. Only ARTS (w3f3-phkq) and DLCS (fbdq-3q4d) publish subject course-taking;
    there is no world-language or PE/health equivalent. MassCore (which requires 2yr
    of one world language + 1yr arts) is the closest published well-rounded proxy and
    is shipped above. Catalog q='world language'/'physical education'/'phys'/'course
    taking'/'subject enrollment' returned no such dataset.
  - Athletics participation (MIAA): NO dataset. q='athletic'/'sports'/'MIAA'/
    'interscholastic' returned only district/school *expenditure* tables (athletics as
    a spending line) and the Youth Risk Behavior Survey resource page — no
    district-level participation counts. MIAA is a non-DESE body and does not publish
    to this Socrata domain. Dropped per brief.
  - Civics (MA Civics Project / student civics engagement): NO dataset. Not published
    on the open-data domain. Dropped.

FACILITIES & TECHNOLOGY (school-side) — the brief's S14b theme — NOT FEASIBLE on this
domain; see scripts/fetch_facilities.py was NOT created because every probe came up
empty. Catalog probes that returned nothing relevant:
  - q='MSBA' -> none.   q='capital' -> none.   q='building' -> only a Pathways
    enrollment table.   q='facility' -> postsecondary tuition + a collaborative
    placement table (irrelevant).   q='capacity'/'enrollment capacity'/'square feet'/
    'infrastructure' -> only Early-Education-&-Care licensing/childcare datasets.
    q='device'/'technology' -> none school-side (only expenditure function codes and
    a Pathways table).
  MSBA building-age / condition / capital-pipeline and 1:1-device inventories live on
  MSBA's own site (massschoolbuildings.org) / district reports, NOT on Socrata, and
  are not queryable district-level open data. Facilities theme is therefore documented
  as not-feasible with available open data and NOT shipped. Nothing fabricated.

Output: ``data/ma_district_whole_child.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_whole_child.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_whole_child.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

SY = "2025"  # latest published school year across all five source datasets

# Each metric: (atlas column, dataset id, extra $where clause, pct field name).
# All are filtered to org_type='District', stu_grp='All Students', the chosen SY,
# and exclude the statewide rollup (dist_code 00000000).
METRICS = [
    ("arts_enrollment_pct",     "w3f3-phkq", "art_subj='All Subjects'", "all_grds_pct"),
    ("arts_music_pct",          "w3f3-phkq", "art_subj='Music'",        "all_grds_pct"),
    ("dlcs_course_pct",         "fbdq-3q4d", "subj='All Subjects'",     "all_grades_pct"),
    # Dropped as duplicates of existing atlas metrics: masscore_completion_pct
    # (== masscore_pct, Outcomes) and advanced_course_pct (== adv_course_completion_pct,
    # Advanced coursework, same dataset ujwr-ux9i). Whole-child keeps the genuinely-new
    # arts + digital-literacy course-taking metrics.
]


def soda(dataset: str, params: dict, tries: int = 4) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # transient network / Socrata hiccup -> back off
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"SODA failed for {dataset}: {last}")


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def frac(raw):
    """Return a 0-1 fraction, or None for suppressed/missing/zero.

    Source fields are already 0-1 fractions. Per AGENTS.md 'null, never 0', a
    reported exact 0 is treated as not-paintable (structural / non-reporting) and
    returned as None so it never poisons the choropleth floor or ranks. A value >1
    (shouldn't happen for these feeds, but guard anyway) is treated as a percent."""
    if raw is None or str(raw).strip() == "":
        return None
    try:
        f = float(raw)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    if f > 1.0:          # defensive: percent-form -> fraction
        f /= 100.0
    if f == 0.0:         # reported zero -> null (see module docstring)
        return None
    return f


def fetch_metric(dataset: str, extra_where, pct_field: str) -> dict[str, float]:
    where = (f"sy='{SY}' AND org_type='District' AND stu_grp='All Students' "
             f"AND dist_code!='00000000'")
    if extra_where:
        where += f" AND {extra_where}"
    rows = soda(dataset, {
        "$where": where,
        "$select": f"dist_code,{pct_field}",
        "$limit": "5000",
    })
    res: dict[str, float] = {}
    for r in rows:
        dc = norm(r.get("dist_code"))
        v = frac(r.get(pct_field))
        if v is not None:
            res[dc] = round(v, 4)
    return res


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    hits: dict[str, int] = {}
    for col, ds, extra, field in METRICS:
        data = fetch_metric(ds, extra, field)
        n = 0
        for dc, v in data.items():
            if dc in out:
                out[dc][col] = v
                n += 1
        hits[col] = n

    # Drop districts that got nothing, keep the file tidy.
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    for col, ds, _, _ in METRICS:
        print(f"  {col:24s} {hits[col]:3d}/{len(ours)} "
              f"({100*hits[col]/len(ours):4.0f}%)  [{ds}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
