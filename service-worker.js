const CACHE_NAME = 'fittrack-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/models.js',
  './js/mockData.js',
  './js/notifications.js',
  './js/dailyContent.js',
  './js/components/dom.js',
  './js/components/icons.js',
  './js/views/onboarding.js',
  './js/views/ageVerification.js',
  './js/views/signup.js',
  './js/views/login.js',
  './js/views/dashboard.js',
  './js/views/calendar.js',
  './js/views/profile.js',
  './js/views/editProfile.js',
  './js/views/clips.js',
  './js/views/messages.js',
  './js/views/workoutDetail.js',
  './js/views/orgJoin.js',
  './js/views/team.js',
  './js/views/workoutForm.js',
  './js/views/athleteProgress.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for app shell assets, network-first fallback for everything
// else (keeps the door open for a future real API without extra config).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
