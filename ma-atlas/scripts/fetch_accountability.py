"""
Add a NEW district-level metric — DESE accountability — to the atlas by
pulling it from MA DESE's open data (Education-to-Career hub, Socrata) and
writing a join file keyed by DIST_CODE:

  pct_targets_met  <- School/District Accountability Classifications
                      [ppbc-i8t9]  cumulative_prgrss_pct

This is DESE's official ESSA accountability for the district: the cumulative
criterion-referenced "% of accountability targets met" (the weighted blend of
prior- and current-year target percentages that drives a district's overall
classification). It is published as a 0–1 fraction at the district level for
271/274 of the atlas's academic districts (latest year SY2025).

NOTE on accountability percentile: ``ppbc-i8t9`` also carries an
``accntblty_pctle`` column (the 1–99 percentile used in the atlas's *school*
popup), but DESE only assigns a percentile to schools — every District row has
``accntblty_pctle`` empty (0 of 396 District rows SY2025 populated). We
therefore do NOT publish a district ``accountability_pctile`` column rather than
fabricate one. Only the cumulative target percentage is published here.

Output: ``data/ma_district_accountability.json`` :: { DIST_CODE: {col: value} }
``pct_targets_met`` is a fraction (0–1) to match the atlas's other *_pct cols.

Run from repo root::  python scripts/fetch_accountability.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_accountability.json"
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
    """Normalize a value to a 0–1 fraction. cumulative_prgrss_pct comes as 0.39
    already; guard against a stray percent (e.g. 39) just in case."""
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

    # District accountability — latest classifications (SY2025), District overall
    # rows (one row per district, no subgroups). cumulative_prgrss_pct is the
    # cumulative criterion-referenced % of accountability targets met (0–1).
    # No cumulative filter, so we also capture the ESSA classification for the
    # "Insufficient data" districts that have no target %.
    acc = soda("ppbc-i8t9", {
        "$where": "org_type='District' AND sy='2025'",
        "$select": "dist_code,cumulative_prgrss_pct,classification_overall,classification_reason",
        "$limit": "5000",
    })
    FLAGGED = "Requiring assistance or intervention"   # DESE's state-flagged tier
    t_hits = c_hits = flagged = 0
    for r in acc:
        dc = norm(r.get("dist_code"))
        if dc not in out:
            continue
        v = to_frac(r.get("cumulative_prgrss_pct"))
        if v is not None:
            out[dc]["pct_targets_met"] = round(v, 4); t_hits += 1
        cls = (r.get("classification_overall") or "").strip()
        if cls:
            out[dc]["accountability_class"] = cls
            rsn = (r.get("classification_reason") or "").strip()
            if rsn:
                out[dc]["accountability_reason"] = rsn
            # Clean boolean for the "State-flagged" map highlight (no client-side
            # string matching).
            out[dc]["is_state_flagged"] = cls == FLAGGED
            c_hits += 1
            flagged += cls == FLAGGED

    # Drop districts that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts")
    print(f"  pct_targets_met:        {t_hits}/{len(ours)} (SY2025, fraction 0-1)")
    print(f"  accountability_class:   {c_hits}/{len(ours)} (ESSA overall classification)")
    print(f"  is_state_flagged=True:  {flagged} (Requiring assistance or intervention)")
    print("  accountability_pctile:  not published for districts (dropped)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
