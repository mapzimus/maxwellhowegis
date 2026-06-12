#!/usr/bin/env python3
"""
Compute pairwise correlations across Massachusetts district-level metrics for the
MA Education Atlas bivariate-mode preset menu.

What it does
------------
1. Rebuilds the *exact* joined district table the app paints from:
   data/ma_academic_districts.geojson (274 dissolved district polygons) +
   every data/ma_district_*.json side file merged by the 8-digit district code
   (DIST_CODE in the geojson == ORG8CODE key in the side files), plus the
   handful of in-app "derived" columns (diversity index, enrollment trend,
   equity gaps) that app.js computes at load time. This guarantees the metric
   ids we recommend are real, populated columns the UI can actually paint.
2. Parses METRICS[...] out of app.js to learn which ids are valid DISTRICT-level
   bivariate candidates (m.levels includes "district"). Only those are eligible.
3. Restricts to real operating districts via a per-row null-rate threshold over a
   core set of "operating" columns (drops admin/union shells with little data).
4. Computes pairwise Pearson AND Spearman across all valid numeric candidate
   columns with n >= MIN_N non-null overlap, excluding tautological / trivial
   pairs (self, near-duplicate, count-vs-its-own-pct, strict subgroup, etc).

Outputs (written next to this script):
  - correlations.md          : methodology + ranked table + curated presets
  - correlation_presets.json : {"expected":[...], "surprising":[...]}
The curated preset lists themselves are hand-authored below (CURATED_*) and are
validated against the computed stats + the METRICS catalog before being written.

scipy is used if present; otherwise a numpy-only Pearson + rank Spearman is used.
"""

import json
import os
import re
import sys
import math
from itertools import combinations

import numpy as np
import pandas as pd

try:
    from scipy.stats import pearsonr, spearmanr  # noqa
    HAVE_SCIPY = True
except Exception:  # pragma: no cover - fallback path
    HAVE_SCIPY = False

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA = os.path.join(ROOT, "data")
APP_JS = os.path.join(ROOT, "app.js")
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

MIN_N = 50          # required non-null overlap for a reported pair
NULL_RATE_DROP = 0.50  # drop a district row if >50% of core operating cols are null
                       # (near-empty admin/union shells; K-only districts that
                       # legitimately lack HS metrics are kept — pairwise n handles
                       # their missing columns).


# ───────────────────────── METRICS catalog (parsed from app.js) ──────────────
def parse_metrics_catalog(path=APP_JS):
    """Extract {id,label,cat,levels,format} for every METRICS entry in app.js."""
    src = open(path, encoding="utf-8").read()
    start = src.index("const METRICS = [")
    # find matching closing of the array (first "\n];" after start)
    end = src.index("\n];", start)
    block = src[start:end]
    metrics = {}
    # each entry is a { ... } object literal on (usually) one line
    for m in re.finditer(r"\{[^{}]*\bid\s*:\s*[\"']([^\"']+)[\"'][^{}]*\}", block):
        obj = m.group(0)
        mid = m.group(1)
        label = _field(obj, "label")
        cat = _field(obj, "cat")
        fmt = _field(obj, "format")
        requires = _field(obj, "requires")
        lv = re.search(r"levels\s*:\s*\[([^\]]*)\]", obj)
        levels = re.findall(r"[\"']([^\"']+)[\"']", lv.group(1)) if lv else []
        metrics[mid] = {
            "id": mid, "label": label, "cat": cat,
            "format": fmt, "levels": levels, "requires": requires,
        }
    return metrics


def _field(obj, name):
    m = re.search(rf"{name}\s*:\s*[\"']([^\"']*)[\"']", obj)
    return m.group(1) if m else None


