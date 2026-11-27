import { Env } from './types';
import { getUserFromRequest, verifyPassword } from './auth';
import { detectLanguage, getTranslations } from './languages';
import { checkContentLength, consumeRateLimitAtomic, parsePositiveId, readJsonWithLimit } from './security';
import { emitUserEvent } from './realtime';
import { verifyEcdsaP256 } from './e2ee';

export const MAX_BACKUP_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_CHUNKS_PER_EPOCH = 32;
export const MAX_TRANSFER_BYTES = 20 * 1024 * 1024;
export const TRANSFER_TTL_MS = 5 * 60 * 1000;
const PROOF_WINDOW_MS = 5 * 60 * 1000;

interface BackupRow {
  user_id: number;
  enabled: number;
  backup_epoch: number;
  backup_version: number;
  kdf_salt: string;
  signer_device_id: number;
  manifest_sig: string;
  chunk_count: number;
  base_chunk_count: number;
  total_size_bytes: number;
  message_count: number;
  last_msg_id: number;
  last_backup_at: string | null;
  updated_at: string;
}

interface BackupChunkRow {
  backup_epoch: number;
  chunk_seq: number;
  r2_key: string;
  iv_b64: string;
  sha256_b64: string;
  size_bytes: number;
  msg_count: number;
  max_msg_id: number;
  is_staged: number;
}

interface TransferRow {
  transfer_id: string;
  user_id: number;
  requester_device_id: number;
  requester_eph_pub: string;
  requester_sig: string;
  sender_device_id: number | null;
  sender_eph_pub: string;
  sender_signature: string;
  r2_key: string;
  iv_b64: string;
  payload_sha256: string;
  size_bytes: number;
  status: string;
  expires_at: string;
  created_at: string;
}

interface ApprovedDeviceRow {
  device_id: number;
  signing_key_pub: string;
  approval_status: string;
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

function jsonError(message: string, status: number, code?: string, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: message, ...(code ? { code } : {}), ...(extra || {}) }, status);
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

function bytesToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function sha256Base64(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return bytesToBase64(digest);
}

function isValidIvB64(b64: string): boolean {
  const raw = decodeBase64Strict(b64, 32);
  return Boolean(raw && raw.length === 12);
}

function isValidSha256B64(b64: string): boolean {
  const raw = decodeBase64Strict(b64, 64);
  return Boolean(raw && raw.length === 32);
}

function isValidSaltB64(b64: string): boolean {
  const raw = decodeBase64Strict(b64, 64);
  return Boolean(raw && raw.length === 32);
}

function isValidSig64(b64: string): boolean {
  const raw = decodeBase64Strict(b64, 128);
  return Boolean(raw && raw.length === 64);
}

function isValidSpkiPub(b64: string): boolean {
  const raw = decodeBase64Strict(b64, 256);
  return Boolean(raw && raw.length >= 64 && raw.length <= 128);
}

