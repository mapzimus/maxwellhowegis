// ===== WORK PAGE CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var all = window.V2_DATA.projects;

    // --- Flagship band ---
    var FLAGSHIPS = ['geopuesto', 'ma-atlas', 'quabbin', 'transit', 'appalachians', 'interstate-challenge'];
    var flagshipEl = document.getElementById('flagshipGrid');
    var flagships = FLAGSHIPS.map(function (s) {
        return all.find(function (p) { return p.slug === s; });
    }).filter(Boolean);
    R.renderGrid(flagshipEl, flagships, { numberPlates: true });

    // --- Filterable project grid ---
    var projects = all.filter(function (p) { return p.kind === 'project'; });
    var grid = document.getElementById('projectGrid');
    var state = { era: null, type: null };

    var TYPE_LABELS = {
        map: 'Cartography', analysis: 'Spatial Analysis', viz: 'Data Viz',
        web: 'Web / Database', tool: 'Tools & Apps', remote: 'Remote Sensing'
    };

    function applyFilters() {
        var out = projects.filter(function (p) {
            if (state.era && p.era !== state.era) return false;
            if (state.type && p.type !== state.type) return false;
            return true;
        });
        R.renderGrid(grid, out, {
            hrefFn: function (p) { return 'project.html?id=' + encodeURIComponent(p.slug); }
        });
    }

    var eraBar = document.getElementById('eraBar');
    R.renderFilterBar(eraBar, 'Era', ['Current', 'Grad School'], function (v) {
        state.era = v === 'Current' ? 'current' : v === 'Grad School' ? 'school' : null;
        applyFilters();
    });

    var typeBar = document.getElementById('typeBar');
    var types = [];
    projects.forEach(function (p) {
        if (types.indexOf(p.type) === -1) types.push(p.type);
    });
    R.renderFilterBar(typeBar, 'Category', types.map(function (t) { return TYPE_LABELS[t] || t; }), function (v) {
        state.type = null;
        if (v) {
            Object.keys(TYPE_LABELS).some(function (k) {
                if (TYPE_LABELS[k] === v) { state.type = k; return true; }
                return false;
            });
        }
        applyFilters();
    });

    applyFilters();

    // --- Lab strip ---
    var labs = all.filter(function (p) { return p.kind === 'lab'; });
    var labEl = document.getElementById('labGrid');
    labEl.innerHTML = labs.map(function (p) {
        return '<div class="lab-card">' +
            '<div class="plate-no"><span>' + R.esc(p.category) + '</span>' + R.badge(p.status) + '</div>' +
            '<h4>' + R.esc(p.title) + '</h4>' +
            '<p>' + R.esc(p.summary) + '</p>' +
            '<div>' + (p.tags || []).map(function (t) { return '<span class="tag">' + R.esc(t) + '</span> '; }).join('') + '</div>' +
            '</div>';
    }).join('');
})();
