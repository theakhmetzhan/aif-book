import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import QRCode from 'qrcode';
import { Book, BW, BH, PW, BT } from './book.js';
import { FACES, SHEETS, SPREADS, BOOK_URL } from './pages.js';
import { grainTile } from './paper.js';
import './style.css';

const qs = new URLSearchParams(location.search);
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
const N = SHEETS.length;

async function fonts() {
  const want = ['400 40px "EB Garamond"', 'italic 400 40px "EB Garamond"', '500 40px "EB Garamond"', '600 40px "EB Garamond"', 'italic 500 40px "EB Garamond"', '500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '500 40px "JetBrains Mono"'];
  await Promise.all(want.map(f => document.fonts.load(f, 'AaҰшқын→∗′≤'))); await document.fonts.ready;
}

async function start() {
  await fonts();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, BOOK_URL, { margin: 0, width: 640, errorCorrectionLevel: 'M', color: { dark: '#232b45', light: '#efe4cc' } });

  const canvas = document.querySelector('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!qs.get('shot') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#101116'); scene.fog = new THREE.Fog('#101116', 120, 330);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;

  // desk
  const dc = document.createElement('canvas'); dc.width = dc.height = 1024; const dg = dc.getContext('2d');
  const rg = dg.createRadialGradient(512, 512, 60, 512, 512, 560); rg.addColorStop(0, '#34333a'); rg.addColorStop(0.05, '#2a2a31'); rg.addColorStop(0.16, '#17181e'); rg.addColorStop(1, '#101116');
  dg.fillStyle = rg; dg.fillRect(0, 0, 1024, 1024); dg.globalCompositeOperation = 'overlay'; dg.globalAlpha = 0.35; dg.fillStyle = dg.createPattern(grainTile(512, 77), 'repeat'); dg.fillRect(0, 0, 1024, 1024);
  const deskTex = new THREE.CanvasTexture(dc); deskTex.colorSpace = THREE.SRGBColorSpace;
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.96 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -BT - 0.002; desk.receiveShadow = true; scene.add(desk);

  // light
  scene.add(new THREE.HemisphereLight('#fff4e0', '#2a2c36', 0.55));
  const key = new THREE.DirectionalLight('#fff1dc', 2.3); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 90 });
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#c9d4ff', 0.35); fill.position.set(18, 12, -10); scene.add(fill);

  // the spark
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const sg = sc.getContext('2d');
  const gr = sg.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.08, 'rgba(255,236,190,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,.45)'); gr.addColorStop(0.6, 'rgba(255,160,80,.08)'); gr.addColorStop(1, 'rgba(255,150,70,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 256, 256);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spark.scale.set(2.2, 2.2, 1); scene.add(spark);
  const sparkLight = new THREE.PointLight('#ffcf8a', 6, 9, 1.6); scene.add(sparkLight);

  const book = new Book(scene, renderer, { qr, mobile });
  const resize = () => renderer.setSize(innerWidth, innerHeight, false); resize(); addEventListener('resize', resize);

  // cameras
  const persp = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const view = { yaw: 0.0, pitch: 0.92, dist: 46, read: 0, readTarget: 0, zoom: 0, zoomTarget: 0, zoomSide: 0 };
  let p = +(qs.get('p') ?? 0), target = p;
  if (qs.get('read')) view.read = view.readTarget = 1;
  if (qs.get('yaw')) view.yaw = +qs.get('yaw'); if (qs.get('pitch')) view.pitch = +qs.get('pitch');

  // ---------- HUD ----------
  const hud = document.querySelector('#hud');
  hud.innerHTML = `
    <div class="brand"><span class="kz">Ұшқын</span><span class="lat">Ushqyn</span></div>
    <div class="where"><button class="nav prev" aria-label="Previous page">‹</button><span class="label"></span><button class="nav next" aria-label="Next page">›</button></div>
    <div class="dots">${Array.from({ length: N + 1 }, (_, i) => `<i data-p="${i}"></i>`).join('')}</div>
    <div class="mode"><button data-m="0" class="on">Explore</button><button data-m="1">Read</button></div>
    <div class="hint">${mobile ? 'Swipe up to turn the page · drag sideways to walk around' : 'Scroll to turn the page · drag to walk around the book'}</div>`;
  const label = hud.querySelector('.label'), dots = [...hud.querySelectorAll('.dots i')], modeBtns = [...hud.querySelectorAll('.mode button')], hint = hud.querySelector('.hint');
  const portrait = () => innerWidth / innerHeight < 0.85;
  // page-by-page order for narrow screens: [spread, side]
  const STOPS = [[0, 0], [1, 1]]; for (let i = 2; i < N - 1; i++) STOPS.push([i, -1], [i, 1]); STOPS.push([N - 1, -1], [N, 0]);
  view.side = 1;
  const go = d => {
    hideHint();
    if (!portrait()) { target = Math.min(N, Math.max(0, Math.round(target) + d)); return; }
    const ri = Math.round(target); let k = STOPS.findIndex(([a, b]) => a === ri && (b === view.side || b === 0));
    if (k < 0) k = STOPS.findIndex(([a]) => a === ri);
    const [a, b] = STOPS[Math.min(STOPS.length - 1, Math.max(0, k + d))]; target = a; if (b) view.side = b;
  };
  hud.querySelector('.prev').onclick = () => go(-1); hud.querySelector('.next').onclick = () => go(1);
  dots.forEach(d => d.onclick = () => { target = +d.dataset.p; view.side = target === N - 1 ? -1 : 1; hideHint(); });
  modeBtns.forEach(b => b.onclick = () => setRead(+b.dataset.m));
  function setRead(on) { view.readTarget = on; if (!on) view.zoomTarget = 0; modeBtns.forEach(b => b.classList.toggle('on', +b.dataset.m === on)); }
  setRead(view.readTarget);
  let hinted = false; function hideHint() { if (!hinted) { hinted = true; hint.classList.add('off'); } }

  // ---------- input ----------
  let idle = 0;
  addEventListener('wheel', e => { e.preventDefault(); const d = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1); target = Math.min(N, Math.max(0, target + d * 0.0022)); idle = 0; hideHint(); }, { passive: false });
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, axis: null, moved: 0, type: e.pointerType }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved < 4) return; hideHint();
    if (drag.type === 'touch') {
      if (!drag.axis) drag.axis = Math.abs(e.clientX - drag.x0) > Math.abs(e.clientY - drag.y0) ? 'x' : 'y';
      if (drag.axis === 'y') { if (!portrait()) { target = Math.min(N, Math.max(0, target - dy * 0.006)); idle = 0; } return; }
    }
    if (view.readTarget === 1) { if (dy > 6 || Math.abs(dx) > 6) { setRead(0); view.pitch = 1.3; } return; }
    view.yaw -= dx * 0.0055; view.pitch = Math.min(1.5, Math.max(0.18, view.pitch + dy * 0.0045));
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && drag.type === 'touch' && drag.axis === 'y' && portrait()) { const t = e.clientY - drag.y0; if (Math.abs(t) > 40) go(t < 0 ? 1 : -1); }
    else if (drag && drag.moved < 5 && view.readTarget === 1) {
      if (portrait()) go(e.clientX < innerWidth / 2 ? -1 : 1); // tap a side to turn
      else if (view.zoomTarget) view.zoomTarget = 0; else { view.zoomTarget = 1; view.zoomSide = e.clientX < innerWidth / 2 ? -1 : 1; } // click to zoom one page
    }
    if (drag?.type === 'touch' && drag.axis === 'y') idle = 0;
    drag = null;
  });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    if (e.key === 'r' || e.key === 'R') setRead(view.readTarget ? 0 : 1);
    if (e.key === 'Home') target = 0; if (e.key === 'End') target = N;
  });

  // ---------- loop ----------
  const clock = new THREE.Clock(); const sparkPos = new THREE.Vector3(7, 3, 0); let first = true;
  const tgt = new THREE.Vector3();
  function sparkFor(pi) {
    const right = pi < N ? SHEETS[pi][0] : null, left = pi > 0 ? SHEETS[pi - 1][1] : null;
    const pick = (pi === 0) ? 'cover' : pi === N ? 'back' : (FACES[right]?.popup ? right : FACES[left]?.popup ? left : right);
    const s = FACES[pick].spark || [7, 1.5, 4];
    if (pi === 0) return new THREE.Vector3(s[0] - 0.25, BH * 0 + 1.2 + s[1], s[2] - BH / 2);
    if (pi === N) return new THREE.Vector3(-7.25, 1.2 + 2.2, -3);
    const w = book.faceToWorld(pick, s[0], s[1], s[2], pi); return w;
  }
  function frame() {
    const dt = Math.min(0.05, clock.getDelta()), el = clock.elapsedTime;
    idle += dt;
    if (idle > 0.16 && !drag && !qs.get('freeze')) target += (Math.round(target) - target) * (1 - Math.exp(-dt * 7));
    p += (target - p) * (1 - Math.exp(-dt * (first ? 100 : 5.2)));
    if (Math.abs(target - p) < 1e-4) p = target;
    book.set(+p.toFixed(5));
    view.read += (view.readTarget - view.read) * (1 - Math.exp(-dt * 4.2)); if (Math.abs(view.read - view.readTarget) < 1e-3) view.read = view.readTarget;
    view.zoom += (view.zoomTarget - view.zoom) * (1 - Math.exp(-dt * 5)); if (Math.abs(view.zoom - view.zoomTarget) < 1e-3) view.zoom = view.zoomTarget;
    const e = view.read < 0.5 ? 4 * view.read ** 3 : 1 - (-2 * view.read + 2) ** 3 / 2;
    const aspect = innerWidth / innerHeight;
    // framing
    const cx = book.centerX(p); const closedness = p < 1 ? 1 - p : p > N - 1 ? p - (N - 1) : 0;
    const spreadW = (2 * BW + 1.6) * (1 - closedness) + (BW + 1.6) * closedness;
    const mTop = mobile ? 54 : 58, mBot = mobile ? 150 : 96; const hudK = innerHeight / Math.max(200, innerHeight - mTop - mBot);
    let vhRead = Math.max((BH + 0.8) * hudK, spreadW / aspect);
    const pageVh = Math.max((BH + 0.6) * hudK, (PW + 0.5) / aspect);
    const port = aspect < 0.85, zoom = port ? 1 : view.zoom, side = port ? view.side : view.zoomSide;
    vhRead = vhRead + (pageVh - vhRead) * zoom;
    const zx = zoom * side * (PW / 2) * (1 - closedness);
    tgt.set(cx + zx * (port ? 1 : e), 0.6 * (1 - e), e * vhRead * ((mBot - mTop) / 2) / innerHeight);
    // explore camera distance: fit the spread (or, on narrow screens, the page) with some air
    const fovE = 30, vhE = port ? Math.max(BH * 0.9, (PW + 1.0) / aspect * 0.92) : Math.max(BH * 1.12, spreadW * 1.02 / Math.min(aspect, 1.9));
    const fov = fovE * Math.pow(1.2 / fovE, e);
    const vh = vhE + (vhRead - vhE) * e;
    const dist = vh / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    // shortest yaw back to 0 as we enter read mode
    if (view.readTarget === 1) view.yaw += (Math.round(view.yaw / (Math.PI * 2)) * Math.PI * 2 - view.yaw) * (1 - Math.exp(-dt * 6));
    const pitch = view.pitch + (Math.PI / 2 - 0.0005 - view.pitch) * e;
    let cam;
    if (view.read > 0.999) {
      cam = ortho; const vw = vh * aspect;
      ortho.left = -vw / 2; ortho.right = vw / 2; ortho.top = vh / 2; ortho.bottom = -vh / 2; ortho.near = 0.1; ortho.far = 200;
      ortho.position.set(tgt.x, 100, tgt.z); ortho.up.set(0, 0, -1); ortho.lookAt(tgt); ortho.updateProjectionMatrix();
    } else {
      cam = persp; persp.fov = fov; persp.aspect = aspect; persp.near = Math.max(0.1, dist * 0.2); persp.far = dist * 3 + 60;
      persp.position.set(tgt.x + Math.sin(view.yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(view.yaw) * Math.cos(pitch) * dist);
      persp.up.set(0, 1, 0); persp.lookAt(tgt); persp.updateProjectionMatrix();
    }
    // light: from the upper left; drifts overhead in Read mode so shadows tuck under the paper
    const lp = new THREE.Vector3(-13, 26, 12).lerp(new THREE.Vector3(-1.5, 30, 1.2), e);
    key.position.copy(lp).add(new THREE.Vector3(cx, 0, 0)); key.target.position.set(cx, 0, 0);
    // spark
    const pi = Math.round(p); const sp = sparkFor(pi);
    sparkPos.lerp(sp, first ? 1 : 1 - Math.exp(-dt * 2.2));
    spark.position.copy(sparkPos).add(new THREE.Vector3(Math.sin(el * 0.9) * 0.08, Math.sin(el * 1.7) * 0.12, Math.cos(el * 0.7) * 0.08));
    const flick = 1 + Math.sin(el * 7.3) * 0.04 + Math.sin(el * 3.1) * 0.05;
    spark.scale.setScalar((1.7 - 0.6 * e) * flick); sparkLight.position.copy(spark.position); sparkLight.intensity = (4.2 - 2.2 * e) * flick; spark.material.opacity = 1 - 0.35 * e;
    // HUD
    const ri = Math.round(p); label.textContent = SPREADS[ri]; dots.forEach((d, i) => d.classList.toggle('on', i === ri));
    hud.querySelector('.prev').disabled = ri === 0; hud.querySelector('.next').disabled = ri === N;
    renderer.render(scene, cam);
    first = false;
    requestAnimationFrame(frame);
  }
  window.__book = { cam: () => ({ o: ortho.position.toArray(), l: ortho.left, r: ortho.right, w: innerWidth, h: innerHeight, cw: canvas.width, ccw: canvas.clientWidth }), set: (pp, opts = {}) => { target = p = pp; Object.assign(view, opts); }, view, get p() { return p; } };
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}
start();
