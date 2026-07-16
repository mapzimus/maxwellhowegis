// ===== HERO — animated topographic contours =====
// Draws slowly-drifting elevation contours (marching squares over layered
// value noise) in the current theme's line/vermilion inks. Respects
// prefers-reduced-motion (renders one static frame).
(function () {
    'use strict';

    var canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- value noise (deterministic, tiny) ---
    function hash(x, y) {
        var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return h - Math.floor(h);
    }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function noise(x, y) {
        var xi = Math.floor(x), yi = Math.floor(y);
        var xf = x - xi, yf = y - yi;
        var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
        var u = smooth(xf), v = smooth(yf);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function field(x, y, t) {
        return 0.6 * noise(x * 1.6 + t, y * 1.6) +
               0.3 * noise(x * 3.4 - t * 0.7, y * 3.4 + t * 0.3) +
               0.1 * noise(x * 7.0, y * 7.0 - t * 0.5);
    }

    var W, H, cols, rows, CELL = 26;

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth; H = canvas.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(W / CELL) + 1;
        rows = Math.ceil(H / CELL) + 1;
    }

    function css(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    // Edge pairs crossed by the iso-line for each marching-squares case.
    // Edges: 0=top 1=right 2=bottom 3=left. Static — allocated once, not per cell.
    var CASES = [
        null, [3, 2], [2, 1], [3, 1], [0, 1], [0, 3, 2, 1], [0, 2], [0, 3],
        [0, 3], [0, 2], [0, 1, 2, 3], [0, 1], [3, 1], [2, 1], [3, 2], null
    ];

    // Interpolate along one cell edge; t clamped so equal corner values
    // (division by ~0) can never emit Infinity coordinates.
    function edgePoint(edge, x, y, level, tl, tr, bl, br, out) {
        var va, vb, t;
        if (edge === 0)      { va = tl; vb = tr; }
        else if (edge === 1) { va = tr; vb = br; }
        else if (edge === 2) { va = bl; vb = br; }
        else                 { va = tl; vb = bl; }
        t = (vb - va) === 0 ? 0.5 : (level - va) / (vb - va);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (edge === 0)      { out[0] = x + CELL * t; out[1] = y; }
        else if (edge === 1) { out[0] = x + CELL;     out[1] = y + CELL * t; }
        else if (edge === 2) { out[0] = x + CELL * t; out[1] = y + CELL; }
        else                 { out[0] = x;            out[1] = y + CELL * t; }
    }

    var PT = [0, 0]; // scratch, avoids per-segment allocation

    function drawLevel(vals, level) {
        ctx.beginPath();
        for (var j = 0; j < rows - 1; j++) {
            for (var i = 0; i < cols - 1; i++) {
                var tl = vals[j * cols + i], tr = vals[j * cols + i + 1];
                var bl = vals[(j + 1) * cols + i], br = vals[(j + 1) * cols + i + 1];
                var idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
                var edges = CASES[idx];
                if (!edges) continue;
                var x = i * CELL, y = j * CELL;
                for (var s = 0; s < edges.length; s += 2) {
                    edgePoint(edges[s], x, y, level, tl, tr, bl, br, PT);
                    ctx.moveTo(PT[0], PT[1]);
                    edgePoint(edges[s + 1], x, y, level, tl, tr, bl, br, PT);
                    ctx.lineTo(PT[0], PT[1]);
                }
            }
        }
        ctx.stroke();
    }

    var LEVELS = [0.35, 0.42, 0.49, 0.56, 0.63, 0.7];
    var INDEX_EVERY = 3; // every 3rd contour is an "index contour" — heavier, vermilion

    function frame(t) {
        ctx.clearRect(0, 0, W, H);
        var vals = new Float32Array(cols * rows);
        for (var j = 0; j < rows; j++)
            for (var i = 0; i < cols; i++)
                vals[j * cols + i] = field(i * CELL / W * 2.2, j * CELL / H * 1.4, t);

        var line = css('--line-strong') || '#b3aa97';
        var accent = css('--vermilion') || '#c53d1c';
        for (var L = 0; L < LEVELS.length; L++) {
            var isIndex = L % INDEX_EVERY === 0;
            ctx.strokeStyle = isIndex ? accent : line;
            ctx.globalAlpha = isIndex ? 0.5 : 0.55;
            ctx.lineWidth = isIndex ? 1.4 : 0.8;
            drawLevel(vals, LEVELS[L]);
        }
        ctx.globalAlpha = 1;
    }

    // The drift is glacial, so ~20fps is indistinguishable from 60 — throttle
    // to keep the hero nearly free on the main thread.
    var t0 = null, last = 0;
    function loop(ts) {
        if (t0 === null) t0 = ts;
        if (W === 0 && canvas.clientWidth > 0) resize(); // loaded while hidden
        if (ts - last > 50) {
            last = ts;
            frame((ts - t0) / 24000); // very slow drift
        }
        requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', function () { resize(); if (reduced) frame(0.5); });
    document.addEventListener('v2:theme', function () { if (reduced) frame(0.5); });

    if (reduced) { frame(0.5); } else { requestAnimationFrame(loop); }
})();
