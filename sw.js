const CACHE_NAME = 'am-sales-cache-v3';
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'supabase-client.js',
  'groq-client.js',
  'manifest.json',
  'local-secrets.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle same-origin requests in the cache
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  } else {
    // Cross-origin requests: just fetch (browser HTTP cache handles them)
    event.respondWith(fetch(event.request));
  }
});
