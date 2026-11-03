// The room around the book: a desk, the evidence board on the wall behind it, the props, the lights and every looped motion.
// Units are centimetres. The desk top is at y = DESK_Y; the book is centred on the origin.
import * as THREE from 'three';
import { T } from './theme.js';
import { grainTile, rng } from './paper.js';
import { G, HILL, fHill, CASES, TITLE_TXT } from './pages.js';
import { SERIF, DISPLAY, TITLE, HAND } from './typeset.js';

export const DESK_Y = -0.202;
const NOIR = T.name === 'noir', B = T.bold;
const WALL_Z = -48, BOARD = { w: 150, h: 84, y0: 6, z: WALL_Z + 2.6 }; // board front surface z
const ticks = []; // per-frame updaters

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const std = (o) => new THREE.MeshStandardMaterial(o);
const shadow = (o, cast = true, recv = true) => { o.traverse(m => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };
function grainOver(g, w, h, a = 0.4, seed = 5) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a; g.fillStyle = g.createPattern(grainTile(512, seed), 'repeat'); g.fillRect(0, 0, w, h); g.restore(); }

export function buildScene(scene, renderer, { mobile }) {
  scene.background = new THREE.Color(T.bg);
  const out = { tick: (t, dt, cam) => ticks.forEach(f => f(t, dt, cam)) };
  wall(scene); desk(scene);
  const board = new THREE.Group(); scene.add(board); evidenceBoard(board, mobile);
  props(scene);
  lights(scene, renderer, mobile, out);
  dust(scene, mobile);
  return out;
}

// ---------------- room ----------------
function wall(scene) {
  const [c, g] = cv(1024, 512);
  if (NOIR) { g.fillStyle = '#23251e'; g.fillRect(0, 0, 1024, 512); for (let x = 0; x < 1024; x += 32) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 14, 512); g.fillStyle = 'rgba(255,240,200,.025)'; g.fillRect(x + 16, 0, 3, 512); } grainOver(g, 1024, 512, 0.5, 8); }
  else { g.fillStyle = '#cfcac2'; g.fillRect(0, 0, 1024, 512); grainOver(g, 1024, 512, 0.18, 8); }
  const t = ctex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(520, 260), std({ map: t, roughness: 0.95 }));
  m.position.set(0, 100, WALL_Z); m.receiveShadow = true; scene.add(m);
  // skirting shadow line where desk meets wall
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), std({ color: NOIR ? '#100d0a' : '#a7a29a', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -76, 100); floor.receiveShadow = true; scene.add(floor);
}
function woodTexture(w, h, cols, seed = 3) {
  const [c, g] = cv(w, h); const r = rng(seed);
  g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 1) { const k = Math.sin(y * 0.045 + Math.sin(y * 0.011) * 3) * 0.5 + 0.5; g.fillStyle = `rgba(${NOIR ? '0,0,0' : '120,80,40'},${0.05 + k * 0.12})`; g.fillRect(0, y, w, 1); }
  for (let k = 0; k < 160; k++) { const y = r() * h, x = r() * w, l = 80 + r() * 400; g.strokeStyle = r() > 0.5 ? cols[1] : cols[2]; g.globalAlpha = 0.25; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y + (r() - 0.5) * 8, x + l * 0.6, y + (r() - 0.5) * 8, x + l, y + (r() - 0.5) * 6); g.stroke(); }
  g.globalAlpha = 1; for (let x = 0; x < w; x += w / 6) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 2, h); } // planks
  grainOver(g, w, h, 0.35, seed + 4); return ctex(c);
}
function desk(scene) {
  const top = std({ map: woodTexture(2048, 1024, T.wood), roughness: NOIR ? 0.55 : 0.7, metalness: 0 });
  const side = std({ color: T.wood[1], roughness: 0.7 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(190, 4, 92), [side, side, top, side, side, side]);
  m.position.set(0, DESK_Y - 2, WALL_Z + 46); m.receiveShadow = true; m.castShadow = true; scene.add(m);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(186, 9, 86), side); apron.position.set(0, DESK_Y - 8.5, WALL_Z + 46); scene.add(apron);
  for (const [x, z] of [[-90, WALL_Z + 4], [90, WALL_Z + 4], [-90, WALL_Z + 88], [90, WALL_Z + 88]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(5, 72, 5), side); l.position.set(x, DESK_Y - 40, z); scene.add(l); }
}

