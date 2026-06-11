#' City of Concord ArcGIS layers
#'
#' Auto-discovers every queryable vector layer on the city server and loads each
#' into the `city` PostGIS schema. Mirrors the Python `download_concord.py`.
#'
#' @name openconcord-concord
NULL

oc_concord_server <- "https://gis.concordnh.gov/arc1061/rest/services"

# Richest services first; dedupe shared layers (Property/Zoning) by name.
oc_concord_preferred <- c(
  "CityGeneral/WaterSystemGIS", "Public/SewerSystemGISBeta", "Public/PubWebGIS2020",
  "CityGeneral/CurrentUse", "CityGeneral/ParcelDimensions", "CityGeneral/RoadCenterlineQuery",
  "CityGeneral/WasteCollectionCustomers", "GSDField/BackflowInspection",
  "GSDField/DrainMainJetting", "GSDField/IrrigationInspection",
  "GSDField/SidewalkPlowing", "GSDField/UtilityInspection")

#' Download all city layers into the `city` schema.
#' @param con A DBI connection.
#' @export
oc_load_concord <- function(con = oc_connect()) {
  disc <- oc_arc_discover(oc_concord_server)
  if (!nrow(disc)) {
    cli::cli_alert_danger("city server: no layers discovered")
    return(invisible(character()))
  }

  # Keep only layers under a preferred service; rank by preferred-list order
  # (richest services first) so the dedup-by-name below keeps the best copy.
  pref_idx <- vapply(disc$url, function(u) {
    hit <- which(vapply(oc_concord_preferred, function(s) grepl(s, u, fixed = TRUE), logical(1)))
    if (length(hit)) hit[1] else NA_integer_
  }, integer(1), USE.NAMES = FALSE)
  keep <- !is.na(pref_idx)
  disc <- disc[keep, , drop = FALSE]
  disc <- disc[order(pref_idx[keep]), , drop = FALSE]

  # Name tables by the layer's real name (NOT its numeric id), and dedup shared
  # layers BEFORE downloading so big shared layers aren't fetched repeatedly.
  disc$slug <- vapply(disc$name, oc_slug, character(1))
  disc <- disc[nzchar(disc$slug) & !duplicated(disc$slug), , drop = FALSE]
  cli::cli_alert_info("city: {nrow(disc)} unique layers to load")

  seen <- character()
  for (i in seq_len(nrow(disc))) {
    cli::cli_h3("{disc$slug[i]}  ({disc$name[i]})")
    tryCatch({
      # Per-layer elapsed cap: a hanging or pathologically large layer (e.g. a
      # dense Contours layer) becomes a graceful skip instead of stalling the run.
      setTimeLimit(elapsed = 240, transient = TRUE)
      lyr <- oc_arc_layer(disc$url[i])            # city data: no bbox needed
      if (is.null(lyr) || nrow(lyr) == 0) {
        cli::cli_alert_warning("{disc$slug[i]}: 0 features, skipping")
      } else {
        oc_write_layer(lyr, "city", disc$slug[i], source = "City of Concord ArcGIS",
                       scope = "city", con = con)
        seen <- c(seen, disc$slug[i])
      }
    }, error = function(e) cli::cli_alert_danger("{disc$slug[i]}: skipped ({conditionMessage(e)})"))
    setTimeLimit()  # clear the per-layer cap before the next iteration
  }
  invisible(seen)
}

#' @keywords internal
oc_slug <- function(x) {
  x <- tolower(gsub("[^A-Za-z0-9]+", "_", x))
  gsub("^_|_$", "", x)
}

`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a))) b else a
