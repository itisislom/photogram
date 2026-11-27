import { Env } from './types';
import { getSessionHashFromRequest, getUserFromRequest, verifyPassword } from './auth';
import { detectLanguage, getTranslations } from './languages';
import { consumeRateLimitAtomic, parsePositiveId, readJsonWithLimit } from './security';
import { emitUserEvent, revokeUserRealtimeSessions } from './realtime';

const MAX_DEVICES_PER_USER = 5;
const MAX_PENDING_DEVICES_PER_USER = 5;
const MAX_PREKEYS_BATCH = 100;
const MAX_PREKEYS_PER_DEVICE = 120;
const REGISTER_LIMIT_PER_HOUR = 30;
const BUNDLE_LIMIT_PER_MIN = 20;
const BUNDLE_PAIR_LIMIT_PER_5MIN = 6;
const IDENTITIES_LIMIT_PER_MIN = 120;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface SignedDeviceListEntry {
  device_id: number;
  identity_key_pub: string;
  signing_key_pub: string;
}

interface DeviceListRow {
  user_id: number;
  list_version: number;
  signer_device_id: number;
  device_list_json: string;
  ecdsa_signature: string;
  signal_signature: string;
  is_recovery_reset: number;
  updated_at: string;
}

interface DeviceRow {
  device_id: number;
  registration_id: number;
  identity_key_pub: string;
  signed_prekey_id: number;
  signed_prekey_pub: string;
  signed_prekey_sig: string;
  signing_key_pub: string;
  signing_key_binding_sig: string;
  approval_status: string;
  trust_origin: string;
  is_primary: number;
  device_label: string;
  approved_by_device_id: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function jsonError(message: string, status: number, code?: string): Response {
  return jsonResponse(code ? { error: message, code } : { error: message }, status);
}

function decodeBase64Strict(b64: string, maxLen = 512): Uint8Array | null {
  if (typeof b64 !== 'string' || b64.length < 4 || b64.length > maxLen) return null;
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

function isValidSpkiEcdsaPub(b64: string): boolean {
  const bytes = decodeBase64Strict(b64, 256);
  return Boolean(bytes && bytes.length >= 64 && bytes.length <= 128);
}

function randomHex(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeDeviceLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function parseUtcTimestampMs(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const s = raw.trim();
  const normalized = s.includes('T') || s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : 0;
}

export function buildApprovalChallengeMsg(
  userId: number,
  approverDeviceId: number,
  targetDeviceId: number,
  targetIdentityKeyPub: string,
  targetSigningKeyPub: string,
  nonce: string,
  challengeId: string,
): string {
  return `pg-e2ee-approve-v1|${userId}|${approverDeviceId}|${targetDeviceId}|${targetIdentityKeyPub}|${targetSigningKeyPub}|${nonce}|${challengeId}`;
}

export function buildDeviceListCanonicalMsg(
  userId: number,
  listVersion: number,
  isRecoveryReset: boolean,
  devices: SignedDeviceListEntry[],
): string {
  const sorted = [...devices].sort((a, b) => a.device_id - b.device_id);
  const body = sorted
    .map((d) => `${d.device_id}:${d.identity_key_pub}:${d.signing_key_pub}`)
    .join(',');
  return `pg-e2ee-devlist-v1|${userId}|${listVersion}|${isRecoveryReset ? 1 : 0}|${body}`;
}

export function buildUnregisterDeviceMsg(
  userId: number,
  deviceId: number,
  timestamp: number,
): string {
  return `pg-e2ee-unreg-v1|${userId}|${deviceId}|${timestamp}`;
}

function batchRowCount(item: unknown): number {
  if (Array.isArray(item)) return item.length;
  if (item && typeof item === 'object') {
    const obj = item as { results?: unknown[]; meta?: { changes?: number } };
    if (Array.isArray(obj.results)) return obj.results.length;
    if (typeof obj.meta?.changes === 'number') return obj.meta.changes;
  }
  return 0;
}

async function execDbBatch(env: Env, stmts: unknown[]): Promise<unknown[]> {
  return (env.DB as unknown as { batch(queries: unknown[]): Promise<unknown[]> }).batch(stmts);
}

export async function verifyEcdsaP256(
  spkiB64: string,
  message: string,
  sigB64: string,
): Promise<boolean> {
  const spki = decodeBase64Strict(spkiB64, 256);
  const sig = decodeBase64Strict(sigB64, 256);
  if (!spki || !sig || sig.length !== 64) return false;
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength) as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const data = new TextEncoder().encode(message);
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig.buffer.slice(sig.byteOffset, sig.byteOffset + sig.byteLength) as ArrayBuffer,
      data,
    );
  } catch {
    return false;
  }
}

function normalizeDeviceListEntries(raw: unknown): SignedDeviceListEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_DEVICES_PER_USER) return null;
  const out: SignedDeviceListEntry[] = [];
  const seen = new Set<number>();
  for (const item of raw as Array<Record<string, unknown>>) {
    const devId = parsePositiveId(item?.device_id);
    const ik = typeof item?.identity_key_pub === 'string' ? item.identity_key_pub.trim() : '';
    const sk = typeof item?.signing_key_pub === 'string' ? item.signing_key_pub.trim() : '';
    if (!devId || seen.has(devId)) return null;
    if (!isValidSignalPublicKey(ik)) return null;
    if (sk && !isValidSpkiEcdsaPub(sk)) return null;
    seen.add(devId);
    out.push({ device_id: devId, identity_key_pub: ik, signing_key_pub: sk });
  }
  out.sort((a, b) => a.device_id - b.device_id);
  return out;
}

function deviceListsEqual(a: SignedDeviceListEntry[], b: SignedDeviceListEntry[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x.device_id - y.device_id);
  const sb = [...b].sort((x, y) => x.device_id - y.device_id);
  for (let i = 0; i < sa.length; i++) {
    if (
      sa[i].device_id !== sb[i].device_id ||
      sa[i].identity_key_pub !== sb[i].identity_key_pub ||
      sa[i].signing_key_pub !== sb[i].signing_key_pub
    ) {
      return false;
    }
  }
  return true;
}

async function getLatestDeviceList(env: Env, userId: number): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare(
    `SELECT user_id, list_version, signer_device_id, device_list_json, ecdsa_signature, signal_signature, is_recovery_reset, updated_at
     FROM e2ee_device_lists
     WHERE user_id = ?`,
  )
    .bind(userId)
    .first<DeviceListRow>();
  if (!row) return null;
  let devices: SignedDeviceListEntry[] = [];
  try {
    const parsed = JSON.parse(row.device_list_json);
    if (Array.isArray(parsed)) devices = parsed;
  } catch {
    return null;
  }
  return {
    user_id: Number(row.user_id),
    list_version: Number(row.list_version),
    signer_device_id: Number(row.signer_device_id),
    devices,
    ecdsa_signature: row.ecdsa_signature,
    signal_signature: row.signal_signature,
    is_recovery_reset: Number(row.is_recovery_reset) === 1,
    updated_at: row.updated_at,
  };
}

