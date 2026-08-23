// ===== CURATED WORK PAGE =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var all = window.V2_DATA.projects;

    var FEATURED = [
        'lidar-site-studies', 'ma-atlas', 'quabbin', 'new-england-in-motion',
        'geopuesto', 'lynn-data-dive', 'ebay-packages'
    ];
    var GRADUATE = ['salem-pantry', 'lynn-absenteeism'];
    var ADDITIONAL = ['appalachians', 'optitrek', 'tappymaps'];

    function ordered(slugs) {
        return slugs.map(function (slug) {
            return all.find(function (project) { return project.slug === slug; });
        }).filter(Boolean);
    }

    function caseStudyUrl(project) {
        return '/work/' + encodeURIComponent(project.slug) + '/';
    }

    R.renderGrid(document.getElementById('featuredWorkGrid'), ordered(FEATURED), {
        hrefFn: caseStudyUrl
    });
    R.renderGrid(document.getElementById('graduateGrid'), ordered(GRADUATE), {
        hrefFn: caseStudyUrl
    });
    R.renderGrid(document.getElementById('additionalGrid'), ordered(ADDITIONAL), {
        hrefFn: caseStudyUrl,
        showThumb: false
    });
})();
