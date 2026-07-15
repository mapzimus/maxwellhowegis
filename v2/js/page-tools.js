// ===== TOOLS CONTROLLER =====
// Renders the 22 tools grouped into their four categories.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var tools = window.V2_DATA.tools;
    var host = document.getElementById('toolSections');

    var CAPTIONS = {
        'Full Apps': 'Complete standalone web apps — bigger than a utility, focused like a tool.',
        'Maps & GIS': 'Coordinates, GeoJSON, geocoding, and other spatial odds and ends.',
        'Data': 'Charts, CSVs, converters, and synthetic data.',
        'Design & Media': 'Palettes, CSS, images, QR codes, markdown.',
        'Teaching': 'Classroom workflow tools — rosters and student work never leave the browser.',
        'Fun & Learning': 'Equations, units, and decision-making by spinning wheel.'
    };

    var order = [];
    tools.forEach(function (t) {
        if (order.indexOf(t.category) === -1) order.push(t.category);
    });

    var h = '';
    order.forEach(function (cat, ci) {
        var group = tools.filter(function (t) { return t.category === cat; });
        h += '<section class="section-tight"><h2>' + esc(cat) + '</h2>' +
            '<p class="marginalia" style="margin-bottom: var(--space-4);">' +
            esc(CAPTIONS[cat] || '') + ' · ' + group.length + ' tools</p>' +
            '<div class="grid' + (cat === 'Full Apps' ? ' grid-wide' : '') + '">' +
            group.map(function (t) { return R.renderCard(t, {}); }).join('') +
            '</div></section>';
        if (ci < order.length - 1) h += '<hr class="scalebar">';
    });
    host.innerHTML = h;
})();
