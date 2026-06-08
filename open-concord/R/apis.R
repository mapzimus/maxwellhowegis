#' Non-ArcGIS APIs (Census, USGS, EPA, CDC, NWS, biodiversity, living data)
#'
#' Census/TIGER use {tidycensus}/{tigris}; biodiversity uses {rgbif}; the rest
#' use {httr2}. GeoJSON-shaped results -> `map+db`; tabular -> `db`.
#' Mirrors the Python `download_apis.py`.
#'
#' @name openconcord-apis
NULL

#' @keywords internal
oc_get_json <- function(url, headers = list()) {
  req <- httr2::request(url) |>
    httr2::req_user_agent("open-concord/1.0 (mhowe.gis@gmail.com)") |>
    httr2::req_retry(max_tries = 4) |>
    httr2::req_timeout(120)
  if (length(headers)) req <- do.call(httr2::req_headers, c(list(req), headers))
  httr2::resp_body_json(httr2::req_perform(req), simplifyVector = TRUE)
}

#' @keywords internal
oc_points_sf <- function(df, lon = "lon", lat = "lat") {
  df <- df[!is.na(df[[lon]]) & !is.na(df[[lat]]), , drop = FALSE]
  sf::st_as_sf(df, coords = c(lon, lat), crs = 4326)
}

#' Load the core + living-data API sources.
#' @param con A DBI connection.
#' @param include_keyed Also run key-gated sources (AirNow, PurpleAir, OpenAQ, FIRMS, Mapillary).
#' @export
oc_load_apis <- function(con = oc_connect(), include_keyed = FALSE) {
  oc_load_census(con)
  oc_api_epa_frs(con)
  oc_api_cdc_places(con)
  oc_api_usgs_streamgages(con)
  oc_api_lodes(con)
  oc_api_nrel_ev(con)
  oc_api_usgs_earthquakes(con)
  oc_api_gbif(con)
  oc_api_inaturalist(con)
  oc_api_nws_alerts(con)
  oc_api_wikipedia_nearby(con)
  oc_api_wikidata_landmarks(con)
  if (include_keyed) oc_load_apis_keyed(con)
  invisible(TRUE)
}

#' Key-gated API sources (read *_API_KEY / token env vars; skip if unset).
#' @param con A DBI connection.
#' @export
oc_load_apis_keyed <- function(con = oc_connect()) {
  oc_api_airnow(con); oc_api_openaq(con); oc_api_purpleair(con)
  oc_api_nasa_firms(con); oc_api_mapillary(con)
  invisible(TRUE)
}

#' ACS demographics for Merrimack County tracts via {tidycensus} (db + map join).
#' @param con A DBI connection.
#' @export
oc_load_census <- function(con = oc_connect()) {
  vars <- c(total_population = "B01003_001", median_household_income = "B19013_001",
            median_home_value = "B25077_001", median_gross_rent = "B25064_001",
            median_age = "B01002_001", housing_units = "B25001_001")
  acs <- tryCatch(
    tidycensus::get_acs(geography = "tract", variables = vars, state = "NH",
                        county = "Merrimack", year = 2023, geometry = TRUE,
                        output = "wide"),
    error = function(e) { cli::cli_alert_danger("ACS (needs CENSUS_API_KEY): {conditionMessage(e)}"); NULL })
  if (!is.null(acs)) oc_write_layer(acs, "apis", "acs_tracts", "Census ACS 2023", "county", con)
  invisible(TRUE)
}

#' USGS earthquakes within 100km of Concord (M2+ since 1900).
#' @param con A DBI connection.
#' @export
oc_api_usgs_earthquakes <- function(con = oc_connect()) {
  cc <- oc_centroid()
  url <- sprintf(paste0("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson",
                        "&latitude=%s&longitude=%s&maxradiuskm=100&minmagnitude=2&starttime=1900-01-01"),
                 cc["lat"], cc["lon"])
  eq <- tryCatch(sf::st_read(url, quiet = TRUE), error = function(e) NULL)
  oc_write_layer(eq, "apis", "usgs_earthquakes", "USGS", "100km", con)
}

#' GBIF species occurrences within the Concord bbox via {rgbif}.
#' @param con A DBI connection.
#' @export
oc_api_gbif <- function(con = oc_connect()) {
  b <- oc_bbox()
  wkt <- sprintf("POLYGON((%f %f,%f %f,%f %f,%f %f,%f %f))",
                 b["xmin"], b["ymin"], b["xmax"], b["ymin"], b["xmax"], b["ymax"],
                 b["xmin"], b["ymax"], b["xmin"], b["ymin"])
  occ <- tryCatch(
    rgbif::occ_data(geometry = wkt, hasCoordinate = TRUE, limit = 9000)$data,
    error = function(e) NULL)
  if (!is.null(occ) && nrow(occ)) {
    sfx <- oc_points_sf(as.data.frame(occ), "decimalLongitude", "decimalLatitude")
    oc_write_layer(sfx, "apis", "gbif_species", "GBIF", "bbox", con)
  }
}

