export function fmt(amount, code) {
  const n = parseFloat(amount);
  return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
}

export function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function cartQtyMap(edges) {
  if (!edges || !edges.length) return {};
  const map = {};
  edges.forEach(e => { map[e.node.merchandise.id] = e.node.quantity; });
  return map;
}

// Mirrors shop/cart.js's attributionCartAttributes(). Takes the parsed
// lw_attribution object directly (cart.js does its own localStorage read/parse)
// and the Meta pixel's cookies ({ _fbc, _fbp }, read from document.cookie).
// Keys starting with "_" are hidden from the customer by Shopify but still
// land on the order (Diwali spec item 0: which ad, and a Meta click ID so
// orders Meta can't see itself can be matched to the click later).
export function attributionCartAttributes(attribution, cookies = {}) {
  if (!attribution) return [];
  const map = {
    'Attribution Source':   attribution.source,
    'Attribution Medium':   attribution.utm_medium,
    'Attribution Campaign': attribution.utm_campaign,
    'Landing Page':         attribution.landingPage,
    'Referrer':             attribution.referrer,
    'Attribution Content':  attribution.utm_content,
    'Attribution Term':     attribution.utm_term,
    '_fbclid':              attribution.fbclid,
    '_fbc':                 cookies._fbc || fbcFromClick(attribution),
    '_fbp':                 cookies._fbp,
  };
  return Object.entries(map).filter(([, v]) => v).map(([key, value]) => ({ key, value: String(value) }));
}

// Meta's click ID cookie format, fb.1.<ms timestamp>.<fbclid> - used when the
// pixel hasn't set _fbc (yet) but the visit came with an fbclid.
export function fbcFromClick(attribution) {
  if (!attribution?.fbclid) return null;
  return `fb.1.${attribution.capturedAt || Date.now()}.${attribution.fbclid}`;
}

// { _fbc, _fbp } from a document.cookie string.
export function metaCookies(cookieString) {
  const out = {};
  for (const part of String(cookieString || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k === '_fbc' || k === '_fbp') out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Mirrors script.js's captureAttribution(): what lw_attribution should be
// after this page view, or null to keep what's stored.
// - An ad click (any utm_* or an fbclid) always wins - the latest click is
//   the one that brought them back (was: first visit kept for 30 days).
// - Otherwise an external referrer only counts if nothing is stored or the
//   stored visit is over 30 days old; on-site navigation never overwrites.
export const ATTRIBUTION_TTL_DAYS = 30;
export function nextAttribution(existing, { search = '', referrer = '', hostname = '', pathname = '/', now = Date.now() } = {}) {
  const params = new URLSearchParams(search);
  const utm = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  const fbclid = params.get('fbclid') || '';
  const isClick = Object.keys(utm).length > 0 || !!fbclid;

  let refHost = '';
  try { refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : ''; } catch {}
  const isOwnDomain = !!refHost && refHost === hostname.replace(/^www\./, '');
  const fresh = existing && (now - existing.capturedAt) < ATTRIBUTION_TTL_DAYS * 86400000;

  if (!isClick) {
    if (fresh) return null;
    if ((!referrer || isOwnDomain) && existing) return null;
  }
  return {
    source: utm.utm_source || (fbclid ? 'facebook' : (isOwnDomain ? '' : (refHost || 'direct'))),
    ...utm,
    ...(fbclid ? { fbclid } : {}),
    referrer: (!isOwnDomain && referrer) ? referrer : '',
    landingPage: pathname,
    capturedAt: now,
  };
}

// Mirrors shop/cart.js's AddToCart tracking: only what an add actually
// changed - new lines, or the extra quantity on a line that was already
// there. (Was: every line of an added variant, so re-adding a product
// already in the cart on its own line - e.g. personalised - fired twice.)
// before/after: cart.lines.edges arrays; addedGids: variant IDs just added.
export function addedLines(beforeEdges, afterEdges, addedGids) {
  const before = new Map((beforeEdges || []).map(e => [e.node.id, e.node.quantity]));
  const ids = new Set(addedGids);
  return (afterEdges || [])
    .map(e => e.node)
    .filter(node => ids.has(node.merchandise.id))
    .map(node => ({ node, quantity: node.quantity - (before.get(node.id) || 0) }))
    .filter(x => x.quantity > 0);
}

// Mirrors the shipping-bar math in shop/cart.js's renderShippingBar().
export function shippingProgress(total, min) {
  const isUnlocked = total >= min;
  const pct = Math.min((total / min) * 100, 100);
  const message = isUnlocked
    ? '🎉 Free shipping unlocked!'
    : `🚚 Add ₹${(min - total).toFixed(0)} more for free shipping`;
  return { isUnlocked, pct, message };
}
