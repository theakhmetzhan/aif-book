// Pop-up exhibits, built as real paper engineering: every element is a rigid card cut-out hinged to its page by a glued tab.
// Face coords: x → right across the page, y ↑ above the page, z = v (down the page, toward the reader). Page 14 × 20 cm.
// All the pieces on one page share one fold angle φ (0 = flat on the page, π/2 = standing), so their planes stay parallel and
// can never pass through each other. The book drives φ from the angle between the two pages of the spread (see book.js).
import * as THREE from 'three';
import { C, FIG11, G, A_ORDER, A_FRONTIER, HILL, fHill, CASES } from './pages.js';
import { grainTile, rng } from './paper.js';
import { SERIF, DISPLAY, TITLE, HAND } from './typeset.js';
import { T } from './theme.js';

const B = T.bold;
export const CARD = 0.024; // card thickness, cm
let grainTex;
const grain = () => { if (!grainTex) { grainTex = new THREE.CanvasTexture(grainTile(256, 21)); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; } return grainTex; };
const mats = {};
function plain(color, side = THREE.FrontSide) {
  const k = color + side; if (mats[k]) return mats[k];
  return (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side, bumpMap: grain(), bumpScale: 0.25 }));
}
// a glue tab lies a hair above its page, about two steps of the depth buffer through Top's long lens, and on a tilting leaf the print flashes through it. The offset gets a material of its own: plain() shares by colour with the cut edges
function tabPaper(color) {
  const k = color + 'tab'; if (mats[k]) return mats[k];
  return (mats[k] = Object.assign(plain(color).clone(), { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
}
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
const shade = (hex, k) => { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + k))); return '#' + c.getHexString(); };
const shadowy = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

function tex(w, h, draw, ppu, base, outline) {
  const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(w * ppu)); c.height = Math.max(8, Math.round(h * ppu));
  const g = c.getContext('2d');
  if (base) { g.fillStyle = base; g.fillRect(0, 0, c.width, c.height); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(grainTile(256, 21), 'repeat'); g.fillRect(0, 0, c.width, c.height); g.restore(); }
  draw?.(g, ppu, c.width, c.height);
  if (outline) { // the cut edge of card reads as a hair-line slightly darker than the face
    g.save(); g.strokeStyle = 'rgba(40,25,10,.35)'; g.lineWidth = Math.max(1, 0.03 * ppu); g.beginPath();
    for (const loop of outline) { loop.forEach(([x, y], i) => i ? g.lineTo(x * ppu, (h - y) * ppu) : g.moveTo(x * ppu, (h - y) * ppu)); g.closePath(); }
    g.stroke(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// a card cut-out standing in its own xy-plane: local x ∈ [0, w], y ∈ [0, h], printed face toward +z, card thickness centred on z = 0
function standee(w, h, { pts = null, holes = [], color = C.cream, back = null, draw = null, ppu = 120 } = {}) {
  const outer = pts || [[0, 0], [w, 0], [w, h], [0, h]];
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hl of holes) shape.holes.push(new THREE.Path(hl.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ShapeGeometry(shape, 24);
  const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w, pos.getY(i) / h);
  const front = new THREE.MeshStandardMaterial({ map: tex(w, h, draw, ppu, color, [outer, ...holes]), roughness: 0.9, bumpMap: grain(), bumpScale: 0.22 });
  const g = new THREE.Group();
  const mf = new THREE.Mesh(geo, front); mf.position.z = CARD / 2;
  const mb = new THREE.Mesh(geo, plain(back || shade(color, -0.1), THREE.BackSide)); mb.position.z = -CARD / 2;
  // the cut edge: sides of a thin extrusion (its caps are hidden behind the two faces)
  const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: CARD * 0.8, bevelEnabled: false, curveSegments: 24 }), [HIDDEN, plain(shade(color, -0.05))]);
  edge.position.z = -CARD * 0.4;
  g.add(mf, mb, edge); g.userData.size = { w, h }; return shadowy(g);
}

