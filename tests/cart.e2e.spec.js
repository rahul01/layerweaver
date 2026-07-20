import { test, expect } from '@playwright/test';

const SHOP = '/shop/';
const PRODUCT_OCTOPUS = '/shop/products/articulated-octopus/';   // 249
const PRODUCT_KEYCHAIN = '/shop/products/personalized-number-plate-keychain/'; // 149, personalized
const PRODUCT_CLIP = '/shop/products/cat-cable-clip/';           // 99
const PRODUCT_BUTTERFLY = '/shop/products/butterfly-bookmark/';  // multi-variant

async function clearCart(page) {
  await page.evaluate(() => {
    localStorage.removeItem('lw_cart_id');
    localStorage.removeItem('lw_cart_qty');
    sessionStorage.removeItem('lw_shipping_unlocked');
  });
}

async function waitForCartReady(page) {
  await page.waitForFunction(() => document.getElementById('cart-icon-btn'), { timeout: 10_000 });
}

async function openDrawer(page) {
  await page.click('#cart-icon-btn');
  await page.waitForSelector('#cart-drawer.open', { timeout: 5_000 });
}

async function getDrawerLines(page) {
  return page.$$eval('.cart-line', lines =>
    lines.map(l => ({
      title: l.querySelector('.line-title')?.textContent?.trim(),
      price: l.querySelector('.line-price')?.textContent?.trim(),
      qty: l.querySelector('.line-qty span')?.textContent?.trim(),
    }))
  );
}

async function getBadgeCount(page) {
  const badge = page.locator('#cart-badge');
  const display = await badge.evaluate(el => getComputedStyle(el).display);
  if (display === 'none') return 0;
  return parseInt(await badge.textContent() || '0');
}

// ── Cart basics ─────────────────────────────────────────────────────────────

test.describe('Cart basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('empty cart - badge hidden and drawer shows empty state', async ({ page }) => {
    expect(await getBadgeCount(page)).toBe(0);
    await openDrawer(page);
    await expect(page.locator('.cart-empty')).toBeVisible();
    await expect(page.locator('.cart-empty')).toContainText('Your cart is empty');
    await expect(page.locator('.cart-empty a')).toContainText('Browse Shop');
  });

  test('add to cart from product page', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && getComputedStyle(badge).display !== 'none';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(1);

    await openDrawer(page);
    const lines = await getDrawerLines(page);
    const octopus = lines.find(l => l.title === 'Articulated Octopus');
    expect(octopus).toBeTruthy();
    expect(octopus.price).toContain('249');
  });

  test('update quantity - increment', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    await page.click('.qty-inc');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '2';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(2);
  });

  test('update quantity - decrement', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    await page.click('.qty-inc');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '2';
    }, { timeout: 10_000 });

    await page.click('.qty-dec');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });

    const qty = await page.$eval('.cart-line .line-qty span', el => el.textContent.trim());
    expect(qty).toBe('1');
  });

  test('remove item - goes to empty state', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    await page.click('.remove-btn');
    await expect(page.locator('.cart-empty')).toBeVisible({ timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(0);
  });

  test('decrement from qty 1 via qty-dec button removes the line', async ({ page }) => {
    // Distinct code path from the explicit remove-btn: handleUpdateLine's
    // newQty <= 0 branch delegates to handleRemoveLine.
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    await page.click('.qty-dec');
    await expect(page.locator('.cart-empty')).toBeVisible({ timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(0);
  });
});

// ── Add to cart from listing page ───────────────────────────────────────────

test.describe('Listing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('add to cart from listing card', async ({ page }) => {
    const addBtn = page.locator('.listing-add-to-cart').first();
    await addBtn.click();
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && getComputedStyle(badge).display !== 'none';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBeGreaterThanOrEqual(1);
    await expect(addBtn).toContainText('In Cart');
  });
});

// ── Personalized products ───────────────────────────────────────────────────

test.describe('Personalized products', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_KEYCHAIN);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('add without custom text - shows error', async ({ page }) => {
    const input = page.locator('#custom-text');
    await page.click('#add-to-cart-btn');

    // Item should NOT be added
    await page.waitForTimeout(1_000);
    expect(await getBadgeCount(page)).toBe(0);
    await expect(input).toBeFocused();
  });

  test('add with custom text - succeeds', async ({ page }) => {
    await page.fill('#custom-text', 'MH12AB1234');
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && getComputedStyle(badge).display !== 'none';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBeGreaterThanOrEqual(1);

    await openDrawer(page);
    const lines = await getDrawerLines(page);
    expect(lines.some(l => l.title?.includes('Personalized'))).toBeTruthy();
  });
});

