// Pop-up exhibits. Built in face coords: x → right, y ↑ above the page, z = v (down the page, toward the reader).
// Each element is wrapped in a `part` with a mode:
//   fold  – a standing paper panel hinged at its base line; lies flat (toward the page top) and swings up
//   grow  – rises out of the page (scale.y)
//   draw  – a string strung along its length (drawRange)
//   pop   – appears and scales up
import * as THREE from 'three';
import { C, FIG11, G, A_ORDER, A_FRONTIER, HILL, fHill, CASES } from './pages.js';
import { grainTile, rng } from './paper.js';
import { SERIF, DISPLAY, TITLE, HAND } from './typeset.js';
import { T } from './theme.js';

const NOIR = T.name === 'noir', B = T.bold;
let grainTex;
const grain = () => { if (!grainTex) { grainTex = new THREE.CanvasTexture(grainTile(256, 21)); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; } return grainTex; };
const mats = {};
function paper(color, { side = THREE.DoubleSide, rough = 0.9 } = {}) {
  const k = color + side + rough; if (mats[k]) return mats[k]; grain();
  return (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side, bumpMap: grainTex, bumpScale: 0.4 }));
}
const metal = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 1, roughness: 0.3 });
const shadowy = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

function tex(w, h, draw, ppu = 120, base) {
  const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(w * ppu)); c.height = Math.max(8, Math.round(h * ppu));
  const g = c.getContext('2d');
  if (base) { g.fillStyle = base; g.fillRect(0, 0, c.width, c.height); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = NOIR ? 0.5 : 0.25; g.fillStyle = g.createPattern(grainTile(256, 21), 'repeat'); g.fillRect(0, 0, c.width, c.height); g.restore(); }
  draw?.(g, ppu, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a standing paper panel: local x ∈ [0, w], y ∈ [0, h], printed front faces +z
function standee(w, h, { pts = null, holes = [], color = C.cream, back = null, draw = null, ppu = 110 } = {}) {
  const shape = new THREE.Shape((pts || [[0, 0], [w, 0], [w, h], [0, h]]).map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hl of holes) shape.holes.push(new THREE.Path(hl.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ShapeGeometry(shape, 24);
  const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w, pos.getY(i) / h);
  const front = new THREE.MeshStandardMaterial({ map: tex(w, h, draw, ppu, color), roughness: 0.88, bumpMap: grain(), bumpScale: 0.3, side: THREE.FrontSide });
  const g = new THREE.Group();
  const mf = new THREE.Mesh(geo, front); mf.position.z = 0.012;
  const mb = new THREE.Mesh(geo, paper(back || shade(color, NOIR ? -0.12 : -0.06), { side: THREE.BackSide })); mb.position.z = -0.012;
  g.add(mf, mb); return shadowy(g);
}
const shade = (hex, k) => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + k))); return '#' + c.getHexString(); };
function part(obj, delay = 0, mode = 'fold', at = [0, 0, 0]) { const g = new THREE.Group(); g.add(obj); g.position.set(...at); Object.assign(g.userData, { delay, mode, phase: Math.random() * 6.28, y0: at[1] }); return g; }
const circle = (cx, cy, r, n = 48, rev = false) => { const a = Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]); return rev ? a.reverse() : a; };

// string through 3D points with a little sag; geometry is drawn on along its length
function string(pts, { r = 0.03, color = T.twine, sag = 0.12, seg = 18 } = {}) {
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
    for (let s = 0; s < seg; s++) { const t = s / seg; const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * sag * a.distanceTo(b) / 6; P.push(p); }
  }
  P.push(new THREE.Vector3(...pts[pts.length - 1]));
  const curve = new THREE.CatmullRomCurve3(P);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, P.length * 2, r, 6, false), new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
  return shadowy(m);
}
// a map pin: steel needle and coloured head; returns group with base at y=0
function pin(h, color, r = 0.3) {
  const g = new THREE.Group();
  const n = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h, 8), metal); n.position.y = h / 2; g.add(n);
  const head = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0 })); head.position.y = h + r * 0.7; g.add(head);
  return shadowy(g);
}
// a little paper flag hung from a pin at height y
function flag(label, sub, { color = C.white, ink = C.ink, w = 1.35, h = 0.66 } = {}) {
  const s = standee(w, h, { color, ppu: 220, draw: (g, p, W, H) => {
    g.fillStyle = ink; g.textBaseline = 'middle';
    g.font = `${B} ${0.36 * p}px ${SERIF}`; g.fillText(label, 0.14 * p, H / 2 + 0.02 * p);
    if (sub) { g.font = `400 ${0.24 * p}px ${SERIF}`; g.textAlign = 'right'; g.fillText(sub, W - 0.12 * p, H / 2 + 0.02 * p); }
  } });
  const f = new THREE.Group(); f.add(s); s.position.set(0.04, -h, 0); f.userData.flutter = true; return f;
}

