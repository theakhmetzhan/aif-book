// Paper pop-ups. Built in face coords: x → right, y ↑ height above the page, z = v (down the page).
// Every element is a child Group whose scale.y is driven by the rise factor, so it folds flat onto the page.
import * as THREE from 'three';
import { C, FIG11, G, HEIGHT_H, A_ORDER, A_FRONTIER, HILL, fHill, tierTop } from './pages.js';
import { grainTile, star8Points } from './paper.js';
import { SERIF, INK } from './typeset.js';

let grainTex;
const mats = {};
function paper(color, { side = THREE.DoubleSide } = {}) {
  const k = color + side; if (mats[k]) return mats[k];
  if (!grainTex) { grainTex = new THREE.CanvasTexture(grainTile(256, 21)); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(0.5, 0.5); grainTex.colorSpace = THREE.SRGBColorSpace; }
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side, bumpMap: grainTex, bumpScale: 0.6 });
  return (mats[k] = m);
}
const shadowy = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// flat layer from polygon(s) in (x, v), top at height y
export function layer(outer, holes = [], y = 0.5, th = 0.05, color = C.cream) {
  const s = new THREE.Shape(outer.map(([x, v]) => new THREE.Vector2(x, v)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, v]) => new THREE.Vector2(x, v))));
  const geo = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(Math.PI / 2); geo.translate(0, y, 0); // shape (x,v) → (x, y, v); extrudes downward from y
  return shadowy(new THREE.Mesh(geo, paper(color)));
}
const circlePts = (cx, cv, r, n = 40) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * r, cv + Math.sin(i / n * Math.PI * 2) * r]);
const starPts = (cx, cv, R, rot = 0, ratio) => star8Points(R, ratio).map(([x, v]) => [cx + x * Math.cos(rot) - v * Math.sin(rot), cv + x * Math.sin(rot) + v * Math.cos(rot)]);

function labelTexture(draw, w, h, ppu = 160) {
  const c = document.createElement('canvas'); c.width = Math.round(w * ppu); c.height = Math.round(h * ppu);
  draw(c.getContext('2d'), ppu, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a disc with a printed top
function disc(x, v, r, y, th, color, label, labelColor = INK) {
  const g = new THREE.Group();
  const side = paper(color);
  let topMat = side;
  if (label) {
    const tex = labelTexture((c, p, w, h) => {
      c.fillStyle = color; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = .5; c.fillStyle = c.createPattern(grainTile(256, 21), 'repeat'); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.translate(-w / 2, -h / 2);
      c.fillStyle = labelColor; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `600 ${label.length > 1 ? r * 0.85 * p : r * 1.15 * p}px ${SERIF}`; c.fillText(label, w / 2, h / 2 + r * 0.06 * p);
    }, r * 2, r * 2);
    topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  }
  const geo = new THREE.CylinderGeometry(r, r, th, 48);
  const m = new THREE.Mesh(geo, [side, topMat, side]); m.position.set(x, y - th / 2, v);
  // cylinder top cap UVs map the disc; rotate so text reads upright from above (v down = -z screen up?)
  m.rotation.y = 0; g.add(shadowy(m)); return g;
}
function column(x, v, r, h, color = C.cream) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16, 1, true), paper(color)); m.position.set(x, h / 2, v); return shadowy(m);
}
// ribbon along 3D points (x, y, v), width horizontal; flat side faces up
function ribbon(pts, width, color, th = 0.02) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const N = Math.max(24, pts.length * 24), pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N), t = curve.getTangent(i / N);
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(width / 2);
    pos.push(p.x + side.x, p.y, p.z + side.z, p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y - th, p.z + side.z, p.x - side.x, p.y - th, p.z - side.z);
    if (i < N) { const a = i * 4, b = a + 4; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2, a, a + 2, b, a + 2, b + 2, b, a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return shadowy(new THREE.Mesh(geo, paper(color)));
}
// straight strip between two 3D points
const strip = (a, b, w, color, th = 0.03) => ribbon([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], w, color, th);
function arrowHead(tip, from, size, y, color, th = 0.04) {
  const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const p = a => [tip[0] - Math.cos(ang + a) * size, tip[1] - Math.sin(ang + a) * size];
  return layer([tip, p(-0.45), p(0.45)], [], y, th, color);
}
// a box card with printed top
function card(x0, x1, v0, v1, h, color, drawTop, th = 0.06) {
  const g = new THREE.Group(); const w = x1 - x0, d = v1 - v0;
  const tex = labelTexture((c, p, W, H) => {
    c.fillStyle = color; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = .55; c.fillStyle = c.createPattern(grainTile(256, 21), 'repeat'); c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    drawTop(c, p, W, H);
  }, w, d, 150);
  const side = paper(color), top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, bumpMap: grainTex, bumpScale: 0.5 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), [side, side, top, side, side, side]);
  m.position.set(x0 + w / 2, h - th / 2, v0 + d / 2); g.add(shadowy(m));
  // folded side walls (pop-up supports), slightly inset so they stay hidden from above
  const wallMat = paper(color);
  for (const [ax, av, bx, bv] of [[x0 + 0.15, v0 + 0.15, x1 - 0.15, v0 + 0.15], [x0 + 0.15, v1 - 0.15, x1 - 0.15, v1 - 0.15]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax, h - th), wallMat); wall.position.set((ax + bx) / 2, (h - th) / 2, av); g.add(shadowy(wall));
  }
  return g;
}

