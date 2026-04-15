/**
 * Service Worker — caches all app files for offline use
 * Bump CACHE_VERSION when you deploy updates
 */

const CACHE_VERSION = 'jokebook-v6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/ui.js',
  './js/jokes.js',
  './js/captures.js',
  './js/setlists.js',
  './js/bits.js',
  './js/performances.js',
  './js/more.js',
  './js/timer.js',
  './js/export.js',
  './js/prompts.js',
  './js/stats.js',
  './js/vendor/jszip.min.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

// Install: cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache new requests for offline use
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // If offline and not cached, return the app shell
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