// ---------------- builders ----------------
export const BUILDERS = {
  // title page: a miniature evidence board, and a magnifier in front of it
  titleBoard() {
    const root = new THREE.Group();
    const bw = 10.4, bh = 7.2;
    const board = standee(bw, bh, { color: NOIR ? '#a67b4c' : '#f4f4f2', ppu: 120, draw: (g, p, W, H) => miniBoard(g, p, W, H) });
    root.add(part(board, 0, 'fold', [1.8, 0, 6.2]));
    // magnifier: brass ring + glass + handle, standing on its handle
    const mg = new THREE.Group(); const R = 1.75, cx = 1.9, cy = 3.9;
    const ringShape = new THREE.Shape(circle(cx, cy, R).map(([x, y]) => new THREE.Vector2(x, y))); ringShape.holes.push(new THREE.Path(circle(cx, cy, R - 0.28).map(([x, y]) => new THREE.Vector2(x, y))));
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 48 }), new THREE.MeshStandardMaterial({ color: NOIR ? '#b8893a' : '#2a2d31', metalness: NOIR ? 1 : 0.2, roughness: NOIR ? 0.32 : 0.5 }));
    rim.position.z = -0.11; mg.add(rim);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R - 0.26, 48), new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(cx, cy, 0); mg.add(glass);
    const hl = 2.4, hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, hl, 20), new THREE.MeshStandardMaterial({ color: NOIR ? '#3b2314' : '#15171a', roughness: 0.55 }));
    const a = Math.atan2(cy - R, cx - 0.4); // from lens bottom to the page
    hdl.position.set((cx + 0.35) / 2 + 0.1, (cy - R) / 2 + 0.05, 0); hdl.rotation.z = -0.38; mg.add(hdl);
    shadowy(mg); root.add(part(mg, 1, 'fold', [6.0, 0, 9.4]));
    return root;
  },
  // contents: a drawer of case folders, Case I in front
  fileDrawer() {
    const root = new THREE.Group();
    const n = CASES.length;
    CASES.slice().reverse().forEach(([r, t, s, p], j) => {
      const k = n - 1 - j; // case index 0..9
      const open = p !== undefined, w = 10.6, h = 3.4 + k * 0.32, tabW = 1.9, tabX = 0.25 + (k % 5) * 2.05;
      const col = open ? (NOIR ? '#d7b87f' : '#ffffff') : (NOIR ? '#bfae8c' : '#e3e5e8');
      const pts = [[0, 0], [w, 0], [w, h], [tabX + tabW + 0.25, h], [tabX + tabW, h + 0.62], [tabX, h + 0.62], [tabX - 0.25, h], [0, h]];
      const sd = standee(w, h + 0.62, { pts, color: col, ppu: 120, draw: (g, q, W, H) => {
        const Y = v => (h + 0.62 - v) * q; // y up → canvas
        g.fillStyle = open ? T.accent : C.ink; g.globalAlpha = open ? 1 : 0.55;
        g.font = `400 ${0.3 * q}px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(`CASE ${r}`, (tabX + 0.2) * q, Y(h + 0.2));
        g.globalAlpha = 1; g.fillStyle = C.ink; g.font = `${NOIR ? 700 : 600} ${0.62 * q}px ${TITLE}`; g.fillText(t, 0.5 * q, Y(h - 0.95));
        g.font = `400 ${0.3 * q}px ${SERIF}`; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(s, 0.5 * q, Y(h - 1.45));
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.02 * q; for (let y = 0.45; y < h - 1.9; y += 0.42) { g.beginPath(); g.moveTo(0.5 * q, Y(y)); g.lineTo((w - 0.5) * q, Y(y)); g.stroke(); }
        g.save(); g.translate((w - 2.0) * q, Y(h - 1.0)); g.rotate(-0.12); g.font = `400 ${0.36 * q}px ${NOIR ? DISPLAY : T.mono}`; g.textAlign = 'center';
        if (NOIR) { g.strokeStyle = open ? '#a3271d' : 'rgba(0,0,0,.45)'; g.lineWidth = 0.04 * q; g.strokeRect(-1.3 * q, -0.45 * q, 2.6 * q, 0.62 * q); g.fillStyle = g.strokeStyle; }
        else { g.fillStyle = open ? T.accent : '#9aa0a6'; g.beginPath(); g.roundRect(-1.3 * q, -0.45 * q, 2.6 * q, 0.62 * q, 0.12 * q); g.fill(); g.fillStyle = '#fff'; }
        g.fillText(open ? 'OPEN' : 'PENDING', 0, 0); g.restore();
      } });
      root.add(part(sd, j, 'fold', [1.7, 0, 1.6 + j * 0.62]));
    });
    return root;
  },
  // Case I left page: four PEAS cards
  peas() {
    const root = new THREE.Group();
    const cards = [['P', 'performance', 'safety, time'], ['E', 'environment', 'roads, traffic'], ['A', 'actuators', 'steering, brakes'], ['S', 'sensors', 'cameras, radar']];
    cards.forEach(([L, w1, w2], i) => {
      const sd = standee(2.7, 3.6, { color: NOIR ? '#f3ead6' : '#ffffff', ppu: 160, draw: (g, p, W, H) => {
        if (NOIR) { g.strokeStyle = 'rgba(163,39,29,.55)'; g.lineWidth = 0.02 * p; g.beginPath(); g.moveTo(0, 0.7 * p); g.lineTo(W, 0.7 * p); g.stroke(); g.strokeStyle = 'rgba(60,90,160,.25)'; for (let y = 1.1; y < 3.6; y += 0.36) { g.beginPath(); g.moveTo(0, y * p); g.lineTo(W, y * p); g.stroke(); } }
        else { g.fillStyle = T.accent2; g.fillRect(0, 0, W, 0.16 * p); }
        g.fillStyle = i % 2 ? T.accent2 : T.accent; g.font = `${NOIR ? 700 : 600} ${1.5 * p}px ${TITLE}`; g.textAlign = 'center'; g.fillText(L, W / 2, 2.15 * p);
        g.fillStyle = C.ink; g.font = `${B} ${0.27 * p}px ${SERIF}`; g.fillText(w1.toUpperCase(), W / 2, 2.75 * p);
        g.fillStyle = 'rgba(0,0,0,.6)'; g.font = `400 ${0.38 * p}px ${HAND}`; g.fillText(w2, W / 2, 3.25 * p);
      } });
      sd.rotation.y = (i - 1.5) * 0.06;
      root.add(part(sd, i, 'fold', [0.9 + i * 3.1, 0, 4.4 - (i % 2) * 0.25]));
    });
    return root;
  },
  // Case I: the environment as a city backdrop, the agent as a box machine, percept/action arrows between them
  agentLoop() {
    const root = new THREE.Group(); const F = FIG11;
    const ew = F.env.x1 - F.env.x0; const r = rng(7);
    const sky = []; let x = 0; sky.push([0, 0]);
    while (x < ew) { const bw = 0.9 + r() * 1.4, bh = 3.4 + r() * 3.6; sky.push([x, bh], [Math.min(ew, x + bw), bh]); x += bw; }
    sky.push([ew, 0]);
    const blds = sky.slice(1, -1);
    const env = standee(ew, 7.2, { pts: sky, color: NOIR ? '#3a3f4e' : '#c9ced6', ppu: 110, draw: (g, p, W, H) => {
      for (let i = 0; i < blds.length; i += 2) {
        const [x0, bh] = blds[i], x1 = blds[i + 1][0];
        g.fillStyle = i % 4 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.05)'; g.fillRect(x0 * p, (7.2 - bh) * p, (x1 - x0) * p, bh * p);
        for (let yy = 0.9; yy < bh - 0.3; yy += 0.55) for (let xx = x0 + 0.2; xx < x1 - 0.25; xx += 0.42) {
          const lit = r() < (NOIR ? 0.3 : 0.15); g.fillStyle = lit ? (NOIR ? '#f4c36a' : '#ffffff') : (NOIR ? 'rgba(0,0,0,.35)' : 'rgba(40,50,70,.25)'); g.fillRect(xx * p, (7.2 - yy) * p, 0.2 * p, 0.28 * p);
        }
      }
      g.fillStyle = NOIR ? '#efe3c8' : '#15171a'; g.fillRect(0, (7.2 - 0.62) * p, W, 0.62 * p);
      g.fillStyle = NOIR ? '#241c14' : '#ffffff'; g.font = `400 ${0.36 * p}px ${DISPLAY}`; g.textAlign = 'center'; g.letterSpacing = 0.12 * p + 'px'; g.fillText('ENVIRONMENT', W / 2, (7.2 - 0.17) * p);
    } });
    root.add(part(env, 0, 'fold', [F.env.x0, 0, F.env.v1]));
    // agent: a box machine
    const aw = F.agent.x1 - F.agent.x0, ad = F.agent.v1 - F.agent.v0, ah = 2.6;
    const faceTex = tex(aw, ah, (g, p, W, H) => {
      g.fillStyle = NOIR ? '#efe3c8' : '#ffffff'; g.font = `400 ${0.42 * p}px ${DISPLAY}`; g.textAlign = 'center'; g.letterSpacing = 0.14 * p + 'px'; g.fillText('AGENT', W / 2, 0.68 * p); g.letterSpacing = '0px';
      g.strokeStyle = g.fillStyle; g.lineWidth = 0.05 * p; g.beginPath(); g.arc(W / 2, 1.62 * p, 0.62 * p, Math.PI * 0.85, Math.PI * 2.15); g.stroke();
      for (let k = 0; k <= 6; k++) { const a = Math.PI * (0.85 + k * 1.3 / 6); g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * 0.5 * p, 1.62 * p + Math.sin(a) * 0.5 * p); g.lineTo(W / 2 + Math.cos(a) * 0.62 * p, 1.62 * p + Math.sin(a) * 0.62 * p); g.stroke(); }
      g.strokeStyle = T.accent; g.lineWidth = 0.06 * p; g.beginPath(); g.moveTo(W / 2, 1.62 * p); g.lineTo(W / 2 + 0.4 * p, 1.25 * p); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = `400 ${0.24 * p}px ${SERIF}`; g.fillText('agent program', W / 2, 2.45 * p);
      for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0.3 * p, (1.0 + k * 0.28) * p, 1.0 * p, 0.08 * p); g.fillRect(W - 1.3 * p, (1.0 + k * 0.28) * p, 1.0 * p, 0.08 * p); }
    }, 140, NOIR ? T.accent2 : '#15171a');
    const side = paper(NOIR ? T.accent2 : '#15171a');
    const box = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, ad), [side, side, side, side, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.85 }), side]);
    box.position.set(aw / 2, ah / 2, ad / 2);
    const ag = new THREE.Group(); ag.add(box);
    // sensor dish on top, facing the city
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.6, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI / 2 + 0.5; dish.position.set(aw * 0.7, ah + 0.75, ad * 0.45); ag.add(dish);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), metal); mast.position.set(aw * 0.7, ah + 0.35, ad * 0.5); ag.add(mast);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), metal); ant.position.set(aw * 0.22, ah + 0.8, ad * 0.5); ag.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: T.accent, emissive: T.accent, emissiveIntensity: 0.6 })); tip.position.set(aw * 0.22, ah + 1.62, ad * 0.5); tip.userData.blink = true; ag.add(tip);
    shadowy(ag); root.add(part(ag, 1, 'grow', [F.agent.x0, 0, F.agent.v0]));
    // arrows: percepts in (city → dish), actions out (box → city)
    const arrow = (pts, color) => { const g = new THREE.Group(); const s = string(pts, { r: 0.09, color, sag: 0 }); g.add(s);
      const a = new THREE.Vector3(...pts[pts.length - 2]), b = new THREE.Vector3(...pts[pts.length - 1]); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      cone.position.copy(b); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(shadowy(cone)); return g; };
    root.add(part(arrow([[11.4, 4.2, 4.7], [11.6, 5.2, 6.2], [10.6, 4.9, 7.6], [9.3, 3.95, 7.95]], T.accent), 2.5, 'draw'));
    root.add(part(arrow([[4.0, 1.6, 8.6], [2.6, 2.6, 7.6], [2.4, 3.6, 5.8], [2.7, 3.4, 4.9]], T.accent2), 3, 'draw'));
    const lbl = (t, col, at, rot) => { const s = standee(2.2, 0.62, { color: C.white, ppu: 200, draw: (g, p, W, H) => { g.fillStyle = col; g.font = `${B} ${0.32 * p}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, W / 2, H / 2 + 0.02 * p); } }); s.rotation.y = rot; return part(s, 3.5, 'pop', at); };
    root.add(lbl('percepts', T.accent, [11.0, 5.75, 6.4], -0.3));
    root.add(lbl('actions', T.accent2, [1.0, 3.35, 6.6], 0.3));
    return root;
  },
  graphH() { return graphPopup(true); },
  graphA() { return graphPopup(false); },
  // Case III: the objective function as a tunnel of paper ridges, each a slice f(x, v) at fixed v
  hills() {
    const root = new THREE.Group();
    const K = 0.6, base = 0.15, x0 = 0.7, x1 = 13.3;
    const slices = [2.6, 3.8, 5.0, 6.2, 7.4, 8.8, 10.0, 11.2, 12.0, 12.8, 14.0, 15.2];
    const H = (x, v) => base + K * fHill(x, v);
    slices.forEach((v, i) => {
      const pts = [[0, 0]]; for (let k = 0; k <= 90; k++) { const x = x0 + (x1 - x0) * k / 90; pts.push([x - x0, H(x, v)]); } pts.push([x1 - x0, 0]);
      const top = Math.max(...pts.map(p => p[1])) + 0.05, t = i / (slices.length - 1);
      const col = NOIR ? '#' + new THREE.Color('#7d5f3e').lerp(new THREE.Color('#efe3c8'), t).getHexString() : '#' + new THREE.Color('#9fb0c8').lerp(new THREE.Color('#ffffff'), t).getHexString();
      const sd = standee(x1 - x0, top, { pts, color: col, ppu: 90, draw: (g, p, W, Hh) => {
        g.strokeStyle = NOIR ? 'rgba(36,28,20,.22)' : 'rgba(21,23,26,.14)'; g.lineWidth = 0.02 * p;
        for (let lv = 1; lv <= 10; lv++) { const y = base + K * lv; if (y > top) break; g.beginPath(); g.moveTo(0, (top - y) * p); g.lineTo(W, (top - y) * p); g.stroke(); }
      } });
      root.add(part(sd, i, 'fold', [x0, 0, v]));
    });
    // climbers: beads along each path at the height of the landscape, summit flags
    const climb = (path, col, label, val, delay) => {
      path.forEach(([x, v], k) => { const m = new THREE.Mesh(new THREE.SphereGeometry(k === 0 ? 0.16 : 0.11, 16, 12), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0 }));
        m.userData.bead = { k, n: path.length }; shadowy(m); root.add(part(m, delay + k * 0.25, 'pop', [x, H(x, v) + 0.12, v])); });
      const [sx, sv] = path[path.length - 1]; const g = new THREE.Group(); g.add(pin(1.6, col, 0.13)); const f = flag(label, val, { color: col, ink: '#fff', w: 2.5 }); f.position.set(0, 1.55, 0); g.add(f);
      root.add(part(g, delay + path.length * 0.25 + 0.5, 'grow', [sx, H(sx, sv), sv]));
    };
    climb(HILL.local.path, T.accent2, 'A', 'local 6.9', 12);
    climb(HILL.global.path, T.accent, 'B', 'global 10.3', 12.5);
    return root;
  },
};

