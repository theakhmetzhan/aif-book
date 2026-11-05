// Every view and the words that choose them, in WebKit and Chromium, on a desktop window and a phone. Each rule is also run against a camera that breaks it, so a pass means something.
// Room comes first; Watch shows no page surface and keeps every pop-up in frame; Top holds every pop-up within a few pixels of its foot; Board is square on and whole; the labels are bare, real buttons a thumb can hit, at every width.
// A swipe in a phone's Read slides to the other page and eases there, a tap turns the page, and a drag anywhere else still orbits. Chromium gets real touches; WebKit has no way to send them, so it gets the same strokes as pointer events.
// Needs: npx playwright-core install webkit. usage: URL=http://localhost:5185/aif-book/ node scripts/check/views.mjs
import { webkit, chromium } from 'playwright-core';
const url = process.env.URL || 'http://localhost:5181/aif-book/', base = new URL(url).pathname;
const FLAT = 6, fails = [], need = (ok, msg) => { if (!ok) fails.push(msg); return ok; };
const BUTTONS = ['Read', 'Watch', 'Top', 'Desk', 'Room', 'Board'], VIEW = { Read: 'book', Watch: 'watch', Top: 'top', Desk: 'desk', Room: 'room', Board: 'board' };
const KEYS = { r: 'book', w: 'watch', t: 'top', h: 'desk', o: 'room', b: 'board', Escape: 'room' };
const ready = p => p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 180000 });
const settle = async p => { await p.waitForFunction(() => { const r = __book.rig; return r.t.distanceTo(r.tg) < 0.02 && Math.abs(r.s.r / r.g.r - 1) < 1e-3 && Math.abs(r.s.ph - r.g.ph) < 1e-3; }, null, { timeout: 60000 }); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };

// measures in the page: what is seen from the camera the view has set
const measure = async base => {
  const u = (await (await fetch(base + 'src/controls.js')).text()).match(/from\s+"([^"]*three[^"]*)"/)[1], T = await import(u), B = __book, cam = B.cam, bk = B.book;
  const tick = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const flip = async (k, v) => { B.set(k); B.goView(v, true); await tick(); await tick(); cam.updateMatrixWorld(true); }; // the app's own loop places the book and the camera: nothing here may put right what it got wrong
  const points = only => { const out = [], v = new T.Vector3(); bk.group.traverseVisible(o => { if (!o.isMesh || !o.geometry.attributes.position) return; let pop = false; for (let q = o; q && q !== bk.group; q = q.parent) if (q.userData.faceRoot) pop = true; if (only && !pop) return; const P = o.geometry.attributes.position; o.updateWorldMatrix(true, false); for (let i = 0; i < P.count; i += Math.max(1, P.count >> 7)) out.push(v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).clone()); }); return out; };
  const pops = () => points(true);
  const pageY = x => { const r = new T.Raycaster(new T.Vector3(x, 30, 9.4), new T.Vector3(0, -1, 0)); return r.intersectObject(bk.group, true)[0]?.point.y; }; // past every pop-up's foot
  const px = (a, W, H) => { const q = a.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
  const frame = () => { const c = cam.position, seen = pops().map(a => a.clone().project(cam)); return { eye: c.y, left: pageY(-7), right: pageY(7), popsOut: seen.filter(q => Math.abs(q.x) > 1 || Math.abs(q.y) > 1).length, pops: seen.length }; };
  const fan = (W, H) => { const foot = { L: pageY(-7), R: pageY(7) }; let worst = 0; for (const a of pops()) { const p = px(a, W, H), f = px(new T.Vector3(a.x, a.x < 0 ? foot.L : foot.R, a.z), W, H); worst = Math.max(worst, Math.hypot(p[0] - f[0], p[1] - f[1])); } return worst; };
  const box = (W, H) => { const x = points().map(a => a.x), l = px(new T.Vector3(Math.min(...x), 1, 0), W, H)[0], r = px(new T.Vector3(Math.max(...x), 1, 0), W, H)[0]; return (l + r) / 2 - W / 2; };
  const crease = (W, H) => px(new T.Vector3(bk.group.position.x + bk.centerX(), 1, 0), W, H)[0] - W / 2; // mid-turn the block's outline swings with the leaf: this is what stays put
  const board = () => { const { z, xs, ys } = B.boardBox, c = [[xs[0], ys[1]], [xs[1], ys[1]], [xs[0], ys[0]], [xs[1], ys[0]]].map(([x, y]) => new T.Vector3(x, y, z).project(cam)); return { c: c.map(q => [q.x, q.y]) }; };
  window.__m = { flip, frame, fan, box, crease, board };
};

