// ===== THEME — light "field paper" / dark "night chart" =====
// Runs synchronously in <head> to avoid a flash of wrong theme.
(function () {
    'use strict';
    var KEY = 'v2-theme';
    function preferred() {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light';
    }
    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        var btn = document.getElementById('themeToggle');
        if (btn) btn.textContent = theme === 'dark' ? '☀ Day' : '☾ Night';
    }
    apply(preferred());

    // Toggle wiring happens after partials injection (nav owns the button).
    window.V2_THEME = {
        toggle: function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
            apply(next);
            document.dispatchEvent(new CustomEvent('v2:theme', { detail: next }));
        },
        refreshButton: function () { apply(document.documentElement.getAttribute('data-theme')); }
    };
})();
