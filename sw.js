/**
 * ============================================
 * IPE3 Engineering - Service Worker
 * @version 3.0.0
 * ============================================
 */

const CACHE_NAME = 'ipe3-v3.0.0';
const OFFLINE_URL = 'offline.html';

// ============================================
// ARCHIVOS A CACHEAR
// ============================================
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
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
    console.log('[Service Worker] Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cacheando archivos...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Instalación completada');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Error en instalación:', error);
            })
    );
});

// ============================================
// ACTIVACIÓN
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activando...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('[Service Worker] Activación completada');
            return self.clients.claim();
        })
    );
});

// ============================================
// ESTRATEGIA DE CACHE: STALE-WHILE-REVALIDATE
// ============================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Permitir navegación offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clonar respuesta para cache
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(OFFLINE_URL);
                })
        );
        return;
    }

    // Estrategia: cache primero, luego red
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Actualizar cache en segundo plano
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
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ============================================
// SINCERONIZACIÓN EN SEGUNDO PLANO
// ============================================
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Sincronización:', event.tag);
    
    if (event.tag === 'sync-dashboard') {
        event.waitUntil(syncDashboardData());
    }
});

async function syncDashboardData() {
    try {
        // Intentar sincronizar datos pendientes
        const cache = await caches.open(CACHE_NAME);
        const pendingRequests = await cache.keys();
        
        for (const request of pendingRequests) {
            if (request.url.includes('/api/')) {
                try {
                    const response = await fetch(request);
                    if (response.ok) {
                        await cache.delete(request);
                    }
                } catch (error) {
                    console.warn('Error sincronizando:', request.url);
                }
            }
        }
        
        console.log('[Service Worker] Sincronización completada');
    } catch (error) {
        console.error('[Service Worker] Error en sincronización:', error);
    }
}

// ============================================
// NOTIFICACIONES PUSH
// ============================================
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Notificación push recibida');
    
    let data = {
        title: 'IPE3 Engineering',
        body: 'Nueva notificación del sistema',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: [
            {
                action: 'open',
                title: 'Ver',
                icon: '/icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: '/icons/icon-96x96.png'
            }
        ],
        tag: data.tag || 'notification',
        renotify: true,
        requireInteraction: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ============================================
// CLICK EN NOTIFICACIONES
// ============================================
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Click en notificación:', event.action);
    
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
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

// ============================================
// MENSAJES DESDE LA APP
// ============================================
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Mensaje recibido:', event.data);
    
    if (event.data && event.data.type === 'CACHE_PAGE') {
        const url = event.data.url;
        if (url) {
            event.waitUntil(
                fetch(url)
                    .then((response) => {
                        if (response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(url, clone);
                            });
                        }
                    })
                    .catch(() => {})
            );
        }
    }
});

// ============================================
// LOG
// ============================================
console.log('⚙️ Service Worker IPE3 Engineering v3.0.0');
console.log('📦 Cache:', CACHE_NAME);
console.log('📄 Archivos cacheados:', urlsToCache.length);
