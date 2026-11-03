// PROTOTYPE shared 3D world: one particle field that morphs between "worlds".
// Abstract only: terrain, graph, mountains, stars, a point of light. No living beings.
import * as THREE from 'three';

const N = 36000;
const rand = mulberry(7);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function steppe() {
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const x = (rand() - 0.5) * 110, z = (rand() - 0.5) * 110;
    const y = Math.sin(x * 0.08) * 1.1 + Math.cos(z * 0.06 + x * 0.02) * 1.4 + Math.sin((x + z) * 0.21) * 0.25;
    p.set([x, y - 3, z], i * 3);
  }
  return p;
}

// grid graph: nodes + edges; edges deterministic from seed
export const GRAPH = (() => {
  const W = 9, H = 9, S = 7, nodes = [], edges = [];
  const r = mulberry(3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) nodes.push([(i - (W - 1) / 2) * S, (j - (H - 1) / 2) * S]);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (i < W - 1 && r() > 0.18) edges.push([k, k + 1]);
    if (j < H - 1 && r() > 0.18) edges.push([k, k + W]);
  }
  return { W, H, S, nodes, edges };
})();

function graph() {
  const p = new Float32Array(N * 3);
  const { nodes, edges } = GRAPH;
  for (let i = 0; i < N; i++) {
    let x, y, z;
    if (i < N * 0.3) {
      const n = nodes[i % nodes.length];
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = 0.55 * Math.cbrt(rand());
      x = n[0] + r * Math.sin(v) * Math.cos(u); y = r * Math.cos(v); z = n[1] + r * Math.sin(v) * Math.sin(u);
    } else if (i < N * 0.85) {
      const [a, b] = edges[i % edges.length]; const t = rand();
      x = nodes[a][0] + (nodes[b][0] - nodes[a][0]) * t + (rand() - 0.5) * 0.08;
      z = nodes[a][1] + (nodes[b][1] - nodes[a][1]) * t + (rand() - 0.5) * 0.08; y = (rand() - 0.5) * 0.08;
    } else { // faint ground dust
      x = (rand() - 0.5) * 140; z = (rand() - 0.5) * 140; y = -3 + Math.sin(x * 0.08) * 0.6;
    }
    p.set([x, y, z], i * 3);
  }
  return p;
}

function mountains() {
  const p = new Float32Array(N * 3);
  const peaks = [[-18, -10, 16, 9], [10, -20, 22, 11], [24, 8, 12, 7], [-6, 14, 10, 8], [-30, 20, 13, 9], [0, -2, 7, 5]];
  for (let i = 0; i < N; i++) {
    const x = (rand() - 0.5) * 100, z = (rand() - 0.5) * 100;
    let y = 0; for (const [px, pz, h, s] of peaks) y += h * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (2 * s * s));
    y += Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.6;
    p.set([x, y - 3, z], i * 3);
  }
  return p;
}

function spark() {
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = 0.4 + Math.pow(rand(), 3) * 30;
    p.set([r * Math.sin(v) * Math.cos(u), r * Math.cos(v) * 0.5 + 2, r * Math.sin(v) * Math.sin(u)], i * 3);
  }
  return p;
}

export const SHAPES = { spark: spark(), steppe: steppe(), graph: graph(), mountains: mountains() };

export function createWorld(canvas, { tint = 0xf2c46b, fog = 0x070b14 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(fog, 0.008);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(0, 30, 60);
  const look = new THREE.Vector3();

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(SHAPES.steppe);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const seed = new Float32Array(N); for (let i = 0; i < N; i++) seed[i] = rand();
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(tint) }, uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uFog: { value: new THREE.Color(fog) } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying float vA; varying float vD;
      void main(){ vec3 p=position; p.y+=sin(uTime*0.6+seed*30.)*0.06;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; vD=-mv.z;
        gl_PointSize=(1.4+seed*1.8)*uPx*(60./-mv.z); vA=0.35+0.65*fract(seed*7.13+uTime*0.05);} `,
    fragmentShader: `uniform vec3 uColor; varying float vA; varying float vD;
      void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; float a=smoothstep(.5,0.,d)*vA*clamp(1.-vD/200.,0.,1.);
        gl_FragColor=vec4(uColor*(0.6+0.4*vA),a*0.85);} `,
  });
  const points = new THREE.Points(geo, mat); scene.add(points);

  // stars (static dome)
  const sg = new THREE.BufferGeometry(); const sp = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) { const u = rand() * Math.PI * 2, v = rand() * 1.3, r = 180; sp.set([r * Math.sin(v) * Math.cos(u), r * Math.cos(v) - 10, r * Math.sin(v) * Math.sin(u)], i * 3); }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false })));

  // the spark itself
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe2a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(5, 5, 1); glow.position.set(0, 2, 0); scene.add(glow);

  // A* path beam (hidden until shown)
  const beam = pathBeam(); beam.visible = false; scene.add(beam);

  let from = 'steppe', to = 'steppe', t = 1;
  function setMorph(a, b, k) { from = a; to = b; t = k; }
  function applyMorph() {
    const A = SHAPES[from], B = SHAPES[to];
    for (let i = 0; i < N; i++) {
      // sweep: particles further along x morph later
      const d = (A[i * 3] + 70) / 140 * 0.5 + seed[i] * 0.15;
      let k = Math.min(1, Math.max(0, (t * 1.65 - d)));
      k = k * k * (3 - 2 * k);
      const i3 = i * 3;
      pos[i3] = A[i3] + (B[i3] - A[i3]) * k;
      pos[i3 + 1] = A[i3 + 1] + (B[i3 + 1] - A[i3 + 1]) * k + Math.sin(k * Math.PI) * 4 * seed[i];
      pos[i3 + 2] = A[i3 + 2] + (B[i3 + 2] - A[i3 + 2]) * k;
    }
    geo.attributes.position.needsUpdate = true;
  }
  let last = '';
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
  }
  const clock = new THREE.Clock();
  let onFrame = null;
  renderer.setAnimationLoop(() => {
    const el = clock.getElapsedTime();
    mat.uniforms.uTime.value = el;
    const key = from + to + t.toFixed(3);
    if (key !== last) { applyMorph(); last = key; }
    glow.material.opacity = 0.75 + Math.sin(el * 2.2) * 0.25;
    if (onFrame) onFrame(el);
    resize(); camera.lookAt(look); renderer.render(scene, camera);
  });
  return {
    scene, camera, look, glow, beam, renderer, setMorph,
    set onFrame(f) { onFrame = f; },
    dispose() { renderer.setAnimationLoop(null); renderer.dispose(); },
  };
}

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.15, 'rgba(255,226,160,0.9)'); r.addColorStop(0.5, 'rgba(242,170,80,0.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

// a fixed corner-to-corner path over the graph edges (BFS on GRAPH)
function pathBeam() {
  const { nodes, edges, W, H } = GRAPH; const adj = nodes.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const s = 0, g = W * H - 1, prev = new Array(nodes.length).fill(-1), q = [s]; prev[s] = s;
  while (q.length) { const u = q.shift(); if (u === g) break; for (const v of adj[u]) if (prev[v] < 0) { prev[v] = u; q.push(v); } }
  const pts = []; let u = g; if (prev[g] < 0) return new THREE.Group();
  while (u !== s) { pts.push(new THREE.Vector3(nodes[u][0], 0.3, nodes[u][1])); u = prev[u]; } pts.push(new THREE.Vector3(nodes[s][0], 0.3, nodes[s][1]));
  const curve = new THREE.CatmullRomCurve3(pts.reverse(), false, 'catmullrom', 0.05);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.userData.curve = curve; return m;
}