async function upsertDeviceList(
  env: Env,
  userId: number,
  expectedPrevVersion: number,
  nextVersion: number,
  signerDeviceId: number,
  devices: SignedDeviceListEntry[],
  ecdsaSignature: string,
  signalSignature: string,
  isRecoveryReset: boolean,
): Promise<boolean> {
  const json = JSON.stringify([...devices].sort((a, b) => a.device_id - b.device_id));
  const recFlag = isRecoveryReset ? 1 : 0;
  if (expectedPrevVersion === 0) {
    try {
      await env.DB.prepare(
        `INSERT INTO e2ee_device_lists (
           user_id, list_version, signer_device_id, device_list_json,
           ecdsa_signature, signal_signature, is_recovery_reset, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
        .bind(userId, nextVersion, signerDeviceId, json, ecdsaSignature, signalSignature, recFlag)
        .run();
      return true;
    } catch {
      return false;
    }
  }
  const upd = await env.DB.prepare(
    `UPDATE e2ee_device_lists
     SET list_version = ?,
         signer_device_id = ?,
         device_list_json = ?,
         ecdsa_signature = ?,
         signal_signature = ?,
         is_recovery_reset = ?,
         updated_at = datetime('now')
     WHERE user_id = ? AND list_version = ?`,
  )
    .bind(nextVersion, signerDeviceId, json, ecdsaSignature, signalSignature, recFlag, userId, expectedPrevVersion)
    .run();
  return Number(upd?.meta?.changes || 0) === 1;
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

async function insertPreKeysBatch(
  env: Env,
  userId: number,
  deviceId: number,
  prekeys: Array<{ key_id: number; public_key: string }>,
): Promise<void> {
  if (prekeys.length === 0) return;
  const placeholders: string[] = [];
  const params: unknown[] = [];
  for (const pk of prekeys) {
    placeholders.push('(?, ?, ?, ?)');
    params.push(userId, deviceId, pk.key_id, pk.public_key);
  }
  await env.DB.prepare(
    `INSERT INTO e2ee_prekeys (user_id, device_id, key_id, public_key) VALUES ${placeholders.join(', ')} ON CONFLICT(user_id, device_id, key_id) DO NOTHING`,
  )
    .bind(...params)
    .run();
}

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  return code === '23505' || /unique|duplicate key|constraint failed/i.test(msg);
}

export async function handleRegisterE2eeKeys(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:reg:${user.id}`, REGISTER_LIMIT_PER_HOUR, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    device_id?: unknown;
    registration_id?: unknown;
    identity_key_pub?: unknown;
    signed_prekey?: { key_id?: unknown; public_key?: unknown; signature?: unknown };
    signing_key_pub?: unknown;
    signing_key_binding_sig?: unknown;
    device_label?: unknown;
    prekeys?: unknown;
  }>(request, 65536);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  const deviceId = parsePositiveId(body?.device_id);
  const registrationId = Number(body?.registration_id);
  const identityKeyPub = typeof body?.identity_key_pub === 'string' ? body.identity_key_pub.trim() : '';
  const spkId = parsePositiveId(body?.signed_prekey?.key_id);
  const spkPub = typeof body?.signed_prekey?.public_key === 'string' ? body.signed_prekey.public_key.trim() : '';
  const spkSig = typeof body?.signed_prekey?.signature === 'string' ? body.signed_prekey.signature.trim() : '';
  const signingKeyPub = typeof body?.signing_key_pub === 'string' ? body.signing_key_pub.trim() : '';
  const signingKeyBindingSig =
    typeof body?.signing_key_binding_sig === 'string' ? body.signing_key_binding_sig.trim() : '';
  const deviceLabel = sanitizeDeviceLabel(body?.device_label);

  if (!deviceId) {
    return jsonError(t.common.networkError, 400);
  }
  if (!Number.isInteger(registrationId) || registrationId <= 0 || registrationId > 16380) {
    return jsonError(t.common.networkError, 400);
  }
  if (!isValidSignalPublicKey(identityKeyPub)) {
    return jsonError(t.common.networkError, 400);
  }
  if (!spkId) {
    return jsonError(t.common.networkError, 400);
  }
  if (!isValidSignalPublicKey(spkPub) || !isValidSignature(spkSig)) {
    return jsonError(t.common.networkError, 400);
  }
  if (signingKeyPub && (!isValidSpkiEcdsaPub(signingKeyPub) || !isValidSignature(signingKeyBindingSig))) {
    return jsonError(t.common.networkError, 400);
  }

  const prekeys = body?.prekeys !== undefined ? validatePreKeyList(body.prekeys) : [];
  if (prekeys === null) {
    return jsonError(t.common.networkError, 400);
  }

  const prevDev = await env.DB.prepare(
    `SELECT identity_key_pub, registration_id, signing_key_pub, signing_key_binding_sig, approval_status, trust_origin, is_primary, device_label
     FROM e2ee_devices
     WHERE user_id = ? AND device_id = ?`,
  )
    .bind(user.id, deviceId)
    .first<{
      identity_key_pub: string;
      registration_id: number;
      signing_key_pub: string;
      signing_key_binding_sig: string;
      approval_status: string;
      trust_origin: string;
      is_primary: number;
      device_label: string;
    }>();

  let approvalStatus = 'pending';
  let trustOrigin = 'pending';
  let isPrimary = 0;

  if (prevDev) {
    const isPrevApproved = prevDev.approval_status === 'approved';
    if (isPrevApproved && prevDev.identity_key_pub !== identityKeyPub) {
      return jsonError(t.common.networkError, 409, 'IDENTITY_MISMATCH');
    }
    if (isPrevApproved && prevDev.signing_key_pub && signingKeyPub && prevDev.signing_key_pub !== signingKeyPub) {
      return jsonError(t.common.networkError, 409, 'SIGNING_KEY_MISMATCH');
    }
    if (prevDev.identity_key_pub !== identityKeyPub || Number(prevDev.registration_id) !== registrationId) {
      await env.DB.prepare('DELETE FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
        .bind(user.id, deviceId)
        .run();
    }

    const nextSigningKeyPub = prevDev.signing_key_pub || signingKeyPub;
    const nextSigningBindingSig = prevDev.signing_key_pub
      ? prevDev.signing_key_binding_sig
      : signingKeyBindingSig;
    const nextLabel = deviceLabel || prevDev.device_label || '';

    await env.DB.prepare(
      `UPDATE e2ee_devices
       SET registration_id = ?,
           identity_key_pub = ?,
           signed_prekey_id = ?,
           signed_prekey_pub = ?,
           signed_prekey_sig = ?,
           signing_key_pub = ?,
           signing_key_binding_sig = ?,
           device_label = ?,
           updated_at = datetime('now')
       WHERE user_id = ? AND device_id = ?`,
    )
      .bind(
        registrationId,
        identityKeyPub,
        spkId,
        spkPub,
        spkSig,
        nextSigningKeyPub,
        nextSigningBindingSig,
        nextLabel,
        user.id,
        deviceId,
      )
      .run();

    approvalStatus = prevDev.approval_status;
    trustOrigin = prevDev.trust_origin;
    isPrimary = Number(prevDev.is_primary) === 1 ? 1 : 0;
  } else {
    const approvedRow = await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'`,
    )
      .bind(user.id)
      .first<{ cnt: number }>();
    const existingApprovedCount = Number(approvedRow?.cnt || 0);

    let insertedAsPrimary = false;
    if (existingApprovedCount === 0) {
      try {
        await env.DB.prepare(
          `INSERT INTO e2ee_devices (
             user_id, device_id, registration_id, identity_key_pub,
             signed_prekey_id, signed_prekey_pub, signed_prekey_sig,
             signing_key_pub, signing_key_binding_sig,
             approval_status, trust_origin, is_primary, device_label,
             approved_by_device_id, approved_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'first_device', 1, ?, ?, datetime('now'), datetime('now'))`,
        )
          .bind(
            user.id,
            deviceId,
            registrationId,
            identityKeyPub,
            spkId,
            spkPub,
            spkSig,
            signingKeyPub,
            signingKeyBindingSig,
            deviceLabel,
            deviceId,
          )
          .run();
        insertedAsPrimary = true;
        approvalStatus = 'approved';
        trustOrigin = 'first_device';
        isPrimary = 1;
      } catch (err) {
        if (!isUniqueConstraintError(err)) {
          throw err;
        }
      }
    }

    if (!insertedAsPrimary) {
      await env.DB.prepare(
        `INSERT INTO e2ee_devices (
           user_id, device_id, registration_id, identity_key_pub,
           signed_prekey_id, signed_prekey_pub, signed_prekey_sig,
           signing_key_pub, signing_key_binding_sig,
           approval_status, trust_origin, is_primary, device_label, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, ?, datetime('now'))
         ON CONFLICT(user_id, device_id) DO UPDATE SET
           registration_id = excluded.registration_id,
           identity_key_pub = excluded.identity_key_pub,
           signed_prekey_id = excluded.signed_prekey_id,
           signed_prekey_pub = excluded.signed_prekey_pub,
           signed_prekey_sig = excluded.signed_prekey_sig,
           signing_key_pub = excluded.signing_key_pub,
           signing_key_binding_sig = excluded.signing_key_binding_sig,
           device_label = excluded.device_label,
           updated_at = datetime('now')
         WHERE e2ee_devices.approval_status = 'pending'`,
      )
        .bind(
          user.id,
          deviceId,
          registrationId,
          identityKeyPub,
          spkId,
          spkPub,
          spkSig,
          signingKeyPub,
          signingKeyBindingSig,
          deviceLabel,
        )
        .run();

      approvalStatus = 'pending';
      trustOrigin = 'pending';
      isPrimary = 0;

      const pendingRows = await env.DB.prepare(
        `SELECT device_id FROM e2ee_devices WHERE user_id = ? AND approval_status = 'pending' ORDER BY updated_at DESC, id DESC`,
      )
        .bind(user.id)
        .all<{ device_id: number }>();
      const pendingIds = (pendingRows.results || []).map((r) => Number(r.device_id));
      if (pendingIds.length > MAX_PENDING_DEVICES_PER_USER) {
        for (const staleId of pendingIds.slice(MAX_PENDING_DEVICES_PER_USER)) {
          await env.DB.prepare('DELETE FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
            .bind(user.id, staleId)
            .run();
          await env.DB.prepare("DELETE FROM e2ee_devices WHERE user_id = ? AND device_id = ? AND approval_status = 'pending'")
            .bind(user.id, staleId)
            .run();
        }
      }

      try {
        await emitUserEvent(env, user.id, {
          type: 'e2ee.device_pending',
          device_id: deviceId,
          device_label: deviceLabel,
        });
      } catch {}
    }
  }

  const curPreRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ cnt: number }>();
  const canInsert = Math.max(0, MAX_PREKEYS_PER_DEVICE - Number(curPreRow?.cnt || 0));
  if (canInsert > 0) {
    await insertPreKeysBatch(env, user.id, deviceId, prekeys.slice(0, canInsert));
  }

  const [cntRow, listRow] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
      .bind(user.id, deviceId)
      .first<{ cnt: number }>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  return jsonResponse(
    {
      success: true,
      device_id: deviceId,
      prekey_count: Number(cntRow?.cnt || 0),
      approval_status: approvalStatus,
      trust_origin: trustOrigin,
      is_primary: isPrimary === 1,
      list_version: Number(listRow?.list_version || 0),
    },
    200,
  );
}

export async function handleUploadPreKeys(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:pk:${user.id}`, REGISTER_LIMIT_PER_HOUR, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ device_id?: unknown; prekeys?: unknown }>(request, 65536);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  const deviceId = parsePositiveId(body?.device_id);
  if (!deviceId) {
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

  await insertPreKeysBatch(env, user.id, deviceId, prekeys.slice(0, canInsert));

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

  const deviceId = parsePositiveId(url.searchParams.get('device_id'));
  if (!deviceId) {
    return jsonResponse({ user_id: user.id, registered: false, prekey_count: 0 }, 200);
  }

  const dev = await env.DB.prepare(
    'SELECT id, approval_status, trust_origin, is_primary FROM e2ee_devices WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, deviceId)
    .first<{ id: number; approval_status: string; trust_origin: string; is_primary: number }>();

  if (!dev) {
    return jsonResponse({ user_id: user.id, registered: false, prekey_count: 0 }, 200);
  }

  const [cntRow, pendingRow, approvedRow, listRow] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
      .bind(user.id, deviceId)
      .first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS cnt FROM e2ee_devices WHERE user_id = ? AND approval_status = 'pending'")
      .bind(user.id)
      .first<{ cnt: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS cnt FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'")
      .bind(user.id)
      .first<{ cnt: number }>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  return jsonResponse(
    {
      user_id: user.id,
      registered: true,
      prekey_count: Number(cntRow?.cnt || 0),
      approval_status: dev.approval_status || 'approved',
      trust_origin: dev.trust_origin || 'legacy',
      is_primary: Number(dev.is_primary) === 1,
      pending_count: Number(pendingRow?.cnt || 0),
      approved_count: Number(approvedRow?.cnt || 0),
      list_version: Number(listRow?.list_version || 0),
    },
    200,
  );
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
    signing_key_pub: string;
    signing_key_binding_sig: string;
    trust_origin: string;
    is_primary: boolean;
    signed_prekey: { key_id: number; public_key: string; signature: string };
    prekey: { key_id: number; public_key: string } | null;
  }>
> {
  const devRes = await env.DB.prepare(
    `SELECT device_id, registration_id, identity_key_pub, signed_prekey_id, signed_prekey_pub, signed_prekey_sig,
            signing_key_pub, signing_key_binding_sig, trust_origin, is_primary
     FROM e2ee_devices
     WHERE user_id = ? AND approval_status = 'approved'
     ORDER BY is_primary DESC, updated_at DESC
     LIMIT ?`,
  )
    .bind(targetUserId, MAX_DEVICES_PER_USER)
    .all<DeviceRow>();

  const devices = (devRes.results || []).filter((d) => Number(d.device_id) !== excludeDeviceId);
  const bundles = [];

  for (const d of devices) {
    const devId = Number(d.device_id);
    const lockClause = env.DATABASE_URL ? 'FOR UPDATE SKIP LOCKED' : '';
    const opk = await env.DB.prepare(
      `DELETE FROM e2ee_prekeys
       WHERE id = (
         SELECT id FROM e2ee_prekeys
         WHERE user_id = ? AND device_id = ?
         ORDER BY id ASC
         LIMIT 1
         ${lockClause}
       )
       RETURNING id, key_id, public_key`,
    )
      .bind(targetUserId, devId)
      .first<{ id: number; key_id: number; public_key: string }>();

    bundles.push({
      user_id: targetUserId,
      device_id: devId,
      registration_id: Number(d.registration_id),
      identity_key_pub: d.identity_key_pub,
      signing_key_pub: d.signing_key_pub || '',
      signing_key_binding_sig: d.signing_key_binding_sig || '',
      trust_origin: d.trust_origin || 'legacy',
      is_primary: Number(d.is_primary) === 1,
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

export async function handleGetKeyBundle(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bundle:${user.id}`, BUNDLE_LIMIT_PER_MIN, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    user_id?: unknown;
    include_self?: unknown;
    self_device_id?: unknown;
  }>(request, 4096);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  const targetUserId = parsePositiveId(body?.user_id);
  if (!targetUserId) {
    return jsonError(t.common.networkError, 400);
  }

  const pairAllowed = await consumeRateLimitAtomic(
    env,
    `e2ee:bp:${user.id}:${targetUserId}`,
    BUNDLE_PAIR_LIMIT_PER_5MIN,
    300,
  );
  if (!pairAllowed) return jsonError(t.messages.errRateLimit, 429);

  const targetExists = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(targetUserId)
    .first<{ id: number }>();
  if (!targetExists) return jsonError(t.explore.noResults, 404);

  const includeSelf = body?.include_self === true || body?.include_self === 1 || body?.include_self === '1';
  const excludeDeviceId = parsePositiveId(body?.self_device_id) || 0;

  const [devices, deviceList, selfDevices, selfDeviceList] = await Promise.all([
    claimDeviceBundles(env, targetUserId, 0),
    getLatestDeviceList(env, targetUserId),
    includeSelf && targetUserId !== user.id ? claimDeviceBundles(env, user.id, excludeDeviceId) : Promise.resolve([]),
    includeSelf && targetUserId !== user.id ? getLatestDeviceList(env, user.id) : Promise.resolve(null),
  ]);

  return jsonResponse(
    {
      success: true,
      user_id: targetUserId,
      devices,
      device_list: deviceList,
      self_devices: selfDevices,
      self_device_list: targetUserId === user.id ? deviceList : selfDeviceList,
    },
    200,
  );
}

export async function handleGetIdentities(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:id:${user.id}`, IDENTITIES_LIMIT_PER_MIN, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const targetUserId = parsePositiveId(url.searchParams.get('user_id'));
  if (!targetUserId) {
    return jsonError(t.common.networkError, 400);
  }

  const includeSelf = url.searchParams.get('include_self') === '1';

  const partnerPromise = env.DB.prepare(
    `SELECT device_id, identity_key_pub, signing_key_pub, signing_key_binding_sig, trust_origin, is_primary, updated_at
     FROM e2ee_devices
     WHERE user_id = ? AND approval_status = 'approved'
     ORDER BY is_primary DESC, updated_at DESC
     LIMIT ?`,
  )
    .bind(targetUserId, MAX_DEVICES_PER_USER)
    .all<DeviceRow>();

  const selfPromise =
    includeSelf && targetUserId !== user.id
      ? env.DB.prepare(
          `SELECT device_id, identity_key_pub, signing_key_pub, signing_key_binding_sig, trust_origin, is_primary, updated_at
           FROM e2ee_devices
           WHERE user_id = ? AND approval_status = 'approved'
           ORDER BY is_primary DESC, updated_at DESC
           LIMIT ?`,
        )
          .bind(user.id, MAX_DEVICES_PER_USER)
          .all<DeviceRow>()
      : Promise.resolve(null);

  const [res, selfRes, deviceList, selfDeviceList] = await Promise.all([
    partnerPromise,
    selfPromise,
    getLatestDeviceList(env, targetUserId),
    includeSelf && targetUserId !== user.id ? getLatestDeviceList(env, user.id) : Promise.resolve(null),
  ]);

  const mapRows = (rows?: DeviceRow[]) =>
    (rows || []).map((r) => ({
      device_id: Number(r.device_id),
      identity_key_pub: r.identity_key_pub,
      signing_key_pub: r.signing_key_pub || '',
      signing_key_binding_sig: r.signing_key_binding_sig || '',
      trust_origin: r.trust_origin || 'legacy',
      is_primary: Number(r.is_primary) === 1,
      updated_at: r.updated_at,
    }));

  const payload: Record<string, unknown> = {
    success: true,
    user_id: targetUserId,
    devices: mapRows(res.results),
    device_list: deviceList,
  };
  if (includeSelf) {
    payload.self_devices = targetUserId === user.id ? payload.devices : mapRows(selfRes?.results);
    payload.self_device_list = targetUserId === user.id ? deviceList : selfDeviceList;
  }

  return jsonResponse(payload, 200);
}

export async function handleListE2eeDevices(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const [rows, deviceList] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, signing_key_binding_sig,
              approval_status, trust_origin, is_primary, device_label,
              approved_by_device_id, approved_at, created_at, updated_at
       FROM e2ee_devices
       WHERE user_id = ?
       ORDER BY CASE WHEN approval_status = 'approved' THEN 0 ELSE 1 END, is_primary DESC, updated_at DESC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    getLatestDeviceList(env, user.id),
  ]);

  return jsonResponse(
    {
      success: true,
      user_id: user.id,
      devices: (rows.results || []).map((r) => ({
        device_id: Number(r.device_id),
        identity_key_pub: r.identity_key_pub,
        signing_key_pub: r.signing_key_pub || '',
        signing_key_binding_sig: r.signing_key_binding_sig || '',
        approval_status: r.approval_status || 'approved',
        trust_origin: r.trust_origin || 'legacy',
        is_primary: Number(r.is_primary) === 1,
        device_label: r.device_label || '',
        approved_by_device_id: r.approved_by_device_id ? Number(r.approved_by_device_id) : null,
        approved_at: r.approved_at || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      device_list: deviceList,
    },
    200,
  );
}

export async function handleCreateDeviceChallenge(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:chal:${user.id}`, 20, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    approver_device_id?: unknown;
    target_device_id?: unknown;
  }>(request, 2048);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const approverDeviceId = parsePositiveId(parsed.data?.approver_device_id);
  const targetDeviceId = parsePositiveId(parsed.data?.target_device_id);
  if (!approverDeviceId || !targetDeviceId || approverDeviceId === targetDeviceId) {
    return jsonError(t.common.networkError, 400);
  }

  const [approver, target, approvedRows, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, approval_status
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, approverDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, approval_status
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, targetDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub
       FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'
       ORDER BY device_id ASC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!approver || approver.approval_status !== 'approved' || !isValidSpkiEcdsaPub(approver.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 403, 'APPROVER_NOT_TRUSTED');
  }
  if (!target || target.approval_status !== 'pending') {
    return jsonError(t.common.networkError, 404, 'TARGET_NOT_PENDING');
  }

  const approvedList = (approvedRows.results || []).map((r) => ({
    device_id: Number(r.device_id),
    identity_key_pub: r.identity_key_pub,
    signing_key_pub: r.signing_key_pub || '',
  }));
  if (approvedList.length >= MAX_DEVICES_PER_USER) {
    return jsonError(t.common.networkError, 409, 'MAX_DEVICES_REACHED');
  }

  const challengeId = randomHex(16);
  const nonce = randomHex(24);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO e2ee_device_challenges (
       challenge_id, user_id, approver_device_id, target_device_id,
       target_identity_key_pub, target_signing_key_pub, nonce, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      challengeId,
      user.id,
      approverDeviceId,
      targetDeviceId,
      target.identity_key_pub,
      target.signing_key_pub || '',
      nonce,
      expiresAt,
    )
    .run();

  const currentListVersion = Number(listRow?.list_version || 0);

  return jsonResponse(
    {
      success: true,
      challenge_id: challengeId,
      nonce,
      expires_at: expiresAt,
      approver_device_id: approverDeviceId,
      target_device_id: targetDeviceId,
      target_identity_key_pub: target.identity_key_pub,
      target_signing_key_pub: target.signing_key_pub || '',
      current_list_version: currentListVersion,
      next_list_version: currentListVersion + 1,
      approved_devices: approvedList,
    },
    200,
  );
}

