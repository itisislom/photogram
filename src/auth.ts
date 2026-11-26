import { Env, User, SavedAccountItem } from './types';
import { detectLanguage, getTranslations } from './languages';
import { isBlockedUsername } from './blockedUsernames';
import {
  checkContentLength,
  consumeRateLimitAtomic,
  getClientIp,
  parsePositiveId,
  readJsonWithLimit,
  recordFailureAtomic,
} from './security';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const SESSION_TOKEN_BYTES = 32;
const SESSION_MAX_AGE = 2_592_000;
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 256;
const MAX_DISPLAY_NAME_LEN = 40;
const MAX_EMAIL_LEN = 254;
const TOKEN_HEX_RE = /^[a-f0-9]{64}$/;
export const MAX_SAVED_ACCOUNTS = 5;
const MAX_CANDIDATE_TOKENS = MAX_SAVED_ACCOUNTS + 2;


function hex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function unhex(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length; i += 2) {
    bytes[i / 2] = parseInt(str.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return hex(buf);
}

function parseCookie(header: string, name: string): string | null {
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? m[1] : null;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers?: Record<string, string>,
  extraSetCookies?: string[],
): Response {
  const resHeaders = new Headers({ 'Content-Type': 'application/json' });
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === 'set-cookie') resHeaders.append('Set-Cookie', v);
      else resHeaders.set(k, v);
    }
  }
  if (extraSetCookies) {
    for (const c of extraSetCookies) {
      resHeaders.append('Set-Cookie', c);
    }
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: resHeaders,
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  const iterations = parseInt(parts[0], 10);
  const salt = unhex(parts[1]);
  const storedHash = unhex(parts[2]);
  const computed = await deriveKey(password, salt, iterations);
  if (computed.byteLength !== storedHash.byteLength) return false;
  return crypto.subtle.timingSafeEqual(computed, storedHash);
}

function isSecure(request: Request): boolean {
  const url = new URL(request.url);
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return url.protocol === 'https:';
  }
  return true;
}

