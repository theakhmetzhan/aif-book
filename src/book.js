// The physical book: a case of two cloth boards and a stiff spine strip joined by flexible joints, stiff card pages bound to the
// back of the block, and the pop-ups glued to the pages. The two stacks meet at the gutter, and the case rocks under them as pages
// cross: whichever stack is thinner rides up to the gutter on a board sloping down to the desk. Each spread's pop-ups fold with
// the angle between its two pages and are kept inside their half of the wedge between those pages, so paper never passes through paper.
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
const REST = 0.01; // a sheet within this angle of flat lies on its stack
const STRIP = 0.2, CROWN = 0.3, LINING = 0.07; // the spine strip stands this far off the block, is rounded this much when shut, and is this thick
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const turnEase = t => t - Math.sin(2 * Math.PI * t) / (2 * Math.PI); // eases in and out of each turn
const smin = (a, b, k = 0.07) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
// the strip's round and chord when its ends stand dy apart, of w when shut: pressed flat by the desk mid-book, its round comes back as it
// stands up, and it keeps its length, so what the round gives back widens it
const stripShape = (dy, w) => { const crown = CROWN * (dy / w) ** 2, c0 = w - 0.04, arc = c0 + 8 * CROWN * CROWN / (3 * c0); return [crown, (arc + Math.sqrt(arc * arc - 32 * crown * crown / 3)) / 2]; };

