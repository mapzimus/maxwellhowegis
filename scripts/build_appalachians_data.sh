#!/usr/bin/env bash
# ============================================================
# build_appalachians_data.sh
# Regenerates appalachians/data/regions.geojson from the USGS
# Physiographic Divisions of the Conterminous U.S. (Fenneman &
# Johnson, 1946) — the six Appalachian Highlands regions,
# full range, Georgia to Maine.
#
# Requires: curl, unzip, npx (mapshaper), jq. No GDAL needed.
# Run from the repo root:  bash scripts/build_appalachians_data.sh
# ============================================================
set -euo pipefail

OUT="appalachians/data/regions.geojson"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ fetching USGS physiographic divisions"
curl -sS -L --max-time 120 -o "$TMP/physio_shp.zip" \
  "https://water.usgs.gov/GIS/dsdl/physio_shp.zip"
unzip -o -q "$TMP/physio_shp.zip" -d "$TMP/physio"

# Map the Appalachian Highlands provinces/sections → 12 legend regions
# (section-level, so the New England ranges and the Plateau read separately).
ASSIGN='region =
  (PROVINCE=="BLUE RIDGE" && SECTION=="SOUTHERN") ? "blue_ridge_s"
  : PROVINCE=="BLUE RIDGE" ? "blue_ridge_n"
  : PROVINCE=="PIEDMONT" ? "piedmont"
  : PROVINCE=="VALLEY AND RIDGE" ? "valley_ridge"
  : (PROVINCE=="APPALACHIAN PLATEAUS" && SECTION=="CATSKILL") ? "catskill"
  : (PROVINCE=="APPALACHIAN PLATEAUS" && (SECTION=="CUMBERLAND PLATEAU" || SECTION=="CUMBERLAND MOUNTAIN")) ? "cumberland"
  : PROVINCE=="APPALACHIAN PLATEAUS" ? "allegheny"
  : (PROVINCE=="NEW ENGLAND" && SECTION=="WHITE MOUNTAIN") ? "white"
  : (PROVINCE=="NEW ENGLAND" && SECTION=="GREEN MOUNTAIN") ? "green"
  : (PROVINCE=="NEW ENGLAND" && SECTION=="TACONIC") ? "taconic"
  : (PROVINCE=="NEW ENGLAND" && SECTION=="NEW ENGLAND UPLAND") ? "ne_upland"
  : PROVINCE=="ADIRONDACK" ? "adirondack"
  : ""'

echo "→ filtering, clipping to the eastern U.S., simplifying, dissolving"
npx -y mapshaper@0.6.102 "$TMP/physio/physio.shp" \
  -each "$ASSIGN" -filter 'region !== ""' \
  -clip bbox=-89,32,-66,47.8 \
  -simplify 8% keep-shapes -clean \
  -dissolve region copy-fields=region \
  -o format=geojson precision=0.001 "$TMP/regions_raw.geojson"

echo "→ attaching labels → $OUT"
jq -c '
  def lbl: {white:"White Mountains",green:"Green Mountains",taconic:"Taconic Mountains",
            ne_upland:"New England Upland",adirondack:"Adirondacks",catskill:"Catskills",
            allegheny:"Allegheny Plateau",cumberland:"Cumberland Plateau",valley_ridge:"Ridge & Valley",
            blue_ridge_n:"Northern Blue Ridge",blue_ridge_s:"Southern Blue Ridge",piedmont:"Piedmont"};
  .features |= map(.properties = {region:.properties.region, label:(lbl[.properties.region])})
' "$TMP/regions_raw.geojson" > "$OUT"

echo "✓ wrote $(jq '.features|length' "$OUT") regions to $OUT"
echo "  NOTE: ranges.geojson, peaks.geojson, appalachian_trail.geojson and states.geojson"
echo "        are vendored separately (curated / NPS ANST / US Census)."
