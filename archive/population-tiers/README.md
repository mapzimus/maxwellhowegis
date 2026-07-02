# US + Puerto Rico + Canada — Towns ≥ 25,000 (Population Tiers)

A deduplicated list of every municipality in the **United States, Puerto Rico, and
Canada** with a population of **25,000 or more**, classified into two tiers:

| Tier | Definition | Count |
|---|---|---:|
| **Tier 1** (contender) | Population **≥ 100,000** | **403** |
| **Tier 2** | Population **25,000 – 99,999** | **1,502** |
| **Total** | ≥ 25,000 | **1,905** |

Breakdown by country:

| Country | Tier 1 | Tier 2 | Total |
|---|---:|---:|---:|
| United States (50 states + DC) | 342 | 1,337 | 1,679 |
| Puerto Rico | 5 | 42 | 47 |
| Canada | 56 | 123 | 179 |

> Tier 1 is a *contender* label. Where many 100k+ cities cluster tightly (greater Los
> Angeles being the extreme case), you may want to demote some back to Tier 2. The
> **cluster analysis** below is built to support exactly that decision.

## Files

| File | What it is |
|---|---|
| `towns.csv` | The list — one row per municipality, sorted by population (desc). |
| `towns.geojson` | Same data as point features (WGS84), ready to drop into a map / QGIS. |
| `build.py` | Reproducible build script. Documents every source URL and every rule. |

### Columns

`name`, `official_name`, `state` (USPS / province code), `country` (US / CA),
`population`, `pop_year`, `tier` (1 / 2), `type`, `geoid`, `lat`, `lon`, `coord_source`.

## Sources & vintages

| Region | Source | Vintage |
|---|---|---|
| US (50 states + DC) | Census Bureau **Vintage 2024 Subcounty Population Estimates** (`POPESTIMATE2024`) | 2024 est. |
| Puerto Rico | **2020 Decennial Census** municipio (county-equivalent) counts | 2020 |
| Canada | **Statistics Canada 2021 Census**, population & dwelling counts, census subdivisions (table 98‑10‑0002) | 2021 |
| Coordinates | US Census **2024 Gazetteer** (places / county subdivisions / counties); **GeoNames** and curated seats for Canada | — |

Puerto Rico uses the 2020 Census because the Census Bureau does not publish PR
municipio figures in the annual (2020s) Population Estimates program. Canada uses the
2021 Census (the most recent full count). So the three regions are **not the same
vintage** — fine for tiering, worth knowing if you compare exact numbers across borders.

## What counts as a "town" (the decisions that matter)

This is the part where "every town" needs a definition. The rules below were chosen to
be complete without double-counting; all are reproduced exactly in `build.py`.

1. **US incorporated places** (Census SUMLEV 162) — the standard "US cities" universe:
   cities, towns, villages, boroughs (~1,600 of the rows).
2. **Consolidated cities** (Indianapolis, Louisville, Nashville, Augusta, Athens, Milford
   CT, Butte‑Silver Bow) are included at their **"(balance)"** figure — the population
   *not* already inside a separately-listed sub-city. This matches the standard
   Census/Wikipedia convention and prevents double-counting (e.g. Louisville's balance is
   641k; the 794k "metro government" total is skipped because its sub-cities like
   Jeffersontown are listed on their own rows).
3. **New England towns** (CT, ME, MA, NH, RI, VT) — included as town-level municipalities
   (Census county subdivisions, SUMLEV 061, active). In these six states the *town* is the
   general-purpose government and there are no incorporated places nested inside it, so
   there is no double-count. This is why **Brookline MA (64k), Greenwich CT, West Hartford,
   Plymouth MA** etc. appear. 73 New England towns qualify.
4. **Puerto Rico municipios** — the 78 county-equivalent municipalities; 47 are ≥ 25k.
5. **Canada census subdivisions** (CSDs) — municipalities (cities, towns, villages,
   townships, etc.). Two BC name collisions are disambiguated: *Langley (City)* vs
   *Langley (Township)*, *North Vancouver (City)* vs *North Vancouver (District)*.

