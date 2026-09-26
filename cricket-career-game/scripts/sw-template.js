/* Cricket Career service worker. Generated at build time by the `serviceWorker`
 * plugin in vite.config.ts, which fills in the version and the precache list.
 * - The whole app (every code-split chunk, the images and icons) is cached on
 *   install, so the game plays offline once it has been opened.
 * - Pages: network first, falling back to the cached app shell.
 * - Build assets (fonts included): cache first; their names change when
 *   their content does. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = `cricket-career-app-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cricket-career-app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request)
          .then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(APP_CACHE).then((c) => c.put('/index.html', copy));
            return res;
          })
          .catch(() => caches.match('/index.html', { ignoreSearch: true })),
      );
      return;
    }
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok && url.pathname.startsWith('/assets/')) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
  }
});
