// PROTOTYPE variant C: scrollytelling. Text column scrolls on the left; a sticky 3D stage on the right reacts per step.
import Lenis from 'lenis';
import { createWorld } from '../shared/world.js';
import { book, sections, chapters } from '../shared/content.js';
import { mountSearchToy } from '../shared/search-toy.js';

const CAM = {
  spark: [[0, 5, 20], [0, 2, 0]], steppe: [[-20, 7, 26], [8, -2, -16]],
  graph: [[-10, 44, 40], [0, 0, 0]], mountains: [[34, 22, 52], [-4, 4, -6]],
};

export function mount(app) {
  app.innerHTML = `<style>
    .c-wrap{display:grid;grid-template-columns:minmax(380px,42%) 1fr}
    .c-text{position:relative;z-index:2;padding:0 6vw 40vh 8vw;background:linear-gradient(90deg,#070b14 70%,transparent)}
    .c-stage{position:sticky;top:0;height:100vh}
    .c-stage canvas{width:100%;height:100%;display:block}
    .c-rail{position:fixed;left:2.4vw;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;z-index:5}
    .c-rail a{font:600 10px Inter;color:rgba(233,227,212,.35);text-decoration:none;letter-spacing:.15em;display:flex;align-items:center;gap:8px}
    .c-rail a i{width:16px;height:1px;background:currentColor;transition:width .3s}
    .c-rail a.on{color:#f2c46b} .c-rail a.on i{width:34px}
    .c-rail a.lock{pointer-events:none}
    .c-hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center}
    .c-hero .kz{font:300 20px Spectral;letter-spacing:.4em;color:#f2c46b}
    .c-hero h1{font:400 clamp(72px,9vw,150px)/.88 'Cormorant Garamond'}
    .c-hero p{font:italic 300 22px Spectral;color:#cfc6b2;margin-top:12px}
    .c-step{min-height:90vh;display:flex;flex-direction:column;justify-content:center;opacity:.25;transition:opacity .6s}
    .c-step.on{opacity:1}
    .c-step .k{font:600 11px Inter;letter-spacing:.35em;text-transform:uppercase;color:#f2c46b;margin-bottom:14px}
    .c-step h2{font:400 clamp(38px,4vw,64px)/1 'Cormorant Garamond';margin-bottom:22px}
    .c-step p{font:300 18px/1.75 Spectral;color:#ddd5c3;margin-bottom:14px;max-width:34em}
    .c-step .toyslot{margin-top:18px}
    .c-note{border-left:2px solid #f2c46b;padding:8px 14px;font:400 13px/1.6 Inter;color:#b9c2d8;margin-top:10px;max-width:34em}
    .c-note b{color:#f2c46b;letter-spacing:.1em;font-size:11px;display:block;margin-bottom:2px}
  </style>
  <nav class="c-rail">${chapters.map(([n, t], k) => `<a href="#" class="${k > 2 ? 'lock' : ''}" data-n="${n}"><i></i>${n}</a>`).join('')}</nav>
  <div class="c-wrap"><div class="c-text">
    <section class="c-hero c-step on" data-world="spark"><div class="kz">${book.kazakh}</div><h1>${book.title}</h1><p>${book.subtitle}</p></section>
    ${sections.map(s => `<section class="c-step" data-world="${s.world}" data-id="${s.id}"><div class="k">${s.kicker}</div><h2>${s.title}</h2>${s.body.map(b => `<p>${b}</p>`).join('')}
      ${s.toy ? '<div class="toyslot"></div>' : ''}
      ${s.id === 'ch2-graph' ? '<div class="c-note"><b>MYTH VS FACT</b>Myth: a smarter search always finds a better path. Fact: BFS and A* find paths of the same length here; A* just looks at fewer places.</div>' : ''}
      ${s.id === 'ch2' ? '<div class="c-note"><b>DID YOU KNOW?</b>A* was published in 1968 by Hart, Nilsson and Raphael for the robot Shakey at SRI.</div>' : ''}
    </section>`).join('')}
  </div><div class="c-stage"><canvas></canvas></div></div>`;
  const W = createWorld(app.querySelector('.c-stage canvas'));
  app.querySelectorAll('.toyslot').forEach(t => mountSearchToy(t));
  let cur = 'spark', anim;
  W.camera.position.set(...CAM.spark[0]); W.look.set(...CAM.spark[1]); W.setMorph('spark', 'spark', 1);
  function goWorld(to) {
    if (to === cur) return; const from = cur; cur = to;
    const c0 = W.camera.position.toArray(), l0 = W.look.toArray(), [c1, l1] = CAM[to], t0 = performance.now();
    cancelAnimationFrame(anim); W.beam.visible = to === 'graph';
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / 2200), e = 1 - Math.pow(1 - k, 3);
      W.camera.position.set(...c0.map((c, j) => c + (c1[j] - c) * e)); W.look.set(...l0.map((c, j) => c + (l1[j] - c) * e));
      W.setMorph(from, to, k); if (k < 1) anim = requestAnimationFrame(step);
    })();
  }
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    app.querySelectorAll('.c-step').forEach(s => s.classList.remove('on')); en.target.classList.add('on');
    goWorld(en.target.dataset.world);
    const id = en.target.dataset.id || '';
    const n = id.startsWith('ch3') ? 'III' : id.startsWith('ch2') ? 'II' : 'I';
    app.querySelectorAll('.c-rail a').forEach(a => a.classList.toggle('on', a.dataset.n === n));
  }), { rootMargin: '-45% 0px -45% 0px' });
  app.querySelectorAll('.c-step').forEach(s => io.observe(s));
  const lenis = new Lenis({ lerp: 0.09 }); (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
}
