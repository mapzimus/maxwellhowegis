#' OpenStreetMap themes via {osmdata}
#'
#' Pulls themed Overpass extracts for the Concord bbox into the `osm` schema.
#' Mirrors the Python `download_osm.py`.
#'
#' @name openconcord-osm
NULL

oc_osm_themes <- list(
  roads = list(key = "highway"), buildings = list(key = "building"),
  waterways = list(key = "waterway"), landuse = list(key = "landuse"),
  amenities = list(key = "amenity"), leisure = list(key = "leisure"),
  railways = list(key = "railway"), power = list(key = "power"),
  shops = list(key = "shop")
)

#' Load all OSM themes.
#' @param con A DBI connection.
#' @export
oc_load_osm <- function(con = oc_connect()) {
  b <- oc_bbox()
  q0 <- osmdata::opq(bbox = c(b["xmin"], b["ymin"], b["xmax"], b["ymax"]))
  for (theme in names(oc_osm_themes)) {
    cli::cli_h3(theme)
    tryCatch({
      res <- osmdata::osmdata_sf(osmdata::add_osm_feature(q0, key = oc_osm_themes[[theme]]$key))
      # combine points + lines + polygons into one layer per theme
      geom <- oc_osm_combine(res)
      oc_write_layer(geom, "osm", theme, paste0("OSM ", oc_osm_themes[[theme]]$key), "bbox", con)
    }, error = function(e) cli::cli_alert_danger("osm {theme}: skipped ({conditionMessage(e)})"))
  }
  invisible(TRUE)
}

#' @keywords internal
oc_osm_combine <- function(res) {
  parts <- list(res$osm_points, res$osm_lines, res$osm_polygons)
  parts <- Filter(function(x) !is.null(x) && nrow(x) > 0, parts)
  if (!length(parts)) return(NULL)
  # Reduce every part to a common (name, geometry) schema so the heterogeneous
  # point/line/polygon tag columns rbind cleanly. Some parts (e.g. unnamed nodes)
  # carry no `name` column at all, so synthesize an NA one before selecting —
  # otherwise x["name"] errors with "undefined columns selected".
  do.call(rbind, lapply(parts, function(x) {
    if (!"name" %in% names(x)) x[["name"]] <- NA_character_
    x["name"]
  }))
}

#' Every-business point layer (comprehensive OSM commercial tags).
#' Overture Places is added separately via [oc_load_overture()].
#' @param con A DBI connection.
#' @export
oc_load_businesses_osm <- function(con = oc_connect()) {
  b <- oc_bbox()
  q <- osmdata::opq(bbox = c(b["xmin"], b["ymin"], b["xmax"], b["ymax"]))
  feats <- list()
  for (k in c("shop", "office", "craft", "amenity", "tourism", "healthcare")) {
    r <- tryCatch(osmdata::osmdata_sf(osmdata::add_osm_feature(q, key = k)),
                  error = function(e) NULL)
    if (!is.null(r)) feats[[k]] <- tryCatch(oc_osm_combine(r), error = function(e) NULL)
  }
  feats <- Filter(Negate(is.null), feats)
  biz <- if (length(feats)) do.call(rbind, feats) else NULL
  oc_write_layer(biz, "business", "osm_businesses", "OpenStreetMap", "bbox", con)
}