function parseUtcMs(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const s = raw.trim();
  const norm = s.includes('T') || s.endsWith('Z') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(norm);
  return Number.isFinite(ms) ? ms : 0;
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

export function buildBackupStageMsg(
  userId: number,
  deviceId: number,
  targetEpoch: number,
  chunkSeq: number,
  ivB64: string,
  sha256B64: string,
  sizeBytes: number,
): string {
  return `pg-backup-stage-v1|${userId}|${deviceId}|${targetEpoch}|${chunkSeq}|${ivB64}|${sha256B64}|${sizeBytes}`;
}

export function buildBackupCommitMsg(
  userId: number,
  deviceId: number,
  targetEpoch: number,
  expectedVersion: number,
  nextVersion: number,
  kdfSalt: string,
  chunkDigestsCsv: string,
): string {
  return `pg-backup-commit-v1|${userId}|${deviceId}|${targetEpoch}|${expectedVersion}|${nextVersion}|${kdfSalt}|${chunkDigestsCsv}`;
}

export function buildBackupDeltaMsg(
  userId: number,
  deviceId: number,
  epoch: number,
  expectedVersion: number,
  nextVersion: number,
  chunkSeq: number,
  ivB64: string,
  sha256B64: string,
  sizeBytes: number,
  kdfSalt: string,
): string {
  return `pg-backup-delta-v1|${userId}|${deviceId}|${epoch}|${expectedVersion}|${nextVersion}|${chunkSeq}|${ivB64}|${sha256B64}|${sizeBytes}|${kdfSalt}`;
}

export function buildBackupDeleteMsg(
  userId: number,
  deviceId: number,
  expectedVersion: number,
  timestamp: number,
): string {
  return `pg-backup-delete-v1|${userId}|${deviceId}|${expectedVersion}|${timestamp}`;
}

export function buildTransferInitMsg(
  userId: number,
  transferId: string,
  requesterDeviceId: number,
  requesterEphPub: string,
): string {
  return `pg-transfer-init-v1|${userId}|${transferId}|${requesterDeviceId}|${requesterEphPub}`;
}

export function buildTransferUploadMsg(
  userId: number,
  transferId: string,
  requesterDeviceId: number,
  requesterEphPub: string,
  senderDeviceId: number,
  senderEphPub: string,
  ivB64: string,
  payloadSha256: string,
  sizeBytes: number,
): string {
  return `pg-transfer-v1|${userId}|${transferId}|${requesterDeviceId}|${requesterEphPub}|${senderDeviceId}|${senderEphPub}|${ivB64}|${payloadSha256}|${sizeBytes}`;
}

async function getApprovedDevice(env: Env, userId: number, deviceId: number): Promise<ApprovedDeviceRow | null> {
  const row = await env.DB.prepare(
    `SELECT device_id, signing_key_pub, approval_status
     FROM e2ee_devices
     WHERE user_id = ? AND device_id = ?`,
  )
    .bind(userId, deviceId)
    .first<ApprovedDeviceRow>();
  if (!row || row.approval_status !== 'approved' || !isValidSpkiPub(row.signing_key_pub || '')) {
    return null;
  }
  return row;
}

export async function cleanupExpiredTransfers(env: Env, userId?: number): Promise<number> {
  try {
    const query = userId
      ? env.DB.prepare(
          `SELECT transfer_id, r2_key, expires_at
           FROM e2ee_device_transfers
           WHERE user_id = ? AND status IN ('pending', 'uploaded')
           LIMIT 25`,
        ).bind(userId)
      : env.DB.prepare(
          `SELECT transfer_id, r2_key, expires_at
           FROM e2ee_device_transfers
           WHERE status IN ('pending', 'uploaded')
           LIMIT 25`,
        );
    const res = await query.all<{ transfer_id: string; r2_key: string; expires_at: string }>();
    const now = Date.now();
    let cleaned = 0;
    for (const row of res.results || []) {
      if (parseUtcMs(row.expires_at) > now) continue;
      if (row.r2_key && env.STORAGE) {
        try {
          await env.STORAGE.delete(row.r2_key);
        } catch {}
      }
      await env.DB.prepare(
        `UPDATE e2ee_device_transfers
         SET status = 'expired', r2_key = ''
         WHERE transfer_id = ? AND status IN ('pending', 'uploaded')`,
      )
        .bind(row.transfer_id)
        .run();
      cleaned++;
    }
    return cleaned;
  } catch {
    return 0;
  }
}

export async function handleGetBackupStatus(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:st:${user.id}`, 60, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  await cleanupExpiredTransfers(env, user.id);

  const backup = await env.DB.prepare(
    `SELECT user_id, enabled, backup_epoch, backup_version, kdf_salt, signer_device_id, manifest_sig,
            chunk_count, base_chunk_count, total_size_bytes, message_count, last_msg_id, last_backup_at, updated_at
     FROM e2ee_backups
     WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<BackupRow>();

  if (!backup) {
    return jsonResponse(
      {
        success: true,
        backup: {
          exists: false,
          enabled: false,
          backup_epoch: 1,
          backup_version: 0,
          kdf_salt: '',
          signer_device_id: 0,
          manifest_sig: '',
          chunk_count: 0,
          base_chunk_count: 0,
          total_size_bytes: 0,
          message_count: 0,
          last_msg_id: 0,
          last_backup_at: null,
        },
        chunks: [],
        limits: {
          max_chunk_bytes: MAX_BACKUP_CHUNK_BYTES,
          max_total_bytes: MAX_BACKUP_TOTAL_BYTES,
          max_chunks_per_epoch: MAX_BACKUP_CHUNKS_PER_EPOCH,
        },
      },
      200,
    );
  }

  const chunkRes = await env.DB.prepare(
    `SELECT backup_epoch, chunk_seq, iv_b64, sha256_b64, size_bytes, msg_count, max_msg_id
     FROM e2ee_backup_chunks
     WHERE user_id = ? AND backup_epoch = ? AND is_staged = 0
     ORDER BY chunk_seq ASC`,
  )
    .bind(user.id, Number(backup.backup_epoch))
    .all<BackupChunkRow>();

  const chunks = (chunkRes.results || []).map((c) => ({
    chunk_seq: Number(c.chunk_seq),
    iv_b64: c.iv_b64,
    sha256_b64: c.sha256_b64,
    size_bytes: Number(c.size_bytes),
    msg_count: Number(c.msg_count || 0),
    max_msg_id: Number(c.max_msg_id || 0),
  }));

  return jsonResponse(
    {
      success: true,
      backup: {
        exists: chunks.length > 0 && Number(backup.backup_version) > 0 && Boolean(backup.kdf_salt),
        enabled: Number(backup.enabled) === 1,
        backup_epoch: Number(backup.backup_epoch),
        backup_version: Number(backup.backup_version),
        kdf_salt: backup.kdf_salt || '',
        signer_device_id: Number(backup.signer_device_id || 0),
        manifest_sig: backup.manifest_sig || '',
        chunk_count: chunks.length,
        base_chunk_count: Math.min(chunks.length, Math.max(0, Number(backup.base_chunk_count || 0))),
        total_size_bytes: Number(backup.total_size_bytes || 0),
        message_count: Number(backup.message_count || 0),
        last_msg_id: Number(backup.last_msg_id || 0),
        last_backup_at: backup.last_backup_at || null,
      },
      chunks,
      limits: {
        max_chunk_bytes: MAX_BACKUP_CHUNK_BYTES,
        max_total_bytes: MAX_BACKUP_TOTAL_BYTES,
        max_chunks_per_epoch: MAX_BACKUP_CHUNKS_PER_EPOCH,
      },
    },
    200,
  );
}

export async function handleToggleBackup(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:tog:${user.id}`, 30, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ enabled?: unknown }>(request, 1024);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);
  const enabledInt = parsed.data?.enabled === true || parsed.data?.enabled === 1 ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO e2ee_backups (user_id, enabled, backup_epoch, backup_version, updated_at)
     VALUES (?, ?, 1, 0, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = datetime('now')`,
  )
    .bind(user.id, enabledInt)
    .run();

  return jsonResponse({ success: true, enabled: enabledInt === 1 }, 200);
}