// ── Shipping progress bar ────────────────────────────────────────────────────

test.describe('Shipping progress bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('shows amount needed below threshold', async ({ page }) => {
    // Octopus is 249, below the 299 free-shipping threshold
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);
    const msg = await page.textContent('#shipping-bar-msg');
    expect(msg).toContain('Add');
    expect(msg).toContain('more');
  });

  test('shows unlocked message at/above threshold', async ({ page }) => {
    // 2x octopus = 498, above the 299 threshold
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    await page.click('.qty-inc');
    await page.waitForFunction(() => {
      const msg = document.getElementById('shipping-bar-msg');
      return msg && msg.textContent.includes('unlocked');
    }, { timeout: 15_000 });
    const msg = await page.textContent('#shipping-bar-msg');
    expect(msg).toContain('unlocked');
  });

  // Regression coverage for the campaign revert: confetti now means "you've
  // crossed the ₹299 free-shipping threshold," not "you added your first item."
  test('confetti fires on crossing the threshold, not on the first item added', async ({ page }) => {
    const countConfetti = () => page.evaluate(() =>
      document.querySelectorAll('body > div[style*="z-index: 9999"]').length);

    // 1x octopus (249) is below threshold - first item added, no confetti.
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);
    await page.waitForTimeout(500);
    expect(await countConfetti()).toBe(0);

    // 2x octopus (498) crosses the threshold - confetti should fire now.
    await page.click('.qty-inc');
    await page.waitForFunction(() => {
      const msg = document.getElementById('shipping-bar-msg');
      return msg && msg.textContent.includes('unlocked');
    }, { timeout: 15_000 });
    await page.waitForFunction(() => document.querySelectorAll(
      'body > div[style*="z-index: 9999"]').length > 0, { timeout: 2_000 });
    expect(await countConfetti()).toBeGreaterThan(0);

    // Let the first batch of confetti fully clear before the next action, so
    // it can't be mistaken for a second (incorrect) firing below.
    await page.waitForFunction(() => document.querySelectorAll(
      'body > div[style*="z-index: 9999"]').length === 0, { timeout: 3_000 });

    // 3x octopus (747) - already unlocked, crossing again shouldn't re-fire.
    await page.click('.qty-inc');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '3';
    }, { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(await countConfetti()).toBe(0);
  });
});

// ── Legacy gift-line cleanup ─────────────────────────────────────────────────
// Regression coverage for cleanupLegacyGiftLine(): carts left over from the
// retired 6-month campaign may still hold a real Shopify line item tagged
// _gift/FREEGIFT299. cart.js no longer knows about the gift feature, so this
// verifies the one-time cleanup on cart load actually strips that line
// server-side rather than just hiding it in the UI.

