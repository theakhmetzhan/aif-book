import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import QRCode from 'qrcode';
import { T, MOODS } from './theme.js';
import { Book } from './book.js';
import { SHEETS, SPREADS, BOOK_URL, TITLE_TXT } from './pages.js';
import { buildScene } from './scene.js';
import './style.css';

const qs = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const N = SHEETS.length;
document.documentElement.dataset.mood = T.name;

async function fonts() {
  const want = ['400 40px "Courier Prime"', '700 40px "Courier Prime"', 'italic 400 40px "Courier Prime"', '400 40px "Special Elite"', '700 40px "Playfair Display"', '400 40px "Playfair Display"', '400 40px "Caveat"',
    '400 40px "Inter"', '600 40px "Inter"', 'italic 400 40px "Inter"', '500 40px "Space Grotesk"', '600 40px "Space Grotesk"', '500 40px "JetBrains Mono"'];
  await Promise.all(want.map(f => document.fonts.load(f, 'AaBb→∗′≤✓'))); await document.fonts.ready;
}

async function start() {
  await fonts();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, BOOK_URL, { margin: 0, width: 640, errorCorrectionLevel: 'M', color: { dark: T.ink, light: T.paper } });

  const canvas = document.querySelector('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!qs.get('shot') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.6 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = T.name === 'noir' ? 0.18 : 0.45;
  const room = buildScene(scene, renderer, { mobile });
  const book = new Book(scene, renderer, { qr, mobile });

  // ---------- one free camera ----------
  const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
  const controls = new OrbitControls(cam, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, panSpeed: 0.8, zoomSpeed: 0.9, zoomToCursor: true, screenSpacePanning: true, minDistance: 6, maxDistance: 260, maxPolarAngle: Math.PI * 0.53 });
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const home = () => {
    const aspect = innerWidth / innerHeight, halfW = aspect < 1 ? 16.5 : 25;
    const dist = Math.max(42, halfW / (Math.tan(THREE.MathUtils.degToRad(20)) * aspect));
    const tgt = new THREE.Vector3(0, aspect < 1 ? 9 : 9.5, -6);
    return { pos: new THREE.Vector3(0, aspect < 1 ? 16 : 7.2, tgt.z + dist), tgt };
  };
  const setView = ({ pos, tgt }) => { cam.position.copy(pos); controls.target.copy(tgt); controls.update(); };
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  setView(home());
  if (qs.get('cam')) { const v = qs.get('cam').split(',').map(Number); setView({ pos: new THREE.Vector3(v[0], v[1], v[2]), tgt: new THREE.Vector3(v[3], v[4], v[5]) }); }
  // fly smoothly back home
  let fly = null;
  const goHome = () => { fly = { from: { pos: cam.position.clone(), tgt: controls.target.clone() }, to: home(), t: 0 }; };

  // ---------- pages ----------
  let p = +(qs.get('p') ?? 0), target = p;
  const go = d => { target = Math.min(N, Math.max(0, Math.round(target) + d)); hideHint(); };

  // ---------- HUD ----------
  const hud = document.querySelector('#hud');
  const other = T.name === 'noir' ? 'modern' : 'noir';
  hud.innerHTML = `
    <div class="brand"><span class="t">${TITLE_TXT}</span><span class="s">A Casebook of AI</span></div>
    <div class="mood">${Object.values(MOODS).map(m => `<button data-m="${m.name}" class="${m.name === T.name ? 'on' : ''}">${m.label}</button>`).join('')}</div>
    <div class="where"><button class="nav prev" aria-label="Previous page">‹</button><span class="label"></span><button class="nav next" aria-label="Next page">›</button></div>
    <div class="dots">${Array.from({ length: N + 1 }, (_, i) => `<i data-p="${i}"></i>`).join('')}</div>
    <button class="home" aria-label="Back to the desk view" title="Back to the desk view">⌂</button>
    <div class="hint">${mobile ? 'Drag to look around · pinch to come closer · tap a page to turn it' : 'Scroll to turn pages · drag to look around · right-drag to move · pinch or ⌃-scroll to come closer'}</div>`;
  const label = hud.querySelector('.label'), dots = [...hud.querySelectorAll('.dots i')], hint = hud.querySelector('.hint');
  hud.querySelector('.prev').onclick = () => go(-1); hud.querySelector('.next').onclick = () => go(1);
  hud.querySelector('.home').onclick = goHome;
  dots.forEach(d => d.onclick = () => { target = +d.dataset.p; hideHint(); });
  hud.querySelectorAll('.mood button').forEach(b => b.onclick = () => { if (b.dataset.m === T.name) return; const u = new URLSearchParams(location.search); u.set('mood', b.dataset.m); u.set('p', String(Math.round(target)));
    const c = cam.position, t = controls.target; u.set('cam', [c.x, c.y, c.z, t.x, t.y, t.z].map(v => v.toFixed(2)).join(',')); document.body.classList.remove('ready'); setTimeout(() => location.search = u.toString(), 450); });
  let hinted = false; function hideHint() { if (!hinted) { hinted = true; hint.classList.add('off'); } }

  // ---------- input: wheel turns pages, ⌃/pinch zooms (handled by the controls) ----------
  let idle = 0;
  addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) return; // pinch / ⌃-scroll → controls zoom
    e.preventDefault(); e.stopImmediatePropagation();
    const d = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
    target = Math.min(N, Math.max(0, target + d * 0.0022)); idle = 0; hideHint();
  }, { passive: false, capture: true });
  // a click (not a drag) on the book turns the page toward the side clicked
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; fly = null; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 6 || dt > 500) { hideHint(); return; }
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(book.group, true)[0]; if (!hit) return;
    const local = book.group.worldToLocal(hit.point.clone());
    const ri = Math.round(target); go(ri === 0 ? 1 : ri === N ? -1 : local.x >= 0 ? 1 : -1);
  });
  controls.addEventListener('start', hideHint);
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    if (e.key === 'Home') target = 0; if (e.key === 'End') target = N;
    if (e.key === 'h' || e.key === 'H' || e.key === 'Escape') goHome();
    if (e.key === '+' || e.key === '=') { cam.position.lerp(controls.target, 0.18); }
    if (e.key === '-' || e.key === '_') { cam.position.sub(controls.target).multiplyScalar(1.22).add(controls.target); }
  });

  // ---------- loop ----------
  const clock = new THREE.Timer(); let first = true;
  const freeze = qs.get('freeze'), tFix = qs.get('t') ? +qs.get('t') : null;
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  function frame() {
    clock.update(); const dt = Math.min(0.05, clock.getDelta()), el = tFix ?? clock.getElapsed();
    idle += dt;
    if (idle > 0.16 && !freeze) target += (Math.round(target) - target) * (1 - Math.exp(-dt * 7));
    p += (target - p) * (1 - Math.exp(-dt * (first ? 100 : 5.2))); if (Math.abs(target - p) < 1e-4) p = target;
    book.set(+p.toFixed(5)); book.group.position.x = -book.centerX(p); book.animate(el);
    if (fly) { fly.t = Math.min(1, fly.t + dt / 1.4); const k = ease(fly.t); cam.position.lerpVectors(fly.from.pos, fly.to.pos, k); controls.target.lerpVectors(fly.from.tgt, fly.to.tgt, k); if (fly.t >= 1) fly = null; }
    controls.update();
    // stay in the room: above the desk, in front of the wall
    const c = cam.position; c.y = Math.max(c.y, 0.8); c.z = Math.max(c.z, -40); c.x = Math.min(170, Math.max(-170, c.x)); c.z = Math.min(c.z, 260);
    const t = controls.target; t.x = Math.min(90, Math.max(-90, t.x)); t.y = Math.min(100, Math.max(-1, t.y)); t.z = Math.min(45, Math.max(-46, t.z));
    room.tick(el, dt, cam);
    const ri = Math.round(p); label.textContent = SPREADS[ri]; dots.forEach((d, i) => d.classList.toggle('on', i === ri));
    hud.querySelector('.prev').disabled = ri === 0; hud.querySelector('.next').disabled = ri === N;
    renderer.render(scene, cam);
    first = false;
    requestAnimationFrame(frame);
  }
  window.__book = { cam, controls, set: pp => { target = p = pp; }, get p() { return p; } };
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}
start();
