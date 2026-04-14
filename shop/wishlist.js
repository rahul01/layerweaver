/**
 * wishlist.js – LayerWeaver wishlist feature
 * Persists items in localStorage. Syncs to Shopify customer metafield when signed in.
 */
(function () {
  const KEY = 'lw_wishlist';

  // Derive shop root from current URL (same approach as cart.js)
  const _path     = window.location.pathname;
  const _shopIdx  = _path.indexOf('/shop/');
  const SHOP_ROOT = _shopIdx !== -1 ? _path.substring(0, _shopIdx + 6) : '/shop/';

  // ── Storage helpers ───────────────────────────────────────────────────────

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); }

  function isWishlisted(handle) { return load().some(i => i.handle === handle); }

  function addItem(item) {
    const items = load();
    if (!items.some(i => i.handle === item.handle)) {
      items.push(item);
      save(items);
      syncToServer(items);
    }
  }

  function removeItem(handle) {
    const items = load().filter(i => i.handle !== handle);
    save(items);
    syncToServer(items);
  }

  function toggle(item) {
    if (isWishlisted(item.handle)) { removeItem(item.handle); return false; }
    addItem(item); return true;
  }

  // ── Server sync ───────────────────────────────────────────────────────────

  async function syncToServer(items) {
    if (!window.LW_AUTH?.isLoggedIn()) return;
    try {
      await window.LW_AUTH.gql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }`, {
        metafields: [{
          namespace: 'wishlist',
          key:       'items',
          value:     JSON.stringify(items),
          type:      'json',
        }],
      });
    } catch (e) {
      console.warn('[Wishlist] Sync to server failed:', e);
    }
  }

  async function syncFromServer() {
    if (!window.LW_AUTH?.isLoggedIn()) return;
    try {
      const data = await window.LW_AUTH.gql(`
        query {
          customer {
            metafield(namespace: "wishlist", key: "items") {
              value
            }
          }
        }`);
      const raw = data?.customer?.metafield?.value;
      if (!raw) return;
      const serverItems = JSON.parse(raw);
      if (!Array.isArray(serverItems)) return;

      const localItems = load();
      const merged     = [...serverItems];
      for (const item of localItems) {
        if (!merged.some(i => i.handle === item.handle)) merged.push(item);
      }
      save(merged);
      updateAllHearts();
      updateBadge();
    } catch (e) {
      console.warn('[Wishlist] Sync from server failed:', e);
    }
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
      <a class="wishlist-item" href="${SHOP_ROOT}products/${item.handle}/" data-handle="${item.handle}">
        <div class="wishlist-item-image">
          ${item.image ? `<img src="${item.image}" alt="${item.title}">` : '<i class="fa-solid fa-cube"></i>'}
        </div>
        <div class="wishlist-item-info">
          <p class="wishlist-item-title">${item.title}</p>
          <p class="wishlist-item-price">${item.price}</p>
        </div>
        <button class="wishlist-remove-btn" data-handle="${item.handle}" aria-label="Remove from wishlist">
          <i class="fa-solid fa-trash"></i>
        </button>
      </a>`).join('');

    body.querySelectorAll('.wishlist-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    window.addEventListener('lw:auth-ready', async (e) => {
      await syncFromServer();
      if (e.detail?.justLoggedIn) {
        updateAllHearts();
        updateBadge();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
