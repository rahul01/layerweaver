// Screenshots all 4 Rakhi ad creatives at all 3 Meta aspect ratios (12 PNGs total).
// Requires the local dev server running: npm run serve
// Run: node ads/rakhi-meta-campaign/export.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADS = [
  { dir: 'ad1-gamer-bro', slug: 'ad1-gamer-bro' },
  { dir: 'ad2-aesthetic-sister', slug: 'ad2-aesthetic-sister' },
  { dir: 'ad3-little-things', slug: 'ad3-little-things' },
  { dir: 'ad4-kid-sibling', slug: 'ad4-kid-sibling' },
];

const RATIOS = [
  { param: '1x1', width: 1080, height: 1080 },
  { param: '4x5', width: 1080, height: 1350 },
  { param: '9x16', width: 1080, height: 1920 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const ad of ADS) {
  const outDir = path.join(__dirname, ad.dir);
  for (const r of RATIOS) {
    await page.setViewportSize({ width: r.width, height: r.height });
    await page.goto(`http://localhost:8080/ads/rakhi-meta-campaign/${ad.dir}/?ratio=${r.param}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const filePath = path.join(outDir, `${ad.slug}-${r.param}.png`);
    await page.screenshot({ path: filePath, clip: { x: 0, y: 0, width: r.width, height: r.height } });
    console.log(`Saved ${ad.slug}-${r.param}.png`);
  }
}

await browser.close();
console.log('\nAll 12 ads exported (2x retina). Ready to upload to Meta.');
