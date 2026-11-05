// Frame cost while navigating, in WebKit and Chromium, at a phone's window and pixel ratio with the app's mobile path on, and on a desktop window. A desktop machine stands in for a phone here: milliseconds are this machine's, so read them as before against after, never as a phone's numbers.
// Everything is hooked from outside the app, so the same script measures any build. One route plays in every run: rest, drag, fly to Read, swipe, turn pages, fly to Desk, drag and pinch, Board, Top, Watch, Room.
// Three passes of the route, because measuring disturbs: `time` hooks only the frame and its stages; `count` counts every GL call, upload and allocation; `gpu` waits for the GPU each time the kind of pass changes. The GPU's clock follows its load, so `gpu` varies by a third from run to run: read it for shares.
// `peak` is the number to compare builds by: Chromium with the display's limit off, dragging, frames as fast as they come. Back to back it holds to about 1%, but what else the machine is doing moves every figure, by half between sessions here: run both builds together and read the ratio.
// Then what a route cannot show, on the phone only: `read` goes through every spread and back, compares each first showing with the second and counts what still went to the GPU; `bar` slides an address bar; `pace` holds frames to a slow device's rate and watches the resolution answer.
// Only what does not depend on this machine can fail the check: draws, uploads, shadow maps drawn while the camera moves, copies held in memory, buffers remade, the resolution's answers. The same limits run against any build, so an older one is the control: it has to fail.
// Needs: npx playwright-core install webkit. usage: URL=http://localhost:5181/aif-book/ node scripts/check/perf.mjs [out.json] [only=WebKit,Chromium] [pass=time,count,gpu,peak,read,bar,pace] [against=before.json]
import { webkit, chromium } from 'playwright-core';
import fs from 'fs';
import { execSync } from 'child_process';
const url = process.env.URL || 'http://localhost:5181/aif-book/', args = process.argv.slice(2), opt = k => args.find(a => a.startsWith(k + '='))?.split('=')[1], out = args.find(a => !a.includes('='));
const CHROME = { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, DESK = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 };
const RUNS = [
  { name: 'WebKit phone', type: webkit, ctx: PHONE },
  { name: 'WebKit phone small cores', type: webkit, ctx: PHONE, small: true }, // WebKit has no throttle: its processes at background priority run on the small cores, a little over half as fast here. Its frames also stall for a fifth of a second at that priority, so only its CPU figures mean anything
  { name: 'Chromium phone', type: chromium, ctx: PHONE, launch: CHROME },
  { name: 'Chromium phone 4x', type: chromium, ctx: PHONE, launch: CHROME, slow: 4 },
  { name: 'Chromium phone 6x', type: chromium, ctx: PHONE, launch: CHROME, slow: 6 },
  { name: 'WebKit desktop', type: webkit, ctx: DESK },
  { name: 'Chromium desktop', type: chromium, ctx: DESK, launch: CHROME },
].filter(r => !opt('only') || opt('only').split(',').some(o => r.name.includes(o)));
const PASSES = (opt('pass') || 'time,count,gpu,peak,read,bar,pace').split(','), PHONE_ONLY = ['read', 'bar', 'pace'];

