const CACHE_NAME = "portal-rt-v4";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Portal Warga", body: "Ada informasi baru dari pengurus RT.", url: "/portal", tag: "wargaku" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_err) {
    data.body = event.data ? event.data.text() : data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "wargaku",
      data: { url: data.url || "/portal" },
    })
  );
});

function tautanNotifikasiAman(mentah) {
  const cadangan = "/portal";
  if (typeof mentah !== "string" || !mentah.trim()) return cadangan;
  const nilai = mentah.trim();
  if (!nilai.startsWith("/") || nilai.startsWith("//") || nilai.includes("\\")) return cadangan;
  try {
    const url = new URL(nilai, self.location.origin);
    if (url.origin !== self.location.origin) return cadangan;
    return `${url.pathname}${url.search}${url.hash}` || cadangan;
  } catch (_err) {
    return cadangan;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tujuan = tautanNotifikasiAman(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(tujuan) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(tujuan);
    })
  );
});