// -------- builders --------
export const BUILDERS = {
  titleMedallion() {
    const root = new THREE.Group(); const cx = 7, cv = 6.6;
    root.add(part(layer(starPts(cx, cv, 2.75), [circlePts(cx, cv, 1.0, 48)], 0.22, 0.05, C.kraft), 0));
    root.add(part(layer(starPts(cx, cv, 2.1, Math.PI / 8), [starPts(cx, cv, 1.25, Math.PI / 8)], 0.55, 0.05, C.indigo), 1));
    root.add(part(layer(starPts(cx, cv, 1.25), [circlePts(cx, cv, 0.42, 48)], 0.9, 0.05, C.cream), 2));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2; root.add(part(column(cx + Math.cos(a) * 1.55, cv + Math.sin(a) * 1.55, 0.06, 0.55, C.kraft), 0)); root.add(part(column(cx + Math.cos(a + Math.PI / 8) * 1.05, cv + Math.sin(a + Math.PI / 8) * 1.05, 0.05, 0.9, C.indigo), 1)); }
    return root;
  },
  coverMedallion() {
    const root = new THREE.Group(); const cx = 7.25, cv = 6.9;
    root.add(part(layer(starPts(cx, cv, 3.0), [starPts(cx, cv, 2.35)], 0.05, 0.04, C.ochre), 0));
    root.add(part(layer(starPts(cx, cv, 2.2, Math.PI / 8), [circlePts(cx, cv, 1.25, 48)], 0.1, 0.04, C.cream), 0));
    root.add(part(layer(starPts(cx, cv, 1.1), [], 0.15, 0.04, C.ochre), 0));
    return root;
  },
  agentLoop() {
    const root = new THREE.Group(); const F = FIG11;
    const env = card(F.env.x0, F.env.x1, F.env.v0, F.env.v1, F.env.h, C.kraft, (c, p, W, H) => {
      c.fillStyle = 'rgba(42,34,25,.85)'; c.font = `600 ${0.3 * p}px ${SERIF}`; c.letterSpacing = 0.08 * p + 'px'; c.textAlign = 'center'; c.fillText('ENVIRONMENT', W / 2, H - 0.32 * p);
    });
    root.add(part(env, 0));
    // steppe hills on the environment card: three wavy paper bands
    const band = (v0, amp, y, col, ph) => { const pts = []; for (let i = 0; i <= 40; i++) { const x = F.env.x0 + 0.25 + (F.env.x1 - F.env.x0 - 0.5) * i / 40; pts.push([x, v0 + Math.sin(i / 40 * Math.PI * 2.2 + ph) * amp]); } pts.push([F.env.x1 - 0.25, F.env.v1 - 0.75], [F.env.x0 + 0.25, F.env.v1 - 0.75]); return layer(pts, [], y, 0.04, col); };
    root.add(part(band(F.env.v0 + 0.55, 0.22, F.env.h + 0.18, C.sage, 0.4), 1));
    root.add(part(band(F.env.v0 + 1.15, 0.2, F.env.h + 0.36, C.ochre, 1.9), 1));
    root.add(part(band(F.env.v0 + 1.75, 0.16, F.env.h + 0.54, C.cream, 3.1), 1));
    const ag = card(F.agent.x0, F.agent.x1, F.agent.v0, F.agent.v1, F.agent.h, C.indigo, (c, p, W, H) => {
      c.fillStyle = '#efe4cc'; c.textAlign = 'center'; c.font = `600 ${0.3 * p}px ${SERIF}`; c.letterSpacing = 0.08 * p + 'px'; c.fillText('AGENT', W / 2, 0.55 * p);
      c.letterSpacing = '0px'; c.font = `italic 400 ${0.34 * p}px ${SERIF}`; c.fillText('agent program', W / 2, H - 0.42 * p);
      c.strokeStyle = 'rgba(239,228,204,.6)'; c.lineWidth = 0.03 * p; c.beginPath(); c.arc(W / 2, H / 2, 0.62 * p, 0, 7); c.stroke();
      c.font = `500 ${0.6 * p}px ${SERIF}`; c.textBaseline = 'middle'; c.fillText('?', W / 2, H / 2 + 0.03 * p);
    });
    root.add(part(ag, 2));
    // arrows: ramps between the two card heights
    const ramp = (pts, h0, h1, col) => {
      const L = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
      let acc = 0; const out = [[pts[0][0], h0 + 0.03, pts[0][1]]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, av] = pts[i - 1], [bx, bv] = pts[i]; const seg = Math.hypot(bx - ax, bv - av);
        for (let s = 1; s <= 8; s++) { const t = s / 8, d = acc + seg * t, k = d / L; out.push([ax + (bx - ax) * t, h0 + (h1 - h0) * (k * k * (3 - 2 * k)) + 0.03 + Math.sin(k * Math.PI) * 0.25, av + (bv - av) * t]); }
        acc += seg;
      }
      const g = new THREE.Group(); g.add(ribbon(out.slice(0, -2), 0.16, col, 0.03));
      const n = pts.length; g.add(arrowHead(pts[n - 1], pts[n - 2], 0.42, h1 + 0.06, col)); return g;
    };
    root.add(part(ramp(F.percept, F.env.h, F.agent.h, C.terracotta), 3));
    root.add(part(ramp(F.action, F.agent.h, F.env.h, C.indigo), 3));
    return root;
  },
  graphH() { return graphPopup(true); },
  graphA() { return graphPopup(false); },
  hills() {
    const root = new THREE.Group();
    HILL.levels.forEach((L, i) => {
      const y = tierTop(i); const t = i / (HILL.levels.length - 1);
      const col = new THREE.Color(C.kraft).lerp(new THREE.Color(C.white), t).getStyle();
      for (const loop of L.loops) root.add(part(layer(loop, [], y, HILL.th, col), i * 0.6));
    });
    // hill-climb paths as small discs sitting on the tier under each point
    const on = (x, v) => { const f = fHill(x, v); const idx = Math.floor(f) - 2; return idx >= 0 ? tierTop(Math.min(idx, HILL.levels.length - 1)) : 0; };
    const path = (P, col) => P.forEach(([x, v], k) => { const y = on(x, v); root.add(part(disc(x, v, k === 0 ? 0.13 : 0.075, y + 0.025, 0.025, col), 6 + k * 0.12)); });
    path(HILL.local, C.indigo); path(HILL.global, C.terracotta);
    return root;
  },
};

