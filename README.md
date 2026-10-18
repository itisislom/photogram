# Photogram

> A high-performance, edge-native, zero-framework social network and Progressive Web Application (PWA). Engineered from the ground up with pure TypeScript, Cloudflare Edge primitives, and an Instagram-grade personalized recommendation engine.

---

## 🌟 Executive Summary

**Photogram** is a full-stack, production-ready social media platform designed for ultra-low latency media sharing, discovery, and engagement. Unlike conventional single-page applications bogged down by massive client-side bundles, Photogram operates on a **zero-heavy-framework** philosophy:

- **Server-rendered edge HTML** combined with targeted, lightweight client micro-controllers.
- Sub-millisecond Time to First Byte (TTFB) executed inside Cloudflare V8 isolates.
- Globally distributed data persistence using **Cloudflare D1** (Serverless SQLite) and **Cloudflare R2** (Zero-egress Object Storage).
- A bespoke, end-to-end recommendation and telemetry pipeline replicating the exact behavioral mechanics of modern social media giants.

---

## 🚀 Key Highlights & Architecture

### 1. Instagram-Grade Personal Recommendation Engine
Photogram incorporates an end-to-end personalization pipeline (`src/recommendations.ts`) that runs across Feed, Explore, Post View, and Profile surfaces:
- **Dual-Factor Affinity Graph**: Tracks two distinct affinity dimensions:
  - **User-to-Author Affinity (`user_affinity`)**: Measures how closely two users interact (likes, comments, profile visits, follows, dwell time).
  - **User-to-Tag Affinity (`user_tag_affinity`)**: Tracks topic interests parsed dynamically from post captions.
- **Multilingual NLP Tokenizer**: Custom regex engine (`/[#]?([a-zа-яё0-9_]{4,30})/gi`) supporting both Latin and Cyrillic character sets, with comprehensive stop-word filtering across Russian and English.
- **Time-Decay & Freshness Dampening**: Scores content via an exponential decay algorithm:
  $$\text{Score} = \frac{(\text{Likes} \times 3 + \text{Comments} \times 5) + (\text{AuthorAffinity} \times 2.5) + (\text{TagAffinity} \times 1.8)}{(\text{AgeHours} + 2.0)^2}$$
- **Real-Time Client-Side Telemetry Engine**:
  - `IntersectionObserver` observing media elements at a 65% visibility threshold.
  - Granular dwell tracking: distinct impression triggers at 600ms and deep engagement signals at 2,500ms.
  - Session deduplication (`seenInSession`) ensuring a single impression record per post per session.
  - Batching queue dispatched via `navigator.sendBeacon` or `fetch` with `env.DB.batch()` on the edge (limited to 50 events per batch).
- **Cold-Start & "Always Live Feed" Resilience**:
  - Unauthenticated fallback to global popularity and chronological freshness.
  - Seen penalties (0.25 for feed, 0.08 for explore) dampening previously viewed content while guaranteeing an active, non-empty viewport at all times.
- **Intelligent Feed Segmentation**:
  - **Followed Posts** ordered by affinity and recency.
  - **"You're All Caught Up"** completion banner with animated status indicators.
  - **"Who to Follow"** carousel based on mutual connections and top network creators.
  - **"Suggested For You"** algorithmic discoveries matching tag affinity.
- **Discovery & Content Controls**:
  - Interactive Explore tag pills bar (`For You`, `Popular`, `Recent`, plus dynamic trending hashtags).
  - Explicit feedback: "Not Interested" (`POST /api/posts/hide`) with immediate negative affinity penalties.
  - Contextual discovery: "Similar Accounts" carousel and "Related Posts" 2x3 discovery grids.

---

### 2. Edge-Native Compute & Zero-Framework Velocity
- **No Heavy Client Runtimes**: Zero React, Vue, or Angular overhead. The entire client payload consists of optimized, native DOM micro-controllers and vanilla CSS tokens.
- **V8 Isolate Execution**: Dynamic routes are rendered at the nearest Cloudflare edge location across 300+ cities globally.
- **Distributed SQLite (Cloudflare D1)**: Multi-region read replicas with strict ACID transactions and query-level indexing.
- **Direct Edge Media Storage (Cloudflare R2)**: Zero-egress-fee storage with streaming byte-range delivery and client-side pre-processing.

