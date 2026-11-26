import { Env } from './types';

export const MAX_INT32 = 2147483647;
export const MAX_IMAGE_DIM = 8192;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const ADMIN_USERNAME = 'islom';

export function isAdminUser(user?: { username?: string | null } | null): boolean {
  return Boolean(
    user &&
      typeof user.username === 'string' &&
      user.username.trim().toLowerCase() === ADMIN_USERNAME,
  );
}

export function isValidPositiveId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_INT32;
}

export function parsePositiveId(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return isValidPositiveId(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d{1,10}$/.test(trimmed)) return null;
    const n = Number(trimmed);
    return isValidPositiveId(n) ? n : null;
  }
  return null;
}

export function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim().slice(0, 64);
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 64);
  return '127.0.0.1';
}

export function checkContentLength(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (raw === null) return true;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const len = Number(trimmed);
  return Number.isFinite(len) && len >= 0 && len <= maxBytes;
}

export async function readJsonWithLimit<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  if (!checkContentLength(request, maxBytes)) {
    return { ok: false, status: 413 };
  }
  let text = '';
  try {
    if (request.body && typeof request.body.getReader === 'function') {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            try {
              await reader.cancel();
            } catch {}
            return { ok: false, status: 413 };
          }
          chunks.push(value);
        }
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      text = new TextDecoder().decode(merged);
    } else {
      text = await request.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        return { ok: false, status: 413 };
      }
    }
  } catch {
    return { ok: false, status: 400 };
  }

  try {
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400 };
  }
}

export async function consumeRateLimitAtomic(
  env: Env,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const row = await env.DB.prepare(
      `INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at)
       VALUES (?1, 1, 0, CAST(?2 AS BIGINT))
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE WHEN (CAST(?2 AS BIGINT) - auth_rate_limits.updated_at) >= CAST(?3 AS BIGINT) THEN 1 ELSE auth_rate_limits.attempts + 1 END,
         updated_at = CASE WHEN (CAST(?2 AS BIGINT) - auth_rate_limits.updated_at) >= CAST(?3 AS BIGINT) THEN CAST(?2 AS BIGINT) ELSE auth_rate_limits.updated_at END,
         locked_until = 0
       RETURNING attempts`,
    )
      .bind(key, now, windowSeconds)
      .first<{ attempts: number }>();
    if (!row) return false;
    return Number(row.attempts) <= maxAttempts;
  } catch {
    return false;
  }
}

export async function acquireCooldownAtomic(
  env: Env,
  key: string,
  cooldownSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const nextUnlock = now + cooldownSeconds;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at)
       VALUES (?1, 1, CAST(?2 AS BIGINT), CAST(?3 AS BIGINT))
       ON CONFLICT(key) DO UPDATE SET
         attempts = auth_rate_limits.attempts + 1,
         locked_until = CAST(?2 AS BIGINT),
         updated_at = CAST(?3 AS BIGINT)
       WHERE auth_rate_limits.locked_until <= CAST(?3 AS BIGINT)
       RETURNING locked_until`,
    )
      .bind(key, nextUnlock, now)
      .first<{ locked_until: number }>();
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function recordFailureAtomic(
  env: Env,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockSeconds: number,
): Promise<{ attempts: number; lockedUntil: number }> {
  const now = Math.floor(Date.now() / 1000);
  const nextLock = now + lockSeconds;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at)
       VALUES (?1, 1, CASE WHEN 1 >= CAST(?2 AS INTEGER) THEN CAST(?4 AS BIGINT) ELSE 0 END, CAST(?5 AS BIGINT))
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE
           WHEN (CAST(?5 AS BIGINT) - auth_rate_limits.updated_at) > CAST(?3 AS BIGINT) OR (auth_rate_limits.locked_until > 0 AND auth_rate_limits.locked_until <= CAST(?5 AS BIGINT))
           THEN 1
           ELSE auth_rate_limits.attempts + 1
         END,
         locked_until = CASE
           WHEN (
             CASE
               WHEN (CAST(?5 AS BIGINT) - auth_rate_limits.updated_at) > CAST(?3 AS BIGINT) OR (auth_rate_limits.locked_until > 0 AND auth_rate_limits.locked_until <= CAST(?5 AS BIGINT))
               THEN 1
               ELSE auth_rate_limits.attempts + 1
             END
           ) >= CAST(?2 AS INTEGER)
           THEN CAST(?4 AS BIGINT)
           ELSE 0
         END,
         updated_at = CAST(?5 AS BIGINT)
       RETURNING attempts, locked_until`,
    )
      .bind(key, maxAttempts, windowSeconds, nextLock, now)
      .first<{ attempts: number; locked_until: number }>();
    if (!row) return { attempts: maxAttempts, lockedUntil: nextLock };
    return { attempts: Number(row.attempts), lockedUntil: Number(row.locked_until) };
  } catch {
    return { attempts: maxAttempts, lockedUntil: nextLock };
  }
}

