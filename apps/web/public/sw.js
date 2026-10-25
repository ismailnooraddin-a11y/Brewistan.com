// Brewistan customer app service worker.
// Caches only static files and customer pages (/cards, /c/..., /scan) so returning customers
// open instantly. Café-owner and admin pages are never cached. Balances always come from the server.
const VERSION = 'bw-customer-card-polish-20261025-v1';
const SHELL = ['/cards', '/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

function isCustomerPage(url) {
  return url.pathname === '/cards' || url.pathname.startsWith('/cards/') || url.pathname.startsWith('/c/') || url.pathname === '/scan';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Static files have unique names: serve from cache, fill the cache on first use.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/card-scenes/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    })));
    return;
  }

  // Customer pages: network first, cached copy when offline.
  if (request.mode === 'navigate' && isCustomerPage(url)) {
    event.respondWith(fetch(request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    }).catch(async () => (await caches.match(request)) || (await caches.match('/cards')) || caches.match('/offline.html')));
  }
});
