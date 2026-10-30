/**
 * cart.js – LayerWeaver Shopify cart integration
 * Uses Storefront API to manage cart. Injects cart icon + drawer into the page.
 */
(function () {
  const DOMAIN            = 'shop.layerweaver.com';
  const TOKEN             = '7f0eafeb115e99a4a917e044a1fb4125';
  const API               = `https://${DOMAIN}/api/2025-01/graphql.json`;
  const KEY                = 'lw_cart_id';

  // Free shipping progress bar - evergreen cart messaging, not tied to any
  // campaign. Shipping has no discount code; Shopify applies it automatically
  // at checkout based on order value, so this is purely informational.
  const REWARD_TIERS = [
    { min: 299, label: 'Free Shipping', icon: 'fa-truck-fast' },
  ];

  // Next-order codes: orders Oct 21 - Nov 1, 2026 (IST) get a code for the
  // next order, sent by the dashboard. Shown in the cart rewards bar on those
  // dates only (the sitewide announcement bar has its own inline date check).
  // Remove in the Nov 9 cleanup.
  const NEXT_ORDER_FROM  = '2026-10-21';
  const NEXT_ORDER_TO    = '2026-11-01';
  // Same numbers as the dashboard (routes/lib/next-order-codes.js) and the
  // order email - change only together with them.
  const NEXT_ORDER_TIERS = [{ min: 599, off: 50 }, { min: 949, off: 100 }];

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

  // Mirrors attributionCartAttributes() / metaCookies() / fbcFromClick() in
  // shop/cart-utils.js (unit-tested there). "_" keys are hidden from the
  // customer by Shopify but land on the order: which ad (Content/Term) and
  // the Meta click IDs, so orders Meta can't see itself can be matched later.
  function metaCookies() {
    const out = {};
    for (const part of String(document.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      const k = part.slice(0, i).trim();
      if (k === '_fbc' || k === '_fbp') { try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
    }
    return out;
  }

  function attributionCartAttributes() {
    let attribution;
    try { attribution = JSON.parse(localStorage.getItem('lw_attribution') || 'null'); } catch { return []; }
    if (!attribution) return [];
    const cookies = metaCookies();
    const fbc = cookies._fbc || (attribution.fbclid ? `fb.1.${attribution.capturedAt || Date.now()}.${attribution.fbclid}` : null);
    const map = {
      'Attribution Source':   attribution.source,
      'Attribution Medium':   attribution.utm_medium,
      'Attribution Campaign': attribution.utm_campaign,
      'Landing Page':         attribution.landingPage,
      'Referrer':             attribution.referrer,
      'Attribution Content':  attribution.utm_content,
      'Attribution Term':     attribution.utm_term,
      '_fbclid':              attribution.fbclid,
      '_fbc':                 fbc,
      '_fbp':                 cookies._fbp,
    };
    return Object.entries(map).filter(([, v]) => v).map(([key, value]) => ({ key, value: String(value) }));
  }

  // Rewrites the cart's attributes with the latest values just before
  // checkout: a newer ad click, or pixel cookies set after the cart was made.
  // Never holds checkout up - gives up after 1.5 s or on any error.
  async function refreshCartAttributes(cartId) {
    const attributes = attributionCartAttributes();
    if (!cartId || !attributes.length) return;
    const update = gql(`
      mutation cartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
        cartAttributesUpdate(cartId: $cartId, attributes: $attributes) { userErrors { message } }
      }`, { cartId, attributes });
    await Promise.race([update, new Promise(r => setTimeout(r, 1500))]).catch(() => {});
  }

  // Signed in on the site? Put the customer on the cart so Shopify's checkout
  // opens as them and the order lands in their account. Without it every
  // checkout is a guest checkout: on Oct 23, 2026 a customer signed in with
  // Google, paid with a phone number, and the order went to a new phone-only
  // customer their account couldn't see. The site's Customer Account token
  // works here as is (checked live Oct 23). Returns the cart's checkout URL,
  // or null if not signed in or Shopify said no - checkout then goes ahead as
  // a guest, same as before. Gives up after 1.5 s.
  async function linkCartToCustomer(cartId) {
    if (!cartId || !window.LW_AUTH) return null;
    const link = (async () => {
      const token = await window.LW_AUTH.getValidToken();
      if (!token) return null;
      const data = await gql(`
        mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
          cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
            cart { checkoutUrl buyerIdentity { customer { id } } }
            userErrors { message }
          }
        }`, { cartId, buyerIdentity: { customerAccessToken: token } });
      const cart = data.cartBuyerIdentityUpdate?.cart;
      return cart?.buyerIdentity?.customer ? cart.checkoutUrl : null;
    })();
    return Promise.race([link, new Promise(r => setTimeout(() => r(null), 1500))]).catch(() => null);
  }

  // Checkout is a plain link to Shopify's checkout; link the signed-in
  // customer and refresh the attributes on the way there. Modified clicks
  // (new tab/window) are left alone.
  let goingToCheckout = false;
  // Back from checkout via the browser's back button restores this page from
  // cache with the flag still set - reset it so the button works again.
  window.addEventListener('pageshow', () => { goingToCheckout = false; });
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('#cart-checkout-btn');
    if (!link || !link.href || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (goingToCheckout) return;
    goingToCheckout = true;
    const cartId = loadCartId();
    let checkoutUrl = null;
    linkCartToCustomer(cartId)
      .then(url => { checkoutUrl = url; return refreshCartAttributes(cartId); })
      .finally(() => { window.location.href = checkoutUrl || link.href; });
  });

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
    if (json.errors) {
      // Tagged so callers can tell "Shopify rejected this" (e.g. a cart line
      // pointing at a deleted variant) apart from a dropped request on a
      // flaky mobile connection - only the former justifies repairing or
      // discarding the cart. See recoverCart().
      const err = new Error(json.errors[0].message);
      err.isGraphQLError = true;
      throw err;
    }
    return json.data;
  }

  const CART_FIELDS = `
    id checkoutUrl totalQuantity
    lines(first: 20) {
      edges { node {
        id quantity
        attributes { key value }
        cost { totalAmount { amount } }
        merchandise { ... on ProductVariant {
          id title requiresShipping
          price { amount currencyCode }
          product { title handle }
          image { url altText }
        }}
      }}
    }
    cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
    discountCodes { code applicable }
    discountAllocations { discountedAmount { amount } }
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
  // Only a GraphQL error means the cart is actually broken. A network error
  // (dropped request on mobile data) is rethrown before anything is removed,
  // otherwise one blip would delete a perfectly healthy line.
  async function recoverCart(cartId) {
    try {
      return await fetchCart(cartId);
    } catch (err) {
      if (!err.isGraphQLError) throw err;
    }
    let remaining;
    try {
      remaining = await fetchCartLineIds(cartId);
    } catch (err) {
      if (!err.isGraphQLError) throw err;
      return null; // cart itself is gone, not just a bad line - nothing to salvage
    }
    while (remaining.length) {
      const lineId = remaining.shift();
      await removeLine(cartId, lineId).catch(() => {});
      try {
        return await fetchCart(cartId);
      } catch (err) {
        if (!err.isGraphQLError) throw err;
        /* still broken - try removing the next candidate */
      }
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
    // whatever code was active - a no-op reapply of a stable code doesn't
    // fragment anything, only quantity increases do.
    await setDiscountCodes(cartId, []);
    const updated = await rawUpdateLines(cartId, updates);
    try {
      return await setDiscountCodes(cartId, priorCodes);
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

  // Cart subtotal (sum of each line's own price×quantity) - used by the free
  // shipping progress bar. Deliberately sums lines directly rather than
  // trusting cart.cost.subtotalAmount, since that field has been observed to
  // behave inconsistently once a discount code is applied to the cart.
  // Gift cards (no shipping) don't count towards free shipping.
  function cartSubtotal(cart) {
    return cart.lines.edges
      .map(e => e.node)
      .filter(l => l.merchandise.requiresShipping !== false)
      .reduce((s, l) => s + parseFloat(l.merchandise.price.amount) * l.quantity, 0);
  }

  // Mirrors nextOrderValue() / nextOrderProgress() in shop/cart-utils.js
  // (unit-tested there). Counted the way the dashboard counts the order:
  // products after discounts (line cost.totalAmount is after line discounts,
  // order-level ones are in cart.discountAllocations), gift cards out - so
  // an applied code can't make the cart claim a tier the order won't get.
  function nextOrderValue(cart) {
    const total = cart.lines.edges
      .map(e => e.node)
      .filter(l => l.merchandise.requiresShipping !== false)
      .reduce((s, l) => s + parseFloat(l.cost?.totalAmount?.amount
        ?? parseFloat(l.merchandise.price.amount) * l.quantity), 0);
    const orderOff = (cart.discountAllocations || [])
      .reduce((s, d) => s + parseFloat(d.discountedAmount?.amount || 0), 0);
    return Math.max(total - orderOff, 0);
  }

  const nextOrderOn = () => { const t = istToday(); return t >= NEXT_ORDER_FROM && t <= NEXT_ORDER_TO; };

  function nextOrderMessage(value) {
    if (value <= 0 || !nextOrderOn()) return null;
    const [low, high] = NEXT_ORDER_TIERS;
    const more = min => Math.ceil(min - value);
    if (value < low.min) return `Add ₹${more(low.min)} more to get ₹${low.off} off your next order`;
    if (value < high.min) return `₹${low.off} off your next order unlocked - add ₹${more(high.min)} more for ₹${high.off} off`;
    return `₹${high.off} off your next order unlocked 🪔 - we'll send the code after you order`;
  }

  // During the offer the free shipping bar becomes one bar with a mark at
  // free shipping and each tier, spaced evenly (like the Rakhi bar) rather
  // than by rupees, and filled stage by stage: full up to the last mark
  // reached, then part of the way to the next. Free shipping is met on its
  // own calculation (cartSubtotal), the tiers on nextOrderValue; the fill
  // follows nextOrderValue, never pre-discount prices. Mirrors
  // rewardsBarMarks() in shop/cart-utils.js. Null outside the offer dates.
  function rewardsBarMarks(subtotal, value) {
    if (!nextOrderOn()) return null;
    const ship = REWARD_TIERS[0].min;
    const mins = [ship, ...NEXT_ORDER_TIERS.map(t => t.min)];
    const at   = i => ((i + 1) / mins.length) * 100;
    const last = mins.reduce((reached, min, i) => (value >= min ? i : reached), -1);
    let pct = 100;
    if (last < mins.length - 1) {
      const from = last < 0 ? 0 : mins[last];
      const part = Math.min(Math.max((value - from) / (mins[last + 1] - from), 0), 1);
      const fromPct = last < 0 ? 0 : at(last);
      pct = fromPct + part * (at(last + 1) - fromPct);
    }
    return {
      pct,
      marks: [
        { pct: at(0), label: 'Free shipping', icon: REWARD_TIERS[0].icon, met: subtotal >= ship },
        ...NEXT_ORDER_TIERS.map((t, i) => ({ pct: at(i + 1), label: `₹${t.off} off`, icon: 'fa-gift', met: value >= t.min })),
      ],
    };
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

  // ── Delivery time and Diwali order-by date by pincode ──────────────────
  // Mirrors orderByForPincode() and arrivesInForPincode() in
  // shop/cart-utils.js (unit-tested there). Fills every [data-orderby] box
  // (product pages, cart drawer): the buyer types a pincode and sees how long
  // delivery usually takes there, plus, until Oct 29, their own order-by
  // date, worked out from their clock in IST, so a passed date flips without
  // a rebuild. The pincode is remembered on this device only (lw_pincode).
  const ORDER_BY_ENDS = '2026-10-30'; // from this IST day: delivery time only, no order-by / Diwali wording
  const ORDER_BY_ZONES = {
    maharashtra: { by: '2026-11-01', date: 'Sun, Nov 1' },
    metro:       { by: '2026-10-30', date: 'Fri, Oct 30' },
    india:       { by: '2026-10-26', date: 'Mon, Oct 26' },
  };
  const METRO_PREFIXES = new Set([110, 121, 122, 201, 560, 500, 600, 700]);
  const ARRIVES_IN = { maharashtra: '4-6', metro: '5-7', india: '6-9' };
  const PIN_KEY = 'lw_pincode';
  const GIFT_CARD_HANDLE = 'layerweaver-e-gift-card';
  const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  function pincodeZone(pin) {
    const p = String(pin ?? '').trim();
    if (!/^[1-9]\d{5}$/.test(p)) return null;
    const p3 = Number(p.slice(0, 3));
    if (p3 >= 400 && p3 <= 445 && p3 !== 403) return 'maharashtra';
    if (METRO_PREFIXES.has(p3)) return 'metro';
    return 'india';
  }

  function orderByForPincode(pin) {
    const zone = pincodeZone(pin);
    const today = istToday();
    if (!zone || today >= ORDER_BY_ENDS) return null;
    const z = ORDER_BY_ZONES[zone];
    return today <= z.by
      ? { zone, open: true, text: `Order by ${z.date} to get it before Diwali.` }
      : { zone, open: false, text: 'Orders to your pincode might arrive after Diwali.' };
  }

  function arrivesInForPincode(pin) {
    const zone = pincodeZone(pin);
    return zone ? `Usually arrives in ${ARRIVES_IN[zone]} days.` : null;
  }

  function savedPincode() {
    try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; }
  }

  function showOrderBy(box, pin) {
    const res = box.querySelector('.orderby-result');
    const eta = arrivesInForPincode(pin);
    const r = orderByForPincode(pin);
    if (!pin) { res.textContent = ''; res.className = 'orderby-result'; return; }
    if (!eta) { res.textContent = 'Enter a 6-digit pincode.'; res.className = 'orderby-result orderby-error'; return; }
    if (!r) { res.textContent = eta; res.className = 'orderby-result orderby-eta'; return; } // from ORDER_BY_ENDS on
    res.className = `orderby-result ${r.open ? 'orderby-open' : 'orderby-closed'}`;
    if (r.open) { res.textContent = `${r.text} ${eta}`; return; }
    // Past the date: offer the e-gift card (arrives instantly), and the chat
    // in case we can still make it.
    const wa = `https://wa.me/917558783018?text=${encodeURIComponent(`Hi! Can you deliver to ${pin} before Diwali?`)}`;
    res.innerHTML = `${esc(r.text)} ${esc(eta)} <a href="${SHOP_ROOT}products/${GIFT_CARD_HANDLE}/"><i class="fa-solid fa-gift"></i> Send an e-gift card - it arrives instantly</a> or <a href="${wa}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> check with us on WhatsApp</a>`;
  }

  function renderOrderBy() {
    const pin = savedPincode();
    const label = istToday() < ORDER_BY_ENDS
      ? '<i class="fa-solid fa-gift"></i> Want it before Diwali?'
      : '<i class="fa-solid fa-truck-fast"></i> When will it arrive?';
    document.querySelectorAll('[data-orderby]').forEach(box => {
      box.innerHTML = `
        <form class="orderby-form" novalidate>
          <label class="orderby-label">${label}</label>
          <div class="orderby-row">
            <input type="text" inputmode="numeric" autocomplete="postal-code" maxlength="6" placeholder="Your pincode" aria-label="Your pincode" value="${esc(pin)}">
            <button type="submit">Check</button>
          </div>
        </form>
        <p class="orderby-result" aria-live="polite"></p>`;
      box.hidden = false;
      showOrderBy(box, pin);
    });
  }

  document.addEventListener('submit', (e) => {
    const form = e.target.closest?.('.orderby-form');
    if (!form) return;
    e.preventDefault();
    const pin = form.querySelector('input').value.replace(/\D/g, '');
    if (pincodeZone(pin)) { try { localStorage.setItem(PIN_KEY, pin); } catch {} }
    // Every box on the page shows the same pincode (product page + cart).
    document.querySelectorAll('[data-orderby]').forEach(box => {
      const input = box.querySelector('input');
      if (input) input.value = pin;
      showOrderBy(box, pin);
    });
  });

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
      <!-- One scrolling panel under the header: items, order-by box, gift
           card link, progress, total, checkout, policy links. Opens scrolled
           to the bottom (see openDrawer), so progress and Checkout show first. -->
      <div class="cart-scroll" id="cart-scroll">
        <div class="cart-scroll-hint-wrap">
          <button type="button" class="cart-scroll-hint" id="cart-scroll-hint" hidden></button>
        </div>
        <div class="cart-body" id="cart-body"></div>
        <div class="cart-extras" id="cart-extras" style="display:none">
          <div class="orderby orderby-cart" data-orderby hidden></div>
          <a class="cart-giftcard-link" id="cart-giftcard-link" href="${SHOP_ROOT}products/${GIFT_CARD_HANDLE}/" hidden>
            <i class="fa-solid fa-gift"></i> Can't decide? Send an e-gift card instead
          </a>
        </div>
        <div class="cart-footer" id="cart-footer">
          <div id="cart-checkout-section" style="display:none">
            <div id="rewards-progress" class="rewards-progress" style="display:none">
              <div class="rewards-bar">
                <div class="rewards-bar-track">
                  <div class="rewards-bar-fill" id="rewards-bar-fill"></div>
                </div>
                <div class="rewards-bar-marks" id="rewards-bar-marks"></div>
              </div>
              <p class="rewards-bar-msg" id="rewards-bar-msg"></p>
              <p class="rewards-nextorder-msg" id="rewards-nextorder-msg" hidden></p>
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
        </div>
        <div class="cart-policy-links">
          <a href="${SITE_ROOT}shipping-policy/"><i class="fa-solid fa-truck-fast"></i> Shipping Policy</a>
          <a href="${SITE_ROOT}return-and-exchange-policy/"><i class="fa-solid fa-rotate-left"></i> Return and Exchange Policy</a>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    document.getElementById('cart-close').addEventListener('click', closeDrawer);
    const scrollEl = document.getElementById('cart-scroll');
    scrollEl.addEventListener('load', () => { if (_stickToBottom) scrollCartToBottom(); updateScrollHint(); }, true);
    scrollEl.addEventListener('scroll', updateScrollHint, { passive: true });
    document.getElementById('cart-scroll-hint').addEventListener('click', () => {
      _stickToBottom = false;
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    });
    ['wheel', 'touchstart', 'keydown'].forEach(type =>
      scrollEl.addEventListener(type, () => { _stickToBottom = false; }, { passive: true }));
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

  // Free shipping progress bar. Written generically over REWARD_TIERS (an
  // array of { min, label, icon }) rather than hardcoded to a single
  // threshold, so a future tier can be added without restructuring this -
  // but today there's exactly one tier (₹299 free shipping).
  function renderRewardsBar() {
    const progressEl = document.getElementById('rewards-progress');
    const fill        = document.getElementById('rewards-bar-fill');
    const msg          = document.getElementById('rewards-bar-msg');
    if (!progressEl || !fill || !msg || !cart) return;

    const subtotal = cartSubtotal(cart);

    // E-gift card nudge, unless one's already in the cart or this is its page.
    const giftLink = document.getElementById('cart-giftcard-link');
    if (giftLink) {
      giftLink.hidden = path.includes(`/products/${GIFT_CARD_HANDLE}/`)
        || cart.lines.edges.some(e => e.node.merchandise.product.handle === GIFT_CARD_HANDLE);
    }

    if (subtotal <= 0) { progressEl.style.display = 'none'; return; }
    progressEl.style.display = '';

    const nextTier = REWARD_TIERS.find(t => subtotal < t.min);
    const shipUnlocked = !nextTier;

    let text;
    if (shipUnlocked) {
      text = `🎉 Free shipping unlocked!`;
    } else {
      const remaining = (nextTier.min - subtotal).toFixed(0);
      text = `🚚 Add ₹${remaining} more for ${nextTier.label}`;
    }
    msg.textContent = text;

    const value    = nextOrderValue(cart);
    const bar      = rewardsBarMarks(subtotal, value);
    const nextText = nextOrderMessage(value);
    // One line under the bar: free shipping until the first tier is
    // unlocked, then only the next-order line (the marks show what's next).
    const showNext = !!nextText && value >= NEXT_ORDER_TIERS[0].min;
    msg.hidden = showNext;
    // Between free shipping and the first tier, the free shipping line
    // points at the ₹50 too. Mirrors freeShippingLine() in cart-utils.js.
    if (bar && shipUnlocked && !showNext) {
      const low = NEXT_ORDER_TIERS[0];
      msg.textContent = `🎉 Free shipping unlocked - add ₹${Math.ceil(low.min - value)} more for ₹${low.off} off your next order`;
    }
    const nextMsg  = document.getElementById('rewards-nextorder-msg');
    if (nextMsg) {
      nextMsg.hidden = !showNext;
      nextMsg.textContent = showNext ? nextText : '';
    }

    // Fill width: one continuous bar over every mark during the next-order
    // offer, otherwise progress toward free shipping.
    let pct, metCount, allUnlocked;
    if (bar) {
      pct = bar.pct;
      metCount = bar.marks.filter(m => m.met).length;
      allUnlocked = metCount === bar.marks.length;
    } else {
      pct = shipUnlocked ? 100 : Math.min(Math.max((subtotal / nextTier.min) * 100, 0), 100);
      metCount = REWARD_TIERS.filter(t => subtotal >= t.min).length;
      allUnlocked = shipUnlocked;
    }
    fill.style.width = pct + '%';
    const marksEl = document.getElementById('rewards-bar-marks');
    if (marksEl) {
      marksEl.innerHTML = (bar?.marks || []).map(m =>
        `<span class="rewards-bar-mark${m.met ? ' is-met' : ''}" style="left:${m.pct}%"><i class="fa-solid ${m.icon}" aria-hidden="true"></i>${esc(m.label)}</span>`).join('');
    }
    progressEl.classList.toggle('rewards-has-marks', !!bar);
    progressEl.classList.toggle('rewards-ship-unlocked', shipUnlocked);
    progressEl.classList.toggle('rewards-all-unlocked', allUnlocked);
    // The bubble names the next thing to chase.
    if (shipUnlocked && nextText) text = nextText;

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
      // Empty cart: the next-order offer (on its dates) and the e-gift card,
      // front and centre in Diwali colours.
      const offer = nextOrderOn() ? `
          <a class="cart-empty-card" href="${SHOP_ROOT}collections/diwali/">
            <span class="cart-empty-card-icon" aria-hidden="true">🪔</span>
            <span class="cart-empty-card-text">Spend ₹${NEXT_ORDER_TIERS[0].min}, get ₹${NEXT_ORDER_TIERS[0].off} off. Spend ₹${NEXT_ORDER_TIERS[1].min}, get ₹${NEXT_ORDER_TIERS[1].off} off - on your next order.</span>
            <span class="cart-empty-card-cta">Shop Diwali →</span>
          </a>` : '';
      body.innerHTML = `
        <div class="cart-empty">
          <i class="fa-solid fa-bag-shopping"></i>
          <p>Your cart is empty</p>
          <div class="cart-empty-cards">${offer}
            <a class="cart-empty-card" href="${SHOP_ROOT}products/${GIFT_CARD_HANDLE}/">
              <span class="cart-empty-card-icon" aria-hidden="true">🎁</span>
              <span class="cart-empty-card-text">Can't decide? Send an e-gift card - it arrives by email instantly.</span>
              <span class="cart-empty-card-cta">Gift cards →</span>
            </a>
          </div>
          <a href="${SHOP_ROOT}" class="btn-primary">Browse Shop</a>
        </div>`;
      const checkoutSection = document.getElementById('cart-checkout-section');
      if (checkoutSection) checkoutSection.style.display = 'none';
      const extras = document.getElementById('cart-extras');
      if (extras) extras.style.display = 'none';
      return;
    }

    // Shopify's cartLinesUpdate/cartDiscountCodesUpdate has a verified
    // server-side quirk where a line's quantity fragments into two lines
    // (same variant, same attributes, split quantity) once a discount code
    // is applied/reapplied to the cart - retrying doesn't self-heal it, so
    // rather than fight an unfixable API behavior, duplicate lines are
    // merged for *display* only: shown as one row summing their quantities,
    // with the mutation handlers (below) fanning qty/remove actions out
    // across every real line ID behind that row. Surcharge lines are
    // excluded - only ever added once at qty 1, they don't fragment.
    const dupGroups = new Map(); // "variantId::attrsKey" -> line[]
    for (const line of lines) {
      if (isSurchargeLine(line)) continue;
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

      const lineControls = `<div class="line-qty">
            <button class="qty-btn qty-dec" data-line-id="${line.id}"${pairedAttr}${extraAttr} data-qty="${displayQty}">−</button>
            <span>${displayQty}</span>
            <button class="qty-btn qty-inc" data-line-id="${line.id}"${pairedAttr}${extraAttr} data-qty="${displayQty}">+</button>
            <button class="remove-btn" data-line-id="${line.id}"${pairedAttr}${extraAttr} aria-label="Remove">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;

      return `
        <div class="cart-line" data-line-id="${line.id}">
          <a class="cart-line-link" href="${SHOP_ROOT}products/${v.product.handle}/">
            <div class="line-image">${img}</div>
            <div class="line-info">
              <p class="line-title">${esc(v.product.title)}</p>
              ${variantLabel}
              ${customAttrs}
              <p class="line-price">${price}</p>
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
    const checkoutSection = document.getElementById('cart-checkout-section');
    if (checkoutSection) checkoutSection.style.display = 'contents';
    const extras = document.getElementById('cart-extras');
    if (extras) extras.style.display = '';
    // Nothing to deliver (only gift cards): no pincode box.
    const cartOrderBy = document.querySelector('.orderby-cart');
    if (cartOrderBy && cartOrderBy.innerHTML) {
      cartOrderBy.hidden = !cart.lines.edges.some(e => e.node.merchandise.requiresShipping !== false);
    }
    renderRewardsBar();
  }

  // ── Drawer open / close ───────────────────────────────────────────────────

  // The cart opens scrolled to the bottom (progress, total, Checkout), and
  // stays there while images load, until the shopper scrolls themselves.
  let _stickToBottom = false;
  function scrollCartToBottom() {
    const el = document.getElementById('cart-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Since the cart opens at the bottom, a pill at the top says the items are
  // above ("↑ See your 3 items", tap to scroll up), and the header gets a
  // shadow whenever anything is scrolled out of view above it.
  function updateScrollHint() {
    const el   = document.getElementById('cart-scroll');
    const hint = document.getElementById('cart-scroll-hint');
    const firstLine = document.querySelector('#cart-body .cart-line');
    if (!el || !hint) return;
    document.getElementById('cart-drawer')?.classList.toggle('cart-scrolled', el.scrollTop > 4);
    const qty = cart ? cart.totalQuantity : 0;
    const linesHidden = !!firstLine && firstLine.offsetTop + firstLine.offsetHeight / 2 < el.scrollTop;
    hint.hidden = !linesHidden || qty <= 0;
    if (!hint.hidden) hint.textContent = `↑ See your ${qty} item${qty === 1 ? '' : 's'}`;
  }

  function openDrawer() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    _stickToBottom = true;
    scrollCartToBottom();
    requestAnimationFrame(() => { scrollCartToBottom(); updateScrollHint(); });
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

  function refreshUI() { updateBadge(); renderCart(); updateCartBtns(); updateScrollHint(); }

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
        // Network failure - leave the cart untouched so "try again" works.
        if (!err.isGraphQLError) throw err;
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
    refreshUI();

    // Only what this add changed: new lines, or the extra quantity on a line
    // already there (mirrors addedLines() in shop/cart-utils.js). Matching
    // every line of the added variant re-fired for a personalised item that
    // was already in the cart on its own line.
    const addedGids = new Set(lines.map(l => l.merchandiseId));
    const beforeQty = new Map((cartBefore?.lines?.edges || []).map(e => [e.node.id, e.node.quantity]));
    const added = (cart?.lines.edges || [])
      .map(e => e.node)
      .filter(node => addedGids.has(node.merchandise.id))
      .map(node => ({ node, quantity: node.quantity - (beforeQty.get(node.id) || 0) }))
      .filter(x => x.quantity > 0);
    for (const { node } of added) {
      if (typeof fbq === 'function') fbq('track', 'AddToCart', {
        content_name: node.merchandise.product.title,
        content_ids:  [node.merchandise.id.split('/').pop()],
        content_type: 'product',
        value:        parseFloat(node.merchandise.price.amount),
        currency:     node.merchandise.price.currencyCode,
      });
    }
    if (added.length && typeof gtag === 'function') gtag('event', 'add_to_cart', {
      currency: added[0].node.merchandise.price.currencyCode,
      value:    added.reduce((sum, a) => sum + parseFloat(a.node.merchandise.price.amount) * a.quantity, 0),
      items: added.map(a => ({
        item_id:   a.node.merchandise.id.split('/').pop(),
        item_name: a.node.merchandise.product.title,
        price:     parseFloat(a.node.merchandise.price.amount),
        quantity:  a.quantity,
      })),
    });
    return cart;
  }

  async function addToCartCore(variantGid, qty = 1, attributes = []) {
    return addLinesCore([{ merchandiseId: variantGid, quantity: qty, attributes }]);
  }

  // Mirrored in shop/cart-utils.js (tested there): the gift card page's
  // recipient fields as the line properties Shopify emails a card from.
  const GIFT_MESSAGE_MAX = 200;
  function giftCardRecipientAttributes({ email = '', name = '', message = '', sendOn = '' } = {}, now = Date.now(), offsetMinutes = -330) {
    email = String(email).trim(); name = String(name).trim(); message = String(message).trim(); sendOn = String(sendOn).trim();
    if (!email) {
      return name || message || sendOn
        ? { error: "Add their email, or clear these fields to get the card yourself.", field: 'email' }
        : { attributes: [] };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Check the email address.', field: 'email' };
    if (message.length > GIFT_MESSAGE_MAX) return { error: `Keep the message under ${GIFT_MESSAGE_MAX} characters.`, field: 'message' };
    if (sendOn) {
      const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const last = new Date(new Date(`${today}T00:00:00Z`).getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sendOn) || sendOn < today) return { error: 'Pick today or a later date.', field: 'sendOn' };
      if (sendOn > last) return { error: 'Pick a date in the next 90 days.', field: 'sendOn' };
    }
    const attributes = [
      { key: '__shopify_send_gift_card_to_recipient', value: 'on' },
      { key: 'Recipient email', value: email },
    ];
    if (name) attributes.push({ key: 'Recipient name', value: name });
    if (message) attributes.push({ key: 'Message', value: message });
    if (sendOn) attributes.push({ key: 'Send on', value: sendOn });
    attributes.push({ key: '__shopify_offset', value: String(offsetMinutes) });
    return { attributes };
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
    if (btn?.dataset.giftCard) {
      const field = id => document.getElementById(id);
      const errEl = field('gc-error');
      const r = giftCardRecipientAttributes({
        email: field('gc-email')?.value, name: field('gc-name')?.value,
        message: field('gc-message')?.value, sendOn: field('gc-send-on')?.value,
      }, Date.now(), new Date().getTimezoneOffset());
      if (r.error) {
        if (errEl) { errEl.textContent = r.error; errEl.hidden = false; }
        const input = field({ email: 'gc-email', message: 'gc-message', sendOn: 'gc-send-on' }[r.field]);
        input?.focus();
        input?.classList.add('field-error');
        input?.addEventListener('input', () => input.classList.remove('field-error'), { once: true });
        return;
      }
      if (errEl) errEl.hidden = true;
      attributes.push(...r.attributes);
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
        refreshUI();
        return;
      }
    }
    cart = await updateLine(cart.id, lineId, newQty, cart);
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
  // extra fragment lines, set the primary line to targetQty, then reapply
  // whatever code was active.
  // A customer clicking +/- on an already-merged display row never sees
  // more than one line again after this runs.
  async function handleConsolidateAndUpdate(primaryLineId, extraLineIds, targetQty) {
    const priorCodes = (cart.discountCodes || []).filter(c => c.applicable).map(c => c.code);
    if (priorCodes.length) cart = await setDiscountCodes(cart.id, []);
    cart = await removeLines(cart.id, extraLineIds);
    cart = await rawUpdateLines(cart.id, [{ id: primaryLineId, quantity: targetQty }]);
    if (priorCodes.length) {
      try {
        cart = await setDiscountCodes(cart.id, priorCodes);
      } catch (err) {
        console.warn('[Cart] Failed to restore discount codes after consolidate:', err);
      }
    }
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
    renderOrderBy();
    injectRewardsBubble();

    // Restore cart from previous session
    const cartId = loadCartId();
    if (cartId) {
      try {
        cart = await fetchCart(cartId);
        if (!cart) { localStorage.removeItem(KEY); cart = null; } // cart explicitly gone on Shopify
        else { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); }
      } catch (err) {
        // Could be a real network error, or a line in this cart referencing
        // a variant Shopify can no longer resolve (see recoverCart). Try to
        // salvage it so the badge/drawer reflect what's actually still
        // there instead of quietly looking empty until the next add.
        console.warn('[Cart] Restoring saved cart failed, attempting recovery:', err);
        cart = await recoverCart(cartId).catch(() => null);
        if (cart) { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); }
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
        else { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); }
      } catch {
        cart = await recoverCart(cartId).catch(() => null);
        if (cart) { await cleanupLegacyGiftLine(); await cleanupOrphanSurchargeLines(); }
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

// Collection nav group menus (desktop). Mouse users get hover via CSS; this
// handles click/tap and keyboard, and closes on outside click or Escape.
(function () {
  function initNavGroups() {
    const groups = [...document.querySelectorAll('.collection-nav-group')];
    if (!groups.length) return;

    const setOpen = (group, open) => {
      group.classList.toggle('open', open);
      group.querySelector('.collection-nav-group-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    const closeAll = except => groups.forEach(g => { if (g !== except) setOpen(g, false); });

    for (const group of groups) {
      const btn = group.querySelector('.collection-nav-group-btn');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll(group);
        setOpen(group, !group.classList.contains('open'));
      });
      group.addEventListener('mouseleave', () => setOpen(group, false));
      group.addEventListener('focusout', (e) => {
        if (!group.contains(e.relatedTarget)) setOpen(group, false);
      });
      group.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && group.classList.contains('open')) {
          setOpen(group, false);
          btn.focus();
        }
      });
    }

    document.addEventListener('click', () => closeAll());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavGroups);
  } else {
    initNavGroups();
  }
})();
