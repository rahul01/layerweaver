/**
 * cart.js – LayerWeaver Shopify cart integration
 * Uses Storefront API to manage cart. Injects cart icon + drawer into the page.
 */
(function () {
  const DOMAIN = 'layerweaver-com.myshopify.com';
  const TOKEN  = '7f0eafeb115e99a4a917e044a1fb4125';
  const API    = `https://${DOMAIN}/api/2025-01/graphql.json`;
  const KEY    = 'lw_cart_id';

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

  function saveCartId(id) { localStorage.setItem(KEY, id); }
  function loadCartId()   { return localStorage.getItem(KEY); }

  // ── DOM: cart icon in header ───────────────────────────────────────────────

  function injectCartIcon() {
    const nav = document.querySelector('header nav');
    if (!nav || document.getElementById('cart-icon-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'cart-icon-btn';
    btn.setAttribute('aria-label', 'Open cart');
    btn.innerHTML = `<i class="fa-solid fa-bag-shopping"></i><span class="cart-badge" id="cart-badge" style="display:none">0</span>`;
    btn.addEventListener('click', openDrawer);
    nav.appendChild(btn);
  }

  function updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const qty = cart ? cart.totalQuantity : 0;
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
        <a id="cart-checkout-btn" class="btn-primary" target="_blank">
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
          <div class="line-image">${img}</div>
          <div class="line-info">
            <p class="line-title">${v.product.title}</p>
            ${variantLabel}
            <p class="line-price">${price}</p>
            <div class="line-qty">
              <button class="qty-btn qty-dec" data-line-id="${line.id}" data-qty="${line.quantity}">−</button>
              <span>${line.quantity}</span>
              <button class="qty-btn qty-inc" data-line-id="${line.id}" data-qty="${line.quantity}">+</button>
              <button class="remove-btn" data-line-id="${line.id}" aria-label="Remove">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
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
    btn.innerHTML = loading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Adding…'
      : '<i class="fa-solid fa-bag-shopping"></i> Add to Cart';
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
          // Cart may have expired — create fresh
          cart = await createCart(variantGid, qty);
          saveCartId(cart.id);
        }
      } else {
        cart = await createCart(variantGid, qty);
        saveCartId(cart.id);
      }
      updateBadge();
      renderCart();
      openDrawer();
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
        const buyNow = card.querySelector('.listing-buy-now');
        if (buyNow) buyNow.href = `https://${DOMAIN}/cart/${swatch.dataset.variantId}:1`;
      });
    });

    document.querySelectorAll('.listing-add-to-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const variantGid = btn.dataset.variantGid;
        if (!variantGid) return;
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding…';
        try {
          const cartId = loadCartId();
          if (cartId) {
            try { cart = await addLine(cartId, variantGid, 1); }
            catch { cart = await createCart(variantGid, 1); saveCartId(cart.id); }
          } else {
            cart = await createCart(variantGid, 1);
            saveCartId(cart.id);
          }
          updateBadge();
          renderCart();
          openDrawer();
        } catch (err) {
          console.error('Add to cart failed:', err);
          alert('Could not add to cart. Please try again.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });
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
    wireProductPage();
    wireListingPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
