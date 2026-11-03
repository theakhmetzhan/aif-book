// The physical book: cloth boards, stiff card pages that turn rigidly about the spine, a cloth spine that flexes with the covers,
// and the pop-ups glued to the pages. Each spread's pop-ups fold with the angle between its two pages and are kept inside their
// half of the wedge between those pages, so paper never passes through paper.
import * as THREE from 'three';
import { FACES, SHEETS } from './pages.js';
import { BUILDERS, setPieceFold, CARD } from './popups.js';
import { T } from './theme.js';
import { clothFill, goldGradient } from './paper.js';
import { Page } from './typeset.js';

export const PW = 14, PH = 20, BW = 14.3, BH = 20.6, BT = 0.2, ST = 0.13;
const N = SHEETS.length, NI = N - 2;
const HINGE = 0; // boards hinge at the spine edge of the block and overhang it by a square elsewhere
export const G0 = 0.07; // pages start this far from the hinge axis, so a turning page's corners never enter either stack
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const turnEase = t => t - Math.sin(2 * Math.PI * t) / (2 * Math.PI); // eases in and out of each turn
const smin = (a, b, k = 0.07) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));

export function faceTexture(name, renderer, extra, mobile) {
  const f = FACES[name]; const board = f.kind === 'board';
  const w = board ? BW : PW, h = board ? BH : PH;
  const TW = mobile ? 1100 : 1700; const S = TW / w;
  const c = document.createElement('canvas'); c.width = TW; c.height = Math.round(h * S);
  Page.sink = []; try { f.draw(c.getContext('2d'), S, c.width, c.height, extra); } finally { f.read = Page.sink; Page.sink = null; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  let metal = null;
  if (f.gold) { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; f.gold(m.getContext('2d'), S, m.width, m.height); metal = new THREE.CanvasTexture(m); }
  return { map: t, metal, canvas: c };
}

// a flat page face lying in the sheet's xz-plane; x ∈ [0, PW] from the spine, UVs so the print reads correctly on either side
function faceMesh(map, back, y) {
  const g = new THREE.PlaneGeometry(PW, PH, 1, 1); g.rotateX(back ? Math.PI / 2 : -Math.PI / 2); g.translate(G0 + PW / 2, y, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) - G0, z = p.getZ(i); uv.setXY(i, back ? 1 - x / PW : x / PW, 1 - (z + PH / 2) / PH); }
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0 })); m.receiveShadow = true; m.castShadow = true; return m;
}