test.describe('Legacy gift-line cleanup', () => {
  const GIFT_VARIANT = 'gid://shopify/ProductVariant/48173905576158'; // Cat Cable Clip

  async function createLegacyGiftCart(page, extraLines = []) {
    return page.evaluate(async ({ giftVariant, extraLines }) => {
      const DOMAIN = 'shop.layerweaver.com';
      const TOKEN = '7f0eafeb115e99a4a917e044a1fb4125';
      const API = `https://${DOMAIN}/api/2025-01/graphql.json`;
      const lines = [
        { merchandiseId: giftVariant, quantity: 1, attributes: [{ key: '_gift', value: 'FREEGIFT299' }] },
        ...extraLines,
      ];
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body: JSON.stringify({
          query: `mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) { cart { id totalQuantity } }
          }`,
          variables: { input: { lines } },
        }),
      });
      const json = await res.json();
      return json.data.cartCreate.cart;
    }, { giftVariant: GIFT_VARIANT, extraLines });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
  });

  test('strips the only line and settles to empty cart', async ({ page }) => {
    const cart = await createLegacyGiftCart(page);
    await page.evaluate((id) => localStorage.setItem('lw_cart_id', id), cart.id);
    await page.reload();
    await waitForCartReady(page);

    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && (badge.textContent === '0' || getComputedStyle(badge).display === 'none');
    }, { timeout: 15_000 });

    await openDrawer(page);
    await expect(page.locator('.cart-empty')).toBeVisible();
  });

  test('removes gift line but keeps other items in the cart', async ({ page }) => {
    const octopusVariant = await page.getAttribute('#add-to-cart-btn', 'data-variant-gid');
    const cart = await createLegacyGiftCart(page, [{ merchandiseId: octopusVariant, quantity: 1 }]);
    await page.evaluate((id) => localStorage.setItem('lw_cart_id', id), cart.id);
    await page.reload();
    await waitForCartReady(page);

    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 15_000 });

    await openDrawer(page);
    const lines = await getDrawerLines(page);
    expect(lines.length).toBe(1);
    expect(lines[0].title).toBe('Articulated Octopus');
  });

  test('clears a lingering discount code even without a gift line', async ({ page }) => {
    // Simulates a cart where the FREEGIFT299 code survived without the tagged
    // line (e.g. the line was removed through some other path) - cleanup must
    // not rely solely on the line's presence to decide to clear the code.
    const octopusVariant = await page.getAttribute('#add-to-cart-btn', 'data-variant-gid');
    const cartId = await page.evaluate(async (variantGid) => {
      const DOMAIN = 'shop.layerweaver.com';
      const TOKEN = '7f0eafeb115e99a4a917e044a1fb4125';
      const API = `https://${DOMAIN}/api/2025-01/graphql.json`;
      const createRes = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body: JSON.stringify({
          query: `mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) { cart { id } }
          }`,
          variables: { input: { lines: [{ merchandiseId: variantGid, quantity: 1 }] } },
        }),
      });
      const { data } = await createRes.json();
      const cartId = data.cartCreate.cart.id;

      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body: JSON.stringify({
          query: `mutation cartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
            cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { cart { id } }
          }`,
          variables: { cartId, discountCodes: ['FREEGIFT299'] },
        }),
      });
      return cartId;
    }, octopusVariant);

    await page.evaluate((id) => localStorage.setItem('lw_cart_id', id), cartId);
    await page.reload();
    await waitForCartReady(page);
    await page.waitForTimeout(1_500); // let cleanup's discount-clear mutation settle

    const discountCodes = await page.evaluate(async (id) => {
      const DOMAIN = 'shop.layerweaver.com';
      const TOKEN = '7f0eafeb115e99a4a917e044a1fb4125';
      const API = `https://${DOMAIN}/api/2025-01/graphql.json`;
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body: JSON.stringify({
          query: `query getCart($id: ID!) { cart(id: $id) { discountCodes { code } } }`,
          variables: { id },
        }),
      });
      const { data } = await res.json();
      return data.cart.discountCodes;
    }, cartId);

    expect(discountCodes).toEqual([]);
  });
});

// ── Cart persistence ────────────────────────────────────────────────────────

test.describe('Cart persistence', () => {
  test('cart survives page reload', async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);

    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });

    await page.reload();
    await waitForCartReady(page);
    // Badge should restore from cached qty or fetched cart
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && getComputedStyle(badge).display !== 'none';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(1);
  });
});

// ── Drawer UI ───────────────────────────────────────────────────────────────

test.describe('Drawer UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('open drawer - overlay visible and scroll locked', async ({ page }) => {
    await openDrawer(page);
    await expect(page.locator('#cart-overlay.open')).toBeVisible();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('close drawer via X button', async ({ page }) => {
    await openDrawer(page);
    await page.click('#cart-close');
    await expect(page.locator('#cart-drawer.open')).not.toBeVisible();
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('');
  });

  test('close drawer via overlay click', async ({ page }) => {
    await openDrawer(page);
    await page.click('#cart-overlay');
    await expect(page.locator('#cart-drawer.open')).not.toBeVisible();
  });

  test('checkout button has href when cart has items', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);
    const href = await page.getAttribute('#cart-checkout-btn', 'href');
    expect(href).toContain('layerweaver.com');
  });

  test('shipping progress bar visible', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);
    await expect(page.locator('#shipping-progress')).toBeVisible();
  });
});

// ── Button states ───────────────────────────────────────────────────────────

test.describe('Button states', () => {
  test('button shows In Cart after adding', async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);

    await page.click('#add-to-cart-btn');
    await expect(page.locator('#add-to-cart-btn')).toContainText('In Cart', { timeout: 10_000 });
    await expect(page.locator('#add-to-cart-btn')).toHaveClass(/btn-in-cart/);
  });

  test('button shows Adding... during request', async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);

    const addBtn = page.locator('#add-to-cart-btn');
    const [_] = await Promise.all([
      addBtn.click(),
      expect(addBtn).toContainText('Adding', { timeout: 3_000 }),
    ]);
  });
});