// before the app runs: every frame the app asks for goes through here, and in the count pass every GL call too
const hooks = pass => {
  const raf = window.requestAnimationFrame.bind(window), now = () => performance.now();
  const P = window.__perf = { raf, last: 0, pace: null, on: false, phase: '', frames: [], cur: {}, gl: {}, shaders: [], tex: new Map(), rb: new Map(), buf: new Map(), load: {}, script: null };
  const paced = f => { if (!P.pace) return raf(f); const due = P.last + P.pace(), go = t => now() >= due - 1 ? f(t) : raf(go); raf(go); }; // a slower device: the frame waits for its time
  window.requestAnimationFrame = cb => paced(t => {
    const a = now(); P.last = a; P.script?.(a); P.cur = {}; if (P.on) P.gl = {}; const heap = performance.memory?.usedJSHeapSize, drawn = window.__book?.renderer.info.render.frame;
    cb(t); P.endFrame?.(); const b = now(); if (window.__book && window.__book.renderer.info.render.frame !== drawn) P.firstPicture ??= b; // the loader's work ends with the first frame that draws, whichever side of `ready` it is done on
    if (P.on) { P.frames.push({ t: a, cpu: b - a, phase: P.phase, heap, dpr: P.dpr?.(), st: P.cur, gl: P.gl, swept: P.swept?.() }); P.gl = {}; } // a fresh one: what comes after must not land on the last frame kept
  });
  if (pass !== 'count' && pass !== 'read') return;
  const G = WebGL2RenderingContext.prototype, bump = (k, n = 1) => { P.gl[k] = (P.gl[k] || 0) + n; };
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x881A: 8, 0x8814: 16, 0x8D62: 2, 0x8229: 1, 0x822B: 2, 0x8D48: 4, 0x81A5: 2, 0x81A6: 3, 0x81A7: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8, 0x822F: 4, 0x8230: 8 };
  const bound = {}; let rbNow = null; const tris = (k, a) => a[0] !== 4 ? 0 : (k.startsWith('drawArrays') ? a[2] : k === 'drawRangeElements' ? a[3] : a[1]) / 3 * (k.endsWith('Instanced') ? a.at(-1) : 1), size = (w, h, f, lv = 1, d = 1) => { let s = 0; for (let i = 0; i < lv; i++) s += Math.max(1, w >> i) * Math.max(1, h >> i) * d * (BPP[f] || 4); return s; };
  for (const k of Object.getOwnPropertyNames(G)) { const d = Object.getOwnPropertyDescriptor(G, k); if (typeof d.value !== 'function') continue; const f = d.value;
    const draw = /^(drawArrays|drawElements|drawArraysInstanced|drawElementsInstanced|drawRangeElements)$/.test(k), data = /^(texImage2D|texSubImage2D|texImage3D|texSubImage3D|bufferData|bufferSubData)$/.test(k);
    G[k] = function (...a) { bump('calls');
      if (draw) { bump('draws'); bump('tris', tris(k, a)); }
      else if (k === 'bindTexture') bound[a[0]] = a[1];
      else if (k === 'bindRenderbuffer') rbNow = a[1];
      else if (k === 'bindBuffer') bound[a[0]] = a[1];
      else if (k === 'bindFramebuffer') bump('fbo');
      else if (k === 'useProgram') bump('programs');
      else if (k === 'generateMipmap') bump('mips');
      else if (k === 'linkProgram') { bump('links'); P.shaders.push(P.phase || 'load'); }
      else if (k === 'texStorage2D') P.tex.set(bound[a[0]], size(a[3], a[4], a[2], a[1]));
      else if (k === 'texStorage3D') P.tex.set(bound[a[0]], size(a[3], a[4], a[2], a[1], a[5]));
      else if (k === 'deleteTexture') P.tex.delete(a[0]);
      else if (k === 'renderbufferStorage') P.rb.set(rbNow, size(a[2], a[3], a[1]));
      else if (k === 'renderbufferStorageMultisample') P.rb.set(rbNow, size(a[3], a[4], a[2]) * a[1]);
      else if (k === 'deleteRenderbuffer') P.rb.delete(a[0]);
      if (data) { const src = a.find(x => x && (x.byteLength !== undefined || x.width)), n = src ? src.byteLength ?? src.width * src.height * 4 : 0; bump(k.startsWith('tex') ? 'texBytes' : 'bufBytes', n); if (k.startsWith('tex')) { bump('texUps'); if (P.on) P.load[P.phase] = (P.load[P.phase] || 0) + n; } if (k === 'bufferData' && a[1]?.byteLength) P.buf.set(bound[a[0]], a[1].byteLength); }
      return f.apply(this, a); }; }
};

