"""
Build ``data/ma_childcare.geojson`` -- a located-dot layer of every licensed
child-care CENTER in Massachusetts (the institutional programs; in-home Family
Child Care is intentionally excluded), enriched with the public-grant dollars
each center received so the atlas can offer a "C3 grant scrutiny" view.

Why centers only: in-home Family Child Care providers are individuals operating
out of their homes, so plotting/flagging them by name raises privacy and
fairness concerns. Centers are institutions, hold the bulk of capacity, and are
where grant-oversight scrutiny is focused.

SOURCES (public, no key; MA Education-to-Career hub, Socrata/SODA):
  * "Current Licensed and Funded EEC Programs" [iyks-y3g6] -- one row per program,
    pre-geocoded (program_latitude/longitude); we keep licensed Center-based Care.
  * "Commonwealth Cares for Children (C3) Funds by Program" [5722-nbhm] -- C3 is
    monthly operational grant funding; one row per program per fiscal year, with
    the dollars disbursed (c3_funds). Joined to the licensing rows by
    PROVIDER_NUMBER (formats match, e.g. "P-169294").

C3 is largely capacity/cost-based, NOT enrollment-based, and no public dataset
exposes a program's actual enrollment or per-child billing. So the grant figures
here support an OVERSIGHT/TRIAGE lens -- surfacing centers whose grant dollars
are statistically unusual relative to their licensed size -- and emphatically NOT
a fraud determination. An outlier here is a prompt to look, not evidence of
wrongdoing; most have ordinary explanations (infant-heavy rooms, subsidy mix...).

Per kept center we write: name, town, licensed capacity, an "ages served" label,
Head Start / accepts-subsidy badges, the C3 dollars for the last three fiscal
years (c3_2024/2025/2026), and c3_per_seat (latest FY / licensed capacity) -- the
field the grant view colors by. Centers with no C3 record leave the C3 fields
null (rendered grey / "no grant on record").

Output: ``data/ma_childcare.geojson`` (GeoJSON FeatureCollection of Points).
Run from repo root::  python scripts/fetch_childcare.py
"""
from __future__ import annotations
import json, statistics, urllib.error, urllib.parse, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "data" / "ma_childcare.geojson"
DOMAIN = "educationtocareer.data.mass.gov"
LICENSE_DS = "iyks-y3g6"          # current licensed/funded programs
C3_DS = "5722-nbhm"               # C3 grant funds by program & fiscal year
C3_YEARS = [2024, 2025, 2026]     # last three fiscal years (trend + latest)
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}

MA_BBOX = (41.0, 43.0, -73.6, -69.8)  # lat_min, lat_max, lon_min, lon_max