// ---------------- evidence board ----------------
function evidenceBoard(group, mobile) {
  const { w, h, y0, z } = BOARD; const cy = y0 + h / 2;
  // surface
  const [c, g] = cv(2048, Math.round(2048 * h / w));
  const S = c.width / w; // px per cm
  if (NOIR) {
    g.fillStyle = '#a77a4a'; g.fillRect(0, 0, c.width, c.height); const r = rng(9);
    for (let k = 0; k < 90000; k++) { const v = r(); g.fillStyle = v > 0.6 ? 'rgba(70,40,15,.35)' : v > 0.3 ? 'rgba(220,170,110,.25)' : 'rgba(40,20,5,.3)'; g.fillRect(r() * c.width, r() * c.height, 1 + r() * 2.5, 1 + r() * 2.5); }
    // old pin holes and faded marks
    for (let k = 0; k < 140; k++) { g.fillStyle = 'rgba(30,15,5,.6)'; g.beginPath(); g.arc(r() * c.width, r() * c.height, 1.5, 0, 7); g.fill(); }
    const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.width * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
  } else {
    g.fillStyle = '#272b31'; g.fillRect(0, 0, c.width, c.height);
    const sh = g.createLinearGradient(0, 0, c.width, c.height); sh.addColorStop(0, 'rgba(255,255,255,.06)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(0.55, 'rgba(255,255,255,.035)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, c.width, c.height);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const mk = (col, wdt, a = 1) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = wdt * S; g.globalAlpha = a; };
    mk('#ffffff', 0.25, 0.12); g.font = `400 ${3.2 * S}px ${HAND}`; g.fillText('A* = g + h ?', 20 * S, 12 * S); g.fillText('pins ~ h(n)', 98 * S, 80 * S);
    mk('#7cf3c6', 0.35, 0.9); g.font = `400 ${2.8 * S}px ${HAND}`; g.fillText('f(n) = g(n) + h(n)', 104 * S, 22 * S);
    mk('#ffffff', 0.35, 0.85); g.fillText('every number → Python ✓', 6 * S, 79 * S);
    mk('#ffffff', 0.3, 0.75); g.beginPath(); g.moveTo(60 * S, 10 * S); g.bezierCurveTo(70 * S, 4 * S, 82 * S, 6 * S, 90 * S, 12 * S); g.stroke();
    g.beginPath(); g.moveTo(90 * S, 12 * S); g.lineTo(87 * S, 9 * S); g.moveTo(90 * S, 12 * S); g.lineTo(86 * S, 12.8 * S); g.stroke();
    g.font = `400 ${2.6 * S}px ${HAND}`; g.fillText('story order = course order', 54 * S, 4.6 * S);
    g.globalAlpha = 1;
  }
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: ctex(c), roughness: NOIR ? 0.95 : 0.5, metalness: 0 }));
  surf.position.set(0, cy, z); surf.receiveShadow = true; group.add(surf);
  // frame
  const fm = std({ color: T.frame, roughness: NOIR ? 0.6 : 0.3, metalness: NOIR ? 0 : 0.8 });
  const fw = NOIR ? 3.2 : 1.6;
  for (const [x, y, ww, hh] of [[0, y0 - fw / 2, w + fw * 2, fw], [0, y0 + h + fw / 2, w + fw * 2, fw], [-w / 2 - fw / 2, cy, fw, h], [w / 2 + fw / 2, cy, fw, h]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 3.2), fm); b.position.set(x, y, z - 1.2); shadow(b); group.add(b);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2.4), std({ color: '#3a2a1a' })); back.position.set(0, cy, z - 1.25); group.add(back);
  if (false) { const tray = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.2, 4), fm); tray.position.set(0, y0 - fw - 0.4, z + 1.2); shadow(tray); group.add(tray);
    for (const [x, col] of [[-16, '#15171a'], [-2, '#2457ff'], [12, '#e0261b']]) { const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 11, 16), std({ color: col, roughness: 0.4 })); mk.rotation.z = Math.PI / 2; mk.position.set(x, y0 - fw + 0.9, z + 1.8); shadow(mk); group.add(mk); } }

  // pinned items. Each: [x, y (board-local centre, from bottom-left), w, h, rot, draw, opts]
  const anchors = {};
  const item = (key, x, y, iw, ih, rot, draw, { color = NOIR ? '#efe3c8' : '#ffffff', pinAt = [0, ih / 2 - 1.2], flutter = false, curl = 0.0 } = {}) => {
    const ppc = mobile ? 14 : 22; const [ic, ig] = cv(Math.round(iw * ppc), Math.round(ih * ppc));
    ig.fillStyle = color; ig.fillRect(0, 0, ic.width, ic.height); grainOver(ig, ic.width, ic.height, NOIR ? 0.45 : 0.15, 13);
    draw(ig, ppc, ic.width, ic.height);
    const geo = new THREE.PlaneGeometry(iw, ih, 8, 8);
    if (curl) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setZ(i, Math.max(0, -yy / ih - 0.2) ** 2 * curl); } geo.computeVertexNormals(); }
    const m = new THREE.Mesh(geo, std({ map: ctex(ic), roughness: 0.9, side: THREE.DoubleSide }));
    const holder = new THREE.Group(); // pivot at the pin
    holder.position.set(x - w / 2 + pinAt[0], y + y0 + pinAt[1], z + 0.15 + Math.random() * 0.12); holder.rotation.z = rot;
    m.position.set(-pinAt[0], -pinAt[1], 0); holder.add(m); shadow(holder, true, true); group.add(holder);
    const pp = new THREE.Vector3(x - w / 2 + pinAt[0], y + y0 + pinAt[1], holder.position.z + 0.2);
    group.add(boardPin(pp)); anchors[key] = pp;
    if (flutter) { const ph = Math.random() * 6; ticks.push(t => { holder.rotation.x = -(Math.max(0, Math.sin(t * 0.9 + ph)) ** 6) * 0.5 - Math.sin(t * 7 + ph) * 0.01; }); }
    return holder;
  };

  // header
  item('head', 75, 79, 46, 8, -0.01, (g, p, W, H) => {
    g.fillStyle = T.ink; g.font = `${NOIR ? 700 : 600} ${4.2 * p}px ${TITLE}`; g.textBaseline = 'middle'; g.fillText(TITLE_TXT, 2.2 * p, H / 2 + 0.2 * p);
    g.font = `400 ${2.3 * p}px ${HAND}`; g.fillStyle = T.accent; g.fillText('— book plan, AIF1303 endterm', 23 * p, H / 2 + 0.5 * p);
  }, { pinAt: [0, 2.4] });
  // case cards I–X
  const casePos = [[22, 57], [45, 60], [68, 56], [92, 60], [116, 57], [24, 35], [48, 38], [72, 34], [96, 38], [122, 35]];
  CASES.forEach(([r, t, s, p], i) => {
    const [x, y] = casePos[i]; const done = p !== undefined;
    item('c' + i, x, y, 17, 10.5, (Math.sin(i * 7.1) * 0.06), (g, q, W, H) => {
      if (NOIR) { g.strokeStyle = 'rgba(163,39,29,.5)'; g.lineWidth = 0.1 * q; g.beginPath(); g.moveTo(0, 2.4 * q); g.lineTo(W, 2.4 * q); g.stroke(); g.strokeStyle = 'rgba(60,90,160,.2)'; for (let y = 3.6; y < H; y += 1.1) { g.beginPath(); g.moveTo(0, y * q); g.lineTo(W, y * q); g.stroke(); } }
      else { g.fillStyle = done ? T.accent : '#cfd2d6'; g.fillRect(0, 0, W, 0.7 * q); }
      g.fillStyle = T.accent; g.font = `400 ${1.5 * q}px ${DISPLAY}`; g.fillText(`CASE ${r}`, 1.0 * q, 2.0 * q);
      g.fillStyle = T.ink; g.font = `${NOIR ? 700 : 600} ${1.75 * q}px ${TITLE}`; g.fillText(t, 1.0 * q, 4.9 * q);
      g.fillStyle = 'rgba(0,0,0,.65)'; g.font = `400 ${1.7 * q}px ${HAND}`; g.fillText(s, 1.0 * q, 7.0 * q);
      g.save(); g.translate(11.8 * q, 8.9 * q); g.rotate(-0.1); g.font = `400 ${1.0 * q}px ${NOIR ? DISPLAY : T.mono}`; g.textAlign = 'center';
      if (done) { g.strokeStyle = g.fillStyle = NOIR ? '#a3271d' : '#1f9d55'; g.lineWidth = 0.12 * q; g.strokeRect(-3.4 * q, -0.95 * q, 6.8 * q, 1.4 * q); g.fillText('✓ DRAFTED', 0, 0); }
      else { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText('TO DO', 0, 0); }
      g.restore();
    }, { color: NOIR ? '#f3ead6' : '#ffffff', pinAt: [0, 3.8] });
  });
  // sketches of the pop-ups (pencil)
  const pencil = (g, p) => { g.strokeStyle = NOIR ? 'rgba(40,35,30,.75)' : 'rgba(30,40,60,.75)'; g.fillStyle = g.strokeStyle; g.lineWidth = 0.12 * p; g.lineCap = 'round'; };
  item('sk1', 130, 76, 20, 15, 0.05, (g, p, W, H) => { // pins = h(n)
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('pin height = h(n)', 1.2 * p, 2.2 * p);
    G.nodes.forEach(n => { const x = 1.5 + n.x * 1.25, base = 13.5 - (n.v - 3) * 0.25, ph = 0.8 + n.h * 0.55; g.beginPath(); g.moveTo(x * p, base * p); g.lineTo(x * p, (base - ph) * p); g.stroke(); g.beginPath(); g.arc(x * p, (base - ph) * p, 0.35 * p, 0, 7); g.stroke(); g.font = `400 ${1.0 * p}px ${HAND}`; g.fillText(n.id, (x + 0.4) * p, (base - ph + 0.3) * p); });
    g.strokeStyle = T.accent; g.beginPath(); g.moveTo(1 * p, 14.2 * p); g.lineTo(19 * p, 14.2 * p); g.stroke();
  }, { pinAt: [0, 6.2] });
  item('sk2', 22, 77, 21, 14, -0.06, (g, p, W, H) => { // ridges = slices
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('ridges = slices of f(x, v)', 1.2 * p, 2.2 * p);
    [3.8, 6.2, 8.8, 11.2, 12.8, 15.2].forEach((v, i) => { g.globalAlpha = 0.45 + i * 0.1; g.beginPath(); for (let k = 0; k <= 40; k++) { const x = 0.7 + 12.6 * k / 40, X = 1 + k / 40 * 17 + i * 0.4, Y = 12.8 - i * 0.55 - fHill(x, v) * 0.75; k ? g.lineTo(X * p, Y * p) : g.moveTo(X * p, Y * p); } g.stroke(); });
    g.globalAlpha = 1; g.fillStyle = T.accent; g.font = `400 ${1.2 * p}px ${HAND}`; g.fillText('B → 10.3', 13 * p, 4.6 * p);
  }, { pinAt: [0, 5.8] });
  item('sk3', 47, 15, 18, 13, 0.04, (g, p, W, H) => { // agent box
    pencil(g, p); g.font = `400 ${1.6 * p}px ${HAND}`; g.fillText('agent = box, city behind', 1.0 * p, 2.0 * p);
    g.strokeRect(5 * p, 6.5 * p, 8 * p, 4.2 * p); g.beginPath(); g.moveTo(5 * p, 6.5 * p); g.lineTo(7 * p, 5.2 * p); g.lineTo(15 * p, 5.2 * p); g.lineTo(13 * p, 6.5 * p); g.moveTo(15 * p, 5.2 * p); g.lineTo(15 * p, 9.4 * p); g.lineTo(13 * p, 10.7 * p); g.stroke();
    g.strokeStyle = T.accent; g.beginPath(); g.moveTo(16.5 * p, 3.6 * p); g.quadraticCurveTo(17.5 * p, 8 * p, 13.5 * p, 8.4 * p); g.stroke();
    g.strokeStyle = T.accent2; g.beginPath(); g.moveTo(4.5 * p, 9 * p); g.quadraticCurveTo(1.2 * p, 7 * p, 2.2 * p, 3.4 * p); g.stroke();
  }, { pinAt: [0, 5.2] });
  // printed map of the search graph
  item('map', 102, 15, 22, 15, -0.03, (g, p, W, H) => {
    g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillStyle = T.ink; g.fillText('MAP · 9 locations, 13 roads', 1.0 * p, 1.7 * p);
    const X = x => (1.2 + x * 1.42) * p, Y = v => (0.6 + v * 0.85) * p;
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.1 * p; for (const [a, b] of G.edges) { g.beginPath(); g.moveTo(X(G.by[a].x), Y(G.by[a].v)); g.lineTo(X(G.by[b].x), Y(G.by[b].v)); g.stroke(); }
    g.strokeStyle = T.accent; g.lineWidth = 0.35 * p; g.beginPath(); G.astar.path.forEach((id, i) => { const n = G.by[id]; i ? g.lineTo(X(n.x), Y(n.v)) : g.moveTo(X(n.x), Y(n.v)); }); g.stroke();
    for (const n of G.nodes) { g.fillStyle = n.id === 'G' ? T.accent : T.ink; g.beginPath(); g.arc(X(n.x), Y(n.v), 0.5 * p, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `${B} ${0.65 * p}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n.id, X(n.x), Y(n.v) + 0.05 * p); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
  }, { pinAt: [0, 6.3] });
  // rubric (from the brief)
  item('rubric', 15, 16, 19, 22, 0.02, (g, p, W, H) => {
    g.fillStyle = T.ink; g.font = `${B} ${1.15 * p}px ${SERIF}`; g.fillText('EVALUATION · 100', 1.2 * p, 2.4 * p);
    const rows = [['Content coverage', 20, 0], ['Scientific accuracy', 25, 1], ['Clarity, education', 20, 0], ['Creativity', 15, 1], ['Design, organisation', 10, 1], ['Presentation, defence', 10, 0]];
    rows.forEach(([t, pt, ok], i) => { const y = 4.8 + i * 2.6; g.fillStyle = T.ink; g.font = `400 ${0.95 * p}px ${SERIF}`; g.fillText(t, 1.2 * p, y * p); g.textAlign = 'right'; g.fillText(String(pt), 17.6 * p, y * p); g.textAlign = 'left';
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 0.06 * p; g.beginPath(); g.moveTo(1.2 * p, (y + 0.7) * p); g.lineTo(17.8 * p, (y + 0.7) * p); g.stroke();
      if (ok) { g.strokeStyle = T.accent; g.lineWidth = 0.22 * p; g.beginPath(); g.moveTo(13.2 * p, (y - 0.5) * p); g.lineTo(13.8 * p, (y + 0.1) * p); g.lineTo(15 * p, (y - 1.0) * p); g.stroke(); } });
    g.fillStyle = T.accent; g.font = `400 ${1.4 * p}px ${HAND}`; g.fillText('accuracy is the big one', 1.2 * p, 20.6 * p);
  }, { pinAt: [0, 9.6] });
  // calendar: November 2026, Friday the 6th circled
  item('cal', 140, 47, 16, 17, 0.0, (g, p, W, H) => {
    g.fillStyle = T.accent; g.fillRect(0, 0, W, 3.2 * p); g.fillStyle = '#fff'; g.font = `${B} ${1.4 * p}px ${SERIF}`; g.textAlign = 'center'; g.fillText('NOVEMBER 2026', W / 2, 2.1 * p);
    g.fillStyle = T.ink; g.font = `400 ${0.75 * p}px ${SERIF}`; ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => g.fillText(d, (1.6 + i * 2.15) * p, 4.6 * p));
    for (let d = 1; d <= 30; d++) { const idx = d + 5 - 1; const col = idx % 7, row = Math.floor(idx / 7); const x = (1.6 + col * 2.15) * p, y = (6.6 + row * 2.0) * p; g.fillStyle = d < 3 ? 'rgba(0,0,0,.3)' : T.ink; g.fillText(String(d), x, y);
      if (d < 3) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.08 * p; g.beginPath(); g.moveTo(x - 0.7 * p, y - 0.7 * p); g.lineTo(x + 0.7 * p, y + 0.2 * p); g.stroke(); }
      if (d === 6) { g.strokeStyle = T.accent; g.lineWidth = 0.2 * p; g.beginPath(); g.ellipse(x, y - 0.3 * p, 1.0 * p, 0.85 * p, 0.2, 0, 7); g.stroke(); } }
    g.fillStyle = T.accent; g.font = `400 ${1.2 * p}px ${HAND}`; g.fillText('defence', 10.5 * p, 16.3 * p);
  }, { pinAt: [0, 7.6] });
  // lecture printouts W1–W3
  [['W1', 'Intelligent agents'], ['W2', 'Search · A*'], ['W3', 'Local search · CSP']].forEach(([wk, t], i) => item('w' + i, 8 + i * 4, 56 - i * 3, 13, 9, -0.05 + i * 0.04, (g, p, W, H) => {
    g.fillStyle = NOIR ? '#2c3956' : '#15171a'; g.fillRect(0, 0, W, 2.4 * p); g.fillStyle = '#fff'; g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillText(`${wk} · AIF1303`, 0.8 * p, 1.6 * p);
    g.fillStyle = T.ink; g.font = `${B} ${1.1 * p}px ${SERIF}`; g.fillText(t, 0.8 * p, 4.0 * p);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) g.fillRect(0.8 * p, (5.0 + k * 0.9) * p, (6 + ((k * 5 + i) % 4) * 1.4) * p, 0.35 * p);
  }, { pinAt: [0, 3.4] }));
  // sticky notes
  const sticky = (key, x, y, rot, lines, col, opts = {}) => item(key, x, y, 9, 9, rot, (g, p, W, H) => {
    g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, W, 1.4 * p);
    g.fillStyle = opts.ink || '#1d1b18'; g.font = `400 ${1.55 * p}px ${HAND}`; lines.forEach((l, i) => g.fillText(l, 0.8 * p, (3.2 + i * 1.75) * p));
  }, { color: col, pinAt: [0, 3.6], curl: opts.curl ?? 0.6, flutter: opts.flutter });
  const Y1 = NOIR ? '#e8d57a' : '#fff176', Y2 = NOIR ? '#d9c08a' : '#7cf3c6', Y3 = NOIR ? '#e3b08a' : '#ff9ec7';
  sticky('n1', 30, 13, 0.06, ['verify every', 'number in', 'Python ✓'], Y1);
  sticky('n2', 125, 19, -0.07, ['no living', 'beings.', 'no music.'], Y2, { flutter: true });
  sticky('n3', 87, 76, 0.04, ['QR on the back', 'cover → test', 'on a phone!'], Y1, { flutter: true });
  sticky('n4', 108, 76, -0.03, ['explain each', 'term the first', 'time it appears'], Y3);
  sticky('n5', 140, 30, 0.05, ['DEFENCE', 'FRI 6 NOV'], NOIR ? '#c9554a' : '#ff4a1c', { ink: '#fff' });
  sticky('n6', 60, 77, -0.05, ['eye level =', 'the story;', 'above = the text'], Y2);

  // red strings: the case chain, then cards to their sketches and notes
  const chain = []; for (let i = 0; i < 9; i++) chain.push(['c' + i, 'c' + (i + 1)]);
  const extra = [['c1', 'sk1'], ['c1', 'map'], ['c2', 'sk2'], ['c0', 'sk3'], ['head', 'n3'], ['c4', 'cal'], ['n5', 'cal'], ['rubric', 'n1'], ['c0', 'w0'], ['c1', 'w1'], ['c2', 'w2']];
  for (const [a, b] of [...chain, ...extra]) if (anchors[a] && anchors[b]) group.add(boardString(anchors[a], anchors[b]));
}
function boardPin(p) {
  const g = new THREE.Group();
  if (NOIR) {
    const col = ['#b3241b', '#c79a3a', '#b3241b', '#2c3956'][Math.floor(Math.random() * 4)];
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.55, 20), std({ color: col, roughness: 0.35 })); head.rotation.x = Math.PI / 2; head.position.z = 0.55;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.18, 24), std({ color: col, roughness: 0.35 })); cap.rotation.x = Math.PI / 2; cap.position.z = 0.9;
    g.add(head, cap);
  } else {
    const col = ['#15171a', '#ff4a1c', '#2457ff', '#e8e8e8'][Math.floor(Math.random() * 4)];
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.55, 28), std({ color: col, roughness: 0.3, metalness: 0.1 })); mag.rotation.x = Math.PI / 2; mag.position.z = 0.3; g.add(mag);
  }
  g.position.copy(p); return shadow(g);
}
// a string between two board pins that sags and sways slowly (vertex shader)
function boardString(a, b) {
  const pts = []; const L = a.distanceTo(b);
  for (let i = 0; i <= 24; i++) { const t = i / 24; const p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * L * 0.035; p.z += 0.9 + Math.sin(Math.PI * t) * 0.6; pts.push(p); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.12, 6, false);
  const mat = std({ color: T.string, roughness: 0.7 }); const u = { t: { value: 0 }, ph: { value: Math.random() * 6 }, amp: { value: Math.min(0.9, L * 0.012) } };
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uT: u.t, uPh: u.ph, uAmp: u.amp }); sh.vertexShader = 'uniform float uT, uPh, uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float s = sin(3.14159 * uv.x); transformed.y += sin(uT * 0.8 + uPh) * uAmp * s; transformed.z += sin(uT * 0.55 + uPh * 1.7) * uAmp * 0.6 * s;'); };
  ticks.push(t => { u.t.value = t; });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}

// ---------------- props ----------------
function props(scene) {
  const D = DESK_Y;
  const add = (o, x, z, ry = 0, y = D) => { o.position.set(x, y, z); o.rotation.y = ry; shadow(o); scene.add(o); return o; };
  // lamp
  const lampObj = add(NOIR ? bankerLamp() : ledLamp(), NOIR ? -50 : -50, -34, NOIR ? 0.55 : 0.6); lampObj.scale.setScalar(0.85);
  // mug with steam
  const mug = mugMesh(); add(mug, 36, -22, -0.6); const steam = steamMesh(); steam.position.set(36, D + 10, -22); scene.add(steam);
  // magnifying glass lying on the desk
  add(magnifier(), 25, 17, 0.7, D + 0.6);
  // pencils
  add(pencilMesh(NOIR ? '#d9a531' : '#15171a'), -25, 15, 0.35, D + 0.45); add(pencilMesh(NOIR ? '#2c3956' : '#ff4a1c'), -23, 18, 0.15, D + 0.45);
  // index-card stack
  add(cardStack(), -37, 3, 0.25);
  // spool of red string with a loose end toward the book, and a tin of pins
  add(spool(), 40, 4, 0.2); add(pinTin(), 46, 13, 0);
  const loose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[40, D + 2.2, 4], [36, D + 0.15, 7], [30, D + 0.15, 6], [24, D + 0.15, 9], [19, D + 0.15, 6.5]].map(p => new THREE.Vector3(...p))), 64, 0.1, 6), std({ color: T.string, roughness: 0.7 }));
  shadow(loose); scene.add(loose);
  // desk clock with a ticking second hand
  add(deskClock(), 52, -32, -0.45);
  if (NOIR) { add(legalPad(), -52, -6, 0.18); }
  else { add(laptop(), 60, -10, -0.75); const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 13, 16), std({ color: '#ff4a1c', roughness: 0.4 })); mk.rotation.z = Math.PI / 2; add(mk, -30, 22, 0.5, D + 0.75); add(phone(), -48, 14, 0.4, D + 0.4); }
}
function lathe(points, mat, seg = 48) { return new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); }
function bankerLamp() {
  const g = new THREE.Group(); const brass = std({ color: '#b8893a', metalness: 1, roughness: 0.28 });
  g.add(lathe([[0, 0], [7, 0], [7, 0.8], [6, 1.6], [2, 2.4], [0, 2.4]], brass));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 24, 16), brass); stem.position.y = 13; g.add(stem);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 12), brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, 25, 4); g.add(arm);
  const shadeMat = std({ color: '#1f5a3a', roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide, emissive: '#0c2a19', emissiveIntensity: 0.6 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 24, 32, 1, true, 0, Math.PI), shadeMat); shade.rotation.z = Math.PI / 2; shade.position.set(0, 26.5, 8); g.add(shade);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, 23.6, 32, 1, true, 0, Math.PI), std({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 1.6, side: THREE.BackSide })); inner.rotation.z = Math.PI / 2; inner.position.copy(shade.position); g.add(inner);
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(5.5, 32, 0, Math.PI), shadeMat); cap.rotation.y = s * Math.PI / 2; cap.position.set(s * 12, 26.5, 8); g.add(cap); }
  const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 18, 12), std({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 3 })); bulb.rotation.z = Math.PI / 2; bulb.position.set(0, 25.6, 8); g.add(bulb);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), brass); chain.position.set(3, 21.5, 12.5); g.add(chain);
  g.userData.lightAt = new THREE.Vector3(0, 24.5, 8); return g;
}
function ledLamp() {
  const g = new THREE.Group(); const m = std({ color: '#1b1d20', roughness: 0.45, metalness: 0.4 });
  g.add(lathe([[0, 0], [6.5, 0], [6.5, 1.2], [0, 1.2]], m));
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 12), m); a1.position.set(0, 15, 0); a1.rotation.z = 0.12; g.add(a1);
  const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 28, 12), m); a2.rotation.z = Math.PI / 2 - 0.25; a2.position.set(-12, 31, 0); a2.rotation.y = 0; g.add(a2);
  const head = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 3.2), m); head.position.set(-26, 27.5, 0); head.rotation.z = -0.25; g.add(head);
  const diff = new THREE.Mesh(new THREE.PlaneGeometry(21, 2.4), std({ color: '#fff', emissive: '#fffaf0', emissiveIntensity: 3 })); diff.rotation.x = Math.PI / 2; diff.position.set(-26, 26.85, 0); diff.rotation.order = 'ZXY'; diff.rotation.z = -0.25; g.add(diff);
  g.userData.lightAt = new THREE.Vector3(-26, 26.5, 0); return g;
}
function mugMesh() {
  const g = new THREE.Group(); const body = std({ color: NOIR ? '#e9e2d2' : '#1b1d20', roughness: NOIR ? 0.25 : 0.6 });
  g.add(lathe([[0, 0], [4.2, 0], [4.6, 0.6], [4.8, 9.5], [4.4, 9.6], [4.2, 1.0], [0, 1.0]], body));
  if (NOIR) { const rim = lathe([[4.75, 9.0], [4.85, 9.0], [4.85, 9.6], [4.75, 9.6]], std({ color: '#2c3956', roughness: 0.3 })); g.add(rim); }
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(4.25, 40), std({ color: '#2a160b', roughness: 0.1, metalness: 0.2 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 8.2; g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.55, 12, 24, Math.PI * 1.2), body); handle.position.set(5.0, 5, 0); handle.rotation.z = -Math.PI * 0.6; g.add(handle);
  return g;
}
function steamMesh() {
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(NOIR ? '#ffe2b8' : '#ffffff') }, uA: { value: NOIR ? 0.32 : 0.22 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uA; uniform vec3 uCol;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){ vec2 uv=vUv; float y=uv.y; vec2 q=vec2(uv.x*3., y*4. - uT*.55); float w = fbm(q + vec2(sin(y*3.+uT*.4)*.6, 0.));
        float x = uv.x - .5 - (fbm(vec2(y*2.-uT*.3, 1.7))-.5)*.5*y; float col = smoothstep(.22, 0., abs(x)) ;
        float a = col * smoothstep(.0,.12,y) * smoothstep(1.,.35,y) * smoothstep(.35,.75,w) * uA; gl_FragColor = vec4(uCol, a); }` });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 18), mat); m.position.y = 0;
  ticks.push((t, dt, cam) => { mat.uniforms.uT.value = t; if (cam) { m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z); } });
  return m;
}
function magnifier() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.45, 16, 64), std({ color: NOIR ? '#b8893a' : '#26292d', metalness: NOIR ? 1 : 0.3, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; g.add(rim);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.25, 48), new THREE.MeshPhysicalMaterial({ color: '#e8f4f6', roughness: 0.02, metalness: 0, transmission: 0.9, thickness: 0.6, ior: 1.5, transparent: true, opacity: 0.5 })); g.add(lens);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 10, 20), std({ color: NOIR ? '#3b2314' : '#15171a', roughness: 0.45 })); h.rotation.z = Math.PI / 2; h.position.set(9.4, 0, 0); g.add(h);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 20), rim.material); ferrule.rotation.z = Math.PI / 2; ferrule.position.set(4.9, 0, 0); g.add(ferrule);
  return g;
}
function pencilMesh(col) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 17, 6), std({ color: col, roughness: 0.5 })); body.rotation.z = Math.PI / 2; g.add(body);
  const wood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.8, 6), std({ color: '#e2c08d', roughness: 0.8 })); wood.rotation.z = -Math.PI / 2; wood.position.x = 9.4; g.add(wood);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 8), std({ color: '#222', roughness: 0.4 })); lead.rotation.z = -Math.PI / 2; lead.position.x = 10.35; g.add(lead);
  if (NOIR) { const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 1.1, 12), std({ color: '#c9a64a', metalness: 1, roughness: 0.3 })); ferr.rotation.z = Math.PI / 2; ferr.position.x = -9.0; g.add(ferr);
    const er = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 12), std({ color: '#d77b7b', roughness: 0.8 })); er.rotation.z = Math.PI / 2; er.position.x = -10.0; g.add(er); }
  return g;
}
function cardStack() {
  const g = new THREE.Group(); const r = rng(4);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(12.7, 0.08, 7.6), std({ color: NOIR ? '#efe3c8' : '#fafafa', roughness: 0.9 })); m.position.y = 0.05 + i * 0.09; m.rotation.y = (r() - 0.5) * 0.12; g.add(m); }
  const [c, x] = cv(508, 304); x.fillStyle = NOIR ? '#f3ead6' : '#fff'; x.fillRect(0, 0, 508, 304);
  if (NOIR) { x.strokeStyle = 'rgba(163,39,29,.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 54); x.lineTo(508, 54); x.stroke(); x.strokeStyle = 'rgba(60,90,160,.25)'; for (let y = 84; y < 304; y += 30) { x.beginPath(); x.moveTo(0, y); x.lineTo(508, y); x.stroke(); } }
  x.fillStyle = '#222'; x.font = `400 40px ${HAND}`; x.fillText('Case IV: minimax,', 24, 118); x.fillText('alpha-beta pruning', 24, 170); x.fillStyle = T.accent; x.fillText('next →', 24, 240);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(12.7, 7.6), std({ map: ctex(c), roughness: 0.9 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.05 + 9 * 0.09 + 0.01; top.rotation.z = 0.05; g.add(top);
  return g;
}
function spool() {
  const g = new THREE.Group(); const wood = std({ color: NOIR ? '#8a6136' : '#d9d4c7', roughness: 0.7 });
  for (const y of [0.3, 4.1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 32), wood); f.position.y = y; g.add(f); }
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 32), std({ color: T.string, roughness: 0.8 })); thread.position.y = 2.2; g.add(thread);
  return g;
}
function pinTin() {
  const g = new THREE.Group(); const tin = std({ color: NOIR ? '#6b6f73' : '#d0d3d6', metalness: 0.9, roughness: 0.35 });
  g.add(lathe([[0, 0], [3.4, 0], [3.4, 1.6], [3.2, 1.6], [3.2, 0.3], [0, 0.3]], tin));
  const r = rng(12); for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = r() * 2.6; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.4, 12), std({ color: [T.string, T.ochre, T.accent2, '#e8e8e8'][i % 4], roughness: 0.4 })); p.position.set(Math.cos(a) * d, 0.55 + r() * 0.35, Math.sin(a) * d); p.rotation.set(r() * 1.4, 0, r() * 1.4); g.add(p); }
  return g;
}
function deskClock() {
  const g = new THREE.Group(); const body = std({ color: NOIR ? '#b8893a' : '#e9e9e7', metalness: NOIR ? 1 : 0, roughness: NOIR ? 0.3 : 0.5 });
  const face = new THREE.Group(); face.position.set(0, 6, 0); face.rotation.x = -0.12; g.add(face);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 48), body); rim.rotation.x = Math.PI / 2; face.add(rim);
  const [c, x] = cv(512, 512); x.fillStyle = NOIR ? '#f1e6cc' : '#ffffff'; x.fillRect(0, 0, 512, 512); x.translate(256, 256); x.fillStyle = '#1b1b1b';
  for (let k = 0; k < 60; k++) { x.save(); x.rotate(k * Math.PI / 30); x.fillRect(-(k % 5 ? 2 : 5), -232, k % 5 ? 4 : 10, k % 5 ? 14 : 34); x.restore(); }
  if (NOIR) { x.font = `700 54px ${TITLE}`; x.textAlign = 'center'; x.textBaseline = 'middle'; [12, 3, 6, 9].forEach((n, i) => { const a = i * Math.PI / 2 - Math.PI / 2; x.fillText(String(n), Math.cos(a) * 165, Math.sin(a) * 165); }); }
  const dial = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), std({ map: ctex(c), roughness: 0.6 })); dial.position.z = 1.21; face.add(dial);
  const hand = (len, w, col, z) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.06), std({ color: col, roughness: 0.4 })); m.position.y = len / 2 - len * 0.15; p.add(m); p.position.z = z; face.add(p); return p; };
  const hh = hand(2.4, 0.28, '#1b1b1b', 1.3), mh = hand(3.5, 0.2, '#1b1b1b', 1.35), sh = hand(3.9, 0.08, T.accent, 1.4);
  ticks.push(() => { const d = new Date(); const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; sh.rotation.z = -s * Math.PI / 30; mh.rotation.z = -m * Math.PI / 30; hh.rotation.z = -h * Math.PI / 6; });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), std({ color: '#fff', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.5 })); glass.position.z = 1.45; face.add(glass);
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
function laptop() {
  const g = new THREE.Group(); const al = std({ color: '#b7bbc0', metalness: 0.85, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(31, 1.2, 21.5), al); base.position.y = 0.6; g.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), std({ color: '#1d1f22', roughness: 0.8 })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 1.21, -2.5); g.add(kb);
  const lid = new THREE.Group(); lid.position.set(0, 1.2, -10.7); lid.rotation.x = -0.32; g.add(lid);
  const back = new THREE.Mesh(new THREE.BoxGeometry(31, 20.5, 0.6), al); back.position.y = 10.25; lid.add(back);
  const [c, x] = cv(1024, 660); const tex = ctex(c);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(29, 18.7), std({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.2 })); screen.position.set(0, 10.25, 0.31); lid.add(screen);
  const lines = ['$ python scripts/verify/graph.py', 'BFS  path S-B-E-G  cost 18  expanded 9', 'UCS  path S-C-F-G  cost 14  expanded 8', 'A*   path S-C-F-G  cost 14  expanded 5', 'h consistent on all 13 edges ... ok', '$ python scripts/verify/hills.py', 'climber A  local max 6.95  steps 8', 'climber B  global max 10.28 steps 14', 'all exhibit numbers match ✓', '$ '];
  let shown = -1;
  ticks.push(t => { const k = Math.floor((t * 0.8) % (lines.length + 6)); const cur = Math.floor(t * 2) % 2; const key = k * 2 + cur; if (key === shown) return; shown = key;
    x.fillStyle = '#0f1115'; x.fillRect(0, 0, 1024, 660); x.fillStyle = '#1b1e24'; x.fillRect(0, 0, 1024, 40); ['#ff5f57', '#febc2e', '#28c840'].forEach((cc, i) => { x.fillStyle = cc; x.beginPath(); x.arc(24 + i * 26, 20, 8, 0, 7); x.fill(); });
    x.font = '500 27px "JetBrains Mono", monospace'; const n = Math.min(lines.length, k + 1);
    for (let i = 0; i < n; i++) { x.fillStyle = lines[i].startsWith('$') ? '#8ab4ff' : lines[i].includes('✓') ? '#7ee787' : '#d6dae0'; x.fillText(lines[i], 30, 92 + i * 52); }
    if (cur) { const last = lines[n - 1]; x.fillStyle = '#d6dae0'; x.fillRect(30 + x.measureText(last).width + 4, 92 + (n - 1) * 52 - 24, 15, 30); }
    tex.needsUpdate = true; });
  return g;
}
function phone() {
  const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.8, 14.8), std({ color: '#202327', roughness: 0.35, metalness: 0.6 })); g.add(m);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.6), std({ color: '#2b2e33', roughness: 0.2 })); cam.position.set(-1.8, 0.5, -5); g.add(cam); return g;
}

