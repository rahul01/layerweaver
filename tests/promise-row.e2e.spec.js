import { test, expect } from '@playwright/test';

// The promise row on product pages and in the cart (shop/promise-row.js).
// Screenshots go to SHOTS when it is set.
const SHOTS = process.env.PROMISE_SHOTS;
const P = h => `/shop/products/${h}/`;
const OCTOPUS = P('articulated-octopus');          // Rs 249
const KEYCHAIN = P('personalized-number-plate-keychain');
const GIFT = P('layerweaver-e-gift-card');
const LAMP = P('chill-guy-lamp');
const DELIVERY = 'Delivery ₹49, free on orders above ₹299.';
const RETURNS = "7-day easy returns. Damaged in transit? We'll make it right. Return policy";
const PERSONAL = 'Made just for you. See our return policy.';
const BIG = P('ghost-balloon-lamp');                 // Rs 299 or more
const HOODIE = P('hoodie-pen-pot-with-personalisation');
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

    const LABELS = ['Delivery ₹49', '7-day easy returns', 'Printed to order in Pune', 'Questions? FAQ'];

    test('product page: icon row under the price, replacing the two text lines', async ({ page }) => {
      await page.goto(OCTOPUS);
      await expect(page.locator('.promise-icons li')).toHaveText(LABELS);
      await expect(page.locator('.promise-row')).toHaveCount(0);        // nothing shown twice
      expect(await noOverflow(page)).toBe(true);
      // order: price, icon row, Add to Cart, pincode box, age line
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('#product-price')).toBeLessThan(await y('.promise-icons'));
      expect(await y('.promise-icons')).toBeLessThan(await y('#add-to-cart-btn'));
      expect(await y('#add-to-cart-btn')).toBeLessThan(await y('[data-orderby]'));
      // four items on one row, tap targets at least 44px tall, links go to the right pages
      const boxes = await page.locator('.promise-icons li > *').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: r.height }; }));
      expect(new Set(boxes.map(b => b.top)).size).toBe(1);
      for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.promise-icons a')).toHaveCount(3);
      await expect(page.locator('.promise-icons a').nth(0)).toHaveAttribute('href', /\/shipping-policy\/$/);
      await expect(page.locator('.promise-icons a').nth(1)).toHaveAttribute('href', /\/return-and-exchange-policy\/$/);
      await expect(page.locator('.promise-icons a').nth(2)).toHaveAttribute('href', /\/faq\/$/);
      await expect(page.locator('.promise-icons a').nth(1)).toHaveAttribute('title', "Damaged in transit? We'll make it right.");
      await page.locator('.promise-icons').scrollIntoViewIfNeeded();
      await shot(page, `product-plain-${vp.name}`);
    });

    test('product page: personalised says Made just for you instead of easy returns', async ({ page }) => {
      await page.goto(KEYCHAIN);
      await expect(page.locator('.promise-icons li').nth(1)).toHaveText('Made just for you');
      await expect(page.locator('.promise-icons')).not.toContainText('easy returns');
      await page.locator('.promise-icons').scrollIntoViewIfNeeded();
      await shot(page, `product-personalised-${vp.name}`);
    });

    test('product page: gift card has no row; a lamp has it (no age line)', async ({ page }) => {
      await page.goto(GIFT);
      await expect(page.locator('.promise-icons')).toHaveCount(0);
      await expect(page.locator('.promise-row')).toHaveCount(0);
      await shot(page, `product-giftcard-${vp.name}`);
      await page.goto(LAMP);
      await expect(page.locator('.promise-icons')).toHaveCount(1);
      await expect(page.locator('.age-warning')).toHaveCount(0);
    });

    test('product at or over Rs 299 says Free delivery', async ({ page }) => {
      await page.goto(BIG);
      await expect(page.locator('.promise-icons li').first()).toHaveText('Free delivery');
      await page.locator('.promise-icons').scrollIntoViewIfNeeded();
      await shot(page, `product-299-plus-${vp.name}`);
      await page.goto(HOODIE);
      await expect(page.locator('.promise-icons li').nth(1)).toHaveText('Made just for you');
    });

    test('the icon links open the policy pages; the cart line still links to the return policy', async ({ page }) => {
      for (const [i, re] of [[0, /\/shipping-policy\/$/], [1, /\/return-and-exchange-policy\/$/], [2, /\/faq\/$/]]) {
        await page.goto(OCTOPUS);
        await Promise.all([page.waitForURL(re), page.locator('.promise-icons a').nth(i).click()]);
      }
      await fresh(page, OCTOPUS);
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await page.locator('#cart-returns-note a').click();
      await expect(page).toHaveURL(/\/return-and-exchange-policy\/$/);
    });

    test('cart footer links: Shipping Policy and FAQ (the FAQ works from every page depth), no second returns link', async ({ page }) => {
      for (const start of [OCTOPUS, '/shop/', '/shop/collections/diwali/']) {
        await fresh(page, start);
        if (start === OCTOPUS) { await page.click('#add-to-cart-btn'); await added(page); }
        await openCart(page);
        const links = page.locator('.cart-policy-links a');
        await expect(links).toHaveText([/Shipping Policy/, /FAQ/]);
        await expect(page.locator('.cart-policy-links', { hasText: 'Return and Exchange Policy' })).toHaveCount(0);
        await expect(page.locator('.cart-policy-links a', { hasText: 'FAQ' })).toHaveAttribute('href', '/faq/');
        if (start === OCTOPUS) await shot(page, `cart-footer-links-${vp.name}`, page.locator('#cart-drawer'));
        await Promise.all([page.waitForURL(/\/faq\/$/), page.locator('.cart-policy-links a', { hasText: 'FAQ' }).click()]);
        await expect(page.locator('h1')).toContainText('Frequently Asked Questions');
      }
    });

    test('cart under Rs 299: delivery Rs 49, total with delivery, returns note, checkout link intact', async ({ page }) => {
      await fresh(page, OCTOPUS);
      await page.click('#add-to-cart-btn'); await added(page); await openCart(page);
      await expect(page.locator('#cart-delivery-row')).toContainText('Delivery');
      await expect(page.locator('#cart-delivery-price')).toHaveText('₹49');
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await expect(page.locator('#cart-total-price')).toHaveText('₹298');
      await expect(page.locator('#cart-returns-note')).toHaveText('7-day easy returns. Return policy');
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
      await expect(page.locator('#cart-returns-note')).toHaveText(PERSONAL);
      await expect(page.locator('#cart-returns-note')).not.toContainText('easy returns');
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
