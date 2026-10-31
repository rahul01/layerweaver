import { test, expect } from '@playwright/test';

// Age warning line (included products only) and the FAQ "Is it safe?" answer.
// Screenshots go to SHOTS when it is set.
const INCLUDED = '/shop/products/articulated-octopus/';
const EXCLUDED = '/shop/products/bunny-keychain/';
const LINE = 'Not for children under 5: small parts. Adult supervision recommended.';
const SHOTS = process.env.SAFETY_SHOTS;
const WIDTHS = [{ name: 'phone', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }];

for (const vp of WIDTHS) {
  test.describe(`safety copy ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('included product shows the line, readable and not overflowing', async ({ page }) => {
      await page.goto(INCLUDED);
      const note = page.locator('.age-warning');
      await expect(note).toHaveText(LINE);
      await expect(note).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      if (SHOTS) {
        await page.locator('.product-actions').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/product-${vp.name}.png` });
      }
    });

    test('excluded product has no line', async ({ page }) => {
      await page.goto(EXCLUDED);
      await expect(page.locator('.age-warning')).toHaveCount(0);
    });

    test('FAQ answers "Is it safe?" without claims', async ({ page }) => {
      await page.goto('/faq/');
      const item = page.locator('#safety');
      await expect(item.locator('summary')).toContainText('Is it safe?');
      await item.locator('summary').click();
      const answer = item.locator('.faq-answer');
      await expect(answer).toContainText('EN 71-3');
      await expect(answer).toContainText('Keep them away from children under 5.');
      await expect(answer).not.toContainText(/eco|plant|non-toxic|safe for/i);
      if (SHOTS) await item.screenshot({ path: `${SHOTS}/faq-${vp.name}.png` });
    });
  });
}