// ---------------- light ----------------
function lights(scene, renderer, mobile, out) {
  const smap = mobile ? 1024 : 2048;
  if (NOIR) {
    renderer.toneMappingExposure = 1.05;
    scene.add(new THREE.HemisphereLight('#4a4a5a', '#120c08', 0.35));
    // the banker's lamp pours a warm pool over the book
    const lamp = new THREE.SpotLight('#ffb25c', 5200, 120, 0.62, 0.8, 1.6);
    lamp.position.set(-38, 21, -24); lamp.target.position.set(3, 0, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(smap, smap); lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 3;
    scene.add(lamp, lamp.target);
    // moonlight through blinds from the right, striping the board
    const blinds = new THREE.SpotLight('#7d93c9', 9000, 400, 0.32, 0.25, 1.2);
    blinds.position.set(150, 120, 80); blinds.target.position.set(-10, 40, WALL_Z); blinds.castShadow = true; blinds.shadow.mapSize.set(1024, 1024);
    const [c, g] = cv(512, 512); g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#fff'; for (let y = 0; y < 512; y += 46) g.fillRect(0, y, 512, 30); g.fillStyle = '#000'; g.fillRect(250, 0, 14, 512);
    blinds.map = ctex(c); scene.add(blinds, blinds.target);
    // warm bounce off the desk onto the board
    const bounce = new THREE.PointLight('#ff9a4a', 380, 140, 1.8); bounce.position.set(0, 18, -20); scene.add(bounce);
    const base = lamp.intensity;
    ticks.push(t => { const flick = 1 + Math.sin(t * 13.1) * 0.006 + Math.sin(t * 7.7) * 0.008 + (Math.sin(t * 0.37) > 0.995 ? -0.12 : 0); lamp.intensity = base * flick; });
    out.lamp = lamp;
  } else {
    renderer.toneMappingExposure = 1.0;
    scene.add(new THREE.HemisphereLight('#eef2ff', '#8f8676', 0.65));
    const sun = new THREE.DirectionalLight('#fff3e2', 2.6); sun.position.set(90, 110, 60); sun.target.position.set(0, 0, -10); sun.castShadow = true;
    sun.shadow.mapSize.set(smap, smap); Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -60, near: 10, far: 400 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    const lamp = new THREE.SpotLight('#fff6ea', 1600, 110, 0.9, 0.9, 1.6); lamp.position.set(-40, 23, -26); lamp.target.position.set(2, 0, 0); scene.add(lamp, lamp.target);
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.5); fill.position.set(-80, 60, 90); scene.add(fill);
    // clouds drifting past the window
    ticks.push(t => { sun.intensity = 2.6 * (0.86 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.13) * Math.sin(t * 0.071 + 1))); });
    out.lamp = lamp;
  }
}
// dust motes drifting through the light
function dust(scene, mobile) {
  const n = mobile ? 260 : 600; const pos = new Float32Array(n * 3), seed = new Float32Array(n); const r = rng(77);
  for (let i = 0; i < n; i++) { pos[i * 3] = -40 + r() * 70; pos[i * 3 + 1] = r() * 40; pos[i * 3 + 2] = -30 + r() * 50; seed[i] = r() * 100; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(NOIR ? '#ffd9a0' : '#ffffff') }, uA: { value: NOIR ? 0.55 : 0.3 }, uPx: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute float seed; uniform float uT, uPx; varying float vA;
      void main(){ vec3 p = position; float s = seed; p.x += sin(uT*.07 + s)*3.0 + sin(uT*.13 + s*1.7)*1.5; p.y = mod(p.y + uT*(.25 + fract(s)*.4), 40.); p.z += cos(uT*.09 + s*2.3)*3.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (40. / -mv.z) * (0.6 + fract(s*3.1)); vA = smoothstep(0., 4., p.y) * smoothstep(40., 30., p.y) * (.4 + .6*fract(s*7.3)); }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(uCol, smoothstep(.5, 0., d) * vA * uA); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  ticks.push(t => { mat.uniforms.uT.value = t; });
}
