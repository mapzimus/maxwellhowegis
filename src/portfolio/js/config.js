// ===== V2 CONFIG =====
// BASE-path resolver. Data files store site-root-relative paths
// ("images/projects/x.png", "quabbin.html", "geopuesto/"). While v2 lives at
// /v2/ the site root is one level up; after promotion to root it's "./".
// Only render.js calls V2.asset() — data never hard-codes a prefix.
(function () {
    'use strict';
    var root = '/';
    window.V2 = {
        ROOT: root,
        SITE: 'https://maxwellhowegis.com',
        asset: function (p) {
            if (!p) return p;
            if (/^(https?:)?\/\//.test(p) || p.indexOf('mailto:') === 0) return p; // absolute → untouched
            return p.charAt(0) === '/' ? p : root + p;
        }
    };
})();
