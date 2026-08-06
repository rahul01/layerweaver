// Screenshots all 4 ad formats for each of the 8 Rakhi collections.
// Requires the local dev server running: npm run serve
// Run: node ads/rakhi/export.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAKHI_COLLECTIONS } from './collections-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FORMATS = [
  { selector: '.ad-square', name: 'square-1080x1080' },
  { selector: '.ad-story', name: 'story-1080x1920' },
  { selector: '.ad-landscape', name: 'landscape-1200x628' },
  { selector: '.ad-whatsapp', name: 'whatsapp-800x800' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });

for (const c of RAKHI_COLLECTIONS) {
  await page.goto(`http://localhost:8080/ads/rakhi/${c.handle}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const outDir = path.join(__dirname, c.handle);
  for (const fmt of FORMATS) {
    const el = await page.$(fmt.selector);
    if (!el) { console.log(`SKIP: ${c.handle} ${fmt.selector} not found`); continue; }
    const filePath = path.join(outDir, `${c.handle}-${fmt.name}.png`);
    await el.screenshot({ path: filePath });
    console.log(`Saved ${c.handle}-${fmt.name}.png`);
  }
}

await browser.close();
