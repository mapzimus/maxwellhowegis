"""
Add the 7th absent regional secondary district — Somerset Berkley Regional
(DESE 07630000) — to ma_academic_districts.geojson. PR #44 added six of the
seven regional HS districts the audit found; Somerset Berkley (member towns
Somerset + Berkley, a 9-12 regional) was missed. Same root cause as #44: the
upstream dominant-town-dissolve gives the regional no town/polygon, so it's a
hole on the map and unsearchable.

This is the spec's FILL 4 "v1": union the member-town polygons for geometry,
then bake CURRENT-YEAR core props. We bake only values we can SOURCE:
  - demographics + enrollment  <- t8td-gens (SY2026), the same columns the
    sibling regionals carry (TOTAL_CNT, EL/LI/SWD/FE/FLNE/HN + race %).
  - grade-10 MCAS % M+E         <- i9w6-niyt (SY2025, test_grade='10').
  - grad_4yr + college-going    <- the spec's live-VERIFIED values
    (grad_4yr 0.937; college any/4yr/2yr 0.717/0.571/0.146).
Grade 3-8 MCAS is left null (a 9-12 district has no grades 3-8). Every other
geojson-only core prop we cannot source-and-verify (per_pupil, dropout, AP,
MassCore, staff, stu_tchr, grad_5yr, military/work) is left NULL — honest v1,
never fabricated. The Tier-A side files (SGP, MCAS detail, finance detail,
postsec incl. persistence, educator, SpEd, EL, discipline, …) backfill on the
fetch-script re-run, and fetch_li_pct_gap.py bakes the low-income timeseries.

Idempotent: re-running when 07630000 already exists is a no-op.

Run from repo root::  python scripts/add_somerset_berkley.py
"""
from __future__ import annotations
import json, re, urllib.request, urllib.parse
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
MUNIS = REPO / "data" / "ma_municipalities.geojson"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

CODE = "07630000"
NAME = "Somerset Berkley"
MEMBER_TOWNS = ["SOMERSET", "BERKLEY"]  # TOWN values in ma_municipalities.geojson
NDIGITS = 5  # match scripts/round_coords.py

# Spec FILL 4 — live-verified Somerset Berkley outcome values (the ONLY numbers
# the spec hard-verifies for this district). Everything else is sourced from DESE.
SPEC_VERIFIED = {
    "grad_4yr": 0.937,
    "pct_any_college": 0.717,
    "pct_4yr_college": 0.571,
    "pct_2yr_college": 0.146,
}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def to_frac(v):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def round_coords(node):
    if isinstance(node, list):
        if node and all(isinstance(x, (int, float)) for x in node):
            return [round(x, NDIGITS) for x in node]
        return [round_coords(x) for x in node]
    return node