for (const [name, type, opts] of [['WebKit', webkit, {}], ['Chromium', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }]]) {
  const b = await type.launch(opts);
  for (const [dev, size, phone] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const tag = `${name} ${dev}`, c = await b.newContext({ viewport: size, deviceScaleFactor: phone ? 3 : 1, isMobile: phone, hasTouch: phone }), p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url + '?dpr=1&t=2&shot=1'); await ready(p);
    // first view
    const first = await p.evaluate(() => ({ view: __book.view, pressed: [...document.querySelectorAll('.views button[aria-pressed=true]')].map(b => b.textContent), hint: document.querySelector('.hint').textContent }));
    need(first.view === 'room' && first.pressed.join() === 'Room', `${tag}: opens on ${first.view}, pressed ${first.pressed}`);
    need(!/desk/i.test(first.hint), `${tag}: hint assumes the desk: ${first.hint}`);
    // the buttons, then the keys
    for (const t of BUTTONS) {
      const el = p.getByRole('button', { name: t, exact: true }); phone ? await el.tap() : await el.click();
      const s = await p.evaluate(() => ({ view: __book.view, pressed: [...document.querySelectorAll('.views button[aria-pressed=true]')].map(b => b.textContent).join() }));
      need(s.view === VIEW[t] && s.pressed === t, `${tag}: ${t} gave ${s.view}, pressed ${s.pressed}`);
    }
    if (!phone) for (const [k, v] of Object.entries(KEYS)) { await p.keyboard.press(k); const s = await p.evaluate(() => __book.view); need(s === v, `${tag}: ${k} gave ${s}, not ${v}`); }
    // the words themselves
    const hud = await p.evaluate(() => { document.activeElement.blur(); return [...document.querySelectorAll('#hud button')].map(b => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return { t: b.textContent, tag: b.tagName, border: parseFloat(s.borderTopWidth), bg: s.backgroundColor, shadow: s.boxShadow, blur: s.backdropFilter || s.webkitBackdropFilter || 'none', font: s.fontFamily, tab: b.tabIndex, w: r.width, h: r.height }; }); });
    for (const h of hud) need(h.tag === 'BUTTON' && h.tab === 0 && !h.border && /rgba\(0, 0, 0, 0\)|transparent/.test(h.bg) && h.shadow === 'none' && h.blur === 'none' && /Caveat/.test(h.font), `${tag}: ${h.t} is not bare: ${JSON.stringify(h)}`);
    for (const h of hud) need(h.w >= 44 && h.h >= 44, `${tag}: ${h.t} is ${h.w}x${h.h}`);
    need(await p.evaluate(() => document.fonts.check('25px Caveat', 'Read')), `${tag}: Caveat not loaded`);
    await p.waitForTimeout(300); // the colour eases
    const on = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.views button[aria-pressed=true]')), b = getComputedStyle(document.querySelector('.views button[aria-pressed=false]')); return { line: a.textDecorationLine, off: b.textDecorationLine, same: a.color === b.color }; });
    need(on.line === 'underline' && on.off === 'none' && !on.same, `${tag}: the active view does not stand out: ${JSON.stringify(on)}`);
    if (!phone) { const tab = name === 'WebKit' ? 'Alt+Tab' : 'Tab'; await p.mouse.click(5, 5); await p.keyboard.press(tab); await p.keyboard.press(tab); const f = await p.evaluate(() => { const a = document.activeElement, s = getComputedStyle(a); return { t: a.tagName, o: s.outlineStyle, w: parseFloat(s.outlineWidth) }; }); need(f.t === 'BUTTON' && f.o === 'solid' && f.w >= 2, `${tag}: focus shows ${JSON.stringify(f)}`); }

    // what each view sees
    await p.evaluate(measure, base);
    const W = size.width, H = size.height, N = await p.evaluate(() => __book.book.sheets.length); // the last state: every sweep runs to the back of whatever book this is
    for (let k = 1; k < N; k++) {
      const f = await p.evaluate(async k => { await __m.flip(k, 'watch'); return __m.frame(); }, k);
      need(f.eye <= Math.min(f.left, f.right) + 0.03, `${tag}: Watch at ${k}: eye ${f.eye.toFixed(3)} above page ${Math.min(f.left, f.right).toFixed(3)}`);
      need(!f.popsOut, `${tag}: Watch at ${k}: ${f.popsOut} of ${f.pops} pop-up points out of frame`);
    }
    const wrong = await p.evaluate(async () => { await __m.flip(3, 'watch'); const r = __book.rig; r.g.ph = r.s.ph = 1.45; r.apply(); __book.cam.updateMatrixWorld(true); return __m.frame(); });
    need(wrong.eye > Math.min(wrong.left, wrong.right) + 0.03, `${tag}: control: Watch check passes a raised eye`);
    let worst = 0; for (let k = 1; k < N; k++) worst = Math.max(worst, await p.evaluate(async ([k, W, H]) => { await __m.flip(k, 'top'); return __m.fan(W, H); }, [k, W, H]));
    need(worst <= FLAT, `${tag}: Top: a pop-up stands ${worst.toFixed(1)} px off its foot`);
    const close = await p.evaluate(async ([W, H]) => { await __m.flip(3, 'top'); const r = __book.rig; r.s.r = 42; r.s.k = 0.344; r.apply(); __book.cam.updateMatrixWorld(true); __book.cam.updateProjectionMatrix(); return __m.fan(W, H); }, [W, H]);
    need(close > FLAT, `${tag}: control: Top check passes a close camera (${close.toFixed(1)} px)`);
    for (const v of ['watch', 'top']) for (let k = 0; k <= N; k++) { const off = await p.evaluate(async ([v, k, W, H]) => { await __m.flip(k, v); return __m.box(W, H); }, [v, k, W, H]); need(Math.abs(off) < W * 0.01, `${tag}: ${v} at ${k}: book ${off.toFixed(1)} px off centre`); }
    for (const v of ['watch', 'top']) for (let k = 1.5; k < N - 1; k += 1) { const off = await p.evaluate(async ([v, k, W, H]) => { await __m.flip(k, v); return __m.crease(W, H); }, [v, k, W, H]); need(Math.abs(off) < W * 0.01, `${tag}: ${v} mid-turn at ${k}: crease ${off.toFixed(1)} px off centre`); }
    const aside = await p.evaluate(async ([W, H]) => { await __m.flip(4, 'top'); const g = __book.book.group; g.position.x += 6; g.updateMatrixWorld(true); return [__m.box(W, H), __m.crease(W, H)]; }, [W, H]);
    need(aside.every(a => Math.abs(a) >= W * 0.01), `${tag}: control: centre check passes a book 6 cm aside (${aside})`);
    const bd = await p.evaluate(async () => { await __m.flip(3, 'board'); return __m.board(); }), [tl, tr, bl, br] = bd.c;
    need(Math.max(...bd.c.flat().map(Math.abs)) < 1, `${tag}: Board: a corner is out of frame ${JSON.stringify(bd.c)}`);
    need(Math.abs(tl[0] - bl[0]) < 0.002 && Math.abs(tr[0] - br[0]) < 0.002 && Math.abs(tl[1] - tr[1]) < 0.002, `${tag}: Board: not square on ${JSON.stringify(bd.c)}`);
    need(Math.max(tr[0] - tl[0], tl[1] - bl[1]) > 1.6, `${tag}: Board: only fills ${Math.max(tr[0] - tl[0], tl[1] - bl[1]) / 2}`);
    const tilt = await p.evaluate(async () => { await __m.flip(3, 'board'); const r = __book.rig; r.s.ph = 1.45; r.apply(); __book.cam.updateMatrixWorld(true); return __m.board().c; });
    need(Math.abs(tilt[0][0] - tilt[2][0]) >= 0.002, `${tag}: control: Board check passes a tilted camera`);
    if (errs.length) fails.push(`${tag}: ${errs[0]}`);
    await p.close(); await c.close();
    console.log(`${tag}\tTop's worst pop-up ${worst.toFixed(1)} px off its foot, a close camera ${close.toFixed(1)} px`);
  }

  // the labels at every phone width
  for (const size of [[320, 568], [360, 740], [390, 844], [430, 932], [667, 375], [844, 390]]) {
    const c = await b.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await c.newPage();
    await p.goto(url + '?dpr=1&t=2&shot=1&freeze=1&home=78,1.36,10.5,-9'); await ready(p);
    const first = await p.evaluate(() => __book.view); need(first === 'room', `${name} ${size}: ?home= opens on ${first}`);
    const r = await p.evaluate(() => [...document.querySelectorAll('#hud button')].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; }));
    for (const a of r) { need(a.x1 - a.x0 >= 44 && a.y1 - a.y0 >= 44 && a.x0 >= 0 && a.x1 <= size[0] && a.y1 <= size[1], `${name} ${size}: ${a.t} ${JSON.stringify(a)}`);
      for (const o of r) if (o !== a) need(a.x1 <= o.x0 + 0.5 || o.x1 <= a.x0 + 0.5 || a.y1 <= o.y0 + 0.5 || o.y1 <= a.y0 + 0.5, `${name} ${size}: ${a.t} overlaps ${o.t}`); }
    await c.close();
  }

  // a phone's Read
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url + '?dpr=1&t=2&p=3'); await ready(p);
  const cdp = name === 'Chromium' ? await c.newCDPSession(p) : null;
  await p.evaluate(() => { const g = document.querySelector('#gl'); g.setPointerCapture = () => {}; g.releasePointerCapture = () => {}; });
  const stroke = async (x0, y0, x1, y1, ms = 240, n = 14) => { // one finger, frame by frame
    const pts = Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]), gap = ms / n;
    if (cdp) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (const [x, y] of pts.slice(1)) { await new Promise(r => setTimeout(r, gap)); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return; }
    await p.evaluate(async ([pts, gap]) => { const g = document.querySelector('#gl'), ev = (t, [x, y], o = {}) => g.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: t === 'pointermove' ? -1 : 0, ...o }));
      ev('pointerdown', pts[0]); for (const q of pts.slice(1)) { if (gap) await new Promise(r => setTimeout(r, gap)); ev('pointermove', q); } ev('pointerup', pts[pts.length - 1]); }, [pts, gap]);
  };
  const tap = (x, y) => cdp ? p.touchscreen.tap(x, y) : stroke(x, y, x, y, 0, 1); // WebKit's frames can outlast a tap
  const state = () => p.evaluate(() => { const B = __book, r = B.rig; return { x: r.tg.x, th: r.g.th, ph: r.g.ph, r: r.g.r, turn: B.target, view: B.view, pressed: document.querySelector('[data-v=book]').getAttribute('aria-pressed') }; });
  await p.evaluate(() => __book.goView('book', true)); await settle(p);
  const s0 = await state(); need(Math.abs(s0.x + 7.2) < 0.01, `${name}: Read starts at ${s0.x}`);
  const trace = () => p.evaluate(() => { const r = __book.rig, out = window.__trace = []; const f = () => { out.push(r.t.x); if (out.length < 600) requestAnimationFrame(f); }; f(); });
  const smooth = async (from, to, what) => { const t = await p.evaluate(() => window.__trace.slice()), d = to - from, dir = Math.sign(d); let back = 0, step = 0; for (let i = 1; i < t.length; i++) { back = Math.max(back, -(t[i] - t[i - 1]) * dir); step = Math.max(step, Math.abs(t[i] - t[i - 1])); }
    need(back < 0.02, `${name}: ${what} goes back ${back.toFixed(3)} cm`); if (cdp) need(step < Math.abs(d) * 0.16, `${name}: ${what} jumps ${step.toFixed(2)} cm in a frame`); return { frames: t.length, step: +step.toFixed(2) }; };
  await trace(); await stroke(330, 420, 110, 424); await settle(p);
  const s1 = await state(); need(Math.abs(s1.x - 7.2) < 0.01, `${name}: swipe left ended at ${s1.x}`); need(s1.th === s0.th && s1.ph === s0.ph && s1.r === s0.r, `${name}: the swipe moved the orbit ${JSON.stringify(s1)}`); need(s1.turn === s0.turn, `${name}: the swipe turned the page`); need(s1.view === 'book' && s1.pressed === 'true', `${name}: the swipe left Read`);
  const ease = await smooth(-7.2, 7.2, 'swipe left');
  await trace(); await stroke(110, 420, 330, 416); await settle(p);
  const s2 = await state(); need(Math.abs(s2.x + 7.2) < 0.01, `${name}: swipe right ended at ${s2.x}`); await smooth(7.2, -7.2, 'swipe right');
  await stroke(200, 420, 120, 420, 60, 5); await settle(p); const s3 = await state(); need(Math.abs(s3.x - 7.2) < 0.01, `${name}: a flick ended at ${s3.x}`);
  await stroke(200, 420, 170, 420, 900, 20); await new Promise(r => setTimeout(r, 200)); await settle(p); const s4 = await state(); need(Math.abs(s4.x - 7.2) < 0.01, `${name}: a slow nudge moved the page to ${s4.x}`);
  await stroke(120, 420, 330, 420); await settle(p); await stroke(120, 420, 330, 420); await settle(p); const s5 = await state(); need(Math.abs(s5.x + 7.2) < 0.01, `${name}: swiping past the left page ended at ${s5.x}`);
  await stroke(330, 420, 110, 420); await settle(p); // on the right page, a tap goes on, and the next spread is framed
  await tap(195, 420); await p.waitForFunction(k => __book.target === k, s0.turn + 1, { timeout: 10000 }); await settle(p);
  const s6 = await state(); need(s6.view === 'book' && s6.pressed === 'true' && Math.abs(s6.x + 7.2) < 0.01, `${name}: after a tap: ${JSON.stringify(s6)}`);
  await stroke(195, 300, 197, 480); const s7 = await state(); need(Math.abs(s7.ph - s6.ph) > 0.1 && Math.abs(s7.x - s6.x) < 0.01, `${name}: a drag down Read did not orbit: ${JSON.stringify(s7)}`);
  await stroke(330, 420, 110, 420); const s8 = await state(); need(s7.pressed === 'false' && Math.abs(s8.th - s7.th) > 0.1 && Math.abs(s8.x - s7.x) < 0.01, `${name}: out of Read, a sideways drag did not orbit: ${JSON.stringify(s8)}`);
  await p.evaluate(() => __book.goView('room', true)); await settle(p); const a = await state(); await stroke(330, 420, 110, 420); const z = await state(); need(Math.abs(z.th - a.th) > 0.1 && Math.abs(z.x - a.x) < 0.01, `${name}: a drag in Room did not orbit: ${JSON.stringify(z)}`);
  await p.evaluate(() => __book.goView('top', true)); await settle(p); const t0 = await state(); await tap(250, 420); await p.waitForFunction(k => __book.target !== k, t0.turn, { timeout: 10000 }); const t1 = await state(); need(t1.view === 'top' && t1.pressed === 'false' && await p.evaluate(() => document.querySelector('[data-v=top]').getAttribute('aria-pressed')) === 'true', `${name}: a tap in Top lost the view`);
  if (errs.length) fails.push(`${name} phone: ${errs[0]}`);
  console.log(`${name} phone\tswipe eased over ${ease.frames} frames, largest step ${ease.step} cm`);
  await c.close(); await b.close();
}
console.log(fails.length ? 'FAIL:\n' + fails.join('\n') : 'PASS'); process.exit(fails.length ? 1 : 0);
