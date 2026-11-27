# Photogram

> A high-performance, edge-native, zero-framework social platform, real-time end-to-end encrypted messenger, and Progressive Web Application (PWA). Engineered with pure TypeScript, Cloudflare Pages & Workers, Durable Objects WebSocket Hibernation, Neon PostgreSQL, and Cloudflare R2.

---

## Executive Summary

**Photogram** is a full-stack social network and E2EE messenger built without heavy frontend frameworks:

- **Server-rendered edge HTML** paired with lightweight DOM micro-controllers and SPA-style in-place navigation.
- **Global edge execution** on **Cloudflare Pages Functions / Workers** with a dedicated **Cloudflare Durable Objects (`UserHub`)** WebSocket Hibernation realtime worker (`workers/realtime`).
- **Serverless relational persistence** on **Neon PostgreSQL** (`@neondatabase/serverless`, with local SQLite/D1 schema parity) and zero-egress media storage on **Cloudflare R2**.
- **Seamless End-to-End Encrypted (E2EE) Messenger** built on the Signal Protocol (`@privacyresearch/libsignal-protocol-typescript`), strict Trust On First Use (TOFU), cryptographic multi-device approval, versioned signed device lists, official 60-digit Safety Numbers with QR verification, and AES-256-GCM encrypted photos and voice messages.
- **Personalized recommendation & telemetry pipeline** across Feed, Explore, Profile, and Pics Mode.

---

## Architecture Overview

```text
                       [ Browser / Mobile PWA ]
                        ├── Pages HTML + SPA nav + Service Worker (public/sw.js)
                        ├── Signal E2EE Client (dist/e2ee.js)
                        │     ├── IndexedDB (per-account isolated: pg_signal_e2ee_u_<id>)
                        │     ├── Web Locks API mutex + BroadcastChannel UI/cache sync
                        │     └── AES-256-GCM media & voice encryption + Safety Number / QR
                        │
        HTTPS / API ────┴────────────────────────────────────── WSS /api/realtime/ws
             │                                                           │
             ▼                                                           ▼
  [ Cloudflare Pages Worker ]  ──── service binding ────▶  [ Realtime Worker (Durable Objects) ]
   (src/index.ts -> _worker.js)                             (workers/realtime/src/index.ts)
     ├── Auth (PBKDF2-SHA256, HttpOnly sessions, multi-account)    └── UserHub (WebSocket Hibernation)
     ├── Posts, Comments (replies/pins/likes), Likes, Follows            ├── Live messages & edits
     ├── Recommendations & Telemetry batching                            ├── Typing & read receipts
     ├── E2EE Key Directory, Signed Device Lists & Challenges            ├── Reactions & voice listened
     ├── Opt-in Link Previews (SSRF-hardened proxy)                      └── Device approval / reset events
     └── Web Push (VAPID)
             │                                   │
             ▼                                   ▼
   [ Neon PostgreSQL ]                    [ Cloudflare R2 ]
    (@neondatabase/serverless)             (Posts, Avatars, E2EE Media & Voice)
```

---

## Key Features & Subsystems

### 1. Seamless End-to-End Encrypted Messenger
- **Signal Protocol (`src/client/e2ee.ts`, `src/e2ee.ts`)**: X3DH + Double Ratchet encryption for text, photos, voice notes, replies, message edits, and shared posts. Private keys and plaintext never leave the client device.
- **Strict TOFU & Account Isolation**: `isTrustedIdentity` enforces Trust On First Use without silent key overwrites; per-account IndexedDB databases (`pg_signal_e2ee_u_<userId>`) isolate keys across saved accounts.
- **Cryptographic Multi-Device Approval & Signed Device Lists**:
  - Atomic primary first-device registration enforced by partial unique index (`idx_e2ee_devices_one_primary`).
  - Adding a new device requires proof-of-possession via an ECDSA P-256 signature over a single-use server challenge (`nonce`, 5-minute TTL, atomic `used_at` replay protection) from an already-trusted device.
  - Monotonically versioned device lists (`e2ee_device_lists`) are dual-signed (ECDSA P-256 verified on the edge worker + Signal Curve25519 XEdDSA verified directly on peer clients against TOFU-pinned keys) to prevent ghost-device injection and version rollback.
  - Existing legacy devices are preserved as `trust_origin = 'legacy'` without silently wiping keys or falsely marking them code-verified.
