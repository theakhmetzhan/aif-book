// PROTOTYPE variant B: a literal open book. Left page = prose, right page = a living 3D plate. Page turns.
import { createWorld } from '../shared/world.js';
import { book, sections } from '../shared/content.js';
import { mountSearchToy } from '../shared/search-toy.js';

const CAM = {
  spark: [[0, 5, 20], [0, 2, 0]], steppe: [[-20, 7, 26], [8, -2, -16]],
  graph: [[0, 46, 34], [0, 0, 0]], mountains: [[34, 22, 52], [-4, 4, -6]],
};

export function mount(app) {
  app.innerHTML = `<style>
    body{background:radial-gradient(ellipse at 50% 30%,#1a1f2c,#05070c 70%)}
    .b-stage{height:100vh;display:grid;place-items:center;padding-top:40px;perspective:2400px}
    .b-book{position:relative;width:min(1240px,94vw);aspect-ratio:1.48/1;display:grid;grid-template-columns:1fr 1fr;transform:rotateX(8deg);transform-style:preserve-3d;filter:drop-shadow(0 40px 60px rgba(0,0,0,.7))}
    .b-pg{position:relative;background:#efe6d2;color:#2a241a;overflow:hidden}
    .b-pg::after{content:'';position:absolute;inset:0;pointer-events:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E")}
    .b-l{border-radius:8px 2px 2px 8px;box-shadow:inset -40px 0 50px -30px rgba(60,40,10,.45);padding:7% 8% 8% 10%}
    .b-r{border-radius:2px 8px 8px 2px;box-shadow:inset 40px 0 50px -30px rgba(60,40,10,.45);padding:6%}
    .b-plate{position:relative;width:100%;height:100%;border-radius:4px;overflow:hidden;background:#070b14;box-shadow:0 0 0 1px #b79a5f,0 0 0 7px #efe6d2,0 0 0 8px #b79a5f}
    .b-plate canvas{width:100%;height:100%;display:block}
    .b-plate .cap{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;font:italic 300 13px Spectral;color:#e9e3d4;background:linear-gradient(transparent,rgba(0,0,0,.7))}
    .b-toy{position:absolute;inset:6%;display:none;align-items:center}
    .b-l .k{font:600 10px Inter;letter-spacing:.35em;text-transform:uppercase;color:#9a6a22;margin-bottom:14px}
    .b-l h2{font:500 clamp(30px,3.6vw,54px)/1 'Cormorant Garamond',serif;margin-bottom:20px}
    .b-l p{font:400 clamp(13px,1.15vw,16.5px)/1.7 Spectral,serif;margin-bottom:12px;text-align:justify;hyphens:auto}
    .b-l .k~p:first-of-type::first-letter{font:600 3.4em/.8 'Cormorant Garamond';float:left;margin:6px 8px 0 0;color:#9a6a22}
    .b-no{position:absolute;bottom:4%;font:400 12px Spectral;color:#8a7a5a}
    .b-l .b-no{left:10%} .b-r .b-no{right:8%}
    .b-cover{text-align:center;display:flex;flex-direction:column;justify-content:center;height:100%}
    .b-cover h1{font:400 clamp(60px,7vw,110px)/.9 'Cormorant Garamond'} .b-cover .kz{font:300 18px Spectral;letter-spacing:.4em;color:#9a6a22}
    .b-flip{position:absolute;top:0;bottom:0;left:50%;width:50%;transform-origin:left center;background:#efe6d2;border-radius:2px 8px 8px 2px;transform:rotateY(0);backface-visibility:hidden;z-index:4;pointer-events:none;opacity:0}
    .b-nav{position:fixed;top:22px;left:50%;transform:translateX(-50%);display:flex;gap:14px;align-items:center;font:400 12px Inter;color:#b9b2a2;letter-spacing:.15em}
    .b-nav button{all:unset;cursor:pointer;padding:8px 16px;border:1px solid rgba(233,227,212,.3);border-radius:999px;color:#e9e3d4}
    .b-spine{position:absolute;left:50%;top:0;bottom:0;width:2px;background:linear-gradient(#0000,rgba(60,40,10,.4),#0000);z-index:3}
  </style>
  <div class="b-stage"><div class="b-book">
    <div class="b-pg b-l"></div>
    <div class="b-pg b-r"><div class="b-plate"><canvas></canvas><div class="cap"></div></div><div class="b-toy"></div><span class="b-no"></span></div>
    <div class="b-spine"></div><div class="b-flip"></div>
  </div></div>
  <div class="b-nav"><button data-d="-1">← Previous page</button><span class="b-pn"></span><button data-d="1">Next page →</button></div>`;
  const W = createWorld(app.querySelector('.b-plate canvas'));
  const L = app.querySelector('.b-l'), plate = app.querySelector('.b-plate'), toy = app.querySelector('.b-toy'), cap = app.querySelector('.cap');
  mountSearchToy(toy, { theme: 'paper' });
  const pages = [{ cover: true, world: 'spark' }, ...sections];
  let i = 0, cur = 'spark', anim = null;
  function render() {
    const s = pages[i];
    L.innerHTML = s.cover
      ? `<div class="b-cover"><div class="kz">${book.kazakh}</div><h1>${book.title}</h1><p style="font:italic 300 18px Spectral;margin-top:14px">${book.subtitle}</p><p style="font:400 12px Inter;letter-spacing:.2em;margin-top:40px;color:#8a7a5a">${book.author.toUpperCase()}<br>${book.course}</p></div>`
      : `<div class="k">${s.kicker}</div><h2>${s.title}</h2>${s.body.map(b => `<p>${b}</p>`).join('')}<span class="b-no">${i * 2}</span>`;
    app.querySelector('.b-r .b-no').textContent = i ? i * 2 + 1 : '';
    const isToy = s.toy === 'search';
    plate.style.display = isToy ? 'none' : 'block'; toy.style.display = isToy ? 'flex' : 'none';
    cap.textContent = { spark: 'Plate 1. The spark on the dark steppe.', steppe: 'Plate 2. The open steppe: a world before it is a problem.', graph: 'Plate 3. The same steppe as a state-space graph; the cyan line is a shortest path.', mountains: 'Plate 4. A landscape of values, where local search climbs.' }[s.world];
    app.querySelector('.b-pn').textContent = `Spread ${i + 1} / ${pages.length}`;
    // morph + camera tween
    const from = cur, to = s.world; cur = to;
    const c0 = W.camera.position.toArray(), l0 = W.look.toArray(), [c1, l1] = CAM[to];
    const t0 = performance.now(); cancelAnimationFrame(anim);
    W.beam.visible = to === 'graph';
    (function step() {
      const k = Math.min(1, (performance.now() - t0) / 1800), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      W.camera.position.set(...c0.map((c, j) => c + (c1[j] - c) * e)); W.look.set(...l0.map((c, j) => c + (l1[j] - c) * e));
      W.setMorph(from, to, k);
      if (k < 1) anim = requestAnimationFrame(step);
    })();
  }
  function turn(d) {
    const n = i + d; if (n < 0 || n >= pages.length) return;
    const f = app.querySelector('.b-flip');
    f.animate([{ transform: `rotateY(${d > 0 ? 0 : -180}deg)`, opacity: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }, { transform: 'rotateY(-90deg)', opacity: 1, boxShadow: '-30px 0 60px rgba(0,0,0,.4)' }, { transform: `rotateY(${d > 0 ? -180 : 0}deg)`, opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.6,.05,.3,1)' });
    setTimeout(() => { i = n; render(); }, 350);
  }
  app.querySelector('.b-nav').addEventListener('click', e => { const d = +e.target.dataset?.d; if (d) turn(d); });
  addEventListener('keydown', e => { if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1); } if (e.key === 'PageUp') turn(-1); });
  let wheelLock = 0;
  addEventListener('wheel', e => { if (e.target.closest('.toy')) return; const now = performance.now(); if (now - wheelLock < 900 || Math.abs(e.deltaY) < 20) return; wheelLock = now; turn(Math.sign(e.deltaY)); }, { passive: true });
  W.camera.position.set(...CAM.spark[0]); W.look.set(...CAM.spark[1]); W.setMorph('spark', 'spark', 1);
  render();
}