function graphPopup(heur) {
  const root = new THREE.Group();
  const PH = n => heur ? 1.0 + n.h * 0.42 : 3.0;
  const shown = n => heur || A_ORDER[n.id] || A_FRONTIER[n.id];
  const top = n => [n.x, PH(n) + 0.17, n.v];
  for (const n of G.nodes) {
    if (!shown(n)) continue;
    let col = C.cream, fc = C.white, label = n.id, sub = `h ${n.h.toFixed(1)}`;
    if (n.id === 'S') col = T.accent2; if (n.id === 'G') col = T.accent;
    if (!heur) {
      const o = A_ORDER[n.id]; if (o) { fc = T.ochre; label = `${o.k} · ${n.id}`; sub = `f ${o.f.toFixed(1)}`; col = n.id === 'G' ? T.accent : n.id === 'S' ? T.accent2 : T.ochre; }
      else { sub = `f ${A_FRONTIER[n.id].f.toFixed(1)}`; col = C.white; }
    }
    const g = new THREE.Group(); g.add(pin(PH(n), col)); const f = flag(label, sub, { color: fc }); f.position.set(0.05, PH(n) - 0.12, 0); g.add(f);
    root.add(part(g, heur ? (12 - n.h) * 0.2 : (A_ORDER[n.id]?.k ?? 6.5) * 0.45, 'grow', [n.x, 0, n.v]));
  }
  for (const [a, b, c] of G.edges) {
    const A = G.by[a], Bn = G.by[b]; if (!shown(A) || !shown(Bn)) continue;
    root.add(part(string([top(A), top(Bn)], { r: 0.025, color: T.twine, sag: 0.6 }), 4, 'draw'));
    if (heur) { // cost tag hanging from the middle of the string
      const m = [(A.x + Bn.x) / 2, (PH(A) + PH(Bn)) / 2 + 0.17 - 0.1 * Math.hypot(A.x - Bn.x, A.v - Bn.v) / 6 * 0.6, (A.v + Bn.v) / 2];
      const s = standee(0.5, 0.42, { color: NOIR ? '#d7b87f' : '#fff3c4', ppu: 220, draw: (g, p, W, H) => { g.fillStyle = T.accent; g.font = `${B} ${0.3 * p}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c), W / 2, H / 2 + 0.02 * p); } });
      s.position.set(-0.25, -0.5, 0); const tg = new THREE.Group(); tg.add(s); tg.userData.flutter = true; root.add(part(tg, 5, 'pop', m));
    }
  }
  if (!heur) {
    const P = G.astar.path.map(id => G.by[id]);
    const red = string(P.map(n => [n.x, PH(n) + 0.42, n.v]), { r: 0.065, color: T.string, sag: 0.25 });
    root.add(part(red, 7, 'draw'));
  }
  return root;
}

// a tiny evidence board printed on the title-page panel
function miniBoard(g, p, W, H) {
  const r = rng(3);
  if (NOIR) { for (let k = 0; k < 2600; k++) { g.fillStyle = r() > 0.5 ? 'rgba(60,35,15,.25)' : 'rgba(255,230,190,.12)'; g.fillRect(r() * W, r() * H, 2, 2); } g.strokeStyle = '#3a2416'; g.lineWidth = 0.35 * p; g.strokeRect(0, 0, W, H); }
  else { g.strokeStyle = '#9aa0a6'; g.lineWidth = 0.22 * p; g.strokeRect(0, 0, W, H); }
  const cards = [[1.1, 1.0, 2.4, 1.6, '?', 'what is intelligence'], [6.2, 0.8, 2.6, 1.7, 'agent', 'perceive · act'], [3.6, 3.4, 2.6, 1.7, 'search', 'follow the trail'], [7.3, 4.2, 2.3, 1.6, 'learn', 'from evidence'], [0.9, 4.6, 2.2, 1.5, 'reason', 'under doubt']];
  const pins = [];
  cards.forEach(([x, y, w, h, t, s], i) => {
    g.save(); g.translate((x + w / 2) * p, (y + h / 2) * p); g.rotate((r() - 0.5) * 0.16);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect((-w / 2 + 0.08) * p, (-h / 2 + 0.1) * p, w * p, h * p);
    g.fillStyle = i === 0 ? (NOIR ? '#f3ead6' : '#ffe066') : (NOIR ? '#efe3c8' : '#ffffff'); g.fillRect(-w / 2 * p, -h / 2 * p, w * p, h * p);
    g.fillStyle = i === 0 ? T.accent : C.ink; g.textAlign = 'center'; g.font = `${i === 0 ? 700 : 400} ${(i === 0 ? 0.9 : 0.44) * p}px ${i === 0 ? TITLE : DISPLAY}`; g.fillText(t, 0, (i === 0 ? 0.25 : 0.05) * p);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.font = `400 ${0.3 * p}px ${HAND}`; g.fillText(s, 0, (h / 2 - 0.25) * p);
    g.restore(); pins.push([(x + w / 2) * p, (y + 0.15) * p]);
  });
  g.strokeStyle = T.string; g.lineWidth = 0.06 * p; g.lineCap = 'round';
  for (const [a, b] of [[0, 1], [0, 2], [2, 3], [0, 4], [4, 2], [1, 3]]) { g.beginPath(); g.moveTo(...pins[a]); const mx = (pins[a][0] + pins[b][0]) / 2, my = (pins[a][1] + pins[b][1]) / 2 + 0.3 * p; g.quadraticCurveTo(mx, my, ...pins[b]); g.stroke(); }
  for (const [x, y] of pins) { g.fillStyle = T.accent; g.beginPath(); g.arc(x, y, 0.13 * p, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 0.04 * p, y - 0.04 * p, 0.04 * p, 0, 7); g.fill(); }
}

// rise 0..1 for a pop-up root
export function setRise(root, r) {
  root.visible = r > 0.002;
  let maxD = 0; for (const c of root.children) maxD = Math.max(maxD, c.userData.delay || 0);
  root.children.forEach((c, i) => {
    const d = (c.userData.delay || 0) / (maxD || 1);
    const k = Math.min(1, Math.max(0, (r - d * 0.5) / 0.5));
    const e = 1 - Math.pow(1 - k, 3); c.userData.e = e; c.visible = k > 0.001;
    const m = c.userData.mode;
    if (m === 'fold') { c.rotation.x = -Math.PI / 2 * (1 - e); c.position.y = c.userData.y0 + 0.004 * (i % 6) * (1 - e) + 0.003; }
    else if (m === 'grow') c.scale.y = Math.max(0.002, e);
    else if (m === 'pop') c.scale.setScalar(Math.max(0.002, e));
    else if (m === 'draw') c.traverse(o => { if (o.isMesh && o.geometry.type === 'TubeGeometry') { const n = o.geometry.index.count; o.geometry.setDrawRange(0, Math.floor(n * e / 6) * 6); } else if (o.isMesh) o.visible = e > 0.97; });
  });
}
// looped life: panels breathe, flags flutter, beads run up the climb, the antenna blinks
export function animate(root, t) {
  if (!root.visible) return;
  for (const c of root.children) {
    const e = c.userData.e ?? 0; if (e < 0.999) continue; const ph = c.userData.phase;
    if (c.userData.mode === 'fold') c.rotation.x = Math.sin(t * 0.7 + ph) * 0.012;
    c.traverse(o => {
      if (o.userData.flutter) o.rotation.y = Math.sin(t * 1.6 + ph) * 0.18 + Math.sin(t * 3.1 + ph * 2) * 0.05;
      if (o.userData.bead) { const { k, n } = o.userData.bead; const run = ((t * 0.45) % 1.4) * n; o.material.emissiveIntensity = Math.max(0, 1 - Math.abs(run - k) / 1.6) * 0.9; }
      if (o.userData.blink) o.material.emissiveIntensity = (Math.sin(t * 3) > 0.6 ? 1.6 : 0.2);
    });
  }
}
