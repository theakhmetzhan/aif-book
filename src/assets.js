// Shared asset loading and the PBR surface materials of the room (desk wood, leather blotter, wall, cork, paper).
// Units are centimetres. Every factory returns a material whose maps are already tiled for the given size, assuming the
// mesh's UVs run 0..1 across that size (true for PlaneGeometry and for the top face of a BoxGeometry).
// Downloaded files live in public/assets/ (see public/assets/CREDITS.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const ASSETS = (import.meta.env?.BASE_URL ?? '/') + 'assets/';
const texLoader = new THREE.TextureLoader();
export const gltfLoader = new GLTFLoader();
const cache = new Map();

/** Load a texture under public/assets/ once; `srgb` for colour maps only. */
export function loadTexture(path, { srgb = false, anisotropy = 8 } = {}) {
  const key = path + (srgb ? '#s' : '');
  if (!cache.has(key)) cache.set(key, texLoader.loadAsync(ASSETS + path).then(t => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; return t;
  }));
  return cache.get(key);
}
/** Load a glTF under public/assets/ once; returns the parsed gltf (clone its scene before use). */
export function loadGLTF(path) {
  if (!cache.has(path)) cache.set(path, gltfLoader.loadAsync(ASSETS + path));
  return cache.get(path);
}

// a copy of a texture with its own tiling; the image is shared, so the GPU upload is too
function tiled(t, rx, ry, rot = 0) {
  const c = t.clone(); c.repeat.set(rx, ry); c.rotation = rot; c.center.set(0.5, 0.5); c.needsUpdate = true; return c;
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rngOf = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// tangent-space normal map (as a CanvasTexture) from a wrapped height field
export function normalFromHeight(H, N, strength = 2) {
  const [c, g] = canvas(N, N); const img = g.createImageData(N, N), d = img.data;
  const at = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    // canvas y runs down, texture v runs up: flip dy for an OpenGL-style (+y up) normal map
    const nx = -dx, ny = dy, nz = 1, l = Math.hypot(nx, ny, nz); const i = (y * N + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}
// tileable value noise, octaves summed, in 0..1
export function valueNoise(N, seed, octaves = [[4, 0.5], [16, 0.3], [64, 0.2]]) {
  const r = rngOf(seed), out = new Float32Array(N * N); const sm = t => t * t * (3 - 2 * t);
  for (const [n, w] of octaves) {
    const G = new Float32Array(n * n); for (let i = 0; i < G.length; i++) G[i] = r();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x / N * n, gy = y / N * n, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0);
      const a = G[(y0 % n) * n + x0 % n], b = G[(y0 % n) * n + (x0 + 1) % n], c = G[((y0 + 1) % n) * n + x0 % n], d = G[((y0 + 1) % n) * n + (x0 + 1) % n];
      out[y * N + x] += w * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
    }
  }
  return out;
}

// ---------- procedural maps ----------
// worn varnish: a clear-coat roughness map with wipe marks, fine scratches and the odd smudge (tiles every 60 cm)
function varnishWear(seed = 7) {
  const N = 1024, [c, g] = canvas(N, N), r = rngOf(seed);
  const base = valueNoise(N, seed, [[3, 0.6], [12, 0.4]]); const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = 34 + base[i] * 30; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const wrap = (f) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); f(); g.restore(); } };
  // circular wipe marks from a polishing cloth
  g.lineCap = 'round';
  g.filter = 'blur(6px)';
  for (let k = 0; k < 18; k++) { const x = r() * N, y = r() * N, R = 30 + r() * 120; wrap(() => { g.strokeStyle = `rgba(255,255,255,${0.012 + r() * 0.018})`; g.lineWidth = 10 + r() * 20; g.beginPath(); g.ellipse(x, y, R, R * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * (0.6 + r() * 0.6)); g.stroke(); }); }
  g.filter = 'none';
  // hairline scratches: short, faint, mostly along the grain
  for (let k = 0; k < 900; k++) { const x = r() * N, y = r() * N, a = (r() - 0.5) * (r() > 0.75 ? 3 : 0.5), l = 3 + r() ** 3 * 50; wrap(() => { g.strokeStyle = `rgba(255,255,255,${0.025 + r() * 0.07})`; g.lineWidth = 0.5 + r() * 0.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }); }
  // a few dull smudges
  for (let k = 0; k < 9; k++) { const x = r() * N, y = r() * N, R = 18 + r() * 50; wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(255,255,255,${0.08 + r() * 0.08})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - R, y - R, 2 * R, 2 * R); }); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}

// open-grain pores telegraphing through old varnish: short dashes along u (the desk's grain direction), 12 cm tile
function poreNormal(seed = 3) {
  const N = 512, r = rngOf(seed), H = valueNoise(N, seed + 1, [[4, 0.6], [16, 0.4]]);
  for (let i = 0; i < H.length; i++) H[i] *= 0.4;
  for (let k = 0; k < 2600; k++) { const x0 = r() * N, y = Math.floor(r() * N), l = 3 + r() * 14, d = 0.4 + r() * 0.6; for (let s = 0; s < l; s++) { const x = Math.floor(x0 + s) % N; H[y * N + x] -= d * Math.sin(Math.PI * s / l); } }
  return normalFromHeight(H, N, 0.9);
}

