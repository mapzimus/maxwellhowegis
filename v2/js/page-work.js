// ===== WORK PAGE CONTROLLER =====
// Two sections + in-dev strip, each independently filterable by category.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var all = window.V2_DATA.projects;

    var TYPE_LABELS = {
        map: 'Cartography', analysis: 'Spatial Analysis', viz: 'Data Viz',
        web: 'Web / Database', tool: 'Tools & Apps', remote: 'Remote Sensing'
    };

    // Flagships lead the Interactive Maps & Apps section, in this order.
    var FLAGSHIP_ORDER = ['geopuesto', 'ma-atlas', 'quabbin', 'transit',
        'appalachians', 'boston-in-motion', 'where-games-go'];

    function flagshipRank(p) {
        var i = FLAGSHIP_ORDER.indexOf(p.slug);
        return i === -1 ? FLAGSHIP_ORDER.length : i;
    }

    var maps = all.filter(function (p) { return p.kind === 'project' && p.era === 'current'; })
        .sort(function (a, b) { return flagshipRank(a) - flagshipRank(b); });
    var cases = all.filter(function (p) { return p.kind === 'project' && p.era === 'school'; });
    var labs = all.filter(function (p) { return p.kind === 'lab'; });

    // One reusable section wiring: filter bar + grid over a fixed item list.
    function wireSection(items, filterId, gridId) {
        var grid = document.getElementById(gridId);
        var bar = document.getElementById(filterId);
        var types = [];
        items.forEach(function (p) {
            if (types.indexOf(p.type) === -1) types.push(p.type);
        });

        function draw(typeKey) {
            var out = typeKey
                ? items.filter(function (p) { return p.type === typeKey; })
                : items;
            R.renderGrid(grid, out, {
                hrefFn: function (p) { return 'project.html?id=' + encodeURIComponent(p.slug); }
            });
        }

        R.renderFilterBar(bar, 'Filter', types.map(function (t) { return TYPE_LABELS[t] || t; }), function (v) {
            var key = null;
            if (v) {
                Object.keys(TYPE_LABELS).some(function (k) {
                    if (TYPE_LABELS[k] === v) { key = k; return true; }
                    return false;
                });
            }
            draw(key);
        });
        draw(null);
    }

    wireSection(maps, 'mapsFilter', 'mapsGrid');
    wireSection(cases, 'casesFilter', 'casesGrid');

    // --- In development strip ---
    var devEl = document.getElementById('devGrid');
    devEl.innerHTML = labs.map(function (p) {
        return '<div class="lab-card">' +
            '<div class="plate-no"><span>' + R.esc(p.category) + '</span>' + R.badge(p.status) + '</div>' +
            '<h4>' + R.esc(p.title) + '</h4>' +
            '<p>' + R.esc(p.summary) + '</p>' +
            '<div>' + (p.tags || []).map(function (t) { return '<span class="tag">' + R.esc(t) + '</span> '; }).join('') + '</div>' +
            '</div>';
    }).join('');
})();