// ── Variant selection ───────────────────────────────────────────────────────

test.describe('Variant selection', () => {
  test('selecting variant updates button state', async ({ page }) => {
    await page.goto(PRODUCT_BUTTERFLY);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);

    const variantBtns = page.locator('.variant-btn');
    const count = await variantBtns.count();
    if (count < 2) {
      test.skip();
      return;
    }

    // Add first variant
    await variantBtns.first().click();
    await page.click('#add-to-cart-btn');
    await expect(page.locator('#add-to-cart-btn')).toContainText('In Cart', { timeout: 10_000 });

    // Switch to second variant - button should reset
    await variantBtns.nth(1).click();
    await page.waitForTimeout(500);
    const text = await page.textContent('#add-to-cart-btn');
    expect(text).toBe('Add to Cart');
  });
});

// ── Analytics events ────────────────────────────────────────────────────────

test.describe('Analytics events', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await clearCart(page);
    await page.reload();
    await waitForCartReady(page);
  });

  test('add_to_cart event fires', async ({ page }) => {
    await page.evaluate(() => {
      window._testEvents = [];
      window.LW_LOG_EVENT = (name, params) => window._testEvents.push({ name, params });
    });
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      return window._testEvents?.some(e => e.name === 'add_to_cart');
    }, { timeout: 10_000 });
    const events = await page.evaluate(() => window._testEvents);
    const addEvent = events.find(e => e.name === 'add_to_cart');
    expect(addEvent.params.item_name).toBe('Articulated Octopus');
    expect(addEvent.params.value).toBe(249);
    expect(addEvent.params.currency).toBe('INR');
  });

  test('view_cart event fires on drawer open', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });

    await page.evaluate(() => {
      window._testEvents = [];
      window.LW_LOG_EVENT = (name, params) => window._testEvents.push({ name, params });
    });
    await openDrawer(page);
    const events = await page.evaluate(() => window._testEvents);
    expect(events.some(e => e.name === 'view_cart')).toBeTruthy();
  });

  test('remove_from_cart event fires', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });

    await page.evaluate(() => {
      window._testEvents = [];
      window.LW_LOG_EVENT = (name, params) => window._testEvents.push({ name, params });
    });
    await openDrawer(page);
    await page.click('.remove-btn');
    await page.waitForFunction(() => {
      return window._testEvents?.some(e => e.name === 'remove_from_cart');
    }, { timeout: 10_000 });
    const events = await page.evaluate(() => window._testEvents);
    const removeEvent = events.find(e => e.name === 'remove_from_cart');
    expect(removeEvent.params.item_name).toBe('Articulated Octopus');
  });

  test('GA4 add_to_cart gtag event fires alongside the existing LW_LOG_EVENT/fbq calls', async ({ page }) => {
    await page.evaluate(() => {
      window._testGtagCalls = [];
      window.gtag = (...args) => window._testGtagCalls.push(args);
    });
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      return window._testGtagCalls?.some(args => args[0] === 'event' && args[1] === 'add_to_cart');
    }, { timeout: 10_000 });
    const calls = await page.evaluate(() => window._testGtagCalls);
    const [, , params] = calls.find(args => args[1] === 'add_to_cart');
    expect(params.currency).toBe('INR');
    expect(params.value).toBe(249);
    expect(params.items).toEqual([{
      item_id: expect.any(String),
      item_name: 'Articulated Octopus',
      price: 249,
      quantity: 1,
    }]);
  });

  test('GA4 begin_checkout gtag event fires with cart line items', async ({ page }) => {
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    await openDrawer(page);

    // The checkout button is a real link to Shopify's checkout domain - add a
    // second click listener that calls preventDefault() so the page doesn't
    // actually navigate away before the first listener's tracking calls can
    // be inspected. (Aborting the navigation's network request instead loads
    // a chrome-error page and tears down window state just the same.)
    await page.evaluate(() => {
      document.getElementById('cart-checkout-btn').addEventListener('click', (e) => e.preventDefault());
      window._testGtagCalls = [];
      window.gtag = (...args) => window._testGtagCalls.push(args);
    });
    await page.click('#cart-checkout-btn');
    await page.waitForFunction(() => {
      return window._testGtagCalls?.some(args => args[0] === 'event' && args[1] === 'begin_checkout');
    }, { timeout: 10_000 });
    const calls = await page.evaluate(() => window._testGtagCalls);
    const [, , params] = calls.find(args => args[1] === 'begin_checkout');
    expect(params.currency).toBe('INR');
    expect(params.value).toBe(249);
    expect(params.items).toEqual([{
      item_id: expect.any(String),
      item_name: 'Articulated Octopus',
      price: 249,
      quantity: 1,
    }]);
  });
});