export async function handleStageBackupChunk(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:stg:${user.id}`, 60, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  if (!checkContentLength(request, MAX_BACKUP_CHUNK_BYTES + 131072)) {
    return jsonError(t.common.networkError, 413, 'CHUNK_TOO_LARGE');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const deviceId = parsePositiveId(form.get('device_id'));
  const targetEpoch = parsePositiveId(form.get('target_epoch'));
  const chunkSeq = Number(form.get('chunk_seq'));
  const ivB64 = String(form.get('iv_b64') || '').trim();
  const sha256B64 = String(form.get('sha256_b64') || '').trim();
  const msgCount = Math.max(0, Math.floor(Number(form.get('msg_count') || 0)));
  const maxMsgId = Math.max(0, Math.floor(Number(form.get('max_msg_id') || 0)));
  const signature = String(form.get('signature') || '').trim();
  const chunkFile = form.get('chunk');

  if (
    !deviceId ||
    !targetEpoch ||
    !Number.isInteger(chunkSeq) ||
    chunkSeq < 0 ||
    chunkSeq >= MAX_BACKUP_CHUNKS_PER_EPOCH ||
    !isValidIvB64(ivB64) ||
    !isValidSha256B64(sha256B64) ||
    !isValidSig64(signature) ||
    !chunkFile ||
    typeof chunkFile !== 'object' ||
    typeof (chunkFile as File).arrayBuffer !== 'function'
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const device = await getApprovedDevice(env, user.id, deviceId);
  if (!device) return jsonError(t.common.networkError, 403, 'DEVICE_NOT_APPROVED');

  const rawBuf = await (chunkFile as File).arrayBuffer();
  const bytes = new Uint8Array(rawBuf);
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_BACKUP_CHUNK_BYTES) {
    return jsonError(t.common.networkError, 413, 'CHUNK_TOO_LARGE');
  }

  const actualSha = await sha256Base64(bytes);
  if (actualSha !== sha256B64) {
    return jsonError(t.common.networkError, 400, 'CHECKSUM_MISMATCH');
  }

  const stageMsg = buildBackupStageMsg(user.id, deviceId, targetEpoch, chunkSeq, ivB64, sha256B64, bytes.byteLength);
  const sigOk = await verifyEcdsaP256(device.signing_key_pub, stageMsg, signature);
  if (!sigOk) {
    return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');
  }

  const [curBackup, stagedSum] = await Promise.all([
    env.DB.prepare('SELECT backup_epoch, backup_version FROM e2ee_backups WHERE user_id = ?')
      .bind(user.id)
      .first<{ backup_epoch: number; backup_version: number }>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes, COUNT(*) AS cnt
       FROM e2ee_backup_chunks
       WHERE user_id = ? AND backup_epoch = ? AND chunk_seq != ?`,
    )
      .bind(user.id, targetEpoch, chunkSeq)
      .first<{ total_bytes: number; cnt: number }>(),
  ]);

  const curEpoch = Number(curBackup?.backup_epoch || 1);
  const curVersion = Number(curBackup?.backup_version || 0);
  if (curVersion > 0 && targetEpoch <= curEpoch) {
    return jsonError(t.common.networkError, 409, 'EPOCH_CONFLICT', {
      current_epoch: curEpoch,
      current_version: curVersion,
    });
  }

  const nextEpochTotal = Number(stagedSum?.total_bytes || 0) + bytes.byteLength;
  if (nextEpochTotal > MAX_BACKUP_TOTAL_BYTES) {
    return jsonError(t.common.networkError, 413, 'BACKUP_QUOTA_EXCEEDED');
  }

  const r2Key = `backups/u_${user.id}/e_${targetEpoch}/c_${chunkSeq}.bin`;
  await env.STORAGE.put(r2Key, rawBuf, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO e2ee_backup_chunks (
         user_id, backup_epoch, chunk_seq, r2_key, iv_b64, sha256_b64, size_bytes, msg_count, max_msg_id, is_staged
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(user_id, backup_epoch, chunk_seq) DO UPDATE SET
         r2_key = excluded.r2_key,
         iv_b64 = excluded.iv_b64,
         sha256_b64 = excluded.sha256_b64,
         size_bytes = excluded.size_bytes,
         msg_count = excluded.msg_count,
         max_msg_id = excluded.max_msg_id,
         is_staged = 1,
         created_at = datetime('now')`,
    )
      .bind(user.id, targetEpoch, chunkSeq, r2Key, ivB64, sha256B64, bytes.byteLength, msgCount, maxMsgId)
      .run();
  } catch (err) {
    try {
      await env.STORAGE.delete(r2Key);
    } catch {}
    throw err;
  }

  return jsonResponse(
    {
      success: true,
      target_epoch: targetEpoch,
      chunk_seq: chunkSeq,
      size_bytes: bytes.byteLength,
      sha256_b64: actualSha,
    },
    200,
  );
}

export async function handleCommitBackupEpoch(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:com:${user.id}`, 30, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    device_id?: unknown;
    target_epoch?: unknown;
    expected_version?: unknown;
    next_version?: unknown;
    kdf_salt?: unknown;
    total_message_count?: unknown;
    last_msg_id?: unknown;
    enabled?: unknown;
    chunks?: Array<{ chunk_seq?: unknown; sha256_b64?: unknown; size_bytes?: unknown }>;
    signature?: unknown;
  }>(request, 32768);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const body = parsed.data;
  const deviceId = parsePositiveId(body?.device_id);
  const targetEpoch = parsePositiveId(body?.target_epoch);
  const expectedVersion = Number(body?.expected_version);
  const nextVersion = Number(body?.next_version);
  const kdfSalt = typeof body?.kdf_salt === 'string' ? body.kdf_salt.trim() : '';
  const totalMessageCount = Math.max(0, Math.floor(Number(body?.total_message_count || 0)));
  const lastMsgId = Math.max(0, Math.floor(Number(body?.last_msg_id || 0)));
  const signature = typeof body?.signature === 'string' ? body.signature.trim() : '';
  const incomingChunks = Array.isArray(body?.chunks) ? body.chunks : [];

  if (
    !deviceId ||
    !targetEpoch ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0 ||
    !Number.isInteger(nextVersion) ||
    nextVersion !== expectedVersion + 1 ||
    !isValidSaltB64(kdfSalt) ||
    !isValidSig64(signature) ||
    incomingChunks.length === 0 ||
    incomingChunks.length > MAX_BACKUP_CHUNKS_PER_EPOCH
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const device = await getApprovedDevice(env, user.id, deviceId);
  if (!device) return jsonError(t.common.networkError, 403, 'DEVICE_NOT_APPROVED');

  const normChunks: Array<{ chunk_seq: number; sha256_b64: string; size_bytes: number }> = [];
  for (let i = 0; i < incomingChunks.length; i++) {
    const c = incomingChunks[i];
    const seq = Number(c?.chunk_seq);
    const sha = typeof c?.sha256_b64 === 'string' ? c.sha256_b64.trim() : '';
    const sz = Number(c?.size_bytes);
    if (seq !== i || !isValidSha256B64(sha) || !Number.isInteger(sz) || sz < 16 || sz > MAX_BACKUP_CHUNK_BYTES) {
      return jsonError(t.common.networkError, 400, 'INVALID_CHUNKS');
    }
    normChunks.push({ chunk_seq: seq, sha256_b64: sha, size_bytes: sz });
  }

  const totalBytes = normChunks.reduce((acc, c) => acc + c.size_bytes, 0);
  if (totalBytes > MAX_BACKUP_TOTAL_BYTES) {
    return jsonError(t.common.networkError, 413, 'BACKUP_QUOTA_EXCEEDED');
  }

  const digestsCsv = normChunks.map((c) => `${c.chunk_seq}:${c.sha256_b64}:${c.size_bytes}`).join(',');
  const commitMsg = buildBackupCommitMsg(
    user.id,
    deviceId,
    targetEpoch,
    expectedVersion,
    nextVersion,
    kdfSalt,
    digestsCsv,
  );
  const sigOk = await verifyEcdsaP256(device.signing_key_pub, commitMsg, signature);
  if (!sigOk) return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');

  const [curBackup, stagedRes] = await Promise.all([
    env.DB.prepare('SELECT enabled, backup_epoch, backup_version FROM e2ee_backups WHERE user_id = ?')
      .bind(user.id)
      .first<{ enabled: number; backup_epoch: number; backup_version: number }>(),
    env.DB.prepare(
      `SELECT chunk_seq, sha256_b64, size_bytes, r2_key
       FROM e2ee_backup_chunks
       WHERE user_id = ? AND backup_epoch = ?
       ORDER BY chunk_seq ASC`,
    )
      .bind(user.id, targetEpoch)
      .all<BackupChunkRow>(),
  ]);

  const curVer = Number(curBackup?.backup_version || 0);
  const curEpoch = Number(curBackup?.backup_epoch || 1);
  if (curVer !== expectedVersion) {
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT', {
      current_version: curVer,
      current_epoch: curEpoch,
    });
  }
  if (curVer > 0 && targetEpoch <= curEpoch) {
    return jsonError(t.common.networkError, 409, 'EPOCH_CONFLICT', {
      current_version: curVer,
      current_epoch: curEpoch,
    });
  }

  const stagedRows = stagedRes.results || [];
  if (stagedRows.length !== normChunks.length) {
    return jsonError(t.common.networkError, 409, 'STAGED_CHUNKS_MISMATCH');
  }
  for (let i = 0; i < normChunks.length; i++) {
    if (
      Number(stagedRows[i].chunk_seq) !== normChunks[i].chunk_seq ||
      stagedRows[i].sha256_b64 !== normChunks[i].sha256_b64 ||
      Number(stagedRows[i].size_bytes) !== normChunks[i].size_bytes
    ) {
      return jsonError(t.common.networkError, 409, 'STAGED_CHUNKS_MISMATCH');
    }
  }

  const enabledInt =
    body?.enabled === true || body?.enabled === 1
      ? 1
      : body?.enabled === false || body?.enabled === 0
        ? 0
        : curBackup
          ? Number(curBackup.enabled)
          : 1;

  const upsertStmt = !curBackup
    ? env.DB.prepare(
        `INSERT INTO e2ee_backups (
           user_id, enabled, backup_epoch, backup_version, kdf_salt, signer_device_id, manifest_sig,
           chunk_count, base_chunk_count, total_size_bytes, message_count, last_msg_id, last_backup_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         RETURNING backup_version`,
      ).bind(
        user.id,
        enabledInt,
        targetEpoch,
        nextVersion,
        kdfSalt,
        deviceId,
        signature,
        normChunks.length,
        normChunks.length,
        totalBytes,
        totalMessageCount,
        lastMsgId,
      )
    : env.DB.prepare(
        `UPDATE e2ee_backups
         SET enabled = ?,
             backup_epoch = ?,
             backup_version = ?,
             kdf_salt = ?,
             signer_device_id = ?,
             manifest_sig = ?,
             chunk_count = ?,
             base_chunk_count = ?,
             total_size_bytes = ?,
             message_count = ?,
             last_msg_id = ?,
             last_backup_at = datetime('now'),
             updated_at = datetime('now')
         WHERE user_id = ? AND backup_version = ?
         RETURNING backup_version`,
      ).bind(
        enabledInt,
        targetEpoch,
        nextVersion,
        kdfSalt,
        deviceId,
        signature,
        normChunks.length,
        normChunks.length,
        totalBytes,
        totalMessageCount,
        lastMsgId,
        user.id,
        expectedVersion,
      );

  const finalizeChunksStmt = env.DB.prepare(
    `UPDATE e2ee_backup_chunks
     SET is_staged = 0
     WHERE user_id = ? AND backup_epoch = ?
       AND EXISTS (
         SELECT 1 FROM e2ee_backups
         WHERE user_id = ? AND backup_epoch = ? AND backup_version = ?
       )`,
  ).bind(user.id, targetEpoch, user.id, targetEpoch, nextVersion);

  let batchRes: unknown[];
  try {
    batchRes = await execDbBatch(env, [upsertStmt, finalizeChunksStmt]);
  } catch {
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT');
  }

  if (batchRowCount(batchRes[0]) !== 1) {
    const latest = await env.DB.prepare('SELECT backup_epoch, backup_version FROM e2ee_backups WHERE user_id = ?')
      .bind(user.id)
      .first<{ backup_epoch: number; backup_version: number }>();
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT', {
      current_version: Number(latest?.backup_version || 0),
      current_epoch: Number(latest?.backup_epoch || 1),
    });
  }

  const oldChunksRes = await env.DB.prepare(
    `SELECT backup_epoch, chunk_seq, r2_key
     FROM e2ee_backup_chunks
     WHERE user_id = ? AND backup_epoch != ?`,
  )
    .bind(user.id, targetEpoch)
    .all<{ backup_epoch: number; chunk_seq: number; r2_key: string }>();

  const oldRows = oldChunksRes.results || [];
  for (const old of oldRows) {
    if (old.r2_key) {
      try {
        await env.STORAGE.delete(old.r2_key);
      } catch {}
    }
  }
  if (oldRows.length > 0) {
    await env.DB.prepare('DELETE FROM e2ee_backup_chunks WHERE user_id = ? AND backup_epoch != ?')
      .bind(user.id, targetEpoch)
      .run();
  }

  return jsonResponse(
    {
      success: true,
      backup_epoch: targetEpoch,
      backup_version: nextVersion,
      chunk_count: normChunks.length,
      total_size_bytes: totalBytes,
      cleaned_old_chunks: oldRows.length,
    },
    200,
  );
}

