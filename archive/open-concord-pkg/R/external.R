#' Federal & state ArcGIS layers (bbox-clipped to Concord)
#'
#' Iterates the `external_arcgis` entries in the manifest, pulling each into the
#' `external` schema. Mirrors the Python `download_external.py`.
#'
#' @name openconcord-external
NULL

#' Load all configured external ArcGIS layers.
#' @param con A DBI connection.
#' @param region Use the wider regional bbox.
#' @export
oc_load_external <- function(con = oc_connect(), region = FALSE) {
  bb <- oc_bbox_sf(region = region)
  targets <- oc_sources()$external_arcgis
  for (t in targets) {
    cli::cli_h3(t$key)
    tryCatch({
      lyr <- oc_arc_layer(t$url, bbox = bb)
      oc_write_layer(lyr, "external", oc_slug(t$key),
                     source = t$title %||% "", scope = "bbox", con = con)
    }, error = function(e) {
      cli::cli_alert_danger("{t$key}: skipped ({conditionMessage(e)})")
    })
  }
  invisible(TRUE)
}
