// The physical book: boards, page sheets that bend as they turn, page blocks, pop-ups per face.
import * as THREE from 'three';
import { FACES, SHEETS } from './pages.js';
import { BUILDERS, setRise } from './popups.js';
import { edgeTexture, clothFill } from './paper.js';

export const PW = 14, PH = 20, BW = 14.5, BH = 20.8, BT = 0.2, BLOCK = 1.0, SEG = 64;
const N = SHEETS.length; // 8 → p ∈ [0, N]
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function faceTexture(name, renderer, extra, mobile) {
  const f = FACES[name]; const board = f.kind === 'board';
  const w = board ? BW : PW, h = board ? BH : PH;
  const TW = mobile ? 1100 : 1700; const S = TW / w;
  const c = document.createElement('canvas'); c.width = TW; c.height = Math.round(h * S);
  f.draw(c.getContext('2d'), S, c.width, c.height, extra);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  let metal = null;
  if (f.gold) { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; f.gold(m.getContext('2d'), S, m.width, m.height); metal = new THREE.CanvasTexture(m); }
  return { map: t, metal, canvas: c };
}

export class Book {
  constructor(scene, renderer, { qr, mobile = false } = {}) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.sheets = []; this.popups = {};
    const edge = new THREE.CanvasTexture(edgeTexture()); edge.colorSpace = THREE.SRGBColorSpace;
    // page blocks (thickness of the unseen pages)
    const blockMat = [new THREE.MeshStandardMaterial({ map: edge, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.95 })];
    const mkBlock = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.05, 1, PH - 0.1), [blockMat[0], blockMat[0], blockMat[1], blockMat[1], blockMat[0], blockMat[0]]); m.castShadow = m.receiveShadow = true; this.group.add(m); return m; };
    this.blockR = mkBlock(); this.blockL = mkBlock();
    // spine (visible when the book is closed)
    const sc = document.createElement('canvas'); sc.width = 256; sc.height = 1024; clothFill(sc.getContext('2d'), 256, 1024);
    const spineTex = new THREE.CanvasTexture(sc); spineTex.colorSpace = THREE.SRGBColorSpace;
    this.spine = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, BH, 32, 1, true, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.85, side: THREE.DoubleSide }));
    this.spine.rotation.x = Math.PI / 2; this.spine.castShadow = true; this.group.add(this.spine);

    SHEETS.forEach(([front, back, kind], i) => {
      const isBoard = kind === 'board';
      const ft = faceTexture(front, renderer, { qr }, mobile), bt = faceTexture(back, renderer, { qr }, mobile);
      const s = { i, front, back, isBoard, t: 0 };
      if (isBoard) {
        const pivot = new THREE.Group(); this.group.add(pivot);
        const side = new THREE.MeshStandardMaterial({ color: '#232b45', roughness: 0.8 });
        const mf = new THREE.MeshStandardMaterial({ map: ft.map, roughness: ft.metal ? 0.75 : 0.9, metalness: 0, metalnessMap: ft.metal || null, roughnessMap: null });
        if (ft.metal) { mf.metalness = 1; mf.roughness = 0.42; mf.metalnessMap = ft.metal; mf.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness; roughnessFactor = mix(0.85, 0.38, texture2D(metalnessMap, vMetalnessMapUv).g);'); }; }
        const mb = new THREE.MeshStandardMaterial({ map: bt.map, roughness: 0.9 });
        // board box: +y face = front (when lying right), -y face = back
        const geo = new THREE.BoxGeometry(BW, BT, BH);
        // fix UVs of -y face so the back reads correctly after the flip (mirror u)
        const uv = geo.attributes.uv; for (let k = 12; k < 16; k++) { uv.setX(k, 1 - uv.getX(k)); uv.setY(k, 1 - uv.getY(k)); } uv.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, [side, side, i === 0 ? mf : mb, i === 0 ? mb : mf, side, side]);
        // which material on top: sheet 0 front=cover (top), back=endpaper (bottom). sheet 7: front=endpaper (top), back=back cover (bottom)
        if (i === N - 1) { mesh.material = [side, side, new THREE.MeshStandardMaterial({ map: ft.map, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: bt.map, roughness: 0.85 }), side, side]; }
        mesh.position.set(BW / 2 - 0.25, -BT / 2, 0); mesh.castShadow = mesh.receiveShadow = true; pivot.add(mesh);
        s.pivot = pivot; s.mesh = mesh;
      } else {
        const geo = new THREE.PlaneGeometry(PW, PH, SEG, 1); geo.rotateX(-Math.PI / 2); // lies in xz, normal +y; x ∈ [-7,7]
        geo.translate(PW / 2, 0, 0); // spine at x=0
        const back = geo.clone(); // shares nothing; we update both
        const buv = back.attributes.uv; for (let k = 0; k < buv.count; k++) buv.setX(k, 1 - buv.getX(k));
        const mF = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ft.map, roughness: 0.93, side: THREE.FrontSide }));
        const mB = new THREE.Mesh(back, new THREE.MeshStandardMaterial({ map: bt.map, roughness: 0.93, side: THREE.BackSide }));
        for (const m of [mF, mB]) { m.receiveShadow = true; m.castShadow = true; this.group.add(m); }
        s.mF = mF; s.mB = mB; s.base = Float32Array.from(geo.attributes.position.array);
      }
      for (const [name, where] of [[front, 'front'], [back, 'back']]) {
        const b = FACES[name].popup; if (!b) continue;
        const root = BUILDERS[b](); root.userData.sheet = i; root.userData.where = where;
        if (isBoard) { s.mesh.add(root); root.position.set(-BW / 2, BT / 2 + 0.001, -BH / 2); root.userData.rigid = true; }
        else this.group.add(root);
        this.popups[name] = root;
      }
      this.sheets.push(s);
    });
    this.p = -1; this.set(0);
  }
  // heights of the page blocks for progress p
  blocks(p) { const c = x => Math.min(1, Math.max(0, x)); return { L: BLOCK * c((p - 2) / (N - 3)), R: BLOCK * (1 - c((p - 1) / (N - 3))) }; }
  // world x-centre of what is visible (closed front → right block, open → spine, closed back → left)
  centerX(p) { return p < 1 ? (BW / 2) * (1 - sstep(0, 1, p)) : p > N - 1 ? -(BW / 2) * sstep(N - 1, N, p) : 0; }
  set(p) {
    if (p === this.p) return; this.p = p;
    const { L, R } = this.blocks(p);
    const eps = 0.012;
    this.blockR.scale.y = Math.max(R, 0.001); this.blockR.position.set(PW / 2 + 0.02, R / 2, 0); this.blockR.visible = R > 0.01;
    this.blockL.scale.y = Math.max(L, 0.001); this.blockL.position.set(-PW / 2 - 0.02, L / 2, 0); this.blockL.visible = L > 0.01;
    // spine: closed states only
    const closed = p < 1 ? 1 - sstep(0.15, 0.9, p) : p > N - 1 ? sstep(N - 0.9, N - 0.15, p) : 0;
    const total = BLOCK + 2 * BT; this.spine.visible = closed > 0.01;
    this.spine.scale.set((p > N / 2 ? -1 : 1) * total / 2 * Math.max(closed, 0.01), 1, total / 2);
    this.spine.position.set(p < 1 ? 0 : 0, BLOCK / 2, 0);
    for (const s of this.sheets) {
      const t = Math.min(1, Math.max(0, p - s.i)); s.t = t;
      const yR = s.isBoard ? (s.i === 0 ? R + BT : 0) : R + eps, yL = s.isBoard ? (s.i === 0 ? -BT : L) : L + eps;
      if (s.isBoard) {
        // board: rigid rotation about spine; pivot height slides between stacks
        const ang = Math.PI * easeTurn(t);
        s.pivot.position.set(0, yR + (yL - yR) * easeTurn(t), 0); s.pivot.rotation.z = ang;
        continue;
      }
      // only the top sheet of each stack and the turning sheets are drawn
      const vis = (t > 0 && t < 1) || s.i === Math.ceil(p) || s.i === Math.floor(p) - 1;
      s.mF.visible = s.mB.visible = vis;
      if (!vis) continue;
      bendSheet(s, t, yR, yL);
    }
    // pop-up rise per face
    for (const [name, root] of Object.entries(this.popups)) {
      const k = root.userData.sheet, where = root.userData.where;
      let r;
      if (where === 'front') r = sstep(k - 1 + 0.35, k - 1 + 0.92, p) * (1 - sstep(k + 0.0, k + 0.2, p));
      else r = sstep(k + 0.6, k + 0.98, p) * (1 - sstep(k + 1.75, k + 1.92, p));
      if (root.userData.rigid) r = where === 'front' ? 1 - sstep(k + 0.0, k + 0.35, p) : 1;
      setRise(root, r);
      if (!root.userData.rigid) {
        root.position.set(where === 'front' ? 0 : -PW, (where === 'front' ? R : L) + 0.012 + 0.004, -PH / 2);
      }
    }
  }
  // world position of a face point (x, height, v) at rest
  faceToWorld(name, x, y, v, p = this.p) {
    const { L, R } = this.blocks(p); const left = isLeftFace(name);
    return new THREE.Vector3(left ? x - PW : x, (left ? L : R) + y, v - PH / 2);
  }
}
const easeTurn = t => t; // page angle is linear in t; the scroll spring supplies the easing
export function isLeftFace(name) { return SHEETS.some(s => s[1] === name); }

