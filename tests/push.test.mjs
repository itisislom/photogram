import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

if (typeof crypto.subtle.timingSafeEqual !== 'function') {
  crypto.subtle.timingSafeEqual = (a, b) => {
    const ua = a instanceof Uint8Array ? a : new Uint8Array(a);
    const ub = b instanceof Uint8Array ? b : new Uint8Array(b);
    return ua.byteLength === ub.byteLength && nodeCrypto.timingSafeEqual(ua, ub);
  };
}

function base64UrlEncode(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

async function hkdfSha256(salt, ikm, info, len) {
  const realSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const prk = await hmacSha256(realSalt, ikm);
  const okm = await hmacSha256(prk, Buffer.concat([Buffer.from(info), Buffer.from([1])]));
  return okm.slice(0, len);
}

async function decryptWebPushAes128Gcm(bodyBytes, uaPrivateKey, uaPublicRaw, authSecret) {
  const salt = bodyBytes.slice(0, 16);
  const idLen = bodyBytes[20];
  const asPublicRaw = bodyBytes.slice(21, 21 + idLen);
  const ciphertext = bodyBytes.slice(21 + idLen);
  const asPubKey = await crypto.subtle.importKey('raw', asPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asPubKey }, uaPrivateKey, 256),
  );
  const te = new TextEncoder();
  const keyInfo = Buffer.concat([Buffer.from(te.encode('WebPush: info\0')), Buffer.from(uaPublicRaw), Buffer.from(asPublicRaw)]);
  const ikm = await hkdfSha256(authSecret, sharedSecret, keyInfo, 32);
  const cek = await hkdfSha256(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfSha256(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['decrypt']);
  const plainBuf = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext));
  let end = plainBuf.length - 1;
  while (end >= 0 && plainBuf[end] === 0) end--;
  assert.strictEqual(plainBuf[end], 2);
  return JSON.parse(new TextDecoder().decode(plainBuf.slice(0, end)));
}

const swFile = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8').replace(/\r\n/g, '\n');
const distSwFile = fs.readFileSync(path.join(root, 'dist/sw.js'), 'utf8').replace(/\r\n/g, '\n');
const badgeFile = fs.readFileSync(path.join(root, 'public/push-badge.svg'), 'utf8').replace(/\r\n/g, '\n');
const distBadgeFile = fs.readFileSync(path.join(root, 'dist/push-badge.svg'), 'utf8').replace(/\r\n/g, '\n');

assert.strictEqual(swFile, distSwFile, 'dist/sw.js must match public/sw.js');
assert.strictEqual(badgeFile, distBadgeFile, 'dist/push-badge.svg must match public/push-badge.svg');
assert.ok(badgeFile.includes('prefers-color-scheme: dark'), 'push-badge.svg must be theme-adaptive');
assert.ok(badgeFile.includes('#111111') && badgeFile.includes('#FFFFFF'), 'push-badge.svg must adapt light/dark colors');
assert.ok(!badgeFile.includes('<rect'), 'push-badge.svg must NOT have an opaque background rect');
assert.ok(badgeFile.includes('<path') && badgeFile.includes('<circle'), 'push-badge.svg must contain camera glyph');
assert.ok(!swFile.includes("icon: '/icon.jpg'"), 'sw.js must NOT hardcode duplicate /icon.jpg');
assert.ok(swFile.includes("badge: '/push-badge.svg'"), 'sw.js must use /push-badge.svg as badge');
new Function(swFile);
console.log('1. Badge SVG (adaptive camera, zero background rect) & SW parity check PASSED');

const workerMod = await import(new URL(`file:///${path.join(root, 'dist/_worker.js').replace(/\\/g, '/')}`).href);
const worker = workerMod.default;

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec(fs.readFileSync(path.join(root, 'src/db/schema.sql'), 'utf8'));
try { sqlite.exec('ALTER TABLE comments ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0'); } catch {}

