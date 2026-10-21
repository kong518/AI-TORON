self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // PWA 설치 요건을 충족하기 위한 빈 페치 핸들러
  e.respondWith(fetch(e.request));
});
