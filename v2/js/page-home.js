// ===== HOME CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var all = window.V2_DATA.projects;

    // --- Currently building: pills for live products + in-dev lab work ---
    var BUILDING = [
        { label: 'TappyMaps', href: 'https://tappymaps.com', state: 'live' },
        { label: 'Howe2Math', href: 'https://howe2math.com', state: 'live' },
        { label: 'WhydahStory.com', href: 'https://whydahstory.com', state: 'live' },
        { label: 'Optitrek', href: 'https://github.com/mapzimus/optitrek', state: 'dev' },
        { label: 'Calm Route', href: null, state: 'dev' },
        { label: 'Boston in Motion', href: null, state: 'dev' }
    ];
    document.getElementById('buildingStrip').innerHTML = BUILDING.map(function (b) {
        var inner = '<span class="dot dot-' + b.state + '"></span>' + esc(b.label);
        return b.href
            ? '<a class="building-pill" href="' + esc(b.href) + '" target="_blank" rel="noopener">' + inner + '</a>'
            : '<span class="building-pill">' + inner + '</span>';
    }).join('');

    // --- Featured: three flagships ---
    var FEATURED = ['geopuesto', 'ma-atlas', 'quabbin'];
    var featured = FEATURED.map(function (s) {
        return all.find(function (p) { return p.slug === s; });
    }).filter(Boolean);
    R.renderGrid(document.getElementById('featuredGrid'), featured, {
        hrefFn: function (p) { return 'project.html?id=' + encodeURIComponent(p.slug); },
        numberPlates: true
    });
})();
