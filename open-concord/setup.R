# One-time environment setup for openconcord.
# Installs dependencies and initialises an renv lockfile pinned to your machine.
#
#   Rscript setup.R
#
# (System libs first — see DEPLOY.md: gdal, geos, proj, udunits2, libpq, tippecanoe.)

pkgs <- c(
  "remotes", "renv",
  # core
  "sf", "DBI", "RPostgres", "httr2", "jsonlite", "cli", "glue", "dplyr", "purrr", "yaml",
  # domain
  "arcgislayers", "tidycensus", "tigris", "osmdata", "rgbif", "educationdata",
  "WikidataQueryServiceR", "WikipediR",
  # pipeline + export
  "targets", "tarchetypes", "arrow",
  # optional
  "duckdb", "mapgl", "rinat"
)

install.packages(setdiff(pkgs, rownames(installed.packages())))
remotes::install_local(".", dependencies = TRUE)   # the openconcord package itself

# Pin exact versions into renv.lock for reproducibility on the VPS.
if (requireNamespace("renv", quietly = TRUE)) {
  renv::init(bare = TRUE)
  renv::snapshot(type = "all", prompt = FALSE)
  message("renv.lock written — commit it for a reproducible environment.")
}
