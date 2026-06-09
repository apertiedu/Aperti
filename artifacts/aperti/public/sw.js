const CACHE_NAME = "aperti-v3";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
];

// ── Install: pre-cache critical assets ────────────────────────────────────────
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

// ── Fetch: smart caching strategy ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, API, auth, socket requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/socket.io")
  ) {
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
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
        }).catch(() => cached || new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Network-first for HTML (app shell), fallback to cache, then offline page
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // Return offline fallback for navigation requests
      if (event.request.mode === "navigate") {
        const offlineCache = await caches.match(OFFLINE_URL);
        return offlineCache || new Response("<h1>You are offline</h1>", {
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("", { status: 503 });
    })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "Aperti", body: "You have a new notification", url: "/" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/favicon.svg",
      badge: "/favicon.svg",
      data: { url: data.url || "/" },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    })
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "offline-sync") {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  try {
    const token = await getTokenFromClients();
    if (!token) return;
    const db = await openOfflineDB();
    const tx = db.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const items = await storeGetAll(store);
    if (!items.length) return;

    const res = await fetch("/api/offline/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actions: items }),
    });
    if (res.ok) {
      const clearTx = db.transaction("queue", "readwrite");
      clearTx.objectStore("queue").clear();
    }
  } catch (err) {
    console.error("[sw] syncOfflineQueue error:", err);
  }
}

async function getTokenFromClients() {
  const clientList = await clients.matchAll({ type: "window" });
  for (const client of clientList) {
    const resp = await client.postMessage({ type: "GET_TOKEN" });
    if (resp) return resp;
  }
  return null;
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("aperti-offline", 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("queue", { autoIncrement: true });
      e.target.result.createObjectStore("content", { keyPath: "id" });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

function storeGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}