// after it is ready: the stages of a frame, and in the gpu pass a wait for the GPU either side of each pass
const stages = pass => {
  const P = __perf, B = __book, gl = B.renderer.getContext(), now = () => performance.now();
  const wrap = (o, k, name) => { const f = o[k]; o[k] = function (...a) { const t = now(), r = f.apply(this, a); P.cur[name] = (P.cur[name] || 0) + now() - t; return r; }; };
  P.dpr = () => B.renderer.getPixelRatio(); P.swept = () => (!!B.rig.drag || B.rig.moving) && Math.abs(B.target - B.p) < 1e-4; // the camera on the move, and only the camera
  const sm = B.renderer.shadowMap, shadow = sm.render;
  if (pass === 'gpu') { // gl.finish() returns at once in both engines: only a read of something just drawn waits for the queue. One wait each time the kind of pass changes, not per draw, because a wait costs a few tenths of a millisecond of its own, measured below and taken off
    const fb = gl.createFramebuffer(), tx = gl.createTexture(), px = new Uint8Array(4); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 1, 1); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null); B.renderer.state.reset?.(); B.renderer.resetState?.();
    const sync = () => { const cur = gl.getParameter(gl.FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.clear(gl.COLOR_BUFFER_BIT); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, cur); };
    let g = null, t = 0; const mark = k => { if (k === g) return; sync(); const n = now(); if (g) { P.cur['gpu:' + g] = (P.cur['gpu:' + g] || 0) + n - t; P.cur.waits = (P.cur.waits || 0) + 1; } g = k; t = now(); }; P.endFrame = () => mark(null);
    P.syncCost = () => { const t = now(); for (let i = 0; i < 50; i++) sync(); return (now() - t) / 50; };
    sm.render = function (...a) { if (!sm.needsUpdate) return shadow.apply(this, a); P.cur.shadows = (P.cur.shadows || 0) + 1; mark('shadow'); shadow.apply(this, a); mark('main'); };
    const render = B.renderer.render, kind = s => s === B.scene ? 'main' : s.isScene ? 'rain' : s.material?.name === 'OutputShader' ? 'output' : B.renderer.getRenderTarget() ? 'bloom' : 'film';
    B.renderer.render = function (s, c) { mark(kind(s)); render.call(this, s, c); };
    return; }
  sm.render = function (...a) { if (!sm.needsUpdate) return shadow.apply(this, a); P.cur.shadows = (P.cur.shadows || 0) + 1; const t = now(); shadow.apply(this, a); P.cur.shadowMs = (P.cur.shadowMs || 0) + now() - t; };
  wrap(B.book, 'set', 'book'); wrap(B.book, 'updateCase', 'case'); wrap(B.rig, 'update', 'rig'); wrap(B.room, 'tick', 'room'); wrap(B.room.rain, 'update', 'rain'); wrap(B.audio, 'update', 'audio'); wrap(B.renderer, 'render', 'render');
};

// one route, one frame at a time: input arrives at the top of a frame, as it does on a device
const route = () => new Promise(done => {
  const P = __perf, B = __book, g = document.querySelector('#gl'), W = g.clientWidth, H = g.clientHeight; g.setPointerCapture = () => {}; g.releasePointerCapture = () => {};
  const ev = (t, x, y, id = 7) => g.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 7, clientX: x, clientY: y, button: t === 'pointermove' ? -1 : 0 }));
  const key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const view = v => document.querySelector(`[data-v=${v}]`).click();
  const drag = (x0, y0, x1, y1, sec) => ({ sec, start() { ev('pointerdown', x0, y0); }, at(u) { const e = u - Math.sin(2 * Math.PI * u) / (2 * Math.PI); ev('pointermove', x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); }, end() { ev('pointerup', x1, y1); } });
  const pinch = (d0, d1, sec) => ({ sec, start() { ev('pointerdown', W / 2 - d0, H / 2); ev('pointerdown', W / 2 + d0, H / 2, 8); }, at(u) { const d = d0 + (d1 - d0) * u; ev('pointermove', W / 2 - d, H / 2); ev('pointermove', W / 2 + d, H / 2, 8); }, end() { ev('pointerup', W / 2 - d1, H / 2); ev('pointerup', W / 2 + d1, H / 2, 8); } });
  const hold = sec => ({ sec }), act = (f, sec) => ({ sec, start: f });
  const x = W * 0.8, y = H * 0.5, ph = (name, s) => ({ name, ...s });
  const steps = [
    ph('idle', hold(3)), ph('drag', drag(x, y, W * 0.2, y + 60, 2)), ph('drag', drag(W * 0.2, y + 60, x, y, 2)), ph('settle', hold(1)),
    ph('fly', act(() => view('book'), 2.5)), ph('swipe', drag(x, y, W * 0.2, y + 4, 0.3)), ph('settle', hold(1.2)),
    ph('turn', act(() => key('ArrowRight'), 1.6)), ph('turn', act(() => key('ArrowRight'), 1.6)), ph('turn', act(() => key('ArrowLeft'), 1.6)),
    ph('fly', act(() => view('desk'), 2.5)), ph('drag', drag(x, y, W * 0.3, y - 80, 2)), ph('pinch', pinch(60, 150, 1.5)), ph('pinch', pinch(150, 60, 1.5)), ph('settle', hold(1)),
    ph('fly', act(() => view('board'), 2.5)), ph('fly', act(() => view('top'), 2.5)), ph('fly', act(() => view('watch'), 2.5)), ph('fly', act(() => view('room'), 2.5)), ph('idle', hold(3)),
  ];
  let i = -1, t0 = 0; const next = t => { steps[i]?.end?.(); i++; if (i >= steps.length) { P.script = null; P.on = false; done(); return; } t0 = t; P.phase = steps[i].name; steps[i].start?.(); };
  P.script = t => { if (i < 0 || t - t0 >= steps[i].sec * 1000) next(t); else steps[i].at?.((t - t0) / (steps[i].sec * 1000)); };
  P.frames = []; P.gl = {}; P.on = true;
});

