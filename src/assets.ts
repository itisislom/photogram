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

export const MANIFEST_JSON = JSON.stringify({
  name: "Photogram",
  short_name: "Photogram",
  description: "Photogram social platform",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#FFFFFF",
  theme_color: "#FFFFFF",
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

export const SW_JS = `const CACHE_NAME = 'photogram-v2';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/icon.svg',
  '/icon.jpg',
  '/manifest.webmanifest'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
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

  if (url.pathname === '/icon.svg' || url.pathname === '/icon.jpg' || url.pathname === '/manifest.webmanifest') {
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
`;
