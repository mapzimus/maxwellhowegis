# Open Concord — Shiny frontend (R)
# ==================================
# The map UI itself, in R. Queries the self-hosted PostGIS live, renders an
# interactive Leaflet map with layer toggles, click-popups, a draw toolbar
# (draw a polygon -> identify/count features inside), and attribute filtering.
#
# Hosted on the VPS (see ../Dockerfile + ../docker-compose.yml) and embedded at
# maxwellhowegis.com/concord/. Uses {leaflet}+{leaflet.extras}; swap to {mapgl}
# (maplibre) if you want vector-tile performance for the big layers.
#
# NOTE: not yet executed in the build sandbox (no R) — validate with a live run.

library(shiny)
library(leaflet)
library(leaflet.extras)
library(sf)
library(DBI)
library(pool)

# ---- DB pool (libpq env vars: PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD) ----
pool <- dbPool(
  RPostgres::Postgres(),
  host = Sys.getenv("PGHOST", "localhost"),
  port = as.integer(Sys.getenv("PGPORT", "5432")),
  dbname = Sys.getenv("PGDATABASE", "openconcord"),
  user = Sys.getenv("PGUSER", "openconcord"),
  password = Sys.getenv("PGPASSWORD", "")
)
onStop(function() poolClose(pool))

GROUP_COLOR <- c(city = "#2563eb", external = "#059669", osm = "#7c3aed",
                 apis = "#d97706", schools = "#dc2626", business = "#db2777",
                 knowledge = "#0891b2", web = "#475569")