const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, r = (x, n = 2) => +x.toFixed(n);
const sum = (f, k) => f.reduce((a, q) => a + (q[k] || 0), 0);
function timeStats(F) {
  const gap = F.slice(1).map((f, i) => f.t - F[i].t), byPhase = {};
  const s = (fs, gaps) => ({ frames: fs.length, fps: r(1000 / mean(gaps), 1), gapP50: r(pct(gaps, 0.5)), gapP95: r(pct(gaps, 0.95)), gapP99: r(pct(gaps, 0.99)), gapMax: r(Math.max(0, ...gaps)), over20: gaps.filter(g => g > 20).length, over33: gaps.filter(g => g > 33.4).length, over50: gaps.filter(g => g > 50).length, cpuMean: r(mean(fs.map(f => f.cpu))), cpuP95: r(pct(fs.map(f => f.cpu), 0.95)), cpuP99: r(pct(fs.map(f => f.cpu), 0.99)), cpuMax: r(Math.max(0, ...fs.map(f => f.cpu))) });
  for (const ph of new Set(F.map(f => f.phase))) { const idx = F.map((f, i) => f.phase === ph && i ? i : -1).filter(i => i > 0); byPhase[ph] = s(idx.map(i => F[i]), idx.map(i => gap[i - 1])); }
  const st = {}; for (const f of F) for (const [k, v] of Object.entries(f.st)) st[k] = (st[k] || 0) + v; for (const k in st) st[k] = r(st[k] / F.length, 3);
  const heapUp = F.slice(1).reduce((a, f, i) => a + Math.max(0, (f.heap || 0) - (F[i].heap || 0)), 0), heapDrops = F.slice(1).filter((f, i) => (f.heap || 0) < (F[i].heap || 0)).length, sec = (F.at(-1).t - F[0].t) / 1000;
  const dprs = F.map(f => f.dpr); let changes = 0; for (let i = 1; i < dprs.length; i++) if (dprs[i] !== dprs[i - 1]) changes++;
  return { all: s(F.slice(1), gap), byPhase, stages: st, allocMBs: r(heapUp / sec / 1048576), heapDrops, dpr: { first: dprs[0], last: dprs.at(-1), min: Math.min(...dprs), changes }, seconds: r(sec, 1) };
}
function countStats(F, extra) {
  const drew = F.filter(f => f.gl.draws), per = k => r(mean(drew.map(f => f.gl[k] || 0)), 1), max = k => Math.max(...F.map(f => f.gl[k] || 0)); const byPhase = {}; // a frame a phone skips at rest draws nothing, and would flatter the mean
  for (const ph of new Set(F.map(f => f.phase))) { const fs = drew.filter(f => f.phase === ph); byPhase[ph] = { draws: r(mean(fs.map(f => f.gl.draws || 0)), 1), tris: Math.round(mean(fs.map(f => f.gl.tris || 0))), calls: r(mean(fs.map(f => f.gl.calls || 0)), 1), drawsMax: Math.max(...fs.map(f => f.gl.draws || 0)) }; }
  const swept = F.filter(f => f.swept);
  return { swept: swept.length, sweptShadows: swept.filter(f => f.st.shadows).length, draws: per('draws'), drawsMax: max('draws'), tris: Math.round(per('tris')), trisMax: max('tris'), calls: per('calls'), callsMax: max('calls'), fbo: per('fbo'), programs: per('programs'), texKBPerFrame: r(mean(F.map(f => (f.gl.texBytes || 0) / 1024)), 1), bufKBPerFrame: r(mean(F.map(f => (f.gl.bufBytes || 0) / 1024)), 1), byPhase, ...extra };
}
function gpuStats(F, wait) { const byPhase = {}, frameMs = f => Object.entries(f.st).reduce((a, [k, v]) => a + (k.startsWith('gpu:') ? v : 0), 0) - (f.st.waits || 0) * wait; for (const ph of new Set(F.map(f => f.phase))) { const fs = F.filter(f => f.phase === ph), drawn = fs.filter(f => f.st.waits); byPhase[ph] = { ms: r(mean(drawn.map(frameMs))), drawnPerSec: r(drawn.length / (fs.reduce((a, f, i) => a + (i ? Math.min(100, f.t - fs[i - 1].t) : 0), 0) / 1000), 0) }; } const st = {}; for (const f of F) for (const [k, v] of Object.entries(f.st)) if (k.startsWith('gpu:')) st[k] = (st[k] || 0) + v; const waits = mean(F.map(f => f.st.waits || 0)), kinds = Object.keys(st).length; for (const k in st) st[k] = r(st[k] / F.length, 3); const total = Object.values(st).reduce((a, v) => a + v, 0) - waits * wait; return { byPhase, perFrame: st, wait: r(wait, 3), waitsPerFrame: r(waits, 1), total: r(total, 2), shadowsPerFrame: r(mean(F.map(f => f.st.shadows || 0)), 3), kinds }; }

