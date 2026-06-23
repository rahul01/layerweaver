import { chromium } from 'playwright';

const browser = await chromium.launch();
const outDir = new URL('.', import.meta.url).pathname;

// Flyer
const flyerPage = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await flyerPage.goto('http://localhost:8080/workshops/july-kids/kids-weekend-course-july-flyer.html', { waitUntil: 'networkidle' });
await flyerPage.waitForTimeout(1500);
const poster = await flyerPage.$('.poster');
if (poster) {
  await poster.screenshot({ path: `${outDir}kids-weekend-course-july-flyer.png` });
  console.log('Saved kids-weekend-course-july-flyer.png');
}

// WhatsApp
const waPage = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });
await waPage.goto('http://localhost:8080/workshops/july-kids/kids-weekend-course-july-whatsapp.html', { waitUntil: 'networkidle' });
await waPage.waitForTimeout(1500);
const card = await waPage.$('.card');
if (card) {
  await card.screenshot({ path: `${outDir}kids-weekend-course-july-whatsapp.png` });
  console.log('Saved kids-weekend-course-july-whatsapp.png');
}

await browser.close();
