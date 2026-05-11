const CACHE_NAME = "quotidy-static-v8";
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
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/")) return;
  if (!url.pathname.startsWith("/_next/static/") && !STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
