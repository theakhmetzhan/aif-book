// Every face of every sheet: what is printed (canvas) and which pop-up stands on it. Face coords: x → right, v ↓ down the page, page 14 × 20.
import { Page, INK, INK2, ACCENT, INDIGO, SERIF, DISPLAY, TITLE, HAND } from './typeset.js';
import { paperFill, pageShade, endpaper, clothFill, goldGradient, rng } from './paper.js';
import { T } from './theme.js';
import graph from './data/graph.json';
import hills from './data/hills.json';
import contours from './data/contours.json';

export const BOOK_URL = 'https://theakhmetzhan.github.io/aif-ushqyn/';
export const TITLE_TXT = 'EVIDENCE', SUB_TXT = 'A Casebook of Artificial Intelligence', AUTHOR = 'Akhmetzhan Turlybek';
export const C = { cream: T.cream, white: T.white, kraft: T.kraft, indigo: T.accent2, terracotta: T.accent, ochre: T.ochre, grey: T.grey, ink: T.ink, paper: T.paper };
const B = T.bold, NOIR = T.name === 'noir';

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
export const FIG11 = { agent: { x0: 4.2, x1: 9.8, v0: 6.6, v1: 9.6 }, env: { x0: 1.6, x1: 12.4, v0: 1.8, v1: 4.6 } };
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
    if (!mask) stamp(g, S, 'CONFIDENTIAL', 9.6, 16.6, { rot: -0.16, color: '#c8352a', size: 0.48, alpha: 0.8 });
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
  endFront: { kind: 'board', draw: (g, S, w, h) => endpaper(g, w, h, S, T.endpaper) },
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
      P.para('Every exhibit stands up from its page. At desk level the exhibits tell the story; lean over the book and the pages underneath give the full explanation. Drag to move around the desk, pinch or ⌃-scroll to come closer, and scroll to turn the page.', { indent: 0.6 });
      P.para('Every number in the exhibits was computed by running the algorithm the case describes, and checked a second time.', { indent: 0.6 });
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
      stamp(g, S, 'CASES IV–X PENDING', 9.3, 18.55, { rot: -0.05, size: 0.26, color: INK2, alpha: 0.7 });
    },
    popup: 'fileDrawer',
  },
  ch1: {
    side: 'L', num: 4, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 4, 'L');
      P.y = 5.2; chapterHead(P, 'I', 'The Agent', 'Agents and environments');
      P.para('Every investigation needs someone who can observe and act. In AI that someone is an **agent**: anything that perceives its environment through *sensors* and acts upon it through *actuators*. Everything it has perceived so far is its *percept sequence*; the *agent function* maps every percept sequence to an action, and the *agent program* implements it.', { dropcap: true });
      P.para('A **rational agent** chooses the action expected to maximise its *performance measure*, given its percepts and what it knows. Rational is not omniscient: a good decision can still meet a bad outcome.', { indent: 0.6 });
      P.para('Before choosing an algorithm, describe the task with **PEAS** (the four cards standing above):', { indent: 0.6, after: 0.06 });
      P.table([['', 'A self-driving car'], ['**P**erformance', 'safety, travel time, comfort'], ['**E**nvironment', 'roads, traffic, weather'], ['**A**ctuators', 'steering, throttle, brakes'], ['**S**ensors', 'cameras, radar, lidar, GPS']], [3.3, P.w - 3.3], { size: 0.28, lead: 0.4 });
      P.para('Designs grow with the world they face: a *simple reflex* agent applies rules to the current percept; a *model-based* agent keeps an internal state; *goal-based* and *utility-based* agents plan. Any of them can become a *learning* agent.', {});
    },
    popup: 'peas',
  },
  fig11: {
    side: 'R', num: 5, draw(g, S, w, h) {
      pageBase(g, w, h, 'left', 4); const P = new Page(g, S); runningHead(P, 'Case I · The Agent', 5, 'R');
      const F = FIG11; g.strokeStyle = INK2; g.lineWidth = 0.03 * S;
      g.strokeRect(F.agent.x0 * S, F.agent.v0 * S, (F.agent.x1 - F.agent.x0) * S, (F.agent.v1 - F.agent.v0) * S);
      g.strokeRect(F.env.x0 * S, F.env.v0 * S, (F.env.x1 - F.env.x0) * S, (F.env.v1 - F.env.v0) * S);
      P.text('AGENT', 7, 8.25, { font: `400 ${0.32 * S}px ${DISPLAY}`, color: INK, align: 'center', spacing: 0.1 });
      P.text('ENVIRONMENT', 7, 3.35, { font: `400 ${0.32 * S}px ${DISPLAY}`, color: INK, align: 'center', spacing: 0.1 });
      arrowPrint(g, S, [[11.2, 4.6], [11.2, 8.1], [9.8, 8.1]], ACCENT); arrowPrint(g, S, [[4.2, 8.1], [2.8, 8.1], [2.8, 4.6]], INDIGO);
      P.text('percepts', 11.45, 6.3, { font: `${B} ${0.28 * S}px ${SERIF}`, color: ACCENT });
      P.text('actions', 2.55, 6.3, { font: `${B} ${0.28 * S}px ${SERIF}`, color: INDIGO, align: 'right' });
      exhibit(P, 'Exhibit 1.1 · the agent–environment loop', 'Percepts flow in through sensors; actions flow out through actuators. The agent program in between is the subject of the rest of this book.', 10.4);
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
      P.text('local max · 6.9', 2.0, 16.35, { font: `${B} ${0.27 * S}px ${SERIF}`, color: INDIGO });
      P.text('A', 1.55, 15.35, { font: `${B} ${0.3 * S}px ${SERIF}`, color: INDIGO });
      P.text('B', 12.0, 13.15, { font: `${B} ${0.3 * S}px ${SERIF}`, color: ACCENT });
      exhibit(P, 'Exhibit 3.1 · hill climbing', 'The objective function cut into paper ridges, each one a slice of the same landscape. Climber A (blue) stops on the local maximum; climber B (red) reaches the global maximum. From above, the printed contours show the landscape as a map.', 16.75);
    },
    popup: 'hills',
  },
  colophon: {
    side: 'L', num: 12, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, TITLE_TXT, 12, 'L');
      P.y = 2.0; P.kicker('About this book');
      P.text('Colophon', P.x0, P.y + 0.7, { font: `${NOIR ? 700 : 600} ${0.7 * S}px ${TITLE}` }); P.y += 1.3;
      P.para(`*${TITLE_TXT}: ${SUB_TXT}* is the endterm project for AI Fundamentals (AIF1303) at QAIRU, Fall trimester 2026, by ${AUTHOR}.`, {});
      P.para('**Sources.** S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed.; AIF1303 lectures, weeks 1–3; P. Hart, N. Nilsson and B. Raphael, “A Formal Basis for the Heuristic Determination of Minimum Cost Paths”, 1968.', {});
      P.para('**Numbers.** Every value in Exhibits 2.1–3.1 and in the tables was produced by running the algorithms described, in Python, and checked a second time in the book’s own code.', {});
      P.para('**Use of AI.** Generative AI (Claude, by Anthropic) was used to draft text, figures and code. All content was reviewed and verified against the sources above. The full declaration accompanies the submission.', {});
      P.para(`**Made with** three.js. Set in ${NOIR ? 'Courier Prime, Special Elite and Playfair Display' : 'Inter, Space Grotesk and JetBrains Mono'}. No living beings are depicted; the book has no music.`, {});
      P.gap(0.3); P.text(BOOK_URL.replace('https://', ''), P.x0, P.y, { font: `400 ${0.28 * S}px ${SERIF}`, color: ACCENT });
      stamp(g, S, 'CASE OPEN', 9.8, 17.4, { rot: -0.18, size: 0.5 });
    },
  },
  endBack: { kind: 'board', draw: (g, S, w, h) => endpaper(g, w, h, S, T.endpaper) },
  back: {
    kind: 'board', draw(g, S, w, h, extra) {
      clothFill(g, w, h, T.cloth);
      const fg = NOIR ? '#e6d6b4' : '#f2f2f2';
      g.fillStyle = fg; g.textAlign = 'center';
      g.font = `${NOIR ? 700 : 600} ${0.9 * S}px ${TITLE}`; g.letterSpacing = (NOIR ? 0.08 : 0) * S + 'px'; g.fillText(TITLE_TXT, 7.25 * S, 3.4 * S); g.letterSpacing = '0px';
      const lines = ['Every intelligent machine is a detective.', 'It gathers evidence, follows leads, rules', 'out the impossible and acts on what remains.', 'Ten cases, from agents and search to', 'learning machines and language models.', 'Every exhibit stands up from its page.'];
      g.font = `400 ${0.34 * S}px ${SERIF}`; lines.forEach((l, i) => g.fillText(l, 7.25 * S, (4.8 + i * 0.6) * S));
      if (extra?.qr) { const q = 4.2; g.fillStyle = T.paper; g.fillRect((7.25 - q / 2 - 0.3) * S, (9.0 - 0.3) * S, (q + 0.6) * S, (q + 0.6) * S); g.drawImage(extra.qr, (7.25 - q / 2) * S, 9.0 * S, q * S, q * S); }
      g.fillStyle = fg; g.font = `400 ${0.28 * S}px ${DISPLAY}`; g.letterSpacing = 0.1 * S + 'px';
      g.fillText('SCAN TO OPEN THE BOOK', 7.25 * S + 0.05 * S, 14.6 * S); g.letterSpacing = '0px';
      g.font = `400 ${0.28 * S}px ${SERIF}`; g.fillText('AI Fundamentals · QAIRU · 2026', 7.25 * S, 18.9 * S);
    },
  },
};
export const CASES = [['I', 'The Agent', 'agents', 4], ['II', 'The Trail', 'search, A*', 6], ['III', 'The High Ground', 'local search, CSP', 10], ['IV', 'The Opponent', 'adversarial search'], ['V', 'The Long Game', 'MDPs, RL'], ['VI', 'The Evidence', 'Bayesian networks'], ['VII', 'The Unseen', 'hidden Markov models'], ['VIII', 'The Interrogation', 'decisions, ML'], ['IX', 'The Pattern', 'neural networks'], ['X', 'The Witness', 'LLMs, safety']];

// sheets: [front, back]; front lies right before the turn, back lies left after it
export const SHEETS = [
  ['cover', 'endFront', 'board'],
  ['title', 'preface'],
  ['contents', 'ch1'],
  ['fig11', 'ch2'],
  ['fig21', 'astar'],
  ['fig22', 'ch3'],
  ['fig31', 'colophon'],
  ['endBack', 'back', 'board'],
];
export const SPREADS = ['Cover', 'Title', 'Preface · Contents', 'Case I · The Agent', 'Case II · The Trail', 'Case II · A*', 'Case III · The High Ground', 'Colophon', 'Back cover'];
