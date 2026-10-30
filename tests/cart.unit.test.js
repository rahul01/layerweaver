import { describe, it, expect } from 'vitest';
import { fmt, esc, cartQtyMap, shippingProgress, attributionCartAttributes, metaCookies, nextAttribution, addedLines, pincodeZone, orderByForPincode, arrivesInForPincode, withUtmTags, giftCardRecipientAttributes, nextOrderValue, nextOrderProgress, rewardsBarMarks, freeShippingLine } from '../shop/cart-utils.js';

function makeLine(variantId, price, qty, handle = 'product', title = 'Product', attrs = []) {
  return {
    node: {
      id: `gid://shopify/CartLine/${Math.random().toString(36).slice(2)}`,
      quantity: qty,
      attributes: attrs,
      merchandise: {
        id: variantId,
        title: title,
        price: { amount: String(price), currencyCode: 'INR' },
        product: { title, handle },
        image: null,
      },
    },
  };
}

// ── fmt ─────────────────────────────────────────────────────────────────────

describe('fmt', () => {
  it('formats INR without decimals', () => {
    expect(fmt('299.00', 'INR')).toBe('₹299');
  });

  it('rounds INR to nearest integer', () => {
    expect(fmt('99.50', 'INR')).toBe('₹100');
  });

  it('formats other currencies with 2 decimals', () => {
    expect(fmt('29.99', 'USD')).toBe('USD 29.99');
  });

  it('handles string amounts', () => {
    expect(fmt('0', 'INR')).toBe('₹0');
  });
});

// ── esc ─────────────────────────────────────────────────────────────────────

