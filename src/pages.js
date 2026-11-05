// Every face of every sheet: what is printed (canvas) and which pop-up stands on it. Face coords: x → right, v ↓ down the page, page 14 × 20.
import { Page, INK, INK2, ACCENT, INDIGO, SERIF, DISPLAY, TITLE, HAND } from './typeset.js';
import { paperFill, pageShade, endpaper, clothFill, goldGradient, rng } from './paper.js';
import { T } from './theme.js';
import graph from './data/graph.json';
import hills from './data/hills.json';
import contours from './data/contours.json';
import adversarial from './data/adversarial.json';
import mdp from './data/mdp.json';
import bayes from './data/bayes.json';
import hmm from './data/hmm.json';
import decisions from './data/decisions.json';
import neural from './data/neural.json';
import language from './data/language.json';

export const BOOK_URL = 'https://theakhmetzhan.github.io/aif-book/';
export const TITLE_TXT = 'EVIDENCE', SUB_TXT = 'A Casebook of Artificial Intelligence', AUTHOR = 'Akhmetzhan Turlybek';
export const C = { cream: T.cream, white: T.white, kraft: T.kraft, indigo: T.accent2, terracotta: T.accent, ochre: T.ochre, grey: T.grey, ink: T.ink, paper: T.paper };
const B = T.bold, NOIR = T.name === 'noir';
export const AD = adversarial, MD = mdp, BY = bayes, HM = hmm, DE = decisions, NE = neural, LA = language; const QE = MD.q.example, TRACE = ['1', '2', '3', '5'];
export const pc = (v, d = 1) => (v * 100).toFixed(d) + '%', neg = v => (v < 0 ? '−' + Math.abs(v) : String(v)), r2 = v => +v.toFixed(2);
// a centred line of mathematics
const formula = (P, text) => { P.text(text, 7, P.y + 0.38, { font: `italic 400 ${0.31 * P.S}px ${SERIF}`, color: INK, align: 'center' }); P.y += 0.66; };

const pageBase = (g, w, h, spine, seed = 2) => { paperFill(g, w, h, T.paper, T.paperGrain, seed); pageShade(g, w, h, spine); };
const runningHead = (P, txt, num, side) => {
  P.text(txt.toUpperCase(), 7, 1.05, { font: `400 ${0.22 * P.S}px ${SERIF}`, color: INK2, align: 'center', spacing: 0.08 });
  P.text(String(num), side === 'L' ? P.x0 : P.x1, 19.05, { font: `400 ${0.28 * P.S}px ${SERIF}`, color: INK2, align: side === 'L' ? 'left' : 'right' });
};
const chapterHead = (P, num, title, sub) => {
  P.text(`CASE ${num}`, P.x0, P.y + 0.75, { font: `400 ${0.36 * P.S}px ${DISPLAY}`, color: ACCENT, spacing: 0.08 });
  P.text(title, P.x0, P.y + 1.85, { font: `${NOIR ? 700 : 600} ${0.95 * P.S}px ${TITLE}`, color: INK });
  P.text(sub, P.x0, P.y + 2.5, { font: `italic 400 ${0.34 * P.S}px ${SERIF}`, color: INK2 });
  P.y += 2.85; P.rule(P.y, { x1: P.x0 + 1.6, color: ACCENT, w: 0.04 }); P.y += 0.3;
};
const exhibit = (P, label, text, y) => {
  P.y = y; P.text(label.toUpperCase(), P.x0, P.y + 0.25, { font: `400 ${0.26 * P.S}px ${DISPLAY}`, color: ACCENT, spacing: 0.06 }); P.y += 0.42;
  P.para(text, { size: T.bodySize * 0.88, lead: T.lead * 0.88, color: INK2, after: 0.1 });
};
// rubber stamp (noir) or label chip (modern), centred at (x, v)
export function stamp(g, S, text, x, v, { rot = -0.12, color = ACCENT, size = 0.42, alpha = 0.85 } = {}) {
  g.save(); g.translate(x * S, v * S); g.rotate(rot); g.globalAlpha = alpha;
  g.font = `400 ${size * S}px ${NOIR ? DISPLAY : T.mono}`; g.letterSpacing = size * 0.18 * S + 'px';
  const tw = g.measureText(text).width, pw = tw + size * 0.9 * S, ph = size * 1.7 * S;
  if (NOIR) {
    g.strokeStyle = color; g.lineWidth = size * 0.1 * S; g.strokeRect(-pw / 2, -ph / 2, pw, ph);
    g.lineWidth = size * 0.04 * S; g.strokeRect(-pw / 2 + size * 0.16 * S, -ph / 2 + size * 0.16 * S, pw - size * 0.32 * S, ph - size * 0.32 * S);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, size * 0.09 * S, size * 0.04 * S);
    // worn ink: knock out speckles
    g.globalCompositeOperation = 'destination-out'; const r = rng(text.length * 7 + 3);
    for (let k = 0; k < 260; k++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.arc((r() - 0.5) * pw, (r() - 0.5) * ph, (0.2 + r() * 1.4) * S * 0.012, 0, 7); g.fill(); }
  } else {
    g.fillStyle = color; g.beginPath(); g.roundRect(-pw / 2, -ph / 2, pw, ph, ph * 0.2); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, size * 0.09 * S, size * 0.04 * S);
  }
  g.restore(); g.letterSpacing = '0px';
}
// coffee ring (noir pages only)
function ring(g, S, x, v, r) {
  if (!NOIR) return; g.save(); g.strokeStyle = 'rgba(120,80,40,.16)'; g.lineWidth = 0.09 * S; g.beginPath(); g.arc(x * S, v * S, r * S, 0.3, 5.9); g.stroke();
  g.strokeStyle = 'rgba(120,80,40,.08)'; g.lineWidth = 0.3 * S; g.beginPath(); g.arc(x * S, v * S, (r - 0.15) * S, 0, 7); g.stroke(); g.restore();
}

// ---------- shared figure data ----------
export const FIG11 = { agent: { x0: 4.4, x1: 9.6, v0: 8.6, v1: 11.0 }, env: { x0: 1.6, x1: 12.4, v0: 1.6, v1: 6.4 } };
export const G = (() => {
  const N = graph.nodes, h = graph.h;
  const nodes = Object.keys(N).map(k => ({ id: k, x: N[k][0], v: N[k][1], h: h[k] }));
  return { nodes, by: Object.fromEntries(nodes.map(n => [n.id, n])), edges: graph.edges, astar: graph.astar, bfs: graph.bfs, ucs: graph.ucs };
})();
const HOFF = { S: [-0.15, 0.95], A: [-1.25, 0.2], B: [-0.2, 0.95], C: [0.62, 0.62], D: [-1.3, 0.1], E: [0.3, 0.95], F: [0.62, 0.42], H: [0.55, 0.62], G: [0.0, -0.66] };
export const A_ORDER = Object.fromEntries(G.astar.order.map((o, i) => [o[0], { k: i + 1, g: o[1], f: o[2] }]));
export const A_FRONTIER = { B: { g: 4, f: 14.6 }, D: { g: 9, f: 14.7 }, E: { g: 15, f: 21.9 } };
export const HILL = { levels: contours, local: hills.local, global: hills.global, peaks: hills.peaks };
export const fHill = (x, v) => hills.peaks.reduce((a, [px, pv, s, A]) => a + A * Math.exp(-((x - px) ** 2 + (v - pv) ** 2) / (2 * s * s)), 0);

function arrowPrint(g, S, pts, color) {
  g.strokeStyle = color; g.lineWidth = 0.05 * S; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, v], i) => i ? g.lineTo(x * S, v * S) : g.moveTo(x * S, v * S)); g.stroke();
  const [a, b] = pts.slice(-2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  g.fillStyle = color; g.beginPath(); g.moveTo(b[0] * S, b[1] * S);
  g.lineTo((b[0] - Math.cos(ang - 0.45) * 0.38) * S, (b[1] - Math.sin(ang - 0.45) * 0.38) * S);
  g.lineTo((b[0] - Math.cos(ang + 0.45) * 0.38) * S, (b[1] - Math.sin(ang + 0.45) * 0.38) * S); g.closePath(); g.fill();
}
function graphPrint(g, S, P, { hlabels = false, astar = false }) {
  for (const [a, b, c] of G.edges) {
    const A = G.by[a], Bn = G.by[b];
    g.strokeStyle = NOIR ? 'rgba(36,28,20,.5)' : 'rgba(21,23,26,.4)'; g.lineWidth = 0.035 * S; g.setLineDash([0.12 * S, 0.1 * S]); g.beginPath(); g.moveTo(A.x * S, A.v * S); g.lineTo(Bn.x * S, Bn.v * S); g.stroke(); g.setLineDash([]);
    const mx = (A.x + Bn.x) / 2, mv = (A.v + Bn.v) / 2, dx = Bn.x - A.x, dv = Bn.v - A.v, L = Math.hypot(dx, dv);
    let nx = -dv / L, nv = dx / L; if (nv > 0) { nx = -nx; nv = -nv; }
    const lx = mx + nx * 0.34, lv = mv + nv * 0.34;
    g.fillStyle = T.paper; g.beginPath(); g.arc(lx * S, lv * S, 0.2 * S, 0, 7); g.fill();
    P.text(String(c), lx, lv + 0.01, { font: `${B} ${0.27 * S}px ${SERIF}`, color: ACCENT, align: 'center', baseline: 'middle' });
  }
  for (const n of G.nodes) {
    g.strokeStyle = INK2; g.lineWidth = 0.03 * S; g.beginPath(); g.arc(n.x * S, n.v * S, 0.42 * S, 0, 7); g.stroke();
    P.text(n.id, n.x, n.v + 0.02, { font: `${B} ${0.36 * S}px ${SERIF}`, color: INK, align: 'center', baseline: 'middle' });
    const [ox, ov] = HOFF[n.id]; const al = ox < -0.5 || ox > 0.4 ? 'left' : 'center';
    if (hlabels) P.text(`h=${n.h.toFixed(1)}`, n.x + ox, n.v + ov, { font: `400 ${0.25 * S}px ${SERIF}`, color: INK2, align: al });
    if (astar) { const o = A_ORDER[n.id] || A_FRONTIER[n.id]; if (o) P.text(`f=${o.f.toFixed(1)}`, n.x + ox, n.v + ov, { font: `400 ${0.25 * S}px ${SERIF}`, color: A_ORDER[n.id] ? ACCENT : INK2, align: al }); }
  }
}
function hillPrint(g, S) {
  HILL.levels.forEach((L, i) => {
    for (const loop of L.loops) {
      g.beginPath(); loop.forEach(([x, v], k) => k ? g.lineTo(x * S, v * S) : g.moveTo(x * S, v * S)); g.closePath();
      g.strokeStyle = NOIR ? `rgba(36,28,20,${0.22 + i * 0.04})` : `rgba(21,23,26,${0.15 + i * 0.04})`; g.lineWidth = 0.025 * S; g.stroke();
    }
  });
  const dots = (path, col) => { path.forEach(([x, v], k) => { g.fillStyle = col; g.beginPath(); g.arc(x * S, v * S, (k === 0 ? 0.13 : 0.075) * S, 0, 7); g.fill(); }); };
  dots(HILL.local.path, INDIGO); dots(HILL.global.path, ACCENT);
}

