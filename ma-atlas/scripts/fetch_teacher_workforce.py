"""
Add teacher-WORKFORCE-DEPTH metrics to the atlas — the age/experience profile of a
district's teaching staff plus its special-education staffing share — pulled from
MA DESE open data (Education-to-Career hub, Socrata) and written to a join file
keyed by DIST_CODE. These are DISTINCT from the workforce columns the atlas already
carries (teacher retention, % experienced, % in-field, % licensed, attendance,
salary, staff race shares, student:teacher ratio, admin/para ratios, educators of
color, principal retention):

  teacher_under32_pct  <- Elementary and Secondary Educators by Age Group
                          [a4b4-k49f], job_cat='Instructional Staff',
                          job_name='Teacher', org_type='District', latest SY (2026).
                          Early-career share = und_26_pct + btwn_26_32_pct
                          (the dataset's two youngest age bands, < 33 yrs old).
  teacher_57plus_pct   <- same a4b4-k49f teacher row. Near-/approaching-retirement
                          share = btwn_57_64_pct + ovr_64_pct (the two oldest bands).
                          NB the dataset's bands break at 56/57, so there is no exact
                          "55+" cut available — 57+ is the honest near-retirement band.
  teacher_sped_pct     <- Elementary and Secondary Teachers by Program Area
                          [vd2f-ib9q], org_type='District', latest SY (2026).
                          sped_fte_pct = share of a district's teacher FTE assigned to
                          Special Education programs. The four program shares
                          (gen-ed / SPED / EL / career-tech) partition the teacher FTE
                          and sum to 1.0, so this is a clean pre-computed fraction.

Age bands in a4b4-k49f (each a *_pct of the teacher FTE, summing to 1):
  und_26, btwn_26_32, btwn_33_40, btwn_41_48, btwn_49_56, btwn_57_64, ovr_64.

All three outputs are fractions (0-1) to match the atlas's other *_pct columns.
A district with 0 teacher FTE is stored as null (never 0/huge), guarding against a
zero-denominator artifact in the choropleth / ranks.

NOT SHIPPED — deliberately skipped, documented here:
  * Teachers by Grade and Subject [77fu-a6h8]: SKIPPED. Its *_pct columns are
    grade distributions WITHIN a subject (e.g. what % of Math teachers teach Gr3-5),
    not shares across subjects. Building "% STEM teachers" would mean summing
    overlapping per-subject FTE counts (a teacher of both Math and Science is counted
    in each), so the counts do not divide into a clean, well-defined denominator.
    Counts alone don't map well here — left out per brief ("don't force it").
  * Educator Licensure by Race/Ethnicity [ky22-vsgr]: SKIPPED. The atlas already
    ships educators_of_color_pct (non-white TEACHER share) plus all-staff race shares
    (White/Hispanic/Black/Asian). A licensure-by-race breakdown adds no genuinely new
    district-level signal over what is already mapped.
  * gen_ed / el / career-tech program shares from vd2f-ib9q: not shipped as separate
    metrics — gen-ed is ~the complement of the others, EL is tiny, and career-tech is
    0 outside vocational districts; SPED is the one broadly meaningful, varying slice.

Output: ``data/ma_district_teacher_workforce.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_teacher_workforce.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_teacher_workforce.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}
SY = "2026"  # latest published school year for both datasets


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction, or None. Bands come as 0.146 already,
    but guard against any percent-style values (14.6) and negatives/blanks."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def add_band(row, *cols):
    """Sum a set of age-band *_pct columns; None if any band is missing (so a partial
    row never yields a misleadingly small share)."""
    total = 0.0
    for c in cols:
        v = to_frac(row.get(c))
        if v is None:
            return None
        total += v
    return round(total, 4)


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Teacher age profile — early-career (<33) and approaching-retirement (57+)
    #    shares of district teacher FTE. Latest SY, the 'Teacher' instructional row.
    age = soda("a4b4-k49f", {
        "$where": (f"org_type='District' AND job_cat='Instructional Staff' "
                   f"AND job_name='Teacher' AND sy='{SY}'"),
        "$select": ("dist_code,fte_cnt,und_26_pct,btwn_26_32_pct,"
                    "btwn_57_64_pct,ovr_64_pct"),
        "$limit": "3000",
    })
    u32_hits = p57_hits = 0
    for r in age:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        # Zero (or missing) teacher FTE → no meaningful age profile; leave null.
        fte = r.get("fte_cnt")
        try:
            if fte is None or float(fte) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        u32 = add_band(r, "und_26_pct", "btwn_26_32_pct")
        if u32 is not None:
            out[dc]["teacher_under32_pct"] = u32; u32_hits += 1
        p57 = add_band(r, "btwn_57_64_pct", "ovr_64_pct")
        if p57 is not None:
            out[dc]["teacher_57plus_pct"] = p57; p57_hits += 1

    # 2) Special-education teacher share — % of teacher FTE in SPED programs. Clean
    #    pre-computed fraction; the four program shares partition the teacher FTE.
    prog = soda("vd2f-ib9q", {
        "$where": f"org_type='District' AND sy='{SY}'",
        "$select": "dist_code,tchr_fte_cnt,sped_fte_pct",
        "$limit": "3000",
    })
    s_hits = 0
    for r in prog:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        fte = r.get("tchr_fte_cnt")
        try:
            if fte is None or float(fte) <= 0:
                continue
        except (TypeError, ValueError):
            continue
        v = to_frac(r.get("sped_fte_pct"))
        if v is not None:
            out[dc]["teacher_sped_pct"] = round(v, 4); s_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  teacher_under32_pct: {u32_hits} (SY{SY}, und_26 + 26-32 bands)")
    print(f"  teacher_57plus_pct:  {p57_hits} (SY{SY}, 57-64 + over-64 bands)")
    print(f"  teacher_sped_pct:    {s_hits} (SY{SY}, SPED program share of teacher FTE)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
