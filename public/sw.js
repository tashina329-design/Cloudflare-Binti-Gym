// BINTI Gym PWA Service Worker
// Version: 1.0.0
const CACHE_NAME = 'binti-gym-shell-v1';

// Static Shell Assets to Pre-cache on Install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

// Domains and endpoints that MUST NEVER be cached (Firestore, Auth, APIs)
const BYPASS_DOMAINS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firebaseio.com',
  'googleapis.com',
  'apis.google.com',
  'accounts.google.com',
  'firebase.googleapis.com',
  'content-firestore.googleapis.com',
];

// Installation: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Pre-cache warning (some assets will cache on demand):', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activation: Clean up old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Helper to determine if a request must strictly bypass caching
function shouldBypassCache(url, request) {
  // Non-GET requests (POST, PUT, DELETE, PATCH)
  if (request.method !== 'GET') {
    return true;
  }

  // Non-http(s) schemes
  if (!url.protocol.startsWith('http')) {
    return true;
  }

  // Server API endpoints
  if (url.pathname.startsWith('/api/')) {
    return true;
  }

  // Firebase Realtime / Firestore / Google Auth / Google APIs
  const hostname = url.hostname.toLowerCase();
  for (const bypass of BYPASS_DOMAINS) {
    if (hostname === bypass || hostname.endsWith('.' + bypass)) {
      return true;
    }
  }

  // WebSocket or live events
  if (url.pathname.includes('/sse') || url.pathname.includes('/live') || url.pathname.includes('/socket')) {
    return true;
  }

  return false;
}

// Fetch handler with strict segregation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Strict Bypass: Live database, Auth, APIs, non-GET calls go directly to network
  if (shouldBypassCache(url, request)) {
    return; // SW does not handle; browser passes directly through to network
  }

  // 2. HTML Navigation Requests (e.g. "/", "/checkin", page reloads)
  // Strategy: Network-First with Cache Fallback (guarantees freshest HTML, works offline)
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: return cached page or app shell
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const shell = await caches.match('/index.html');
          if (shell) {
            return shell;
          }
          return new Response(
            '<!DOCTYPE html><html><head><title>BINTI Gym (Offline)</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;"><div><h2>⚡ BINTI Gym is Offline</h2><p style="color:#94a3b8;">Please reconnect to the internet to sync gym operations.</p><button onclick="location.reload()" style="background:#10b981;color:#020617;font-weight:bold;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">Retry</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts, Icons)
  // Strategy: Stale-While-Revalidate (Fast local load + background update)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline network failure for static asset is fine if cached
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for messages from client (e.g. manual update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
