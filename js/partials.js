// ===== SHARED NAV + FOOTER PARTIALS =====
// Injects the site-wide nav and footer into <div id="site-nav"></div> and
// <div id="site-footer"></div> placeholders. Loaded at the end of <body>
// BEFORE js/main.js, so it runs synchronously during parse: the placeholders
// already exist, and main.js's DOMContentLoaded wiring (hamburger toggle,
// active-link highlighting) finds the injected DOM afterwards.
//
// Edit the nav/footer in ONE place here — never per-page.

(function () {
    'use strict';

    var NAV_LINKS = [
        { href: 'about.html', label: 'About' },
        { href: 'portfolio.html', label: 'Projects' },
        { href: 'gallery.html', label: 'Map Gallery' },
        { href: 'side-projects.html', label: 'Beyond GIS' },
        { href: 'tools.html', label: 'Tools' },
        { href: 'fieldnotes.html', label: 'Field Notes' },
        { href: 'contact.html', label: 'Contact' }
    ];

    var FOOTER_LINKS = [
        { href: 'index.html', label: 'Home' },
        { href: 'portfolio.html', label: 'Projects' },
        { href: 'gallery.html', label: 'Map Gallery' },
        { href: 'side-projects.html', label: 'Beyond GIS' },
        { href: 'fieldnotes.html', label: 'Field Notes' },
        { href: 'tools.html', label: 'Tools' },
        { href: 'about.html', label: 'About' },
        { href: 'contact.html', label: 'Contact' },
        { href: 'feedback.html', label: 'Ideas' },
        { href: 'links.html', label: 'Links' },
        { href: 'https://github.com/mapzimus', label: 'GitHub', external: true }
    ];

    // Current page for active-link highlighting ('' or '/' -> index.html)
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';

    function navHTML() {
        var items = NAV_LINKS.map(function (l) {
            var active = l.href === currentPage
                ? ' class="active" aria-current="page"'
                : '';
            return '            <li><a href="' + l.href + '"' + active + '>' + l.label + '</a></li>';
        }).join('\n');
        return '<nav class="nav">\n' +
            '    <div class="nav-inner">\n' +
            '        <a href="index.html" class="nav-logo">Maxwell Howe</a>\n' +
            '        <ul class="nav-links" id="navLinks">\n' +
            items + '\n' +
            '        </ul>\n' +
            '        <button class="nav-hamburger" id="hamburger" aria-label="Menu">\n' +
            '            <span></span><span></span><span></span>\n' +
            '        </button>\n' +
            '    </div>\n' +
            '</nav>';
    }

    function footerHTML() {
        var items = FOOTER_LINKS.map(function (l) {
            var attrs = l.external ? ' target="_blank" rel="noopener"' : '';
            return '            <li><a href="' + l.href + '"' + attrs + '>' + l.label + '</a></li>';
        }).join('\n');
        return '<footer class="footer">\n' +
            '    <div class="footer-inner">\n' +
            '        <p>&copy; 2026 Maxwell Howe</p>\n' +
            '        <ul class="footer-links">\n' +
            items + '\n' +
            '        </ul>\n' +
            '    </div>\n' +
            '</footer>';
    }

    var navSlot = document.getElementById('site-nav');
    if (navSlot) navSlot.outerHTML = navHTML();

    var footerSlot = document.getElementById('site-footer');
    if (footerSlot) footerSlot.outerHTML = footerHTML();
})();
