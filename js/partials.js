// ===== SHARED NAV + FOOTER PARTIALS =====
// Used by legacy writeups (lynn.html, quabbin.html) that still load the
// dark chrome in css/style.css. Keep the IA aligned with the professional
// portfolio so these pages don't advertise retired routes.
(function () {
    'use strict';

    var NAV_LINKS = [
        { href: '/work/', label: 'Work' },
        { href: '/about/', label: 'About' },
        { href: '/contact/', label: 'Contact' }
    ];

    var FOOTER_LINKS = [
        { href: '/', label: 'Home' },
        { href: '/work/', label: 'Work' },
        { href: '/about/', label: 'About' },
        { href: '/contact/', label: 'Contact' },
        { href: 'https://mapzimus.com', label: 'Mapzimus', external: true },
        { href: 'https://github.com/mapzimus', label: 'GitHub', external: true }
    ];

    var pathname = window.location.pathname;

    function navHTML() {
        var items = NAV_LINKS.map(function (l) {
            var active = pathname === l.href || (l.href !== '/' && pathname.indexOf(l.href) === 0)
                ? ' class="active" aria-current="page"'
                : '';
            return '            <li><a href="' + l.href + '"' + active + '>' + l.label + '</a></li>';
        }).join('\n');
        return '<nav class="nav">\n' +
            '    <div class="nav-inner">\n' +
            '        <a href="/" class="nav-logo">Maxwell Howe</a>\n' +
            '        <ul class="nav-links" id="navLinks">\n' +
            items + '\n' +
            '        </ul>\n' +
            '        <button class="nav-hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">\n' +
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
        var year = new Date().getFullYear();
        return '<footer class="footer">\n' +
            '    <div class="footer-inner">\n' +
            '        <p>&copy; ' + year + ' Maxwell Howe · Salem, MA</p>\n' +
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
