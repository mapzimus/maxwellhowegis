"""
NATIONAL achievement benchmark from the Stanford Education Data Archive (SEDA) —
the one thing the atlas otherwise completely lacks: every test metric already in
the atlas is MA-relative, so a parent can't tell whether a district is above or
below the U.S. average. SEDA puts U.S. DISTRICT-level achievement on ONE national
grade-equivalent scale.

Source: Stanford Education Data Archive (SEDA) **Version 6.0** (Reardon, Ho, Shear,
Fahle, Kalogrides, Saliba, et al.; Educational Opportunity Project at Stanford
University, edopportunity.org), released Feb 2026, DOI 10.25740/xh833nn4025.
We use the POOLED, GRADE-COHORT-STANDARDIZED geographic-school-district file
(pooled across years AND subjects; "geodist" reassigns charters to the district
they sit in). The GCS scale is the one SEDA itself recommends "for low-stakes
reporting to non-research audiences" — each unit = one U.S. grade level.

  https://stacks.stanford.edu/file/druid:xh833nn4025/seda_geodist_pool_gcs_6.0.csv
  (75 MB; cached under scripts/.seda_cache/, gitignored — only the small derived
   JSON is committed.)
  https://educationdata.urban.org/api/v1/school-districts/ccd/directory/2020/
   (NCES CCD LEA directory via Urban Institute — supplies the leaid→DESE crosswalk,
   identical to scripts/fetch_crdc.py.)

We keep ONLY the all-students rows (`subcat='all'`, `subgroup='all'`) for
Massachusetts (`fips=25`). Per SEDA 6.0 §II.G ("How to Obtain Values Shown on
edopportunity.org") the three headline measures are derived from the Empirical-
Bayes (`_eb`, shrunken — recommended over `_ol` for reporting) pooled columns:

  seda_achievement  = gcs_mn_avg_eb − gradecenter
        Average test score vs the U.S. average, in GRADE LEVELS. `gcs_mn_avg_eb`
        is absolute grade-level performance (e.g. 6.95 at the gradecenter of 5.5);
        subtracting gradecenter re-centers it on the national average so 0 = "at
        the U.S. average for this grade", +1 = "one full grade level ahead",
        −1 = "one grade behind". MA range ≈ −1.8 .. +4.1 (median ≈ +1.4 — MA runs
        above the U.S. average). Diverging RdBu (blue = above, red = below).
  seda_learning_rate = gcs_mn_lrn_eb
        The LEARNING RATE: grade levels of growth gained per year of school. The
        national average is 1.0 (a full grade per grade) — verified empirically:
        the national all/all median of gcs_mn_lrn_eb is 1.005. MA range ≈ 0.5..1.6.
        (SEDA's website recipe writes "gcs_mn_lrn_eb + 1", but the published column
        is ALREADY centered on 1.0 — adding 1 would double-count; we confirmed
        against the national distribution and use the raw column. dark = faster.)
  seda_trend = gcs_mn_tav_eb
        The TREND in average scores: change in grade-level performance per cohort
        (≈ per year), in grade levels/year. Positive = scores rising over time.
        MA range ≈ −0.21 .. +0.14. Diverging RdBu (blue = improving, red = falling).

CROSSWALK (NCES → DESE), reused verbatim from scripts/fetch_crdc.py: the CCD LEA
directory exposes `state_leaid` = "MA-XXXX", where XXXX is the 4-digit DESE org
code; DESE's 8-digit DIST_CODE = XXXX + "0000". SEDA's key is `sedalea` (= NCES
7-digit leaid). 271/273 MA SEDA geodist districts crosswalk; the 2 that don't are
non-operating shell districts (Berlin/Boylston non-op), correctly absent.

COVERAGE (of the 281 atlas academic districts):
  seda_achievement   269   seda_learning_rate  240   seda_trend  266
The ~12 districts with no SEDA row are REGIONAL SECONDARY districts (grades 7-12 /
9-12 only — Concord-Carlisle, Dover-Sherborn, King Philip, Lincoln-Sudbury,
Masconomet, Nauset, Northboro-Southboro, Somerset Berkley, Tantasqua, Berlin-
Boylston) plus two tiny rurals (Gosnold, Worthington). SEDA's GEOGRAPHIC districts
count grade-3-8 testing under the elementary town a child lives in, so a secondary-
only regional has no geodist achievement row — this is expected, and we store
`null` (never 0). Learning rate has lower coverage (240) because SEDA suppresses a
district's growth slope when too few grade-cohorts are observed; those districts
keep achievement but get `null` learning rate.

Output: data/ma_district_seda.json :: { DIST_CODE: {col: val} }

Run from repo root::  python scripts/fetch_seda.py
"""
from __future__ import annotations
import csv, json, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_seda.json"
CACHE = Path(__file__).resolve().parent / ".seda_cache"

