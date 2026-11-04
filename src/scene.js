// The detective's office at night, as much of it as the light reaches: the desk, the evidence board on the wall behind it,
// the props, the lamp, the window light through the blinds with rain on the glass, and everything else falling into black.
// Units are centimetres. The desk top is at y = DESK_Y; the book is centred on the origin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { T } from './theme.js';
import { grainTile, rng } from './paper.js';
import { G, fHill, CASES, TITLE_TXT } from './pages.js';
import { SERIF, DISPLAY, TITLE, HAND } from './typeset.js';
import { loadProps } from './props.js';
import { loadSurfaces } from './assets.js';

export const DESK_Y = -0.202;
export const WALL_Z = -48;
export const BOARD = { w: 150, h: 84, y0: 7, z: WALL_Z + 3.0 }; // board front surface z
export const WINDOW = new THREE.Vector3(175, 105, 25); // where the window light comes from (off to the right)
const ticks = [];
const B = T.bold;

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const std = (o) => new THREE.MeshStandardMaterial(o);
const shadow = (o, cast = true, recv = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };
function grainOver(g, w, h, a = 0.4, seed = 5) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; g.fillStyle = g.createPattern(grainTile(512, seed), 'repeat'); g.fillRect(0, 0, w, h); g.restore(); }

// ---------- darkness ----------
// Everything outside the reach of the lamp and the window falls off to black with distance from the desk and the board.
// Implemented through the fog chunks so every built-in material gets it; scene.fog only switches it on.
export function installDarkness() {
  // The lightning is the only directional light, and dark but for a moment: while it is, skip its shadow lookups and its shading.
  const lf = THREE.ShaderChunk.lights_fragment_begin, at = lf.indexOf('getDirectionalLightInfo');
  THREE.ShaderChunk.lights_fragment_begin = lf.slice(0, at) + lf.slice(at).replace(';', '; if ( directLight.color != vec3( 0.0 ) ) {').replace(/RE_Direct\(.*\);/, '$& }');
  // The map's lamp stand-in is there to be reflected: the real lamp does the lighting. It stands in front of the props, so its fill
  // would wash over every face turned to the viewer (the board, the clock's dial). The diffuse fill reads the map mirrored front to back.
  THREE.ShaderChunk.envmap_physical_pars_fragment = THREE.ShaderChunk.envmap_physical_pars_fragment.replace('envMapRotation * worldNormal, ENVMAP_MAX_LOD', 'envMapRotation * ( worldNormal * vec3( 1.0, 1.0, - 1.0 ) ), ENVMAP_MAX_LOD');
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying vec3 vFogWorld;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vec4 fogW = vec4( transformed, 1.0 );\n #ifdef USE_INSTANCING\n fogW = instanceMatrix * fogW;\n #endif\n vFogWorld = ( modelMatrix * fogW ).xyz;\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying vec3 vFogWorld; uniform float fogNear; uniform float fogFar;
    float fogBox( vec3 p, vec3 c, vec3 b ) { vec3 q = abs( p - c ) - b; return length( max( q, 0.0 ) ) + min( max( q.x, max( q.y, q.z ) ), 0.0 ); }
  #endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    float fogD = min( fogBox( vFogWorld, vec3( 0.0, ${(BOARD.y0 + BOARD.h / 2).toFixed(1)}, ${(WALL_Z + 2).toFixed(1)} ), vec3( ${(BOARD.w / 2 + 4).toFixed(1)}, ${(BOARD.h / 2 + 4).toFixed(1)}, 8.0 ) ),
                      fogBox( vFogWorld, vec3( 0.0, -3.0, -2.0 ), vec3( 92.0, 4.0, 44.0 ) ) );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, smoothstep( 0.0, fogFar, fogD ) * fogNear );
  #endif`;
}

export const BLOTTER = { w: 60, d: 42, x: 0, z: 2, top: DESK_Y + 0.176 };
export async function buildScene(scene, renderer, { mobile, card }) {
  scene.background = new THREE.Color('#000000');
  scene.fog = new THREE.Fog(0x000000, 1.0, 46); // near = strength, far = fall-off distance (cm), see installDarkness
  const out = { tick: (t, dt, cam) => ticks.forEach(f => f(t, dt, cam)), pickables: [], positions: {}, events: {} };
  let kit = null, surf = null;
  try { [kit, surf] = await Promise.all([loadProps(renderer), loadSurfaces(renderer)]); } catch (e) { console.info('[props] using the simple set:', e?.message); }
  room(scene, out, surf); desk(scene, out, surf);
  const board = new THREE.Group(); scene.add(board); evidenceBoard(board, mobile, card, out);
  if (kit) placeProps(scene, out, kit); else props(scene, out);
  lights(scene, renderer, mobile, out);
  return out;
}

