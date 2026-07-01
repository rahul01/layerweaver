import { describe, it, expect } from 'vitest';
import { fmt, esc, cartQtyMap } from '../shop/cart-utils.js';

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
