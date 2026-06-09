#' PostGIS load helpers
#'
#' Every dataset is written to PostGIS: spatial (`map+db`) layers go in as
#' `geometry(...,4326)` tables; reference (`db`) data goes in as plain tables.
#' A `catalog` table records what landed and whether it has been validated.
#'
#' @name openconcord-db
NULL

#' Ensure the schemas and catalog table exist.
#' @param con A DBI connection.
#' @export
oc_db_init <- function(con = oc_connect()) {
  DBI::dbExecute(con, "CREATE EXTENSION IF NOT EXISTS postgis;")
  for (s in c("city", "external", "osm", "apis", "schools", "business", "knowledge", "web")) {
    DBI::dbExecute(con, glue::glue("CREATE SCHEMA IF NOT EXISTS {s};"))
  }
  DBI::dbExecute(con, "
    CREATE TABLE IF NOT EXISTS public.catalog (
      schema_name text, table_name text, target text,
      source text, scope text, n_features integer,
      validated boolean DEFAULT false, notes text,
      loaded_at timestamptz DEFAULT now(),
      PRIMARY KEY (schema_name, table_name)
    );")
  invisible(con)
}

#' Write a spatial (`map+db`) layer to PostGIS.
#'
#' @param x An `sf` object (will be transformed to EPSG:4326).
#' @param schema,table Destination schema and table name.
#' @param source,scope Catalog metadata.
#' @param con A DBI connection.
#' @export
oc_write_layer <- function(x, schema, table, source = "", scope = "", con = oc_connect()) {
  if (is.null(x) || nrow(x) == 0) {
    cli::cli_alert_warning("{schema}.{table}: 0 features, skipping")
    n <- 0L
  } else {
    x <- sf::st_transform(x, 4326)
    x <- oc_flatten_list_cols(x)
    sf::st_write(x, con, DBI::Id(schema = schema, table = table),
                 delete_layer = TRUE, quiet = TRUE)
    n <- nrow(x)
    cli::cli_alert_success("{schema}.{table}: {n} features -> PostGIS")
  }
  oc_catalog_upsert(con, schema, table, "map+db", source, scope, n)
  invisible(n)
}

#' Write a reference (`db`) table to PostGIS.
#'
#' @param df A data.frame.
#' @inheritParams oc_write_layer
#' @export
oc_write_table <- function(df, schema, table, source = "", scope = "", con = oc_connect()) {
  n <- if (is.null(df)) 0L else nrow(df)
  if (n > 0) {
    df <- oc_flatten_list_cols(df)
    DBI::dbWriteTable(con, DBI::Id(schema = schema, table = table), df, overwrite = TRUE)
    cli::cli_alert_success("{schema}.{table}: {n} rows -> PostGIS")
  }
  oc_catalog_upsert(con, schema, table, "db", source, scope, n)
  invisible(n)
}

#' Upsert a row into the catalog.
#' @keywords internal
oc_catalog_upsert <- function(con, schema, table, target, source, scope, n) {
  DBI::dbExecute(con, "
    INSERT INTO public.catalog (schema_name, table_name, target, source, scope, n_features)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (schema_name, table_name) DO UPDATE SET
      target = EXCLUDED.target, source = EXCLUDED.source, scope = EXCLUDED.scope,
      n_features = EXCLUDED.n_features, loaded_at = now();",
    params = list(schema, table, target, source, scope, n))
}

#' Coerce non-geometry list-columns to text so PostGIS can store them.
#'
#' ArcGIS/REST and some API layers occasionally return fields as list-columns
#' (mixed types, nested/coded values, multi-valued cells). `RPostgres`'
#' `dbWriteTable()` rejects list-columns unless they hold raw vectors, which
#' otherwise halts the write. We collapse each cell to a single string so the
#' attribute survives (useful for Shiny popups) rather than dropping it.
#' The `sfc` geometry column is left untouched.
#' @param x An `sf` object or data.frame.
#' @keywords internal
oc_flatten_list_cols <- function(x) {
  geom <- attr(x, "sf_column")  # NULL for a plain data.frame
  hit <- character()
  for (nm in setdiff(names(x), geom)) {
    col <- x[[nm]]
    if (is.list(col) && !inherits(col, "sfc")) {
      x[[nm]] <- vapply(col, function(v) {
        if (is.null(v) || length(v) == 0L || all(is.na(v))) NA_character_
        else paste(format(v, trim = TRUE), collapse = "; ")
      }, character(1))
      hit <- c(hit, nm)
    }
  }
  if (length(hit)) {
    cli::cli_alert_info("flattened list-column(s) to text: {paste(hit, collapse = ', ')}")
  }
  x
}
