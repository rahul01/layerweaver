/**
 * cart.js – LayerWeaver Shopify cart integration
 * Uses Storefront API to manage cart. Injects cart icon + drawer into the page.
 */
(function () {
  const DOMAIN            = 'shop.layerweaver.com';
  const TOKEN             = '7f0eafeb115e99a4a917e044a1fb4125';
  const API               = `https://${DOMAIN}/api/2025-01/graphql.json`;
  const KEY                = 'lw_cart_id';

  // Unified cart rewards ladder - free shipping plus the Raksha Bandhan 2026
  // campaign (2026-08-06 → 2026-08-28). Thresholds/codes mirror the live
  // Shopify discount codes - see .ai/plans/rakshabandhan-2026-site-masterplan.md.
  // Shipping has no discount code (it's just informational - Shopify applies
  // it automatically at checkout based on order value). The 3 Rakhi offers
  // are single-use discount codes (BUNNY499 is a code-based BXGY, not an
  // automatic one) so only one is ever active on a cart at a time - Shopify's
  // discount engine doesn't allow a BXGY (the free-gift mechanic) to combine
  // with an order-wide % off code on the same order, so "free gift AND % off"
  // was never achievable; mutually-exclusive codes sidesteps that entirely.
  // Tiers are ordered ascending; the highest tier whose min the subtotal
  // meets is always the active discount code (a customer at ₹3000 gets
  // RAKHI10, not RAKHI05 or BUNNY499).
  //
  // BUNNY499 needs the Bunny Keychain physically in the cart to have
  // anything to make free (verified: applying it to a cart with no keychain
  // line leaves it inapplicable) - so syncRakhiPerks auto-adds/removes that
  // line whenever BUNNY499 is the active tier, tagged with GIFT_LINE_ATTR so
  // it can tell "the line it added" apart from a keychain the customer
  // bought themselves.
  const RAKHI_GIFT_VARIANT_GID = 'gid://shopify/ProductVariant/48079833432286'; // Bunny Keychain
  const GIFT_LINE_ATTR = '_rakhi_bunny499_gift';
  const REWARD_TIERS = [
    { min: 299,  label: 'Free Shipping',        icon: 'fa-truck-fast' },
    { min: 499,  code: 'BUNNY499', label: 'Free Bunny Keychain', needsGiftLine: true, icon: 'fa-gift' },
    { min: 1499, code: 'RAKHI05',  label: '5% off (RAKHI05)',    text: '5%' },
    { min: 2999, code: 'RAKHI10',  label: '10% off (RAKHI10)',   text: '10%' },
  ];
  const RAKHI_TIERS = REWARD_TIERS.filter(t => t.code);
  const RAKHI_CODES = RAKHI_TIERS.map(t => t.code);

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

  function attributionCartAttributes() {
    let attribution;
    try { attribution = JSON.parse(localStorage.getItem('lw_attribution') || 'null'); } catch { return []; }
    if (!attribution) return [];
    const map = {
      'Attribution Source':   attribution.source,
      'Attribution Medium':   attribution.utm_medium,
      'Attribution Campaign': attribution.utm_campaign,
      'Landing Page':         attribution.landingPage,
      'Referrer':             attribution.referrer,
    };
    return Object.entries(map).filter(([, v]) => v).map(([key, value]) => ({ key, value }));
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
    cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
    discountCodes { code applicable }
  `;

  // ── API calls ─────────────────────────────────────────────────────────────

  async function createCart(variantId, qty, attributes = []) {
    const line = { merchandiseId: variantId, quantity: qty };
    if (attributes.length) line.attributes = attributes;
    const input = { lines: [line] };
    const attrAttrs = attributionCartAttributes();
    if (attrAttrs.length) input.attributes = attrAttrs;
    const data = await gql(`
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) { cart { ${CART_FIELDS} } }
      }`, { input });
    return data.cartCreate.cart;
  }

  async function fetchCart(cartId) {
    const data = await gql(`
      query getCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
      { id: cartId });
    return data.cart;
  }

  // Line IDs only, deliberately not touching `merchandise` - a line whose
  // variant Shopify can no longer resolve (e.g. after a color-variant swap
  // in the admin) makes any query that expands that line's merchandise
  // throw, and since CartLine/its edges are non-null in the schema, that
  // failure doesn't just null out the one field - it propagates up and
  // takes the *entire* cart query down with it. This query has nothing for
  // a broken variant to break, so it reliably succeeds even when the cart
  // holds a poisoned line, which is what makes recovery possible below.
  async function fetchCartLineIds(cartId) {
    const data = await gql(`
      query getCartLineIds($id: ID!) { cart(id: $id) { id lines(first: 20) { edges { node { id } } } } }`,
      { id: cartId });
    return data.cart?.lines.edges.map(e => e.node.id) || [];
  }

  // Recovers a cart that fails to load because one (or more) of its lines
  // references a variant that no longer exists in Shopify, without
  // discarding lines that are still fine. There's no reliable way to know
  // *which* line is bad from the failed query alone (see fetchCartLineIds
  // above), so this removes one candidate at a time and retries the real
  // fetch after each removal, stopping as soon as it succeeds - in the
  // common case (a single bad line) that's one extra round trip, and it
  // never touches a line that turns out to be fine.
  async function recoverCart(cartId) {
    let remaining;
    try {
      remaining = await fetchCartLineIds(cartId);
    } catch {
      return null; // cart itself is gone, not just a bad line - nothing to salvage
    }
    while (remaining.length) {
      const lineId = remaining.shift();
      await removeLine(cartId, lineId).catch(() => {});
      try {
        return await fetchCart(cartId);
      } catch { /* still broken - try removing the next candidate */ }
    }
    return null;
  }

  async function rawAddLines(cartId, lines) {
    const data = await gql(`
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } }
      }`, { cartId, lines });
    return data.cartLinesAdd.cart;
  }

  // Adding a variant already present as a line merges into that line's
  // quantity server-side - the same quantity-increase-while-discounted bug
  // documented above on updateLines applies here too (verified: adding a
  // variant already in the cart while a code is active can even bump the
  // *wrong* line's quantity, not just fragment the right one). currentCart
  // is optional so the handful of call sites that only ever add to an empty
  // or freshly-created cart (no discount code could possibly be active yet)
  // don't need to plumb it through.
  async function addLines(cartId, lines, currentCart = null) {
    const priorCodes = (currentCart?.discountCodes || []).filter(c => c.applicable).map(c => c.code);
    if (!priorCodes.length) return rawAddLines(cartId, lines);

    await setDiscountCodes(cartId, []);
    const updated = await rawAddLines(cartId, lines);
    try {
      return await setDiscountCodes(cartId, priorCodes);
    } catch (err) {
      console.warn('[Cart] Failed to restore discount codes after add:', err);
      return updated;
    }
  }

  async function addLine(cartId, variantId, qty, attributes = []) {
    const line = { merchandiseId: variantId, quantity: qty };
    if (attributes.length) line.attributes = attributes;
    return addLines(cartId, [line]);
  }

  // Shopify's cartLinesUpdate has been observed to occasionally fragment a
  // line instead of updating its quantity in place - verified via direct
  // API testing: any cartLinesUpdate that *increases* a line's quantity
  // while the cart has an active discount code fragments that line into
  // two (e.g. requesting quantity 7 on an existing qty-6 line comes back as
  // two lines, qty 1 + qty 6, instead of one line at qty 7). Decreases and
  // no-op updates are unaffected, and it's not specific to which line is
  // discounted - any line, discounted or not, fragments on increase.
  // Reapplying the same discount code afterward does not itself fragment
  // anything, so the fix is to always increase quantity with no discount
  // code active, then restore it: strip codes -> update -> reapply.
  async function rawUpdateLines(cartId, updates) {
    const data = await gql(`
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } }
      }`, { cartId, lines: updates });
    return data.cartLinesUpdate.cart;
  }

  async function updateLines(cartId, updates, currentCart = null) {
    const priorCodes = (currentCart?.discountCodes || []).filter(c => c.applicable).map(c => c.code);
    const isIncrease = currentCart && updates.some(u => {
      const line = currentCart.lines.edges.find(e => e.node.id === u.id)?.node;
      return line && u.quantity > line.quantity;
    });

    if (!priorCodes.length || !isIncrease) {
      return rawUpdateLines(cartId, updates);
    }

    // Strip discount codes, apply the quantity increase safely, then restore
    // whatever *non-Rakhi* codes were active - a no-op reapply of a stable
    // code doesn't fragment anything, only quantity increases do. A Rakhi
    // code is deliberately NOT restored here even if it was active before:
    // this update may have just crossed a tier boundary, and re-applying the
    // old (now possibly wrong) tier's code would be visible to anyone
    // reading cart state between this call and syncRakhiPerks's correction
    // right after - syncRakhiPerks is the sole source of truth for which
    // Rakhi code (if any) belongs on the cart, so it's left off here and
    // applied fresh once.
    const nonRakhiCodes = priorCodes.filter(c => !RAKHI_CODES.includes(c));
    await setDiscountCodes(cartId, []);
    const updated = await rawUpdateLines(cartId, updates);
    if (!nonRakhiCodes.length) return updated;
    try {
      return await setDiscountCodes(cartId, nonRakhiCodes);
    } catch (err) {
      console.warn('[Cart] Failed to restore discount codes after qty increase:', err);
      return updated;
    }
  }

  async function updateLine(cartId, lineId, qty, currentCart = null) {
    return updateLines(cartId, [{ id: lineId, quantity: qty }], currentCart);
  }

  async function removeLines(cartId, lineIds) {
    const data = await gql(`
      mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } }
      }`, { cartId, lineIds });
    return data.cartLinesRemove.cart;
  }

  async function removeLine(cartId, lineId) {
    return removeLines(cartId, [lineId]);
  }

  // One-time cleanup for carts that still hold the free-gift line item and/or
  // discount code from the retired 6-month campaign (added server-side, so
  // removing the client code doesn't remove it from the cart). Checked
  // independently rather than inferring the discount from the line's presence,
  // so a cart with the code but no line (or vice versa) still gets cleaned up.
  async function cleanupLegacyGiftLine() {
    if (!cart) return;
    const giftLine = cart.lines.edges.find(e =>
      e.node.attributes?.some(a => a.key === '_gift' && a.value === 'FREEGIFT299')
    )?.node;
    const hasLegacyDiscount = () => cart.discountCodes?.some(c => c.code === 'FREEGIFT299');
    if (!giftLine && !hasLegacyDiscount()) return;
    try {
      if (giftLine) {
        cart = await removeLine(cart.id, giftLine.id);
      }
      if (hasLegacyDiscount()) {
        const data = await gql(`
          mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
            cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
              cart { ${CART_FIELDS} }
            }
          }`, { cartId: cart.id, discountCodes: [] });
        if (data?.cartDiscountCodesUpdate?.cart) cart = data.cartDiscountCodesUpdate.cart;
      }
    } catch (err) {
      console.warn('[Cart] Legacy gift line cleanup failed:', err);
    }
  }

  // Per-char surcharge lines (see handleAddToCart) only make sense paired
  // with their base line via a shared `_pgroup` attribute. A surcharge line
  // whose base line is missing - e.g. removed by a pre-pairing version of
  // this code, or some other path that bypassed handleRemoveLine - is a
  // silent overcharge with nothing left to explain it, so it's swept on
  // every cart load rather than left for the customer to notice at checkout.
  async function cleanupOrphanSurchargeLines() {
    if (!cart) return;
    const lines = cart.lines.edges.map(e => e.node);
    const orphanIds = lines
      .filter(isSurchargeLine)
      .filter(sLine => {
        const pgroup = attrValue(sLine, '_pgroup');
        return !lines.some(b => !isSurchargeLine(b) && attrValue(b, '_pgroup') === pgroup);
      })
      .map(l => l.id);
    if (!orphanIds.length) return;
    try {
      cart = await removeLines(cart.id, orphanIds);
    } catch (err) {
      console.warn('[Cart] Orphan surcharge line cleanup failed:', err);
    }
  }

  async function setDiscountCodes(cartId, codes) {
    const data = await gql(`
      mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
        cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
          cart { ${CART_FIELDS} }
        }
      }`, { cartId, discountCodes: codes });
    return data.cartDiscountCodesUpdate.cart;
  }

  // Keeps the cart's free Bunny Keychain line and RAKHI05/RAKHI10 discount
  // code in sync with the cart subtotal, on every cart load/mutation.
  // Eligibility is computed against the subtotal *excluding* the auto-added
  // gift line's own price, so adding the ₹99 gift never causes the ₹1,499/
  // ₹2,999 tiers to be crossed on their own - only the customer's real
  // purchases decide the code tier.
  // The customer's real spend, excluding the auto-added gift line - used for
  // reward-tier eligibility everywhere so adding the ₹99 gift never causes
  // the ₹1,499/₹2,999 tiers to be crossed on its own. Deliberately sums each
  // non-gift line's own price×quantity rather than using
  // cart.cost.subtotalAmount minus the gift line's price: verified that
  // Shopify's subtotalAmount silently EXCLUDES a 100%-off line once
  // cartDiscountCodesUpdate has been applied (though not right after
  // cartLinesAdd, before the code exists) - subtracting the gift price from
  // an already-excluding subtotal double-subtracted it, undercounting the
  // customer's real spend by ₹99 and delaying every tier crossing by one
  // click.
  function rakhiEligibleSubtotal(cart) {
    return cart.lines.edges
      .map(e => e.node)
      .filter(l => attrValue(l, GIFT_LINE_ATTR) !== 'true')
      .reduce((s, l) => s + parseFloat(l.merchandise.price.amount) * l.quantity, 0);
  }

  // Sum of every line (including the gift line) at full, undiscounted price -
  // i.e. what the cart would cost with no discount at all. Used to show the
  // "was ₹X, discount -₹Y, now ₹Z" breakdown in the footer. Computed the same
  // way as rakhiEligibleSubtotal (summing each line's own price×quantity)
  // rather than trusting cart.cost.subtotalAmount, since that field has been
  // observed to silently exclude a 100%-off line once a discount code is
  // applied - see rakhiEligibleSubtotal's comment for the full story.
  function cartFullPriceTotal(cart) {
    return cart.lines.edges
      .map(e => e.node)
      .reduce((s, l) => s + parseFloat(l.merchandise.price.amount) * l.quantity, 0);
  }

  async function syncRakhiPerks() {
    if (!cart) return;

    const giftLine = cart.lines.edges.map(e => e.node).find(l => attrValue(l, GIFT_LINE_ATTR) === 'true');
    const subtotal = rakhiEligibleSubtotal(cart);

    const bestTier = RAKHI_TIERS.filter(t => subtotal >= t.min).pop() || null;
    const bestCode = bestTier?.code || null;
    const wantsGiftLine = !!bestTier?.needsGiftLine;

    // ── Gift line (BUNNY499 needs the Bunny Keychain physically in the cart
    // to have anything to make free - see the block comment above) ──
    if (wantsGiftLine && !giftLine) {
      try {
        cart = await addLines(cart.id, [{
          merchandiseId: RAKHI_GIFT_VARIANT_GID,
          quantity: 1,
          attributes: [{ key: GIFT_LINE_ATTR, value: 'true' }],
        }], cart);
      } catch (err) {
        console.warn('[Cart] Rakhi gift add failed:', err);
      }
    } else if (!wantsGiftLine && giftLine) {
      try {
        cart = await removeLine(cart.id, giftLine.id);
      } catch (err) {
        console.warn('[Cart] Rakhi gift remove failed:', err);
      }
    } else if (wantsGiftLine && giftLine && giftLine.quantity !== 1) {
      // Guard against the gift line's quantity ever being bumped above 1
      // (e.g. a stray updateLines call elsewhere) - it's a single free item.
      try {
        cart = await updateLine(cart.id, giftLine.id, 1, cart);
      } catch (err) {
        console.warn('[Cart] Rakhi gift quantity fix failed:', err);
      }
    }

    // ── Discount code ──
    // Only ever manage the Rakhi codes here - if the customer already has a
    // non-Rakhi code applied (e.g. FAMILY15), leave it alone entirely rather
    // than clobbering it with cartDiscountCodesUpdate's full-replace semantics.
    const currentCodes = (cart.discountCodes || []).map(c => c.code);
    const currentRakhi = currentCodes.find(c => RAKHI_CODES.includes(c)) || null;
    const otherCodes   = currentCodes.filter(c => !RAKHI_CODES.includes(c));

    if (currentRakhi !== bestCode) {
      const nextCodes = bestCode ? [...otherCodes, bestCode] : otherCodes;
      try {
        cart = await setDiscountCodes(cart.id, nextCodes);
      } catch (err) {
        console.warn('[Cart] Rakhi discount code sync failed:', err);
      }
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
      <div class="cart-body" id="cart-body"></div>
      <div class="cart-footer" id="cart-footer">
        <div id="cart-checkout-section" style="display:none">
          <div id="rewards-progress" class="rewards-progress" style="display:none">
            <div class="rewards-bar-track">
              <div class="rewards-bar-fill" id="rewards-bar-fill"></div>
              <div class="rewards-bar-ticks" id="rewards-bar-ticks"></div>
            </div>
            <p class="rewards-bar-msg" id="rewards-bar-msg"></p>
          </div>
          <div class="cart-discount-row" id="cart-discount-row" style="display:none">
            <span>Subtotal</span>
            <span id="cart-subtotal-price"></span>
          </div>
          <div class="cart-discount-row cart-discount-savings" id="cart-savings-row" style="display:none">
            <span id="cart-discount-label">Discount</span>
            <span id="cart-discount-amount"></span>
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
    let _drawerBusy = false; // still used to serialize remove-btn, which fully re-renders
    // Rapid +/- clicks on the same line are debounced into a single mutation
    // chain targeting the final quantity, instead of firing a full
    // clear-code/update/reapply round trip (see updateLines) per click - both
    // because each round trip is ~600-900ms (feels sluggish under fast
    // clicking) and because collapsing N clicks into one mutation means only
    // one clear/reapply detour instead of N. The displayed number updates
    // immediately on every click (optimistic) so the UI never feels stuck
    // waiting on the network; the real re-render after the debounced mutation
    // settles simply overwrites it with the true state.
    const _pending = new Map(); // lineId -> { qty, pairedLineId, extraLineIds, timer }
    const DEBOUNCE_MS = 450;

    function flushPending(lineId) {
      const p = _pending.get(lineId);
      if (!p) return Promise.resolve();
      _pending.delete(lineId);
      setLineBusy(lineId, true);
      const run = p.extraLineIds.length
        ? (p.qty <= 0
            ? handleRemoveLine(lineId, p.pairedLineId, p.extraLineIds)
            : handleConsolidateAndUpdate(lineId, p.extraLineIds, p.qty))
        : (p.qty <= 0
            ? handleRemoveLine(lineId, p.pairedLineId)
            : handleUpdateLine(lineId, p.qty, p.pairedLineId));
      return run.finally(() => setLineBusy(lineId, false));
    }

    function setLineBusy(lineId, busy) {
      document.querySelectorAll(`[data-line-id="${lineId}"]`).forEach(el => {
        el.disabled = busy;
      });
    }

    document.getElementById('cart-body').addEventListener('click', (e) => {
      const btn = e.target.closest('.qty-dec, .qty-inc, .remove-btn');
      if (!btn) return;
      const lineId = btn.dataset.lineId;
      const pairedLineId = btn.dataset.pairedLineId || null;
      const extraLineIds = btn.dataset.extraLineIds ? btn.dataset.extraLineIds.split(',') : [];

      if (btn.classList.contains('remove-btn')) {
        if (_drawerBusy) return;
        // Flush any other line's pending debounced update first and wait for
        // it - handleRemoveLine/handleUpdateLine both read/write the shared
        // `cart` global, so two of these flows racing on the network would
        // let whichever response lands second silently clobber the other's
        // result.
        _pending.delete(lineId);
        const others = [..._pending.keys()];
        _drawerBusy = true;
        setDrawerLoading(true);
        Promise.all(others.map(id => {
          clearTimeout(_pending.get(id).timer);
          return flushPending(id);
        }))
          .then(() => handleRemoveLine(lineId, pairedLineId, extraLineIds))
          .finally(() => {
            _drawerBusy = false;
            setDrawerLoading(false);
          });
        return;
      }

      // Base quantity to increment/decrement from: whatever's already
      // pending for this line (so repeated clicks accumulate), else what's
      // currently on screen.
      const baseQty = _pending.has(lineId) ? _pending.get(lineId).qty : parseInt(btn.dataset.qty);
      const nextQty = baseQty + (btn.classList.contains('qty-dec') ? -1 : 1);

      // Reflect the click immediately in the displayed number and badge -
      // the real cart.totalQuantity is restored by refreshUI() once the
      // debounced mutation settles, this is purely a felt-latency fix.
      const qtyDisplay = btn.closest('.line-qty')?.querySelector('span');
      if (qtyDisplay && nextQty > 0) qtyDisplay.textContent = nextQty;
      document.querySelectorAll(`[data-line-id="${lineId}"][data-qty]`).forEach(el => {
        el.dataset.qty = Math.max(nextQty, 0);
      });
      const badge = document.getElementById('cart-badge');
      if (badge) {
        const delta = btn.classList.contains('qty-dec') ? -1 : 1;
        badge.textContent = Math.max(parseInt(badge.textContent || '0') + delta, 0);
      }

      const existing = _pending.get(lineId);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => flushPending(lineId), DEBOUNCE_MS);
      _pending.set(lineId, { qty: nextQty, pairedLineId, extraLineIds, timer });
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

  function injectRewardsBubble() {
    if (document.getElementById('rewards-bubble')) return;
    const bubble = document.createElement('div');
    bubble.id = 'rewards-bubble';
    bubble.innerHTML = `
      <p class="bubble-msg" id="bubble-msg"></p>
      <div class="bubble-track"><div class="bubble-fill" id="bubble-fill"></div></div>`;
    document.body.appendChild(bubble);
  }

  let _bubbleTimer = null;
  function showRewardsBubble(pct, msg, unlocked) {
    const bubble = document.getElementById('rewards-bubble');
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

  // Single staged bar with a tick mark at every threshold - free shipping
  // (₹299) through the 3 Rakhi tiers. Ticks are spaced evenly (not
  // proportional to the ₹ gap between them) so the huge jump from ₹499 to
  // ₹2,999 doesn't crush the first two milestones into the left edge of the
  // bar - each stage gets equal visual room regardless of how many rupees
  // it actually spans. Uses the same cart subtotal as syncRakhiPerks so the
  // bar and the actually-applied discount code never disagree about which
  // tier the cart is in.
  function renderRewardsBar() {
    const progressEl = document.getElementById('rewards-progress');
    const fill        = document.getElementById('rewards-bar-fill');
    const ticksEl      = document.getElementById('rewards-bar-ticks');
    const msg          = document.getElementById('rewards-bar-msg');
    if (!progressEl || !fill || !ticksEl || !msg || !cart) return;

    const subtotal = rakhiEligibleSubtotal(cart);

    if (subtotal <= 0) { progressEl.style.display = 'none'; return; }
    progressEl.style.display = '';

    // Ticks at (i+1)/n rather than i/(n-1), so the first milestone (free
    // shipping) sits a stretch into the bar instead of glued to the left
    // edge - the empty run from 0% represents "cart just started, nothing
    // unlocked yet" rather than looking like shipping is already halfway won.
    const n = REWARD_TIERS.length;
    const tickPct = i => ((i + 1) / n) * 100;

    if (!ticksEl.dataset.built) {
      ticksEl.innerHTML = REWARD_TIERS.map((t, i) => {
        const inner = t.text
          ? `<span class="rewards-tick-text">${esc(t.text)}</span>`
          : `<i class="fa-solid ${t.icon}"></i>`;
        return `<span class="rewards-tick${t.text ? ' rewards-tick-has-text' : ''}" data-tier-index="${i}" style="left:${tickPct(i)}%" title="${esc(t.label)}">
          ${inner}
        </span>`;
      }).join('');
      ticksEl.dataset.built = 'true';
    }

    // Fill width by segment progress, not raw ₹ ratio: full width to the
    // last fully-met tick, plus partial progress across the current segment
    // toward the next one.
    let pct;
    const metIdx = REWARD_TIERS.reduce((last, t, i) => subtotal >= t.min ? i : last, -1);
    if (metIdx === n - 1) {
      pct = 100;
    } else {
      const segStart = metIdx === -1 ? 0 : REWARD_TIERS[metIdx].min;
      const segEnd = REWARD_TIERS[metIdx + 1].min;
      const segFrac = Math.min(Math.max((subtotal - segStart) / (segEnd - segStart), 0), 1);
      const segStartPct = metIdx === -1 ? 0 : tickPct(metIdx);
      const segEndPct = tickPct(metIdx + 1);
      pct = segStartPct + segFrac * (segEndPct - segStartPct);
    }
    fill.style.width = pct + '%';

    const nextTier = REWARD_TIERS.find(t => subtotal < t.min);
    const metCount = REWARD_TIERS.filter(t => subtotal >= t.min).length;

    // Light up each milestone icon individually as its own threshold is
    // reached, rather than only styling the bar as a whole.
    ticksEl.querySelectorAll('.rewards-tick').forEach((tickEl, i) => {
      tickEl.classList.toggle('rewards-tick-reached', subtotal >= REWARD_TIERS[i].min);
    });

    let text;
    if (!nextTier) {
      text = `🎉 All rewards unlocked!`;
    } else {
      const remaining = (nextTier.min - subtotal).toFixed(0);
      text = `🪢 Add ₹${remaining} more for ${nextTier.label}`;
    }
    msg.textContent = text;
    const allUnlocked = !nextTier;
    progressEl.classList.toggle('rewards-all-unlocked', allUnlocked);

    const wasMetCount = parseInt(sessionStorage.getItem('lw_rewards_tier_count') || '0');
    if (_cartReady && metCount > wasMetCount) spawnPageConfetti();
    sessionStorage.setItem('lw_rewards_tier_count', metCount);

    // ── Speech bubble near cart icon ──
    // Nudge on every render while there's still a reward to chase, and once
    // more right when the last tier gets crossed - matches the old shipping
    // bubble's behavior (only staying silent once already fully unlocked and
    // nothing changed).
    if (_cartReady && (!allUnlocked || metCount !== wasMetCount)) {
      showRewardsBubble(pct, text, allUnlocked);
    }
  }

  // Attribute keys starting with `_` are internal bookkeeping (pairing
  // tokens, flags) - never shown to the customer as a line detail.
  function attrValue(line, key) {
    return line.attributes?.find(a => a.key === key)?.value;
  }

  function isSurchargeLine(line) {
    return attrValue(line, '_surcharge') === 'true';
  }

  function renderCart() {
    const body   = document.getElementById('cart-body');
    const total  = document.getElementById('cart-total-price');
    const chkBtn = document.getElementById('cart-checkout-btn');
    if (!body) return;

    const lines = cart ? cart.lines.edges.map(e => e.node) : [];

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

    // Shopify's cartLinesUpdate/cartDiscountCodesUpdate has a verified
    // server-side quirk where a line's quantity fragments into two lines
    // (same variant, same attributes, split quantity) once a discount code
    // is applied/reapplied to the cart - retrying doesn't self-heal it, so
    // rather than fight an unfixable API behavior, duplicate lines are
    // merged for *display* only: shown as one row summing their quantities,
    // with the mutation handlers (below) fanning qty/remove actions out
    // across every real line ID behind that row. Gift and surcharge lines
    // are excluded - only ever added once at qty 1, they don't fragment.
    const dupGroups = new Map(); // "variantId::attrsKey" -> line[]
    for (const line of lines) {
      if (isSurchargeLine(line) || attrValue(line, GIFT_LINE_ATTR) === 'true') continue;
      const key = `${line.merchandise.id}::${(line.attributes || []).map(a => `${a.key}=${a.value}`).sort().join('|')}`;
      if (!dupGroups.has(key)) dupGroups.set(key, []);
      dupGroups.get(key).push(line);
    }
    const mergedIds = new Set(); // ids folded into a merged display line, so raw baseLines skips them
    const extraLineIdsFor = new Map(); // primary line id -> [other real line ids also representing this row]
    for (const group of dupGroups.values()) {
      if (group.length < 2) continue;
      const [primary, ...rest] = group;
      extraLineIdsFor.set(primary.id, rest.map(l => l.id));
      rest.forEach(l => mergedIds.add(l.id));
    }

    // Pair each per-char surcharge line to its base line via the shared
    // `_pgroup` token so it can render nested (no independent qty/remove
    // controls) instead of as its own confusing line item. A surcharge line
    // whose base line is gone (e.g. removed before this pairing existed)
    // falls back to rendering as a normal standalone line rather than being
    // silently hidden.
    const surchargeLines = lines.filter(isSurchargeLine);
    const baseLines = lines.filter(l => !isSurchargeLine(l) && !mergedIds.has(l.id));
    const pairedSurchargeIds = new Set();
    const surchargeFor = new Map(); // base line id -> surcharge line
    for (const sLine of surchargeLines) {
      const pgroup = attrValue(sLine, '_pgroup');
      const base = pgroup && baseLines.find(b => attrValue(b, '_pgroup') === pgroup);
      if (base) {
        surchargeFor.set(base.id, sLine);
        pairedSurchargeIds.add(sLine.id);
      }
    }
    const orphanSurchargeLines = surchargeLines.filter(l => !pairedSurchargeIds.has(l.id));
    const renderOrder = [...baseLines, ...orphanSurchargeLines];

    body.innerHTML = renderOrder.map(line => {
      const v     = line.merchandise;
      const price = fmt(v.price.amount, v.price.currencyCode);
      const img   = v.image ? `<img src="${v.image.url}" alt="${esc(v.image.altText || v.product.title)}">` : '';
      const swatchHex = (window.LW_SWATCHES?.[v.product.handle]?.[v.title]);
      const swatchDot = swatchHex
        ? `<span class="line-variant-swatch" style="background:${swatchHex}${swatchHex === '#ffffff' ? ';border-color:#ddd' : ''}"></span>`
        : '';
      const variantLabel = v.title !== 'Default Title'
        ? `<span class="line-variant">${swatchDot}${esc(v.title)}</span>`
        : '';
      const customAttrs = line.attributes?.filter(a => a.value && !a.key.startsWith('_'))
        .map(a => `<span class="line-attr"><em>${esc(a.key)}:</em> ${esc(a.value)}</span>`).join('') || '';

      const pairedSurcharge = surchargeFor.get(line.id);
      const surchargeNote = pairedSurcharge
        ? `<p class="line-personalization-surcharge">+ ${pairedSurcharge.quantity} extra character${pairedSurcharge.quantity > 1 ? 's' : ''}: <span class="line-price">${fmt(pairedSurcharge.quantity * parseFloat(pairedSurcharge.merchandise.price.amount), pairedSurcharge.merchandise.price.currencyCode)}</span></p>`
        : '';
      const pairedAttr = pairedSurcharge ? ` data-paired-line-id="${pairedSurcharge.id}"` : '';

      // If Shopify fragmented this variant into multiple real lines (see the
      // dupGroups comment above), fold their quantities into one displayed
      // number and tag the extra line IDs so qty/remove clicks fan out to
      // all of them, not just the "primary" one shown here.
      const extraIds = extraLineIdsFor.get(line.id) || [];
      const extraLines = extraIds.map(id => lines.find(l => l.id === id)).filter(Boolean);
      const displayQty = line.quantity + extraLines.reduce((s, l) => s + l.quantity, 0);
      const extraAttr = extraIds.length ? ` data-extra-line-ids="${extraIds.join(',')}"` : '';

      // The auto-added BUNNY499 gift line (see syncRakhiPerks) is a locked
      // qty-1 freebie, not a normal line - no qty controls, price shown as
      // "FREE" (the real ₹0 only reconciles once BUNNY499 is applied), and a
      // badge so it doesn't read as an accidental purchase.
      const isGift = attrValue(line, GIFT_LINE_ATTR) === 'true';
      const giftBadge = isGift ? `<span class="line-gift-badge"><i class="fa-solid fa-gift"></i> Free Gift</span>` : '';
      const lineControls = isGift
        ? `<div class="line-qty line-qty-gift">
            <button class="remove-btn" data-line-id="${line.id}" aria-label="Remove free gift">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`
        : `<div class="line-qty">
            <button class="qty-btn qty-dec" data-line-id="${line.id}"${pairedAttr}${extraAttr} data-qty="${displayQty}">−</button>
            <span>${displayQty}</span>
            <button class="qty-btn qty-inc" data-line-id="${line.id}"${pairedAttr}${extraAttr} data-qty="${displayQty}">+</button>
            <button class="remove-btn" data-line-id="${line.id}"${pairedAttr}${extraAttr} aria-label="Remove">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;

      return `
        <div class="cart-line${isGift ? ' cart-line-gift' : ''}" data-line-id="${line.id}">
          <a class="cart-line-link" href="${SHOP_ROOT}products/${v.product.handle}/">
            <div class="line-image">${img}</div>
            <div class="line-info">
              <p class="line-title">${esc(v.product.title)} ${giftBadge}</p>
              ${variantLabel}
              ${customAttrs}
              <p class="line-price">${isGift ? '<s>' + price + '</s> FREE' : price}</p>
              ${surchargeNote}
            </div>
          </a>
          ${lineControls}
        </div>`;
    }).join('');

    // Footer
    const costAmt = cart.cost.totalAmount;
    total.textContent = fmt(costAmt.amount, costAmt.currencyCode);
    chkBtn.href = cart.checkoutUrl;
    renderDiscountBreakdown(cart);
    const checkoutSection = document.getElementById('cart-checkout-section');
    if (checkoutSection) checkoutSection.style.display = 'contents';
    renderRewardsBar();
  }

  // Shows "Subtotal ₹X" / "Discount -₹Y" rows above the Total whenever any
  // discount is actually saving the customer money - either a Rakhi code
  // (RAKHI05/RAKHI10, computed as % off) or the BUNNY499 gift line itself
  // (100% off just that line). Hidden entirely when nothing is discounted,
  // so the footer looks exactly as it always has for a plain cart.
  function renderDiscountBreakdown(cart) {
    const subtotalRow = document.getElementById('cart-discount-row');
    const savingsRow  = document.getElementById('cart-savings-row');
    const subtotalEl  = document.getElementById('cart-subtotal-price');
    const labelEl     = document.getElementById('cart-discount-label');
    const amountEl    = document.getElementById('cart-discount-amount');
    if (!subtotalRow || !savingsRow || !subtotalEl || !labelEl || !amountEl) return;

    const fullPrice = cartFullPriceTotal(cart);
    const actualTotal = parseFloat(cart.cost.totalAmount.amount);
    const savings = fullPrice - actualTotal;
    const currency = cart.cost.totalAmount.currencyCode;

    if (savings <= 0.01) {
      subtotalRow.style.display = 'none';
      savingsRow.style.display = 'none';
      return;
    }

    const activeCode = (cart.discountCodes || []).find(c => c.applicable && RAKHI_CODES.includes(c.code))?.code;
    const tier = RAKHI_TIERS.find(t => t.code === activeCode);
    labelEl.textContent = tier ? tier.label : 'Discount';

    subtotalEl.textContent = fmt(fullPrice, currency);
    amountEl.textContent = `-${fmt(savings, currency)}`;
    subtotalRow.style.display = '';
    savingsRow.style.display = '';
  }

  // ── Drawer open / close ───────────────────────────────────────────────────

  function openDrawer() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof gtag === 'function') gtag('event', 'view_cart', {
      currency: cart?.cost?.totalAmount?.currencyCode || '',
      value:    parseFloat(cart?.cost?.totalAmount?.amount || 0),
      items: (cart?.lines?.edges || []).map(e => ({
        item_id:   e.node.merchandise.id.split('/').pop(),
        item_name: e.node.merchandise.product.title,
        price:     parseFloat(e.node.merchandise.price.amount),
        quantity:  e.node.quantity,
      })),
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

  // Shared by single-item and multi-item (e.g. per-char surcharge) add-to-cart
  // flows. `lines` is an array of { merchandiseId, quantity, attributes? }.
  async function addLinesCore(lines) {
    const cartId = loadCartId();
    const cartBefore = cart;
    if (cartId) {
      try {
        cart = await addLines(cartId, lines, cartBefore);
      } catch (err) {
        // A line elsewhere in this cart likely references a variant that no
        // longer exists (e.g. after swapping color variants in Shopify) -
        // try to salvage the rest of the cart before giving up on it
        // entirely. See recoverCart().
        console.warn('[Cart] Add failed, attempting to recover the existing cart:', err);
        const recovered = await recoverCart(cartId);
        cart = recovered ? await addLines(cartId, lines, recovered).catch(() => null) : null;
      }
      if (!cart) {
        localStorage.removeItem(KEY);
        cart = await createCart(lines[0].merchandiseId, lines[0].quantity, lines[0].attributes || []);
        if (lines.length > 1) cart = await addLines(cart.id, lines.slice(1), cart);
        saveCartId(cart.id);
        syncCartIdToServer(cart.id);
      }
    } else {
      cart = await createCart(lines[0].merchandiseId, lines[0].quantity, lines[0].attributes || []);
      if (lines.length > 1) cart = await addLines(cart.id, lines.slice(1));
      saveCartId(cart.id);
      syncCartIdToServer(cart.id);
    }
    await syncRakhiPerks();
    refreshUI();

    const addedGids = new Set(lines.map(l => l.merchandiseId));
    const newLines = cart?.lines.edges
      .map(e => e.node)
      .filter(node => addedGids.has(node.merchandise.id)) || [];
    for (const newLine of newLines) {
      if (typeof fbq === 'function') fbq('track', 'AddToCart', {
        content_name: newLine.merchandise.product.title,
        content_ids:  [newLine.merchandise.id.split('/').pop()],
        content_type: 'product',
        value:        parseFloat(newLine.merchandise.price.amount),
        currency:     newLine.merchandise.price.currencyCode,
      });
    }
    if (newLines.length && typeof gtag === 'function') gtag('event', 'add_to_cart', {
      currency: newLines[0].merchandise.price.currencyCode,
      value:    newLines.reduce((sum, l) => sum + parseFloat(l.merchandise.price.amount) * l.quantity, 0),
      items: newLines.map(l => ({
        item_id:   l.merchandise.id.split('/').pop(),
        item_name: l.merchandise.product.title,
        price:     parseFloat(l.merchandise.price.amount),
        quantity:  l.quantity,
      })),
    });
    return cart;
  }

  async function addToCartCore(variantGid, qty = 1, attributes = []) {
    return addLinesCore([{ merchandiseId: variantGid, quantity: qty, attributes }]);
  }

  async function handleAddToCart(variantGid, qty = 1) {
    const btn = document.getElementById('add-to-cart-btn');

    const attributes = [];
    let text = '';
    if (btn?.dataset.personalized) {
      const input = document.getElementById('custom-text');
      text = input?.value.trim();
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
      // Per-character pricing: the cart can't override a line's price, so the
      // per-char rate is charged by adding a second line for a hidden
      // surcharge variant at quantity = characters beyond the first. The two
      // lines are tied together with a shared `_pgroup` token (keys starting
      // with `_` are internal - see customAttrs in renderCart) so the drawer
      // can pair them: the surcharge line never gets its own qty/remove
      // controls, and updating/removing the base line cascades to it.
      const rate = parseFloat(btn?.dataset.perCharRate);
      const surchargeGid = btn?.dataset.surchargeGid;
      if (rate && surchargeGid) {
        const extraChars = Math.max(0, text.length - 1);
        if (extraChars > 0) {
          const pgroup = `pg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          attributes.push({ key: '_pgroup', value: pgroup });
          const lines = [
            { merchandiseId: variantGid, quantity: qty, attributes },
            {
              merchandiseId: surchargeGid,
              quantity: extraChars * qty,
              attributes: [
                { key: 'Custom Text', value: text },
                { key: 'For', value: btn.dataset.forProduct || '' },
                { key: '_pgroup', value: pgroup },
                { key: '_surcharge', value: 'true' },
              ],
            },
          ];
          await addLinesCore(lines);
        } else {
          await addToCartCore(variantGid, qty, attributes);
        }
      } else {
        await addToCartCore(variantGid, qty, attributes);
      }
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert('Could not add to cart. Please try again.');
    } finally {
      setAddBtnLoading(btn, false);
    }
  }

  // `pairedLineId`, when present, is a per-char surcharge line tied to this
  // base line (see renderCart's pairing logic) - it's never given its own
  // qty/remove controls, so any change to the base line must cascade to it
  // here, in the same mutation, to keep the two in sync.
  async function handleUpdateLine(lineId, newQty, pairedLineId = null) {
    if (newQty <= 0) return handleRemoveLine(lineId, pairedLineId);
    if (pairedLineId) {
      const baseLine = cart?.lines.edges.find(e => e.node.id === lineId)?.node;
      const pairedLine = cart?.lines.edges.find(e => e.node.id === pairedLineId)?.node;
      if (baseLine && pairedLine && baseLine.quantity > 0) {
        const perUnit = pairedLine.quantity / baseLine.quantity;
        cart = await updateLines(cart.id, [
          { id: lineId, quantity: newQty },
          { id: pairedLineId, quantity: Math.round(perUnit * newQty) },
        ], cart);
        await syncRakhiPerks();
        refreshUI();
        return;
      }
    }
    cart = await updateLine(cart.id, lineId, newQty, cart);
    await syncRakhiPerks();
    refreshUI();
  }

  async function handleRemoveLine(lineId, pairedLineId = null, extraLineIds = []) {
    const line = cart?.lines.edges.find(e => e.node.id === lineId)?.node;
    // Capture extra fragment lines' quantities before cart is reassigned -
    // see renderCart's dupGroups comment for why a display row can be
    // backed by more than one real Shopify line.
    const extraQty = extraLineIds.reduce((s, id) => {
      const l = cart?.lines.edges.find(e => e.node.id === id)?.node;
      return s + (l?.quantity || 0);
    }, 0);
    const allIds = [lineId, pairedLineId, ...extraLineIds].filter(Boolean);
    cart = allIds.length > 1
      ? await removeLines(cart.id, allIds)
      : await removeLine(cart.id, lineId);
    await syncRakhiPerks();
    refreshUI();
    if (line) {
      if (typeof gtag === 'function') gtag('event', 'remove_from_cart', {
        currency: line.merchandise.price.currencyCode,
        value:    parseFloat(line.merchandise.price.amount) * (line.quantity + extraQty),
        items: [{
          item_id:   line.merchandise.id.split('/').pop(),
          item_name: line.merchandise.product.title,
          price:     parseFloat(line.merchandise.price.amount),
          quantity:  line.quantity + extraQty,
        }],
      });
    }
  }

  // Consolidates a Shopify-fragmented display row (see renderCart's
  // dupGroups) into a single real line, then sets it to targetQty in the
  // same safe sequence used elsewhere: clear any active discount code
  // (removal/update never fragments when no code is active), remove the
  // extra fragment lines, set the primary line to targetQty, reapply
  // whatever *non-Rakhi* code was active (see updateLines for why a Rakhi
  // code specifically is left for syncRakhiPerks to reapply fresh, rather
  // than restored here - targetQty may have just crossed a tier boundary).
  // A customer clicking +/- on an already-merged display row never sees
  // more than one line again after this runs.
  async function handleConsolidateAndUpdate(primaryLineId, extraLineIds, targetQty) {
    const priorCodes = (cart.discountCodes || []).filter(c => c.applicable).map(c => c.code);
    const nonRakhiCodes = priorCodes.filter(c => !RAKHI_CODES.includes(c));
    if (priorCodes.length) cart = await setDiscountCodes(cart.id, []);
    cart = await removeLines(cart.id, extraLineIds);
    cart = await rawUpdateLines(cart.id, [{ id: primaryLineId, quantity: targetQty }]);
    if (nonRakhiCodes.length) {
      try {
        cart = await setDiscountCodes(cart.id, nonRakhiCodes);
      } catch (err) {
        console.warn('[Cart] Failed to restore discount codes after consolidate:', err);
      }
    }
    await syncRakhiPerks();
    refreshUI();
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
                cart = await addLines(serverCartId, linesToMerge, serverCart);
              }
            } catch { /* local cart gone - ignore */ }
          }
          saveCartId(serverCartId);
          cart = await fetchCart(serverCartId);
          await syncRakhiPerks();
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
    injectRewardsBubble();

    // Restore cart from previous session
    const cartId = loadCartId();
    if (cartId) {
      try {
        cart = await fetchCart(cartId);
        if (!cart) { localStorage.removeItem(KEY); cart = null; } // cart explicitly gone on Shopify
        else { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); await syncRakhiPerks(); }
      } catch (err) {
        // Could be a real network error, or a line in this cart referencing
        // a variant Shopify can no longer resolve (see recoverCart). Try to
        // salvage it so the badge/drawer reflect what's actually still
        // there instead of quietly looking empty until the next add.
        console.warn('[Cart] Restoring saved cart failed, attempting recovery:', err);
        cart = await recoverCart(cartId).catch(() => null);
        if (cart) { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); await syncRakhiPerks(); }
      }
    }

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
        else { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); await syncRakhiPerks(); }
      } catch {
        cart = await recoverCart(cartId).catch(() => null);
        if (cart) { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); await syncRakhiPerks(); }
      }
    } else {
      cart = null;
    }
    refreshUI();
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
