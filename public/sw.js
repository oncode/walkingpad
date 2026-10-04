// Offline support: pages are network-first (so deploys show up immediately when online),
// static assets are cache-first (Vite asset filenames are content-hashed, so they never change).
const CACHE = "walkingpad-v1";
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// The first visit loads its assets before this worker is in control, so the page
// sends us the list of what it already loaded and we cache those too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return;
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          event.data.urls
            .filter(isCacheable)
            .map((url) =>
              cache.match(url).then((hit) => hit ?? cache.add(url).catch(() => undefined)),
            ),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isCacheable(request.url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

function isCacheable(url) {
  const { origin, pathname } = new URL(url, self.location.origin);
  // Auth and server functions must always hit the server.
  return (
    origin === self.location.origin &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_serverFn")
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await cache.match(SHELL_URL));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
