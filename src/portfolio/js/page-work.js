// ===== CURATED WORK PAGE =====
// Grids are derived from tier + order in projects.js — edit data, not this file.
(function () {
    'use strict';
    var R = window.V2_RENDER;

    function caseStudyUrl(project) {
        return '/work/' + encodeURIComponent(project.slug) + '/';
    }

    R.renderGrid(document.getElementById('featuredWorkGrid'), R.curated('featured'), {
        hrefFn: caseStudyUrl
    });
    R.renderGrid(document.getElementById('graduateGrid'), R.curated('graduate'), {
        hrefFn: caseStudyUrl
    });
    R.renderGrid(document.getElementById('additionalGrid'), R.curated('additional'), {
        hrefFn: caseStudyUrl
    });
})();
