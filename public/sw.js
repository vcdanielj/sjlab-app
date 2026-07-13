// SJ Lab — Service Worker
// Mínimo necesario para que la app califique como PWA instalable.
// Network-first para todo (no cache offline aún).
const CACHE = 'sjlab-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => {
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            cache.put(req, clone).catch(() => {});
          }
        });
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || new Response('', { status: 504 })))
  );
});
