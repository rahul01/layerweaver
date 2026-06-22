import { chromium } from 'playwright';

const ads = [
  { selector: '.ad-post', name: 'instagram-post' },
  { selector: '.ad-story', name: 'instagram-story' },
  { selector: '.ad-reel', name: 'instagram-reel' },
  { selector: '.ad-whatsapp', name: 'whatsapp-status' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
await page.goto('http://localhost:8080/ads/6-months-gift/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const outDir = new URL('.', import.meta.url).pathname;

for (const ad of ads) {
  const el = await page.$(ad.selector);
  if (!el) { console.log(`SKIP: ${ad.selector} not found`); continue; }
  await el.screenshot({ path: `${outDir}${ad.name}.png` });
  console.log(`Saved ${ad.name}.png`);
}

await browser.close();
