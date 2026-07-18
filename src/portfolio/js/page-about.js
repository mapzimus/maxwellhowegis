// ===== ABOUT — PRODUCTS & TEACHING STRIP =====
// Four live ventures as cards; the full roster (boards, in-dev work) stays on mapzimus.com.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var ventures = window.V2_DATA.ventures;

    var STRIP = ['tappymaps-venture', 'howe2math', 'lehsmath', 'whydahstory'];

    var items = STRIP.map(function (slug) {
        return ventures.find(function (v) { return v.slug === slug; });
    }).filter(Boolean);

    R.renderGrid(document.getElementById('ventureStrip'), items, {});
})();