// what a route cannot show
const reading = () => new Promise(done => { // every spread, there and back, a little past each turn's end
  const P = __perf, key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })), worst = {};
  const turn = (k, name, left) => new Promise(r => { key(k); let n = 0, w = 0, t = performance.now(); const f = () => { const q = performance.now(); w = Math.max(w, q - t); t = q; ++n < 100 ? P.raf(f) : (worst[name] = w, r()); }; P.raf(f); });
  (async () => { P.phase = 'first'; const a = [], b = []; for (let i = 1; i <= 8; i++) { await turn('ArrowRight', 'f' + i); a.push(worst['f' + i]); } P.phase = 'second'; for (let i = 7; i >= 0; i--) { await turn('ArrowLeft', 'b' + i); b.push(worst['b' + i]); } done({ first: a, again: b }); })();
});
const sliding = () => new Promise(done => { // an address bar on its way out: the box changes for 24 frames running, then holds
  const P = __perf, B = __book, g = document.querySelector('#gl'), H = g.clientHeight, R = B.renderer, set = R.setSize; let made = 0; R.setSize = function (...a) { made++; return set.apply(this, a); };
  const gaps = [], shapes = []; let n = 0, t = performance.now(); const f = () => { const q = performance.now(); gaps.push(q - t); t = q; n++; shapes.push(Math.abs(B.cam.aspect - g.clientWidth / g.clientHeight)); if (n <= 24) g.style.height = H - 100 * Math.sin(n / 24 * Math.PI / 2) + 'px'; if (n < 70) P.raf(f); else { R.setSize = set; done({ made, worstGap: Math.max(...gaps), buffer: [g.width, g.height], box: [g.clientWidth, g.clientHeight], off: Math.max(...shapes.slice(1)) }); g.style.height = ''; } }; P.raf(f);
});
// a finger that never stops, for as long as it takes; the frame's length comes from `ms`, which can read the pixel ratio the app has chosen
const paced = ([ms, sec]) => new Promise(done => {
  const P = __perf, B = __book, g = document.querySelector('#gl'), W = g.clientWidth, H = g.clientHeight; g.setPointerCapture = () => {};
  const ev = (t, x, y) => g.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: t === 'pointermove' ? -1 : 0 }));
  const dpr = () => B.renderer.getPixelRatio(), f = new Function('dpr', 'return ' + ms), trace = [dpr()], t0 = performance.now(); P.pace = () => f(dpr()); ev('pointerdown', W / 2, H / 2);
  const step = () => { const u = (performance.now() - t0) / 1000; ev('pointermove', W / 2 + Math.sin(u * 3) * 90, H / 2); if (dpr() !== trace.at(-1)) trace.push(dpr()); if (u < sec) P.raf(step); else { ev('pointerup', W / 2, H / 2); P.pace = null; done(trace); } }; step();
});
const flatOut = () => new Promise(done => { // each view with a finger on it, as fast as frames come
  const P = __perf, B = __book, g = document.querySelector('#gl'); g.setPointerCapture = () => {}; const out = {};
  const ev = (t, x, y) => g.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: t === 'pointermove' ? -1 : 0 }));
  const views = ['room', 'book', 'desk']; (async () => { for (const v of views) { B.goView(v, true); await new Promise(r => setTimeout(r, 300)); ev('pointerdown', 200, 300); let i = 0; const mv = setInterval(() => ev('pointermove', 200 + 40 * Math.sin(++i / 8), 300), 8); await new Promise(r => setTimeout(r, 500)); let n = 0; const t0 = performance.now(); await new Promise(r => { const f = () => { n++; performance.now() - t0 < 2500 ? requestAnimationFrame(f) : r(); }; f(); }); out[v] = +(2500 / n).toFixed(2); clearInterval(mv); ev('pointerup', 200, 300); B.goView(v, true); } done(out); })();
});
const CASES = { saving: ['33.4', 11, 'a phone saving power: 30 fps whatever is drawn'], fill: ['30 * (dpr / 1.5) ** 2', 7, 'too many pixels: 30 ms at 1.5, and less as it draws less'], hitch: ['performance.now() % 3000 < 34 ? 400 : 0', 7, 'a hitch now and then, on a phone with room to spare'], crawl: ['120 * (dpr / 1.5) ** 2', 24, 'far too many pixels: 120 ms at 1.5, 53 at 1'] };