// cork: pressed granules of varied tone with dark pores; returns { map, normalMap, roughnessMap } for a 25 cm tile
function corkMaps(seed = 11) {
  const N = 1024, r = rngOf(seed);
  const H = new Float32Array(N * N), C = new Float32Array(N * N * 3); const owner = new Float32Array(N * N).fill(-1);
  const noise = valueNoise(N, seed + 3, [[6, 0.5], [24, 0.3], [96, 0.2]]);
  for (let i = 0; i < N * N; i++) { const n = noise[i]; H[i] = 0.2 + n * 0.1; C[i * 3] = 0.42 + n * 0.1; C[i * 3 + 1] = 0.27 + n * 0.07; C[i * 3 + 2] = 0.15 + n * 0.05; }
  const tones = [[0.56, 0.37, 0.21], [0.5, 0.32, 0.18], [0.6, 0.41, 0.24], [0.45, 0.28, 0.15], [0.64, 0.45, 0.27], [0.4, 0.25, 0.13]];
  const G = 42000; // granules, 0.8-3 mm across at 51 px/cm
  for (let k = 0; k < G; k++) {
    const cx = r() * N, cy = r() * N, R = 2.0 + r() ** 2.2 * 6.0, e = 0.55 + r() * 0.45, a = r() * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    const tone = tones[(r() * tones.length) | 0], j = 0.9 + r() * 0.2, h0 = 0.45 + r() * 0.55;
    const ir = Math.ceil(R) + 1;
    for (let dy = -ir; dy <= ir; dy++) for (let dx = -ir; dx <= ir; dx++) {
      const u = (dx * ca + dy * sa) / R, v = (-dx * sa + dy * ca) / (R * e); const q = u * u + v * v; if (q > 1) continue;
      const x = ((Math.round(cx) + dx) % N + N) % N, y = ((Math.round(cy) + dy) % N + N) % N, i = y * N + x;
      const h = h0 * Math.sqrt(1 - q) * 0.6 + 0.35; if (h < H[i]) continue;
      H[i] = h; owner[i] = k; const sh = 0.93 + 0.07 * Math.sqrt(1 - q);
      C[i * 3] = tone[0] * j * sh; C[i * 3 + 1] = tone[1] * j * sh; C[i * 3 + 2] = tone[2] * j * sh;
    }
  }
  // pores and old pin holes
  for (let k = 0; k < 3200; k++) {
    const cx = r() * N, cy = r() * N, R = 0.8 + r() * (k < 300 ? 2.2 : 1.3);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const q = (dx * dx + dy * dy) / (R * R); if (q > 1) continue; const i = (((Math.round(cy) + dy) % N + N) % N) * N + ((Math.round(cx) + dx) % N + N) % N; H[i] -= 0.35 * (1 - q); C[i * 3] *= 0.45; C[i * 3 + 1] *= 0.42; C[i * 3 + 2] *= 0.4; }
  }
  const [c, g] = canvas(N, N); const img = g.createImageData(N, N);
  const [rc, rg] = canvas(N, N); const rimg = rg.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    img.data[i * 4] = Math.min(255, C[i * 3] ** (1 / 1.0) * 255); img.data[i * 4 + 1] = Math.min(255, C[i * 3 + 1] * 255); img.data[i * 4 + 2] = Math.min(255, C[i * 3 + 2] * 255); img.data[i * 4 + 3] = 255;
    const rv = 200 + (1 - H[i]) * 50; rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = Math.min(255, rv); rimg.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const roughnessMap = new THREE.CanvasTexture(rc); roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap, normalMap: normalFromHeight(H, N, 4) };
}

// paper fibre normal map, a 6 cm tile: a felt of short curved fibres over a fine mottle
let _paperNormal = null;
export function paperNormal() {
  if (_paperNormal) return _paperNormal;
  const N = 512, r = rngOf(21); const H = valueNoise(N, 22, [[8, 0.35], [32, 0.35], [128, 0.3]]);
  for (let i = 0; i < H.length; i++) H[i] *= 0.35;
  for (let k = 0; k < 5200; k++) {
    let x = r() * N, y = r() * N, a = r() * Math.PI * 2; const L = 6 + r() * 28, h = 0.05 + r() * 0.12;
    for (let s = 0; s < L; s++) { a += (r() - 0.5) * 0.25; x += Math.cos(a); y += Math.sin(a); const i = ((Math.round(y) % N + N) % N) * N + ((Math.round(x) % N + N) % N); H[i] += h; }
  }
  _paperNormal = normalFromHeight(H, N, 1.4); return _paperNormal;
}
// glaze "orange peel" and hand-finished metal: a smooth low-amplitude ripple normal map
let _peel = null;
export function peelNormal() {
  if (_peel) return _peel;
  const N = 256; const H = valueNoise(N, 31, [[8, 0.6], [24, 0.4]]); _peel = normalFromHeight(H, N, 3); return _peel;
}

