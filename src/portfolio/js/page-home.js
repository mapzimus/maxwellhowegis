// ===== HOME CONTROLLER =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;

    // What is actually on the desk this month. Keep it to two or three.
    var BUILDING = [
        { label: '30 Day Map Challenge: 7 of 30 done', href: '/30-day-maps/', state: 'live' },
        { label: 'Optimal Drives: routing videos, 30+ posted', href: '/drives/', state: 'live' },
        { label: 'Teaching stats at Lynn English, year four', href: '/about/', state: 'dev' }
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
