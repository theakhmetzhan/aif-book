import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import QRCode from 'qrcode';
import { T } from './theme.js';
import { Book } from './book.js';
import { SHEETS, SPREADS, BOOK_URL, FACES } from './pages.js';
import { buildScene, installDarkness, roomEnvironment, DESK_Y, BOARD } from './scene.js';
import { CameraRig } from './controls.js';
import { Ambience } from './audio.js';
import { makeCardCanvas } from './card.js';
import './style.css';

const qs = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = SHEETS.length;

async function fonts() {
  const want = ['400 40px "Courier Prime"', '700 40px "Courier Prime"', 'italic 400 40px "Courier Prime"', '400 40px "Special Elite"', '700 40px "Playfair Display"', '400 40px "Playfair Display"', '400 40px "Caveat"'];
  // the fonts are served with the site; if one still fails, carry on with the fallbacks rather than wait
  await Promise.race([Promise.all(want.map(f => document.fonts.load(f, 'AaBb→∗′≤✓Δ'))).then(() => document.fonts.ready).catch(e => console.info('[fonts]', e?.message)), new Promise(r => setTimeout(r, 5000))]);
}

function fail(msg) {
  const L = document.querySelector('#loader'); document.body.classList.remove('ready');
  L.innerHTML = `<div class="t">EVIDENCE</div><p class="err" role="alert">${msg}</p><button class="retry" type="button">Reload</button>`;
  L.querySelector('.retry').onclick = () => location.reload();
}

