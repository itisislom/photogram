import { Env } from './types';
import { getUserFromRequest } from './auth';
import { detectLanguage, getTranslations } from './languages';

const MAX_DEVICES_PER_USER = 5;
const MAX_PREKEYS_BATCH = 100;
const MAX_PREKEYS_PER_DEVICE = 120;
const REGISTER_LIMIT_PER_HOUR = 30;
const BUNDLE_LIMIT_PER_MIN = 60;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function decodeBase64Strict(b64: string): Uint8Array | null {
  if (typeof b64 !== 'string' || b64.length < 4 || b64.length > 512) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function isValidSignalPublicKey(b64: string): boolean {
  const bytes = decodeBase64Strict(b64);
  if (!bytes) return false;
  return (bytes.length === 33 && bytes[0] === 0x05) || bytes.length === 32;
}

function isValidSignature(b64: string): boolean {
  const bytes = decodeBase64Strict(b64);
  return Boolean(bytes && bytes.length === 64);
}

async function consumeRateLimit(
  env: Env,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'SELECT attempts, locked_until, updated_at FROM auth_rate_limits WHERE key = ?',
  )
    .bind(key)
    .first<{ attempts: number; locked_until: number; updated_at: number }>();

  let attempts = 1;
  let updatedAt = now;
  if (row && now - row.updated_at < windowSeconds) {
    attempts = row.attempts + 1;
    updatedAt = row.updated_at;
    if (attempts > maxAttempts) return false;
  }

  await env.DB.prepare(
    'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = 0, updated_at = ?',
  )
    .bind(key, attempts, updatedAt, attempts, updatedAt)
    .run();

  return true;
}

interface IncomingPreKey {
  key_id?: unknown;
  public_key?: unknown;
}

function validatePreKeyList(raw: unknown): Array<{ key_id: number; public_key: string }> | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_PREKEYS_BATCH) return null;
  const out: Array<{ key_id: number; public_key: string }> = [];
  const seen = new Set<number>();
  for (const item of raw as IncomingPreKey[]) {
    const keyId = Number(item?.key_id);
    const pubKey = typeof item?.public_key === 'string' ? item.public_key.trim() : '';
    if (!Number.isInteger(keyId) || keyId <= 0 || keyId > 2147483647) return null;
    if (seen.has(keyId)) continue;
    if (!isValidSignalPublicKey(pubKey)) return null;
    seen.add(keyId);
    out.push({ key_id: keyId, public_key: pubKey });
  }
  return out;
}

