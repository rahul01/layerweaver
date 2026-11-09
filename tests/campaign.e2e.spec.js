import { test, expect } from '@playwright/test';

// Diwali 2026 campaign: the gift card tab and the cart's
// next-order progress (the announcement bar is now the ship-date notice, see
// holiday-notice.e2e.spec.js). The clock is faked to IST dates and the
// cart is stubbed, so these don't depend on today's date or on Shopify.

const GIFT_CARD = 'layerweaver-e-gift-card';

async function onDay(page, day) {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00+05:30`));
}

function line(price, { qty = 1, total = price * qty, handle = 'snail-lamp' } = {}) {
  return { node: {
    id: `gid://shopify/CartLine/${handle}-${price}`, quantity: qty, attributes: [],
    cost: { totalAmount: { amount: String(total) } },
    merchandise: {
      id: `gid://shopify/ProductVariant/${handle}-${price}`, title: 'Default Title',
      requiresShipping: handle !== GIFT_CARD,
      price: { amount: String(price), currencyCode: 'INR' },
      product: { title: handle, handle }, image: null,
    },
  } };
}

function cartOf(lines, orderOff = 0) {
  return {
    id: 'gid://shopify/Cart/test', checkoutUrl: 'https://example.com/checkout', totalQuantity: lines.length,
    lines: { edges: lines },
    cost: { totalAmount: { amount: '0', currencyCode: 'INR' }, subtotalAmount: { amount: '0', currencyCode: 'INR' } },
    discountCodes: orderOff ? [{ code: 'TEST', applicable: true }] : [],
    discountAllocations: orderOff ? [{ discountedAmount: { amount: String(orderOff) } }] : [],
  };
}

async function openCart(page, day, lines, { orderOff = 0, path = '/shop/' } = {}) {
  await onDay(page, day);
  await page.route(/shop\.layerweaver\.com\/api/, route =>
    route.fulfill({ json: { data: { cart: cartOf(lines, orderOff) } } }));
  await page.addInitScript(() => localStorage.setItem('lw_cart_id', 'gid://shopify/Cart/test'));
  await page.goto(path);
  await page.waitForFunction(() => document.getElementById('cart-icon-btn'));
  await page.click('#cart-icon-btn');
  await page.waitForSelector('#cart-drawer.open');
  await expect(page.locator('#rewards-progress')).toBeVisible();
}

// ── Logo ribbon and gift card tab ───────────────────────────────────────────

test.describe('Logo ribbon and gift card tab', () => {
  for (const path of ['/', '/shop/', '/shop/products/snail-lamp/']) {
    test(`${path} - no seasonal ribbon (removed Nov 9 2026)`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('.logo-diwali-ribbon')).toHaveCount(0);
    });
  }

  test('e-gift card is first in the Gifts menu on desktop', async ({ page }) => {
    await page.goto('/shop/');
    await page.locator('.collection-nav-group-btn', { hasText: 'Gifts' }).click();
    const first = page.locator('.collection-nav-group:has(.collection-nav-group-btn:has-text("Gifts")) .collection-nav-menu-item').first();
    await expect(first).toBeVisible();
    await expect(first).toHaveText('🎁E-gift card');
    // The gift card isn't a collection: the Gifts group isn't marked active.
    await expect(page.locator('.collection-nav-group-btn.active')).toHaveCount(0);
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/shop/products/${GIFT_CARD}/$`));
  });

  test('phones list it under Gifts in the dropdown, with no extra chip', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/shop/');
    await expect(page.locator('.collection-nav-mobile .collection-nav-icon-chip')).toHaveCount(2);
    await page.click('.collection-filter-btn');
    await expect(page.locator('.collection-dropdown-item--giftcard')).toBeVisible();
  });
});


// ── Cart layout ─────────────────────────────────────────────────────────────

test.describe('Cart layout with the campaign pieces', () => {
  test('one scrolling panel, opened at the bottom, not covered by the bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => localStorage.setItem('lw_pincode', '411001'));
    await openCart(page, '2026-10-25', [line(250), line(200, { handle: 'cat-bookmark' }), line(150, { handle: 'orca' })]);
    // One scrolling panel under the header holds everything, opened at the
    // bottom so progress and Checkout show first.
    const scroll = page.locator('#cart-scroll');
    for (const part of ['#cart-body', '.orderby-cart', '#rewards-progress', '#cart-checkout-btn', '.cart-policy-links']) {
      await expect(scroll.locator(part)).toHaveCount(1);
    }
    await expect.poll(() => scroll.evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThanOrEqual(1);
    await expect(page.locator('#cart-checkout-btn')).toBeInViewport();
    await expect(page.locator('#rewards-progress')).toBeInViewport();
    // The drawer's back link is the topmost element where it sits.
    const back = await page.locator('#cart-drawer .drawer-back-link').boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.drawer-back-link') !== null,
      [back.x + 5, back.y + back.height / 2]);
    expect(hit).toBe(true);
  });
});

test.describe('Cart scroll hint', () => {
  test('says the items are above, and scrolls up to them', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => localStorage.setItem('lw_pincode', '411001'));
    await openCart(page, '2026-10-25', [line(250), line(200, { handle: 'cat-bookmark' }), line(150, { handle: 'orca' })]);
    const hint = page.locator('#cart-scroll-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText('↑ See your 3 items');
    await hint.click();
    await expect.poll(() => page.locator('#cart-scroll').evaluate(e => e.scrollTop)).toBe(0);
    await expect(hint).toBeHidden();
  });

  test('stays hidden when everything fits', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await openCart(page, '2026-10-25', [line(450)]);
    await expect(page.locator('#cart-scroll-hint')).toBeHidden();
  });
});

// ── Empty cart offer cards ──────────────────────────────────────────────────

test.describe('Empty cart offer cards', () => {
  async function openEmptyCart(page, day) {
    await onDay(page, day);
    await page.goto('/shop/');
    await page.waitForFunction(() => document.getElementById('cart-icon-btn'));
    await page.click('#cart-icon-btn');
    await expect(page.locator('.cart-empty')).toBeVisible();
  }

  test('shows the gift card', async ({ page }) => {
    await openEmptyCart(page, '2026-11-12');
    await expect(page.locator('.cart-empty-card')).toHaveCount(1);
    await expect(page.locator('.cart-empty-card')).toContainText('e-gift card');
  });
});
