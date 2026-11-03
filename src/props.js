// Photoreal desk props for the noir desk. Units are centimetres; each prop is a THREE.Group whose origin is the centre of
// its footprint with y = 0 on the desk surface and whose front faces +z. `userData.footprint = { w, d }` is the local x/z
// bounding box. Procedural props are built here; scanned ones come from Poly Haven (CC0, see public/assets/CREDITS.md).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { loadGLTF, paperNormal, peelNormal, valueNoise, normalFromHeight } from './assets.js';

const V3 = THREE.Vector3;
const HAND = '"Caveat", "Bradley Hand", "Segoe Print", cursive';
const TYPE = '"Special Elite", "Courier Prime", "Courier New", monospace';
const SERIF = '"Playfair Display", Georgia, serif';
const INK = '#1d2440'; // blue-black fountain-pen ink

// ---------------------------------------------------------------- small helpers
const rngOf = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
let ANISO = 8;
function ctex(c, { srgb = true, wrap = false } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = ANISO;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function mesh(geo, mat, { cast = true, recv = true, name } = {}) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; if (name) m.name = name; return m; }

// round the corners of a 2D polyline [[x, y], ...]; `rad` is a number or a per-vertex array; `closed` wraps the ends
function fillet(pts, rad, segs = 5, closed = false) {
  const out = [], n = pts.length;
  for (let k = 0; k < n; k++) {
    const P = pts[k], r = Array.isArray(rad) ? rad[k] : rad;
    if ((!closed && (k === 0 || k === n - 1)) || !r) { out.push(P); continue; }
    const A = pts[(k - 1 + n) % n], B = pts[(k + 1) % n];
    let d1x = A[0] - P[0], d1y = A[1] - P[1]; const l1 = Math.hypot(d1x, d1y); d1x /= l1; d1y /= l1;
    let d2x = B[0] - P[0], d2y = B[1] - P[1]; const l2 = Math.hypot(d2x, d2y); d2x /= l2; d2y /= l2;
    const th = Math.acos(clamp(d1x * d2x + d1y * d2y, -1, 1));
    if (th > Math.PI - 1e-3 || th < 1e-3) { out.push(P); continue; }
    let t = r / Math.tan(th / 2), rr = r; const tmax = 0.5 * Math.min(l1, l2); if (t > tmax) { t = tmax; rr = t * Math.tan(th / 2); }
    const S = [P[0] + d1x * t, P[1] + d1y * t], E = [P[0] + d2x * t, P[1] + d2y * t];
    let bx = d1x + d2x, by = d1y + d2y; const bl = Math.hypot(bx, by); bx /= bl; by /= bl;
    const dc = rr / Math.sin(th / 2), C = [P[0] + bx * dc, P[1] + by * dc];
    const a0 = Math.atan2(S[1] - C[1], S[0] - C[0]); let da = Math.atan2(E[1] - C[1], E[0] - C[0]) - a0;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    for (let s = 0; s <= segs; s++) { const a = a0 + da * s / segs; out.push([C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr]); }
  }
  return out;
}
// cumulative arc length of a 2D polyline, normalised to 0..1
function arcParams(pts) { const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const L = s[s.length - 1]; return { s: s.map(v => v / L), L }; }
// lathe about +y from a profile of [r, y] (counter-clockwise around the solid's cross-section gives outward normals);
// uv.x runs around, uv.y runs along the profile by arc length
function lathe(pts, segs = 64, { phiStart = 0, phiLength = Math.PI * 2 } = {}) {
  const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(0, p[0]), p[1])), segs, phiStart, phiLength);
  const { s } = arcParams(pts), uv = g.attributes.uv, n = pts.length;
  for (let i = 0; i <= segs; i++) for (let j = 0; j < n; j++) uv.setY(i * n + j, s[j]);
  return g;
}
// profile arc parameter (0..1) at the first point where the profile reaches y (searching from index `from`)
function arcAtY(pts, y, from = 0, to = pts.length - 1) {
  const { s } = arcParams(pts);
  for (let i = Math.max(1, from); i <= to; i++) { const a = pts[i - 1][1], b = pts[i][1]; if ((a - y) * (b - y) <= 0 && a !== b) { const t = (y - a) / (b - a); return s[i - 1] + (s[i] - s[i - 1]) * t; } }
  return null;
}
// [min, max] arc fraction of the profile points that satisfy pred(p)
function arcRange(pts, pred) { const { s } = arcParams(pts); let a = 1, b = 0; pts.forEach((p, i) => { if (pred(p)) { a = Math.min(a, s[i]); b = Math.max(b, s[i]); } }); return [a, b]; }
const argMaxY = pts => pts.reduce((m, p, i) => p[1] > pts[m][1] ? i : m, 0);
// a (nu x nv) parametric grid; fn(u, v, i, j) -> [x, y, z]
function grid(nu, nv, fn, { flip = false } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv, i, j); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// make normals continuous across the u = 0 / u = 1 seam of a grid built with closeU
function weldSeam(g, nu, nv) {
  const n = g.attributes.normal;
  for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
  return g;
}
// sweep a closed cross-section [[a, b], ...] along a curve; b runs along `up`, a along up x tangent. scale(t) tapers it.
function sweep(curve, nAlong, section, { up = new V3(0, 0, 1), scale = () => 1, flip = false } = {}) {
  const ns = section.length, P = new V3(), T = new V3(), B = new V3(), N = new V3();
  const g = grid(ns, nAlong, (u, v, i, j) => {
    const t = j / nAlong; curve.getPointAt(t, P); curve.getTangentAt(t, T).normalize();
    B.copy(up).addScaledVector(T, -up.dot(T)).normalize(); N.crossVectors(B, T);
    const [a, b] = section[i % ns], s = scale(t);
    return [P.x + (N.x * a + B.x * b) * s, P.y + (N.y * a + B.y * b) * s, P.z + (N.z * a + B.z * b) * s];
  }, { flip });
  return weldSeam(g, ns, nAlong);
}
const ellipse = (a, b, n = 16) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [Math.cos(t) * a, Math.sin(t) * b]; });
const roundRect = (w, h, r, segs = 3) => fillet([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], r, segs, true);
// merge geometries that share a material (drops attributes other than position / normal / uv)
function merge(geos) {
  const list = geos.map(g => { const c = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k); if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); return c; });
  return mergeGeometries(list, false);
}
// lay a set of 2D silhouette points [x, yBelowAxis] on the lower convex hull edge spanning comX; returns the tilt angle
// (radians about z, negative lowers +x) and the axis height above the desk at x = 0
function restTilt(pts, comX) {
  const P = pts.slice().sort((a, b) => a[0] - b[0]); const hull = [];
  for (const p of P) { while (hull.length >= 2) { const [o, a] = [hull[hull.length - 2], hull[hull.length - 1]]; if ((a[0] - o[0]) * (p[1] - o[1]) - (a[1] - o[1]) * (p[0] - o[0]) <= 0) hull.pop(); else break; } hull.push(p); }
  for (let i = 1; i < hull.length; i++) { const a = hull[i - 1], b = hull[i]; if (a[0] <= comX && b[0] >= comX) { const slope = (b[1] - a[1]) / (b[0] - a[0]); return { angle: -Math.atan(slope), a, b }; } }
  return { angle: 0 };
}