function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie(secure: boolean): string {
  const parts = ['session=', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildAccountsCookie(tokens: string[], secure: boolean): string {
  const clean = tokens.filter((t) => TOKEN_HEX_RE.test(t)).slice(0, MAX_SAVED_ACCOUNTS);
  if (clean.length === 0) {
    const emptyParts = ['pg_accounts=', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
    if (secure) emptyParts.push('Secure');
    return emptyParts.join('; ');
  }
  const parts = [
    `pg_accounts=${clean.join('.')}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

interface DeviceSessionEntry {
  rawToken: string;
  tokenHash: string;
  user: SavedAccountItem;
}

async function resolveDeviceSessions(env: Env, request: Request): Promise<{
  entries: DeviceSessionEntry[];
  activeRaw: string | null;
  rawCookieValue: string;
}> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const activeRaw = parseCookie(cookieHeader, 'session');
  const rawCookieValue = parseCookie(cookieHeader, 'pg_accounts') || '';
  const candidateTokens: string[] = [];
  const seenRaw = new Set<string>();

  for (const part of rawCookieValue.split('.')) {
    if (candidateTokens.length >= MAX_CANDIDATE_TOKENS) break;
    const trimmed = part.trim().toLowerCase();
    if (TOKEN_HEX_RE.test(trimmed) && !seenRaw.has(trimmed)) {
      seenRaw.add(trimmed);
      candidateTokens.push(trimmed);
    }
  }
  if (activeRaw && TOKEN_HEX_RE.test(activeRaw.trim().toLowerCase())) {
    const cleanActive = activeRaw.trim().toLowerCase();
    if (!seenRaw.has(cleanActive)) {
      seenRaw.add(cleanActive);
      candidateTokens.unshift(cleanActive);
      if (candidateTokens.length > MAX_CANDIDATE_TOKENS) {
        candidateTokens.length = MAX_CANDIDATE_TOKENS;
      }
    }
  }

  const byUserId = new Map<number, DeviceSessionEntry>();
  const now = new Date();

  for (const raw of candidateTokens) {
    if (byUserId.size >= MAX_SAVED_ACCOUNTS && !activeRaw) break;
    const tokenHash = await sha256(raw);
    const session = await env.DB.prepare(
      'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?',
    )
      .bind(tokenHash)
      .first<{ user_id: number; expires_at: string }>();

    if (!session) continue;
    if (new Date(session.expires_at) < now) {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
      continue;
    }

    const existingForUser = byUserId.get(session.user_id);
    if (existingForUser) {
      if (activeRaw && raw === activeRaw.trim().toLowerCase()) {
        existingForUser.rawToken = raw;
        existingForUser.tokenHash = tokenHash;
        existingForUser.user.is_current = true;
      }
      continue;
    }

    if (byUserId.size >= MAX_SAVED_ACCOUNTS) continue;

    const u = await env.DB.prepare(
      'SELECT id, username, display_name, avatar_key, is_verified FROM users WHERE id = ?',
    )
      .bind(session.user_id)
      .first<{ id: number; username: string; display_name: string; avatar_key: string; is_verified?: number | boolean }>();

    if (!u) continue;

    byUserId.set(u.id, {
      rawToken: raw,
      tokenHash,
      user: {
        id: u.id,
        username: u.username,
        display_name: u.display_name || u.username,
        avatar_key: u.avatar_key || '',
        is_verified: u.is_verified,
        is_current: Boolean(activeRaw && raw === activeRaw.trim().toLowerCase()),
      },
    });
  }

  return {
    entries: Array.from(byUserId.values()).slice(0, MAX_SAVED_ACCOUNTS),
    activeRaw: activeRaw ? activeRaw.trim().toLowerCase() : null,
    rawCookieValue,
  };
}

export async function getSavedAccountsForPage(
  env: Env,
  request: Request,
  currentUser: User,
): Promise<{ accounts: SavedAccountItem[]; syncCookie?: string }> {
  const resolved = await resolveDeviceSessions(env, request);
  const accounts = resolved.entries.map((e) => ({
    ...e.user,
    is_current: e.user.id === currentUser.id,
  }));
  const joined = resolved.entries.map((e) => e.rawToken).join('.');
  const syncCookie = joined !== resolved.rawCookieValue
    ? buildAccountsCookie(resolved.entries.map((e) => e.rawToken), isSecure(request))
    : undefined;
  return { accounts, syncCookie };
}

export async function getDeviceSessionUserIds(env: Env, request: Request): Promise<Set<number>> {
  const resolved = await resolveDeviceSessions(env, request);
  const out = new Set<number>();
  for (const entry of resolved.entries) {
    out.add(Number(entry.user.id));
  }
  return out;
}

async function createSession(env: Env, userId: number): Promise<string> {
  try {
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  } catch {}
  const raw = hex(crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES)));
  const tokenHash = await sha256(raw);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(tokenHash, userId, expiresAt)
    .run();
  return raw;
}

export async function getUserFromRequest(env: Env, request: Request): Promise<User | null> {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const raw = parseCookie(cookieHeader, 'session');
  if (!raw) return null;

  const tokenHash = await sha256(raw);

  const session = await env.DB.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .first<{ user_id: number; expires_at: string }>();

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  return (
    (await env.DB.prepare(
      'SELECT id, username, email, display_name, bio, avatar_key, is_verified, notifications_enabled, created_at FROM users WHERE id = ?',
    )
      .bind(session.user_id)
      .first<User>()) ?? null
  );
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const ip = getClientIp(request);
  const rateKey = `reg:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  const regCheck = await env.DB.prepare(
    'SELECT attempts, locked_until, updated_at FROM auth_rate_limits WHERE key = ?',
  )
    .bind(rateKey)
    .first<{ attempts: number; locked_until: number; updated_at: number }>();

  if (regCheck && regCheck.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((regCheck.locked_until - now) / 60));
    return jsonError(t.auth.errTooManyRegAttempts(remainingMinutes), 429);
  }

  if (!checkContentLength(request, 65536)) {
    return jsonError(t.common.networkError, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const username = (typeof form.get('username') === 'string' ? (form.get('username') as string) : '').toLowerCase().trim();
  const rawEmail = (typeof form.get('email') === 'string' ? (form.get('email') as string) : '').toLowerCase().trim();
  if (rawEmail.length > MAX_EMAIL_LEN) {
    return jsonError(t.common.networkError, 400);
  }
  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : `${username}@photogram.local`;
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : '';
  const displayName = (typeof form.get('display_name') === 'string' ? (form.get('display_name') as string) : '').trim();

  if (!USERNAME_RE.test(username)) {
    return jsonError(t.auth.errUsernameFormat, 400);
  }

  if (isBlockedUsername(username)) {
    return jsonError(t.auth.errUsernameForbidden, 400);
  }

  if (!displayName || displayName.length > MAX_DISPLAY_NAME_LEN) {
    return jsonError(t.auth.errDisplayNameRequired, 400);
  }

  const terms = form.get('terms');
  if (!terms) {
    return jsonError(t.auth.errTermsRequired, 400);
  }

  if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
    return jsonError(t.auth.errPasswordMin, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?',
  )
    .bind(username, email)
    .first();

  if (existing) return jsonError(t.auth.errUsernameTaken, 409);

  const deviceSessions = await resolveDeviceSessions(env, request);
  if (deviceSessions.entries.length >= MAX_SAVED_ACCOUNTS) {
    return jsonError(t.auth.errAccountsLimitReached, 400);
  }

  const pwHash = await hashPassword(password);

  try {
    await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    )
      .bind(username, email, pwHash, displayName || username)
      .run();
  } catch {
    return jsonError(t.auth.errUsernameTaken, 409);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: number }>();

  if (!user) return jsonError(t.auth.errAccountCreate, 500);

  await recordFailureAtomic(env, rateKey, 5, 3600, 3600);

  const secure = isSecure(request);
  const token = await createSession(env, user.id);
  const updatedTokens = [...deviceSessions.entries.map((e) => e.rawToken), token].slice(0, MAX_SAVED_ACCOUNTS);

  return jsonResponse({ success: true }, 201, undefined, [
    sessionCookie(token, secure),
    buildAccountsCookie(updatedTokens, secure),
  ]);
}

const DUMMY_PASSWORD_HASH = '100000:00112233445566778899aabbccddeeff:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const ip = getClientIp(request);
  const ipRateKey = `login:ip:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare('DELETE FROM auth_rate_limits WHERE updated_at < ? AND locked_until < ?')
      .bind(now - 86400, now)
      .run();
  } catch {}

  const ipRateRow = await env.DB.prepare(
    'SELECT attempts, locked_until, updated_at FROM auth_rate_limits WHERE key = ?',
  )
    .bind(ipRateKey)
    .first<{ attempts: number; locked_until: number; updated_at: number }>();

  if (ipRateRow && ipRateRow.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((ipRateRow.locked_until - now) / 60));
    return jsonError(t.auth.errTooManyIpAttempts(remainingMinutes), 429);
  }

  if (!checkContentLength(request, 65536)) {
    return jsonError(t.common.networkError, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(t.common.networkError, 400);
  }
  const login = (typeof form.get('login') === 'string' ? (form.get('login') as string) : '').toLowerCase().trim();
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : '';

  if (!login || !password) return jsonError(t.auth.errLoginRequired, 400);
  if (login.length > MAX_EMAIL_LEN || password.length > MAX_PASSWORD_LEN) {
    return jsonError(t.auth.errInvalidCredentials, 400);
  }

  const userRateKey = `login:user:${login}`;
  const userRateRow = await env.DB.prepare(
    'SELECT attempts, locked_until, updated_at FROM auth_rate_limits WHERE key = ?',
  )
    .bind(userRateKey)
    .first<{ attempts: number; locked_until: number; updated_at: number }>();

  if (userRateRow && userRateRow.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((userRateRow.locked_until - now) / 60));
    return jsonError(t.auth.errAccountLocked(remainingMinutes), 429);
  }

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE username = ? OR email = ?',
  )
    .bind(login, login)
    .first<{ id: number; password_hash: string }>();

  let valid = false;
  if (user) {
    valid = await verifyPassword(password, user.password_hash);
  } else {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
  }

  if (!user || !valid) {
    const [ipFail, userFail] = await Promise.all([
      recordFailureAtomic(env, ipRateKey, 5, 900, 900),
      recordFailureAtomic(env, userRateKey, 5, 900, 900),
    ]);

    if (ipFail.attempts >= 5 || userFail.attempts >= 5) {
      return jsonError(t.auth.errLoginLocked15m, 429);
    }
    return jsonError(t.auth.errInvalidCredentials, 401);
  }

  const deviceSessions = await resolveDeviceSessions(env, request);
  const existingDeviceEntry = deviceSessions.entries.find((e) => e.user.id === user.id);
  if (!existingDeviceEntry && deviceSessions.entries.length >= MAX_SAVED_ACCOUNTS) {
    return jsonError(t.auth.errAccountsLimitReached, 400);
  }

  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE key IN (?, ?)')
    .bind(ipRateKey, userRateKey)
    .run();

  if (existingDeviceEntry) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(existingDeviceEntry.tokenHash)
      .run();
  }

  const secure = isSecure(request);
  const token = await createSession(env, user.id);
  const otherTokens = deviceSessions.entries
    .filter((e) => e.user.id !== user.id)
    .map((e) => e.rawToken);
  const updatedTokens = [...otherTokens, token].slice(0, MAX_SAVED_ACCOUNTS);

  return jsonResponse({ success: true }, 200, undefined, [
    sessionCookie(token, secure),
    buildAccountsCookie(updatedTokens, secure),
  ]);
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookieHeader = request.headers.get('Cookie');
  const secure = isSecure(request);
  const ip = getClientIp(request);
  const allowed = await consumeRateLimitAtomic(env, `logout:ip:${ip}`, 30, 60);
  if (!allowed) {
    return jsonError('Too many requests', 429);
  }
  const resolved = await resolveDeviceSessions(env, request);
  const activeEntry = resolved.entries.find((e) => e.rawToken === resolved.activeRaw);
  const loggedOutUserId = activeEntry ? activeEntry.user.id : 0;

  if (cookieHeader) {
    const raw = parseCookie(cookieHeader, 'session');
    if (raw) {
      const tokenHash = await sha256(raw);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
  }

  const remaining = resolved.entries.filter((e) => e.rawToken !== resolved.activeRaw);
  if (remaining.length > 0) {
    const nextActive = remaining[0].rawToken;
    return jsonResponse({ success: true, redirect: '/feed', logged_out_user_id: loggedOutUserId }, 200, undefined, [
      sessionCookie(nextActive, secure),
      buildAccountsCookie(remaining.map((e) => e.rawToken), secure),
    ]);
  }

  return jsonResponse({ success: true, redirect: '/login', logged_out_user_id: loggedOutUserId }, 200, undefined, [
    clearSessionCookie(secure),
    buildAccountsCookie([], secure),
  ]);
}

export async function handleChangePassword(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) {
    return jsonError(t.common.authRequired, 401);
  }

  const rateKey = `pwchange:user:${currentUser.id}`;
  const now = Math.floor(Date.now() / 1000);

  const rateRow = await env.DB.prepare(
    'SELECT attempts, locked_until, updated_at FROM auth_rate_limits WHERE key = ?',
  )
    .bind(rateKey)
    .first<{ attempts: number; locked_until: number; updated_at: number }>();

  if (rateRow && rateRow.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((rateRow.locked_until - now) / 60));
    return jsonError(t.auth.errTooManyPwChangeAttempts(remainingMinutes), 429);
  }

  const parsed = await readJsonWithLimit<{
    current_password?: unknown;
    new_password?: unknown;
    confirm_password?: unknown;
  }>(request, 8192);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  const currentPassword = typeof body?.current_password === 'string' ? body.current_password : '';
  const newPassword = typeof body?.new_password === 'string' ? body.new_password : '';
  const confirmPassword = typeof body?.confirm_password === 'string' ? body.confirm_password : '';

  if (!currentPassword) {
    return jsonError(t.auth.errCurrentPasswordRequired, 400);
  }

  if (currentPassword.length > MAX_PASSWORD_LEN || newPassword.length > MAX_PASSWORD_LEN || confirmPassword.length > MAX_PASSWORD_LEN) {
    return jsonError(t.auth.errPasswordMin, 400);
  }

  if (newPassword.length < MIN_PASSWORD_LEN) {
    return jsonError(t.auth.errPasswordMin, 400);
  }

  if (newPassword !== confirmPassword) {
    return jsonError(t.auth.errPasswordsMismatch, 400);
  }

  if (newPassword === currentPassword) {
    return jsonError(t.auth.errPasswordSame, 400);
  }

  const userRow = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .bind(currentUser.id)
    .first<{ id: number; password_hash: string }>();

  if (!userRow) {
    return jsonError(t.common.authRequired, 401);
  }

  const valid = await verifyPassword(currentPassword, userRow.password_hash);
  if (!valid) {
    const fail = await recordFailureAtomic(env, rateKey, 5, 900, 900);
    if (fail.attempts >= 5) {
      return jsonError(t.auth.errTooManyPwChangeAttempts(15), 429);
    }
    return jsonError(t.auth.errCurrentPasswordWrong, 400);
  }

  const deviceSessions = await resolveDeviceSessions(env, request);
  const otherTokens = deviceSessions.entries
    .filter((e) => e.user.id !== currentUser.id)
    .map((e) => e.rawToken);

  const newHash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, currentUser.id)
    .run();

  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(currentUser.id).run();

  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE key IN (?, ?, ?)')
    .bind(
      rateKey,
      `login:user:${currentUser.username.toLowerCase()}`,
      `login:user:${String(currentUser.email || '').toLowerCase()}`,
    )
    .run();

  const secure = isSecure(request);
  const token = await createSession(env, currentUser.id);
  const updatedTokens = [...otherTokens, token].slice(0, MAX_SAVED_ACCOUNTS);

  return jsonResponse({ success: true }, 200, undefined, [
    sessionCookie(token, secure),
    buildAccountsCookie(updatedTokens, secure),
  ]);
}

export async function handleSwitchAccount(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) {
    return jsonError(t.common.authRequired, 401);
  }

  const allowed = await consumeRateLimitAtomic(env, `switch:user:${currentUser.id}`, 30, 60);
  if (!allowed) {
    return jsonError(t.common.networkError, 429);
  }

  const parsed = await readJsonWithLimit<{ user_id?: unknown }>(request, 4096);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }

  const targetId = parsePositiveId(parsed.data?.user_id);
  if (!targetId) {
    return jsonError(t.common.networkError, 400);
  }

  const resolved = await resolveDeviceSessions(env, request);
  const match = resolved.entries.find((e) => e.user.id === targetId);
  if (!match) {
    return jsonError(t.common.authRequired, 403);
  }

  const secure = isSecure(request);
  return jsonResponse(
    { success: true, username: match.user.username },
    200,
    undefined,
    [
      sessionCookie(match.rawToken, secure),
      buildAccountsCookie(resolved.entries.map((e) => e.rawToken), secure),
    ],
  );
}

export async function handleRemoveAccount(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) {
    return jsonError(t.common.authRequired, 401);
  }

  const allowed = await consumeRateLimitAtomic(env, `removeacc:user:${currentUser.id}`, 20, 60);
  if (!allowed) {
    return jsonError(t.common.networkError, 429);
  }

  const parsed = await readJsonWithLimit<{ user_id?: unknown }>(request, 4096);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }

  const targetId = parsePositiveId(parsed.data?.user_id);
  if (!targetId) {
    return jsonError(t.common.networkError, 400);
  }

  const resolved = await resolveDeviceSessions(env, request);
  const target = resolved.entries.find((e) => e.user.id === targetId);
  if (!target) {
    return jsonError(t.common.networkError, 404);
  }

  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(target.tokenHash)
    .run();

  const remaining = resolved.entries.filter((e) => e.user.id !== targetId);
  const secure = isSecure(request);

  if (remaining.length === 0) {
    return jsonResponse(
      { success: true, redirect: '/login' },
      200,
      undefined,
      [clearSessionCookie(secure), buildAccountsCookie([], secure)],
    );
  }

  if (targetId === currentUser.id) {
    return jsonResponse(
      { success: true, switched: true, redirect: '/accountlist' },
      200,
      undefined,
      [
        sessionCookie(remaining[0].rawToken, secure),
        buildAccountsCookie(remaining.map((e) => e.rawToken), secure),
      ],
    );
  }

  return jsonResponse(
    { success: true, switched: false },
    200,
    undefined,
    [buildAccountsCookie(remaining.map((e) => e.rawToken), secure)],
  );
}
