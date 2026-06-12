# Gap backlog — "can a person prove a problem at their school?"

From the user-problem sweep (a parent/community member arrives worried about a specific
issue and wants to back it with data). Tracks what's closed and what remains, with *why*.
The atlas is strong for district-level equity/funding/outcomes questions; the gaps below
are mostly **school-specific granularity** and **relatable topics with no open data source**.

## ✅ Closed (this session — PR "gap-closeout")
- **School-level depth** — the #1 gap. The per-school click popup now adds **class size,
  students-disciplined rate, Gr3-8 Science MCAS, and AP % 3+** to the ~9 existing fields
  (`fetch_school_metrics.py` → `ma_school_metrics.json`). Most real problems are about one
  school, so this is the highest-leverage fix.
- **Underserved subgroups** — MCAS Gr3-8 by **Military-connected / Foster Care / Homeless**
  (new category "Achievement by group (other)"). DESE-suppressed/sparse but real — the
  families most often invisible in the data can now see themselves.
- **Finance categories** — per-pupil **Professional Development** + **Other Teaching Services**.

## ⛔ Blocked — no queryable open (DESE Socrata) source
| Gap (the user problem) | Why blocked | Where the data lives (out of scope) |
|---|---|---|
| Athletics / sports ("is there a team?") | Not DESE; no open API | MIAA — membership/eligibility, not open data |
| Facilities — building age/condition/overcrowding/capacity | Not on DESE Socrata | MSBA capital pipeline (project-level, not a metric) |
| Classroom devices / 1:1 / school connectivity | Only federal ECF/E-rate (`i5j4-3rvr`), messy, not clean per-district | FCC ECF, NCES — federal, lagged |
| Educator **vacancies** / unfilled positions / long-term subs | No DESE open dataset | DESE collects internally; not published openly |
| **World-language %** / **PE %** enrollment | No DESE course-taking dataset (only Arts `w3f3-phkq` + DLCS `fbdq-3q4d` exist) | — |
| Free/reduced lunch / meals participation | Federal/messy; **low-income % already proxies it** | USDA/NCES; DESE low-income is the working proxy |
| **Migrant**-student achievement | DESE suppresses to ~4 districts — not mappable | inherent small-n suppression |

## 🎯 Partially feasible (deferred, NOT blocked — buildable later)
- **Transportation / food-services spending** — DESE publishes these only as **total dollars**
  in a function-code report (different units), not per-pupil in `er3w-dyti`. Buildable by
  fetching the totals report and normalizing by enrollment. Medium effort. (This is the only
  angle on the "buses" question; bus-ride length / route data isn't published per-district.)
- **School-level subgroups** — MCAS by race/income *at the school level* (`i9w6-niyt` has
  `org_type='Public School'` × `stu_grp`). Would deepen the school popup further. Feasible.
- **School-level finance / class-size by grade** — not published per-school by DESE.

## 💡 Future UX (not data gaps — turn coverage into clarity)
- **Problem-oriented entry**: "I'm worried about → [bullying / class size / college / spending]"
  → jump to the relevant metric(s). 324 metrics is a lot; guide non-experts to the right one.
- **Per-school "report card"** — one readable card synthesizing a school's stats, vs the
  metric-by-metric choropleth. Pairs naturally with the deepened school layer above.
- Peer comparison: "similar districts" already shipped (#87); **school-level** peer comparison
  is still open.

## Source-discovery notes (so the next session doesn't re-spike)
- DESE Education-to-Career Socrata domain `educationtocareer.data.mass.gov` **federates other
  states' data** — catalog searches return Vermont/Maryland/WA/LAPD noise. Filter to real
  MA-DESE datasets.
- School-level rows: `i9w6-niyt` (MCAS) uses `org_type IN ('Public School','Charter School')`;
  most DESE reports carry an `org_type='School'` grain keyed by `org_code` (= atlas `SCHID`).
- Current class-size-by-school dataset is `35yv-uxv5` (not the catalog's stale `sgr7-hhwp`).