export class Book {
  constructor(scene, renderer, { qr, mobile = false } = {}) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.sheets = []; this.faces = [];
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const edgeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(T.paper).multiplyScalar(0.86), roughness: 0.95 });
    const sideMat = new THREE.MeshStandardMaterial({ color: T.clothSide, roughness: 0.8 });

    SHEETS.forEach(([front, back, kind], i) => {
      const isBoard = kind === 'board';
      const ft = faceTexture(front, renderer, { qr }, mobile), bt = faceTexture(back, renderer, { qr }, mobile);
      const pivot = new THREE.Group(); this.group.add(pivot);
      const s = { i, front, back, isBoard, pivot, t: 0, theta: 0 };
      if (isBoard) {
        const cloth = (tx) => {
          const m = new THREE.MeshPhysicalMaterial({ map: tx.map, roughness: 0.78, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#7a3a30') });
          if (tx.metal) { m.metalness = 1; m.metalnessMap = tx.metal; m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.82, 0.32, texture2D(metalnessMap, vMetalnessMapUv).g);'); }; }
          return m;
        };
        const paperFace = tx => new THREE.MeshStandardMaterial({ map: tx.map, roughness: 0.9 });
        const geo = new THREE.BoxGeometry(BW, BT, BH, 1, 1, 1);
        const uv = geo.attributes.uv; for (let k = 12; k < 16; k++) { uv.setX(k, 1 - uv.getX(k)); uv.setY(k, 1 - uv.getY(k)); } uv.needsUpdate = true;
        // +y face = front, -y face = back. Cover: front is cloth; back cover board: front is the endpaper, back is cloth.
        const top = i === 0 ? cloth(ft) : paperFace(ft), bot = i === 0 ? paperFace(bt) : cloth(bt);
        const mesh = new THREE.Mesh(geo, [sideMat, sideMat, top, bot, sideMat, sideMat]);
        // each board turns about the spine corner of its inner (endpaper) face, so its outer corner swings away from the block
        const inner = i === 0 ? 'bot' : 'top';
        mesh.position.set(BW / 2 - HINGE, inner === 'bot' ? BT / 2 : -BT / 2, 0); mesh.castShadow = mesh.receiveShadow = true; pivot.add(mesh);
        s.mesh = mesh; if (inner === 'bot') { s.top = BT; s.bot = 0; } else { s.top = 0; s.bot = -BT; }
      } else {
        pivot.add(faceMesh(ft.map, false, ST / 2), faceMesh(bt.map, true, -ST / 2));
        const edge = new THREE.Mesh(new THREE.BoxGeometry(PW, ST, PH), [edgeMat, edgeMat, hidden, hidden, edgeMat, edgeMat]); edge.position.x = G0 + PW / 2; edge.castShadow = edge.receiveShadow = true; pivot.add(edge);
        s.top = ST / 2; s.bot = -ST / 2;
      }
      // pop-ups glued to either face of this sheet
      for (const [name, side] of [[front, 'front'], [back, 'back']]) {
        const b = FACES[name].popup; if (!b) continue;
        const built = BUILDERS[b]();
        const root = new THREE.Group(); root.userData.faceRoot = true; pivot.add(root);
        if (side === 'front') root.position.set(G0, s.top, -PH / 2);
        else { root.rotation.z = Math.PI; root.position.set(G0 + PW, s.bot, -PH / 2); }
        for (const pc of built.pieces) root.add(pc.hinge);
        for (const st of built.strings || []) root.add(st.mesh);
        for (const tg of built.tags || []) root.add(tg.holder);
        // flat stacking: a piece lies on top of the pieces it folds over, one card thickness higher than the highest one it overlaps
        const key = pc => (pc.dir < 0 ? pc.v0 : -pc.v0); let top = -1;
        const placed = [];
        for (const pc of built.pieces.slice().sort((a, b) => key(a) - key(b))) {
          let L = 0; for (const q of placed) if (q.x0 < pc.x1 && pc.x0 < q.x1 && q.lo < pc.hi && pc.lo < q.hi) L = Math.max(L, q.layer + q.span);
          pc.layer = L; placed.push(pc); top = Math.max(top, L + pc.span - 1);
        }
        const strR = Math.max(0, ...(built.strings || []).map(st => st.r));
        const face = { name, sheet: i, side, spread: side === 'front' ? i : i + 1, root, ...built, strings: built.strings || [], tags: built.tags || [], phase: (i * 2.399 + (side === 'front' ? 0 : 1.3)) % 6.283, cards: top + 1, flat: (top + 1) * (CARD + 0.0015) + 0.002 + 2 * strR + 0.004 };
        this.checkFlat(face);
        this.calibrateStrings(face);
        this.faces.push(face);
      }
      this.sheets.push(s);
    });

    // each spread's pop-ups fold flat between its two pages, so the gap there is as thick as the card folded inside it
    const gap = k => 0.03 + this.faces.filter(f => f.spread === k).reduce((a, f) => a + f.flat, 0);
    this.gaps = Array.from({ length: N }, (_, k) => gap(k));
    for (let i = 1; i <= NI; i++) { // inner sheets: centre heights on the right stack and on the left stack
      let r = 0; for (let j = i; j <= NI; j++) r += this.gaps[j + 1 <= N - 1 ? j + 1 : N - 1] + (j > i ? ST : 0);
      const s = this.sheets[i]; s.yR = r + ST / 2;
      let l = 0; for (let j = 1; j <= i; j++) l += this.gaps[j] + (j < i ? ST : 0);
      s.yL = l + ST / 2;
    }
    this.sheets[0].yR = this.sheets[1].yR + ST / 2 + this.gaps[1]; this.sheets[0].yL = 0;
    this.sheets[N - 1].yR = 0; this.sheets[N - 1].yL = this.sheets[NI].yL + ST / 2 + this.gaps[N - 1];
    // a shut spread holds its pop-ups folded flat: seen from the edge, that is layered card, not air
    const [lc, lg] = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 64; return [c, c.getContext('2d')]; })();
    lg.fillStyle = '#cbbd9c'; lg.fillRect(0, 0, 16, 64); for (let y = 0; y < 64; y += 4) { lg.fillStyle = 'rgba(70,50,25,.28)'; lg.fillRect(0, y, 16, 1); }
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; lt.wrapS = lt.wrapT = THREE.RepeatWrapping;
    const fillMat = new THREE.MeshStandardMaterial({ map: lt, roughness: 0.95 });
    this.fillers = [];
    for (let k = 1; k < N - 1; k++) {
      if (!this.faces.some(f => f.spread === k)) continue;
      const g = this.gaps[k] - 0.012, m = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.12, g, PH - 0.16), [fillMat, fillMat, hidden, hidden, fillMat, fillMat]);
      m.position.set(G0 + (PW - 0.12) / 2, this.sheets[k].top + 0.006 + g / 2, 0); m.castShadow = m.receiveShadow = true;
      lt.repeat.set(1, g / 0.05); this.sheets[k].pivot.add(m); this.fillers.push({ k, m });
    }
    // cloth spine, a flexible strip joining the two boards' hinge edges
    const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 256; clothFill(sc.getContext('2d'), 1024, 256, T.cloth);
    const sg = sc.getContext('2d'); sg.save(); sg.translate(512, 128); sg.fillStyle = goldGradient(sg, -300, 0, 300, 0); sg.font = '700 74px "Playfair Display", serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.letterSpacing = '14px'; sg.fillText('EVIDENCE', 0, 4); sg.restore();
    const spineTex = new THREE.CanvasTexture(sc); spineTex.colorSpace = THREE.SRGBColorSpace;
    this.spineSeg = 24;
    const sgeo = new THREE.PlaneGeometry(1, BH, this.spineSeg, 1);
    this.spine = new THREE.Mesh(sgeo, new THREE.MeshPhysicalMaterial({ map: spineTex, roughness: 0.75, side: THREE.DoubleSide, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#7a3a30') }));
    this.spine.castShadow = true; this.spine.receiveShadow = true; this.spine.frustumCulled = false; this.group.add(this.spine);
    // UVs: u runs around the spine (text reads along the spine), v along its length
    const suv = sgeo.attributes.uv; for (let k = 0; k < suv.count; k++) { const u = suv.getX(k), v = suv.getY(k); suv.setXY(k, v, u); }
    this.p = -1; this.set(0);
  }

  // warn if a folded piece would stick out of its page
  checkFlat(face) {
    for (const pc of face.pieces) {
      const lo = pc.dir < 0 ? pc.v0 - pc.H : pc.v0, hi = pc.dir < 0 ? pc.v0 : pc.v0 + pc.H;
      if (lo < -0.05 || hi > PH + 0.05) console.warn(`[book] ${face.name}: a piece folds off the page (${lo.toFixed(2)}..${hi.toFixed(2)})`);
    }
  }
  // fix each string's length from the longest chord its ends reach over the whole fold
  calibrateStrings(face) {
    if (!face.strings.length) return;
    const max = face.strings.map(s => new Array(s.anchors.length - 1).fill(0));
    for (let k = 0; k <= 24; k++) {
      const phi = Math.PI / 2 * k / 24; for (const pc of face.pieces) setPieceFold(pc, phi);
      face.strings.forEach((s, j) => { const e = this.ends(s); for (let q = 0; q < e.length - 1; q++) max[j][q] = Math.max(max[j][q], e[q].distanceTo(e[q + 1])); });
    }
    face.strings.forEach((s, j) => s.calibrate(max[j]));
  }
  // anchor positions in face coords
  ends(s) {
    if (!s._ends) s._ends = s.anchors.map(() => new THREE.Vector3());
    s.anchors.forEach((a, i) => { const v = s._ends[i].copy(a.position); for (let o = a.parent; o && !o.userData.faceRoot; o = o.parent) { o.updateMatrix(); v.applyMatrix4(o.matrix); } });
    return s._ends;
  }

  // world x of what is visible (closed front → right block, open → spine, closed back → left)
  centerX(p) { return p < 1 ? (BW / 2 - HINGE) * (1 - sstep(0, 1, p)) : p > N - 1 ? -(BW / 2 - HINGE) * sstep(N - 1, N, p) : 0; }

  // page frame in the book's xy cross-section: origin of the face plane, outward direction, face normal
  frame(sheet, side) {
    const s = this.sheets[sheet], th = s.theta, c = Math.cos(th), sn = Math.sin(th);
    const off = side === 'front' ? s.top : s.bot;
    const P = [-sn * off, s.pivot.position.y + c * off];
    const u = [c, sn], n = side === 'front' ? [-sn, c] : [sn, -c];
    return { P, u, n };
  }

  // lift > 0 raises the right-hand page's edge a little (a hint that it turns), lift < 0 the left-hand one
  set(p, time = 0, lift = 0) {
    this.p = p; const k = Math.round(p), near = Math.abs(p - k) < 0.02;
    for (const s of this.sheets) {
      const t = Math.min(1, Math.max(0, p - s.i)); s.t = t; const e = turnEase(t);
      s.theta = Math.PI * e;
      if (near && lift > 0 && s.i === k && k < N) s.theta += 0.075 * lift;
      if (near && lift < 0 && s.i === k - 1 && k >= 1) s.theta += 0.075 * lift;
      // the spine end only ever moves away from the stack the page is over: it rises while the page is still over the
      // right-hand stack, and comes down only once the page is over the left-hand one
      const slide = s.yL > s.yR ? sstep(0.02, 0.5, e) : sstep(0.5, 0.98, e);
      s.pivot.position.y = s.yR + (s.yL - s.yR) * slide; s.pivot.rotation.z = s.theta;
    }
    // pop-ups
    for (const f of this.faces) {
      const k = f.spread, L = this.sheets[k - 1], R = this.sheets[k];
      const alpha = L.theta - R.theta;
      f.root.visible = alpha > 0.02;
      if (!f.root.visible) continue;
      const me = f.side === 'front' ? this.frame(k, 'front') : this.frame(k - 1, 'back');
      const other = f.side === 'front' ? this.frame(k - 1, 'back') : this.frame(k, 'front');
      const slope = 1 - (me.n[0] * other.n[0] + me.n[1] * other.n[1]);
      const un = me.u[0] * other.n[0] + me.u[1] * other.n[1];
      const base = (me.P[0] - other.P[0]) * other.n[0] + (me.P[1] - other.P[1]) * other.n[1] - 0.02;
      const hmax = d => slope < 1e-5 ? 1e9 : (base + d * un) / slope;
      let phiMax = Math.PI / 2;
      for (const pc of f.pieces) {
        const d0 = G0 + (f.side === 'front' ? pc.x0 : PW - pc.x1), d1 = G0 + (f.side === 'front' ? pc.x1 : PW - pc.x0);
        const h = Math.min(hmax(d0), hmax(d1)) - (pc.layer + pc.span) * (CARD + 0.0015);
        phiMax = Math.min(phiMax, Math.asin(Math.min(1, Math.max(0, h / pc.H))));
      }
      const u = Math.min(1, Math.max(0, alpha / Math.PI));
      const mech = Math.PI / 2 * (1 - Math.pow(1 - u, 2.2));
      let phi = Math.max(0, smin(mech, phiMax));
      if (u > 0.999) phi = Math.min(phi, Math.PI / 2 - 0.006 * (1 + Math.sin(time * 0.6 + f.phase))); // a faint draft
      for (const pc of f.pieces) setPieceFold(pc, phi);
      const floor = f.cards * (CARD + 0.0015) * (1 - Math.sin(phi)) + 0.001;
      for (const s of f.strings) s.update(this.ends(s), floor);
      for (const tg of f.tags) hangTag(tg, floor);
    }
    for (const { k, m } of this.fillers) m.visible = this.sheets[k - 1].theta - this.sheets[k].theta <= 0.02;
    this.updateSpine(p);
  }

  updateSpine(p) {
    const open = p >= 1 && p <= N - 1; this.spine.visible = !open;
    if (open) return;
    const cov = this.sheets[0], bk = this.sheets[N - 1];
    const pt = (s, lx, ly) => { const c = Math.cos(s.theta), sn = Math.sin(s.theta); return [lx * c - ly * sn, s.pivot.position.y + lx * sn + ly * c]; };
    const dir = (s) => [-Math.cos(s.theta), -Math.sin(s.theta)];
    const A = pt(bk, 0, bk.bot), B = pt(cov, 0, cov.top), oA = dir(bk), oB = dir(cov);
    const gap = Math.hypot(B[0] - A[0], B[1] - A[1]), k = 0.66 * gap;
    const P = this.spine.geometry.attributes.position, n = this.spineSeg;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
      const x = a * A[0] + b * (A[0] + oA[0] * k) + c * (B[0] + oB[0] * k) + d * B[0];
      const y = a * A[1] + b * (A[1] + oA[1] * k) + c * (B[1] + oB[1] * k) + d * B[1];
      P.setXYZ(i, x, y, BH / 2); P.setXYZ(i + n + 1, x, y, -BH / 2);
    }
    P.needsUpdate = true; this.spine.geometry.computeVertexNormals();
  }
}

// a cost tag hangs from the middle of its string; when the string lies low it tips over instead of entering the page
const _t = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
function hangTag(tg, floor = 0) {
  const pts = tg.s.pts, m = Math.floor(pts.length / 2), p = pts[m];
  _t.subVectors(pts[m + 1], pts[m - 1]); _t.y = 0; if (_t.lengthSq() < 1e-8) _t.set(1, 0, 0); _t.normalize();
  if (_t.x < 0) _t.negate();
  const cosA = Math.min(1, Math.max(0, (p.y - floor - 0.03) / tg.h)), sinA = Math.sqrt(1 - cosA * cosA);
  const side = _z.set(-_t.z, 0, _t.x); // horizontal, perpendicular to the string, toward the reader
  if (side.z < 0) side.negate();
  _y.set(0, cosA, 0).addScaledVector(side, -sinA); // up along the tag
  _x.copy(_t); _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z); tg.holder.quaternion.setFromRotationMatrix(_m); tg.holder.position.copy(p);
}