export function faceTexture(name, renderer, extra, mobile) {
  const f = FACES[name]; const board = f.kind === 'board';
  const w = board ? BW : PW, h = board ? BH : PH;
  const TW = mobile ? 1100 : 1700; const S = TW / w;
  const c = document.createElement('canvas'); c.width = TW; c.height = Math.round(h * S);
  Page.sink = []; try { f.draw(c.getContext('2d'), S, c.width, c.height, extra); } finally { f.read = Page.sink; Page.sink = null; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  let metal = null;
  if (f.gold) { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; f.gold(m.getContext('2d'), S, m.width, m.height); metal = new THREE.CanvasTexture(m); metal.anisotropy = t.anisotropy; }
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
          // foil: part metal so its gold base still shows in a dark room (full metal mirrors the black ceiling), pressed into the cloth
          if (tx.metal) { m.metalness = 0.6; m.metalnessMap = tx.metal; m.bumpMap = tx.metal; m.bumpScale = -1; m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.82, 0.32, texture2D(metalnessMap, vMetalnessMapUv).g);'); }; }
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
    // how much each sheet adds to the stack it lies on: its card, and the pop-ups folded under it
    for (const s of this.sheets) { const card = s.isBoard ? 0 : ST; s.addR = card + (this.gaps[s.i + 1] ?? 0); s.addL = card + (s.i ? this.gaps[s.i] : 0); }
    this.W = this.sheets[0].yR; // the strip spans the shut block; the case keeps this length open
    // a shut spread holds its pop-ups folded flat: seen from the edge, that is layered card, not air
    const [lc, lg] = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 64; return [c, c.getContext('2d')]; })();
    lg.fillStyle = '#cbbd9c'; lg.fillRect(0, 0, 16, 64); for (let y = 0; y < 64; y += 4) { lg.fillStyle = 'rgba(70,50,25,.28)'; lg.fillRect(0, y, 16, 1); }
    const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; lt.wrapS = lt.wrapT = THREE.RepeatWrapping;
    const fillMat = new THREE.MeshStandardMaterial({ map: lt, color: '#a2957f', roughness: 0.95 }); // in the shade between the leaves, so it never reads as page thickness
    this.fillers = [];
    // flush with the page edges and just overlapping both pages: an inset or a slit leaves lit paper thinner than a pixel,
    // which shimmers along the block whenever the view moves
    for (let k = 1; k < N; k++) {
      const pop = this.faces.some(f => f.spread === k), mat = fillMat;
      const g = this.gaps[k] + 0.002, m = new THREE.Mesh(new THREE.BoxGeometry(PW, g, PH), [mat, mat, hidden, hidden, mat, mat]);
      m.position.x = G0 + PW / 2; m.castShadow = m.receiveShadow = true;
      if (pop) lt.repeat.set(1, g / 0.05);
      this.sheets[k].pivot.add(m); this.fillers.push({ k, m, g: this.gaps[k] });
    }
    // the back of the block, one glued band through every sheet's spine end and on to both boards: it folds at the open spread
    // like a tent over the strip, and bridges to the board as the endpaper's hinge at the first and last spreads
    this.backSeg = N - 1;
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(1, PH, this.backSeg, 1), new THREE.MeshStandardMaterial({ color: T.endpaper[0], roughness: 0.95, side: THREE.DoubleSide }));
    this.back.castShadow = this.back.receiveShadow = true; this.back.frustumCulled = false; this.group.add(this.back);
    this.events = {}; // events.sheet({ type: 'lift' | 'land', sheet, board }) as a sheet leaves or reaches a stack
    // the cloth of the spine: a stiff strip between the boards, the joints either side of it flexing as they swing
    const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 256; clothFill(sc.getContext('2d'), 1024, 256, T.cloth);
    const sg = sc.getContext('2d'); sg.save(); sg.translate(512, 128); sg.fillStyle = goldGradient(sg, -300, 0, 300, 0); sg.font = '700 74px "Playfair Display", serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.letterSpacing = '14px'; sg.fillText('EVIDENCE', 0, 4); sg.restore();
    const spineTex = new THREE.CanvasTexture(sc); spineTex.colorSpace = THREE.SRGBColorSpace;
    // one section swept along the spine: the cloth outside (joint, strip, joint), then back along the lining inside, closed at head and tail
    this.spineSeg = 28;
    const n = this.spineSeg, ring = 2 * (n + 1), pos = new Float32Array(ring * 2 * 3), uvs = new Float32Array(ring * 2 * 2), idx = [];
    for (let i = 0; i < ring; i++) for (let e = 0; e < 2; e++) { const j = (i * 2 + e) * 2, t = i <= n ? i / n : (ring - 1 - i) / n; uvs[j] = 1 - e; uvs[j + 1] = t; }
    for (let i = 0; i < ring; i++) { const a = i * 2, b = ((i + 1) % ring) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    for (let i = 1; i <= n; i++) for (const e of [0, 1]) { const a = (ring - 1 - i) * 2 + e, b = (ring - i) * 2 + e, c = (i - 1) * 2 + e, d = i * 2 + e; idx.push(...(e ? [a, b, c, a, c, d] : [a, c, b, a, d, c])); } // head and tail
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sgeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); sgeo.setIndex(idx); sgeo.addGroup(0, 6 * n, 0); sgeo.addGroup(6 * n, idx.length - 6 * n, 1); // the cloth outside, the lining and cut ends
    this.spine = new THREE.Mesh(sgeo, [new THREE.MeshPhysicalMaterial({ map: spineTex, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color('#7a3a30') }), sideMat]);
    this.spine.castShadow = true; this.spine.receiveShadow = true; this.spine.frustumCulled = false; this.group.add(this.spine);
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

  // pages do not lift on hover (a third, hover argument is ignored): a lifted page opens a wedge in the block and squeezes
  // the pop-ups on the facing page flat
  set(p, time = 0) {
    this.p = p; let L = 0, R = 0;
    for (const s of this.sheets) { s.t = Math.min(1, Math.max(0, p - s.i)); s.e = turnEase(s.t); L += s.e * s.addL; R += (1 - s.e) * s.addR; }
    // the two stacks meet at the gutter, as high as the thicker one. The thinner side's board climbs to it from the desk, so it
    // slopes (sL, sR), and the strip between the boards leans over: upright against the block near the covers, flat under it mid-book.
    const gy = (L + R + Math.hypot(L - R, 0.15)) / 2; let d = 0, sL = 0, sR = 0, cL = 1, cR = 1, bl = 0, br = 0;
    for (let i = 0; i < 4; i++) { // the boards part by what the strip's lean frees, the lighter side sliding most
      bl = d * R / (L + R); br = d * L / (L + R); sL = (gy - L) / (BW + bl); sR = (gy - R) / (BW + br); cL = Math.sqrt(1 - sL * sL); cR = Math.sqrt(1 - sR * sR);
      const dy = (R * cR + br * sR) - (L * cL + bl * sL), w = stripShape(dy, this.W)[1] + 0.04; d = Math.sqrt(Math.max(0, w * w - dy * dy));
    }
    const tL = Math.asin(sL), tR = Math.asin(sR), span = Math.PI + tL + tR;
    // a sheet's slot on a stack: its height above that board, sheared toward the gutter so the stack's back runs from the board's hinge to the gutter
    const onLeft = h => { const u = Math.min(1, h / Math.max(1e-6, L - ST / 2)), x = -bl * (1 - u), y = h - L; return [x * cL - y * sL, gy + x * sL + y * cL]; };
    const onRight = h => { const u = Math.min(1, h / Math.max(1e-6, R - ST / 2)), x = br * (1 - u), y = h - R; return [x * cR + y * sR, gy - x * sR + y * cR]; };
    for (const s of this.sheets) {
      s.theta = -tR + span * s.e;
      const [xr, yr] = onRight(s.yR), [xl, yl] = onLeft(s.yL);
      // the spine end only ever moves away from the stack the page is over: it rises while the page is still over the
      // right-hand stack, and comes down only once the page is over the left-hand one
      const slide = yl > yr ? sstep(0.02, 0.5, s.e) : sstep(0.5, 0.98, s.e);
      s.pivot.position.set(xr + (xl - xr) * slide, yr + (yl - yr) * slide, 0); s.pivot.rotation.z = s.theta;
      const rest = span * s.e <= REST || span * (1 - s.e) <= REST;
      if (s.rest !== undefined && s.rest !== rest) this.events.sheet?.({ type: s.rest ? 'lift' : 'land', sheet: s.i, board: s.isBoard });
      s.rest = rest;
    }
    // pop-ups
    for (const f of this.faces) {
      const k = f.spread, L = this.sheets[k - 1], R = this.sheets[k];
      const alpha = L.theta - R.theta;
      f.root.visible = alpha > 0.02;
      if (!f.root.visible) continue;
      // real card rises with the opening and nothing else: a piece d from the spine stays under the wedge's bisector, d·tan(α/2) high.
      // That bound only grows as the spread opens, so the fold can never reverse while it does
      const half = alpha >= Math.PI - 1e-3 ? 1e9 : Math.tan(alpha / 2);
      let phiMax = Math.PI / 2;
      for (const pc of f.pieces) {
        const h = half * (G0 + (f.side === 'front' ? pc.x0 : PW - pc.x1)) - 0.02 - (pc.layer + pc.span) * (CARD + 0.0015);
        phiMax = Math.min(phiMax, Math.asin(Math.min(1, Math.max(0, h / pc.H))));
      }
      // flat while a page of the spread is high in the air; they stand up as it comes down, and fold as soon as it lifts
      const u = Math.min(1, Math.max(0, alpha / Math.PI));
      const mech = Math.PI / 2 * sstep(0.78, 1, u);
      let phi = Math.max(0, smin(mech, phiMax));
      if (u > 0.999) phi = Math.min(phi, Math.PI / 2 - 0.006 * (1 + Math.sin(time * 0.6 + f.phase))); // a faint draft
      for (const pc of f.pieces) setPieceFold(pc, phi);
      const floor = f.cards * (CARD + 0.0015) * (1 - Math.sin(phi)) + 0.001;
      for (const s of f.strings) s.update(this.ends(s), floor);
      for (const tg of f.tags) hangTag(tg, floor);
    }
    // the folded card lies on whichever page stays put: it settles away as that page's spread opens and gathers as it shuts
    for (const { k, m, g } of this.fillers) {
      const c = 1 - sstep(0.02, 0.3, this.sheets[k - 1].theta - this.sheets[k].theta), right = p < k, host = this.sheets[right ? k : k - 1];
      m.visible = c > 0; if (!m.visible) continue;
      if (m.parent !== host.pivot) host.pivot.add(m);
      m.scale.y = c; m.position.y = right ? host.top + g * c / 2 : host.bot - g * c / 2;
    }
    if (p !== this.caseAt) { this.caseAt = p; this.updateCase(); }
  }

  // the cross-section of the case and of the block's back follow the boards and the sheets
  updateCase() {
    const S = this.sheets, cov = S[0], bk = S[N - 1];
    const at = (s, lx, ly) => { const c = Math.cos(s.theta), sn = Math.sin(s.theta), q = s.pivot.position; return [q.x + lx * c - ly * sn, q.y + lx * sn + ly * c]; };
    const n = this.spineSeg, nj = 5, ns = n - 2 * nj, F = at(cov, 0, 0), B = at(bk, 0, 0), Cf = at(cov, 0, cov.top), Cb = at(bk, 0, bk.bot);
    const len = Math.hypot(F[0] - B[0], F[1] - B[1]), tx = (F[0] - B[0]) / len, ty = (F[1] - B[1]) / len, mx = -ty, my = tx; // along the strip, back to front, and outward
    const [crown, chord] = stripShape(F[1] - B[1], this.W), off = STRIP * crown / CROWN; // it hangs between the boards' outer corners: well off them when it stands, level with them flat on the desk
    const under = -BT - ((Cf[1] + Cb[1] - Math.abs(ty) * chord) / 2 + my * off), slide = under > 0 ? under / ty : 0; // its lower end rests on the desk, so it rides up along itself
    const end = dir => [(Cf[0] + Cb[0] - tx * dir * chord) / 2 + mx * off + tx * slide, (Cf[1] + Cb[1] - ty * dir * chord) / 2 + my * off + ty * slide], Sb = end(1), Sf = end(-1);
    // a joint: cloth leaving the board along its face and arriving along the strip, so it rolls open and creases as the board swings
    const joint = (C, s, Sx, dir, t) => {
      const k = 0.25 * Math.hypot(Sx[0] - C[0], Sx[1] - C[1]), c = Math.cos(s.theta), sn = Math.sin(s.theta), a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, e = 3 * (1 - t) * t * t, f = t ** 3;
      const x = a * C[0] + b * (C[0] - c * k) + e * (Sx[0] + tx * dir * k) + f * Sx[0], y = a * C[1] + b * (C[1] - sn * k) + e * (Sx[1] + ty * dir * k) + f * Sx[1];
      const u = (x - C[0]) * c + (y - C[1]) * sn, v = ((y - C[1]) * c - (x - C[0]) * sn) * dir;
      return u > 0 && v < 0 ? [C[0] + u * c, C[1] + u * sn] : [x, y]; // the board stops it: folded back, the cloth lies along the board's face
    };
    const line = [];
    for (let i = 0; i <= n; i++) {
      if (i < nj) line.push(joint(Cb, bk, Sb, -1, i / nj));
      else if (i > n - nj) line.push(joint(Cf, cov, Sf, 1, (n - i) / nj));
      else { const w = (i - nj) / ns, h = 4 * w * (1 - w) * crown; line.push([Sb[0] + (Sf[0] - Sb[0]) * w + mx * h, Sb[1] + (Sf[1] - Sb[1]) * w + my * h]); }
    }
    const P = this.spine.geometry.attributes.position, ring = 2 * (n + 1), set = (i, x, y) => { y = Math.max(y, -BT); P.setXYZ(i * 2, x, y, BH / 2); P.setXYZ(i * 2 + 1, x, y, -BH / 2); }; // the desk stops it
    for (let i = 0; i <= n; i++) { const [x, y] = line[i], k = LINING * Math.max(0, Math.min(1, (i - nj) / 2, (n - nj - i) / 2)); set(i, x, y); set(ring - 1 - i, x - mx * k, y - my * k); } // only the strip is lined, thinning to its ends: a joint is bare cloth
    P.needsUpdate = true; this.spine.geometry.computeVertexNormals(); this.spine.geometry.computeBoundingSphere();
    const Q = this.back.geometry.attributes.position, m = this.backSeg + 1;
    S.forEach((s, i) => { const q = s.pivot.position; Q.setXYZ(i, q.x, q.y, PH / 2); Q.setXYZ(i + m, q.x, q.y, -PH / 2); });
    Q.needsUpdate = true; this.back.geometry.computeVertexNormals(); this.back.geometry.computeBoundingSphere();
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
