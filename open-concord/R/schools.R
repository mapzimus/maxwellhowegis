#' Schools: Concord SD + Merrimack Valley SD (Penacook), colleges, enrollment
#'
#' Both districts serving Concord are pulled by LEAID (full coverage incl.
#' Penacook + MVSD's surrounding towns), plus a regional bbox. Enrollment — the
#' "big database" — comes from the Urban Institute via {educationdata}.
#' Mirrors the Python `download_schools.py`.
#'
#' @name openconcord-schools
NULL

oc_nces <- list(
  public  = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Public_School_Locations_Current/FeatureServer/0",
  private = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Private_School_Locations_Current/FeatureServer/0",
  college = "https://services1.arcgis.com/Ua5sjt3LWTPigjyD/arcgis/rest/services/Postsecondary_School_Locations_Current/FeatureServer/0"
)

#' Load all school data into the `schools` schema.
#' @param con A DBI connection.
#' @param year CCD enrollment year.
#' @export
oc_load_schools <- function(con = oc_connect(), year = 2022) {
  leaids <- oc_school_leaids()
  region <- oc_bbox_sf(region = TRUE)

  # --- district boundaries (the two, by GEOID) via {tigris} ---
  sd <- tigris::school_districts(state = "NH", type = "unified", year = year, progress_bar = FALSE)
  two <- sd[sd$GEOID %in% unname(leaids), ]
  oc_write_layer(two, "schools", "school_districts", "Census TIGER", "districts", con)
  oc_write_layer(sf::st_filter(sd, sf::st_as_sfc(region)),
                 "schools", "school_districts_region", "Census TIGER", "region", con)

  # --- schools by district (full coverage incl. Penacook) ---
  where_leaid <- sprintf("LEAID IN ('%s')", paste(unname(leaids), collapse = "','"))
  oc_write_layer(oc_arc_layer(oc_nces$public, where = where_leaid),
                 "schools", "public_schools_districts", "NCES EDGE", "districts", con)
  oc_write_layer(oc_arc_layer(oc_nces$public, bbox = region),
                 "schools", "public_schools_region", "NCES EDGE", "region", con)
  oc_write_layer(oc_arc_layer(oc_nces$private, bbox = region),
                 "schools", "private_schools_region", "NCES EDGE (incl. St. Paul's)", "region", con)
  oc_write_layer(oc_arc_layer(oc_nces$college, bbox = region),
                 "schools", "colleges", "NCES IPEDS (NHTI, UNH Law)", "region", con)

  # --- enrollment "big database" via {educationdata} (db tier) ---
  oc_load_enrollment(con, year = year)
  invisible(TRUE)
}

#' CCD enrollment for both districts (district + school level) -> `db` tables.
#' @param con A DBI connection.
#' @param year CCD year.
#' @export
oc_load_enrollment <- function(con = oc_connect(), year = 2022) {
  leaids <- as.integer(unname(oc_school_leaids()))
  dist <- tryCatch(
    educationdata::get_education_data(
      level = "school-districts", source = "ccd", topic = "enrollment",
      filters = list(year = year, grade = 99, leaid = leaids),
      subtopic = c("race", "sex")),
    error = function(e) { cli::cli_alert_danger("district enrollment: {conditionMessage(e)}"); NULL })
  oc_write_table(dist, "schools", "enrollment_districts", "Urban Inst. CCD", "districts", con)

  sch <- tryCatch(
    educationdata::get_education_data(
      level = "schools", source = "ccd", topic = "enrollment",
      filters = list(year = year, grade = 99, fips = 33),
      subtopic = c("race", "sex")),
    error = function(e) { cli::cli_alert_danger("school enrollment: {conditionMessage(e)}"); NULL })
  if (!is.null(sch)) sch <- sch[sch$leaid %in% leaids, ]
  oc_write_table(sch, "schools", "enrollment_schools", "Urban Inst. CCD", "districts", con)
  invisible(TRUE)
}
