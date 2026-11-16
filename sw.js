// Service worker TirtaPlan Studio: aplikasi tetap terbuka tanpa sinyal di lapangan.
const APP = 'tirtaplan-app-v10';
const TILES = 'tirtaplan-tiles-v1';
const MAX_TILES = 3000;
const SHELL = ['./', './index.html', './auth-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
const LIBS = [
  'https://cdn.tailwindcss.com/3.4.17',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
  'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});
const isTile = (u) => /arcgisonline\.com|tile\.openstreetmap\.org|tile\.opentopomap\.org/.test(u.hostname);
async function trimTiles(c) { const keys = await c.keys(); if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES + 300)) await c.delete(k); }
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.open-meteo.com' || /googleapis\.com|firebaseio\.com|identitytoolkit/.test(url.hostname)) return; // layanan daring: selalu dari jaringan
  if (url.pathname.endsWith('/auth-config.js')) { e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(APP).then(c => c.put(req.url, cp)); return r; }).catch(() => caches.match(req.url))); return; } // elevasi: selalu dari jaringan (aplikasi punya cadangan sendiri)
  if (isTile(url)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES); const hit = await c.match(req.url);
      const net = fetch(req).then(r => { if (r.ok && r.type !== 'opaque') { c.put(req.url, r.clone()).then(() => trimTiles(c)); } return r; }).catch(() => hit || Response.error());
      return hit || net;
    })());
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(APP).then(c => c.put('./index.html', cp)); return r; })
      .catch(async () => (await caches.match(req)) || caches.match('./index.html')));
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req.url);
    const net = fetch(req).then(r => { if (r.ok && r.type !== 'opaque') { const cp = r.clone(); caches.open(APP).then(c => c.put(req.url, cp)); } return r; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  })());
});