export async function handleUploadBackupDelta(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:del:${user.id}`, 45, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  if (!checkContentLength(request, MAX_BACKUP_CHUNK_BYTES + 131072)) {
    return jsonError(t.common.networkError, 413, 'CHUNK_TOO_LARGE');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const deviceId = parsePositiveId(form.get('device_id'));
  const epoch = parsePositiveId(form.get('epoch'));
  const expectedVersion = Number(form.get('expected_version'));
  const nextVersion = expectedVersion + 1;
  const chunkSeq = Number(form.get('chunk_seq'));
  const ivB64 = String(form.get('iv_b64') || '').trim();
  const sha256B64 = String(form.get('sha256_b64') || '').trim();
  const msgCount = Math.max(0, Math.floor(Number(form.get('msg_count') || 0)));
  const maxMsgId = Math.max(0, Math.floor(Number(form.get('max_msg_id') || 0)));
  const totalMessageCount = Math.max(0, Math.floor(Number(form.get('total_message_count') || 0)));
  const kdfSalt = String(form.get('kdf_salt') || '').trim();
  const signature = String(form.get('signature') || '').trim();
  const chunkFile = form.get('chunk');

  if (
    !deviceId ||
    !epoch ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion <= 0 ||
    !Number.isInteger(chunkSeq) ||
    chunkSeq <= 0 ||
    chunkSeq >= MAX_BACKUP_CHUNKS_PER_EPOCH ||
    !isValidIvB64(ivB64) ||
    !isValidSha256B64(sha256B64) ||
    !isValidSaltB64(kdfSalt) ||
    !isValidSig64(signature) ||
    !chunkFile ||
    typeof chunkFile !== 'object' ||
    typeof (chunkFile as File).arrayBuffer !== 'function'
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const device = await getApprovedDevice(env, user.id, deviceId);
  if (!device) return jsonError(t.common.networkError, 403, 'DEVICE_NOT_APPROVED');

  const rawBuf = await (chunkFile as File).arrayBuffer();
  const bytes = new Uint8Array(rawBuf);
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_BACKUP_CHUNK_BYTES) {
    return jsonError(t.common.networkError, 413, 'CHUNK_TOO_LARGE');
  }

  const actualSha = await sha256Base64(bytes);
  if (actualSha !== sha256B64) {
    return jsonError(t.common.networkError, 400, 'CHECKSUM_MISMATCH');
  }

  const deltaMsg = buildBackupDeltaMsg(
    user.id,
    deviceId,
    epoch,
    expectedVersion,
    nextVersion,
    chunkSeq,
    ivB64,
    sha256B64,
    bytes.byteLength,
    kdfSalt,
  );
  const sigOk = await verifyEcdsaP256(device.signing_key_pub, deltaMsg, signature);
  if (!sigOk) return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');

  const cur = await env.DB.prepare(
    `SELECT backup_epoch, backup_version, kdf_salt, chunk_count, total_size_bytes
     FROM e2ee_backups
     WHERE user_id = ?`,
  )
    .bind(user.id)
    .first<BackupRow>();

  if (
    !cur ||
    Number(cur.backup_version) !== expectedVersion ||
    Number(cur.backup_epoch) !== epoch ||
    cur.kdf_salt !== kdfSalt ||
    Number(cur.chunk_count) !== chunkSeq
  ) {
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT', {
      current_version: Number(cur?.backup_version || 0),
      current_epoch: Number(cur?.backup_epoch || 1),
      current_chunk_count: Number(cur?.chunk_count || 0),
    });
  }

  if (Number(cur.total_size_bytes || 0) + bytes.byteLength > MAX_BACKUP_TOTAL_BYTES) {
    return jsonError(t.common.networkError, 413, 'BACKUP_QUOTA_EXCEEDED');
  }

  const r2Key = `backups/u_${user.id}/e_${epoch}/c_${chunkSeq}.bin`;
  await env.STORAGE.put(r2Key, rawBuf, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  const updBackupStmt = env.DB.prepare(
    `UPDATE e2ee_backups
     SET backup_version = ?,
         signer_device_id = ?,
         manifest_sig = ?,
         chunk_count = chunk_count + 1,
         total_size_bytes = total_size_bytes + ?,
         message_count = ?,
         last_msg_id = CASE WHEN ? > last_msg_id THEN ? ELSE last_msg_id END,
         last_backup_at = datetime('now'),
         updated_at = datetime('now')
     WHERE user_id = ? AND backup_epoch = ? AND backup_version = ? AND chunk_count = ?
     RETURNING backup_version`,
  ).bind(
    nextVersion,
    deviceId,
    signature,
    bytes.byteLength,
    totalMessageCount,
    maxMsgId,
    maxMsgId,
    user.id,
    epoch,
    expectedVersion,
    chunkSeq,
  );

  const insChunkStmt = env.DB.prepare(
    `INSERT INTO e2ee_backup_chunks (
       user_id, backup_epoch, chunk_seq, r2_key, iv_b64, sha256_b64, size_bytes, msg_count, max_msg_id, is_staged
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 0
     WHERE EXISTS (
       SELECT 1 FROM e2ee_backups
       WHERE user_id = ? AND backup_epoch = ? AND backup_version = ? AND manifest_sig = ?
     )
     RETURNING chunk_seq`,
  ).bind(
    user.id,
    epoch,
    chunkSeq,
    r2Key,
    ivB64,
    sha256B64,
    bytes.byteLength,
    msgCount,
    maxMsgId,
    user.id,
    epoch,
    nextVersion,
    signature,
  );

  let batchRes: unknown[];
  try {
    batchRes = await execDbBatch(env, [updBackupStmt, insChunkStmt]);
  } catch {
    try {
      await env.STORAGE.delete(r2Key);
    } catch {}
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT');
  }

  if (batchRowCount(batchRes[0]) !== 1 || batchRowCount(batchRes[1]) !== 1) {
    try {
      await env.STORAGE.delete(r2Key);
    } catch {}
    const latest = await env.DB.prepare('SELECT backup_epoch, backup_version, chunk_count FROM e2ee_backups WHERE user_id = ?')
      .bind(user.id)
      .first<{ backup_epoch: number; backup_version: number; chunk_count: number }>();
    return jsonError(t.common.networkError, 409, 'BACKUP_VERSION_CONFLICT', {
      current_version: Number(latest?.backup_version || 0),
      current_epoch: Number(latest?.backup_epoch || 1),
      current_chunk_count: Number(latest?.chunk_count || 0),
    });
  }

  return jsonResponse(
    {
      success: true,
      backup_epoch: epoch,
      backup_version: nextVersion,
      chunk_seq: chunkSeq,
      chunk_count: chunkSeq + 1,
      total_size_bytes: Number(cur.total_size_bytes || 0) + bytes.byteLength,
    },
    200,
  );
}

export async function handleDownloadBackupChunk(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:get:${user.id}`, 90, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const epoch = parsePositiveId(url.searchParams.get('epoch'));
  const seqRaw = url.searchParams.get('seq');
  const seq = seqRaw !== null && /^\d+$/.test(seqRaw) ? Number(seqRaw) : -1;
  if (!epoch || seq < 0 || seq >= MAX_BACKUP_CHUNKS_PER_EPOCH) {
    return jsonError(t.common.networkError, 400);
  }

  const row = await env.DB.prepare(
    `SELECT r2_key, iv_b64, sha256_b64, size_bytes
     FROM e2ee_backup_chunks
     WHERE user_id = ? AND backup_epoch = ? AND chunk_seq = ? AND is_staged = 0`,
  )
    .bind(user.id, epoch, seq)
    .first<BackupChunkRow>();

  if (!row || !row.r2_key || !row.r2_key.startsWith(`backups/u_${user.id}/`)) {
    return jsonError(t.common.networkError, 404, 'CHUNK_NOT_FOUND');
  }

  const obj = await env.STORAGE.get(row.r2_key);
  if (!obj) {
    return jsonError(t.common.networkError, 404, 'CHUNK_NOT_FOUND');
  }
  const buf = await obj.arrayBuffer();

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Chunk-Iv': row.iv_b64,
      'X-Chunk-Sha256': row.sha256_b64,
    },
  });
}

