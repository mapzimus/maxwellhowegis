#' Overture Maps Places (every business) via {duckdb}
#'
#' The dense, redistributable POI set. Queries Overture's cloud Parquet directly
#' with DuckDB (spatial + httpfs) and loads into the `business` schema.
#' The OSM business layer lives in [oc_load_businesses_osm()].
#'
#' @name openconcord-businesses
NULL

#' Load Overture places for the Concord bbox.
#' @param con A DBI connection (PostGIS).
#' @param release Overture release tag; see https://docs.overturemaps.org/release/latest/
#' @export
oc_load_overture <- function(con = oc_connect(), release = "2025-05-21.0") {
  if (!requireNamespace("duckdb", quietly = TRUE)) {
    cli::cli_alert_warning("install.packages('duckdb') to load Overture places; skipping")
    return(invisible(FALSE))
  }
  b <- oc_bbox()
  dk <- DBI::dbConnect(duckdb::duckdb())
  on.exit(DBI::dbDisconnect(dk, shutdown = TRUE))
  DBI::dbExecute(dk, "INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;")
  DBI::dbExecute(dk, "SET s3_region='us-west-2';")
  src <- sprintf("s3://overturemaps-us-west-2/release/%s/theme=places/type=place/*", release)
  q <- glue::glue("
    SELECT names.primary AS name, categories.primary AS category, confidence,
           ST_AsText(geometry) AS wkt
    FROM read_parquet('{src}', hive_partitioning=1)
    WHERE bbox.xmin BETWEEN {b['xmin']} AND {b['xmax']}
      AND bbox.ymin BETWEEN {b['ymin']} AND {b['ymax']}")
  df <- tryCatch(DBI::dbGetQuery(dk, q), error = function(e) {
    cli::cli_alert_danger("Overture query failed: {conditionMessage(e)}"); NULL })
  if (is.null(df) || !nrow(df)) return(invisible(FALSE))
  sfx <- sf::st_as_sf(df, wkt = "wkt", crs = 4326)
  oc_write_layer(sfx, "business", "overture_places", "Overture Maps", "bbox", con)
}