function graphPopup(heur) {
  const root = new THREE.Group();
  const hOf = n => heur ? HEIGHT_H(n) : 0.45;
  for (const n of G.nodes) {
    const h = hOf(n);
    let col = C.cream, label = n.id, lc = INK;
    if (!heur) {
      if (A_ORDER[n.id]) { col = C.ochre; label = `${n.id}${A_ORDER[n.id].k}`; }
      else if (A_FRONTIER[n.id]) { col = C.white; }
      else { col = '#cfc6b5'; lc = '#8a8070'; }
    }
    const g = new THREE.Group(); g.add(column(n.x, n.v, 0.12, h - 0.05, C.kraft)); g.add(disc(n.x, n.v, 0.42, h, 0.05, col, label, lc));
    if (!heur && A_FRONTIER[n.id]) { const ring = layer(circlePts(n.x, n.v, 0.42, 48), [circlePts(n.x, n.v, 0.34, 48)], h + 0.012, 0.012, INK); g.add(ring); }
    root.add(part(g, heur ? (12 - n.h) * 0.15 : (A_ORDER[n.id]?.k ?? 7) * 0.4));
  }
  for (const [a, b] of G.edges) {
    const A = G.by[a], B = G.by[b];
    const dx = B.x - A.x, dv = B.v - A.v, L = Math.hypot(dx, dv), ux = dx / L, uv = dv / L;
    const p0 = [A.x + ux * 0.4, hOf(A) - 0.06, A.v + uv * 0.4], p1 = [B.x - ux * 0.4, hOf(B) - 0.06, B.v - uv * 0.4];
    root.add(part(strip(p0, p1, 0.09, C.kraft, 0.02), 1.5));
  }
  if (!heur) { // raised path ribbon: one arch per step, springing from the disc rims
    const P = G.astar.path.map(id => G.by[id]);
    P.forEach((n, i) => {
      if (!i) return; const m = P[i - 1]; const dx = n.x - m.x, dv = n.v - m.v, L = Math.hypot(dx, dv), ux = dx / L, uv = dv / L;
      const a = [m.x + ux * 0.5, m.v + uv * 0.5], b = [n.x - ux * 0.5, n.v - uv * 0.5], pts = [];
      for (let s = 0; s <= 16; s++) { const t = s / 16; pts.push([a[0] + (b[0] - a[0]) * t, 0.47 + Math.sin(t * Math.PI) * 0.8, a[1] + (b[1] - a[1]) * t]); }
      root.add(part(ribbon(pts, 0.2, C.terracotta, 0.025), 5 + i * 0.5));
    });
  }
  return root;
}

// wrap an element so it can fold: delay = stagger order
function part(obj, delay = 0) { const g = new THREE.Group(); g.add(obj); g.userData.delay = delay; return g; }

// set rise 0..1 for a popup root built above
export function setRise(root, r) {
  root.visible = r > 0.002;
  let maxD = 0; for (const c of root.children) maxD = Math.max(maxD, c.userData.delay || 0);
  for (const c of root.children) {
    const d = (c.userData.delay || 0) / (maxD || 1); // 0..1
    const k = Math.min(1, Math.max(0, (r - d * 0.45) / 0.55));
    const e = k < 1 ? 1 - Math.pow(1 - k, 3) * (1 - 0.0 * k) : 1;
    c.scale.y = Math.max(0.002, e); c.visible = k > 0.001;
  }
}