#' Active NWS weather alerts for New Hampshire.
#' @param con A DBI connection.
#' @export
oc_api_nws_alerts <- function(con = oc_connect()) {
  al <- tryCatch(
    sf::st_read("https://api.weather.gov/alerts/active?area=NH", quiet = TRUE),
    error = function(e) NULL)
  oc_write_layer(al, "apis", "noaa_weather_alerts", "NWS", "state", con)
}

#' Geotagged Wikipedia articles within 10km of Concord.
#' @param con A DBI connection.
#' @export
oc_api_wikipedia_nearby <- function(con = oc_connect()) {
  cc <- oc_centroid()
  url <- sprintf(paste0("https://en.wikipedia.org/w/api.php?action=query&list=geosearch",
                        "&gscoord=%s%%7C%s&gsradius=10000&gslimit=500&format=json"),
                 cc["lat"], cc["lon"])
  d <- tryCatch(oc_get_json(url), error = function(e) NULL)
  gs <- d$query$geosearch
  if (!is.null(gs) && nrow(gs)) {
    gs$url <- paste0("https://en.wikipedia.org/?curid=", gs$pageid)
    oc_write_layer(oc_points_sf(gs), "apis", "wikipedia_articles", "Wikipedia", "10km", con)
  }
}

# --------------------------------------------------------------------------- #
# Remaining httr2 sources (parity with the Python download_apis.py)
# --------------------------------------------------------------------------- #

#' EPA FRS regulated facilities in Merrimack County, NH -> db table.
#' @param con A DBI connection.
#' @export
oc_api_epa_frs <- function(con = oc_connect()) {
  url <- paste0("https://data.epa.gov/efservice/frs.frs_program_facility/",
                "county_name/equals/MERRIMACK/state_code/equals/NH/JSON")
  recs <- tryCatch(oc_get_json(url), error = function(e) NULL)
  if (is.null(recs) || !length(recs)) return(invisible(FALSE))
  df <- as.data.frame(recs)
  agg <- stats::aggregate(pgm_sys_acrnm ~ registry_id, data = df,
                          FUN = function(x) paste(sort(unique(x)), collapse = ";"))
  meta <- df[!duplicated(df$registry_id),
             intersect(c("registry_id", "primary_name", "location_address",
                         "city_name", "postal_code", "site_type_name"), names(df))]
  out <- merge(meta, agg, by = "registry_id", all.x = TRUE)
  oc_write_table(out, "apis", "epa_frs_facilities", "EPA FRS", "county", con)
}

#' CDC PLACES tract health measures (long) for Merrimack County -> map+db points.
#' @param con A DBI connection.
#' @export
oc_api_cdc_places <- function(con = oc_connect()) {
  url <- paste0("https://data.cdc.gov/resource/cwsq-ngmh.json?",
                "stateabbr=NH&countyname=Merrimack&$limit=50000")
  recs <- tryCatch(oc_get_json(url), error = function(e) NULL)
  if (is.null(recs) || !nrow(recs)) return(invisible(FALSE))
  coords <- recs$geolocation$coordinates
  recs$lon <- vapply(coords, function(c) if (length(c)) c[[1]] else NA_real_, numeric(1))
  recs$lat <- vapply(coords, function(c) if (length(c)) c[[2]] else NA_real_, numeric(1))
  recs$geolocation <- NULL
  oc_write_layer(oc_points_sf(recs), "apis", "cdc_places", "CDC PLACES", "county", con)
}

#' USGS NWIS active stream sites in Merrimack County -> map+db points.
#' @param con A DBI connection.
#' @export
oc_api_usgs_streamgages <- function(con = oc_connect()) {
  rdb <- tryCatch(
    httr2::resp_body_string(httr2::req_perform(httr2::request(paste0(
      "https://waterservices.usgs.gov/nwis/site/?format=rdb",
      "&countyCd=33013&siteType=ST&hasDataTypeCd=iv")))),
    error = function(e) NULL)
  if (is.null(rdb)) return(invisible(FALSE))
  lines <- grep("^#", strsplit(rdb, "\n")[[1]], value = TRUE, invert = TRUE)
  lines <- lines[nzchar(lines)]
  hdr <- strsplit(lines[1], "\t")[[1]]
  body <- lines[-(1:2)]                                  # drop header + type row
  df <- do.call(rbind, lapply(body, function(l) strsplit(l, "\t")[[1]]))
  df <- as.data.frame(df, stringsAsFactors = FALSE); names(df) <- hdr
  df$lon <- as.numeric(df$dec_long_va); df$lat <- as.numeric(df$dec_lat_va)
  oc_write_layer(oc_points_sf(df), "apis", "usgs_streamgages", "USGS NWIS", "county", con)
}

