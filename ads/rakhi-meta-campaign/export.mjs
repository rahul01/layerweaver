// Screenshots all 3 ratios for each of the 4 Meta persona ad creatives.
// Requires the local dev server running: npm run serve
// Run: node ads/rakhi-meta-campaign/export.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADS } from './ads-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FORMATS = [
  { selector: '.ad-1x1', name: '1x1' },
  { selector: '.ad-4x5', name: '4x5' },
  { selector: '.ad-9x16', name: '9x16' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });

for (const ad of ADS) {
  await page.goto(`http://localhost:8080/ads/rakhi-meta-campaign/${ad.id}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const outDir = path.join(__dirname, ad.id);
  for (const fmt of FORMATS) {
    const el = await page.$(fmt.selector);
    if (!el) { console.log(`SKIP: ${ad.id} ${fmt.selector} not found`); continue; }
    const filePath = path.join(outDir, `${ad.id}-${fmt.name}.png`);
    await el.screenshot({ path: filePath });
    console.log(`Saved ${ad.id}-${fmt.name}.png`);
  }
}

await browser.close();
