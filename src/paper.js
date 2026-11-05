import { T } from './theme.js';
// Procedural paper, cloth and ornament. Abstract geometry only.
const cache = {};
export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// tileable grain: mottling + fibres + fine noise; returned as a canvas (neutral grey around 128 for overlay use)
export function grainTile(size = 512, seed = 1) {
  const key = 'g' + size + seed; if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const r = rng(seed);
  const img = g.createImageData(size, size), d = img.data;
  // value noise, tileable, 3 octaves
  const oct = [[8, 0.5], [32, 0.3], [128, 0.2]];
  const grids = oct.map(([n]) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; });
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    oct.forEach(([n, w], k) => {
      const gx = x / size * n, gy = y / size * n, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
      const G = grids[k], at = (i, j) => G[((j % n) * n) + (i % n)];
      const a = at(x0, y0), b = at(x0 + 1, y0), cc = at(x0, y0 + 1), dd = at(x0 + 1, y0 + 1);
      v += w * (a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy);
    });
    const n = (v - 0.5) * 34 + (r() - 0.5) * 16;
    const i = (y * size + x) * 4; d[i] = d[i + 1] = d[i + 2] = 128 + n; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibres
  g.globalAlpha = 0.07; g.lineWidth = 1;
  for (let k = 0; k < size * 0.9; k++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 6 + r() * 26;
    g.strokeStyle = r() > 0.5 ? '#fff' : '#000'; g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - .5) * 6, y + Math.sin(a) * l * 0.5 + (r() - .5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1;
  return (cache[key] = c);
}

// fill a rect with paper base + grain (overlay)
export function paperFill(g, w, h, base = '#f1e8d6', strength = 0.55, seed = 1) {
  g.fillStyle = base; g.fillRect(0, 0, w, h); paperGrain(g, w, h, strength, seed);
}
// the paper's grain, over whatever is there: laid over print, the fibres run through the ink
export function paperGrain(g, w, h, strength = 0.55, seed = 1) {
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = strength;
  g.fillStyle = g.createPattern(grainTile(512, seed), 'repeat'); g.fillRect(0, 0, w, h); g.restore();
}

// soft page shading: gutter darkening + edge falloff (side: 'left'|'right' = which side the spine is on)
export function pageShade(g, w, h, spine) {
  const grd = spine === 'left' ? g.createLinearGradient(0, 0, w * 0.12, 0) : g.createLinearGradient(w, 0, w * 0.88, 0);
  const tint = T.name === 'noir' ? '70,45,15' : '30,32,36'; grd.addColorStop(0, `rgba(${tint},.26)`); grd.addColorStop(0.35, `rgba(${tint},.07)`); grd.addColorStop(1, `rgba(${tint},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  e.addColorStop(0, `rgba(${tint},0)`); e.addColorStop(1, `rgba(${tint},${T.name === 'noir' ? .14 : .05})`);
  g.fillStyle = e; g.fillRect(0, 0, w, h);
}

// eight-pointed star (two squares at 45°) path, centred at x,y, outer radius R
export function star8(g, x, y, R, inner = null) {
  const pts = [];
  const ratio = inner ?? 0.765;
  for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8; const r = k % 2 ? R * ratio : R; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath();
  return pts;
}
export function star8Points(R, innerRatio = 0.765) {
  const pts = []; for (let k = 0; k < 16; k++) { const a = -Math.PI / 2 + k * Math.PI / 8; const r = k % 2 ? R * innerRatio : R; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts;
}

// the inside of a board, over what is printed on its endpaper: the cover's cloth turned in over the three outer edges and mitred at the corners, and the paper pasted down
// short of them, open at the spine edge, where it runs on into the joint
export function pastedown(g, S, w, h, spine) {
  const t = 0.3 * S, cut = 0.72 * S, sx = spine === 'left' ? 0 : w, fx = w - sx, d = sx ? 1 : -1, px = fx + d * t, cx = fx + d * cut; // how much cloth the paper leaves showing; where the cloth's cut edge lies under the paper; the spine and fore-edge sides; d runs in from the fore-edge
  const line = (pts, style, lw) => { g.strokeStyle = style; g.lineWidth = lw * S; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const fade = (x0, y0, x1, y1, rgba) => { const f = g.createLinearGradient(x0, y0, x1, y1); f.addColorStop(0, `rgba(${rgba})`); f.addColorStop(1, `rgba(${rgba.replace(/[^,]+$/, '0')})`); g.fillStyle = f; g.fillRect(0, 0, w, h); };
  // the paper takes the shape of that cut edge, a ridge the light only just finds, and dips as it leaves the board for the joint
  for (const [o, style] of [[-0.015 * S, 'rgba(255,240,210,.09)'], [0.015 * S, 'rgba(40,20,8,.1)']]) line([[sx, cut + o], [cx + o, cut + o], [cx + o, h - cut + o], [sx, h - cut + o]], style, 0.03);
  fade(sx, 0, sx - d * 0.7 * S, 0, '70,45,15,.3');
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.rect(Math.min(sx, px), t, w - t, h - 2 * t); g.clip('evenodd'); clothFill(g, w, h, T.cloth);
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 0.1 * S], [0, h, 0, h - 0.1 * S], [fx, 0, fx + d * 0.1 * S, 0]]) fade(x0, y0, x1, y1, '255,205,170,.16'); // the cloth rounds over the board's edge
  for (const [y, iy] of [[0, t], [h, h - t]]) { line([[fx, y], [px, iy]], 'rgba(18,5,3,.7)', 0.02); line([[fx + d * 0.02 * S, y], [px + d * 0.02 * S, iy]], 'rgba(255,205,170,.14)', 0.012); }
  g.restore();
  const rim = [[sx, t], [px, t], [px, h - t], [sx, h - t]]; line(rim, 'rgba(18,5,3,.6)', 0.03); line(rim, 'rgba(255,240,210,.3)', 0.008); // the shade the paper throws on the cloth, and its own cut edge
}

// book cloth: woven texture
export function clothFill(g, w, h, base = '#26304f') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(5); g.globalAlpha = 0.08;
  for (let y = 0; y < h; y += 3) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 3) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.fillRect(x, 0, 1, h); }
  g.globalAlpha = 1;
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(grainTile(512, 3), 'repeat'); g.fillRect(0, 0, w, h); g.restore();
}

export function goldGradient(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#b8893a'); gr.addColorStop(0.35, '#f0d48a'); gr.addColorStop(0.55, '#c99a45'); gr.addColorStop(0.8, '#e9c877'); gr.addColorStop(1, '#a87a30');
  return gr;
}

// page-edge stripes for the page block sides
export function edgeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = T.paper; g.fillRect(0, 0, 64, 256); const r = rng(11);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(110,85,50,${0.06 + r() * 0.12})`; g.fillRect(0, y, 64, 1); }
  return c;
}