// ── Attribution capture ──────────────────────────────────────────────────────
// script.js's captureAttribution() IIFE has no DOM dependency and runs on
// every page load, so each test here treats its own first page.goto() as
// the "landing" - a preceding plain navigation would itself count as a
// first touch and mask what's under test (see first-touch persistence test).

test.describe('Attribution capture', () => {
  test('captures UTM params from the landing page into localStorage', async ({ page }) => {
    await page.goto(`${PRODUCT_OCTOPUS}?utm_source=newsletter&utm_medium=email&utm_campaign=july-sale`);
    await page.waitForFunction(() => localStorage.getItem('lw_attribution') !== null);
    const attribution = await page.evaluate(() => JSON.parse(localStorage.getItem('lw_attribution')));
    expect(attribution.source).toBe('newsletter');
    expect(attribution.utm_medium).toBe('email');
    expect(attribution.utm_campaign).toBe('july-sale');
    expect(attribution.landingPage).toBe(PRODUCT_OCTOPUS);
    expect(attribution.capturedAt).toEqual(expect.any(Number));
  });

  test('captures direct visits with source "direct" when there is no UTM or referrer', async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await page.waitForFunction(() => localStorage.getItem('lw_attribution') !== null);
    const attribution = await page.evaluate(() => JSON.parse(localStorage.getItem('lw_attribution')));
    expect(attribution.source).toBe('direct');
    expect(attribution.referrer).toBe('');
  });

  test('first-touch attribution persists across a later visit with different UTM params', async ({ page }) => {
    await page.goto(`${PRODUCT_OCTOPUS}?utm_source=newsletter&utm_medium=email`);
    await page.waitForFunction(() => localStorage.getItem('lw_attribution') !== null);

    await page.goto(`${SHOP}?utm_source=google&utm_medium=cpc`);
    await page.waitForTimeout(200); // let captureAttribution's IIFE run and (not) write
    const attribution = await page.evaluate(() => JSON.parse(localStorage.getItem('lw_attribution')));
    expect(attribution.source).toBe('newsletter');
    expect(attribution.utm_medium).toBe('email');
  });

  test('attaches captured attribution to the cart on first add-to-cart', async ({ page }) => {
    await page.goto(`${PRODUCT_OCTOPUS}?utm_source=instagram&utm_medium=social`);
    await waitForCartReady(page);

    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });

    const cartId = await page.evaluate(() => localStorage.getItem('lw_cart_id'));
    const attributes = await page.evaluate(async (id) => {
      const DOMAIN = 'shop.layerweaver.com';
      const TOKEN = '7f0eafeb115e99a4a917e044a1fb4125';
      const API = `https://${DOMAIN}/api/2025-01/graphql.json`;
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
        body: JSON.stringify({
          query: `query getCart($id: ID!) { cart(id: $id) { attributes { key value } } }`,
          variables: { id },
        }),
      });
      const { data } = await res.json();
      return data.cart.attributes;
    }, cartId);

    const map = Object.fromEntries(attributes.map(a => [a.key, a.value]));
    expect(map['Attribution Source']).toBe('instagram');
    expect(map['Attribution Medium']).toBe('social');
    expect(map['Landing Page']).toBe(PRODUCT_OCTOPUS);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

test.describe('Edge cases', () => {
  test('expired cart ID falls back to new cart', async ({ page }) => {
    await page.goto(PRODUCT_OCTOPUS);
    await page.evaluate(() => {
      localStorage.setItem('lw_cart_id', 'gid://shopify/Cart/INVALID_EXPIRED_ID');
      localStorage.setItem('lw_cart_qty', '3');
    });
    await page.reload();
    await waitForCartReady(page);

    // Badge may briefly show cached qty, but after fetch fails cart should be null
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && (badge.textContent === '0' || getComputedStyle(badge).display === 'none');
    }, { timeout: 10_000 });

    // Should still be able to add to cart (creates new cart)
    await page.click('#add-to-cart-btn');
    await page.waitForFunction(() => {
      const badge = document.getElementById('cart-badge');
      return badge && badge.textContent === '1';
    }, { timeout: 10_000 });
    expect(await getBadgeCount(page)).toBe(1);
  });
});
