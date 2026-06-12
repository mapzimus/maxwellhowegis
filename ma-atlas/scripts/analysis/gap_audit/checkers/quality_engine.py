"""The per-column quality engine — relocated verbatim from ``audit_quality.py`` so
the package owns it and the original script can be retired without breaking anything.

Public surface used by the checkers:
  col_stats(series)            -> per-column distribution snapshot (or None if empty)
  flags_for(mid,meta,pal,lvl,st) -> list of (code, severity, detail)
  is_diverging(mid,meta,pal)   -> bool
  zero_is_implausible(mid)     -> bool
  tiny_district_zero_check(df,catalog) / TINY_DISTRICTS
  year_family_check(df,catalog)

Flag codes: DISTINCT_LE2, LOW_VARIANCE, LOW_PRECISION, PCT_RANGE, PCT_NEG,
USD_NONPOS, USD_ABSURD, NUM_SGP_RANGE, ZERO_CLUSTER, FLOOR_TRUNC, CEIL_TRUNC,
TINY_DIST_ZERO, YEAR_LATEST_GAP.
"""

import math
import re
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

DIVERGING_PALETTES = {
    "RdBu", "PuOr", "BrBG", "RdYlBu", "RdYlGn", "Spectral", "PiYG", "PRGn",
    "RdGy", "coolwarm",
}


def num(v):
    try:
        if v is None:
            return None
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def is_diverging(mid, meta, palette):
    if palette in DIVERGING_PALETTES:
        return True
    if meta["cat"] in ("Equity gaps", "Trends", "Economic mobility"):
        return True
    if re.search(r"(?:^|_)(gap|change|net)(?:_|$)", mid):
        return True
    return False


def col_stats(series):
    s = pd.to_numeric(series, errors="coerce").dropna()
    n = int(s.size)
    if n == 0:
        return None
    vals = s.to_numpy(dtype=float)
    vc = Counter(np.round(vals, 6))
    top_val, top_n = vc.most_common(1)[0]
    mn, mx = float(vals.min()), float(vals.max())
    span = mx - mn
    band = max(span * 0.01, 1e-9)
    near_min = float(np.mean(np.abs(vals - mn) <= band))
    near_max = float(np.mean(np.abs(vals - mx) <= band))
    exact_zero = int(np.sum(vals == 0.0))
    return {
        "n": n,
        "distinct": len(vc),
        "min": mn, "max": mx,
        "mean": float(vals.mean()), "std": float(vals.std()),
        "p01": float(np.percentile(vals, 1)),
        "p50": float(np.percentile(vals, 50)),
        "p99": float(np.percentile(vals, 99)),
        "top_val": float(top_val), "top_share": top_n / n,
        "near_min_share": near_min, "near_max_share": near_max,
        "exact_zero": exact_zero, "zero_share": exact_zero / n,
    }


# Metrics where an exact 0 is implausible (0 => almost certainly suppressed-null).
ZERO_IMPLAUSIBLE_SUBSTR = (
    "per_pupil", "salary", "class_size", "ratio", "students_per",
    "_mean", "sat_", "attendance_rate", "_income", "home_value", "_sgp",
    "enrollment", "TOTAL_CNT", "median", "earnings", "tuition",
)
ZERO_OK_SUBSTR = (  # genuinely-can-be-zero rare-event / count rates
    "restraint", "expulsion", "expelled", "excluded", "law_referral",
    "arrest", "bully", "ged", "_net_", "change", "gap", "homeless",
    "gifted", "ap_", "cte", "choice", "homeschool", "private",
)


def zero_is_implausible(mid):
    low = mid.lower()
    if any(s in low for s in ZERO_OK_SUBSTR):
        return False
    if any(s.lower() in low for s in ZERO_IMPLAUSIBLE_SUBSTR):
        return True
    return False


