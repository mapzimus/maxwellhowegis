// ===== SHARED RENDERERS — plate cards, badges, filters, lightbox =====
// Every page renders through these so the whole site speaks one card language.
// All data values pass through esc() before touching the DOM.
(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var STATUS_LABEL = { live: 'Live', development: 'In Dev', archived: 'Archived' };

    function badge(status) {
        if (!status || !STATUS_LABEL[status]) return '';
        return '<span class="badge badge-' + status + '">' + STATUS_LABEL[status] + '</span>';
    }

    // Primary link for a card: live > writeup > repo
    function primaryLink(item) {
        var L = item.links || {};
        return L.live || L.writeup || L.repo || null;
    }

    function isExternal(url) { return /^https?:\/\//.test(url || ''); }

    // ---- Plate card ----
    // opts: { plateNo, showThumb (default true), hrefFn(item) → override link }
    function renderCard(item, opts) {
        opts = opts || {};
        // hrefFn gives a v2-internal link (used as-is); data links are
        // site-root-relative and go through the BASE resolver.
        var ownHref = opts.hrefFn && opts.hrefFn(item);
        var href = ownHref || primaryLink(item);
        var resolved = ownHref ? ownHref : (href ? window.V2.asset(href) : null);
        var ext = isExternal(href);
        var tag = resolved ? 'a' : 'div';

        var h = '<' + tag + ' class="plate"' +
            (resolved ? ' href="' + esc(resolved) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') : '') + '>';

        if (item.thumb && opts.showThumb !== false) {
            h += '<figure class="plate-figure"><img src="' + esc(window.V2.asset(item.thumb)) +
                '" alt="' + esc(item.title) + '" loading="lazy"></figure>';
        }

        h += '<div class="plate-body">';
        h += '<div class="plate-no"><span>' +
            (opts.plateNo ? 'Plate ' + esc(opts.plateNo) : esc(item.category || item.kind || '')) +
            '</span><span>' + esc(item.year || '') + '</span></div>';
        h += '<h3>' + (item.icon ? esc(item.icon) + ' ' : '') + esc(item.title) + '</h3>';
        if (item.summary) h += '<p class="summary">' + esc(item.summary) + '</p>';

        h += '<div class="plate-meta">';
        h += badge(item.status);
        if (ext) h += '<span class="badge badge-external">↗ External</span>';
        (item.tags || []).slice(0, 4).forEach(function (t) {
            h += '<span class="tag">' + esc(t) + '</span>';
        });
        h += '</div></div></' + tag + '>';
        return h;
    }

    function renderGrid(el, items, opts) {
        opts = opts || {};
        if (!items.length) {
            el.innerHTML = '<div class="empty-note">No plates match this filter.</div>';
            return;
        }
        el.innerHTML = items.map(function (it, i) {
            var o = Object.assign({}, opts);
            if (opts.numberPlates) o.plateNo = romanize(i + 1);
            return renderCard(it, o);
        }).join('');
    }

    function romanize(n) {
        var map = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        var out = '';
        map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
        return out;
    }

    // ---- Filter bar ----
    // Builds pressable chips; calls onChange(activeValue|null).
    function renderFilterBar(el, label, values, onChange) {
        var h = '<span class="fb-label">' + esc(label) + '</span>';
        h += '<button class="chip" data-val="" aria-pressed="true">All</button>';
        values.forEach(function (v) {
            h += '<button class="chip" data-val="' + esc(v) + '" aria-pressed="false">' + esc(v) + '</button>';
        });
        el.innerHTML = h;
        el.addEventListener('click', function (e) {
            var btn = e.target.closest('.chip');
            if (!btn) return;
            el.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
            btn.setAttribute('aria-pressed', 'true');
            onChange(btn.getAttribute('data-val') || null);
        });
    }

    // ---- Lightbox (shared by gallery + project detail) ----
    var lb = null, lbItems = [], lbIndex = 0;

    function ensureLightbox() {
        if (lb) return;
        lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.innerHTML =
            '<button class="lightbox-close" aria-label="Close">✕</button>' +
            '<button class="lightbox-nav lightbox-prev" aria-label="Previous">←</button>' +
            '<div class="lightbox-inner"><img alt=""><div class="lightbox-caption"></div></div>' +
            '<button class="lightbox-nav lightbox-next" aria-label="Next">→</button>';
        document.body.appendChild(lb);
        lb.querySelector('.lightbox-close').addEventListener('click', close);
        lb.querySelector('.lightbox-prev').addEventListener('click', function () { show(lbIndex - 1); });
        lb.querySelector('.lightbox-next').addEventListener('click', function () { show(lbIndex + 1); });
        lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
        document.addEventListener('keydown', function (e) {
            if (!lb.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') show(lbIndex - 1);
            if (e.key === 'ArrowRight') show(lbIndex + 1);
        });
    }

    function show(i) {
        lbIndex = (i + lbItems.length) % lbItems.length;
        var it = lbItems[lbIndex];
        lb.querySelector('img').src = window.V2.asset(it.src);
        lb.querySelector('img').alt = it.alt || it.title || '';
        var cap = lb.querySelector('.lightbox-caption');
        var linkHtml = '';
        var target = it.link || (it.cta && it.cta.href);
        if (target) {
            linkHtml = '<a href="' + esc(window.V2.asset(target)) + '"' +
                (isExternal(target) ? ' target="_blank" rel="noopener"' : '') + '>' +
                esc((it.cta && it.cta.text) || 'Open project →') + '</a>';
        }
        cap.innerHTML = '<h3>' + esc(it.title) + '</h3>' +
            '<p>' + esc(it.caption || '') + '</p>' +
            '<div class="marginalia">' + (it.tags || []).map(esc).join(' · ') + '</div>' + linkHtml;
    }

    function open(items, index) {
        ensureLightbox();
        lbItems = items;
        show(index || 0);
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        lb.classList.remove('open');
        document.body.style.overflow = '';
    }

    window.V2_RENDER = {
        esc: esc,
        badge: badge,
        renderCard: renderCard,
        renderGrid: renderGrid,
        renderFilterBar: renderFilterBar,
        openLightbox: open
    };
})();
