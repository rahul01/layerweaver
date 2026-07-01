import { test, expect } from '@playwright/test';

const SHOP = '/shop/';
const PRODUCT_OCTOPUS = '/shop/products/articulated-octopus/';   // 199
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
    expect(octopus.price).toContain('199');
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
    // Octopus is 199, below the 299 free-shipping threshold
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
    // 2x octopus = 398, above the 299 threshold
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
    expect(addEvent.params.value).toBe(199);
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
