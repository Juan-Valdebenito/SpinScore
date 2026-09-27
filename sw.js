/* SpinScore — service worker
   Permite usar la app sin conexión una vez abierta por primera vez.
   Cambia CACHE en cada versión para que los clientes reciban los archivos nuevos.
*/
const CACHE = 'spinscore-2.2.0';

const CORE = [
  './',
  './index.html',
  './app.html',
  './public.html',
  './multimesa.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/landing.css',
  './css/dialog.css',
  './js/utils.js',
  './js/rules.js',
  './js/theme.js',
  './js/storage.js',
  './js/core.js',
  './js/match.js',
  './js/liga.js',
  './js/grupos.js',
  './js/eliminacion.js',
  './images/favicon.ico',
  './images/favicon-32.png',
  './images/icon-192.png',
  './images/apple-touch-icon.png',
];

// Google Fonts: se guarda al primer uso para que las fuentes funcionen sin conexión.
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: red primero (para ver cambios), caché si no hay conexión.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(async () =>
          (await caches.match(req, { ignoreSearch: true })) ||
          (await caches.match('./app.html')))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !RUNTIME_HOSTS.includes(url.hostname)) return;

  // Recursos: responde desde caché y actualiza en segundo plano.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
