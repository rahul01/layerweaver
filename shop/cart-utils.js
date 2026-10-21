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

// Mirrors shop/cart.js's giftCardRecipientAttributes(). The gift card page's
// optional "send it to someone" fields, as the cart line properties Shopify
// reads to email a gift card to a recipient (the same ones its own themes'
// recipient form sends): no email = the card goes to the buyer, as before.
// sendOn is yyyy-mm-dd, today (IST) up to 90 days ahead; empty = send now.
// offsetMinutes is the buyer's Date#getTimezoneOffset() (-330 in India).
// Returns { attributes } or { error, field } for the field to fix.
export const GIFT_MESSAGE_MAX = 200;
export function giftCardRecipientAttributes({ email = '', name = '', message = '', sendOn = '' } = {}, now = Date.now(), offsetMinutes = -330) {
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

// Mirrors shop/cart.js's nextOrderValue() / nextOrderProgress(). Next-order
// codes (orders Oct 21 - Nov 1, 2026 IST): ₹599+ gets ₹50 off the next order,
// ₹949+ gets ₹100 off, sent by the dashboard after the order. The cart must
// count the value the way the dashboard does - products after discounts,
// before shipping, gift cards left out - so it never says "unlocked" for an
// order that won't get a code. Line cost.totalAmount is after line-level
// discounts; order-level discounts sit in cart.discountAllocations.
export const NEXT_ORDER = {
  from: '2026-10-21',
  to:   '2026-11-01',
  tiers: [{ min: 599, off: 50 }, { min: 949, off: 100 }],
};
export function nextOrderValue(cart) {
  const lines = (cart?.lines?.edges || []).map(e => e.node)
    .filter(l => l.merchandise.requiresShipping !== false);
  const total = lines.reduce((s, l) => s + parseFloat(l.cost?.totalAmount?.amount
    ?? parseFloat(l.merchandise.price.amount) * l.quantity), 0);
  const orderOff = (cart?.discountAllocations || [])
    .reduce((s, d) => s + parseFloat(d.discountedAmount?.amount || 0), 0);
  return Math.max(total - orderOff, 0);
}
// Message for a cart of `value` on IST day `today` (yyyy-mm-dd), or null
// outside the offer dates or for an empty cart.
export function nextOrderProgress(value, today, cfg = NEXT_ORDER) {
  if (value <= 0 || today < cfg.from || today > cfg.to) return null;
  const [low, high] = cfg.tiers;
  const more = min => Math.ceil(min - value);
  if (value < low.min) return { unlocked: 0, message: `Add ₹${more(low.min)} more to get ₹${low.off} off your next order` };
  if (value < high.min) return { unlocked: low.off, message: `₹${low.off} off your next order unlocked - add ₹${more(high.min)} more for ₹${high.off} off` };
  return { unlocked: high.off, message: `₹${high.off} off your next order unlocked 🪔 - we'll send the code after you order` };
}

// Mirrors shop/cart.js's rewardsBarMarks(). During the offer the cart's free
// shipping bar becomes one bar with a mark at free shipping (met on the
// pre-discount subtotal, like the free shipping line) and at each tier (met
// on nextOrderValue, which also drives the fill). Marks are spaced evenly,
// like the Rakhi bar; the fill is full up to the last mark reached, then part
// of the way to the next.
export function rewardsBarMarks(subtotal, value, today, shipMin = 299, cfg = NEXT_ORDER) {
  if (today < cfg.from || today > cfg.to) return null;
  const mins = [shipMin, ...cfg.tiers.map(t => t.min)];
  const at = i => ((i + 1) / mins.length) * 100;
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
      { pct: at(0), label: 'Free shipping', icon: 'fa-truck-fast', met: subtotal >= shipMin },
      ...cfg.tiers.map((t, i) => ({ pct: at(i + 1), label: `₹${t.off} off`, icon: 'fa-gift', met: value >= t.min })),
    ],
  };
}

// Mirrors the free shipping line in shop/cart.js's renderRewardsBar() during
// the offer: once free shipping is unlocked but the first tier isn't, it also
// says how far the ₹50 is. Null when the next-order line shows instead (or
// outside the offer dates, when the plain free shipping line shows).
export function freeShippingLine(subtotal, value, today, shipMin = 299, cfg = NEXT_ORDER) {
  if (today < cfg.from || today > cfg.to || subtotal < shipMin || value >= cfg.tiers[0].min) return null;
  const low = cfg.tiers[0];
  return `🎉 Free shipping unlocked - add ₹${Math.ceil(low.min - value)} more for ₹${low.off} off your next order`;
}
