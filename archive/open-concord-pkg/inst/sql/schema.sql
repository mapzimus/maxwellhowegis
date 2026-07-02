-- Open Concord PostGIS schema (created by oc_db_init()).
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS city;       -- City of Concord ArcGIS layers      (map+db)
CREATE SCHEMA IF NOT EXISTS external;   -- federal/state ArcGIS               (map+db)
CREATE SCHEMA IF NOT EXISTS osm;        -- OpenStreetMap themes               (map+db)
CREATE SCHEMA IF NOT EXISTS apis;       -- Census/USGS/EPA/CDC/NWS/biodiversity (mixed)
CREATE SCHEMA IF NOT EXISTS schools;    -- districts/schools (map+db) + enrollment (db)
CREATE SCHEMA IF NOT EXISTS business;   -- OSM + Overture POIs                (map+db)
CREATE SCHEMA IF NOT EXISTS knowledge;  -- people/facts/history (mostly db)
CREATE SCHEMA IF NOT EXISTS web;        -- materialized exports / joins for the map

-- Self-describing catalog: one row per loaded dataset.
CREATE TABLE IF NOT EXISTS public.catalog (
  schema_name text,
  table_name  text,
  target      text CHECK (target IN ('map+db','db')),
  source      text,
  scope       text,
  n_features  integer,
  validated   boolean DEFAULT false,   -- flip true after visual validation
  notes       text,
  loaded_at   timestamptz DEFAULT now(),
  PRIMARY KEY (schema_name, table_name)
);

-- Example join (db -> map+db): ACS income onto census tracts for a choropleth.
-- SELECT t.*, a.median_household_income
-- FROM apis.acs_tracts t;   -- (acs_tracts is loaded with geometry; tabular ACS joins on GEOID)
