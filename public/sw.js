/**
 * @file sw.js
 * @summary Offline app shell service worker for Water4All Mobile.
 * @description Keeps the application usable on a farm with no connectivity: the shell and its
 * build assets are cached on first visit and served from cache afterwards, map and radar tiles
 * are reused while they are revalidated, and live weather is deliberately left uncached.
 *
 * Written by hand rather than generated, because the app has exactly three caching policies and a
 * generated precache manifest would add a build-time dependency for no behavioural gain. Vite
 * emits content-hashed filenames under `assets/`, so a cached asset is immutable and cache-first
 * can never serve a stale module: a new build requests new filenames.
 *
 * ## Caches
 *
 * - shell: the navigation entry point, the manifest and the icons, primed at install.
 * - assets: content-hashed JS, CSS and fonts, filled on first request and never revalidated.
 * - tiles: base map and radar imagery, served stale while a fresh copy is fetched, capped by
 *   entry count because a panning operator can request thousands of tiles.
 *
 * ## What is not cached
 *
 * Open-Meteo readings pass straight through to the network. A cached reading would be presented
 * as live weather while being hours old; the app already answers offline with the synthetic
 * fallback built from climate normals (ADR 0003), which is honest about what it is.
 */

/** Bump to invalidate every cache at once; old versions are dropped on activate. */
const CACHE_VERSION = 'water4all-v1';

const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const TILE_CACHE = `${CACHE_VERSION}-tiles`;

/**
 * Entry points primed at install, relative to the worker's own directory.
 *
 * @remarks Relative URLs keep the worker working both at the site root under `vite preview` and
 * under the `/water4all-mobile/` path on GitHub Pages, matching Vite's relative `base`.
 */
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/**
 * Maximum number of map and radar tiles retained.
 *
 * @remarks A single farm site view is a few dozen tiles; the cap exists so an operator panning
 * the map cannot grow the cache without bound, not to keep a working set small.
 */
const MAX_TILE_ENTRIES = 300;

/** Hosts serving map and radar imagery, which is reusable but should not go stale indefinitely. */
const TILE_HOSTS = ['tile.openstreetmap.org', 'tilecache.rainviewer.com'];

/**
 * Primes the shell cache and takes over from any previous worker immediately.
 *
 * @remarks Each entry is added independently: `addAll` rejects the whole install if any single
 * URL 404s, which would leave the farm with no offline shell because one icon was missing.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

/**
 * Drops caches from previous versions and claims open pages.
 *
 * @remarks Claiming means the first visit is offline-capable without a reload, which matters when
 * the operator installs the app in the field and loses signal before opening it again.
 */
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, ASSET_CACHE, TILE_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('water4all-') && !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Serves a navigation from the network, falling back to the cached app shell.
 *
 * @param request - The navigation request.
 * @returns The network response, or the cached shell when the network is unreachable.
 */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Only a successful navigation may replace the shell. A 404, a 500 or a captive portal's
    // sign-in page is still a response, and caching one would overwrite the app with it: the
    // farm would then start offline into an error page with no way to recover.
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await caches.match('./index.html')) ?? (await caches.match('./'));
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Serves a request from cache, falling back to the network and storing what it returns.
 *
 * @param request - The request to satisfy.
 * @param cacheName - Cache to read from and populate.
 * @returns The cached or freshly fetched response.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Trims a cache to its entry cap, evicting the oldest insertions first.
 *
 * @param cacheName - Cache to trim.
 * @param maxEntries - Number of entries to retain.
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache keys are returned in insertion order, so the head of the list is the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

/**
 * Serves imagery from cache while refreshing it in the background.
 *
 * @param request - The tile request.
 * @returns The cached tile when one exists, otherwise the network response.
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(TILE_CACHE);
        await cache.put(request, response.clone());
        await trimCache(TILE_CACHE, MAX_TILE_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Revalidation continues past this response; the next view shows the fresher tile.
    return cached;
  }

  const response = await networkFetch;
  if (response) {
    return response;
  }
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are cacheable, and extension URLs are not ours to intercept.
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Hashed build output is immutable; everything else in the shell is revalidated on navigation.
    const cacheName = url.pathname.includes('/assets/') ? ASSET_CACHE : SHELL_CACHE;
    event.respondWith(cacheFirst(request, cacheName));
    return;
  }

  if (TILE_HOSTS.some((host) => url.hostname.endsWith(host))) {
    event.respondWith(staleWhileRevalidate(request));
  }

  // Everything else, weather readings included, falls through to the network untouched.
});
