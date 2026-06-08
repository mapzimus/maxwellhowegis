#' Knowledge base: notable people, facts, history
#'
#' Notable inhabitants (Wikipedia category + Wikidata), structured facts
#' (Wikidata Q28249) and history (Wikipedia extracts). Mostly `db` tier, with a
#' centroid pin layer for the map. Mirrors the Python `download_knowledge.py`.
#'
#' @name openconcord-knowledge
NULL

oc_history_pages <- c(
  "Concord, New Hampshire", "Penacook, New Hampshire",
  "Saint Paul's School (New Hampshire)", "NHTI – Concord's Community College",
  "University of New Hampshire Franklin Pierce School of Law",
  "New Hampshire State House", "Concord Coach")

#' Load notable people, facts, and history.
#' @param con A DBI connection.
#' @export
oc_load_knowledge <- function(con = oc_connect()) {
  oc_load_notable_people(con)
  oc_load_history(con)
  oc_load_wikidata_facts(con)
  invisible(TRUE)
}

#' Notable people from Wikipedia category + Wikidata -> db table + centroid pins.
#' @param con A DBI connection.
#' @export
oc_load_notable_people <- function(con = oc_connect()) {
  members <- tryCatch(
    WikipediR::pages_in_category("en", "wikipedia",
      categories = "People from Concord, New Hampshire",
      properties = c("title"), type = "page", limit = 500),
    error = function(e) NULL)
  titles <- vapply(members$query$categorymembers, function(m) m$title, character(1))
  titles <- titles[!grepl("^List of", titles)]
  if (!length(titles)) return(invisible(FALSE))

  df <- data.frame(name = titles,
                   url = paste0("https://en.wikipedia.org/wiki/",
                                utils::URLencode(gsub(" ", "_", titles))),
                   stringsAsFactors = FALSE)
  oc_write_table(df, "knowledge", "notable_people", "Wikipedia + Wikidata", "city", con)

  # centroid pins with deterministic jitter so they don't stack (map+db)
  cc <- oc_centroid(); n <- nrow(df)
  df$lon <- cc["lon"] + ((seq_len(n) - 1) %% 12 - 6) * 0.0009
  df$lat <- cc["lat"] + ((seq_len(n) - 1) %/% 12 - 6) * 0.0009
  oc_write_layer(oc_points_sf(df), "knowledge", "notable_people_pins",
                 "Wikipedia + Wikidata", "city", con)
}

#' Wikipedia history extracts for seed pages -> db table.
#' @param con A DBI connection.
#' @export
oc_load_history <- function(con = oc_connect()) {
  rows <- lapply(oc_history_pages, function(p) {
    pg <- tryCatch(WikipediR::page_content("en", "wikipedia", page_name = p,
                                           as_wikitext = FALSE), error = function(e) NULL)
    if (is.null(pg)) return(NULL)
    data.frame(title = p, html = pg$parse$text$`*` %||% "", stringsAsFactors = FALSE)
  })
  df <- do.call(rbind, Filter(Negate(is.null), rows))
  oc_write_table(df, "knowledge", "history", "Wikipedia", "city", con)
}

#' All Wikidata statements for Concord (Q28249) -> flattened db table.
#' @param con A DBI connection.
#' @export
oc_load_wikidata_facts <- function(con = oc_connect()) {
  q <- "SELECT ?prop ?propLabel ?value ?valueLabel WHERE {
          wd:Q28249 ?p ?value . ?prop wikibase:directClaim ?p .
          SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. } }"
  df <- tryCatch(WikidataQueryServiceR::query_wikidata(q), error = function(e) NULL)
  oc_write_table(df, "knowledge", "wikidata_facts", "Wikidata Q28249", "city", con)
}
