// PROTOTYPE switcher: ?variant=A|B|C|D ; ← → cycle (full reload keeps each variant isolated)
const VARIANTS = { A: ['Fly-through', () => import('./variants/a-flythrough.js')], B: ['Living book', () => import('./variants/b-spread.js')], C: ['Scrollytelling', () => import('./variants/c-scrolly.js')], D: ['Constellation map', () => import('./variants/d-constellation.js')] };
const keys = Object.keys(VARIANTS);
const cur = (new URLSearchParams(location.search).get('variant') || 'A').toUpperCase();
const v = VARIANTS[cur] ? cur : 'A';
VARIANTS[v][1]().then(m => m.mount(document.getElementById('app')));
if (import.meta.env.DEV) {
  const go = d => { const n = keys[(keys.indexOf(v) + d + keys.length) % keys.length]; const u = new URL(location); u.searchParams.set('variant', n); location.replace(u); };
  const bar = document.createElement('div'); bar.className = 'proto-switch';
  bar.innerHTML = `<button aria-label="previous">‹</button><span>${v} · ${VARIANTS[v][0]}</span><button aria-label="next">›</button>`;
  bar.children[0].onclick = () => go(-1); bar.children[2].onclick = () => go(1);
  document.body.appendChild(bar);
  addEventListener('keydown', e => { if (e.target.closest('input,textarea,[contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
}
