"""
MCAS Gr3-8 achievement (% Meeting+Exceeding) for the UNDERSERVED subgroups the
atlas could not show at all: Military-Connected, Foster Care, Homeless, and
Migrant families. These are small, DESE-suppressed populations — but real, and
exactly the families who go looking for data about their own kids. This makes
them visible at the district level.

These sit in a deliberately separate category in the picker ("Achievement by
group (other)") so they stay distinct from the main race/income/SWD/EL groups
shipped by fetch_mcas_groups.py / fetch_mcas_groups2.py.

All cells are ELA + Math, Gr3-8 aggregate ("ALL (03-08)"). Subgroup labels are
the EXACT distinct ``stu_grp`` strings in the dataset (verified live).

Suppression vs. genuine zero (verified live against SY2025, see PR notes):
DESE simply OMITS sub-min-n cohorts from the dataset — there are NO rows with a
missing/blank ``m_plus_e_pct``. So a suppressed district just never gets a value
here (it stays absent -> renders as no-data). Every row that IS present carries a
real ``stu_cnt`` (>=10) AND a real ``m_plus_e_pct``. A handful of present rows
have ``m_plus_e_pct == 0``: these are GENUINE measured zeros — a reported cohort
of 10-46 students where none reached Meeting/Exceeding (e.g. Bourne Foster-Care
Math, stu_cnt=12, all 12 partially/not-meeting). These are KEPT, not nulled:
they are true, statistically-valid, severe-outcome signals and nulling them would
hide exactly the data these families came for. (This is the atlas's "genuine 0
stays, only *false*/missing 0 becomes null" rule — cf. staff_asian_pct.) The
to_frac guard below still rejects junk; districts that got nothing are dropped.

Coverage bar: ship a subgroup's ELA+Math only if its ELA coverage clears >=40
operating districts (a relaxed bar — the whole point is to serve small groups;
below ~40 the map is too empty to be useful even for them). Migrant is expected
to be far below this and is skipped if so. The fetcher prints per-column counts
so the bar can be checked against live data before the PR is opened.

Source: MA DESE "MCAS Achievement Results" [i9w6-niyt] (Education-to-Career hub,
Socrata), SY2025. ``m_plus_e_pct`` is a 0-1 fraction.

Output: ``data/ma_district_mcas_groups_other.json`` :: { DIST_CODE: {col: val} }

Run from repo root::  python scripts/fetch_mcas_groups_other.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_mcas_groups_other.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
DATASET = "i9w6-niyt"
SY = "2025"

# Ship a subgroup only if its ELA Gr3-8 coverage clears this many districts.
MIN_DISTRICTS = 40

# (key, exact stu_grp label). Labels are the dataset's distinct stu_grp strings.
SUBGROUPS = [
    ("military", "Military"),
    ("foster",   "Foster Care"),
    ("homeless", "Homeless"),
    ("migrant",  "Migrant"),  # likely too sparse — dropped below the bar.
]
SUBJECTS = [("ela", "ELA"), ("math", "MATH")]

# Build (column, subject_code, stu_grp) cells; Gr3-8 aggregate grade band only.
CELLS = []
for subj_lc, subj in SUBJECTS:
    for key, label in SUBGROUPS:
        CELLS.append((f"mcas_{subj_lc}_{key}", subj, label, key))


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """m_plus_e_pct is published as a 0-1 fraction. Guard: divide if it ever
    arrives as a percent (>1); reject negatives."""
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
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    ours.discard("00000000")  # never the synthetic state row
    out: dict[str, dict] = {dc: {} for dc in ours}
    # Stage raw per-cell hits so we can DROP whole subgroups under the bar before
    # writing — a subgroup that fails the ELA bar contributes no columns at all.
    staged: dict[str, dict[str, float]] = {col: {} for col, _, _, _ in CELLS}
    hits: dict[str, int] = {}

    for col, subj, grp, key in CELLS:
        grp_esc = grp.replace("'", "''")
        rows = soda(DATASET, {
            "$where": (f"org_type='Public School District' "
                       f"AND stu_grp='{grp_esc}' AND sy='{SY}' "
                       f"AND test_grade='ALL (03-08)' AND subject_code='{subj}'"),
            "$select": "dist_code,m_plus_e_pct",
            "$limit": "5000",
        })
        n = 0
        for r in rows:
            dc = norm(r.get("dist_code"))
            if dc not in out:
                continue
            v = to_frac(r.get("m_plus_e_pct"))
            if v is not None:
                staged[col][dc] = round(v, 4)
                n += 1
        hits[col] = n

    # Decide which subgroups clear the bar (judged on ELA coverage), then emit
    # only those subgroups' columns. Keeps a near-empty group (e.g. Migrant) out.
    kept_keys, skipped = [], []
    for key, label in SUBGROUPS:
        ela_n = hits.get(f"mcas_ela_{key}", 0)
        if ela_n >= MIN_DISTRICTS:
            kept_keys.append(key)
        else:
            skipped.append((key, label, ela_n))

    for col, subj, grp, key in CELLS:
        if key not in kept_keys:
            continue
        for dc, v in staged[col].items():
            out[dc][col] = v

    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))

    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (SY{SY})")
    print(f"  bar = >={MIN_DISTRICTS} districts (judged on each group's ELA coverage)")
    for col, subj, grp, key in CELLS:
        flag = "" if key in kept_keys else "   [DROPPED — below bar]"
        print(f"  {col:18s} {subj:4s} {grp:13s}: {hits[col]:4d}{flag}")
    if skipped:
        print("  skipped subgroups:",
              ", ".join(f"{lbl} (ELA {n})" for _, lbl, n in skipped))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
