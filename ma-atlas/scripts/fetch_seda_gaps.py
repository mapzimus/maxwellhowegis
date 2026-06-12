"""
NATIONAL-SCALE ACHIEVEMENT GAPS from the Stanford Education Data Archive (SEDA) —
the equity companion to scripts/fetch_seda.py. Every gap the atlas already shows
(grad_gap_*, mcas_*_gap_*, etc.) is MASSACHUSETTS-relative; these three are on the
ABSOLUTE U.S. grade-level scale, so a district's white-Black gap can be compared
directly against districts in any other state.

Source: Stanford Education Data Archive (SEDA) **Version 6.0** (Reardon, Ho, Shear,
Fahle, Kalogrides, Saliba, et al.; Educational Opportunity Project at Stanford
University, edopportunity.org), released Feb 2026, DOI 10.25740/xh833nn4025.
We use the POOLED, GRADE-COHORT-STANDARDIZED, *SUBGROUP* geographic-school-district
file — the by-race / by-economic counterpart of the all-students file used by
fetch_seda.py. The GCS scale is the one SEDA recommends "for low-stakes reporting
to non-research audiences": each unit = one U.S. grade level.

  https://stacks.stanford.edu/file/druid:xh833nn4025/seda_geodist_poolsub_gcs_6.0.csv
  (~100 MB; cached under scripts/.seda_cache/, gitignored — only the small derived
   JSON is committed.)
  https://educationdata.urban.org/api/v1/school-districts/ccd/directory/2020/
   (NCES CCD LEA directory via Urban Institute — supplies the leaid→DESE crosswalk,
   identical to scripts/fetch_seda.py / fetch_crdc.py.)

WHAT THE FILE GIVES US (verified by inspecting the actual CSV header + MA rows):
The subgroup file does NOT carry pre-computed gap *columns* named gcs_wbg/gcs_whg/
gcs_neg. Instead it ships SEDA's pre-computed gaps as dedicated subgroup *ROWS*,
flagged `gap=1`, whose mean-achievement columns hold the gap itself (in grade
levels). For Massachusetts (`fips=25`) the relevant rows are:

  subcat=race, subgroup=wbg  -> white-minus-Black gap   (positive = white ahead)
  subcat=race, subgroup=whg  -> white-minus-Hispanic gap
  subcat=ecd,  subgroup=neg  -> nonECD-minus-ECD gap    (non-poor minus poor)

We confirmed against the component rows that, e.g., the `wbg` row's value equals
(wht achievement - blk achievement) exactly, and `neg` equals (nec - ecd) exactly
(see the gradecenter-cancels note below). So reading the published gap rows is
equivalent to computing (subgroup_a - subgroup_b) ourselves; we use the published
rows because they are SEDA's authoritative gap values.

There is also NO combined-across-subjects mean column in the subgroup file (the
all-students file's `gcs_mn_avg_eb` is absent here). The EB (Empirical-Bayes,
shrunken — recommended over `_ol` for reporting) means are split by subject:
`gcs_mn_avg_mth_eb` (math) and `gcs_mn_avg_rla_eb` (reading/language-arts). We pool
the two subjects by averaging whichever are present, matching SEDA's own pooled
treatment. Because each subject's gap is a DIFFERENCE of two grade-level scores at
the same gradecenter, the gradecenter term cancels — a gap value is already a pure
grade-level difference and needs no re-centering (unlike fetch_seda.py's level
metric, which subtracts gradecenter).

SHIPPED METRICS (district level, grade levels, format "num"):
  seda_gap_white_black     white - Black achievement  (subgroup row race/wbg)
  seda_gap_white_hispanic  white - Hispanic            (subgroup row race/whg)
  seda_gap_econ            non-poor - poor (nonECD-ECD)(subgroup row ecd/neg)
A positive value = the advantaged group is that many U.S. grade levels ahead.
MA gaps run ~0-3.3 grade levels (medians ~1.2 white-Hisp, ~1.5 white-Black,
~1.6 econ). Bigger gap = worse (less equitable): the atlas paints these on a
sequential Reds ramp, consistent with the other absolute "...gap" metrics.

CROSSWALK (NCES -> DESE), reused verbatim from fetch_seda.py / fetch_crdc.py: the
CCD LEA directory exposes `state_leaid` = "MA-XXXX", where XXXX is the 4-digit DESE
org code; DESE's 8-digit DIST_CODE = XXXX + "0000". SEDA's key is `sedalea` (= NCES
7-digit leaid).

COVERAGE (of the 281 atlas academic districts) is deliberately SPARSER than the
all-students benchmark: a subgroup gap exists only where SEDA observed enough of
BOTH groups. White-Black is the sparsest (only districts with a measurable Black
student population); the economic gap is the densest (nearly every district has
both ECD and non-ECD students). Districts without a gap get `null` (never 0) — a
missing gap is "not enough of one group to measure", not "no gap".

Output: data/ma_district_seda_gaps.json :: { DIST_CODE: {col: val} }

Run from repo root::  python scripts/fetch_seda_gaps.py
"""
from __future__ import annotations
import csv, json, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISTS = REPO / "data" / "ma_academic_districts.geojson"
OUT = REPO / "data" / "ma_district_seda_gaps.json"
CACHE = Path(__file__).resolve().parent / ".seda_cache"

