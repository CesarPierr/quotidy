const CACHE_NAME = "quotidy-static-v9";
const RUNTIME_CACHE = "quotidy-runtime-v9";
const STATIC_ASSETS = ["/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([CACHE_NAME, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "quotidy", body: "Vous avez de nouvelles tâches.", url: "/app" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payload
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/app";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url) && "focus" in c);
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});

// Network-first cache for app navigations + RSC payloads, so the app boots and
// shows its last-seen data when offline. The app's own outbox handles writes —
// /api/ is always left to the network (and the app queues failed mutations).
function isAppDocument(request, url) {
  if (request.mode === "navigate") return true;
  // Next App Router client navigations fetch RSC payloads.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // App pages / RSC: network-first, fall back to the cached version (then to a
  // cached app shell) when offline.
  if (isAppDocument(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone)).catch(() => undefined);
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/app")) || Response.error()),
    );
    return;
  }

  // Static assets (content-hashed): network-first with cache fallback.
  if (url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request)),
    );
  }
});