export async function handleDeleteBackup(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:bk:rm:${user.id}`, 10, 3600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{
    device_id?: unknown;
    expected_version?: unknown;
    timestamp?: unknown;
    signature?: unknown;
    password?: unknown;
  }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const deviceId = parsePositiveId(parsed.data?.device_id);
  const expectedVersion = Number(parsed.data?.expected_version ?? 0);
  const ts = Number(parsed.data?.timestamp ?? 0);
  const signature = typeof parsed.data?.signature === 'string' ? parsed.data.signature.trim() : '';
  const password = typeof parsed.data?.password === 'string' ? parsed.data.password : '';

  let authorized = false;
  if (deviceId && Number.isInteger(expectedVersion) && expectedVersion >= 0 && Math.abs(Date.now() - ts) <= PROOF_WINDOW_MS && isValidSig64(signature)) {
    const dev = await getApprovedDevice(env, user.id, deviceId);
    if (dev) {
      const msg = buildBackupDeleteMsg(user.id, deviceId, expectedVersion, Math.floor(ts));
      authorized = await verifyEcdsaP256(dev.signing_key_pub, msg, signature);
    }
  } else if (password && password.length <= 256) {
    const uRow = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ password_hash: string }>();
    if (uRow) {
      authorized = await verifyPassword(password, uRow.password_hash);
    }
  }

  if (!authorized) {
    return jsonError(t.common.networkError, 403, 'PROOF_REQUIRED');
  }

  const chunksRes = await env.DB.prepare('SELECT r2_key FROM e2ee_backup_chunks WHERE user_id = ?')
    .bind(user.id)
    .all<{ r2_key: string }>();

  for (const row of chunksRes.results || []) {
    if (row.r2_key) {
      try {
        await env.STORAGE.delete(row.r2_key);
      } catch {}
    }
  }

  const cur = await env.DB.prepare('SELECT backup_epoch, backup_version FROM e2ee_backups WHERE user_id = ?')
    .bind(user.id)
    .first<{ backup_epoch: number; backup_version: number }>();

  const nextEpoch = Number(cur?.backup_epoch || 1) + 1;
  const nextVer = Number(cur?.backup_version || 0) + 1;

  await execDbBatch(env, [
    env.DB.prepare('DELETE FROM e2ee_backup_chunks WHERE user_id = ?').bind(user.id),
    env.DB.prepare(
      `INSERT INTO e2ee_backups (
         user_id, enabled, backup_epoch, backup_version, kdf_salt, signer_device_id, manifest_sig,
         chunk_count, base_chunk_count, total_size_bytes, message_count, last_msg_id, last_backup_at, updated_at
       ) VALUES (?, 0, ?, ?, '', 0, '', 0, 0, 0, 0, 0, NULL, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         enabled = 0,
         backup_epoch = excluded.backup_epoch,
         backup_version = excluded.backup_version,
         kdf_salt = '',
         signer_device_id = 0,
         manifest_sig = '',
         chunk_count = 0,
         base_chunk_count = 0,
         total_size_bytes = 0,
         message_count = 0,
         last_msg_id = 0,
         last_backup_at = NULL,
         updated_at = datetime('now')`,
    ).bind(user.id, nextEpoch, nextVer),
  ]);

  return jsonResponse({ success: true, backup_epoch: nextEpoch, backup_version: nextVer }, 200);
}

export async function handleTransferInit(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:xf:init:${user.id}`, 15, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  await cleanupExpiredTransfers(env, user.id);

  const parsed = await readJsonWithLimit<{
    device_id?: unknown;
    transfer_id?: unknown;
    requester_eph_pub?: unknown;
    signature?: unknown;
  }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const deviceId = parsePositiveId(parsed.data?.device_id);
  const transferId = typeof parsed.data?.transfer_id === 'string' ? parsed.data.transfer_id.trim() : '';
  const requesterEphPub = typeof parsed.data?.requester_eph_pub === 'string' ? parsed.data.requester_eph_pub.trim() : '';
  const signature = typeof parsed.data?.signature === 'string' ? parsed.data.signature.trim() : '';

  if (
    !deviceId ||
    !/^[a-f0-9]{24,64}$/i.test(transferId) ||
    !isValidSpkiPub(requesterEphPub) ||
    !isValidSig64(signature)
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const device = await getApprovedDevice(env, user.id, deviceId);
  if (!device) return jsonError(t.common.networkError, 403, 'DEVICE_NOT_APPROVED');

  const initMsg = buildTransferInitMsg(user.id, transferId, deviceId, requesterEphPub);
  const sigOk = await verifyEcdsaP256(device.signing_key_pub, initMsg, signature);
  if (!sigOk) return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');

  const expiresAt = new Date(Date.now() + TRANSFER_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO e2ee_device_transfers (
       transfer_id, user_id, requester_device_id, requester_eph_pub, requester_sig, status, expires_at
     ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(transferId, user.id, deviceId, requesterEphPub, signature, expiresAt)
    .run();

  try {
    await emitUserEvent(env, user.id, {
      type: 'e2ee.transfer_requested',
      transfer_id: transferId,
      requester_device_id: deviceId,
    });
  } catch {}

  return jsonResponse(
    {
      success: true,
      transfer_id: transferId,
      requester_device_id: deviceId,
      expires_at: expiresAt,
    },
    200,
  );
}

export async function handleTransferListPending(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:xf:ls:${user.id}`, 60, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  await cleanupExpiredTransfers(env, user.id);

  const res = await env.DB.prepare(
    `SELECT transfer_id, requester_device_id, requester_eph_pub, requester_sig,
            sender_device_id, sender_eph_pub, sender_signature, iv_b64, payload_sha256,
            size_bytes, status, expires_at, created_at
     FROM e2ee_device_transfers
     WHERE user_id = ? AND status IN ('pending', 'uploaded')
     ORDER BY created_at DESC
     LIMIT 10`,
  )
    .bind(user.id)
    .all<TransferRow>();

  const now = Date.now();
  const transfers = (res.results || [])
    .filter((r) => parseUtcMs(r.expires_at) > now)
    .map((r) => ({
      transfer_id: r.transfer_id,
      requester_device_id: Number(r.requester_device_id),
      requester_eph_pub: r.requester_eph_pub,
      requester_sig: r.requester_sig,
      sender_device_id: r.sender_device_id ? Number(r.sender_device_id) : null,
      sender_eph_pub: r.sender_eph_pub || '',
      sender_signature: r.sender_signature || '',
      iv_b64: r.iv_b64 || '',
      payload_sha256: r.payload_sha256 || '',
      size_bytes: Number(r.size_bytes || 0),
      status: r.status,
      expires_at: r.expires_at,
    }));

  return jsonResponse({ success: true, transfers }, 200);
}

export async function handleTransferUpload(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:xf:up:${user.id}`, 10, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  await cleanupExpiredTransfers(env, user.id);

  if (!checkContentLength(request, MAX_TRANSFER_BYTES + 131072)) {
    return jsonError(t.common.networkError, 413, 'TRANSFER_TOO_LARGE');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const transferId = String(form.get('transfer_id') || '').trim();
  const senderDeviceId = parsePositiveId(form.get('sender_device_id'));
  const senderEphPub = String(form.get('sender_eph_pub') || '').trim();
  const ivB64 = String(form.get('iv_b64') || '').trim();
  const payloadSha256 = String(form.get('payload_sha256') || '').trim();
  const signature = String(form.get('signature') || '').trim();
  const payloadFile = form.get('payload');

  if (
    !/^[a-f0-9]{24,64}$/i.test(transferId) ||
    !senderDeviceId ||
    !isValidSpkiPub(senderEphPub) ||
    !isValidIvB64(ivB64) ||
    !isValidSha256B64(payloadSha256) ||
    !isValidSig64(signature) ||
    !payloadFile ||
    typeof payloadFile !== 'object' ||
    typeof (payloadFile as File).arrayBuffer !== 'function'
  ) {
    return jsonError(t.common.networkError, 400, 'INVALID_PAYLOAD');
  }

  const [senderDev, xfer] = await Promise.all([
    getApprovedDevice(env, user.id, senderDeviceId),
    env.DB.prepare(
      `SELECT transfer_id, user_id, requester_device_id, requester_eph_pub, status, expires_at
       FROM e2ee_device_transfers
       WHERE transfer_id = ? AND user_id = ?`,
    )
      .bind(transferId, user.id)
      .first<TransferRow>(),
  ]);

  if (!senderDev) return jsonError(t.common.networkError, 403, 'DEVICE_NOT_APPROVED');
  if (!xfer) return jsonError(t.common.networkError, 404, 'TRANSFER_NOT_FOUND');
  if (xfer.status !== 'pending') return jsonError(t.common.networkError, 409, 'TRANSFER_ALREADY_USED');
  if (parseUtcMs(xfer.expires_at) <= Date.now()) {
    return jsonError(t.common.networkError, 410, 'TRANSFER_EXPIRED');
  }
  if (Number(xfer.requester_device_id) === senderDeviceId) {
    return jsonError(t.common.networkError, 400, 'SAME_DEVICE_TRANSFER');
  }

  const rawBuf = await (payloadFile as File).arrayBuffer();
  const bytes = new Uint8Array(rawBuf);
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_TRANSFER_BYTES) {
    return jsonError(t.common.networkError, 413, 'TRANSFER_TOO_LARGE');
  }

  const actualSha = await sha256Base64(bytes);
  if (actualSha !== payloadSha256) {
    return jsonError(t.common.networkError, 400, 'CHECKSUM_MISMATCH');
  }

  const uploadMsg = buildTransferUploadMsg(
    user.id,
    transferId,
    Number(xfer.requester_device_id),
    xfer.requester_eph_pub,
    senderDeviceId,
    senderEphPub,
    ivB64,
    payloadSha256,
    bytes.byteLength,
  );
  const sigOk = await verifyEcdsaP256(senderDev.signing_key_pub, uploadMsg, signature);
  if (!sigOk) return jsonError(t.common.networkError, 403, 'INVALID_SIGNATURE');

  const r2Key = `transfers/u_${user.id}/${transferId}.bin`;
  await env.STORAGE.put(r2Key, rawBuf, {
    httpMetadata: { contentType: 'application/octet-stream' },
  });

  const upd = await env.DB.prepare(
    `UPDATE e2ee_device_transfers
     SET sender_device_id = ?,
         sender_eph_pub = ?,
         sender_signature = ?,
         r2_key = ?,
         iv_b64 = ?,
         payload_sha256 = ?,
         size_bytes = ?,
         status = 'uploaded'
     WHERE transfer_id = ? AND user_id = ? AND status = 'pending'
     RETURNING transfer_id`,
  )
    .bind(senderDeviceId, senderEphPub, signature, r2Key, ivB64, payloadSha256, bytes.byteLength, transferId, user.id)
    .first<{ transfer_id: string }>();

  if (!upd) {
    try {
      await env.STORAGE.delete(r2Key);
    } catch {}
    return jsonError(t.common.networkError, 409, 'TRANSFER_ALREADY_USED');
  }

  try {
    await emitUserEvent(env, user.id, {
      type: 'e2ee.transfer_ready',
      transfer_id: transferId,
      requester_device_id: Number(xfer.requester_device_id),
      sender_device_id: senderDeviceId,
    });
  } catch {}

  return jsonResponse({ success: true, transfer_id: transferId, size_bytes: bytes.byteLength }, 200);
}

export async function handleTransferDownload(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:xf:dl:${user.id}`, 30, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  await cleanupExpiredTransfers(env, user.id);

  const transferId = (url.searchParams.get('transfer_id') || '').trim();
  const deviceId = parsePositiveId(url.searchParams.get('device_id'));
  if (!/^[a-f0-9]{24,64}$/i.test(transferId) || !deviceId) {
    return jsonError(t.common.networkError, 400);
  }

  const xfer = await env.DB.prepare(
    `SELECT transfer_id, requester_device_id, sender_device_id, sender_eph_pub, sender_signature,
            r2_key, iv_b64, payload_sha256, status, expires_at
     FROM e2ee_device_transfers
     WHERE transfer_id = ? AND user_id = ?`,
  )
    .bind(transferId, user.id)
    .first<TransferRow>();

  if (!xfer || Number(xfer.requester_device_id) !== deviceId) {
    return jsonError(t.common.networkError, 404, 'TRANSFER_NOT_FOUND');
  }
  if (xfer.status !== 'uploaded') {
    return jsonError(t.common.networkError, 409, 'TRANSFER_NOT_READY');
  }
  if (parseUtcMs(xfer.expires_at) <= Date.now()) {
    return jsonError(t.common.networkError, 410, 'TRANSFER_EXPIRED');
  }
  if (!xfer.r2_key || !xfer.r2_key.startsWith(`transfers/u_${user.id}/`)) {
    return jsonError(t.common.networkError, 404, 'TRANSFER_NOT_FOUND');
  }

  const obj = await env.STORAGE.get(xfer.r2_key);
  if (!obj) return jsonError(t.common.networkError, 404, 'TRANSFER_NOT_FOUND');
  const buf = await obj.arrayBuffer();

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Transfer-Sender-Device': String(xfer.sender_device_id || 0),
      'X-Transfer-Sender-Eph-Pub': xfer.sender_eph_pub || '',
      'X-Transfer-Sender-Sig': xfer.sender_signature || '',
      'X-Transfer-Iv': xfer.iv_b64 || '',
      'X-Transfer-Sha256': xfer.payload_sha256 || '',
    },
  });
}

export async function handleTransferComplete(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `e2ee:xf:ok:${user.id}`, 20, 600);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ transfer_id?: unknown; device_id?: unknown }>(request, 1024);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const transferId = typeof parsed.data?.transfer_id === 'string' ? parsed.data.transfer_id.trim() : '';
  const deviceId = parsePositiveId(parsed.data?.device_id);
  if (!/^[a-f0-9]{24,64}$/i.test(transferId) || !deviceId) {
    return jsonError(t.common.networkError, 400);
  }

  const existing = await env.DB.prepare(
    `SELECT r2_key, status
     FROM e2ee_device_transfers
     WHERE transfer_id = ? AND user_id = ? AND requester_device_id = ?`,
  )
    .bind(transferId, user.id, deviceId)
    .first<{ r2_key: string; status: string }>();

  if (!existing) return jsonError(t.common.networkError, 404, 'TRANSFER_NOT_FOUND');
  if (existing.status !== 'uploaded') {
    return jsonError(t.common.networkError, 409, 'TRANSFER_ALREADY_USED');
  }

  const consumed = await env.DB.prepare(
    `UPDATE e2ee_device_transfers
     SET status = 'completed', r2_key = ''
     WHERE transfer_id = ? AND user_id = ? AND requester_device_id = ? AND status = 'uploaded'
     RETURNING transfer_id`,
  )
    .bind(transferId, user.id, deviceId)
    .first<{ transfer_id: string }>();

  if (!consumed) {
    return jsonError(t.common.networkError, 409, 'TRANSFER_ALREADY_USED');
  }

  if (existing.r2_key) {
    try {
      await env.STORAGE.delete(existing.r2_key);
    } catch {}
  }

  return jsonResponse({ success: true, transfer_id: transferId }, 200);
}
