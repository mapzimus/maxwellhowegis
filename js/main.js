// ===== SHARED SITE JS =====

// Hamburger menu
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
        navLinks.querySelectorAll('a').forEach(a =>
            a.addEventListener('click', () => navLinks.classList.remove('open'))
        );
    }

    // Scroll fade-in
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
});

// ===== PROJECT RENDERING =====
function renderFilters(containerId, gridId) {
    const bar = document.getElementById(containerId);
    if (!bar) return;
    bar.innerHTML = categories.map(cat => {
        const count = cat.key === 'all' ? projects.length : projects.filter(p => p.type === cat.key).length;
        return `<button class="filter-btn ${cat.key === 'all' ? 'active' : ''}" data-filter="${cat.key}">
            ${cat.label}<span class="filter-count">${count}</span>
        </button>`;
    }).join('');

    bar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderProjectGrid(gridId, btn.dataset.filter);
        });
    });
}

function renderProjectGrid(gridId, filter = 'all', limit = null) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    let filtered = filter === 'all' ? [...projects] : projects.filter(p => p.type === filter);
    if (limit) filtered = filtered.slice(0, limit);

    grid.innerHTML = filtered.map(p => `
        <div class="project-card" data-id="${p.id}">
            <div class="project-thumb">
                ${p.thumb
                    ? `<img src="${p.thumb}" alt="${p.title}" loading="lazy">`
                    : `<div class="placeholder-map">${typePlaceholders[p.type] || '\u{1F5FA}'}</div>`
                }
                <span class="project-type-badge ${typeClasses[p.type]}">${typeLabels[p.type]}</span>
            </div>
            <div class="project-info">
                <h3>${p.title}</h3>
                <p>${p.summary}</p>
                <div class="project-tags">
                    ${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => openModal(Number(card.dataset.id)));
    });
}

// ===== MODAL =====
function openModal(id) {
    const p = projects.find(pr => pr.id === id);
    if (!p) return;
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;

    document.getElementById('modalThumb').innerHTML = p.thumb
        ? `<img src="${p.thumb}" alt="${p.title}">`
        : `<div class="placeholder-map">${typePlaceholders[p.type] || '\u{1F5FA}'}</div>`;

    document.getElementById('modalBody').innerHTML = `
        <h2>${p.title}</h2>
        <div class="modal-meta">
            <span><span class="project-type-badge ${typeClasses[p.type]}" style="position:static;">${typeLabels[p.type]}</span></span>
            <span>${p.category}</span>
            <span>${p.year}</span>
            ${p.course ? `<span>${p.course}</span>` : ''}
        </div>
        <div class="modal-description">${p.description}</div>
        <div class="modal-section-title">Tools & Technologies</div>
        <div class="modal-tools">
            ${p.tools.map(t => `<span class="modal-tool">${t}</span>`).join('')}
        </div>
        <div class="modal-actions">
            ${p.liveUrl ? `<a href="${p.liveUrl}" target="_blank" class="btn btn-primary">View Live</a>` : ''}
            ${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" class="btn btn-secondary">Source Code</a>` : ''}
        </div>
    `;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('modalClose');
    const overlay = document.getElementById('modalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
});

// ===== COUNTER ANIMATION =====
function animateCounters() {
    document.querySelectorAll('[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target);
        const duration = 1500;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}