- **Safe Session Recovery & PreKey Auto-Refill**: PreKeys replenish automatically on startup and after `PreKeyWhisperMessage` decryption. A single `Bad MAC` or duplicate delivery never destroys working Double Ratchet keys; X3DH rebuild triggers only after repeated distinct failures from an unchanged trusted identity key.
- **Lost-Device Recovery**: Requires password re-authentication (`verifyPassword`), revokes all other devices, PreKeys, auth sessions, and WebSocket connections, notifies active sessions, and exposes the key change to contacts (`KEY_CHANGED`).
- **Optional Safety Number & QR Verification**: Uses `FingerprintGenerator(5200)` for official 60-digit Signal Safety Numbers and `qrcode-generator` for SVG QR rendering (DOM `createElementNS`, no `innerHTML`) with optional `BarcodeDetector` camera scanning.
- **Cross-Tab Mutual Exclusion**: Uses Web Locks API (`navigator.locks`) with a fallback lease lock for crypto operations; `BroadcastChannel` is used strictly for cross-tab cache and UI synchronization.
- **Opt-In Link Previews**: Disabled by default for new users (`users.link_previews_enabled = 0`) with explicit Settings disclosure that enabled previews send URLs to the Photogram server. When disabled, neither outgoing URL lookups nor incoming preview image fetches are made (enforced with HTTP `403` on the server).
- **Rich Chat UX**: Voice messages with tap-to-record, waveform rendering, and listened indicators; emoji reactions; replies; photo editing/replacement; read receipts (single/double checkmarks); typing indicators; YouTube embed modal with clickable timecodes.

### 2. Real-Time Messaging via Durable Objects WebSocket Hibernation
- Dedicated worker (`workers/realtime`) hosting per-user `UserHub` Durable Objects using the Cloudflare WebSocket Hibernation API.
- CSWSH protection (`Origin` + `Sec-Fetch-Site`), per-user/per-IP connection rate limits, instant delivery of messages, edits, deletions, reactions, typing, read/listened receipts, and E2EE device events, with automatic fallback polling if WebSockets disconnect.

### 3. Personalized Recommendation Engine
- Dual-factor affinity graph (`user_affinity` + `user_tag_affinity`) with multilingual Latin/Cyrillic tokenization (`src/recommendations.ts`).
- Time-decay scoring across Feed, Explore, Related Posts, Similar Accounts, and Who to Follow, backed by batched client `IntersectionObserver` telemetry (`POST /api/telemetry`).

### 4. Social Feed, Profiles, Comments & Media
- Mobile-first Instagram-grade UI in Light and Dark themes.
- Double-tap heart reaction on posts, mobile two-finger pinch-to-zoom with snap-back animation, and fullscreen vertical Pics Mode.
- Threaded comments with replies, author likes, pinning, and unified context-menu actions (long-press on mobile / right-click on desktop).
- Client-side image compression/cropping to WebP with full + thumbnail variants stored in R2.
- Multi-account switcher (`/accountlist`), Activity center (`/activity`), and Web Push notifications (VAPID, `src/push.ts`).

### 5. Progressive Web App (PWA) & 4-Language i18n
- Installable PWA (`public/manifest.webmanifest`, `public/sw.js`) with offline fallback (`/offline`) and versioned cache invalidation.
- Full localization across **Russian (`ru`)**, **English (`en`)**, **Uzbek (`uz`)**, and **Kazakh (`kz`)**.