# ───────────────────────── Build the joined district table ───────────────────
def num(v):
    try:
        if v is None:
            return None
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def compute_derived(props_by_code):
    """Replicate app.js computeDerivedMetrics() for the columns it adds."""
    def r3(v):
        return round(v * 1000) / 1000

    for p in props_by_code.values():
        shares = [num(p.get(k)) for k in ("WH_PCT", "BAA_PCT", "HL_PCT", "AS_PCT")]
        shares = [s for s in shares if s is not None]
        if shares:
            known = sum(shares)
            parts = list(shares)
            other = 1 - known
            if other > 0.001:
                parts.append(other)
            p["diversity_index"] = max(0.0, r3(1 - sum(s * s for s in parts)))

        series = []
        for y in range(1994, 2027):
            v = num(p.get(f"TOTAL_CNT__{y}"))
            if v is not None and v > 0:
                series.append((y, v))
        if series:
            ly, lv = series[-1]
            def at(back):
                for (y, val) in series:
                    if y == ly - back:
                        return val
                return None
            c5, c10 = at(5), at(10)
            if c5:
                p["enroll_change_5yr"] = r3((lv - c5) / c5)
            if c10:
                p["enroll_change_10yr"] = r3((lv - c10) / c10)

        def gap_achieve(all_c, sub_c, out):
            a, s = num(p.get(all_c)), num(p.get(sub_c))
            if a is not None and s is not None:
                p[out] = r3(a - s)

        gap_achieve("grad_4yr", "grad_4yr__li", "grad_gap_low_income")
        gap_achieve("grad_4yr", "grad_4yr__swd", "grad_gap_swd")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_low_income", "mcas_ela_gap_low_income")
        gap_achieve("mcas_g38_math_me", "mcas_math_low_income", "mcas_math_gap_low_income")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_swd", "mcas_ela_gap_swd")
        gap_achieve("mcas_g38_math_me", "mcas_math_swd", "mcas_math_gap_swd")
        gap_achieve("grad_4yr", "grad_4yr__ell", "grad_gap_ell")
        gap_achieve("grad_4yr", "grad_4yr__hl", "grad_gap_hispanic")
        gap_achieve("grad_4yr", "grad_4yr__baa", "grad_gap_black")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_ell", "mcas_ela_gap_ell")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_hispanic", "mcas_ela_gap_hispanic")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_black", "mcas_ela_gap_black")
        gap_achieve("mcas_g38_math_me", "mcas_math_ell", "mcas_math_gap_ell")
        gap_achieve("mcas_g38_math_me", "mcas_math_hispanic", "mcas_math_gap_hispanic")
        gap_achieve("mcas_g38_math_me", "mcas_math_black", "mcas_math_gap_black")
        # Later computed gaps (mirror app.js computeDerivedMetrics gapAchieve calls):
        gap_achieve("grad_avg_earnings", "grad_avg_earnings_lowincome", "earnings_gap_low_income")
        gap_achieve("college_enroll_pct", "college_enroll_low_income", "college_gap_low_income")
        gap_achieve("college_enroll_pct", "college_enroll_black", "college_gap_black")
        gap_achieve("college_enroll_pct", "college_enroll_hispanic", "college_gap_hispanic")
        gap_achieve("college_enroll_pct", "college_enroll_swd", "college_gap_swd")
        gap_achieve("college_enroll_pct", "college_enroll_ell", "college_gap_ell")
        gap_achieve("mcas_g38_ela_me", "mcas_ela_high_needs", "mcas_ela_gap_high_needs")
        gap_achieve("mcas_g38_math_me", "mcas_math_high_needs", "mcas_math_gap_high_needs")
        gap_achieve("mcas_ela_female", "mcas_ela_male", "mcas_ela_gender_gap")
        gap_achieve("mcas_math_female", "mcas_math_male", "mcas_math_gender_gap")

        def gap_burden(sub_c, all_c, out):
            a, s = num(p.get(all_c)), num(p.get(sub_c))
            if a is not None and s is not None:
                p[out] = r3(s - a)

        gap_burden("oss_low_income", "disc_oss_pct", "oss_gap_low_income")
        gap_burden("oss_swd", "disc_oss_pct", "oss_gap_swd")
        gap_burden("oss_black", "disc_oss_pct", "oss_gap_black")
        gap_burden("oss_hispanic", "disc_oss_pct", "oss_gap_hispanic")
        gap_burden("chronic_low_income", "chronic_absent_pct", "chronic_gap_low_income")
        gap_burden("chronic_swd", "chronic_absent_pct", "chronic_gap_swd")
        gap_burden("chronic_ell", "chronic_absent_pct", "chronic_gap_ell")

        stud_color = (1 - num(p["WH_PCT"])) if num(p.get("WH_PCT")) is not None else None
        edu_color = num(p.get("educators_of_color_pct"))
        if stud_color is not None and edu_color is not None:
            p["teacher_rep_gap"] = r3(stud_color - edu_color)


