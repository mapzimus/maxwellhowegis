#' ArcGIS REST helpers (via {arcgislayers})
#'
#' `arcgislayers::arc_read()` handles pagination and returns `sf`, so the Python
#' `arcgis_to_geojson.py` engine collapses to a thin wrapper here.
#'
#' @name openconcord-arcgis
NULL

#' Read an ArcGIS REST feature/map layer as `sf`, optionally clipped to a bbox.
#'
#' @param url Full layer URL ending in `/<layerId>`.
#' @param bbox Optional `sf` bbox (EPSG:4326) spatial filter; see [oc_bbox_sf()].
#' @param where SQL filter (default all rows).
#' @return An `sf` object in EPSG:4326, or `NULL` on failure.
#' @export
oc_arc_layer <- function(url, bbox = NULL, where = "1=1") {
  out <- tryCatch({
    lyr <- arcgislayers::arc_open(url)
    res <- arcgislayers::arc_select(
      lyr,
      where = where,
      filter_geom = if (!is.null(bbox)) sf::st_as_sfc(bbox) else NULL,
      crs = 4326
    )
    res
  }, error = function(e) {
    cli::cli_alert_danger("ArcGIS layer failed: {url} ({conditionMessage(e)})")
    NULL
  })
  out
}

#' List folders / services / layers under an ArcGIS REST server (for discovery).
#' @param base REST services root (no trailing slash).
#' @return Character vector of layer URLs.
#' @keywords internal
oc_arc_discover <- function(base) {
  get_json <- function(u) jsonlite::fromJSON(paste0(u, "?f=json"))
  root <- get_json(base)
  folders <- c("", root$folders)
  layer_urls <- character()
  for (folder in folders) {
    svc_url <- if (nzchar(folder)) paste0(base, "/", folder) else base
    svcs <- tryCatch(get_json(svc_url)$services, error = function(e) NULL)
    if (is.null(svcs) || !length(svcs)) next
    for (i in seq_len(nrow(svcs))) {
      nm <- svcs$name[i]; ty <- svcs$type[i]
      if (!ty %in% c("MapServer", "FeatureServer")) next
      service_url <- paste0(base, "/", nm, "/", ty)
      lyrs <- tryCatch(get_json(paste0(service_url, "/layers"))$layers,
                       error = function(e) NULL)
      if (is.null(lyrs) || !length(lyrs)) next
      vect <- lyrs$geometryType %in% c(
        "esriGeometryPoint", "esriGeometryMultipoint",
        "esriGeometryPolyline", "esriGeometryPolygon")
      for (j in which(vect)) {
        layer_urls <- c(layer_urls, paste0(service_url, "/", lyrs$id[j]))
      }
    }
  }
  unique(layer_urls)
}