// tileable wear/smudge roughness map for hand-worn metal (G channel = roughness)
function smudgeMap(seed, lo, hi) {
  const N = 512, [c, g] = cnv(N, N), r = rngOf(seed); const H = valueNoise(N, seed, [[4, 0.5], [16, 0.35], [64, 0.15]]);
  const img = g.createImageData(N, N); for (let i = 0; i < N * N; i++) { const v = (lo + (hi - lo) * (0.25 + H[i] * 0.5)) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 40; k++) { const x = r() * N, y = r() * N, R = 6 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, R); const v = Math.round(hi * 255); gr.addColorStop(0, `rgba(${v},${v},${v},${0.15 + r() * 0.25})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
  g.lineCap = 'round'; for (let k = 0; k < 160; k++) { const x = r() * N, y = r() * N, a = r() * 6.28, l = 4 + r() * 30; const v = Math.round((lo + (hi - lo) * (r() > 0.5 ? 0.9 : 0.1)) * 255); g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return ctex(c, { srgb: false, wrap: true });
}

// ---------------------------------------------------------------- shared materials
function materials() {
  const peel = peelNormal();
  const brassRough = smudgeMap(5, 0.16, 0.42);
  const M = {
    peel,
    brass: new THREE.MeshPhysicalMaterial({ color: '#d4ab62', metalness: 1, roughness: 1, roughnessMap: brassRough, clearcoat: 0.7, clearcoatRoughness: 0.06, normalMap: peel, normalScale: new THREE.Vector2(0.05, 0.05) }),
    brassSatin: new THREE.MeshPhysicalMaterial({ color: '#c99f58', metalness: 1, roughness: 0.42 }),
    gold: new THREE.MeshPhysicalMaterial({ color: '#e7c374', metalness: 1, roughness: 1, roughnessMap: smudgeMap(9, 0.1, 0.26) }),
    steel: new THREE.MeshStandardMaterial({ color: '#c3c6c9', metalness: 1, roughness: 0.24 }),
    tin: new THREE.MeshStandardMaterial({ color: '#d2d5d8', metalness: 1, roughness: 1, roughnessMap: smudgeMap(13, 0.18, 0.38) }),
  };
  return M;
}

// put a group's content so its footprint is centred on the origin with its base on y = 0, set shadows and the footprint
function finalize(group, content, points = {}) {
  group.add(content); content.updateMatrixWorld(true);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  content.traverse(o => { if (o.isMesh && !o.userData.noFootprint) { o.geometry.computeBoundingBox(); if (o.isInstancedMesh) { o.computeBoundingBox(); tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld); } else tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); } });
  const off = new V3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  content.position.add(off); content.updateMatrixWorld(true);
  content.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noCast; o.receiveShadow = true; } });
  group.userData.footprint = { w: +(box.max.x - box.min.x).toFixed(2), d: +(box.max.z - box.min.z).toFixed(2) };
  group.userData.height = +(box.max.y - box.min.y).toFixed(2);
  for (const [k, p] of Object.entries(points)) group.userData[k] = p.clone().add(off);
  return group;
}

// ================================================================= BANKER'S LAMP
// Brass base and stem, a curved strap yoke holding a cased-glass shade (deep green outside, opal white inside) on two
// thumb-screw pivots, a socket with a pull-chain switch and a ball chain, a frosted bulb and a cloth cord.
function bankersLamp(M) {
  const g = new THREE.Group();
  const Hs = 27.5, tilt = 0.4; // shade axis height and forward tilt
  const Ry = 7.2, Rz = 7.0, Lc = 13.0, ca = 5.0, th = 0.3, flare = 0.32; const X = Lc / 2 + ca;
  const brass = M.brass;

  // ----- base + stem: one turned piece
  const stemTop = Hs - 6.1;
  const prof = fillet([
    [0, 0.12], [7.7, 0.12], [7.95, 0.34], [7.95, 0.86], [7.62, 1.06], [7.62, 1.22], [7.2, 1.48], [6.1, 2.15], [4.6, 2.55], [3.0, 2.82], [2.15, 3.12],
    [1.55, 3.2], [1.55, 3.62], [1.05, 3.82], [0.66, 3.95], [0.66, 4.45], [0.9, 4.6], [0.9, 5.05], [0.64, 5.25],
    [0.6, 17.6], [0.82, 17.9], [0.95, 18.5], [0.82, 19.1], [0.6, 19.35], [0.6, stemTop - 0.75], [0.98, stemTop - 0.6], [0.98, stemTop], [0, stemTop],
  ], [0, 0.12, 0.2, 0.18, 0.06, 0.06, 0.4, 1.2, 1.4, 0.8, 0.3, 0.1, 0.1, 0.25, 0.1, 0.06, 0.08, 0.08, 0.1, 0.12, 0.25, 0.35, 0.25, 0.12, 0.08, 0.1, 0.06, 0], 5);
  const baseGeo = lathe(prof, 96);
  // felt pad under the base
  const felt = mesh(lathe(fillet([[0, 0], [7.55, 0], [7.55, 0.13], [0, 0.13]], [0, 0.05, 0.04, 0], 3), 64), new THREE.MeshPhysicalMaterial({ color: '#1d3324', roughness: 1, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#3f6b4c') }), { name: 'felt' });

  // ----- yoke: a flat brass strap, U-shaped under the shade, rising to pivots at the shade's end caps
  const yx = X + 0.42, yb = stemTop + 0.18;
  const yPts = fillet([[-yx, Hs + 0.75], [-yx, Hs - 2.2], [-6.4, yb], [6.4, yb], [yx, Hs - 2.2], [yx, Hs + 0.75]], [0, 2.6, 3.4, 3.4, 2.6, 0], 10);
  const yCurve = new THREE.CatmullRomCurve3(yPts.map(p => new V3(p[0], p[1], 0)), false, 'centripetal');
  const yoke = sweep(yCurve, 160, roundRect(0.36, 1.12, 0.12, 3), { up: new V3(0, 0, 1) });
  // rounded ends of the strap: half discs closing the top of each upright
  const yokeCaps = [-1, 1].map(s => { const c = new THREE.CylinderGeometry(0.56, 0.56, 0.36, 28, 1, false, 0, Math.PI); c.rotateZ(Math.PI / 2); c.translate(s * yx, Hs + 0.75, 0); return c; });
  // collar joining the yoke to the socket
  const nipple = lathe(fillet([[0, yb + 0.1], [0.72, yb + 0.1], [0.72, yb + 0.55], [0.55, yb + 0.7], [0, yb + 0.7]], [0, 0.06, 0.08, 0.05, 0], 3), 48);
  // pivots: washer and knurled thumb nut outside each upright
  const pivots = [];
  for (const s of [-1, 1]) {
    const washer = new THREE.CylinderGeometry(0.62, 0.62, 0.26, 32); washer.rotateZ(Math.PI / 2); washer.translate(s * (X + 0.11), Hs, 0); pivots.push(washer);
    const flutes = 22, nut = grid(flutes * 4, 10, (u, v, i, j) => {
      const a = u * Math.PI * 2, r0 = 0.66 + 0.035 * Math.cos(a * flutes);
      const xs = [0, 0.05, 0.1, 0.5, 0.75, 0.82, 0.86, 0.9, 0.93, 0.96, 1.0][j];
      const rr = j <= 1 ? [0.5, 0.62][j] : j >= 7 ? r0 * Math.cos((j - 6) / 4 * 1.25) : r0;
      const x = s * (yx + 0.18 + xs * 0.95);
      return [x, Hs + Math.sin(a) * rr, Math.cos(a) * rr];
    }, { flip: s < 0 });
    pivots.push(weldSeam(nut, flutes * 4, 10));
    const tip = new THREE.SphereGeometry(0.24, 16, 8); tip.translate(s * (yx + 1.14), Hs, 0); pivots.push(tip);
  }

  // ----- socket with the pull-chain switch
  const sb = yb + 0.6, st = Hs - 1.1; // socket bottom / top
  const sock = lathe(fillet([[0, sb], [1.25, sb], [1.45, sb + 0.25], [1.45, sb + 1.2], [1.38, sb + 1.3], [1.45, sb + 1.4], [1.45, st - 0.45], [1.3, st - 0.2], [1.12, st], [1.05, st], [1.05, st - 0.15], [0, st - 0.15]], [0, 0.15, 0.12, 0.04, 0.03, 0.04, 0.12, 0.12, 0.05, 0.02, 0, 0], 3), 64);
  const swY = sb + 2.4;
  const sw = lathe(fillet([[0, 0], [0.5, 0], [0.5, 0.75], [0.38, 0.95], [0.32, 1.05], [0, 1.05]], [0, 0.04, 0.1, 0.05, 0.03, 0], 3), 32); sw.rotateX(Math.PI / 2); sw.translate(0, swY, 1.3);
  // bulb: frosted A15 globe on a brass screw base
  const bulbProf = [[0.96, 0], [1.0, 0.45], [1.18, 1.0], [1.72, 1.8], [2.2, 2.7], [2.4, 3.6], [2.3, 4.55], [1.88, 5.3], [1.1, 5.82], [0, 6.0]];
  const bulbGeo = lathe(bulbProf, 48); bulbGeo.translate(0, st, 0);
  const screw = grid(48, 12, (u, v) => { const a = u * Math.PI * 2, y = st - 0.95 + v * 1.0, r = 1.0 + 0.05 * Math.sin((v * 1.0 / 0.18 + u) * Math.PI * 2); return [Math.sin(a) * r, y, Math.cos(a) * r]; }, { flip: true });
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4, emissive: '#ffcf94', emissiveIntensity: 7 });

  // ----- shade: half a capsule cut through its axis, cased glass
  const rows = []; const nc = 18, nm = 8;
  const capRows = (inner) => { const a = inner ? ca - th : ca, out = [];
    for (let k = 0; k <= nc; k++) { const ph = Math.PI / 2 * (1 - k / nc); out.push([-(Lc / 2 + a * Math.sin(ph)), Math.cos(ph)]); }
    for (let k = 1; k < nm; k++) out.push([-Lc / 2 + Lc * k / nm, 1]);
    for (let k = 0; k <= nc; k++) { const ph = Math.PI / 2 * (k / nc); out.push([Lc / 2 + a * Math.sin(ph), Math.cos(ph)]); }
    return out; };
  const rowsO = capRows(false), rowsI = capRows(true), NR = rowsO.length - 1, NA = 64;
  const fl = al => flare * (1 - Math.sin(al)) ** 3;
  const shadePt = (rws, ry, rz, i, al) => { const [x, s] = rws[i]; return [x, s * (ry + fl(al)) * Math.sin(al), s * (rz + fl(al)) * Math.cos(al)]; };
  const outer = grid(NR, NA, (u, v, i, j) => shadePt(rowsO, Ry, Rz, i, v * Math.PI), { flip: true });
  const inner = grid(NR, NA, (u, v, i, j) => shadePt(rowsI, Ry - th, Rz - th, i, v * Math.PI));
  // the cut edge: green casing on the outside, opal on the inside
  const rimStrip = (al, f0, f1, flip) => grid(NR, 2, (u, v, i, j) => {
    const o = shadePt(rowsO, Ry, Rz, i, al), n = shadePt(rowsI, Ry - th, Rz - th, i, al), t = f0 + (f1 - f0) * j / 2;
    return [o[0] + (n[0] - o[0]) * t, o[1] + (n[1] - o[1]) * t, o[2] + (n[2] - o[2]) * t];
  }, { flip });
  const rimG = merge([rimStrip(0, 0, 0.32, false), rimStrip(Math.PI, 0, 0.32, true)]);
  const rimW = merge([rimStrip(0, 0.32, 1, false), rimStrip(Math.PI, 0.32, 1, true)]);
  // glow map: brightest at the top centre above the bulb, falling toward the rim and the ends
  const [gc, gg] = cnv(256, 128); const gi = gg.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) { const u = x / 255, v = 1 - y / 127; const k = (0.22 + 0.78 * Math.exp(-(((u - 0.5) / 0.27) ** 2))) * (0.1 + 0.9 * Math.sin(Math.PI * v) ** 2.2); const i = (y * 256 + x) * 4; gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = Math.min(255, k * 255); gi.data[i + 3] = 255; }
  gg.putImageData(gi, 0, 0); const glowMap = ctex(gc);
  const greenMat = new THREE.MeshPhysicalMaterial({ color: '#06371f', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.52, specularIntensity: 1, emissive: '#0e6e37', emissiveMap: glowMap, emissiveIntensity: 0.45, normalMap: M.peel, normalScale: new THREE.Vector2(0.04, 0.04) });
  const opalMat = new THREE.MeshStandardMaterial({ color: '#f2eee4', roughness: 0.38, metalness: 0, emissive: '#ffcf96', emissiveMap: glowMap, emissiveIntensity: 1.0 });
  const shade = new THREE.Group(); shade.position.set(0, Hs, 0); shade.rotation.x = -tilt;
  shade.add(mesh(merge([outer, rimG]), greenMat, { name: 'shadeOuter' }));
  const innerMesh = mesh(merge([inner, rimW]), opalMat, { name: 'shadeInner' }); innerMesh.userData.noCast = false; shade.add(innerMesh);

  // ----- pull chain: ball chain hanging from the switch, a brass pull at the end
  const chainTop = new V3(0, swY - 0.38, 2.18);
  const chainCurve = new THREE.CatmullRomCurve3([chainTop, new V3(0, swY - 0.7, 2.42), new V3(0.03, swY - 1.4, 2.5), new V3(0.05, swY - 4, 2.52), new V3(0.06, swY - 8.6, 2.52)]);
  const pitch = 0.3, balls = Math.floor(chainCurve.getLength() / pitch);
  const ballGeo = new THREE.SphereGeometry(0.115, 12, 8), linkGeo = new THREE.CylinderGeometry(0.03, 0.03, pitch, 6);
  const ballI = new THREE.InstancedMesh(ballGeo, M.brassSatin, balls), linkI = new THREE.InstancedMesh(linkGeo, M.brassSatin, balls - 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pA = new V3(), pB = new V3(), one = new V3(1, 1, 1);
  for (let i = 0; i < balls; i++) { chainCurve.getPointAt(i / (balls - 1), pA); ballI.setMatrixAt(i, m4.compose(pA, q.identity(), one)); }
  for (let i = 0; i < balls - 1; i++) { chainCurve.getPointAt(i / (balls - 1), pA); chainCurve.getPointAt((i + 1) / (balls - 1), pB); q.setFromUnitVectors(new V3(0, 1, 0), pB.clone().sub(pA).normalize()); linkI.setMatrixAt(i, m4.compose(pA.clone().add(pB).multiplyScalar(0.5), q, one)); }
  const end = chainCurve.getPointAt(1);
  const pull = lathe(fillet([[0, 0], [0.2, 0.05], [0.36, 0.35], [0.4, 0.9], [0.3, 1.35], [0.16, 1.55], [0.16, 1.75], [0, 1.8]], [0, 0.05, 0.2, 0.25, 0.15, 0.05, 0.04, 0], 4), 32);
  pull.translate(end.x, end.y - 1.85, end.z);

  // ----- cord: twisted cloth flex leaving the back of the base
  const cordMat = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.9, normalMap: cordNormal(), normalScale: new THREE.Vector2(0.9, 0.9) });
  const cord = mesh(new THREE.BufferGeometry(), cordMat, { name: 'cord' }); cord.userData.noFootprint = true;
  const setCord = (len = 14, drop = 8) => {
    const pts = [new V3(0, 0.9, -7.3), new V3(0.4, 0.45, -8.6), new V3(1.2, 0.3, -10.5)];
    const n = Math.max(1, Math.round((len - 10) / 4)); for (let k = 1; k <= n; k++) pts.push(new V3(1.2 + Math.sin(k * 1.3) * 0.8, 0.3, -10.5 - (len - 10) * k / n));
    pts.push(new V3(1.4, 0.0, -len - 0.8), new V3(1.4, -drop, -len - 1.2));
    cord.geometry.dispose(); cord.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 120, 0.27, 10);
    const uv = cord.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len * 1.6);
  };
  setCord();

  const content = new THREE.Group();
  content.add(mesh(merge([baseGeo, yoke, ...yokeCaps, nipple, ...pivots, sock, sw, pull]), brass, { name: 'brass' }));
  const screwMesh = mesh(screw, M.brassSatin, { name: 'screw' }); screwMesh.userData.noCast = true;
  const bulb = mesh(bulbGeo, bulbMat, { name: 'bulb' }); bulb.userData.noCast = true;
  ballI.castShadow = linkI.castShadow = true;
  content.add(felt, shade, bulb, screwMesh, ballI, linkI, cord);
  const out = finalize(g, content, { bulb: new V3(0, st + 3.6, 0) });
  out.userData.aim = new V3(0, -Math.cos(tilt), Math.sin(tilt)).normalize();
  out.userData.shade = shade; out.userData.setCord = setCord; out.userData.cord = cord;
  const base = { b: bulbMat.emissiveIntensity, o: opalMat.emissiveIntensity, g: greenMat.emissiveIntensity };
  out.userData.setGlow = (k = 1) => { bulbMat.emissiveIntensity = base.b * k; opalMat.emissiveIntensity = base.o * k; greenMat.emissiveIntensity = base.g * k; };
  return out;
}
function cordNormal() {
  const N = 128; const H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ph = (x / N * 3 + y / N * 2) * Math.PI * 2; H[y * N + x] = Math.abs(Math.sin(ph)) ** 0.6 * 6 + Math.sin(x * 1.7 + y * 0.9) * 0.3; }
  return normalFromHeight(H, N, 0.5);
}

// ================================================================= CUP AND SAUCER
// 1940s restaurant china: heavy vitrified cup and saucer, off-white glaze with a maroon double pinstripe, unglazed foot rings.
function cupAndSaucer(M) {
  const glazeCol = '#efe9dc', band = '#6e1f1c', biscuit = '#cbb99a';
  // band / biscuit strip textures along the profile (v = arc fraction)
  const strip = (pts, bands, bisc) => {
    const H = 2048, [c, g] = cnv(4, H), [rc, rg] = cnv(4, H);
    g.fillStyle = glazeCol; g.fillRect(0, 0, 4, H); rg.fillStyle = 'rgb(46,46,46)'; rg.fillRect(0, 0, 4, H);
    const at = s => (1 - s) * H; // canvas row for arc fraction s (flipY)
    for (const [s0, s1, col] of bands) { g.fillStyle = col; g.fillRect(0, at(s1), 4, Math.max(1, at(s0) - at(s1))); }
    for (const [s0, s1] of bisc) { g.fillStyle = biscuit; g.fillRect(0, at(s1), 4, at(s0) - at(s1)); rg.fillStyle = 'rgb(200,200,200)'; rg.fillRect(0, at(s1), 4, at(s0) - at(s1)); }
    const map = ctex(c), rough = ctex(rc, { srgb: false }); map.anisotropy = rough.anisotropy = 1; return { map, rough };
  };
  const glaze = (t) => new THREE.MeshPhysicalMaterial({ map: t.map, roughnessMap: t.rough, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, normalMap: M.peel, normalScale: new THREE.Vector2(0.06, 0.06), sheen: 0, ior: 1.5 });

  // saucer
  const sp = fillet([
    [0, 0.34], [3.55, 0.34], [3.7, 0.02], [4.05, 0.0], [4.2, 0.2], [4.7, 0.5], [6.3, 1.12], [7.2, 1.52], [7.32, 1.68], [7.22, 1.86], [7.0, 1.84],
    [5.6, 1.36], [3.6, 0.92], [3.0, 0.8], [2.7, 0.74], [0, 0.72],
  ], [0, 0.1, 0.06, 0.06, 0.15, 0.3, 0.8, 0.4, 0.12, 0.12, 0.3, 0.8, 0.5, 0.3, 0.25, 0], 6);
  const sRim = argMaxY(sp), sBand0 = arcAtY(sp, 1.7, sRim), sBand1 = arcAtY(sp, 1.6, sRim);
  const sStrip = strip(sp, [[sBand0, sBand0 + 0.005, band], [sBand1, sBand1 + 0.0022, band]], [arcRange(sp, p => p[1] < 0.03)]);
  const saucer = mesh(lathe(sp, 128), glaze(sStrip), { name: 'saucer' });
  const well = 0.72;

  // cup (profile from the centre of the underside, out over the foot, up the wall, over the rim, down inside)
  const cp = fillet([
    [0, 0.16], [1.95, 0.16], [2.12, 0.0], [2.5, 0.0], [2.66, 0.22], [3.4, 0.95], [3.95, 2.1], [4.24, 3.9], [4.33, 5.7], [4.36, 6.42], [4.18, 6.5],
    [4.0, 6.3], [3.95, 5.4], [3.82, 3.9], [3.45, 2.3], [2.6, 1.1], [1.2, 0.86], [0, 0.84],
  ], [0, 0.08, 0.05, 0.06, 0.2, 0.6, 1.2, 1.6, 1.0, 0.1, 0.1, 0.3, 1.0, 1.6, 1.2, 0.8, 0.4, 0], 6);
  const outerEnd = argMaxY(cp);
  const cb0 = arcAtY(cp, 6.02, 3, outerEnd), cb1 = arcAtY(cp, 5.8, 3, outerEnd);
  const cStrip = strip(cp, [[cb0 - 0.006, cb0, band], [cb1 - 0.0022, cb1, band]], [arcRange(cp, p => p[1] < 0.03)]);
  const cupMat = glaze(cStrip);
  const cupGeo = lathe(cp, 128);
  // handle: oval section swept along a loop that dives into the wall at both ends, flaring like a pulled fillet
  const hc = new THREE.CatmullRomCurve3([[3.72, 5.35], [4.6, 5.55], [5.55, 5.45], [6.2, 4.85], [6.3, 3.95], [5.9, 3.05], [5.05, 2.45], [4.1, 2.2], [3.5, 2.12]].map(([x, y]) => new V3(x, y, 0)), false, 'centripetal');
  const hGeo = sweep(hc, 90, ellipse(0.3, 0.44, 20), { up: new V3(0, 0, 1), scale: t => 1 + 0.42 * (sstep(0.14, 0, t) + sstep(0.86, 1, t)) });
  // map the handle's uv onto plain glaze (arc fraction of the outer wall)
  const huv = hGeo.attributes.uv; const plain = arcAtY(cp, 4.2, 4, outerEnd); for (let i = 0; i < huv.count; i++) huv.setXY(i, 0.5, plain);
  const cup = mesh(merge([cupGeo, hGeo]), cupMat, { name: 'cup' });
  cup.position.y = well;

  // coffee: black, glassy, with a thin brown meniscus where it climbs the wall
  const fillY = 5.2; let rIn = 3.9;
  for (let i = outerEnd; i < cp.length - 1; i++) { const a = cp[i], b = cp[i + 1]; if ((a[1] - fillY) * (b[1] - fillY) <= 0) { rIn = a[0] + (b[0] - a[0]) * (fillY - a[1]) / (b[1] - a[1]); break; } }
  const coffeeProf = [[0, fillY], [rIn - 0.35, fillY], [rIn - 0.12, fillY + 0.012], [rIn - 0.03, fillY + 0.045], [rIn + 0.03, fillY + 0.07]].reverse();
  const coffeeGeo = lathe(coffeeProf, 96);
  const col = new Float32Array(coffeeGeo.attributes.position.count * 3), cc = new THREE.Color(), dark = new THREE.Color('#080402'), edge = new THREE.Color('#4a2611');
  for (let i = 0; i < coffeeGeo.attributes.position.count; i++) { const x = coffeeGeo.attributes.position.getX(i), z = coffeeGeo.attributes.position.getZ(i); const k = sstep(rIn - 0.5, rIn, Math.hypot(x, z)); cc.copy(dark).lerp(edge, k * 0.85); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
  coffeeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const coffee = mesh(coffeeGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.04, metalness: 0, ior: 1.34, specularIntensity: 1, clearcoat: 0 }), { name: 'coffee' });
  coffee.position.y = well;

  const content = new THREE.Group(); content.add(saucer, cup, coffee);
  return finalize(new THREE.Group(), content, { steamOrigin: new V3(0, well + fillY, 0) });
}

// ================================================================= MAGNIFYING GLASS
// a reading glass: double-convex lens in a lacquered brass rim, brass neck and ferrule, turned ebonised handle
function magnifier(M) {
  const R = 4.5, rim0 = R - 0.08, rim1 = R + 0.42, hh = 0.42;
  // lens: two shallow spherical caps
  const lp = []; for (let k = 0; k <= 24; k++) { const r = R * k / 24; lp.push([r, -0.1 - 0.2 * (1 - (r / R) ** 2)]); }
  for (let k = 24; k >= 0; k--) { const r = R * k / 24; lp.push([r, 0.1 + 0.2 * (1 - (r / R) ** 2)]); }
  const lensGeo = lathe(lp, 96);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.015, transmission: 1, thickness: 0.45, ior: 1.52, specularIntensity: 1, attenuationColor: '#e9f5ee', attenuationDistance: 20 });
  // rim: a rounded band with a bead on top and a groove holding the lens
  const rimProf = fillet([[rim0, -hh], [rim1 - 0.06, -hh], [rim1, -hh + 0.08], [rim1, hh - 0.16], [rim1 + 0.05, hh - 0.1], [rim1 + 0.05, hh - 0.02], [rim1 - 0.04, hh + 0.04], [rim0 + 0.12, hh], [rim0, hh - 0.1], [rim0, -hh + 0.06]].concat([[rim0, -hh]]),
    [0, 0.05, 0.06, 0.03, 0.03, 0.04, 0.05, 0.06, 0.04, 0.04, 0], 4);
  const rimGeo = lathe(rimProf, 128);
  // neck, ferrule and end cap: brass, turned about the x axis
  const alongX = (prof, segs = 48) => { const g = lathe(prof, segs); g.rotateZ(-Math.PI / 2); return g; };
  const neck = alongX(fillet([[0, R + 0.2], [0.34, R + 0.2], [0.36, rim1 + 0.25], [0.3, rim1 + 0.9], [0.42, rim1 + 1.25], [0.46, rim1 + 1.5], [0.36, rim1 + 1.75], [0.36, rim1 + 1.9], [0, rim1 + 1.9]], [0, 0.03, 0.12, 0.15, 0.12, 0.1, 0.05, 0.02, 0], 4));
  const h0 = rim1 + 1.85; // handle starts here
  const ferrule = alongX(fillet([[0, h0], [0.5, h0], [0.56, h0 + 0.12], [0.56, h0 + 0.3], [0.5, h0 + 0.38], [0.52, h0 + 0.48], [0.58, h0 + 0.62], [0.58, h0 + 1.05], [0, h0 + 1.05]], [0, 0.04, 0.04, 0.03, 0.03, 0.04, 0.05, 0.02, 0], 4));
  const hp = [[0, h0 + 0.95], [0.5, h0 + 0.95], [0.53, h0 + 1.6], [0.62, h0 + 3.5], [0.7, h0 + 6.0], [0.7, h0 + 7.4], [0.64, h0 + 9.0], [0.62, h0 + 9.6], [0, h0 + 9.6]];
  const handleGeo = alongX(fillet(hp, [0, 0.03, 0.6, 1.5, 1.2, 1.0, 0.4, 0.05, 0], 6), 56);
  const cap = alongX(fillet([[0, h0 + 9.5], [0.6, h0 + 9.5], [0.62, h0 + 9.7], [0.56, h0 + 9.95], [0.36, h0 + 10.15], [0, h0 + 10.2]], [0, 0.03, 0.06, 0.12, 0.1, 0], 4));
  // ebonised wood with a faint grain along the handle
  // grain runs along the handle: texture u goes round it, v along it
  const [wc, wg] = cnv(256, 512); wg.fillStyle = '#24170f'; wg.fillRect(0, 0, 256, 512); const r = rngOf(9);
  for (let k = 0; k < 260; k++) { const x = r() * 256, w = 0.4 + r() * 2.2; wg.fillStyle = `rgba(${r() > 0.55 ? '96,60,36' : '6,4,2'},${0.12 + r() * 0.25})`; wg.beginPath(); wg.moveTo(x, 0); for (let y = 0; y <= 512; y += 32) wg.lineTo(x + Math.sin(y * 0.01 + k) * 3 + w, y); for (let y = 512; y >= 0; y -= 32) wg.lineTo(x + Math.sin(y * 0.01 + k) * 3, y); wg.fill(); }
  const wood = new THREE.MeshPhysicalMaterial({ map: ctex(wc), roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
  const lensMesh = mesh(lensGeo, glass, { name: 'lens' }); lensMesh.userData.noCast = true;
  const mag = new THREE.Group();
  mag.add(lensMesh, mesh(merge([rimGeo, neck, ferrule, cap]), M.brass, { name: 'brass' }), mesh(handleGeo, wood, { name: 'handle' }));
  // lying flat: rests on the rim's far edge and the handle's swell
  const sil = [[-rim1 - 0.05, -hh], [rim1 + 0.05, -hh]].concat(hp.map(([rr, x]) => [x, -rr]));
  const { angle } = restTilt(sil, 1.2); mag.rotation.z = angle;
  const content = new THREE.Group(); content.add(mag);
  return finalize(new THREE.Group(), content);
}

// ================================================================= PENCILS
// Hexagonal cedar pencil with lacquered paint and a foil stamp, a cone cut by the sharpener (the scallops where the cone
// meets the flats come from the geometry), graphite core, crimped brass ferrule with painted bands and a worn eraser.
function pencil(M, { length = 17.2, paint = '#d9a224', paint2 = null, foil = '#d8b25c', foilMetal = true, stamp = 'DRAFTSMAN  ·  No. 2  ·  HB', bands = '#24452f', eraser = '#c8786d', seed = 1 } = {}) {
  const A = 0.355, Rc = A / Math.cos(Math.PI / 6), cone = 0.19, rTip = 0.014, rLead = 0.1, tipX = length;
  const rCone = x => (tipX - x) * cone + rTip;
  // rounded hexagon perimeter, faces centred on 30°, 90°, ... (the 270° face lies on the desk); (sy, sz) = (r sin φ, r cos φ)
  const hex = []; for (let k = 0; k < 6; k++) { const ph = k * Math.PI / 3; hex.push([Rc * Math.sin(ph), Rc * Math.cos(ph)]); }
  const per0 = fillet(hex, 0.05, 4, true); per0.push(per0[0]);
  const { s: ps } = arcParams(per0); const NP = 96, per = [];
  for (let i = 0; i < NP; i++) { const t = i / NP; let k = 1; while (ps[k] < t) k++; const f = (t - ps[k - 1]) / (ps[k] - ps[k - 1]); per.push([per0[k - 1][0] + (per0[k][0] - per0[k - 1][0]) * f, per0[k - 1][1] + (per0[k][1] - per0[k - 1][1]) * f]); }
  per.push(per[0]);
  const xc = tipX - (Rc - rTip) / cone; let xs = [0.02, 2, 5, 8, 11, 14].filter(x => x < xc - 1.2); xs.push(xc - 1, xc - 0.3);
  for (let k = 0; k <= 48; k++) { const t = k / 48; xs.push(xc - 0.05 + (tipX - xc + 0.05) * (t ** 1.15)); }
  xs = [...new Set(xs)].sort((a, b) => a - b);
  const body = grid(NP, xs.length - 1, (u, v, i, j) => {
    const x = xs[j], [sy, sz] = per[i], rho = Math.hypot(sy, sz), k = Math.min(1, rCone(x) / rho);
    return [x, sy * k, sz * k];
  });
  // close the tip with a tiny rounded point
  const tip = new THREE.SphereGeometry(rTip * 1.05, 10, 6); tip.translate(tipX, 0, 0);
  weldSeam(body, NP, xs.length - 1);
  // body uv: u along the length, v around
  const buv = body.attributes.uv; for (let j = 0; j < xs.length; j++) for (let i = 0; i <= NP; i++) buv.setXY(j * (NP + 1) + i, xs[j] / length, i / NP);
  const tuv = tip.attributes.uv; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, 0.9995, 0.5);
  // paint / wood / graphite maps, painted per texel from the same cone so the scallops match the geometry
  const W = 2048, H = 256, r = rngOf(seed);
  const [c, g] = cnv(W, H), [rc, rg] = cnv(W, H), [mc, mg] = cnv(W, H);
  const img = g.createImageData(W, H), rim = rg.createImageData(W, H), mim = mg.createImageData(W, H);
  const pc = new THREE.Color(paint), wc = new THREE.Color('#d9b48a'), wc2 = new THREE.Color('#b98f63'), gc = new THREE.Color('#3a3a3c');
  const grain = Array.from({ length: H }, () => r());
  for (let y = 0; y < H; y++) {
    const i = Math.round((1 - y / (H - 1)) * NP) % NP, [sy, sz] = per[i], rho = Math.hypot(sy, sz);
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5) / W * length, rcx = rCone(X), o = (y * W + x) * 4; let col, rough, metal = 0;
      if (rcx >= rho - 0.002) { col = pc; rough = 0.24 + (r() * 0.03); }
      else if (rcx < rLead) { col = gc; rough = 0.36; }
      else { const gr = 0.5 + 0.5 * Math.sin(grain[y] * 40 + X * 2); col = wc.clone().lerp(wc2, gr * 0.5 + r() * 0.1); rough = 0.72; }
      img.data[o] = col.r ** (1 / 2.2) * 255; img.data[o + 1] = col.g ** (1 / 2.2) * 255; img.data[o + 2] = col.b ** (1 / 2.2) * 255; img.data[o + 3] = 255;
      rim.data[o] = rim.data[o + 1] = rim.data[o + 2] = rough * 255; rim.data[o + 3] = 255; mim.data[o] = mim.data[o + 1] = mim.data[o + 2] = metal; mim.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); rg.putImageData(rim, 0, 0); mg.putImageData(mim, 0, 0);
  // foil stamp on the top face (centred on φ = 90°: v = 0.25 -> canvas row 0.75 H), reading with the point to the right
  const cy = 0.75 * H;
  const stampText = (ctx, style) => { ctx.save(); ctx.translate(W * 0.13, cy); ctx.scale(1, (H / 2.46) / (W / length)); ctx.font = `600 ${0.2 * W / length}px ${SERIF}`; ctx.textBaseline = 'middle'; ctx.fillStyle = style; ctx.letterSpacing = '1px'; ctx.fillText(stamp, 0, 0); ctx.restore(); };
  stampText(g, foil); stampText(rg, foilMetal ? 'rgb(70,70,70)' : 'rgb(110,110,110)'); if (foilMetal) stampText(mg, '#ffffff');
  // a thin second colour ring painted round the end by the ferrule
  if (paint2) { g.fillStyle = paint2; g.fillRect(0, 0, W * 0.012, H); }
  const map = ctex(c), roughnessMap = ctex(rc, { srgb: false }), metalnessMap = ctex(mc, { srgb: false });
  const bodyMat = new THREE.MeshPhysicalMaterial({ map, roughnessMap, metalnessMap, roughness: 1, metalness: 1, clearcoat: 0.5, clearcoatRoughness: 0.12 });
  // ferrule: brass, rolled edges, two crimp grooves, painted bands between
  const fp = fillet([[0.36, -1.06], [0.405, -1.05], [0.42, -1.01], [0.42, -0.84], [0.398, -0.8], [0.398, -0.72], [0.42, -0.68], [0.42, -0.38], [0.398, -0.34], [0.398, -0.26], [0.42, -0.22], [0.42, 0.04], [0.405, 0.075], [0.37, 0.08]], [0, 0.02, 0.02, 0.012, 0.006, 0.006, 0.012, 0.012, 0.006, 0.006, 0.012, 0.02, 0.01, 0], 3);
  const fgeo = lathe(fp, 56); fgeo.rotateZ(-Math.PI / 2); // lathe axis +y -> +x
  const fs = arcParams(fp).s; const [fc, fg] = cnv(4, 512), [frc, frg] = cnv(4, 512), [fmc, fmg] = cnv(4, 512);
  fg.fillStyle = '#d6b066'; fg.fillRect(0, 0, 4, 512); frg.fillStyle = 'rgb(84,84,84)'; frg.fillRect(0, 0, 4, 512); fmg.fillStyle = '#fff'; fmg.fillRect(0, 0, 4, 512);
  for (const [a, b] of [[3, 6], [8, 10]]) { const y0 = (1 - fs[b]) * 512, y1 = (1 - fs[a]) * 512; fg.fillStyle = bands; fg.fillRect(0, y0, 4, y1 - y0); frg.fillStyle = 'rgb(90,90,90)'; frg.fillRect(0, y0, 4, y1 - y0); fmg.fillStyle = '#000'; fmg.fillRect(0, y0, 4, y1 - y0); }
  const ferMat = new THREE.MeshPhysicalMaterial({ map: ctex(fc), roughnessMap: ctex(frc, { srgb: false }), metalnessMap: ctex(fmc, { srgb: false }), roughness: 1, metalness: 1 });
  // eraser, a little worn and rounded
  const ep = fillet([[0, -1.66], [0.3, -1.66], [0.352, -1.6], [0.355, -0.95], [0, -0.95]].reverse(), [0, 0.1, 0.12, 0, 0].reverse(), 6).reverse();
  const egeo = lathe(ep, 40); egeo.rotateZ(-Math.PI / 2);
  const eMat = new THREE.MeshPhysicalMaterial({ color: eraser, roughness: 0.82, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color('#e7a69c'), normalMap: paperNormal(), normalScale: new THREE.Vector2(0.4, 0.4) });

  const pen = new THREE.Group();
  pen.add(mesh(merge([body, tip]), bodyMat, { name: 'pencil' }), mesh(fgeo, ferMat, { name: 'ferrule' }), mesh(egeo, eMat, { name: 'eraser' }));
  // lie on the bottom flat: contacts are the ferrule edge and the flat near the start of the cone
  const xA = tipX - (A - rTip) / cone;
  const { angle } = restTilt([[-1.0, -0.42], [0.04, -0.42], [xA, -A], [tipX, -rTip], [-1.66, -0.3]], length * 0.45);
  pen.rotation.z = angle;
  const content = new THREE.Group(); content.add(pen);
  return finalize(new THREE.Group(), content);
}

// ---------------------------------------------------------------- handwriting
// per-glyph jitter, pressure and a faint feathered under-layer so fountain-pen ink sits in the paper
function writeHand(g, text, x, y, size, { color = INK, seed = 1, slant = -0.03, jitter = 1, alpha = 0.92, font = HAND } = {}) {
  const r = rngOf(seed); g.save(); g.font = `400 ${size}px ${font}`; g.textBaseline = 'alphabetic';
  const glyphs = []; let cx = x;
  for (const ch of text) { const w = g.measureText(ch).width; glyphs.push([ch, cx + (r() - 0.5) * size * 0.015 * jitter, y + (r() - 0.5) * size * 0.04 * jitter, slant + (r() - 0.5) * 0.04 * jitter, 0.84 + r() * 0.16]); cx += w * (0.98 + r() * 0.03); }
  for (const pass of [0, 1]) for (const [ch, gx, gy, rot, p] of glyphs) {
    g.save(); g.translate(gx, gy); g.rotate(rot); g.fillStyle = color;
    if (pass === 0) { g.globalAlpha = alpha * 0.22 * p; g.filter = `blur(${size * 0.012}px)`; g.fillText(ch, 0, 0); }
    else { g.globalAlpha = alpha * p; g.filter = 'none'; g.fillText(ch, 0, 0); }
    g.restore();
  }
  g.restore(); return cx;
}
// a hand-drawn arrow / tick as an ink stroke
function inkStroke(g, pts, w, color = INK, alpha = 0.9) { g.save(); g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore(); }
function arrow(g, x, y, len, w, color = INK) { inkStroke(g, [[x, y], [x + len * 0.5, y - len * 0.03], [x + len, y + len * 0.01]], w, color); inkStroke(g, [[x + len * 0.78, y - len * 0.16], [x + len * 1.01, y + len * 0.01], [x + len * 0.76, y + len * 0.17]], w, color); }
function paperGrain(g, W, H, seed, a = 0.06) {
  const r = rngOf(seed); const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
  g.putImageData(img, 0, 0);
  // faint mottling
  for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * H, R = W * (0.05 + r() * 0.2); const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(120,95,50,${0.012 + r() * 0.02})`); gr.addColorStop(1, 'rgba(120,95,50,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }
}
const tiledNormal = (rep) => { const t = paperNormal().clone(); t.repeat.set(rep, rep); t.needsUpdate = true; return t; };

// ================================================================= INDEX CARDS
// a stack of 3 x 5 in ruled cards, slightly askew; the top card carries the note
function indexCards() {
  const W = 12.7, D = 7.62, T = 0.024, n = 26, r = rngOf(4);
  const shape = new THREE.Shape(roundRect(W, D, 0.18, 3).map(([x, y]) => new THREE.Vector2(x, y)));
  const base = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 3 }); base.rotateX(-Math.PI / 2);
  const geos = [];
  for (let i = 0; i < n; i++) {
    const c = base.clone(); const odd = i === 7 || i === 15;
    c.rotateY((r() - 0.5) * (odd ? 0.09 : 0.03)); c.translate((r() - 0.5) * (odd ? 0.9 : 0.16) + (odd ? 0.5 : 0), i * T, (r() - 0.5) * (odd ? 0.4 : 0.12));
    const tone = 0.95 + r() * 0.05, col = new Float32Array(c.attributes.position.count * 3).fill(tone); c.setAttribute('color', new THREE.BufferAttribute(col, 3)); geos.push(c.index ? c.toNonIndexed() : c);
  }
  const stackGeo = mergeGeometries(geos, false);
  const stackMat = new THREE.MeshStandardMaterial({ color: '#f1ebdd', vertexColors: true, roughness: 0.92, metalness: 0, normalMap: tiledNormal(1 / 6), normalScale: new THREE.Vector2(0.25, 0.25) });
  // the top card: ruled, with the note in ink
  const PX = 160, [c, g] = cnv(Math.round(W * PX), Math.round(D * PX));
  g.fillStyle = '#f4efe3'; g.fillRect(0, 0, c.width, c.height); paperGrain(g, c.width, c.height, 41, 0.05);
  g.strokeStyle = 'rgba(196,58,58,.72)'; g.lineWidth = 0.022 * PX; g.beginPath(); g.moveTo(0, 1.55 * PX); g.lineTo(c.width, 1.55 * PX); g.stroke();
  g.strokeStyle = 'rgba(92,132,190,.42)'; g.lineWidth = 0.014 * PX; for (let y = 2.19; y < D - 0.3; y += 0.635) { g.beginPath(); g.moveTo(0, y * PX); g.lineTo(c.width, y * PX); g.stroke(); }
  const S = 0.66 * PX;
  const e1 = writeHand(g, 'Case IV: minimax,', 0.55 * PX, 1.36 * PX, S, { seed: 3 });
  inkStroke(g, [[0.55 * PX, 1.47 * PX], [0.55 * PX + (e1 - 0.55 * PX) * 0.38, 1.455 * PX]], 0.03 * PX, INK, 0.8);
  writeHand(g, 'alpha-beta pruning', 0.85 * PX, 2.79 * PX, S, { seed: 5 });
  const e3 = writeHand(g, 'next', 0.85 * PX, 4.06 * PX, S, { seed: 7 });
  arrow(g, e3 + 0.18 * PX, 3.88 * PX, 0.95 * PX, 0.032 * PX);
  const cardMap = ctex(c);
  const top = new THREE.PlaneGeometry(W, D, 48, 30); top.rotateX(-Math.PI / 2);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const k = sstep(0.35, 1, (x / (W / 2) + z / (D / 2)) / 2); p.setY(i, 0.11 * k * k); }
  top.computeVertexNormals();
  const topMesh = mesh(top, new THREE.MeshStandardMaterial({ map: cardMap, roughness: 0.9, metalness: 0, normalMap: tiledNormal(1), normalScale: new THREE.Vector2(0.25, 0.25) }), { name: 'topCard' });
  // tile the fibre normal in cm across the top card
  topMesh.material.normalMap.repeat.set(W / 6, D / 6);
  topMesh.position.set(0.12, n * T + 0.0015, -0.05); topMesh.rotation.y = 0.035;
  const content = new THREE.Group(); content.add(mesh(stackGeo, stackMat, { name: 'stack' }), topMesh);
  return finalize(new THREE.Group(), content);
}

