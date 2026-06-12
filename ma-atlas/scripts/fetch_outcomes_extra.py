"""
Pull additional district-level student-outcome metrics from MA DESE's open data
(Education-to-Career hub, Socrata) into a join file keyed by DIST_CODE:

  sat_ebrw_mean        <- SAT Performance      [wihy-jkek]  read_write_score
  sat_math_mean        <- SAT Performance      [wihy-jkek]  math_score
  sat_total_mean       <- SAT Performance      [wihy-jkek]  read_write_score + math_score
  avg_class_size       <- Class Size (subj=All) [35yv-uxv5]  avg_clss_cnt
  stability_rate       <- Student Mobility Rate [5jqj-jcbt]  stab_pct
  churn_pct            <- Student Mobility Rate [5jqj-jcbt]  churn_pct

All are reported at the district level for ~2xx/274 of the atlas's academic
districts, latest published year (SY2025 for all three datasets), All Students.

IMPORTANT on units:
  * SAT scores (200-800 each section) and average class size are RAW NUMBERS,
    NOT percentages -- they are NOT divided by 100.
  * stability_rate and churn_pct are published as 0-1 fractions already and are
    kept as fractions to match the atlas's other *_pct / rate columns.
  DESE does NOT publish an SAT participation rate at district level (only a
  taken count), so sat_participation_pct is omitted.

Output: ``data/ma_district_outcomes_extra.json`` :: { DIST_CODE: {col: value, ...} }

Run from repo root::  python scripts/fetch_outcomes_extra.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_outcomes_extra.json"
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
    """Normalize a true percentage to a 0-1 fraction. Mobility pcts come as 0.968
    already; divide only if the source ever reports a 0-100 percent. Use ONLY for
    real percentages -- never for SAT scores or class size."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_num(v):
    """Pass a raw numeric value through (SAT scores, class size). NOT a percent --
    do not divide by 100."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}
    out: dict[str, dict] = {dc: {} for dc in ours}

    # 1) SAT mean scores -- latest (SY2025), District, All Students.
    #    read_write_score (EBRW) and math_score are 200-800 scores, NOT percents.
    sat = soda("wihy-jkek", {
        "$where": "org_type='District' AND stu_grp='All Students' AND sy='2025'",
        "$select": "dist_code,read_write_score,math_score",
        "$limit": "2000",
    })
    ebrw_hits = math_hits = total_hits = 0
    for r in sat:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        ebrw = to_num(r.get("read_write_score"))
        math = to_num(r.get("math_score"))
        if ebrw is not None:
            out[dc]["sat_ebrw_mean"] = int(round(ebrw)); ebrw_hits += 1
        if math is not None:
            out[dc]["sat_math_mean"] = int(round(math)); math_hits += 1
        if ebrw is not None and math is not None:
            out[dc]["sat_total_mean"] = int(round(ebrw + math)); total_hits += 1

    # 2) Average class size -- latest (SY2025), District, all subjects combined.
    #    avg_clss_cnt is a count of students per class, NOT a percent.
    cls = soda("35yv-uxv5", {
        "$where": "org_type='District' AND subj='All' AND sy='2025'",
        "$select": "dist_code,avg_clss_cnt",
        "$limit": "2000",
    })
    cls_hits = 0
    for r in cls:
        dc = norm(r.get("dist_code"))
        # avg_clss_cnt of 0 is meaningless (a class can't average 0 students); DESE
        # reports it for zero-enrollment districts (Gosnold) — store null, not 0,
        # so it doesn't poison the choropleth/ranks. See audit_quality.md.
        if dc in out and (v := to_num(r.get("avg_clss_cnt"))) is not None and v > 0:
            out[dc]["avg_class_size"] = round(v, 1); cls_hits += 1

    # 3) Student mobility -- latest (SY2025), District, All Students.
    #    stab_pct (stability) and churn_pct come as 0-1 fractions already.
    mob = soda("5jqj-jcbt", {
        "$where": "org_type='District' AND stu_grp='All Students' AND sy='2025'",
        "$select": "dist_code,stab_pct,churn_pct",
        "$limit": "2000",
    })
    stab_hits = churn_hits = 0
    for r in mob:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        stab = to_frac(r.get("stab_pct"))
        churn = to_frac(r.get("churn_pct"))
        if stab is not None:
            out[dc]["stability_rate"] = round(stab, 4); stab_hits += 1
        if churn is not None:
            out[dc]["churn_pct"] = round(churn, 4); churn_hits += 1

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts (of {len(ours)})")
    print(f"  sat_ebrw_mean:   {ebrw_hits} (SY2025)")
    print(f"  sat_math_mean:   {math_hits} (SY2025)")
    print(f"  sat_total_mean:  {total_hits} (SY2025)")
    print(f"  avg_class_size:  {cls_hits} (SY2025)")
    print(f"  stability_rate:  {stab_hits} (SY2025)")
    print(f"  churn_pct:       {churn_hits} (SY2025)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
