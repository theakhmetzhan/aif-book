// Every face of every sheet: what is printed (canvas) and what pops up (3D). Face coords: x → right, v ↓ down, page 14 × 20.
import { Page, INK, INK2, ACCENT, INDIGO, RULE, SERIF, DISPLAY } from './typeset.js';
import { paperFill, pageShade, endpaper, clothFill, goldGradient, star8 } from './paper.js';
import graph from './data/graph.json';
import hills from './data/hills.json';
import contours from './data/contours.json';

export const BOOK_URL = 'https://theakhmetzhan.github.io/aif-ushqyn/';
export const C = { cream: '#efe4cc', white: '#f7f1e3', kraft: '#c29a6b', indigo: '#34426e', terracotta: '#b65a36', ochre: '#d4a24c', sage: '#8f9f86', ink: INK };

const pageBase = (g, w, h, spine) => { paperFill(g, w, h, '#f2e9d6', 0.5, spine === 'left' ? 2 : 4); pageShade(g, w, h, spine); };
const runningHead = (P, txt, num, side) => {
  const f = `400 ${0.24 * P.S}px ${SERIF}`;
  P.text(txt.toUpperCase(), 7, 1.05, { font: f, color: INK2, align: 'center', spacing: 0.05 });
  P.text(String(num), side === 'L' ? P.x0 : P.x1, 19.05, { font: `400 ${0.3 * P.S}px ${SERIF}`, color: INK2, align: side === 'L' ? 'left' : 'right' });
};
const chapterHead = (P, roman, title, sub) => {
  P.text(roman, P.x0 - 0.04, P.y + 2.0, { font: `500 ${2.6 * P.S}px ${DISPLAY}`, color: ACCENT });
  P.text(title, P.x0, P.y + 3.15, { font: `500 ${1.02 * P.S}px ${DISPLAY}`, color: INK });
  P.text(sub, P.x0, P.y + 3.75, { font: `italic 400 ${0.4 * P.S}px ${SERIF}`, color: INK2 });
  P.y += 4.05; P.rule(P.y, { x1: P.x0 + 1.6, color: ACCENT, w: 0.03 }); P.y += 0.3;
};
const caption = (P, label, text, y) => {
  P.y = y; P.rule(P.y, { x1: P.x0 + 1.2, color: ACCENT, w: 0.025 }); P.y += 0.12;
  P.para(`**${label}** ${text}`, { size: 0.33, lead: 0.47, color: INK2, after: 0.1 });
};

// ---------- figure geometry (shared by print + pop-up) ----------
export const FIG11 = {
  agent: { x0: 3.6, x1: 10.4, v0: 2.3, v1: 5.3, h: 2.1 },
  env: { x0: 2.0, x1: 12.0, v0: 8.1, v1: 11.5, h: 0.75 },
  percept: [[11.2, 8.1], [11.2, 3.8], [10.4, 3.8]], // env → agent (right side)
  action: [[3.6, 3.8], [2.8, 3.8], [2.8, 8.1]], // agent → env (left side)
};
export const G = (() => {
  const N = graph.nodes, h = graph.h;
  const nodes = Object.keys(N).map(k => ({ id: k, x: N[k][0], v: N[k][1], h: h[k] }));
  return { nodes, by: Object.fromEntries(nodes.map(n => [n.id, n])), edges: graph.edges, astar: graph.astar, bfs: graph.bfs, ucs: graph.ucs };
})();
export const HEIGHT_H = n => 0.3 + n.h * 0.19; // fig 2.1 node height = heuristic landscape
// label offsets (x, v) for node info, hand-placed to avoid edges
const HOFF = { S: [-0.15, 0.95], A: [-1.25, 0.2], B: [-0.2, 0.95], C: [0.62, 0.62], D: [-1.3, 0.1], E: [0.3, 0.95], F: [0.62, 0.42], H: [0.55, 0.62], G: [0.0, -0.66] };
export const A_ORDER = Object.fromEntries(G.astar.order.map((o, i) => [o[0], { k: i + 1, g: o[1], f: o[2] }]));
export const A_FRONTIER = { B: { g: 4, f: 14.6 }, D: { g: 9, f: 14.7 }, E: { g: 15, f: 21.9 } };
export const HILL = { tierH: 0.26, base: 0.12, th: 0.07, levels: contours, local: hills.local.path, global: hills.global.path, peaks: hills.peaks };
export const fHill = (x, v) => hills.peaks.reduce((a, [px, pv, s, A]) => a + A * Math.exp(-((x - px) ** 2 + (v - pv) ** 2) / (2 * s * s)), 0);
export const tierTop = idx => HILL.base + idx * HILL.tierH + HILL.th;