def flags_for(mid, meta, palette, level, st):
    """Return list of (code, severity, detail) for one (metric, level)."""
    out = []
    fmt = meta["format"]
    div = is_diverging(mid, meta, palette)
    n = st["n"]

    # 1) distinct <= 2 / near-constant
    if st["distinct"] <= 2:
        out.append(("DISTINCT_LE2", "high",
                    f"only {st['distinct']} distinct value(s); "
                    f"top={st['top_val']:.4g} ({st['top_share']*100:.0f}%)"))
    elif st["top_share"] >= 0.95 and n >= 30:
        out.append(("LOW_VARIANCE", "med",
                    f"{st['top_share']*100:.0f}% share at {st['top_val']:.4g} "
                    f"(distinct={st['distinct']})"))

    # 1b) suspiciously coarse for a continuous rate
    if (fmt == "pct" and not div and n >= 50 and 2 < st["distinct"] <= 15
            and st["top_val"] != 0):
        out.append(("LOW_PRECISION", "med",
                    f"only {st['distinct']} distinct values over n={n} for a "
                    f"continuous pct → coarse binning / rounding suspected"))

    # 2) format-range checks
    if fmt == "pct":
        hi = 1.0001
        lo = -1.0001 if div else -1e-6
        if st["max"] > hi or st["min"] < lo:
            out.append(("PCT_RANGE", "high",
                        f"pct range [{st['min']:.4g}, {st['max']:.4g}] outside "
                        f"{'[-1,1]' if div else '[0,1]'} (diverging={div})"))
        if (not div) and st["min"] < -1e-6:
            out.append(("PCT_NEG", "high",
                        f"non-diverging pct goes negative (min={st['min']:.4g})"))
    elif fmt == "usd":
        if st["min"] <= 0 and not div:
            out.append(("USD_NONPOS", "high",
                        f"usd min={st['min']:.4g} (<= 0)"))
        per_unit = any(s in mid.lower() for s in
                       ("per_pupil", "salary", "income", "home_value",
                        "tuition", "per_capita", "earnings", "net_price"))
        if per_unit and st["max"] > 1e6:
            out.append(("USD_ABSURD", "med",
                        f"per-unit usd max={st['max']:.4g} (>$1M) → possible mis-scale"))
    elif fmt == "num":
        if "sgp" in mid.lower():
            if st["min"] < 1 or st["max"] > 99:
                out.append(("NUM_SGP_RANGE", "high",
                            f"SGP range [{st['min']:.4g},{st['max']:.4g}] "
                            f"outside [1,99]"))

    # 3) 0-for-null cluster
    if zero_is_implausible(mid) and st["zero_share"] > 0.02 and st["exact_zero"] >= 2:
        out.append(("ZERO_CLUSTER", "high",
                    f"{st['exact_zero']} exact-0 ({st['zero_share']*100:.0f}%) "
                    f"where 0 is implausible → likely 0-for-null"))

    # 4) floor / ceiling truncation
    if fmt == "pct" and not div and n >= 40:
        if st["min"] >= 0.30 and st["near_min_share"] >= 0.05 and st["min"] > st["p01"] - 1e-9:
            out.append(("FLOOR_TRUNC", "high",
                        f"pct floor at {st['min']:.3g} (no values below; "
                        f"{st['near_min_share']*100:.0f}% within 1% of floor) "
                        f"→ possible DESE suppression bias"))
        if st["max"] >= 0.999 and st["near_max_share"] >= 0.20:
            out.append(("CEIL_TRUNC", "med",
                        f"{st['near_max_share']*100:.0f}% pile at max≈1.0 "
                        f"→ check ceiling suppression / saturation"))

    return out


# ── targeted district checks ─────────────────────────────────────────────────
TINY_DISTRICTS = {  # codes known to be tiny / intermittently operating
    "01090000": "Gosnold",
    "06250000": "Devens (DESC)",
    "06450000": "Hancock",
    "06820000": "Rowe",
    "06010000": "Florida",
}


def tiny_district_zero_check(df, catalog):
    """For tiny districts, list ratio/rate columns stored as exact 0 (not null)."""
    rows = []
    cat_ids = set(catalog)
    for code, name in TINY_DISTRICTS.items():
        if code not in df.index:
            continue
        r = df.loc[code]
        for col in df.columns:
            if col not in cat_ids:
                continue
            if not zero_is_implausible(col):
                continue
            v = num(r.get(col))
            if v == 0.0:
                rows.append((code, name, col, catalog[col]["label"]))
    return rows


def year_family_check(df, catalog):
    """Per year-keyed base, flag a latest year far sparser than the family's peak."""
    yk = defaultdict(dict)
    for c in df.columns:
        m = re.match(r"^(.+)__(\d{4})$", str(c))
        if m:
            base, yr = m.group(1), int(m.group(2))
            yk[base][yr] = int(pd.to_numeric(df[c], errors="coerce").notna().sum())
    flags = []
    for base, years in sorted(yk.items()):
        if not years:
            continue
        peak = max(years.values())
        latest = max(years)
        latest_n = years[latest]
        if peak >= 30 and latest_n < 0.5 * peak:
            flags.append((base, latest, latest_n, peak, years))
    return yk, flags
