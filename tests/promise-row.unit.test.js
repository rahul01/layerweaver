import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { DELIVERY_FEE, FREE_FROM, COPY, deliveryCost, promiseLines, iconRow, productDetails, cartTotals } = createRequire(import.meta.url)('../shop/promise-row.js');

describe('deliveryCost', () => {
  it('is Rs 49 below Rs 299 and free from Rs 299', () => {
    expect([DELIVERY_FEE, FREE_FROM]).toEqual([49, 299]);
    expect(deliveryCost(0)).toBe(49);
    expect(deliveryCost(298)).toBe(49);
    expect(deliveryCost(298.99)).toBe(49);
    expect(deliveryCost(299)).toBe(0);
    expect(deliveryCost(300)).toBe(0);
  });
});

describe('promiseLines', () => {
  const texts = o => promiseLines(o).map(l => l.text);
  it('product under Rs 299: delivery fee line, then easy returns', () => {
    expect(texts({ context: 'product', price: 249 })).toEqual([
      'Delivery ₹49, free on orders above ₹299.',
      "7-day easy returns. Damaged in transit? We'll make it right.",
    ]);
    expect(texts({ context: 'product', price: 298.99 })[0]).toBe('Delivery ₹49, free on orders above ₹299.');
  });
  it('product at or over Rs 299: free delivery', () => {
    expect(texts({ context: 'product', price: 299 })[0]).toBe('Free delivery.');
    expect(texts({ context: 'product', price: 1200 })[0]).toBe('Free delivery.');
  });
  it('variants spanning 299: the caller passes the lowest price, so the fee line shows', () => {
    const lowest = Math.min(249, 349);
    expect(texts({ context: 'product', price: lowest })[0]).toBe('Delivery ₹49, free on orders above ₹299.');
    expect(texts({ context: 'product', price: Math.min(299, 349) })[0]).toBe('Free delivery.');
  });
  it('every returns line links to the policy page', () => {
    for (const o of [{ context: 'product', price: 100 }, { context: 'cart' }, { context: 'product', personalised: true }]) {
      expect(promiseLines(o).at(-1).link.path).toBe('return-and-exchange-policy/');
    }
  });
  it('personalised: made just for you, no easy-returns line', () => {
    const full = o => promiseLines(o).map(l => `${l.text}${l.link ? ' ' + l.link.text : ''}`);
    expect(full({ context: 'product', personalised: true, price: 149 })).toEqual(['Delivery ₹49, free on orders above ₹299.', 'Made just for you. See our return policy.']);
    expect(full({ context: 'cart', personalised: true })).toEqual(['Made just for you. See our return policy.']);
    expect(JSON.stringify(promiseLines({ context: 'product', personalised: true }))).not.toMatch(/easy returns/i);
  });
  it('cart: only the returns note (the delivery cost is its own line)', () => {
    expect(texts({ context: 'cart' })).toEqual(['7-day easy returns.']);
  });
  it('the strict rules are not in the row (they live on the policy page)', () => {
    const all = JSON.stringify(COPY);
    expect(all).not.toMatch(/full refund|with photos|change your mind/i);
  });
  it('gift card: nothing', () => {
    expect(promiseLines({ context: 'product', giftCard: true })).toEqual([]);
    expect(promiseLines({ context: 'cart', giftCard: true })).toEqual([]);
  });
  it('never makes a material or safety claim and has no em dash', () => {
    expect(JSON.stringify(COPY)).not.toMatch(/non-?toxic|\beco|PLA\b|plastic|child-?safe|—/i);
  });
});