function arrowPrint(g, S, pts, color) {
  g.strokeStyle = color; g.lineWidth = 0.05 * S; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, v], i) => i ? g.lineTo(x * S, v * S) : g.moveTo(x * S, v * S)); g.stroke();
  const [a, b] = pts.slice(-2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  g.fillStyle = color; g.beginPath(); g.moveTo(b[0] * S, b[1] * S);
  g.lineTo((b[0] - Math.cos(ang - 0.45) * 0.42) * S, (b[1] - Math.sin(ang - 0.45) * 0.42) * S);
  g.lineTo((b[0] - Math.cos(ang + 0.45) * 0.42) * S, (b[1] - Math.sin(ang + 0.45) * 0.42) * S); g.closePath(); g.fill();
}
function graphPrint(g, S, P, { costs = true, hlabels = false, astar = false }) {
  for (const [a, b, c] of G.edges) {
    const A = G.by[a], B = G.by[b];
    g.strokeStyle = 'rgba(42,34,25,.55)'; g.lineWidth = 0.035 * S; g.beginPath(); g.moveTo(A.x * S, A.v * S); g.lineTo(B.x * S, B.v * S); g.stroke();
    if (costs) {
      const mx = (A.x + B.x) / 2, mv = (A.v + B.v) / 2, dx = B.x - A.x, dv = B.v - A.v, L = Math.hypot(dx, dv);
      let nx = -dv / L, nv = dx / L; if (nv > 0) { nx = -nx; nv = -nv; } // put label on the upper side
      const lx = mx + nx * 0.34, lv = mv + nv * 0.34;
      g.fillStyle = '#f2e9d6'; g.beginPath(); g.arc(lx * S, lv * S, 0.2 * S, 0, 7); g.fill();
      P.text(String(c), lx, lv + 0.01, { font: `italic 500 ${0.3 * S}px ${SERIF}`, color: ACCENT, align: 'center', baseline: 'middle' });
    }
  }
  for (const n of G.nodes) {
    g.strokeStyle = 'rgba(42,34,25,.5)'; g.lineWidth = 0.03 * S; g.beginPath(); g.arc(n.x * S, n.v * S, 0.42 * S, 0, 7); g.stroke();
    if (hlabels) {
      const [ox, ov] = HOFF[n.id];
      P.text(`h = ${n.h.toFixed(1)}`, n.x + ox, n.v + ov, { font: `italic 400 ${0.27 * S}px ${SERIF}`, color: INK2, align: ox < -0.5 ? 'left' : ox > 0.4 ? 'left' : 'center' });
    }
    if (astar) {
      const [ox, ov] = HOFF[n.id]; const o = A_ORDER[n.id] || A_FRONTIER[n.id];
      if (o) P.text(`f = ${o.f.toFixed(1)}`, n.x + ox, n.v + ov, { font: `italic 400 ${0.27 * S}px ${SERIF}`, color: A_ORDER[n.id] ? ACCENT : INK2, align: ox < -0.5 ? 'left' : ox > 0.4 ? 'left' : 'center' });
    }
  }
}
function hillPrint(g, S) {
  HILL.levels.forEach((L, i) => {
    for (const loop of L.loops) {
      g.beginPath(); loop.forEach(([x, v], k) => k ? g.lineTo(x * S, v * S) : g.moveTo(x * S, v * S)); g.closePath();
      g.strokeStyle = `rgba(42,34,25,${0.25 + i * 0.04})`; g.lineWidth = 0.025 * S; g.stroke();
    }
  });
  const dots = (path, col) => { path.forEach(([x, v], k) => { g.fillStyle = col; g.beginPath(); g.arc(x * S, v * S, (k === 0 ? 0.13 : 0.075) * S, 0, 7); g.fill(); }); };
  dots(HILL.local, C.indigo); dots(HILL.global, C.terracotta);
}

