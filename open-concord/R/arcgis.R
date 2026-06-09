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
  errored <- FALSE
  out <- tryCatch({
    lyr <- arcgislayers::arc_open(url)
    arcgislayers::arc_select(
      lyr,
      where = where,
      filter_geom = if (!is.null(bbox)) sf::st_as_sfc(bbox) else NULL,
      crs = 4326
    )
  }, error = function(e) {
    cli::cli_alert_warning("arcgislayers failed: {url} ({conditionMessage(e)})")
    errored <<- TRUE
    NULL
  })

  # Fallback: some services (e.g. the FWS NWI MapServer) break arcgislayers'
  # internal count step even though the REST endpoint paginates fine. Page the
  # /query endpoint directly. Only meaningful when a bbox bounds the request.
  if (errored && !is.null(bbox)) {
    cli::cli_alert_info("retrying via direct REST pagination")
    out <- tryCatch(
      oc_arc_layer_rest(url, bbox, where = where),
      error = function(e) {
        cli::cli_alert_danger("ArcGIS layer failed (REST fallback): {url} ({conditionMessage(e)})")
        NULL
      })
  } else if (errored) {
    cli::cli_alert_danger("ArcGIS layer failed: {url}")
  }
  out
}

#' REST pagination fallback for ArcGIS feature layers.
#'
#' Pages a layer's `/query` endpoint directly as GeoJSON, looping until a short
#' page returns (so it needs no count query — the exact step arcgislayers fails
#' on for some services). Used by [oc_arc_layer()] when the arcgislayers path
#' raises an error and a `bbox` is available to bound the request.
#'
#' @param url Layer URL ending in `/<layerId>`.
#' @param bbox An `sf` bbox (EPSG:4326) — see [oc_bbox_sf()].
#' @param where SQL filter (default all rows).
#' @param page Features per page (server caps via maxRecordCount).
#' @return An `sf` object in EPSG:4326, or `NULL` if nothing matched.
#' @keywords internal
oc_arc_layer_rest <- function(url, bbox, where = "1=1", page = 2000L) {
  b <- as.numeric(bbox)
  env <- sprintf(
    '{"xmin":%f,"ymin":%f,"xmax":%f,"ymax":%f,"spatialReference":{"wkid":4326}}',
    b[1], b[2], b[3], b[4])
  qurl <- paste0(url, "/query")
  off <- 0L
  parts <- list()
  repeat {
    resp <- httr2::request(qurl) |>
      httr2::req_url_query(
        where = where, geometry = env, geometryType = "esriGeometryEnvelope",
        spatialRel = "esriSpatialRelIntersects", inSR = "4326", outSR = "4326",
        outFields = "*", resultOffset = off, resultRecordCount = page,
        f = "geojson") |>
      httr2::req_perform()
    txt <- httr2::resp_body_string(resp)
    tf <- tempfile(fileext = ".geojson")
    writeLines(txt, tf)
    part <- tryCatch(sf::st_read(tf, quiet = TRUE), error = function(e) NULL)
    unlink(tf)
    n <- if (is.null(part)) 0L else nrow(part)
    if (n == 0L) break
    parts[[length(parts) + 1L]] <- part
    if (n < page) break          # short page => last page
    off <- off + page
  }
  if (!length(parts)) return(NULL)
  sf::st_transform(do.call(rbind, parts), 4326)
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