function makeDbAdapter(db) {
  return {
    prepare(rawSql) {
      return {
        sql: rawSql,
        params: [],
        bind(...p) { this.params = p; return this; },
        async first() {
          const row = db.prepare(rawSql).get(...this.params);
          return row === undefined ? null : { ...row };
        },
        async all() {
          return { results: db.prepare(rawSql).all(...this.params).map((r) => ({ ...r })) };
        },
        async run() {
          const info = db.prepare(rawSql).run(...this.params);
          return { meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } };
        },
      };
    },
    async batch(queries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = [];
        for (const q of queries) {
          const stmt = db.prepare(q.sql);
          if (/\bRETURNING\b/i.test(q.sql)) out.push(stmt.all(...(q.params || [])).map((r) => ({ ...r })));
          else {
            const info = stmt.run(...(q.params || []));
            out.push({ meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } });
          }
        }
        db.exec('COMMIT');
        return out;
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch {}
        throw err;
      }
    },
  };
}

const vapidKp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const vapidPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', vapidKp.publicKey));
const vapidPrivJwk = await crypto.subtle.exportKey('jwk', vapidKp.privateKey);

const subKeys = new Map();
const capturedPushes = [];
const origFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : input.url;
  if (urlStr.startsWith('https://fcm.googleapis.com/fcm/send/')) {
    const sub = subKeys.get(urlStr);
    assert.ok(sub, 'Unknown push endpoint ' + urlStr);
    const bodyBytes = init.body instanceof Uint8Array ? init.body : new Uint8Array(init.body);
    const decrypted = await decryptWebPushAes128Gcm(bodyBytes, sub.privKey, sub.pubRaw, sub.auth);
    capturedPushes.push({ endpoint: urlStr, lang: sub.lang, payload: decrypted });
    return new Response('', { status: 201 });
  }
  return origFetch(input, init);
};

const r2Store = new Map();
const env = {
  DB: makeDbAdapter(sqlite),
  VAPID_PUBLIC_KEY: base64UrlEncode(vapidPubRaw),
  VAPID_PRIVATE_KEY: vapidPrivJwk.d,
  VAPID_SUBJECT: 'mailto:test@photogramapp.pages.dev',
  STORAGE: {
    async put(key, val) {
      r2Store.set(key, val instanceof Uint8Array ? new Uint8Array(val) : new Uint8Array(await new Response(val).arrayBuffer()));
    },
    async get(key) {
      const b = r2Store.get(key);
      if (!b) return null;
      return { body: b, size: b.byteLength, writeHttpMetadata(h) { h.set('Content-Type', 'application/octet-stream'); }, async arrayBuffer() { return b.buffer; } };
    },
    async delete(key) { r2Store.delete(key); },
  },
  REALTIME_HUB: {
    idFromName(n) { return n; },
    get() { return { async fetch() { return new Response(JSON.stringify({ ok: true }), { status: 200 }); } }; },
  },
};

const origin = 'https://photogramapp.pages.dev';
const bgPromises = [];
const ctx = { waitUntil(p) { bgPromises.push(p); } };
async function flushBg() {
  while (bgPromises.length) {
    const batch = bgPromises.splice(0);
    await Promise.all(batch);
  }
}

const badgeRouteRes = await worker.fetch(new Request(`${origin}/push-badge.svg`), env, ctx);
assert.strictEqual(badgeRouteRes.status, 200);
assert.ok((badgeRouteRes.headers.get('content-type') || '').includes('image/svg+xml'));
assert.strictEqual((await badgeRouteRes.text()).replace(/\r\n/g, '\n').trim(), badgeFile.trim());

const swRouteRes = await worker.fetch(new Request(`${origin}/sw.js`), env, ctx);
assert.strictEqual(swRouteRes.status, 200);
assert.strictEqual((await swRouteRes.text()).replace(/\r\n/g, '\n').trim(), swFile.trim());
console.log('2. Worker routes /push-badge.svg and /sw.js match public files PASSED');

