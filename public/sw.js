/*
 * Offline shell for Sessionboard. The app has no backend, so once its files are cached a
 * workshop can run with no network at all.
 *
 * Navigations go to the network first, so a new build is picked up as soon as one exists,
 * falling back to the cached page when there is nothing to reach.
 *
 * The entry bundle, the stylesheet and the fonts are precached on install: the browser asks
 * for them before this worker activates, so caching on first use would leave a first visit
 * with nothing to run offline. Everything else is cached as it is used, which is safe because
 * Vite gives every built asset a content hash in its name.
 */

/*
 * Both values are rewritten at build time by the precache plugin in vite.config.ts; these
 * literals are what development sees, where the worker is never registered anyway.
 *
 * The version is part of the cache name so that a new build lands in a new cache and the
 * activate handler below evicts the old one. Without it, content-hashed filenames mean every
 * deploy adds entries that nothing ever removes.
 */
const VERSION = 'dev';
const PRECACHE = [];

const CACHE = `sessionboard-${VERSION}`;

/*
 * Derived, never hardcoded. The app is served from the origin root in development and from a
 * project subpath on GitHub Pages, and a worker can only ever control the scope it was
 * registered under — so its own scope is the one value that is right in both places. Getting
 * this wrong fails quietly: the navigation fallback would never match, and offline mode is
 * the whole point of the worker.
 */
const BASE = new URL(self.registration.scope).pathname;
const SHELL = [BASE, `${BASE}favicon.svg`, `${BASE}manifest.webmanifest`];

/*
 * The shell plus the build's own entry bundle. Caching on first use is not enough for these:
 * the browser requests them during the initial page load, before this worker activates, so on
 * a first visit they never pass through the fetch handler and an offline reload gets HTML with
 * nothing to run.
 */
const INSTALL_SET = [...SHELL, ...PRECACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(INSTALL_SET)).then(() => self.skipWaiting()));
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

  /*
   * Matched by URL, not by Request. caches.match(request) compares the whole request, and a
   * precached entry written by addAll does not match the cors, dest=script request the parser
   * makes for the same file — so an offline first visit missed on assets that were sitting in
   * the cache. The navigation branch above always worked precisely because it matches a URL.
   * For content-hashed files the URL is the identity; mode and destination carry nothing.
   */
  event.respondWith(
    caches.match(request.url).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return response;
    })),
  );
});
