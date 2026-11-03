// Dev-only lab for the desk props: every prop on the desk material under lighting close to the final scene.
// URL params:
//   view=home|top|low|<prop>   camera preset (a prop name frames that prop at ~25 cm)      dist=<cm> for prop views
//   cam=x,y,z,tx,ty,tz          explicit camera                                              fov=<deg>
//   layout=scene|row            props placed as on the final desk, or in a row for inspection
//   light=scene|inspect         final-like lighting, or the same plus a soft neutral key for material checks
//   only=a,b / hide=a,b         show only / hide some props       glow=<k> lamp glow     tilt=<rad> lamp shade tilt
//   exp=<exposure>  env=<intensity>  shot=1 (hide the overlay)
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadProps } from './props.js';
import { loadSurfaces } from './assets.js';

const qs = new URLSearchParams(location.search);
const DESK_Y = -0.202, WALL_Z = -48;
const info = document.querySelector('#info');
if (qs.get('shot')) document.body.classList.add('shot');

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#gl'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = +(qs.get('exp') ?? 1.05);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0a09');
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = +(qs.get('env') ?? 0.18);
const cam = new THREE.PerspectiveCamera(+(qs.get('fov') ?? 40), innerWidth / innerHeight, 0.5, 900);
const controls = new OrbitControls(cam, renderer.domElement); controls.enableDamping = true;
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