// ---------- pieces ----------
// A piece is hinged along the face x-axis at (x, v0); it stands up from y = 0. `dir` = -1 folds it flat toward the head of the page
// (it lies on [v0 - H, v0]), +1 toward the reader (it lies on [v0, v0 + H]). `ext` = its x-extent on the face, for the clearance check.
function piece(obj, { x = 0, v0, dir = -1, H, x0, x1, tx0 = x0, tx1 = x1, tab = true, color = null }) {
  const hinge = new THREE.Group(); hinge.position.set(0, 0, v0);
  const fold = new THREE.Group(); fold.position.x = x; hinge.add(fold); fold.add(obj);
  if (tab) { // glue tab lying on the page on the far side of the fold
    const w = (tx1 - tx0), d = 0.42;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tabPaper(color || C.cream)); t.rotation.x = -Math.PI / 2; t.position.set((tx0 + tx1) / 2, 0.0012, -dir * d / 2); t.receiveShadow = true; hinge.add(t);
  }
  return { hinge, fold, dir, H, x0, x1, v0, lo: dir < 0 ? v0 - H : v0, hi: dir < 0 ? v0 : v0 + H, layer: 0, span: 1 };
}
// set a piece's fold angle φ (π/2 standing, 0 flat) and its flat-stack offset
export function setPieceFold(pc, phi) {
  pc.fold.rotation.x = pc.dir * (Math.PI / 2 - phi);
  // the hinge sits half a card above the page so a flat card rests on it; flat cards stack one card thickness per layer
  pc.fold.position.y = CARD / 2 + 0.0008 + pc.layer * (CARD + 0.0015) * (1 - Math.sin(phi));
  pc.custom?.(phi);
}

