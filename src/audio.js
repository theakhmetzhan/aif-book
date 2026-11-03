// The office at night, heard from the desk: rain on the window, wind at the sash and the blinds, a wet city far off,
// the desk clock, the lamp's hum, a steam radiator, and the book's card pages. Recordings where they exist
// (public/audio, see CREDITS.md), WebAudio synthesis for the rest. No music, no voices, nothing alive.
// Units are centimetres, like the scene. Every public method is safe to call before unlock() or without audio.
import * as THREE from 'three';

const FILES = ['rain', 'thunder1', 'thunder2', 'thunder3', 'thunder4', 'page1', 'page2', 'page3', 'paper', 'tick', 'tock', 'siren', 'horn', 'train'];

const dB = d => Math.pow(10, d / 20);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Pre-panner levels. The panners then attenuate by distance (inverse law, ref/rolloff per source below).
const LEVEL = {
  rain: dB(-8), rainWash: dB(-14), drops: dB(-32),
  wind: dB(-15), draught: dB(-27), rattle: dB(-25), blinds: dB(-31),
  city: dB(-32), car: dB(-37), train: dB(-35), siren: dB(-52), horn: dB(-47), sirenRec: dB(-40), hornRec: dB(-36),
  tick: dB(-15), hum: dB(-43), crackle: dB(-42),
  hiss: dB(-29), clank: dB(-19), creakR: dB(-33),
  page: dB(-5), thump: dB(-20), paper: dB(-13), creak: dB(-25),
  thunder: dB(-6.5), reverb: dB(-11),
};

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
   * @param {THREE.Camera} o.camera   the listener rides on it
   * @param {object} o.positions      { clock, lamp, mug, book, window, radiator } in world cm (Vector3 or {x,y,z})
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
    this.pos = {
      clock: v(P.clock, 52, 6, -32), lamp: v(P.lamp, -46, 22, -30), mug: v(P.mug, 34, 8, -16), book: v(P.book, 0, 2, 0),
      window: v(P.window, 160, 110, 60), radiator: v(P.radiator, -170, 30, -20),
    };
    this._enabled = enabled !== false;
    this._ctxOpt = context;
    this._now = typeof now === 'function' ? now : () => Date.now();
    let base = baseUrl;
    if (base == null) { try { base = (import.meta.env?.BASE_URL ?? '/') + 'audio/'; } catch { base = 'audio/'; } }
    this._base = base;
    this._r = mulberry32(seed ?? (Math.random() * 2 ** 32));
    this._buf = {}; this._loops = []; this._pending = new Set(); this._groups = {};
    this._lampK = 1; this._lampSet = -1; this._lampPrev = 1; this._crackT = 0;
    this._paperT = -1; this._pageLast = -1; this._acc = 0;
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
      THREE.AudioContext.setContext(ctx);
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

  /** A stiff card page turning: swish, then a soft landing. speed 0.5 (slow) .. 2 (flicked). */
  pageTurn(speed = 1) {
    this._safe(() => {
      if (!this._live()) return;
      const s = clamp(+speed || 1, 0.5, 2), ctx = this._ctx, r = this._r, t = ctx.currentTime + 0.01;
      const names = ['page1', 'page2', 'page3'].filter(n => this._buf[n]);
      if (!names.length) return;
      let i = Math.floor(r() * names.length); if (names.length > 1 && i === this._pageLast) i = (i + 1) % names.length; this._pageLast = i;
      const b = this._buf[names[i]], rate = clamp(0.84 + 0.13 * s, 0.9, 1.12) * (1 + (r() - 0.5) * 0.04);
      const body = this._biquad('lowshelf', 260, 0.7, 3.5 - s), air = this._biquad('highshelf', 4500, 0.7, -2 + 1.5 * s);
      const g = this._gain(LEVEL.page * dB(-5 + 5 * Math.log2(s + 1) / Math.log2(3)));
      this._one(b, t, rate, body); body.connect(air).connect(g).connect(this._grp('page', this._spots.book));
      // card landing on card: low, short, soft
      this._one(this._bank.thump[Math.floor(r() * this._bank.thump.length)], t + (b.duration * 0.72) / rate, 0.9 + r() * 0.2, this._grp('page', this._spots.book), LEVEL.thump * (0.6 + 0.25 * s));
    });
  }

  /** Pop-up paper unfolding or folding: rustle and fibre creak, amount 0..1. Rate-limited. */
  paper(amount = 0.5) {
    this._safe(() => {
      if (!this._live()) return;
      const a = clamp(+amount || 0, 0, 1); if (a < 0.03) return;
      const ctx = this._ctx, r = this._r, now = ctx.currentTime;
      if (now - this._paperT < 0.16 - 0.08 * a) return;
      this._paperT = now;
      const dest = this._grp('page', this._spots.book), b = this._buf.paper;
      if (b) {
        const dur = 0.14 + 0.5 * a * (0.6 + 0.4 * r()), rate = 0.85 + r() * 0.3, off = r() * Math.max(0, b.duration - dur * rate - 0.05);
        const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
        const e = this._gain(0), hp = this._biquad('highpass', 300 + 500 * (1 - a), 0.6);
        s.connect(hp).connect(e).connect(dest);
        const pk = LEVEL.paper * Math.pow(a, 0.8);
        e.gain.setValueAtTime(0, now); e.gain.linearRampToValueAtTime(pk, now + 0.02); e.gain.setTargetAtTime(0, now + dur * 0.45, dur * 0.2);
        s.start(now, off, dur * rate + 0.1); s.stop(now + dur + 0.6); this._track(s, [hp, e]);
      }
      if (r() < 0.2 + 0.6 * a) this._one(this._bank.creak[Math.floor(r() * this._bank.creak.length)], now + 0.02 + r() * 0.12, 0.85 + r() * 0.35, dest, LEVEL.creak * (0.4 + 0.6 * a));
    });
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
      if (km < 3.5) this._rattle(t + 0.05, 0.4 + 0.5 * (1 - km / 3.5), 0.9);
      this._rainBoost(t + 0.5);
    });
  }

  /** Lamp brightness around 1; the hum follows the flicker, and sharp dips crackle. */
  lamp(k = 1) { this._lampK = clamp(+k || 0, 0, 2); }

  /** Every frame. */
  update(dt = 1 / 60) {
    if (!this._ctx || this._dead) return;
    this._safe(() => {
      const ctx = this._ctx, now = ctx.currentTime, k = this._lampK;
      if (this._offline || ctx.state === 'running') this.listener.updateMatrixWorld(true);
      if (Math.abs(k - this._lampSet) > 0.002) {
        this._hum.gain.setTargetAtTime(Math.pow(k, 1.5), now, 0.03); this._lampSet = k;
        if (this._lampPrev - k > 0.06 && now - this._crackT > 0.25 && this._live()) { this._crackT = now; this._crackle(now + 0.005); }
      }
      this._lampPrev = k;
      this._acc += dt;
      if (this._acc > 0.1) { this._acc = 0; this._pump(); }
    });
  }

  dispose() {
    this._dead = true; clearInterval(this._timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis);
    if (typeof window !== 'undefined') { removeEventListener('pagehide', this._onVis); removeEventListener('pageshow', this._onVis); removeEventListener('pointerdown', this._kick); removeEventListener('keydown', this._kick); }
    try { this.listener?.removeFromParent(); if (!this._offline) this._ctx?.close(); } catch { /* already gone */ }
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
  /** One-shot buffer at time t. Returns nothing; connects to dest (optionally through a gain). */
  _one(buf, t, rate = 1, dest, gain) {
    if (!buf || !dest) return;
    const ctx = this._ctx, s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    let out = s, g = null;
    if (gain != null) { g = this._gain(gain); s.connect(g); out = g; }
    out.connect(dest);
    s.start(Math.max(t, ctx.currentTime)); this._track(s, g ? [g] : []);
  }
  _noise(kind, dest) { const s = this._ctx.createBufferSource(); s.buffer = this._nz[kind]; s.loop = true; s.connect(dest); s.start(this._ctx.currentTime, this._r() * s.buffer.duration * 0.9); return s; }
  _ramp(to, dur) { const g = this._master.gain, t = this._ctx.currentTime; this._target = to; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + dur); }

  _sleep(fade) {
    if (!this._ctx) return;
    this._ramp(0, fade);
    if (this._offline) return;
    clearTimeout(this._susT);
    this._susT = setTimeout(() => this._safe(() => {
      for (const s of this._pending) { try { s.stop(); } catch { /* not started */ } }
      this._pending.clear(); this._tickSec = null; this._attach(false);
      this._ctx.suspend?.().catch(() => {});
    }), fade * 1000 + 80);
  }
  _wake() {
    if (!this._ctx || this._dead || !this._enabled || (!this._offline && document.hidden)) return;
    clearTimeout(this._susT); this._attach(true);
    if (!this._offline && this._ctx.state !== 'running') this._ctx.resume?.().catch(() => {});
    if (this._target !== 1) this._ramp(1, 0.5);
  }
  /** Only nudge a context the browser paused (iOS interruptions); never touches the fades. */
  _resume() { if (this._ctx && !this._offline && this._enabled && !document.hidden && this._ctx.state !== 'running' && this._ctx.state !== 'closed') this._ctx.resume?.().catch(() => {}); }
  _visibility() { if (document.hidden) this._sleep(0.12); else this._wake(); }
  /** The listener rides the camera only while the context runs: a suspended context never prunes the position ramps
   *  three schedules on every rendered frame, so they would pile up for as long as the sound is off. */
  _attach(on) {
    const L = this.listener; if (!L) return;
    if (on && this.camera?.add && L.parent !== this.camera) { this.camera.add(L); L.updateMatrixWorld(true); }
    else if (!on && L.parent) L.removeFromParent();
  }

  _load() {
    const ctx = this._ctx;
    const decode = ab => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p?.then) p.then(res, rej); });
    return Promise.all(FILES.map(n => fetch(this._base + n + '.mp3').then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(n)))).then(decode)
      .then(b => { this._buf[n] = b; }).catch(() => { /* that sound stays out */ })));
  }

  // ------------------------------------------------------------------ the graph

  _build() {
    const ctx = this._ctx, r = this._r;
    const L = this.listener = new THREE.AudioListener();
    this._attach(this._enabled || this._offline);
    // master: fade → rumble cut → gentle glue → limiter → soft ceiling. Chrome and Safari add automatic makeup gain
    // to DynamicsCompressor (about +5 dB here, +3.4 dB on the limiter); the trims take it back out, so the limiter
    // starts working near -5 dBFS at the output and the clipper never lets anything past about -4 dBFS.
    L.gain.disconnect();
    this._master = L.gain; this._in = L.getInput();
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
    // noise
    this._nz = { white: this._noiseBuf('white', 3), pink: this._noiseBuf('pink', 7), brown: this._noiseBuf('brown', 7) };
    this._bank = this._makeBanks();
    // where things are: ref distance and rolloff in cm
    const spot = (p, ref, roll, hrtf, send) => {
      const pn = ctx.createPanner(); pn.panningModel = hrtf ? 'HRTF' : 'equalpower'; pn.distanceModel = 'inverse';
      pn.refDistance = ref; pn.rolloffFactor = roll; pn.maxDistance = 1e5;
      if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
      const input = this._gain(1); input.connect(pn).connect(this._in);
      if (send) input.connect(this._gain(send)).connect(this._rev);
      return input;
    };
    this._spots = {
      window: spot(this.pos.window, 120, 0.6, false, 0.3),
      clock: spot(this.pos.clock, 20, 1, true, 0.12),
      lamp: spot(this.pos.lamp, 12, 1, true, 0),
      radiator: spot(this.pos.radiator, 60, 0.8, false, 0.45),
      book: spot(this.pos.book, 30, 1, true, 0.12),
    };
    const now = ctx.currentTime;

    // rain: two layers come in once the file is decoded (_startFiles); the level wanders and swells after thunder
    this._rainMod = this._gain(1); this._rainLP = this._biquad('lowpass', 9000, 0.5);
    this._rainLP.connect(this._rainMod).connect(this._grp('rain', this._spots.window));
    this._washMod = this._gain(1); this._washMod.connect(this._grp('rain', this._in));
    this._rainT = now + 6; this._dropT = now + 1;

    // wind: a low body and a thin draught through the sash, both breathing with each gust
    const w = this._wind = {};
    w.bp = this._biquad('bandpass', 320, 0.55); w.lp = this._biquad('lowpass', 1100, 0.5); w.env = this._gain(0.07);
    this._noise('pink', w.bp); w.bp.connect(w.lp).connect(w.env).connect(this._gain(LEVEL.wind)).connect(this._grp('wind', this._spots.window));
    w.bp2 = this._biquad('bandpass', 1600, 0.9); w.env2 = this._gain(0.02);
    this._noise('pink', w.bp2); w.bp2.connect(w.env2).connect(this._gain(LEVEL.draught)).connect(this._grp('wind', this._spots.window));
    this._gustT = now + 4 + r() * 10;

    // the city: a low wet rumble through the glass, tyres on wet streets now and then
    this._cityMod = this._gain(1);
    const c1 = this._biquad('lowpass', 150, 0.6), c2 = this._biquad('lowpass', 150, 0.6), c3 = this._biquad('highpass', 28, 0.6);
    this._noise('brown', c1); c1.connect(c2).connect(c3).connect(this._cityMod).connect(this._gain(LEVEL.city)).connect(this._grp('city', this._in));
    this._cityT = now + 5; this._carT = now + 3 + r() * 12;
    this._trainT = now + 70 + r() * 200; this._sirenT = now + 160 + r() * 300; this._hornT = now + 110 + r() * 260;

    // the lamp: 60 Hz mains, mostly its 120 Hz magnetostriction, and a little buzz
    this._hum = this._gain(1);
    const hum = this._gain(LEVEL.hum);
    for (const [f, a, type] of [[60, 0.35, 'sine'], [120, 1, 'sine'], [180, 0.12, 'sine'], [240, 0.3, 'sine'], [360, 0.08, 'sine']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(this._gain(a)).connect(this._hum); o.start(now);
    }
    const buzz = ctx.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = 120;
    buzz.connect(this._biquad('bandpass', 2400, 0.8)).connect(this._gain(0.025)).connect(this._hum); buzz.start(now);
    this._hum.connect(hum).connect(this._grp('lamp', this._spots.lamp));

    // the radiator: first knock comes within the first minute
    this._radT = now + 20 + r() * 30;
    this._tickSec = null;
  }

  _startFiles() {
    const b = this._buf.rain; if (!b || this._rainOn) return; this._rainOn = true;
    this._loop(b, this._rainLP, LEVEL.rain, 10, 19, 4, 1);
    const wl = this._biquad('lowpass', 1000, 0.5); wl.connect(this._washMod);
    this._loop(b, wl, LEVEL.rainWash, 12, 21, 5, 0.94);
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

  /** The scheduler: keeps the beds fed and decides when the next gust, car, knock or tick happens. */
  _pump() {
    const ctx = this._ctx; if (!ctx || this._dead) return;
    const now = ctx.currentTime, r = this._r, ahead = now + 1;
    for (const L of this._loops) this._pumpLoop(L);
    this._pumpTicks();
    if (!this._live() && !this._offline) return;
    // rain wanders by a few dB, brighter when heavier
    if (now > this._rainT) {
      const k = this._boostUntil > now ? 1.35 : dB(-2.5 + r() * 4.5), tc = 3 + r() * 4;
      this._rainMod.gain.setTargetAtTime(k, now, tc); this._washMod.gain.setTargetAtTime(k, now, tc * 1.3);
      this._rainLP.frequency.setTargetAtTime(5500 + 5000 * clamp((k - 0.7) / 0.7, 0, 1), now, tc);
      this._rainT = now + 6 + r() * 9;
    }
    // drops ticking on the glass, more when the rain is heavier
    if (this._rainOn) while (this._dropT < now + 0.6) {
      const t = Math.max(this._dropT, now + 0.01);
      this._one(this._bank.drop[Math.floor(r() * this._bank.drop.length)], t, 0.8 + r() * 0.5, this._grp('rain', this._spots.window), LEVEL.drops * (0.25 + r() * 0.75) * this._rainMod.gain.value);
      this._dropT = t - Math.log(1 - r()) / (2.5 + 3 * this._rainMod.gain.value);
    }
    if (now > this._cityT) { this._cityMod.gain.setTargetAtTime(dB(-2 + r() * 4), now, 4); this._cityT = now + 5 + r() * 8; }
    if (ahead > this._gustT) this._gust(Math.max(this._gustT, now + 0.05));
    if (ahead > this._carT) { this._car(Math.max(this._carT, now + 0.05)); this._carT = now + 7 + r() * 22; }
    if (ahead > this._radT) { this._radiator(Math.max(this._radT, now + 0.05)); this._radT = now + 45 + r() * 80; }
    if (ahead > this._trainT) { this._train(Math.max(this._trainT, now + 0.05)); this._trainT = now + 200 + r() * 300; }
    if (ahead > this._sirenT) { this._siren(Math.max(this._sirenT, now + 0.05)); this._sirenT = now + 300 + r() * 420; }
    if (ahead > this._hornT) { this._horn(Math.max(this._hornT, now + 0.05)); this._hornT = now + 240 + r() * 360; }
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

  _gust(t) {
    const w = this._wind, r = this._r, k = 0.3 + 0.7 * Math.pow(r(), 0.8);
    const up = 1.2 + r() * 2.5, hold = 0.3 + r() * 1.6, down = 2.5 + r() * 4.5, base = 0.07;
    const peak = base + k, end = t + up + hold;
    w.env.gain.setTargetAtTime(peak, t, up / 2.5); w.env.gain.setTargetAtTime(peak * 0.8, t + up, hold / 2); w.env.gain.setTargetAtTime(base, end, down / 3);
    w.env2.gain.setTargetAtTime(0.02 + k * 0.6, t + up * 0.3, up / 2.5); w.env2.gain.setTargetAtTime(0.02, end, down / 4);
    w.bp.frequency.setTargetAtTime(320 + 520 * k, t, up / 2.5); w.bp.frequency.setTargetAtTime(320, end, down / 3);
    w.lp.frequency.setTargetAtTime(1100 + 1600 * k, t, up / 2.5); w.lp.frequency.setTargetAtTime(1100, end, down / 3);
    w.bp2.frequency.setTargetAtTime(1600 + 700 * k, t, up / 2); w.bp2.frequency.setTargetAtTime(1600, end, down / 3);
    if (k > 0.45) this._rattle(t + up * 0.7, k, up * 0.4 + hold + down * 0.25);
    this._gustT = end + down + 6 + r() * 26;
  }
  /** The sash knocks in its frame and the blind slats clatter against each other. */
  _rattle(t, k, span) {
    const r = this._r, dest = this._grp('wind', this._spots.window);
    const knocks = Math.round(2 + 9 * k * r());
    for (let i = 0; i < knocks; i++) {
      const tt = t + Math.pow(r(), 1.4) * span;
      this._one(this._bank.knock[Math.floor(r() * this._bank.knock.length)], tt, 0.9 + r() * 0.2, dest, LEVEL.rattle * k * (0.3 + 0.7 * r()));
    }
    let tt = t + r() * 0.3; const slats = Math.round(5 + 18 * k * r());
    for (let i = 0; i < slats; i++) {
      tt += 0.012 + Math.pow(r(), 2) * 0.16;
      this._one(this._bank.blind[Math.floor(r() * this._bank.blind.length)], tt, 0.92 + r() * 0.16, dest, LEVEL.blinds * k * (0.25 + 0.75 * r()));
    }
  }

  /** Tyres on a wet street below, passing left to right or back. */
  _car(t) {
    const ctx = this._ctx, r = this._r, dur = 4 + r() * 5, k = 0.35 + 0.65 * r(), dir = r() < 0.5 ? -1 : 1;
    const bp = this._biquad('bandpass', 700, 0.7), env = this._gain(0), eng = this._biquad('lowpass', 110 + r() * 50, 0.7), env2 = this._gain(0);
    const glass = this._biquad('lowpass', 2600, 0.5), out = this._gain(LEVEL.car * k);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const n1 = this._noise('pink', bp), n2 = this._noise('brown', eng);
    bp.connect(env); eng.connect(env2); env.connect(glass); env2.connect(glass);
    if (pan) { glass.connect(pan).connect(out); pan.pan.setValueAtTime(-0.7 * dir, t); pan.pan.linearRampToValueAtTime(0.7 * dir, t + dur); } else glass.connect(out);
    out.connect(this._grp('city', this._in));
    const mid = t + dur * 0.5;
    env.gain.setValueAtTime(0, t); env.gain.setTargetAtTime(1, t, dur * 0.2); env.gain.setTargetAtTime(0, mid, dur * 0.14);
    env2.gain.setValueAtTime(0, t); env2.gain.setTargetAtTime(2.2, t, dur * 0.22); env2.gain.setTargetAtTime(0, mid, dur * 0.16);
    bp.frequency.setValueAtTime(600, t); bp.frequency.setTargetAtTime(2100, t, dur * 0.25); bp.frequency.setTargetAtTime(750, mid, dur * 0.18);
    const stop = t + dur + 2.5; n1.stop(stop); n2.stop(stop);
    n1.onended = () => { try { [n1, n2, bp, env, eng, env2, glass, out, pan].forEach(x => x?.disconnect()); } catch { /* fine */ } };
  }

  /** An elevated train a few blocks off: a low roll and the rail joints, swelling and fading. */
  _train(t) {
    const ctx = this._ctx, r = this._r, dur = 18 + r() * 12, out = this._gain(LEVEL.train), lp = this._biquad('lowpass', 420, 0.6);
    lp.connect(out).connect(this._grp('city', this._in));
    const swell = (p, k) => { p.setValueAtTime(0, t); p.setTargetAtTime(k, t, dur * 0.18); p.setTargetAtTime(0, t + dur * 0.55, dur * 0.14); };
    const env = this._gain(0), rum = this._biquad('lowpass', 90, 0.7);
    const n = this._noise('brown', rum); rum.connect(env).connect(lp); swell(env.gain, 1.6); n.stop(t + dur + 4);
    const b = this._buf.train;
    if (b) {
      // the rail-joint recording, slowed a little and laid end to end in random stretches with equal-power joins
      const sw = this._gain(0); sw.connect(lp); swell(sw.gain, 1);
      for (let tt = t, xf = 0.7; tt < t + dur;) {
        const seg = 2 + r() * 1.4, rate = 0.8 + r() * 0.08, span = seg * rate, off = r() * Math.max(0, b.duration - span - 0.05);
        const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const e = this._gain(0); s.connect(e).connect(sw);
        e.gain.setValueCurveAtTime(FADE_IN, tt, xf); e.gain.setValueCurveAtTime(FADE_OUT, tt + seg - xf, xf);
        s.start(tt, off, span + 0.02); s.stop(tt + seg + 0.02); this._track(s, [e]); tt += seg - xf;
      }
      return;
    }
    const period = 1.15 + r() * 0.35, shape = tt => Math.sin(Math.PI * clamp((tt - t) / dur, 0, 1)) ** 2;
    for (let tt = t + 1; tt < t + dur; tt += period) {
      for (const o of [0, 0.15, 0.48, 0.63]) {
        const a = shape(tt + o); if (a < 0.05) continue;
        this._one(this._bank.knock[Math.floor(r() * this._bank.knock.length)], tt + o + (r() - 0.5) * 0.01, 0.55 + r() * 0.1, lp, 0.9 * a * (0.6 + 0.4 * r()));
      }
    }
  }

  /** A mechanical siren far across town: one slow wail, mostly lost in the rain. */
  _siren(t) {
    const ctx = this._ctx, r = this._r, b = this._buf.siren;
    if (b) {
      // a motor siren's wail, drifting slowly flat as it moves away, heard over rooftops
      const s = ctx.createBufferSource(); s.buffer = b; const rate = 0.95 + r() * 0.08;
      s.playbackRate.setValueAtTime(rate, t); s.playbackRate.linearRampToValueAtTime(rate * 0.97, t + b.duration / rate);
      const lp = this._biquad('lowpass', 1300, 0.5), out = this._gain(LEVEL.sirenRec);
      s.connect(lp).connect(out).connect(this._grp('city', this._in)); out.connect(this._gain(0.9)).connect(this._rev);
      s.start(t); this._track(s, [lp, out]);
      return;
    }
    const dur = 9 + r() * 5;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square';
    const lp = this._biquad('lowpass', 900, 0.5), env = this._gain(0), out = this._gain(LEVEL.siren);
    o.connect(lp); o2.connect(this._gain(0.3)).connect(lp); lp.connect(env).connect(out);
    out.connect(this._grp('city', this._in)); out.connect(this._gain(0.8)).connect(this._rev);
    const f = o.frequency, f2 = o2.frequency, lo = 330 + r() * 40, hi = 680 + r() * 60;
    for (const p of [f, f2]) { p.setValueAtTime(lo, t); p.setTargetAtTime(hi, t, 1.1); p.setTargetAtTime(lo * 1.1, t + dur * 0.45, 1.3); p.setTargetAtTime(hi * 0.97, t + dur * 0.62, 1.0); p.setTargetAtTime(lo, t + dur * 0.85, 1.4); }
    env.gain.setValueAtTime(0, t); env.gain.setTargetAtTime(1, t, 1.5); env.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.12);
    o.start(t); o2.start(t); o.stop(t + dur + 2); o2.stop(t + dur + 2);
  }

  /** A ship's horn down at the harbour, twice. */
  _horn(t) {
    const ctx = this._ctx, r = this._r, b = this._buf.horn;
    if (b) {
      // a lighthouse diaphone across the water, sounding twice
      const lp = this._biquad('lowpass', 700, 0.5), out = this._gain(LEVEL.hornRec);
      lp.connect(out).connect(this._grp('city', this._in)); out.connect(this._gain(1.1)).connect(this._rev);
      const rate = 0.93 + r() * 0.06;
      this._one(b, t, rate, lp); this._one(b, t + 7 + r() * 3, rate * (0.99 + r() * 0.02), lp);
      return;
    }
    const f = 118 + r() * 30, out = this._gain(LEVEL.horn), lp = this._biquad('lowpass', 520, 0.6);
    lp.connect(out).connect(this._grp('city', this._in)); out.connect(this._gain(1)).connect(this._rev);
    for (const [t0, len] of [[0, 2.6 + r()], [4.2 + r(), 3 + r() * 1.5]]) {
      const env = this._gain(0); env.connect(lp);
      for (const [m, a] of [[1, 1], [1.004, 0.7], [2.01, 0.25]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; o.connect(this._gain(a)).connect(env); o.start(t + t0); o.stop(t + t0 + len + 3); }
      env.gain.setValueAtTime(0, t + t0); env.gain.setTargetAtTime(1, t + t0, 0.25); env.gain.setTargetAtTime(0, t + t0 + len, 0.6);
    }
  }

  // ------------------------------------------------------------------ the room

  /** A steam radiator coming on: water hammer knocks, then the air vent hissing and spitting. */
  _radiator(t) {
    const ctx = this._ctx, r = this._r, dest = this._grp('radiator', this._spots.radiator);
    let tt = t; const knocks = 1 + Math.floor(r() * 3);
    for (let i = 0; i < knocks; i++) { this._one(this._bank.clank[Math.floor(r() * this._bank.clank.length)], tt, 0.9 + r() * 0.2, dest, LEVEL.clank * (0.5 + 0.5 * r())); tt += 0.35 + r() * 1.3; }
    if (r() < 0.75) {
      const t0 = tt + 0.5 + r() * 2, dur = 3 + r() * 7;
      const hp = this._biquad('highpass', 2600, 0.6), bp = this._biquad('bandpass', 5200 + r() * 1500, 0.7), env = this._gain(0), out = this._gain(LEVEL.hiss);
      const n = this._noise('white', hp); hp.connect(bp).connect(env).connect(out).connect(dest);
      env.gain.setValueAtTime(0, t0); env.gain.setTargetAtTime(1, t0, 0.35);
      for (let s = t0 + 0.6; s < t0 + dur; s += 0.06 + r() * 0.25) env.gain.setTargetAtTime(r() < 0.08 ? 1.6 : 0.55 + 0.45 * r(), s, 0.03);
      env.gain.setTargetAtTime(0, t0 + dur, 0.4); n.stop(t0 + dur + 3);
      n.onended = () => { try { [n, hp, bp, env, out].forEach(x => x.disconnect()); } catch { /* fine */ } };
    }
    // the iron ticking as it warms
    for (let i = 0, k = Math.floor(r() * 4); i < k; i++) this._one(this._bank.tickR[Math.floor(r() * this._bank.tickR.length)], tt + 2 + r() * 10, 0.9 + r() * 0.2, dest, LEVEL.creakR * (0.4 + 0.6 * r()));
  }

  _crackle(t) { this._one(this._bank.crackle[Math.floor(this._r() * this._bank.crackle.length)], t, 0.9 + this._r() * 0.2, this._grp('lamp', this._spots.lamp), LEVEL.crackle); }

  // ------------------------------------------------------------------ synthesis

  _noiseBuf(kind, sec) {
    const ctx = this._ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = this._r;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    // the loop point: fade the last 50 ms into the first so the looped noise never clicks
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const a = i / f; d[n - f + i] = d[n - f + i] * (1 - a) + d[i] * a; }
    return b;
  }

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
      // sash in its frame: a dull wooden knock with a little glass in it
      knock: bank(6, () => make(0.12, (d, n) => { const f = 170 + r() * 130; modes(d, n, 0, [[f, 1, 0.026, r() * 6], [f * 2.31, 0.5, 0.015, r() * 6], [f * 3.87, 0.25, 0.008, r() * 6], [2300 + r() * 1500, 0.18, 0.011, r() * 6]], 0.9, 0.003, 0.5); })),
      // thin steel slats touching
      blind: bank(8, () => make(0.07, (d, n) => { const f = 2600 + r() * 2600; modes(d, n, 0, [[f, 1, 0.02, r() * 6], [f * 1.58, 0.55, 0.013, r() * 6], [f * 2.37, 0.3, 0.008, r() * 6]], 0.7, 0.0009); })),
      // water hammer in an iron pipe: a dull tonk and a short metallic tail
      clank: bank(4, () => make(1.0, (d, n) => { const f = 120 + r() * 90; modes(d, n, 0, [[f, 1, 0.38, r() * 6], [f * 2.76, 0.6, 0.22, r() * 6], [f * 5.4, 0.35, 0.12, r() * 6], [f * 8.93, 0.18, 0.06, r() * 6], [1300 + r() * 500, 0.12, 0.04, r() * 6]], 1.4, 0.012, 0.15); })),
      tickR: bank(4, () => make(0.05, (d, n) => { modes(d, n, 0, [[1400 + r() * 1400, 1, 0.006, r() * 6]], 0.8, 0.0012); })),
      // a raindrop hitting the pane
      drop: bank(10, () => make(0.04, (d, n) => { modes(d, n, 0, [[2400 + r() * 3200, 0.35, 0.0035, r() * 6]], 1, 0.0008, 0.6); })),
      // card fibres giving: a quick stick-slip run of tiny clicks
      // (noise clicks of random colour and spacing, so the run never settles on a pitch)
      creak: bank(6, () => make(0.4, (d, n) => {
        let t = 0.005; const k = 8 + Math.floor(r() * 18);
        for (let j = 0; j < k; j++) { modes(d, n, t, [], 0.3 + r() * 0.7, 0.0004 + r() * 0.0012, 0.15 + r() * 0.7); t += 0.004 + Math.pow(r(), 2) * 0.05; if (t > 0.36) break; }
      })),
      // a card page settling flat: low and soft
      thump: bank(3, () => make(0.16, (d, n) => { modes(d, n, 0.002, [[65 + r() * 25, 0.6, 0.035, 0], [150 + r() * 60, 0.25, 0.02, 0]], 1, 0.02, 0.025); })),
      crackle: bank(4, () => make(0.03, (d, n) => { modes(d, n, 0, [], 1, 0.0025); for (let j = 0; j < 3; j++) modes(d, n, r() * 0.015, [], 0.5, 0.001); })),
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