def build_district_table():
    geo = json.load(open(os.path.join(DATA, "ma_academic_districts.geojson")))
    props_by_code = {}
    for f in geo["features"]:
        code = str(f["properties"].get("DIST_CODE", "")).strip()
        if not code:
            continue
        props_by_code[code] = dict(f["properties"])

    # Merge every district side file by the 8-digit code.
    side_files = sorted(
        fn for fn in os.listdir(DATA)
        if fn.startswith("ma_district_") and fn.endswith(".json")
    )
    for fn in side_files:
        d = json.load(open(os.path.join(DATA, fn)))
        for code, row in d.items():
            code = str(code).strip()
            if code in props_by_code and isinstance(row, dict):
                props_by_code[code].update(row)

    compute_derived(props_by_code)
    df = pd.DataFrame.from_dict(props_by_code, orient="index")
    df.index.name = "DIST_CODE"
    return df, side_files


# ───────────────────────── Correlation helpers ──────────────────────────────
def corr_pair(a, b):
    """Return (pearson, spearman, n) for aligned non-null overlap, or None."""
    m = a.notna() & b.notna()
    n = int(m.sum())
    if n < MIN_N:
        return None
    x = a[m].to_numpy(dtype=float)
    y = b[m].to_numpy(dtype=float)
    if np.std(x) == 0 or np.std(y) == 0:
        return None
    if HAVE_SCIPY:
        pr = float(pearsonr(x, y)[0])
        sr = float(spearmanr(x, y)[0])
    else:
        pr = float(np.corrcoef(x, y)[0, 1])
        rx = pd.Series(x).rank().to_numpy()
        ry = pd.Series(y).rank().to_numpy()
        sr = float(np.corrcoef(rx, ry)[0, 1])
    return pr, sr, n


