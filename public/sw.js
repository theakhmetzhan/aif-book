// Keeps the site for repeat visits and for no network: about 7 MB in all. The page itself asks the network first, so a new deploy is seen at once; everything else comes from here and is refreshed behind it.
const NAME = 'aif-book-1';
addEventListener('install', () => skipWaiting());
addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== NAME).map(k => caches.delete(k))))));
const keep = async (req, res) => { if (res.ok && res.type === 'basic') await (await caches.open(NAME)).put(req, res.clone()); return res; };
// each deploy names a new bundle: the old one goes once the page no longer asks for it
const prune = async html => { const c = await caches.open(NAME); for (const k of await c.keys()) { const n = new URL(k.url).pathname.split('/').pop(); if (/^index-.*\.(js|css)$/.test(n) && !html.includes(n)) await c.delete(k); } };
addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range') || new URL(r.url).origin !== location.origin) return; // a media element's ranges can't be stored
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(res => { e.waitUntil(res.clone().text().then(prune)); return keep(r, res); }).catch(() => caches.match(r, { ignoreSearch: true }))); return; }
  const fresh = fetch(r).then(res => keep(r, res));
  e.respondWith(caches.match(r).then(hit => { if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; } return fresh; }));
});