// ---------- slack string between moving anchors ----------
// fixed length; sags as a parabola when its ends come closer; never goes through the page.
export class SlackString {
  constructor(anchors, { r = 0.03, color = T.twine, seg = 18, radial = 5, extra = 1.03, lift = 0 } = {}) {
    this.anchors = anchors; this.r = r; this.seg = seg; this.radial = radial; this.lift = lift; this.L = null; this.extra = extra;
    const spans = anchors.length - 1, n = spans * seg + 1; this.n = n;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * (radial + 1) * 3); this.nrm = new Float32Array(n * (radial + 1) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    const idx = []; for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 })); this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.pts = Array.from({ length: n }, () => new THREE.Vector3()); this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  // lengths are fixed from the longest chord the ends ever reach
  calibrate(maxChords) { this.L = maxChords.map(c => c * this.extra); }
  update(ends, floor = 0) { // ends: Vector3[] in the parent's (face) coords; floor: top of any flat card under it
    const { seg, pts, r } = this; let k = 0;
    for (let s = 0; s < ends.length - 1; s++) {
      const a = ends[s], b = ends[s + 1], c = a.distanceTo(b), L = Math.max(c, this.L ? this.L[s] : c * this.extra);
      const sag = Math.sqrt(Math.max(0, 3 * c * (L - c) / 8));
      for (let i = 0; i < seg + (s === ends.length - 2 ? 1 : 0); i++) {
        const t = i / seg; const p = pts[k++]; p.lerpVectors(a, b, t); p.y -= 4 * sag * t * (1 - t);
        p.y = Math.max(p.y, floor + r + 0.003);
      }
    }
    // rings
    const R = this.radial;
    for (let i = 0; i < this.n; i++) {
      const p = pts[i], q = pts[Math.min(this.n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      const t = this._t.subVectors(q, o).normalize(); if (!isFinite(t.x) || t.lengthSq() < 1e-8) t.set(1, 0, 0);
      const up = Math.abs(t.y) < 0.9 ? this._n.set(0, 1, 0) : this._n.set(1, 0, 0);
      const bn = this._b.crossVectors(t, up).normalize(); const nn = up.crossVectors(bn, t).normalize();
      for (let j = 0; j <= R; j++) {
        const a = j / R * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), ix = (i * (R + 1) + j) * 3;
        const nx = nn.x * cs + bn.x * sn, ny = nn.y * cs + bn.y * sn, nz = nn.z * cs + bn.z * sn;
        this.nrm[ix] = nx; this.nrm[ix + 1] = ny; this.nrm[ix + 2] = nz;
        this.pos[ix] = p.x + nx * r; this.pos[ix + 1] = p.y + ny * r; this.pos[ix + 2] = p.z + nz * r;
      }
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true;
    return pts;
  }
}

// ---------------- builders ----------------
// each returns { pieces, strings?, tick? } in face coords
export const BUILDERS = {
  // title page: a miniature evidence board with a magnifying glass in front of it
  titleBoard() {
    const pieces = [];
    const bw = 10.4, bh = 7.2;
    const board = standee(bw, bh, { color: '#a67b4c', ppu: 130, draw: (g, p, W, H) => miniBoard(g, p, W, H) });
    pieces.push(piece(board, { x: 1.8, v0: 6.2, dir: 1, H: bh, x0: 1.8, x1: 1.8 + bw, color: '#a67b4c' }));
    // magnifier: one card cut-out (brass ring printed, acetate lens in the hole), standing on the end of its handle
    const cx = 1.9, cy = 3.8, R = 1.8, r = 1.42, bx = 3.0;
    const ang = Math.atan2(0 - cy, bx - cx), hw = 0.17;
    const a1 = ang + hw, a2 = ang - hw + Math.PI * 2;
    const outer = []; for (let k = 0; k <= 64; k++) { const a = a1 + (a2 - a1) * k / 64; outer.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    outer.push([bx - 0.4, 0], [bx + 0.4, 0]);
    const hole = Array.from({ length: 64 }, (_, k) => { const a = -k / 64 * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const mw = 3.9, mh = cy + R + 0.05;
    const mag = standee(mw, mh, { pts: outer, holes: [hole], color: '#c39a4a', back: '#6b5330', ppu: 160, draw: (g, p, W, H) => {
      const Y = y => (mh - y) * p;
      // turned wooden handle
      const hg = g.createLinearGradient((bx - 0.5) * p, 0, (bx + 0.5) * p, 0); hg.addColorStop(0, '#2a160b'); hg.addColorStop(0.45, '#6b3d20'); hg.addColorStop(1, '#1d0f07');
      g.fillStyle = hg; g.fillRect(0, Y(cy - R + 0.2), W, (cy - R + 0.2) * p);
      // brass ring
      const gg = g.createLinearGradient((cx - R) * p, Y(cy + R), (cx + R) * p, Y(cy - R)); gg.addColorStop(0, '#f1d58b'); gg.addColorStop(0.4, '#a87a2f'); gg.addColorStop(0.7, '#e3bf6a'); gg.addColorStop(1, '#7d5a20');
      g.strokeStyle = gg; g.lineWidth = (R - r + 0.05) * p; g.beginPath(); g.arc(cx * p, Y(cy), ((R + r) / 2) * p, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.025 * p; g.beginPath(); g.arc(cx * p, Y(cy), (r + 0.06) * p, 0, 7); g.stroke();
      // ferrule
      g.save(); g.translate(((cx + bx) / 2 + 0.25) * p, Y(cy - R - 0.1)); g.rotate(Math.PI / 2 + ang); g.fillStyle = gg; g.fillRect(-0.36 * p, -0.25 * p, 0.72 * p, 0.5 * p); g.restore();
    } });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r + 0.02, 64), new THREE.MeshPhysicalMaterial({ color: '#eef6f2', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide }));
    lens.position.set(cx, cy, 0); mag.add(lens);
    pieces.push(piece(mag, { x: 5.6, v0: 9.4, dir: 1, H: mh, x0: 5.6 + cx - R, x1: 5.6 + cx + R, tx0: 5.6 + bx - 0.4, tx1: 5.6 + bx + 0.4, color: '#c39a4a' }));
    // the tab under the handle only
    return { pieces };
  },
  // contents: a drawer of case folders, Case I in front
  fileDrawer() {
    const pieces = []; const n = CASES.length;
    CASES.slice().reverse().forEach(([r, t, s, p], j) => {
      const k = n - 1 - j; // case index 0..9
      const open = p !== undefined, w = 10.6, h = 3.4 + k * 0.32, tabW = 1.9, tabX = 0.25 + (k % 5) * 2.05;
      const col = open ? '#d7b87f' : '#bfae8c';
      const pts = [[0, 0], [w, 0], [w, h], [tabX + tabW + 0.25, h], [tabX + tabW, h + 0.62], [tabX, h + 0.62], [tabX - 0.25, h], [0, h]];
      const sd = standee(w, h + 0.62, { pts, color: col, ppu: 120, draw: (g, q, W, H) => {
        const Y = v => (h + 0.62 - v) * q;
        g.fillStyle = open ? T.accent : C.ink; g.globalAlpha = open ? 1 : 0.55;
        g.font = `400 ${0.3 * q}px ${DISPLAY}`; g.textAlign = 'left'; g.fillText(`CASE ${r}`, (tabX + 0.2) * q, Y(h + 0.2));
        g.globalAlpha = 1; g.fillStyle = C.ink; g.font = `700 ${0.62 * q}px ${TITLE}`; g.fillText(t, 0.5 * q, Y(h - 0.95));
        g.font = `400 ${0.3 * q}px ${SERIF}`; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(s, 0.5 * q, Y(h - 1.45));
        g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 0.02 * q; for (let y = 0.45; y < h - 1.9; y += 0.42) { g.beginPath(); g.moveTo(0.5 * q, Y(y)); g.lineTo((w - 0.5) * q, Y(y)); g.stroke(); }
        g.save(); g.translate((w - 2.0) * q, Y(h - 1.0)); g.rotate(-0.12); g.font = `400 ${0.36 * q}px ${DISPLAY}`; g.textAlign = 'center';
        g.strokeStyle = open ? '#a3271d' : 'rgba(0,0,0,.45)'; g.lineWidth = 0.04 * q; g.strokeRect(-1.3 * q, -0.45 * q, 2.6 * q, 0.62 * q); g.fillStyle = g.strokeStyle;
        g.fillText(open ? 'OPEN' : 'PENDING', 0, 0); g.restore();
      } });
      pieces.push(piece(sd, { x: 1.7, v0: 1.6 + j * 0.62, dir: 1, H: h + 0.62, x0: 1.7, x1: 1.7 + w, color: col }));
    });
    return { pieces };
  },
  // Case I, left page: the four PEAS cards
  peas() {
    const pieces = [];
    const cards = [['P', 'performance', 'safety, time'], ['E', 'environment', 'roads, traffic'], ['A', 'actuators', 'steering, brakes'], ['S', 'sensors', 'cameras, radar']];
    cards.forEach(([L, w1, w2], i) => {
      const sd = standee(2.7, 3.6, { color: '#f3ead6', ppu: 170, draw: (g, p, W, H) => {
        g.strokeStyle = 'rgba(163,39,29,.55)'; g.lineWidth = 0.02 * p; g.beginPath(); g.moveTo(0, 0.7 * p); g.lineTo(W, 0.7 * p); g.stroke(); g.strokeStyle = 'rgba(60,90,160,.25)'; for (let y = 1.1; y < 3.6; y += 0.36) { g.beginPath(); g.moveTo(0, y * p); g.lineTo(W, y * p); g.stroke(); }
        g.fillStyle = i % 2 ? T.accent2 : T.accent; g.font = `700 ${1.5 * p}px ${TITLE}`; g.textAlign = 'center'; g.fillText(L, W / 2, 2.15 * p);
        g.fillStyle = C.ink; g.font = `${B} ${0.27 * p}px ${SERIF}`; g.fillText(w1.toUpperCase(), W / 2, 2.75 * p);
        g.fillStyle = 'rgba(0,0,0,.6)'; g.font = `400 ${0.38 * p}px ${HAND}`; g.fillText(w2, W / 2, 3.25 * p);
      } });
      const x = 0.9 + i * 3.1; const pc = piece(sd, { x, v0: 4.4 - (i % 2) * 0.25, dir: -1, H: 3.6, x0: x, x1: x + 2.7, color: '#f3ead6' });
      pc.hinge.rotation.y = (i - 1.5) * 0.035; pieces.push(pc);
    });
    return { pieces };
  },
  // Case I, right page: the environment (a city skyline) behind, the agent (a paper box machine) in front, percept and action arrows
  agentLoop() {
    const pieces = []; const F = FIG11;
    const ew = F.env.x1 - F.env.x0; const r = rng(7);
    const sky = [[0, 0]]; let x = 0; const blds = [];
    while (x < ew - 0.01) { const bw = Math.min(ew - x, 0.9 + r() * 1.4), bh = 3.2 + r() * 2.5; sky.push([x, bh], [x + bw, bh]); blds.push([x, x + bw, bh]); x += bw; }
    sky.push([ew, 0]);
    const SH = 5.8;
    const env = standee(ew, SH, { pts: sky, color: '#6a7389', back: '#4a5163', ppu: 120, draw: (g, p, W, H) => {
      blds.forEach(([x0, x1, bh], i) => {
        g.fillStyle = i % 2 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.06)'; g.fillRect(x0 * p, (SH - bh) * p, (x1 - x0) * p, bh * p);
        for (let yy = 0.9; yy < bh - 0.3; yy += 0.55) for (let xx = x0 + 0.2; xx < x1 - 0.25; xx += 0.42) {
          const lit = r() < 0.28; g.fillStyle = lit ? '#f4c36a' : 'rgba(0,0,0,.35)'; g.fillRect(xx * p, (SH - yy) * p, 0.2 * p, 0.28 * p);
        }
      });
      g.fillStyle = '#efe3c8'; g.fillRect(0, (SH - 0.62) * p, W, 0.62 * p);
      g.fillStyle = '#241c14'; g.font = `400 ${0.36 * p}px ${DISPLAY}`; g.textAlign = 'center'; g.letterSpacing = 0.12 * p + 'px'; g.fillText('ENVIRONMENT', W / 2, (SH - 0.17) * p); g.letterSpacing = '0px';
    } });
    pieces.push(piece(env, { x: F.env.x0, v0: F.env.v1, dir: -1, H: SH, x0: F.env.x0, x1: F.env.x1, color: '#6a7389' }));
    // arrows: card cut-outs standing between the city and the machine
    const arrowCard = (label, col, down, x0) => {
      const w = 2.5, h = 3.3; const pts = [[0.55, 0], [1.95, 0], [1.95, 0.55], [w, 0.55], [w, h], [0, h], [0, 0.55], [0.55, 0.55]];
      const sd = standee(w, h, { pts, color: '#efe3c8', ppu: 170, draw: (g, p, W, H) => {
        const Y = y => (h - y) * p; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 0.16 * p; g.lineCap = 'round';
        const a = down ? [0.6, 2.9] : [1.9, 1.1], b = down ? [1.9, 1.1] : [0.6, 2.9];
        g.beginPath(); g.moveTo(a[0] * p, Y(a[1])); g.quadraticCurveTo((down ? 2.0 : 0.5) * p, Y(2.9), b[0] * p, Y(b[1]) + (down ? -0.15 : 0.15) * p); g.stroke();
        const ang = down ? Math.PI / 2 : -Math.PI / 2; g.beginPath(); g.moveTo(b[0] * p + Math.cos(ang) * 0.32 * p, Y(b[1]) + Math.sin(ang) * 0.32 * p);
        g.lineTo(b[0] * p + Math.cos(ang + 2.4) * 0.32 * p, Y(b[1]) + Math.sin(ang + 2.4) * 0.32 * p); g.lineTo(b[0] * p + Math.cos(ang - 2.4) * 0.32 * p, Y(b[1]) + Math.sin(ang - 2.4) * 0.32 * p); g.fill();
        g.font = `${B} ${0.3 * p}px ${SERIF}`; g.textAlign = 'center'; g.fillText(label, W / 2, Y(0.85));
      } });
      return piece(sd, { x: x0, v0: 7.7, dir: -1, H: h, x0, x1: x0 + w, tx0: x0 + 0.55, tx1: x0 + 1.95, color: '#efe3c8' });
    };
    pieces.push(arrowCard('percepts', T.accent, true, 10.15), arrowCard('actions', T.accent2, false, 1.35));
    // the agent: a parallel-fold box (back, top and front panels) that collapses flat toward the head of the page
    const aw = F.agent.x1 - F.agent.x0, ad = F.agent.v1 - F.agent.v0, ah = 2.4, body = '#46608f';
    const inside = '#cfc3a6'; // the unprinted reverse of the card
    const front = standee(aw, ah, { color: body, back: inside, ppu: 150, draw: (g, p, W, H) => {
      g.fillStyle = '#efe3c8'; g.font = `400 ${0.42 * p}px ${DISPLAY}`; g.textAlign = 'center'; g.letterSpacing = 0.14 * p + 'px'; g.fillText('AGENT', W / 2, 0.66 * p); g.letterSpacing = '0px';
      g.strokeStyle = '#efe3c8'; g.lineWidth = 0.05 * p; g.beginPath(); g.arc(W / 2, 1.6 * p, 0.6 * p, Math.PI * 0.85, Math.PI * 2.15); g.stroke();
      for (let k = 0; k <= 6; k++) { const a = Math.PI * (0.85 + k * 1.3 / 6); g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * 0.48 * p, 1.6 * p + Math.sin(a) * 0.48 * p); g.lineTo(W / 2 + Math.cos(a) * 0.6 * p, 1.6 * p + Math.sin(a) * 0.6 * p); g.stroke(); }
      g.strokeStyle = T.accent; g.lineWidth = 0.06 * p; g.beginPath(); g.moveTo(W / 2, 1.6 * p); g.lineTo(W / 2 + 0.4 * p, 1.24 * p); g.stroke();
      g.fillStyle = 'rgba(239,227,200,.6)'; g.font = `400 ${0.24 * p}px ${SERIF}`; g.fillText('agent program', W / 2, 2.38 * p);
      for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0.3 * p, (1.0 + k * 0.28) * p, 1.0 * p, 0.08 * p); g.fillRect(W - 1.3 * p, (1.0 + k * 0.28) * p, 1.0 * p, 0.08 * p); }
    } });
    const backP = standee(aw, ah, { color: inside, back: shade(body, -0.04), ppu: 40 });
    const topP = standee(aw, ad, { color: shade(body, 0.04), back: inside, ppu: 60, draw: (g, p, W, H) => { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.03 * p; g.strokeRect(0.25 * p, 0.25 * p, W - 0.5 * p, H - 0.5 * p); } });
    // a paper dish and mast standing on the top panel, facing the city
    const dish = standee(1.7, 1.75, { pts: [[0.75, 0], [0.95, 0], [0.95, 0.75], [1.62, 1.2], [1.6, 1.42], [1.2, 1.7], [0.5, 1.75], [0.1, 1.5], [0.05, 1.3], [0.75, 0.75]], color: '#efe3c8', ppu: 170, draw: (g, p, W, H) => {
      g.strokeStyle = 'rgba(36,28,20,.5)'; g.lineWidth = 0.03 * p; g.beginPath(); g.moveTo(0.2 * p, (1.75 - 1.4) * p); g.quadraticCurveTo(0.85 * p, (1.75 - 0.95) * p, 1.5 * p, (1.75 - 1.32) * p); g.stroke();
      g.fillStyle = T.accent; g.beginPath(); g.arc(0.85 * p, (1.75 - 1.62) * p, 0.07 * p, 0, 7); g.fill();
    } });
    const box = new THREE.Group(); const bx0 = F.agent.x0;
    const bHinge = new THREE.Group(), fHinge = new THREE.Group(), topG = new THREE.Group(), dishHinge = new THREE.Group();
    bHinge.position.set(bx0, 0, F.agent.v0); fHinge.position.set(bx0, 0, F.agent.v1); box.add(bHinge, fHinge, topG);
    bHinge.add(backP); fHinge.add(front);
    topP.rotation.x = -Math.PI / 2; topP.position.set(0, 0, ad); topG.add(topP); // top panel lies in xz, spans z ∈ [0, ad] from its back edge
    dishHinge.position.set(aw * 0.62, CARD, ad * 0.74); topG.add(dishHinge); dishHinge.add(dish); dish.position.x = -0.85;
    shadowy(box);
    // flat, it is three cards deep: back panel, then the top panel on it, then the dish; the front panel lies in its own strip
    const pc = { hinge: box, fold: new THREE.Group(), dir: -1, H: ah + 1.75, x0: bx0, x1: bx0 + aw, v0: F.agent.v1, lo: F.agent.v0 - ah, hi: F.agent.v1, layer: 0, span: 3 };
    pc.custom = phi => { // panels lean back by (π/2 − φ); the top stays level
      const lean = -(Math.PI / 2 - phi), s = Math.sin(phi), c = Math.cos(phi), U = (CARD + 0.0015) * (1 - s), L = pc.layer * U;
      bHinge.rotation.x = lean; fHinge.rotation.x = lean; bHinge.position.y = CARD / 2 + 0.0008 + L; fHinge.position.y = CARD / 2 + 0.0008 + L + U;
      topG.position.set(bx0, ah * s + CARD / 2 + 0.0008 + L + U, F.agent.v0 - ah * c);
      dishHinge.rotation.x = lean;
    };
    // glue tabs for the two panels
    for (const v of [F.agent.v0, F.agent.v1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(aw, 0.42), tabPaper(body)); t.rotation.x = -Math.PI / 2; t.position.set(bx0 + aw / 2, 0.0012, v + 0.21); t.receiveShadow = true; box.add(t); }
    pieces.push(pc);
    return { pieces };
  },
  graphH() { return graphPopup(true); },
  graphA() { return graphPopup(false); },
  // Case III: the objective function as a tunnel of card ridges, each a slice f(x, v) at fixed v
  hills() {
    const pieces = [];
    const K = 0.6, base = 0.15, x0 = 0.7, x1 = 13.3;
    const slices = [2.6, 3.8, 5.0, 6.2, 7.4, 8.8, 10.0, 11.2, 12.0, 12.8, 14.0, 15.2];
    const Hf = (x, v) => base + K * fHill(x, v);
    const near = (path, v) => path.filter(([, pv]) => Math.abs(pv - v) <= 0.62);
    const sumL = HILL.local.path[HILL.local.path.length - 1], sumG = HILL.global.path[HILL.global.path.length - 1];
    slices.forEach((v, i) => {
      const pts = [[0, 0]]; for (let k = 0; k <= 120; k++) { const x = x0 + (x1 - x0) * k / 120; pts.push([x - x0, Hf(x, v)]); }
      // a summit flag cut from the same card where a climber stops
      const flagFor = [[sumG, T.accent, 'B · 10.3'], [sumL, T.accent2, 'A · 6.9']].find(([s]) => Math.abs(s[1] - v) < 0.3);
      let flag = null;
      if (flagFor) {
        const [[sx, sv], col] = flagFor; const fx = sx - x0, fy = Hf(sx, v);
        flag = { fx, fy, col, label: flagFor[2] };
        // insert a pole and flag into the silhouette at fx
        const at = pts.findIndex(([px]) => px > fx - 0.05);
        pts.splice(at, 0, [fx - 0.05, fy], [fx - 0.05, fy + 1.5], [fx + 1.55, fy + 1.5], [fx + 1.55, fy + 0.95], [fx + 0.05, fy + 0.95], [fx + 0.05, fy]);
      }
      pts.push([x1 - x0, 0]);
      const top = Math.max(...pts.map(p => p[1])) + 0.02, t = i / (slices.length - 1);
      const col = '#' + new THREE.Color('#6e5236').lerp(new THREE.Color('#efe3c8'), t).getHexString();
      const marks = [...near(HILL.local.path, v).map(p => [p, T.accent2]), ...near(HILL.global.path, v).map(p => [p, T.accent])];
      const sd = standee(x1 - x0, top, { pts, color: col, ppu: 95, draw: (g, p, W, Hh) => {
        g.strokeStyle = 'rgba(36,28,20,.2)'; g.lineWidth = 0.02 * p;
        for (let lv = 1; lv <= 10; lv++) { const y = base + K * lv; if (y > top) break; g.beginPath(); g.moveTo(0, (top - y) * p); g.lineTo(W, (top - y) * p); g.stroke(); }
        for (const [[px, pv], c] of marks) { g.fillStyle = c; g.beginPath(); g.arc((px - x0) * p, (top - Hf(px, v) + 0.2) * p, 0.11 * p, 0, 7); g.fill(); }
        if (flag) { g.fillStyle = flag.col; g.fillRect((flag.fx + 0.05) * p, (top - flag.fy - 1.5) * p, 1.5 * p, 0.55 * p); g.fillStyle = '#fff'; g.font = `${B} ${0.3 * p}px ${SERIF}`; g.textBaseline = 'middle'; g.fillText(flag.label, (flag.fx + 0.17) * p, (top - flag.fy - 1.22) * p); g.fillStyle = '#3a2a1a'; g.fillRect((flag.fx - 0.05) * p, (top - flag.fy - 1.5) * p, 0.1 * p, 1.5 * p); }
      } });
      pieces.push(piece(sd, { x: x0, v0: v, dir: -1, H: top, x0, x1, color: col }));
    });
    return { pieces };
  },
};