// ---------------- room ----------------
function room(scene, out, surf) {
  // old painted plaster with a darker wainscot below the board
  const [c, g] = cv(1024, 1024); const r = rng(31);
  g.fillStyle = '#2b2a24'; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 9000; k++) { g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,240,210,.035)'; const s = 2 + r() * 14; g.fillRect(r() * 1024, r() * 1024, s, s * (0.5 + r())); }
  grainOver(g, 1024, 1024, 0.55, 8);
  for (let k = 0; k < 14; k++) { const x = r() * 1024, y = r() * 1024; const gr = g.createRadialGradient(x, y, 0, x, y, 60 + r() * 140); gr.addColorStop(0, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024); }
  const t = ctex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  const [bc, bg] = cv(256, 256); bg.drawImage(grainTile(256, 8), 0, 0); const bump = ctex(bc, false); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(12, 8);
  const wallMat = surf ? surf.wall({ w: 460, h: 260, tint: '#5d5848' }) : std({ map: t, roughness: 0.96, bumpMap: bump, bumpScale: 0.6 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(460, 260), wallMat); wall.position.set(0, 100, WALL_Z); wall.receiveShadow = true; scene.add(wall);
  out.pickables.push(wall); out.wallMat = wallMat;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(460, 300), std({ color: '#0d0b09', roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -76, 100); floor.receiveShadow = true; scene.add(floor);
}

function woodTexture(w, h, seed = 3) {
  // flat-sawn walnut: long wavy grain lines with cathedral arcs, pores, and slow colour variation
  const [c, g] = cv(w, h); const r = rng(seed);
  const img = g.createImageData(w, h), d = img.data;
  const n1 = new Float32Array(64 * 16).map(() => r());
  const noise = (x, y) => { const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const at = (i, j) => n1[((j & 15) * 64) + (i & 63)]; const a = at(X, Y), b = at(X + 1, Y), cc = at(X, Y + 1), dd = at(X + 1, Y + 1); return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + dd) * sx * sy; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const warp = noise(u * 6, v * 3) * 2.2 + noise(u * 24, v * 9) * 0.35;
    const ring = Math.sin((v * 34 + warp * 3.2 + Math.sin(u * 3.1 + v * 2) * 1.4) * Math.PI);
    const fine = noise(u * 64, v * 15.9) * 0.5 + noise(u * 63, v * 15.7 + 3) * 0.5;
    let k = 0.5 + 0.28 * ring + 0.22 * (fine - 0.5) + 0.25 * (noise(u * 2, v * 1.5) - 0.5);
    k = Math.max(0, Math.min(1, k));
    const i = (y * w + x) * 4;
    d[i] = 40 + k * 46; d[i + 1] = 22 + k * 28; d[i + 2] = 12 + k * 15; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < w * 2.2; k++) { g.fillStyle = `rgba(10,5,2,${0.12 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 6, 1); } // pores
  return ctex(c);
}
function desk(scene, out, surf) {
  let top, side;
  if (surf) { top = surf.deskWood({ w: 190, d: 92 }); side = surf.deskWood({ w: 190, d: 92, tint: '#6f5a50' }); }
  else { const map = woodTexture(1024, 512); map.wrapS = map.wrapT = THREE.RepeatWrapping;
    top = new THREE.MeshPhysicalMaterial({ map, roughness: 0.48, clearcoat: 0.4, clearcoatRoughness: 0.45, specularIntensity: 0.5, metalness: 0 });
    side = new THREE.MeshPhysicalMaterial({ map, color: '#9a8a80', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }); }
  // the varnish mirrors the real lamp only: the environment's lamp stand-in sits off to the left, so across a 190 cm top it
  // outlined the left edges alone. (three ignores envMapIntensity on materials that fall back to scene.environment.)
  for (const mt of [top, side]) { mt.envMap = scene.environment; mt.envMapIntensity = 0; }
  const m = new THREE.Mesh(new RoundedBoxGeometry(190, 4.5, 92, 4, 0.8), [top]);
  m.material = top; m.position.set(0, DESK_Y - 2.25, WALL_Z + 46); m.receiveShadow = true; m.castShadow = true; scene.add(m);
  const apron = new THREE.Mesh(new RoundedBoxGeometry(184, 10, 86, 2, 0.4), side); apron.position.set(0, DESK_Y - 9.5, WALL_Z + 46); scene.add(apron);
  for (const [x, z] of [[-89, WALL_Z + 6], [89, WALL_Z + 6], [-89, WALL_Z + 86], [89, WALL_Z + 86]]) { const l = new THREE.Mesh(new RoundedBoxGeometry(6, 72, 6, 2, 0.5), side); l.position.set(x, DESK_Y - 40, z); scene.add(l); }
  // tooled leather writing blotter under the book
  const [c, g] = cv(1536, 1024); const r = rng(14);
  g.fillStyle = '#1f3a2c'; g.fillRect(0, 0, 1536, 1024);
  for (let k = 0; k < 60000; k++) { const v = r(); g.fillStyle = v > 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(120,160,120,.05)'; g.fillRect(r() * 1536, r() * 1024, 1 + r() * 2, 1 + r() * 2); }
  grainOver(g, 1536, 1024, 0.5, 19);
  const gold = 'rgba(196,160,86,.75)'; g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(34, 34, 1536 - 68, 1024 - 68); g.lineWidth = 1.2; g.strokeRect(46, 46, 1536 - 92, 1024 - 92);
  const wear = g.createRadialGradient(768, 560, 80, 768, 520, 760); wear.addColorStop(0, 'rgba(160,190,150,.10)'); wear.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = wear; g.fillRect(0, 0, 1536, 1024);
  const lt = ctex(c);
  const [bc, bg] = cv(512, 512); bg.drawImage(grainTile(512, 19), 0, 0); const lb = ctex(bc, false); lb.wrapS = lb.wrapT = THREE.RepeatWrapping; lb.repeat.set(4, 3);
  // the blotter stands 1.76 mm proud of the desk; its top is BLOTTER.top
  const blotter = new THREE.Mesh(new RoundedBoxGeometry(BLOTTER.w, 0.35, BLOTTER.d, 2, 0.15), new THREE.MeshPhysicalMaterial({ map: lt, roughness: 0.62, bumpMap: lb, bumpScale: 1.2, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#4f6f5a') }));
  blotter.position.set(BLOTTER.x, BLOTTER.top - 0.175, BLOTTER.z); blotter.receiveShadow = true; scene.add(blotter);
  out.pickables.push(m, blotter); out.blotterTop = DESK_Y + 0.176;
}

// ---------------- evidence board ----------------
function evidenceBoard(group, mobile, card, out) {
  const { w, h, y0, z } = BOARD; const cy = y0 + h / 2;
  const [c, g] = cv(2048, Math.round(2048 * h / w));
  g.fillStyle = '#9c7146'; g.fillRect(0, 0, c.width, c.height); const r = rng(9);
  for (let k = 0; k < 160000; k++) { const v = r(); g.fillStyle = v > 0.6 ? 'rgba(70,40,15,.32)' : v > 0.3 ? 'rgba(220,170,110,.22)' : 'rgba(40,20,5,.28)'; g.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let k = 0; k < 260; k++) { g.fillStyle = 'rgba(30,15,5,.55)'; g.beginPath(); g.arc(r() * c.width, r() * c.height, 1.4, 0, 7); g.fill(); } // old pin holes
  for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(255,235,200,.05)'; g.fillRect(r() * c.width, r() * c.height, 80 + r() * 160, 60 + r() * 120); } // shadows of papers that used to hang here
  const corkMap = ctex(c); const [kc, kg] = cv(1024, 576); kg.drawImage(c, 0, 0, 1024, 576); const corkBump = ctex(kc, false);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: corkMap, roughness: 0.97, bumpMap: corkBump, bumpScale: 1.6 }));
  surf.position.set(0, cy, z); surf.receiveShadow = true; group.add(surf); out.pickables.push(surf);
  const fm = new THREE.MeshPhysicalMaterial({ color: '#2a170c', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const fw = 3.4;
  for (const [x, y, ww, hh] of [[0, y0 - fw / 2, w + fw * 2, fw], [0, y0 + h + fw / 2, w + fw * 2, fw], [-w / 2 - fw / 2, cy, fw, h], [w / 2 + fw / 2, cy, fw, h]]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(ww, hh, 3.4, 2, 0.5), fm); b.position.set(x, y, z - 1.0); shadow(b); group.add(b);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.4), std({ color: '#3a2a1a' })); back.position.set(0, cy, z - 1.25); group.add(back);

  // pinned items. Each: [x, y (board-local centre, from bottom-left), w, h, rot, draw, opts]
  // Papers that overlap are stacked: each sits one layer above the highest one it covers, so their waviness, curl and
  // flutter never cross. Fluttering notes bend outward below their pin; the part above the pin stays on the board.
  const anchors = {}, placed = [], LAYER = 0.32;
  const pr = rng(101);
  const footprint = (x, y, iw, ih, rot, pinAt, pad = 0.3) => { const c = Math.cos(rot), sn = Math.sin(rot), px = x + pinAt[0], py = y + pinAt[1];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const lx = -pinAt[0] + u * (iw / 2 + pad), ly = -pinAt[1] + v * (ih / 2 + pad); return [px + c * lx - sn * ly, py + sn * lx + c * ly]; }); };
  const sat = (A, Bc) => { for (const Q of [A, Bc]) for (let i = 0; i < 4; i++) { const [x0, y0] = Q[i], [x1, y1] = Q[(i + 1) % 4], nx = y1 - y0, ny = x0 - x1;
    const pa = A.map(([x, y]) => x * nx + y * ny), pb = Bc.map(([x, y]) => x * nx + y * ny); if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false; } return true; };
  const inside = (Q, x, y) => { let s0 = 0; for (let i = 0; i < 4; i++) { const [x0, y0] = Q[i], [x1, y1] = Q[(i + 1) % 4], c = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0); if (c !== 0) { if (s0 && Math.sign(c) !== s0) return false; s0 = Math.sign(c); } } return true; };
  // how far the paper stands off the cork at a board point (cm), for strings to lie over
  const paperAt = (x, y) => placed.reduce((h, q) => inside(q.fp, x, y) ? Math.max(h, q.layer * LAYER + 0.12 + 0.25 + q.lift) : h, 0);
  const item = (key, x, y, iw, ih, rot, draw, { color = '#efe3c8', pinAt = [0, ih / 2 - 1.2], flutter = false, curl = 0.0, ppc = mobile ? 16 : 26, pins = null, tex = null } = {}) => {
    let map = tex;
    if (!map) {
      const [ic, ig] = cv(Math.round(iw * ppc), Math.round(ih * ppc));
      ig.fillStyle = color; ig.fillRect(0, 0, ic.width, ic.height); grainOver(ig, ic.width, ic.height, 0.45, 13);
      draw(ig, ppc, ic.width, ic.height);
      // light ageing toward the edges
      const e = ig.createRadialGradient(ic.width / 2, ic.height / 2, Math.min(ic.width, ic.height) * 0.3, ic.width / 2, ic.height / 2, Math.max(ic.width, ic.height) * 0.75); e.addColorStop(0, 'rgba(90,60,20,0)'); e.addColorStop(1, 'rgba(90,60,20,.16)'); ig.fillStyle = e; ig.fillRect(0, 0, ic.width, ic.height);
      map = ctex(ic);
    }
    const geo = new THREE.PlaneGeometry(iw, ih, 10, flutter ? 24 : 10);
    const p = geo.attributes.position; const ph = pr() * 6;
    for (let i = 0; i < p.count; i++) { const xx = p.getX(i), yy = p.getY(i); let zz = 0.06 + Math.sin(xx * 0.35 + ph) * Math.sin(yy * 0.3) * 0.06; if (curl) zz += Math.max(0, -yy / ih - 0.2) ** 2 * curl; zz += (Math.abs(xx) / iw * 2) ** 3 * 0.12 * (1 - Math.min(1, Math.abs(yy - pinAt[1] + ih / 2) / ih)); p.setZ(i, zz); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ map, roughness: 0.9, side: THREE.DoubleSide }));
    const fp = footprint(x, y, iw, ih, rot, pinAt);
    const layer = placed.reduce((l, q) => sat(fp, q.fp) ? Math.max(l, q.layer + 1) : l, 0);
    placed.push({ key, fp, layer, lift: curl * 0.64 + 0.12 });
    const holder = new THREE.Group();
    holder.position.set(x - w / 2 + pinAt[0], y + y0 + pinAt[1], z + 0.12 + layer * LAYER + pr() * 0.02); holder.rotation.z = rot;
    m.position.set(-pinAt[0], -pinAt[1], 0); holder.add(m); shadow(holder, true, true); group.add(holder);
    const pinList = pins || [pinAt];
    for (const [px, py] of pinList) { const v = new THREE.Vector3(px - pinAt[0], py - pinAt[1], 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rot); group.add(boardPin(new THREE.Vector3(holder.position.x + v.x, holder.position.y + v.y, holder.position.z + 0.15), pr)); }
    anchors[key] = new THREE.Vector3(holder.position.x, holder.position.y, holder.position.z + 0.2);
    if (flutter) {
      // a draught lifts the free end now and then; the paper curls from the pin line down (arc length is kept)
      const ph2 = pr() * 6, base = Float32Array.from(p.array), pinY = pinAt[1], rows = new Map(); let acc = 1;
      ticks.push((t, dt) => {
        acc += dt; if (acc < 1 / 30 || out.freeze) return; acc = 0;
        const a = (Math.max(0, Math.sin(t * 0.9 + ph2)) ** 6) * 0.38 + (0.5 + 0.5 * Math.sin(t * 7 + ph2)) * 0.012;
        rows.clear();
        for (let i = 0; i < p.count; i++) {
          const yy = base[i * 3 + 1], d = pinY - yy; let dz = 0, dy = 0;
          if (d > 0) { let o = rows.get(yy); if (!o) { o = [0, 0]; for (let s0 = 0, n = Math.ceil(d / 0.1), h = d / n; s0 < n; s0++) { const th = a * Math.min(1, (s0 + 0.5) * h / 2.2); o[0] += Math.sin(th) * h; o[1] += (1 - Math.cos(th)) * h; } rows.set(yy, o); } dz = o[0]; dy = o[1]; }
          p.setY(i, yy + dy); p.setZ(i, base[i * 3 + 2] + dz);
        }
        p.needsUpdate = true; geo.computeVertexNormals();
      });
    }
    return holder;
  };

  // header
  item('head', 75, 79, 46, 8, -0.01, (g, p, W, H) => {
    g.fillStyle = T.ink; g.font = `700 ${4.2 * p}px ${TITLE}`; g.textBaseline = 'middle'; g.fillText(TITLE_TXT, 2.2 * p, H / 2 + 0.2 * p);
    const tw = g.measureText(TITLE_TXT).width, x0 = 2.2 * p + tw + 1.4 * p, room = W - x0 - 1.6 * p, sub = '— book plan, AIF1303 endterm';
    g.font = `400 ${2.3 * p}px ${HAND}`; const k = Math.min(1, room / g.measureText(sub).width); g.font = `400 ${2.3 * p * k}px ${HAND}`;
    g.fillStyle = T.accent; g.fillText(sub, x0, H / 2 + 0.5 * p);
  }, { pinAt: [0, 2.4] });
  // case cards I–X
  const casePos = [[22, 57], [45, 60], [68, 56], [92, 60], [116, 57], [24, 35], [48, 38], [72, 34], [96, 38], [121, 39]];
  CASES.forEach(([rn, t, s, p], i) => {
    const [x, y] = casePos[i]; const done = p !== undefined;
    item('c' + i, x, y, 17, 10.5, (Math.sin(i * 7.1) * 0.05), (g, q, W, H) => {
      g.strokeStyle = 'rgba(163,39,29,.5)'; g.lineWidth = 0.1 * q; g.beginPath(); g.moveTo(0, 2.4 * q); g.lineTo(W, 2.4 * q); g.stroke(); g.strokeStyle = 'rgba(60,90,160,.2)'; for (let yy = 3.6; yy < H / q; yy += 1.1) { g.beginPath(); g.moveTo(0, yy * q); g.lineTo(W, yy * q); g.stroke(); }
      g.fillStyle = T.accent; g.font = `400 ${1.5 * q}px ${DISPLAY}`; g.fillText(`CASE ${rn}`, 1.0 * q, 2.0 * q);
      g.fillStyle = T.ink; g.font = `700 ${1.75 * q}px ${TITLE}`; g.fillText(t, 1.0 * q, 4.9 * q);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.font = `400 ${1.7 * q}px ${HAND}`; g.fillText(s, 1.0 * q, 7.0 * q);
      g.save(); g.translate(11.8 * q, 8.9 * q); g.rotate(-0.1); g.font = `400 ${1.0 * q}px ${DISPLAY}`; g.textAlign = 'center';
      if (done) { g.strokeStyle = g.fillStyle = '#a3271d'; g.lineWidth = 0.12 * q; g.strokeRect(-3.4 * q, -0.95 * q, 6.8 * q, 1.4 * q); g.fillText('✓ DRAFTED', 0, 0); }
      else { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText('TO DO', 0, 0); }
      g.restore();
    }, { color: '#f3ead6', pinAt: [0, 3.8] });
  });
  // pencil sketches of the pop-ups
  const pencil = (g, p) => { g.strokeStyle = 'rgba(40,35,30,.75)'; g.fillStyle = g.strokeStyle; g.lineWidth = 0.12 * p; g.lineCap = 'round'; };
  item('sk1', 130, 76, 20, 15, 0.05, (g, p) => {
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('post height = h(n)', 1.2 * p, 2.2 * p);
    G.nodes.forEach(n => { const x = 1.5 + n.x * 1.25, base = 13.5 - (n.v - 3) * 0.25, ph = 0.8 + n.h * 0.55; g.beginPath(); g.moveTo(x * p, base * p); g.lineTo(x * p, (base - ph) * p); g.stroke(); g.strokeRect((x + 0.05) * p, (base - ph) * p, 1.0 * p, 0.6 * p); g.font = `400 ${0.8 * p}px ${HAND}`; g.fillText(n.id, (x + 0.25) * p, (base - ph + 0.48) * p); });
    g.strokeStyle = T.accent; g.beginPath(); g.moveTo(1 * p, 14.2 * p); g.lineTo(19 * p, 14.2 * p); g.stroke();
  }, { pinAt: [0, 6.2] });
  item('sk2', 22, 77, 21, 14, -0.06, (g, p) => {
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('ridges = slices of f(x, v)', 1.2 * p, 2.2 * p);
    [3.8, 6.2, 8.8, 11.2, 12.8, 15.2].forEach((v, i) => { g.globalAlpha = 0.45 + i * 0.1; g.beginPath(); for (let k = 0; k <= 40; k++) { const x = 0.7 + 12.6 * k / 40, X = 1 + k / 40 * 17 + i * 0.4, Y = 12.8 - i * 0.55 - fHill(x, v) * 0.75; k ? g.lineTo(X * p, Y * p) : g.moveTo(X * p, Y * p); } g.stroke(); });
    g.globalAlpha = 1; g.fillStyle = T.accent; g.font = `400 ${1.2 * p}px ${HAND}`; g.fillText('B → 10.3', 13 * p, 4.6 * p);
  }, { pinAt: [0, 5.8] });
  item('sk3', 47, 15, 18, 13, 0.04, (g, p) => {
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('agent = box, city behind', 1.0 * p, 2.0 * p);
    g.strokeRect(5 * p, 6.5 * p, 8 * p, 4.2 * p); g.beginPath(); g.moveTo(5 * p, 6.5 * p); g.lineTo(7 * p, 5.2 * p); g.lineTo(15 * p, 5.2 * p); g.lineTo(13 * p, 6.5 * p); g.moveTo(15 * p, 5.2 * p); g.lineTo(15 * p, 9.4 * p); g.lineTo(13 * p, 10.7 * p); g.stroke();
    g.strokeStyle = T.accent; g.beginPath(); g.moveTo(16.5 * p, 3.6 * p); g.quadraticCurveTo(17.5 * p, 8 * p, 13.5 * p, 8.4 * p); g.stroke();
    g.strokeStyle = T.accent2; g.beginPath(); g.moveTo(4.5 * p, 9 * p); g.quadraticCurveTo(1.2 * p, 7 * p, 2.2 * p, 3.4 * p); g.stroke();
  }, { pinAt: [0, 5.2] });
  // printed map of the search graph
  item('map', 100, 15, 22, 15, -0.03, (g, p) => {
    g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillStyle = T.ink; g.fillText('MAP · 9 locations, 13 roads', 1.0 * p, 1.7 * p);
    const X = x => (1.2 + x * 1.42) * p, Y = v => (0.6 + v * 0.85) * p;
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.1 * p; for (const [a, b] of G.edges) { g.beginPath(); g.moveTo(X(G.by[a].x), Y(G.by[a].v)); g.lineTo(X(G.by[b].x), Y(G.by[b].v)); g.stroke(); }
    g.strokeStyle = T.accent; g.lineWidth = 0.35 * p; g.beginPath(); G.astar.path.forEach((id, i) => { const n = G.by[id]; i ? g.lineTo(X(n.x), Y(n.v)) : g.moveTo(X(n.x), Y(n.v)); }); g.stroke();
    for (const n of G.nodes) { g.fillStyle = n.id === 'G' ? T.accent : T.ink; g.beginPath(); g.arc(X(n.x), Y(n.v), 0.5 * p, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `${B} ${0.65 * p}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n.id, X(n.x), Y(n.v) + 0.05 * p); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
  }, { pinAt: [0, 6.3] });
  // the brief's rubric
  item('rubric', 15, 16, 19, 22, 0.02, (g, p) => {
    g.fillStyle = T.ink; g.font = `${B} ${1.15 * p}px ${SERIF}`; g.fillText('EVALUATION · 100', 1.2 * p, 2.4 * p);
    const rows = [['Content coverage', 20, 0], ['Scientific accuracy', 25, 1], ['Clarity, education', 20, 1], ['Creativity', 15, 1], ['Design, organisation', 10, 1], ['Presentation, defence', 10, 0]];
    rows.forEach(([t, pt, ok], i) => { const yy = 4.8 + i * 2.6; g.fillStyle = T.ink; g.font = `400 ${0.95 * p}px ${SERIF}`; g.fillText(t, 1.2 * p, yy * p); g.textAlign = 'right'; g.fillText(String(pt), 17.6 * p, yy * p); g.textAlign = 'left';
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 0.06 * p; g.beginPath(); g.moveTo(1.2 * p, (yy + 0.7) * p); g.lineTo(17.8 * p, (yy + 0.7) * p); g.stroke();
      if (ok) { g.strokeStyle = T.accent; g.lineWidth = 0.22 * p; g.beginPath(); g.moveTo(13.2 * p, (yy - 0.5) * p); g.lineTo(13.8 * p, (yy + 0.1) * p); g.lineTo(15 * p, (yy - 1.0) * p); g.stroke(); } });
    g.fillStyle = T.accent; g.font = `400 ${1.4 * p}px ${HAND}`; g.fillText('accuracy is the big one', 1.2 * p, 20.6 * p);
  }, { pinAt: [0, 9.6] });
  // calendar: November 2026
  item('cal', 141, 50, 16, 17, 0.0, (g, p, W) => {
    g.fillStyle = T.accent; g.fillRect(0, 0, W, 3.2 * p); g.fillStyle = '#fff'; g.font = `${B} ${1.4 * p}px ${SERIF}`; g.textAlign = 'center'; g.fillText('NOVEMBER 2026', W / 2, 2.1 * p);
    g.fillStyle = T.ink; g.font = `400 ${0.75 * p}px ${SERIF}`; ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => g.fillText(d, (1.6 + i * 2.15) * p, 4.6 * p));
    for (let d = 1; d <= 30; d++) { const idx = d + 6 - 1; /* 1 Nov 2026 is a Sunday; Monday-first grid */ const col = idx % 7, row = Math.floor(idx / 7); const x = (1.6 + col * 2.15) * p, y = (6.5 + row * 1.85) * p; g.fillStyle = d < 3 ? 'rgba(0,0,0,.3)' : T.ink; g.fillText(String(d), x, y);
      if (d < 3) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.08 * p; g.beginPath(); g.moveTo(x - 0.7 * p, y - 0.7 * p); g.lineTo(x + 0.7 * p, y + 0.2 * p); g.stroke(); }
    }
  }, { pinAt: [0, 7.6] });
  // lecture printouts W1–W3
  [['W1', 'Intelligent agents'], ['W2', 'Search · A*'], ['W3', 'Local search · CSP']].forEach(([wk, t], i) => item('w' + i, 8 + i * 4, 56 - i * 3, 13, 9, -0.05 + i * 0.04, (g, p, W) => {
    g.fillStyle = '#2c3956'; g.fillRect(0, 0, W, 2.4 * p); g.fillStyle = '#fff'; g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillText(`${wk} · AIF1303`, 0.8 * p, 1.6 * p);
    g.fillStyle = T.ink; g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillText(t, 0.8 * p, 4.0 * p);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) g.fillRect(0.8 * p, (5.0 + k * 0.9) * p, (6 + ((k * 5 + i) % 4) * 1.4) * p, 0.35 * p);
  }, { pinAt: [0, 3.4] }));
  // sticky notes
  const sticky = (key, x, y, rot, lines, col, opts = {}) => item(key, x, y, 9, 9, rot, (g, p) => {
    g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, 9 * p, 1.4 * p);
    g.fillStyle = opts.ink || '#1d1b18'; g.font = `400 ${1.55 * p}px ${HAND}`; lines.forEach((l, i) => g.fillText(l, 0.8 * p, (3.2 + i * 1.75) * p));
  }, { color: col, pinAt: [0, 3.6], curl: opts.curl ?? 0.6, flutter: opts.flutter });
  sticky('n1', 31, 13, 0.06, ['verify every', 'number in', 'Python ✓'], '#e8d57a');
  sticky('n3', 87, 76, 0.04, ['card on the', 'board → test', 'QR on a phone!'], '#e8d57a'); // strings hold this one down
  sticky('n4', 108, 76, -0.03, ['explain each', 'term the first', 'time it appears'], '#e3b08a', { flutter: true });
  sticky('n6', 60, 77, -0.05, ['eye level =', 'the story;', 'above = the text'], '#d9c08a', { flutter: true });
  // the 16:9 presentation card, printed and pinned at both top corners, in the clear corner below Case X
  if (card) {
    const cw = 32, ch = 18;
    const t = ctex(card); t.anisotropy = 16;
    item('card', 129, 17.5, cw, ch, 0.012, null, { tex: t, pinAt: [0, ch / 2 - 1.1], pins: [[-cw / 2 + 1.2, ch / 2 - 1.1], [cw / 2 - 1.2, ch / 2 - 1.1]] });
  }

  // red strings: the case chain, then cards to their sketches and notes
  const chain = []; for (let i = 0; i < 9; i++) chain.push(['c' + i, 'c' + (i + 1)]);
  const extra = [['c1', 'sk1'], ['c1', 'map'], ['c2', 'sk2'], ['c0', 'sk3'], ['head', 'n3'], ['c4', 'cal'], ['rubric', 'n1'], ['c0', 'w0'], ['c1', 'w1'], ['c2', 'w2'], ['n3', 'card']];
  for (const [a, b] of [...chain, ...extra]) if (anchors[a] && anchors[b]) group.add(boardString(anchors[a], anchors[b], (x, y) => z + paperAt(x + w / 2, y - y0)));
  pinMeshes(group);
  out.boardLayout = placed.map(q => ({ key: q.key, layer: q.layer, fp: q.fp }));
  for (let i = 0; i < placed.length; i++) for (let k = i + 1; k < placed.length; k++) if (sat(placed[i].fp, placed[k].fp)) console.info(`[board] ${placed[k].key} lies over ${placed[i].key}`);
}
// push pins: one instanced mesh per colour
const PIN_COLS = ['#a8231b', '#b8892f', '#2c3956', '#d8d0bd'], pinList = [];
function boardPin(p, r) {
  const k = [0, 1, 0, 2, 3][Math.floor(r() * 5)];
  const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25)), new THREE.Vector3(1, 1, 1));
  pinList.push([k, m]); return new THREE.Object3D();
}
function pinMeshes(group) {
  const geo = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.26, 0.55], [0.58, 0.68], [0.6, 0.86], [0.5, 0.95], [0, 0.98]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  PIN_COLS.forEach((col, k) => {
    const mine = pinList.filter(q => q[0] === k); if (!mine.length) return;
    // glossy enough to read as plastic, rough enough that a 4 px cap never sparkles as the camera moves
    const im = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.32 }), mine.length);
    mine.forEach(([, m], i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = false; group.add(im);
  });
}
// a string between two board pins: wound on each pin's shaft under the cap, lying over any paper it crosses, sagging a
// little and swaying in the draught (outward only, never into the paper)
function boardString(a0, b0, surfZ) {
  // start at the shaft's surface, not its axis, so strings sharing a pin never overlap each other
  const dir = b0.clone().sub(a0).setZ(0).normalize(), a = a0.clone().addScaledVector(dir, 0.3), b = b0.clone().addScaledVector(dir, -0.3);
  const pts = []; const L = a.distanceTo(b);
  for (let i = 0; i <= 24; i++) { const t = i / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * L * 0.035; p.z = Math.max(p.z + 0.35 + Math.sin(Math.PI * t) * 0.25, surfZ(p.x, p.y) + 0.15); pts.push(p); }
  for (let k = 0; k < 2; k++) for (let i = 1; i < 24; i++) pts[i].z = Math.max(pts[i].z, (pts[i - 1].z + pts[i + 1].z) / 2); // no kinks where it climbs onto a paper
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.1, 6, false);
  const mat = std({ color: T.string, roughness: 0.75 }); const u = { t: { value: 0 }, ph: { value: (L * 7.31) % 6 }, amp: { value: Math.min(0.6, L * 0.008) } };
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uT: u.t, uPh: u.ph, uAmp: u.amp }); sh.vertexShader = 'uniform float uT, uPh, uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float s = sin(3.14159 * uv.x); transformed.y += sin(uT * 0.8 + uPh) * uAmp * s; transformed.z += (0.5 + 0.5 * sin(uT * 0.55 + uPh * 1.7)) * uAmp * 0.6 * s;'); };
  ticks.push(t => { u.t.value = t; });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}

