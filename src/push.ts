import { Env } from './types';
import { getUserFromRequest, getDeviceSessionUserIds } from './auth';
import { detectLanguage, getTranslations, normalizeLang, Translations } from './languages';
import { consumeRateLimitAtomic, readJsonWithLimit } from './security';

const MAX_SUBSCRIPTIONS_PER_USER = 5;
const ALLOWED_PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
  'push.samsungosp.com',
  'push.opera.com',
  'webpush.yandex.net',
];

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

async function hkdfSha256(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const realSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const prk = await hmacSha256(realSalt, ikm);
  const okm = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
  return okm.slice(0, length);
}

export async function encryptWebPushPayload(
  payloadJson: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const te = new TextEncoder();
  const uaPublicBytes = base64UrlDecode(p256dhB64);
  const authSecretBytes = base64UrlDecode(authB64);
  if (uaPublicBytes.length !== 65 || uaPublicBytes[0] !== 0x04 || authSecretBytes.length !== 16) {
    throw new Error('Invalid subscription keys');
  }

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const asKeyPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;

  const asPublicRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', asKeyPair.publicKey)) as ArrayBuffer,
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      asKeyPair.privateKey,
      256,
    ),
  );

  const keyInfo = concatBytes(te.encode('WebPush: info\0'), uaPublicBytes, asPublicRaw);
  const ikm = await hkdfSha256(authSecretBytes, sharedSecret, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdfSha256(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfSha256(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  const plaintext = concatBytes(te.encode(payloadJson), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext),
  );

  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, rsBytes, new Uint8Array([asPublicRaw.length]), asPublicRaw);

  return concatBytes(header, ciphertext);
}

export async function buildVapidAuthHeader(
  endpoint: string,
  publicKeyB64: string,
  privateKeyD: string,
  subject: string,
): Promise<string> {
  const te = new TextEncoder();
  const pubBytes = base64UrlDecode(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID public key');
  }
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: privateKeyD },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;
  const headerB64 = base64UrlEncode(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = base64UrlEncode(te.encode(JSON.stringify({ aud, exp, sub: subject })));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    te.encode(unsigned),
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));
  return `vapid t=${unsigned}.${sigB64}, k=${publicKeyB64}`;
}

export function isAllowedPushEndpoint(raw: string): boolean {
  if (!raw || raw.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.port !== '' || parsed.username !== '' || parsed.password !== '') return false;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    return false;
  }
  return ALLOWED_PUSH_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

export interface PushPayload {
  kind: 'dm' | 'dm_reaction' | 'like' | 'comment' | 'comment_like' | 'comment_reply' | 'follow' | 'mention';
  title: string;
  body: string;
  url: string;
  tag: string;
  icon?: string;
  image?: string;
  ts?: number;
}

export function formatPushActorTitle(displayName: string | null | undefined, username: string): string {
  const uname = String(username || '').trim();
  const dname = String(displayName || '').trim();
  if (dname && uname && dname.toLowerCase() !== uname.toLowerCase()) {
    return `${dname} (@${uname})`.slice(0, 80);
  }
  return uname ? `@${uname}` : 'Photogram';
}

export function safePushAvatarUrl(avatarKey: string | null | undefined): string | undefined {
  const k = String(avatarKey || '').trim();
  if (!k || !k.startsWith('avatars/') || k.includes('..') || k.includes('\\') || /[\x00-\x1f\x7f]/.test(k)) {
    return undefined;
  }
  return `/media/${encodeURIComponent(k)}`;
}

export function safePushPostThumbUrl(imageKey: string | null | undefined): string | undefined {
  const k = String(imageKey || '').trim();
  if (!k || !k.startsWith('posts/') || k.includes('..') || k.includes('\\') || /[\x00-\x1f\x7f]/.test(k)) {
    return undefined;
  }
  const base = `/media/${encodeURIComponent(k)}`;
  return k.endsWith('.webp') && !k.endsWith('_thumb.webp') && !k.endsWith('_full.webp')
    ? `${base}?v=thumb`
    : base;
}

export type PushPayloadSource = PushPayload | ((t: Translations) => PushPayload);

