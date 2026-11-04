// Flies the real camera rig through the moves that upset the sound and renders the real Ambience with an OfflineAudioContext, stepped at 60 fps, so every run is the same.
// Rain and thunder are rendered twice from one seed, camera still and camera flying: anything that differs is the camera's doing. The clock and the book carry a steady tone,
// read every 128 samples, so a jump of one audio block shows. The book's sound is rendered for a cover and a page, and for a fast run of pages.
// usage: URL=http://localhost:5185/aif-book/ node scripts/check/sound.mjs [traces.json]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const url = process.env.URL || 'http://localhost:5181/aif-book/', base = new URL(url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', protocolTimeout: 900000 });
const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(url + 'audio/CREDITS.md');
const r = await pg.evaluate(async base => {
  const { Ambience } = await import(base + 'src/audio.js'), { CameraRig } = await import(base + 'src/controls.js');
  const T3 = await import((await (await fetch(base + 'src/controls.js')).text()).match(/from\s+"([^"]*three[^"]*)"/)[1]);
  const SR = 44100, V = (x, y, z) => new T3.Vector3(x, y, z), pos = { clock: V(31.9, 6.4, -34.5), book: V(0, 2, 0) }, HOME = { target: V(0, 10.5, -9), r: 78, th: -0.2, ph: 1.36 };
  // wheel hard into the clock, hold, whip round it, wheel out past the room, whip round, wheel into the book, hold, cut straight home
  const FLIGHT = [
    [4.0, 4.6, g => { g.at = pos.clock; g.zoom(0.825, 0, 0); }],
    [6.0, 7.5, (g, t) => { g.g.th = -0.2 + 1.1 * Math.sin((t - 6) * 7.5); g.g.ph = 1.2 + 0.3 * Math.sin((t - 6) * 5.6); g.limit(); }],
    [7.5, 8.3, g => { g.at = null; g.zoom(1.25); }],
    [8.5, 10, (g, t) => { g.g.th = 1.25 * Math.sin((t - 8.5) * 9.4); g.limit(); }],
    [10, 10.6, g => { g.at = pos.book; g.zoom(0.8, 0, 0); }],
    [12, 12.02, g => g.set(HOME.target, HOME, true)],
  ];
  const render = async ({ T = 15, seed = 7, solo = [], tone = null, fly = false, at = {}, chain = false, step = null }) => {
    const ctx = new OfflineAudioContext(2, T * SR, SR), cam = new T3.PerspectiveCamera(38, 16 / 9, 2, 900), dom = document.createElement('div');
    const rig = new CameraRig(cam, dom, { pick: () => rig.at || null, limits: { rMax: 500 } }); rig.set(HOME.target, HOME, true); rig.home = HOME.target.clone(); cam.updateMatrixWorld(true);
    const A = new Ambience({ camera: cam, positions: pos, context: ctx, seed, now: () => 1.7e12 + ctx.currentTime * 1000, baseUrl: base + 'audio/' });
    A.unlock(); await A.ready; A._solo(solo);
    if (!chain) { A._master.disconnect(); A._master.connect(ctx.destination); } // the stem itself, ahead of the compressors
    if (tone) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = SR / 128 * 3; g.gain.value = 0.1; o.connect(g); o.start(0); // whole cycles in each block: a steady tone reads the same in every one
      if (step) { const s = ctx.createGain(); s.gain.setValueAtTime(1, 0); s.gain.setValueAtTime(2, step); g.connect(s).connect(ctx.destination); A._master.disconnect(); } else g.connect(A._spots[tone]); }
    const dt = 1 / 60, n = Math.floor(T * 60) - 2;
    for (let i = 1; i <= n; i++) ctx.suspend(i * dt).then(() => { const t = i * dt;
      if (fly) for (const [a, z, f] of FLIGHT) if (t >= a && t < z) f(rig, t);
      rig.update(dt); for (const k in at) if (Math.abs(t - k) < dt / 2) at[k](A);
      A.update(dt); cam.updateMatrixWorld(); ctx.resume(); });
    const o = await ctx.startRendering(); return [o.getChannelData(0), o.getChannelData(1)];
  };
  const dB = v => 20 * Math.log10(v + 1e-9), rms = (x, a, n) => { let s = 0; for (let i = a; i < a + n; i++) s += x[i] * x[i]; return Math.sqrt(s / n); };
  const trace = ([l, q], n, from = 3.2) => { const o = []; for (let i = Math.round(from * SR / n) * n; i + n <= l.length; i += n) { const a = rms(l, i, n), c = rms(q, i, n); o.push([i / SR, dB(Math.hypot(a, c)), dB(c) - dB(a)]); } return o; };
  const peak = (x, a = 0, z = x.length) => { let p = 0; for (let i = a; i < z; i++) p = Math.max(p, Math.abs(x[i])); return p; };
  const out = {};
  // steady: flying against still, in 50 ms windows
  for (const [name, o] of [['rain', { solo: ['rain'] }], ['thunder', { solo: ['thunder'], at: { 4.2: A => A.thunder(1), 9: A => A.thunder(3) } }]]) {
    const s = trace(await render(o), 2205), f = trace(await render({ ...o, fly: true }), 2205), live = s.filter(w => w[1] > -70), d = s.map((w, i) => [w[0], f[i][1] - w[1], f[i][2] - w[2]]).filter((_, i) => s[i][1] > -70);
    out[name] = { heard: live.length, level: Math.max(...d.map(w => Math.abs(w[1]))), side: Math.max(...d.map(w => Math.abs(w[2]))), still: s, flying: f };
  }
  // a gentle place: a steady tone at each source, every 128 samples
  const read = tr => { const lv = tr.map(w => w[1]), sd = tr.map(w => w[2]), K = 34; let jump = 0, speed = 0, sideSpeed = 0; // 34 blocks: 0.1 s
    for (let i = 1; i < tr.length; i++) jump = Math.max(jump, Math.abs(lv[i] - lv[i - 1]));
    for (let i = K; i < tr.length; i++) { speed = Math.max(speed, Math.abs(lv[i] - lv[i - K]) / (K * 128 / SR)); sideSpeed = Math.max(sideSpeed, Math.abs(sd[i] - sd[i - K]) / (K * 128 / SR)); }
    return { range: Math.max(...lv) - Math.min(...lv), side: Math.max(...sd) - Math.min(...sd), jump, speed, sideSpeed }; };
  for (const name of ['clock', 'book']) { const tr = trace(await render({ tone: name, fly: true }), 128); out[name] = { ...read(tr), trace: tr.filter((_, i) => i % 8 === 0) }; }
  out.control = read(trace(await render({ T: 6, tone: 'clock', step: 1536 * 128 / SR }), 128)); // a known 6 dB step: the reading must see it
  // the book's sound: one lift, the same for a cover and a page; nothing on landing; a fast run no louder
  const turn = async (lifts, land) => { const at = {}; for (const [t, sheet] of lifts) at[t] = A => A.sheet({ type: 'lift', sheet, board: !sheet }); if (land) at[land[0]] = A => A.sheet({ type: 'land', sheet: land[1], board: !land[1] }); return render({ T: 6.5, solo: ['page'], at }); };
  const first = x => { for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 1e-4) return i; return -1; }, f60 = n => Math.round(n * 60) / 60;
  const A1 = f60(3.5), A2 = f60(4.25), [cover] = await turn([[A1, 0]], [f60(4.6), 0]), [page] = await turn([[A2, 3]], [f60(5.35), 3]), c0 = first(cover), p0 = first(page), len = Math.round(0.72 * SR); let diff = 0; for (let i = 0; i < len; i++) diff = Math.max(diff, Math.abs(cover[c0 + i] - page[p0 + i]));
  const [run] = await turn(Array.from({ length: 8 }, (_, i) => [f60(3.5 + i * 0.2), i]));
  out.turn = { same: dB(diff / peak(page)), delay: c0 / SR - A1, peak: dB(peak(page)), landing: dB(peak(cover, Math.round(f60(4.6) * SR), Math.round((f60(4.6) + 0.25) * SR)) / peak(cover)), run: dB(peak(run)) - dB(peak(page)) };
  return out;
}, base);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(r));
const { rain, thunder, clock, book, control, turn } = r, f = v => v.toFixed(2);
console.log(`rain     flying against still: ${f(rain.level)} dB level, ${f(rain.side)} dB side, over ${rain.heard} windows`);
console.log(`thunder  flying against still: ${f(thunder.level)} dB level, ${f(thunder.side)} dB side, over ${thunder.heard} windows`);
for (const [n, c] of [['clock', clock], ['book', book]]) console.log(`${n.padEnd(8)} moves ${f(c.range)} dB and ${f(c.side)} dB side; at most ${f(c.speed)} dB/s, ${f(c.sideSpeed)} dB side/s; biggest jump between blocks ${f(c.jump)} dB`);
console.log(`control  a 6 dB step reads as a ${f(control.jump)} dB jump`);
console.log(`turn     cover against page ${f(turn.same)} dB; starts ${(turn.delay * 1000).toFixed(0)} ms after the lift; peak ${f(turn.peak)} dBFS; ${f(turn.landing)} dB on landing; a run of 8 peaks ${f(turn.run)} dB over one`);
const fails = [], need = (c, m) => { if (!c) fails.push(m); };
need(rain.heard > 100 && thunder.heard > 100, 'nothing to measure');
need(rain.level < 0.05 && rain.side < 0.05, 'the camera moves the rain'); need(thunder.level < 0.05 && thunder.side < 0.05, 'the camera moves the thunder');
for (const [n, c, range] of [['clock', clock, 9.5], ['book', book, 6.5]]) {
  need(c.range < range, `${n}: level moves too far`); need(c.speed < 3.5, `${n}: level moves too fast`); need(c.sideSpeed < 5, `${n}: side moves too fast`); need(c.jump < 0.1, `${n}: level jumps`);
  need(c.range > 2 && c.side > 2, `${n}: has lost its sense of place`);
}
need(control.jump > 5.5, 'the reading cannot see a jump');
need(turn.same < -60, 'a cover and a page do not make the same sound'); need(turn.delay < 0.04, 'the sound starts late'); need(turn.landing < -20, 'a landing makes a sound of its own'); need(turn.peak < -28, 'the turn is loud'); need(turn.run < 1, 'a run of pages builds up');
console.log('errors', errs); console.log(fails.length ? 'FAIL: ' + fails.join('; ') : 'PASS'); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
