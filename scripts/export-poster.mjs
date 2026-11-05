// Export the picture #loader holds until the room is ready: the first frame of the Room view, read straight from the canvas. Run it again when the first frame changes.
// Room fits a box 79 wide and 67 high, so from 79:67 up the camera's distance is fixed and the picture scales with the height: wide is cut far wider than a screen, and is only ever cropped at the sides.
// tall shows below 17:20. Its shape is where that distance reaches the rig's limit of 500: narrower still the picture scales with the height, wider with the width, which is just what object-fit: cover does.
// Between 17:20 and 79:67 wide scales with the width. The camera stands nearer there than for either picture, so the desk lands up to 4% off the board.
// Usage: node scripts/export-poster.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const server = await createServer({ root, server: { port: 0 }, logLevel: 'error' }); await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  // the height of wide keeps it a desktop to the page; tall is narrow enough to be a phone
  for (const [name, w, h, kb] of [['wide', 1536, 640, 40], ['tall', 514, 1000, 40]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${url}?shot=1&freeze=1&t=0&dpr=2`);
    await page.waitForFunction(() => window.__book && document.body.classList.contains('ready'), null, { timeout: 120000 });
    const webp = await page.evaluate(async ([w, h, kb]) => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(document.querySelector('#gl'), 0, 0, w, h);
      for (let q = 0.9; ; q -= 0.02) { const d = c.toDataURL('image/webp', q).split(',')[1]; if (d.length * 0.75 <= kb * 1024 || q < 0.1) return d; }
    }, [w, h, kb]);
    const file = path.join(root, `src/poster-${name}.webp`), bytes = Buffer.from(webp, 'base64');
    await writeFile(file, bytes); console.log(`${file}  ${w}×${h}  ${(bytes.length / 1024).toFixed(1)} KB`);
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