#' LEHD LODES8 NH workplace jobs (2023) -> db table.
#' @param con A DBI connection.
#' @export
oc_api_lodes <- function(con = oc_connect()) {
  url <- "https://lehd.ces.census.gov/data/lodes/LODES8/nh/wac/nh_wac_S000_JT00_2023.csv.gz"
  tmp <- tempfile(fileext = ".csv.gz")
  ok <- tryCatch({ utils::download.file(url, tmp, quiet = TRUE); TRUE },
                 error = function(e) FALSE)
  if (!ok) return(invisible(FALSE))
  df <- utils::read.csv(gzfile(tmp), colClasses = c(w_geocode = "character"))
  oc_write_table(df, "apis", "lodes_wac_2023", "LEHD LODES8", "state", con)
}

#' NREL AFDC EV charging stations within 25 mi of Concord -> map+db points.
#' @param con A DBI connection.
#' @export
oc_api_nrel_ev <- function(con = oc_connect()) {
  cc <- oc_centroid(); key <- Sys.getenv("NREL_API_KEY", "DEMO_KEY")
  url <- sprintf(paste0("https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.geojson",
                        "?api_key=%s&latitude=%s&longitude=%s&radius=25&fuel_type=ELEC&limit=200"),
                 key, cc["lat"], cc["lon"])
  ev <- tryCatch(sf::st_read(url, quiet = TRUE), error = function(e) NULL)
  oc_write_layer(ev, "apis", "ev_charging_stations", "NREL AFDC", "25mi", con)
}

#' iNaturalist research-grade observations in the Concord bbox -> map+db points.
#' @param con A DBI connection.
#' @export
oc_api_inaturalist <- function(con = oc_connect()) {
  b <- oc_bbox(); feats <- list()
  for (page in 1:15) {
    url <- sprintf(paste0("https://api.inaturalist.org/v1/observations?swlat=%f&swlng=%f",
                          "&nelat=%f&nelng=%f&geo=true&per_page=200&page=%d"),
                   b["ymin"], b["xmin"], b["ymax"], b["xmax"], page)
    d <- tryCatch(oc_get_json(url), error = function(e) NULL)
    if (is.null(d) || !length(d$results) || !NROW(d$results)) break
    res <- d$results
    coords <- res$geojson$coordinates
    res$lon <- vapply(coords, function(c) if (length(c)) c[[1]] else NA_real_, numeric(1))
    res$lat <- vapply(coords, function(c) if (length(c)) c[[2]] else NA_real_, numeric(1))
    feats[[page]] <- data.frame(species = res$taxon$name %||% NA,
                                observed_on = res$observed_on %||% NA,
                                uri = res$uri %||% NA, lon = res$lon, lat = res$lat,
                                stringsAsFactors = FALSE)
    if (NROW(res) < 200) break
  }
  df <- do.call(rbind, feats)
  if (!is.null(df) && nrow(df)) oc_write_layer(oc_points_sf(df), "apis",
    "inaturalist", "iNaturalist", "bbox", con)
}

#' Wikidata items with coordinates in the Concord bbox -> map+db points.
#' @param con A DBI connection.
#' @export
oc_api_wikidata_landmarks <- function(con = oc_connect()) {
  b <- oc_bbox()
  q <- sprintf("SELECT ?item ?itemLabel ?coord WHERE {
      SERVICE wikibase:box { ?item wdt:P625 ?coord.
        bd:serviceParam wikibase:cornerSouthWest 'Point(%f %f)'^^geo:wktLiteral.
        bd:serviceParam wikibase:cornerNorthEast 'Point(%f %f)'^^geo:wktLiteral. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. } }",
    b["xmin"], b["ymin"], b["xmax"], b["ymax"])
  df <- tryCatch(WikidataQueryServiceR::query_wikidata(q), error = function(e) NULL)
  if (is.null(df) || !nrow(df)) return(invisible(FALSE))
  m <- regmatches(df$coord, regexec("Point\\(([-0-9.]+) ([-0-9.]+)\\)", df$coord))
  df$lon <- as.numeric(vapply(m, function(x) if (length(x) == 3) x[2] else NA, character(1)))
  df$lat <- as.numeric(vapply(m, function(x) if (length(x) == 3) x[3] else NA, character(1)))
  oc_write_layer(oc_points_sf(df), "apis", "wikidata_landmarks", "Wikidata", "bbox", con)
}