function blindsMap(n = 11, slat = 0.62) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.filter = 'blur(3px)'; g.fillStyle = '#fff';
  for (let i = 0; i < n; i++) g.fillRect(0, i * 512 / n, 512, 512 / n * slat); g.fillStyle = '#000'; g.fillRect(250, 0, 12, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

async function start() {
  const [S, P] = await Promise.all([loadSurfaces(renderer), loadProps(renderer)]);
  // ---------- room ----------
  const deskTop = S.deskWood({ w: 190, d: 92 }), deskFB = S.deskWood({ w: 190, d: 4 }), deskLR = S.deskWood({ w: 92, d: 4 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(190, 4, 92), [deskLR, deskLR, deskTop, deskTop, deskFB, deskFB]);
  desk.position.set(0, DESK_Y - 2, -2); desk.receiveShadow = true; scene.add(desk);
  const blotter = new THREE.Mesh(new THREE.BoxGeometry(50, 0.3, 34), [S.leather({ w: 0.3, d: 34 }), S.leather({ w: 0.3, d: 34 }), S.leather({ w: 50, d: 34 }), S.leather({ w: 50, d: 34 }), S.leather({ w: 50, d: 0.3 }), S.leather({ w: 50, d: 0.3 })]);
  blotter.position.set(0, DESK_Y + 0.15, -4); blotter.receiveShadow = true; scene.add(blotter);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 250), S.wall({ w: 400, h: 250 })); wall.position.set(0, 100, WALL_Z); wall.receiveShadow = true; scene.add(wall);
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(150, 84), S.cork({ w: 150, h: 84 })); cork.position.set(0, 48, WALL_Z + 2.6); cork.receiveShadow = true; scene.add(cork);
  const frameMat = S.deskWood({ w: 160, d: 4 });
  for (const [x, y, w, h] of [[0, 4.4, 156.4, 3.2], [0, 91.6, 156.4, 3.2], [-76.6, 48, 3.2, 84], [76.6, 48, 3.2, 84]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3.2), frameMat); b.position.set(x, y, WALL_Z + 1.4); b.castShadow = b.receiveShadow = true; scene.add(b); }
  // placeholder open book (29 x 21) for scale
  const book = new THREE.Group(); const cloth = new THREE.MeshStandardMaterial({ color: '#5b1e1a', roughness: 0.8 }), pages = S.paper({ w: 14, h: 20, color: '#ede1c6' });
  for (const s of [-1, 1]) { const half = new THREE.Group(); const board = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.25, 20.8), cloth); board.position.set(s * 7.25, 0.125, 0); const blk = new THREE.Mesh(new THREE.BoxGeometry(14, 1.1, 20), pages); blk.position.set(s * 7.1, 0.8, 0); half.add(board, blk); half.rotation.z = s * 0.05; book.add(half); }
  book.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); book.position.set(0, DESK_Y + 0.3, -2); scene.add(book);

  // ---------- props ----------
  const layout = qs.get('layout') ?? 'scene';
  const place = {
    lamp: [-46, -30, 0], mug: [36, -22, -0.6], magnifier: [25, 17, 0.7], pencilA: [-25, 15, 0.35], pencilB: [-22, 19, 0.15], cardStack: [-37, 3, 0.25],
    spool: [40, 4, 0.2], pinTin: [47, 14, 0], clock: [53, -32, -0.45], legalPad: [-58, -6, 0.18], spectacles: [-12, 25, 0.25], pocketWatch: [12, 26, 0.4],
    fountainPen: [-36, 24, -0.3], envelope: [64, 14, -0.25],
  };
  const only = qs.get('only')?.split(','), hide = qs.get('hide')?.split(',') ?? [];
  let rx = -95; const names = Object.keys(P);
  for (const name of names) {
    const o = P[name]; if ((only && !only.includes(name)) || hide.includes(name)) continue;
    if (layout === 'row') { const w = o.userData.footprint.w; o.position.set(rx + w / 2, DESK_Y, 12); rx += w + 5; }
    else { const [x, z, ry] = place[name] ?? [0, 30, 0]; o.position.set(x, DESK_Y, z); o.rotation.y = ry; }
    scene.add(o);
  }
  const lamp = P.lamp; const bookAt = new THREE.Vector3(0, DESK_Y, -2);
  lamp.rotation.y = Math.atan2(bookAt.x - lamp.position.x, bookAt.z - lamp.position.z);
  if (qs.get('tilt')) lamp.userData.shade.rotation.x = -+qs.get('tilt');
  lamp.userData.setGlow(+(qs.get('glow') ?? 1));
  lamp.updateMatrixWorld(true);

  // ---------- light (close to the final scene) ----------
  scene.add(new THREE.HemisphereLight('#4a4a5a', '#120c08', 0.35));
  const bulb = lamp.localToWorld(lamp.userData.bulb.clone());
  const spot = new THREE.SpotLight('#ffb36b', +(qs.get('lamp') ?? 5200), 140, 0.68, 0.8, 1.6);
  spot.position.copy(bulb); spot.target.position.copy(bookAt).add(new THREE.Vector3(3, 0, 2)); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0002; spot.shadow.normalBias = 0.02; spot.shadow.radius = 3; spot.shadow.camera.near = 1.5;
  scene.add(spot, spot.target);
  const moon = new THREE.SpotLight('#7d93c9', 9000, 400, 0.32, 0.25, 1.2); moon.position.set(150, 120, 80); moon.target.position.set(-10, 40, WALL_Z); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.08; moon.map = blindsMap(); scene.add(moon, moon.target);
  const street = new THREE.SpotLight('#9fb2d6', 2600, 400, 0.22, 0.4, 1.2); street.position.set(170, 70, 30); street.target.position.set(30, 0, 0); street.castShadow = true; street.shadow.mapSize.set(2048, 2048); street.shadow.bias = -0.0005; street.shadow.normalBias = 0.06; street.map = blindsMap(14, 0.55); scene.add(street, street.target);
  const bounce = new THREE.PointLight('#ff9a4a', 380, 140, 1.8); bounce.position.set(0, 18, -20); scene.add(bounce);
  if (qs.get('light') === 'inspect') { const key = new THREE.DirectionalLight('#fff4e6', 2.2); key.position.set(-40, 60, 60); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -100, right: 100, top: 60, bottom: -60, near: 1, far: 300 }); key.shadow.bias = -0.0003; scene.add(key, key.target); scene.environmentIntensity = +(qs.get('env') ?? 0.6); }

  if (qs.get('markers')) { // debug: the hook points the integrator uses
    const dot = (o, v, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false })); m.renderOrder = 9; m.position.copy(o.localToWorld(v.clone())); scene.add(m); };
    dot(P.lamp, P.lamp.userData.bulb, '#ff00ff'); dot(P.lamp, P.lamp.userData.bulb.clone().addScaledVector(P.lamp.userData.aim, 12), '#ff00ff');
    dot(P.mug, P.mug.userData.steamOrigin, '#00ffff'); dot(P.clock, P.clock.userData.face, '#ffff00'); dot(P.spool, P.spool.userData.threadEnd, '#00ff00');
  }
  // ---------- camera ----------
  const box = new THREE.Box3(), ctr = new THREE.Vector3(), size = new THREE.Vector3();
  const view = qs.get('view') ?? 'home';
  if (qs.get('cam')) { const v = qs.get('cam').split(',').map(Number); cam.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); }
  else if (P[view]) {
    box.setFromObject(P[view]).getCenter(ctr); box.getSize(size); const d = +(qs.get('dist') ?? Math.max(22, size.length() * 1.15));
    const el = +(qs.get('el') ?? 0.42), az = +(qs.get('az') ?? 0);
    controls.target.copy(ctr); cam.position.set(ctr.x + Math.sin(az) * Math.cos(el) * d, ctr.y + Math.sin(el) * d, ctr.z + Math.cos(az) * Math.cos(el) * d);
  } else if (view === 'top') { cam.position.set(0, 140, 30); controls.target.set(0, 0, -2); }
  else if (view === 'low') { cam.position.set(0, 4, 48); controls.target.set(0, 4, -10); }
  else if (view === 'wide') { cam.position.set(0, 55, 95); controls.target.set(0, 5, -8); }
  else { const aspect = innerWidth / innerHeight; const dist = Math.max(42, 25 / (Math.tan(THREE.MathUtils.degToRad(20)) * aspect)); controls.target.set(0, 9.5, -6); cam.position.set(0, 7.2 + 6, -6 + dist + 12); }
  controls.update();

  const rep = names.map(n => `${n.padEnd(12)} ${String(P[n].userData.footprint.w).padStart(6)} x ${String(P[n].userData.footprint.d).padEnd(6)} h ${P[n].userData.height}`).join('\n');
  info.textContent = `props lab · layout=${layout} view=${view}\n` + rep;
  window.__props = Object.fromEntries(names.map(n => [n, { ...P[n].userData.footprint, h: P[n].userData.height }]));
  console.info('[props-lab] ' + JSON.stringify(window.__props));
  let frames = 0;
  renderer.setAnimationLoop(() => {
    controls.update(); P.clock.userData.tick(); P.pocketWatch.userData.tick?.();
    renderer.render(scene, cam);
    if (++frames === 4) { window.__ready = true; document.body.dataset.ready = '1'; }
  });
  window.__lab = { scene, cam, controls, P, renderer, spot };
  if (qs.get('dbg')) { // show the canvases behind a prop's materials
    const seen = new Set(); P[qs.get('dbg')].traverse(o => { if (!o.isMesh) return; for (const k of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap']) { const t = o.material[k]; const img = t?.image; if (img?.tagName === 'CANVAS' && !seen.has(img)) { seen.add(img); img.style.cssText = 'position:relative;display:block;width:100vw;height:120px;border-bottom:2px solid #f0f'; document.body.prepend(img); } } });
    renderer.domElement.style.display = 'none';
  }
}
start().catch(e => { info.textContent = 'error: ' + e.message; console.error(e); });
