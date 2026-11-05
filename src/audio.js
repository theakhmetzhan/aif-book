// The office at night, heard from the desk: light rain outside, drops ticking on the pane, thunder far off now and
// then, the desk clock, and the book's pages. Kept sparse on purpose: a quiet room is what makes the rain read.
// Recordings in public/audio (see CREDITS.md); the pane ticks are synthesized.
// Units are centimetres, like the scene. Every public method is safe to call before unlock() or without audio.
import * as THREE from 'three';

const FILES = ['rain', 'thunder1', 'thunder2', 'thunder3', 'thunder4', 'page', 'tick', 'tock'];

const dB = d => Math.pow(10, d / 20);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Levels going into each place below.
const LEVEL = {
  rain: dB(-10), drops: dB(-33),
  tick: dB(-9),
  page: dB(-13),
  thunder: dB(-9), reverb: dB(-11),
};

// Where things are heard. Rain and thunder come through the window, off to the right, and stay there whatever the camera does.
const WINDOW = { pan: 0.4, gain: dB(-3) };
// The clock and the book keep a gentle sense of place: `gain` in dB from `ref` cm, 3 dB per doubling of distance, held within lo..hi of that;
// `pan` is as far as they go to one side. FOLLOW is how slowly they get there: a time constant in seconds, then a top speed in dB and in pan per second.
const PLACE = {
  clock: { gain: -15.5, ref: 120, lo: -3, hi: 6, pan: 0.6 },
  book: { gain: -7.5, ref: 70, lo: -3, hi: 3, pan: 0.35 },
};
const FOLLOW = { tau: 1.2, dB: 3, pan: 0.25 };

