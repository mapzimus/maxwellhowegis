"""
Bake composite indices to ``data/ma_district_composites.json`` — equal-weight
z-score blends of metrics the atlas already carries. No new data is fetched; these
summarize existing columns into three at-a-glance indices, each centered on the
state average (0 = average; +/- = standard deviations above/below), so they're
naturally diverging on the map.

Indices (component, sign):
  cost_of_living_index        — housing-cost pressure (higher = costlier)
      acs_median_home_value (+), acs_renter_cost_burden_pct (+),
      acs_severe_rent_burden_pct (+)
  livability_index            — community/quality blend (higher = more livable)
      acs_bachelors_plus_pct (+), acs_broadband_pct (+), acs_median_commute_min (-),
      chronic_absent_pct (-), childcare_capacity_per_100_u5 (+), acs_uninsured_pct (-)
  opportunity_to_learn_index  — HS course-access blend (higher = more opportunity)
      ap_participation_pct (+), ap_subjects_offered (+), calculus_access_pct (+),
      physics_access_pct (+), adv_course_completion_pct (+), early_college_pct (+)

Each component is z-scored across districts that have it; a district's index is the
equal-weight mean of its available signed z-scores, requiring at least half the
components present (else null — not a fabricated 0). Re-tune by editing COMPOSITES.

Reuses scripts/analysis/compute_correlations.build_district_table() so the inputs
are exactly the columns the app paints (geojson + every ma_district_*.json side
file, incl. the new childcare metrics).

Output: ``data/ma_district_composites.json`` :: { DIST_CODE: { index: value, ... } }
Run from repo root::  python scripts/bake_composites.py
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts" / "analysis"))
from compute_correlations import build_district_table, num  # noqa: E402

OUT = REPO / "data" / "ma_district_composites.json"

COMPOSITES = {
    "cost_of_living_index": [
        ("acs_median_home_value", 1), ("acs_renter_cost_burden_pct", 1),
        ("acs_severe_rent_burden_pct", 1),
    ],
    "livability_index": [
        ("acs_bachelors_plus_pct", 1), ("acs_broadband_pct", 1),
        ("acs_median_commute_min", -1), ("chronic_absent_pct", -1),
        ("childcare_capacity_per_100_u5", 1), ("acs_uninsured_pct", -1),
    ],
    "opportunity_to_learn_index": [
        ("ap_participation_pct", 1), ("ap_subjects_offered", 1),
        ("calculus_access_pct", 1), ("physics_access_pct", 1),
        ("adv_course_completion_pct", 1), ("early_college_pct", 1),
    ],
}


def main() -> int:
    df, _ = build_district_table()

    # ── operating universe: drop near-empty admin/union shells so z-scores aren't
    # distorted (same core/threshold as compute_correlations) ────────────────────
    core = [c for c in ("TOTAL_CNT", "grad_4yr", "mcas_g38_ela_me", "mcas_g38_math_me",
                        "attendance_rate", "per_pupil", "EL_PCT", "LI_PCT") if c in df.columns]
    op = df[df[core].apply(pd.to_numeric, errors="coerce").isna().mean(axis=1) <= 0.5]

    # ── per-component mean/std over operating districts ──────────────────────────
    components = sorted({c for comps in COMPOSITES.values() for c, _ in comps})
    stats = {}
    for c in components:
        if c not in op.columns:
            print(f"  WARN: component column '{c}' absent — skipped")
            continue
        s = pd.to_numeric(op[c], errors="coerce").dropna()
        if len(s) > 1 and s.std(ddof=0) > 0:
            stats[c] = (float(s.mean()), float(s.std(ddof=0)))

    # ── composite per district ───────────────────────────────────────────────────
    out: dict[str, dict] = {}
    for code in df.index:
        row = {}
        for name, comps in COMPOSITES.items():
            zs = []
            for c, sign in comps:
                st = stats.get(c)
                if not st:
                    continue
                v = num(df.at[code, c]) if c in df.columns else None
                if v is None:
                    continue
                mean, std = st
                zs.append(sign * (v - mean) / std)
            if len(zs) >= max(2, (len(comps) + 1) // 2):   # >= half the components present
                row[name] = round(sum(zs) / len(zs), 3)
        if row:
            out[str(code)] = row

    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)} with {len(out)} districts.")
    for name in COMPOSITES:
        vals = sorted(r[name] for r in out.values() if name in r)
        if vals:
            print(f"  {name:28s} n={len(vals):3d}  min={vals[0]:+.2f} "
                  f"median={vals[len(vals)//2]:+.2f} max={vals[-1]:+.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
