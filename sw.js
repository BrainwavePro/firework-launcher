// Minimal cache-first service worker so the game works offline / installs as a PWA.
const CACHE = 'fw-launcher-v2';
const ASSETS = [
  '.',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/particles.js',
  'js/collision.js',
  'js/fireworks.js',
  'js/world.js',
  'js/audio.js',
  'js/ui.js',
  'js/input.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-maskable.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
