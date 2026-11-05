// Keeps the site for repeat visits and for no network: about 7 MB in all. The page itself asks the network first, so a new deploy is seen at once; everything else comes from here and is refreshed behind it.
const NAME = 'aif-book-1', HOME = registration.scope, ours = u => new URL(u).origin === location.origin && u.startsWith(HOME);
addEventListener('install', () => skipWaiting());
addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('aif-book-') && k !== NAME).map(k => caches.delete(k)))).then(() => clients.claim()))); // the origin's caches are shared with its other projects
// a full disk costs the copy, never the answer
const keep = (key, res) => { if (res.ok && res.type === 'basic') { const c = res.clone(); return caches.open(NAME).then(s => s.put(key, c)).catch(() => {}); } return Promise.resolve(); };
// each deploy names a new bundle: the old one goes once the page no longer asks for it
const prune = async html => { const c = await caches.open(NAME); for (const k of await c.keys()) { const n = new URL(k.url).pathname.split('/').pop(); if (/^index-.*\.(js|css)$/.test(n) && !html.includes(n)) await c.delete(k); } };
// the worker comes after the first load: the page says what it fetched, and the page itself, under one name whatever its query, goes with it
addEventListener('message', e => { if (!Array.isArray(e.data)) return; e.waitUntil(Promise.all([HOME, ...e.data.filter(ours)].map(u => caches.match(u, { ignoreVary: true }).then(hit => hit || fetch(u).then(res => keep(u, res))).catch(() => {})))); });
addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range') || !ours(r.url)) return; // a media element's ranges can't be stored
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(res => { const text = res.clone().text(); e.waitUntil(keep(HOME, res).then(() => text).then(prune).catch(() => {})); return res; }).catch(() => caches.match(HOME).then(hit => hit || Response.error()))); return; }
  const fresh = fetch(r).then(res => { e.waitUntil(keep(r, res)); return res; });
  e.respondWith(caches.match(r, { ignoreVary: true }).then(hit => { if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; } return fresh; }));
});