// ================================================================= LEGAL PAD
// yellow legal pad, chipboard back, maroon gummed binding; the top sheet's front-right corner lifts in a gentle curl
const PAD_LINES = ['suspects:', ' BFS — fewest steps', ' UCS — cheapest', ' A* — cheapest, 5 looks', '', 'motive: f = g + h', 'h never overestimates', '→ admissible ✓'];
function legalPad() {
  const W = 21.6, D = 30.5, back = 0.11, block = 0.5, bindD = 2.3, PX = 72;
  const rule = 0.87, top0 = 3.3; // first rule (cm from top) and spacing
  const ruled = (write) => {
    const [c, g] = cnv(Math.round(W * PX), Math.round(D * PX));
    g.fillStyle = '#f3dc66'; g.fillRect(0, 0, c.width, c.height); paperGrain(g, c.width, c.height, write ? 61 : 62, 0.045);
    g.strokeStyle = 'rgba(84,120,176,.5)'; g.lineWidth = 0.02 * PX;
    for (let y = top0; y < D - 0.4; y += rule) { g.beginPath(); g.moveTo(0, y * PX); g.lineTo(c.width, y * PX); g.stroke(); }
    g.strokeStyle = 'rgba(205,64,58,.62)'; g.lineWidth = 0.022 * PX; for (const x of [3.15, 3.32]) { g.beginPath(); g.moveTo(x * PX, 0); g.lineTo(x * PX, c.height); g.stroke(); }
    if (write) {
      const S = 0.84 * PX; let k = 0;
      PAD_LINES.forEach((line, i) => {
        if (!line) return; const y = (top0 + rule * (i + 1)) * PX - 0.12 * PX; let x = 3.7 * PX + (line.startsWith(' ') ? 0.7 * PX : 0); let txt = line.trim();
        if (txt.startsWith('→')) { arrow(g, x, y - 0.24 * PX, 0.95 * PX, 0.045 * PX, '#1f2943'); x += 1.35 * PX; txt = txt.slice(1).trim(); }
        const tick = txt.endsWith('✓'); if (tick) txt = txt.slice(0, -1).trim();
        const end = writeHand(g, txt, x, y, S, { seed: 11 + (k++) * 7, color: '#1f2943', alpha: 0.97 });
        if (tick) inkStroke(g, [[end + 0.3 * PX, y - 0.3 * PX], [end + 0.52 * PX, y - 0.04 * PX], [end + 1.1 * PX, y - 0.85 * PX]], 0.05 * PX, '#1f2943');
        if (i === 0) inkStroke(g, [[x, y + 0.14 * PX], [end, y + 0.11 * PX]], 0.04 * PX, '#1f2943', 0.85);
      });
      // A* circled as the answer
      const yA = (top0 + rule * 4) * PX - 0.12 * PX; g.save(); g.strokeStyle = '#1f2943'; g.globalAlpha = 0.8; g.lineWidth = 0.04 * PX; g.beginPath(); g.ellipse(4.92 * PX, yA - 0.28 * PX, 0.82 * PX, 0.52 * PX, -0.05, 0.3, Math.PI * 2 + 0.15); g.stroke(); g.restore();
    }
    return ctex(c);
  };
  const sheetMat = new THREE.MeshStandardMaterial({ map: ruled(true), roughness: 0.88, metalness: 0, normalMap: tiledNormal(1), normalScale: new THREE.Vector2(0.3, 0.3) });
  sheetMat.normalMap.repeat.set(W / 6, D / 6);
  const sheetBack = new THREE.MeshStandardMaterial({ color: '#efdc7a', roughness: 0.9, metalness: 0, side: THREE.BackSide });
  const underMat = new THREE.MeshStandardMaterial({ map: ruled(false), roughness: 0.9, metalness: 0 });
  // sheet edges seen on the sides of the block
  const [ec, eg] = cnv(8, 256); eg.fillStyle = '#e9d67a'; eg.fillRect(0, 0, 8, 256); for (let y = 0; y < 256; y += 5) { eg.fillStyle = `rgba(120,95,30,${0.18 + Math.random() * 0.1})`; eg.fillRect(0, y, 8, 1); }
  const edgeTex = ctex(ec, { wrap: true }); edgeTex.repeat.set(1, 1);
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.95, metalness: 0 });
  const blockGeo = new THREE.BoxGeometry(W - 0.04, block, D - bindD + 0.3); blockGeo.translate(0, back + block / 2, (bindD - 0.3) / 2);
  const blockMesh = mesh(blockGeo, [edgeMat, edgeMat, underMat, edgeMat, edgeMat, edgeMat], { name: 'block' });
  // the visible part of the block's top shows the sheet beneath, so re-map its top uvs to the pad's coordinates
  const buv = blockGeo.attributes.uv, bpos = blockGeo.attributes.position;
  for (let i = 8; i < 12; i++) buv.setXY(i, (bpos.getX(i) + W / 2) / W, 1 - (bpos.getZ(i) + D / 2) / D);
  const chip = mesh(new RoundedBoxGeometry(W, back, D, 2, 0.03), new THREE.MeshStandardMaterial({ color: '#7d6f5c', roughness: 0.95, metalness: 0, normalMap: tiledNormal(1), normalScale: new THREE.Vector2(0.8, 0.8) }), { name: 'chipboard' });
  chip.material.normalMap.repeat.set(4, 6); chip.position.y = back / 2;
  // binding: gummed tape wrapped over the head of the pad
  const bind = mesh(new RoundedBoxGeometry(W + 0.04, back + block + 0.1, bindD, 3, 0.07), new THREE.MeshPhysicalMaterial({ color: '#5e1915', roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, normalMap: tiledNormal(1), normalScale: new THREE.Vector2(0.4, 0.4) }), { name: 'binding' });
  bind.material.normalMap.repeat.set(4, 0.5); bind.position.set(0, (back + block + 0.1) / 2, -D / 2 + bindD / 2);
  // the top sheet, tucked under the binding, with a cylindrical curl at the front-right corner
  const z0 = -D / 2 + bindD - 0.25, sh = new THREE.PlaneGeometry(W, D / 2 - z0, 72, 96); sh.rotateX(-Math.PI / 2); sh.translate(0, 0, (z0 + D / 2) / 2);
  const sp = sh.attributes.position, suv = sh.attributes.uv; const R = 13, cx = W / 2, cz = D / 2, Dd = 7.5; // fold line through the points Dd from the corner
  const nrm = new V3(1, 0, 1).normalize(); const lineD = (cx - Dd) * nrm.x + cz * nrm.z; // n . p = lineD on the fold line
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), z = sp.getZ(i); suv.setXY(i, (x + W / 2) / W, 1 - (z + D / 2) / D);
    const s = x * nrm.x + z * nrm.z - lineD; if (s <= 0) { sp.setY(i, 0); continue; }
    const a = s / R; sp.setXYZ(i, x - nrm.x * (s - R * Math.sin(a)), R * (1 - Math.cos(a)), z - nrm.z * (s - R * Math.sin(a)));
  }
  sh.computeVertexNormals(); const topY = back + block + 0.004;
  const sheet = mesh(sh, sheetMat, { name: 'topSheet' }), sheetB = mesh(sh, sheetBack, { name: 'topSheetBack' }); sheet.position.y = sheetB.position.y = topY;
  const content = new THREE.Group(); content.add(chip, blockMesh, bind, sheet, sheetB);
  return finalize(new THREE.Group(), content);
}

