import { test, expect } from '@playwright/test';

// The pincode box on a product page and in the cart: the year-round delivery wording.
// (The Diwali "order by" wording and its Oct 30 switch were removed on Nov 9 2026; that
// wording is in git history.) The date is faked in the browser. Screenshots go to SHOTS
// when it is set.
const PRODUCT = '/shop/products/articulated-octopus/';
const DAY = '2026-11-12T12:00:00+05:30';
const SHOTS = process.env.PINCODE_SHOTS;

const WIDTHS = [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }];

async function fillPincode(page, scope, pin) {
  await page.locator(scope + ' .orderby-form input').fill(pin);
  await page.locator(scope + ' .orderby-form button').click();
}

for (const vp of WIDTHS) {
  {
    test.describe(`pincode box ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date(DAY));
        await page.goto(PRODUCT);
        await page.evaluate(() => { localStorage.removeItem('lw_cart_id'); localStorage.removeItem('lw_cart_qty'); localStorage.removeItem('lw_pincode'); });
        await page.reload();
        await page.waitForSelector('[data-orderby] .orderby-form');
      });

      test('product page', async ({ page }) => {
        const box = page.locator('[data-orderby]').first();
        // Rest of India (Guwahati).
        await fillPincode(page, '[data-orderby]:visible', '781001');
        const res = box.locator('.orderby-result');
        await expect(res).toHaveText('Usually arrives in 6-8 days.');
        await expect(box.locator('.orderby-label')).toContainText('When will it arrive?');
        await expect(box).not.toContainText(/Diwali|Order by|e-gift/);
        // Maharashtra (Pune).
        await fillPincode(page, '[data-orderby]:visible', '411001');
        await expect(res).toHaveText('Usually arrives in 3-5 days.');
        // Mumbai, rest of Maharashtra (Nashik), Goa.
        for (const [pin, days] of [['400001', '3-5'], ['422001', '3-6'], ['403001', '6-8']]) {
          await fillPincode(page, '[data-orderby]:visible', pin);
          await expect(res).toHaveText(`Usually arrives in ${days} days.`);
        }
        // Metro (Bengaluru).
        await fillPincode(page, '[data-orderby]:visible', '560001');
        await expect(res).toHaveText('Usually arrives in 5-7 days.');
        if (SHOTS) await box.screenshot({ path: `${SHOTS}/product-${vp.name}.png` });
      });

      test('cart', async ({ page }) => {
        await page.click('#add-to-cart-btn');
        await page.waitForFunction(() => {
          const b = document.getElementById('cart-badge');
          return b && getComputedStyle(b).display !== 'none';
        }, { timeout: 10_000 });
        await page.click('#cart-icon-btn');
        await page.waitForSelector('#cart-drawer.open', { timeout: 5_000 });
        const box = page.locator('.orderby-cart');
        await expect(box).toBeVisible();
        await fillPincode(page, '.orderby-cart', '781001');
        const res = box.locator('.orderby-result');
        await expect(res).toHaveText('Usually arrives in 6-8 days.');
        await expect(box).not.toContainText(/Diwali|Order by|e-gift/);
        if (SHOTS) await page.locator('#cart-drawer').screenshot({ path: `${SHOTS}/cart-${vp.name}.png` });
      });
    });
  }
}
