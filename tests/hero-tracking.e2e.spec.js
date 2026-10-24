import { test, expect } from '@playwright/test';

// Homepage hero taps go to GA4 as hero_click, with the hero part in
// link_text, so we can see whether people use the carousel before deciding
// what goes in the hero. Navigation is blocked so the page stays put.

async function heroClicks(page, selector) {
  await page.goto('/');
  await page.evaluate(() => {
    window._testEvents = [];
    window.gtag = (...args) => window._testEvents.push({ name: args[1], params: args[2] });
    document.addEventListener('click', e => e.preventDefault());
  });
  await page.locator(selector).first().click({ force: true });
  return page.evaluate(() => window._testEvents.filter(e => e.name === 'hero_click'));
}

test('carousel slide tap sends hero_click with the slide', async ({ page }) => {
  const events = await heroClicks(page, '.hero-carousel-slide.active');
  expect(events).toHaveLength(1);
  expect(events[0].params.link_text).toMatch(/^carousel: /);
  expect(events[0].params.link_url).toContain('/shop/collections/');
});

test('collection link and shop button are told apart', async ({ page }) => {
  const link = await heroClicks(page, '.hero-service-link');
  expect(link[0].params.link_text).toMatch(/^collection_link: /);
  const button = await heroClicks(page, '.hero-shop-btn');
  expect(button[0].params.link_text).toMatch(/^shop_button: /);
});

test('taps outside the hero send no hero_click', async ({ page }) => {
  const events = await heroClicks(page, 'footer a');
  expect(events).toHaveLength(0);
});
