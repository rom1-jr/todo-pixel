/* Service worker : appli disponible hors ligne, notifications du récap du matin et des rappels. */
const CACHE = 'todo-pixel-v3';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './vendor/firebase.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/badge-72.png',
  './fonts/press-start-2p-latin-400-normal.woff2',
  './fonts/pixelify-sans-latin-400-normal.woff2',
  './fonts/pixelify-sans-latin-500-normal.woff2',
  './fonts/pixelify-sans-latin-600-normal.woff2',
  './fonts/pixelify-sans-latin-700-normal.woff2',
  './fonts/jacquard-24-latin-400-normal.woff2'
];
// Fichiers qui changent quand on met l'appli à jour : réseau d'abord, cache si hors ligne.
const FRESH = ['/', '/index.html', '/app.js', '/config.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase et Google : jamais intercepté
  const scope = new URL(self.registration.scope);
  const path = '/' + url.pathname.slice(scope.pathname.length);
  const fresh = req.mode === 'navigate' || FRESH.includes(path);
  if (fresh) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Récap du matin';
  const options = {
    body: data.body || 'Ouvre ta liste pour voir ta journée.',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    tag: data.tag || 'recap-matin',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
