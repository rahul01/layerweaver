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

// Mirrors shop/cart.js's orderByForPincode(). Diwali order-by date for a
// pincode (Diwali 2026 plan, section 7). Zones by the first three digits:
// Maharashtra 400-445 except 403 (Goa); metro cities Delhi 110, Faridabad
// 121, Gurugram 122, Noida/Ghaziabad 201, Bengaluru 560, Hyderabad 500,
// Chennai 600, Kolkata 700; everything else is the rest of India. A zone
// stays open through its date (IST). Returns null for a pincode that isn't
// 6 digits, or from Diwali day on.
export const ORDER_BY = {
  diwali: '2026-11-08',
  zones: {
    maharashtra: { by: '2026-11-01', date: 'Sun, Nov 1' },
    metro:       { by: '2026-10-30', date: 'Fri, Oct 30' },
    india:       { by: '2026-10-26', date: 'Mon, Oct 26' },
  },
};
const METRO_PREFIXES = new Set([110, 121, 122, 201, 560, 500, 600, 700]);
export function pincodeZone(pin) {
  const p = String(pin ?? '').trim();
  if (!/^[1-9]\d{5}$/.test(p)) return null;
  const p3 = Number(p.slice(0, 3));
  if (p3 >= 400 && p3 <= 445 && p3 !== 403) return 'maharashtra';
  if (METRO_PREFIXES.has(p3)) return 'metro';
  return 'india';
}
export function orderByForPincode(pin, now = Date.now(), cfg = ORDER_BY) {
  const zone = pincodeZone(pin);
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (!zone || today >= cfg.diwali) return null;
  const z = cfg.zones[zone];
  return today <= z.by
    ? { zone, open: true, text: `Order by ${z.date} to get it before Diwali.` }
    : { zone, open: false, text: 'Orders to your pincode might arrive after Diwali. Check with us on WhatsApp.' };
}

// Mirrors script.js's passUtmToWhatsApp(). A WhatsApp chat carries nothing
// but its text, so the visitor's original utm_* tags (lw_attribution) go on
// our site link inside the typed message: added to a layerweaver.com link
// already in it, or the current page's link added when there isn't one.
// The dashboard's webhook reads them back from the chat. No tags stored, or
// a message that already has them: the link is left alone.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
export function withUtmTags(href, attr, pageUrl) {
  const tags = UTM_KEYS.filter(k => attr?.[k]).map(k => [k, attr[k]]);
  if (!tags.length) return href;
  let url;
  try { url = new URL(href); } catch { return href; }
  if (!/(^|\.)wa\.me$/.test(url.hostname) && url.hostname !== 'api.whatsapp.com') return href;
  const text = url.searchParams.get('text') ?? '';
  if (/utm_[a-z]+=/i.test(text)) return href;
  const tag = link => {
    const u = new URL(link);
    for (const [k, v] of tags) u.searchParams.set(k, v);
    return u.toString();
  };
  const ours = /https?:\/\/(?:www\.)?layerweaver\.com\/[^\s]*/i;
  const next = ours.test(text)
    ? text.replace(ours, m => tag(m))
    : `${text.trim() || 'Hi!'}\n${tag(pageUrl)}`;
  url.searchParams.set('text', next);
  return url.toString();
}