// ---------- surfaces ----------
export async function loadSurfaces(renderer) {
  const an = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const [wDiff, wNor, wRough, lGreen, lOx, lNor, lRough, pDiff, pNor, pRough] = await Promise.all([
    loadTexture('textures/wood_table_001/diff_2k.webp', { srgb: true, anisotropy: an }),
    loadTexture('textures/wood_table_001/nor_gl_x3_2k.webp', { anisotropy: an }),
    loadTexture('textures/wood_table_001/rough_1k.webp', { anisotropy: an }),
    loadTexture('textures/leather_red_03/diff_green_1k.webp', { srgb: true, anisotropy: an }),
    loadTexture('textures/leather_red_03/diff_oxblood_1k.webp', { srgb: true, anisotropy: an }),
    loadTexture('textures/leather_red_03/nor_gl_x5_1k.webp', { anisotropy: an }),
    loadTexture('textures/leather_red_03/rough_1k.webp', { anisotropy: an }),
    loadTexture('textures/decrepit_wallpaper/diff_1k.webp', { srgb: true, anisotropy: an }),
    loadTexture('textures/decrepit_wallpaper/nor_gl_1k.webp', { anisotropy: an }),
    loadTexture('textures/decrepit_wallpaper/rough_1k.webp', { anisotropy: an }),
  ]);
  const wear = varnishWear(); wear.anisotropy = an; const pores = poreNormal(); pores.anisotropy = an;
  let cork = null;
  const WOOD_TILE = 150, LEATHER_TILE = 30, WALL_TILE = 250, CORK_TILE = 20, WEAR_TILE = 60, PAPER_TILE = 6;

  return {
    /** Dark varnished mahogany. Grain runs along x (the desk's long side). */
    deskWood({ w = 190, d = 92, tint = '#8a6f62' } = {}) {
      const rx = w / WOOD_TILE, ry = d / WOOD_TILE, rot = Math.PI / 2; // texture grain runs along v: turn it to run along u
      return new THREE.MeshPhysicalMaterial({
        map: tiled(wDiff, rx, ry, rot), color: tint,
        normalMap: tiled(wNor, rx, ry, rot), normalScale: new THREE.Vector2(0.45 / 3, 0.45 / 3),
        roughnessMap: tiled(wRough, rx, ry, rot), roughness: 0.75, metalness: 0,
        clearcoat: 0.7, clearcoatRoughness: 1.4, clearcoatRoughnessMap: tiled(wear, w / WEAR_TILE, d / WEAR_TILE), // 34..64/255 -> ~0.19..0.35: the lamp is a point here, its shade's mouth is wide
        clearcoatNormalMap: tiled(pores, w / 12, d / 12), clearcoatNormalScale: new THREE.Vector2(0.07, 0.07),
        specularIntensity: 0.3,
      });
    },
    /** Desk blotter leather, 'green' (default) or 'oxblood'. */
    leather({ w = 64, d = 44, color = 'green' } = {}) {
      const rx = w / LEATHER_TILE, ry = d / LEATHER_TILE;
      return new THREE.MeshPhysicalMaterial({
        map: tiled(color === 'oxblood' ? lOx : lGreen, rx, ry), color: color === 'oxblood' ? '#ffffff' : '#c9d2c6',
        normalMap: tiled(lNor, rx, ry), normalScale: new THREE.Vector2(0.7 / 5, 0.7 / 5),
        roughnessMap: tiled(lRough, rx, ry), roughness: 0.8, metalness: 0,
        clearcoat: 0.6, clearcoatRoughness: 0.32,
      });
    },
    /** Old stained wallpaper over plaster, darkened for a night office. */
    wall({ w = 400, h = 250, tint = '#6d6858' } = {}) {
      const rx = w / WALL_TILE, ry = h / WALL_TILE;
      return new THREE.MeshStandardMaterial({
        map: tiled(pDiff, rx, ry), color: tint, normalMap: tiled(pNor, rx, ry), normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: tiled(pRough, rx, ry), roughness: 1, metalness: 0,
      });
    },
    /** Pressed cork board (procedural). */
    cork({ w = 150, h = 84, tint = '#ffffff' } = {}) {
      if (!cork) { cork = corkMaps(); for (const t of Object.values(cork)) t.anisotropy = an; }
      const rx = w / CORK_TILE, ry = h / CORK_TILE;
      return new THREE.MeshStandardMaterial({ map: tiled(cork.map, rx, ry), color: tint, normalMap: tiled(cork.normalMap, rx, ry), normalScale: new THREE.Vector2(1, 1), roughnessMap: tiled(cork.roughnessMap, rx, ry), roughness: 1, metalness: 0 });
    },
    /** Paper: a subtle fibre normal map; pass `map` for printed or written sheets. */
    paper({ w = 21, h = 28, map = null, color = '#ffffff', roughness = 0.88, strength = 0.35 } = {}) {
      const n = tiled(paperNormal(), w / PAPER_TILE, h / PAPER_TILE); n.anisotropy = an;
      return new THREE.MeshStandardMaterial({ map, color, roughness, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(strength, strength) });
    },
    paperNormal,
  };
}