// ---------- figure geometry for Cases IV–X: each exhibit's print and its pop-up stand on the same marks ----------
export const FIG = {
  tree: { root: { x: 7, v: 4.0, w: 3.4, h: 3.7 }, mins: { v: 6.8, w: 2.5, h: 2.7, x: [2.75, 7, 11.25] }, leaf: { v: 9.5, w: 1.08, h: 1.7, x: [[1.5, 2.75, 4], [5.75, 7, 8.25], [10, 11.25, 12.5]] } },
  grid: { x0: 1.5, cell: 2.2, rows: [5.0, 7.4, 9.8], depth: 2.4, h: V => 0.5 + (V + 1.1) * 0.42, goal: 4.9, trap: 0.32, wall: 0.2 },
  stair: { x0: 1.8, cell: 1.74, rows: [4.8, 6.4, 8.0, 9.6], route: ['2,0', '1,0', '0,0', '0,1', '0,2', '0,3'], h: V => 0.75 + (V + 1.1) * 0.3 },
  net: { nodes: { B: [3.1, 4.2, 3.4], S: [6.1, 4.2, 3.4], W: [5.6, 7.0, 2.3], M: [2.5, 7.0, 2.3] }, w: 2.5, bars: { x0: 8.0, w: 1.0, v: 9.2, base: 0.8, k: 4.3 } },
  trellis: { x: [2.3, 5.4, 8.5, 11.6], w: 1.26, v: 6.6, base: 0.5, k: 4.4, obs: { v: 9.6, w: 2.2, h: 1.9 } },
  ramp: { x0: 1.6, x1: 12.4, pMax: 0.4, k: 4.4, v: 7.0, flat: 7.3, flag: { v: 8.6, h: 3.1 } },
  sig: { x0: 1.6, x1: 12.4, z0: -4, z1: 2, curve: 5.4, k: 4.6, flags: 6.5, rows: [7.1, 7.75, 8.4], tok: { w: 0.72, h: 1.05 } },
  nn: { input: { v: 9.5, h: 1.6, x: [3.9, 10.1] }, hidden: { v: 7.0, h: 2.6, x: [3.9, 10.1] }, output: { v: 4.3, h: 3.7, x: [7] }, w: 2.7 },
  word: { x0: 2.2, w: 2.3, rows: [{ t: '0.5', v: 6.0, base: 2.3 }, { t: '1', v: 7.2, base: 1.4 }, { t: '2', v: 8.4, base: 0.55 }], k: 5.5, tiles: { x0: 1.5, w: 1.74, v: 9.8, base: 0.72, k: 3.2 } },
  layers: { x0: 2.3, w: 9.4, cards: [{ v: 9.0, h: 3.0, name: 'Data checks' }, { v: 7.9, h: 3.5, name: 'Model training' }, { v: 6.5, h: 4.1, name: 'Output filters' }, { v: 5.1, h: 4.7, name: 'Human review' }], hole: [4.4, 1.7], stop: [6.9, 1.7], r: 0.46, token: { v: 9.9, w: 4.2, h: 2.2 } },
};
export const sigX = z => FIG.sig.x0 + (z - FIG.sig.z0) / (FIG.sig.z1 - FIG.sig.z0) * (FIG.sig.x1 - FIG.sig.x0), logit = p => Math.log(p / (1 - p));
const ARROW = { N: '↑', E: '→', S: '↓', W: '←' };
const small = (S, k = 0.25) => `400 ${k * S}px ${SERIF}`, boldS = (S, k = 0.3) => `${B} ${k * S}px ${SERIF}`;
const dash = (g, S, a, b, col = null) => { g.strokeStyle = col || (NOIR ? 'rgba(36,28,20,.5)' : 'rgba(21,23,26,.4)'); g.lineWidth = 0.03 * S; g.setLineDash([0.12 * S, 0.1 * S]); g.beginPath(); g.moveTo(a[0] * S, a[1] * S); g.lineTo(b[0] * S, b[1] * S); g.stroke(); g.setLineDash([]); };
function treePrint(g, S, P) {
  const t = FIG.tree, back = 0.5;
  t.mins.x.forEach((x, i) => {
    dash(g, S, [t.root.x, t.root.v - back + 0.2], [x, t.mins.v - back - 0.2], i === AD.best ? ACCENT : null);
    t.leaf.x[i].forEach((lx, j) => { const cut = AD.pruned.some(([a, b]) => a === i && b === j); if (!cut) dash(g, S, [x, t.mins.v - back + 0.2], [lx, t.leaf.v - back - 0.2], i === AD.best && AD.leaves[i][j] === AD.root ? ACCENT : null); P.text(cut ? '×' : String(AD.leaves[i][j]), lx, t.leaf.v - back + 0.1, { font: boldS(S), color: cut ? INK2 : INK, align: 'center' }); });
    P.text(String(AD.mins[i]), x, t.mins.v - back + 0.1, { font: boldS(S), color: INK, align: 'center' });
  });
  P.text(String(AD.root), t.root.x, t.root.v - back + 0.1, { font: boldS(S, 0.34), color: ACCENT, align: 'center' });
}
function gridPrint(g, S, P) {
  const { x0, cell, rows, depth } = FIG.grid; g.strokeStyle = INK2; g.lineWidth = 0.02 * S;
  MD.map.forEach((row, r) => [...row].forEach((c, k) => {
    const x = x0 + k * cell, v = rows[r] - depth, key = `${r},${k}`; g.strokeRect(x * S, v * S, cell * S, depth * S);
    if (c === '#') { g.fillStyle = 'rgba(36,28,20,.16)'; g.fillRect(x * S, v * S, cell * S, depth * S); return; }
    const mid = x + cell / 2, label = c === 'G' ? 'warrant' : c === 'X' ? 'tip-off' : `${MD.V[key].toFixed(2).replace('-', '−')} ${ARROW[MD.pi[key]]}`;
    P.text(label, mid, v + 1.15, { font: c === 'G' || c === 'X' ? boldS(S, 0.26) : small(S, 0.27), color: c === 'X' ? ACCENT : c === 'G' ? INDIGO : INK, align: 'center' });
    if (c === 'S') P.text('S', x + 0.25, v + 0.45, { font: boldS(S), color: INDIGO });
  }));
}
function stairPrint(g, S, P) {
  const { x0, cell, rows, route } = FIG.stair;
  ['10 attempts', '100 attempts', '1,000 attempts', 'true values'].forEach((t, i) => { g.strokeStyle = INK2; g.lineWidth = 0.02 * S; g.beginPath(); g.moveTo(x0 * S, (rows[i] + 0.5) * S); g.lineTo((x0 + cell * route.length) * S, (rows[i] + 0.5) * S); g.stroke(); P.text(t, x0, rows[i] + 0.84, { font: small(S, 0.25), color: i === 3 ? ACCENT : INK2 }); });
}
function netPrint(g, S, P) {
  const n = FIG.net.nodes;
  for (const [a, b] of [['B', 'W'], ['S', 'W'], ['B', 'M']]) arrowPrint(g, S, [[n[a][0], n[a][1] + 0.55], [n[b][0], n[b][1] - 2.3]], INK2);
  const b = FIG.net.bars; ['none', 'window', '+storm', '+print', 'all'].forEach((t, i) => P.text(t, b.x0 + (i + 0.5) * b.w, b.v + 0.68, { font: small(S, 0.22), color: INK2, align: 'center' }));
}
function trellisPrint(g, S, P) {
  const t = FIG.trellis; HM.obs.forEach((o, i) => { P.text(`night ${i + 1}`, t.x[i], t.obs.v + 0.62, { font: small(S, 0.24), color: INK2, align: 'center' }); if (i) arrowPrint(g, S, [[t.x[i - 1] + 1.45, t.v + 0.72], [t.x[i] - 1.45, t.v + 0.72]], INK2); });
}
function rampPrint(g, S, P) {
  const f = FIG.ramp, X = p => f.x0 + p / f.pMax * (f.x1 - f.x0); g.strokeStyle = INK2; g.lineWidth = 0.025 * S; g.beginPath(); g.moveTo(f.x0 * S, 9.25 * S); g.lineTo(f.x1 * S, 9.25 * S); g.stroke();
  for (const p of [0, 0.1, 0.2, 0.3, 0.4]) { g.beginPath(); g.moveTo(X(p) * S, 9.25 * S); g.lineTo(X(p) * S, 9.38 * S); g.stroke(); P.text(pc(p, 0), X(p), 9.68, { font: small(S, 0.24), color: INK2, align: 'center' }); }
  P.text('p', f.x1 + 0.3, 9.33, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: INK2 });
}
function sigmoidPrint(g, S, P) {
  const f = FIG.sig; g.strokeStyle = INK2; g.lineWidth = 0.025 * S; g.beginPath(); g.moveTo(f.x0 * S, 9.0 * S); g.lineTo(f.x1 * S, 9.0 * S); g.stroke();
  for (let z = f.z0; z <= f.z1; z += 2) { const x = sigX(z); g.beginPath(); g.moveTo(x * S, 9.0 * S); g.lineTo(x * S, 9.12 * S); g.stroke(); P.text(`z = ${String(z).replace('-', '−')}`, x, 9.38, { font: small(S, 0.22), color: INK2, align: 'center' }); }
  DE.test.slice().sort((a, b) => a.p - b.p).forEach((t, i) => { g.fillStyle = t.y ? ACCENT : INK2; g.beginPath(); g.arc(sigX(logit(t.p)) * S, (f.rows[i % 3] - 0.3) * S, 0.09 * S, 0, 7); g.fill(); });
}
function nnPrint(g, S, P) {
  const f = FIG.nn; for (const [a, b] of [[f.input, f.hidden], [f.hidden, f.output]]) for (const x of a.x) for (const y of b.x) dash(g, S, [x, a.v - 0.5], [y, b.v + 0.55]);
}
function wordPrint(g, S, P) {
  const f = FIG.word; for (const r of f.rows) dash(g, S, [f.x0 - 1, r.v + 0.5], [f.x0 + f.w * 4, r.v + 0.5]);
}
function layerPrint(g, S, P) {
  const f = FIG.layers; f.cards.forEach(c => { dash(g, S, [f.x0, c.v + 0.45], [f.x0 + f.w, c.v + 0.45]); });
}

