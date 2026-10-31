import { test, expect } from '@playwright/test';

// The promise row on product pages and in the cart (shop/promise-row.js).
// Screenshots go to SHOTS when it is set.
const SHOTS = process.env.PROMISE_SHOTS;
const P = h => `/shop/products/${h}/`;
const OCTOPUS = P('articulated-octopus');          // Rs 249
const KEYCHAIN = P('personalized-number-plate-keychain');
const GIFT = P('layerweaver-e-gift-card');
const LAMP = P('chill-guy-lamp');
const DELIVERY = 'Delivery ₹49, free above ₹299.';
const DAMAGED = 'Damaged or wrong item? Replacement or full refund within 7 days, with photos.';
const PERSONAL = "Personalised items can't be returned if you change your mind.";
const WIDTHS = [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }];

async function fresh(page, path) {
  await page.goto(path);
  await page.evaluate(() => { for (const k of ['lw_cart_id', 'lw_cart_qty', 'lw_pincode']) localStorage.removeItem(k); sessionStorage.removeItem('lw_rewards_tier_count'); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('cart-icon-btn'), { timeout: 10_000 });
}
async function added(page) {
  await page.waitForFunction(() => { const b = document.getElementById('cart-badge'); return b && getComputedStyle(b).display !== 'none'; }, { timeout: 10_000 });
}
async function openCart(page) {
  await page.click('#cart-icon-btn');
  await page.waitForSelector('#cart-drawer.open', { timeout: 5_000 });
  await page.waitForTimeout(600);
}
const shot = async (page, name, el) => { if (SHOTS) await (el ?? page).screenshot({ path: `${SHOTS}/${name}.png` }); };
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const vp of WIDTHS) {
  test.describe(`promise row ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('product page: delivery cost and damage line under the pincode box', async ({ page }) => {
      await page.goto(OCTOPUS);
      const items = page.locator('.promise-row li');
      await expect(items).toHaveText([DELIVERY, DAMAGED]);
      expect(await noOverflow(page)).toBe(true);
      // order: Add to Cart, pincode box, promise row, age line
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('#add-to-cart-btn')).toBeLessThan(await y('[data-orderby]'));
      expect(await y('[data-orderby]')).toBeLessThan(await y('.promise-row'));
      expect(await y('.promise-row')).toBeLessThan(await y('.age-warning'));
      await page.locator('.product-actions').scrollIntoViewIfNeeded();
      await shot(page, `product-plain-${vp.name}`);
    });

    test('product page: personalised keeps the damage line and excludes change-of-mind returns', async ({ page }) => {
      await page.goto(KEYCHAIN);
      await expect(page.locator('.promise-row li').nth(1)).toHaveText(`${DAMAGED} ${PERSONAL}`);
      await page.locator('.promise-row').scrollIntoViewIfNeeded();
      await shot(page, `product-personalised-${vp.name}`);
    });

    test('product page: gift card has no row; a lamp has it (no age line)', async ({ page }) => {
      await page.goto(GIFT);
      await expect(page.locator('.promise-row')).toHaveCount(0);
      await shot(page, `product-giftcard-${vp.name}`);
      await page.goto(LAMP);
      await expect(page.locator('.promise-row')).toHaveCount(1);
      await expect(page.locator('.age-warning')).toHaveCount(0);
    });

    test('cart under Rs 299: delivery Rs 49, total with delivery, returns note, checkout link intact', async ({ page }) => {
      await fresh(page, OCTOPUS);
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await expect(page.locator('#cart-delivery-row')).toContainText('Delivery');
      await expect(page.locator('#cart-delivery-price')).toHaveText('₹49');
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await expect(page.locator('#cart-total-price')).toHaveText('₹298');
      await expect(page.locator('#cart-returns-note')).toHaveText('Damaged or wrong item? Replacement or full refund within 7 days.');
      const href = await page.locator('#cart-checkout-btn').getAttribute('href');
      expect(href).toMatch(/^https:\/\/.+/);
      await shot(page, `cart-under299-${vp.name}`, page.locator('#cart-drawer'));
      // no floating rewards bubble over the items while the cart is open
      await expect(page.locator('#rewards-bubble.bubble-visible')).toHaveCount(0);
    });

    test('cart from Rs 299: delivery free, total unchanged', async ({ page }) => {
      await fresh(page, OCTOPUS);
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await page.click('.qty-inc'); await expect(page.locator('#cart-total-price')).toHaveText('₹498', { timeout: 8_000 });
      await expect(page.locator('#cart-delivery-price')).toHaveText('Free');
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await shot(page, `cart-over299-${vp.name}`, page.locator('#cart-drawer'));
    });

    test('cart with a personalised item: returns note excludes change-of-mind returns', async ({ page }) => {
      await fresh(page, KEYCHAIN);
      await page.fill('#custom-text', 'MH12AB1234');
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await expect(page.locator('#cart-returns-note')).toContainText('Damaged or wrong item?');
      await expect(page.locator('#cart-returns-note')).toContainText(PERSONAL);
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await shot(page, `cart-personalised-${vp.name}`, page.locator('#cart-drawer'));
    });

    test('cart with only a gift card: plain total, no delivery, no returns note', async ({ page }) => {
      await fresh(page, GIFT);
      await page.fill('#gc-email', 'test@example.com');
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await expect(page.locator('#cart-total-label')).toHaveText('Total');
      await expect(page.locator('#cart-delivery-row')).toBeHidden();
      await expect(page.locator('#cart-returns-note')).toBeHidden();
      await shot(page, `cart-giftcard-only-${vp.name}`, page.locator('#cart-drawer'));
    });

    test('cart with a gift card and a product: total with delivery (the gift card does not make delivery free)', async ({ page }) => {
      await fresh(page, GIFT);
      await page.fill('#gc-email', 'test@example.com');
      await page.click('#add-to-cart-btn'); await added(page);
      await page.goto(OCTOPUS);
      await page.waitForLoadState('networkidle');
      await page.click('#add-to-cart-btn');
      await expect(page.locator('#add-to-cart-btn')).toContainText(/In Cart/i, { timeout: 10_000 });
      await openCart(page);
      await expect(page.locator('#cart-delivery-price')).toHaveText('₹49');
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await shot(page, `cart-giftcard-plus-product-${vp.name}`, page.locator('#cart-drawer'));
    });

    test('empty cart: no row, Diwali cards untouched before Nov 1 and after', async ({ page }) => {
      for (const day of ['2026-10-31T12:00:00+05:30', '2026-11-02T12:00:00+05:30']) {
        await page.clock.setFixedTime(new Date(day));
        await fresh(page, OCTOPUS);
        await openCart(page);
        await expect(page.locator('#cart-delivery-row')).toBeHidden();
        await expect(page.locator('#cart-returns-note')).toBeHidden();
        await expect(page.locator('.cart-empty')).toBeVisible();
        await shot(page, `cart-empty-${day.slice(0, 10)}-${vp.name}`, page.locator('#cart-drawer'));
        await page.click('#cart-close');
      }
    });

    test('cart row works with the Diwali rewards marks (Nov 1) and after them (Nov 2)', async ({ page }) => {
      for (const day of ['2026-11-01T12:00:00+05:30', '2026-11-02T12:00:00+05:30']) {
        await page.clock.setFixedTime(new Date(day));
        await fresh(page, OCTOPUS);
        await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
        await expect(page.locator('#cart-total-price')).toHaveText('₹298');
        if (day.startsWith('2026-11-01')) await expect(page.locator('.rewards-bar-mark').first()).toBeVisible();
        await shot(page, `cart-under299-${day.slice(0, 10)}-${vp.name}`, page.locator('#cart-drawer'));
        await page.click('#cart-close');
      }
    });
  });
}
