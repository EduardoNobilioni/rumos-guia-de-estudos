const CACHE = 'rumos-cache-v5';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/fonts.css',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/motion.css',
  './js/app.js',
  './js/store.js',
  './js/load-tracks.js',
  './js/icons.js',
  './js/model.js',
  './js/model/storage.js',
  './js/model/validate.js',
  './js/model/roadmap.js',
  './js/plan.js',
  './js/ics.js',
  './js/files.js',
  './js/share.js',
  './js/projects.js',
  './js/ui/dom.js',
  './js/ui/glyph.js',
  './js/ui/onboarding.js',
  './js/ui/roadmap.js',
  './js/ui/sidebar.js',
  './js/ui/dialogs.js',
  './js/ui/quiz.js',
  './js/ui/cmdk.js',
  './js/ui/sheet.js',
  './js/screens/plan-screen.js',
  './js/screens/dashboard-screen.js',
  './js/screens/projects-screen.js',
  './assets/fonts/plus-jakarta-sans-400.woff2',
  './assets/fonts/plus-jakarta-sans-500.woff2',
  './assets/fonts/plus-jakarta-sans-600.woff2',
  './assets/fonts/plus-jakarta-sans-800.woff2',
  './assets/fonts/jetbrains-mono-400.woff2',
  './assets/fonts/jetbrains-mono-500.woff2',
  './assets/brand/mark.svg',
  './assets/brand/favicon.svg',
  './data/tracks/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const trackJson = /\/data\/tracks\/.+\.json$/.test(url.pathname) && !url.pathname.endsWith('/index.json');
  if (trackJson) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html'))),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}