# Age-band capacity columns, youngest -> oldest. Used only to summarize an
# "ages served" label (the bands overlap and don't sum to licensed_capacity).
AGE_BANDS = [
    ("infant_birth15mo",          "infant"),
    ("infant_toddler_birth33mo",  "infant"),
    ("toddler_15mo33mo",          "toddler"),
    ("toddler_preschool_15mok",   "toddler"),
    ("preschool_33mok",           "preschool"),
    ("preschoolsa_33mo8yr",       "preschool"),
    ("kindergarten",              "preschool"),
    ("kindergarten_schoolage",    "schoolage"),
    ("schoolage_5yr14yr",         "schoolage"),
    ("multi_agegroup_birth14yr",  "infant"),
]
STAGE_ORDER = ["infant", "toddler", "preschool", "schoolage"]
STAGE_LABEL = {"infant": "Infant", "toddler": "Toddler",
               "preschool": "Preschool", "schoolage": "School age"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def soda_all(dataset: str, select: str, where: str, order: str) -> list[dict]:
    """Page through a dataset (well above the 1k default)."""
    rows, offset, page = [], 0, 5000
    while True:
        batch = soda(dataset, {"$select": select, "$where": where,
                               "$order": order, "$limit": str(page), "$offset": str(offset)})
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows


def num(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def truthy(v) -> bool:
    return str(v).strip().lower() in ("true", "1", "yes", "t")


def ages_label(row: dict) -> str:
    present = {stage for col, stage in AGE_BANDS if (num(row.get(col)) or 0) > 0}
    if not present:
        return ""
    stages = [s for s in STAGE_ORDER if s in present]
    if len(stages) == 1:
        return STAGE_LABEL[stages[0]]
    return f"{STAGE_LABEL[stages[0]]}–{STAGE_LABEL[stages[-1]]}"


def title_town(name: str) -> str:
    return " ".join(w.capitalize() for w in (name or "").strip().split())


def fetch_c3() -> dict[str, dict[int, int]]:
    """{provider_number: {fiscal_year: dollars}} for the recent fiscal years."""
    yrs = ",".join(str(y) for y in C3_YEARS)
    rows = soda_all(C3_DS, "provider_number,fiscal_year,c3_funds",
                    f"fiscal_year in ({yrs})", "provider_number")
    out: dict[str, dict[int, int]] = {}
    for r in rows:
        pid = (r.get("provider_number") or "").strip()
        fy = num(r.get("fiscal_year"))
        amt = num(r.get("c3_funds"))
        if not pid or fy is None or amt is None:
            continue
        out.setdefault(pid, {})[int(fy)] = int(round(amt))
    return out


def main() -> int:
    lat_min, lat_max, lon_min, lon_max = MA_BBOX

    centers = soda_all(
        LICENSE_DS,
        "provider_number,program_name,program_city,program_latitude,program_longitude,"
        "licensed_capacity,head_start,voucher_contract,licensed_provider_status,"
        "regulatory_status," + ",".join(c for c, _ in AGE_BANDS),
        "licensed_funded='Licensed' AND program_type='Center-based Care'",
        "provider_number",
    )
    c3 = fetch_c3()

    features = []
    dropped_status = dropped_coords = 0
    head_start = subsidy = with_c3 = 0
    per_seat_vals = []

    for r in centers:
        status = (r.get("licensed_provider_status") or "").strip()
        reg = (r.get("regulatory_status") or "").strip()
        if status == "Expired" or reg == "Inactive":
            dropped_status += 1
            continue
        lat, lon = num(r.get("program_latitude")), num(r.get("program_longitude"))
        if lat is None or lon is None or not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
            dropped_coords += 1
            continue

        pid = (r.get("provider_number") or "").strip()
        cap = num(r.get("licensed_capacity"))
        hs = truthy(r.get("head_start"))
        sub = truthy(r.get("voucher_contract"))
        if hs:
            head_start += 1
        if sub:
            subsidy += 1

        props = {
            "NAME": (r.get("program_name") or "").strip(),
            "CITY": title_town(r.get("program_city")),
            "capacity": int(cap) if cap is not None else None,
            "ages": ages_label(r),
        }
        if hs:
            props["head_start"] = True
        if sub:
            props["subsidy"] = True

        funds = c3.get(pid, {})
        if funds:
            with_c3 += 1
        for y in C3_YEARS:
            if y in funds:
                props[f"c3_{y}"] = funds[y]
        latest = funds.get(C3_YEARS[-1])
        if latest is not None and cap and cap > 0:
            ps = round(latest / cap)
            props["c3_per_seat"] = ps
            per_seat_vals.append(ps)

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            "properties": props,
        })

    features.sort(key=lambda f: f["properties"]["NAME"].lower())
    fc = {
        "type": "FeatureCollection",
        "name": "ma_childcare",
        "metadata": {
            "source": "MA EEC (Education-to-Career hub)",
            "datasets": {"licensing": LICENSE_DS, "c3_grants": C3_DS},
            "universe": "Center-based Care, licensed, active; in-home Family Child Care excluded",
            "c3_latest_fy": C3_YEARS[-1],
            "note": "C3 figures support oversight triage, not fraud determination",
        },
        "features": features,
    }
    OUT.write_text(json.dumps(fc, separators=(",", ":")))

    total = len(features)
    print(f"wrote {OUT.relative_to(REPO)}: {total} licensed child-care CENTERS (EEC {LICENSE_DS} + C3 {C3_DS})")
    print(f"  with a C3 grant on record (FY{C3_YEARS[-1]} or prior): {with_c3}/{total}")
    print(f"  Head Start: {head_start}   accepts subsidy: {subsidy}")
    print(f"  dropped: {dropped_status} closed/expired, {dropped_coords} missing/out-of-MA coords")
    if per_seat_vals:
        per_seat_vals.sort()
        q1 = per_seat_vals[len(per_seat_vals) // 4]
        med = statistics.median(per_seat_vals)
        q3 = per_seat_vals[len(per_seat_vals) * 3 // 4]
        fence = q3 + 1.5 * (q3 - q1)
        n_out = sum(1 for v in per_seat_vals if v > fence)
        print(f"  c3_per_seat (FY{C3_YEARS[-1]}): n={len(per_seat_vals)} "
              f"median={med:.0f} Q1={q1} Q3={q3} IQR-fence={fence:.0f} "
              f"-> {n_out} outliers above fence ({100*n_out/len(per_seat_vals):.1f}%)")
    print(f"  file size: {OUT.stat().st_size/1_000_000:.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
