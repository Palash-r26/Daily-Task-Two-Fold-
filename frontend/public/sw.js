const CACHE_NAME = "important-updates-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Bypass caching in local development
  if (
    self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1" ||
    event.request.url.includes("localhost") ||
    event.request.url.includes("127.0.0.1") ||
    event.request.url.includes("/@vite/") ||
    event.request.url.includes("/node_modules/")
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});

// ─── Web Push: receive a push and show a system notification ───────────────
self.addEventListener("push", (event) => {
  let data = { title: "Daily Tasks", body: "You have a new message.", url: "/chat" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: "/app-logo.png",
    badge: "/app-logo.png",
    tag: "daily-tasks-message",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── When user taps the notification: open / focus the app ─────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});