# Open Concord — Shiny frontend v2 ("light studio")
# ==================================================
# MapLibre GL (via {mapgl}) over the live PostGIS DB. A grouped, collapsible
# legend with per-group + per-layer feature counts (empty layers hidden) and
# human names; curated click-popups; a Light/Dark/Satellite basemap switcher;
# and the retained draw-to-identify + server-side attribute filter.
#
# Why MapLibre: WebGL rendering on the GPU handles the big layers (osm.roads
# 103k, osm.buildings 88k) smoothly where Leaflet's per-feature SVG froze.
# get_layer() also st_simplify()s large non-point layers to shrink the payload.
# (True instant-any-zoom for the mega layers is the optional pg_tileserv phase.)
#
# v1 (Leaflet) is preserved as app-leaflet-v1.R.

library(shiny)
library(bslib)
library(mapgl)
library(sf)
library(DBI)
library(pool)

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

# ---- DB pool (libpq env vars: PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD) ----
pool <- dbPool(
  RPostgres::Postgres(),
  host     = Sys.getenv("PGHOST", "localhost"),
  port     = as.integer(Sys.getenv("PGPORT", "5432")),
  dbname   = Sys.getenv("PGDATABASE", "openconcord"),
  user     = Sys.getenv("PGUSER", "openconcord"),
  password = Sys.getenv("PGPASSWORD", "")
)
onStop(function() poolClose(pool))

# ---- category metadata: label + color, keyed by schema, in display order ----
CATEGORIES <- list(
  city      = list(label = "City of Concord", color = "#2563eb"),
  external  = list(label = "Federal & state", color = "#059669"),
  osm       = list(label = "OpenStreetMap",   color = "#7c3aed"),
  schools   = list(label = "Schools",         color = "#dc2626"),
  apis      = list(label = "APIs & sensors",  color = "#d97706"),
  business  = list(label = "Business",        color = "#db2777"),
  knowledge = list(label = "Knowledge",       color = "#0891b2"),
  web       = list(label = "Web exports",     color = "#475569")
)
CATEGORY_ORDER <- names(CATEGORIES)
CONCORD_CENTER <- c(-71.538, 43.207)
DEFAULT_ON <- c("schools.public_schools_districts")

# free satellite basemap (Esri World Imagery raster) as a MapLibre style object
SATELLITE_STYLE <- list(
  version = 8,
  sources = list(esri = list(
    type = "raster", tileSize = 256,
    tiles = list("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"),
    attribution = "Esri, Maxar, Earthstar Geographics")),
  layers = list(list(id = "esri", type = "raster", source = "esri"))
)

# prettify a table slug into a human, sentence-case label (acronyms upper-cased)
nice_label <- function(table) {
  s <- gsub("_", " ", table)
  for (a in c("nhd","nwi","epa","faa","fcc","cdc","usgs","osm","usa","gbif","nrhp","tiger","fema","ev","acs","lodes"))
    s <- gsub(paste0("\\b", a, "\\b"), toupper(a), s, ignore.case = TRUE)
  paste0(toupper(substr(s, 1, 1)), substr(s, 2, nchar(s)))
}

