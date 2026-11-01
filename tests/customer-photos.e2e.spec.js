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
    });

    test('the lower "all photos" strip is gone on every page', async ({ page }) => {
      for (const h of ['ghost-balloon-lamp', 'bunny-keychain', 'floating-cat']) {
        await page.goto(P(h));
        await expect(page.locator('#review-photos')).toHaveCount(0);
        await expect(page.locator('.review-photo-strip')).toHaveCount(0);
        await expect(page.locator('.customer-photos-all')).toHaveCount(0);
        await expect(page.locator('.review-card').first()).toBeAttached();      // review cards below are untouched
      }
    });

    test('ghost-balloon-lamp shows its 3 picked photos in file order; bunny-keychain and floating-cat show none', async ({ page }) => {
      const idOf = u => u.split('?')[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/__[a-z]+$/i, '');
      await page.goto(P('ghost-balloon-lamp'));
      const ids = (await page.locator('.customer-photos .customer-photo').evaluateAll(els => els.map(e => e.dataset.full))).map(idOf);
      expect(ids).toEqual(picks['ghost-balloon-lamp']);
      await page.locator('.customer-photos').scrollIntoViewIfNeeded();
      await shot(page, `photos-ghost-balloon-lamp-${vp.name}`);
      for (const h of ['bunny-keychain', 'floating-cat']) {
        await page.goto(P(h));
        await expect(page.locator('.customer-photos')).toHaveCount(0);
        if (h === 'bunny-keychain') await shot(page, `photos-bunny-keychain-${vp.name}`);
      }
    });

    test('the row markup: labelled, three fixed 72px tiles, right order, no overflow, existing viewer', async ({ page }) => {
      await page.goto(P('ghost-balloon-lamp'));
      // reuse the three real photos of a picked product's row, re-rendered by the build's own markup
      const real = await page.locator('.customer-photos .customer-photo').evaluateAll(els => els.map(e => ({ full: e.dataset.full, thumb: e.querySelector('img').src, rating: Number(e.dataset.rating), name: e.dataset.name, body: '' })));
      const html = customerPhotosHtml(real, 'Customer photo of Ghost Balloon Lamp');
      await page.evaluate(h => { document.querySelectorAll('.customer-photos').forEach(e => e.remove()); document.querySelector('.thumbnails').insertAdjacentHTML('afterend', h); }, html);
      const box = page.locator('.customer-photos');
      await expect(box.locator('.customer-photos-label')).toHaveText('Photos from customers');
      const tiles = box.locator('.customer-photo');
      await expect(tiles).toHaveCount(real.length);
      for (let i = 0; i < real.length; i++) {
        const b = await tiles.nth(i).boundingBox();
        expect(Math.round(b.width)).toBe(72); expect(Math.round(b.height)).toBe(72);
        await expect(tiles.nth(i).locator('img')).toHaveAttribute('alt', 'Customer photo of Ghost Balloon Lamp');
      }
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('.main-image-wrap')).toBeLessThan(await y('.customer-photos'));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(box.locator('a')).toHaveCount(0);
      await page.locator('.customer-photos').scrollIntoViewIfNeeded();
      await shot(page, `photos-row-markup-${vp.name}`);
    });

    test('tapping a row photo opens the photo viewer', async ({ page }) => {
      await page.goto(P('ghost-balloon-lamp'));
      await page.locator('.customer-photos .customer-photo').first().click();
      await expect(page.locator('#review-lightbox.review-lightbox--open')).toBeVisible();
      await expect(page.locator('#review-lightbox-img')).toHaveAttribute('src', /https?:\/\//);
      await expect(page.locator('.review-lightbox')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('#review-lightbox.review-lightbox--open')).toHaveCount(0);
    });
  });
}
