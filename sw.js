/* Verse offline support: keeps a copy of the app on the phone so it opens without a connection.
   Bump VERSION whenever any file below changes, so phones pick up the new copy. */
const VERSION = 'verse-v3';
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './fonts/eb-garamond-latin-400-normal.woff2',
  './fonts/eb-garamond-latin-400-italic.woff2',
  './fonts/eb-garamond-latin-500-normal.woff2',
  './fonts/courier-prime-latin-400-normal.woff2',
  './fonts/courier-prime-latin-400-italic.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)),
  );
});
