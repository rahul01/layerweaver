/**
 * cart.js – LayerWeaver Shopify cart integration
 * Uses Storefront API to manage cart. Injects cart icon + drawer into the page.
 */
(function () {
  const DOMAIN            = 'shop.layerweaver.com';
  const TOKEN             = '7f0eafeb115e99a4a917e044a1fb4125';
  const API               = `https://${DOMAIN}/api/2025-01/graphql.json`;
  const KEY               = 'lw_cart_id';
  const FREE_SHIPPING_MIN = 0; // 6-month celebration: free shipping on all orders
  const FREE_GIFT_MIN     = 299;
  const FREE_GIFT_NAME    = 'Cat Cable Clip';
  const FREE_GIFT_HANDLE  = 'cat-cable-clip';
  const FREE_GIFT_VARIANT = 'gid://shopify/ProductVariant/48173905576158';
  const FREE_GIFT_CODE    = 'FREEGIFT299';
  const GIFT_ATTR_KEY     = '_gift';
  const GIFT_ATTR_VALUE   = 'FREEGIFT299';

  // Derive the path to shop/ root from the current page URL
  const path     = window.location.pathname;
  const shopIdx  = path.indexOf('/shop/');
  const SHOP_ROOT  = shopIdx !== -1 ? path.substring(0, shopIdx + 6) : '/shop/';
  const SITE_ROOT  = shopIdx !== -1 ? path.substring(0, shopIdx + 1) : '/';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function fmt(amount, code) {
    const n = parseFloat(amount);
    return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
        attributes { key value }
        merchandise { ... on ProductVariant {
          id title
          price { amount currencyCode }
          product { title handle }
          image { url altText }
        }}
      }}
    }
    cost { totalAmount { amount currencyCode } }
    discountCodes { code applicable }
  `;

  // ── API calls ─────────────────────────────────────────────────────────────

  async function createCart(variantId, qty, attributes = []) {
    const line = { merchandiseId: variantId, quantity: qty };
    if (attributes.length) line.attributes = attributes;
    const data = await gql(`
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) { cart { ${CART_FIELDS} } }
      }`, { input: { lines: [line] } });
    return data.cartCreate.cart;
  }

  async function fetchCart(cartId) {
    const data = await gql(`
      query getCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: cartId });
    return data.cart;
  }

  async function addLines(cartId, lines) {
    const data = await gql(`
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } }
      }`, { cartId, lines });
    return data.cartLinesAdd.cart;
  }

  async function addLine(cartId, variantId, qty, attributes = []) {
    const line = { merchandiseId: variantId, quantity: qty };
    if (attributes.length) line.attributes = attributes;
    return addLines(cartId, [line]);
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

  async function applyDiscountCode(cartId, codes) {
    const data = await gql(`
      mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
        cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
          cart { ${CART_FIELDS} }
          userErrors { field message }
        }
      }`, { cartId, discountCodes: codes });
    const result = data.cartDiscountCodesUpdate;
    if (result.userErrors?.length) {
      console.error('[Cart] Discount code error:', result.userErrors);
    }
    const appliedCart = result.cart;
    if (codes.length && appliedCart?.discountCodes) {
      const applied = appliedCart.discountCodes.find(c => c.code === codes[0]);
      if (applied && !applied.applicable) {
        console.warn('[Cart] Discount code not applicable:', applied);
      }
    }
    return appliedCart;
  }

  function getGiftLine() {
    if (!cart) return null;
    return cart.lines.edges.find(e =>
      e.node.attributes?.some(a => a.key === GIFT_ATTR_KEY && a.value === GIFT_ATTR_VALUE)
    )?.node || null;
  }

  let _qtCache = null, _qtCacheCart = null;
  function getQualifyingTotal() {
    if (!cart) return 0;
    if (_qtCacheCart === cart) return _qtCache;
    let sum = 0;
    for (const edge of cart.lines.edges) {
      const line = edge.node;
      const isGift = line.attributes?.some(a => a.key === GIFT_ATTR_KEY && a.value === GIFT_ATTR_VALUE);
      if (!isGift) {
        sum += parseFloat(line.merchandise.price.amount || 0) * line.quantity;
      }
    }
    _qtCacheCart = cart;
    _qtCache = sum;
    return sum;
  }

  let _giftBusy = false;
  async function reconcileGift() {
    if (_giftBusy || !cart) return;
    _giftBusy = true;
    try {
      const qualifyingTotal = getQualifyingTotal();
      const giftLine = getGiftLine();
      const shouldHaveGift = qualifyingTotal >= FREE_GIFT_MIN;
      console.log('[Gift] qualifying:', qualifyingTotal, 'shouldHaveGift:', shouldHaveGift, 'hasGiftLine:', !!giftLine);

      let changed = false;
      if (shouldHaveGift && !giftLine) {
        cart = await addLine(cart.id, FREE_GIFT_VARIANT, 1, [{ key: GIFT_ATTR_KEY, value: GIFT_ATTR_VALUE }]);
        cart = await applyDiscountCode(cart.id, [FREE_GIFT_CODE]);
        changed = true;
      } else if (shouldHaveGift && giftLine) {
        const hasCodes = cart.discountCodes?.some(c => c.code === FREE_GIFT_CODE);
        if (!hasCodes) {
          cart = await applyDiscountCode(cart.id, [FREE_GIFT_CODE]);
          changed = true;
        }
      } else if (!shouldHaveGift && giftLine) {
        cart = await removeLine(cart.id, giftLine.id);
        cart = await applyDiscountCode(cart.id, []);
        changed = true;
      }
      if (changed) refreshUI();
    } catch (err) {
      console.error('[Cart] Gift reconcile failed:', err);
    } finally {
      _giftBusy = false;
    }
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let cart = null;
  let _cartReady = false;

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
      <div class="cart-free-shipping-banner"><i class="fa-solid fa-truck-fast"></i> Free shipping on all orders!</div>
      <div class="cart-body" id="cart-body"></div>
      <div class="cart-footer" id="cart-footer">
        <div id="cart-checkout-section" style="display:none">
          <div id="gift-progress" class="gift-progress">
            <div class="gift-bar-track">
              <div class="gift-bar-fill" id="gift-bar-fill"></div>
            </div>
            <p class="gift-progress-msg" id="gift-progress-msg"></p>
          </div>
          <div class="cart-total">
            <span>Total</span>
            <span id="cart-total-price"></span>
          </div>
          <a id="cart-checkout-btn" class="btn-primary">
            Checkout <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>
        <p class="cart-payment-note"><i class="fa-solid fa-lock"></i> UPI · Debit/Credit Cards · Net Banking via Razorpay</p>
        <div class="cart-policy-links">
          <a href="${SITE_ROOT}shipping-policy/"><i class="fa-solid fa-truck-fast"></i> Shipping Policy</a>
          <a href="${SITE_ROOT}return-and-exchange-policy/"><i class="fa-solid fa-rotate-left"></i> Return and Exchange Policy</a>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.getElementById('cart-close').addEventListener('click', closeDrawer);
    drawer.querySelector('.drawer-back-link').addEventListener('click', (e) => {
      e.preventDefault();
      closeDrawer();
      window.location.href = SHOP_ROOT;
    });
    document.getElementById('cart-checkout-btn').addEventListener('click', () => {
      window.LW_LOG_EVENT?.('begin_checkout', {
        value:     parseFloat(cart?.cost?.totalAmount?.amount || 0),
        currency:  cart?.cost?.totalAmount?.currencyCode || '',
        num_items: cart?.totalQuantity || 0,
      });
      if (typeof fbq === 'function') fbq('track', 'InitiateCheckout', {
        value:        parseFloat(cart?.cost?.totalAmount?.amount || 0),
        currency:     cart?.cost?.totalAmount?.currencyCode || 'INR',
        num_items:    cart?.totalQuantity || 0,
        content_ids:  (cart?.lines?.edges || []).map(e => e.node.merchandise.id.split('/').pop()),
        content_type: 'product',
      });
    });

    let _drawerBusy = false;
    document.getElementById('cart-body').addEventListener('click', async (e) => {
      if (_drawerBusy) return;
      const btn = e.target.closest('.qty-dec, .qty-inc, .remove-btn');
      if (!btn) return;
      _drawerBusy = true;
      setDrawerLoading(true);
      try {
        const lineId = btn.dataset.lineId;
        if (btn.classList.contains('remove-btn') || btn.classList.contains('qty-dec')) {
          const newQty = btn.classList.contains('remove-btn') ? 0 : parseInt(btn.dataset.qty) - 1;
          if (newQty <= 0) {
            await handleRemoveLine(lineId);
          } else {
            await handleUpdateLine(lineId, newQty);
          }
        } else {
          await handleUpdateLine(lineId, parseInt(btn.dataset.qty) + 1);
        }
      } finally {
        _drawerBusy = false;
        setDrawerLoading(false);
      }
    });
  }

  function spawnPageConfetti() {
    const colors = ['#A083D5', '#EFCF20', '#22c55e', '#f97316', '#ec4899'];
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (let i = 0; i < 60; i++) {
      const dot  = document.createElement('div');
      const size = 5 + Math.random() * 7;
      const sx   = Math.random() * W;
      const sy   = 0.2 * H + Math.random() * 0.6 * H;
      dot.style.cssText = `position:fixed;width:${size}px;height:${size}px;border-radius:50%;background:${colors[Math.floor(Math.random() * colors.length)]};left:${sx}px;top:${sy}px;pointer-events:none;z-index:9999;`;
      document.body.appendChild(dot);
      const tx = (Math.random() - 0.5) * 200;
      const ty = -(60 + Math.random() * 180);
      dot.animate(
        [{ transform: 'translate(0,0) scale(1)', opacity: 1 },
         { transform: `translate(${tx}px,${ty}px) scale(0)`, opacity: 0 }],
        { duration: 800 + Math.random() * 600, easing: 'ease-out', fill: 'forwards', delay: Math.random() * 300 }
      ).onfinish = () => dot.remove();
    }
    // Bounce the cart icon
    const cartBtn = document.getElementById('cart-icon-btn');
    if (cartBtn) {
      cartBtn.classList.add('cart-icon-celebrate');
      cartBtn.addEventListener('animationend', () => cartBtn.classList.remove('cart-icon-celebrate'), { once: true });
    }
  }

  function injectShippingBubble() {
    if (document.getElementById('shipping-bubble')) return;
    const bubble = document.createElement('div');
    bubble.id = 'shipping-bubble';
    bubble.innerHTML = `
      <p class="bubble-msg" id="bubble-msg"></p>
      <div class="bubble-track"><div class="bubble-fill" id="bubble-fill"></div></div>`;
    document.body.appendChild(bubble);
  }

  let _bubbleTimer = null;
  function showShippingBubble(pct, msg, unlocked) {
    const bubble = document.getElementById('shipping-bubble');
    const fill   = document.getElementById('bubble-fill');
    const msgEl  = document.getElementById('bubble-msg');
    if (!bubble || !fill || !msgEl) return;

    const cartBtn = document.getElementById('cart-icon-btn');
    if (cartBtn) {
      const rect = cartBtn.getBoundingClientRect();
      bubble.style.top   = (rect.bottom + 10) + 'px';
      bubble.style.right = (window.innerWidth - rect.right) + 'px';
    }

    fill.style.width = pct + '%';
    msgEl.textContent = msg;
    bubble.classList.toggle('bubble-unlocked', unlocked);
    bubble.classList.add('bubble-visible');

    clearTimeout(_bubbleTimer);
    _bubbleTimer = setTimeout(() => bubble.classList.remove('bubble-visible'), unlocked ? 3500 : 2800);
  }

  function renderShippingBar() {
    const qualifyingTotal = getQualifyingTotal();
    const giftUnlocked = qualifyingTotal >= FREE_GIFT_MIN;
    const giftPct      = FREE_GIFT_MIN > 0 ? Math.min((qualifyingTotal / FREE_GIFT_MIN) * 100, 100) : 100;
    const wasGiftUnlocked = sessionStorage.getItem('lw_gift_unlocked') === 'true';

    // ── Free gift progress bar ──
    const giftEl   = document.getElementById('gift-progress');
    const giftFill = document.getElementById('gift-bar-fill');
    const giftMsg  = document.getElementById('gift-progress-msg');
    if (giftEl && giftFill && giftMsg) {
      giftFill.style.width = giftPct + '%';
      if (giftUnlocked) {
        giftMsg.textContent = '🎁 Free ' + FREE_GIFT_NAME + ' included!';
        giftEl.classList.add('gift-unlocked');
        if (!wasGiftUnlocked) {
          sessionStorage.setItem('lw_gift_unlocked', 'true');
          spawnPageConfetti();
        }
      } else if (qualifyingTotal > 0) {
        giftMsg.textContent = '🎁 Add ₹' + (FREE_GIFT_MIN - qualifyingTotal).toFixed(0) + ' more for a free ' + FREE_GIFT_NAME + '!';
        giftEl.classList.remove('gift-unlocked');
        sessionStorage.removeItem('lw_gift_unlocked');
      } else {
        giftMsg.textContent = '🎁 Free ' + FREE_GIFT_NAME + ' on orders above ₹' + FREE_GIFT_MIN + '!';
        giftEl.classList.remove('gift-unlocked');
        sessionStorage.removeItem('lw_gift_unlocked');
      }
    }

    // ── Speech bubble near cart icon ──
    const giftBubbleMsg = giftUnlocked ? '🎁 Free ' + FREE_GIFT_NAME + ' included!' : '🎁 Add ₹' + Math.max(0, FREE_GIFT_MIN - qualifyingTotal).toFixed(0) + ' more for a free gift!';
    if (_cartReady && (!giftUnlocked || !wasGiftUnlocked)) {
      showShippingBubble(giftPct, giftBubbleMsg, giftUnlocked);
    }

  }

  function renderCart() {
    const body   = document.getElementById('cart-body');
    const total  = document.getElementById('cart-total-price');
    const chkBtn = document.getElementById('cart-checkout-btn');
    if (!body) return;

    const lines = cart ? cart.lines.edges.map(e => e.node).sort((a, b) => {
      const aGift = a.attributes?.some(x => x.key === GIFT_ATTR_KEY && x.value === GIFT_ATTR_VALUE);
      const bGift = b.attributes?.some(x => x.key === GIFT_ATTR_KEY && x.value === GIFT_ATTR_VALUE);
      return bGift - aGift;
    }) : [];

    if (!cart || lines.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <a href="${SHOP_ROOT}" class="btn-primary">Browse Shop</a>
        </div>`;
      const checkoutSection = document.getElementById('cart-checkout-section');
      if (checkoutSection) checkoutSection.style.display = 'none';
      return;
    }

    body.innerHTML = lines.map(line => {
      const v     = line.merchandise;
      const isGift = line.attributes?.some(a => a.key === GIFT_ATTR_KEY && a.value === GIFT_ATTR_VALUE);
      const price = isGift ? 'FREE' : fmt(v.price.amount, v.price.currencyCode);
      const img   = v.image ? `<img src="${v.image.url}" alt="${esc(v.image.altText || v.product.title)}">` : '';
      const swatchHex = (window.LW_SWATCHES?.[v.product.handle]?.[v.title]);
      const swatchDot = swatchHex
        ? `<span class="line-variant-swatch" style="background:${swatchHex}${swatchHex === '#ffffff' ? ';border-color:#ddd' : ''}"></span>`
        : '';
      const variantLabel = v.title !== 'Default Title'
        ? `<span class="line-variant">${swatchDot}${esc(v.title)}</span>`
        : '';
      const customAttrs = line.attributes?.filter(a => a.value && a.key !== GIFT_ATTR_KEY)
        .map(a => `<span class="line-attr"><em>${esc(a.key)}:</em> ${esc(a.value)}</span>`).join('') || '';
      const giftBadge = isGift ? '<span class="line-gift-badge">🎁 Free Gift</span>' : '';
      const qtyControls = isGift ? `<div class="line-qty"><span class="line-gift-label">Gift</span></div>` : `
          <div class="line-qty">
            <button class="qty-btn qty-dec" data-line-id="${line.id}" data-qty="${line.quantity}">−</button>
            <span>${line.quantity}</span>
            <button class="qty-btn qty-inc" data-line-id="${line.id}" data-qty="${line.quantity}">+</button>
            <button class="remove-btn" data-line-id="${line.id}" aria-label="Remove">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;
      return `
        <div class="cart-line${isGift ? ' cart-line--gift' : ''}" data-line-id="${line.id}">
          <a class="cart-line-link" href="${SHOP_ROOT}products/${v.product.handle}/">
            <div class="line-image">${img}</div>
            <div class="line-info">
              <p class="line-title">${esc(v.product.title)}</p>
              ${giftBadge}
              ${variantLabel}
              ${customAttrs}
              <p class="line-price${isGift ? ' line-price--free' : ''}">${price}</p>
            </div>
          </a>
          ${qtyControls}
        </div>`;
    }).join('');

    // Footer
    const costAmt = cart.cost.totalAmount;
    total.textContent = fmt(getQualifyingTotal(), costAmt.currencyCode);
    chkBtn.href = cart.checkoutUrl;
    const checkoutSection = document.getElementById('cart-checkout-section');
    if (checkoutSection) checkoutSection.style.display = 'contents';
    renderShippingBar();
  }

  // ── Drawer open / close ───────────────────────────────────────────────────

  function openDrawer() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.LW_LOG_EVENT?.('view_cart', {
      value:     parseFloat(cart?.cost?.totalAmount?.amount || 0),
      currency:  cart?.cost?.totalAmount?.currencyCode || '',
      num_items: cart?.totalQuantity || 0,
    });
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

  function refreshUI() { updateBadge(); renderCart(); updateCartBtns(); }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function addToCartCore(variantGid, qty = 1, attributes = []) {
    const prevLineCount = cart?.lines?.edges?.length || 0;
    const cartId = loadCartId();
    if (cartId) {
      cart = await addLine(cartId, variantGid, qty, attributes);
      if (!cart) {
        localStorage.removeItem(KEY);
        cart = await createCart(variantGid, qty, attributes);
        saveCartId(cart.id);
        syncCartIdToServer(cart.id);
      }
    } else {
      cart = await createCart(variantGid, qty, attributes);
      saveCartId(cart.id);
      syncCartIdToServer(cart.id);
    }
    refreshUI();
    reconcileGift();
    if (prevLineCount === 0 && (cart?.lines?.edges?.length || 0) > 0) {
      spawnPageConfetti();
    }
    const newLine = cart?.lines.edges.find(e => e.node.merchandise.id === variantGid)?.node;
    if (newLine) {
      window.LW_LOG_EVENT?.('add_to_cart', {
        item_name:  newLine.merchandise.product.title,
        item_id:    newLine.merchandise.product.handle,
        value:      parseFloat(newLine.merchandise.price.amount),
        currency:   newLine.merchandise.price.currencyCode,
        cart_total: parseFloat(cart?.cost?.totalAmount?.amount || 0),
      });
      if (typeof fbq === 'function') fbq('track', 'AddToCart', {
        content_name: newLine.merchandise.product.title,
        content_ids:  [newLine.merchandise.id.split('/').pop()],
        content_type: 'product',
        value:        parseFloat(newLine.merchandise.price.amount),
        currency:     newLine.merchandise.price.currencyCode,
      });
    }
  }

  async function handleAddToCart(variantGid, qty = 1) {
    const btn = document.getElementById('add-to-cart-btn');

    const attributes = [];
    if (btn?.dataset.personalized) {
      const input = document.getElementById('custom-text');
      const text  = input?.value.trim();
      if (!text) {
        input?.focus();
        input?.classList.add('field-error');
        input?.addEventListener('input', () => input.classList.remove('field-error'), { once: true });
        return;
      }
      attributes.push({ key: 'Custom Text', value: text });
    }

    setAddBtnLoading(btn, true);
    try {
      await addToCartCore(variantGid, qty, attributes);
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert('Could not add to cart. Please try again.');
    } finally {
      setAddBtnLoading(btn, false);
    }
  }

  async function handleUpdateLine(lineId, newQty) {
    if (newQty <= 0) return handleRemoveLine(lineId);
    cart = await updateLine(cart.id, lineId, newQty);
    refreshUI();
    reconcileGift();
  }

  async function handleRemoveLine(lineId) {
    const line = cart?.lines.edges.find(e => e.node.id === lineId)?.node;
    cart = await removeLine(cart.id, lineId);
    refreshUI();
    reconcileGift();
    if (line) {
      window.LW_LOG_EVENT?.('remove_from_cart', {
        item_name: line.merchandise.product.title,
        item_id:   line.merchandise.product.handle,
      });
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

    // Update button state when variant changes (via button or thumbnail)
    document.querySelectorAll('.variant-btn, .thumbnail').forEach(el => {
      el.addEventListener('click', () => updateCartBtns());
    });
  }

  // ── Wire up listing page "Add to Cart" buttons ────────────────────────────

  function wireListingPage() {
    // Colour swatch selection - update active state + sync Add to Cart / Buy Now
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
          await addToCartCore(variantGid);
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
              if (localCart && localCart.lines.edges.length > 0) {
                const linesToMerge = localCart.lines.edges.map(e => ({
                  merchandiseId: e.node.merchandise.id,
                  quantity: e.node.quantity,
                }));
                cart = await addLines(serverCartId, linesToMerge);
              }
            } catch { /* local cart gone - ignore */ }
          }
          saveCartId(serverCartId);
          cart = await fetchCart(serverCartId);
          refreshUI();
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
    injectShippingBubble();

    // Restore cart from previous session
    const cartId = loadCartId();
    if (cartId) {
      try {
        cart = await fetchCart(cartId);
        if (!cart) { localStorage.removeItem(KEY); cart = null; } // cart explicitly gone on Shopify
      } catch { /* network error - keep cart ID, will retry on next interaction */ }
    }

    await reconcileGift();
    refreshUI();
    wireProductPage();
    wireListingPage();
    _cartReady = true;

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

  // Refresh cart when page is restored from bfcache (back/forward navigation)
  window.addEventListener('pageshow', async (event) => {
    if (!event.persisted) return;
    const cartId = loadCartId();
    if (cartId) {
      try {
        cart = await fetchCart(cartId);
        if (!cart) { localStorage.removeItem(KEY); cart = null; }
      } catch {}
    } else {
      cart = null;
    }
    refreshUI();
    reconcileGift();
  });
})();

// Collection filter dropdown (mobile)
(function () {
  function initFilterDropdown() {
    const btn = document.querySelector('.collection-filter-btn');
    const dropdown = document.querySelector('.collection-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterDropdown);
  } else {
    initFilterDropdown();
  }
})();
