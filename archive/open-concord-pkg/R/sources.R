#' Read the source manifest (data-raw/sources.json)
#'
#' The language-agnostic manifest is shared with the (now retired) Python tool.
#' @return Parsed list.
#' @export
oc_sources <- function() {
  path <- system.file("..", "data-raw", "sources.json", package = "openconcord")
  if (!nzchar(path) || !file.exists(path)) {
    path <- file.path("data-raw", "sources.json")
  }
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}
