// ===== HOME CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var all = window.V2_DATA.projects;

    // One active build keeps the homepage current without turning it into a backlog.
    var BUILDING = [
        { label: 'Finishing Howe2Math for grades 8–11', href: 'https://howe2math.com', state: 'dev' }
    ];
    document.getElementById('buildingStrip').innerHTML = BUILDING.map(function (b) {
        var inner = '<span class="dot dot-' + b.state + '"></span>' + esc(b.label);
        return b.href
            ? '<a class="building-pill" href="' + esc(b.href) + '" target="_blank" rel="noopener">' + inner + '</a>'
            : '<span class="building-pill">' + inner + '</span>';
    }).join('');

    // Eight recent projects define the professional portfolio.
    var FEATURED = [
        'ma-atlas', 'quabbin', 'boston-in-motion', 'geopuesto',
        'appalachians', 'lynn-data-dive', 'tappymaps', 'ebay-packages'
    ];
    var featured = FEATURED.map(function (s) {
        return all.find(function (p) { return p.slug === s; });
    }).filter(Boolean);
    R.renderGrid(document.getElementById('featuredGrid'), featured, {
        hrefFn: function (p) { return '/work/' + encodeURIComponent(p.slug) + '/'; },
        numberPlates: true
    });
})();