describe('esc', () => {
  it('returns normal strings unchanged', () => {
    expect(esc('Cat Cable Clip')).toBe('Cat Cable Clip');
  });

  it('escapes HTML special characters', () => {
    expect(esc('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(esc('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('escapes single quotes', () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc('')).toBe('');
  });
});

// ── cartQtyMap ──────────────────────────────────────────────────────────────

describe('cartQtyMap', () => {
  it('returns empty object for null/empty edges', () => {
    expect(cartQtyMap(null)).toEqual({});
    expect(cartQtyMap([])).toEqual({});
  });

  it('maps variant GID to quantity', () => {
    const edges = [
      makeLine('v1', 199, 2),
      makeLine('v2', 149, 1),
    ];
    expect(cartQtyMap(edges)).toEqual({ v1: 2, v2: 1 });
  });
});

// ── attributionCartAttributes ────────────────────────────────────────────────

describe('attributionCartAttributes', () => {
  it('returns an empty array when there is no captured attribution', () => {
    expect(attributionCartAttributes(null)).toEqual([]);
    expect(attributionCartAttributes(undefined)).toEqual([]);
  });

  it('maps a full attribution object to key/value cart attributes', () => {
    const result = attributionCartAttributes({
      source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'summer-sale',
      referrer: 'https://google.com/search',
      landingPage: '/shop/products/cat-cable-clip/',
    });
    expect(result).toEqual([
      { key: 'Attribution Source', value: 'google' },
      { key: 'Attribution Medium', value: 'cpc' },
      { key: 'Attribution Campaign', value: 'summer-sale' },
      { key: 'Landing Page', value: '/shop/products/cat-cable-clip/' },
      { key: 'Referrer', value: 'https://google.com/search' },
    ]);
  });

  it('omits keys for fields that were not captured', () => {
    // Direct/on-site traffic: no UTM params, no external referrer.
    const result = attributionCartAttributes({
      source: 'direct',
      referrer: '',
      landingPage: '/',
    });
    expect(result).toEqual([
      { key: 'Attribution Source', value: 'direct' },
      { key: 'Landing Page', value: '/' },
    ]);
  });

  it('drops a field entirely when its value is an empty string', () => {
    const result = attributionCartAttributes({
      source: '',
      utm_medium: 'email',
      landingPage: '/',
    });
    expect(result.find(a => a.key === 'Attribution Source')).toBeUndefined();
    expect(result).toContainEqual({ key: 'Attribution Medium', value: 'email' });
  });
});

// ── shippingProgress ──────────────────────────────────────────────────────────
// Covers the ₹299 free-shipping threshold math restored by the 6-month
// campaign revert (shop/cart.js renderShippingBar).

describe('shippingProgress', () => {
  it('reports locked with partial progress below the threshold', () => {
    const result = shippingProgress(150, 299);
    expect(result.isUnlocked).toBe(false);
    expect(result.pct).toBeCloseTo((150 / 299) * 100);
    expect(result.message).toBe('🚚 Add ₹149 more for free shipping');
  });

  it('rounds the remaining amount in the pending message', () => {
    // 299 - 100.40 = 198.6, should round to 199
    const result = shippingProgress(100.4, 299);
    expect(result.message).toBe('🚚 Add ₹199 more for free shipping');
  });

  it('unlocks exactly at the threshold', () => {
    const result = shippingProgress(299, 299);
    expect(result.isUnlocked).toBe(true);
    expect(result.pct).toBe(100);
    expect(result.message).toBe('🎉 Free shipping unlocked!');
  });

  it('caps progress at 100% above the threshold', () => {
    const result = shippingProgress(999, 299);
    expect(result.isUnlocked).toBe(true);
    expect(result.pct).toBe(100);
  });

  it('handles a zero total as fully locked', () => {
    const result = shippingProgress(0, 299);
    expect(result.isUnlocked).toBe(false);
    expect(result.pct).toBe(0);
    expect(result.message).toBe('🚚 Add ₹299 more for free shipping');
  });
});

// ── Diwali spec item 0: which ad, Meta click IDs, last click wins ─────────────

describe('attributionCartAttributes - ad and Meta click fields', () => {
  it('adds utm_content / utm_term, and the hidden fbclid, _fbc and _fbp', () => {
    const result = attributionCartAttributes(
      { source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'LW Diwali Prospecting', utm_content: 'ghost-lamp-reel', utm_term: 'lamps', fbclid: 'IwAR123', landingPage: '/shop/', capturedAt: 1790000000000 },
      { _fbc: 'fb.1.1790000000000.IwAR123', _fbp: 'fb.1.1789999999999.55555' },
    );
    expect(result.slice(4)).toEqual([ // after Source, Medium, Campaign, Landing Page (no referrer here)
      { key: 'Attribution Content', value: 'ghost-lamp-reel' },
      { key: 'Attribution Term', value: 'lamps' },
      { key: '_fbclid', value: 'IwAR123' },
      { key: '_fbc', value: 'fb.1.1790000000000.IwAR123' },
      { key: '_fbp', value: 'fb.1.1789999999999.55555' },
    ]);
  });

  it('builds _fbc from the stored fbclid when the pixel has not set the cookie', () => {
    const result = attributionCartAttributes({ source: 'facebook', fbclid: 'IwAR9', capturedAt: 1790000000000 }, {});
    expect(result.find(a => a.key === '_fbc')).toEqual({ key: '_fbc', value: 'fb.1.1790000000000.IwAR9' });
  });
});

describe('metaCookies', () => {
  it('reads only _fbc and _fbp from document.cookie', () => {
    expect(metaCookies('lw=1; _fbp=fb.1.123.456; _ga=GA1; _fbc=fb.1.789.IwAR%3D%3D')).toEqual({ _fbp: 'fb.1.123.456', _fbc: 'fb.1.789.IwAR==' });
    expect(metaCookies('')).toEqual({});
  });
});

describe('nextAttribution', () => {
  const day = 86400000, now = 1790000000000;
  const site = { hostname: 'www.layerweaver.com', pathname: '/shop/ghost-balloon-lamp/', now };
  const stored = { source: 'facebook', utm_campaign: 'old-ad', capturedAt: now - 3 * day };

  it('a new ad click replaces a recent one - the latest click wins', () => {
    const next = nextAttribution(stored, { ...site, search: '?utm_source=facebook&utm_medium=paid_social&utm_campaign=new-ad&utm_content=reel-2&fbclid=IwAR7' });
    expect(next).toMatchObject({ source: 'facebook', utm_campaign: 'new-ad', utm_content: 'reel-2', fbclid: 'IwAR7', capturedAt: now });
  });

  it('an fbclid alone counts as a Meta click', () => {
    expect(nextAttribution(stored, { ...site, search: '?fbclid=IwAR8' })).toMatchObject({ source: 'facebook', fbclid: 'IwAR8' });
  });

  it('a visit without a click keeps a recent ad click', () => {
    expect(nextAttribution(stored, { ...site, referrer: 'https://www.google.com/' })).toBeNull();
    expect(nextAttribution(stored, { ...site, referrer: 'https://www.layerweaver.com/' })).toBeNull();
  });

  it('after 30 days an external referrer takes over; on-site browsing never does', () => {
    const old = { ...stored, capturedAt: now - 31 * day };
    expect(nextAttribution(old, { ...site, referrer: 'https://www.google.com/' })).toMatchObject({ source: 'google.com' });
    expect(nextAttribution(old, { ...site, referrer: 'https://www.layerweaver.com/shop/' })).toBeNull();
  });

  it('a first visit with nothing is direct', () => {
    expect(nextAttribution(null, site)).toMatchObject({ source: 'direct', landingPage: '/shop/ghost-balloon-lamp/' });
  });
});

describe('addedLines (AddToCart fires once per real add)', () => {
  const line = (id, variant, quantity) => ({ node: { id, quantity, merchandise: { id: variant } } });

  it('a personalised item added again on its own line: only the new line counts', () => {
    const before = [line('L1', 'V1', 1)];
    const after = [line('L1', 'V1', 1), line('L2', 'V1', 1)];
    expect(addedLines(before, after, ['V1']).map(x => [x.node.id, x.quantity])).toEqual([['L2', 1]]);
  });

  it('adding more of a line already in the cart counts only the extra quantity', () => {
    expect(addedLines([line('L1', 'V1', 2)], [line('L1', 'V1', 3)], ['V1']).map(x => x.quantity)).toEqual([1]);
  });

  it('a first add into an empty cart counts the whole line; other products are ignored', () => {
    expect(addedLines([], [line('L1', 'V1', 2), line('L9', 'V9', 1)], ['V1']).map(x => [x.node.id, x.quantity])).toEqual([['L1', 2]]);
  });
});

describe('pincodeZone', () => {
  it('maps pincodes to zones by their first three digits', () => {
    expect(pincodeZone('411001')).toBe('maharashtra'); // Pune
    expect(pincodeZone('400001')).toBe('maharashtra'); // Mumbai
    expect(pincodeZone('440001')).toBe('maharashtra'); // Nagpur
    expect(pincodeZone('403001')).toBe('india');       // Goa, not Maharashtra
    for (const p of ['110001', '121001', '122001', '201301', '560001', '500001', '600001', '700001']) expect(pincodeZone(p)).toBe('metro');
    expect(pincodeZone('380001')).toBe('india');       // Ahmedabad
    expect(pincodeZone('781001')).toBe('india');       // Guwahati
  });
  it('rejects anything that is not a 6-digit pincode', () => {
    for (const p of ['', '41100', '4110011', '011001', 'abcdef', null]) expect(pincodeZone(p)).toBeNull();
    expect(pincodeZone(' 411001 ')).toBe('maharashtra');
  });
});

describe('orderByForPincode', () => {
  const at = s => new Date(s).getTime();
  it('gives each zone its own date', () => {
    const now = at('2026-10-15T12:00:00+05:30');
    expect(orderByForPincode('411001', now).text).toBe('Order by Sun, Nov 1 to get it before Diwali.');
    expect(orderByForPincode('560001', now).text).toBe('Order by Fri, Oct 30 to get it before Diwali.');
    expect(orderByForPincode('781001', now).text).toBe('Order by Mon, Oct 26 to get it before Diwali.');
  });
  it('stays open through the date in IST, then says after Diwali', () => {
    expect(orderByForPincode('781001', at('2026-10-26T23:59:00+05:30')).open).toBe(true);
    expect(orderByForPincode('781001', at('2026-10-27T00:01:00+05:30'))).toEqual({ zone: 'india', open: false, text: 'Orders to your pincode might arrive after Diwali. Check with us on WhatsApp.' });
    expect(orderByForPincode('411001', at('2026-10-27T00:01:00+05:30')).open).toBe(true);
  });
  it('null for a bad pincode', () => {
    expect(orderByForPincode('123', at('2026-10-15T12:00:00+05:30'))).toBeNull();
  });
  it('switches to the year-round wording (null) from Oct 30 00:00 IST, every zone', () => {
    for (const pin of ['411001', '560001', '781001']) {
      expect(orderByForPincode(pin, at('2026-10-29T23:59:00+05:30'))).not.toBeNull();
      expect(orderByForPincode(pin, at('2026-10-30T00:00:00+05:30'))).toBeNull();
      expect(orderByForPincode(pin, at('2026-11-01T12:00:00+05:30'))).toBeNull();
      expect(orderByForPincode(pin, at('2026-11-08T00:00:00+05:30'))).toBeNull();
    }
    // Last minute before the switch: Maharashtra and metros open, the rest past their date.
    expect(orderByForPincode('411001', at('2026-10-29T23:59:00+05:30')).open).toBe(true);
    expect(orderByForPincode('560001', at('2026-10-29T23:59:00+05:30')).open).toBe(true);
    expect(orderByForPincode('781001', at('2026-10-29T23:59:00+05:30')).open).toBe(false);
  });
  it('the switch follows IST, not UTC (Oct 29 18:30 UTC is already Oct 30 in IST)', () => {
    expect(orderByForPincode('411001', at('2026-10-29T18:30:00Z'))).toBeNull();
    expect(orderByForPincode('411001', at('2026-10-29T18:29:00Z')).open).toBe(true);
  });
});

describe('arrivesInForPincode', () => {
  it('gives the measured order-to-door range for the pincode\'s zone', () => {
    expect(arrivesInForPincode('411045')).toBe('Usually arrives in 4-6 days.'); // Pune
    expect(arrivesInForPincode('560102')).toBe('Usually arrives in 5-7 days.'); // Bengaluru
    expect(arrivesInForPincode('781001')).toBe('Usually arrives in 6-9 days.'); // Guwahati
    expect(arrivesInForPincode('403001')).toBe('Usually arrives in 6-9 days.'); // Goa is not Maharashtra
  });
  it('nothing for a pincode that isn\'t 6 digits', () => {
    expect(arrivesInForPincode('4110')).toBeNull();
    expect(arrivesInForPincode('')).toBeNull();
  });
});

describe('withUtmTags', () => {
  const ad = { source: 'facebook', utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'LW Diwali Prospecting', utm_content: 'P-sardine', fbclid: 'x' };
  const page = 'https://www.layerweaver.com/shop/products/sardine-fishbone-jewelry-organizer/';
  const text = h => new URL(h).searchParams.get('text');
  it('adds the original tags to our link already in the message', () => {
    const t = text(withUtmTags(`https://wa.me/917558783018?text=${encodeURIComponent(`Hi! I'm interested in Sardine\n${page}`)}`, ad, page));
    expect(t).toBe(`Hi! I'm interested in Sardine\n${page}?utm_source=facebook&utm_medium=paid_social&utm_campaign=LW+Diwali+Prospecting&utm_content=P-sardine`);
    expect(t).not.toMatch(/fbclid/);
  });
  it('adds the current page link when the message has none', () => {
    expect(text(withUtmTags('https://wa.me/917558783018', { utm_source: 'creator', utm_content: 'shivna' }, 'https://www.layerweaver.com/')))
      .toBe('Hi!\nhttps://www.layerweaver.com/?utm_source=creator&utm_content=shivna');
  });
  it('leaves the link alone with no stored tags, tags already there, or not WhatsApp', () => {
    const h = 'https://wa.me/917558783018?text=Hi';
    expect(withUtmTags(h, null, page)).toBe(h);
    expect(withUtmTags(h, { source: 'direct' }, page)).toBe(h);
    const tagged = `https://wa.me/917558783018?text=${encodeURIComponent(`${page}?utm_source=facebook`)}`;
    expect(withUtmTags(tagged, ad, page)).toBe(tagged);
    expect(withUtmTags(page, ad, page)).toBe(page);
  });
});

describe('giftCardRecipientAttributes', () => {
  const now = new Date('2026-10-20T15:00:00+05:30').getTime();
  it('no email: the card goes to the buyer, no properties', () => {
    expect(giftCardRecipientAttributes({}, now)).toEqual({ attributes: [] });
    expect(giftCardRecipientAttributes({ email: '  ' }, now)).toEqual({ attributes: [] });
  });
  it('asks for the email when other fields are filled', () => {
    expect(giftCardRecipientAttributes({ message: 'Happy Diwali' }, now)).toMatchObject({ field: 'email' });
    expect(giftCardRecipientAttributes({ sendOn: '2026-11-08' }, now)).toMatchObject({ field: 'email' });
  });
  it("sends Shopify's recipient properties, trimmed, with the time zone offset", () => {
    expect(giftCardRecipientAttributes({ email: ' a@b.in ', name: ' Asha ', message: ' Happy Diwali! ', sendOn: '2026-11-08' }, now, -330)).toEqual({ attributes: [
      { key: '__shopify_send_gift_card_to_recipient', value: 'on' },
      { key: 'Recipient email', value: 'a@b.in' },
      { key: 'Recipient name', value: 'Asha' },
      { key: 'Message', value: 'Happy Diwali!' },
      { key: 'Send on', value: '2026-11-08' },
      { key: '__shopify_offset', value: '-330' },
    ] });
  });
  it('leaves out empty optional fields (send now)', () => {
    expect(giftCardRecipientAttributes({ email: 'a@b.in' }, now).attributes.map(a => a.key))
      .toEqual(['__shopify_send_gift_card_to_recipient', 'Recipient email', '__shopify_offset']);
  });
  it('checks the email, message length and date', () => {
    expect(giftCardRecipientAttributes({ email: 'asha@' }, now)).toMatchObject({ field: 'email' });
    expect(giftCardRecipientAttributes({ email: 'a@b.in', message: 'x'.repeat(201) }, now)).toMatchObject({ field: 'message' });
    expect(giftCardRecipientAttributes({ email: 'a@b.in', message: 'x'.repeat(200) }, now).attributes).toBeTruthy();
    expect(giftCardRecipientAttributes({ email: 'a@b.in', sendOn: '2026-10-19' }, now)).toMatchObject({ field: 'sendOn' });
    expect(giftCardRecipientAttributes({ email: 'a@b.in', sendOn: '2026-10-20' }, now).attributes).toBeTruthy(); // today (IST) is fine
    expect(giftCardRecipientAttributes({ email: 'a@b.in', sendOn: '2027-01-18' }, now).attributes).toBeTruthy(); // day 90
    expect(giftCardRecipientAttributes({ email: 'a@b.in', sendOn: '2027-01-19' }, now)).toMatchObject({ field: 'sendOn' });
  });
});

// ── next-order codes ─────────────────────────────────────────────────────────
// Orders Oct 21 - Nov 1, 2026: ₹599+ gets ₹50 off the next order, ₹949+ ₹100
// (the dashboard's numbers, routes/lib/next-order-codes.js).
// Value counted like the dashboard: after discounts, gift cards out.

function costLine(price, qty, total = price * qty, requiresShipping = true) {
  const l = makeLine(`gid://shopify/ProductVariant/${price}`, price, qty);
  l.node.merchandise.requiresShipping = requiresShipping;
  l.node.cost = { totalAmount: { amount: String(total) } };
  return l;
}

describe('nextOrderValue', () => {
  it('sums line totals after line discounts', () => {
    expect(nextOrderValue({ lines: { edges: [costLine(399, 2, 700), costLine(200, 1)] } })).toBe(900);
  });

  it('subtracts order-level discounts', () => {
    const cart = { lines: { edges: [costLine(649, 1)] }, discountAllocations: [{ discountedAmount: { amount: '65.00' } }] };
    expect(nextOrderValue(cart)).toBe(584);
  });

  it('leaves gift cards out', () => {
    expect(nextOrderValue({ lines: { edges: [costLine(299, 1), costLine(1000, 1, 1000, false)] } })).toBe(299);
  });

  it('falls back to price x quantity when a line has no cost', () => {
    const l = makeLine('v', 350, 2);
    expect(nextOrderValue({ lines: { edges: [l] } })).toBe(700);
  });
});

describe('nextOrderProgress', () => {
  const day = '2026-10-25';

  it('asks for the rest to ₹599 below the first tier', () => {
    expect(nextOrderProgress(598, day)).toEqual({ unlocked: 0, message: 'Add ₹1 more to get ₹50 off your next order' });
  });

  it('unlocks ₹50 from ₹599 to ₹948', () => {
    expect(nextOrderProgress(599, day).message).toBe('₹50 off your next order unlocked - add ₹350 more for ₹100 off');
    expect(nextOrderProgress(948, day)).toEqual({ unlocked: 50, message: '₹50 off your next order unlocked - add ₹1 more for ₹100 off' });
  });

  it('unlocks ₹100 from ₹949 (two ₹499 items make ₹998)', () => {
    expect(nextOrderProgress(949, day)).toEqual({ unlocked: 100, message: "₹100 off your next order unlocked 🪔 - we'll send the code after you order" });
    expect(nextOrderProgress(998, day).unlocked).toBe(100);
  });

  it('rounds a fractional shortfall up so the amount is enough', () => {
    expect(nextOrderProgress(598.5, day).message).toBe('Add ₹1 more to get ₹50 off your next order');
  });

  it('shows only Oct 21 - Nov 1 (IST dates) and not for an empty cart', () => {
    expect(nextOrderProgress(700, '2026-10-20')).toBeNull();
    expect(nextOrderProgress(700, '2026-10-21')).not.toBeNull();
    expect(nextOrderProgress(700, '2026-11-01')).not.toBeNull();
    expect(nextOrderProgress(700, '2026-11-02')).toBeNull();
    expect(nextOrderProgress(0, day)).toBeNull();
  });
});

describe('rewardsBarMarks', () => {
  const day = '2026-10-25';

  it('spaces the ₹299, ₹599 and ₹949 marks evenly, like the Rakhi bar', () => {
    const bar = rewardsBarMarks(450, 450, day);
    expect(bar.marks.map(m => m.label)).toEqual(['Free shipping', '₹50 off', '₹100 off']);
    expect(bar.marks.map(m => Math.round(m.pct))).toEqual([33, 67, 100]);
    expect(bar.marks.map(m => m.met)).toEqual([true, false, false]);
  });

  it('fills stage by stage: part of the way from one mark to the next', () => {
    expect(rewardsBarMarks(150, 150, day).pct).toBeCloseTo((150 / 299) * (100 / 3));
    expect(rewardsBarMarks(450, 450, day).pct).toBeCloseTo(100 / 3 + ((450 - 299) / 300) * (100 / 3));
    expect(rewardsBarMarks(799, 799, day).pct).toBeCloseTo(200 / 3 + ((799 - 599) / 350) * (100 / 3));
  });

  it('sits exactly on a mark when its amount is reached', () => {
    expect(rewardsBarMarks(299, 299, day).pct).toBeCloseTo(100 / 3);
    expect(rewardsBarMarks(599, 599, day).pct).toBeCloseTo(200 / 3);
  });

  it('meets free shipping on the subtotal and the tiers on the discounted value', () => {
    const bar = rewardsBarMarks(650, 585, day);
    expect(bar.marks.map(m => m.met)).toEqual([true, false, false]);
    expect(bar.pct).toBeCloseTo(100 / 3 + ((585 - 299) / 300) * (100 / 3));
  });

  it('fills completely from ₹949', () => {
    const bar = rewardsBarMarks(949, 949, day);
    expect(bar.pct).toBe(100);
    expect(bar.marks.every(m => m.met)).toBe(true);
  });

  it('is null outside Oct 21 - Nov 1', () => {
    expect(rewardsBarMarks(500, 500, '2026-10-20')).toBeNull();
    expect(rewardsBarMarks(500, 500, '2026-11-02')).toBeNull();
  });
});

describe('freeShippingLine', () => {
  const day = '2026-10-25';

  it('points at the ₹50 once free shipping is unlocked', () => {
    expect(freeShippingLine(450, 450, day)).toBe('🎉 Free shipping unlocked - add ₹149 more for ₹50 off your next order');
  });

  it('counts the ₹50 on the discounted value', () => {
    expect(freeShippingLine(650, 585, day)).toBe('🎉 Free shipping unlocked - add ₹14 more for ₹50 off your next order');
  });

  it('is null below free shipping, from ₹599, and outside the offer dates', () => {
    expect(freeShippingLine(200, 200, day)).toBeNull();
    expect(freeShippingLine(599, 599, day)).toBeNull();
    expect(freeShippingLine(450, 450, '2026-11-02')).toBeNull();
  });
});
