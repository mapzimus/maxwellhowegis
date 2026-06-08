# Open Concord pipeline — replaces run_all.py
# Run with: targets::tar_make()
#
# Each target opens its own PostGIS connection, downloads a group, and loads it.
# `targets` tracks what's done so re-runs only redo what changed.

library(targets)

tar_option_set(
  packages = c("openconcord"),
  # download targets have side effects (writing to PostGIS); keep them as the
  # unit of work and let `cue = tar_cue("always")` re-run when asked.
  format = "rds"
)

# load package functions during interactive dev
if (file.exists("R")) targets::tar_source("R")

list(
  tar_target(db,        openconcord::oc_db_init(),                  cue = tar_cue("always")),
  tar_target(concord,   { openconcord::oc_load_concord();   "ok" }, cue = tar_cue("always")),
  tar_target(external,  { openconcord::oc_load_external();  "ok" }, cue = tar_cue("always")),
  tar_target(osm,       { openconcord::oc_load_osm();       "ok" }, cue = tar_cue("always")),
  tar_target(apis,      { openconcord::oc_load_apis();      "ok" }, cue = tar_cue("always")),
  tar_target(schools,   { openconcord::oc_load_schools();   "ok" }, cue = tar_cue("always")),
  tar_target(knowledge, { openconcord::oc_load_knowledge(); "ok" }, cue = tar_cue("always")),
  tar_target(business,  { openconcord::oc_load_businesses_osm(); "ok" }, cue = tar_cue("always")),
  # web export depends on everything being loaded
  tar_target(web,
    { openconcord::oc_export_web(); "ok" },
    pattern = NULL,
    cue = tar_cue("always")
  )
)
