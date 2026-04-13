/**
 * wishlist.js – LayerWeaver wishlist feature
 * Persists items in localStorage. Injects heart buttons, header icon, and drawer.
 */
(function () {
  const KEY = 'lw_wishlist';

  // ── Storage helpers ───────────────────────────────────────────────────────

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function isWishlisted(handle) { return load().some(i => i.handle === handle); }

  function addItem(item) {
    const items = load();
    if (!items.some(i => i.handle === item.handle)) { items.push(item); save(items); }
  }

  function removeItem(handle) { save(load().filter(i => i.handle !== handle)); }

  function toggle(item) {
    if (isWishlisted(item.handle)) { removeItem(item.handle); return false; }
    addItem(item); return true;
  }

  // ── Header icon ───────────────────────────────────────────────────────────

  function injectHeaderIcon() {
    const nav = document.querySelector('header nav');
    if (!nav || document.getElementById('wishlist-icon-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'wishlist-icon-btn';
    btn.setAttribute('aria-label', 'Open wishlist');
    btn.innerHTML = `<i class="fa-regular fa-heart"></i><span class="wishlist-badge" id="wishlist-badge" style="display:none">0</span>`;
    btn.addEventListener('click', openDrawer);

    // Insert before cart icon if it exists, else just append
    const cartBtn = document.getElementById('cart-icon-btn');
    if (cartBtn) nav.insertBefore(btn, cartBtn);
    else nav.appendChild(btn);
  }

  function updateBadge() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) return;
    const count = load().length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  // ── Drawer ────────────────────────────────────────────────────────────────

  function injectDrawer() {
    if (document.getElementById('wishlist-drawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'wishlist-overlay';
    overlay.addEventListener('click', closeDrawer);

    const drawer = document.createElement('div');
    drawer.id = 'wishlist-drawer';
    drawer.innerHTML = `
      <div class="wishlist-header">
        <h3>Wishlist</h3>
        <button id="wishlist-close" aria-label="Close wishlist">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="wishlist-body" id="wishlist-body"></div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.getElementById('wishlist-close').addEventListener('click', closeDrawer);
  }

  function renderDrawer() {
    const body = document.getElementById('wishlist-body');
    if (!body) return;

    const items = load();
    if (items.length === 0) {
      body.innerHTML = `
        <div class="wishlist-empty">
          <i class="fa-regular fa-heart"></i>
          <p>Your wishlist is empty</p>
          <a href="./" class="btn-primary">Browse Shop</a>
        </div>`;
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="wishlist-item" data-handle="${item.handle}">
        <div class="wishlist-item-image">
          ${item.image ? `<img src="${item.image}" alt="${item.title}">` : '<i class="fa-solid fa-cube"></i>'}
        </div>
        <div class="wishlist-item-info">
          <p class="wishlist-item-title">${item.title}</p>
          <p class="wishlist-item-price">${item.price}</p>
          <a href="${item.url}" class="wishlist-view-link">View product</a>
        </div>
        <button class="wishlist-remove-btn" data-handle="${item.handle}" aria-label="Remove from wishlist">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`).join('');

    body.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeItem(btn.dataset.handle);
        updateAllHearts();
        updateBadge();
        renderDrawer();
      });
    });
  }

  function openDrawer() {
    renderDrawer();
    document.getElementById('wishlist-drawer')?.classList.add('open');
    document.getElementById('wishlist-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    document.getElementById('wishlist-drawer')?.classList.remove('open');
    document.getElementById('wishlist-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Heart buttons ─────────────────────────────────────────────────────────

  function updateAllHearts() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      const handle = btn.dataset.handle;
      const active = isWishlisted(handle);
      btn.classList.toggle('active', active);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      }
    });
  }

  function wireHeartButtons() {
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      // Set initial state
      const handle = btn.dataset.handle;
      const active = isWishlisted(handle);
      btn.classList.toggle('active', active);
      const icon = btn.querySelector('i');
      if (icon) icon.className = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = {
          handle: btn.dataset.handle,
          title:  btn.dataset.title,
          price:  btn.dataset.price,
          image:  btn.dataset.image,
          url:    btn.dataset.url,
        };
        const added = toggle(item);
        btn.classList.toggle('active', added);
        const ic = btn.querySelector('i');
        if (ic) ic.className = added ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        updateBadge();
      });
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() {
    injectHeaderIcon();
    injectDrawer();
    updateBadge();
    wireHeartButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
