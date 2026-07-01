/**
 * IPE3 Engineering - Service Worker
 * @version 3.0.0
 */

const CACHE_NAME = 'ipe3-v3.0.0';
const OFFLINE_URL = 'offline.html';

// Archivos a cachear
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/equipos.html',
    '/solicitudes.html',
    '/admin.html',
    '/offline.html',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

// ============================================
// INSTALACIÓN
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos...');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================
// ACTIVACIÓN
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================
// ESTRATEGIA DE CACHE
// ============================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Navegación - offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // API de Google Sheets - siempre online
    if (url.hostname.includes('google.com') || url.hostname.includes('script.google.com')) {
        event.respondWith(fetch(request));
        return;
    }

    // Cache primero, luego red
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Actualizar en segundo plano
                    fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, response);
                                });
                            }
                        })
                        .catch(() => {});
                    return cachedResponse;
                }
                return fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        if (request.destination === 'image') {
                            return caches.match('/icons/icon-192x192.png');
                        }
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    });
            })
    );
});

// ============================================
// NOTIFICACIONES PUSH
// ============================================
self.addEventListener('push', (event) => {
    let data = {
        title: 'IPE3 Engineering',
        body: 'Nueva notificación del sistema',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png'
    };

    if (event.data) {
        try { data = event.data.json(); } catch { data.body = event.data.text(); }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/icons/icon-192x192.png',
            badge: data.badge || '/icons/icon-96x96.png',
            vibrate: [200, 100, 200],
            data: data.data || {},
            actions: [
                { action: 'open', title: 'Ver', icon: '/icons/icon-96x96.png' },
                { action: 'close', title: 'Cerrar', icon: '/icons/icon-96x96.png' }
            ],
            tag: data.tag || 'notification',
            renotify: true,
            requireInteraction: true
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('/dashboard.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/dashboard.html');
                }
            })
    );
});

console.log('⚙️ Service Worker IPE3 Engineering v3.0');