def main() -> int:
    gj = json.loads(DISTS.read_text())
    # Rebuild idempotently: drop any existing Somerset Berkley feature first.
    feats = [f for f in gj["features"] if f["properties"].get("DIST_CODE") != CODE]
    gj["features"] = feats

    # 1) Geometry: dissolve the member-town polygons.
    munis = json.loads(MUNIS.read_text())["features"]
    geoms = [shape(f["geometry"]) for f in munis
             if str(f["properties"].get("TOWN", "")).upper() in MEMBER_TOWNS]
    if len(geoms) != len(MEMBER_TOWNS):
        raise SystemExit(f"expected {len(MEMBER_TOWNS)} member towns, found {len(geoms)}")
    geometry = round_coords(mapping(unary_union(geoms)))

    # 2) Demographics + enrollment — t8td-gens, District, SY2026.
    rows = soda("t8td-gens", {"$where": f"org_code='{CODE}' AND sy='2026'", "$limit": "1"})
    if not rows:
        raise SystemExit("no t8td-gens SY2026 row for " + CODE)
    d = rows[0]
    props = {
        "DIST_CODE": CODE,
        "DIST_NAME": NAME,
        "dist_display": NAME,
        "is_lynn": False,
        "TOTAL_CNT": fnum(d.get("total_cnt")),
        "EL_PCT": to_frac(d.get("el_pct")),
        "LI_PCT": to_frac(d.get("li_pct")),
        "AS_PCT": to_frac(d.get("as_pct")),
        "BAA_PCT": to_frac(d.get("baa_pct")),
        "HL_PCT": to_frac(d.get("hl_pct")),
        "HN_PCT": to_frac(d.get("hn_pct")),
        "WH_PCT": to_frac(d.get("wh_pct")),
        "SWD_PCT": to_frac(d.get("swd_pct")),
        "FE_PCT": to_frac(d.get("fe_pct")),
        "FLNE_PCT": to_frac(d.get("flne_pct")),
    }

    # 3) Grade-10 MCAS % M+E — i9w6-niyt, District, All Students, SY2025.
    SUBJ = {"ELA": "mcas_g10_ela_me", "MATH": "mcas_g10_math_me", "SCI": "mcas_g10_sci_me"}
    for subj, col in SUBJ.items():
        props[col] = None
    # org_code is unique to the district; org_type at district grain is
    # 'Public School District' (not 'District'), so we don't filter on it.
    mc = soda("i9w6-niyt", {
        "$where": f"org_code='{CODE}' AND stu_grp='All Students' "
                  "AND test_grade='10' AND sy='2025'",
        "$select": "subject_code,m_plus_e_pct", "$limit": "20",
    })
    for r in mc:
        col = SUBJ.get(str(r.get("subject_code")).upper())
        if col:
            props[col] = round(to_frac(r.get("m_plus_e_pct")), 4) if to_frac(r.get("m_plus_e_pct")) is not None else None
    # Grade 3-8 MCAS: structurally N/A for a 9-12 district.
    props["mcas_g38_ela_me"] = props["mcas_g38_math_me"] = props["mcas_g38_sci_me"] = None

    # 4) Spec-verified outcomes (the only hard-verified numbers for this district).
    props.update(SPEC_VERIFIED)

    # 5) Mirror each current-year value into its latest __YYYY column. The map's
    #    year slider clamps to a metric's max year and paints metric__<maxYear>,
    #    so flat-only props would render BLANK on the choropleth (unlike the six
    #    siblings from #44, which carry __YYYY columns). Our sourced values ARE
    #    the latest published year, so placing them in the max-year column is
    #    accurate, and it makes SB paint like the other regionals.
    maxyear: dict[str, int] = {}
    for f in feats:
        for k in f["properties"]:
            m = re.match(r"(.+)__(\d{4})$", k)
            if m and int(m.group(2)) > maxyear.get(m.group(1), 0):
                maxyear[m.group(1)] = int(m.group(2))
    IDENT = {"DIST_CODE", "DIST_NAME", "dist_display", "is_lynn"}
    mirrored = []
    for k in list(props):
        if k in IDENT or props[k] is None or k not in maxyear:
            continue
        props[f"{k}__{maxyear[k]}"] = props[k]
        mirrored.append(f"{k}__{maxyear[k]}")

    feats.append({"type": "Feature", "properties": props, "geometry": geometry})
    DISTS.write_text(json.dumps(gj, separators=(",", ":")))
    print(f"added {CODE} {NAME}: {len(feats)} districts total")
    print(f"  TOTAL_CNT={props['TOTAL_CNT']} LI_PCT={props['LI_PCT']} SWD_PCT={props['SWD_PCT']}")
    print(f"  mcas_g10 ela/math/sci = {props['mcas_g10_ela_me']}/{props['mcas_g10_math_me']}/{props['mcas_g10_sci_me']}")
    print(f"  grad_4yr={props['grad_4yr']} college any/4yr/2yr={props['pct_any_college']}/{props['pct_4yr_college']}/{props['pct_2yr_college']}")
    print(f"  mirrored {len(mirrored)} flat->__maxYear cols: {sorted(mirrored)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