// the answer to a slow run, against a clock that does not need a device: every case the app has to get right, on the numbers alone
async function logic() {
  const { Resolution } = await import(new URL('../../src/resolution.js', import.meta.url)).catch(() => ({})); if (!Resolution) return null;
  const run = (frames, r = new Resolution(1.5)) => { const seen = [r.now], at = [0]; for (const [dt, moving] of frames(r)) { const to = r.frame(dt, moving); if (to) { seen.push(to); at.push(r.clock); } } return { seen, at }; };
  const for_ = (sec, dt, moving) => function* () { for (let t = 0; t < sec; t += dt) yield [dt, moving]; };
  const out = {};
  out.steady = run(for_(120, 1 / 60, true)).seen; // 60 fps for two minutes: nothing changes
  out.saving = run(for_(60, 1 / 30, true)).seen; // 30 fps whatever is drawn: it tries, and goes back
  out.fill = run(function* (r) { for (let t = 0; t < 20;) { const dt = Math.max(1 / 60, 0.03 * (r.now / 1.5) ** 2); t += dt; yield [dt, true]; } }).seen;
  out.back = run(function* (r) { for (let t = 0; t < 5;) { const dt = Math.max(1 / 60, 0.03 * (r.now / 1.5) ** 2); t += dt; yield [dt, true]; } yield* for_(5, 1 / 60, true)(); for (let k = 0; k < 2; k++) yield* for_(40, 1 / 30, false)(); yield* for_(3, 1 / 60, true)(); }).seen; // the load eases: a still moment raises it
  const tries = run(function* (r) { for (let t = 0; t < 1500; t += 10) { for (let m = 0; m < 5;) { const dt = Math.max(1 / 60, 0.026 * (r.now / 1.5) ** 2); m += dt; yield [dt, true]; } yield* for_(5, 1 / 30, false)(); } }); // 26 ms at 1.5, 18 at 1.25: the lower step looks like room to rise, and the higher one never holds
  const rises = tries.at.filter((_, i) => i && tries.seen[i] === 1.5); out.tries = tries.seen; out.waits = rises.slice(1).map((t, i) => Math.round(t - rises[i])); // so it asks less and less often
  return out;
}

