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
  urls <- oc_arc_discover(oc_concord_server)
  # keep only preferred services to avoid downloading shared layers many times
  keep <- Reduce(`|`, lapply(oc_concord_preferred, function(s) grepl(s, urls, fixed = TRUE)))
  urls <- urls[keep]

  seen <- character()
  for (url in urls) {
    lyr <- oc_arc_layer(url)                      # city data: no bbox needed
    if (is.null(lyr) || nrow(lyr) == 0) next
    nm <- oc_slug(attr(lyr, "layer_name") %||% basename(url))
    if (nm %in% seen) next
    seen <- c(seen, nm)
    oc_write_layer(lyr, "city", nm, source = "City of Concord ArcGIS",
                   scope = "city", con = con)
  }
  invisible(seen)
}

#' @keywords internal
oc_slug <- function(x) {
  x <- tolower(gsub("[^A-Za-z0-9]+", "_", x))
  gsub("^_|_$", "", x)
}

`%||%` <- function(a, b) if (is.null(a) || (length(a) == 1 && is.na(a))) b else a
