import { chromium } from 'playwright';

const outDir = new URL('.', import.meta.url).pathname;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: {
    dir: outDir,
    size: { width: 1080, height: 1920 },
  },
});

const page = await context.newPage();
await page.goto('http://localhost:8080/ads/6-months-gift/reel-video.html', { waitUntil: 'networkidle' });

// Wait for full animation to play + hold at the end
await page.waitForTimeout(7000);

await context.close();
await browser.close();

// Rename the auto-generated video file
import { readdirSync, renameSync } from 'fs';
const files = readdirSync(outDir).filter(f => f.endsWith('.webm'));
if (files.length > 0) {
  const src = `${outDir}${files[files.length - 1]}`;
  const dest = `${outDir}reel-video.webm`;
  renameSync(src, dest);
  console.log(`Saved reel-video.webm`);
  console.log(`\nTo convert to MP4, run:`);
  console.log(`ffmpeg -i "${dest}" -c:v libx264 -pix_fmt yuv420p -crf 18 "${outDir}reel-video.mp4"`);
}
