// Service Worker — caches MapTiler tiles, fonts, and TileJSON
// Cache names are versioned; bumping V auto-evicts old caches on activate.
const V = 'v1';
const CACHES = {
  tiles: `rb-tiles-${V}`,
  fonts: `rb-fonts-${V}`,
  meta:  `rb-meta-${V}`,
};

// Strip the API key from cache keys so rotating the key doesn't bust the cache.
function keylessUrl(url) {
  const u = new URL(url);
  u.searchParams.delete('key');
  return u.toString();
}

// Activate immediately and clean up any caches from previous versions.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(
      keys
        .filter(k => k.startsWith('rb-') && !Object.values(CACHES).includes(k))
        .map(k => caches.delete(k))
    ))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
  if (!event.request.url.includes('api.maptiler.com')) return;
  const path = new URL(event.request.url).pathname;

  if (path.startsWith('/fonts/')) {
    // Glyph PBFs never change — cache forever
    event.respondWith(cacheFirst(event.request, CACHES.fonts));
  } else if (path.endsWith('tiles.json')) {
    // TileJSON metadata — serve cache instantly, refresh in background
    event.respondWith(staleRevalidate(event.request, CACHES.meta));
  } else {
    // Vector + terrain tiles — cache-first
    event.respondWith(cacheFirst(event.request, CACHES.tiles));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const key   = keylessUrl(req.url);
  const hit   = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(key, res.clone());
  return res;
}

async function staleRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const key   = keylessUrl(req.url);
  const hit   = await cache.match(key);
  // Always refresh in background regardless of cache hit
  const fresh = fetch(req).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  }).catch(() => {});
  return hit || fresh;
}
