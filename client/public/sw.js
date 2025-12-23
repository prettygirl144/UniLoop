// Dynamic cache name that changes with each deployment to prevent stale cache issues
const CACHE_VERSION = `1.0.4-no-double-render-${Date.now()}`; // Step 10: Bumped version for double render fix
const CACHE_NAME = `uniloop-v${CACHE_VERSION}`;
console.log(`🔄 Service Worker Version: ${CACHE_VERSION} - ${new Date().toISOString()}`);
const urlsToCache = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/192.png',
  '/icons/512.png'
];

// Install event - cache resources with cache busting
self.addEventListener('install', (event) => {
  console.log(`SW installing with cache version: ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
  // Force immediate activation of new service worker
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network with smart caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isApiRequest = url.pathname.startsWith('/api/');
  const isHtmlDocument = event.request.destination === 'document' || 
                        event.request.headers.get('accept')?.includes('text/html');
  const isDevelopment = url.hostname === 'localhost' || 
                       url.hostname.includes('replit.dev') ||
                       url.hostname.includes('replit.app');
  
  // Enhanced logging and bypass for sick food booking diagnostics
  if (url.pathname.includes('/api/amenities/sick-food')) {
    console.log(`🔄 [SERVICE-WORKER] Intercepted sick food request - Method: ${event.request.method}, URL: ${url.pathname}`);
  }

  // Skip caching for API requests to avoid interfering with authentication and bookings
  if (isApiRequest) {
    console.log(`🚫 [SERVICE-WORKER] Bypassing cache for API request: ${url.pathname}`);
    return;
  }
  
  // In development, always fetch HTML documents to get latest changes
  if (isDevelopment && isHtmlDocument) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return offline page only if network fails
        return caches.match('/offline.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response && !isDevelopment) {
          return response;
        }
        
        // Clone the request because it's a stream
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Only cache http/https requests, skip chrome-extension and other schemes
          if (event.request.url.startsWith('http') && !isDevelopment) {
            // Clone the response because it's a stream
            const responseToCache = response.clone();
            
            // Cache successful responses for non-API requests (not in development)
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        }).catch(() => {
          // Return offline page for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Activate event - clean up old caches and force immediate control
self.addEventListener('activate', (event) => {
  console.log(`SW activating with cache: ${CACHE_NAME}`);
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Clear all caches if this is a development environment for fresh start
      (() => {
        const isDevelopment = self.location.hostname === 'localhost' || 
                             self.location.hostname.includes('replit.dev') ||
                             self.location.hostname.includes('replit.app');
        if (isDevelopment) {
          console.log('Development environment detected, clearing all caches');
          return caches.keys().then(cacheNames => 
            Promise.all(cacheNames.map(name => caches.delete(name)))
          );
        }
        return Promise.resolve();
      })()
    ])
  );
  
  // Take control of all pages immediately
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      },
      actions: [
        {
          action: 'explore',
          title: 'View',
          icon: '/icon-96.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icon-96.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync operations
      console.log('Background sync triggered')
    );
  }
});

// Handle offline/online events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync for notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(
      // Sync content in background
      console.log('Periodic background sync triggered')
    );
  }
});
