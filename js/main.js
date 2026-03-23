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
        card.addEventListener('click', () => {
            const p = projects.find(pr => pr.id === Number(card.dataset.id));
            if (p && p.liveUrl && !p.liveUrl.startsWith('http')) {
                window.location.href = p.liveUrl;
            } else {
                openModal(Number(card.dataset.id));
            }
        });
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

    const galleryHTML = p.gallery && p.gallery.length > 0 ? `
        <div class="modal-section-title">Project Gallery</div>
        <div class="modal-gallery">
            ${p.gallery.map((img, i) => `
                <div class="modal-gallery-item" data-index="${i}">
                    <img src="${img.src}" alt="${img.caption}" loading="lazy">
                    <span class="modal-gallery-caption">${img.caption}</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    document.getElementById('modalBody').innerHTML = `
        <h2>${p.title}</h2>
        <div class="modal-meta">
            <span><span class="project-type-badge ${typeClasses[p.type]}" style="position:static;">${typeLabels[p.type]}</span></span>
            ${p.groupProject ? '<span class="group-badge">Group Project</span>' : ''}
            <span>${p.category}</span>
            <span>${p.year}</span>
            ${p.course ? `<span>${p.course}</span>` : ''}
        </div>
        <div class="modal-description">${p.description}</div>
        ${galleryHTML}
        <div class="modal-section-title">Tools & Technologies</div>
        <div class="modal-tools">
            ${p.tools.map(t => `<span class="modal-tool">${t}</span>`).join('')}
        </div>
        <div class="modal-actions">
            ${p.liveUrl ? `<a href="${p.liveUrl}" target="_blank" class="btn btn-primary">View Live</a>` : ''}
            ${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" class="btn btn-secondary">Source Code</a>` : ''}
        </div>
    `;

    // Gallery lightbox
    if (p.gallery && p.gallery.length > 0) {
        document.querySelectorAll('.modal-gallery-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                openGalleryLightbox(p.gallery, parseInt(item.dataset.index));
            });
        });
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// ===== GALLERY LIGHTBOX =====
function openGalleryLightbox(gallery, startIndex) {
    let current = startIndex;
    const lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.innerHTML = `
        <button class="gallery-lb-close">&times;</button>
        <button class="gallery-lb-nav gallery-lb-prev">&lsaquo;</button>
        <button class="gallery-lb-nav gallery-lb-next">&rsaquo;</button>
        <div class="gallery-lb-content">
            <img src="${gallery[current].src}" alt="${gallery[current].caption}">
            <div class="gallery-lb-caption">${gallery[current].caption}</div>
            <div class="gallery-lb-counter">${current + 1} / ${gallery.length}</div>
        </div>
    `;
    document.body.appendChild(lb);

    const img = lb.querySelector('img');
    const caption = lb.querySelector('.gallery-lb-caption');
    const counter = lb.querySelector('.gallery-lb-counter');

    function show(i) {
        current = i;
        img.src = gallery[current].src;
        img.alt = gallery[current].caption;
        caption.textContent = gallery[current].caption;
        counter.textContent = `${current + 1} / ${gallery.length}`;
    }

    lb.querySelector('.gallery-lb-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        show((current - 1 + gallery.length) % gallery.length);
    });
    lb.querySelector('.gallery-lb-next').addEventListener('click', (e) => {
        e.stopPropagation();
        show((current + 1) % gallery.length);
    });
    function cleanup() { lb.remove(); document.removeEventListener('keydown', onKey); }

    lb.querySelector('.gallery-lb-close').addEventListener('click', cleanup);
    lb.addEventListener('click', (e) => { if (e.target === lb) cleanup(); });

    function onKey(e) {
        if (e.key === 'ArrowLeft') show((current - 1 + gallery.length) % gallery.length);
        if (e.key === 'ArrowRight') show((current + 1) % gallery.length);
        if (e.key === 'Escape') cleanup();
    }
    document.addEventListener('keydown', onKey);
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

