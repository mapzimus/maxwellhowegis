"""
Add real per-school metrics to the atlas's school point layer
(``ma_public_schools.geojson``), which currently carries no metrics. We pull
them from MA DESE's open data (Education-to-Career hub, Socrata) and write a
join file keyed by SCHID (the atlas's 8-char zero-padded school code):

  sch_enrollment              <- Enrollment: Grade, Race/Ethnicity, ...  [t8td-gens]  total_cnt
  sch_mcas_ela_me             <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (ELA)
  sch_mcas_math_me            <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (MATH)
  sch_mcas_ela_low_income     <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (ELA, Low Income)
  sch_mcas_math_low_income    <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (MATH, Low Income)
  sch_mcas_g10_ela_me         <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (ELA, gr10)
  sch_mcas_g10_math_me        <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (MATH, gr10)
  sch_accountability_pctile   <- School/District Accountability Class.   [ppbc-i8t9]  accntblty_pctle
  sch_chronic_absent_pct      <- Student Attendance                      [ak6h-9k7x]  pct_chron_abs_10
  sch_teacher_experienced_pct <- Elementary and Secondary Teacher Data   [4684-cw3t]  exp_tchr_pct
  sch_grad_4yr                <- High School Graduation Rates            [n2xa-p822]  grad_pct (HS only)
  sch_class_size              <- Class Size by Gender/Race/Selected Pop. [35yv-uxv5]  avg_clss_cnt (subj='All')
  sch_disciplined_pct         <- Student Discipline                      [2kca-w7rq]  stu_discipl_cnt / stu_cnt
  sch_mcas_sci_me             <- MCAS Achievement Results                [i9w6-niyt]  m_plus_e_pct (SCI, gr 03-08)
  sch_ap_pct_3plus            <- Advanced Placement (AP) Performance      [787a-3wen]  pct_3_5 (HS only)
  sch_per_pupil               <- School Expenditures by Spending Category [i5up-aez6]  ind_value (Total A+B+C)

All are reported at the SCHOOL level keyed by ``org_code``, an 8-char
zero-padded code that matches the atlas's SCHID. We take the latest year each
metric is published, All Students:
  - enrollment   SY2026 (most recent fall collection)
  - MCAS         SY2025, grade band "ALL (03-08)" (the all-grades rollup)
  - accountability SY2025 (DESE assigns each school a 1-99 percentile)
  - chronic absence SY2025 (End-of-Year, All Students; ~0-1 fraction)
  - teacher experience SY2025 (exp_tchr_pct; SY2026 not yet populated at school grain)
  - 4-yr graduation SY2025 (only schools with a 4-year cohort — i.e. high schools —
    report a value; elementary/middle schools are left absent, as for grad_4yr)
  - class size    SY2025 (avg_clss_cnt for subj='All'; the all-subjects average; a
    suppressed/zero average is treated as absent). The parent-most-asked field.
  - discipline    SY2025 (All Offenses, All Students; share of students disciplined =
    stu_discipl_cnt / stu_cnt — full coverage, vs. suspension % which is small-cell
    suppressed for low-discipline schools). A real 0 disciplined is a true 0%, not
    suppression (suppression shows as an empty count), so 0 is kept.
  - science MCAS  SY2025, SCI subject, "ALL (03-08)" band — mirrors the ELA/Math rollup.
  - AP            SY2025, All Subjects (pct_3_5 = share of AP exams scoring 3-5). Only
    schools that administer AP exams (high schools) report; others left absent.
  - per-pupil $   SY2024 (latest published; the table runs 2019..2024). DESE's
    "School Expenditures by Spending Category" reports each school's TOTAL
    per-pupil spending on the ``Total A+B+C`` / ``Total Expenditures`` row
    (ind_value_type='Amount') — the sum of district-allocated + school-reported
    instructional + non-instructional per-pupil dollars. This is published only
    for some schools (district-run schools with a school-level expenditure
    report); charters and many non-standard orgs are absent, so sch_per_pupil is
    null for those (hidden in the popup). A 0 / blank amount is treated as absent
    (a real school never spends $0/pupil; 0 means not reported). Stored as a whole
    USD integer.

MCAS is only administered in grades 3-8 (+ high school by subject), so only
tested schools have MCAS rows; accountability percentiles are likewise only
assigned to schools with sufficient data. Enrollment covers nearly all schools.
Class size and discipline cover nearly all schools; science MCAS covers tested
(grades 3-8) schools; AP covers only high schools that administer exams.

Output: ``data/ma_school_metrics.json`` :: { SCHID: {col: value, ...} }
Enrollment is an integer count; MCAS values are fractions (0-1) rounded to 4
decimals; accountability percentile is a 1-99 integer.

Run from repo root::  python scripts/fetch_school_metrics.py
"""
from __future__ import annotations
import json, urllib.request, urllib.parse
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCHOOLS = REPO / "data" / "ma_public_schools.geojson"
OUT = REPO / "data" / "ma_school_metrics.json"
DOMAIN = "educationtocareer.data.mass.gov"
UA = {"User-Agent": "ma-education-atlas/1.0 (github.com/mapzimus/ma-education-atlas)"}


