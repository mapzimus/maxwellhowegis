/* ============================================================================
   COMPARE MODE — side-by-side maps, pan/zoom synced
   Different metric per side, shared level + palette + classify
   Loaded as a separate <script> after app.js so it can extend the existing
   `state`, `map`, `METRICS`, `paintExpression`, etc.
   ============================================================================ */

let mapB = null;
let stateB = null;
let _syncing = false;

function pickContrastMetric(currentId) {
    const cur = getMetric(currentId);
    const sameLevel = METRICS.filter(m => m.levels.includes(state.level) && m.id !== currentId);
    if (!sameLevel.length) return currentId;
    const differentCat = sameLevel.filter(m => m.cat !== cur.cat);
    return (differentCat[0] || sameLevel[0]).id;
}

function populateMetricSelectB() {
    const sel = document.getElementById("metricSelectB");
    if (!sel) return;
    sel.innerHTML = "";
    const candidates = METRICS.filter(m => m.levels.includes(state.level));
    const cats = [...new Set(candidates.map(m => m.cat))];
    cats.forEach(cat => {
        const grp = document.createElement("optgroup");
        grp.label = cat;
        candidates.filter(m => m.cat === cat).forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id; opt.textContent = m.label;
            grp.appendChild(opt);
        });
        sel.appendChild(grp);
    });
    sel.value = stateB.metric;
}

function paintForB(metricId) {
    return paintExpression(metricId, state.palette, state.classify, state.level);
}

function addCompareLayersToMapB() {
    const fillLayerId = state.level + "-fill-b";
    const sourceId = state.level === "muni" ? "municipalities"
                    : state.level === "district" ? "districts"
                    : "tracts";

    if (!mapB.getSource(sourceId)) {
        const mainSrc = map.getStyle().sources[sourceId];
        if (mainSrc) mapB.addSource(sourceId, mainSrc);
    }

    const cfg = {
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": paintForB(stateB.metric), "fill-opacity": 0.78 },
    };
    if (state.level === "district") {
        cfg.filter = ["==", ["get", "TYPE"], "Operating District"];
    }
    if (mapB.getLayer(fillLayerId)) mapB.removeLayer(fillLayerId);
    mapB.addLayer(cfg);

    const outlineId = state.level + "-outline-b";
    if (mapB.getLayer(outlineId)) mapB.removeLayer(outlineId);
    const outlineCfg = {
        id: outlineId,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#37474F", "line-width": 0.4, "line-opacity": 0.35 },
    };
    if (state.level === "district") {
        outlineCfg.filter = ["==", ["get", "TYPE"], "Operating District"];
    }
    mapB.addLayer(outlineCfg);

    if (!mapB._compareClickWired) {
        mapB.on("click", fillLayerId, function(e) {
            if (!e.features.length) return;
            const p = e.features[0].properties;
            const m = getMetric(stateB.metric);
            const name = p.dist_display || p.DIST_NAME || p.town_display || p.TOWN || p.NAMELSAD || "Feature";
            const val = p[stateB.metric];
            new maplibregl.Popup({ closeButton: true, maxWidth: "300px" })
                .setLngLat(e.lngLat)
                .setHTML(
                    "<div class='popup-title'>" + name + "</div>" +
                    "<div class='popup-row'><span class='label'>" + m.label + "</span>" +
                    "<span class='value'>" + fmt(+val, m.format) + "</span></div>"
                )
                .addTo(mapB);
        });
        mapB.on("mouseenter", fillLayerId, function() { mapB.getCanvas().style.cursor = "pointer"; });
        mapB.on("mouseleave", fillLayerId, function() { mapB.getCanvas().style.cursor = ""; });
        mapB._compareClickWired = true;
    }
}

function applyCompareB() {
    if (!mapB) return;
    const fillLayerId = state.level + "-fill-b";
    if (mapB.getLayer(fillLayerId)) {
        mapB.setPaintProperty(fillLayerId, "fill-color", paintForB(stateB.metric));
    } else {
        addCompareLayersToMapB();
    }
    updateCompareLabels();
}

function updateCompareLabels() {
    const labelA = document.getElementById("compareLabelA");
    if (labelA) {
        labelA.innerHTML = "";
        const span = document.createElement("span");
        span.innerHTML = "<strong>A:</strong> " + getMetric(state.metric).label;
        labelA.appendChild(span);
    }
}

function _syncFromAtoB() {
    if (_syncing || !mapB) return;
    _syncing = true;
    mapB.jumpTo({
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
    });
    _syncing = false;
}
function _syncFromBtoA() {
    if (_syncing) return;
    _syncing = true;
    map.jumpTo({
        center: mapB.getCenter(),
        zoom: mapB.getZoom(),
        bearing: mapB.getBearing(),
        pitch: mapB.getPitch(),
    });
    _syncing = false;
}

function enableCompareMode() {
    if (mapB) return;
    document.getElementById("mapsWrap").classList.add("compare");

    stateB = { metric: pickContrastMetric(state.metric) };

    mapB = new maplibregl.Map({
        container: "mapB",
        style: "https://tiles.openfreemap.org/styles/positron",
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        minZoom: 6,
        maxZoom: 18,
        attributionControl: false,
        preserveDrawingBuffer: true,
    });
    mapB.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

    mapB.on("load", function() {
        addCompareLayersToMapB();
        populateMetricSelectB();
        updateCompareLabels();
        map.on("move",  _syncFromAtoB);
        mapB.on("move", _syncFromBtoA);
        setTimeout(function() { map.resize(); mapB.resize(); }, 50);
    });

    const selB = document.getElementById("metricSelectB");
    if (selB && !selB._wired) {
        selB.addEventListener("change", function(e) {
            stateB.metric = e.target.value;
            applyCompareB();
        });
        selB._wired = true;
    }
}

function disableCompareMode() {
    if (!mapB) return;
    document.getElementById("mapsWrap").classList.remove("compare");
    map.off("move",  _syncFromAtoB);
    mapB.off("move", _syncFromBtoA);
    mapB.remove();
    mapB = null;
    stateB = null;
    setTimeout(function() { map.resize(); }, 50);
}

document.addEventListener("DOMContentLoaded", function() {
    const toggle = document.getElementById("compareToggle");
    if (toggle) {
        toggle.addEventListener("change", function(e) {
            if (e.target.checked) enableCompareMode();
            else disableCompareMode();
        });
    }
});

// Hook into the primary applyChoropleth so mapB syncs whenever the user
// changes level/metric/palette/classify in the main panel.
(function hookApplyChoropleth() {
    if (typeof applyChoropleth !== "function") return;
    const _orig = applyChoropleth;
    window.applyChoropleth = function() {
        _orig();
        if (mapB) {
            const fillLayerId = state.level + "-fill-b";
            if (!mapB.getLayer(fillLayerId)) {
                ["muni", "district", "tract"].forEach(function(lvl) {
                    ["fill-b", "outline-b"].forEach(function(suffix) {
                        const id = lvl + "-" + suffix;
                        if (mapB.getLayer(id)) mapB.removeLayer(id);
                    });
                });
                const m = getMetric(stateB.metric);
                if (!m.levels.includes(state.level)) {
                    stateB.metric = pickContrastMetric(state.metric);
                }
                populateMetricSelectB();
                addCompareLayersToMapB();
            } else {
                applyCompareB();
            }
            updateCompareLabels();
        }
    };
})();
