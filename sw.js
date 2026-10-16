/* Пульс 2 © Demshin_lab. Офлайн-кеш и обновления.
   Версию поднимайте вместе с APP в index.html и version.json. */
const VERSION = "pulse2-2.0.0-121";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./version.json",
  "./vendor/d3.min.js",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@400;500;600&display=swap",
];

self.addEventListener("install", (e) => {
  // без skipWaiting: новая версия ждёт, пока пользователь нажмёт «Обновить»
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !k.startsWith("pulse2-offline")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "VERSION") e.source && e.source.postMessage({ version: VERSION });
});

/* нажали на уведомление: открываем приложение на нужном пункте */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const id = (e.notification.data && e.notification.data.id) || "";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const c = list[0];
      if (c) { c.postMessage({ type: "pulse-open", id }); return c.focus && c.focus(); }
      return self.clients.openWindow("./?n=" + encodeURIComponent(id));
    })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // страница и version.json: сначала сеть, без сети — кеш
  if (req.mode === "navigate" || url.pathname.endsWith("/version.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req.mode === "navigate" ? "./index.html" : req, copy));
          return res;
        })
        .catch(() => caches.match(req.mode === "navigate" ? "./index.html" : req))
    );
    return;
  }

  // остальное (иконки, d3, шрифты): сначала кеш, затем сеть с дозаписью
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok && (url.origin === self.location.origin || res.type === "cors")) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit)
    )
  );
});
