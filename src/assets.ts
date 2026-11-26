import { ICON_JPG_BASE64 } from './iconJpgBase64';

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="photogram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2196F3"/>
      <stop offset="50%" stop-color="#F48FB1"/>
      <stop offset="100%" stop-color="#FFD54F"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" ry="128" fill="url(#photogram-gradient)"/>
  <svg x="128" y="128" width="256" height="256" viewBox="0 0 24 24" fill="#FFFFFF">
    <path d="M9.4 4L7.6 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.6L14.6 4H9.4zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
</svg>`;

export function getIconJpgBytes(): Uint8Array {
  const binary = atob(ICON_JPG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getManifestJson(theme?: string): string {
  const bg = theme === 'light' ? '#FFFFFF' : '#000000';
  return JSON.stringify({
    name: "Photogram",
    short_name: "Photogram",
    description: "Photogram social platform",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "portrait",
    background_color: bg,
    theme_color: bg,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any maskable"
      },
      {
        src: "/icon.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any maskable"
      }
    ]
  }, null, 2);
}

export const MANIFEST_JSON = getManifestJson('dark');

export const SW_JS = `const CACHE_NAME = 'photogram-v9';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  '/icon.svg',
  '/icon.jpg',
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

  if (url.pathname === '/icon.svg' || url.pathname === '/icon.jpg') {
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
    var isAppFocused = windowClients.some(function(c) {
      return Boolean(c.focused);
    });
    if (isAppFocused) {
      return;
    }
    if (!data.title && !data.body) {
      return;
    }
    await self.registration.showNotification(data.title || 'Photogram', {
      body: data.body || '',
      icon: '/icon.jpg',
      badge: '/icon.svg',
      tag: data.tag || 'photogram-notif',
      renotify: Boolean(data.kind === 'dm'),
      data: { url: data.url || '/' }
    });
  })());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var rawUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  var targetUrl = '/';
  if (typeof rawUrl === 'string' && rawUrl.startsWith('/') && !rawUrl.startsWith('//') && rawUrl.indexOf('\\\\') === -1 && !/[\\x00-\\x1f\\x7f]/.test(rawUrl)) {
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
`;