SEDA_VERSION = "6.0"
SEDA_CSV_URL = ("https://stacks.stanford.edu/file/druid:xh833nn4025/"
                "seda_geodist_poolsub_gcs_6.0.csv")
URBAN = "https://educationdata.urban.org/api/v1"
CCD_YEAR = 2020
FIPS_MA = 25
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

# SEDA gap-subgroup row -> our metric id. Each is a published (gap=1) row whose
# mean-achievement value IS the gap, in grade levels (advantaged minus other).
GAP_ROWS = {
    ("race", "wbg"): "seda_gap_white_black",      # white - Black
    ("race", "whg"): "seda_gap_white_hispanic",   # white - Hispanic
    ("ecd",  "neg"): "seda_gap_econ",             # non-poor (nonECD) - poor (ECD)
}


def num(v):
    """Parse a SEDA numeric (CSV stores Stata-style '.123' / '-.05' strings).
    Return float, or None for blanks. SEDA uses blank for suppressed/missing."""
    if v is None or v == "" or v == ".":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def pooled_avg(row) -> float | None:
    """Pool the math + reading EB means into one grade-level value by averaging
    whichever subjects are present (matching SEDA's pooled treatment). For a gap
    row this is the white-minus-other (or nonpoor-minus-poor) gap, in grade
    levels. Returns None if neither subject is observed."""
    mth = num(row.get("gcs_mn_avg_mth_eb"))
    rla = num(row.get("gcs_mn_avg_rla_eb"))
    vals = [v for v in (mth, rla) if v is not None]
    return sum(vals) / len(vals) if vals else None


def download(url: str, dest: Path) -> Path:
    """Fetch `url` to `dest` once; reuse the cached copy on subsequent runs."""
    CACHE.mkdir(exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
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
    """CCD state_leaid 'MA-0753' -> DESE DIST_CODE '07530000' (see fetch_seda.py)."""
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

    # 1) NCES leaid -> DESE DIST_CODE crosswalk (via CCD state_leaid).
    lea2dc = {}
    for row in fetch_ccd_dir():
        dc = state_leaid_to_distcode(row.get("state_leaid"))
        if dc:
            lea2dc[str(row["leaid"]).zfill(7)] = dc

    # 2) SEDA pooled GCS subgroup geodist CSV — keep only MA gap-subgroup rows.
    csv_path = download(SEDA_CSV_URL, CACHE / "seda_geodist_poolsub_gcs_6.0.csv")

    out: dict[str, dict] = {}
    counts = {mid: 0 for mid in GAP_ROWS.values()}
    seen = 0       # MA gap rows that crosswalked to a DIST_CODE in our universe
    orphans = 0    # crosswalked but not in the atlas universe
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("fips") != str(FIPS_MA):
                continue
            key = (row.get("subcat"), row.get("subgroup"))
            mid = GAP_ROWS.get(key)
            if not mid:
                continue
            dc = lea2dc.get(str(row.get("sedalea")).zfill(7))
            if not dc:
                continue
            if dc not in ours:
                orphans += 1
                continue
            gap = pooled_avg(row)
            if gap is None:
                continue
            seen += 1
            out.setdefault(dc, {})[mid] = round(gap, 3)
            counts[mid] += 1

    OUT.write_text(json.dumps(out, indent=1))
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)} districts "
          f"(SEDA v{SEDA_VERSION}, pooled GCS subgroup geodist)")
    print(f"  MA gap rows used: {seen} "
          f"({orphans} not in atlas universe -> dropped)")
    for mid in GAP_ROWS.values():
        print(f"  {mid:24s} {counts[mid]}/{len(ours)}  (grade levels)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