### 6. Security Controls
- **Passwords & Sessions**: PBKDF2-SHA256 salted password hashes with timing-safe verification; `HttpOnly`, `Secure`, `SameSite=Lax` session cookies; session revocation on password change and lost-device recovery.
- **Request & Media Hardening**: Atomic rate limiting (`auth_rate_limits`), CSRF checks (`Origin` / `Sec-Fetch-Site`), strict allowlisted R2 `/media/*` access control with DM attachment membership verification, SSRF-hardened Link Preview proxy with raster magic-byte verification, and security headers (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `CSP`).
- **Known Security Trade-offs**: Active CSP currently retains `script-src 'self' 'unsafe-inline'` for server-rendered page scripts; Key Transparency is not implemented (first-contact verification relies on TOFU + optional Safety Number/QR comparison); encrypted cloud chat backup is not yet implemented.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Edge Compute** | [Cloudflare Pages](https://pages.cloudflare.com/) & [Workers](https://workers.cloudflare.com/) | SSR HTML, REST APIs, static assets |
| **Realtime** | [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) | WebSocket Hibernation (`UserHub`) |
| **Database** | [Neon PostgreSQL](https://neon.tech/) (`@neondatabase/serverless`) | Primary relational store (with D1/SQLite parity) |
| **Object Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Posts, avatars, AES-GCM encrypted DM media & voice |
| **E2EE & QR** | `@privacyresearch/libsignal-protocol-typescript`, `qrcode-generator` | Signal Protocol X3DH/Ratchet, Safety Numbers, QR |
| **Language & Build** | TypeScript (strict), [esbuild](https://esbuild.github.io/) | `dist/e2ee.js` (IIFE) + `dist/_worker.js` (ESM) |
| **Styling & PWA** | Vanilla CSS variables, Service Worker, Web Push (VAPID) | Light/Dark design system, offline support, notifications |

---

## Project Directory Map

```text
Photogram/
├── public/
│   ├── _headers                        # Static security & cache headers
│   ├── manifest.webmanifest            # PWA application manifest
│   └── sw.js                           # Service Worker & Web Push handler
├── src/
│   ├── client/
│   │   └── e2ee.ts                     # Browser Signal E2EE engine, TOFU, Web Locks, QR
│   ├── db/
│   │   ├── client.ts                   # Neon PostgreSQL adapter (D1-compatible API)
│   │   ├── schema.postgres.sql         # PostgreSQL base schema
│   │   ├── schema.sql                  # SQLite/D1 parity schema
│   │   └── migrations/
│   │       └── 2026-11-27_seamless_e2ee.sql
│   ├── languages/
│   │   ├── types.ts                    # Strongly-typed i18n dictionary contract
│   │   ├── ru.ts / en.ts / uz.ts / kz.ts
│   │   └── index.ts                    # Locale detection & date/number formatting
│   ├── pages/
│   │   ├── layout.ts                   # App shell, SPA router, realtime WS client, telemetry
│   │   ├── feed.ts / explore.ts / profile.ts
│   │   ├── messages.ts                 # E2EE messenger UI, voice recorder, Safety Number/QR
│   │   ├── settings.ts                 # Theme, language, notifications, Link Previews & Devices
│   │   ├── activity.ts / accountlist.ts / notifications.ts
│   │   ├── commentsModal.ts / share.ts / publishpost.ts / editprofile.ts
│   │   ├── sublist.ts / subslist.ts / nav.ts / login.ts / register.ts / useraccept.ts / error.ts
│   ├── activity.ts / auth.ts / blockedUsernames.ts / e2ee.ts
│   ├── index.ts                        # Main Cloudflare Pages Worker router
│   ├── linkPreview.ts                  # Opt-in SSRF-hardened link metadata & image proxy
│   ├── messages.ts / notifications.ts / posts.ts / profile.ts
│   ├── push.ts / realtime.ts / recommendations.ts / security.ts
│   ├── styles.ts / types.ts / assets.ts / iconJpgBase64.ts
├── workers/
│   └── realtime/
│       ├── src/index.ts                # Durable Object UserHub (WebSocket Hibernation)
│       └── wrangler.toml
├── package.json
├── tsconfig.json
├── wrangler.toml.example
└── README.md
```

---

## Quickstart & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Install Dependencies
```bash
git clone https://github.com/itisislom/photogram.git
cd photogram
npm install
```

### 2. Configure Environment & Bindings
Copy `wrangler.toml.example` to `wrangler.toml` and configure your Cloudflare R2 bucket, service binding to `photogram-realtime`, and secrets (`DATABASE_URL` for Neon PostgreSQL, VAPID keys for Web Push) in `.dev.vars` locally or in Cloudflare Pages project settings.

### 3. Build & Run Locally
Start the realtime Durable Objects worker and the main Pages dev server in separate terminals:
```bash
npm run dev:realtime
npm run dev
```
Open `http://127.0.0.1:8787` in your browser.

### 4. Production Deployment
Apply any pending SQL migrations in `src/db/migrations/` to Neon PostgreSQL, then deploy:
```bash
npm run deploy:realtime
npm run deploy:pages
```

---

## License

Photogram is **Source-Available (All Rights Reserved)** — the code is publicly visible on GitHub for transparency and independent security inspection, while copying, modifying, redistributing, or hosting clones of the application, backend, UI, or Photogram branding is prohibited without written permission from the author.

The standalone client E2EE module (`src/client/e2ee.ts`), which integrates `@privacyresearch/libsignal-protocol-typescript`, is licensed separately under **GNU GPL v3.0 (`GPL-3.0-only`)** ([`src/client/LICENSE-GPL-3.0.txt`](src/client/LICENSE-GPL-3.0.txt)).

See the [LICENSE](LICENSE) file for complete terms.

---

Made By Islom Sadriddinov