export async function sendPushToUser(
  env: Env,
  recipientUserId: number,
  payload: PushPayloadSource,
): Promise<void> {
  try {
    const pubKey = (env.VAPID_PUBLIC_KEY || '').trim();
    const privKey = (env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (env.VAPID_SUBJECT || 'mailto:admin@photogramapp.pages.dev').trim();
    if (!pubKey || !privKey) return;

    const pref = await env.DB.prepare('SELECT notifications_enabled FROM users WHERE id = ?')
      .bind(recipientUserId)
      .first<{ notifications_enabled?: number | boolean }>();

    if (!pref || pref.notifications_enabled === 0 || pref.notifications_enabled === false) {
      return;
    }

    const subsRes = await env.DB.prepare(
      'SELECT id, endpoint, p256dh, auth, lang FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
    )
      .bind(recipientUserId, MAX_SUBSCRIPTIONS_PER_USER)
      .all<{ id: number; endpoint: string; p256dh: string; auth: string; lang?: string | null }>();

    const subs = subsRes.results || [];
    if (subs.length === 0) return;

    const jsonByLang = new Map<string, string>();
    const payloadJsonFor = (rawLang: string | null | undefined): string => {
      const lang = normalizeLang(rawLang) || 'ru';
      const cached = jsonByLang.get(lang);
      if (cached) return cached;
      const resolved = typeof payload === 'function' ? payload(getTranslations(lang)) : payload;
      const json = JSON.stringify(resolved);
      jsonByLang.set(lang, json);
      return json;
    };

    await Promise.all(
      subs.map(async (sub) => {
        if (!isAllowedPushEndpoint(sub.endpoint)) return;
        try {
          const payloadJson = payloadJsonFor(sub.lang);
          const encrypted = await encryptWebPushPayload(payloadJson, sub.p256dh, sub.auth);
          const authHeader = await buildVapidAuthHeader(sub.endpoint, pubKey, privKey, subject);
          const res = await fetch(sub.endpoint, {
            method: 'POST',
            redirect: 'manual',
            signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
              ? AbortSignal.timeout(4000)
              : undefined,
            headers: {
              Authorization: authHeader,
              'Content-Encoding': 'aes128gcm',
              'Content-Type': 'application/octet-stream',
              TTL: '86400',
              Urgency: 'high',
            },
            body: encrypted,
          });
          if (res.status === 404 || res.status === 410) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
          }
        } catch {}
      }),
    );
  } catch {}
}

export async function handleGetVapidKey(env: Env): Promise<Response> {
  const pubKey = (env.VAPID_PUBLIC_KEY || '').trim();
  return new Response(JSON.stringify({ enabled: Boolean(pubKey), public_key: pubKey }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `push:sub:${user.id}`, 20, 3600);
  if (!allowed) return jsonError(t.common.networkError, 429);

  const parsed = await readJsonWithLimit<{ endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }>(
    request,
    8192,
  );
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';

  if (!isAllowedPushEndpoint(endpoint)) {
    return jsonError(t.common.networkError, 400);
  }

  try {
    const pubBytes = base64UrlDecode(p256dh);
    const authBytes = base64UrlDecode(auth);
    if (pubBytes.length !== 65 || pubBytes[0] !== 0x04 || authBytes.length !== 16) {
      return jsonError(t.common.networkError, 400);
    }
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const existingSub = await env.DB.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?')
    .bind(endpoint)
    .first<{ user_id: number }>();

  if (existingSub && Number(existingSub.user_id) !== Number(user.id)) {
    const deviceUserIds = await getDeviceSessionUserIds(env, request);
    if (!deviceUserIds.has(Number(existingSub.user_id))) {
      return jsonError(t.common.networkError, 409);
    }
  }

  const subLang = detectLanguage(request);
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, lang, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(endpoint) DO UPDATE SET user_id = ?, p256dh = ?, auth = ?, lang = ?, updated_at = datetime('now')`,
  )
    .bind(user.id, endpoint, p256dh, auth, subLang, user.id, p256dh, auth, subLang)
    .run();

  const allSubs = await env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC, id DESC',
  )
    .bind(user.id)
    .all<{ id: number }>();

  const ids = (allSubs.results || []).map((r) => Number(r.id));
  if (ids.length > MAX_SUBSCRIPTIONS_PER_USER) {
    const stale = ids.slice(MAX_SUBSCRIPTIONS_PER_USER);
    for (const staleId of stale) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(staleId).run();
    }
  }

  return jsonResponse({ success: true }, 200);
}

export async function handlePushUnsubscribe(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `push:unsub:${user.id}`, 30, 3600);
  if (!allowed) return jsonError(t.common.networkError, 429);

  let endpoint = '';
  const parsed = await readJsonWithLimit<{ endpoint?: unknown }>(request, 4096);
  if (parsed.ok && typeof parsed.data?.endpoint === 'string') {
    endpoint = parsed.data.endpoint.trim();
  }

  if (endpoint) {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .bind(user.id, endpoint)
      .run();
  } else {
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
      .bind(user.id)
      .run();
  }

  return jsonResponse({ success: true }, 200);
}
