// ===== HOME CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;

    // One active build keeps the homepage current without turning it into a backlog.
    var BUILDING = [
        { label: 'Building a Massachusetts housing-suitability model — Phase 2', href: 'https://github.com/mapzimus/predicting-housing-crisis', state: 'dev' }
    ];
    document.getElementById('buildingStrip').innerHTML = BUILDING.map(function (b) {
        var inner = '<span class="dot dot-' + b.state + '"></span>' + esc(b.label);
        return b.href
            ? '<a class="building-pill" href="' + esc(b.href) + '"' +
                (/^https?:/.test(b.href) ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>'
            : '<span class="building-pill">' + inner + '</span>';
    }).join('');

    // Featured tier + order in projects.js is the single source of curation.
    R.renderGrid(document.getElementById('featuredGrid'), R.curated('featured'), {
        hrefFn: function (p) { return '/work/' + encodeURIComponent(p.slug) + '/'; },
        numberPlates: true
    });
})();
