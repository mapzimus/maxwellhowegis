// ===== CURATED WORK PAGE =====
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var all = window.V2_DATA.projects;

    var FEATURED = [
        'ma-atlas', 'quabbin', 'boston-in-motion', 'geopuesto',
        'appalachians', 'lynn-data-dive', 'tappymaps', 'ebay-packages'
    ];
    var GRADUATE = ['salem-pantry', 'lynn-absenteeism'];
    var ADDITIONAL = ['optitrek', 'open-concord', 'pockettiles', 'salem-photo-walk'];

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
