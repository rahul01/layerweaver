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
  it('product page: delivery cost, then the damage line', () => {
    expect(promiseLines({ context: 'product' }).map(l => l.text)).toEqual([
      'Delivery ₹49, free above ₹299.',
      'Damaged or wrong item? Replacement or full refund within 7 days, with photos.',
    ]);
  });
  it('personalised: damage line stays, change-of-mind returns are excluded', () => {
    const [, second] = promiseLines({ context: 'product', personalised: true });
    expect(second.text).toBe("Damaged or wrong item? Replacement or full refund within 7 days, with photos. Personalised items can't be returned if you change your mind.");
  });
  it('cart: only the returns note (the delivery cost is its own line)', () => {
    expect(promiseLines({ context: 'cart' }).map(l => l.text)).toEqual(['Damaged or wrong item? Replacement or full refund within 7 days.']);
    expect(promiseLines({ context: 'cart', personalised: true })[0].text).toContain("Personalised items can't be returned if you change your mind.");
  });
  it('gift card: nothing', () => {
    expect(promiseLines({ context: 'product', giftCard: true })).toEqual([]);
    expect(promiseLines({ context: 'cart', giftCard: true })).toEqual([]);
  });
  it('never makes a material or safety claim and has no em dash', () => {
    const all = JSON.stringify(COPY);
    expect(all).not.toMatch(/non-?toxic|\beco|PLA\b|plastic|child-?safe|—/i);
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
