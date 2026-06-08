const CACHE_NAME = "aperti-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
];

// ── Install: pre-cache critical assets ───────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static assets, network-first for API ───────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, auth, or non-GET requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/socket.io")
  ) {
    return;
  }

  // Cache-first for JS/CSS/fonts/images
  const isStaticAsset =
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/) ||
    url.pathname.startsWith("/assets/");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Network-first for HTML pages (app shell)
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && url.pathname === "/") {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
