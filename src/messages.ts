import { Env, ConversationItem, DirectMessage, User } from './types';
import { getUserFromRequest } from './auth';
import { detectLanguage, getTranslations } from './languages';
import { sendPushToUser } from './push';

const MAX_DM_ENC_MEDIA_SIZE = 6 * 1024 * 1024;
const MAX_ENVELOPES_PER_MSG = 15;
const MAX_CIPHERTEXT_B64_LEN = 32768;
const SEND_LIMIT_PER_MIN = 30;
const NEW_CHAT_LIMIT_PER_HOUR = 15;
const PAGE_SIZE = 30;
const DM_KEY_RE = /^dm\/(\d+)\/[a-zA-Z0-9._-]+$/;

interface ValidatedEnvelopeItem {
  u: number;
  d: number;
  t: number;
  b: string;
}

function validateEnvelopes(
  raw: unknown,
  allowedUserIds: Set<number>,
): ValidatedEnvelopeItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ENVELOPES_PER_MSG) return null;
  const out: ValidatedEnvelopeItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const rec = item as { u?: unknown; d?: unknown; t?: unknown; b?: unknown };
    const u = Number(rec.u);
    const d = Number(rec.d);
    const t = Number(rec.t);
    const b = typeof rec.b === 'string' ? rec.b.trim() : '';
    if (!Number.isInteger(u) || !allowedUserIds.has(u)) return null;
    if (!Number.isInteger(d) || d <= 0 || d > 2147483647) return null;
    if (t !== 1 && t !== 3) return null;
    if (!b || b.length > MAX_CIPHERTEXT_B64_LEN || !/^[A-Za-z0-9+/]+={0,2}$/.test(b)) return null;
    const key = `${u}:${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ u, d, t, b });
  }
  return out.length > 0 ? out : null;
}

function filterEnvelopeForUser(rawEnvelope: string | undefined, userId: number): string {
  if (!rawEnvelope) return '';
  try {
    const parsed = JSON.parse(rawEnvelope) as ValidatedEnvelopeItem[];
    if (!Array.isArray(parsed)) return '';
    const mine = parsed.filter((item) => Number(item.u) === Number(userId));
    return JSON.stringify(mine);
  } catch {
    return '';
  }
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function canonicalPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
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
    if (attempts > maxAttempts) {
      return false;
    }
  }

  await env.DB.prepare(
    'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(key) DO UPDATE SET attempts = ?, locked_until = 0, updated_at = ?',
  )
    .bind(key, attempts, updatedAt, attempts, updatedAt)
    .run();

  return true;
}

export async function canAccessDmMedia(env: Env, userId: number, key: string): Promise<boolean> {
  const match = DM_KEY_RE.exec(key);
  if (!match) return false;
  const convId = parseInt(match[1], 10);
  if (!Number.isInteger(convId) || convId <= 0) return false;

  const row = await env.DB.prepare(
    'SELECT id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
  )
    .bind(convId, userId, userId)
    .first<{ id: number }>();

  return Boolean(row);
}

export async function getTotalUnreadCount(env: Env, userId: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.user1_id = ? OR c.user2_id = ?)
       AND m.sender_id != ?
       AND m.read_at IS NULL
       AND m.deleted_at IS NULL`,
  )
    .bind(userId, userId, userId)
    .first<{ cnt: number }>();
  return Number(row?.cnt || 0);
}

