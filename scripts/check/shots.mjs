// The frames a person must look at before this book is called done: every rest state and every turn in eighths, from desk level and from above,
// plus each owner complaint as a permanent shot. Each frame is native 1920x1080, with a true 3x render of the spine and gutter beside it.
// usage: URL=http://localhost:5185/aif-book/ node scripts/check/shots.mjs <outDir> [views=a,b] [states=0,1,7.5]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [out, viewArg, stateArg] = process.argv.slice(2);
const near = p => p < 4 ? -1 : 1; // the side the spine faces while the book is shut, and the thicker stack's far side
const VIEWS = {
  spine: p => [near(p) * 18, 1.4, 22, near(p) * 3, 1, 4], // desk level, off the spine's end
  head: () => [0, 1.4, -26, 0, 1, 0],
  tail: () => [0, 1.4, 26, 0, 1, 0],
  fore: p => [-near(p) * 34, 2.2, 6, 0, 1, 0],
  top: () => [0, 42, 0.01, 0, 0, 0],
  // the owner's own cameras, solved from their screenshots and recording of the last spread
  'owner-top': () => [-1.584, 56.06, 5.025, -2.082, -1.124, 1.352], // "wide dark strip between the left page and the back board"
  'owner-low': () => [-0.012, 5.897, 35.323, 1.532, 2.69, -10.854], // "the back board is a ramp hanging in the air"; block's end "a few thick dark and pale bands"
  'owner-rec': () => [0.15, 2.36, 19, 0.15, 0.96, -1], // "gap between pages and spine, and the glitching gap between the spine and the book's bottom cover"
  'owner-rec-under': () => [0.15, 1.0, 19, 0.15, 0.2, -1], // the same recording, at its lowest
};
// every owner complaint stays a shot: the item, the owner's words, where to look
const COMPLAINTS = [
  ['1.1', 'build the book a proper real life like physically realistic spine', 'spine, tail, owner-rec at 0 to 1'],
  ['1.2', 'fix this shadow gap issue when you close the book at the last page', 'owner-low, owner-top at 6 to 7'],
  ['1.3', 'fix the pages changing in their thickness when you flip through them', 'fore, tail through every turn'],
  ['1.4', 'some have a twitch/glitch issue where they open close open in a split second', 'owner-low at 3 to 4'],
  ['1.5', 'there are some raindrops shadows that just disappear', 'rain: the window light on the wall, live, one frame a second'],
  ['CP1', 'gap between pages and spine, and the glitching gap between the spine and the book\'s bottom cover', 'owner-rec, owner-rec-under at every state'],
  ['CP1', 'wide dark strip between the left page and the back board', 'owner-top at 1 and 7'],
  ['CP1', 'the back board is a ramp hanging in the air', 'owner-low at every state'],
  ['CP1', 'a few thick dark and pale bands, not a block of paper', 'owner-low, tail at every state'],
];
const views = viewArg && viewArg !== 'all' ? viewArg.split(',') : Object.keys(VIEWS);
const states = stateArg ? stateArg.split(',').map(Number) : Array.from({ length: 65 }, (_, i) => i / 8), rests = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const url = process.env.URL || 'http://localhost:5181/aif-book/', W = 1920, H = 1080, K = 3;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 600000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); await pg.setViewport({ width: W, height: H });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => ['error', 'warn', 'warning'].includes(m.type()) && errs.push(m.text().slice(0, 200)));
await pg.goto(url + '?freeze=1&shot=1&dpr=1&t=2&p=0', { waitUntil: 'networkidle0' }); await pg.waitForFunction(() => document.body.classList.contains('ready'), { timeout: 120000 });
await pg.addStyleTag({ content: '.hint{display:none!important}' });
const frame = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const look = (p, c, zoom, exp) => pg.evaluate((p, c, zoom, exp, W, H, K) => {
  const B = __book, cam = B.cam, V = cam.position.constructor; B.set(p); B.book.set(p, 2); B.book.group.position.x = -B.book.centerX(p); B.book.group.updateMatrixWorld(true);
  B.rig.L.box.min.set(-1e3, -1e3, -1e3); B.rig.L.box.max.set(1e3, 1e3, 1e3); B.rig.L.rMin = 1; B.rig.L.thetaMin = -7; B.rig.L.thetaMax = 7; B.rig.L.phiMax = 3; B.rig.L.phiMin = 0.001;
  B.rig.lookFrom(new V(c[0], c[1], c[2]), new V(c[3], c[4], c[5])); B.rig.update(1); cam.clearViewOffset(); cam.updateMatrixWorld(true);
  if (zoom) { // the crop: the spine's middle, at the end of the book nearest this camera
    const P = B.book.spine.geometry.attributes.position, m = B.book.spineSeg, z = Math.abs(c[2]) > Math.abs(c[0]) && Math.abs(c[2]) > Math.abs(c[1]) ? Math.sign(c[2]) * 10.3 : 0;
    const q = new V(P.getX(m), P.getY(m) + 0.8, z).applyMatrix4(B.book.group.matrixWorld).project(cam), w = W / K, h = H / K;
    cam.setViewOffset(W, H, Math.min(W - w, Math.max(0, (q.x + 1) / 2 * W - w / 2)), Math.min(H - h, Math.max(0, (1 - q.y) / 2 * H - h / 2)), w, h);
  }
  B.renderer.toneMappingExposure = exp; B.room.freeze = true; B.renderer.shadowMap.needsUpdate = true;
}, p, c, zoom, exp, W, H, K);
for (const v of views) {
  fs.mkdirSync(`${out}/${v}`, { recursive: true });
  for (const p of v === 'owner-rec-under' && !stateArg ? rests : states) {
    const n = `${out}/${v}/p${p.toFixed(3).padStart(5, '0')}`, c = VIEWS[v](p);
    await look(p, c, false, +(process.env.EXP || 1)); await frame(); await pg.screenshot({ path: `${n}.png` });
    await look(p, c, true, +(process.env.EXP_CROP || 2)); await frame(); await pg.screenshot({ path: `${n}_crop.png` });
  }
  await pg.evaluate(() => __book.cam.clearViewOffset());
}
fs.writeFileSync(`${out}/COMPLAINTS.json`, JSON.stringify(COMPLAINTS, null, 1));
console.log(JSON.stringify({ views, errors: errs })); await b.close(); process.exit(errs.length ? 1 : 0);
