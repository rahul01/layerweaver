// Run with: node export-ads.js
// Requires: npm install puppeteer

const puppeteer = require('puppeteer');
const path = require('path');

const ads = [
  'ad1-gamer-bro.html',
  'ad2-aesthetic-sister.html',
  'ad3-little-things.html',
  'ad4-kid-sibling.html',
];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

  for (const ad of ads) {
    const filePath = path.resolve(__dirname, ad);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });
    const outFile = ad.replace('.html', '.png');
    await page.screenshot({ path: path.resolve(__dirname, outFile), fullPage: false });
    console.log(`✓ Exported ${outFile}`);
  }

  await browser.close();
  console.log('\nAll 4 ads exported as 2160x2160 PNG (2x retina). Ready to upload to Meta.');
})();