export async function getUserConversations(env: Env, userId: number): Promise<ConversationItem[]> {
  const res = await env.DB.prepare(
    `SELECT
       c.id,
       c.last_message_at,
       u.id AS other_user_id,
       u.username AS other_username,
       u.display_name AS other_display_name,
       u.avatar_key AS other_avatar_key,
       u.is_verified AS other_is_verified,
       lm.id AS last_message_id,
       lm.body AS last_message_body,
       lm.image_key AS last_message_image_key,
       lm.is_encrypted AS last_message_encrypted,
       lm.sender_id AS last_message_sender_id,
       (
         SELECT COUNT(*)
         FROM messages um
         WHERE um.conversation_id = c.id
           AND um.sender_id != ?
           AND um.read_at IS NULL
           AND um.deleted_at IS NULL
       ) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
     LEFT JOIN messages lm ON lm.id = c.last_message_id AND lm.deleted_at IS NULL
     WHERE c.user1_id = ? OR c.user2_id = ?
     ORDER BY c.last_message_at DESC, c.id DESC
     LIMIT 60`,
  )
    .bind(userId, userId, userId, userId)
    .all<{
      id: number;
      last_message_at: string;
      other_user_id: number;
      other_username: string;
      other_display_name: string;
      other_avatar_key: string;
      other_is_verified?: number | boolean;
      last_message_id?: number | null;
      last_message_body: string | null;
      last_message_image_key: string | null;
      last_message_encrypted?: number | boolean | null;
      last_message_sender_id: number | null;
      unread_count: number;
    }>();

  return (res.results || []).map((r) => ({
    id: Number(r.id),
    other_user_id: Number(r.other_user_id),
    other_username: r.other_username,
    other_display_name: r.other_display_name || r.other_username,
    other_avatar_key: r.other_avatar_key || '',
    other_is_verified: r.other_is_verified,
    last_message_id: r.last_message_id ? Number(r.last_message_id) : null,
    last_message_body: r.last_message_body || '',
    last_message_image: Boolean(r.last_message_image_key),
    last_message_encrypted: Boolean(r.last_message_encrypted),
    last_message_sender_id: r.last_message_sender_id !== null ? Number(r.last_message_sender_id) : null,
    last_message_at: r.last_message_at,
    unread_count: Number(r.unread_count || 0),
  }));
}

export async function getOrCreateConversation(
  env: Env,
  userId: number,
  targetUserId: number,
): Promise<{ id: number; rateLimited?: boolean }> {
  const [u1, u2] = canonicalPair(userId, targetUserId);
  const existing = await env.DB.prepare(
    'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
  )
    .bind(u1, u2)
    .first<{ id: number }>();

  if (existing) {
    return { id: Number(existing.id) };
  }

  const allowed = await consumeRateLimit(env, `dm:new:user:${userId}`, NEW_CHAT_LIMIT_PER_HOUR, 3600);
  if (!allowed) {
    return { id: 0, rateLimited: true };
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO conversations (user1_id, user2_id) VALUES (?, ?)',
  )
    .bind(u1, u2)
    .run();

  const created = await env.DB.prepare(
    'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
  )
    .bind(u1, u2)
    .first<{ id: number }>();

  return { id: created ? Number(created.id) : 0 };
}

export async function getConversationForUser(
  env: Env,
  conversationId: number,
  userId: number,
): Promise<{ id: number; user1_id: number; user2_id: number } | null> {
  const row = await env.DB.prepare(
    'SELECT id, user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
  )
    .bind(conversationId, userId, userId)
    .first<{ id: number; user1_id: number; user2_id: number }>();
  return row
    ? { id: Number(row.id), user1_id: Number(row.user1_id), user2_id: Number(row.user2_id) }
    : null;
}