# Tautology / near-duplicate filter. Returns True if the pair should be dropped.
def is_trivial(a, cat_a, b, cat_b, pr):
    if a == b:
        return True
    sa, sb = set(a.split("_")), set(b.split("_"))

    # explicit definitional duplicate families
    dup_families = [
        {"LI_PCT", "HN_PCT"},                       # low income ⊂ high needs
        {"acs_poverty_pct", "acs_child_poverty_pct"},
        {"acs_poverty_pct", "LI_PCT"},
        {"acs_child_poverty_pct", "LI_PCT"},
        {"acs_median_household_income", "acs_median_earnings"},
        {"acs_median_household_income", "acs_per_capita_income"},
        {"acs_per_capita_income", "acs_median_earnings"},
        {"acs_bachelors_plus_pct", "acs_grad_degree_pct"},
        {"sat_total_mean", "sat_math_mean"},
        {"sat_total_mean", "sat_ebrw_mean"},
        {"sat_ebrw_mean", "sat_math_mean"},
        {"grad_4yr", "grad_5yr"},
        {"grad_4yr", "dropout_pct"},
        {"per_pupil", "in_district_pp_exp"},
        {"foundation_budget", "required_nss"},
        {"foundation_budget", "actual_nss"},
        {"required_nss", "actual_nss"},
        {"avg_class_size", "stu_tchr_ratio"},
        {"WH_PCT", "staff_white_pct"},
        {"EL_PCT", "FLNE_PCT"},
        {"EL_PCT", "FE_PCT"},
        {"attendance_rate", "chronic_absent_pct"},
        {"college_enroll_pct", "college_enroll_4yr_pct"},
        {"pct_any_college", "pct_4yr_college"},
        {"pct_any_college", "college_enroll_pct"},
    ]
    for fam in dup_families:
        if a in fam and b in fam:
            return True

    # same-prefix family collapses (two MCAS subjects of a grade, two SAT, etc.)
    same_family_prefixes = [
        "mcas_", "sat_", "class_size", "per_pupil", "chronic_", "oss_",
        "college_enroll", "sped_", "el_", "acs_median", "staff_",
    ]
    for pre in same_family_prefixes:
        if a.startswith(pre) and b.startswith(pre):
            # near-duplicate measures within the same metric family at high |r|
            if abs(pr) >= 0.80:
                return True

    # a subgroup slice vs the all-students base (strict subset): e.g.
    # mcas_ela_low_income vs mcas_g38_ela_me, oss_black vs disc_oss_pct, etc.
    base_subgroup = [
        ("mcas_g38_ela_me", ("mcas_ela_low_income", "mcas_ela_swd", "mcas_ela_ell",
                             "mcas_ela_black", "mcas_ela_hispanic")),
        ("mcas_g38_math_me", ("mcas_math_low_income", "mcas_math_swd", "mcas_math_ell",
                              "mcas_math_black", "mcas_math_hispanic")),
        ("disc_oss_pct", ("oss_low_income", "oss_swd", "oss_ell", "oss_black", "oss_hispanic")),
        ("chronic_absent_pct", ("chronic_low_income", "chronic_swd", "chronic_ell",
                                "chronic_black", "chronic_hispanic")),
    ]
    for base, subs in base_subgroup:
        if (a == base and b in subs) or (b == base and a in subs):
            return True

    # a gap metric vs one of the two columns it is computed from
    gap_inputs = {
        "grad_gap_low_income": ("grad_4yr",),
        "mcas_ela_gap_low_income": ("mcas_g38_ela_me", "mcas_ela_low_income"),
        "mcas_math_gap_low_income": ("mcas_g38_math_me", "mcas_math_low_income"),
        "teacher_rep_gap": ("educators_of_color_pct", "WH_PCT"),
    }
    for gap, inputs in gap_inputs.items():
        if (a == gap and b in inputs) or (b == gap and a in inputs):
            return True

    # generic: same category + very high |r| → almost certainly a restatement
    if cat_a == cat_b and abs(pr) >= 0.92:
        return True

    return False