// equal-power crossfade curves
const N = 128, FADE_IN = new Float32Array(N), FADE_OUT = new Float32Array(N);
for (let i = 0; i < N; i++) { const a = (i / (N - 1)) * Math.PI / 2; FADE_IN[i] = Math.sin(a); FADE_OUT[i] = Math.cos(a); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Ambience {
  /**
   * @param {object} o
   * @param {THREE.Camera} o.camera   the clock and the book are placed from it
   * @param {object} o.positions      { clock, book } in world cm (Vector3 or {x,y,z})
   * @param {boolean} [o.enabled=true]
   * @param {string} [o.baseUrl]      where the mp3s live (defaults to <vite base>/audio/)
   * @param {BaseAudioContext} [o.context]  e.g. an OfflineAudioContext for rendering tests
   * @param {number} [o.seed]         makes the random events repeatable
   * @param {() => number} [o.now]    wall clock in ms for the desk clock (defaults to Date.now)
   */
  constructor({ camera = null, positions = {}, enabled = true, baseUrl, context = null, seed, now } = {}) {
    const v = (p, x, y, z) => new THREE.Vector3(p?.x ?? x, p?.y ?? y, p?.z ?? z);
    const P = positions || {};
    this.camera = camera;
    this.pos = { clock: v(P.clock, 52, 6, -32), book: v(P.book, 0, 2, 0) };
    this._v = new THREE.Vector3(); this._right = new THREE.Vector3();
    this._enabled = enabled !== false;
    this._ctxOpt = context;
    this._now = typeof now === 'function' ? now : () => Date.now();
    let base = baseUrl;
    if (base == null) { try { base = (import.meta.env?.BASE_URL ?? '/') + 'audio/'; } catch { base = 'audio/'; } }
    this._base = base;
    this._r = mulberry32(seed ?? (Math.random() * 2 ** 32));
    this._buf = {}; this._loops = []; this._pending = new Set(); this._groups = {};
    this._acc = 0;
    this.ready = Promise.resolve();
    this._onVis = e => this._safe(() => (e?.type === 'pagehide' ? this._sleep(0.05) : this._visibility()));
    this._kick = () => this._safe(() => this._resume());
  }

  get enabled() { return this._enabled; }
  get unlocked() { return !!this._ctx; }

  /** First user gesture: create or resume the context, load the files, fade the beds in. Idempotent. */
  unlock() {
    if (this._dead) return this.ready;
    if (this._ctx) { this._safe(() => this._resume()); return this.ready; }
    try {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      const ctx = this._ctxOpt || (AC ? new AC() : null);
      if (!ctx) { this._dead = true; return this.ready; }
      this._ctx = ctx;
      this._offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
      this._build();
      const t = ctx.currentTime, g = this._master.gain;
      g.setValueAtTime(0, t); this._target = 0;
      if (this._enabled) { g.linearRampToValueAtTime(1, t + 3); this._target = 1; }
      if (!this._offline) {
        // iOS wants a sound started inside the gesture
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start();
        if (this._enabled && !document.hidden) ctx.resume?.().catch(() => {}); else ctx.suspend?.().catch(() => {});
        document.addEventListener('visibilitychange', this._onVis);
        addEventListener('pagehide', this._onVis); addEventListener('pageshow', this._onVis);
        addEventListener('pointerdown', this._kick, { passive: true }); addEventListener('keydown', this._kick);
        this._timer = setInterval(() => this._safe(() => this._pump()), 500);
      }
      this.ready = this._load().then(() => this._safe(() => this._startFiles()));
      this._pump();
    } catch (e) { this._fail(e); }
    return this.ready;
  }

  /** Mute or unmute with a 0.5 s fade; the context sleeps while muted. */
  setEnabled(on) {
    this._enabled = !!on;
    if (!this._ctx) return;
    this._safe(() => { if (this._enabled) this._wake(); else this._sleep(0.5); });
  }

  /** The book's sheet events: a sheet leaving its stack ('lift') or settling on one ('land'). Pages and covers alike make the
   *  one sound, exactly the same every time: it starts as a sheet lifts, and gives way when the next one lifts, so a fast run of pages stays quiet. */
  sheet({ type, sheet } = {}) {
    this._early = null; // a turn still waiting on its recording is stale once anything else happens, heard or not
    this._safe(() => {
      if (!this._live()) return;
      const t = this._turning;
      if (t && (type === 'lift' || t.sheet === sheet)) { t.g.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05); this._turning = null; }
      if (type === 'lift') { this._turning = this._turn(sheet); if (!this._turning) this._early = { sheet }; } // recording still decoding: start once it arrives
    });
  }

  _turn(sheet) {
    const b = this._buf.page; if (!b || !this._live()) return null;
    b.__onset ??= onset(b); // the file opens on a few hundredths of a second of silence
    return { sheet, g: this._one(b, this._ctx.currentTime + 0.005, 1, this._grp('page', this._spots.book), LEVEL.page, Math.max(0, b.__onset - 0.03)) };
  }

  /** Lightning just flashed distanceKm away: the thunder arrives distance / 0.343 s later. */
  thunder(distanceKm = 3) {
    this._safe(() => {
      if (!this._live()) return;
      const km = clamp(+distanceKm || 3, 0.3, 30), ctx = this._ctx, r = this._r;
      const t = ctx.currentTime + km / 0.343;
      const pick = km < 2.2 ? ['thunder1'] : km < 6 ? ['thunder2', 'thunder3'] : ['thunder4', 'thunder3'];
      let name = pick[Math.floor(r() * pick.length)];
      if (!this._buf[name]) name = ['thunder1', 'thunder2', 'thunder3', 'thunder4'].find(n => this._buf[n]);
      if (!name) return;
      // air soaks up the highs with distance; the near ones are louder but held well under the ceiling
      const lp = this._biquad('lowpass', clamp(15000 / (1 + km * 1.15), 450, 11000), 0.5);
      const g = LEVEL.thunder * clamp(Math.pow(2.2 / (km + 1.2), 0.75), 0.18, 1);
      this._one(this._buf[name], t, 1 - Math.min(0.1, km * 0.012), lp);
      const dir = this._gain(g * 0.75), room = this._gain(g * 0.5), lows = this._biquad('lowpass', 220, 0.6);
      lp.connect(dir).connect(this._grp('thunder', this._spots.window));
      lp.connect(lows).connect(room).connect(this._grp('thunder', this._in));
      this._rainBoost(t + 0.5);
    });
  }

  /** Every frame. */
  update(dt = 1 / 60) {
    if (!this._ctx || this._dead) return;
    this._safe(() => {
      this._follow(dt);
      this._acc += dt;
      if (this._acc > 0.1) { this._acc = 0; this._pump(); this._place(); }
    });
  }

  dispose() {
    this._dead = true; clearInterval(this._timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis);
    if (typeof window !== 'undefined') { removeEventListener('pagehide', this._onVis); removeEventListener('pageshow', this._onVis); removeEventListener('pointerdown', this._kick); removeEventListener('keydown', this._kick); }
    try { if (!this._offline) this._ctx?.close(); } catch { /* already gone */ }
  }

  // ------------------------------------------------------------------ plumbing

  _safe(f) { try { return f(); } catch (e) { this._fail(e); } }
  _fail(e) { if (!this._warned) { this._warned = true; console.info('[audio] off:', e?.message || e); } }
  _live() { return !!this._ctx && !this._dead && this._enabled && this._ctx.state !== 'closed' && (this._offline || !document.hidden); }
  _gain(v = 1) { const g = this._ctx.createGain(); g.gain.value = v; return g; }
  _biquad(type, f, q = 0.7, gain = 0) { const b = this._ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }
  _grp(name, dest) {
    const key = name + ':' + (dest.__id ??= Math.random()); let g = this._groups[key];
    if (!g) { g = this._groups[key] = this._gain(!this._soloed || this._soloed.includes(name) ? 1 : 0); g.__group = name; g.connect(dest); }
    return g;
  }
  /** Mute everything but these groups (for rendering stems). */
  _solo(names) { for (const g of Object.values(this._groups)) g.gain.value = names.includes(g.__group) ? 1 : 0; this._soloed = names; }
  _track(s, nodes = []) { this._pending.add(s); s.onended = () => { this._pending.delete(s); try { s.disconnect(); nodes.forEach(n => n.disconnect()); } catch { /* fine */ } }; }
  /** One-shot buffer at time t. Connects to dest, optionally through a gain, which it returns. */
  _one(buf, t, rate = 1, dest, gain, offset = 0) {
    if (!buf || !dest) return;
    const ctx = this._ctx, s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    let out = s, g = null;
    if (gain != null) { g = this._gain(gain); s.connect(g); out = g; }
    out.connect(dest);
    s.start(Math.max(t, ctx.currentTime), offset); this._track(s, g ? [g] : []);
    return g;
  }
  _ramp(to, dur) { const g = this._master.gain, t = this._ctx.currentTime; this._target = to; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + dur); }

  _sleep(fade) {
    if (!this._ctx) return;
    this._ramp(0, fade);
    if (this._offline) return;
    clearTimeout(this._susT);
    this._susT = setTimeout(() => this._safe(() => {
      for (const s of this._pending) { try { s.stop(); } catch { /* not started */ } }
      this._pending.clear(); this._tickSec = null;
      this._ctx.suspend?.().catch(() => {});
    }), fade * 1000 + 80);
  }
  _wake() {
    if (!this._ctx || this._dead || !this._enabled || (!this._offline && document.hidden)) return;
    clearTimeout(this._susT);
    if (!this._offline && this._ctx.state !== 'running') this._ctx.resume?.().catch(() => {});
    if (this._target !== 1) this._ramp(1, 0.5);
  }
  /** Only nudge a context the browser paused (iOS interruptions); never touches the fades. */
  _resume() { if (this._ctx && !this._offline && this._enabled && !document.hidden && this._ctx.state !== 'running' && this._ctx.state !== 'closed') this._ctx.resume?.().catch(() => {}); }
  _visibility() { if (document.hidden) this._sleep(0.12); else this._wake(); }
  /** Where the camera would put a source: how far to one side, and how many dB from its level at `ref`. */
  _heard(name) {
    const cam = this.camera; if (!cam) return { pan: 0, dB: 0 };
    const P = PLACE[name], v = this._v.copy(this.pos[name]).sub(cam.position), d = Math.max(v.length(), 1);
    return { pan: P.pan * v.dot(this._right.set(1, 0, 0).applyQuaternion(cam.quaternion)) / d, dB: clamp(3 * Math.log2(P.ref / d), P.lo, P.hi) };
  }
  /** The clock and the book drift toward where the camera puts them, however fast it moves. */
  _follow(dt) {
    const k = 1 - Math.exp(-dt / FOLLOW.tau), step = (a, b, top) => a + clamp((b - a) * k, -top * dt, top * dt);
    for (const name in PLACE) {
      const s = this._at[name], h = this._heard(name);
      s.pan = step(s.pan, h.pan, FOLLOW.pan); s.dB = step(s.dB, h.dB, FOLLOW.dB);
    }
  }
  /** Hands the drift to the audio thread, ten times a second and only when it has moved: a suspended context would keep every event it was given. */
  _place() {
    const ctx = this._ctx; if (!this._offline && ctx.state !== 'running') return;
    const ease = (param, v) => { if (!(Math.abs(param.__to - v) < 1e-3)) { param.__to = v; param.setTargetAtTime(v, ctx.currentTime, 0.05); } };
    for (const name in PLACE) { const s = this._at[name], n = this._spots[name]; ease(n.__pan, s.pan); ease(n.__gain, dB(PLACE[name].gain + s.dB)); }
  }

  _load() {
    const ctx = this._ctx;
    const decode = ab => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p?.then) p.then(res, rej); });
    return Promise.all(FILES.map(n => fetch(this._base + n + '.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(n)))).then(decode)
      .then(b => { this._buf[n] = b; const e = this._early; if (e && n === 'page') this._safe(() => { this._early = null; this._turning = this._turn(e.sheet); }); }).catch(() => { /* that sound stays out */ })));
  }

  // ------------------------------------------------------------------ the graph

  _build() {
    const ctx = this._ctx;
    // master: fade → rumble cut → gentle glue → limiter → soft ceiling. Chrome and Safari add automatic makeup gain
    // to DynamicsCompressor (about +5 dB here, +3.4 dB on the limiter); the trims take it back out, so the limiter
    // starts working near -5 dBFS at the output and the clipper never lets anything past about -4 dBFS.
    this._master = this._in = this._gain(1);
    const hp = this._biquad('highpass', 24, 0.6);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 2; comp.attack.value = 0.02; comp.release.value = 0.4;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    const trimA = this._gain(dB(-1.5)), trimB = this._gain(dB(-2.5)), clip = ctx.createWaveShaper();
    const n = 2049, curve = new Float32Array(n), lin = 0.5, top = 0.63;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a <= lin ? a : lin + (top - lin) * Math.tanh((a - lin) / (top - lin))); }
    clip.curve = curve; clip.oversample = '2x';
    this._master.connect(hp).connect(comp).connect(trimA).connect(lim).connect(trimB).connect(clip).connect(ctx.destination);
    // a small dark office
    this._rev = ctx.createConvolver(); this._rev.buffer = this._ir(1.3, 0.55);
    this._rev.connect(this._gain(LEVEL.reverb)).connect(this._in);
    this._bank = this._makeBanks();
    // where things are: a level and a side, the room's reverb taken before either
    const spot = (gain, pan, send) => {
      const input = this._gain(1), out = this._gain(gain), pn = ctx.createStereoPanner(); pn.pan.value = pan;
      input.connect(out).connect(pn).connect(this._in);
      if (send) input.connect(this._gain(send)).connect(this._rev);
      input.__gain = out.gain; input.__pan = pn.pan;
      return input;
    };
    this._at = { clock: this._heard('clock'), book: this._heard('book') }; // where the clock and the book are heard right now; _follow moves these
    const place = (name, send) => spot(dB(PLACE[name].gain + this._at[name].dB), this._at[name].pan, send);
    this._spots = { window: spot(WINDOW.gain, WINDOW.pan, 0.3), clock: place('clock', 0.12), book: place('book', 0.12) };
    const now = ctx.currentTime;

    // rain: one bed from the recording once it is decoded (_startFiles); the level wanders and swells after thunder.
    // A gentle low cut keeps it a patter outside the glass rather than a roar in the room.
    this._rainMod = this._gain(1); this._rainLP = this._biquad('lowpass', 9000, 0.5); const rainHP = this._biquad('highpass', 160, 0.6);
    this._rainLP.connect(rainHP).connect(this._rainMod).connect(this._grp('rain', this._spots.window));
    this._rainT = now + 6; this._dropT = now + 1;
    this._tickSec = null;
  }

  _startFiles() {
    const b = this._buf.rain; if (!b || this._rainOn) return; this._rainOn = true;
    this._loop(b, this._rainLP, LEVEL.rain, 12, 24, 4, 1);
    for (const n of ['tick', 'tock']) { const t = this._buf[n]; if (t) t.__onset = onset(t); }
  }

  /** A bed from one recording: random stretches, each faded in and out with equal-power curves, two always overlapping. */
  _loop(buf, dest, level, segMin, segMax, xf, rate) {
    const out = this._gain(level); out.connect(dest);
    const L = { buf, out, segMin, segMax, xf, rate, next: this._ctx.currentTime + 0.05 };
    this._loops.push(L); this._pumpLoop(L);
  }
  _pumpLoop(L) {
    const ctx = this._ctx, now = ctx.currentTime, r = this._r;
    if (L.next < now) L.next = now + 0.05;
    while (L.next < now + 8) {
      const maxDur = L.buf.duration / L.rate - 0.2;
      const dur = Math.min(maxDur, L.segMin + r() * (L.segMax - L.segMin));
      const span = dur * L.rate, off = r() * Math.max(0, L.buf.duration - span - 0.1), t = L.next;
      const s = ctx.createBufferSource(); s.buffer = L.buf; s.playbackRate.value = L.rate;
      const e = this._gain(0); s.connect(e).connect(L.out);
      e.gain.setValueCurveAtTime(FADE_IN, t, L.xf);
      e.gain.setValueCurveAtTime(FADE_OUT, t + dur - L.xf, L.xf);
      s.start(t, off, span + 0.05); s.stop(t + dur + 0.05);
      s.onended = () => { try { s.disconnect(); e.disconnect(); } catch { /* fine */ } };
      L.next = t + dur - L.xf; this._seamLog?.push(t);
    }
  }

  /** The scheduler: keeps the bed fed and decides when the next drop or tick happens. */
  _pump() {
    const ctx = this._ctx; if (!ctx || this._dead) return;
    const now = ctx.currentTime, r = this._r;
    for (const L of this._loops) this._pumpLoop(L);
    this._pumpTicks();
    if (!this._live() && !this._offline) return;
    // rain wanders by a few dB, brighter when heavier
    if (now > this._rainT) {
      const k = this._boostUntil > now ? 1.35 : dB(-2.5 + r() * 4.5), tc = 3 + r() * 4;
      this._rainMod.gain.setTargetAtTime(k, now, tc);
      this._rainLP.frequency.setTargetAtTime(5500 + 5000 * clamp((k - 0.7) / 0.7, 0, 1), now, tc);
      this._rainT = now + 6 + r() * 9;
    }
    // drops ticking on the glass, more when the rain is heavier
    if (this._rainOn) while (this._dropT < now + 0.6) {
      const t = Math.max(this._dropT, now + 0.01);
      this._one(this._bank.drop[Math.floor(r() * this._bank.drop.length)], t, 0.8 + r() * 0.5, this._grp('rain', this._spots.window), LEVEL.drops * (0.25 + r() * 0.75) * this._rainMod.gain.value);
      this._dropT = t - Math.log(1 - r()) / (2.5 + 3 * this._rainMod.gain.value);
    }
  }

  // ------------------------------------------------------------------ the clock

  /** Context time at which wall-clock ms will be heard. */
  _ctxAt(ms, nowMs) {
    const ctx = this._ctx;
    if (!this._offline && ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (performance.now() + (ms - nowMs) - ts.performanceTime) / 1000;
    }
    return ctx.currentTime + (ms - nowMs) / 1000;
  }
  _pumpTicks() {
    const ctx = this._ctx;
    if (!this._live() || (!this._offline && ctx.state !== 'running') || !this._buf.tick) return;
    const nowMs = this._now();
    if (this._tickSec == null || this._tickSec * 1000 < nowMs - 1500) this._tickSec = Math.floor(nowMs / 1000) + 1;
    for (let i = 0; i < 4; i++) {
      const sec = this._tickSec, t = this._ctxAt(sec * 1000, nowMs);
      if (t > ctx.currentTime + 0.6) break;
      if (t > ctx.currentTime + 0.002) this._tick(t, sec % 2 === 0);
      this._tickSec++;
    }
  }
  _tick(t, strong) {
    const b = (strong ? this._buf.tick : this._buf.tock) || this._buf.tick, r = this._r;
    this._one(b, t - (b.__onset || 0), 1 + (r() - 0.5) * 0.012, this._grp('clock', this._spots.clock), LEVEL.tick * dB((r() - 0.5) * 1.2));
  }

  // ------------------------------------------------------------------ weather

  _rainBoost(t) { this._boostUntil = t + 14; this._rainT = Math.min(this._rainT, t); }

  // ------------------------------------------------------------------ synthesis

  /** Short buffers made of decaying partials and a noise transient. */
  _makeBanks() {
    const ctx = this._ctx, sr = ctx.sampleRate, r = this._r;
    const make = (sec, fn) => {
      const n = Math.floor(sec * sr), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); fn(d, n);
      let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
      const g = pk > 0 ? 0.9 / pk : 0, fo = Math.min(n, Math.floor(0.004 * sr));
      for (let i = 0; i < n; i++) d[i] *= g * (i >= n - fo ? (n - i) / fo : 1);
      return b;
    };
    const modes = (d, n, at, parts, noiseAmp, noiseTau, lpK = 1) => {
      let lp = 0; const s0 = Math.floor(at * sr);
      for (let i = s0; i < n; i++) {
        const t = (i - s0) / sr; let v = 0;
        for (const [f, a, tau, ph] of parts) v += a * Math.sin(2 * Math.PI * f * t + ph) * Math.exp(-t / tau);
        lp += lpK * ((r() * 2 - 1) - lp); v += noiseAmp * lp * Math.exp(-t / noiseTau);
        d[i] += v * Math.min(1, t / 0.0006);
      }
    };
    const bank = (count, fn) => Array.from({ length: count }, fn);
    return {
      // a raindrop hitting the pane
      drop: bank(10, () => make(0.04, (d, n) => { modes(d, n, 0, [[2400 + r() * 3200, 0.35, 0.0035, r() * 6]], 1, 0.0008, 0.6); })),
    };
  }

  /** Room impulse: decaying noise that darkens as it fades. */
  _ir(sec, rt) {
    const ctx = this._ctx, sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(2, n, sr), r = this._r;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, k = 0.5 - 0.42 * Math.min(1, t / 0.8); lp += k * ((r() * 2 - 1) - lp); d[i] = t < 0.006 ? 0 : lp * Math.exp((-6.91 * t) / rt); }
    }
    return b;
  }
}

/** Seconds from the start of a buffer to its first real transient. */
function onset(b) {
  const d = b.getChannelData(0); let pk = 0;
  for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > pk * 0.25) return i / b.sampleRate;
  return 0;
}
