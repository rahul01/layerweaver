import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { DELIVERY_FEE, FREE_FROM, COPY, deliveryCost, promiseLines, cartTotals } = createRequire(import.meta.url)('../shop/promise-row.js');

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