export async function handleRegisterE2eeKeys(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimit(env, `e2ee:reg:${user.id}`, REGISTER_LIMIT_PER_HOUR, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  let body: {
    device_id?: unknown;
    registration_id?: unknown;
    identity_key_pub?: unknown;
    signed_prekey?: { key_id?: unknown; public_key?: unknown; signature?: unknown };
    prekeys?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const deviceId = Number(body?.device_id);
  const registrationId = Number(body?.registration_id);
  const identityKeyPub = typeof body?.identity_key_pub === 'string' ? body.identity_key_pub.trim() : '';
  const spkId = Number(body?.signed_prekey?.key_id);
  const spkPub = typeof body?.signed_prekey?.public_key === 'string' ? body.signed_prekey.public_key.trim() : '';
  const spkSig = typeof body?.signed_prekey?.signature === 'string' ? body.signed_prekey.signature.trim() : '';

  if (!Number.isInteger(deviceId) || deviceId <= 0 || deviceId > 2147483647) {
    return jsonError(t.common.networkError, 400);
  }
  if (!Number.isInteger(registrationId) || registrationId <= 0 || registrationId > 16380) {
    return jsonError(t.common.networkError, 400);
  }
  if (!isValidSignalPublicKey(identityKeyPub)) {
    return jsonError(t.common.networkError, 400);
  }
  if (!Number.isInteger(spkId) || spkId <= 0 || spkId > 2147483647) {
    return jsonError(t.common.networkError, 400);
  }
  if (!isValidSignalPublicKey(spkPub) || !isValidSignature(spkSig)) {
    return jsonError(t.common.networkError, 400);
  }

  const prekeys = body?.prekeys !== undefined ? validatePreKeyList(body.prekeys) : [];
  if (prekeys === null) {
    return jsonError(t.common.networkError, 400);
  }

  await env.DB.prepare(
    `INSERT INTO e2ee_devices (
       user_id, device_id, registration_id, identity_key_pub,
       signed_prekey_id, signed_prekey_pub, signed_prekey_sig, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, device_id) DO UPDATE SET
       registration_id = ?,
       identity_key_pub = ?,
       signed_prekey_id = ?,
       signed_prekey_pub = ?,
       signed_prekey_sig = ?,
       updated_at = datetime('now')`,
  )
    .bind(
      user.id,
      deviceId,
      registrationId,
      identityKeyPub,
      spkId,
      spkPub,
      spkSig,
      registrationId,
      identityKeyPub,
      spkId,
      spkPub,
      spkSig,
    )
    .run();

  const allDevices = await env.DB.prepare(
    'SELECT device_id FROM e2ee_devices WHERE user_id = ? ORDER BY updated_at DESC, id DESC',
  )
    .bind(user.id)
    .all<{ device_id: number }>();

  const devList = (allDevices.results || []).map((r) => Number(r.device_id));
  if (devList.length > MAX_DEVICES_PER_USER) {
    const stale = devList.slice(MAX_DEVICES_PER_USER);
    for (const staleDevId of stale) {
      await env.DB.prepare('DELETE FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
        .bind(user.id, staleDevId)
        .run();
      await env.DB.prepare('DELETE FROM e2ee_devices WHERE user_id = ? AND device_id = ?')
        .bind(user.id, staleDevId)
        .run();
    }
  }

  for (const pk of prekeys) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO e2ee_prekeys (user_id, device_id, key_id, public_key) VALUES (?, ?, ?, ?)',
    )
      .bind(user.id, deviceId, pk.key_id, pk.public_key)
      .run();
  }

  const cntRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ cnt: number }>();

  return jsonResponse(
    {
      success: true,
      device_id: deviceId,
      prekey_count: Number(cntRow?.cnt || 0),
    },
    200,
  );
}

export async function handleUploadPreKeys(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimit(env, `e2ee:pk:${user.id}`, REGISTER_LIMIT_PER_HOUR, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  let body: { device_id?: unknown; prekeys?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const deviceId = Number(body?.device_id);
  if (!Number.isInteger(deviceId) || deviceId <= 0 || deviceId > 2147483647) {
    return jsonError(t.common.networkError, 400);
  }

  const exists = await env.DB.prepare(
    'SELECT id FROM e2ee_devices WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ id: number }>();
  if (!exists) return jsonError(t.common.networkError, 404);

  const prekeys = validatePreKeyList(body?.prekeys);
  if (!prekeys || prekeys.length === 0) {
    return jsonError(t.common.networkError, 400);
  }

  const curRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ cnt: number }>();
  const currentCount = Number(curRow?.cnt || 0);
  const canInsert = Math.max(0, MAX_PREKEYS_PER_DEVICE - currentCount);

  for (const pk of prekeys.slice(0, canInsert)) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO e2ee_prekeys (user_id, device_id, key_id, public_key) VALUES (?, ?, ?, ?)',
    )
      .bind(user.id, deviceId, pk.key_id, pk.public_key)
      .run();
  }

  await env.DB.prepare(
    "UPDATE e2ee_devices SET updated_at = datetime('now') WHERE user_id = ? AND device_id = ?",
  )
    .bind(user.id, deviceId)
    .run();

  const nextRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ cnt: number }>();

  return jsonResponse({ success: true, prekey_count: Number(nextRow?.cnt || 0) }, 200);
}