// ================================================================= SPOOL OF RED THREAD
function spool(M) {
  // turned beech, waxed; end-grain rings on the flanges come from a radial texture
  const [wc, wg] = cnv(512, 512); wg.fillStyle = '#b9925f'; wg.fillRect(0, 0, 512, 512); const r = rngOf(17);
  for (let y = 0; y < 512; y++) { const k = 0.5 + 0.5 * Math.sin(y * 0.21 + Math.sin(y * 0.031) * 4); wg.fillStyle = `rgba(110,70,30,${0.06 + k * 0.12})`; wg.fillRect(0, y, 512, 1); }
  for (let k = 0; k < 900; k++) { wg.fillStyle = `rgba(80,50,20,${r() * 0.12})`; wg.fillRect(r() * 512, r() * 512, 1 + r() * 30, 1); }
  const woodMat = new THREE.MeshPhysicalMaterial({ map: ctex(wc, { wrap: true }), roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const wp = fillet([[0.42, 0.04], [0.5, 0.0], [2.18, 0.0], [2.35, 0.14], [2.35, 0.34], [2.2, 0.46], [1.32, 0.52], [1.16, 0.62], [1.16, 4.0], [1.32, 4.1], [2.2, 4.16], [2.35, 4.28], [2.35, 4.48], [2.18, 4.62], [0.5, 4.62], [0.42, 4.58], [0.42, 0.04]],
    [0, 0.03, 0.06, 0.05, 0.05, 0.04, 0.1, 0.08, 0.08, 0.1, 0.04, 0.05, 0.05, 0.06, 0.03, 0.02, 0], 4);
  const woodGeo = lathe(wp, 96);
  // thread: wound cylinder; colour, height (-> normal) and roughness from a helix of round strands, with a cross-wound top layer
  const N = 1024, NW = 150; const H = new Float32Array(N * N), [tc, tg] = cnv(N, N); const img = tg.createImageData(N, N);
  const lay = valueNoise(N, 19, [[3, 0.7], [9, 0.3]]); const wrapTone = Array.from({ length: NW * 2 + 2 }, () => 0.86 + r() * 0.2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = 1 - y / N; const ph = v * NW + u, f = ph - Math.floor(ph), h1 = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
    const ph2 = v * NW * 0.5 - u * 5, f2 = ph2 - Math.floor(ph2), h2 = Math.sqrt(Math.max(0, 1 - (2 * f2 - 1) ** 2));
    const top = sstep(0.55, 0.62, lay[y * N + x]); const h = h1 * (1 - top) + (0.6 + 0.6 * h2) * top;
    const tone = (top > 0.5 ? wrapTone[Math.floor(ph2) & 255] : wrapTone[Math.floor(ph) % wrapTone.length]) * (0.55 + 0.45 * (top > 0.5 ? h2 : h1));
    H[y * N + x] = h * 1.2; const i = (y * N + x) * 4; img.data[i] = Math.min(255, 138 * tone); img.data[i + 1] = Math.min(255, 20 * tone); img.data[i + 2] = Math.min(255, 18 * tone); img.data[i + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  const threadMat = new THREE.MeshPhysicalMaterial({ map: ctex(tc), normalMap: normalFromHeight(H, N, 1.6), roughness: 0.68, metalness: 0, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#c8463a') });
  const tp = fillet([[1.2, 0.47], [1.86, 0.47], [1.95, 0.6], [1.975, 2.31], [1.95, 4.02], [1.86, 4.15], [1.2, 4.15]], [0, 0.06, 0.1, 0, 0.1, 0.06, 0], 4);
  const threadGeo = lathe(tp, 96);
  // paper label on the top flange
  const [lc, lg] = cnv(1024, 1024); lg.translate(512, 512);
  const TAU = Math.PI * 2;
  lg.fillStyle = '#e9dfc4'; lg.beginPath(); lg.arc(0, 0, 510, 0, TAU); lg.fill();
  lg.fillStyle = '#7f1712'; lg.beginPath(); lg.arc(0, 0, 500, 0, TAU); lg.arc(0, 0, 440, 0, TAU, true); lg.fill();
  lg.fillStyle = '#1d1a16'; lg.beginPath(); lg.arc(0, 0, 232, 0, TAU); lg.arc(0, 0, 196, 0, TAU, true); lg.fill();
  lg.font = `700 54px ${SERIF}`; lg.fillStyle = '#1d1a16'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
  const around = (txt, R, a0, sp, ctx = lg) => { let a = a0; for (const ch of txt) { const w = ctx.measureText(ch).width / R * sp; ctx.save(); ctx.rotate(a + w / 2); ctx.translate(0, -R); ctx.fillText(ch, 0, 0); ctx.restore(); a += w; } };
  lg.fillStyle = '#efe6cf'; lg.font = `700 44px ${SERIF}`; around('SIX CORD LINEN THREAD  ·  FAST COLOUR  ·  SIX CORD LINEN THREAD  ·  FAST COLOUR  ·', 470, 0, 1.0);
  lg.fillStyle = '#1d1a16'; lg.font = `700 96px ${SERIF}`; lg.fillText('No 40', 0, -318); lg.font = `600 60px ${SERIF}`; lg.fillText('100 YDS', 0, 330);
  lg.globalCompositeOperation = 'destination-out'; lg.beginPath(); lg.arc(0, 0, 0.5 / 2.0 * 512, 0, 7); lg.fill();
  const label = new THREE.RingGeometry(0.5, 2.0, 96, 1); label.rotateX(-Math.PI / 2); label.translate(0, 4.623, 0);
  const luv = label.attributes.uv, lpos = label.attributes.position; for (let i = 0; i < luv.count; i++) luv.setXY(i, 0.5 + lpos.getX(i) / 4.0, 0.5 - lpos.getZ(i) / 4.0);
  const labelMat = new THREE.MeshStandardMaterial({ map: ctex(lc), roughness: 0.75, metalness: 0, transparent: false, alphaTest: 0.5 });
  // loose end: leaves the barrel tangentially, clears the flange and curls on the desk
  const ph0 = 0.55, R0 = 1.975; const rad = new V3(Math.sin(ph0), 0, Math.cos(ph0)), tan = new V3(Math.cos(ph0), 0, -Math.sin(ph0));
  const P = (rr, y, t = 0) => rad.clone().multiplyScalar(rr).add(tan.clone().multiplyScalar(t)).setY(y);
  const tail = new THREE.CatmullRomCurve3([P(R0 - 0.01, 1.25, -0.25), P(R0 + 0.02, 1.15, 0.2), P(R0 + 0.35, 0.95, 0.75), P(2.7, 0.62, 1.1), P(3.15, 0.2, 1.35), P(3.5, 0.036, 1.6), P(4.3, 0.036, 2.2), P(5.4, 0.036, 2.0), P(6.1, 0.036, 1.1), P(6.5, 0.036, 0.4)], false, 'centripetal');
  const tailGeo = new THREE.TubeGeometry(tail, 160, 0.034, 8);
  const content = new THREE.Group();
  content.add(mesh(woodGeo, woodMat, { name: 'spool' }), mesh(threadGeo, threadMat, { name: 'thread' }), mesh(label, labelMat, { name: 'label' }), mesh(tailGeo, new THREE.MeshPhysicalMaterial({ color: '#7e1712', roughness: 0.65, sheen: 0.5, sheenColor: new THREE.Color('#c8463a') }), { name: 'tail' }));
  return finalize(new THREE.Group(), content, { threadEnd: tail.getPointAt(1) });
}

// ================================================================= TIN OF PUSH PINS
function pinTin(M) {
  const R = 2.78;
  const tp = fillet([[0, 0], [R, 0], [R + 0.02, 1.6], [R + 0.08, 1.64], [R + 0.08, 1.73], [R + 0.02, 1.78], [R - 0.04, 1.72], [R - 0.04, 0.06], [0, 0.06]], [0, 0.1, 0.03, 0.025, 0.025, 0.025, 0.02, 0.05, 0], 4);
  const wall0 = arcAtY(tp, 1.56), wall1 = arcAtY(tp, 0.14);
  // lithographed outer wall: deep red with a gold legend; inside and bottom bare tinplate
  const [c, g] = cnv(2048, 1024), [mc, mg] = cnv(2048, 1024);
  g.fillStyle = '#d4d6d8'; g.fillRect(0, 0, 2048, 1024); mg.fillStyle = '#fff'; mg.fillRect(0, 0, 2048, 1024);
  const y0 = (1 - wall0) * 1024, y1 = (1 - wall1) * 1024; g.fillStyle = '#651612'; g.fillRect(0, y0, 2048, y1 - y0); mg.fillStyle = '#000'; mg.fillRect(0, y0, 2048, y1 - y0);
  g.fillStyle = mg.fillStyle = '#d7b46a'; mg.fillStyle = '#fff';
  for (const ctx of [g, mg]) { ctx.save(); ctx.fillStyle = ctx === g ? '#d7b46a' : '#fff'; ctx.fillRect(0, y0 + 10, 2048, 4); ctx.fillRect(0, y1 - 14, 2048, 4); ctx.font = `700 ${(y1 - y0) * 0.36}px ${SERIF}`; ctx.textBaseline = 'middle'; const txt = 'PUSH PINS  ·  STEEL POINTS  ·  100  ·  '; let x = 10; while (x < 2048) { ctx.fillText(txt, x, (y0 + y1) / 2 + 2); x += ctx.measureText(txt).width; } ctx.restore(); }
  const tinMat = new THREE.MeshPhysicalMaterial({ map: ctex(c), metalnessMap: ctex(mc, { srgb: false }), metalness: 1, roughness: 1, roughnessMap: M.tin.roughnessMap, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const tin = mesh(lathe(tp, 128), tinMat, { name: 'tin' });
  // lid lying beside it, label up
  const L = R + 0.13;
  const lp = fillet([[0, 0.74], [L - 0.06, 0.74], [L - 0.06, 0.06], [L - 0.02, 0.0], [L + 0.03, 0.06], [L + 0.03, 0.72], [L - 0.06, 0.82], [0, 0.82]], [0, 0.03, 0.03, 0.02, 0.03, 0.06, 0.08, 0], 4);
  const lid = new THREE.Group(); lid.position.set(R + L + 0.55, 0, 0.8);
  lid.add(mesh(lathe(lp, 128), M.tin, { name: 'lid' }));
  const [lc, lg] = cnv(1024, 1024), [lmc, lmg] = cnv(1024, 1024); lg.translate(512, 512); lmg.translate(512, 512);
  const disc = (ctx, rr, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); };
  disc(lg, 512, '#d7b46a'); disc(lmg, 512, '#fff'); disc(lg, 470, '#651612'); disc(lmg, 470, '#000'); disc(lg, 330, '#d7b46a'); disc(lmg, 330, '#fff'); disc(lg, 318, '#efe4c6'); disc(lmg, 318, '#000');
  lg.textAlign = lmg.textAlign = 'center'; lg.textBaseline = lmg.textBaseline = 'middle';
  const around = (ctx, txt, rr, a0, font, col) => { ctx.font = font; ctx.fillStyle = col; const total = [...txt].reduce((s, ch) => s + ctx.measureText(ch).width / rr, 0); let a = a0 - total / 2; for (const ch of txt) { const w = ctx.measureText(ch).width / rr; ctx.save(); ctx.rotate(a + w / 2); ctx.translate(0, -rr); ctx.fillText(ch, 0, 0); ctx.restore(); a += w; } };
  const aroundBottom = (ctx, txt, rr, font, col) => { ctx.font = font; ctx.fillStyle = col; const total = [...txt].reduce((s, ch) => s + ctx.measureText(ch).width / rr, 0); let a = total / 2; for (const ch of txt) { const w = ctx.measureText(ch).width / rr; ctx.save(); ctx.rotate(a - w / 2); ctx.translate(0, rr); ctx.fillText(ch, 0, 0); ctx.restore(); a -= w; } };
  for (const [ctx, gold, ink] of [[lg, '#d7b46a', '#1a1612'], [lmg, '#fff', '#000']]) {
    around(ctx, 'STEEL POINT · GLASS HEAD', 405, 0, `700 70px ${SERIF}`, gold);
    aroundBottom(ctx, 'MADE IN U.S.A.', 430, `700 52px ${SERIF}`, gold);
    ctx.fillStyle = ink === '#000' ? '#000' : '#651612'; ctx.font = `700 132px ${SERIF}`; ctx.fillText('PUSH', 0, -70); ctx.fillText('PINS', 0, 70);
    ctx.fillStyle = ink; ctx.font = `400 54px ${TYPE}`; ctx.fillText('— 100 —', 0, 200);
  }
  const lidTop = new THREE.CircleGeometry(L - 0.12, 96); lidTop.rotateX(-Math.PI / 2); lidTop.translate(0, 0.8215, 0);
  const lu = lidTop.attributes.uv, lpos = lidTop.attributes.position; for (let i = 0; i < lu.count; i++) lu.setXY(i, 0.5 + lpos.getX(i) / (2 * (L - 0.12)), 0.5 - lpos.getZ(i) / (2 * (L - 0.12)));
  lid.add(mesh(lidTop, new THREE.MeshPhysicalMaterial({ map: ctex(lc), metalnessMap: ctex(lmc, { srgb: false }), metalness: 1, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.12 }), { name: 'lidLabel' }));
  lid.rotation.y = 0.6;

  // pins: glass-headed map pins dropped into the tin one by one so none passes through another
  const headR = 0.2, needleL = 1.15, beta = Math.asin(headR / needleL), r = rngOf(23);
  const placed = []; const els = []; // spheres [x, y, z, r]
  const elOffsets = [[0, headR]].concat([0.32, 0.5, 0.68, 0.86, 1.04].map(t => [t, 0.036]));
  const inner = R - 0.04, floor = 0.06, pins = [];
  const tryPlace = (cx, cz, yaw, inside) => {
    const d = new V3(Math.cos(yaw) * Math.cos(beta), -Math.sin(beta), Math.sin(yaw) * Math.cos(beta));
    const local = elOffsets.map(([t, rr]) => [d.x * t, d.y * t, d.z * t, rr]);
    let y = 0; for (const [ex, ey, ez, rr] of local) y = Math.max(y, (inside ? floor : 0) + rr - ey);
    for (const [ex, ey, ez, rr] of local) for (const [px, py, pz, pr] of els) { const dx = cx + ex - px, dz = cz + ez - pz, dd = Math.hypot(dx, dz), R2 = rr + pr; if (dd < R2) y = Math.max(y, py + Math.sqrt(R2 * R2 - dd * dd) - ey); }
    if (inside) for (const [ex, ey, ez, rr] of local) if (Math.hypot(cx + ex, cz + ez) + rr > inner - 0.01 || y + ey + rr > 1.3) return null;
    return { pos: new V3(cx, y, cz), d, local };
  };
  const cols = ['#b5161a', '#b5161a', '#b5161a', '#c21e1e', '#ece6da', '#1b1b1b', '#d7a21e', '#1f3f8a'];
  for (let k = 0; k < 600 && pins.length < 30; k++) {
    const a = r() * 6.283, rr = Math.sqrt(r()) * (inner - 0.3), p = tryPlace(Math.cos(a) * rr, Math.sin(a) * rr, r() * 6.283, true);
    if (!p) continue; pins.push({ ...p, col: cols[(r() * cols.length) | 0] }); for (const [ex, ey, ez, er] of p.local) els.push([p.pos.x + ex, p.pos.y + ey, p.pos.z + ez, er]);
  }
  // a few strays on the desk in front of the tin
  for (const [x, z, yaw, col] of [[1.4, 4.1, 2.6, '#b5161a'], [-2.9, 3.4, 0.25, '#b5161a'], [3.9, 3.4, 1.9, '#ece6da']]) { const p = tryPlace(x, z, yaw, false); pins.push({ ...p, col }); }
  const headGeo = new THREE.SphereGeometry(headR, 24, 16);
  const needleGeo = lathe(fillet([[0, -needleL], [0.012, -needleL + 0.06], [0.032, -needleL + 0.2], [0.032, -0.12], [0, -0.1]], [0, 0.01, 0.03, 0, 0], 3), 12);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, ior: 1.5 }), pins.length);
  const needles = new THREE.InstancedMesh(needleGeo, M.steel, pins.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new V3(1, 1, 1), col = new THREE.Color();
  pins.forEach((p, i) => { q.setFromUnitVectors(new V3(0, -1, 0), p.d); m4.compose(p.pos, q, one); heads.setMatrixAt(i, m4); needles.setMatrixAt(i, m4); heads.setColorAt(i, col.set(p.col)); });
  // two brass thumb tacks, point up
  const tackGeo = merge([lathe(fillet([[0, 0], [0.47, 0], [0.5, 0.035], [0.46, 0.07], [0.12, 0.095], [0, 0.1]], [0, 0.02, 0.02, 0.05, 0.03, 0], 3), 40), lathe([[0.032, 0.09], [0.03, 0.7], [0.012, 0.8], [0, 0.84]], 10)]);
  const tacks = new THREE.InstancedMesh(tackGeo, M.brassSatin, 2);
  [[-3.7, 1.4, 0], [-0.6, 5.3, 0]].forEach(([x, z], i) => tacks.setMatrixAt(i, m4.compose(new V3(x, 0, z), q.identity(), one)));
  const content = new THREE.Group(); content.add(tin, lid, heads, needles, tacks);
  return finalize(new THREE.Group(), content);
}

// ================================================================= BRASS ALARM CLOCK (Poly Haven: alarm_clock_01, recoloured to brass)
// hands rotate about the dial's axis; tick() sets them from the system clock with a real one-second step
function handRig(root, names, faceN) {
  const up = new V3(0, 1, 0).addScaledVector(faceN, -faceN.y).normalize(), out = {};
  for (const [key, name] of Object.entries(names)) {
    const node = root.getObjectByName(name); if (!node) continue;
    node.geometry.computeBoundingBox(); const c = node.geometry.boundingBox.getCenter(new V3()); node.updateMatrix(); c.applyMatrix4(node.matrix).sub(node.position);
    c.addScaledVector(faceN, -c.dot(faceN)).normalize();
    const th0 = Math.atan2(faceN.dot(new V3().crossVectors(up, c)), up.dot(c));
    const pivot = new THREE.Group(); pivot.position.copy(node.position); node.parent.add(pivot); node.position.set(0, 0, 0); pivot.add(node);
    out[key] = { pivot, th0 };
  }
  const q = new THREE.Quaternion();
  const set = (key, frac) => { const h = out[key]; if (h) h.pivot.quaternion.copy(q.setFromAxisAngle(faceN, -frac * Math.PI * 2 - h.th0)); };
  const easeBack = k => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
  return () => {
    const d = new Date(), ms = d.getMilliseconds(); const s = d.getSeconds() - 1 + (ms < 90 ? easeBack(ms / 90) : 1);
    const H = d.getHours(), m = d.getMinutes() + d.getSeconds() / 60, h = ((H >= 20 || H < 5 ? H : 23) % 12) + m / 60; // always some hour of the night
    set('s', s / 60); set('m', m / 60); set('h', h / 12);
  };
}
function alarmClock(gltf) {
  const root = gltf.scene.clone(true); root.scale.setScalar(100);
  root.traverse(o => { if (o.isMesh && o.material.name.toLowerCase().includes('glass')) { o.userData.noCast = true; o.material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 0, ior: 1.5, specularIntensity: 1 }); } });
  const body = root.getObjectByName('alarm_clock_01'); const faceN = new V3(1, 0, 0).applyQuaternion(body.quaternion).normalize();
  const tick = handRig(root, { h: 'houd_hand', m: 'minute_hand', s: 'second_hand' }, faceN);
  const content = new THREE.Group(); content.add(root); tick(); content.updateMatrixWorld(true);
  let glass = null; root.traverse(o => { if (o.isMesh && o.material.transmission === 1) glass = o; });
  const face = new THREE.Box3().setFromObject(glass).getCenter(new V3()); // centre of the dial glass, content space
  const out = finalize(new THREE.Group(), content, { face });
  out.userData.faceNormal = faceN.clone(); out.userData.tick = tick; return out;
}

// ================================================================= EXTRAS
// round wire spectacles (Poly Haven: round_spectacles), open, resting on the rims and the temple tips
function spectacles(gltf) {
  const root = gltf.scene.clone(true); root.scale.setScalar(100);
  root.traverse(o => { if (o.isMesh && o.material.name.endsWith('glass')) { o.userData.noCast = true; o.material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.2, ior: 1.5, specularIntensity: 1 }); } });
  // temples run toward -z; turn them to +x to find the resting tilt, then turn back
  const a = new THREE.Group(), b = new THREE.Group(); a.add(root); b.add(a); a.rotation.y = -Math.PI / 2; b.updateMatrixWorld(true);
  const pts = [], v = new V3(); root.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); pts.push([v.x, v.y]); } } });
  const box = new THREE.Box3().setFromObject(b); const { angle } = restTilt(pts, (box.min.x + box.max.x) / 2 - 2);
  b.rotation.z = angle; const c = new THREE.Group(); c.add(b); b.rotation.order = 'XYZ'; c.rotation.y = Math.PI / 2;
  const content = new THREE.Group(); content.add(c); return finalize(new THREE.Group(), content);
}
// brass open-face pocket watch (Poly Haven: pocket_watch), lying face up with the bow away from the viewer; it runs
function pocketWatch(gltf) {
  const root = gltf.scene.clone(true);
  root.traverse(o => { if (o.isMesh && o.material.name.endsWith('glass')) { o.userData.noCast = true; o.material = o.material.clone(); Object.assign(o.material, { transparent: true, opacity: 0.16, roughness: 0.03, depthWrite: false }); o.renderOrder = 2; } });
  const tick = handRig(root, { h: 'pocket_watch_hand_hours', m: 'pocket_watch_hand_minutes', s: 'pocket_watch_hand_secondes' }, new V3(0, 0, 1)); tick();
  const lay = new THREE.Group(); lay.add(root); root.scale.setScalar(100); root.rotation.x = -Math.PI / 2;
  const content = new THREE.Group(); content.add(lay);
  const out = finalize(new THREE.Group(), content); out.userData.tick = tick; return out;
}
// 1940s lever-filler fountain pen, capped: black celluloid, gold-filled clip and bands, lying clip up
function fountainPen(M) {
  const prof = fillet([[0, 0], [0.24, 0], [0.44, 0.16], [0.5, 0.55], [0.5, 0.95], [0.565, 1.6], [0.575, 6.98], [0.562, 7.03], [0.6, 7.06], [0.636, 7.2], [0.645, 7.5], [0.648, 11.0], [0.625, 12.2], [0.56, 13.05], [0.44, 13.45], [0.26, 13.6], [0, 13.62]],
    [0, 0.12, 0.25, 0.2, 0.2, 0.3, 0, 0.01, 0.01, 0.06, 0.1, 0.6, 0.6, 0.3, 0.15, 0.1, 0], 6);
  const body = lathe(prof, 72);
  const ring = (y0, y1, rr) => lathe(fillet([[rr - 0.04, y0], [rr, y0 + 0.01], [rr, y1 - 0.01], [rr - 0.04, y1]], [0, 0.015, 0.015, 0], 2), 72);
  const gold = [ring(7.55, 7.76, 0.662), ring(7.86, 7.93, 0.66), ring(0.8, 0.93, 0.512), ring(12.75, 12.95, 0.612)];
  // clip
  const rAt = y => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const a = prof[i - 1], b = prof[i]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1] || 1); } return 0; };
  const cpts = [[12.85, 0.0], [12.55, 0.07], [12.0, 0.1], [10.5, 0.1], [9.2, 0.09], [8.75, 0.07]].map(([y, h]) => new V3(rAt(y) + 0.045 + h, y, 0));
  const clip = sweep(new THREE.CatmullRomCurve3(cpts, false, 'centripetal'), 60, roundRect(0.09, 0.34, 0.035, 3), { up: new V3(0, 0, 1), scale: t => 1 - 0.18 * t });
  const ball = new THREE.SphereGeometry(0.13, 20, 12); ball.scale(1, 1.25, 1); ball.translate(rAt(8.6) + 0.11, 8.6, 0);
  gold.push(clip, ball);
  const cell = new THREE.MeshPhysicalMaterial({ color: '#0b0b0c', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, normalMap: M.peel, normalScale: new THREE.Vector2(0.03, 0.03) });
  const pen = new THREE.Group(); pen.add(mesh(body, cell, { name: 'celluloid' }), mesh(merge(gold), M.gold, { name: 'gold' }));
  // lathe axis (y) -> x, clip (+x) -> up
  pen.rotation.z = Math.PI / 2;
  const sil = prof.map(([r, y]) => [-y, -r]);
  const { angle } = restTilt(sil, -6.9); const tiltG = new THREE.Group(); tiltG.add(pen); tiltG.rotation.z = angle;
  const content = new THREE.Group(); content.add(tiltG); content.rotation.y = Math.PI; // cap toward +x
  const wrap = new THREE.Group(); wrap.add(content); return finalize(new THREE.Group(), wrap);
}
// a cream laid-paper envelope, back up, flap sealed with red wax and stamped CONFIDENTIAL
function envelope() {
  const W = 23.5, D = 10.5, T = 0.16, PX = 100, r = rngOf(31);
  const [c, g] = cnv(W * PX, D * PX); g.fillStyle = '#e9dec4'; g.fillRect(0, 0, c.width, c.height); paperGrain(g, c.width, c.height, 33, 0.04);
  g.strokeStyle = 'rgba(150,130,90,.07)'; g.lineWidth = 1; for (let y = 0; y < c.height; y += 0.1 * PX) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = 'rgba(150,130,90,.09)'; for (let x = 0.6 * PX; x < c.width; x += 2.5 * PX) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  // height field for the folds: flap and side seams sit a sheet higher
  const N = 1024, HW = N, HH = Math.round(N * D / W); const [hc, hg] = cnv(HW, HH); hg.fillStyle = '#000'; hg.fillRect(0, 0, HW, HH);
  const fy = 5.6, side = [[0, D], [W * 0.33, D * 0.42], [W * 0.67, D * 0.42], [W, D]];
  const flap = [[0.15, 0], [W / 2 - 0.9, fy - 0.35], [W / 2, fy], [W / 2 + 0.9, fy - 0.35], [W - 0.15, 0]];
  const path = (ctx, pts, s) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); };
  hg.fillStyle = '#444'; path(hg, side, HW / W); hg.closePath(); hg.fill(); hg.fillStyle = '#888'; path(hg, flap, HW / W); hg.closePath(); hg.fill();
  hg.filter = 'blur(1px)'; hg.drawImage(hc, 0, 0); const hd = hg.getImageData(0, 0, HW, HH).data;
  const Hf = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const yy = Math.min(HH - 1, Math.round(y * HH / N)); Hf[y * N + x] = hd[(yy * HW + x) * 4] / 255 * 3; }
  // painted shading under the fold edges
  const edge = (pts, a) => { g.save(); g.strokeStyle = `rgba(80,60,30,${a})`; g.lineWidth = 0.05 * PX; g.filter = 'blur(2px)'; path(g, pts, PX); g.stroke(); g.restore(); g.save(); g.strokeStyle = 'rgba(255,250,235,.35)'; g.lineWidth = 0.02 * PX; path(g, pts.map(([x, y]) => [x, y - 0.02]), PX); g.stroke(); g.restore(); };
  edge(side.slice(0, 2), 0.22); edge(side.slice(2), 0.22); edge(flap, 0.3);
  // rubber stamp
  const [stc, stg] = cnv(6 * PX, 1.6 * PX); stg.translate(3 * PX, 0.8 * PX); stg.strokeStyle = stg.fillStyle = '#9b1c1a'; stg.lineWidth = 0.06 * PX;
  stg.strokeRect(-2.6 * PX, -0.55 * PX, 5.2 * PX, 1.1 * PX); stg.font = `400 ${0.62 * PX}px ${TYPE}`; stg.textAlign = 'center'; stg.textBaseline = 'middle'; stg.fillText('CONFIDENTIAL', 0, 0.04 * PX);
  stg.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 1400; k++) { stg.globalAlpha = r() * 0.6; stg.fillRect((r() - 0.5) * 5.6 * PX, (r() - 0.5) * 1.3 * PX, 1 + r() * 4, 1 + r() * 3); }
  g.save(); g.translate(W * 0.73 * PX, D * 0.72 * PX); g.rotate(-0.09); g.globalAlpha = 0.6; g.globalCompositeOperation = 'multiply'; g.drawImage(stc, -3 * PX, -0.8 * PX); g.restore();
  const paper = ctex(c);
  const geo = new RoundedBoxGeometry(W, T, D, 2, 0.05); const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, 1 - (pos.getZ(i) + D / 2) / D);
  const nm = normalFromHeight(Hf, N, 2.5); nm.wrapS = nm.wrapT = THREE.ClampToEdgeWrapping;
  const env = mesh(geo, new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9, metalness: 0, normalMap: nm, normalScale: new THREE.Vector2(1, 1) }), { name: 'envelope' });
  env.position.y = T / 2;
  // wax seal: an irregular blob with a raised rim and an impressed eight-pointed star
  const R0 = 1.4, NS = 96, NR = 26; const wob = Array.from({ length: 7 }, () => [r() * 6.28, 0.03 + r() * 0.05]);
  const Rt = th => R0 * (1 + wob.reduce((s, [p, a], k) => s + a * Math.sin((k + 2) * th + p), 0));
  const seal = grid(NS, NR, (u, v) => {
    const th = u * Math.PI * 2, rr = Rt(th) * Math.min(1, v * 1.02), q = v;
    let h = 0.3 * Math.sqrt(Math.max(0, 1 - q ** 8)); h -= 0.07 * sstep(0.78, 0.7, q); h += 0.03 * sstep(0.6, 0.76, q) * sstep(0.9, 0.78, q);
    return [Math.sin(th) * rr, Math.max(0.0, h), Math.cos(th) * rr];
  });
  weldSeam(seal, NS, NR);
  const suv = seal.attributes.uv, spos = seal.attributes.position; for (let i = 0; i < suv.count; i++) suv.setXY(i, 0.5 + spos.getX(i) / (2.4 * R0), 0.5 - spos.getZ(i) / (2.4 * R0));
  const SN = 512; const [ec, eg] = cnv(SN, SN); eg.fillStyle = '#000'; eg.fillRect(0, 0, SN, SN); eg.translate(SN / 2, SN / 2); const ks = SN / (2.4 * R0);
  eg.strokeStyle = '#fff'; eg.lineWidth = 0.06 * ks; eg.beginPath(); eg.arc(0, 0, 0.88 * ks, 0, 7); eg.stroke();
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; eg.fillStyle = '#fff'; eg.beginPath(); eg.arc(Math.cos(a) * 0.76 * ks, Math.sin(a) * 0.76 * ks, 0.035 * ks, 0, 7); eg.fill(); }
  eg.fillStyle = '#fff'; eg.beginPath(); for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8, rr = (k % 2 ? 0.27 : 0.6) * ks; k ? eg.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : eg.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } eg.closePath(); eg.fill();
  eg.fillStyle = '#000'; eg.beginPath(); eg.arc(0, 0, 0.12 * ks, 0, 7); eg.fill();
  const ed = eg.getImageData(0, 0, SN, SN).data, EH = new Float32Array(SN * SN); for (let i = 0; i < SN * SN; i++) EH[i] = ed[i * 4] / 255;
  // soften the relief
  const EH2 = new Float32Array(SN * SN); for (let y = 0; y < SN; y++) for (let x = 0; x < SN; x++) { let s = 0, n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= SN || yy >= SN) continue; s += EH[yy * SN + xx]; n++; } EH2[y * SN + x] = s / n * 6; }
  const sealN = normalFromHeight(EH2, SN, 1); sealN.wrapS = sealN.wrapT = THREE.ClampToEdgeWrapping;
  const sealMesh = mesh(seal, new THREE.MeshPhysicalMaterial({ color: '#7c1512', roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.18, normalMap: sealN, normalScale: new THREE.Vector2(1, 1), sheen: 0.2, sheenColor: new THREE.Color('#d0483f') }), { name: 'seal' });
  sealMesh.position.set(0, T - 0.01, -D / 2 + fy - 0.55); sealMesh.rotation.y = 0.2;
  const content = new THREE.Group(); content.add(env, sealMesh); return finalize(new THREE.Group(), content);
}