describe('cartTotals', () => {
  it('under Rs 299: adds Rs 49 and says so', () => {
    expect(cartTotals({ shippableTotal: 249, itemsTotal: 249, needsShipping: true })).toEqual({ delivery: 49, total: 298, label: 'Total with delivery' });
    expect(cartTotals({ shippableTotal: 298, itemsTotal: 298, needsShipping: true }).total).toBe(347);
  });
  it('from Rs 299: free', () => {
    expect(cartTotals({ shippableTotal: 299, itemsTotal: 299, needsShipping: true })).toEqual({ delivery: 0, total: 299, label: 'Total with delivery' });
    expect(cartTotals({ shippableTotal: 498, itemsTotal: 498, needsShipping: true }).total).toBe(498);
  });
  it('gift card plus a product: gift card value does not count towards free delivery (checked against Shopify)', () => {
    expect(cartTotals({ shippableTotal: 249, itemsTotal: 749, needsShipping: true })).toEqual({ delivery: 49, total: 798, label: 'Total with delivery' });
  });
  it('gift cards only: plain total', () => {
    expect(cartTotals({ shippableTotal: 0, itemsTotal: 500, needsShipping: false })).toEqual({ delivery: null, total: 500, label: 'Total' });
  });
  it('a discount on the cart: plain total, no delivery guess', () => {
    expect(cartTotals({ shippableTotal: 400, itemsTotal: 350, needsShipping: true, hasDiscount: true })).toEqual({ delivery: null, total: 350, label: 'Total' });
  });
});

describe('iconRow', () => {
  const labels = o => iconRow(o).map(i => i.label);
  it('four items: delivery, returns, printed to order, FAQ', () => {
    expect(labels({ price: 249 })).toEqual(['Delivery ₹49', '7-day easy returns', 'Printed to order in Pune', 'Questions? FAQ']);
  });
  it('free delivery from Rs 299 (the lowest variant price), fee line under it', () => {
    expect(iconRow({ price: 299 })[0].label).toBe('Free delivery');
    expect(iconRow({ price: 298.99 })[0].label).toBe('Delivery ₹49');
    expect(iconRow({ price: 298.99 })[0].title).toBe('Delivery ₹49, free on orders above ₹299.');
  });
  it('personalised: Made just for you instead of easy returns', () => {
    expect(iconRow({ price: 149, personalised: true })[1].label).toBe('Made just for you');
    expect(JSON.stringify(iconRow({ price: 149, personalised: true }))).not.toMatch(/easy returns/i);
  });
  it('icons: truck, arrows, location pin, question mark', () => {
    expect(iconRow({ price: 100 }).map(i => i.icon)).toEqual(['fa-truck-fast', 'fa-rotate-left', 'fa-location-dot', 'fa-circle-question']);
  });
  it('links: shipping policy, return policy, FAQ; the Printed in Pune item has none', () => {
    expect(iconRow({ price: 100 }).map(i => i.path)).toEqual(['shipping-policy/', 'return-and-exchange-policy/', undefined, 'faq/']);
  });
  it('gift card: nothing', () => {
    expect(iconRow({ giftCard: true })).toEqual([]);
  });
  it('no banned wording or em dash in any label or tooltip', () => {
    expect(JSON.stringify([iconRow({ price: 100 }), iconRow({ price: 500, personalised: true })])).not.toMatch(/non-?toxic|\beco|PLA\b|plastic|child-?safe|biodegradable|sustainable|renewable|—/i);
  });
});

describe('productDetails', () => {
  it('material and made always; colours only when there is a choice; size only when known', () => {
    expect(productDetails()).toEqual([
      { label: 'Material', value: 'Plant-based filament, 3D printed' },
      { label: 'Made', value: 'Printed to order in Pune' },
    ]);
    expect(productDetails({ colours: ['Purple'] }).map(r => r.label)).toEqual(['Material', 'Made']);
    expect(productDetails({ colours: ['Purple', 'Pink'], size: '25 cm' }).slice(2)).toEqual([
      { label: 'Colours', value: 'Purple, Pink' }, { label: 'Size', value: '25 cm' },
    ]);
  });
  it('no age row, no N/A, no banned wording', () => {
    const all = JSON.stringify(productDetails({ colours: ['A', 'B'], size: '1 cm' }));
    expect(all).not.toMatch(/age|N\/A|non-?toxic|\beco|PLA\b|plastic|child-?safe|biodegradable|sustainable|renewable/i);
  });
});
