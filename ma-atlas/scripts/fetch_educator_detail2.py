"""
Add NEW educator-workforce metrics (round 2) to the atlas — educator racial
diversity and principal retention — pulled from MA DESE's open data
(Education-to-Career hub, Socrata) and written to a join file keyed by DIST_CODE.
These are DISTINCT from the workforce columns the atlas already carries (teacher
retention, % experienced, % in-field, % licensed, % core classes licensed,
teacher attendance, avg teacher salary, staff race/ethnicity %, student:teacher
ratio):

  educators_of_color_pct  <- Total Educators, Retention, and New Hires by
                             Race/Ethnicity [fz9c-2g33]
                             job_class_grp='Teacher', race_eth='White'
                             educators_pct -> 1 - white share of TEACHERS.
                             This is the COMBINED non-white TEACHER share, which
                             is distinct from the atlas's staff_white_pct (an
                             all-staff, single-race share from a different
                             staffing dataset).
  principal_retention_pct <- Elementary and Secondary Staff Retention Rates
                             [52c5-e56a]
                             staff_desc='Principals'  retnd_pct (0-1 fraction)
  teacher_retention_pct   <- Elementary and Secondary Staff Retention Rates
                             [52c5-e56a]
                             staff_desc='Teachers'  retnd_pct (0-1 fraction).
                             OVERRIDES the same-named column baked into
                             ma_academic_districts.geojson, which is rounded to
                             the nearest 10% (Boston 0.872 -> 0.9, Lynn 0.834 ->
                             0.8; only ~10 distinct values statewide). The DESE
                             source publishes full precision; the side-file value
                             wins on merge. See scripts/analysis/audit_quality.md.

Latest published year per source: educator diversity SY2023 (latest year
fz9c-2g33 publishes the educator race breakdown), principal + teacher retention
SY2026.

NOT INCLUDED — deliberately dropped to avoid duplicating existing columns:
  * teacher_early_career_pct: DESE's experience dataset [b99t-n6jh] only
    publishes "Experienced Teachers" (already in the atlas as
    teacher_experienced_pct); early-career is just its complement
    (1 - experienced) and is derivable in-app, so no new column is shipped.

Output: ``data/ma_district_educator2.json`` :: { DIST_CODE: {col: value, ...} }
Values are fractions (0-1) to match the atlas's other *_pct / rate columns.

Run from repo root::  python scripts/fetch_educator_detail2.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_educator2.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes drop leading zeros (e.g. 10000); atlas uses zero-padded 8-char."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize a value to a 0-1 fraction. The retention/educator-share columns
    come as 0.881 already, but guard against any percent-style values (88.1)."""
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
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) Educators of color — share of TEACHERS who are not White. Latest year
    #    the educator race breakdown is published (SY2023). The dataset reports a
    #    White educators_pct per district; we keep its complement as the combined
    #    non-white teacher share. Distinct from staff_white_pct (all-staff).
    eoc = soda("fz9c-2g33", {
        "$where": "sy='2023' AND race_eth='White' AND job_class_grp='Teacher'",
        "$select": "dist_code,educators_pct", "$limit": "3000",
    })
    e_hits = 0
    for r in eoc:
        dc = norm(r.get("dist_code"))
        if dc in out and (w := to_frac(r.get("educators_pct"))) is not None:
            out[dc]["educators_of_color_pct"] = round(1.0 - w, 4); e_hits += 1

    # 2) Principal retention rate — latest (SY2026), Principals, District-level.
    #    retnd_pct is already a 0-1 fraction.
    prin = soda("52c5-e56a", {
        "$where": "org_type='District' AND staff_desc='Principals' AND sy='2026'",
        "$select": "dist_code,retnd_pct", "$limit": "3000",
    })
    p_hits = 0
    for r in prin:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("retnd_pct"))) is not None:
            out[dc]["principal_retention_pct"] = round(v, 4); p_hits += 1

    # 3) Teacher retention rate — latest (SY2026), Teachers, District-level.
    #    Full precision from DESE; overrides the nearest-10%-rounded value baked
    #    into the geojson (the side file wins on merge).
    tchr = soda("52c5-e56a", {
        "$where": "org_type='District' AND staff_desc='Teachers' AND sy='2026'",
        "$select": "dist_code,retnd_pct", "$limit": "3000",
    })
    t_hits = 0
    for r in tchr:
        dc = norm(r.get("dist_code"))
        if dc in out and (v := to_frac(r.get("retnd_pct"))) is not None:
            out[dc]["teacher_retention_pct"] = round(v, 4); t_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  educators_of_color_pct:  {e_hits} (SY2023, 1 - white teacher share)")
    print(f"  principal_retention_pct: {p_hits} (SY2026, fraction)")
    print(f"  teacher_retention_pct:   {t_hits} (SY2026, fraction; overrides geojson)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
