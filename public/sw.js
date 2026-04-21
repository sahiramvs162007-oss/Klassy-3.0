// ─── KLASSY Service Worker ────────────────────────────────────────────────────
// Estrategia: Cache-First para estáticos, Network-First para páginas dinámicas

const CACHE_VERSION = 'klassy-v1';
const CACHE_ESTATICO = `${CACHE_VERSION}-estatico`;
const CACHE_DINAMICO = `${CACHE_VERSION}-dinamico`;

// Recursos que se cachean inmediatamente al instalar
const RECURSOS_ESTATICOS = [
  '/css/estilos.css',
  '/css/paginas/login.css',
  '/js/main.js',
  '/js/drawer.js',
  '/js/paginacion.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
  '/offline.html',
];

// Patrones de URL que NUNCA se cachean (siempre van a la red)
const SIN_CACHE = [
  '/auth/',
  '/api/',
  '/_method',
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando KLASSY SW...');
  event.waitUntil(
    caches.open(CACHE_ESTATICO).then((cache) => {
      return cache.addAll(RECURSOS_ESTATICOS).catch((err) => {
        console.warn('[SW] Algunos recursos no se pudieron cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando nueva versión...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('klassy-') && name !== CACHE_ESTATICO && name !== CACHE_DINAMICO)
          .map((name) => {
            console.log('[SW] Eliminando caché antigua:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones del mismo origen
  if (url.origin !== location.origin) return;

  // No cachear rutas de autenticación ni API
  if (SIN_CACHE.some((patron) => url.pathname.startsWith(patron))) return;

  // No cachear métodos que no sean GET
  if (request.method !== 'GET') return;

  // Archivos estáticos → Cache First
  if (esRecursoEstatico(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Páginas HTML (rutas del servidor) → Network First con fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstConFallback(request));
    return;
  }
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let datos = { titulo: 'KLASSY', cuerpo: 'Nueva notificación', icono: '/icons/icon-192x192.png' };

  if (event.data) {
    try {
      datos = { ...datos, ...event.data.json() };
    } catch {
      datos.cuerpo = event.data.text();
    }
  }

  const opciones = {
    body: datos.cuerpo,
    icon: datos.icono || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: { url: datos.url || '/notificaciones' },
    actions: [
      { action: 'ver', title: 'Ver', icon: '/icons/icon-72x72.png' },
      { action: 'cerrar', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(datos.titulo, opciones)
  );
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'cerrar') return;

  const urlDestino = event.notification.data?.url || '/notificaciones';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          client.navigate(urlDestino);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlDestino);
    })
  );
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function esRecursoEstatico(pathname) {
  return (
    pathname.startsWith('/css/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/imagenes/') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.ttf')
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_ESTATICO);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

async function networkFirstConFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_DINAMICO);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}