---

### 3. Pics Mode (Vertical Immersive Media Viewer)
- Fullscreen, Reels/TikTok-inspired vertical media viewer with smooth touch and keyboard navigation.
- Floating bottom meta panel displaying author details, relative time offsets, and exact publication timestamps.
- Global persistent controls ensuring fixed navigation and instant exit state preservation.

---

### 4. Progressive Web App (PWA) & Offline Resiliency
- Web App Manifest v2 compliant (`public/manifest.webmanifest`) with standalone display mode, orientation locking, and brand icons.
- Service Worker (`public/sw.js`) utilizing a hybrid caching strategy:
  - **Cache-First** for static assets, brand icons, and CSS tokens.
  - **Network-First with Graceful Fallback** for authenticated social feeds and profiles.

---

### 5. Multi-Language Internationalization (i18n)
- Native support for 4 localized languages:
  - 🇷🇺 Russian (`ru`)
  - 🇺🇸 English (`en`)
  - 🇺🇿 Uzbek (`uz`)
  - 🇰🇿 Kazakh (`kz`)
- Persistent selection synced across HttpOnly cookies and client storage with instant UI re-rendering.

---

### 6. Security & Edge Isolation Standards
- **Zero Raw Passwords**: Salted hashing via Web Crypto API (`crypto.subtle.digest('SHA-256')` with unique per-user salts).
- **Hardened Session Management**: HttpOnly, SameSite=Lax, Secure session cookies with cryptographic entropy.
- **SQL Injection Immune**: 100% prepared parameterized bindings (`stmt.bind(...)`) across all D1 database operations.
- **XSS & Output Sanitization**: Strict HTML entity escaping for user captions, comments, and usernames.
- **IDOR Protection**: Author verification enforced on all mutation and deletion operations.
- **Secret Isolation**: Zero sensitive tokens, database IDs, or private credentials committed to version control.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Edge Runtime** | [Cloudflare Pages](https://pages.cloudflare.com/) / [Workers](https://workers.cloudflare.com/) | Global serverless execution on V8 isolates |
| **Edge Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) | Distributed serverless SQLite with relational integrity |
| **Object Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | S3-compatible media storage with zero egress fees |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) | End-to-end type safety and maintainable system contracts |
| **Bundler** | [esbuild](https://esbuild.github.io/) | Sub-second bundle compilation to ESM `_worker.js` |
| **Styling** | Vanilla CSS (CSS Variables) | Tailored design system, dark mode, responsive layout |
| **Client Protocols** | DOM APIs, `IntersectionObserver` | Zero-overhead telemetry and dynamic UI hydration |
| **Application Layer** | PWA (Service Worker + Manifest) | Native-app feel, home screen installation, offline cache |

---

## 📂 Project Directory Map

```text
Photogram/
├── public/
│   ├── manifest.webmanifest      # PWA application manifest
│   └── sw.js                     # Offline cache & Service Worker
├── src/
│   ├── db/
│   │   └── schema.sql            # SQLite DDL schema & performance indexes
│   ├── languages/
│   │   ├── types.ts              # Strongly-typed i18n translation keys
│   │   ├── en.ts                 # English locale dictionary
│   │   ├── ru.ts                 # Russian locale dictionary
│   │   ├── uz.ts                 # Uzbek locale dictionary
│   │   ├── kz.ts                 # Kazakh locale dictionary
│   │   └── index.ts              # Locale selector and cookie parser
│   ├── pages/
│   │   ├── layout.ts             # Master page shell, telemetry observer, head
│   │   ├── feed.ts               # Feed view (Followed, Caught up, Suggested)
│   │   ├── explore.ts            # Explore grid, tag pills bar, Pics viewer
│   │   ├── profile.ts            # Profile view, related posts, post modal
│   │   ├── login.ts              # Authentication entrypoint
│   │   ├── register.ts           # User registration flow
│   │   ├── commentsModal.ts      # Comment dialog component
│   │   ├── nav.ts                # Responsive navigation bar (top & bottom)
│   │   ├── useraccept.ts         # User agreement & onboarding
│   │   └── error.ts              # Error layout handler
│   ├── assets.ts                 # Vector icons & SVG assets
│   ├── auth.ts                   # Password hashing, tokens, session cookies
│   ├── iconJpgBase64.ts          # Inline image fallback assets
│   ├── index.ts                  # Worker router & edge endpoint dispatcher
│   ├── posts.ts                  # Post creation, likes, comments, deletions
│   ├── profile.ts                # Profile queries, follow graphs, avatar uploads
│   ├── recommendations.ts        # Recommendation engine, tag extraction, telemetry
│   ├── styles.ts                 # Unified CSS design system & micro-animations
│   └── types.ts                  # Core TypeScript types & Cloudflare bindings
├── icon.jpg                      # Application brand icon (JPEG)
├── icon.svg                      # Scalable application brand icon (SVG)
├── package.json                  # Scripts & development dependencies
├── tsconfig.json                 # TypeScript compiler configuration
├── wrangler.toml.example         # Cloudflare configuration template
└── README.md                     # Technical architecture documentation
```

---

## ⚙️ Recommendation Engine Mechanics

```
                             [ User Browser Session ]
                                        │
                         (Scroll & Interaction Events)
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [ Impression ]                   [ Dwell ]
                   (600ms / 65%)                (2500ms / 65%)
                         │                             │
                         └──────────────┬──────────────┘
                                        ▼
                           [ Telemetry Batch Queue ]
                               (Max 50 / 4s sync)
                                        │
                                 POST /api/telemetry
                                        ▼
                         [ Cloudflare Edge Worker ]
                                        │
                               env.DB.batch(...)
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
       [ user_interactions ]                          [ user_affinity ]
      - Raw event telemetry                         - Aggregated score
      - Session deduplication                       - Real-time updates
                                                               │
                                                               ▼
                                                  [ Feed & Explore Scoring ]
                                                  - Author Affinity Weight
                                                  - Tag Affinity Weight
                                                  - Time-Decay Curve
                                                  - Seen Penalty Dampening
```

### Event Interaction Weights
| Event Type | Affinity Delta | Description |
|---|---|---|
| `like` | `+3.0` | Explicit positive engagement signal |
| `comment` | `+5.0` | High-intent conversational interaction |
| `dwell` | `+1.5` | Deep content consumption (viewport stay $\ge 2.5\text{s}$) |
| `profile_visit` | `+2.0` | Navigation to author's profile page |
| `follow` | `+10.0` | Graph subscription (highest baseline affinity) |
| `unlike` | `-3.0` | Retracted engagement (clamped at `0.0`) |
| `hide` | `-10.0` | Explicit negative signal ("Not Interested") |

---

## ⚡ Quickstart & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Clone & Install
```bash
git clone https://github.com/itisislom/photogram.git
cd photogram
npm install
```

### 2. Configure Cloudflare Bindings
Copy the sample configuration file and insert your Cloudflare resource identifiers:
```bash
cp wrangler.toml.example wrangler.toml
```
Update `wrangler.toml` with your credentials:
```toml
name = "photogramapp"
compatibility_date = "2024-12-30"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "photogram-db"
database_id = "YOUR_D1_DATABASE_ID"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "photogram-media"
```

### 3. Initialize Database Schema
Apply the database tables and indexes to your local D1 environment:
```bash
npm run db:local
```
Or provision your remote Cloudflare D1 production database:
```bash
npm run db:remote
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:8787` in your browser.

### 5. Production Deployment
Build the ESM bundle and deploy directly to Cloudflare Pages:
```bash
npm run deploy:pages
```

---

## 🛡️ License

This project is licensed under the **MIT License** with an explicit **Trademark & Branding Protection Notice**. See the [LICENSE](file:///d:/Projects/Programing/Apps/Photogram/LICENSE) file for complete details.

---

Made By Islom Sadriddinov