def main():
    catalog = parse_metrics_catalog()
    df, side_files = build_district_table()
    total_rows = len(df)

    # Valid district-level bivariate candidates = METRICS entries whose levels
    # include "district". (ACS metrics require state.hasAcs, which is true since
    # both muni + district ACS files load, so they remain valid candidates.)
    candidate_ids = [mid for mid, m in catalog.items() if "district" in m["levels"]]

    # Restrict to columns that actually exist & are numeric in the joined table.
    present = []
    for cid in candidate_ids:
        if cid not in df.columns:
            continue
        col = pd.to_numeric(df[cid], errors="coerce")
        if col.notna().sum() >= MIN_N:
            df[cid] = col
            present.append(cid)
    missing = [c for c in candidate_ids if c not in present]

    # ── Restrict to real operating districts via null-rate over core cols ─────
    core_cols = [c for c in (
        "TOTAL_CNT", "grad_4yr", "mcas_g38_ela_me", "mcas_g38_math_me",
        "attendance_rate", "per_pupil", "EL_PCT", "LI_PCT",
    ) if c in df.columns]
    core = df[core_cols].apply(pd.to_numeric, errors="coerce")
    null_rate = core.isna().mean(axis=1)
    keep = null_rate <= NULL_RATE_DROP
    df = df[keep].copy()
    eff_n = len(df)

    # ── Pairwise correlations ─────────────────────────────────────────────────
    rows = []
    for a, b in combinations(present, 2):
        res = corr_pair(df[a], df[b])
        if res is None:
            continue
        pr, sr, n = res
        ca, cb = catalog[a]["cat"], catalog[b]["cat"]
        trivial = is_trivial(a, ca, b, cb, pr)
        rows.append({
            "metricA": a, "metricB": b,
            "labelA": catalog[a]["label"], "labelB": catalog[b]["label"],
            "catA": ca, "catB": cb,
            "pearson": round(pr, 3), "spearman": round(sr, 3), "n": n,
            "abs_r": abs(pr), "trivial": trivial,
            "cross_cat": ca != cb,
        })
    res_df = pd.DataFrame(rows).sort_values("abs_r", ascending=False)
    nontrivial = res_df[~res_df["trivial"]].copy()

    res_df.to_csv(os.path.join(OUT_DIR, "all_correlations.csv"), index=False)

    # ── Validate the hand-curated presets against computed stats + catalog ────
    stat_index = {(r["metricA"], r["metricB"]): r for _, r in res_df.iterrows()}
    stat_index.update({(r["metricB"], r["metricA"]): r for _, r in res_df.iterrows()})

    def lookup(a, b):
        return stat_index.get((a, b))

    validated = {"expected": [], "surprising": []}
    problems = []
    for group in ("expected", "surprising"):
        for p in CURATED[group]:
            a, b = p["metricA"], p["metricB"]
            for mid in (a, b):
                if mid not in catalog or "district" not in catalog[mid]["levels"]:
                    problems.append(f"{group}: {mid} not a valid district candidate")
                if mid not in present:
                    problems.append(f"{group}: {mid} has no data in joined table")
            st = lookup(a, b)
            obj = {
                "metricA": a, "metricB": b,
                "labelA": catalog.get(a, {}).get("label", p.get("labelA")),
                "labelB": catalog.get(b, {}).get("label", p.get("labelB")),
                "title": p["title"], "blurb": p["blurb"],
            }
            if st is not None:
                obj["pearson"] = float(st["pearson"])
                obj["spearman"] = float(st["spearman"])
                obj["n"] = int(st["n"])
            else:
                problems.append(f"{group}: pair {a}×{b} had < {MIN_N} overlap or no stat")
                obj["pearson"] = obj["spearman"] = None
                obj["n"] = None
            validated[group].append(obj)

    with open(os.path.join(OUT_DIR, "correlation_presets.json"), "w") as fh:
        json.dump(validated, fh, indent=2)

    write_report(catalog, side_files, total_rows, eff_n, present, missing,
                 res_df, nontrivial, validated, problems)

    print(f"Side files merged: {len(side_files)}")
    print(f"Total district rows: {total_rows}  ->  effective operating N: {eff_n}")
    print(f"Valid district bivariate candidate columns with data: {len(present)}")
    if missing:
        print(f"Candidate ids with NO data (excluded): {missing}")
    print(f"Pairs computed (n>={MIN_N}): {len(res_df)}  non-trivial: {len(nontrivial)}")
    if problems:
        print("VALIDATION PROBLEMS:")
        for pb in problems:
            print("  -", pb)
    else:
        print("All curated preset ids validated OK.")
    print(f"Wrote: {os.path.join(OUT_DIR, 'correlations.md')}")
    print(f"Wrote: {os.path.join(OUT_DIR, 'correlation_presets.json')}")
    print(f"Wrote: {os.path.join(OUT_DIR, 'all_correlations.csv')}")