// the search graph as card posts with flags; twine between them, cost tags on the twine, and the red A* path
function graphPopup(heur) {
  const pieces = [], strings = [], tags = [];
  const PHt = n => heur ? 1.0 + n.h * 0.42 : 3.0;
  const shown = n => heur || A_ORDER[n.id] || A_FRONTIER[n.id];
  const tips = {};
  for (const n of G.nodes) {
    if (!shown(n)) continue;
    let col = '#e7d6b3', fc = C.white, label = n.id, sub = `h ${n.h.toFixed(1)}`;
    if (n.id === 'S') col = T.accent2; if (n.id === 'G') col = T.accent;
    if (!heur) {
      const o = A_ORDER[n.id]; if (o) { fc = '#e6c27a'; label = `${o.k} · ${n.id}`; sub = `f ${o.f.toFixed(1)}`; col = n.id === 'G' ? T.accent : n.id === 'S' ? T.accent2 : T.ochre; }
      else { sub = `f ${A_FRONTIER[n.id].f.toFixed(1)}`; col = '#e7d6b3'; }
    }
    const h = PHt(n), pw = 0.3, fw = 1.42, fh = 0.8;
    // post + flag as one cut-out: the post is a strip, the flag hangs off its right side just below the top
    const pts = [[0, 0], [pw, 0], [pw, h - fh - 0.12], [pw + fw, h - fh - 0.12], [pw + fw, h - 0.12], [pw, h - 0.12], [pw, h], [0, h]];
    const sd = standee(pw + fw, h, { pts, color: col, ppu: 220, draw: (g, p, W, H) => {
      const Y = y => (h - y) * p;
      g.fillStyle = fc; g.fillRect(pw * p, Y(h - 0.12), fw * p, fh * p);
      // two lines, each fitted to the flag: the name (and A* order) above, the number below
      g.fillStyle = C.ink; g.textBaseline = 'alphabetic'; const room = (fw - 0.24) * p;
      const fit = (str, wt, size) => { g.font = `${wt} ${size * p}px ${SERIF}`; const k = Math.min(1, room / g.measureText(str).width); g.font = `${wt} ${size * k * p}px ${SERIF}`; };
      fit(label, B, 0.32); g.fillText(label, (pw + 0.12) * p, Y(h - 0.12 - 0.36));
      fit(sub, 400, 0.24); g.fillStyle = 'rgba(31,23,17,.85)'; g.fillText(sub, (pw + 0.12) * p, Y(h - 0.12 - 0.66));
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, Y(h), pw * p, 0.14 * p);
    } });
    sd.position.x = -pw / 2;
    const pc = piece(sd, { x: n.x, v0: n.v, dir: -1, H: h, x0: n.x - pw / 2, x1: n.x - pw / 2 + pw + fw, color: col });
    const tip = new THREE.Object3D(); tip.position.set(0, h - 0.05, 0.05); pc.fold.add(tip); tips[n.id] = { tip, pc };
    pieces.push(pc);
  }
  // twine between post tops
  for (const [a, b, c] of G.edges) {
    if (!tips[a] || !tips[b]) continue;
    const s = new SlackString([tips[a].tip, tips[b].tip], { r: 0.022, color: T.twine, extra: 1.035 }); s.ends = [tips[a], tips[b]]; strings.push(s);
    if (heur) { // a cost tag hanging from the middle of the twine
      const tg = standee(0.5, 0.42, { color: '#d7b87f', ppu: 240, draw: (g, p, W, H) => { g.fillStyle = T.accent; g.font = `${B} ${0.3 * p}px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(c), W / 2, H / 2 + 0.02 * p); } });
      tg.position.set(-0.25, -0.47, 0); const holder = new THREE.Group(); holder.add(tg); tags.push({ holder, s, h: 0.47 });
    }
  }
  if (!heur) {
    const path = G.astar.path.map(id => { const o = new THREE.Object3D(); o.position.set(0, PHt(G.by[id]) - 0.22, 0.07); tips[id].pc.fold.add(o); return o; });
    const red = new SlackString(path, { r: 0.05, color: T.string, extra: 1.02 }); strings.push(red);
  }
  return { pieces, strings, tags };
}

// a tiny evidence board printed on the title-page panel
function miniBoard(g, p, W, H) {
  const r = rng(3);
  for (let k = 0; k < 4200; k++) { g.fillStyle = r() > 0.5 ? 'rgba(60,35,15,.25)' : 'rgba(255,230,190,.12)'; g.fillRect(r() * W, r() * H, 2, 2); }
  g.strokeStyle = '#3a2416'; g.lineWidth = 0.35 * p; g.strokeRect(0, 0, W, H);
  const cards = [[1.1, 1.0, 2.4, 1.6, '?', 'what is intelligence'], [6.2, 0.8, 2.6, 1.7, 'agent', 'perceive · act'], [3.6, 3.4, 2.6, 1.7, 'search', 'follow the trail'], [7.3, 4.2, 2.3, 1.6, 'learn', 'from evidence'], [0.9, 4.6, 2.2, 1.5, 'reason', 'under doubt']];
  const pins = [];
  cards.forEach(([x, y, w, h, t, s], i) => {
    g.save(); g.translate((x + w / 2) * p, (y + h / 2) * p); g.rotate((r() - 0.5) * 0.16);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect((-w / 2 + 0.08) * p, (-h / 2 + 0.1) * p, w * p, h * p);
    g.fillStyle = i === 0 ? '#f3ead6' : '#efe3c8'; g.fillRect(-w / 2 * p, -h / 2 * p, w * p, h * p);
    g.fillStyle = i === 0 ? T.accent : C.ink; g.textAlign = 'center'; g.font = `${i === 0 ? 700 : 400} ${(i === 0 ? 0.9 : 0.44) * p}px ${i === 0 ? TITLE : DISPLAY}`; g.fillText(t, 0, (i === 0 ? 0.25 : 0.05) * p);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.font = `400 ${0.3 * p}px ${HAND}`; g.fillText(s, 0, (h / 2 - 0.25) * p);
    g.restore(); pins.push([(x + w / 2) * p, (y + 0.15) * p]);
  });
  g.strokeStyle = T.string; g.lineWidth = 0.06 * p; g.lineCap = 'round';
  for (const [a, b] of [[0, 1], [0, 2], [2, 3], [0, 4], [4, 2], [1, 3]]) { g.beginPath(); g.moveTo(...pins[a]); const mx = (pins[a][0] + pins[b][0]) / 2, my = (pins[a][1] + pins[b][1]) / 2 + 0.3 * p; g.quadraticCurveTo(mx, my, ...pins[b]); g.stroke(); }
  for (const [x, y] of pins) { g.fillStyle = T.accent; g.beginPath(); g.arc(x, y, 0.13 * p, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 0.04 * p, y - 0.04 * p, 0.04 * p, 0, 7); g.fill(); }
}