export async function getConversationMessages(
  env: Env,
  conversationId: number,
  viewerUserId: number,
  beforeId?: number,
  limit: number = PAGE_SIZE,
): Promise<{ messages: DirectMessage[]; hasMore: boolean }> {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const fetchLimit = safeLimit + 1;
  const res = beforeId && beforeId > 0
    ? await env.DB.prepare(
        `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, created_at
         FROM messages
         WHERE conversation_id = ? AND deleted_at IS NULL AND id < ?
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(conversationId, beforeId, fetchLimit)
        .all<DirectMessage>()
    : await env.DB.prepare(
        `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, created_at
         FROM messages
         WHERE conversation_id = ? AND deleted_at IS NULL
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(conversationId, fetchLimit)
        .all<DirectMessage>();

  const rows = (res.results || []).map((m) => {
    const encrypted = Boolean(m.is_encrypted);
    return {
      id: Number(m.id),
      conversation_id: Number(m.conversation_id),
      sender_id: Number(m.sender_id),
      body: encrypted ? '' : (m.body || ''),
      image_key: m.image_key || '',
      is_encrypted: encrypted ? 1 : 0,
      sender_device_id: Number(m.sender_device_id || 0),
      ciphertext_envelope: encrypted ? filterEnvelopeForUser(m.ciphertext_envelope, viewerUserId) : '',
      read_at: m.read_at || null,
      created_at: m.created_at,
    };
  });

  const hasMore = rows.length > safeLimit;
  const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
  sliced.reverse();
  return { messages: sliced, hasMore };
}

export async function markConversationRead(
  env: Env,
  conversationId: number,
  readerId: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE messages
     SET read_at = datetime('now')
     WHERE conversation_id = ?
       AND sender_id != ?
       AND read_at IS NULL
       AND deleted_at IS NULL`,
  )
    .bind(conversationId, readerId)
    .run();
}

export async function getLastReadOwnMessageId(
  env: Env,
  conversationId: number,
  senderId: number,
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT id FROM messages
     WHERE conversation_id = ?
       AND sender_id = ?
       AND read_at IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
  )
    .bind(conversationId, senderId)
    .first<{ id: number }>();
  return row ? Number(row.id) : 0;
}

export async function getChatPageData(
  env: Env,
  currentUser: User,
  targetUsername?: string,
): Promise<{
  conversations: ConversationItem[];
  activeConversationId: number | null;
  activePartner: { id: number; username: string; display_name: string; avatar_key: string; is_verified?: number | boolean } | null;
  messages: DirectMessage[];
  hasMore: boolean;
  lastReadOwnId: number;
  notFound?: boolean;
}> {
  let activeConversationId: number | null = null;
  let activePartner: { id: number; username: string; display_name: string; avatar_key: string; is_verified?: number | boolean } | null = null;
  let messages: DirectMessage[] = [];
  let hasMore = false;
  let lastReadOwnId = 0;

  if (targetUsername) {
    const cleanTarget = targetUsername.toLowerCase().trim();
    const partner = await env.DB.prepare(
      'SELECT id, username, display_name, avatar_key, is_verified FROM users WHERE LOWER(username) = LOWER(?)',
    )
      .bind(cleanTarget)
      .first<{ id: number; username: string; display_name: string; avatar_key: string; is_verified?: number | boolean }>();

    if (!partner || Number(partner.id) === Number(currentUser.id)) {
      const conversations = await getUserConversations(env, currentUser.id);
      return {
        conversations,
        activeConversationId: null,
        activePartner: null,
        messages: [],
        hasMore: false,
        lastReadOwnId: 0,
        notFound: true,
      };
    }

    activePartner = {
      id: Number(partner.id),
      username: partner.username,
      display_name: partner.display_name || partner.username,
      avatar_key: partner.avatar_key || '',
      is_verified: partner.is_verified,
    };

    const [u1, u2] = canonicalPair(currentUser.id, activePartner.id);
    const existingConv = await env.DB.prepare(
      'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
    )
      .bind(u1, u2)
      .first<{ id: number }>();

    if (existingConv) {
      activeConversationId = Number(existingConv.id);
      await markConversationRead(env, activeConversationId, currentUser.id);
      const loaded = await getConversationMessages(env, activeConversationId, currentUser.id);
      messages = loaded.messages;
      hasMore = loaded.hasMore;
      lastReadOwnId = await getLastReadOwnMessageId(env, activeConversationId, currentUser.id);
    }
  }

  const conversations = await getUserConversations(env, currentUser.id);
  return {
    conversations,
    activeConversationId,
    activePartner,
    messages,
    hasMore,
    lastReadOwnId,
  };
}

export async function handleGetConversations(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const conversations = await getUserConversations(env, user.id);
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  return jsonResponse({ success: true, conversations, unread_total: unreadTotal }, 200);
}

export async function handleStartConversation(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  let body: { user_id?: unknown; username?: unknown };
  try {
    body = (await request.json()) as { user_id?: unknown; username?: unknown };
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  let partner: { id: number; username: string } | null = null;
  if (body?.user_id !== undefined) {
    const tid = Number(body.user_id);
    if (Number.isInteger(tid) && tid > 0) {
      partner = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?')
        .bind(tid)
        .first<{ id: number; username: string }>();
    }
  } else if (typeof body?.username === 'string' && body.username.trim()) {
    partner = await env.DB.prepare('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(body.username.trim())
      .first<{ id: number; username: string }>();
  }

  if (!partner) return jsonError(t.explore.noResults, 404);
  if (Number(partner.id) === Number(user.id)) return jsonError(t.messages.errSelfMessage, 400);

  const conv = await getOrCreateConversation(env, user.id, Number(partner.id));
  if (conv.rateLimited) return jsonError(t.messages.errRateLimit, 429);
  if (!conv.id) return jsonError(t.common.networkError, 500);

  return jsonResponse({ success: true, conversation_id: conv.id, username: partner.username }, 200);
}

export async function handleGetMessages(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const convId = parseInt(url.searchParams.get('conversation_id') || '0', 10);
  const beforeId = parseInt(url.searchParams.get('before_id') || '0', 10);
  if (!Number.isInteger(convId) || convId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const { messages, hasMore } = await getConversationMessages(env, convId, user.id, beforeId > 0 ? beforeId : undefined);
  return jsonResponse({ success: true, messages, has_more: hasMore }, 200);
}

export async function handlePollMessages(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const convId = parseInt(url.searchParams.get('conversation_id') || '0', 10);
  const afterId = parseInt(url.searchParams.get('after_id') || '0', 10);
  if (!Number.isInteger(convId) || convId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const res = await env.DB.prepare(
    `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, created_at
     FROM messages
     WHERE conversation_id = ? AND deleted_at IS NULL AND id > ?
     ORDER BY id ASC
     LIMIT 50`,
  )
    .bind(convId, Math.max(0, afterId))
    .all<DirectMessage>();

  const newMessages = (res.results || []).map((m) => {
    const encrypted = Boolean(m.is_encrypted);
    return {
      id: Number(m.id),
      conversation_id: Number(m.conversation_id),
      sender_id: Number(m.sender_id),
      body: encrypted ? '' : (m.body || ''),
      image_key: m.image_key || '',
      is_encrypted: encrypted ? 1 : 0,
      sender_device_id: Number(m.sender_device_id || 0),
      ciphertext_envelope: encrypted ? filterEnvelopeForUser(m.ciphertext_envelope, user.id) : '',
      read_at: m.read_at || null,
      created_at: m.created_at,
    };
  });

  if (newMessages.some((m) => m.sender_id !== user.id)) {
    await markConversationRead(env, convId, user.id);
  }

  const lastReadOwnId = await getLastReadOwnMessageId(env, convId, user.id);
  const unreadTotal = await getTotalUnreadCount(env, user.id);

  return jsonResponse(
    {
      success: true,
      messages: newMessages,
      last_read_own_id: lastReadOwnId,
      unread_total: unreadTotal,
    },
    200,
  );
}

export async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimit(env, `dm:send:user:${user.id}`, SEND_LIMIT_PER_MIN, 60);
  if (!allowed) {
    return jsonError(t.messages.errRateLimit, 429);
  }

  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  let convId = 0;
  let targetUserId = 0;
  let senderDeviceId = 0;
  let rawEnvelopes: unknown = null;
  let encMediaFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    convId = parseInt(String(form.get('conversation_id') || '0'), 10);
    targetUserId = parseInt(String(form.get('target_user_id') || '0'), 10);
    senderDeviceId = parseInt(String(form.get('sender_device_id') || '0'), 10);
    const envRawStr = String(form.get('envelopes') || '');
    try {
      rawEnvelopes = envRawStr ? JSON.parse(envRawStr) : null;
    } catch {
      return jsonError(t.messages.e2eeRequired, 400);
    }
    const rawFile = form.get('encrypted_media');
    if (rawFile && typeof rawFile === 'object' && 'arrayBuffer' in rawFile && (rawFile as File).size > 0) {
      encMediaFile = rawFile as File;
    }
  } else {
    let body: {
      conversation_id?: unknown;
      target_user_id?: unknown;
      sender_device_id?: unknown;
      envelopes?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonError(t.common.networkError, 400);
    }
    convId = Number(body?.conversation_id || 0);
    targetUserId = Number(body?.target_user_id || 0);
    senderDeviceId = Number(body?.sender_device_id || 0);
    rawEnvelopes = body?.envelopes;
  }

  if (!Number.isInteger(senderDeviceId) || senderDeviceId <= 0 || senderDeviceId > 2147483647) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  let resolvedConvId = 0;
  let recipientUserId = 0;
  if (Number.isInteger(convId) && convId > 0) {
    const conv = await getConversationForUser(env, convId, user.id);
    if (!conv) return jsonError(t.common.authRequired, 403);
    resolvedConvId = conv.id;
    recipientUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;
  } else if (Number.isInteger(targetUserId) && targetUserId > 0) {
    if (targetUserId === user.id) return jsonError(t.messages.errSelfMessage, 400);
    const partner = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetUserId).first<{ id: number }>();
    if (!partner) return jsonError(t.explore.noResults, 404);
    const created = await getOrCreateConversation(env, user.id, targetUserId);
    if (created.rateLimited) return jsonError(t.messages.errRateLimit, 429);
    if (!created.id) return jsonError(t.common.networkError, 500);
    resolvedConvId = created.id;
    recipientUserId = targetUserId;
  } else {
    return jsonError(t.common.networkError, 400);
  }

  const allowedRecipients = new Set<number>([recipientUserId, user.id]);
  const envelopes = validateEnvelopes(rawEnvelopes, allowedRecipients);
  if (!envelopes || !envelopes.some((e) => e.u === recipientUserId)) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  let imageKey = '';
  if (encMediaFile) {
    if (encMediaFile.size < 20 || encMediaFile.size > MAX_DM_ENC_MEDIA_SIZE) {
      return jsonError(t.messages.errImageTooLarge, 400);
    }
    const buf = await encMediaFile.arrayBuffer();
    const rand = crypto.randomUUID().replace(/-/g, '');
    imageKey = `dm/${resolvedConvId}/${Date.now()}_${rand}.enc`;
    await env.STORAGE.put(imageKey, buf, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
  }

  const serializedEnvelope = JSON.stringify(envelopes);
  const ins = await env.DB.prepare(
    'INSERT INTO messages (conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope) VALUES (?, ?, ?, ?, 1, ?, ?)',
  )
    .bind(resolvedConvId, user.id, '', imageKey, senderDeviceId, serializedEnvelope)
    .run();

  let msgId = Number(ins.meta?.last_row_id || 0);
  if (!msgId) {
    const latest = await env.DB.prepare(
      'SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ? ORDER BY id DESC LIMIT 1',
    )
      .bind(resolvedConvId, user.id)
      .first<{ id: number }>();
    msgId = latest ? Number(latest.id) : 0;
  }

  const inserted = await env.DB.prepare(
    'SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, created_at FROM messages WHERE id = ?',
  )
    .bind(msgId)
    .first<DirectMessage>();

  if (msgId) {
    await env.DB.prepare(
      "UPDATE conversations SET last_message_id = ?, last_message_at = datetime('now') WHERE id = ?",
    )
      .bind(msgId, resolvedConvId)
      .run();
  }

  if (recipientUserId > 0) {
    await sendPushToUser(env, recipientUserId, {
      kind: 'dm',
      title: `@${user.username}`,
      body: t.messages.encryptedPushBody,
      url: `/messages/${encodeURIComponent(user.username)}`,
      tag: `dm-${resolvedConvId}`,
    });
  }

  return jsonResponse(
    {
      success: true,
      conversation_id: resolvedConvId,
      message: inserted
        ? {
            id: Number(inserted.id),
            conversation_id: Number(inserted.conversation_id),
            sender_id: Number(inserted.sender_id),
            body: '',
            image_key: inserted.image_key || '',
            is_encrypted: 1,
            sender_device_id: Number(inserted.sender_device_id || senderDeviceId),
            ciphertext_envelope: filterEnvelopeForUser(inserted.ciphertext_envelope, user.id),
            read_at: inserted.read_at || null,
            created_at: inserted.created_at,
          }
        : {
            id: msgId,
            conversation_id: resolvedConvId,
            sender_id: user.id,
            body: '',
            image_key: imageKey,
            is_encrypted: 1,
            sender_device_id: senderDeviceId,
            ciphertext_envelope: filterEnvelopeForUser(serializedEnvelope, user.id),
            read_at: null,
            created_at: new Date().toISOString(),
          },
    },
    201,
  );
}

export async function handleMarkRead(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  let body: { conversation_id?: unknown };
  try {
    body = (await request.json()) as { conversation_id?: unknown };
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const convId = Number(body?.conversation_id || 0);
  if (!Number.isInteger(convId) || convId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  await markConversationRead(env, convId, user.id);
  const unreadTotal = await getTotalUnreadCount(env, user.id);
  return jsonResponse({ success: true, unread_total: unreadTotal }, 200);
}

export async function handleDeleteMessage(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  let body: { message_id?: unknown };
  try {
    body = (await request.json()) as { message_id?: unknown };
  } catch {
    return jsonError(t.common.networkError, 400);
  }

  const msgId = Number(body?.message_id || 0);
  if (!Number.isInteger(msgId) || msgId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const msg = await env.DB.prepare(
    'SELECT id, conversation_id, sender_id, image_key FROM messages WHERE id = ? AND deleted_at IS NULL',
  )
    .bind(msgId)
    .first<{ id: number; conversation_id: number; sender_id: number; image_key: string }>();

  if (!msg) return jsonError(t.common.networkError, 404);
  if (Number(msg.sender_id) !== Number(user.id)) return jsonError(t.common.authRequired, 403);

  const imageKeyToDelete = msg.image_key;
  await env.DB.prepare("UPDATE messages SET deleted_at = datetime('now'), body = '', image_key = '', ciphertext_envelope = '' WHERE id = ?")
    .bind(msgId)
    .run();

  if (imageKeyToDelete) {
    try {
      await env.STORAGE.delete(imageKeyToDelete);
    } catch {}
  }

  const prev = await env.DB.prepare(
    'SELECT id, created_at FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
  )
    .bind(msg.conversation_id)
    .first<{ id: number; created_at: string }>();

  if (prev) {
    await env.DB.prepare('UPDATE conversations SET last_message_id = ?, last_message_at = ? WHERE id = ?')
      .bind(prev.id, prev.created_at, msg.conversation_id)
      .run();
  } else {
    await env.DB.prepare('UPDATE conversations SET last_message_id = NULL WHERE id = ?')
      .bind(msg.conversation_id)
      .run();
  }

  return jsonResponse({ success: true, deleted_id: msgId }, 200);
}

export async function handleUnreadCount(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonResponse({ unread_total: 0 }, 200);
  const unreadTotal = await getTotalUnreadCount(env, user.id);
  return jsonResponse({ success: true, unread_total: unreadTotal }, 200);
}
