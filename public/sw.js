const CACHE_NAME = 'photogram-v11';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/icon.svg',
  '/icon.jpg',
  '/push-badge.svg',
  '/manifest.webmanifest'
];

function refreshOfflineCache() {
  return fetch(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'same-origin' }))
    .then(function(res) {
      if (!res || !res.ok) return;
      return caches.open(CACHE_NAME).then(function(cache) {
        return cache.put(OFFLINE_URL, res);
      });
    })
    .catch(function() {});
}

function isSafePushMediaPath(raw, kind) {
  if (typeof raw !== 'string' || !raw || raw.length > 512) return false;
  if (!raw.startsWith('/media/') || raw.startsWith('//')) return false;
  if (raw.indexOf('..') !== -1 || raw.indexOf('\\') !== -1 || /[\x00-\x1f\x7f]/.test(raw)) return false;
  var lower = raw.toLowerCase();
  if (kind === 'avatar') {
    return lower.startsWith('/media/avatars/') || lower.startsWith('/media/avatars%2f');
  }
  if (kind === 'post') {
    return lower.startsWith('/media/posts/') || lower.startsWith('/media/posts%2f');
  }
  return false;
}

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(function() {
      return refreshOfflineCache();
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'REFRESH_OFFLINE') {
    event.waitUntil(refreshOfflineCache());
  }
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function() {
        return fetch(req.url, { credentials: 'include' });
      }).catch(function() {
        return caches.match(OFFLINE_URL).then(function(cached) {
          return cached || new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  if (url.pathname === '/manifest.webmanifest' || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(req).then(function(res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return res;
      }).catch(function() {
        return caches.match(req);
      })
    );
    return;
  }

  if (url.pathname === '/icon.svg' || url.pathname === '/icon.jpg' || url.pathname === '/push-badge.svg') {
    event.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(req, clone);
            });
          }
          return res;
        });
      })
    );
    return;
  }
});

self.addEventListener('push', function(event) {
  event.waitUntil((async function() {
    var data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      data = { title: 'Photogram', body: event.data ? event.data.text() : '' };
    }
    var windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    var isAppVisible = windowClients.some(function(c) {
      return Boolean(c.focused && c.visibilityState === 'visible');
    });
    if (isAppVisible) {
      return;
    }
    if (!data.title && !data.body) {
      return;
    }
    var notifOptions = {
      body: data.body || '',
      badge: '/push-badge.svg',
      tag: data.tag || 'photogram-notif',
      renotify: true,
      timestamp: (typeof data.ts === 'number' && data.ts > 0) ? data.ts : Date.now(),
      vibrate: [120, 60, 120],
      data: { url: data.url || '/' }
    };
    if (isSafePushMediaPath(data.icon, 'avatar')) {
      notifOptions.icon = data.icon;
    }
    if (isSafePushMediaPath(data.image, 'post')) {
      notifOptions.image = data.image;
    }
    await self.registration.showNotification(data.title || 'Photogram', notifOptions);
  })());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var rawUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  var targetUrl = '/';
  if (typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') && rawUrl.indexOf('\\') === -1 && !/[\x00-\x1f\x7f]/.test(rawUrl)) {
    try {
      var parsed = new URL(rawUrl, self.location.origin);
      if (parsed.origin === self.location.origin) {
        targetUrl = parsed.pathname + parsed.search + parsed.hash;
      }
    } catch (e) {}
  }
  event.waitUntil((async function() {
    var windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < windowClients.length; i++) {
      var client = windowClients[i];
      if (client && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(targetUrl); } catch (e) {}
        }
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