export async function handleApproveE2eeDevice(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:appr:${user.id}`, 20, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    challenge_id?: unknown;
    approver_device_id?: unknown;
    target_device_id?: unknown;
    approval_signature?: unknown;
    device_list?: {
      list_version?: unknown;
      devices?: unknown;
      ecdsa_signature?: unknown;
      signal_signature?: unknown;
    };
  }>(request, 16384);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const body = parsed.data;
  const challengeId = typeof body?.challenge_id === 'string' ? body.challenge_id.trim() : '';
  const approverDeviceId = parsePositiveId(body?.approver_device_id);
  const targetDeviceId = parsePositiveId(body?.target_device_id);
  const approvalSig = typeof body?.approval_signature === 'string' ? body.approval_signature.trim() : '';
  const listVersion = Number(body?.device_list?.list_version);
  const listEcdsaSig =
    typeof body?.device_list?.ecdsa_signature === 'string' ? body.device_list.ecdsa_signature.trim() : '';
  const listSignalSig =
    typeof body?.device_list?.signal_signature === 'string' ? body.device_list.signal_signature.trim() : '';
  const incomingDevices = normalizeDeviceListEntries(body?.device_list?.devices);

  if (
    !/^[a-f0-9]{16,64}$/i.test(challengeId) ||
    !approverDeviceId ||
    !targetDeviceId ||
    !isValidSignature(approvalSig) ||
    !Number.isInteger(listVersion) ||
    listVersion <= 0 ||
    !isValidSignature(listEcdsaSig) ||
    !isValidSignature(listSignalSig) ||
    !incomingDevices
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const ch = await env.DB.prepare(
    `SELECT challenge_id, approver_device_id, target_device_id, target_identity_key_pub,
            target_signing_key_pub, nonce, expires_at, used_at
     FROM e2ee_device_challenges
     WHERE challenge_id = ? AND user_id = ?`,
  )
    .bind(challengeId, user.id)
    .first<{
      challenge_id: string;
      approver_device_id: number;
      target_device_id: number;
      target_identity_key_pub: string;
      target_signing_key_pub: string;
      nonce: string;
      expires_at: string;
      used_at: string | null;
    }>();

  if (!ch) return jsonError(t.common.networkError, 404, 'CHALLENGE_NOT_FOUND');
  if (ch.used_at) return jsonError(t.common.networkError, 409, 'CHALLENGE_ALREADY_USED');
  if (Number(ch.approver_device_id) !== approverDeviceId || Number(ch.target_device_id) !== targetDeviceId) {
    return jsonError(t.common.networkError, 400, 'CHALLENGE_MISMATCH');
  }
  if (parseUtcTimestampMs(ch.expires_at) <= Date.now()) {
    return jsonError(t.common.networkError, 410, 'CHALLENGE_EXPIRED');
  }

  const [approver, target, approvedRows, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, approval_status
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, approverDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, approval_status
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, targetDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub
       FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'
       ORDER BY device_id ASC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!approver || approver.approval_status !== 'approved' || !isValidSpkiEcdsaPub(approver.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 403, 'APPROVER_NOT_TRUSTED');
  }
  if (
    !target ||
    target.approval_status !== 'pending' ||
    target.identity_key_pub !== ch.target_identity_key_pub ||
    (target.signing_key_pub || '') !== (ch.target_signing_key_pub || '')
  ) {
    return jsonError(t.common.networkError, 409, 'TARGET_CHANGED');
  }

  const currentVersion = Number(listRow?.list_version || 0);
  const expectedNextVersion = currentVersion + 1;
  if (listVersion !== expectedNextVersion) {
    return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
  }

  const approvedList: SignedDeviceListEntry[] = (approvedRows.results || []).map((r) => ({
    device_id: Number(r.device_id),
    identity_key_pub: r.identity_key_pub,
    signing_key_pub: r.signing_key_pub || '',
  }));
  if (approvedList.length >= MAX_DEVICES_PER_USER) {
    return jsonError(t.common.networkError, 409, 'MAX_DEVICES_REACHED');
  }

  const expectedDevices: SignedDeviceListEntry[] = [
    ...approvedList,
    {
      device_id: targetDeviceId,
      identity_key_pub: target.identity_key_pub,
      signing_key_pub: target.signing_key_pub || '',
    },
  ];
  if (!deviceListsEqual(incomingDevices, expectedDevices)) {
    return jsonError(t.common.networkError, 400, 'DEVICE_LIST_MISMATCH');
  }

  const challengeMsg = buildApprovalChallengeMsg(
    user.id,
    approverDeviceId,
    targetDeviceId,
    ch.target_identity_key_pub,
    ch.target_signing_key_pub || '',
    ch.nonce,
    challengeId,
  );
  const validChallengeSig = await verifyEcdsaP256(approver.signing_key_pub, challengeMsg, approvalSig);
  if (!validChallengeSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_APPROVAL_SIGNATURE');
  }

  const listMsg = buildDeviceListCanonicalMsg(user.id, expectedNextVersion, false, expectedDevices);
  const validListSig = await verifyEcdsaP256(approver.signing_key_pub, listMsg, listEcdsaSig);
  if (!validListSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_LIST_SIGNATURE');
  }

  const sortedJson = JSON.stringify([...expectedDevices].sort((a, b) => a.device_id - b.device_id));
  const listStmt =
    currentVersion === 0
      ? env.DB.prepare(
          `INSERT INTO e2ee_device_lists (
             user_id, list_version, signer_device_id, device_list_json,
             ecdsa_signature, signal_signature, is_recovery_reset, updated_at
           )
           SELECT ?, ?, ?, ?, ?, ?, 0, datetime('now')
           WHERE EXISTS (
             SELECT 1 FROM e2ee_device_challenges
             WHERE challenge_id = ? AND user_id = ? AND approver_device_id = ? AND target_device_id = ? AND used_at IS NULL
           )
           AND EXISTS (
             SELECT 1 FROM e2ee_devices
             WHERE user_id = ? AND device_id = ? AND approval_status = 'pending' AND identity_key_pub = ?
           )
           RETURNING list_version`,
        ).bind(
          user.id,
          expectedNextVersion,
          approverDeviceId,
          sortedJson,
          listEcdsaSig,
          listSignalSig,
          challengeId,
          user.id,
          approverDeviceId,
          targetDeviceId,
          user.id,
          targetDeviceId,
          ch.target_identity_key_pub,
        )
      : env.DB.prepare(
          `UPDATE e2ee_device_lists
           SET list_version = ?,
               signer_device_id = ?,
               device_list_json = ?,
               ecdsa_signature = ?,
               signal_signature = ?,
               is_recovery_reset = 0,
               updated_at = datetime('now')
           WHERE user_id = ? AND list_version = ?
             AND EXISTS (
               SELECT 1 FROM e2ee_device_challenges
               WHERE challenge_id = ? AND user_id = ? AND approver_device_id = ? AND target_device_id = ? AND used_at IS NULL
             )
             AND EXISTS (
               SELECT 1 FROM e2ee_devices
               WHERE user_id = ? AND device_id = ? AND approval_status = 'pending' AND identity_key_pub = ?
             )
           RETURNING list_version`,
        ).bind(
          expectedNextVersion,
          approverDeviceId,
          sortedJson,
          listEcdsaSig,
          listSignalSig,
          user.id,
          currentVersion,
          challengeId,
          user.id,
          approverDeviceId,
          targetDeviceId,
          user.id,
          targetDeviceId,
          ch.target_identity_key_pub,
        );

  const consumeStmt = env.DB.prepare(
    `UPDATE e2ee_device_challenges
     SET used_at = datetime('now')
     WHERE challenge_id = ? AND user_id = ? AND approver_device_id = ? AND target_device_id = ? AND used_at IS NULL
       AND EXISTS (
         SELECT 1 FROM e2ee_device_lists
         WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?
       )
     RETURNING challenge_id`,
  ).bind(
    challengeId,
    user.id,
    approverDeviceId,
    targetDeviceId,
    user.id,
    expectedNextVersion,
    listEcdsaSig,
  );

  const promoteStmt = env.DB.prepare(
    `UPDATE e2ee_devices
     SET approval_status = 'approved',
         trust_origin = 'device_approved',
         approved_by_device_id = ?,
         approved_at = datetime('now'),
         updated_at = datetime('now')
     WHERE user_id = ? AND device_id = ? AND approval_status = 'pending' AND identity_key_pub = ?
       AND EXISTS (
         SELECT 1 FROM e2ee_device_lists
         WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?
       )
     RETURNING device_id`,
  ).bind(
    approverDeviceId,
    user.id,
    targetDeviceId,
    ch.target_identity_key_pub,
    user.id,
    expectedNextVersion,
    listEcdsaSig,
  );

  let batchRes: unknown[];
  try {
    batchRes = await execDbBatch(env, [listStmt, consumeStmt, promoteStmt]);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
    }
    throw err;
  }

  if (batchRowCount(batchRes[0]) !== 1 || batchRowCount(batchRes[1]) !== 1 || batchRowCount(batchRes[2]) !== 1) {
    return jsonError(t.common.networkError, 409, 'APPROVAL_CONFLICT');
  }

  try {
    await emitUserEvent(env, user.id, {
      type: 'e2ee.device_approved',
      device_id: targetDeviceId,
      approved_by_device_id: approverDeviceId,
      list_version: expectedNextVersion,
    });
  } catch {}

  return jsonResponse(
    {
      success: true,
      device_id: targetDeviceId,
      list_version: expectedNextVersion,
    },
    200,
  );
}

export async function handleSignDeviceList(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:sign:${user.id}`, 30, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    signer_device_id?: unknown;
    device_list?: {
      list_version?: unknown;
      devices?: unknown;
      ecdsa_signature?: unknown;
      signal_signature?: unknown;
    };
  }>(request, 16384);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const signerDeviceId = parsePositiveId(parsed.data?.signer_device_id);
  const listVersion = Number(parsed.data?.device_list?.list_version);
  const ecdsaSig =
    typeof parsed.data?.device_list?.ecdsa_signature === 'string'
      ? parsed.data.device_list.ecdsa_signature.trim()
      : '';
  const signalSig =
    typeof parsed.data?.device_list?.signal_signature === 'string'
      ? parsed.data.device_list.signal_signature.trim()
      : '';
  const incomingDevices = normalizeDeviceListEntries(parsed.data?.device_list?.devices);

  if (
    !signerDeviceId ||
    !Number.isInteger(listVersion) ||
    listVersion <= 0 ||
    !isValidSignature(ecdsaSig) ||
    !isValidSignature(signalSig) ||
    !incomingDevices
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const [signer, approvedRows, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, signing_key_pub, approval_status
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, signerDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub
       FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'
       ORDER BY device_id ASC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!signer || signer.approval_status !== 'approved' || !isValidSpkiEcdsaPub(signer.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 403, 'SIGNER_NOT_TRUSTED');
  }

  const currentVersion = Number(listRow?.list_version || 0);
  if (listVersion !== currentVersion + 1) {
    return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
  }

  const expectedDevices: SignedDeviceListEntry[] = (approvedRows.results || []).map((r) => ({
    device_id: Number(r.device_id),
    identity_key_pub: r.identity_key_pub,
    signing_key_pub: r.signing_key_pub || '',
  }));
  if (!deviceListsEqual(incomingDevices, expectedDevices)) {
    return jsonError(t.common.networkError, 400, 'DEVICE_LIST_MISMATCH');
  }

  const listMsg = buildDeviceListCanonicalMsg(user.id, listVersion, false, expectedDevices);
  const validSig = await verifyEcdsaP256(signer.signing_key_pub, listMsg, ecdsaSig);
  if (!validSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_LIST_SIGNATURE');
  }

  const saved = await upsertDeviceList(
    env,
    user.id,
    currentVersion,
    listVersion,
    signerDeviceId,
    expectedDevices,
    ecdsaSig,
    signalSig,
    false,
  );
  if (!saved) return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');

  return jsonResponse({ success: true, list_version: listVersion }, 200);
}

