#!/usr/bin/env bash
# ============================================================
# build_appalachians_data.sh
# Regenerates appalachians/data/provinces.geojson from the USGS
# Physiographic Divisions of the Conterminous U.S. (Fenneman &
# Johnson, 1946). One-time offline prep; output is committed.
#
# Requires: curl, unzip, npx (mapshaper), jq. No GDAL needed.
# Run from the repo root:  bash scripts/build_appalachians_data.sh
# ============================================================
set -euo pipefail

OUT="appalachians/data/provinces.geojson"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ fetching USGS physiographic divisions"
curl -sS -L --max-time 120 -o "$TMP/physio_shp.zip" \
  "https://water.usgs.gov/GIS/dsdl/physio_shp.zip"
unzip -o -q "$TMP/physio_shp.zip" -d "$TMP/physio"

# Map USGS PROVINCE/SECTION → the 6 poster legend groups.
ASSIGN='province = PROVINCE=="ADIRONDACK" ? "adirondack"
  : (PROVINCE=="NEW ENGLAND"&&SECTION=="WHITE MOUNTAIN") ? "white"
  : (PROVINCE=="NEW ENGLAND"&&SECTION=="GREEN MOUNTAIN") ? "green"
  : (PROVINCE=="NEW ENGLAND"&&SECTION=="TACONIC") ? "taconic"
  : (PROVINCE=="APPALACHIAN PLATEAUS"&&(SECTION=="CATSKILL"||SECTION=="SOUTHERN NEW YORK")) ? "plateau"
  : (PROVINCE=="VALLEY AND RIDGE"&&(SECTION=="HUDSON VALLEY"||SECTION=="MIDDLE")) ? "ridge_valley"
  : ""'

echo "→ filtering, clipping to the Northeast, simplifying, dissolving"
npx -y mapshaper@0.6.102 "$TMP/physio/physio.shp" \
  -each "$ASSIGN" \
  -filter 'province !== ""' \
  -clip bbox=-80.5,39.8,-69.2,45.7 \
  -simplify 18% keep-shapes \
  -dissolve province copy-fields=province \
  -o format=geojson precision=0.0001 "$TMP/prec.geojson"

echo "→ attaching human labels → $OUT"
jq -c '
  def lbl: {adirondack:"Adirondack Mountains",white:"White Mountains",green:"Green Mountains",
            taconic:"Taconic Mountains",plateau:"Allegheny Plateau",ridge_valley:"Ridge and Valley"};
  .features |= map(.properties = {province:.properties.province, label:(lbl[.properties.province])})
' "$TMP/prec.geojson" > "$OUT"

echo "✓ wrote $(jq '.features|length' "$OUT") provinces to $OUT"
echo "  NOTE: subranges.geojson and peaks.geojson are hand-curated — not regenerated here."
