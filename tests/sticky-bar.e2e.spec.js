import { test, expect } from '@playwright/test';

// Sticky Add to Cart bar on product pages (wireStickyBar in shop/cart.js). Phones only.
// Screenshots go to SHOTS when it is set.
const SHOTS = process.env.STICKY_SHOTS;
const P = h => `/shop/products/${h}/`;
const OCTOPUS = P('articulated-octopus');
const KEYCHAIN = P('personalized-number-plate-keychain');
const GIFT = P('layerweaver-e-gift-card');
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const bar = page => page.locator('#sticky-add-bar');
const scrollPast = async page => { await page.evaluate(() => window.scrollTo(0, 1400)); await page.waitForTimeout(400); };
async function fresh(page, path) {
  await page.goto(path);
  await page.evaluate(() => { for (const k of ['lw_cart_id', 'lw_cart_qty']) localStorage.removeItem(k); sessionStorage.removeItem('lw_rewards_tier_count'); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('cart-icon-btn'), { timeout: 10_000 });
}
const badge = async page => { const b = page.locator('#cart-badge'); return (await b.evaluate(e => getComputedStyle(e).display)) === 'none' ? 0 : parseInt(await b.textContent()); };

for (const vp of [{ name: 'phone375', width: 375, height: 800 }, { name: 'phone430', width: 430, height: 900 }]) {
  test.describe(`sticky add bar ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('hidden at the top, shows after the button scrolls away, hides when it is back', async ({ page }) => {
      await fresh(page, OCTOPUS);
      await expect(bar(page)).toBeHidden();
      await scrollPast(page);
      await expect(bar(page)).toBeVisible();
      await expect(bar(page).locator('.sticky-add-price')).toHaveText('₹249');
      await expect(bar(page).locator('.sticky-add-btn')).toContainText('Add to Cart');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(page, `bar-normal-${vp.name}`);
      // nothing covers the end of the page: padding below the footer is at least the bar's height
      const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
      const h = (await bar(page).boundingBox()).height;
      expect(pad).toBeGreaterThanOrEqual(h - 1);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
      await expect(bar(page)).toBeHidden();
    });

    test('adds the selected colour from the bar; the bar button follows the main button', async ({ page }) => {
      await fresh(page, OCTOPUS);
      await page.locator('.variant-btn').nth(1).click();
      const colour = (await page.locator('#selected-variant-label').textContent()).trim();
      await scrollPast(page);
      await bar(page).locator('.sticky-add-btn').click();
      await page.waitForFunction(() => { const b = document.getElementById('cart-badge'); return b && getComputedStyle(b).display !== 'none'; }, { timeout: 10_000 });
      expect(await badge(page)).toBe(1);
      await expect(bar(page).locator('.sticky-add-btn')).toContainText('In Cart', { timeout: 5_000 });
      await shot(page, `bar-with-rewards-bubble-${vp.name}`);
      await page.click('#cart-icon-btn');
      await page.waitForSelector('#cart-drawer.open');
      await expect(bar(page)).toBeHidden();                              // hidden while the cart is open
      await expect(page.locator('.cart-line')).toContainText(new RegExp(colour, 'i'));
    });

    test('personalised: with the text empty the bar takes you back to the field instead of adding', async ({ page }) => {
      await fresh(page, KEYCHAIN);
      await scrollPast(page);
      await expect(bar(page)).toBeVisible();
      await shot(page, `bar-personalised-${vp.name}`);
      await bar(page).locator('.sticky-add-btn').click();
      await page.waitForTimeout(800);
      expect(await badge(page)).toBe(0);
      await expect(page.locator('#custom-text')).toBeFocused();
      await expect(page.locator('#custom-text')).toBeInViewport();
      await page.fill('#custom-text', 'MH12AB1234');
      await scrollPast(page);
      await bar(page).locator('.sticky-add-btn').click();
      await page.waitForFunction(() => { const b = document.getElementById('cart-badge'); return b && getComputedStyle(b).display !== 'none'; }, { timeout: 10_000 });
      expect(await badge(page)).toBeGreaterThanOrEqual(1);
    });

    test('no bar on a gift card', async ({ page }) => {
      await page.goto(GIFT);
      await scrollPast(page);
      await expect(bar(page)).toHaveCount(0);
    });
  });
}

test.describe('sticky add bar desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('never shows on desktop width', async ({ page }) => {
    await page.goto(OCTOPUS);
    await scrollPast(page);
    await expect(bar(page)).toBeHidden();
  });
});
