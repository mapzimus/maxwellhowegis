// ===== HOME CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var all = window.V2_DATA.projects;

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

    // Selected recent GIS projects define the professional portfolio.
    var FEATURED = [
        'african-urbanization', 'lidar-site-studies', 'ma-atlas', 'quabbin',
        'new-england-in-motion', 'geopuesto', 'lynn-data-dive', 'ebay-packages'
    ];
    var featured = FEATURED.map(function (s) {
        return all.find(function (p) { return p.slug === s; });
    }).filter(Boolean);
    R.renderGrid(document.getElementById('featuredGrid'), featured, {
        hrefFn: function (p) { return '/work/' + encodeURIComponent(p.slug) + '/'; },
        numberPlates: true
    });
})();
