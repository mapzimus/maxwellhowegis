// ===== VENTURES CONTROLLER =====
// Grouped sections: Products / Education / Research & Boards.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var ventures = window.V2_DATA.ventures;
    var host = document.getElementById('ventureSections');

    var CAPTIONS = {
        'Products': 'Live, revenue-bearing, always shipping.',
        'Education': 'Built for real classrooms — Lynn, Salem, and beyond.',
        'Research & Boards': 'Engines that feed everything else.'
    };

    var order = [];
    ventures.forEach(function (v) {
        if (order.indexOf(v.group) === -1) order.push(v.group);
    });

    var h = '';
    order.forEach(function (grp, gi) {
        var group = ventures.filter(function (v) { return v.group === grp; });
        h += '<section class="section-tight"><h2>' + esc(grp) + '</h2>' +
            '<p class="marginalia" style="margin-bottom: var(--space-4);">' + esc(CAPTIONS[grp] || '') + '</p>' +
            '<div class="venture-row">' +
            group.map(function (v) { return R.renderCard(v, {}); }).join('') +
            '</div></section>';
        if (gi < order.length - 1) h += '<hr class="scalebar">';
    });
    host.innerHTML = h;
})();
