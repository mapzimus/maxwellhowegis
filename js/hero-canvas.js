/**
 * Animated Topographic Contour Hero
 * Draws flowing contour lines that slowly shift — on-brand for a GIS portfolio.
 */
(function() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, time = 0, animId;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Simple 2D noise (value noise with smoothing)
    const PERM = new Uint8Array(512);
    (function initPerm() {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    })();

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    function grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    function noise(x, y) {
        const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = fade(xf), v = fade(yf);
        const a = PERM[xi] + yi, b = PERM[xi + 1] + yi;
        return lerp(
            lerp(grad(PERM[a], xf, yf), grad(PERM[b], xf - 1, yf), u),
            lerp(grad(PERM[a + 1], xf, yf - 1), grad(PERM[b + 1], xf - 1, yf - 1), u),
            v
        );
    }

    function fbm(x, y, octaves) {
        let val = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < octaves; i++) {
            val += noise(x * freq, y * freq) * amp;
            max += amp;
            amp *= 0.5;
            freq *= 2;
        }
        return val / max;
    }

    // Marching squares for contour extraction
    function getContourPaths(field, cols, rows, threshold, cellW, cellH) {
        const paths = [];
        for (let y = 0; y < rows - 1; y++) {
            for (let x = 0; x < cols - 1; x++) {
                const tl = field[y * cols + x] >= threshold ? 1 : 0;
                const tr = field[y * cols + x + 1] >= threshold ? 1 : 0;
                const br = field[(y + 1) * cols + x + 1] >= threshold ? 1 : 0;
                const bl = field[(y + 1) * cols + x] >= threshold ? 1 : 0;
                const code = tl * 8 + tr * 4 + br * 2 + bl;
                if (code === 0 || code === 15) continue;

                const ax = x * cellW, ay = y * cellH;
                const v_tl = field[y * cols + x];
                const v_tr = field[y * cols + x + 1];
                const v_br = field[(y + 1) * cols + x + 1];
                const v_bl = field[(y + 1) * cols + x];

                function interpX(va, vb, baseX, baseY) {
                    const t = (threshold - va) / (vb - va);
                    return [baseX + t * cellW, baseY];
                }
                function interpY(va, vb, baseX, baseY) {
                    const t = (threshold - va) / (vb - va);
                    return [baseX, baseY + t * cellH];
                }

                const top = interpX(v_tl, v_tr, ax, ay);
                const right = interpY(v_tr, v_br, ax + cellW, ay);
                const bottom = interpX(v_bl, v_br, ax, ay + cellH);
                const left = interpY(v_tl, v_bl, ax, ay);

                const segments = [];
                switch (code) {
                    case 1: case 14: segments.push([left, bottom]); break;
                    case 2: case 13: segments.push([bottom, right]); break;
                    case 3: case 12: segments.push([left, right]); break;
                    case 4: case 11: segments.push([top, right]); break;
                    case 5: segments.push([left, top], [bottom, right]); break;
                    case 6: case 9: segments.push([top, bottom]); break;
                    case 7: case 8: segments.push([left, top]); break;
                    case 10: segments.push([left, bottom], [top, right]); break;
                }
                for (const seg of segments) paths.push(seg);
            }
        }
        return paths;
    }

    function draw() {
        time += 0.003;
        ctx.clearRect(0, 0, w, h);

        // Generate noise field
        const cellSize = 12;
        const cols = Math.ceil(w / cellSize) + 1;
        const rows = Math.ceil(h / cellSize) + 1;
        const field = new Float32Array(cols * rows);
        const scale = 0.008;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                field[y * cols + x] = fbm(x * cellSize * scale + time * 0.5, y * cellSize * scale + time * 0.3, 4);
            }
        }

        // Draw contour lines at multiple thresholds
        const levels = 12;
        for (let i = 0; i < levels; i++) {
            const t = -0.6 + (i / levels) * 1.2;
            const paths = getContourPaths(field, cols, rows, t, cellSize, cellSize);
            const alpha = 0.06 + 0.08 * (1 - Math.abs(i - levels / 2) / (levels / 2));

            // Color shifts from blue to teal across levels
            const hue = 200 + (i / levels) * 40;
            ctx.strokeStyle = `hsla(${hue}, 70%, 70%, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const [p1, p2] of paths) {
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p2[0], p2[1]);
            }
            ctx.stroke();
        }

        // Coordinate grid overlay
        ctx.strokeStyle = 'rgba(135, 195, 255, 0.04)';
        ctx.lineWidth = 0.5;
        const gridSpacing = 120;
        for (let x = 0; x < w; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Coordinate tick marks at intersections
        ctx.fillStyle = 'rgba(135, 195, 255, 0.08)';
        ctx.font = '9px JetBrains Mono, monospace';
        for (let x = gridSpacing; x < w; x += gridSpacing * 2) {
            for (let y = gridSpacing; y < h; y += gridSpacing * 2) {
                const lat = (42.3 + (y / h) * 0.5).toFixed(2);
                const lng = (-71.1 + (x / w) * 0.5).toFixed(2);
                ctx.fillText(`${lat}°N`, x + 4, y - 4);
                ctx.fillText(`${lng}°W`, x + 4, y + 10);
            }
        }

        animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();
})();