SEDA_VERSION = "6.0"
SEDA_CSV_URL = ("https://stacks.stanford.edu/file/druid:xh833nn4025/"
                "seda_geodist_pool_gcs_6.0.csv")
URBAN = "https://educationdata.urban.org/api/v1"
CCD_YEAR = 2020
FIPS_MA = 25
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def num(v):
    """Parse a SEDA numeric (CSV stores Stata-style '.123' / '-.05' strings).
    Return float, or None for blanks. SEDA uses blank for suppressed/missing."""
    if v is None or v == "" or v == ".":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def download(url: str, dest: Path) -> Path:
    """Fetch `url` to `dest` once; reuse the cached copy on subsequent runs."""
    CACHE.mkdir(exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    return dest


def fetch_ccd_dir() -> list[dict]:
    """All MA CCD LEA directory rows (paged), cached to disk."""
    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / f"ccd_dir_{CCD_YEAR}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    rows: list[dict] = []
    url = (f"{URBAN}/school-districts/ccd/directory/{CCD_YEAR}/"
           f"?fips={FIPS_MA}&limit=10000")
    while url:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            j = json.loads(r.read().decode("utf-8"))
        rows += j["results"]
        url = j.get("next")
    cache_file.write_text(json.dumps(rows))
    return rows


def state_leaid_to_distcode(state_leaid) -> str | None:
    """CCD state_leaid 'MA-0753' → DESE DIST_CODE '07530000' (see fetch_crdc.py)."""
    if not state_leaid:
        return None
    s = str(state_leaid)
    if s.startswith("MA-"):
        s = s[3:]
    s = s.strip()
    return s.zfill(4) + "0000" if s.isdigit() else None


def main() -> int:
    ours = {f["properties"]["DIST_CODE"] for f in
            json.loads(DISTS.read_text())["features"]}

    # 1) NCES leaid → DESE DIST_CODE crosswalk (via CCD state_leaid).
    lea2dc = {}
    for row in fetch_ccd_dir():
        dc = state_leaid_to_distcode(row.get("state_leaid"))
        if dc:
            lea2dc[str(row["leaid"]).zfill(7)] = dc

    # 2) SEDA pooled GCS geodist CSV — keep only MA all-students rows.
    csv_path = download(SEDA_CSV_URL, CACHE / "seda_geodist_pool_gcs_6.0.csv")

    out: dict[str, dict] = {}
    n_ach = n_lrn = n_trd = 0
    seen = 0           # MA all/all rows that crosswalked to a DIST_CODE
    orphans = 0        # crosswalked but not in the atlas universe
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("fips") != str(FIPS_MA)
                    or row.get("subcat") != "all"
                    or row.get("subgroup") != "all"):
                continue
            dc = lea2dc.get(str(row.get("sedalea")).zfill(7))
            if not dc:
                continue
            seen += 1
            if dc not in ours:
                orphans += 1
                continue

            gradecenter = num(row.get("gradecenter"))
            avg = num(row.get("gcs_mn_avg_eb"))
            lrn = num(row.get("gcs_mn_lrn_eb"))
            tav = num(row.get("gcs_mn_tav_eb"))

            rec = {}
            # Achievement: re-center absolute grade-level performance on the
            # national average (0 = at the U.S. average for this grade).
            if avg is not None and gradecenter is not None:
                rec["seda_achievement"] = round(avg - gradecenter, 3)
                n_ach += 1
            # Learning rate: grade levels gained per year (national avg = 1.0).
            if lrn is not None:
                rec["seda_learning_rate"] = round(lrn, 3)
                n_lrn += 1
            # Trend: change in average score per cohort/year (grade levels/yr).
            if tav is not None:
                rec["seda_trend"] = round(tav, 4)
                n_trd += 1

            if rec:
                # Last writer wins, but sedalea↔DIST_CODE is 1:1 here; assert it.
                if dc in out:
                    print(f"  WARN duplicate DIST_CODE {dc} ({row['sedaleaname']})")
                out[dc] = rec

    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(SEDA v{SEDA_VERSION}, pooled GCS geodist)")
    print(f"  MA all/all rows crosswalked: {seen} "
          f"({orphans} not in atlas universe -> dropped)")
    print(f"  seda_achievement    {n_ach}/{len(ours)}  (grade levels vs U.S. average)")
    print(f"  seda_learning_rate  {n_lrn}/{len(ours)}  (grade levels gained per year; US=1.0)")
    print(f"  seda_trend          {n_trd}/{len(ours)}  (change in avg score per year)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