def soda(dataset: str, params: dict) -> list[dict]:
    url = f"https://{DOMAIN}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def norm(code) -> str:
    """DESE codes may drop leading zeros; atlas uses zero-padded 8-char SCHID."""
    return str(code).zfill(8)


def to_frac(v):
    """Normalize to a 0-1 fraction. MCAS m_plus_e_pct comes as 0.33 already;
    guard against percent-style values just in case."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if f < 0:
        return None
    return f / 100.0 if f > 1.0 else f


def to_int(v):
    if v is None or v == "":
        return None
    try:
        return int(round(float(v)))
    except ValueError:
        return None


def to_num(v):
    """A plain non-negative number (e.g. an average count like 14.2), rounded to
    1 decimal. Used for class size, which is NOT a 0-1 fraction."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    return None if f <= 0 else round(f, 1)


def main() -> int:
    ours = {f["properties"]["SCHID"] for f in
            json.loads(SCHOOLS.read_text())["features"]}
    out: dict[str, dict] = {sid: {} for sid in ours}

    # 1) Enrollment (total count) — latest fall collection (SY2026), schools only.
    enr = soda("t8td-gens", {
        "$where": "org_type='School' AND sy='2026'",
        "$select": "org_code,total_cnt", "$limit": "5000",
    })
    n_enr = 0
    for r in enr:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_int(r.get("total_cnt"))) is not None:
            out[sid]["sch_enrollment"] = v; n_enr += 1

    # 2) MCAS % Meeting+Exceeding — SY2025, All Students, all-grades (03-08) band.
    for subj, col in (("ELA", "sch_mcas_ela_me"), ("MATH", "sch_mcas_math_me")):
        rows = soda("i9w6-niyt", {
            "$where": "org_type IN ('Public School','Charter School') "
                      "AND stu_grp='All Students' "
                      f"AND subject_code='{subj}' "
                      "AND test_grade='ALL (03-08)' AND sy='2025'",
            "$select": "org_code,m_plus_e_pct", "$limit": "5000",
        })
        n = 0
        for r in rows:
            sid = norm(r.get("org_code"))
            if sid in out and (v := to_frac(r.get("m_plus_e_pct"))) is not None:
                out[sid][col] = round(v, 4); n += 1
        if subj == "ELA":
            n_ela = n
        else:
            n_math = n

    # 2a) MCAS % M+E for the LOW-INCOME subgroup — SY2025, all-grades (03-08) band.
    #     Same query/dataset as the All-Students rollup above, sliced to
    #     stu_grp='Low Income', so the popup can show the income gap AT the school
    #     (how low-income kids do here vs. all students). Only schools with a tested
    #     low-income cohort report, so this is sparser than All-Students — correct.
    for subj, col in (("ELA", "sch_mcas_ela_low_income"),
                      ("MATH", "sch_mcas_math_low_income")):
        rows = soda("i9w6-niyt", {
            "$where": "org_type IN ('Public School','Charter School') "
                      "AND stu_grp='Low Income' "
                      f"AND subject_code='{subj}' "
                      "AND test_grade='ALL (03-08)' AND sy='2025'",
            "$select": "org_code,m_plus_e_pct", "$limit": "5000",
        })
        n = 0
        for r in rows:
            sid = norm(r.get("org_code"))
            if sid in out and (v := to_frac(r.get("m_plus_e_pct"))) is not None:
                out[sid][col] = round(v, 4); n += 1
        if subj == "ELA":
            n_ela_li = n
        else:
            n_math_li = n

    # 2b) MCAS Grade-10 % M+E — SY2025. Grade-10-only high schools have NO grades 3-8,
    #     so the (03-08) query above never matches them. Separate sch_mcas_g10_* fields.
    for subj, col in (("ELA", "sch_mcas_g10_ela_me"), ("MATH", "sch_mcas_g10_math_me")):
        rows = soda("i9w6-niyt", {
            "$where": "org_type IN ('Public School','Charter School') "
                      "AND stu_grp='All Students' "
                      f"AND subject_code='{subj}' "
                      "AND test_grade='10' AND sy='2025'",
            "$select": "org_code,m_plus_e_pct", "$limit": "5000",
        })
        n = 0
        for r in rows:
            sid = norm(r.get("org_code"))
            if sid in out and (v := to_frac(r.get("m_plus_e_pct"))) is not None:
                out[sid][col] = round(v, 4); n += 1
        if subj == "ELA":
            n_g10_ela = n
        else:
            n_g10_math = n

    # 3) Accountability percentile (1-99) — SY2025, school level.
    acc = soda("ppbc-i8t9", {
        "$where": "org_type='School' AND sy='2025' AND accntblty_pctle IS NOT NULL",
        "$select": "org_code,accntblty_pctle", "$limit": "5000",
    })
    n_acc = 0
    for r in acc:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_int(r.get("accntblty_pctle"))) is not None:
            out[sid]["sch_accountability_pctile"] = v; n_acc += 1

    # 3b) Official ESSA classification (SY2025) -> two boolean flags for the
    #     "Schools of Recognition" / "Requiring assistance" map filter. Recognition
    #     is the DESE award (incl. National Blue Ribbon / ESEA Distinguished);
    #     needs-assistance is classification_overall="Requiring assistance or
    #     intervention". A school is at most one of the two (Recognition reasons are
    #     disjoint from the assistance tier); "Meeting/exceeding targets" etc. = neither.
    cls = soda("ppbc-i8t9", {
        "$where": "org_type='School' AND sy='2025'",
        "$select": "org_code,classification_overall,classification_reason", "$limit": "5000",
    })
    NEEDS = "Requiring assistance or intervention"
    n_rec = n_need = 0
    for r in cls:
        sid = norm(r.get("org_code"))
        if sid not in out:
            continue
        co = (r.get("classification_overall") or "").strip()
        rsn = (r.get("classification_reason") or "")
        if "Recognition" in rsn or "Distinguished" in rsn or "Blue Ribbon" in rsn:
            out[sid]["is_school_recognition"] = True; n_rec += 1
        elif co == NEEDS:
            out[sid]["is_school_needs_assistance"] = True; n_need += 1

    # 4) Chronic absenteeism — Student Attendance [ak6h-9k7x], SY2025 End-of-Year,
    #    All Students, school level. pct_chron_abs_10 is already a 0-1 fraction.
    #    (Same dataset/column fetch_absence_groups.py uses, sliced to schools.)
    cab = soda("ak6h-9k7x", {
        "$where": "org_type='School' AND stu_grp='All Students' "
                  "AND attend_period='End of Year' AND sy='2025'",
        "$select": "org_code,pct_chron_abs_10", "$limit": "5000",
    })
    n_cab = 0
    for r in cab:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_frac(r.get("pct_chron_abs_10"))) is not None:
            out[sid]["sch_chronic_absent_pct"] = round(v, 4); n_cab += 1

    # 5) Experienced-teacher share — Elementary & Secondary Teacher Data
    #    [4684-cw3t], SY2025, All Teachers, school level. exp_tchr_pct is a 0-1
    #    fraction. We pin SY2025 because exp_tchr_pct is not yet populated at
    #    school grain for SY2026 (licensure is, but experience is the metric here).
    exp = soda("4684-cw3t", {
        "$where": "org_type='School' AND subject='All Teachers' AND sy='2025'",
        "$select": "org_code,exp_tchr_pct", "$limit": "5000",
    })
    n_exp = 0
    for r in exp:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_frac(r.get("exp_tchr_pct"))) is not None:
            out[sid]["sch_teacher_experienced_pct"] = round(v, 4); n_exp += 1

    # 6) 4-year graduation rate — High School Graduation Rates [n2xa-p822],
    #    SY2025, All Students, 4-Year cohort, school level. grad_pct is a 0-1
    #    fraction. Only schools that operate a graduating cohort (high schools)
    #    report; the ~1,400 elementary/middle schools are left absent by design.
    grad = soda("n2xa-p822", {
        "$where": "org_type='School' AND stu_grp='All Students' "
                  "AND grad_rate_type='4-Year Graduation Rate' AND sy='2025'",
        "$select": "org_code,grad_pct", "$limit": "5000",
    })
    n_grad = 0
    for r in grad:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_frac(r.get("grad_pct"))) is not None:
            out[sid]["sch_grad_4yr"] = round(v, 4); n_grad += 1

    # 7) Average class size — Class Size by Gender/Race/Selected Populations
    #    [35yv-uxv5], SY2025, subj='All' (all-subjects average), school level.
    #    avg_clss_cnt is a plain count (e.g. 14.2), NOT a fraction. This is the
    #    current DESE class-size dataset (supersedes the stale 2021-22 sgr7-hhwp).
    #    A 0 / suppressed average is dropped (to_num returns None for <=0).
    cls_sz = soda("35yv-uxv5", {
        "$where": "org_type='School' AND subj='All' AND sy='2025'",
        "$select": "org_code,avg_clss_cnt", "$limit": "5000",
    })
    n_clssz = 0
    for r in cls_sz:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_num(r.get("avg_clss_cnt"))) is not None:
            out[sid]["sch_class_size"] = v; n_clssz += 1

    # 8) Share of students disciplined — Student Discipline [2kca-w7rq], SY2025,
    #    All Students, offense='All Offenses', school level. We compute the rate
    #    stu_discipl_cnt / stu_cnt (full coverage) rather than the published
    #    out/in-school suspension %, which is small-cell suppressed for most
    #    low-discipline schools. A genuine 0 disciplined (with a real enrollment)
    #    is a true 0% and kept; suppression instead shows as an empty count.
    disc = soda("2kca-w7rq", {
        "$where": "org_type='School' AND stu_grp='All Students' "
                  "AND offense='All Offenses' AND sy='2025'",
        "$select": "org_code,stu_cnt,stu_discipl_cnt", "$limit": "5000",
    })
    n_disc = 0
    for r in disc:
        sid = norm(r.get("org_code"))
        if sid not in out:
            continue
        tot = to_int(r.get("stu_cnt"))
        dc = to_int(r.get("stu_discipl_cnt"))
        if tot and dc is not None:  # tot>0 and a non-null disciplined count
            out[sid]["sch_disciplined_pct"] = round(dc / tot, 4); n_disc += 1

    # 9) MCAS Science % Meeting+Exceeding — [i9w6-niyt], SY2025, All Students,
    #    SCI subject, all-grades (03-08) band. Mirrors the ELA/Math rollup; only
    #    schools that test grades 3-8 science report.
    sci = soda("i9w6-niyt", {
        "$where": "org_type IN ('Public School','Charter School') "
                  "AND stu_grp='All Students' AND subject_code='SCI' "
                  "AND test_grade='ALL (03-08)' AND sy='2025'",
        "$select": "org_code,m_plus_e_pct", "$limit": "5000",
    })
    n_sci = 0
    for r in sci:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_frac(r.get("m_plus_e_pct"))) is not None:
            out[sid]["sch_mcas_sci_me"] = round(v, 4); n_sci += 1

    # 10) AP % of exams scoring 3+ — Advanced Placement (AP) Performance
    #     [787a-3wen], SY2025, All Students, subj_cat='All Subjects', school level.
    #     pct_3_5 is the share of AP exams scoring 3-5 (the qualifying band). Only
    #     high schools that administer AP exams report; others left absent.
    ap = soda("787a-3wen", {
        "$where": "org_type='School' AND stu_grp='All Students' "
                  "AND subj_cat='All Subjects' AND sy='2025'",
        "$select": "org_code,pct_3_5", "$limit": "5000",
    })
    n_ap = 0
    for r in ap:
        sid = norm(r.get("org_code"))
        if sid in out and (v := to_frac(r.get("pct_3_5"))) is not None:
            out[sid]["sch_ap_pct_3plus"] = round(v, 4); n_ap += 1

    # 11) Total per-pupil spending — School Expenditures by Spending Category
    #     [i5up-aez6], SY2024 (latest). The 'Total A+B+C' / 'Total Expenditures'
    #     row is each school's all-in per-pupil dollars (ind_value_type='Amount').
    #     Only schools with a school-level expenditure report publish this, so it
    #     is null for charters / non-standard orgs. A 0 / blank amount means "not
    #     reported" (no school truly spends $0/pupil), so it is treated as absent.
    spend = soda("i5up-aez6", {
        "$where": "ind_cat='Total A+B+C' AND sy='2024'",
        "$select": "org_code,ind_value", "$limit": "5000",
    })
    n_spend = 0
    for r in spend:
        sid = norm(r.get("org_code"))
        if sid not in out:
            continue
        v = to_int(r.get("ind_value"))
        if v is not None and v > 0:   # drop 0/blank "not reported"
            out[sid]["sch_per_pupil"] = v; n_spend += 1

    # Drop schools that got nothing, keep file tidy
    out = {k: v for k, v in out.items() if v}
    OUT.write_text(json.dumps(out, indent=1))
    total = len(ours)
    print(f"wrote {OUT.relative_to(REPO)} for {len(out)}/{total} schools")
    print(f"  sch_enrollment:            {n_enr}/{total} (SY2026)")
    print(f"  sch_mcas_ela_me:           {n_ela}/{total} (SY2025, grades 03-08)")
    print(f"  sch_mcas_math_me:          {n_math}/{total} (SY2025, grades 03-08)")
    print(f"  sch_mcas_ela_low_income:   {n_ela_li}/{total} (SY2025, grades 03-08, Low Income)")
    print(f"  sch_mcas_math_low_income:  {n_math_li}/{total} (SY2025, grades 03-08, Low Income)")
    print(f"  sch_mcas_g10_ela_me:       {n_g10_ela}/{total} (SY2025, grade 10)")
    print(f"  sch_mcas_g10_math_me:      {n_g10_math}/{total} (SY2025, grade 10)")
    print(f"  sch_accountability_pctile: {n_acc}/{total} (SY2025)")
    print(f"  is_school_recognition:       {n_rec}/{total} (Schools of Recognition)")
    print(f"  is_school_needs_assistance:  {n_need}/{total} (Requiring assistance/intervention)")
    print(f"  sch_chronic_absent_pct:      {n_cab}/{total} (SY2025, End-of-Year)")
    print(f"  sch_teacher_experienced_pct: {n_exp}/{total} (SY2025)")
    print(f"  sch_grad_4yr:                {n_grad}/{total} (SY2025, HS cohorts only)")
    print(f"  sch_class_size:              {n_clssz}/{total} (SY2025, avg all subjects)")
    print(f"  sch_disciplined_pct:         {n_disc}/{total} (SY2025, All Offenses)")
    print(f"  sch_mcas_sci_me:             {n_sci}/{total} (SY2025, science gr 03-08)")
    print(f"  sch_ap_pct_3plus:            {n_ap}/{total} (SY2025, HS w/ AP exams only)")
    print(f"  sch_per_pupil:               {n_spend}/{total} (SY2024, total per-pupil $)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
