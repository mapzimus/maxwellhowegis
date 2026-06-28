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

# Map the Appalachian Highlands provinces → 6 legend regions.
# (New England excludes its coastal Seaboard Lowland section.)
ASSIGN='region = PROVINCE=="BLUE RIDGE" ? "blue_ridge"
  : PROVINCE=="PIEDMONT" ? "piedmont"
  : PROVINCE=="VALLEY AND RIDGE" ? "valley_ridge"
  : PROVINCE=="APPALACHIAN PLATEAUS" ? "plateau"
  : (PROVINCE=="NEW ENGLAND" && SECTION!="SEABOARD LOWLAND") ? "new_england"
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
  def lbl: {blue_ridge:"Blue Ridge",piedmont:"Piedmont",valley_ridge:"Ridge & Valley",
            plateau:"Appalachian Plateau",new_england:"New England Upland",adirondack:"Adirondacks"};
  .features |= map(.properties = {region:.properties.region, label:(lbl[.properties.region])})
' "$TMP/regions_raw.geojson" > "$OUT"

echo "✓ wrote $(jq '.features|length' "$OUT") regions to $OUT"
echo "  NOTE: ranges.geojson, peaks.geojson, appalachian_trail.geojson and states.geojson"
echo "        are vendored separately (curated / NPS ANST / US Census)."