async function start() {
  await fonts();
  const canvas = document.querySelector('#gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!qs.get('shot') }); }
  catch (e) { fail('This casebook needs WebGL, which this browser or device has turned off. Try another browser, or turn on hardware acceleration.'); return; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The graphics card dropped the scene. Reload to set the desk up again.'); });
  const dprMax = Math.min(devicePixelRatio, mobile ? 1.5 : 2); let dpr = +(qs.get('dpr') || dprMax);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  installDarkness();

  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, BOOK_URL, { margin: 1, width: 640, errorCorrectionLevel: 'M', color: { dark: '#1a140e', light: T.paper } });
  let card = null;
  try { card = await Promise.race([makeCardCanvas(2048, 1152), new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 8000))]); } catch (e) { console.info('[card] skipped:', e?.message); }

  const scene = new THREE.Scene();
  scene.environment = roomEnvironment(renderer); scene.environmentIntensity = 1.0;
  const room = await buildScene(scene, renderer, { mobile, card });
  const book = new Book(scene, renderer, { qr, mobile });
  book.group.position.y = DESK_Y + 0.2 + 0.176; // on the blotter
  room.pickables.push(book.group);

  // ---------- camera ----------
  const cam = new THREE.PerspectiveCamera(+(qs.get('fov') || 38), 1, 2, 900);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickAt = (x, y, objs) => { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObjects(objs, true)[0] || null; };
  const rig = new CameraRig(cam, canvas, { pick: (x, y) => pickAt(x, y, room.pickables)?.point || null, limits: { rMax: 500 } }); // far enough for a phone to fit the whole board
  const home = () => {
    const a = innerWidth / innerHeight;
    if (a < 0.8) return { target: new THREE.Vector3(0, 6, -3), r: 50 / Math.max(0.42, a), th: 0, ph: 1.24 };
    return { target: new THREE.Vector3(0, 10.5, -9), r: Math.max(78, 120 / a), th: -0.2, ph: 1.36 }; // a little from the left: the lamp's side
  };
  const hq = qs.get('home')?.split(',').map(Number);
  let userMoved = false, view = 'desk';
  // fit a box of half-width hw and half-height hh (as seen from the camera) inside the view, leaving room for the HUD
  const fitR = (hw, hh) => { const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), a = innerWidth / innerHeight; return Math.max(hw / (t * a), hh / t) * 1.12; };
  const views = {
    desk: home,
    book: () => { const ri = Math.round(target), shut = ri === 0 || ri === N, a = innerWidth / innerHeight;
      const hw = shut ? 8.6 : a < 0.8 ? 8.4 : 16.2; const tx = !shut && a < 0.8 ? (ri === 1 ? 7.2 : -7.2) : 0; // a phone reads one page at a time: the text page
      return { target: new THREE.Vector3(tx, DESK_Y + 2.2, 1.2), r: fitR(hw, 12.5), th: 0, ph: 0.6 }; },
    // the whole setup: the board and the desk in front of it, seen from a step back and a little above
    room: () => ({ target: new THREE.Vector3(0, 42, -4), r: fitR(BOARD.w / 2 + 12, 65), th: -0.05, ph: 1.34 }),
  };
  const goView = (name, instant = false) => { view = name; userMoved = false; instant ||= reduced; const h = views[name](); rig.home = name === 'desk' ? h.target.clone() : rig.home; rig.set(h.target, h, instant); markView(); unlock(); };
  let markView = () => {};
  const goHome = (instant = false) => { view = 'desk'; markView(); userMoved = false; instant ||= reduced; const h = home(); if (hq) Object.assign(h, { r: hq[0], ph: hq[1], target: new THREE.Vector3(0, hq[2], hq[3]) }); rig.home = h.target.clone(); rig.set(h.target, h, instant); };
  goHome(true);
  if (qs.get('cam')) { const v = qs.get('cam').split(',').map(Number); rig.lookFrom(new THREE.Vector3(v[0], v[1], v[2]), new THREE.Vector3(v[3], v[4], v[5])); }

  // ---------- post ----------
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: +(qs.get('msaa') || (mobile || dprMax > 1.6 ? 2 : 4)) });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.6); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uGrain: { value: 0.045 }, uVig: { value: 0.42 }, uAspect: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uGrain, uVig, uAspect; varying vec2 vUv;
      float h(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0); float v = 1.0 - uVig * smoothstep(0.35, 1.05, length(q) * 1.15); c *= v;
        float l = dot(c, vec3(0.299, 0.587, 0.114)); float n = (h(vUv * 1024.0 + fract(uT * 7.31) * 97.0) - 0.5) * uGrain * (0.35 + 0.65 * (1.0 - l));
        c += n; gl_FragColor = vec4(c, 1.0); }`,
  });
  composer.addPass(film);

  const resize = () => {
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
    bloom.resolution.set(innerWidth / 2, innerHeight / 2);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); film.uniforms.uAspect.value = cam.aspect;
  };
  resize(); addEventListener('resize', () => { resize(); if (!userMoved && !qs.get('cam')) view === 'desk' ? goHome(true) : goView(view, true); });

  // ---------- pages ----------
  let p = +(qs.get('p') ?? 0), target = Math.round(p), pv = 0, hover = 0, hoverK = 0;
  const reframe = () => { if (view === 'book' && !userMoved) { const h = views.book(); rig.set(h.target, h, reduced); } };
  const go = d => { target = Math.min(N, Math.max(0, target + d)); hideHint(); unlock(); reframe(); };
  const goto = k => { target = Math.min(N, Math.max(0, k)); hideHint(); unlock(); reframe(); };

  // ---------- HUD ----------
  const hud = document.querySelector('#hud');
  let soundOn = true; try { soundOn = localStorage.getItem('ev-sound') !== 'off'; } catch {}
  hud.innerHTML = `
    <button class="snd" aria-pressed="${soundOn}" title="Sound (M)"><span class="ic"></span><span class="lb">${soundOn ? 'Sound on' : 'Sound off'}</span></button>
    <div class="views" role="group" aria-label="View"><button data-v="desk" title="The desk (H)">Desk</button><button data-v="book" title="Lean over the book to read (R)">Read</button><button data-v="room" title="Step back: the board and the desk (O)">Room</button></div>
    <div class="hint">${mobile ? 'Drag to look around · pinch to come closer · tap a page to turn it' : 'Drag to look around · scroll to come closer · click a page or press ← → to turn it'}</div>`;
  const hint = hud.querySelector('.hint'), sndB = hud.querySelector('.snd');
  const viewB = [...hud.querySelectorAll('.views button')];
  viewB.forEach(b => b.onclick = () => b.dataset.v === 'desk' ? (goHome(false), unlock()) : goView(b.dataset.v));
  markView = () => viewB.forEach(b => b.setAttribute('aria-pressed', String(!userMoved && b.dataset.v === view)));
  markView();
  let hinted = false; function hideHint() { if (!hinted) { hinted = true; hint.classList.add('off'); } }
  setTimeout(hideHint, 14000);

  const readEl = document.querySelector('#read');
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const faceHTML = name => (FACES[name]?.read || []).filter(b => !(b.kind === 'x' && /^\d+$/.test(b.text))).map(b => b.kind === 'h' ? `<h2>${esc(b.text)}</h2>` : b.kind === 'p' ? `<p>${esc(b.text)}</p>` : b.kind === 'table' ? `<table>${b.rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table>` : `<p>${esc(b.text)}</p>`).join('');
  const readSpread = k => { const L = k > 0 ? SHEETS[k - 1][1] : null, R = k < N ? SHEETS[k][0] : null; readEl.innerHTML = `<h1>${esc(SPREADS[k])}</h1>` + (L ? faceHTML(L) : '') + (R ? faceHTML(R) : ''); };

  // ---------- sound ----------
  // created up front so the first gesture can start it synchronously (Safari only unlocks audio inside the gesture)
  const audio = new Ambience({ camera: cam, positions: room.positions, enabled: soundOn });
  room.events.lightning = km => audio.thunder(km);
  function unlock() { audio.unlock(); }
  const setSound = on => { sndB.setAttribute('aria-pressed', String(on)); sndB.querySelector('.lb').textContent = on ? 'Sound on' : 'Sound off'; try { localStorage.setItem('ev-sound', on ? 'on' : 'off'); } catch {} audio.setEnabled(on); unlock(); };
  sndB.onclick = () => setSound(sndB.getAttribute('aria-pressed') !== 'true');
  addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });

  // ---------- input ----------
  rig.onStart = () => { hideHint(); if (!userMoved) { userMoved = true; markView(); } };
  const sideAt = (x, y) => { const hit = pickAt(x, y, [book.group]); if (!hit) return 0; const lx = book.group.worldToLocal(hit.point.clone()).x; const ri = Math.round(target); return ri === 0 ? 1 : ri === N ? -1 : lx >= 0 ? 1 : -1; };
  rig.onTap = e => { const s = sideAt(e.clientX, e.clientY); if (s) go(s); };
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || rig.drag) { hover = 0; canvas.style.cursor = rig.drag ? 'grabbing' : ''; return; } hover = sideAt(e.clientX, e.clientY); canvas.style.cursor = hover ? 'pointer' : 'grab'; });
  canvas.addEventListener('pointerleave', () => { hover = 0; });
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.target.closest?.('button') && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') goto(0); else if (e.key === 'End') goto(N);
    else if (e.key === 'h' || e.key === 'H' || e.key === 'Escape') goHome(false);
    else if (e.key === 'r' || e.key === 'R') goView('book'); else if (e.key === 'o' || e.key === 'O') goView('room');
    else if (e.key === '+' || e.key === '=') { rig.zoom(0.8, innerWidth / 2, innerHeight / 2); userMoved = true; }
    else if (e.key === '-' || e.key === '_') { rig.zoom(1.25); userMoved = true; }
    else if (e.key === 'm' || e.key === 'M') setSound(sndB.getAttribute('aria-pressed') !== 'true');
    else if (e.key === 'ArrowUp') { e.preventDefault(); rig.g.ph -= 0.12; rig.limit(); userMoved = true; } else if (e.key === 'ArrowDown') { e.preventDefault(); rig.g.ph += 0.12; rig.limit(); userMoved = true; }
    else if (e.key === 'a' || e.key === 'A') { rig.g.th += 0.12; rig.limit(); userMoved = true; } else if (e.key === 'd' || e.key === 'D') { rig.g.th -= 0.12; rig.limit(); userMoved = true; }
  });

  // ---------- loop ----------
  const clock = new THREE.Timer(); let first = true, lastSide = 0, shadowTick = 0, calm = 0, shown = -1; const ft = [];
  const freeze = !!qs.get('freeze'), tFix = qs.get('t') ? +qs.get('t') : null; room.freeze = freeze;
  if (freeze) { p = target = +(qs.get('p') ?? 0); }
  function frame() {
    clock.update(); const dt = Math.min(0.05, clock.getDelta()), el = tFix ?? (reduced ? 4 : clock.getElapsed());
    // page spring: critically damped, capped speed for long jumps
    if (!freeze) {
      const w = reduced ? 9 : 6.2; pv += (w * w * (target - p) - 2 * w * pv) * dt; pv = Math.max(-5, Math.min(5, pv)); p += pv * dt;
      if (Math.abs(target - p) < 1e-4 && Math.abs(pv) < 1e-3) { p = target; pv = 0; }
    }
    // turning sounds as each sheet leaves its stack
    const side = Math.floor(p + 0.5); if (side !== lastSide && !first) { audio.pageTurn(Math.min(2, 0.6 + Math.abs(pv) * 0.4)); lastSide = side; } else if (first) lastSide = side;
    // the pop-ups fold and unfold near the start and end of each turn: paper rustle in proportion to how fast
    { const f = p - Math.floor(p); if (Math.abs(pv) > 0.15 && (f > 0.04 && f < 0.3 || f > 0.7 && f < 0.96)) audio.paper(Math.min(1, Math.abs(pv) * 0.45)); }
    hoverK += ((Math.abs(target - p) < 0.02 ? hover : 0) - hoverK) * (1 - Math.exp(-dt * 10));
    book.set(+p.toFixed(5), el, hoverK);
    book.group.position.x = -book.centerX(p);
    rig.update(first ? 1 : dt);
    room.tick(el, dt, cam);
    audio.update(dt);
    const ri = Math.round(target);
    if (ri !== shown) { shown = ri; readSpread(ri); }
    film.uniforms.uT.value = el;
    // shadows: every frame while anything that casts them moves, otherwise a few times a second for the drifting paper
    const busy = Math.abs(target - p) > 1e-4 || Math.abs(pv) > 1e-4 || Math.abs(hoverK) > 1e-3 && Math.abs(hoverK - (Math.abs(target - p) < 0.02 ? hover : 0)) > 1e-3;
    if (busy || first || ++shadowTick % 4 === 0) renderer.shadowMap.needsUpdate = true;
    composer.render(dt);
    // keep it smooth: lower the resolution while frames run long, raise it again when there is room
    if (!freeze && !qs.get('dpr')) { ft.push(clock.getDelta() * 0 + dt); if (ft.length > 45) { const a = ft.reduce((x, y) => x + y, 0) / ft.length; ft.length = 0;
      if (a > 0.024 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); } else if (a < 0.0125 && dpr < dprMax && ++calm > 4) { dpr = Math.min(dprMax, dpr + 0.25); resize(); calm = 0; } } }
    first = false;
    requestAnimationFrame(frame);
  }
  window.__book = { cam, rig, renderer, scene, book, room, set: pp => { target = p = pp; pv = 0; }, get p() { return p; } };
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}
start().catch(e => { console.error(e); fail('Something went wrong while setting up the desk. Try reloading the page.'); });
