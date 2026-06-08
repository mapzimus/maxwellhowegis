#' Open Concord configuration
#'
#' Central constants shared across the pipeline: the Concord bounding box, the
#' wider region (Concord + surrounding towns "to a small extent"), the two school
#' districts serving the city, and database connection settings (from env vars).
#'
#' @name openconcord-config
NULL

#' Concord, NH bounding box (WGS84), from the city boundary layer extent.
#' @export
oc_bbox <- function() {
  c(xmin = -71.668185, ymin = 43.151772, xmax = -71.456903, ymax = 43.309419)
}

#' Wider regional bbox: Concord + surrounding towns (Penacook, Boscawen, Loudon,
#' Bow, Hopkinton, Canterbury, Pembroke, Chichester...).
#' @export
oc_region_bbox <- function() {
  c(xmin = -71.95, ymin = 42.95, xmax = -71.30, ymax = 43.50)
}

#' City centroid (lon, lat) — used for point-anchored layers (notable people).
#' @export
oc_centroid <- function() c(lon = -71.538, lat = 43.207)

#' As an `sf` bbox in EPSG:4326 for spatial filters.
#' @param region Use the wider regional bbox instead of the city bbox.
#' @export
oc_bbox_sf <- function(region = FALSE) {
  b <- if (region) oc_region_bbox() else oc_bbox()
  sf::st_bbox(b, crs = sf::st_crs(4326))
}

#' The two districts that serve Concord (NCES LEAID == TIGER GEOID).
#' Concord School District (SAU 8) and Merrimack Valley School District (SAU 46,
#' which serves Penacook + Boscawen/Loudon/Salisbury/Webster).
#' @export
oc_school_leaids <- function() {
  c(concord = "3302460", merrimack_valley = "3304760")
}

#' Merrimack County, NH FIPS pieces.
#' @export
oc_fips <- function() list(state = "33", county = "013")

#' Wikidata entity id for Concord, New Hampshire.
#' @export
oc_concord_qid <- function() "Q28249"

#' PostGIS connection from environment variables.
#'
#' Reads PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD (libpq conventions). For
#' Supabase use the connection-pooler host/credentials from the project settings.
#' @return A live `DBI` connection (remember to `DBI::dbDisconnect()`).
#' @export
oc_connect <- function() {
  DBI::dbConnect(
    RPostgres::Postgres(),
    host     = Sys.getenv("PGHOST", "localhost"),
    port     = as.integer(Sys.getenv("PGPORT", "5432")),
    dbname   = Sys.getenv("PGDATABASE", "openconcord"),
    user     = Sys.getenv("PGUSER", "postgres"),
    password = Sys.getenv("PGPASSWORD", ""),
    sslmode  = Sys.getenv("PGSSLMODE", "prefer")
  )
}
