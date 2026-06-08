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
    res <- tryCatch(
      osmdata::osmdata_sf(osmdata::add_osm_feature(q0, key = oc_osm_themes[[theme]]$key)),
      error = function(e) NULL)
    if (is.null(res)) next
    # combine points + lines + polygons into one layer per theme
    geom <- oc_osm_combine(res)
    oc_write_layer(geom, "osm", theme, paste0("OSM ", oc_osm_themes[[theme]]$key), "bbox", con)
  }
  invisible(TRUE)
}

#' @keywords internal
oc_osm_combine <- function(res) {
  parts <- list(res$osm_points, res$osm_lines, res$osm_polygons)
  parts <- Filter(function(x) !is.null(x) && nrow(x) > 0, parts)
  if (!length(parts)) return(NULL)
  # keep only named features to reduce noise on point layers
  do.call(rbind, lapply(parts, function(x) x["name"]))
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
    if (!is.null(r)) feats[[k]] <- oc_osm_combine(r)
  }
  feats <- Filter(Negate(is.null), feats)
  biz <- if (length(feats)) do.call(rbind, feats) else NULL
  oc_write_layer(biz, "business", "osm_businesses", "OpenStreetMap", "bbox", con)
}
