import { describe, it, expect } from 'vitest';
import { fmt, esc, getQualifyingTotal, getGiftLine, cartQtyMap } from '../shop/cart-utils.js';

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

function makeGiftLine() {
  return makeLine(
    'gid://shopify/ProductVariant/48173905576158',
    99, 1, 'cat-cable-clip', 'Cat Cable Clip',
    [{ key: '_gift', value: 'FREEGIFT299' }]
  );
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

// ── getQualifyingTotal ──────────────────────────────────────────────────────

describe('getQualifyingTotal', () => {
  it('returns 0 for empty/null edges', () => {
    expect(getQualifyingTotal(null)).toBe(0);
    expect(getQualifyingTotal([])).toBe(0);
  });

  it('sums a single regular item', () => {
    const edges = [makeLine('v1', 199, 1)];
    expect(getQualifyingTotal(edges)).toBe(199);
  });

  it('sums multiple items', () => {
    const edges = [
      makeLine('v1', 199, 1),
      makeLine('v2', 149, 1),
    ];
    expect(getQualifyingTotal(edges)).toBe(348);
  });

  it('multiplies by quantity', () => {
    const edges = [makeLine('v1', 100, 3)];
    expect(getQualifyingTotal(edges)).toBe(300);
  });

  it('excludes _gift-tagged line', () => {
    const edges = [
      makeLine('v1', 199, 1),
      makeGiftLine(),
    ];
    expect(getQualifyingTotal(edges)).toBe(199);
  });

  it('includes user-added Cat Cable Clip without _gift tag', () => {
    const edges = [
      makeLine('v1', 199, 1),
      makeLine('gid://shopify/ProductVariant/48173905576158', 99, 1, 'cat-cable-clip', 'Cat Cable Clip'),
    ];
    expect(getQualifyingTotal(edges)).toBe(298);
  });

  it('includes user clip + excludes gift clip', () => {
    const edges = [
      makeLine('v1', 199, 1),
      makeLine('gid://shopify/ProductVariant/48173905576158', 99, 1, 'cat-cable-clip', 'Cat Cable Clip'),
      makeGiftLine(),
    ];
    expect(getQualifyingTotal(edges)).toBe(298);
  });
});

// ── getGiftLine ─────────────────────────────────────────────────────────────

describe('getGiftLine', () => {
  it('returns null when no gift in cart', () => {
    const edges = [makeLine('v1', 199, 1)];
    expect(getGiftLine(edges)).toBeNull();
  });

  it('returns null for empty/null edges', () => {
    expect(getGiftLine(null)).toBeNull();
    expect(getGiftLine([])).toBeNull();
  });

  it('finds the gift line', () => {
    const gift = makeGiftLine();
    const edges = [makeLine('v1', 199, 1), gift];
    expect(getGiftLine(edges)).toBe(gift.node);
  });

  it('does not match user-added Cat Cable Clip without _gift tag', () => {
    const edges = [
      makeLine('gid://shopify/ProductVariant/48173905576158', 99, 1, 'cat-cable-clip', 'Cat Cable Clip'),
    ];
    expect(getGiftLine(edges)).toBeNull();
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
