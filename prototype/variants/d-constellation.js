// PROTOTYPE variant D: non-linear constellation map. Ten chapter-stars over the steppe; click to dive in; chapter opens in a drawer.
import * as THREE from 'three';
import { createWorld } from '../shared/world.js';
import { book, sections, chapters } from '../shared/content.js';
import { mountSearchToy } from '../shared/search-toy.js';

export function mount(app) {
  app.innerHTML = `<style>
    .d-cv{position:fixed;inset:0;width:100vw;height:100vh}
    .d-title{position:fixed;top:4vh;left:0;right:0;text-align:center;pointer-events:none;transition:opacity .6s}
    .d-title .kz{font:300 16px Spectral;letter-spacing:.5em;color:#f2c46b}
    .d-title h1{font:400 clamp(44px,5vw,76px)/.9 'Cormorant Garamond'}
    .d-title p{font:italic 300 17px Spectral;color:#cfc6b2;margin-top:6px}
    .d-title small{display:block;margin-top:18px;font:600 10px Inter;letter-spacing:.35em;color:rgba(233,227,212,.5)}
    .d-lbl{position:fixed;transform:translate(-50%,-140%);pointer-events:auto;cursor:pointer;text-align:center;white-space:nowrap;transition:opacity .4s}
    .d-lbl b{display:block;font:600 10px Inter;letter-spacing:.3em;color:#f2c46b}
    .d-lbl span{font:400 19px 'Cormorant Garamond';color:#e9e3d4}
    .d-lbl em{display:block;font:300 11px Inter;color:rgba(233,227,212,.5);font-style:normal}
    .d-lbl.lock{opacity:.35;cursor:default}
    .d-drawer{position:fixed;top:0;right:0;bottom:0;width:min(620px,92vw);background:rgba(7,11,20,.78);backdrop-filter:blur(18px);border-left:1px solid rgba(242,196,107,.2);transform:translateX(105%);transition:transform .9s cubic-bezier(.7,0,.2,1);overflow:auto;padding:9vh 48px 16vh;z-index:6}
    .d-drawer.on{transform:none}
    .d-drawer .k{font:600 11px Inter;letter-spacing:.35em;color:#f2c46b;text-transform:uppercase;margin:34px 0 10px}
    .d-drawer h2{font:400 46px/1 'Cormorant Garamond';margin-bottom:16px}
    .d-drawer p{font:300 17px/1.75 Spectral;color:#ddd5c3;margin-bottom:12px}
    .d-back{all:unset;cursor:pointer;font:600 11px Inter;letter-spacing:.25em;color:#f2c46b;position:sticky;top:0}
  </style>
  <canvas class="d-cv"></canvas>
  <div class="d-title"><div class="kz">${book.kazakh}</div><h1>${book.title}</h1><p>${book.subtitle}</p><small>CHOOSE A STAR · DRAG TO LOOK AROUND</small></div>
  <div class="d-labels"></div>
  <aside class="d-drawer"><button class="d-back">← BACK TO THE SKY</button><div class="d-body"></div></aside>`;
  const W = createWorld(app.querySelector('.d-cv'));
  W.setMorph('steppe', 'steppe', 1); W.glow.visible = false;
  // ten chapter stars on a rising spiral (the path of the book)
  const stars = chapters.map((c, k) => {
    const a = k * 0.66 + 0.4, r = 34;
    const p = new THREE.Vector3(Math.cos(a) * r, 4 + k * 1.6, Math.sin(a) * r);
    const s = W.glow.clone(); s.material = W.glow.material.clone(); s.visible = true; s.position.copy(p); s.scale.setScalar(k < 3 ? 6 : 3.5);
    if (k >= 3) s.material.opacity = 0.35; W.scene.add(s); return { c, k, p, s };
  });
  // constellation lines
  const lg = new THREE.BufferGeometry().setFromPoints(stars.map(s => s.p));
  W.scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf2c46b, transparent: true, opacity: 0.25 })));
  const labels = app.querySelector('.d-labels');
  stars.forEach(s => { const d = document.createElement('div'); d.className = 'd-lbl' + (s.k > 2 ? ' lock' : ''); d.innerHTML = `<b>${s.c[0]}</b><span>${s.c[1]}</span><em>${s.c[2]}</em>`; labels.appendChild(d); s.el = d; d.onclick = () => s.k <= 2 && open(s.k); });
  let yaw = 0, pitch = 0.5, dist = 88, target = new THREE.Vector3(0, 4, 0), mode = 'sky', drag = null;
  const cv = app.querySelector('.d-cv');
  cv.addEventListener('pointerdown', e => drag = [e.clientX, e.clientY, yaw, pitch]);
  addEventListener('pointerup', () => drag = null);
  addEventListener('pointermove', e => { if (!drag || mode !== 'sky') return; yaw = drag[2] - (e.clientX - drag[0]) * 0.004; pitch = Math.min(1.2, Math.max(0.05, drag[3] + (e.clientY - drag[1]) * 0.003)); });
  let tw = null;
  function fly(toPos, toLook, ms, morph) {
    const c0 = W.camera.position.clone(), l0 = W.look.clone(), t0 = performance.now();
    tw = { done: false };
    const me = tw;
    (function step() {
      if (me !== tw) return;
      const k = Math.min(1, (performance.now() - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      W.camera.position.lerpVectors(c0, toPos, e); W.look.lerpVectors(l0, toLook, e);
      if (morph) W.setMorph(morph[0], morph[1], k);
      if (k < 1) requestAnimationFrame(step); else me.done = true;
    })();
  }
  const worldOf = k => ['spark', 'graph', 'mountains'][k];
  let curWorld = 'steppe';
  function open(k) {
    mode = 'dive';
    const s = stars[k], to = worldOf(k), from = curWorld; curWorld = to;
    fly(new THREE.Vector3(-30, to === 'graph' ? 40 : 14, 40), new THREE.Vector3(6, to === 'mountains' ? 6 : 0, 0), 2200, [from, to]);
    app.querySelector('.d-title').style.opacity = 0; labels.style.opacity = 0; labels.style.pointerEvents = 'none';
    W.beam.visible = to === 'graph';
    const ids = k === 0 ? ['preface'] : k === 1 ? ['ch2', 'ch2-graph', 'ch2-astar'] : ['ch3'];
    const body = app.querySelector('.d-body');
    body.innerHTML = ids.map(id => { const x = sections.find(q => q.id === id); return `<div class="k">${x.kicker}</div><h2>${x.title}</h2>${x.body.map(b => `<p>${b}</p>`).join('')}${x.toy ? '<div class="slot"></div>' : ''}`; }).join('');
    body.querySelectorAll('.slot').forEach(t => mountSearchToy(t));
    app.querySelector('.d-drawer').classList.add('on'); app.querySelector('.d-drawer').scrollTop = 0;
  }
  app.querySelector('.d-back').onclick = () => {
    app.querySelector('.d-drawer').classList.remove('on'); W.beam.visible = false;
    const from = curWorld; curWorld = 'steppe';
    fly(skyPos(), target, 1800, [from, 'steppe']);
    setTimeout(() => { mode = 'sky'; app.querySelector('.d-title').style.opacity = 1; labels.style.opacity = 1; labels.style.pointerEvents = ''; }, 1800);
  };
  const skyPos = () => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
  const v = new THREE.Vector3();
  W.onFrame = el => {
    if (mode === 'sky' && (!tw || tw.done)) { if (!drag) yaw += 0.0007; W.camera.position.copy(skyPos()); W.look.copy(target); }
    W.camera.updateMatrixWorld();
    for (const s of stars) {
      s.s.scale.setScalar((s.k < 3 ? 6 : 3.5) * (1 + Math.sin(el * 2 + s.k) * 0.12));
      v.copy(s.p).project(W.camera);
      s.el.style.left = (v.x * .5 + .5) * innerWidth + 'px'; s.el.style.top = (-v.y * .5 + .5) * innerHeight + 'px';
      s.el.style.display = v.z < 1 ? '' : 'none';
    }
  };
}