// ---------- faces ----------
export const FACES = {
  cover: {
    kind: 'board', draw(g, S, w, h) {
      clothFill(g, w, h);
      const P = new Page(g, S);
      g.strokeStyle = goldGradient(g, 0, 0, w, h); g.lineWidth = 0.04 * S; g.strokeRect(0.8 * S, 0.8 * S, (14.5 - 1.6) * S, (20.8 - 1.6) * S);
      g.lineWidth = 0.015 * S; g.strokeRect(0.95 * S, 0.95 * S, (14.5 - 1.9) * S, (20.8 - 1.9) * S);
      g.fillStyle = goldGradient(g, 0, 12 * S, w, 16 * S);
      for (const [t, y, f, sp] of [['Ұшқын', 13.6, `500 ${1.9 * S}px ${DISPLAY}`, 0], ['USHQYN', 14.75, `500 ${0.42 * S}px ${SERIF}`, 0.32], ['THE SPARK THAT LEARNED TO THINK', 15.55, `400 ${0.3 * S}px ${SERIF}`, 0.12]]) {
        g.font = f; g.textAlign = 'center'; g.letterSpacing = sp * S + 'px'; g.fillText(t, 7.25 * S + sp * S / 2, y * S); g.letterSpacing = '0px';
      }
      g.font = `italic 400 ${0.34 * S}px ${SERIF}`; g.fillText('A pop-up book of AI fundamentals', 7.25 * S, 17.6 * S);
      g.font = `400 ${0.27 * S}px ${SERIF}`; g.letterSpacing = 0.12 * S + 'px'; g.fillText('AKHMETZHAN TURLYBEK', 7.25 * S + 0.06 * S, 18.6 * S); g.letterSpacing = '0px';
      g.beginPath(); star8(g, 7.25 * S, 6.9 * S, 3.6 * S); g.strokeStyle = goldGradient(g, 0, 3 * S, w, 11 * S); g.lineWidth = 0.03 * S; g.stroke();
    },
    gold(g, S, w, h) { // metalness mask: white = gold
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
      g.lineWidth = 0.04 * S; g.strokeRect(0.8 * S, 0.8 * S, (14.5 - 1.6) * S, (20.8 - 1.6) * S); g.lineWidth = 0.015 * S; g.strokeRect(0.95 * S, 0.95 * S, (14.5 - 1.9) * S, (20.8 - 1.9) * S);
      for (const [t, y, f, sp] of [['Ұшқын', 13.6, `500 ${1.9 * S}px ${DISPLAY}`, 0], ['USHQYN', 14.75, `500 ${0.42 * S}px ${SERIF}`, 0.32], ['THE SPARK THAT LEARNED TO THINK', 15.55, `400 ${0.3 * S}px ${SERIF}`, 0.12]]) { g.font = f; g.textAlign = 'center'; g.letterSpacing = sp * S + 'px'; g.fillText(t, 7.25 * S + sp * S / 2, y * S); g.letterSpacing = '0px'; }
      g.font = `italic 400 ${0.34 * S}px ${SERIF}`; g.fillText('A pop-up book of AI fundamentals', 7.25 * S, 17.6 * S);
      g.font = `400 ${0.27 * S}px ${SERIF}`; g.letterSpacing = 0.12 * S + 'px'; g.fillText('AKHMETZHAN TURLYBEK', 7.25 * S + 0.06 * S, 18.6 * S); g.letterSpacing = '0px';
      g.beginPath(); star8(g, 7.25 * S, 6.9 * S, 3.6 * S); g.lineWidth = 0.03 * S; g.stroke();
    },
    popup: 'coverMedallion', spark: [7.25, 2.2, 6.9],
  },
  endFront: { kind: 'board', draw: (g, S, w, h) => endpaper(g, w, h, S), spark: [-7, 2, 0] },
  title: {
    side: 'R', num: 1, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S);
      g.beginPath(); star8(g, 7 * S, 6.6 * S, 2.75 * S); g.strokeStyle = 'rgba(168,72,42,.35)'; g.lineWidth = 0.025 * S; g.stroke();
      P.text('Ұшқын', 7, 12.0, { font: `500 ${1.5 * S}px ${DISPLAY}`, color: INK, align: 'center' });
      P.text('USHQYN', 7, 12.85, { font: `500 ${0.36 * S}px ${SERIF}`, color: ACCENT, align: 'center', spacing: 0.3 });
      P.text('The Spark That Learned to Think', 7, 13.85, { font: `italic 400 ${0.5 * S}px ${SERIF}`, color: INK, align: 'center' });
      P.rule(14.55, { x0: 6.2, x1: 7.8, color: ACCENT, w: 0.025 });
      P.text('A pop-up book of the ideas behind artificial intelligence,', 7, 15.35, { font: `400 ${0.34 * S}px ${SERIF}`, color: INK2, align: 'center' });
      P.text('from agents and search to learning machines', 7, 15.85, { font: `400 ${0.34 * S}px ${SERIF}`, color: INK2, align: 'center' });
      P.text('AKHMETZHAN TURLYBEK', 7, 17.6, { font: `500 ${0.3 * S}px ${SERIF}`, color: INK, align: 'center', spacing: 0.12 });
      P.text('AI Fundamentals · QAIRU · 2026', 7, 18.2, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: INK2, align: 'center' });
    },
    popup: 'titleMedallion', spark: [7, 2.1, 6.6],
  },
  preface: {
    side: 'L', num: 2, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 2, 'L');
      P.y = 2.2; P.kicker('Preface');
      P.text('A spark on the steppe', P.x0, P.y + 0.75, { font: `500 ${0.9 * S}px ${DISPLAY}` }); P.y += 1.45;
      P.para('Every intelligent system in this book begins the same way: something that can sense a little of its world and act on a little of it. Here that something is Ushqyn (Kazakh for “spark”), a point of light on a dark steppe.', { dropcap: true });
      P.para('Ushqyn is not a creature. It is an **agent**, the word AI uses for anything that perceives its environment and acts upon it. Each chapter gives it one new way of thinking, in the order the AI Fundamentals course taught them: reacting, searching, optimising, reasoning under uncertainty and, finally, learning.', { indent: 0.6 });
      P.para('This is a pop-up book. Every figure stands up from its page, and its heights mean something: how far a camp is from the goal, how good a solution is. Drag to walk around a figure. Press **Read** to look straight down, and the figure folds back into an ordinary diagram that lines up with the text.', { indent: 0.6 });
      P.para('Every number in the figures was computed by the algorithms the chapters describe, and checked twice.', { indent: 0.6 });
      P.gap(0.5);
      P.text('A. T.', P.x1, P.y, { font: `italic 400 ${0.4 * S}px ${SERIF}`, color: INK2, align: 'right' });
      P.text('November 2026', P.x1, P.y + 0.55, { font: `italic 400 ${0.34 * S}px ${SERIF}`, color: INK2, align: 'right' });
    },
    spark: [-7, 1.6, 4],
  },
  contents: {
    side: 'R', num: 3, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S); runningHead(P, 'Contents', 3, 'R');
      P.y = 2.2; P.kicker('Contents');
      P.text('Ten worlds', P.x0, P.y + 0.75, { font: `500 ${0.9 * S}px ${DISPLAY}` }); P.y += 1.7;
      const rows = [['I', 'Waking', 'Agents and environments', 4], ['II', 'The Paths', 'Search, A* and heuristics', 6], ['III', 'The Mountains', 'Local search and CSPs', 10], ['IV', 'The Board', 'Adversarial search'], ['V', 'The Storm', 'MDPs and reinforcement learning'], ['VI', 'The Night Sky', 'Probability and Bayesian networks'], ['VII', 'The Hidden Engine', 'Hidden Markov models'], ['VIII', 'The Saxaul Tree', 'Rational decisions and classical ML'], ['IX', 'The Roots', 'Perceptrons and neural networks'], ['X', 'The River of Words', 'LLMs, generative AI and safety']];
      for (const [r, t, s, p] of rows) {
        const on = p !== undefined, col = on ? INK : 'rgba(42,34,25,.38)';
        P.text(r, P.x0 + 0.9, P.y, { font: `500 ${0.42 * S}px ${DISPLAY}`, color: on ? ACCENT : 'rgba(168,72,42,.4)', align: 'right' });
        P.text(t, P.x0 + 1.3, P.y, { font: `500 ${0.5 * S}px ${DISPLAY}`, color: col });
        P.text(s, P.x0 + 1.3, P.y + 0.46, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: on ? INK2 : 'rgba(91,79,64,.4)' });
        if (on) {
          g.font = `500 ${0.5 * S}px ${DISPLAY}`; const tw = g.measureText(t).width / S;
          g.fillStyle = 'rgba(42,34,25,.35)'; for (let x = P.x0 + 1.3 + tw + 0.25; x < P.x1 - 0.55; x += 0.2) { g.beginPath(); g.arc(x * S, (P.y - 0.05) * S, 0.022 * S, 0, 7); g.fill(); }
          P.text(String(p), P.x1, P.y, { font: `400 ${0.4 * S}px ${SERIF}`, color: INK, align: 'right' });
        }
        P.y += 1.24;
      }
      P.para('*This prototype edition contains Chapters I–III. The remaining chapters are in preparation.*', { size: 0.3, lead: 0.44, color: INK2, justify: false });
    },
    spark: [12.6, 1.4, 2.4],
  },
  ch1: {
    side: 'L', num: 4, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 4, 'L');
      P.y = 1.6; chapterHead(P, 'I', 'Waking', 'Agents and environments');
      P.para('An **agent** is anything that perceives its environment through *sensors* and acts upon it through *actuators*. Everything it has perceived so far is its *percept sequence*. The *agent function* maps every percept sequence to an action; the *agent program* is the code that implements it (Figure 1.1).', { dropcap: true });
      P.para('A **rational agent** chooses the action expected to maximise its *performance measure*, given its percepts and what it knows. Rational is not omniscient: a good decision can still meet a bad outcome.', { indent: 0.6 });
      P.para('Before choosing an algorithm, describe the task with **PEAS**:', { indent: 0.6, after: 0.08 });
      P.table([['', 'A self-driving car'], ['**P**erformance', 'safety, travel time, comfort'], ['**E**nvironment', 'roads, traffic, weather, pedestrians'], ['**A**ctuators', 'steering, throttle, brakes'], ['**S**ensors', 'cameras, radar, lidar, GPS']], [3.2, P.w - 3.2], { size: 0.32, lead: 0.44 });
      P.para('Agent designs grow with the world they face: a *simple reflex* agent applies rules to the current percept; a *model-based* agent keeps an internal state; a *goal-based* agent plans toward a goal; a *utility-based* agent weighs competing outcomes. Any of them can become a *learning* agent.', { indent: 0 });
    },
    spark: [-7, 1.5, 3],
  },
  fig11: {
    side: 'R', num: 5, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S); runningHead(P, 'I · Waking', 5, 'R');
      const F = FIG11; g.strokeStyle = 'rgba(42,34,25,.4)'; g.lineWidth = 0.03 * S;
      g.strokeRect(F.agent.x0 * S, F.agent.v0 * S, (F.agent.x1 - F.agent.x0) * S, (F.agent.v1 - F.agent.v0) * S);
      g.strokeRect(F.env.x0 * S, F.env.v0 * S, (F.env.x1 - F.env.x0) * S, (F.env.v1 - F.env.v0) * S);
      arrowPrint(g, S, F.percept, C.terracotta); arrowPrint(g, S, F.action, C.indigo);
      P.text('percepts', 10.95, 6.55, { font: `italic 500 ${0.36 * S}px ${SERIF}`, color: C.terracotta, align: 'right' });
      P.text('through sensors', 10.95, 7.05, { font: `400 ${0.28 * S}px ${SERIF}`, color: INK2, align: 'right' });
      P.text('actions', 3.05, 6.55, { font: `italic 500 ${0.36 * S}px ${SERIF}`, color: C.indigo });
      P.text('through actuators', 3.05, 7.05, { font: `400 ${0.28 * S}px ${SERIF}`, color: INK2 });
      caption(P, 'Figure 1.1', 'The agent–environment loop. Percepts flow in through sensors; actions flow out through actuators. The agent program in between is the subject of the rest of this book.', 12.15);
      P.gap(0.15);
      P.text('SIX WAYS ENVIRONMENTS DIFFER', P.x0, P.y + 0.2, { font: `600 ${0.22 * S}px ${SERIF}`, color: INDIGO, spacing: 0.05 }); P.y += 0.42;
      P.table([['Dimension', 'Chess (with a clock)', 'Self-driving'], ['Observable', 'fully', 'partially'], ['Agents', 'multi', 'multi'], ['Outcomes', 'deterministic', 'stochastic'], ['Episodes', 'sequential', 'sequential'], ['Change', 'semi-dynamic', 'dynamic'], ['Actions', 'discrete', 'continuous']], [3.4, 4.0, P.w - 7.4], { size: 0.3, lead: 0.4 });
    },
    popup: 'agentLoop', spark: [7, 2.75, 3.8],
  },
  ch2: {
    side: 'L', num: 6, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 6, 'L');
      P.y = 1.6; chapterHead(P, 'II', 'The Paths', 'Search, A* and heuristics');
      P.para('Ushqyn wants to reach a far camp, G. No algorithm can help until the task is written as a **search problem**: an *initial state* S; the *actions* available in each state; a *transition model* saying where each action leads; a *goal test*; and a *path cost*, the sum of the step costs.', { dropcap: true });
      P.para('Figure 2.1 is this problem as a *state-space graph*: nine camps, thirteen tracks, each labelled with its cost. Search grows a tree of paths from S and keeps a *frontier* of paths not yet extended. Strategies differ only in which frontier node they expand next.', { indent: 0.6 });
      P.para('**Breadth-first search** expands the shallowest node. It finds the path with the fewest steps, here S → B → E → G with cost 18, which is optimal only when every step costs the same.', { indent: 0.6 });
      P.para('**Uniform-cost search** expands the node with the lowest path cost *g(n)*. It finds the cheapest path, S → C → F → G with cost 14, but spreads out in every direction to do so.', { indent: 0.6 });
      P.para('**Depth-first search** expands the deepest node. It needs little memory but is not optimal, and it is not complete when paths can be infinite.', { indent: 0.6 });
      P.aside('Did you know?', 'A* was published in 1968 by Peter Hart, Nils Nilsson and Bertram Raphael at the Stanford Research Institute, to plan routes for the mobile robot Shakey.');
    },
    spark: [-7, 1.5, 3],
  },
  fig21: {
    side: 'R', num: 7, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S); runningHead(P, 'II · The Paths', 7, 'R');
      graphPrint(g, S, P, { costs: true, hlabels: true });
      caption(P, 'Figure 2.1', 'Ushqyn’s steppe as a state-space graph; numbers on the tracks are step costs. Each camp is raised to the height of its heuristic *h(n)*, the straight-line distance to G, so the whole landscape slopes down toward the goal. Look from the side to see the slope; look from above to read the graph.', 15.35);
    },
    popup: 'graphH', spark: [12.7, 2.2, 4.6],
  },
  astar: {
    side: 'L', num: 8, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 8, 'L');
      P.y = 2.2; P.kicker('II · Informed search');
      P.text('A* looks toward the goal', P.x0, P.y + 0.75, { font: `500 ${0.86 * S}px ${DISPLAY}` }); P.y += 1.4;
      P.para('A *heuristic* *h(n)* estimates the cost from *n* to the goal. **A§** expands the frontier node with the lowest *f(n) = g(n) + h(n)*: the cost already paid plus the estimated cost still to pay.', { dropcap: true });
      P.para('A heuristic that never overestimates is **admissible**. One with *h(n) ≤ c(n, n′) + h(n′)* for every step is **consistent**. Straight-line distance is both here, because no track is shorter than the straight line between its camps. With a consistent heuristic, A§ graph search returns an optimal path.', { indent: 0.6 });
      P.table([['', 'Path found', 'Cost', 'Expanded'], ['BFS', 'S → B → E → G', '18', '9'], ['UCS', 'S → C → F → G', '14', '8'], ['A§', 'S → C → F → G', '14', '5']], [1.5, 5.0, 1.8, P.w - 8.3], { size: 0.33, lead: 0.46, align: ['left', 'left', 'right', 'right'] });
      P.para('*Goal tested when a node is expanded; neighbours and ties in alphabetical order.*', { size: 0.28, lead: 0.4, color: INK2, justify: false, after: 0.25 });
      P.table([['A§ step', 'Node', '*~g*', '*~h*', '*~f*'], ...G.astar.order.map((o, i) => [String(i + 1), o[0], String(o[1]), G.by[o[0]].h.toFixed(1), o[2].toFixed(1)])], [2.0, 2.0, 2.0, 2.0, P.w - 8], { size: 0.32, lead: 0.42, align: ['left', 'left', 'right', 'right', 'right'] });
      P.aside('Myth vs fact', '*Myth:* a heuristic is a guess, so A§ may return a worse path. *Fact:* with a consistent heuristic it still returns an optimal path; the heuristic only changes how much work the search does.', { color: C.terracotta });
    },
    spark: [-7, 1.5, 3],
  },
  fig22: {
    side: 'R', num: 9, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S); runningHead(P, 'II · The Paths', 9, 'R');
      graphPrint(g, S, P, { costs: true, astar: true });
      // path underlay
      const p = G.astar.path.map(id => G.by[id]); g.strokeStyle = 'rgba(182,90,54,.35)'; g.lineWidth = 0.2 * S; g.lineCap = 'round'; g.beginPath(); p.forEach((n, i) => i ? g.lineTo(n.x * S, n.v * S) : g.moveTo(n.x * S, n.v * S)); g.stroke(); g.lineCap = 'butt';
      // legend
      const ly = 15.1; const items = [[C.ochre, 'expanded, in order'], ['ring', 'on the frontier'], ['#b9b0a0', 'never generated'], [C.terracotta, 'path returned']];
      items.forEach(([col, t], i) => {
        const x = P.x0 + (i % 2) * 5.4, y = ly + Math.floor(i / 2) * 0.55;
        if (col === 'ring') { g.strokeStyle = INK; g.lineWidth = 0.04 * S; g.beginPath(); g.arc((x + 0.18) * S, (y - 0.1) * S, 0.15 * S, 0, 7); g.stroke(); }
        else if (i === 3) { g.fillStyle = col; g.fillRect(x * S, (y - 0.16) * S, 0.38 * S, 0.12 * S); }
        else { g.fillStyle = col; g.beginPath(); g.arc((x + 0.18) * S, (y - 0.1) * S, 0.16 * S, 0, 7); g.fill(); }
        P.text(t, x + 0.6, y, { font: `400 ${0.3 * S}px ${SERIF}`, color: INK2 });
      });
      caption(P, 'Figure 2.2', 'A§ on the same graph. Camps were expanded in the order shown (1–5); B, D and E were still on the frontier when G was chosen, and H was never generated. The raised ribbon is the path A§ returns: S → C → F → G, cost 14.', 16.35);
    },
    popup: 'graphA', spark: [12.7, 2.2, 4.6],
  },
  ch3: {
    side: 'L', num: 10, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 10, 'L');
      P.y = 1.6; chapterHead(P, 'III', 'The Mountains', 'Local search and constraint satisfaction');
      P.para('In Chapter II the path was the answer. In many problems only the final configuration matters: where to place eight queens, how to order a delivery route. **Local search** keeps one current state and moves to a neighbouring state, guided by an *objective function* to maximise (or a cost to minimise). It needs almost no memory.', { dropcap: true });
      P.para('**Hill climbing** moves to the best neighbour and stops when no neighbour is better. In Figure 3.1 climber A stops after 8 steps on a *local maximum* of height 6.9; climber B reaches the *global maximum*, 10.3, in 14 steps. Hill climbing can also stall on *plateaus* and *ridges*.', { indent: 0.6 });
      P.para('**Random restarts** rerun the climb from random states and keep the best result. **Simulated annealing** sometimes accepts a worse move, with probability exp(Δ*E*/*T*); as the temperature *T* falls, it explores less and settles. **Local beam search** keeps *k* states at once; **genetic algorithms** recombine and mutate a population.', { indent: 0.6 });
      P.para('A **constraint satisfaction problem** describes a state with *variables*, their *domains* and *constraints*: colour every region of a map so that no two neighbours match. *Backtracking search* assigns one variable at a time and undoes a choice as soon as a constraint fails.', { indent: 0.6 });
    },
    spark: [-7, 1.5, 3],
  },
  fig31: {
    side: 'R', num: 11, draw(g, S, w, h) {
      pageBase(g, w, h, 'left'); const P = new Page(g, S); runningHead(P, 'III · The Mountains', 11, 'R');
      hillPrint(g, S);
      P.text('global maximum · 10.3', 9.1, 4.35, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: C.terracotta, align: 'center' });
      P.text('local maximum · 6.9', 2.0, 16.25, { font: `italic 400 ${0.3 * S}px ${SERIF}`, color: C.indigo });
      P.text('A', 1.55, 15.35, { font: `600 ${0.32 * S}px ${SERIF}`, color: C.indigo });
      P.text('B', 12.0, 13.15, { font: `600 ${0.32 * S}px ${SERIF}`, color: C.terracotta });
      caption(P, 'Figure 3.1', 'An objective function as a paper relief: each layer adds one unit of height. Two hill climbers take steps of 0.3 in eight directions. Climber A (indigo) stops on the local maximum; climber B (terracotta) reaches the global maximum. Seen from above, the layers become a contour map.', 16.8);
    },
    popup: 'hills', spark: [9.0, 3.2, 8.6],
  },
  colophon: {
    side: 'L', num: 12, draw(g, S, w, h) {
      pageBase(g, w, h, 'right'); const P = new Page(g, S); runningHead(P, 'Ushqyn', 12, 'L');
      P.y = 2.2; P.kicker('About this book');
      P.text('Colophon', P.x0, P.y + 0.75, { font: `500 ${0.9 * S}px ${DISPLAY}` }); P.y += 1.5;
      P.para('*Ushqyn* is the endterm project for AI Fundamentals (AIF1303) at QAIRU, Fall trimester 2026, by Akhmetzhan Turlybek, Group 1.', {});
      P.para('**Sources.** S. Russell and P. Norvig, *Artificial Intelligence: A Modern Approach*, 4th ed.; AIF1303 lectures, weeks 1–3; Law of the Republic of Kazakhstan “On Artificial Intelligence” No. 230-VIII ZRK (17 November 2025); P. Hart, N. Nilsson and B. Raphael, “A Formal Basis for the Heuristic Determination of Minimum Cost Paths”, 1968.', {});
      P.para('**Numbers.** Every value in Figures 2.1–3.1 and in the tables was produced by running the algorithms described, in Python, and checked a second time in the book’s own code.', {});
      P.para('**Use of AI.** Generative AI (Claude, by Anthropic) was used to draft text, figures and code. All content was reviewed and verified against the sources above. The full declaration accompanies the submission.', {});
      P.para('**Made with** three.js. Set in EB Garamond and Cormorant Garamond. No living beings are depicted; the book has no music.', {});
      P.gap(0.4); P.text(BOOK_URL.replace('https://', ''), P.x0, P.y, { font: `italic 400 ${0.32 * S}px ${SERIF}`, color: ACCENT });
    },
    spark: [-7, 1.5, 3],
  },
  endBack: { kind: 'board', draw: (g, S, w, h) => endpaper(g, w, h, S), spark: [7, 2.6, 10] },
  back: {
    kind: 'board', draw(g, S, w, h, extra) {
      clothFill(g, w, h);
      g.strokeStyle = goldGradient(g, 0, 0, w, h); g.lineWidth = 0.04 * S; g.strokeRect(0.8 * S, 0.8 * S, (14.5 - 1.6) * S, (20.8 - 1.6) * S);
      g.fillStyle = '#e8dcc0'; g.textAlign = 'center';
      g.font = `500 ${0.9 * S}px ${DISPLAY}`; g.fillText('Ushqyn', 7.25 * S, 3.6 * S);
      const lines = ['A point of light wakes on a dark steppe.', 'It learns to search for paths, to climb toward', 'better answers, to reason when it cannot see,', 'and at last to learn. Every figure in this book', 'stands up from the page and folds back into', 'the diagram it explains.'];
      g.font = `italic 400 ${0.42 * S}px ${SERIF}`; lines.forEach((l, i) => g.fillText(l, 7.25 * S, (5.0 + i * 0.66) * S));
      if (extra?.qr) { const q = 4.2; g.fillStyle = '#efe4cc'; g.fillRect((7.25 - q / 2 - 0.3) * S, (10.6 - 0.3) * S, (q + 0.6) * S, (q + 0.6) * S); g.drawImage(extra.qr, (7.25 - q / 2) * S, 10.6 * S, q * S, q * S); }
      g.fillStyle = '#e8dcc0'; g.font = `400 ${0.3 * S}px ${SERIF}`; g.letterSpacing = 0.1 * S + 'px';
      g.fillText('SCAN TO OPEN THE BOOK', 7.25 * S + 0.05 * S, 16.1 * S); g.letterSpacing = '0px';
      g.font = `italic 400 ${0.3 * S}px ${SERIF}`; g.fillText('AI Fundamentals · QAIRU · 2026', 7.25 * S, 18.9 * S);
    },
    spark: [-7.25, 2, 0],
  },
};

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
// what the HUD calls each resting spread p = 0..8
export const SPREADS = ['Cover', 'Title', 'Preface · Contents', 'I · Waking', 'II · The Paths', 'II · A*', 'III · The Mountains', 'Colophon', 'Back cover'];
