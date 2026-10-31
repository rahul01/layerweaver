import { test, expect } from '@playwright/test';

// "Photos from customers" under the product gallery (customerPhotosHtml in build-shop.js).
// Screenshots go to SHOTS when it is set. Product handles with 3, 1-2 and 0 photos
// are taken from the build output as it stands (reviews change), see PICKS below.
const SHOTS = process.env.PHOTO_SHOTS;
const P = h => `/shop/products/${h}/`;
const THREE = P('floating-cat');                 // 3 photos when written
const FEW = P('bunny-keychain');                 // 1-2 photos when written
const NONE = P('custom-name-keyring');           // 0 photos when written
const GIFT = P('layerweaver-e-gift-card');
const shot = async (page, name, el) => { if (SHOTS) await (el ?? page).screenshot({ path: `${SHOTS}/${name}.png` }); };

for (const vp of [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }]) {
  test.describe(`customer photos ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('3 photos: labelled row under the gallery, fixed size, in the right order, viewer opens', async ({ page }) => {
      await page.goto(THREE);
      const box = page.locator('.customer-photos');
      await expect(box.locator('.customer-photos-label')).toHaveText('Photos from customers');
      const tiles = box.locator('.customer-photo');
      await expect(tiles).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        const img = tiles.nth(i).locator('img');
        await expect(img).toHaveAttribute('alt', /^Customer photo of .+/);
        await expect(img).toHaveAttribute('loading', 'lazy');
        await expect(img).toHaveAttribute('width', '72');
        const b = await tiles.nth(i).boundingBox();
        expect(Math.round(b.width)).toBe(72); expect(Math.round(b.height)).toBe(72);
      }
      // order: gallery, customer photos, then title, price, icon row, Add to Cart
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('.main-image-wrap')).toBeLessThan(await y('.customer-photos'));
      if (vp.width < 769) {
        expect(await y('.customer-photos')).toBeLessThan(await y('.product-details h1'));
        expect(await y('#product-price')).toBeLessThan(await y('.promise-icons'));
        expect(await y('.promise-icons')).toBeLessThan(await y('#add-to-cart-btn'));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // the existing viewer opens, no second lightbox
      await tiles.first().click();
      await expect(page.locator('#review-lightbox.review-lightbox--open')).toBeVisible();
      await expect(page.locator('.review-lightbox')).toHaveCount(1);
      await expect(page.locator('#review-lightbox-img')).toHaveAttribute('src', /https?:\/\//);
      await shot(page, `photos-viewer-${vp.name}`);
      await page.keyboard.press('Escape');
      await expect(page.locator('#review-lightbox.review-lightbox--open')).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `photos-three-${vp.name}`);
    });

    test('See all photos scrolls to the full strip lower down (both are kept)', async ({ page }) => {
      await page.goto(THREE);
      const all = page.locator('.customer-photos-all');
      if (await all.count()) {
        await all.click();
        await expect(page.locator('#review-photos')).toBeInViewport();
      }
      await expect(page.locator('#review-photos.review-photo-strip')).toHaveCount(1);
    });

    test('1-2 photos shows those; no photos shows nothing at all (no heading, no empty box)', async ({ page }) => {
      await page.goto(FEW);
      const n = await page.locator('.customer-photos .customer-photo').count();
      expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(3);
      await shot(page, `photos-few-${vp.name}`);
      await page.goto(NONE);
      await expect(page.locator('.customer-photos')).toHaveCount(0);
      await expect(page.getByText('Photos from customers')).toHaveCount(0);
      await shot(page, `photos-none-${vp.name}`);
    });

    test('gift card: nothing', async ({ page }) => {
      await page.goto(GIFT);
      await expect(page.locator('.customer-photos')).toHaveCount(0);
    });
  });
}
