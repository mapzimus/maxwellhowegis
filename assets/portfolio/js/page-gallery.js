// ===== GALLERY CONTROLLER =====
// Fetches js/data/gallery.json (extracted from v1's hand-coded bricks)
// and renders a filterable masonry wall with a lightbox.
(function () {
    'use strict';
    var R = window.V2_RENDER;
    var esc = R.esc;
    var wall = document.getElementById('wall');
    var tagBar = document.getElementById('tagBar');
    var countEl = document.getElementById('count');

    fetch('js/data/gallery.json')
        .then(function (r) {
            if (!r.ok) throw new Error('gallery.json ' + r.status);
            return r.json();
        })
        .then(init)
        .catch(function (err) {
            wall.innerHTML = '<div class="empty-note">Could not load the gallery data (' +
                esc(err.message) + '). If you opened this page from disk, serve it over HTTP:' +
                ' <code>python -m http.server</code></div>';
        });

    function init(items) {
        countEl.textContent = items.length;

        // Top tags by frequency (the long tail stays reachable via "All")
        var freq = {};
        items.forEach(function (it) {
            (it.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; });
        });
        var topTags = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 12);

        var current = items;

        function draw(list) {
            wall.innerHTML = list.map(function (it) {
                var i = items.indexOf(it);
                return '<figure class="brick" data-i="' + i + '">' +
                    '<img src="' + esc(window.V2.asset(it.src)) + '" alt="' + esc(it.alt || it.title) + '" loading="lazy">' +
                    '<figcaption><span>' + esc(it.label || it.title) + '</span>' +
                    '<span class="b-tags">' + (it.tags || []).slice(0, 2).map(esc).join(' · ') + '</span></figcaption>' +
                    '</figure>';
            }).join('');
        }

        R.renderFilterBar(tagBar, 'Filter', topTags, function (tag) {
            current = tag
                ? items.filter(function (it) { return (it.tags || []).indexOf(tag) !== -1; })
                : items;
            countEl.textContent = current.length;
            draw(current);
        });

        wall.addEventListener('click', function (e) {
            var f = e.target.closest('.brick');
            if (!f) return;
            var globalIndex = parseInt(f.getAttribute('data-i'), 10);
            var localIndex = current.indexOf(items[globalIndex]);
            R.openLightbox(current, localIndex === -1 ? 0 : localIndex);
        });

        draw(items);
    }
})();