# --- key-gated (skip silently if the env var is unset) ---

#' @keywords internal
oc_api_airnow <- function(con = oc_connect()) {
  key <- Sys.getenv("AIRNOW_API_KEY"); if (!nzchar(key)) return(invisible(FALSE))
  cc <- oc_centroid()
  url <- sprintf(paste0("https://www.airnowapi.org/aq/observation/latLong/current/",
                        "?format=application/json&latitude=%s&longitude=%s&distance=25&API_KEY=%s"),
                 cc["lat"], cc["lon"], key)
  d <- tryCatch(oc_get_json(url), error = function(e) NULL)
  if (!is.null(d) && nrow(d)) { d$lon <- d$Longitude; d$lat <- d$Latitude
    oc_write_layer(oc_points_sf(d), "apis", "airnow_aqi", "EPA AirNow", "25mi", con) }
}

#' @keywords internal
oc_api_openaq <- function(con = oc_connect()) {
  key <- Sys.getenv("OPENAQ_API_KEY"); if (!nzchar(key)) return(invisible(FALSE))
  b <- oc_bbox()
  url <- sprintf("https://api.openaq.org/v3/locations?bbox=%f,%f,%f,%f&limit=1000",
                 b["xmin"], b["ymin"], b["xmax"], b["ymax"])
  d <- tryCatch(oc_get_json(url, list(`X-API-Key` = key)), error = function(e) NULL)
  res <- d$results
  if (!is.null(res) && nrow(res)) { res$lon <- res$coordinates$longitude
    res$lat <- res$coordinates$latitude
    oc_write_layer(oc_points_sf(res), "apis", "openaq", "OpenAQ", "bbox", con) }
}

#' @keywords internal
oc_api_purpleair <- function(con = oc_connect()) {
  key <- Sys.getenv("PURPLEAIR_API_KEY"); if (!nzchar(key)) return(invisible(FALSE))
  b <- oc_bbox()
  url <- sprintf(paste0("https://api.purpleair.com/v1/sensors?fields=name,latitude,longitude,",
                        "pm2.5,pm2.5_60minute&nwlng=%f&nwlat=%f&selng=%f&selat=%f"),
                 b["xmin"], b["ymax"], b["xmax"], b["ymin"])
  d <- tryCatch(oc_get_json(url, list(`X-API-Key` = key)), error = function(e) NULL)
  if (is.null(d$data)) return(invisible(FALSE))
  df <- as.data.frame(d$data, stringsAsFactors = FALSE); names(df) <- d$fields
  df$lon <- as.numeric(df$longitude); df$lat <- as.numeric(df$latitude)
  oc_write_layer(oc_points_sf(df), "apis", "purpleair", "PurpleAir", "bbox", con)
}

#' @keywords internal
oc_api_nasa_firms <- function(con = oc_connect()) {
  key <- Sys.getenv("FIRMS_MAP_KEY"); if (!nzchar(key)) return(invisible(FALSE))
  b <- oc_bbox()
  url <- sprintf("https://firms.modaps.eosdis.nasa.gov/api/area/csv/%s/VIIRS_SNPP_NRT/%f,%f,%f,%f/7",
                 key, b["xmin"], b["ymin"], b["xmax"], b["ymax"])
  df <- tryCatch(utils::read.csv(url), error = function(e) NULL)
  if (!is.null(df) && nrow(df)) oc_write_layer(oc_points_sf(df, "longitude", "latitude"),
    "apis", "nasa_firms", "NASA FIRMS", "bbox", con)
}

#' @keywords internal
oc_api_mapillary <- function(con = oc_connect()) {
  tok <- Sys.getenv("MAPILLARY_TOKEN"); if (!nzchar(tok)) return(invisible(FALSE))
  b <- oc_bbox()
  url <- sprintf(paste0("https://graph.mapillary.com/images?access_token=%s",
                        "&bbox=%f,%f,%f,%f&fields=id,captured_at,compass_angle,geometry&limit=2000"),
                 tok, b["xmin"], b["ymin"], b["xmax"], b["ymax"])
  d <- tryCatch(oc_get_json(url), error = function(e) NULL)
  res <- d$data
  if (is.null(res) || !NROW(res)) return(invisible(FALSE))
  coords <- res$geometry$coordinates
  res$lon <- vapply(coords, function(c) c[[1]], numeric(1))
  res$lat <- vapply(coords, function(c) c[[2]], numeric(1))
  res$geometry <- NULL
  oc_write_layer(oc_points_sf(res), "apis", "mapillary", "Mapillary", "bbox", con)
}
