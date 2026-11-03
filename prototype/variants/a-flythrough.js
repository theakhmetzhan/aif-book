// PROTOTYPE variant A: cinematic fly-through. Scroll drives a camera along one path; worlds morph; text as overlays.
import * as THREE from 'three';
import Lenis from 'lenis';
import { createWorld } from '../shared/world.js';
import { book, sections } from '../shared/content.js';
import { mountSearchToy } from '../shared/search-toy.js';

export function mount(app) {
  app.innerHTML = `<style>
    .a-cv{position:fixed;inset:0;width:100vw;height:100vh}
    .a-vig{position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 60%,transparent 40%,rgba(3,5,10,.85) 100%)}
    .a-track{position:relative;height:1100vh}
    .a-hud{position:fixed;top:22px;left:28px;right:28px;display:flex;justify-content:space-between;font:600 11px Inter;letter-spacing:.25em;text-transform:uppercase;color:rgba(233,227,212,.7);z-index:5}
    .a-prog{position:fixed;left:28px;top:50%;transform:translateY(-50%);width:2px;height:40vh;background:rgba(233,227,212,.15);z-index:5}
    .a-prog i{display:block;width:100%;background:#f2c46b;height:0}
    .a-cap{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,86vw);text-align:center;opacity:0;pointer-events:none;z-index:4}
    .a-cap.on{pointer-events:auto}
    .a-cap .k{font:600 11px Inter;letter-spacing:.35em;text-transform:uppercase;color:#f2c46b;margin-bottom:18px}
    .a-cap h2{font:400 clamp(44px,7vw,104px)/0.95 'Cormorant Garamond',serif;letter-spacing:-.01em;margin-bottom:22px;text-shadow:0 4px 40px rgba(0,0,0,.7)}
    .a-cap p{font:300 18px/1.65 Spectral,serif;color:rgba(233,227,212,.88);margin:0 auto 12px;max-width:620px;text-shadow:0 2px 18px rgba(0,0,0,.9)}
    .a-cap.toyside{left:auto;right:4vw;transform:translate(0,-50%);width:min(560px,46vw);text-align:left;background:rgba(7,11,20,.55);backdrop-filter:blur(14px);padding:28px;border-radius:18px;border:1px solid rgba(242,196,107,.18)}
    .a-cap.toyside h2{font-size:48px}
    .a-cap.toyside p{font-size:15px;margin:0 0 10px}
    .a-title h1{font:400 clamp(80px,14vw,210px)/.85 'Cormorant Garamond',serif;letter-spacing:.02em}
    .a-title .kz{font:300 22px Spectral;color:#f2c46b;letter-spacing:.4em;margin-bottom:10px}
    .a-hint{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);font:400 12px Inter;letter-spacing:.3em;text-transform:uppercase;color:rgba(233,227,212,.55);z-index:4}
  </style>
  <canvas class="a-cv"></canvas><div class="a-vig"></div>
  <div class="a-hud"><span>${book.title} · ${book.kazakh}</span><span class="a-ch">Cover</span></div>
  <div class="a-prog"><i></i></div>
  <div class="a-hint">Scroll to begin</div>
  <div class="a-track"></div>`;
  const W = createWorld(app.querySelector('.a-cv'));
  W.setMorph('spark', 'spark', 1);

  // captions: [start,end] in scroll progress
  const caps = [];
  const add = (html, s, e, cls = '') => { const d = document.createElement('div'); d.className = 'a-cap ' + cls; d.innerHTML = html; app.appendChild(d); caps.push({ d, s, e }); return d; };
  add(`<div class="a-title"><div class="kz">${book.kazakh}</div><h1>${book.title}</h1></div><p>${book.subtitle}</p>`, -0.1, 0.07);
  const sec = id => sections.find(s => s.id === id);
  const capOf = (s, i = 0) => `<div class="k">${s.kicker}</div><h2>${s.title}</h2><p>${s.body[i]}</p>`;
  add(capOf(sec('preface'), 0), 0.09, 0.17); add(`<p>${sec('preface').body[1]}</p>`, 0.18, 0.26);
  add(capOf(sec('ch2')), 0.3, 0.4);
  add(capOf(sec('ch2-graph'), 0), 0.45, 0.53); add(`<p>${sec('ch2-graph').body[1]}</p>`, 0.54, 0.61);
  const toyCap = add(`<div class="k">${sec('ch2-astar').kicker}</div><h2>${sec('ch2-astar').title}</h2>${sec('ch2-astar').body.map(b => `<p>${b}</p>`).join('')}<div class="slot"></div>`, 0.64, 0.79, 'toyside');
  mountSearchToy(toyCap.querySelector('.slot'));
  add(capOf(sec('ch3')), 0.86, 1.1);

  // camera path keyed by progress
  const keysP = [
    [0.00, [0, 4, 22], [0, 2, 0], 'spark', 'spark'],
    [0.20, [0, 9, 40], [0, 2, 0], 'spark', 'spark'],
    [0.30, [0, 3.5, 34], [0, 0, -20], 'spark', 'steppe'],
    [0.42, [-16, 6, 22], [12, -2, -24], 'steppe', 'steppe'],
    [0.50, [0, 30, 42], [0, 0, 0], 'steppe', 'graph'],
    [0.62, [-24, 20, 30], [4, 0, 0], 'graph', 'graph'],
    [0.80, [-36, 40, 18], [8, 0, 0], 'graph', 'graph'],
    [0.90, [30, 24, 56], [-4, 4, -6], 'graph', 'mountains'],
    [1.00, [44, 14, 38], [-8, 6, -10], 'mountains', 'mountains'],
  ];
  const ease = x => x * x * (3 - 2 * x);
  const base = new THREE.Vector3(0, 4, 22);
  function apply(p) {
    let i = 0; while (i < keysP.length - 2 && p > keysP[i + 1][0]) i++;
    const [p0, c0, l0] = keysP[i], [p1, c1, l1, f1, t1] = keysP[i + 1];
    const k = ease(Math.min(1, Math.max(0, (p - p0) / (p1 - p0))));
    base.set(...c0.map((c, j) => c + (c1[j] - c) * k));
    W.look.set(...l0.map((c, j) => c + (l1[j] - c) * k));
    // morph: segment's target shapes
    const [, , , f0, t0] = keysP[i];
    if (f1 !== t1) W.setMorph(f1, t1, k); else W.setMorph(t1, t1, 1);
    W.glow.visible = p < 0.48;
    W.glow.position.set(0, 2, 0);
    W.beam.visible = p > 0.66 && p < 0.86;
    if (W.beam.visible) { W.beam.geometry.setDrawRange(0, Math.floor(Math.min(1, (p - 0.66) / 0.08) * W.beam.geometry.index.count / 3) * 3); }
    for (const c of caps) {
      const a = Math.min(1, Math.max(0, Math.min((p - c.s) / 0.025, (c.e - p) / 0.025)));
      c.d.style.opacity = a; c.d.classList.toggle('on', a > 0.5);
      c.d.style.filter = `blur(${(1 - a) * 8}px)`;
    }
    app.querySelector('.a-prog i').style.height = p * 100 + '%';
    app.querySelector('.a-hint').style.opacity = p < 0.02 ? 1 : 0;
    app.querySelector('.a-ch').textContent = p < 0.08 ? 'Cover' : p < 0.28 ? 'Preface' : p < 0.84 ? 'Chapter II · The Paths' : 'Chapter III · The Mountains';
  }
  const lenis = new Lenis({ lerp: 0.07 });
  const prog = () => scrollY / (document.documentElement.scrollHeight - innerHeight);
  lenis.on('scroll', () => apply(prog()));
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  // subtle idle drift
  W.onFrame = el => { W.camera.position.set(base.x + Math.sin(el * 0.3) * 0.6, base.y + Math.sin(el * 0.23) * 0.3, base.z); };
  apply(prog());
}