export async function handlePreKeyCount(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const deviceId = parseInt(url.searchParams.get('device_id') || '0', 10);
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    return jsonResponse({ user_id: user.id, registered: false, prekey_count: 0 }, 200);
  }

  const dev = await env.DB.prepare(
    'SELECT id FROM e2ee_devices WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ id: number }>();

  if (!dev) {
    return jsonResponse({ user_id: user.id, registered: false, prekey_count: 0 }, 200);
  }

  const cntRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ cnt: number }>();

  return jsonResponse({ user_id: user.id, registered: true, prekey_count: Number(cntRow?.cnt || 0) }, 200);
}

interface DeviceRow {
  device_id: number;
  registration_id: number;
  identity_key_pub: string;
  signed_prekey_id: number;
  signed_prekey_pub: string;
  signed_prekey_sig: string;
}

async function claimDeviceBundles(
  env: Env,
  targetUserId: number,
  excludeDeviceId: number = 0,
): Promise<
  Array<{
    user_id: number;
    device_id: number;
    registration_id: number;
    identity_key_pub: string;
    signed_prekey: { key_id: number; public_key: string; signature: string };
    prekey: { key_id: number; public_key: string } | null;
  }>
> {
  const devRes = await env.DB.prepare(
    `SELECT device_id, registration_id, identity_key_pub, signed_prekey_id, signed_prekey_pub, signed_prekey_sig
     FROM e2ee_devices
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
  )
    .bind(targetUserId, MAX_DEVICES_PER_USER)
    .all<DeviceRow>();

  const devices = (devRes.results || []).filter((d) => Number(d.device_id) !== excludeDeviceId);
  const bundles = [];

  for (const d of devices) {
    const devId = Number(d.device_id);
    const opk = await env.DB.prepare(
      'SELECT id, key_id, public_key FROM e2ee_prekeys WHERE user_id = ? AND device_id = ? ORDER BY id ASC LIMIT 1',
    )
      .bind(targetUserId, devId)
      .first<{ id: number; key_id: number; public_key: string }>();

    if (opk) {
      await env.DB.prepare('DELETE FROM e2ee_prekeys WHERE id = ?').bind(opk.id).run();
    }

    bundles.push({
      user_id: targetUserId,
      device_id: devId,
      registration_id: Number(d.registration_id),
      identity_key_pub: d.identity_key_pub,
      signed_prekey: {
        key_id: Number(d.signed_prekey_id),
        public_key: d.signed_prekey_pub,
        signature: d.signed_prekey_sig,
      },
      prekey: opk ? { key_id: Number(opk.key_id), public_key: opk.public_key } : null,
    });
  }

  return bundles;
}

export async function handleGetKeyBundle(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimit(env, `e2ee:bundle:${user.id}`, BUNDLE_LIMIT_PER_MIN, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const targetUserId = parseInt(url.searchParams.get('user_id') || '0', 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const targetExists = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(targetUserId)
    .first<{ id: number }>();
  if (!targetExists) return jsonError(t.explore.noResults, 404);

  const includeSelf = url.searchParams.get('include_self') === '1';
  const excludeDeviceId = parseInt(url.searchParams.get('self_device_id') || '0', 10) || 0;

  const devices = await claimDeviceBundles(env, targetUserId, 0);
  const selfDevices =
    includeSelf && targetUserId !== user.id
      ? await claimDeviceBundles(env, user.id, excludeDeviceId)
      : [];

  return jsonResponse(
    {
      success: true,
      user_id: targetUserId,
      devices,
      self_devices: selfDevices,
    },
    200,
  );
}

export async function handleGetIdentities(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const targetUserId = parseInt(url.searchParams.get('user_id') || '0', 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const res = await env.DB.prepare(
    'SELECT device_id, identity_key_pub, updated_at FROM e2ee_devices WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
  )
    .bind(targetUserId, MAX_DEVICES_PER_USER)
    .all<{ device_id: number; identity_key_pub: string; updated_at: string }>();

  return jsonResponse(
    {
      success: true,
      user_id: targetUserId,
      devices: (res.results || []).map((r) => ({
        device_id: Number(r.device_id),
        identity_key_pub: r.identity_key_pub,
        updated_at: r.updated_at,
      })),
    },
    200,
  );
}