### Deliberately excluded (ask if you want them)

- **New York State "towns"** (Hempstead ~790k, Brookhaven, Islip, Oyster Bay…) and
  **Michigan charter townships** (Clinton, Canton, Macomb…). These are Census
  minor civil divisions that *contain separately-incorporated villages/cities already on
  this list*, so adding them would double-count population. New England towns don't have
  that problem, which is the principled line drawn here. If you want NY towns / MI
  townships added anyway, it's a one-line change in `build.py`.
- Unincorporated Census-designated places (CDPs) — not municipalities.

## Tier-1 cluster analysis (the "LA problem")

Tier-1 cities (≥100k) grouped into clusters where 3+ of them chain together within
**35 km** of a neighbor. Use this to decide which clusters to partially demote to Tier 2.
Greater LA alone has **41** Tier-1 cities; the Bay Area, DFW, and Toronto are the next
densest.

| Metro cluster (anchor) | # Tier-1 | Cities, largest first |
|---|---:|---|
| **Los Angeles, CA** | 41 | Los Angeles (3878k), Long Beach (450k), Anaheim (344k), Riverside (323k), Irvine (318k), Santa Ana (316k), Santa Clarita (229k), San Bernardino (224k), Fontana (218k), Moreno Valley (213k), Oxnard (200k), Huntington Beach (193k), Glendale (187k), Ontario (185k), Rancho Cucamonga (176k), Garden Grove (172k), Oceanside (170k), Corona (161k), Escondido (148k), Pomona (147k), Victorville (140k), Fullerton (140k), Torrance (139k), Orange (137k), Pasadena (137k), Simi Valley (125k), Thousand Oaks (124k), Menifee (117k), Carlsbad (113k), Murrieta (112k), Temecula (112k), San Buenaventura (Ventura) (109k), Downey (109k), Costa Mesa (109k), Jurupa Valley (108k), West Covina (106k), Rialto (104k), El Monte (104k), Burbank (103k), Inglewood (102k), Hesperia (101k) |
| **Toronto, ON** | 19 | Toronto (2794k), Mississauga (717k), Brampton (656k), Hamilton (569k), Markham (338k), Vaughan (323k), Kitchener (256k), Oakville (213k), Richmond Hill (202k), Burlington (186k), Oshawa (175k), Guelph (143k), Whitby (138k), Cambridge (138k), Milton (132k), Ajax (126k), Waterloo (121k), Brantford (104k), Clarington (101k) |
| **Dallas, TX** | 15 | Dallas (1326k), Fort Worth (1008k), Arlington (403k), Plano (293k), Irving (258k), Garland (250k), Frisco (235k), McKinney (227k), Grand Prairie (207k), Denton (165k), Mesquite (150k), Lewisville (135k), Carrollton (135k), Richardson (118k), Allen (113k) |
| **San Jose, CA** | 15 | San Jose (997k), Oakland (443k), Fremont (228k), Hayward (158k), Sunnyvale (156k), Santa Clara (133k), Concord (124k), Vallejo (123k), Fairfield (122k), Berkeley (121k), Antioch (118k), Richmond (115k), Vacaville (103k), San Mateo (103k), Daly City (101k) |
| **Miami, FL** | 13 | Miami (487k), Hialeah (235k), Fort Lauderdale (190k), Pembroke Pines (179k), Hollywood (159k), Miramar (143k), Coral Springs (140k), Pompano Beach (118k), Miami Gardens (116k), Davie (112k), Boca Raton (102k), Plantation (100k), Sunrise (100k) |
| **Phoenix, AZ** | 11 | Phoenix (1673k), Mesa (517k), Gilbert (288k), Chandler (281k), Glendale (258k), Scottsdale (246k), Peoria (199k), Tempe (190k), Surprise (167k), Goodyear (118k), Buckeye (114k) |
| **New York, NY** | 10 | New York (8478k), Newark (317k), Jersey City (302k), Yonkers (211k), Paterson (160k), Bridgeport (151k), Elizabeth (140k), Stamford (139k), New Haven (137k), Waterbury (115k) |
| **Denver, CO** | 8 | Denver (729k), Aurora (403k), Lakewood (156k), Thornton (146k), Arvada (121k), Westminster (115k), Centennial (108k), Boulder (106k) |
| **Vancouver, BC** | 8 | Vancouver (662k), Surrey (568k), Burnaby (249k), Richmond (209k), Abbotsford (153k), Coquitlam (148k), Langley (Township) (132k), Delta (108k) |
| **Seattle, WA** | 6 | Seattle (780k), Tacoma (228k), Bellevue (154k), Kent (136k), Renton (105k), Federal Way (100k) |
| **Boston, MA** | 6 | Boston (673k), Cambridge (121k), Lowell (120k), Brockton (105k), Lynn (103k), Quincy (103k) |
| **Kansas City, MO** | 6 | Kansas City (516k), Overland Park (202k), Kansas City (156k), Olathe (149k), Independence (121k), Lee's Summit (106k) |
| **Virginia Beach, VA** | 6 | Virginia Beach (454k), Chesapeake (254k), Norfolk (231k), Newport News (183k), Hampton (137k), Suffolk (103k) |
| **Houston, TX** | 5 | Houston (2390k), Pasadena (149k), Pearland (129k), League City (118k), Sugar Land (109k) |
| **Detroit, MI** | 5 | Detroit (645k), Windsor (229k), Warren (137k), Sterling Heights (134k), Dearborn (106k) |
| **Montréal, QC** | 4 | Montréal (1762k), Laval (438k), Longueuil (254k), Terrebonne (119k) |
| **Portland, OR** | 4 | Portland (635k), Vancouver (198k), Gresham (111k), Hillsboro (110k) |
| **San Juan, PR** | 4 | San Juan (342k), Bayamón (185k), Carolina (154k), Caguas (127k) |
| **Aurora, IL** | 4 | Aurora (180k), Naperville (153k), Joliet (151k), Elgin (114k) |
| **San Diego, CA** | 3 | San Diego (1404k), Chula Vista (278k), El Cajon (103k) |
| **Austin, TX** | 3 | Austin (993k), Round Rock (135k), Georgetown (101k) |
| **Indianapolis, IN** | 3 | Indianapolis (891k), Fishers (103k), Carmel (103k) |
| **Las Vegas, NV** | 3 | Las Vegas (678k), Henderson (350k), North Las Vegas (294k) |
| **Sacramento, CA** | 3 | Sacramento (535k), Elk Grove (182k), Roseville (163k) |
| **Atlanta, GA** | 3 | Atlanta (520k), South Fulton (112k), Sandy Springs (105k) |
| **Raleigh, NC** | 3 | Raleigh (499k), Durham (301k), Cary (182k) |
| **Tampa, FL** | 3 | Tampa (414k), St. Petersburg (267k), Clearwater (116k) |
| **Greensboro, NC** | 3 | Greensboro (307k), Winston-Salem (255k), High Point (118k) |
| **Boise City, ID** | 3 | Boise City (237k), Meridian (139k), Nampa (117k) |
| **Salt Lake City, UT** | 3 | Salt Lake City (217k), West Valley City (138k), West Jordan (116k) |

**30** multi-city Tier-1 clusters (3+ cities chained within 35 km); **163** Tier-1 cities stand alone.

_Distances are straight-line between municipal representative points. Re-run
`build.py`'s clustering block with a different radius to taste._

## Reproducing

```bash
# from this directory, with the source files downloaded into ./data/ (URLs in build.py)
python3 build.py       # writes towns.csv and towns.geojson
```

`build.py` reads from a local `./data/` folder; the exact download URLs for every source
file are listed at the top of the script. Raw source files (the 7 MB Census estimates
file, gazetteers, etc.) are intentionally not committed.