// ================================================================= ENTRY POINT
export async function loadProps(renderer) {
  ANISO = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  if (typeof document !== 'undefined' && document.fonts) await Promise.all(['400 64px "Caveat"', '400 40px "Special Elite"', '600 40px "Playfair Display"', '700 40px "Playfair Display"'].map(f => document.fonts.load(f).catch(() => {})));
  const M = materials();
  const [clk, specs, watch] = await Promise.all([
    loadGLTF('models/alarm_clock_01/alarm_clock_01.gltf'),
    loadGLTF('models/round_spectacles/round_spectacles.gltf'), loadGLTF('models/pocket_watch/pocket_watch.gltf'),
  ]);
  return {
    lamp: bankersLamp(M),
    mug: cupAndSaucer(M),
    magnifier: magnifier(M),
    pencilA: pencil(M, { length: 17.4, paint: '#d6a021', foil: '#1f2a20', foilMetal: false, stamp: 'DRAFTSMAN  ·  No. 2  ·  HB', bands: '#24452f', seed: 1 }),
    pencilB: pencil(M, { length: 12.6, paint: '#1d3a2b', foil: '#d8b25c', stamp: 'MERIDIAN  ·  2B  ·  DRAWING', bands: '#7a1c18', eraser: '#b9665e', seed: 2 }),
    cardStack: indexCards(),
    legalPad: legalPad(),
    spool: spool(M),
    pinTin: pinTin(M),
    clock: alarmClock(clk),
    spectacles: spectacles(specs),
    pocketWatch: pocketWatch(watch),
    fountainPen: fountainPen(M),
    envelope: envelope(),
  };
}