export async function consumeBurstWithLockoutAtomic(
  env: Env,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  lockSeconds: number,
): Promise<{ allowed: boolean; lockedUntil: number }> {
  const now = Math.floor(Date.now() / 1000);
  const nextLock = now + lockSeconds;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at)
       VALUES (?1, 1, 0, CAST(?5 AS BIGINT))
       ON CONFLICT(key) DO UPDATE SET
         attempts = CASE
           WHEN auth_rate_limits.locked_until > CAST(?5 AS BIGINT) THEN auth_rate_limits.attempts
           WHEN (CAST(?5 AS BIGINT) - auth_rate_limits.updated_at) > CAST(?3 AS BIGINT) THEN 1
           ELSE auth_rate_limits.attempts + 1
         END,
         locked_until = CASE
           WHEN auth_rate_limits.locked_until > CAST(?5 AS BIGINT) THEN auth_rate_limits.locked_until
           WHEN (
             CASE WHEN (CAST(?5 AS BIGINT) - auth_rate_limits.updated_at) > CAST(?3 AS BIGINT) THEN 1 ELSE auth_rate_limits.attempts + 1 END
           ) > CAST(?2 AS INTEGER) THEN CAST(?4 AS BIGINT)
           ELSE 0
         END,
         updated_at = CASE
           WHEN auth_rate_limits.locked_until > CAST(?5 AS BIGINT) THEN auth_rate_limits.updated_at
           ELSE CAST(?5 AS BIGINT)
         END
       RETURNING attempts, locked_until`,
    )
      .bind(key, maxAttempts, windowSeconds, nextLock, now)
      .first<{ attempts: number; locked_until: number }>();
    if (!row) return { allowed: false, lockedUntil: nextLock };
    const lockedUntil = Number(row.locked_until || 0);
    return { allowed: lockedUntil <= now, lockedUntil };
  } catch {
    return { allowed: false, lockedUntil: nextLock };
  }
}

function readUint16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function readUint16LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function readUint32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function readUint32LE(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function checkImageDimensions(width: number, height: number, maxDim: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maxDim &&
    height <= maxDim &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    return null;
  }
  return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 25) return null;
  const c0 = bytes[12];
  const c1 = bytes[13];
  const c2 = bytes[14];
  const c3 = bytes[15];
  if (c0 === 0x56 && c1 === 0x50 && c2 === 0x38 && c3 === 0x20) {
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: readUint16LE(bytes, 26) & 0x3fff,
      height: readUint16LE(bytes, 28) & 0x3fff,
    };
  }
  if (c0 === 0x56 && c1 === 0x50 && c2 === 0x38 && c3 === 0x4c) {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const bits = readUint32LE(bytes, 21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (c0 === 0x56 && c1 === 0x50 && c2 === 0x38 && c3 === 0x58) {
    if (bytes.length < 30) return null;
    const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width: w, height: h };
  }
  return null;
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let pos = 2;
  const len = bytes.length;
  while (pos + 4 < len) {
    if (bytes[pos] !== 0xff) return null;
    while (pos < len && bytes[pos] === 0xff) pos++;
    if (pos >= len) return null;
    const marker = bytes[pos++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }
    if (pos + 2 > len) return null;
    const segLen = readUint16BE(bytes, pos);
    if (segLen < 2 || pos + segLen > len) return null;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (segLen < 7 || pos + 7 > len) return null;
      return {
        height: readUint16BE(bytes, pos + 3),
        width: readUint16BE(bytes, pos + 5),
      };
    }
    pos += segLen;
  }
  return null;
}

export function validateImageBytes(
  bytes: Uint8Array,
  maxDim: number = MAX_IMAGE_DIM,
): { mime: string; ext: string; width: number; height: number } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const dim = parseJpegDimensions(bytes);
    if (!dim || !checkImageDimensions(dim.width, dim.height, maxDim)) return null;
    return { mime: 'image/jpeg', ext: 'jpg', width: dim.width, height: dim.height };
  }
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const dim = parsePngDimensions(bytes);
    if (!dim || !checkImageDimensions(dim.width, dim.height, maxDim)) return null;
    return { mime: 'image/png', ext: 'png', width: dim.width, height: dim.height };
  }
  if (
    bytes.length >= 25 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const dim = parseWebpDimensions(bytes);
    if (!dim || !checkImageDimensions(dim.width, dim.height, maxDim)) return null;
    return { mime: 'image/webp', ext: 'webp', width: dim.width, height: dim.height };
  }
  return null;
}
