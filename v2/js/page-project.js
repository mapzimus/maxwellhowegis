// ===== PROJECT DETAIL CONTROLLER =====
// Renders one project from ?id=slug. Replaces v1's five hand-built detail pages.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var el = document.getElementById('detail');

    var slug = new URLSearchParams(window.location.search).get('id');
    var p = window.V2_DATA.projects.find(function (x) { return x.slug === slug; });

    if (!p) {
        el.innerHTML = '<header class="page-head"><div class="kicker">404 — Off the map</div>' +
            '<h1>Plate not found</h1>' +
            '<p class="lede">No project matches this reference. ' +
            '<a href="work.html">Return to the index of plates</a>.</p></header>';
        document.title = 'Not found — Maxwell Howe';
        return;
    }

    document.title = p.title + ' — Maxwell Howe';

    var L = p.links || {};
    var actions = '';
    if (L.live) {
        actions += '<a class="btn" href="' + esc(window.V2.asset(L.live)) + '"' +
            (/^https?:/.test(L.live) ? ' target="_blank" rel="noopener"' : '') + '>Open the project ↗</a> ';
    }
    if (L.repo) {
        actions += '<a class="btn btn-ghost" href="' + esc(L.repo) + '" target="_blank" rel="noopener">Source ↗</a>';
    }

    var marginalia = [
        p.category, p.year,
        p.course || null,
        p.groupProject ? 'Group project' : null
    ].filter(Boolean).map(esc).join(' · ');

    var h = '<header class="page-head">' +
        '<div class="kicker">' + esc(p.era === 'school' ? 'Grad School Series' : 'Current Series') + '</div>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<div class="marginalia" style="margin-bottom: var(--space-3);">' + marginalia + ' ' + R.badge(p.status) + '</div>' +
        '<hr class="tick-rule"></header>';

    h += '<div class="detail-head section-tight">';
    h += '<div><p class="lede">' + esc(p.summary) + '</p>' +
        (p.description ? '<div class="detail-desc"><p>' + esc(p.description) + '</p></div>' : '') +
        '<div class="hero-actions">' + actions + '</div></div>';

    h += '<aside><div class="datum-block">' +
        '<b>SPECIFICATIONS</b><br>' +
        (p.tools || []).map(esc).join(' · ') +
        '<br><br><b>TAGS</b><br>' +
        (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') +
        '</div></aside></div>';

    if (p.gallery && p.gallery.length) {
        h += '<hr class="scalebar"><section class="section-tight"><h2>Figures</h2>' +
            '<div class="detail-figures" id="figs">' +
            p.gallery.map(function (g, i) {
                return '<figure class="brick" data-i="' + i + '">' +
                    '<img src="' + esc(window.V2.asset(g.src)) + '" alt="' + esc(g.caption) + '" loading="lazy">' +
                    '<figcaption><span>Fig. ' + (i + 1) + '</span><span class="b-tags">' + esc(g.caption) + '</span></figcaption>' +
                    '</figure>';
            }).join('') + '</div></section>';
    }

    h += '<p style="margin-top: var(--space-5);"><a href="work.html">← All work</a></p>';
    el.innerHTML = h;

    var figs = document.getElementById('figs');
    if (figs) {
        var items = p.gallery.map(function (g) {
            return { src: g.src, title: p.title, caption: g.caption, tags: [] };
        });
        figs.addEventListener('click', function (e) {
            var f = e.target.closest('.brick');
            if (f) R.openLightbox(items, parseInt(f.getAttribute('data-i'), 10));
        });
    }
})();