# map+db layers with at least one feature (empties hidden), biggest first per group
catalog <- function() {
  tryCatch(
    dbGetQuery(pool,
      "SELECT schema_name, table_name, n_features
         FROM public.catalog
        WHERE target = 'map+db' AND n_features > 0
        ORDER BY schema_name, n_features DESC"),
    error = function(e) data.frame())
}

# curated popup HTML per feature (key non-empty fields, internal cols dropped)
build_popup <- function(g, schema, table) {
  df <- sf::st_drop_geometry(g)
  df <- df[, !grepl("^(geom|geometry|wkb|globalid|objectid|gid|fid|oid|id)$|_id$|code$|^se_anno|shape[_.]",
                    names(df), ignore.case = TRUE), drop = FALSE]
  cat_label <- CATEGORIES[[schema]]$label %||% schema
  cat_color <- CATEGORIES[[schema]]$color %||% "#475569"
  tcands <- c("name", "primary_name", "title", "sch_name", "school_name", "facility", "fac_name", "label")
  tmatch <- match(tcands, tolower(names(df)))
  title_col <- if (any(!is.na(tmatch))) names(df)[tmatch[which(!is.na(tmatch))[1]]] else NA_character_
  vapply(seq_len(nrow(df)), function(i) {
    row <- df[i, , drop = FALSE]
    vals <- trimws(as.character(unlist(row)))
    keep <- which(!is.na(vals) & nzchar(vals) & vals != "NA" & nchar(vals) <= 80)
    if (!is.na(title_col)) keep <- setdiff(keep, match(title_col, names(row)))
    keep <- head(keep, 6)
    title <- if (!is.na(title_col) && nzchar(trimws(as.character(row[[title_col]]))))
      as.character(row[[title_col]]) else nice_label(table)
    rows_html <- paste0(sprintf(
      "<tr><td style='color:#6b7280;padding:1px 10px 1px 0;white-space:nowrap'>%s</td><td style='color:#111827'>%s</td></tr>",
      nice_label(names(row)[keep]), vals[keep]), collapse = "")
    sprintf("<div style='font:13px/1.45 system-ui,-apple-system,sans-serif;min-width:150px;max-width:280px'><div style='font-weight:600;color:#111827'>%s</div><div style='font-size:11px;color:%s;margin:1px 0 6px'>%s</div><table style='font-size:11.5px;border-collapse:collapse'>%s</table></div>",
            htmltools::htmlEscape(title), cat_color, cat_label, rows_html)
  }, character(1))
}

# fetch a layer as sf (EPSG:4326); simplify large non-point layers; add popup_html
get_layer <- function(schema, table, where = "1=1") {
  con <- poolCheckout(pool); on.exit(poolReturn(con))
  q <- sprintf('SELECT * FROM "%s"."%s" WHERE %s', schema, table, where)
  g <- tryCatch(st_transform(st_read(con, query = q, quiet = TRUE), 4326),
                error = function(e) NULL)
  if (is.null(g) || !nrow(g)) return(g)
  gt <- as.character(st_geometry_type(g, by_geometry = FALSE))
  if (!grepl("POINT", gt) && nrow(g) > 4000) {
    old <- sf::sf_use_s2(FALSE)
    g <- tryCatch(st_simplify(g, dTolerance = 0.00004, preserveTopology = TRUE),
                  error = function(e) g)
    sf::sf_use_s2(old)
  }
  if (nrow(g) <= 8000) g$popup_html <- build_popup(g, schema, table)
  g
}

geom_kind <- function(g) {
  gt <- as.character(st_geometry_type(g, by_geometry = FALSE))
  if (grepl("POLY", gt)) "poly" else if (grepl("LINE", gt)) "line" else "point"
}

# add an sf layer to the map proxy, styled by geometry kind
add_oc_layer <- function(proxy, id, g, color, highlight = FALSE) {
  pop <- if ("popup_html" %in% names(g)) "popup_html" else NULL
  k <- geom_kind(g)
  if (k == "poly") {
    add_fill_layer(proxy, id = id, source = g, fill_color = color,
      fill_opacity = if (highlight) 0.5 else 0.2, fill_outline_color = color, popup = pop)
  } else if (k == "line") {
    add_line_layer(proxy, id = id, source = g, line_color = color,
      line_width = if (highlight) 2.6 else 1.6, line_opacity = 0.9, popup = pop)
  } else {
    add_circle_layer(proxy, id = id, source = g, circle_color = color,
      circle_radius = if (highlight) 6.5 else 4.5, circle_stroke_color = "#ffffff",
      circle_stroke_width = 1.2, circle_opacity = 0.9, popup = pop)
  }
}

# ------------------------------------------------------------------- UI ----
ui <- page_sidebar(
  theme = bs_theme(version = 5, primary = "#2563eb",
                   base_font = font_google("Inter", local = FALSE),
                   heading_font = font_google("Inter", local = FALSE)),
  title = tags$span(style = "display:flex;align-items:baseline;gap:10px",
    tags$span("Open Concord", style = "font-weight:600;letter-spacing:-0.01em"),
    tags$span("Concord, NH · live geospatial data",
              style = "font-weight:400;color:#9ca3af;font-size:12.5px")),
  tags$head(tags$style(HTML(
    ".maplibregl-map,.html-widget{height:100% !important}
     .accordion{--bs-accordion-border-color:transparent}
     .accordion-item{border:0;margin-bottom:1px}
     .accordion-button{padding:7px 10px;font-size:13px;border-radius:7px!important;background:transparent}
     .accordion-button:not(.collapsed){background:#eef2f7;color:inherit;box-shadow:none}
     .accordion-button:focus{box-shadow:none}
     .accordion-button::after{width:0.9rem;height:0.9rem;background-size:0.9rem}
     .accordion-body{padding:3px 10px 8px}
     .shiny-input-checkboxgroup .checkbox{margin:0 0 2px}
     .shiny-input-checkboxgroup .checkbox label{display:flex;align-items:center;gap:8px;width:100%;margin:0;font-size:12.5px;font-weight:400;cursor:pointer}
     .shiny-input-checkboxgroup .checkbox input{margin:0;flex:0 0 auto;cursor:pointer}
     .shiny-input-checkboxgroup .checkbox label>span{flex:1 1 auto;min-width:0}
     .maplibregl-ctrl-attrib{font-size:10px;opacity:0.7}
     .maplibregl-ctrl-group button{width:27px;height:27px}"))),
  sidebar = sidebar(
    width = 320, gap = "8px",
    radioButtons("basemap", "Basemap", inline = TRUE,
      choices = c(Light = "positron", Dark = "dark-matter", Satellite = "satellite"),
      selected = "positron"),
    div(style = "font-size:11px;color:#9ca3af", textOutput("summary", inline = TRUE)),
    uiOutput("legend"),
    tags$details(
      tags$summary("Filter a layer", style = "font-size:12px;cursor:pointer;color:#374151"),
      div(style = "padding-top:6px",
        selectInput("filter_layer", NULL, choices = NULL),
        textInput("filter_where", NULL, placeholder = "SQL WHERE, e.g. zone = 'RS'"),
        actionButton("apply_filter", "Apply filter", class = "btn-sm btn-primary"))),
    div(style = "font-size:11px;color:#6b7280;border-top:1px solid #eee;padding-top:6px",
        textOutput("status"))
  ),
  maplibreOutput("map", height = "100%")
)

# --------------------------------------------------------------- server ----
server <- function(input, output, session) {
  cat_df <- reactivePoll(30000, session, function() Sys.time(), catalog)
  shown <- reactiveVal(character())

  output$summary <- renderText({
    df <- cat_df()
    if (!nrow(df)) return("No layers loaded — run the ETL.")
    sprintf("%d layers · %s features · empties hidden",
            nrow(df), format(sum(df$n_features), big.mark = ","))
  })

  output$legend <- renderUI({
    df <- cat_df()
    validate(need(nrow(df) > 0, "No map+db layers in PostGIS yet."))
    updateSelectInput(session, "filter_layer",
      choices = sprintf("%s.%s", df$schema_name, df$table_name))
    panels <- lapply(intersect(CATEGORY_ORDER, unique(df$schema_name)), function(sch) {
      sub <- df[df$schema_name == sch, , drop = FALSE]
      ids <- sprintf("%s.%s", sub$schema_name, sub$table_name)
      meta <- CATEGORIES[[sch]] %||% list(label = sch, color = "#475569")
      names_html <- lapply(seq_len(nrow(sub)), function(i) HTML(sprintf(
        "<span style='display:inline-flex;justify-content:space-between;width:100%%;gap:8px'><span>%s</span><span style='color:#9ca3af;font-size:11px'>%s</span></span>",
        nice_label(sub$table_name[i]), format(sub$n_features[i], big.mark = ","))))
      accordion_panel(
        value = sch,
        title = HTML(sprintf(
          "<span style='width:9px;height:9px;border-radius:50%%;background:%s;display:inline-block;margin-right:8px'></span>%s <span style='color:#9ca3af;font-size:11px;margin-left:5px'>%d</span>",
          meta$color, meta$label, nrow(sub))),
        checkboxGroupInput(paste0("grp_", sch), NULL,
          choiceNames = names_html, choiceValues = ids,
          selected = intersect(DEFAULT_ON, ids))
      )
    })
    open_grp <- if ("schools" %in% df$schema_name) "schools" else intersect(CATEGORY_ORDER, unique(df$schema_name))[1]
    do.call(accordion, c(Filter(Negate(is.null), panels),
                         list(open = open_grp, multiple = TRUE)))
  })

  selected <- debounce(reactive({
    df <- cat_df()
    unlist(lapply(unique(df$schema_name), function(s) input[[paste0("grp_", s)]]))
  }), 350)

  output$map <- renderMaplibre({
    maplibre(style = carto_style("positron"), center = CONCORD_CENTER, zoom = 12) |>
      add_draw_control(position = "top-left", orientation = "horizontal")
  })

  # diff-based: add newly checked layers, clear newly unchecked ones
  observeEvent(selected(), ignoreNULL = FALSE, {
    sel <- selected() %||% character()
    proxy <- maplibre_proxy("map")
    cur <- shown()
    for (id in setdiff(cur, sel)) proxy |> clear_layer(id)
    for (id in setdiff(sel, cur)) {
      parts <- strsplit(id, ".", fixed = TRUE)[[1]]
      g <- get_layer(parts[1], parts[2])
      if (is.null(g) || !nrow(g)) next
      add_oc_layer(proxy, id, g, CATEGORIES[[parts[1]]]$color %||% "#2563eb")
    }
    shown(sel)
  })

  observeEvent(input$basemap, {
    style <- switch(input$basemap,
      positron      = carto_style("positron"),
      "dark-matter" = carto_style("dark-matter"),
      satellite     = SATELLITE_STYLE)
    maplibre_proxy("map") |> set_style(style)
  }, ignoreInit = TRUE)

  # draw a shape -> count features of shown layers inside it (live PostGIS)
  observeEvent(input$map_drawn_features, {
    sel <- shown()
    if (!length(sel)) {
      output$status <- renderText("Toggle some layers, then draw a shape to count features inside it.")
      return()
    }
    feats <- tryCatch(get_drawn_features(maplibre_proxy("map")), error = function(e) NULL)
    if (is.null(feats) || !nrow(feats)) return()
    wkt <- st_as_text(st_union(st_geometry(feats)))
    con <- poolCheckout(pool); on.exit(poolReturn(con))
    counts <- vapply(sel, function(id) {
      parts <- strsplit(id, ".", fixed = TRUE)[[1]]
      n <- tryCatch(dbGetQuery(con, sprintf(
        'SELECT count(*) n FROM "%s"."%s" WHERE ST_Intersects(geometry, ST_GeomFromText(%s, 4326))',
        parts[1], parts[2], dbQuoteString(con, wkt)))$n, error = function(e) NA)
      sprintf("%s: %s", nice_label(parts[2]), n)
    }, character(1))
    output$status <- renderText(paste("In drawn area —", paste(counts, collapse = " · ")))
  })

  # server-side attribute filter on one layer -> highlighted overlay
  observeEvent(input$apply_filter, {
    id <- input$filter_layer; req(id)
    parts <- strsplit(id, ".", fixed = TRUE)[[1]]
    where <- if (nzchar(input$filter_where)) input$filter_where else "1=1"
    g <- get_layer(parts[1], parts[2], where)
    proxy <- maplibre_proxy("map")
    fid <- paste0("filter::", id)
    proxy |> clear_layer(fid)
    if (!is.null(g) && nrow(g)) {
      add_oc_layer(proxy, fid, g, "#f59e0b", highlight = TRUE)
      output$status <- renderText(sprintf("%s: %d features match.", nice_label(parts[2]), nrow(g)))
    } else {
      output$status <- renderText("No matches, or query error.")
    }
  })
}

shinyApp(ui, server)