// ---------- cover art (colour pass or foil mask) ----------
function coverArt(g, S, w, h, mask) {
  const cx = 7.25 * S, F = c => mask ? '#fff' : c;
  if (NOIR) {
    const foil = mask ? '#fff' : goldGradient(g, 0, 0, w, h);
    g.strokeStyle = foil; g.lineWidth = 0.05 * S; g.strokeRect(0.8 * S, 0.8 * S, 12.9 * S, 19.2 * S); g.lineWidth = 0.016 * S; g.strokeRect(0.98 * S, 0.98 * S, 12.54 * S, 18.84 * S);
    g.fillStyle = foil; g.textAlign = 'center';
    const T1 = (t, y, f, sp = 0) => { g.font = f; g.letterSpacing = sp * S + 'px'; g.fillText(t, cx + sp * S / 2, y * S); g.letterSpacing = '0px'; };
    T1('CASE FILE  No. AIF-1303', 2.4, `400 ${0.32 * S}px ${DISPLAY}`, 0.12);
    // magnifier emblem
    g.strokeStyle = foil; g.lineWidth = 0.22 * S; g.beginPath(); g.arc(cx - 0.3 * S, 6.6 * S, 2.1 * S, 0, 7); g.stroke();
    g.lineWidth = 0.05 * S; g.beginPath(); g.arc(cx - 0.3 * S, 6.6 * S, 1.75 * S, 0, 7); g.stroke();
    g.lineWidth = 0.55 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 1.25 * S, 8.15 * S); g.lineTo(cx + 2.9 * S, 9.8 * S); g.stroke(); g.lineCap = 'butt';
    g.font = `400 ${1.7 * S}px ${TITLE}`; g.fillText('?', cx - 0.3 * S, 7.2 * S);
    T1(TITLE_TXT, 13.3, `700 ${1.75 * S}px ${TITLE}`, 0.12);
    g.fillRect(cx - 2.2 * S, 14.0 * S, 4.4 * S, 0.03 * S);
    T1(SUB_TXT.toUpperCase(), 14.8, `400 ${0.3 * S}px ${DISPLAY}`, 0.06);
    T1(AUTHOR.toUpperCase(), 18.7, `400 ${0.3 * S}px ${DISPLAY}`, 0.14);
  } else {
    g.fillStyle = F(T.accent); g.fillRect(0, 1.2 * S, 10.6 * S, 3.6 * S);
    g.fillStyle = mask ? '#000' : '#15171a'; g.textAlign = 'left';
    g.font = `600 ${1.9 * S}px ${TITLE}`; g.letterSpacing = -0.02 * S + 'px'; g.fillText(TITLE_TXT, 0.9 * S, 3.95 * S); g.letterSpacing = '0px';
    g.fillStyle = F('#f2f2f2');
    g.font = `500 ${0.3 * S}px ${T.mono}`; ['CASE FILE / AIF-1303', 'CASES  I–X', 'QAIRU  2026'].forEach((t, i) => g.fillText(t, 0.9 * S, (6.0 + i * 0.5) * S));
    g.font = `500 ${0.62 * S}px ${TITLE}`; g.fillText('A Casebook of', 0.9 * S, 16.2 * S); g.fillText('Artificial Intelligence', 0.9 * S, 17.0 * S);
    g.font = `500 ${0.3 * S}px ${T.mono}`; g.fillText(AUTHOR.toUpperCase(), 0.9 * S, 19.2 * S);
    // thin-line magnifier
    g.strokeStyle = F('#f2f2f2'); g.lineWidth = 0.06 * S; g.beginPath(); g.arc(8.8 * S, 9.6 * S, 2.3 * S, 0, 7); g.stroke();
    g.lineWidth = 0.36 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(10.5 * S, 11.3 * S); g.lineTo(12.4 * S, 13.2 * S); g.stroke(); g.lineCap = 'butt';
    g.strokeStyle = F(T.accent); g.lineWidth = 0.05 * S; g.beginPath(); g.moveTo(7.5 * S, 9.4 * S); g.lineTo(8.4 * S, 10.3 * S); g.lineTo(10.0 * S, 8.6 * S); g.stroke();
  }
}

