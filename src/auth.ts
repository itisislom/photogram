import { Env, User } from './types';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const SESSION_TOKEN_BYTES = 32;
const SESSION_MAX_AGE = 2_592_000;
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;


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
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
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
  return new URL(request.url).protocol === 'https:';
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

function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return '127.0.0.1';
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
      'SELECT id, username, email, display_name, bio, avatar_key, is_verified, created_at FROM users WHERE id = ?',
    )
      .bind(session.user_id)
      .first<User>()) ?? null
  );
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const ip = getClientIp(request);
  const rateKey = `reg:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  const regCheck = await env.DB.prepare(
    'SELECT attempts, locked_until FROM auth_rate_limits WHERE key = ?',
  )
    .bind(rateKey)
    .first<{ attempts: number; locked_until: number }>();

  if (regCheck && regCheck.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((regCheck.locked_until - now) / 60));
    return jsonError(`Слишком много регистраций с вашего адреса. Попробуйте через ${remainingMinutes} мин.`, 429);
  }

  const form = await request.formData();
  const username = (form.get('username') as string ?? '').toLowerCase().trim();
  const rawEmail = (form.get('email') as string ?? '').toLowerCase().trim();
  const email = rawEmail && EMAIL_RE.test(rawEmail) ? rawEmail : `${username}@photogram.local`;
  const password = form.get('password') as string ?? '';
  const displayName = (form.get('display_name') as string ?? '').trim();

  if (!USERNAME_RE.test(username)) {
    return jsonError('Имя пользователя: 3–24 символа, только маленькие буквы, цифры и подчёркивание', 400);
  }

  if (!displayName) {
    return jsonError('Введите имя', 400);
  }

  const terms = form.get('terms');
  if (!terms) {
    return jsonError('Необходимо принять пользовательское соглашение', 400);
  }

  if (password.length < MIN_PASSWORD_LEN) {
    return jsonError(`Пароль — минимум ${MIN_PASSWORD_LEN} символов`, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?',
  )
    .bind(username, email)
    .first();

  if (existing) return jsonError('Имя пользователя уже занято', 409);

  const pwHash = await hashPassword(password);

  await env.DB.prepare(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
  )
    .bind(username, email, pwHash, displayName || username)
    .run();

  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username)
    .first<{ id: number }>();

  if (!user) return jsonError('Ошибка при создании аккаунта', 500);

  const newAttempts = regCheck ? regCheck.attempts + 1 : 1;
  const lockUntil = newAttempts >= 5 ? now + 3600 : 0;
  await env.DB.prepare(
    'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = ?, updated_at = ?',
  )
    .bind(rateKey, newAttempts, lockUntil, now, newAttempts, lockUntil, now)
    .run();

  const secure = isSecure(request);
  const token = await createSession(env, user.id);

  return jsonResponse({ success: true }, 201, {
    'Set-Cookie': sessionCookie(token, secure),
  });
}

const DUMMY_PASSWORD_HASH = '100000:00112233445566778899aabbccddeeff:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const ip = getClientIp(request);
  const ipRateKey = `login:ip:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  const ipRateRow = await env.DB.prepare(
    'SELECT attempts, locked_until FROM auth_rate_limits WHERE key = ?',
  )
    .bind(ipRateKey)
    .first<{ attempts: number; locked_until: number }>();

  if (ipRateRow && ipRateRow.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((ipRateRow.locked_until - now) / 60));
    return jsonError(`Слишком много неудачных попыток входа с вашего IP. Попробуйте через ${remainingMinutes} мин.`, 429);
  }

  const form = await request.formData();
  const login = (form.get('login') as string ?? '').toLowerCase().trim();
  const password = form.get('password') as string ?? '';

  if (!login || !password) return jsonError('Введите логин и пароль', 400);

  const userRateKey = `login:user:${login}`;
  const userRateRow = await env.DB.prepare(
    'SELECT attempts, locked_until FROM auth_rate_limits WHERE key = ?',
  )
    .bind(userRateKey)
    .first<{ attempts: number; locked_until: number }>();

  if (userRateRow && userRateRow.locked_until > now) {
    const remainingMinutes = Math.max(1, Math.ceil((userRateRow.locked_until - now) / 60));
    return jsonError(`Аккаунт временно заблокирован из-за множества неверных попыток. Попробуйте через ${remainingMinutes} мин.`, 429);
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
    const ipAttempts = ipRateRow ? ipRateRow.attempts + 1 : 1;
    const ipLock = ipAttempts >= 5 ? now + 900 : 0;
    await env.DB.prepare(
      'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = ?, updated_at = ?',
    )
      .bind(ipRateKey, ipAttempts, ipLock, now, ipAttempts, ipLock, now)
      .run();

    const userAttempts = userRateRow ? userRateRow.attempts + 1 : 1;
    const userLock = userAttempts >= 5 ? now + 900 : 0;
    await env.DB.prepare(
      'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = ?, updated_at = ?',
    )
      .bind(userRateKey, userAttempts, userLock, now, userAttempts, userLock, now)
      .run();

    if (ipAttempts >= 5 || userAttempts >= 5) {
      return jsonError('Слишком много неудачных попыток входа. Вход заблокирован на 15 минут.', 429);
    }
    return jsonError('Неверный логин или пароль', 401);
  }

  await env.DB.prepare('DELETE FROM auth_rate_limits WHERE key IN (?, ?)')
    .bind(ipRateKey, userRateKey)
    .run();

  const secure = isSecure(request);
  const token = await createSession(env, user.id);

  return jsonResponse({ success: true }, 200, {
    'Set-Cookie': sessionCookie(token, secure),
  });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookieHeader = request.headers.get('Cookie');
  const secure = isSecure(request);

  if (cookieHeader) {
    const raw = parseCookie(cookieHeader, 'session');
    if (raw) {
      const tokenHash = await sha256(raw);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
  }

  return jsonResponse({ success: true }, 200, {
    'Set-Cookie': clearSessionCookie(secure),
  });
}