def write_report(catalog, side_files, total_rows, eff_n, present, missing,
                 res_df, nontrivial, validated, problems):
    L = []
    L.append("# MA Education Atlas — District Correlation Analysis\n")
    L.append("## Methodology\n")
    L.append(
        "The joined district table is rebuilt exactly as `app.js` paints it: "
        "`data/ma_academic_districts.geojson` (274 dissolved operating-district "
        "polygons) merged with every `data/ma_district_*.json` side file by the "
        "8-digit district code (`DIST_CODE` == `ORG8CODE`), plus the in-app "
        "derived columns (diversity index, 5/10-yr enrollment change, equity "
        "gaps) reproduced from `computeDerivedMetrics()`.\n")
    L.append(
        f"- Side files merged: **{len(side_files)}**.\n"
        f"- Raw district rows: **{total_rows}**. After dropping admin/union shells "
        f"with >{int(NULL_RATE_DROP*100)}% of core operating columns null, the "
        f"**effective N = {eff_n}** operating districts.\n"
        f"- Eligible metrics = METRICS entries whose `levels` include `district` "
        f"that exist as real numeric columns with ≥{MIN_N} values: "
        f"**{len(present)}** columns.\n"
        f"- Pairwise **Pearson** and **Spearman** computed for every pair with "
        f"≥{MIN_N} non-null overlap; n recorded per pair.\n"
        f"- scipy available: **{HAVE_SCIPY}**.\n")
    if missing:
        L.append(f"- Candidate ids with no data (excluded): "
                 f"{', '.join('`'+m+'`' for m in missing)}.\n")
    L.append(
        "\nTautological / near-duplicate pairs are filtered: a metric vs itself; "
        "definitional duplicates (e.g. % low income vs % high needs, SAT subject "
        "vs SAT total, attendance vs chronic absence); a subgroup slice vs its "
        "all-students base; a gap metric vs an input it is computed from; and any "
        "same-category pair with |r| ≥ 0.92. Cross-category pairs are kept even "
        "when strong.\n")

    L.append("\n## Strongest non-trivial correlations (top 40)\n")
    L.append("| A | B | Pearson | Spearman | n | cross-cat |")
    L.append("|---|---|---:|---:|---:|:---:|")
    for _, r in nontrivial.head(40).iterrows():
        L.append(f"| {r['labelA']} | {r['labelB']} | {r['pearson']:+.2f} | "
                 f"{r['spearman']:+.2f} | {r['n']} | {'✓' if r['cross_cat'] else ''} |")

    L.append("\n## Weakest / near-zero cross-category pairs (a sample)\n")
    cc = nontrivial[nontrivial["cross_cat"]].copy()
    near0 = cc[cc["abs_r"] < 0.08].sort_values("abs_r")
    L.append("| A | B | Pearson | Spearman | n |")
    L.append("|---|---|---:|---:|---:|")
    for _, r in near0.head(15).iterrows():
        L.append(f"| {r['labelA']} | {r['labelB']} | {r['pearson']:+.2f} | "
                 f"{r['spearman']:+.2f} | {r['n']} |")

    for group, heading in (("expected", "Expected / confirming"),
                           ("surprising", "Surprising / worth a look")):
        L.append(f"\n## Curated presets — {heading}\n")
        for p in validated[group]:
            pr = f"{p['pearson']:+.2f}" if p["pearson"] is not None else "n/a"
            sr = f"{p['spearman']:+.2f}" if p["spearman"] is not None else "n/a"
            L.append(f"### {p['title']}")
            L.append(f"- **{p['labelA']}** × **{p['labelB']}**")
            L.append(f"- Pearson {pr}, Spearman {sr}, n={p['n']}")
            L.append(f"- {p['blurb']}\n")

    if problems:
        L.append("\n## Validation warnings\n")
        for pb in problems:
            L.append(f"- {pb}")

    with open(os.path.join(OUT_DIR, "correlations.md"), "w") as fh:
        fh.write("\n".join(L) + "\n")