# map+db layers from the self-describing catalog
catalog <- function() {
  tryCatch(
    dbGetQuery(pool, "SELECT schema_name, table_name, target, n_features
                      FROM public.catalog WHERE target = 'map+db'
                      ORDER BY schema_name, table_name"),
    error = function(e) data.frame())
}

# read one layer as sf (optionally filtered), transformed to WGS84
get_layer <- function(schema, table, where = "1=1") {
  con <- poolCheckout(pool); on.exit(poolReturn(con))
  q <- sprintf('SELECT * FROM "%s"."%s" WHERE %s', schema, table, where)
  tryCatch(st_transform(st_read(con, query = q, quiet = TRUE), 4326),
           error = function(e) NULL)
}

# one HTML table per feature (returns a character vector of length nrow(x))
popup_table <- function(x) {
  df <- st_drop_geometry(x)
  if (!nrow(df)) return(character())
  apply(df, 1, function(r) paste0(
    "<table>", paste0("<tr><td><b>", names(df), "</b></td><td>",
                      substr(as.character(r), 1, 120), "</td></tr>", collapse = ""),
    "</table>"))
}

# ---------------------------------------------------------------- UI ----
ui <- fluidPage(
  tags$head(tags$style(HTML("#map{height:100vh!important} body{margin:0}
    .well{font-size:13px}"))),
  div(style = "position:absolute;inset:0",
    leafletOutput("map", height = "100%")),
  absolutePanel(top = 10, right = 10, width = 300, draggable = TRUE,
    wellPanel(
      h4("Open Concord"),
      div(style = "color:#666;font-size:11px",
          "Live from PostGIS. Toggle layers, click features, or use the draw tool to identify."),
      uiOutput("layer_ui"),
      hr(),
      selectInput("filter_layer", "Filter a layer (server-side):", choices = NULL),
      textInput("filter_where", NULL, placeholder = "SQL WHERE, e.g. zone = 'RS'"),
      actionButton("apply_filter", "Apply", class = "btn-sm"),
      div(style = "font-size:11px;color:#666;margin-top:6px", textOutput("status"))
    ))
)

# ------------------------------------------------------------ server ----
server <- function(input, output, session) {
  cat_df <- reactivePoll(10000, session, function() Sys.time(), catalog)
  layer_id <- function(s, t) paste(s, t, sep = ".")

  output$layer_ui <- renderUI({
    df <- cat_df(); if (!nrow(df)) return(div(style = "color:#b91c1c",
      "No map+db layers in PostGIS yet — run the ETL (targets::tar_make())."))
    ids <- layer_id(df$schema_name, df$table_name)
    updateSelectInput(session, "filter_layer", choices = ids)
    groups <- split(seq_len(nrow(df)), df$schema_name)
    lapply(names(groups), function(g) tags$details(
      tags$summary(tags$span(style = sprintf(
        "display:inline-block;width:9px;height:9px;border-radius:50%%;background:%s;margin-right:5px",
        ifelse(is.na(GROUP_COLOR[g]), "#3b82f6", GROUP_COLOR[g])), ""),
        sprintf("%s (%d)", g, length(groups[[g]]))),
      checkboxGroupInput(paste0("grp_", g), NULL,
        choiceNames = df$table_name[groups[[g]]],
        choiceValues = ids[groups[[g]]])
    ))
  })

  output$map <- renderLeaflet({
    leaflet() |>
      addProviderTiles(providers$CartoDB.Positron) |>
      setView(-71.538, 43.207, 12) |>
      addDrawToolbar(targetGroup = "draw", polygonOptions = TRUE,
        rectangleOptions = TRUE, circleOptions = FALSE, markerOptions = FALSE,
        polylineOptions = FALSE, editOptions = editToolbarOptions())
  })

  selected <- reactive({
    df <- cat_df()
    unlist(lapply(unique(df$schema_name), function(g) input[[paste0("grp_", g)]]))
  })

  # add/remove layers as the selection changes
  observeEvent(selected(), ignoreNULL = FALSE, {
    sel <- selected() %||% character()
    proxy <- leafletProxy("map")
    # clear all then redraw the selected (simple + correct)
    for (id in isolate(shown$ids)) proxy |> clearGroup(id)
    for (id in sel) {
      parts <- strsplit(id, ".", fixed = TRUE)[[1]]
      g <- get_layer(parts[1], parts[2]); if (is.null(g) || !nrow(g)) next
      col <- ifelse(is.na(GROUP_COLOR[parts[1]]), "#3b82f6", GROUP_COLOR[parts[1]])
      gt <- as.character(st_geometry_type(g, by_geometry = FALSE))
      if (grepl("POLY", gt)) proxy |> addPolygons(data = g, group = id, color = col,
          weight = 1, fillOpacity = 0.25, popup = popup_table(g))
      else if (grepl("LINE", gt)) proxy |> addPolylines(data = g, group = id,
          color = col, weight = 2, popup = popup_table(g))
      else proxy |> addCircleMarkers(data = g, group = id, radius = 4, color = col,
          stroke = TRUE, weight = 0.6, fillOpacity = 0.8, popup = popup_table(g))
    }
    shown$ids <- sel
  })
  shown <- reactiveValues(ids = character())

  # draw -> identify features inside the drawn shape (live PostGIS spatial query)
  observeEvent(input$map_draw_new_feature, {
    feat <- input$map_draw_new_feature
    poly <- tryCatch(st_read(jsonlite::toJSON(feat$geometry, auto_unbox = TRUE),
                             quiet = TRUE), error = function(e) NULL)
    if (is.null(poly)) return()
    wkt <- st_as_text(st_geometry(poly)[[1]])
    counts <- lapply(shown$ids, function(id) {
      parts <- strsplit(id, ".", fixed = TRUE)[[1]]
      con <- poolCheckout(pool); on.exit(poolReturn(con))
      n <- tryCatch(dbGetQuery(con, sprintf(
        'SELECT count(*) n FROM "%s"."%s"
         WHERE ST_Intersects(geometry, ST_GeomFromText(%s, 4326))',
        parts[1], parts[2], dbQuoteString(con, wkt)))$n, error = function(e) NA)
      sprintf("%s: %s", id, n)
    })
    output$status <- renderText(paste("In drawn area —",
      paste(unlist(counts), collapse = "  ·  ")))
  })

  # server-side attribute filter: re-query one layer with a WHERE clause
  observeEvent(input$apply_filter, {
    id <- input$filter_layer; if (is.null(id)) return()
    parts <- strsplit(id, ".", fixed = TRUE)[[1]]
    where <- if (nzchar(input$filter_where)) input$filter_where else "1=1"
    g <- get_layer(parts[1], parts[2], where)
    proxy <- leafletProxy("map") |> clearGroup(id)
    if (!is.null(g) && nrow(g)) {
      col <- ifelse(is.na(GROUP_COLOR[parts[1]]), "#3b82f6", GROUP_COLOR[parts[1]])
      proxy |> addCircleMarkers(data = st_centroid(g), group = id, radius = 5,
        color = "#facc15", stroke = TRUE, weight = 1, popup = popup_table(g))
      output$status <- renderText(sprintf("%s: %d features match.", id, nrow(g)))
    } else output$status <- renderText("No matches / query error.")
  })
}

`%||%` <- function(a, b) if (is.null(a)) b else a
shinyApp(ui, server)