const fails = [], report = {}, need = (ok, msg) => { if (!ok) fails.push(msg); return ok; };
const tally = (a, f) => a.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
for (const run of RUNS) {
  report[run.name] = {}; const phone = run.ctx === PHONE;
  for (const pass of PASSES) {
    if (pass !== 'time' && (run.slow || run.small)) continue; // the rest read the same with or without a slower processor
    if (PHONE_ONLY.includes(pass) && !phone) continue;
    if (pass === 'peak' && (run.type !== chromium)) continue; // WebKit has no way to drop the display's limit
    const b = await run.type.launch(pass === 'peak' ? { ...run.launch, args: [...run.launch.args, '--disable-gpu-vsync', '--disable-frame-rate-limit'] } : run.launch || {}), c = await b.newContext(run.ctx), p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /GL_INVALID|WebGL:|no image data/.test(m.text())) errs.push(m.text()); }); await p.addInitScript(hooks, pass);
    const t0 = Date.now(); await p.goto(url + (url.includes('?') ? '&' : '?') + (pass === 'read' ? 'p=0' : 'p=3')); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 240000 }); await p.evaluate(() => new Promise(r => { const f = () => __perf.firstPicture ? r() : __perf.raf(f); f(); })); const load = Math.round(await p.evaluate(() => __perf.firstPicture));
    if (run.slow) await (await c.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: run.slow });
    if (run.small) for (const pid of execSync('pgrep -f "ms-playwright/webkit.*(WebContent|GPU)"').toString().trim().split('\n')) execSync(`taskpolicy -b -p ${pid}`);
    await p.evaluate(() => new Promise(r => { let n = 0; const f = () => ++n > 120 ? r() : __perf.raf(f); f(); })); // past the first frames
    if (pass === 'peak') { const w = await p.evaluate(flatOut); report[run.name].peak = w; console.log(`${run.name}\tpeak\tms a frame ${JSON.stringify(w)}`); await b.close(); continue; }
    if (PHONE_ONLY.includes(pass)) {
      if (pass === 'read') { await p.evaluate(() => { __perf.on = true; __perf.phase = 'first'; }); const w = await p.evaluate(reading), g = await p.evaluate(() => ({ up: __perf.load, links: __perf.shaders.filter(x => x !== 'load').length })); report[run.name].read = { ...w, firstWorst: r(Math.max(...w.first), 1), againWorst: r(Math.max(...w.again), 1) }; const bytes = Object.values(g.up).reduce((a, b) => a + b, 0), mb = r(bytes / 1048576, 1); report[run.name].read.uploadsMB = mb; report[run.name].read.links = g.links; console.log(`${run.name}\tread\tworst gap on a first showing ${r(Math.max(...w.first), 1)} ms, the second time ${r(Math.max(...w.again), 1)} ms, ${mb} MB uploaded, ${g.links} shaders built`); need(!bytes, `${run.name}: ${bytes} bytes uploaded on the way through the book`); need(!g.links, `${run.name}: ${g.links} shaders built on the way through the book`); }
      if (pass === 'bar') { const w = await p.evaluate(sliding); report[run.name].bar = w; console.log(`${run.name}\tbar\t${w.made} buffer changes in 24 frames of sliding, worst gap ${r(w.worstGap, 1)} ms, picture off its box by ${r(w.off, 4)}`); need(w.made <= 2, `${run.name}: the picture's buffers were remade ${w.made} times while a bar slid`); need(w.off < 1e-6, `${run.name}: the picture's shape lagged its box`); need(Math.abs(w.buffer[1] / w.buffer[0] - w.box[1] / w.box[0]) < 0.01, `${run.name}: the buffer never caught up with the box`); }
      if (pass === 'pace') { const res = {}; for (const [k, [ms, sec]] of Object.entries(CASES)) { await p.reload(); await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 240000 }); await p.evaluate(() => new Promise(r => { let n = 0; const f = () => ++n > 90 ? r() : __perf.raf(f); f(); })); res[k] = await p.evaluate(paced, [ms, sec]); } report[run.name].pace = res; console.log(`${run.name}\tpace\t${JSON.stringify(res)}`);
        need(res.saving.at(-1) === 1.5, `${run.name}: a phone saving power stays at ${res.saving.at(-1)}`); need(res.fill.at(-1) < 1.5 && res.fill.length > 1, `${run.name}: too many pixels and the resolution did not answer: ${res.fill}`); need(res.hitch.length === 1, `${run.name}: a hitch moved the resolution: ${res.hitch}`); need(res.crawl.at(-1) === 1, `${run.name}: a phone crawling at 53 ms went back up: ${res.crawl}`); }
      if (errs.length) fails.push(`${run.name} ${pass}: ${errs[0]}`);
      await b.close(); continue;
    }
    await p.evaluate(stages, pass);
    const trace = pass === 'time' && run.type === chromium; if (trace) await b.startTracing(p, { categories: ['devtools.timeline', 'v8', 'disabled-by-default-v8.gc'] });
    await p.evaluate(route);
    let gc = null; if (trace) { const ev = JSON.parse((await b.stopTracing()).toString()).traceEvents.filter(e => e.ph === 'X' && /^(MinorGC|MajorGC)$/.test(e.name)); gc = { events: ev.length, totalMs: r(ev.reduce((a, e) => a + e.dur, 0) / 1000), maxMs: r(Math.max(0, ...ev.map(e => e.dur)) / 1000) }; }
    const raw = await p.evaluate(() => ({ wait: __perf.syncCost?.() || 0, F: __perf.frames, links: __perf.shaders, load: __perf.load, tex: [...__perf.tex.values()].reduce((a, b) => a + b, 0), rb: [...__perf.rb.values()].reduce((a, b) => a + b, 0), buf: [...__perf.buf.values()].reduce((a, b) => a + b, 0), nTex: __perf.tex.size, size: [document.querySelector('#gl').width, document.querySelector('#gl').height], objs: (() => { let n = 0, m = 0; __book.scene.traverse(o => { n++; if (o.isMesh) m++; }); return [n, m]; })(), canvases: (() => { const seen = new Set(); let px = 0; __book.scene.traverse(o => { for (const m of [o.material].flat()) if (m) for (const v of Object.values(m)) if (v?.isTexture && v.image?.getContext && !seen.has(v.image)) { seen.add(v.image); px += v.image.width * v.image.height; } }); return px * 4; })() }));
    const res = pass === 'time' ? timeStats(raw.F) : pass === 'count' ? countStats(raw.F, { linksDuringRoute: raw.links.filter(x => x !== 'load').length, uploadsDuringRouteMB: Object.fromEntries(Object.entries(raw.load).map(([k, v]) => [k, r(v / 1048576, 1)])), textureMB: r(raw.tex / 1048576, 1), textures: raw.nTex, renderbufferMB: r(raw.rb / 1048576, 1), bufferMB: r(raw.buf / 1048576, 1), canvasMB: r(raw.canvases / 1048576, 1), objects: raw.objs[0], meshes: raw.objs[1] }) : gpuStats(raw.F, raw.wait);
    report[run.name][pass] = { ...res, loadMs: load, gc, buffer: raw.size };
    if (errs.length) fails.push(`${run.name} ${pass}: ${errs[0]}`);
    await b.close();
    console.log(`${run.name}\t${pass}\t${JSON.stringify(pass === 'time' ? { fps: res.all.fps, gapP95: res.all.gapP95, gapP99: res.all.gapP99, over33: res.all.over33, cpuMean: res.all.cpuMean, cpuP99: res.all.cpuP99, dpr: res.dpr, gc } : pass === 'count' ? { draws: res.draws, tris: res.tris, calls: res.calls, textureMB: res.textureMB, renderbufferMB: res.renderbufferMB, canvasMB: res.canvasMB, uploads: res.uploadsDuringRouteMB, links: res.linksDuringRoute, swept: res.swept, sweptShadows: res.sweptShadows } : res)}`);
    if (pass === 'count' && phone) { need(res.draws < 270, `${run.name}: ${res.draws} draws a frame`); need(res.swept > 300 && res.sweptShadows <= 2, `${run.name}: a shadow map drew in ${res.sweptShadows} of ${res.swept} frames of a camera move`); // a strike draws its own, once
      need(!Object.keys(res.uploadsDuringRouteMB).length, `${run.name}: uploads while navigating: ${JSON.stringify(res.uploadsDuringRouteMB)}`); need(!res.linksDuringRoute, `${run.name}: ${res.linksDuringRoute} shaders built while navigating`); need(res.canvasMB < 10, `${run.name}: ${res.canvasMB} MB of canvases kept after upload`); }
  }
}
const sums = await logic(); if (sums) { report.logic = sums; console.log('logic\t' + JSON.stringify(sums)); const s = sums; need(s.steady.length === 1, `steady 60 fps moved the resolution: ${s.steady}`); need(s.saving.at(-1) === 1.5 && s.saving.length === 4, `30 fps whatever is drawn: ${s.saving}`); need(s.fill.at(-1) === 1.25 && s.fill.length === 2, `too many pixels: ${s.fill}`); need(s.back.at(-1) === 1.5, `a load that eased never came back: ${s.back}`); need(s.waits.length >= 5 && s.waits.every((w, i) => !i || w > s.waits[i - 1] * 1.4 || w >= 300) && s.waits.at(-1) < 320, `no room to rise, and the waits between tries did not lengthen to their limit: ${s.waits}`); }
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
if (opt('against')) { const a = JSON.parse(fs.readFileSync(opt('against'))), row = (k, f) => console.log(k.padEnd(34), ...Object.keys(report).filter(n => report[n].time && a[n]?.time).map(n => `${n}: ${f(a[n])} -> ${f(report[n])}`)); for (const [k, f] of [['frames over 33 ms', v => v.time.all.over33], ['gap p99, ms', v => v.time.all.gapP99], ['frame CPU mean, ms', v => v.time.all.cpuMean], ['frame CPU p99, ms', v => v.time.all.cpuP99], ['JS garbage, MB/s', v => v.time.allocMBs], ['flat out, ms a frame', v => JSON.stringify(v.peak ?? '-')], ['draws a frame', v => v.count?.draws ?? '-'], ['GL calls a frame', v => v.count?.calls ?? '-']]) row(k, f); }
console.log(fails.length ? 'FAIL:\n' + fails.join('\n') : 'PASS'); process.exit(fails.length ? 1 : 0);