export async function handleRevokeE2eeDevice(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:rev:${user.id}`, 20, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    approver_device_id?: unknown;
    target_device_id?: unknown;
    device_list?: {
      list_version?: unknown;
      devices?: unknown;
      ecdsa_signature?: unknown;
      signal_signature?: unknown;
    };
  }>(request, 16384);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const approverDeviceId = parsePositiveId(parsed.data?.approver_device_id);
  const targetDeviceId = parsePositiveId(parsed.data?.target_device_id);
  if (!targetDeviceId) return jsonError(t.common.networkError, 400);

  const target = await env.DB.prepare(
    `SELECT device_id, approval_status, is_primary FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
  )
    .bind(user.id, targetDeviceId)
    .first<DeviceRow>();
  if (!target) return jsonError(t.common.networkError, 404);

  if (target.approval_status === 'pending') {
    await env.DB.prepare('DELETE FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?')
      .bind(user.id, targetDeviceId)
      .run();
    await env.DB.prepare("DELETE FROM e2ee_devices WHERE user_id = ? AND device_id = ? AND approval_status = 'pending'")
      .bind(user.id, targetDeviceId)
      .run();
    try {
      await emitUserEvent(env, user.id, { type: 'e2ee.device_revoked', device_id: targetDeviceId });
    } catch {}
    return jsonResponse({ success: true, device_id: targetDeviceId }, 200);
  }

  if (!approverDeviceId || approverDeviceId === targetDeviceId) {
    return jsonError(t.common.networkError, 400, 'CANNOT_REVOKE_SELF');
  }

  const [approver, approvedRows, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, signing_key_pub, approval_status FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, approverDeviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub
       FROM e2ee_devices WHERE user_id = ? AND approval_status = 'approved'
       ORDER BY device_id ASC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!approver || approver.approval_status !== 'approved' || !isValidSpkiEcdsaPub(approver.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 403, 'APPROVER_NOT_TRUSTED');
  }

  const remainingDevices: SignedDeviceListEntry[] = (approvedRows.results || [])
    .filter((r) => Number(r.device_id) !== targetDeviceId)
    .map((r) => ({
      device_id: Number(r.device_id),
      identity_key_pub: r.identity_key_pub,
      signing_key_pub: r.signing_key_pub || '',
    }));

  if (remainingDevices.length === 0) {
    return jsonError(t.common.networkError, 400, 'CANNOT_REVOKE_LAST_DEVICE');
  }

  const listVersion = Number(parsed.data?.device_list?.list_version);
  const ecdsaSig =
    typeof parsed.data?.device_list?.ecdsa_signature === 'string'
      ? parsed.data.device_list.ecdsa_signature.trim()
      : '';
  const signalSig =
    typeof parsed.data?.device_list?.signal_signature === 'string'
      ? parsed.data.device_list.signal_signature.trim()
      : '';
  const incomingDevices = normalizeDeviceListEntries(parsed.data?.device_list?.devices);

  const currentVersion = Number(listRow?.list_version || 0);
  if (
    !incomingDevices ||
    listVersion !== currentVersion + 1 ||
    !isValidSignature(ecdsaSig) ||
    !isValidSignature(signalSig) ||
    !deviceListsEqual(incomingDevices, remainingDevices)
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_DEVICE_LIST');
  }

  const listMsg = buildDeviceListCanonicalMsg(user.id, listVersion, false, remainingDevices);
  const validSig = await verifyEcdsaP256(approver.signing_key_pub, listMsg, ecdsaSig);
  if (!validSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_LIST_SIGNATURE');
  }

  const sortedRemJson = JSON.stringify([...remainingDevices].sort((a, b) => a.device_id - b.device_id));
  const revListStmt =
    currentVersion === 0
      ? env.DB.prepare(
          `INSERT INTO e2ee_device_lists (
             user_id, list_version, signer_device_id, device_list_json,
             ecdsa_signature, signal_signature, is_recovery_reset, updated_at
           )
           SELECT ?, ?, ?, ?, ?, ?, 0, datetime('now')
           WHERE EXISTS (
             SELECT 1 FROM e2ee_devices
             WHERE user_id = ? AND device_id = ? AND approval_status = 'approved'
           )
           RETURNING list_version`,
        ).bind(
          user.id,
          listVersion,
          approverDeviceId,
          sortedRemJson,
          ecdsaSig,
          signalSig,
          user.id,
          targetDeviceId,
        )
      : env.DB.prepare(
          `UPDATE e2ee_device_lists
           SET list_version = ?,
               signer_device_id = ?,
               device_list_json = ?,
               ecdsa_signature = ?,
               signal_signature = ?,
               is_recovery_reset = 0,
               updated_at = datetime('now')
           WHERE user_id = ? AND list_version = ?
             AND EXISTS (
               SELECT 1 FROM e2ee_devices
               WHERE user_id = ? AND device_id = ? AND approval_status = 'approved'
             )
           RETURNING list_version`,
        ).bind(
          listVersion,
          approverDeviceId,
          sortedRemJson,
          ecdsaSig,
          signalSig,
          user.id,
          currentVersion,
          user.id,
          targetDeviceId,
        );

  const revokeStmts = [
    revListStmt,
    env.DB.prepare(
      `DELETE FROM e2ee_prekeys
       WHERE user_id = ? AND device_id = ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(user.id, targetDeviceId, user.id, listVersion, ecdsaSig),
    env.DB.prepare(
      `DELETE FROM e2ee_devices
       WHERE user_id = ? AND device_id = ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(user.id, targetDeviceId, user.id, listVersion, ecdsaSig),
  ];

  if (Number(target.is_primary) === 1) {
    revokeStmts.push(
      env.DB.prepare(
        `UPDATE e2ee_devices
         SET is_primary = 1
         WHERE user_id = ? AND device_id = ?
           AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
      ).bind(user.id, approverDeviceId, user.id, listVersion, ecdsaSig),
    );
  }

  let revBatchRes: unknown[];
  try {
    revBatchRes = await execDbBatch(env, revokeStmts);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
    }
    throw err;
  }

  if (batchRowCount(revBatchRes[0]) !== 1) {
    return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
  }

  try {
    await emitUserEvent(env, user.id, {
      type: 'e2ee.device_revoked',
      device_id: targetDeviceId,
      list_version: listVersion,
    });
  } catch {}

  return jsonResponse({ success: true, device_id: targetDeviceId, list_version: listVersion }, 200);
}

export async function handleRecoverE2eeDevice(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:rec:${user.id}`, 5, 900);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    password?: unknown;
    device_id?: unknown;
    device_list?: {
      list_version?: unknown;
      devices?: unknown;
      ecdsa_signature?: unknown;
      signal_signature?: unknown;
    };
  }>(request, 16384);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const password = typeof parsed.data?.password === 'string' ? parsed.data.password : '';
  const deviceId = parsePositiveId(parsed.data?.device_id);
  const listVersion = Number(parsed.data?.device_list?.list_version);
  const ecdsaSig =
    typeof parsed.data?.device_list?.ecdsa_signature === 'string'
      ? parsed.data.device_list.ecdsa_signature.trim()
      : '';
  const signalSig =
    typeof parsed.data?.device_list?.signal_signature === 'string'
      ? parsed.data.device_list.signal_signature.trim()
      : '';
  const incomingDevices = normalizeDeviceListEntries(parsed.data?.device_list?.devices);

  if (
    !password ||
    password.length > 256 ||
    !deviceId ||
    !Number.isInteger(listVersion) ||
    listVersion <= 0 ||
    !isValidSignature(ecdsaSig) ||
    !isValidSignature(signalSig) ||
    !incomingDevices ||
    incomingDevices.length !== 1
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const userRow = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string }>();
  if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
    return jsonError(t.auth.errInvalidCredentials, 403, 'INVALID_PASSWORD');
  }

  const [dev, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub, signing_key_binding_sig
       FROM e2ee_devices WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, deviceId)
      .first<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!dev || !isValidSpkiEcdsaPub(dev.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 404, 'DEVICE_NOT_FOUND');
  }

  const currentVersion = Number(listRow?.list_version || 0);
  if (listVersion !== currentVersion + 1) {
    return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
  }

  const expectedDevices: SignedDeviceListEntry[] = [
    {
      device_id: deviceId,
      identity_key_pub: dev.identity_key_pub,
      signing_key_pub: dev.signing_key_pub,
    },
  ];
  if (!deviceListsEqual(incomingDevices, expectedDevices)) {
    return jsonError(t.common.networkError, 400, 'DEVICE_LIST_MISMATCH');
  }

  const listMsg = buildDeviceListCanonicalMsg(user.id, listVersion, true, expectedDevices);
  const validSig = await verifyEcdsaP256(dev.signing_key_pub, listMsg, ecdsaSig);
  if (!validSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_LIST_SIGNATURE');
  }

  const currentSessionHash = await getSessionHashFromRequest(request);
  const currentSessionKey = currentSessionHash ? currentSessionHash.slice(0, 32) : '';

  try {
    await emitUserEvent(
      env,
      user.id,
      {
        type: 'e2ee.devices_reset',
        new_device_id: deviceId,
        list_version: listVersion,
      },
      currentSessionKey ? { excludeSession: currentSessionKey } : undefined,
    );
  } catch {}

  const sortedRecJson = JSON.stringify([...expectedDevices].sort((a, b) => a.device_id - b.device_id));
  const recListStmt =
    currentVersion === 0
      ? env.DB.prepare(
          `INSERT INTO e2ee_device_lists (
             user_id, list_version, signer_device_id, device_list_json,
             ecdsa_signature, signal_signature, is_recovery_reset, updated_at
           )
           SELECT ?, ?, ?, ?, ?, ?, 1, datetime('now')
           WHERE EXISTS (
             SELECT 1 FROM e2ee_devices WHERE user_id = ? AND device_id = ?
           )
           RETURNING list_version`,
        ).bind(user.id, listVersion, deviceId, sortedRecJson, ecdsaSig, signalSig, user.id, deviceId)
      : env.DB.prepare(
          `UPDATE e2ee_device_lists
           SET list_version = ?,
               signer_device_id = ?,
               device_list_json = ?,
               ecdsa_signature = ?,
               signal_signature = ?,
               is_recovery_reset = 1,
               updated_at = datetime('now')
           WHERE user_id = ? AND list_version = ?
             AND EXISTS (
               SELECT 1 FROM e2ee_devices WHERE user_id = ? AND device_id = ?
             )
           RETURNING list_version`,
        ).bind(listVersion, deviceId, sortedRecJson, ecdsaSig, signalSig, user.id, currentVersion, user.id, deviceId);

  const recStmts = [
    recListStmt,
    env.DB.prepare(
      `DELETE FROM e2ee_device_challenges
       WHERE user_id = ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(user.id, user.id, listVersion, ecdsaSig),
    env.DB.prepare(
      `DELETE FROM e2ee_prekeys
       WHERE user_id = ? AND device_id != ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(user.id, deviceId, user.id, listVersion, ecdsaSig),
    env.DB.prepare(
      `DELETE FROM e2ee_devices
       WHERE user_id = ? AND device_id != ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(user.id, deviceId, user.id, listVersion, ecdsaSig),
    env.DB.prepare(
      `UPDATE e2ee_devices
       SET approval_status = 'approved',
           trust_origin = 'recovery_reset',
           is_primary = 1,
           approved_by_device_id = ?,
           approved_at = datetime('now'),
           updated_at = datetime('now')
       WHERE user_id = ? AND device_id = ?
         AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
    ).bind(deviceId, user.id, deviceId, user.id, listVersion, ecdsaSig),
  ];

  if (currentSessionHash) {
    recStmts.push(
      env.DB.prepare(
        `DELETE FROM sessions
         WHERE user_id = ? AND token_hash != ?
           AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
      ).bind(user.id, currentSessionHash, user.id, listVersion, ecdsaSig),
    );
  }

  let recBatchRes: unknown[];
  try {
    recBatchRes = await execDbBatch(env, recStmts);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
    }
    throw err;
  }

  if (batchRowCount(recBatchRes[0]) !== 1) {
    return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
  }

  try {
    await revokeUserRealtimeSessions(
      env,
      user.id,
      currentSessionKey ? { exceptSessionKey: currentSessionKey } : { all: true },
    );
  } catch {}

  return jsonResponse(
    {
      success: true,
      device_id: deviceId,
      list_version: listVersion,
      revoked_other_sessions: true,
    },
    200,
  );
}

export async function handleUnregisterE2eeDevice(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:unreg:${user.id}`, 20, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    device_id?: unknown;
    timestamp?: unknown;
    signature?: unknown;
    device_list?: {
      list_version?: unknown;
      devices?: unknown;
      ecdsa_signature?: unknown;
      signal_signature?: unknown;
    };
  }>(request, 16384);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }

  const deviceId = parsePositiveId(parsed.data?.device_id);
  const ts = Number(parsed.data?.timestamp);
  const sig = typeof parsed.data?.signature === 'string' ? parsed.data.signature.trim() : '';
  if (!deviceId) {
    return jsonError(t.common.networkError, 400);
  }
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > CHALLENGE_TTL_MS || !isValidSignature(sig)) {
    return jsonError(t.common.networkError, 403, 'PROOF_REQUIRED');
  }

  const [target, approvedRows, listRow] = await Promise.all([
    env.DB.prepare(
      `SELECT device_id, signing_key_pub, approval_status, is_primary
       FROM e2ee_devices
       WHERE user_id = ? AND device_id = ?`,
    )
      .bind(user.id, deviceId)
      .first<DeviceRow>(),
    env.DB.prepare(
      `SELECT device_id, identity_key_pub, signing_key_pub
       FROM e2ee_devices
       WHERE user_id = ? AND approval_status = 'approved'
       ORDER BY device_id ASC`,
    )
      .bind(user.id)
      .all<DeviceRow>(),
    env.DB.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?')
      .bind(user.id)
      .first<{ list_version: number }>(),
  ]);

  if (!target) {
    return jsonError(t.common.networkError, 404, 'DEVICE_NOT_FOUND');
  }
  if (!isValidSpkiEcdsaPub(target.signing_key_pub || '')) {
    return jsonError(t.common.networkError, 403, 'SIGNING_KEY_REQUIRED');
  }

  const unregMsg = buildUnregisterDeviceMsg(user.id, deviceId, Math.floor(ts));
  const validSig = await verifyEcdsaP256(target.signing_key_pub, unregMsg, sig);
  if (!validSig) {
    return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');
  }

  const remainingDevices: SignedDeviceListEntry[] = (approvedRows.results || [])
    .filter((r) => Number(r.device_id) !== deviceId)
    .map((r) => ({
      device_id: Number(r.device_id),
      identity_key_pub: r.identity_key_pub,
      signing_key_pub: r.signing_key_pub || '',
    }));

  if (target.approval_status === 'approved' && remainingDevices.length > 0) {
    const currentVersion = Number(listRow?.list_version || 0);
    const listVersion = Number(parsed.data?.device_list?.list_version);
    const listEcdsaSig =
      typeof parsed.data?.device_list?.ecdsa_signature === 'string'
        ? parsed.data.device_list.ecdsa_signature.trim()
        : '';
    const listSignalSig =
      typeof parsed.data?.device_list?.signal_signature === 'string'
        ? parsed.data.device_list.signal_signature.trim()
        : '';
    const incomingDevices = normalizeDeviceListEntries(parsed.data?.device_list?.devices);

    if (
      !incomingDevices ||
      listVersion !== currentVersion + 1 ||
      !isValidSignature(listEcdsaSig) ||
      !isValidSignature(listSignalSig) ||
      !deviceListsEqual(incomingDevices, remainingDevices)
    ) {
      return jsonError(t.common.networkError, 400, 'INVALID_DEVICE_LIST');
    }

    const listMsg = buildDeviceListCanonicalMsg(user.id, listVersion, false, remainingDevices);
    const validListSig = await verifyEcdsaP256(target.signing_key_pub, listMsg, listEcdsaSig);
    if (!validListSig) {
      return jsonError(t.common.networkError, 403, 'INVALID_LIST_SIGNATURE');
    }

    const sortedJson = JSON.stringify([...remainingDevices].sort((a, b) => a.device_id - b.device_id));
    const listStmt =
      currentVersion === 0
        ? env.DB.prepare(
            `INSERT INTO e2ee_device_lists (
               user_id, list_version, signer_device_id, device_list_json,
               ecdsa_signature, signal_signature, is_recovery_reset, updated_at
             )
             SELECT ?, ?, ?, ?, ?, ?, 0, datetime('now')
             WHERE EXISTS (
               SELECT 1 FROM e2ee_devices WHERE user_id = ? AND device_id = ? AND approval_status = 'approved'
             )
             RETURNING list_version`,
          ).bind(user.id, listVersion, deviceId, sortedJson, listEcdsaSig, listSignalSig, user.id, deviceId)
        : env.DB.prepare(
            `UPDATE e2ee_device_lists
             SET list_version = ?,
                 signer_device_id = ?,
                 device_list_json = ?,
                 ecdsa_signature = ?,
                 signal_signature = ?,
                 is_recovery_reset = 0,
                 updated_at = datetime('now')
             WHERE user_id = ? AND list_version = ?
               AND EXISTS (
                 SELECT 1 FROM e2ee_devices WHERE user_id = ? AND device_id = ? AND approval_status = 'approved'
               )
             RETURNING list_version`,
          ).bind(listVersion, deviceId, sortedJson, listEcdsaSig, listSignalSig, user.id, currentVersion, user.id, deviceId);

    const unregStmts = [
      listStmt,
      env.DB.prepare(
        `DELETE FROM e2ee_prekeys
         WHERE user_id = ? AND device_id = ?
           AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
      ).bind(user.id, deviceId, user.id, listVersion, listEcdsaSig),
      env.DB.prepare(
        `DELETE FROM e2ee_devices
         WHERE user_id = ? AND device_id = ?
           AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
      ).bind(user.id, deviceId, user.id, listVersion, listEcdsaSig),
    ];

    if (Number(target.is_primary) === 1) {
      unregStmts.push(
        env.DB.prepare(
          `UPDATE e2ee_devices
           SET is_primary = 1
           WHERE user_id = ? AND device_id = ?
             AND EXISTS (SELECT 1 FROM e2ee_device_lists WHERE user_id = ? AND list_version = ? AND ecdsa_signature = ?)`,
        ).bind(user.id, remainingDevices[0].device_id, user.id, listVersion, listEcdsaSig),
      );
    }

    let unregBatchRes: unknown[];
    try {
      unregBatchRes = await execDbBatch(env, unregStmts);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
      }
      throw err;
    }

    if (batchRowCount(unregBatchRes[0]) !== 1) {
      return jsonError(t.common.networkError, 409, 'LIST_VERSION_CONFLICT');
    }

    return jsonResponse({ success: true, list_version: listVersion }, 200);
  }

  await execDbBatch(env, [
    env.DB.prepare('DELETE FROM e2ee_prekeys WHERE user_id = ? AND device_id = ?').bind(user.id, deviceId),
    env.DB.prepare('DELETE FROM e2ee_devices WHERE user_id = ? AND device_id = ?').bind(user.id, deviceId),
  ]);

  return jsonResponse({ success: true }, 200);
}
