const CACHE_NAME = 'finy-web-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  // cache.addAll() is atomic: a single 404 (the old /favicon.ico entry) rejected the
  // whole batch, so `install` failed, the worker never reached `activate`, and the PWA
  // was permanently un-installable. Individual adds + allSettled keep one missing asset
  // from blocking the rest.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS_TO_CACHE.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // POSTs (Edge Function calls) have no meaningful cache fallback, and intercepting
  // them turned a CORS rejection into an opaque net::ERR_FAILED.
  if (event.request.method !== 'GET') return;

  // Simple fetch interceptor: network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      // respondWith rejects a non-Response, which surfaced as
      // "TypeError: Failed to convert value to 'Response'" and hid the real error.
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
