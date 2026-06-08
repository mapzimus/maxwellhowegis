#' Export PostGIS -> static web artifacts for self-hosting
#'
#' The website is static (GitHub Pages), so the mega map reads a single PMTiles
#' archive plus a catalog. This reads the `map+db` layers from PostGIS, writes a
#' combined GeoJSONSeq, and tiles it to PMTiles with `tippecanoe`; `db` tables are
#' exported to Parquet for in-browser DuckDB-WASM querying.
#'
#' Requires `tippecanoe` (and `ogr2ogr`) on PATH. Output goes to the website repo.
#'
#' @name openconcord-export
NULL

#' Export all `map+db` layers to one PMTiles + `db` tables to Parquet.
#'
#' @param con A DBI connection.
#' @param out_dir Web output directory (e.g. the site's `concord/data/`).
#' @export
oc_export_web <- function(con = oc_connect(), out_dir = "../concord/data") {
  dir.create(out_dir, showWarnings = FALSE, recursive = TRUE)
  cat <- DBI::dbGetQuery(con, "SELECT schema_name, table_name, target FROM public.catalog")

  # 1. map+db layers -> per-layer GeoJSON -> tippecanoe -> concord.pmtiles
  tmp <- tempfile("oc_layers_"); dir.create(tmp)
  layer_args <- character()
  for (i in which(cat$target == "map+db")) {
    s <- cat$schema_name[i]; t <- cat$table_name[i]; name <- paste0(s, "__", t)
    g <- sf::st_read(con, query = sprintf('SELECT * FROM "%s"."%s"', s, t), quiet = TRUE)
    if (!nrow(g)) next
    fp <- file.path(tmp, paste0(name, ".geojson"))
    sf::st_write(g, fp, delete_dsn = TRUE, quiet = TRUE)
    layer_args <- c(layer_args, "-L", paste0(name, ":", fp))
  }
  pmtiles <- file.path(out_dir, "concord.pmtiles")
  system2("tippecanoe", c("-o", pmtiles, "--force", "-zg",
                          "--drop-densest-as-needed", "--extend-zooms-if-still-dropping",
                          layer_args))
  cli::cli_alert_success("wrote {pmtiles} ({sum(cat$target=='map+db')} layers)")

  # 2. db tables -> Parquet (DuckDB-WASM friendly)
  if (requireNamespace("arrow", quietly = TRUE)) {
    for (i in which(cat$target == "db")) {
      s <- cat$schema_name[i]; t <- cat$table_name[i]
      df <- DBI::dbGetQuery(con, sprintf('SELECT * FROM "%s"."%s"', s, t))
      arrow::write_parquet(df, file.path(out_dir, paste0(s, "__", t, ".parquet")))
    }
  }

  # 3. catalog.json drives the map's layer panel
  jsonlite::write_json(cat, file.path(out_dir, "catalog.json"), auto_unbox = TRUE)
  invisible(pmtiles)
}
