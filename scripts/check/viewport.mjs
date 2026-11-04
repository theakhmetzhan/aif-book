// A phone's window changes height with its address bar, and 100vh does not follow it. Desktop engines cannot move a bar, so this builds the same geometry:
// the viewport is the tall window (100vh), the body is the window with the bar showing, and it holds every fixed box, as it does on a phone, while innerHeight reports it.
// A sphere at the middle of the view, unlit so the room's darkness cannot hide it, projects as a true circle; each state is screenshotted as shown and that circle measured, in WebKit and Chromium, through bar and rotation.
// Needs: npx playwright-core install webkit. usage: URL=http://localhost:5185/aif-book/ node scripts/check/viewport.mjs [outDir]
import { webkit, chromium } from 'playwright-core';
import fs from 'fs';
const url = process.env.URL || 'http://localhost:5181/aif-book/', out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
// tall window, then the window with the bar: what iPhone Safari reports, more or less, upright and on its side
const TALL = { width: 390, height: 844 }, SIDE = { width: 844, height: 390 };
const STEPS = [
  { name: 'bar-showing', size: TALL, h: 664 },
  { name: 'bar-hidden', size: TALL, h: 844 },
  { name: 'bar-back', size: TALL, h: 664 },
  { name: 'bar-half', size: TALL, h: 751, quiet: true }, // mid-animation: no resize event has fired yet
  { name: 'rotated', size: SIDE, h: 340 },
  { name: 'rotated-bar-hidden', size: SIDE, h: 390 },
  { name: 'upright-again', size: TALL, h: 664 },
];
const shim = `<style>html{height:var(--bar-h)!important}body{position:absolute!important;top:0;left:0;width:100%;height:var(--bar-h)!important;transform:translate(0)}</style>
<script>window.__bar=h=>{document.documentElement.style.setProperty('--bar-h',h+'px');window.__h=h};__bar(${STEPS[0].h});Object.defineProperty(window,'innerHeight',{get:()=>window.__h});</script>`;
const fails = [];
for (const [name, type, opts] of [['WebKit', webkit, {}], ['Chromium', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }]]) {
  const b = await type.launch(opts), c = await b.newContext({ viewport: TALL, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(u => u.pathname === new URL(url).pathname, async r => { const res = await r.fetch(); await r.fulfill({ response: res, body: (await res.text()).replace('<head>', '<head>' + shim) }); });
  await p.goto(url + '?freeze=1&shot=1&dpr=1.5&t=2&p=0'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 180000 });
  await p.addStyleTag({ content: '#hud,#loader{display:none!important}' });
  await p.evaluate(async base => { // a sphere that nothing hides, held on the view's axis
    const u = (await (await fetch(base + 'src/controls.js')).text()).match(/from\s+"([^"]*three[^"]*)"/)[1], T = await import(u), B = __book;
    const s = window.__ball = new T.Mesh(new T.SphereGeometry(3, 96, 64), new T.ShaderMaterial({ vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }', depthTest: false })); s.renderOrder = 999; s.frustumCulled = false; B.scene.add(s);
    window.__hold = () => { const f = new T.Vector3(); B.cam.getWorldDirection(f); s.position.copy(B.cam.position).addScaledVector(f, 30); s.updateMatrixWorld(true); requestAnimationFrame(__hold); }; __hold();
  }, new URL(url).pathname);
  for (const s of STEPS) {
    await p.setViewportSize(s.size); await p.evaluate(s => { __bar(s.h); if (!s.quiet) dispatchEvent(new Event('resize')); }, s);
    await p.evaluate(() => new Promise(r => { let n = 0; const f = () => ++n > 6 ? r() : requestAnimationFrame(f); f(); }));
    const shot = await p.screenshot({ clip: { x: 0, y: 0, width: s.size.width, height: s.h } });
    await p.evaluate(h => { window.__cy = document.querySelector('#gl').getBoundingClientRect().height / 2 / h; }, s.h);
    if (out) fs.writeFileSync(`${out}/${name}-${s.name}.png`, shot);
    const m = await p.evaluate(async b64 => {
      const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d'); x.drawImage(bmp, 0, 0);
      const W = bmp.width, H = bmp.height, d = x.getImageData(0, 0, W, H).data, red = (i, j) => { const k = (j * W + i) * 4; return d[k] > 130 && d[k + 1] < 60 && d[k + 2] < 60; };
      const cy = window.__cy * H, cx = W >> 1, run = (i, j, a, b) => { let n = 0; while (i + a * (n + 1) >= 0 && i + a * (n + 1) < W && j + b * (n + 1) >= 0 && j + b * (n + 1) < H && red(i + a * (n + 1), j + b * (n + 1))) n++; return n; };
      const y = Math.round(cy), up = run(cx, y, 0, -1), dn = run(cx, y, 0, 1), lf = run(cx, y, -1, 0), rt = run(cx, y, 1, 0); // from the sphere's middle out to its edge, each way
      const g = document.querySelector('#gl'), r = g.getBoundingClientRect();
      return { w: lf + rt + 1, h: up + dn + 1, box: [r.width, r.height], buf: [g.width, g.height] };
    }, shot.toString('base64'));
    const round = m.h / m.w, shown = (m.box[0] / m.box[1]) / (m.buf[0] / m.buf[1]), cover = m.box[1] / s.h;
    console.log(`${name}\t${s.name.padEnd(20)}window ${s.size.width}x${s.h}, 100vh ${s.size.height}\tbox ${m.box.join('x')}\tbuffer ${m.buf.join('x')}\tcircle ${m.w}x${m.h} = ${round.toFixed(3)}`);
    if (Math.min(m.w, m.h) < 100) fails.push(`${name} ${s.name}: no circle to measure (${m.w}x${m.h})`);
    if (Math.abs(round - 1) > 0.02) fails.push(`${name} ${s.name}: circle ${round.toFixed(3)} tall`);
    if (Math.abs(shown - 1) > 0.01) fails.push(`${name} ${s.name}: buffer and box differ by ${shown.toFixed(3)}`);
    if (Math.abs(cover - 1) > 0.002) fails.push(`${name} ${s.name}: canvas ${m.box[1]} tall in a ${s.h} window`);
  }
  if (errs.length) fails.push(`${name}: ${errs[0]}`);
  await b.close();
}
console.log(fails.length ? 'FAIL: ' + fails.join('; ') : 'PASS'); process.exit(fails.length ? 1 : 0);