// ---------------- props (placeholder set; replaced by props.js when it loads) ----------------
function props(scene, out) {
  const D = DESK_Y;
  const add = (o, x, z, ry = 0, y = D) => { o.position.set(x, y, z); o.rotation.y = ry; shadow(o); scene.add(o); return o; };
  // the lamp stands at the front-left corner, its shade reaching over the book, so the light rakes across the exhibits
  const lampObj = add(bankerLamp(), -44, 13, 2.0); lampObj.scale.setScalar(0.85); out.lampObj = lampObj;
  lampObj.updateMatrixWorld(); out.bulb = lampObj.localToWorld(lampObj.userData.bulb.clone());
  const mug = mugMesh(); add(mug, 34, -16, -0.6); const steam = steamMesh(); steam.position.set(34, D + 9.5, -16); scene.add(steam); out.positions.mug = new THREE.Vector3(34, D + 8, -16);
  add(magnifier(), 27, 22, 0.7, D + 0.6);
  add(pencilMesh('#d9a531'), -27, 17, 0.35, D + 0.45); add(pencilMesh('#2c3956'), -25, 20.5, 0.15, D + 0.45);
  add(cardStack(), -25, -21, 0.2);
  add(spool(), 40, 4, 0.2); add(pinTin(), 47, 15, 0);
  const loose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[40, D + 2.2, 4], [36, D + 0.12, 7], [30, D + 0.12, 6], [24, D + 0.12, 9], [19, D + 0.12, 6.5]].map(p => new THREE.Vector3(...p))), 64, 0.08, 6), std({ color: T.string, roughness: 0.75 }));
  shadow(loose); scene.add(loose);
  add(deskClock(), 52, -32, -0.45); out.positions.clock = new THREE.Vector3(52, D + 6, -32);
  add(legalPad(), -48, -18, 0.22);
  out.positions.lamp = out.bulb.clone(); out.positions.book = new THREE.Vector3(0, 2, 0); out.positions.window = WINDOW.clone();
}
// ---------------- props (props.js) ----------------
// Each prop's origin is the centre of its footprint at its base. A prop sits either wholly on the blotter or wholly on the
// wood, never across the blotter's edge, and no two footprints overlap: checked below, warned about in the console.
const LAYOUT = [
  // name, x, z, rotation about y. The middle of the back is kept clear so the pop-ups stand against the dark.
  ['lamp', -47, 17, 1.92], // front left, just out of the desk view: its light rakes across the pop-ups' printed faces
  ['legalPad', -45, -14, 0.15],
  ['cardStack', -22.5, -8.5, 1.45],
  ['pencilA', -12.5, 16.2, 0.22],
  ['pencilB', -16.5, 20.4, 0.06],
  ['fountainPen', 15.5, 18.2, -0.35],
  ['magnifier', 22.8, -2, 1.62],
  ['mug', 41, -15, -0.5],
  ['clock', 33, -37, -0.42],
  ['spool', 42, 3.5, 0.3],
  ['pinTin', 46, 14, 0.32],
  ['spectacles', -22, -30, 0.5],
  ['envelope', -50, -38.5, 0.1],
  ['pocketWatch', 22, -27, 0.5],
];
function cheapGlass(m) { // three's transmission costs a second full render of the scene; a thin dielectric sheen reads the same here
  return new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: Math.min(0.06, m.roughness ?? 0.03), ior: 1.5, specularIntensity: 1, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.4, name: (m.name || '') + ' (glass)' });
}
function placeProps(scene, out, kit) {
  const B = BLOTTER, bx0 = B.x - B.w / 2, bx1 = B.x + B.w / 2, bz0 = B.z - B.d / 2, bz1 = B.z + B.d / 2;
  const boxes = [];
  for (const [name, x, z, ry] of LAYOUT) {
    const o = kit[name]; if (!o) continue;
    o.traverse(m => { if (m.isMesh && m.material?.transmission > 0) m.material = cheapGlass(m.material); });
    const fp = o.userData.footprint, c = Math.cos(ry), s = Math.sin(ry);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + c * u * fp.w / 2 + s * v * fp.d / 2, z - s * u * fp.w / 2 + c * v * fp.d / 2]);
    const inside = corners.filter(([px, pz]) => px > bx0 && px < bx1 && pz > bz0 && pz < bz1).length;
    const base = name === 'lamp' ? 8.0 : 0; // the lamp stands on its round foot; its shade is in the air
    const onB = base ? (x > bx0 - base && x < bx1 + base && z > bz0 - base && z < bz1 + base) : inside === 4;
    if (!base && inside > 0 && inside < 4) console.warn(`[props] ${name} straddles the blotter edge`);
    if (base && x > bx0 - base && x < bx1 + base && z > bz0 - base && z < bz1 + base && !(x - base > bx0 && x + base < bx1 && z - base > bz0 && z + base < bz1)) console.warn(`[props] ${name} foot straddles the blotter edge`);
    o.position.set(x, onB ? B.top : DESK_Y, z); o.rotation.y = ry; scene.add(o);
    boxes.push({ name, corners: base ? null : corners, circle: base ? [x, z, base] : null });
    out.props = out.props || {}; out.props[name] = o;
  }
  // the open book's footprint, at its widest
  boxes.push({ name: 'book', corners: [[-15, -10.6], [15, -10.6], [15, 10.6], [-15, 10.6]] });
  const sat = (A, Bc) => { for (const P of [A, Bc]) for (let i = 0; i < 4; i++) { const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % 4], nx = z1 - z0, nz = x0 - x1;
    const pa = A.map(([x, z]) => x * nx + z * nz), pb = Bc.map(([x, z]) => x * nx + z * nz); if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false; } return true; };
  const circ = ([cx, cz, r]) => Array.from({ length: 4 }, (_, k) => [cx + r * Math.cos(k * Math.PI / 2 + Math.PI / 4) * Math.SQRT2, cz + r * Math.sin(k * Math.PI / 2 + Math.PI / 4) * Math.SQRT2]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].corners || circ(boxes[i].circle), b = boxes[j].corners || circ(boxes[j].circle);
    if (sat(a, b)) console.warn(`[props] ${boxes[i].name} overlaps ${boxes[j].name}`);
  }
  out.layout = boxes;

  // the lamp: its light comes from its bulb, and leaves through the mouth of the shade
  const lamp = out.props.lamp; lamp.updateMatrixWorld(true); out.lampObj = lamp;
  const bulb = lamp.localToWorld(lamp.userData.bulb.clone()), aim = lamp.userData.aim.clone().transformDirection(lamp.matrixWorld);
  out.bulb = bulb; out.lampAim = aim;
  // its cord: on from the base across the wood, square over the desk's left edge, and plumb to the floor. Its centre stays
  // one radius off the wood, wraps the top's rounded edge (radius 0.8), and swings out a little before it hangs free.
  const { cord, cordTail } = lamp.userData, from = cord.localToWorld(cordTail.clone()), r = cordTail.y, lip = 0.8, ex = -95 + lip, ey = DESK_Y - lip, n = 5, run = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z), wander = k => from.z + Math.sin(k * 1.3) * 0.8, z = wander(n);
  run.push(V(from.x - 2, DESK_Y + r, from.z)); // a point close to each end of the run keeps the spline from dipping into the wood
  for (let k = 1; k < n; k++) run.push(V(from.x + (ex - from.x) * k / n, DESK_Y + r, wander(k)));
  run.push(V(ex + 2, DESK_Y + r, z));
  for (const a of [0, 30, 60, 90].map(THREE.MathUtils.degToRad)) run.push(V(ex - (lip + r) * Math.sin(a), ey + (lip + r) * Math.cos(a), z));
  run.push(V(-95.45, DESK_Y - 3, z), V(-95.6, DESK_Y - 8, z), V(-95.6, -76 + r, z));
  lamp.userData.setCord(run.map(p => cord.worldToLocal(p)));
  // steam rises from the coffee's surface
  const mug = out.props.mug; mug.updateMatrixWorld(true);
  const so = mug.userData.steamOrigin ? mug.localToWorld(mug.userData.steamOrigin.clone()) : mug.position.clone().add(new THREE.Vector3(0, 6, 0));
  const steam = steamMesh(); steam.position.copy(so).add(new THREE.Vector3(0, 9 * 0.62, 0)); steam.scale.setScalar(0.62); scene.add(steam);
  // clocks run
  for (const k of ['clock', 'pocketWatch']) { const t = out.props[k]?.userData.tick; if (t) { let acc = 1; ticks.push((_, dt) => { acc += dt; if (acc > 0.03) { acc = 0; t(); } }); } }
  const clk = out.props.clock; clk.updateMatrixWorld(true);
  out.positions.clock = clk.userData.face ? clk.localToWorld(clk.userData.face.clone()) : clk.position.clone().add(new THREE.Vector3(0, 8, 0));
  out.positions.mug = so.clone(); out.positions.lamp = bulb.clone(); out.positions.book = new THREE.Vector3(0, 2, 0);
  out.positions.window = WINDOW.clone();
  out.pickables.push(...Object.values(out.props));
}
function lathe(points, mat, seg = 48) { return new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); }
function bankerLamp() {
  const g = new THREE.Group(); const brass = new THREE.MeshStandardMaterial({ color: '#b8893a', metalness: 1, roughness: 0.3 });
  g.add(lathe([[0, 0], [7, 0], [7, 0.8], [6, 1.6], [2, 2.4], [0, 2.4]], brass));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 24, 16), brass); stem.position.y = 13; g.add(stem);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 12), brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, 25, 4); g.add(arm);
  const shadeMat = std({ color: '#1f5a3a', roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, emissive: '#0a2414', emissiveIntensity: 0.8 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 24, 32, 1, true, 0, Math.PI), shadeMat); shade.rotation.z = Math.PI / 2; shade.position.set(0, 26.5, 8); g.add(shade);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, 23.6, 32, 1, true, 0, Math.PI), std({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 2.2, side: THREE.BackSide })); inner.rotation.z = Math.PI / 2; inner.position.copy(shade.position); g.add(inner);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32, 0, Math.PI), shadeMat); cap.rotation.y = s * Math.PI / 2; cap.position.set(s * 12, 26.5, 8); g.add(cap); }
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 18, 12), std({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 9 })); bulb.rotation.z = Math.PI / 2; bulb.position.set(0, 25.6, 8); g.add(bulb);
  g.userData.setGlow = k => { inner.material.emissiveIntensity = 2.2 * k; bulb.material.emissiveIntensity = 9 * k; };
  g.userData.bulb = new THREE.Vector3(0, 25.2, 8);
  return g;
}
function mugMesh() {
  const g = new THREE.Group(); const body = new THREE.MeshPhysicalMaterial({ color: '#e9e2d2', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  g.add(lathe([[0, 0], [4.2, 0], [4.6, 0.6], [4.8, 9.5], [4.4, 9.6], [4.2, 1.0], [0, 1.0]], body));
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(4.25, 40), new THREE.MeshPhysicalMaterial({ color: '#1a0c05', roughness: 0.05, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 8.2; g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 12, 24, Math.PI * 1.2), body); handle.position.set(5.0, 5, 0); handle.rotation.z = -Math.PI * 0.6; g.add(handle);
  return g;
}
function steamMesh() {
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color('#ffe7c4') }, uA: { value: 0.22 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uA; uniform vec3 uCol;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){ vec2 uv=vUv; float y=uv.y; vec2 q=vec2(uv.x*3., y*4. - uT*.45); float w = fbm(q + vec2(sin(y*3.+uT*.4)*.6, 0.));
        float x = uv.x - .5 - (fbm(vec2(y*2.-uT*.25, 1.7))-.5)*.6*y; float col = smoothstep(.2, 0., abs(x)) ;
        float a = col * smoothstep(.0,.15,y) * smoothstep(1.,.3,y) * smoothstep(.4,.8,w) * uA; gl_FragColor = vec4(uCol, a); }` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 18), mat);
  ticks.push((t, dt, cam) => { mat.uniforms.uT.value = t; if (cam) m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z); });
  return m;
}
function magnifier() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: '#b8893a', metalness: 1, roughness: 0.28 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 16, 64), brass); rim.rotation.x = Math.PI / 2; g.add(rim);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.25, 48), new THREE.MeshPhysicalMaterial({ color: '#e8f4f6', roughness: 0.02, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false })); g.add(lens);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 10, 20), std({ color: '#3b2314', roughness: 0.45 })); h.rotation.z = Math.PI / 2; h.position.set(9.4, 0, 0); g.add(h);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 20), brass); ferrule.rotation.z = Math.PI / 2; ferrule.position.set(4.9, 0, 0); g.add(ferrule);
  return g;
}
function pencilMesh(col) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 17, 6), std({ color: col, roughness: 0.5 })); body.rotation.z = Math.PI / 2; g.add(body);
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 6), std({ color: '#e2c08d', roughness: 0.8 })); wood.rotation.z = -Math.PI / 2; wood.position.x = 9.4; g.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 8), std({ color: '#222', roughness: 0.4 })); lead.rotation.z = -Math.PI / 2; lead.position.x = 10.35; g.add(lead);
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 1.1, 12), std({ color: '#c9a64a', metalness: 1, roughness: 0.3 })); ferr.rotation.z = Math.PI / 2; ferr.position.x = -9.0; g.add(ferr);
  const er = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 12), std({ color: '#d77b7b', roughness: 0.8 })); er.rotation.z = Math.PI / 2; er.position.x = -10.0; g.add(er);
  return g;
}
function cardStack() {
  const g = new THREE.Group(); const r = rng(4);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(12.7, 0.08, 7.6), std({ color: '#efe3c8', roughness: 0.9 })); m.position.y = 0.05 + i * 0.09; m.rotation.y = (r() - 0.5) * 0.12; g.add(m); }
  const [c, x] = cv(508, 304); x.fillStyle = '#f3ead6'; x.fillRect(0, 0, 508, 304);
  x.strokeStyle = 'rgba(163,39,29,.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 54); x.lineTo(508, 54); x.stroke(); x.strokeStyle = 'rgba(60,90,160,.25)'; for (let y = 84; y < 304; y += 30) { x.beginPath(); x.moveTo(0, y); x.lineTo(508, y); x.stroke(); }
  x.fillStyle = '#222'; x.font = `400 40px ${HAND}`; x.fillText('Case IV: minimax,', 24, 118); x.fillText('alpha-beta pruning', 24, 170); x.fillStyle = T.accent; x.fillText('next →', 24, 240);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(12.7, 7.6), std({ map: ctex(c), roughness: 0.9 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.05 + 9 * 0.09 + 0.01; top.rotation.z = 0.05; g.add(top);
  return g;
}
function spool() {
  const g = new THREE.Group(); const wood = std({ color: '#8a6136', roughness: 0.7 });
  for (const y of [0.3, 4.1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 32), wood); f.position.y = y; g.add(f); }
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 32), std({ color: T.string, roughness: 0.8 })); thread.position.y = 2.2; g.add(thread);
  return g;
}
function pinTin() {
  const g = new THREE.Group(); const tin = std({ color: '#6b6f73', metalness: 0.9, roughness: 0.35 });
  g.add(lathe([[0, 0], [3.4, 0], [3.4, 1.6], [3.2, 1.6], [3.2, 0.3], [0, 0.3]], tin));
  const r = rng(12); for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = r() * 2.6; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.4, 12), std({ color: [T.string, T.ochre, T.accent2, '#e8e8e8'][i % 4], roughness: 0.4 })); p.position.set(Math.cos(a) * d, 0.55 + r() * 0.35, Math.sin(a) * d); p.rotation.set(r() * 1.4, 0, r() * 1.4); g.add(p); }
  return g;
}
function deskClock() {
  const g = new THREE.Group(); const body = std({ color: '#b8893a', metalness: 1, roughness: 0.3 });
  const face = new THREE.Group(); face.position.set(0, 6, 0); face.rotation.x = -0.12; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 48), body); rim.rotation.x = Math.PI / 2; face.add(rim);
  const [c, x] = cv(512, 512); x.fillStyle = '#f1e6cc'; x.fillRect(0, 0, 512, 512); x.translate(256, 256); x.fillStyle = '#1b1b1b';
  for (let k = 0; k < 60; k++) { x.save(); x.rotate(k * Math.PI / 30); x.fillRect(-(k % 5 ? 2 : 5), -232, k % 5 ? 4 : 10, k % 5 ? 14 : 34); x.restore(); }
  x.font = `700 54px ${TITLE}`; x.textAlign = 'center'; x.textBaseline = 'middle'; [12, 3, 6, 9].forEach((n, i) => { const a = i * Math.PI / 2 - Math.PI / 2; x.fillText(String(n), Math.cos(a) * 165, Math.sin(a) * 165); });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), std({ map: ctex(c), roughness: 0.6 })); dial.position.z = 1.21; face.add(dial);
  const hand = (len, w, col, z) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.06), std({ color: col, roughness: 0.4 })); m.position.y = len / 2 - len * 0.15; p.add(m); p.position.z = z; face.add(p); return p; };
  const hh = hand(2.4, 0.28, '#1b1b1b', 1.3), mh = hand(3.5, 0.2, '#1b1b1b', 1.35), sh = hand(3.9, 0.08, T.accent, 1.4);
  ticks.push(() => { const d = new Date(); const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; sh.rotation.z = -s * Math.PI / 30; mh.rotation.z = -m * Math.PI / 30; hh.rotation.z = -h * Math.PI / 6; });
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), body); leg.position.set(s * 3, 1.0, 0.4); leg.rotation.z = s * 0.4; g.add(leg); }
  return g;
}
function legalPad() {
  const g = new THREE.Group();
  const [c, x] = cv(560, 800); x.fillStyle = '#f2e27e'; x.fillRect(0, 0, 560, 800); x.strokeStyle = 'rgba(60,90,160,.35)'; x.lineWidth = 2; for (let y = 120; y < 800; y += 34) { x.beginPath(); x.moveTo(0, y); x.lineTo(560, y); x.stroke(); }
  x.strokeStyle = 'rgba(200,60,60,.55)'; x.beginPath(); x.moveTo(70, 0); x.lineTo(70, 800); x.stroke();
  x.fillStyle = '#28324a'; x.font = `400 38px ${HAND}`; ['suspects:', ' BFS — fewest steps', ' UCS — cheapest', ' A* — cheapest, 5 looks', '', 'motive: f = g + h', 'h never overestimates', '→ admissible ✓'].forEach((l, i) => x.fillText(l, 84, 112 + i * 68));
  x.fillStyle = '#7a1f17'; x.fillRect(0, 0, 560, 70);
  const m = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.6, 30.5), [std({ color: '#e9dfb0' }), std({ color: '#e9dfb0' }), std({ map: ctex(c), roughness: 0.85 }), std({ color: '#5a4a35' }), std({ color: '#e9dfb0' }), std({ color: '#e9dfb0' })]);
  m.position.y = 0.3; g.add(m); return g;
}

// ---------------- light ----------------
function lights(scene, renderer, mobile, out) {
  const smap = mobile ? 1024 : 2048;
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#2a3550', '#0a0705', 0.05)); // the night, barely
  // the banker's lamp: a warm pool on the desk and the book
  // the cone is the shade's own: down the shade's axis, as wide as its mouth lets the bulb see, so the pool lies under the lamp
  const lamp = new THREE.SpotLight('#ffb36a', 8600, 190, 1.25, 0.3, 2);
  lamp.position.copy(out.bulb);
  if (out.lampAim) lamp.target.position.copy(lamp.position).addScaledVector(out.lampAim, 30); else lamp.target.position.set(3, 0, -3);
  lamp.castShadow = true; // near skips the lamp's own head: a real bulb and its opal shade are far wider than the socket, this single point is not
  lamp.shadow.mapSize.set(smap, smap); lamp.shadow.bias = -0.00015; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 5; lamp.shadow.camera.near = 12; lamp.shadow.camera.far = 170;
  scene.add(lamp, lamp.target);
  // warm bounce off the desk and the pages onto the board. A spot aimed up at the board, so nothing in front of it
  // (the desk's front edge, the props' faces) catches a highlight from a light that isn't there.
  const bounce = new THREE.SpotLight('#ff9d55', 1300, 130, 1.35, 1, 2); bounce.position.set(0, 6, -14); bounce.target.position.set(15, 44, -46); scene.add(bounce, bounce.target);
  // the window: cool night light through venetian blinds with rain on the glass
  const win = new THREE.SpotLight('#8fa6d6', 56000, 460, 0.44, 0.45, 2);
  win.position.copy(WINDOW); win.target.position.set(6, 28, -30); win.castShadow = true; win.shadow.mapSize.set(1024, 1024); win.shadow.bias = -0.0003; win.shadow.normalBias = 0.06; win.shadow.radius = 2;
  const rain = rainGobo(renderer, mobile, out, win); win.map = rain.texture; win.intensity /= rain.glass; scene.add(win, win.target); out.rain = rain;
  ticks.push((t, dt) => rain.update(t, dt));
  // lightning, now and then: the window flashes, the room shows for an instant
  // Its shadow covers the desk and the board. It is drawn once at start, so the map exists before the first strike, then only while a strike lasts. Dark, it costs nothing: see installDarkness.
  const flash = new THREE.DirectionalLight('#c9d6ff', 0); flash.position.copy(WINDOW); flash.castShadow = true; flash.shadow.autoUpdate = false; flash.shadow.needsUpdate = true;
  flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -0.0005; flash.shadow.normalBias = 0.5; flash.shadow.radius = 1; // normalBias: it rakes the board at 7 degrees
  Object.assign(flash.shadow.camera, { left: -70, right: 70, top: 132, bottom: -122, near: 20, far: 480 }); flash.shadow.camera.updateProjectionMatrix(); scene.add(flash);
  const baseWin = win.intensity; let next = 20 + Math.random() * 25, strike = null;
  out.lightningAt = (t) => { strike = { t0: t, k: 0.7 + Math.random() * 0.6 }; };
  ticks.push(t => {
    if (!strike && t > next && !out.freeze) { strike = { t0: t, k: 0.6 + Math.random() * 0.7 }; next = t + 50 + Math.random() * 70; out.events.lightning?.(1 + Math.random() * 5); }
    let f = 0; if (strike) { const u = t - strike.t0; f = (Math.exp(-((u - 0.05) ** 2) / 0.002) + 0.6 * Math.exp(-((u - 0.28) ** 2) / 0.004) + 0.35 * Math.exp(-((u - 0.5) ** 2) / 0.01)) * strike.k; if (u > 1.2) strike = null; }
    if (f > 0) { if (!flash.intensity) renderer.shadowMap.needsUpdate = true; flash.shadow.needsUpdate = true; } // the first frame can't wait for main's shadow tick
    win.intensity = baseWin * (1 + f * 7); win.color.setRGB(0.56 + f * 0.3, 0.65 + f * 0.25, 0.84 + f * 0.1); flash.intensity = f * 0.9;
  });
  out.lampObj?.userData.setGlow?.(1);
  // main.js builds the first map before the bulb exists, so it holds no lamp: right for the outside of the shade, which faces away
  // from its bulb, and it is what desk() holds. Everything else sees the stand-in where the bulb really is from the middle of the
  // props. The lamp's own brass sees it overhead and sees the wider pool it stands in. Satin, full colour so its reflections match
  // the clock's, but it takes little of the direct light: the real source is the shade's whole mouth, its light spread thin, and
  // this single point packs all of it into one spot, so brass would mirror it as a white bloom, not a soft streak of bulb colour.
  if (out.lampObj) { const clean = scene.environment, others = Object.values(out.props ?? {}).filter(o => o !== out.lampObj), mid = new THREE.Vector3();
    others.forEach(o => mid.add(o.position)); mid.divideScalar(others.length || 1);
    const standIn = b => out.bulb.clone().sub(b).normalize().multiplyScalar(2.9).toArray();
    scene.environment = roomEnvironment(renderer, standIn(mid));
    const env = roomEnvironment(renderer, standIn(out.lampObj.position), 3);
    out.lampObj.traverse(m => { if (m.name === 'shadeOuter') m.material.envMap = clean;
      if (m.isMesh && m.material.metalness === 1) { m.material = m.material.clone(); Object.assign(m.material, { envMap: env, envMapIntensity: 0.7, roughnessMap: null, roughness: 0.34, clearcoat: 0 });
        m.material.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directSpecular *= 0.05;'); }; } }); }
  out.lamp = lamp; out.win = win;
}

// The window light's cookie: the blinds, and the rain on the pane in front of them. Each drop on the glass is a small
// lens, so its shadow is a dark ring around a brighter core. Drops land at once and merge; once heavy enough they run down
// in jerks, swallowing what they meet and leaving beads and a fading wet streak behind. Nothing leaves in one frame: a swallowed
// drop is drawn into the runner in a blink, and when the pane is full the oldest shrink and fade as they dry. Simulated in pixels of a 1024
// square, drawn on the GPU into a render target that the spot projects.
function rainGobo(renderer, mobile, out, win) {
  const S = mobile ? 512 : 1024, GLASS = 0.62; // the clear pane passes GLASS; a drop's focused core passes up to 1
  const [bc, bg] = cv(S, S);
  bg.fillStyle = '#000'; bg.fillRect(0, 0, S, S);
  const slat = S / 13;
  for (let y = 0; y < S; y += slat) { const gr = bg.createLinearGradient(0, y, 0, y + slat); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.18, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,255,1)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); bg.fillStyle = gr; bg.fillRect(0, y, S, slat); }
  bg.fillStyle = '#000'; bg.fillRect(S * 0.49, 0, S * 0.025, S); bg.fillRect(0, S * 0.33, S, S * 0.02);
  const vg = bg.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)'); bg.fillStyle = vg; bg.fillRect(0, 0, S, S);
  // the sill: the beam's lower edge lands on the foot of the board, so the desk and what stands on it get no window light
  // (and so no rain). Black past the board's bottom edge as the spot projects it (its shadow camera), with a soft edge.
  const sc = new THREE.PerspectiveCamera(THREE.MathUtils.RAD2DEG * 2 * win.angle, 1, 1, 1000); sc.position.copy(win.position); sc.lookAt(win.target.position); sc.updateMatrixWorld();
  const px = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(sc); return [(v.x + 1) / 2 * S, (1 - v.y) / 2 * S]; };
  const [ax, ay] = px(-100, BOARD.y0 - 3.4, BOARD.z + 0.7), [bx, by] = px(100, BOARD.y0 - 3.4, BOARD.z + 0.7), [dx, dy] = px(0, DESK_Y, 0);
  const ang = Math.atan2(by - ay, bx - ax), side = (dy - ay) * Math.cos(ang) - (dx - ax) * Math.sin(ang) > 0 ? 1 : -1, soft = S * 0.012;
  bg.save(); bg.translate(ax, ay); bg.rotate(ang); bg.scale(1, side);
  const sg = bg.createLinearGradient(0, -soft, 0, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, '#000'); bg.fillStyle = sg; bg.fillRect(-2 * S, -soft, 4 * S, 4 * S); bg.restore();
  const blinds = ctex(bc);

  const rt = new THREE.WebGLRenderTarget(S, S, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const gs = new THREE.Scene(), gc = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const bgQ = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), new THREE.MeshBasicMaterial({ map: blinds, color: new THREE.Color(GLASS, GLASS, GLASS), toneMapped: false, depthTest: false, depthWrite: false }));
  gs.add(bgQ);
  const MAX = mobile ? 2000 : 4400, geo = new THREE.InstancedBufferGeometry(); geo.index = new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const aD = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4), aK = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  aD.setUsage(THREE.DynamicDrawUsage); aK.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aD', aD); geo.setAttribute('aK', aK); geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    // 2x multiply (dst * src + src * dst): the shader writes m / 2, so a drop can both darken (m < 1) and focus (m > 1)
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor,
    vertexShader: `attribute vec4 aD, aK; varying vec2 vQ; varying vec4 vK;
      void main(){ float k = aK.x > 0.5 ? 1.0 : 1.5; vQ = position.xy * k; vK = aK; gl_Position = projectionMatrix * vec4(aD.xy + position.xy * aD.zw * k, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying vec4 vK;
      void main(){
        float m;
        if (vK.x > 0.5) { // wet streak: a faint soft line
          m = 1.0 - 0.22 * vK.y * (1.0 - smoothstep(0.25, 1.0, abs(vQ.x))) * smoothstep(1.0, 0.6, abs(vQ.y));
        } else {          // drop: lumpy outline, dark rim, bright core sitting low (drops on a pane are heavier at the bottom)
          float a = atan(vQ.y, vQ.x), s = vK.z * 6.2832;
          float r = length(vQ) * (1.0 + 0.07 * sin(3.0 * a + s) + 0.045 * sin(5.0 * a + 2.7 * s));
          float inside = smoothstep(1.1, 0.84, r), rim = smoothstep(0.18, 0.9, r) * inside;
          vec2 c = vQ - vec2(0.06, -0.22); float core = exp(-dot(c, c) * 4.0) * inside;
          m = mix(1.0, 1.0 - 0.86 * rim + 0.8 * core, vK.y);
        }
        gl_FragColor = vec4(vec3(m * 0.5), 1.0);
      }`,
  });
  const dm = new THREE.Mesh(geo, mat); dm.frustumCulled = false; dm.renderOrder = 1; gs.add(dm);

  // ---- the simulation, in px of a 1024 square, y up; a coarse grid keeps the neighbour tests cheap ----
  const r = rng(55), P = 1024, MAXD = MAX - 400, LIVE = MAXD - 240; let drops = []; const runs = [], streaks = []; // LIVE leaves room inside MAXD for the drops still fading
  const CELL = 24, GW = Math.ceil(P / CELL) + 4, grid = new Map();
  const cell = (x, y) => (Math.floor(y / CELL) + 2) * GW + Math.floor(x / CELL) + 2;
  const put = d => { const k = cell(d.x, d.y); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(d); };
  const near = (x, y, f) => { const cx = Math.floor(x / CELL) + 2, cy = Math.floor(y / CELL) + 2; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = grid.get((cy + j) * GW + cx + i); if (a) for (const d of a) if (!d.dead && !d.gone && f(d)) return d; } return null; };
  const land = (x, y, rad) => {
    const d = near(x, y, d => (d.x - x) ** 2 + (d.y - y) ** 2 < (d.rad + rad) ** 2);
    if (d) { const a = d.rad ** 3, b = rad ** 3, v = a + b; d.x = (d.x * a + x * b) / v; d.y = (d.y * a + y * b) / v; d.rad = Math.cbrt(v); return d; }
    const n = { x, y, rad, ax: 0.9 + r() * 0.2, seed: r(), a: 0 }; drops.push(n); put(n); return n;
  };
  function startRun(d) { d.dead = true; runs.push({ x: d.x, y: d.y, rad: d.rad, seed: d.seed, moving: false, t: r() * 0.8, vx: 0, trav: 0, next: 6, sx: d.x, sy: d.y }); }
  const step = dt => {
    grid.clear(); for (const d of drops) if (!d.gone) put(d);
    // rain landing on the pane: mostly fine droplets; drops that grow heavy, and now and then a fat one, start to run
    for (let n = Math.floor(dt * 120 + r()); n > 0; n--) { const d = land(r() * P, r() * P, 1.7 + Math.pow(r(), 2.6) * 3.4); if (d.rad > 5.4 && runs.length < 12) startRun(d); }
    if (r() < dt * 0.4 && runs.length < 12) startRun(land(r() * P, P * (0.3 + 0.75 * r()), 5.6 + r() * 1.8));
    for (const d of drops) d.a = d.gone ? d.a - dt * d.gone : Math.min(1, d.a + dt * 14); // gone: the rate it fades out at
    for (let i = runs.length - 1; i >= 0; i--) {
      const q = runs[i];
      // stick-slip: a burst of sliding, then a pause while the drop gathers itself
      q.t -= dt; if (q.t < 0) { q.moving = !q.moving; q.t = q.moving ? 0.25 + r() * 0.9 : 0.15 + r() * (q.rad > 6.5 ? 0.6 : 1.8); q.vx = (r() - 0.5) * 10; }
      if (q.moving) {
        const v = (16 + (q.rad - 5) * 8) * (0.7 + r() * 0.6); q.y -= v * dt; q.x += q.vx * dt; q.trav += v * dt;
        near(q.x, q.y, d => { if ((d.x - q.x) ** 2 + (d.y - q.y) ** 2 < (d.rad + q.rad * 0.9) ** 2) { q.rad = Math.cbrt(q.rad ** 3 + d.rad ** 3); d.gone = 9; } return false; }); // swallow what it runs into
        // leave a bead behind every so often, and a piece of wet streak
        if (q.trav > q.next) { const b = 1.2 + r() * 1.2; if (q.rad ** 3 - b ** 3 > 4.6 ** 3) { q.rad = Math.cbrt(q.rad ** 3 - b ** 3); const n = { x: q.x + (r() - 0.5) * 1.5, y: q.y + q.rad * 1.1, rad: b, ax: 1, seed: r(), a: 1 }; drops.push(n); put(n); } q.trav = 0; q.next = 5 + r() * 9; }
        if (Math.hypot(q.x - q.sx, q.y - q.sy) > 7) { streaks.push({ x0: q.sx, y0: q.sy, x1: q.x, y1: q.y + q.rad * 0.6, w: q.rad * 0.42, age: 0 }); q.sx = q.x; q.sy = q.y + q.rad * 0.6; }
      }
      q.rad = Math.min(q.rad, 9);
      if (q.y < -12) runs.splice(i, 1);
    }
    for (let i = streaks.length - 1; i >= 0; i--) { streaks[i].age += dt; if (streaks[i].age > 14) streaks.splice(i, 1); }
    drops = drops.filter(d => !d.dead && !(d.gone && d.a <= 0));
    let live = 0; for (const d of drops) if (!d.gone) live++;
    for (let i = 0; live > LIVE && i < drops.length; i++) if (!drops[i].gone) { drops[i].gone = 1.2; live--; } // the pane holds only so much: the oldest droplets dry off
    if (drops.length > MAXD) drops.splice(0, drops.length - MAXD); // the buffer's hard limit, past anything the fades should reach
    while (streaks.length > MAX - MAXD - runs.length) streaks.shift();
  };
  // the rain has been falling for a while already
  for (let i = 0; i < 900; i++) step(1 / 10);

  const write = () => {
    let n = 0; const D = aD.array, K = aK.array, u = 1 / P;
    for (const s of streaks) { const k = Math.exp(-s.age / 5); if (k < 0.03) continue; D.set([(s.x0 + s.x1) / 2 * u, (s.y0 + s.y1) / 2 * u, s.w * u, Math.max(0.5, Math.abs(s.y0 - s.y1) / 2 + 1) * u], n * 4); K.set([1, k, 0, 0], n * 4); n++; }
    for (const d of drops) { const k = d.gone ? 0.5 + 0.5 * d.a : 1; D.set([d.x * u, d.y * u, d.rad * k * d.ax * u, d.rad * k / d.ax * u], n * 4); K.set([0, d.a, d.seed, 0], n * 4); n++; } // shrinking as it leaves
    for (const q of runs) { const st = q.moving ? 1.22 : 1.08; D.set([q.x * u, q.y * u, q.rad / Math.sqrt(st) * u, q.rad * st * u], n * 4); K.set([0, 1, q.seed, 0], n * 4); n++; }
    geo.instanceCount = n; aD.needsUpdate = aK.needsUpdate = true;
    const prev = renderer.getRenderTarget(), sm = renderer.shadowMap.needsUpdate;
    renderer.setRenderTarget(rt); renderer.render(gs, gc); renderer.setRenderTarget(prev); renderer.shadowMap.needsUpdate = sm;
  };
  let acc = 1;
  return {
    texture: rt.texture, glass: GLASS, rt, stats: () => ({ drops: drops.length, runs: runs.length, streaks: streaks.length }),
    update(t, dt) {
      acc += dt; if (acc < 1 / 30) return;
      if (!out.freeze) step(Math.min(0.1, acc)); acc = 0;
      write();
    },
  };
}

// a dim environment matching the room: the lamp's warm pool, the window's cool slats, black elsewhere (for reflections on brass, glass, varnish)
// lampAt places the lamp's stand-in; without it the map holds no lamp
export function roomEnvironment(renderer, lampAt, poolScale = 1) {
  const env = new THREE.Scene(); env.background = new THREE.Color('#020202');
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: '#050403', side: THREE.BackSide })); env.add(box);
  if (lampAt) { const warm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36a').multiplyScalar(14) })); warm.position.set(...lampAt); env.add(warm); }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5a3a1c').multiplyScalar(1.2) })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, -2.9, 0); pool.scale.setScalar(poolScale); env.add(pool);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.8 - 0.0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fa6d6').multiplyScalar(2.2) })); s.position.set(4.95, 0.4 + i * 0.32 - 0.8, 1); s.rotation.y = -Math.PI / 2; s.scale.set(1, 1, 1); s.rotation.z = Math.PI / 2; env.add(s); }
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(env, 0.02).texture; pm.dispose(); return tex;
}
