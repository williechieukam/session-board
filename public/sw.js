/*
 * Offline shell for Sessionboard. The app has no backend, so once its files are cached a
 * workshop can run with no network at all.
 *
 * Navigations go to the network first, so a new build is picked up as soon as one exists,
 * falling back to the cached page when there is nothing to reach. Everything else is cached
 * on first use, which is safe because Vite gives every built asset a content hash in its name.
 */
const CACHE = 'sessionboard-v1';

/*
 * Derived, never hardcoded. The app is served from the origin root in development and from a
 * project subpath on GitHub Pages, and a worker can only ever control the scope it was
 * registered under — so its own scope is the one value that is right in both places. Getting
 * this wrong fails quietly: the navigation fallback would never match, and offline mode is
 * the whole point of the worker.
 */
const BASE = new URL(self.registration.scope).pathname;
const SHELL = [BASE, `${BASE}favicon.svg`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(BASE, copy));
          return response;
        })
        .catch(() => caches.match(BASE).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return response;
    })),
  );
});