// bend a sheet: angle along the page grows from base angle θ, the free edge lags (curl)
function bendSheet(s, t, yR, yL) {
  const th = Math.PI * t, curl = Math.sin(Math.PI * t) * 0.55, lift = Math.sin(Math.PI * t) * 0.0;
  const y0 = yR + (yL - yR) * t;
  const P = s.mF.geometry.attributes.position, B = s.mB.geometry.attributes.position, base = s.base;
  const cols = SEG + 1, du = PW / SEG;
  // compute the curve once per column
  const xs = new Float32Array(cols), ys = new Float32Array(cols); let x = 0, y = 0;
  for (let k = 0; k < cols; k++) {
    xs[k] = x; ys[k] = y;
    const u = (k + 0.5) / SEG; const a = th - curl * Math.pow(u, 1.6);
    x += Math.cos(a) * du; y += Math.sin(a) * du;
  }
  for (let i = 0; i < P.count; i++) {
    const k = Math.round(base[i * 3] / du);
    P.setXYZ(i, xs[k], y0 + ys[k] + 0.002, base[i * 3 + 2]);
    B.setXYZ(i, xs[k], y0 + ys[k] + 0.002, base[i * 3 + 2]);
  }
  P.needsUpdate = B.needsUpdate = true;
  s.mF.geometry.computeVertexNormals(); s.mB.geometry.computeVertexNormals();
  s.mF.geometry.computeBoundingSphere(); s.mB.geometry.computeBoundingSphere();
}