// ---------- faces ----------
export const FACES = {
  cover: {
    kind: 'board', draw(g, S, w, h) { clothFill(g, w, h, T.cloth); coverArt(g, S, w, h, false); },
    gold: T.foil ? (g, S, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); coverArt(g, S, w, h, true); } : null,
  },
  endFront: { kind: 'board', draw: (g, S, w, h) => endpaper(g, S, w, h, 'right') },
  title: {
    side: 'R', num: 1, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S);
      P.text(TITLE_TXT, 7, 13.0, { font: `${NOIR ? 700 : 600} ${1.45 * S}px ${TITLE}`, color: INK, align: 'center', spacing: NOIR ? 0.1 : 0 });
      P.text(SUB_TXT, 7, 13.95, { font: `italic 400 ${0.44 * S}px ${SERIF}`, color: INK, align: 'center' });
      P.rule(14.6, { x0: 6.2, x1: 7.8, color: ACCENT, w: 0.035 });
      P.text('Ten cases in how machines perceive, search,', 7, 15.35, { font: `400 ${0.3 * S}px ${SERIF}`, color: INK2, align: 'center' });
      P.text('reason under uncertainty and learn', 7, 15.85, { font: `400 ${0.3 * S}px ${SERIF}`, color: INK2, align: 'center' });
      P.text(AUTHOR.toUpperCase(), 7, 17.6, { font: `${B} ${0.28 * S}px ${SERIF}`, color: INK, align: 'center', spacing: 0.12 });
      P.text('AI Fundamentals · QAIRU · 2026', 7, 18.2, { font: `400 ${0.28 * S}px ${SERIF}`, color: INK2, align: 'center' });
    },
    popup: 'titleBoard',
  },
  preface: {
    side: 'L', num: 2, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 2, 'L');
      P.y = 2.0; P.kicker('Preface');
      P.text('How to read this casebook', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.7 * S}px ${TITLE}` }); P.y += 1.3;
      P.para('A detective and an AI system do the same job. Both take in evidence, follow leads, rule out what cannot be true, and act on the best explanation they have. This book treats the ideas of artificial intelligence as ten cases, in the order the AI Fundamentals course teaches them.', { dropcap: true });
      P.para('Each case opens one method: how an **agent** meets its world, how **search** follows a trail, how **local search** climbs toward better answers, and on to probability, learning and language models.', { indent: 0.6 });
      P.para('Every exhibit stands up from its page. At desk level the exhibits tell the story; lean over the book and the pages underneath give the full explanation. Drag to look around the desk, scroll or pinch to come closer, and click a page or press the arrow keys to turn it.', { indent: 0.6 });
      P.para('Every number in the exhibits was computed by running the algorithm the case describes.', { indent: 0.6 });
      P.gap(0.4);
      P.text('A. T.', P.x1, P.y, { font: `italic 400 ${0.36 * S}px ${SERIF}`, color: INK2, align: 'right' });
      P.text('November 2026', P.x1, P.y + 0.5, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: INK2, align: 'right' });
    },
  },
  contents: {
    side: 'R', num: 3, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Contents', 3, 'R');
      P.y = 9.3; P.kicker('Contents');
      P.text('Ten cases', P.x0, P.y + 0.6, { font: `${NOIR ? 700 : 600} ${0.62 * S}px ${TITLE}` }); P.y += 1.15;
      for (const [r, t, s, p] of CASES) {
        const on = p !== undefined, col = on ? INK : (NOIR ? 'rgba(36,28,20,.4)' : 'rgba(21,23,26,.38)');
        P.text(r, P.x0 + 0.75, P.y, { font: `400 ${0.32 * S}px ${DISPLAY}`, color: on ? ACCENT : col, align: 'right' });
        P.text(t, P.x0 + 1.05, P.y, { font: `${B} ${0.32 * S}px ${SERIF}`, color: col });
        g.font = `${B} ${0.32 * S}px ${SERIF}`; const tw = g.measureText(t).width / S;
        P.text(s, P.x0 + 1.25 + tw, P.y, { font: `400 ${0.27 * S}px ${SERIF}`, color: on ? INK2 : col });
        if (on) P.text(String(p), P.x1, P.y, { font: `400 ${0.3 * S}px ${SERIF}`, color: INK, align: 'right' });
        P.y += 0.78;
      }
    },
    popup: 'fileDrawer',
  },
  ch1: {
    side: 'L', num: 4, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 4, 'L');
      P.y = 4.75; chapterHead(P, 'I', 'The Agent', 'Agents and environments');
      P.para('Every investigation needs someone who can observe and act. In AI that is an **agent**: anything that perceives its environment through *sensors* and acts on it through *actuators*. The *agent function* maps each *percept sequence*, everything perceived so far, to an action; the *agent program* implements it.', { dropcap: true });
      P.para('A **rational agent** picks the action expected to maximise its *performance measure*, given its percepts and knowledge. Rational is not omniscient.', { indent: 0.6 });
      P.para('First describe the task with **PEAS**, the cards above:', { indent: 0.6, after: 0.06 });
      P.table([['', 'A self-driving car'], ['**P**erformance', 'safety, travel time, comfort'], ['**E**nvironment', 'roads, traffic, weather'], ['**A**ctuators', 'steering, throttle, brakes'], ['**S**ensors', 'cameras, radar, lidar, GPS']], [3.3, P.w - 3.3], { size: 0.28, lead: 0.37 });
      P.para('Designs grow with the world: *simple reflex* agents react to the current percept, *model-based* ones keep internal state, *goal-based* and *utility-based* ones plan, and any of them can *learn*.', {});
    },
    popup: 'peas',
  },
  fig11: {
    side: 'R', num: 5, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case I · The Agent', 5, 'R');
      const F = FIG11; g.strokeStyle = INK2; g.lineWidth = 0.03 * S;
      g.strokeRect(F.agent.x0 * S, F.agent.v0 * S, (F.agent.x1 - F.agent.x0) * S, (F.agent.v1 - F.agent.v0) * S);
      g.strokeRect(F.env.x0 * S, F.env.v0 * S, (F.env.x1 - F.env.x0) * S, (F.env.v1 - F.env.v0) * S);
      P.text('AGENT', 7, (F.agent.v0 + F.agent.v1) / 2 + 0.12, { font: `400 ${0.32 * S}px ${DISPLAY}`, color: INK, align: 'center', spacing: 0.1 });
      P.text('ENVIRONMENT', 7, (F.env.v0 + F.env.v1) / 2 + 0.12, { font: `400 ${0.32 * S}px ${DISPLAY}`, color: INK, align: 'center', spacing: 0.1 });
      const am = (F.agent.v0 + F.agent.v1) / 2;
      arrowPrint(g, S, [[11.2, F.env.v1], [11.2, am], [F.agent.x1, am]], ACCENT); arrowPrint(g, S, [[F.agent.x0, am], [2.8, am], [2.8, F.env.v1]], INDIGO);
      P.text('percepts', 11.45, (F.env.v1 + am) / 2 + 0.1, { font: `${B} ${0.28 * S}px ${SERIF}`, color: ACCENT });
      P.text('actions', 2.55, (F.env.v1 + am) / 2 + 0.1, { font: `${B} ${0.28 * S}px ${SERIF}`, color: INDIGO, align: 'right' });
      exhibit(P, 'Exhibit 1.1 · the agent–environment loop', 'Percepts flow in through sensors; actions flow out through actuators. The agent program in between is the subject of the rest of this book.', 11.55);
      P.gap(0.1);
      P.text('SIX WAYS ENVIRONMENTS DIFFER', P.x0, P.y + 0.2, { font: `${B} ${0.22 * S}px ${SERIF}`, color: INDIGO, spacing: 0.04 }); P.y += 0.4;
      P.table([['', 'Chess + clock', 'Self-driving'], ['Observable', 'fully', 'partially'], ['Agents', 'multi', 'multi'], ['Outcomes', 'deterministic', 'stochastic'], ['Episodes', 'sequential', 'sequential'], ['Change', 'semi-dynamic', 'dynamic'], ['Actions', 'discrete', 'continuous']], [3.1, 4.0, P.w - 7.1], { size: 0.27, lead: 0.37 });
      ring(g, S, 11.6, 16.6, 1.5);
    },
    popup: 'agentLoop',
  },
  ch2: {
    side: 'L', num: 6, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 6, 'L');
      P.y = 1.6; chapterHead(P, 'II', 'The Trail', 'Search, A* and heuristics');
      P.para('The detective must get from the office, S, to the scene, G. No algorithm can help until the task is written as a **search problem**: an *initial state*; the *actions* available in each state; a *transition model* saying where each action leads; a *goal test*; and a *path cost*, the sum of the step costs.', { dropcap: true });
      P.para('Exhibit 2.1 is this problem as a *state-space graph*: nine locations and thirteen roads, each labelled with its cost. Search grows a tree of paths from S and keeps a *frontier* of paths not yet extended. Strategies differ only in which frontier node they expand next.', { indent: 0.6 });
      P.para('**Breadth-first search** expands the shallowest node. It finds the path with the fewest steps, S → B → E → G with cost 18, which is optimal only when every step costs the same.', { indent: 0.6 });
      P.para('**Uniform-cost search** expands the node with the lowest path cost *g(n)*. It finds the cheapest path, S → C → F → G with cost 14, but spreads out in every direction to do so.', { indent: 0.6 });
      P.para('**Depth-first search** expands the deepest node. It needs little memory but is not optimal, and it is not complete when paths can be infinite.', { indent: 0.6 });
      P.aside('Did you know?', 'A* was published in 1968 by Peter Hart, Nils Nilsson and Bertram Raphael at the Stanford Research Institute, to plan routes for the mobile robot Shakey.');
    },
  },
  fig21: {
    side: 'R', num: 7, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case II · The Trail', 7, 'R');
      graphPrint(g, S, P, { hlabels: true });
      exhibit(P, 'Exhibit 2.1 · the map as a graph', 'Numbers on the roads are step costs. Each pin stands as tall as its heuristic *h(n)*, the straight-line distance to G, so the pins grow shorter toward the goal. From desk level you see the slope; from above you read the map.', 15.1);
    },
    popup: 'graphH',
  },
  astar: {
    side: 'L', num: 8, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 8, 'L');
      P.y = 2.0; P.kicker('Case II · Informed search');
      P.text('A* looks toward the goal', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.66 * S}px ${TITLE}` }); P.y += 1.25;
      P.para('A *heuristic* *h(n)* estimates the cost from *n* to the goal. **A§** expands the frontier node with the lowest *f(n) = g(n) + h(n)*: the cost already paid plus the estimated cost still to pay.', { dropcap: true });
      P.para('A heuristic that never overestimates is **admissible**. One with *h(n) ≤ c(n, n′) + h(n′)* for every step is **consistent**. Straight-line distance is both here, because no road is shorter than the straight line between its ends. With a consistent heuristic, A§ graph search returns an optimal path.', { indent: 0.6 });
      P.table([['', 'Path found', 'Cost', 'Expanded'], ['BFS', 'S → B → E → G', '18', '9'], ['UCS', 'S → C → F → G', '14', '8'], ['A§', 'S → C → F → G', '14', '5']], [1.5, 5.0, 1.8, P.w - 8.3], { size: 0.3, lead: 0.42, align: ['left', 'left', 'right', 'right'] });
      P.para('*Goal tested when a node is expanded; ties broken alphabetically.*', { size: 0.26, lead: 0.38, color: INK2, after: 0.2 });
      P.table([['Step', 'Node', '*~g*', '*~h*', '*~f*'], ...G.astar.order.map((o, i) => [String(i + 1), o[0], String(o[1]), G.by[o[0]].h.toFixed(1), o[2].toFixed(1)])], [2.0, 2.0, 2.0, 2.0, P.w - 8], { size: 0.29, lead: 0.39, align: ['left', 'left', 'right', 'right', 'right'] });
      P.aside('Myth vs fact', '*Myth:* a heuristic is a guess, so A§ may return a worse path. *Fact:* with a consistent heuristic it still returns an optimal path; the heuristic only changes how much work the search does.', { color: ACCENT });
    },
  },
  fig22: {
    side: 'R', num: 9, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case II · The Trail', 9, 'R');
      const p = G.astar.path.map(id => G.by[id]); g.strokeStyle = NOIR ? 'rgba(163,39,29,.3)' : 'rgba(255,74,28,.3)'; g.lineWidth = 0.22 * S; g.lineCap = 'round'; g.beginPath(); p.forEach((n, i) => i ? g.lineTo(n.x * S, n.v * S) : g.moveTo(n.x * S, n.v * S)); g.stroke(); g.lineCap = 'butt';
      graphPrint(g, S, P, { astar: true });
      exhibit(P, 'Exhibit 2.2 · A* on the same map', 'Flags 1–5 give the order A§ expanded the locations; B, D and E were still on the frontier when G was chosen, and H was never generated. The red string is the path A§ returns: S → C → F → G, cost 14.', 15.1);
    },
    popup: 'graphA',
  },
  ch3: {
    side: 'L', num: 10, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 10, 'L');
      P.y = 1.6; chapterHead(P, 'III', 'The High Ground', 'Local search and constraint satisfaction');
      P.para('In Case II the path was the answer. In many problems only the final configuration matters: where to place eight queens, how to order a delivery route. **Local search** keeps one current state and moves to a neighbouring state, guided by an *objective function* to maximise. It needs almost no memory.', { dropcap: true });
      P.para('**Hill climbing** moves to the best neighbour and stops when no neighbour is better. In Exhibit 3.1 climber A stops after 8 steps on a *local maximum* of height 6.9; climber B reaches the *global maximum*, 10.3, in 14 steps. Hill climbing can also stall on *plateaus* and *ridges*.', { indent: 0.6 });
      P.para('**Random restarts** rerun the climb from random states and keep the best result. **Simulated annealing** sometimes accepts a worse move, with probability exp(Δ*E*/*T*); as the temperature *T* falls, it explores less and settles. **Local beam search** keeps *k* states at once; **genetic algorithms** recombine and mutate a population.', { indent: 0.6 });
      P.para('A **constraint satisfaction problem** describes a state with *variables*, their *domains* and *constraints*: colour every region of a map so that no two neighbours match. *Backtracking search* assigns one variable at a time and undoes a choice as soon as a constraint fails.', { indent: 0.6 });
    },
  },
  fig31: {
    side: 'R', num: 11, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case III · The High Ground', 11, 'R');
      hillPrint(g, S);
      P.text('global max · 10.3', 9.0, 4.4, { font: `${B} ${0.27 * S}px ${SERIF}`, color: ACCENT, align: 'center' });
      g.save(); g.font = `${B} ${0.27 * S}px ${SERIF}`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 0.12 * S; g.strokeStyle = T.paper; g.strokeText('local max · 6.9', 4.5 * S, 11.05 * S); g.fillStyle = INDIGO; g.fillText('local max · 6.9', 4.5 * S, 11.05 * S); g.restore();
      P.text('A', 1.55, 15.35, { font: `${B} ${0.3 * S}px ${SERIF}`, color: INDIGO });
      P.text('B', 12.0, 13.15, { font: `${B} ${0.3 * S}px ${SERIF}`, color: ACCENT });
      exhibit(P, 'Exhibit 3.1 · hill climbing', 'Paper ridges, each a slice of one landscape. Climber A (blue) stops on a local maximum; climber B (red) reaches the global one. The contours are the same landscape seen from above.', 16.4);
    },
    popup: 'hills',
  },
  ch4: {
    side: 'L', num: 12, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 12, 'L');
      P.y = 1.6; chapterHead(P, 'IV', 'The Opponent', 'Adversarial search and game trees');
      P.para('So far the world held still. Now the smuggler thinks too. A **game** adds an opponent to search: *states*, *actions*, a *terminal test* and a *utility*, the final score. In a *zero-sum* game one side’s gain is the other’s loss, so one number serves both: MAX pushes it up, MIN pushes it down.', { dropcap: true });
      P.para('**Minimax** works up a **game tree** from its leaves: a MIN node takes its lowest child, a MAX node its highest. The root’s value is what MAX can guarantee against perfect play.', { indent: 0.6 });
      P.para(`In Exhibit 4.1 the detective picks a place to watch; the smuggler sees it and picks a route. The Station holds the best leaf, ${AD.leaves[2][0]}, but the reply would be ${AD.mins[2]}. The Market gives ${AD.mins[1]} and the Docks ${AD.mins[0]}, so: the Docks. Minimax plans for the reply, not the prize.`, { indent: 0.6 });
      P.para(`A full search costs about *b*^*m* steps, for *b* moves a turn and *m* turns: about 10^154 for chess. **Alpha–beta pruning** carries two bounds, α, the best MAX can force so far, and β, the best MIN can. When α ≥ β the rest of a branch cannot matter. The Docks set α = ${AD.mins[0]}; the Market’s first leaf is ${AD.leaves[1][0]}, so its last two go unread. The answer never changes, only the work.`, { indent: 0.6 });
      P.para('A **depth limit** stops early and scores positions with an *evaluation function*, often a weighted sum of features. The risk is the *horizon effect*: disaster one move past the limit stays unseen.', { indent: 0.6 });
    },
  },
  fig41: {
    side: 'R', num: 13, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case IV · The Opponent', 13, 'R');
      treePrint(g, S, P);
      exhibit(P, 'Exhibit 4.1 · the game tree', `MAX at the back, MIN in the middle, leaves in front. ${AD.mins.join(', ')} rise to the MIN cards; ${AD.root} reaches the root along the red string. Grey leaves were pruned: ${AD.seen.length} of 9 read.`, 10.2);
      P.gap(0.08);
      P.table([['Watch', 'Worst reply', 'Average reply'], ...AD.moves.map((m, i) => [m, String(AD.mins[i]), AD.means[i].toFixed(2)])], [3.6, 3.6, P.w - 7.2], { size: 0.28, lead: 0.37, align: ['left', 'right', 'right'] });
      P.para(`**Expectimax** swaps MIN for a *chance node* that averages its children: for luck, not malice. If the route is random, the Station wins, at ${AD.means[2].toFixed(2)}.`, { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
      P.aside('Did you know?', `Python played all ${AD.ttt.games.toLocaleString('en-US')} games of tic-tac-toe. Perfect play draws. Alpha–beta proves it with ${(AD.ttt.alphabeta / AD.ttt.positions * 100).toFixed(1)}% of the work: ${AD.ttt.alphabeta.toLocaleString('en-US')} tree nodes, not ${AD.ttt.positions.toLocaleString('en-US')}.`, { size: T.bodySize * 0.88, lead: T.lead * 0.88 });
    },
    popup: 'gameTree',
  },
  ch5: {
    side: 'L', num: 14, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 14, 'L');
      P.y = 1.6; chapterHead(P, 'V', 'The Long Game', 'Markov decision processes');
      P.para('A fixed route fails the first time a street is blocked. When actions can go astray, the answer must say what to do from *anywhere*. A **Markov decision process** (MDP) has *states*, *actions*, a *transition model* P(s′ | s, a) giving each outcome’s chance, a *reward* for each step and a *discount* γ from 0 to 1. *Markov* means the next state depends only on the current state and action.', { dropcap: true });
      P.para(`The answer is a **policy**: one action for every state. The *return* adds up rewards, each shrunk by γ per step: with γ = ${MD.gamma}, a reward 10 steps away counts for ${(MD.gamma ** 10).toFixed(2)} of itself. The **value** V(s) is the expected return from s, acting as well as possible.`, { indent: 0.6 });
      P.para('In Exhibit 5.1, reach the warrant (+10), avoid the tip-off (−10), pay −1 per block. A move goes as planned 80% of the time and slips to each side 10%.', { indent: 0.6 });
      P.para('The **Bellman equation** says a state is worth its best action: the expected reward plus the discounted value of where it leads.', { indent: 0.6, after: 0.02 });
      formula(P, 'V(s) = max_a Σ_s′ P(s′ | s, a) [ R + γ V(s′) ]');
      P.para(`**Value iteration** starts every value at 0 and applies that equation to all states, over and over. Good news spreads backward from the goal. Here it settles in ${MD.sweeps} sweeps. *Policy iteration* evaluates a policy, then improves it.`, { indent: 0.6 });
    },
  },
  fig51: {
    side: 'R', num: 15, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case V · The Long Game', 15, 'R');
      gridPrint(g, S, P);
      exhibit(P, 'Exhibit 5.1 · value as high ground', 'Each paper ridge is one row of the city, each step one block, as tall as its value. The start S is bottom left. Follow the arrows uphill to the warrant.', 11.0);
      P.gap(0.08);
      P.table([['After sweep', ...TRACE.map(k => '~' + k), String(MD.sweeps)], ['V(S)', ...TRACE.map(k => MD.trace[k]['2,0'].toFixed(2)), MD.V['2,0'].toFixed(2)], ['V beside goal', ...TRACE.map(k => MD.trace[k]['1,4'].toFixed(2)), MD.V['1,4'].toFixed(2)]], [3.3, 1.5, 1.5, 1.5, 1.5, P.w - 9.3], { size: 0.27, lead: 0.36, align: ['left', 'right', 'right', 'right', 'right', 'right'] });
      P.para(`**One backup.** The block above the tip-off, moving east: 0.8 × (10) + 0.1 × (−1 + 0.9 × ${MD.V['0,3']}) + 0.1 × (−10) = ${MD.V['0,3']}. A slip north hits the city edge and stays put, so the value is its own fixed point.`, { size: T.bodySize * 0.92, lead: T.lead * 0.92 });
      P.para(`**Two roads, six moves each.** From S the policy takes the top road (${MD.qS.N.toFixed(2).replace('-', '−')} against ${MD.qS.E.toFixed(2).replace('-', '−')} going east): it risks a slip into the tip-off once, the bottom road twice.`, { size: T.bodySize * 0.92, lead: T.lead * 0.92 });
    },
    popup: 'valueTerrain',
  },
  ch5b: {
    side: 'L', num: 16, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 16, 'L');
      P.y = 1.7; P.kicker('Case V · Reinforcement learning');
      P.text('Learning without the map', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.66 * S}px ${TITLE}` }); P.y += 1.2;
      P.para('Value iteration needs the rules of the city in advance. A detective new in town has none. **Reinforcement learning** (RL) learns from experience: act, see what happens, adjust. No label says which action was right. There is only reward, often late.', { dropcap: true });
      P.para('**Q-learning** keeps one number Q(s, a) for each state and action: the return expected from doing *a* in *s*, then acting well. After each step it nudges that entry:', { indent: 0.6, after: 0.02 });
      formula(P, 'Q(s,a) ← Q(s,a) + α [ r + γ max Q(s′,a′) − Q(s,a) ]');
      P.para(`The bracket is the *temporal-difference error*: new evidence minus old belief. From our run, on attempt ${QE.ep} (one *episode*, a walk to an end), two blocks from the warrant, moving east: Q = ${neg(QE.old)}, r = ${neg(QE.r)}, best next Q = ${QE.fut}, α = ${QE.alpha}. Target ${neg(QE.r)} + 0.9 × ${QE.fut} = ${QE.target}; new Q = ${neg(QE.old)} + ${QE.alpha} × (${QE.target} + ${Math.abs(QE.old)}) = ${QE.new}.`, { indent: 0.6 });
      P.para('Three dials: the *learning rate* α sets how far one experience moves a belief, the *discount* γ how much the future counts, and the *exploration rate* ε how often to try something else.', { indent: 0.6 });
      P.para('**Exploration versus exploitation** is the dilemma: use what you know, or find out more? *ε-greedy* takes a random action with chance ε, otherwise the best known.', { indent: 0.6 });
      P.para('Q-learning is *model-free*: it never learns the probabilities. It is *off-policy*: its target assumes the best next move even while exploring. *SARSA* uses the move actually taken.', { indent: 0.6 });
      P.para('When states are too many to list, a *deep Q-network* replaces the table with a neural network (Case IX).', { indent: 0.6 });
    },
  },
  fig52: {
    side: 'R', num: 17, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case V · The Long Game', 17, 'R');
      stairPrint(g, S, P);
      exhibit(P, 'Exhibit 5.2 · the learner’s map', `The six blocks of the best road from S. Back to front: Q-learning’s values after 10, 100 and 1,000 attempts, then the truth. It knows no probabilities, only ${MD.q.steps.toLocaleString('en-US')} sampled moves.`, 10.5);
      P.gap(0.08);
      P.table([['Attempts', 'Policy matches', 'Value error'], ...['10', '100', '1000', String(MD.q.episodes)].map(k => [Number(k).toLocaleString('en-US'), `${MD.q.snap[k].match} of 12`, MD.q.snap[k].rms.toFixed(2)])], [3.3, 4.0, P.w - 7.3], { size: 0.26, lead: 0.33, align: ['left', 'right', 'right'] });
      P.para('*Value error: root-mean-square gap from Exhibit 5.1. Attempts start at random blocks, ε = 0.3, and α falls with each revisit.*', { size: 0.25, lead: 0.34, color: INK2, after: 0.1 });
      P.aside('Myth vs fact', '*Myth:* more reward means a better agent. *Fact:* an agent optimises the reward it is given, not the one you meant. A robot paid for dirt collected can learn to spill dirt.', { color: ACCENT, size: T.bodySize * 0.88, lead: T.lead * 0.88 });
    },
    popup: 'staircase',
  },
  ch6: {
    side: 'L', num: 18, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 18, 'L');
      P.y = 1.6; chapterHead(P, 'VI', 'The Evidence', 'Probability and Bayesian networks');
      P.para('Evidence rarely proves; it shifts belief. A **random variable** is an uncertain quantity, and its *probability distribution* gives each value a chance, summing to 1. The *conditional probability* P(A | B) is the chance of A once B is known: it shrinks the world to the cases where B holds.', { dropcap: true });
      P.para('**Bayes’ rule** turns evidence into belief: P(H | E) = P(E | H) P(H) / P(E). P(H) is the *prior*, the belief before; P(E | H) is the *likelihood*, how well H predicts the evidence; P(H | E) is the *posterior*, the belief after.', { indent: 0.6 });
      P.para(`A shoe print matches ${pc(BY.sens, 0)} of guilty suspects and ${pc(BY.fpr, 0)} of innocent ones; ${pc(BY.prior, 0)} of suspects are guilty. Take ${BY.N.toLocaleString('en-US')}: ${BY.guilty} guilty give ${BY.tp} matches; ${(BY.N - BY.guilty).toLocaleString('en-US')} innocent give ${BY.fp}. So a match means guilt ${BY.tp} times in ${BY.tp + BY.fp}: ${pc(BY.post)}, not ${pc(BY.sens, 0)}. Confusing P(E | H) with P(H | E) is the *prosecutor’s fallacy*.`, { indent: 0.6 });
      P.para(`A full table over *n* yes/no variables needs 2^*n* − 1 numbers. A **Bayesian network** needs far fewer: a directed graph without cycles, one node per variable, an arrow per direct influence, and at each node a *conditional probability table* (CPT) given its parents. Multiplying the tables gives any joint probability. Exhibit 6.1 takes ${BY.params.network} numbers, not ${BY.params.joint}.`, { indent: 0.6 });
      P.para('*Enumeration* sums over hidden variables and normalises; *sampling* estimates by simulation.', { indent: 0.6 });
    },
  },
  fig61: {
    side: 'R', num: 19, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case VI · The Evidence', 19, 'R');
      netPrint(g, S, P);
      exhibit(P, 'Exhibit 6.1 · a broken window', 'A storm or a break-in can break a window; a break-in may leave a muddy print. The bars show P(break-in) as evidence arrives.', 9.95);
      P.gap(0.08);
      P.table([['Known', 'P(break-in)'], ['nothing', pc(BY.rows.B, 1)], ['window broken', pc(BY.rows['B|W'], 1)], ['… and there was a storm', pc(BY.rows['B|W,S'], 1)], ['… or a print, no word of a storm', pc(BY.rows['B|W,M'], 1)], ['window, storm and print', pc(BY.rows['B|W,S,M'], 1)]], [8.0, P.w - 8.0], { size: 0.27, lead: 0.35, align: ['left', 'right'] });
      P.para(`**Explaining away.** Break-in and storm are independent until the window breaks. Then they compete: learn of the storm and the break-in falls to ${pc(BY.rows['B|W,S'], 1)}. **By enumeration:** P(B, W) / P(W) = ${BY.pbw.toFixed(5)} / ${(BY.pbw + BY.pnw).toFixed(5)} = ${pc(BY.rows['B|W'], 1)}. **By sampling:** ${BY.sample.kept.toLocaleString('en-US')} of ${BY.sample.n.toLocaleString('en-US')} simulated nights broke a window; ${pc(BY.sample.est, 1)} of those were break-ins.`, { size: T.bodySize * 0.88, lead: T.lead * 0.88 });
      P.aside('Quick quiz', '*A 99%-accurate test says yes. Are you 99% likely to be ill?* No: it depends how rare the illness is.', { size: T.bodySize * 0.86, lead: T.lead * 0.86 });
    },
    popup: 'beliefNet',
  },
  ch7: {
    side: 'L', num: 20, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 20, 'L');
      P.y = 1.6; chapterHead(P, 'VII', 'The Unseen', 'Hidden Markov models and filtering');
      P.para('The suspect is never seen. Each night brings one clue: is the warehouse window lit? A **hidden Markov model** (HMM) tracks a state nobody can observe from the evidence it leaves. It has three tables: where the state starts, how it changes (the *transition model*), and what it shows (the *emission model*). The next state depends only on the current one, and each reading only on the current state.', { dropcap: true });
      P.table([['', 'To Active', 'To Quiet', 'P(Lit)', 'P(Dark)'], ['Active', HM.T[0][0].toFixed(1), HM.T[0][1].toFixed(1), HM.E.Lit[0].toFixed(1), HM.E.Dark[0].toFixed(1)], ['Quiet', HM.T[1][0].toFixed(1), HM.T[1][1].toFixed(1), HM.E.Lit[1].toFixed(1), HM.E.Dark[1].toFixed(1)]], [2.5, 2.3, 2.1, 2.0, P.w - 8.9], { size: 0.27, lead: 0.36, align: ['left', 'right', 'right', 'right', 'right'] });
      P.para(`**Filtering** asks: what is the state *now*? Three steps repeat: *predict* with the transition model, *weigh* by the reading, *normalise* to sum to 1. Start at ${HM.pi[0]} Active. Night 1 is lit: ${HM.pi[0]} × ${HM.E.Lit[0]} = ${r2(HM.pi[0] * HM.E.Lit[0])} against ${HM.pi[1]} × ${HM.E.Lit[1]} = ${r2(HM.pi[1] * HM.E.Lit[1])}, so Active is ${r2(HM.pi[0] * HM.E.Lit[0])} / ${r2(HM.pi[0] * HM.E.Lit[0] + HM.pi[1] * HM.E.Lit[1])} = ${HM.filter[0][0].toFixed(3)}. Night 2 predicts ${HM.filter[0][0].toFixed(3)} × ${HM.T[0][0]} + ${HM.filter[0][1].toFixed(3)} × ${HM.T[1][0]} = ${HM.predicted[1][0].toFixed(3)}, and a second lit window lifts it to ${HM.filter[1][0].toFixed(3)}.`, { indent: 0.6 });
      P.para('*Prediction* runs the transition model forward with no reading. **Smoothing** lets later evidence correct a past belief, with a forward and a backward pass. The **Viterbi algorithm** finds the likeliest whole path: filtering with max in place of sum, then a walk back through the winners.', { indent: 0.6 });
      P.para('The same machinery tracks robots and speech sounds.', { indent: 0.6 });
    },
  },
  fig71: {
    side: 'R', num: 21, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case VII · The Unseen', 21, 'R');
      trellisPrint(g, S, P);
      exhibit(P, 'Exhibit 7.1 · four nights', 'A window in front, two beliefs behind it, as tall as their filtered probabilities. The red string is the Viterbi path.', 10.45);
      P.gap(0.08);
      P.table([['Night', ...HM.obs.map((_, i) => '~' + (i + 1))], ['Window', ...HM.obs], ['P(Active), filtered', ...HM.filter.map(v => v[0].toFixed(3))], ['P(Active), smoothed', ...HM.smooth.map(v => v[0].toFixed(3))], ['Viterbi path', ...HM.path.map(i => HM.states[i])]], [4.5, 1.6, 1.6, 1.6, P.w - 9.3], { size: 0.26, lead: 0.35, align: ['left', 'right', 'right', 'right', 'right'] });
      P.para(`**Night 3** is dark, and filtering says Quiet (Active ${HM.filter[2][0].toFixed(3)}). Night 4 is lit, so smoothing lifts night 3 to ${HM.smooth[2][0].toFixed(3)}, and the likeliest whole story is Active all four nights. Prediction for night 5: Active ${HM.next[0].toFixed(3)}.`, { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
      P.aside('Myth vs fact', '*Myth:* Viterbi takes each night’s likeliest filtered state. *Fact:* that gives Quiet on night 3. Viterbi scores whole paths.', { color: ACCENT, size: T.bodySize * 0.88, lead: T.lead * 0.88 });
    },
    popup: 'trellis',
  },
  ch8: {
    side: 'L', num: 22, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 22, 'L');
      P.y = 1.6; chapterHead(P, 'VIII', 'The Interrogation', 'Rational decisions and classical machine learning');
      P.para('Belief is not yet action. **Utility** scores how much an outcome is wanted. The **expected utility** of an action adds up each outcome’s probability times its utility, and the principle of *maximum expected utility* says: choose the action where that sum is highest.', { dropcap: true });
      P.para(`Raid tonight: ${pc(DE.acts['Raid tonight'][0][0], 0)} chance of +${DE.acts['Raid tonight'][0][1]}, ${pc(DE.acts['Raid tonight'][1][0], 0)} of ${neg(DE.acts['Raid tonight'][1][1])}, so EU = ${DE.eu['Raid tonight']}. Wait for the warrant: ${pc(DE.acts['Wait for the warrant'][0][0], 0)} of +${DE.acts['Wait for the warrant'][0][1]}, ${pc(DE.acts['Wait for the warrant'][1][0], 0)} of ${neg(DE.acts['Wait for the warrant'][1][1])}, so EU = ${DE.eu['Wait for the warrant']}. Waiting has the smaller prize and the better bet. Had the raid won, it would still have been the wrong call: rationality is judged on what was known beforehand. A *risk-averse* agent, for whom each extra dollar matters less, leans further toward safety.`, { indent: 0.6 });
      P.para('**Machine learning** (ML) fits a model to examples instead of hand-writing rules. *Supervised* learning has labelled answers: *regression* predicts a number, *classification* a category. *Unsupervised* learning finds structure with no labels. *Reinforcement* learning has rewards (Case V).', { indent: 0.6 });
      P.para('Data is split. A model learns from the *training set*, and its score is taken on a *test set* it has never seen. *Overfitting* is learning the noise: high on training data, poor on new data. *Leakage* is letting test information in through the back door.', { indent: 0.6 });
    },
  },
  fig81: {
    side: 'R', num: 23, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case VIII · The Interrogation', 23, 'R');
      rampPrint(g, S, P);
      exhibit(P, 'Exhibit 8.1 · the price of a threshold', `A witness may be attacked with probability *p*. A guard costs $${DE.guard.toLocaleString('en-US')} and stops the attack; an unguarded attack costs $${DE.loss.toLocaleString('en-US')}. The rising card is the expected loss with no guard, *p* × $${DE.loss.toLocaleString('en-US')}. The flat card is the cost of a guard.`, 9.9);
      P.para(`They cross at *p* = ${DE.guard.toLocaleString('en-US')} / ${DE.loss.toLocaleString('en-US')} = ${pc(DE.tau, 1)}. Guard above that, not below. The costs set the threshold, not the accuracy of any model. Dearer failures push it lower.`, { size: T.bodySize * 0.92, lead: T.lead * 0.92 });
      P.table([['*~p*', 'No guard', 'Guard', 'Choose'], ...[0.05, 0.125, 0.3].map(p => [pc(p, 1), '$' + (p * DE.loss).toLocaleString('en-US'), '$' + DE.guard.toLocaleString('en-US'), p * DE.loss > DE.guard ? 'guard' : p * DE.loss === DE.guard ? 'either' : 'no guard'])], [2.3, 2.9, 2.5, P.w - 7.7], { size: 0.27, lead: 0.36, align: ['left', 'right', 'right', 'right'] });
      P.aside('Did you know?', 'Prediction says what may happen; utility says what to do. Good AI needs both, and a better model does not fix a wrong cost.', { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
    },
    popup: 'utilityRamp',
  },
  ch8b: {
    side: 'L', num: 24, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 24, 'L');
      P.y = 1.7; P.kicker('Case VIII · The line-up');
      P.text('Five models, one desk', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.66 * S}px ${TITLE}` }); P.y += 1.2;
      P.para(`The desk logs ${DE.train.length + DE.test.length} invented tips, each scored for *detail* and for the source’s *record*, 0 to 10, and labelled real or hoax. ${DE.train.length} train the models; ${DE.test.length} stay sealed for the test.`, { dropcap: true });
      P.para(`**Linear regression** fits a line ŷ = *w x* + *b*, the one with the smallest *mean squared error*. Tips by hours since the crime give ŷ = ${neg(+DE.line[0].toFixed(2))}*x* + ${DE.line[1].toFixed(1)}: expect ${(DE.line[0] * 5 + DE.line[1]).toFixed(1)} tips in hour 5.`, { indent: 0.6 });
      P.para(`**Logistic regression** makes a score and squeezes it into a probability with the *sigmoid* σ(*z*) = 1 / (1 + e^−*z*). Fitted: *z* = ${DE.w[0].toFixed(2)} detail + ${DE.w[1].toFixed(2)} record − ${Math.abs(DE.w[2]).toFixed(2)}. A record counts for more than detail.`, { indent: 0.6 });
      P.para(`**Naive Bayes** uses Bayes’ rule and assumes features are independent given the class, which is what makes it naive. *Laplace smoothing* adds 1 to each count so an unseen word cannot force a zero. In 14 logged tips, one naming a place and a time is real with probability ${pc(DE.nb.both, 1)}; one naming neither, ${pc(DE.nb.none, 1)}.`, { indent: 0.6 });
      P.para(`A **decision tree** asks yes/no questions, each chosen to leave purer groups. Asking “detail ≤ ${DE.tree.root[1]}?” drops *Gini impurity* from ${DE.tree.giniRoot.toFixed(3)} to ${DE.tree.giniSplit.toFixed(3)}. Two levels score ${pc(DE.tree.trainAcc, 1)} in training but ${pc(DE.tree.testAcc, 1)} on the test. A *random forest* votes across many trees grown on resampled data.`, { indent: 0.6 });
      P.para(`**K-means** clusters without labels: place *k* centres, assign each point to the nearest, move each centre to the mean, repeat. On these tips, with *k* = 2, it settles in ${DE.kmeans.it} rounds. It finds groups; people decide what they mean.`, { indent: 0.6 });
    },
  },
  fig82: {
    side: 'R', num: 25, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case VIII · The Interrogation', 25, 'R');
      sigmoidPrint(g, S, P);
      exhibit(P, 'Exhibit 8.2 · twelve sealed tips', `The curve is the fitted sigmoid. Each token is a test tip at its score, red if truly real. The flags are two thresholds τ: chase every tip right of the flag. A chase costs $${DE.guard.toLocaleString('en-US')}; a missed real tip, $${DE.loss.toLocaleString('en-US')}.`, 10.0);
      P.gap(0.05);
      const row = (k, f) => [k, f(DE.m5), f(DE.mt)];
      P.table([['', 'τ = 0.5', `τ = ${DE.tau}`], row('Caught / missed real', m => `${m.tp} / ${m.fn}`), row('False alarms', m => String(m.fp)), row('Accuracy', m => pc(m.acc, 1)), row('Precision', m => pc(m.prec, 1)), row('Recall', m => pc(m.rec, 1)), row('F1', m => m.f1.toFixed(3)), row('Total cost', m => '$' + m.cost.toLocaleString('en-US'))], [4.9, 3.0, P.w - 7.9], { size: 0.26, lead: 0.33, align: ['left', 'right', 'right'] });
      P.para(`*Accuracy* is the share right. *Precision*: of the alarms, how many were real. *Recall*: of the real, how many were caught. *F1* blends the two. The lower threshold is less accurate and half the cost. Calling everything a hoax scores ${pc(DE.always.acc, 1)} and costs $${DE.always.cost.toLocaleString('en-US')}.`, { size: T.bodySize * 0.88, lead: T.lead * 0.88 });
    },
    popup: 'threshold',
  },
  ch9: {
    side: 'L', num: 26, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 26, 'L');
      P.y = 1.6; chapterHead(P, 'IX', 'The Pattern', 'Perceptrons and neural networks');
      P.para('Two witnesses each answer yes (1) or no (0). Can a machine learn how to weigh them? A **perceptron**, the simplest artificial neuron, multiplies each input *x* by a *weight* *w*, adds a *bias* *b*, and fires if the sum *z* = *w*₁*x*₁ + *w*₂*x*₂ + *b* is at least 0. Weights say how much an input counts; the bias moves the bar.', { dropcap: true });
      P.para(`It learns from mistakes: *w* ← *w* + η (*y* − *ŷ*) *x*, for true answer *y*, guess *ŷ* and learning rate η; *b* moves likewise, with *x* = 1. If the guess was right, nothing changes. To fire only when both witnesses say yes (AND), with η = 0.1, it needs ${NE.and.epoch} passes: *w*₁ = ${NE.and.w[0]}, *w*₂ = ${NE.and.w[1]}, *b* = ${neg(NE.and.b)}. Both yes: ${NE.and.w[0]} + ${NE.and.w[1]} − ${Math.abs(NE.and.b)} = 0, so it fires. One yes: at most −0.1, so it does not.`, { indent: 0.6 });
      P.para(`Now flag the case when the witnesses *disagree* (XOR). A perceptron draws one straight line, and no line splits these four cases: they are not *linearly separable*. After 1,000 passes it gets ${NE.xor.right} of 4 right.`, { indent: 0.6 });
      P.para('A **neural network** stacks neurons in layers: inputs, *hidden layers*, outputs. Each neuron applies an *activation function*, such as the sigmoid or ReLU. These must bend, or the layers collapse into one straight line.', { indent: 0.6 });
      P.para('To train it, a *loss* measures the error. **Gradient descent** moves each weight a small step downhill, and **backpropagation** works out those slopes, passing the error backward from the output layer by layer.', { indent: 0.6 });
    },
  },
  fig91: {
    side: 'R', num: 27, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case IX · The Pattern', 27, 'R');
      nnPrint(g, S, P);
      exhibit(P, 'Exhibit 9.1 · a network that learned XOR', 'Two inputs in front, two hidden neurons, one output: 9 numbers in all. Red strings add, blue subtract. Hidden A fires on (0, 1), B on (1, 0), and the output on either.', 10.2);
      P.gap(0.08);
      P.table([['Witnesses', ...[[0, 0], [0, 1], [1, 0], [1, 1]].map(x => `~(${x})`)], ['Wanted', '0', '1', '1', '0'], ['Network', ...NE.net.out.map(v => v.toFixed(3))]], [3.5, 1.85, 1.85, 1.85, P.w - 9.05], { size: 0.27, lead: 0.36, align: ['left', 'right', 'right', 'right', 'right'] });
      P.para(`Backpropagation took its loss from ${NE.net.curve[0][1].toFixed(3)} to ${NE.net.curve[NE.net.curve.length - 1][1].toFixed(4)} in 20,000 passes. Starting weights matter: ${NE.seeds.h2} of ${NE.seeds.of} random starts solved it. With three hidden neurons, ${NE.seeds.h3} of ${NE.seeds.of} did.`, { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
      P.para('A network with 98% in training and 65% on a test set memorised: it does not *generalise*. For images, *convolutional networks* (CNNs) learn edges, then shapes.', { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
      P.aside('Quick quiz', '*100% on 100 pictures: does the network understand cats?* No, a pattern fits them.', { size: T.bodySize * 0.86, lead: T.lead * 0.86 });
    },
    popup: 'network',
  },
  ch10: {
    side: 'L', num: 28, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 28, 'L');
      P.y = 1.6; chapterHead(P, 'X', 'The Witness', 'Large language models and generative AI');
      P.para('The last witness is fluent, tireless and sometimes wrong. A **language model** gives the probability of the next *token*, a word or piece of a word, given the tokens before it. A **large language model** (LLM) does this with a neural network of billions of weights, trained on a vast body of text.', { dropcap: true });
      P.para(`The smallest version counts word pairs. Ours read ${LA.n} tokens of case notes. After “the” it has seen ${LA.after.map(([w2, c]) => `${w2} ${pc(c / LA.after.reduce((a, b) => a + b[1], 0), 0)}`).join(', ')}. Sample a word, append it, repeat: that is *generation*.`, { indent: 0.6 });
      P.para('Modern LLMs are **transformers** (2017). Each token becomes a vector of numbers, an *embedding*. **Self-attention** lets each token weigh every other, so “it” can look back to “safe”. The model sees only what fits in its *context window*.', { indent: 0.6 });
      P.para('*Pre-training* teaches next-token prediction. *Fine-tuning* adapts the model, and *reinforcement learning from human feedback* (RLHF) rewards answers people prefer: Case V again.', { indent: 0.6 });
      P.para('**Generative AI** makes new text, images or sound. *Diffusion models* learn to remove noise step by step. *Generative adversarial networks* (GANs) train a forger against a detector: Case IV, in a new form.', { indent: 0.6 });
      P.para('A fluent, false answer is a **hallucination**. The model is built to continue text, not to check it.', { indent: 0.6 });
    },
  },
  fig101: {
    side: 'R', num: 29, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case X · The Witness', 29, 'R');
      wordPrint(g, S, P);
      exhibit(P, 'Exhibit 10.1 · what comes after “the”', `Three ridges of bars give the next word at three *temperatures* T. Low T sharpens the odds; high T flattens them. In front, the height of each word is how much “it” attends to that word.`, 10.2);
      P.gap(0.08);
      const ws = LA.after.map(a => a[0]);
      P.table([['T', ...ws.map(x => '~' + x)], ...['0.5', '1', '2'].map(t => [t, ...ws.map(x => pc(LA.T[t][x], 1))])], [1.5, 2.4, 2.4, 2.4, P.w - 8.7], { size: 0.27, lead: 0.36, align: ['left', 'right', 'right', 'right', 'right'] });
      P.para(`**How a witness lies without lying.** The notes say Reed opened the door and Moss opened the safe. They never say “${LA.claim.replace(' .', '').replace('reed', 'Reed')}”. Yet every word pair in it is real, so the model says it with a ${pc(LA.claimP, 0)} chance once it starts with “Reed”. Of ${LA.sampled.toLocaleString('en-US')} sampled sentences, ${LA.new} are in no note at all.`, { size: T.bodySize * 0.92, lead: T.lead * 0.92 });
      P.para('*Attention weights come from small vectors set by hand for this exhibit; a real model learns its own.*', { size: 0.26, lead: 0.36, color: INK2, after: 0.1 });
    },
    popup: 'nextWord',
  },
  ch10b: {
    side: 'L', num: 30, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 30, 'L');
      P.y = 1.7; P.kicker('Case X · Cross-examination');
      P.text('Can the witness be trusted?', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.62 * S}px ${TITLE}` }); P.y += 1.2;
      P.para('**AI safety** is the work of making sure systems do what people intend, and that their failures are caught. The charges are familiar by now:', { dropcap: true });
      P.para('*Bias.* A model trained on unfair records repeats them. *Hallucination.* Fluent text is not checked text. *Misuse.* The same tools can make deepfakes and scams. *Privacy.* What goes into a public model may not come back out safely. *Prompt injection.* Instructions hidden in a document can hijack a model that reads it. *Misalignment.* An agent chases the goal it was given, not the goal you meant: the reward problem of Case V, now with higher stakes.', { indent: 0.6 });
      P.para('**The law agrees.** Kazakhstan’s Law on Artificial Intelligence, No. 230-VIII, adopted on 17 November 2025, puts people first. It sorts systems by *risk* (minimal, medium, high) and by *autonomy* (whether a person can correct the decision). It bans systems that manipulate people, tells owners to manage risk, and requires that users be told when AI is at work and that synthetic results be labelled.', { indent: 0.6 });
      P.para('Responsibility stays with people. “The model made the decision” is no defence: someone chose to use it, and someone must be able to step in.', { indent: 0.6 });
      P.para('A good detective checks a witness against the record. *Retrieval-augmented generation* gives a model real documents to quote, and a careful reader asks for sources and verifies them.', { indent: 0.6 });
    },
  },
  fig102: {
    side: 'R', num: 31, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case X · The Witness', 31, 'R');
      layerPrint(g, S, P);
      exhibit(P, 'Exhibit 10.2 · layers of defence', `No safeguard is perfect, so they are stacked: every card has holes. The twine is a harm that one layer stops. The red string found holes that line up.`, 10.4);
      P.gap(0.08);
      P.table([['Layer', 'Misses'], ...['Data checks', 'Model training', 'Output filters', 'Human review'].map((l, i) => [l, pc(LA.miss[i], 0)])], [7.0, P.w - 7.0], { size: 0.27, lead: 0.35, align: ['left', 'right'] });
      P.para(`If these invented layers failed independently, ${LA.miss.map(m => m.toFixed(2)).join(' × ')} = ${LA.through.toFixed(4)}: 1 harm in ${Math.round(1 / LA.through).toLocaleString('en-US')} gets through. Layers that share a weakness do far worse.`, { size: T.bodySize * 0.9, lead: T.lead * 0.9 });
      P.aside('Myth vs fact', '*Myth:* an LLM looks facts up. *Fact:* unless given search or documents, it writes what is likely.', { color: ACCENT, size: T.bodySize * 0.9, lead: T.lead * 0.9 });
    },
    popup: 'safeguards',
  },
  quiz: {
    side: 'L', num: 32, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 32, 'L');
      P.y = 1.7; P.kicker('Cold-case review');
      P.text('Ten questions', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.66 * S}px ${TITLE}` }); P.y += 1.3;
      P.para('One question from each case. Answers are on the facing page, so cover it first.', { after: 0.2 });
      QUIZ.forEach(([r, q], i) => P.para(`**${r}.** ${q}`, { after: 0.14 }));
    },
  },
  answers: {
    side: 'R', num: 33, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Cold-case review', 33, 'R');
      P.y = 1.7; P.kicker('Answers');
      QUIZ.forEach(([r, , a]) => P.para(`**${r}.** ${a}`, { after: 0.12, size: T.bodySize * 0.95, lead: T.lead * 0.95 }));
      P.gap(0.15); P.kicker('Milestones on the board', INDIGO);
      P.table(MILESTONES, [1.7, P.w - 1.7], { size: 0.27, lead: 0.35 });
    },
  },
  colophon: {
    side: 'L', num: 34, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 34, 'L');
      P.y = 2.0; P.kicker('About this book');
      P.text('Colophon', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.7 * S}px ${TITLE}` }); P.y += 1.3;
      P.para(`*${TITLE_TXT}: ${SUB_TXT}* is the endterm project for AI Fundamentals (AIF1303) at QAIRU, Fall trimester 2026, by ${AUTHOR}.`, {});
      P.para('**Sources.** S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed.; AIF1303 lectures, weeks 1–9, and the syllabus for week 10; Hart, Nilsson and Raphael, 1968 (A§); Vaswani et al., “Attention Is All You Need”, 2017; Reason, “Human error: models and management”, 2000; Law of the Republic of Kazakhstan No. 230-VIII, 2025.', {});
      P.para('**Numbers.** Every value in the exhibits and tables was produced by running the algorithms described, in Python. The tips, case notes and safeguard rates are invented for teaching.', {});
      P.para('**Use of AI.** Generative AI (Claude by Anthropic, and Codex by OpenAI) wrote the text, figures and code under the author’s creative direction. Accuracy was checked by independent AI review against the sources above and by running the algorithms in Python. The author is responsible for the work. The full declaration accompanies the submission.', {});
      P.para('**Made with** three.js. Set in Courier Prime, Special Elite and Playfair Display. **Sound:** public-domain recordings from Wikimedia Commons (rain, thunder, pages, clock), the rest synthesised live in the browser.', {});
      P.gap(0.3); P.text(BOOK_URL.replace('https://', ''), P.x0, P.y, { font: `400 ${0.28 * S}px ${SERIF}`, color: ACCENT });
      stamp(g, S, 'CASE CLOSED', 9.8, 18.2, { rot: -0.1, size: 0.42 });
    },
  },
  endBack: { kind: 'board', draw: (g, S, w, h) => endpaper(g, S, w, h, 'left') },
  back: {
    kind: 'board', draw(g, S, w, h, extra) {
      clothFill(g, w, h, T.cloth);
      const fg = NOIR ? '#e6d6b4' : '#f2f2f2';
      g.fillStyle = fg; g.textAlign = 'center';
      g.font = `${NOIR ? 700 : 600} ${0.9 * S}px ${TITLE}`; g.letterSpacing = (NOIR ? 0.08 : 0) * S + 'px'; g.fillText(TITLE_TXT, 7.25 * S + (NOIR ? 0.04 : 0) * S, 6.4 * S); g.letterSpacing = '0px';
      if (extra?.qr) { const q = 4.2, y = 7.6; g.fillStyle = T.paper; g.fillRect((7.25 - q / 2 - 0.3) * S, (y - 0.3) * S, (q + 0.6) * S, (q + 0.6) * S); g.drawImage(extra.qr, (7.25 - q / 2) * S, y * S, q * S, q * S); }
      g.fillStyle = fg; g.font = `400 ${0.28 * S}px ${DISPLAY}`; g.letterSpacing = 0.1 * S + 'px';
      g.fillText('SCAN TO OPEN THE BOOK', 7.25 * S + 0.05 * S, 13.2 * S); g.letterSpacing = '0px';
      g.font = `400 ${0.28 * S}px ${SERIF}`; g.fillText('AI Fundamentals · QAIRU · 2026', 7.25 * S, 18.9 * S);
    },
  },
};
const QUIZ = [
  ['I', 'A rational agent’s plan fails through bad luck. Was it irrational?', 'No. Rational means the best choice on what it knew, not knowing the future.'],
  ['II', 'If *h*(*n*) = 0 everywhere, what does A§ become?', 'Uniform-cost search: *f* = *g*.'],
  ['III', 'Why does simulated annealing accept a worse move?', 'To escape local maxima. It does so less as the temperature falls.'],
  ['IV', 'Can alpha–beta change the root’s value?', 'No. It skips only branches that cannot affect it.'],
  ['V', 'What does an agent with γ = 0 care about?', 'Only the next reward.'],
  ['VI', 'Evidence is ten times likelier if H is true. Is H now likely?', 'Not necessarily: the prior matters as much.'],
  ['VII', 'Filtering and smoothing: which uses later readings?', 'Smoothing. Filtering uses only readings so far.'],
  ['VIII', 'A fault hits 2% of machines. “Never faulty” scores 98%. Is that good?', 'No. Recall is 0: it catches no faults.'],
  ['IX', 'Why can a single perceptron not learn XOR?', 'It draws one straight line, and XOR needs two.'],
  ['X', 'Why can an LLM sound sure and be wrong?', 'It predicts likely text. Fluency is not evidence.'],
];
const MILESTONES = [['~Year', '~Event'], ['1950', 'Turing asks whether machines can think'], ['1956', 'The Dartmouth workshop names the field'], ['1968', 'A§ is published'], ['1997', 'Deep Blue defeats Kasparov at chess'], ['2016', 'AlphaGo defeats Lee Sedol at Go'], ['2017', 'The transformer is published']];
export const CASES = [['I', 'The Agent', 'agents', 4], ['II', 'The Trail', 'search, A*', 6], ['III', 'The High Ground', 'local search, CSP', 10], ['IV', 'The Opponent', 'adversarial search', 12], ['V', 'The Long Game', 'MDPs, RL', 14], ['VI', 'The Evidence', 'Bayesian networks', 18], ['VII', 'The Unseen', 'hidden Markov models', 20], ['VIII', 'The Interrogation', 'decisions, ML', 22], ['IX', 'The Pattern', 'neural networks', 26], ['X', 'The Witness', 'LLMs, safety', 28]];

// sheets: [front, back]; front lies right before the turn, back lies left after it
export const SHEETS = [
  ['cover', 'endFront', 'board'],
  ['title', 'preface'],
  ['contents', 'ch1'],
  ['fig11', 'ch2'],
  ['fig21', 'astar'],
  ['fig22', 'ch3'],
  ['fig31', 'ch4'],
  ['fig41', 'ch5'],
  ['fig51', 'ch5b'],
  ['fig52', 'ch6'],
  ['fig61', 'ch7'],
  ['fig71', 'ch8'],
  ['fig81', 'ch8b'],
  ['fig82', 'ch9'],
  ['fig91', 'ch10'],
  ['fig101', 'ch10b'],
  ['fig102', 'quiz'],
  ['answers', 'colophon'],
  ['endBack', 'back', 'board'],
];
export const SPREADS = ['Cover', 'Title', 'Preface · Contents', 'Case I · The Agent', 'Case II · The Trail', 'Case II · A*', 'Case III · The High Ground', 'Case IV · The Opponent', 'Case V · The Long Game', 'Case V · Learning', 'Case VI · The Evidence', 'Case VII · The Unseen', 'Case VIII · The Interrogation', 'Case VIII · The line-up', 'Case IX · The Pattern', 'Case X · The Witness', 'Case X · Cross-examination', 'Cold-case review', 'Colophon', 'Back cover'];
