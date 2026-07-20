import { describe, it, expect } from 'vitest';
import { fmt, esc, cartQtyMap, shippingProgress, attributionCartAttributes } from '../shop/cart-utils.js';

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