# ───────────────────────── Hand-curated presets ─────────────────────────────
# Authored from the computed stats (see all_correlations.csv); each is validated
# against the catalog + data before being written. Stats are filled in at run
# time so r/rho/n always match the data.
CURATED = {
    "expected": [
        {"metricA": "acs_median_household_income", "metricB": "mcas_g10_math_me",
         "title": "Household income × 10th-grade math",
         "blurb": "The classic gradient: richer towns post far higher MCAS 10th-grade math pass rates. A clean, strong positive relationship that orients you to the map's main north-south spread."},
        {"metricA": "LI_PCT", "metricB": "mcas_g38_ela_me",
         "title": "Low-income share × grade 3–8 reading",
         "blurb": "Districts with more low-income students have markedly lower early-grade ELA proficiency — the single strongest poverty-to-outcome link in the data."},
        {"metricA": "acs_bachelors_plus_pct", "metricB": "mcas_g10_ela_me",
         "title": "Adults with degrees × 10th-grade English",
         "blurb": "Where more adults hold a bachelor's degree, students score higher on 10th-grade ELA. Parental education tracks achievement almost as tightly as income."},
        {"metricA": "acs_median_household_income", "metricB": "college_enroll_4yr_pct",
         "title": "Income × four-year-college enrollment",
         "blurb": "Wealthier districts send a much larger share of graduates straight to four-year colleges — opportunity compounds with income."},
        {"metricA": "LI_PCT", "metricB": "chronic_absent_pct",
         "title": "Low income × chronic absenteeism",
         "blurb": "Chronic absence rises steeply with the low-income share — poverty shows up as missed school days, not just lower test scores."},
        {"metricA": "mcas_g38_ela_me", "metricB": "grad_4yr",
         "title": "Early reading × graduation rate",
         "blurb": "Districts that get more kids reading proficiently by grade 8 graduate more of them on time. Early literacy is an early-warning signal you can see on the map."},
        {"metricA": "acs_bachelors_plus_pct", "metricB": "ap_participation_pct",
         "title": "Educated towns × AP enrollment",
         "blurb": "More college-educated communities push more juniors and seniors into AP/IB courses — a confirming signal of how expectations scale with adult education."},
        {"metricA": "acs_median_household_income", "metricB": "attendance_rate",
         "title": "Income × showing up to school",
         "blurb": "Higher-income districts have higher daily attendance. A simple, intuitive pairing that makes the wealth gradient tangible."},
    ],
    "surprising": [
        {"metricA": "per_pupil", "metricB": "mcas_g10_math_me",
         "title": "Spending per pupil × math scores",
         "blurb": "Surprising: total per-pupil spending barely tracks 10th-grade math achievement. The highest-spending districts are NOT the highest-scoring — money and outcomes decouple, partly because high-need districts spend more by design."},
        {"metricA": "avg_teacher_salary", "metricB": "mcas_math_sgp",
         "title": "Teacher pay × student growth",
         "blurb": "Counterintuitive: districts paying the highest average teacher salaries do not show faster student growth (SGP). Salary tracks local cost-of-living more than how much kids improve year to year."},
        {"metricA": "diversity_index", "metricB": "mcas_ela_sgp",
         "title": "Diversity × student growth",
         "blurb": "Worth a look: student racial diversity is essentially uncorrelated with academic growth. Diverse districts span the full range of growth — a useful counter to the assumption that demographics determine progress."},
        {"metricA": "acs_median_commute_min", "metricB": "mcas_g10_math_me",
         "title": "Commute time × math scores",
         "blurb": "Unexpected angle: longer average commutes weakly track higher math scores — a proxy for affluent, car-dependent suburbs that send parents far to work and post strong results."},
        {"metricA": "acs_median_home_value", "metricB": "disc_students_pct",
         "title": "Home values × discipline rate",
         "blurb": "Pricey-housing districts discipline a smaller share of students. Housing cost — a wealth proxy — maps onto who gets suspended, a sobering cross-domain pattern."},
        {"metricA": "school_choice_out_pct", "metricB": "mcas_g38_math_me",
         "title": "Students leaving × math scores",
         "blurb": "Districts losing more resident students to school choice tend to have lower math proficiency — families voting with their feet, visible as an outflow-vs-outcomes pattern on the map."},
        {"metricA": "students_per_counselor", "metricB": "grad_4yr",
         "title": "Counselor caseload × graduation",
         "blurb": "Surprising how weak it is: the number of students per guidance counselor barely predicts graduation rates. Staffing ratios alone don't tell the outcome story people expect."},
        {"metricA": "acs_median_household_income", "metricB": "sped_separate_pct",
         "title": "Income × separate special-ed placement",
         "blurb": "Counterintuitive: wealthier districts place FEWER students with disabilities in substantially-separate settings. Lower-income districts lean on segregated placements more — inclusion tracks money, not need."},
        {"metricA": "stu_tchr_ratio", "metricB": "mcas_g10_math_me",
         "title": "Class crowding × math scores",
         "blurb": "Surprising non-result: the number of students per teacher is essentially unrelated to 10th-grade math scores. Bigger classes don't mean worse outcomes here — a caution against reading the ratio as a quality signal."},
        {"metricA": "acs_work_from_home_pct", "metricB": "college_enroll_4yr_pct",
         "title": "Work-from-home × college-going",
         "blurb": "An odd but real proxy: districts with more remote workers send more grads to four-year colleges — remote work concentrates in the same educated, higher-income communities."},
    ],
}


if __name__ == "__main__":
    sys.exit(main())
