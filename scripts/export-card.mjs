// Export the Book Presentation Card to PNG: 1920×1080 and 3840×2160 (@2x), read straight from the canvas.
// Uses the running dev server (default http://localhost:5181/aif-ushqyn/card.html, override with CARD_URL);
// starts a temporary Vite server if none answers.  Usage: node scripts/export-card.mjs [outDir]
import puppeteer from 'puppeteer-core';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || '/Users/akhmetzhanturlybek/HQ/Fronts/academics/courses/aif-1303/assessments');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let url = process.env.CARD_URL || 'http://localhost:5181/aif-ushqyn/card.html';

let server = null;
try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); }
catch {
  const { createServer } = await import('vite');
  server = await createServer({ root, server: { port: 0 }, logLevel: 'error' }); await server.listen();
  url = server.resolvedUrls.local[0].replace(/\/$/, '') + '/card.html'; // base already in resolvedUrls
  console.log('started vite at', url);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
try {
  await mkdir(OUT, { recursive: true });
  for (const [scale, name, W, H] of [[1, 'aif-endterm-card.png', 1920, 1080], [2, 'aif-endterm-card@2x.png', 3840, 2160]]) {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'warn' || m.type() === 'error') console.log(`[page ${m.type()}]`, m.text()); });
    page.on('pageerror', e => console.log('[page error]', e.message));
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`${url}?scale=${scale}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
    const { w, h, data, info } = await page.evaluate(() => { const c = document.querySelector('#card'); return { w: c.width, h: c.height, data: c.toDataURL('image/png'), info: window.cardInfo }; });
    if (w !== W || h !== H) throw new Error(`${name}: canvas is ${w}×${h}, expected ${W}×${H}`);
    const file = path.join(OUT, name);
    await writeFile(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${file}  ${w}×${h}`, JSON.stringify(info));
    await page.close();
  }
} finally { await browser.close(); if (server) await server.close(); }
