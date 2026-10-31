import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { customerPhotosHtml } from '../scripts/build-shop-utils.js';

// "Photos from customers" under the gallery is curated (shop/customer-photo-picks.json).
// With no picks the row is absent everywhere, the full strip lower down is unchanged. The
// layout of a row that does have photos is checked by injecting the build's own markup.
const picks = JSON.parse(readFileSync('shop/customer-photo-picks.json', 'utf8'));
const SHOTS = process.env.PHOTO_SHOTS;
const P = h => `/shop/products/${h}/`;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

for (const vp of [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }]) {
  test.describe(`customer photos ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('only products with picks show the row; the full strip is unchanged', async ({ page }) => {
      for (const handle of ['floating-cat', 'bunny-keychain', 'custom-name-keyring', 'layerweaver-e-gift-card']) {
        await page.goto(P(handle));
        const has = Array.isArray(picks[handle]) && picks[handle].length > 0 && handle !== 'layerweaver-e-gift-card';
        await expect(page.locator('.customer-photos')).toHaveCount(has ? 1 : 0);
        if (!has) await expect(page.getByText('Photos from customers')).toHaveCount(0);
      }
      await page.goto(P('floating-cat'));
      await expect(page.locator('#review-photos.review-photo-strip .review-strip-photo').first()).toBeAttached();
    });

    test('the row markup: labelled, three fixed 72px tiles, right order, no overflow, existing viewer', async ({ page }) => {
      await page.goto(P('floating-cat'));
      // reuse three real photos from the full strip as the picks
      const real = await page.locator('#review-photos .review-strip-photo').evaluateAll(els => els.slice(0, 3).map(e => ({ full: e.dataset.full, thumb: e.querySelector('img').src, rating: Number(e.dataset.rating), name: e.dataset.name, body: '' })));
      const html = customerPhotosHtml(real, real.length + 2, 'Customer photo of Floating Cat');
      await page.evaluate(h => { document.querySelectorAll('.customer-photos').forEach(e => e.remove()); document.querySelector('.thumbnails').insertAdjacentHTML('afterend', h); }, html);
      const box = page.locator('.customer-photos');
      await expect(box.locator('.customer-photos-label')).toHaveText('Photos from customers');
      const tiles = box.locator('.customer-photo');
      await expect(tiles).toHaveCount(real.length);
      for (let i = 0; i < real.length; i++) {
        const b = await tiles.nth(i).boundingBox();
        expect(Math.round(b.width)).toBe(72); expect(Math.round(b.height)).toBe(72);
        await expect(tiles.nth(i).locator('img')).toHaveAttribute('alt', 'Customer photo of Floating Cat');
      }
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('.main-image-wrap')).toBeLessThan(await y('.customer-photos'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(box.locator('.customer-photos-all')).toHaveAttribute('href', '#review-photos');
      await page.locator('.customer-photos').scrollIntoViewIfNeeded();
      await shot(page, `photos-row-markup-${vp.name}`);
    });
  });
}
