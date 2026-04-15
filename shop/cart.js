/**
 * cart.js – LayerWeaver Shopify cart integration
 * Uses Storefront API to manage cart. Injects cart icon + drawer into the page.
 */
(function () {
  const DOMAIN = 'shop.layerweaver.com';
  const TOKEN  = '7f0eafeb115e99a4a917e044a1fb4125';
  const API    = `https://${DOMAIN}/api/2025-01/graphql.json`;
  const KEY    = 'lw_cart_id';

  // Derive the path to shop/ root from the current page URL
  const path     = window.location.pathname;
  const shopIdx  = path.indexOf('/shop/');
  const SHOP_ROOT = shopIdx !== -1 ? path.substring(0, shopIdx + 6) : '/shop/';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function fmt(amount, code) {
    const n = parseFloat(amount);
    return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
  }

  async function gql(query, variables = {}) {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }

  const CART_FIELDS = `
    id checkoutUrl totalQuantity
    lines(first: 20) {
      edges { node {
        id quantity
        merchandise { ... on ProductVariant {
          id title
          price { amount currencyCode }
          product { title handle }
          image { url altText }
        }}
      }}
    }
    cost { totalAmount { amount currencyCode } }
  `;

  // ── API calls ─────────────────────────────────────────────────────────────

  async function createCart(variantId, qty) {
    const data = await gql(`
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) { cart { ${CART_FIELDS} } }
      }`, { input: { lines: [{ merchandiseId: variantId, quantity: qty }] } });
    return data.cartCreate.cart;
  }

  async function fetchCart(cartId) {
    const data = await gql(`
      query getCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: cartId });
    return data.cart;
  }

  async function addLine(cartId, variantId, qty) {
    const data = await gql(`
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } }
      }`, { cartId, lines: [{ merchandiseId: variantId, quantity: qty }] });
    return data.cartLinesAdd.cart;
  }

  async function updateLine(cartId, lineId, qty) {
    const data = await gql(`
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } }
      }`, { cartId, lines: [{ id: lineId, quantity: qty }] });
    return data.cartLinesUpdate.cart;
  }

  async function removeLine(cartId, lineId) {
    const data = await gql(`
      mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } }
      }`, { cartId, lineIds: [lineId] });
    return data.cartLinesRemove.cart;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let cart = null;

  const KEY_QTY = 'lw_cart_qty';
  function saveCartId(id) { localStorage.setItem(KEY, id); }
  function loadCartId()   { return localStorage.getItem(KEY); }
  function loadCachedQty(){ return parseInt(localStorage.getItem(KEY_QTY) || '0'); }

  // ── DOM: cart icon in header ───────────────────────────────────────────────

  function injectCartIcon() {
    const nav = document.querySelector('header nav');
    if (!nav || document.getElementById('cart-icon-btn')) return;

    const qty = loadCachedQty();
    const btn = document.createElement('button');
    btn.id = 'cart-icon-btn';
    btn.setAttribute('aria-label', 'Open cart');
    btn.innerHTML = `<i class="fa-solid fa-bag-shopping"></i><span class="cart-badge" id="cart-badge" style="display:${qty > 0 ? 'flex' : 'none'}">${qty}</span>`;
    btn.addEventListener('click', openDrawer);
    nav.appendChild(btn);
  }

  function updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const qty = cart ? cart.totalQuantity : 0;
    localStorage.setItem(KEY_QTY, qty);
    badge.textContent = qty;
    badge.style.display = qty > 0 ? 'flex' : 'none';
  }

  // ── DOM: drawer ───────────────────────────────────────────────────────────

  function injectDrawer() {
    if (document.getElementById('cart-drawer')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cart-overlay';
    overlay.addEventListener('click', closeDrawer);

    const drawer = document.createElement('div');
    drawer.id = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-header">
        <a href="${SHOP_ROOT}" class="drawer-back-link">← Back to Shop</a>
        <h3>Your Cart</h3>
        <button id="cart-close" aria-label="Close cart">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="cart-body" id="cart-body"></div>
      <div class="cart-footer" id="cart-footer" style="display:none">
        <div class="cart-total">
          <span>Total</span>
          <span id="cart-total-price"></span>
        </div>
        <a id="cart-checkout-btn" class="btn-primary">
          Checkout <i class="fa-solid fa-arrow-right"></i>
        </a>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.getElementById('cart-close').addEventListener('click', closeDrawer);
  }

  function renderCart() {
    const body   = document.getElementById('cart-body');
    const footer = document.getElementById('cart-footer');
    const total  = document.getElementById('cart-total-price');
    const chkBtn = document.getElementById('cart-checkout-btn');
    if (!body) return;

    const lines = cart ? cart.lines.edges.map(e => e.node) : [];

    if (!cart || lines.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <a href="./" class="btn-primary">Browse Shop</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    body.innerHTML = lines.map(line => {
      const v     = line.merchandise;
      const price = fmt(v.price.amount, v.price.currencyCode);
      const img   = v.image ? `<img src="${v.image.url}" alt="${v.image.altText || v.product.title}">` : '';
      const swatchHex = (window.LW_SWATCHES?.[v.product.handle]?.[v.title]);
      const swatchDot = swatchHex
        ? `<span class="line-variant-swatch" style="background:${swatchHex}${swatchHex === '#ffffff' ? ';border-color:#ddd' : ''}"></span>`
        : '';
      const variantLabel = v.title !== 'Default Title'
        ? `<span class="line-variant">${swatchDot}${v.title}</span>`
        : '';
      return `
        <div class="cart-line" data-line-id="${line.id}">
          <a class="cart-line-link" href="${SHOP_ROOT}products/${v.product.handle}/">
            <div class="line-image">${img}</div>
            <div class="line-info">
              <p class="line-title">${v.product.title}</p>
              ${variantLabel}
              <p class="line-price">${price}</p>
            </div>
          </a>
          <div class="line-qty">
            <button class="qty-btn qty-dec" data-line-id="${line.id}" data-qty="${line.quantity}">−</button>
            <span>${line.quantity}</span>
            <button class="qty-btn qty-inc" data-line-id="${line.id}" data-qty="${line.quantity}">+</button>
            <button class="remove-btn" data-line-id="${line.id}" aria-label="Remove">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    // Quantity / remove events
    body.querySelectorAll('.qty-dec').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newQty = parseInt(btn.dataset.qty) - 1;
        await handleUpdateLine(btn.dataset.lineId, newQty);
      });
    });
    body.querySelectorAll('.qty-inc').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newQty = parseInt(btn.dataset.qty) + 1;
        await handleUpdateLine(btn.dataset.lineId, newQty);
      });
    });
    body.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => handleRemoveLine(btn.dataset.lineId));
    });

    // Footer
    const costAmt = cart.cost.totalAmount;
    total.textContent = fmt(costAmt.amount, costAmt.currencyCode);
    chkBtn.href = cart.checkoutUrl;
    footer.style.display = 'flex';
  }

  // ── Drawer open / close ───────────────────────────────────────────────────

  function openDrawer() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  function setAddBtnLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding…';
  }

  // Build variantGid → qty map from current cart
  function cartQtyMap() {
    if (!cart) return {};
    const map = {};
    cart.lines.edges.forEach(e => { map[e.node.merchandise.id] = e.node.quantity; });
    return map;
  }

  // Sync all Add to Cart buttons on the page with current cart state
  function updateCartBtns() {
    const qtyMap = cartQtyMap();

    document.querySelectorAll('.listing-add-to-cart').forEach(btn => {
      const qty = qtyMap[btn.dataset.variantGid];
      if (qty) {
        btn.innerHTML = `<i class="fa-solid fa-check"></i> In Cart (${qty})`;
        btn.classList.add('btn-in-cart');
      } else {
        btn.innerHTML = 'Add to Cart';
        btn.classList.remove('btn-in-cart');
      }
    });

    // Product detail page button
    const addBtn = document.getElementById('add-to-cart-btn');
    if (addBtn) {
      const activeVariant = document.querySelector('.variant-btn.active');
      const gid = activeVariant ? activeVariant.dataset.variantGid : addBtn.dataset.variantGid;
      const qty = qtyMap[gid];
      if (qty) {
        addBtn.innerHTML = `<i class="fa-solid fa-check"></i> In Cart (${qty})`;
        addBtn.classList.add('btn-in-cart');
      } else {
        addBtn.innerHTML = 'Add to Cart';
        addBtn.classList.remove('btn-in-cart');
      }
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddToCart(variantGid, qty = 1) {
    const btn = document.getElementById('add-to-cart-btn');
    setAddBtnLoading(btn, true);
    try {
      const cartId = loadCartId();
      if (cartId) {
        try {
          cart = await addLine(cartId, variantGid, qty);
        } catch {
          cart = await createCart(variantGid, qty);
          saveCartId(cart.id);
          syncCartIdToServer(cart.id);
        }
      } else {
        cart = await createCart(variantGid, qty);
        saveCartId(cart.id);
        syncCartIdToServer(cart.id);
      }
      updateBadge();
      renderCart();
      updateCartBtns();
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert('Could not add to cart. Please try again.');
    } finally {
      setAddBtnLoading(btn, false);
    }
  }

  async function handleUpdateLine(lineId, newQty) {
    if (newQty <= 0) return handleRemoveLine(lineId);
    setDrawerLoading(true);
    try {
      cart = await updateLine(cart.id, lineId, newQty);
      updateBadge();
      renderCart();
      updateCartBtns();
    } finally {
      setDrawerLoading(false);
    }
  }

  async function handleRemoveLine(lineId) {
    setDrawerLoading(true);
    try {
      cart = await removeLine(cart.id, lineId);
      updateBadge();
      renderCart();
      updateCartBtns();
    } finally {
      setDrawerLoading(false);
    }
  }

  function setDrawerLoading(on) {
    const body = document.getElementById('cart-body');
    if (body) body.style.opacity = on ? '0.5' : '1';
  }

  // ── Wire up product page ──────────────────────────────────────────────────

  function wireProductPage() {
    const addBtn = document.getElementById('add-to-cart-btn');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
      const activeBtn = document.querySelector('.variant-btn.active');
      const variantGid = activeBtn
        ? activeBtn.dataset.variantGid
        : addBtn.dataset.variantGid;
      if (variantGid) handleAddToCart(variantGid);
    });

    // Update button state when variant changes
    document.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => updateCartBtns());
    });
  }

  // ── Wire up listing page "Add to Cart" buttons ────────────────────────────

  function wireListingPage() {
    // Colour swatch selection — update active state + sync Add to Cart / Buy Now
    document.querySelectorAll('.listing-swatch[data-variant-gid]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const card = swatch.closest('.shop-product-card');
        card.querySelectorAll('.listing-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const addBtn = card.querySelector('.listing-add-to-cart');
        if (addBtn) addBtn.dataset.variantGid = swatch.dataset.variantGid;
      });
    });

    document.querySelectorAll('.listing-add-to-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const variantGid = btn.dataset.variantGid;
        if (!variantGid) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding…';
        try {
          const cartId = loadCartId();
          if (cartId) {
            try { cart = await addLine(cartId, variantGid, 1); }
            catch { cart = await createCart(variantGid, 1); saveCartId(cart.id); syncCartIdToServer(cart.id); }
          } else {
            cart = await createCart(variantGid, 1);
            saveCartId(cart.id);
            syncCartIdToServer(cart.id);
          }
          updateBadge();
          renderCart();
          updateCartBtns();
        } catch (err) {
          console.error('Add to cart failed:', err);
          alert('Could not add to cart. Please try again.');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // ── Cart sync ──────────────────────────────────────────────────────────────

  async function syncCartIdToServer(cartId) {
    if (!window.LW_AUTH?.isLoggedIn()) return;
    try {
      const ownerId = JSON.stringify(window.LW_AUTH.getCustomer()?.id);
      const value   = JSON.stringify(JSON.stringify(cartId));
      await window.LW_AUTH.gql(`
        mutation {
          metafieldsSet(metafields: [{
            ownerId:   ${ownerId}
            namespace: "lw_cart"
            key:       "active"
            type:      "json"
            value:     ${value}
          }]) {
            userErrors { field message }
          }
        }`);
    } catch (e) {
      console.warn('[Cart] Sync cart ID to server failed:', e);
    }
  }

  async function syncCartFromServer() {
    if (!window.LW_AUTH?.isLoggedIn()) return;
    try {
      const data = await window.LW_AUTH.gql(`
        query {
          customer {
            metafield(namespace: "lw_cart", key: "active") {
              value
            }
          }
        }`);
      const raw = data?.customer?.metafield?.value;
      const serverCartId = raw ? JSON.parse(raw) : null;

      if (!serverCartId) {
        const localCartId = loadCartId();
        if (localCartId) syncCartIdToServer(localCartId);
        return;
      }

      const localCartId = loadCartId();
      if (serverCartId === localCartId) return;

      try {
        const serverCart = await fetchCart(serverCartId);
        if (serverCart && serverCart.lines.edges.length > 0) {
          if (localCartId && localCartId !== serverCartId) {
            try {
              const localCart = await fetchCart(localCartId);
              if (localCart) {
                for (const edge of localCart.lines.edges) {
                  const v = edge.node.merchandise;
                  serverCart && await addLine(serverCartId, v.id, edge.node.quantity)
                    .then(c => { cart = c; }).catch(() => {});
                }
              }
            } catch { /* local cart gone — ignore */ }
          }
          saveCartId(serverCartId);
          cart = await fetchCart(serverCartId);
          updateBadge();
          renderCart();
          updateCartBtns();
        } else if (localCartId) {
          syncCartIdToServer(localCartId);
        }
      } catch {
        if (localCartId) syncCartIdToServer(localCartId);
      }
    } catch (e) {
      console.warn('[Cart] Sync cart from server failed:', e);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async function init() {
    injectCartIcon();
    injectDrawer();

    // Restore cart from previous session
    const cartId = loadCartId();
    if (cartId) {
      try {
        cart = await fetchCart(cartId);
        if (!cart) { localStorage.removeItem(KEY); cart = null; }
      } catch { localStorage.removeItem(KEY); }
    }

    updateBadge();
    renderCart();
    updateCartBtns();
    wireProductPage();
    wireListingPage();

    // Sync with server when auth is ready
    if (window.LW_AUTH) {
      syncCartFromServer();
    } else {
      window.addEventListener('lw:auth-ready', () => syncCartFromServer(), { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