async function register(username, displayName) {
  const fd = new FormData();
  fd.set('username', username);
  fd.set('display_name', displayName);
  fd.set('password', 'Password123!');
  fd.set('terms', '1');
  const res = await worker.fetch(new Request(`${origin}/api/auth/register`, {
    method: 'POST',
    headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
    body: fd,
  }), env, ctx);
  assert.strictEqual(res.status, 201);
  const sess = res.headers.getSetCookie().find((c) => c.startsWith('session=')).split(';')[0];
  const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return { id: Number(row.id), cookie: sess };
}

async function subscribePush(cookie, lang, tag) {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const endpoint = `https://fcm.googleapis.com/fcm/send/${tag}_${lang}`;
  subKeys.set(endpoint, { privKey: kp.privateKey, pubRaw, auth, lang });
  const res = await worker.fetch(new Request(`${origin}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      Cookie: `${cookie}; lang=${lang}`,
    },
    body: JSON.stringify({
      endpoint,
      keys: { p256dh: base64UrlEncode(pubRaw), auth: base64UrlEncode(auth) },
    }),
  }), env, ctx);
  assert.strictEqual(res.status, 200);
}

const alice = await register('alice', 'Alice Wonderland');
const bob = await register('bob', 'Bob Builder');
const charlie = await register('charlie', 'charlie');
sqlite.prepare("UPDATE users SET avatar_key = 'avatars/bob_1.webp' WHERE id = ?").run(bob.id);
for (const lang of ['ru', 'en', 'uz', 'kz']) {
  await subscribePush(alice.cookie, lang, 'alice');
}

const postId = Number(
  sqlite.prepare("INSERT INTO posts (user_id, image_key, caption) VALUES (?, 'posts/alice_sunset.webp', 'Sunset in mountains')").run(alice.id).lastInsertRowid,
);

capturedPushes.length = 0;
const likeRes = await worker.fetch(new Request(`${origin}/api/posts/like`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ post_id: postId }),
}), env, ctx);
assert.strictEqual(likeRes.status, 200);
await flushBg();
assert.strictEqual(capturedPushes.length, 4);
const likeRu = capturedPushes.find((p) => p.lang === 'ru').payload;
const likeEn = capturedPushes.find((p) => p.lang === 'en').payload;
assert.strictEqual(likeRu.title, 'Bob Builder (@bob)');
assert.ok(likeRu.body.includes('Понравилась ваша публикация') && likeRu.body.includes('Sunset in mountains'));
assert.strictEqual(likeRu.icon, '/media/avatars%2Fbob_1.webp');
assert.strictEqual(likeRu.image, '/media/posts%2Falice_sunset.webp?v=thumb');
assert.strictEqual(likeRu.url, `/u/alice?post=${postId}`);
assert.ok(likeEn.body.includes('Liked your post'));
console.log('3. Instagram-style Like push (actor title, caption, avatar icon, post thumb, deep link, 4 langs) PASSED');

capturedPushes.length = 0;
const commRes = await worker.fetch(new Request(`${origin}/api/posts/comment`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ post_id: postId, content: 'Amazing shot!' }),
}), env, ctx);
assert.strictEqual(commRes.status, 201);
const commJson = await commRes.json();
await flushBg();
assert.strictEqual(capturedPushes.length, 4);
const commRu = capturedPushes.find((p) => p.lang === 'ru').payload;
assert.strictEqual(commRu.title, 'Bob Builder (@bob)');
assert.strictEqual(commRu.body, 'Прокомментировал(-а): «Amazing shot!»');
assert.strictEqual(commRu.icon, '/media/avatars%2Fbob_1.webp');
assert.strictEqual(commRu.image, '/media/posts%2Falice_sunset.webp?v=thumb');
assert.strictEqual(commRu.url, `/u/alice?post=${postId}`);
console.log('4. Instagram-style Comment push PASSED');

const aliceCommRes = await worker.fetch(new Request(`${origin}/api/posts/comment`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: alice.cookie },
  body: JSON.stringify({ post_id: postId, content: 'Thanks!' }),
}), env, ctx);
assert.strictEqual(aliceCommRes.status, 201);
const aliceCommJson = await aliceCommRes.json();
const aliceCommentId = Number(aliceCommJson.comment?.id || 0);
assert.ok(aliceCommentId > 0);
await flushBg();

sqlite.prepare("DELETE FROM auth_rate_limits WHERE key LIKE 'comment:%' OR key LIKE 'push:notif:%'").run();
capturedPushes.length = 0;
const replyRes = await worker.fetch(new Request(`${origin}/api/posts/comment`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ post_id: postId, parent_id: aliceCommentId, content: 'You are welcome!' }),
}), env, ctx);
assert.strictEqual(replyRes.status, 201);
await flushBg();
const replyRu = capturedPushes.find((p) => p.lang === 'ru' && p.payload.kind === 'comment_reply').payload;
assert.strictEqual(replyRu.title, 'Bob Builder (@bob)');
assert.strictEqual(replyRu.body, 'Ответил(-а) на ваш комментарий: «You are welcome!»');
assert.strictEqual(replyRu.url, `/u/alice?post=${postId}`);

capturedPushes.length = 0;
const clikeRes = await worker.fetch(new Request(`${origin}/api/posts/comment/like`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ comment_id: aliceCommentId }),
}), env, ctx);
assert.strictEqual(clikeRes.status, 200);
await flushBg();
const clikeRu = capturedPushes.find((p) => p.lang === 'ru' && p.payload.kind === 'comment_like').payload;
assert.strictEqual(clikeRu.title, 'Bob Builder (@bob)');
assert.strictEqual(clikeRu.body, 'Понравился ваш комментарий: «Thanks!»');
assert.strictEqual(clikeRu.image, '/media/posts%2Falice_sunset.webp?v=thumb');
console.log('4b. Instagram-style Comment Reply & Comment Like pushes PASSED');

capturedPushes.length = 0;
const folRes = await worker.fetch(new Request(`${origin}/api/users/follow`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: charlie.cookie },
  body: JSON.stringify({ following_id: alice.id }),
}), env, ctx);
assert.strictEqual(folRes.status, 200);
await flushBg();
assert.strictEqual(capturedPushes.length, 4);
const folRu = capturedPushes.find((p) => p.lang === 'ru').payload;
assert.strictEqual(folRu.title, '@charlie');
assert.strictEqual(folRu.body, 'Подписался(-ась) на ваши обновления');
assert.strictEqual(folRu.icon, undefined, 'Actor without avatar must NOT send icon');
assert.strictEqual(folRu.image, undefined);
assert.strictEqual(folRu.url, '/u/charlie');
console.log('5. Instagram-style Follow push (no duplicate icon when avatar absent, profile deep link) PASSED');

const dummyKey = Buffer.alloc(33, 5); dummyKey[0] = 0x05;
const dummySpk = Buffer.alloc(33, 6); dummySpk[0] = 0x05;
const dummySig = Buffer.alloc(64, 7);
for (const u of [alice, bob]) {
  sqlite.prepare(`
    INSERT INTO e2ee_devices (
      user_id, device_id, registration_id, identity_key_pub,
      signed_prekey_id, signed_prekey_pub, signed_prekey_sig,
      signing_key_pub, signing_key_binding_sig, approval_status, trust_origin, is_primary
    ) VALUES (?, 1, 100, ?, 1, ?, ?, '', '', 'approved', 'first_device', 1)
  `).run(u.id, dummyKey.toString('base64'), dummySpk.toString('base64'), dummySig.toString('base64'));
}

const envPayload = [
  { u: alice.id, d: 1, t: 3, b: Buffer.from('ciphertext-for-alice').toString('base64') },
  { u: bob.id, d: 1, t: 3, b: Buffer.from('ciphertext-for-bob').toString('base64') },
];

capturedPushes.length = 0;
const dm1Res = await worker.fetch(new Request(`${origin}/api/messages/send`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ target_user_id: alice.id, sender_device_id: 1, envelopes: envPayload }),
}), env, ctx);
assert.strictEqual(dm1Res.status, 201);
const dm1Json = await dm1Res.json();
await flushBg();
assert.strictEqual(capturedPushes.length, 4);
const dm1Ru = capturedPushes.find((p) => p.lang === 'ru').payload;
const dm1En = capturedPushes.find((p) => p.lang === 'en').payload;
const dm1Uz = capturedPushes.find((p) => p.lang === 'uz').payload;
const dm1Kz = capturedPushes.find((p) => p.lang === 'kz').payload;
assert.strictEqual(dm1Ru.title, 'Bob Builder (@bob)');
assert.strictEqual(dm1Ru.body, 'Отправил(-а) вам сообщение');
assert.strictEqual(dm1En.body, 'Sent you a message');
assert.strictEqual(dm1Uz.body, 'Sizga xabar yubordi');
assert.strictEqual(dm1Kz.body, 'Сізге хабарлама жіберді');
assert.strictEqual(dm1Ru.icon, '/media/avatars%2Fbob_1.webp');
assert.strictEqual(dm1Ru.image, undefined);
assert.strictEqual(dm1Ru.url, '/messages/bob');

sqlite.prepare("DELETE FROM auth_rate_limits WHERE key LIKE 'push:dm:%'").run();
capturedPushes.length = 0;
const dm2Res = await worker.fetch(new Request(`${origin}/api/messages/send`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ conversation_id: dm1Json.conversation_id, sender_device_id: 1, envelopes: envPayload }),
}), env, ctx);
assert.strictEqual(dm2Res.status, 201);
await flushBg();
const dm2Ru = capturedPushes.find((p) => p.lang === 'ru').payload;
assert.strictEqual(dm2Ru.body, 'Отправил(-а) вам 2 сообщения');

sqlite.prepare("DELETE FROM auth_rate_limits WHERE key LIKE 'push:dm:%'").run();
capturedPushes.length = 0;
const dmShareRes = await worker.fetch(new Request(`${origin}/api/messages/send`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ conversation_id: dm1Json.conversation_id, sender_device_id: 1, shared_post_id: postId, envelopes: envPayload }),
}), env, ctx);
assert.strictEqual(dmShareRes.status, 201);
await flushBg();
const dmShareRu = capturedPushes.find((p) => p.lang === 'ru').payload;
assert.strictEqual(dmShareRu.body, 'Поделился(-лась) публикацией');
assert.strictEqual(dmShareRu.image, '/media/posts%2Falice_sunset.webp?v=thumb');

capturedPushes.length = 0;
const reactRes = await worker.fetch(new Request(`${origin}/api/messages/react`, {
  method: 'POST',
  headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', Cookie: bob.cookie },
  body: JSON.stringify({ message_id: dm1Json.message.id, emoji: '❤️' }),
}), env, ctx);
assert.strictEqual(reactRes.status, 200);
await flushBg();
const reactRu = capturedPushes.find((p) => p.lang === 'ru').payload;
assert.strictEqual(reactRu.title, 'Bob Builder (@bob)');
assert.strictEqual(reactRu.body, 'Отреагировал(-а) ❤️ на ваше сообщение');
assert.strictEqual(reactRu.icon, '/media/avatars%2Fbob_1.webp');
console.log('6. Instagram-style E2EE DM (single, multi-unread, shared post, reaction) pushes across 4 langs PASSED');

globalThis.fetch = origFetch;

const swListeners = {};
const shownNotifs = [];
const openedUrls = [];
let mockClients = [];
const swSandbox = {
  URL,
  Date,
  Promise,
  Response,
  Request,
  caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], delete: async () => {}, match: async () => null },
  fetch: async () => new Response('ok', { status: 200 }),
  self: null,
};
swSandbox.self = {
  location: { origin },
  skipWaiting() {},
  clients: {
    claim: async () => {},
    matchAll: async () => mockClients,
    openWindow: async (u) => { openedUrls.push(u); },
  },
  registration: {
    showNotification: async (title, opts) => { shownNotifs.push({ title, opts }); },
  },
  addEventListener(type, fn) { swListeners[type] = fn; },
};
vm.runInNewContext(swFile, swSandbox);

async function dispatchSwPush(payload, clients) {
  mockClients = clients;
  shownNotifs.length = 0;
  let p = null;
  swListeners.push({
    data: { json: () => payload, text: () => JSON.stringify(payload) },
    waitUntil(prom) { p = prom; },
  });
  await p;
  return [...shownNotifs];
}

const offlineNotifs = await dispatchSwPush(
  { title: '@charlie', body: 'Подписался(-ась) на ваши обновления', url: '/u/charlie', tag: 'f1' },
  [],
);
assert.strictEqual(offlineNotifs.length, 1);
assert.strictEqual(offlineNotifs[0].opts.badge, '/push-badge.svg');
assert.strictEqual(offlineNotifs[0].opts.icon, undefined, 'Must NOT render second Photogram logo');
assert.strictEqual(offlineNotifs[0].opts.image, undefined);

const lockedNotifs = await dispatchSwPush(
  {
    title: 'Bob Builder (@bob)',
    body: 'Отправил(-а) вам сообщение',
    url: '/messages/bob',
    tag: 'dm-1',
    icon: '/media/avatars%2Fbob_1.webp',
    image: '/media/posts%2Falice_sunset.webp?v=thumb',
  },
  [{ focused: true, visibilityState: 'hidden' }],
);
assert.strictEqual(lockedNotifs.length, 1, 'Locked/hidden tab must STILL show push');
assert.strictEqual(lockedNotifs[0].opts.badge, '/push-badge.svg');
assert.strictEqual(lockedNotifs[0].opts.icon, '/media/avatars%2Fbob_1.webp');
assert.strictEqual(lockedNotifs[0].opts.image, '/media/posts%2Falice_sunset.webp?v=thumb');

const fgNotifs = await dispatchSwPush(
  { title: 'Bob', body: 'hi', url: '/messages/bob' },
  [{ focused: true, visibilityState: 'visible' }],
);
assert.strictEqual(fgNotifs.length, 0, 'Focused visible foreground app should suppress duplicate OS push');

const evilNotifs = await dispatchSwPush(
  {
    title: 'Attacker',
    body: 'test',
    url: 'https://evil.com/phish',
    icon: 'https://evil.com/track.png',
    image: '/media/dm/1/private.enc',
  },
  [],
);
assert.strictEqual(evilNotifs.length, 1);
assert.strictEqual(evilNotifs[0].opts.icon, undefined, 'External icon URL must be rejected');
assert.strictEqual(evilNotifs[0].opts.image, undefined, 'Private /media/dm/ image URL must be rejected');

openedUrls.length = 0;
mockClients = [];
let clickP = null;
swListeners.notificationclick({
  notification: { close() {}, data: { url: 'https://evil.com/phish' } },
  waitUntil(p) { clickP = p; },
});
await clickP;
assert.deepStrictEqual(openedUrls, ['/'], 'External click URL must sanitize to /');

openedUrls.length = 0;
swListeners.notificationclick({
  notification: { close() {}, data: { url: `/u/alice?post=${postId}` } },
  waitUntil(p) { clickP = p; },
});
await clickP;
assert.deepStrictEqual(openedUrls, [`/u/alice?post=${postId}`], 'Deep link click URL must open exact post');

console.log('7. Service Worker offline/lockscreen/foreground/security & zero-duplicate-logo tests PASSED');
console.log('ALL_PUSH_TESTS_PASSED');
