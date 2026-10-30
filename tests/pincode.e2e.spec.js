import { test, expect } from '@playwright/test';

// The pincode box on a product page and in the cart, before and after the
// Oct 31 (IST) switch to the year-round delivery wording. The date is faked in
// the browser. Screenshots go to SHOTS when it is set.
const PRODUCT = '/shop/products/articulated-octopus/';
const BEFORE = '2026-10-30T12:00:00+05:30';
const AFTER = '2026-10-31T00:00:00+05:30';
const SHOTS = process.env.PINCODE_SHOTS;

const WIDTHS = [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }];

async function fillPincode(page, scope, pin) {
  await page.locator(scope + ' .orderby-form input').fill(pin);
  await page.locator(scope + ' .orderby-form button').click();
}

for (const vp of WIDTHS) {
  for (const [when, iso] of [['before', BEFORE], ['after', AFTER]]) {
    test.describe(`pincode box ${vp.name} ${when} the Oct 31 switch`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.beforeEach(async ({ page }) => {
        await page.clock.setFixedTime(new Date(iso));
        await page.goto(PRODUCT);
        await page.evaluate(() => { localStorage.removeItem('lw_cart_id'); localStorage.removeItem('lw_cart_qty'); localStorage.removeItem('lw_pincode'); });
        await page.reload();
        await page.waitForSelector('[data-orderby] .orderby-form');
      });

      test('product page', async ({ page }) => {
        const box = page.locator('[data-orderby]').first();
        // Rest of India (Guwahati): past its Oct 26 date before, year-round after.
        await fillPincode(page, '[data-orderby]:visible', '781001');
        const res = box.locator('.orderby-result');
        if (when === 'before') {
          await expect(res).toContainText('might arrive after Diwali');
          await expect(res).toContainText('Usually arrives in 6-9 days.');
          await expect(box.locator('.orderby-label')).toContainText('before Diwali');
        } else {
          await expect(res).toHaveText('Usually arrives in 6-9 days.');
          await expect(box.locator('.orderby-label')).toContainText('When will it arrive?');
          await expect(box).not.toContainText(/Diwali|Order by|e-gift/);
        }
        // Maharashtra (Pune): order-by date before, plain after.
        await fillPincode(page, '[data-orderby]:visible', '411001');
        if (when === 'before') await expect(res).toContainText('Order by Sun, Nov 1 to get it before Diwali. Usually arrives in 4-6 days.');
        else await expect(res).toHaveText('Usually arrives in 4-6 days.');
        // Metro (Bengaluru): last day Oct 30.
        await fillPincode(page, '[data-orderby]:visible', '560001');
        if (when === 'before') await expect(res).toContainText('Order by Fri, Oct 30 to get it before Diwali. Usually arrives in 5-7 days.');
        else await expect(res).toHaveText('Usually arrives in 5-7 days.');
        if (SHOTS) await box.screenshot({ path: `${SHOTS}/product-${vp.name}-${when}.png` });
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
        if (when === 'before') await expect(res).toContainText('might arrive after Diwali');
        else {
          await expect(res).toHaveText('Usually arrives in 6-9 days.');
          await expect(box).not.toContainText(/Diwali|Order by|e-gift/);
        }
        if (SHOTS) await page.locator('#cart-drawer').screenshot({ path: `${SHOTS}/cart-${vp.name}-${when}.png` });
      });
    });
  }
}
