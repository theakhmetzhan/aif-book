// The eye goes all the way round and never through the wall: a real drag past a full turn, the wall held on every frame, the short way home from any bearing, and the book still in sight with the wall at its back. On a phone, Sound sits top left.
// usage: URL=http://localhost:5185/aif-book/ node scripts/check/orbit.mjs
import { webkit, chromium } from 'playwright-core';
const url = process.env.URL || 'http://localhost:5181/aif-book/', fails = [], need = (ok, msg) => { if (!ok) fails.push(msg); };
for (const [name, type, opts] of [['WebKit', webkit, {}], ['Chromium', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }]]) {
  const b = await type.launch(opts);
  for (const [dev, size, phone] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    const tag = `${name} ${dev}`, c = await b.newContext({ viewport: size, isMobile: phone, hasTouch: phone }), p = await c.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url + '?dpr=1&t=2&shot=1'); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 180000 });
    await p.evaluate(() => { window.__z = Infinity; const B = __book, f = () => { __z = Math.min(__z, B.cam.position.z); requestAnimationFrame(f); }; f(); });
    for (const v of phone ? ['room', 'desk', 'board'] : ['room', 'desk', 'book', 'board']) { // a sideways stroke in a phone's Read is a swipe
      await p.evaluate(v => { __book.goView(v, true); __z = Infinity; }, v);
      const th0 = await p.evaluate(() => __book.rig.g.th), H = size.height, step = 200, y = H / 2, turns = Math.ceil(2 * Math.PI * 1.15 / (2 / H * step));
      await p.mouse.move(100, y); await p.mouse.down(); // pointer events are the same path on both; WebKit has no way to send touches
      for (let i = 0; i < turns; i++) { await p.mouse.move(100 + step, y, { steps: 8 }); await p.mouse.up(); await p.mouse.move(100, y); await p.mouse.down(); }
      await p.mouse.up(); await p.waitForTimeout(400);
      const s = await p.evaluate(() => ({ th: __book.rig.g.th, z: __z, wall: __book.rig.L.wall }));
      need(Math.abs(s.th - th0) > 2 * Math.PI, `${tag} ${v}: a long drag turned only ${Math.abs(s.th - th0).toFixed(2)}`);
      need(s.z >= s.wall - 1e-6, `${tag} ${v}: the eye reached z ${s.z.toFixed(2)}, past the wall at ${s.wall}`);
    }
    for (const a of [2.5, 3.6, 5.5, 7, -2.5, -4]) { // whichever way it was wound, a view comes back the short way
      const d = await p.evaluate(a => { const B = __book, r = B.rig; B.goView('room', true); r.g.th = a; r.limit(); r.s.th = a; B.goView('desk'); return Math.abs(r.g.th - r.s.th); }, a);
      need(d <= Math.PI + 1e-6, `${tag}: from ${a} the way home is ${d.toFixed(2)}`);
    }
    const seen = await p.evaluate(async () => { const B = __book, r = B.rig; B.set(0); B.goView('room', true); r.free(); r.g.th = Math.PI; r.limit(); r.t.copy(r.tg); Object.assign(r.s, r.g); r.apply(); await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))); const q = B.book.group.position.clone().set(0, 2, 0).project(B.cam); return [q.x, q.y]; });
    need(Math.abs(seen[0]) < 0.9 && Math.abs(seen[1]) < 0.9, `${tag}: the book is out of sight from the wall: ${seen}`);
    const home = await p.evaluate(async () => { const B = __book, r = B.rig; B.goView('room', true); const a = { y: r.tg.y, ph: r.g.ph, r: r.g.r }; for (let i = 0; i <= 60; i++) { r.g.th = i / 60 * 2 * Math.PI; r.limit(); } return [Math.abs(r.tg.y - a.y), Math.abs(r.g.ph - a.ph), Math.abs(r.g.r - a.r)]; });
    need(Math.max(...home) < 1e-9, `${tag}: a full turn changed the framing: ${home}`);
    const jump = await p.evaluate(async () => { const B = __book, r = B.rig; let worst = 0; for (const v of ['room', 'desk', 'board']) { B.goView(v, true); r.free(); let was = null; for (let i = 0; i <= 720; i++) { r.g.th = r.s.th = i / 720 * 2 * Math.PI; r.limit(); r.apply(); const c = B.cam.position.clone(); if (was) worst = Math.max(worst, c.distanceTo(was)); was = c; } } return worst; });
    need(jump < 30, `${tag}: a half-degree turn moved the eye ${jump.toFixed(1)}`); // from five metres out a half-degree is already some way: this is for the snap, which was over 200
    const snd = await p.evaluate(() => { const r = document.querySelector('.snd').getBoundingClientRect(); return { x: r.left, y: r.top }; });
    if (phone) need(snd.x < 40 && snd.y < 40, `${tag}: Sound is at ${snd.x}, ${snd.y}`);
    need(!errs.length, `${tag}: ${errs[0]}`); await c.close();
  }
  await b.close();
}
console.log(fails.length ? fails.join('\n') : 'orbit: the full turn, the wall, the short way home and the phone\'s Sound all hold'); process.exit(fails.length ? 1 : 0);
