import { test, expect } from '@playwright/test';
import { HOLIDAY, COPY } from '../holiday.js';

// Ship-date notice (holiday.js): every order placed from HOLIDAY.from ships on HOLIDAY.shipDate.
// The clock is faked to IST dates. Screenshots go to SHOTS when it is set.
const SHOTS = process.env.HOLIDAY_SHOTS;
const day = d => new Date(`${d}T12:00:00+05:30`);
const IN = '2026-11-05';
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const bar = page => page.locator('.announcement-bar');

for (const vp of [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }]) {
  test.describe(`holiday notice ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('bar: only the ship-date line, still, on static and shop pages, header below it, no overflow', async ({ page }) => {
      for (const path of ['/', '/faq/', '/shop/', '/shop/products/articulated-octopus/', '/shipping-policy/']) {
        await page.clock.setFixedTime(day(IN));
        await page.goto(path);
        await expect(bar(page)).toBeVisible();
        await expect(page.locator('.announcement-bar-track > a:not(.announcement-dup):not([hidden])')).toHaveText(COPY.bar);
        await expect(bar(page)).not.toHaveClass(/announcement-rotate/);
        await expect(page.locator('.announcement-dup:visible')).toHaveCount(0);
        const b = await bar(page).boundingBox();
        expect(b.height).toBe(vp.width < 901 ? 58 : 48);                         // tall enough to read as a notice
        const textBox = await page.locator('.announcement-bar-track > a:not(.announcement-dup)').boundingBox();
        expect(textBox.height).toBeLessThanOrEqual(b.height - 8);                // one or two lines, inside the bar
        expect(textBox.x).toBeGreaterThanOrEqual(0);
        expect(textBox.x + textBox.width).toBeLessThanOrEqual(vp.width + 1);     // nothing cut off at the right
        const look = await page.locator('.announcement-bar-track > a:not(.announcement-dup)').evaluate(a => { const c = getComputedStyle(a); return { size: parseFloat(c.fontSize), weight: Number(c.fontWeight), color: c.color, anim: getComputedStyle(a.parentElement).animationName }; });
        expect(look.size).toBeGreaterThanOrEqual(vp.width < 901 ? 16 : 15);
        expect(look.weight).toBeGreaterThanOrEqual(700);
        expect(look.color).toBe('rgb(26, 16, 48)');                              // near-black on brand yellow
        expect(look.anim).toBe('none');                                          // no marquee
        expect(await bar(page).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(239, 207, 32)');
        await expect(page.locator('.announcement-bar-track > a:not(.announcement-dup) i.fa-calendar-days')).toBeVisible();
        const header = await page.locator('header').first().boundingBox();
        expect(header.y).toBe(b.height);                                         // the header starts right under the bar
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await page.goto('/');
      await shot(page, `home-${vp.name}`);
    });

    test('bar dates: hidden before, shown from the start day through the ship day, hidden after', async ({ page }) => {
      for (const [d, shown] of [['2026-11-02', false], [HOLIDAY.from, true], [HOLIDAY.shipDate, true], ['2026-11-13', false]]) {
        await page.clock.setFixedTime(day(d));
        await page.goto('/faq/');
        if (shown) await expect(bar(page)).toBeVisible(); else await expect(bar(page)).toBeHidden();
      }
    });

    test('no Diwali wording in the bar', async ({ page }) => {
      await page.clock.setFixedTime(day(IN));
      await page.goto('/shop/');
      await expect(bar(page)).not.toContainText(/diwali|order by|e-gift|🪔/i);
      await expect(bar(page).locator('a')).toHaveCount(2);   // the notice and its marquee copy; no other message
    });

    test('product page: ship note under the buttons, pincode line says when it ships, sticky bar says Ships 12 Nov', async ({ page }) => {
      await page.clock.setFixedTime(day(IN));
      await page.goto('/shop/products/articulated-octopus/');
      await expect(page.locator('.holiday-note')).toHaveText(COPY.note);
      const y = async s => (await page.locator(s).first().boundingBox()).y;
      expect(await y('#add-to-cart-btn')).toBeLessThan(await y('.holiday-note'));
      expect(await y('.holiday-note')).toBeLessThan(await y('[data-orderby]'));
      for (const [pin, line] of [['411001', 'Ships on 12 Nov. Then usually arrives in 2-4 days.'], ['400001', 'Ships on 12 Nov. Then usually arrives in 3-5 days.'], ['422001', 'Ships on 12 Nov. Then usually arrives in 3-5 days.'], ['560001', 'Ships on 12 Nov. Then usually arrives in 4-6 days.'], ['781001', 'Ships on 12 Nov. Then usually arrives in 5-8 days.']]) {
        await page.locator('[data-orderby] input').first().fill(pin);
        await page.locator('[data-orderby] button').first().click();
        await expect(page.locator('[data-orderby] .orderby-result').first()).toHaveText(line);
      }
      const copy = (await page.locator('.holiday-note, [data-orderby], .promise-icons').allInnerTexts()).join(' ');
      expect(copy).not.toMatch(/far states|Diwali|PLA\b|plastic|eco-friendly|non-toxic|—/i);
      await page.locator('.holiday-note').scrollIntoViewIfNeeded();
      await shot(page, `product-${vp.name}`);
      if (vp.width < 769) {
        await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(400);
        await expect(page.locator('#sticky-add-bar')).toBeVisible();
        await expect(page.locator('.sticky-add-ship')).toHaveText('Ships 12 Nov');
        const header = await page.locator('.shop-header').boundingBox();
        const stick = await page.locator('#sticky-add-bar').boundingBox();
        expect(stick.y).toBeGreaterThan(header.y + header.height);              // the two never overlap
        await shot(page, `product-sticky-${vp.name}`);
      }
    });

    test('after the ship date the product note and the old pincode wording return', async ({ page }) => {
      await page.clock.setFixedTime(day('2026-11-13'));
      await page.goto('/shop/products/articulated-octopus/');
      await expect(page.locator('.holiday-note')).toBeHidden();
      await page.locator('[data-orderby] input').first().fill('560001');
      await page.locator('[data-orderby] button').first().click();
      await expect(page.locator('[data-orderby] .orderby-result').first()).toHaveText('Usually arrives in 5-7 days.');
    });

    test('gift card page: no ship note (it is emailed)', async ({ page }) => {
      await page.clock.setFixedTime(day(IN));
      await page.goto('/shop/products/layerweaver-e-gift-card/');
      await expect(page.locator('.holiday-note')).toHaveCount(0);
    });

    test('cart: ship note with items that ship, none for an empty cart', async ({ page }) => {
      await page.clock.setFixedTime(day(IN));
      await page.goto('/shop/products/articulated-octopus/');
      await page.evaluate(() => { for (const k of ['lw_cart_id', 'lw_cart_qty']) localStorage.removeItem(k); });
      await page.reload();
      await page.waitForFunction(() => document.getElementById('cart-icon-btn'), { timeout: 10_000 });
      await page.click('#cart-icon-btn');
      await page.waitForSelector('#cart-drawer.open');
      await expect(page.locator('#cart-holiday-note')).toHaveCount(0);
      await page.click('#cart-close');
      await page.click('#add-to-cart-btn');
      await page.waitForFunction(() => { const b = document.getElementById('cart-badge'); return b && getComputedStyle(b).display !== 'none'; }, { timeout: 10_000 });
      await page.click('#cart-icon-btn');
      await page.waitForSelector('#cart-drawer.open');
      await page.waitForTimeout(700);
      await expect(page.locator('#cart-holiday-note')).toHaveCount(0);
      await expect(page.locator('#cart-total-label')).toHaveText('Total with delivery');
      await shot(page, `cart-${vp.name}`);
    });

    test('shipping policy and FAQ carry the ship-date box', async ({ page }) => {
      for (const path of ['/shipping-policy/', '/faq/']) {
        await page.goto(path);
        await expect(page.locator('.holiday-policy-note')).toContainText('Every order placed from 3 Nov ships on 12 Nov');
      }
    });
  });
}
