self.addEventListener('install', (event) => {
  console.log('[PWA] Service Worker: Terinstal');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[PWA] Service Worker: Aktif');
});

self.addEventListener('fetch', (event) => {
  // Bypass cache, langsung ke network supaya data RT tidak pernah basi
  event.respondWith(fetch(event.request));
});