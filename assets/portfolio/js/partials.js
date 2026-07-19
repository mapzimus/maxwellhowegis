// ===== V2 NAV + FOOTER =====
// Injected into <div id="site-nav"></div> / <div id="site-footer"></div>.
// Loaded at end of <body>, runs synchronously (same pattern as v1 js/partials.js).
(function () {
    'use strict';

    var NAV_LINKS = [
        { href: '/work/', label: 'Work', path: '/work/' },
        { href: '/about/', label: 'About', path: '/about/' },
        { href: '/resume/', label: 'Resume', path: '/resume/' },
        { href: '/contact/', label: 'Contact', path: '/contact/' },
        { href: 'https://mapzimus.com', label: 'Mapzimus ↗', external: true, secondary: true }
    ];

    var FOOTER_LINKS = [
        { href: '/', label: 'Home' },
        { href: '/work/', label: 'Work' },
        { href: '/about/', label: 'About' },
        { href: '/resume/', label: 'Resume' },
        { href: '/contact/', label: 'Contact' },
        { href: 'https://mapzimus.com', label: 'Mapzimus', external: true },
        { href: 'https://github.com/mapzimus', label: 'GitHub', external: true }
    ];

    // Compass-rose mark (inline SVG, currentColor-aware)
    var MARK =
        '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">' +
        '<circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" stroke-width="1"/>' +
        '<circle cx="13" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.45"/>' +
        '<path d="M13 2.5 L15 13 L13 23.5 L11 13 Z" fill="#c53d1c"/>' +
        '<path d="M2.5 13 L13 11 L23.5 13 L13 15 Z" fill="currentColor" opacity="0.55"/>' +
        '<circle cx="13" cy="13" r="1.4" fill="currentColor"/>' +
        '</svg>';

    var pathname = window.location.pathname;

    function navHTML() {
        var items = NAV_LINKS.map(function (l) {
            var active = l.path && (pathname === l.path || pathname.indexOf(l.path) === 0)
                ? ' active' : '';
            var classes = [l.secondary ? 'nav-secondary' : '', active].filter(Boolean).join(' ');
            var attrs = (classes ? ' class="' + classes + '"' : '') +
                (active ? ' aria-current="page"' : '') +
                (l.external ? ' target="_blank" rel="noopener"' : '');
            return '<li><a href="' + l.href + '"' + attrs + '>' + l.label + '</a></li>';
        }).join('');
        return '<header class="nav"><div class="nav-inner">' +
            '<a href="/" class="nav-logo">' + MARK + 'Maxwell Howe</a>' +
            '<ul class="nav-links" id="navLinks">' + items +
            '<li><button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle color theme">Theme</button></li>' +
            '</ul>' +
            '<button class="nav-hamburger" id="hamburger" aria-label="Menu" aria-expanded="false">' +
            '<span></span><span></span><span></span></button>' +
            '</div></header>';
    }

    function footerHTML() {
        var items = FOOTER_LINKS.map(function (l) {
            var attrs = l.external ? ' target="_blank" rel="noopener"' : '';
            return '<li><a href="' + l.href + '"' + attrs + '>' + l.label + '</a></li>';
        }).join('');
        var year = new Date().getFullYear();
        return '<footer class="footer"><div class="footer-inner">' +
            '<div class="footer-colophon">&copy; ' + year + ' Maxwell Howe · Salem, MA<br>' +
            'Web GIS developer and spatial analyst.</div>' +
            '<ul class="footer-links">' + items + '</ul>' +
            '</div></footer>';
    }

    var navSlot = document.getElementById('site-nav');
    if (navSlot) navSlot.outerHTML = navHTML();
    var footSlot = document.getElementById('site-footer');
    if (footSlot) footSlot.outerHTML = footerHTML();

    // Wiring (elements now exist)
    var burger = document.getElementById('hamburger');
    var links = document.getElementById('navLinks');
    if (burger && links) {
        burger.addEventListener('click', function () {
            var open = links.classList.toggle('open');
            burger.setAttribute('aria-expanded', String(open));
        });
    }
    var toggle = document.getElementById('themeToggle');
    if (toggle && window.V2_THEME) {
        toggle.addEventListener('click', window.V2_THEME.toggle);
        window.V2_THEME.refreshButton();
    }
})();
