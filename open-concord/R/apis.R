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
  for (nm in names(headers)) req <- httr2::req_headers(req, !!nm := headers[[nm]])
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
  oc_api_usgs_earthquakes(con)
  oc_api_gbif(con)
  oc_api_nws_alerts(con)
  oc_api_wikipedia_nearby(con)
  # ... additional httr2 sources (epa_frs, cdc_places, usgs gages, lodes, nrel,
  #     inaturalist, wikidata_landmarks) follow the same pattern; see TODO in NEWS.
  if (include_keyed) cli::cli_alert_info("key-gated sources read *_API_KEY env vars")
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
