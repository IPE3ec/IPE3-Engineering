const CACHE_NAME = 'ipe3-v3.0.0';
const OFFLINE_URL = 'offline.html';

const urlsToCache = [
    '/',
    'index.html',
    'login.html',
    'dashboard.html',
    'equipos.html',
    'solicitudes.html',
    'admin.html',
    'offline.html',
    'manifest.json',
    'icons/icon-192x192.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
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

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    if (url.hostname.includes('google.com') || url.hostname.includes('script.google.com')) {
        event.respondWith(fetch(request));
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    fetch(request).then((response) => {
                        if (response && response.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
                        }
                    }).catch(() => {});
                    return cachedResponse;
                }
                return fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        if (request.destination === 'image') {
                            return caches.match('icons/icon-192x192.png');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});
