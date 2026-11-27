import { Env, ConversationItem, DirectMessage, MessageReaction, User } from './types';
import { getSessionHashFromRequest, getUserFromRequest } from './auth';
import { detectLanguage, getTranslations } from './languages';
import { sendPushToUser } from './push';
import {
  authorizeRealtimeConversation,
  authorizeRealtimeConversations,
  emitUserEvent,
  revokeRealtimeConversation,
} from './realtime';
import {
  acquireCooldownAtomic,
  checkContentLength,
  consumeRateLimitAtomic,
  parsePositiveId,
  readJsonWithLimit,
} from './security';

const MAX_DM_ENC_MEDIA_SIZE = 6 * 1024 * 1024;
const MAX_ENVELOPES_PER_MSG = 15;
const MAX_CIPHERTEXT_B64_LEN = 32768;
const SEND_LIMIT_PER_MIN = 30;
const EDIT_LIMIT_PER_MIN = 30;
const REACT_LIMIT_PER_MIN = 60;
const NEW_CHAT_LIMIT_PER_HOUR = 15;
const PAGE_SIZE = 30;
const DM_KEY_RE = /^dm\/(\d+)\/[a-zA-Z0-9._-]+$/;
export const ALLOWED_DM_REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '👎'] as const;
const ALLOWED_DM_REACTION_SET = new Set<string>(ALLOWED_DM_REACTIONS);

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
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

function canonicalPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

async function runBackground(ctx: ExecutionContext | undefined, task: () => Promise<unknown>): Promise<void> {
  const promise = task().catch(() => {});
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
    return;
  }
  await promise;
}

export async function canAccessDmMedia(env: Env, userId: number, key: string): Promise<boolean> {
  const match = DM_KEY_RE.exec(key);
  if (!match) return false;
  const convId = parsePositiveId(match[1]);
  if (!convId) return false;

  const row = await env.DB.prepare(
    `SELECT m.id
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ?
       AND m.image_key = ?
       AND m.deleted_at IS NULL
       AND (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
     LIMIT 1`,
  )
    .bind(convId, key, userId, userId)
    .first<{ id: number }>();

  return Boolean(row);
}

export async function getTotalUnreadCount(env: Env, userId: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
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
       lm.sender_device_id AS last_message_sender_device_id,
       lm.ciphertext_envelope AS last_message_ciphertext_envelope,
       lm.edit_version AS last_message_edit_version,
       lm.read_at AS last_message_read_at,
       (
         SELECT COUNT(*)
         FROM messages um
         WHERE um.conversation_id = c.id
           AND um.sender_id != ?
           AND um.read_at IS NULL
           AND um.deleted_at IS NULL
           AND um.id > CASE WHEN c.user1_id = ? THEN c.user1_cleared_before_id ELSE c.user2_cleared_before_id END
           AND (CASE WHEN c.user1_id = ? THEN um.deleted_for_user1 ELSE um.deleted_for_user2 END) = 0
       ) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
     LEFT JOIN messages lm
       ON lm.id = (
         SELECT m2.id
         FROM messages m2
         WHERE m2.conversation_id = c.id
           AND m2.deleted_at IS NULL
           AND m2.id > CASE WHEN c.user1_id = ? THEN c.user1_cleared_before_id ELSE c.user2_cleared_before_id END
           AND (CASE WHEN c.user1_id = ? THEN m2.deleted_for_user1 ELSE m2.deleted_for_user2 END) = 0
         ORDER BY m2.id DESC
         LIMIT 1
       )
     WHERE (c.user1_id = ? AND c.user1_hidden = 0)
        OR (c.user2_id = ? AND c.user2_hidden = 0)
     ORDER BY c.last_message_at DESC, c.id DESC
     LIMIT 60`,
  )
    .bind(userId, userId, userId, userId, userId, userId, userId, userId)
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
      last_message_sender_device_id?: number | null;
      last_message_ciphertext_envelope?: string | null;
      last_message_edit_version?: number | null;
      last_message_read_at?: string | null;
      unread_count: number;
    }>();

  return (res.results || []).map((r) => {
    const encrypted = Boolean(r.last_message_encrypted);
    return {
      id: Number(r.id),
      other_user_id: Number(r.other_user_id),
      other_username: r.other_username,
      other_display_name: r.other_display_name || r.other_username,
      other_avatar_key: r.other_avatar_key || '',
      other_is_verified: r.other_is_verified,
      last_message_id: r.last_message_id ? Number(r.last_message_id) : null,
      last_message_body: encrypted ? '' : (r.last_message_body || ''),
      last_message_image: Boolean(r.last_message_image_key),
      last_message_encrypted: encrypted,
      last_message_sender_id: r.last_message_sender_id !== null ? Number(r.last_message_sender_id) : null,
      last_message_sender_device_id: encrypted ? Number(r.last_message_sender_device_id || 0) : 0,
      last_message_ciphertext_envelope: encrypted
        ? filterEnvelopeForUser(r.last_message_ciphertext_envelope || '', userId)
        : '',
      last_message_edit_version: Number(r.last_message_edit_version || 0),
      last_message_read: Boolean(r.last_message_read_at),
      last_message_at: r.last_message_at,
      unread_count: Number(r.unread_count || 0),
    };
  });
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

  const allowed = await consumeRateLimitAtomic(env, `dm:new:user:${userId}`, NEW_CHAT_LIMIT_PER_HOUR, 3600);
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
): Promise<{
  id: number;
  user1_id: number;
  user2_id: number;
  user1_cleared_before_id: number;
  user2_cleared_before_id: number;
  cleared_before_id: number;
} | null> {
  const row = await env.DB.prepare(
    'SELECT id, user1_id, user2_id, user1_cleared_before_id, user2_cleared_before_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
  )
    .bind(conversationId, userId, userId)
    .first<{
      id: number;
      user1_id: number;
      user2_id: number;
      user1_cleared_before_id?: number;
      user2_cleared_before_id?: number;
    }>();
  if (!row) return null;
  const u1 = Number(row.user1_id);
  const u2 = Number(row.user2_id);
  const u1Cleared = Number(row.user1_cleared_before_id || 0);
  const u2Cleared = Number(row.user2_cleared_before_id || 0);
  return {
    id: Number(row.id),
    user1_id: u1,
    user2_id: u2,
    user1_cleared_before_id: u1Cleared,
    user2_cleared_before_id: u2Cleared,
    cleared_before_id: u1 === Number(userId) ? u1Cleared : u2Cleared,
  };
}

function groupReactionRows(
  rows: Array<{ message_id: number; user_id: number; emoji: string }>,
  viewerUserId: number,
): Map<number, MessageReaction[]> {
  const byMsg = new Map<number, Map<string, MessageReaction>>();
  for (const r of rows) {
    const mid = Number(r.message_id);
    const emoji = String(r.emoji || '');
    if (!mid || !ALLOWED_DM_REACTION_SET.has(emoji)) continue;
    let emojiMap = byMsg.get(mid);
    if (!emojiMap) {
      emojiMap = new Map<string, MessageReaction>();
      byMsg.set(mid, emojiMap);
    }
    let entry = emojiMap.get(emoji);
    if (!entry) {
      entry = { emoji, count: 0, mine: false };
      emojiMap.set(emoji, entry);
    }
    entry.count += 1;
    if (Number(r.user_id) === Number(viewerUserId)) {
      entry.mine = true;
    }
  }
  const out = new Map<number, MessageReaction[]>();
  byMsg.forEach((emojiMap, mid) => {
    out.set(mid, Array.from(emojiMap.values()));
  });
  return out;
}

async function getReactionsForMessages(
  env: Env,
  messageIds: number[],
  viewerUserId: number,
): Promise<Map<number, MessageReaction[]>> {
  const cleanIds = Array.from(
    new Set(messageIds.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)),
  ).slice(0, 100);
  if (cleanIds.length === 0) return new Map();
  const placeholders = cleanIds.map(() => '?').join(', ');
  const res = await env.DB.prepare(
    `SELECT message_id, user_id, emoji
     FROM message_reactions
     WHERE message_id IN (${placeholders})
     ORDER BY created_at ASC`,
  )
    .bind(...cleanIds)
    .all<{ message_id: number; user_id: number; emoji: string }>();
  return groupReactionRows(res.results || [], viewerUserId);
}

function viewerDelCond(viewerSlot: 1 | 2 | 0, alias: string = ''): string {
  const p = alias ? `${alias}.` : '';
  if (viewerSlot === 1) return ` AND ${p}deleted_for_user1 = 0`;
  if (viewerSlot === 2) return ` AND ${p}deleted_for_user2 = 0`;
  return '';
}

async function getConversationReactionsMap(
  env: Env,
  conversationId: number,
  viewerUserId: number,
  clearedBeforeId: number,
  minVisibleMsgId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<Record<string, MessageReaction[]>> {
  const floorId = Math.max(
    0,
    Number(clearedBeforeId || 0),
    minVisibleMsgId > 0 ? Number(minVisibleMsgId) - 1 : 0,
  );
  const res = await env.DB.prepare(
    `SELECT r.message_id, r.user_id, r.emoji
     FROM message_reactions r
     JOIN messages m ON m.id = r.message_id
     WHERE m.conversation_id = ?
       AND m.deleted_at IS NULL${viewerDelCond(viewerSlot, 'm')}
       AND m.id > ?
     ORDER BY r.message_id DESC, r.created_at ASC
     LIMIT 300`,
  )
    .bind(conversationId, floorId)
    .all<{ message_id: number; user_id: number; emoji: string }>();
  const grouped = groupReactionRows(res.results || [], viewerUserId);
  const out: Record<string, MessageReaction[]> = {};
  grouped.forEach((list, mid) => {
    out[String(mid)] = list;
  });
  return out;
}

export async function getConversationMessages(
  env: Env,
  conversationId: number,
  viewerUserId: number,
  beforeId?: number,
  limit: number = PAGE_SIZE,
  clearedBeforeId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<{ messages: DirectMessage[]; hasMore: boolean }> {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const fetchLimit = safeLimit + 1;
  const minAfterId = Math.max(0, Number(clearedBeforeId || 0));
  const delCond = viewerDelCond(viewerSlot);
  const res = beforeId && beforeId > 0
    ? await env.DB.prepare(
        `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, listened_at, edited_at, edit_version, created_at
         FROM messages
         WHERE conversation_id = ? AND deleted_at IS NULL${delCond} AND id > ? AND id < ?
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(conversationId, minAfterId, beforeId, fetchLimit)
        .all<DirectMessage>()
    : await env.DB.prepare(
        `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, listened_at, edited_at, edit_version, created_at
         FROM messages
         WHERE conversation_id = ? AND deleted_at IS NULL${delCond} AND id > ?
         ORDER BY id DESC
         LIMIT ?`,
      )
        .bind(conversationId, minAfterId, fetchLimit)
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
      listened_at: m.listened_at || null,
      edited_at: m.edited_at || null,
      edit_version: Number(m.edit_version || 0),
      created_at: m.created_at,
    };
  });

  const hasMore = rows.length > safeLimit;
  const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
  sliced.reverse();
  const reactionsByMsg = await getReactionsForMessages(
    env,
    sliced.map((m) => m.id),
    viewerUserId,
  );
  const withReactions = sliced.map((m) => ({
    ...m,
    reactions: reactionsByMsg.get(m.id) || [],
  }));
  return { messages: withReactions, hasMore };
}

export async function markConversationRead(
  env: Env,
  conversationId: number,
  readerId: number,
  clearedBeforeId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<number> {
  const minAfterId = Math.max(0, Number(clearedBeforeId || 0));
  const delCond = viewerDelCond(viewerSlot);
  const res = await env.DB.prepare(
    `UPDATE messages
     SET read_at = datetime('now')
     WHERE conversation_id = ?
       AND sender_id != ?
       AND read_at IS NULL
       AND deleted_at IS NULL${delCond}
       AND id > ?`,
  )
    .bind(conversationId, readerId, minAfterId)
    .run();
  return Number(res.meta?.changes || 0);
}

export async function getLastReadOwnMessageId(
  env: Env,
  conversationId: number,
  senderId: number,
  clearedBeforeId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<number> {
  const minAfterId = Math.max(0, Number(clearedBeforeId || 0));
  const delCond = viewerDelCond(viewerSlot);
  const row = await env.DB.prepare(
    `SELECT id FROM messages
     WHERE conversation_id = ?
       AND sender_id = ?
       AND read_at IS NOT NULL
       AND deleted_at IS NULL${delCond}
       AND id > ?
     ORDER BY id DESC
     LIMIT 1`,
  )
    .bind(conversationId, senderId, minAfterId)
    .first<{ id: number }>();
  return row ? Number(row.id) : 0;
}

export async function getChatPageData(
  env: Env,
  currentUser: User,
  targetUsername?: string,
  ctx?: ExecutionContext,
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

  const convsPromise = getUserConversations(env, currentUser.id);

  if (targetUsername) {
    const cleanTarget = targetUsername.toLowerCase().trim();
    const partner = await env.DB.prepare(
      'SELECT id, username, display_name, avatar_key, is_verified FROM users WHERE LOWER(username) = LOWER(?)',
    )
      .bind(cleanTarget)
      .first<{ id: number; username: string; display_name: string; avatar_key: string; is_verified?: number | boolean }>();

    if (!partner || Number(partner.id) === Number(currentUser.id)) {
      const conversations = await convsPromise;
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
      'SELECT id, user1_id, user2_id, user1_cleared_before_id, user2_cleared_before_id FROM conversations WHERE user1_id = ? AND user2_id = ?',
    )
      .bind(u1, u2)
      .first<{
        id: number;
        user1_id: number;
        user2_id: number;
        user1_cleared_before_id?: number;
        user2_cleared_before_id?: number;
      }>();

    if (existingConv) {
      activeConversationId = Number(existingConv.id);
      const viewerSlot: 1 | 2 = Number(existingConv.user1_id) === Number(currentUser.id) ? 1 : 2;
      const clearedBeforeId =
        viewerSlot === 1
          ? Number(existingConv.user1_cleared_before_id || 0)
          : Number(existingConv.user2_cleared_before_id || 0);
      const [loaded, lastReadId, markedCount] = await Promise.all([
        getConversationMessages(env, activeConversationId, currentUser.id, undefined, PAGE_SIZE, clearedBeforeId, viewerSlot),
        getLastReadOwnMessageId(env, activeConversationId, currentUser.id, clearedBeforeId, viewerSlot),
        markConversationRead(env, activeConversationId, currentUser.id, clearedBeforeId, viewerSlot),
      ]);
      messages = loaded.messages;
      hasMore = loaded.hasMore;
      lastReadOwnId = lastReadId;
      if (markedCount > 0) {
        const partnerIdForBg = activePartner.id;
        const convIdForBg = activeConversationId;
        const partnerSlot: 1 | 2 = viewerSlot === 1 ? 2 : 1;
        const partnerCleared =
          partnerSlot === 1
            ? Number(existingConv.user1_cleared_before_id || 0)
            : Number(existingConv.user2_cleared_before_id || 0);
        await runBackground(ctx, async () => {
          const [partnerLastRead, unreadTotal] = await Promise.all([
            getLastReadOwnMessageId(env, convIdForBg, partnerIdForBg, partnerCleared, partnerSlot),
            getTotalUnreadCount(env, currentUser.id),
          ]);
          await Promise.all([
            emitUserEvent(env, partnerIdForBg, {
              type: 'message.read',
              conversation_id: convIdForBg,
              reader_id: currentUser.id,
              last_read_id: partnerLastRead,
            }),
            emitUserEvent(env, currentUser.id, {
              type: 'unread.updated',
              messages: unreadTotal,
            }),
          ]);
        });
      }
    }
  }

  const conversations = await convsPromise;
  if (activeConversationId) {
    for (const c of conversations) {
      if (c.id === activeConversationId) c.unread_count = 0;
    }
  }
  const authItems = conversations.map((c) => ({ conv_id: c.id, partner_user_id: c.other_user_id }));
  if (activeConversationId && activePartner && !authItems.some((a) => a.conv_id === activeConversationId)) {
    authItems.push({ conv_id: activeConversationId, partner_user_id: activePartner.id });
  }
  await runBackground(ctx, () => authorizeRealtimeConversations(env, currentUser.id, authItems));
  return {
    conversations,
    activeConversationId,
    activePartner,
    messages,
    hasMore,
    lastReadOwnId,
  };
}

export async function handleGetConversations(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:convs:user:${user.id}`, 120, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const conversations = await getUserConversations(env, user.id);
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  await runBackground(ctx, () =>
    authorizeRealtimeConversations(
      env,
      user.id,
      conversations.map((c) => ({ conv_id: c.id, partner_user_id: c.other_user_id })),
    ),
  );
  return jsonResponse({ success: true, conversations, unread_total: unreadTotal }, 200);
}

export async function handleStartConversation(request: Request, env: Env): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const parsed = await readJsonWithLimit<{ user_id?: unknown; username?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);
  const body = parsed.data;

  let partner: { id: number; username: string } | null = null;
  if (body?.user_id !== undefined) {
    const tid = parsePositiveId(body.user_id);
    if (tid) {
      partner = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?')
        .bind(tid)
        .first<{ id: number; username: string }>();
    }
  } else if (typeof body?.username === 'string' && body.username.trim()) {
    partner = await env.DB.prepare('SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(body.username.trim().slice(0, 64))
      .first<{ id: number; username: string }>();
  }

  if (!partner) return jsonError(t.explore.noResults, 404);
  if (Number(partner.id) === Number(user.id)) return jsonError(t.messages.errSelfMessage, 400);

  const conv = await getOrCreateConversation(env, user.id, Number(partner.id));
  if (conv.rateLimited) return jsonError(t.messages.errRateLimit, 429);
  if (!conv.id) return jsonError(t.common.networkError, 500);

  await Promise.all([
    authorizeRealtimeConversation(env, user.id, conv.id, Number(partner.id)),
    authorizeRealtimeConversation(env, Number(partner.id), conv.id, user.id),
  ]);

  return jsonResponse({ success: true, conversation_id: conv.id, username: partner.username }, 200);
}

export async function handleGetMessages(
  request: Request,
  env: Env,
  url: URL,
  ctx?: ExecutionContext,
): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const convId = parseInt(url.searchParams.get('conversation_id') || '0', 10);
  const beforeId = parseInt(url.searchParams.get('before_id') || '0', 10);
  const wantMarkRead = url.searchParams.get('mark_read') === '1';
  if (!Number.isInteger(convId) || convId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const viewerSlot: 1 | 2 = conv.user1_id === Number(user.id) ? 1 : 2;
  if (beforeId > 0) {
    const { messages, hasMore } = await getConversationMessages(
      env,
      convId,
      user.id,
      beforeId,
      PAGE_SIZE,
      conv.cleared_before_id,
      viewerSlot,
    );
    return jsonResponse({ success: true, messages, has_more: hasMore }, 200);
  }

  const [loaded, lastReadOwnId] = await Promise.all([
    getConversationMessages(env, convId, user.id, undefined, PAGE_SIZE, conv.cleared_before_id, viewerSlot),
    getLastReadOwnMessageId(env, convId, user.id, conv.cleared_before_id, viewerSlot),
  ]);

  if (wantMarkRead) {
    const partnerId = conv.user1_id === Number(user.id) ? conv.user2_id : conv.user1_id;
    const partnerSlot: 1 | 2 = viewerSlot === 1 ? 2 : 1;
    const partnerCleared =
      partnerSlot === 1 ? conv.user1_cleared_before_id : conv.user2_cleared_before_id;
    await runBackground(ctx, async () => {
      const markedCount = await markConversationRead(env, convId, user.id, conv.cleared_before_id, viewerSlot);
      if (markedCount > 0) {
        const [partnerLastRead, unreadTotal] = await Promise.all([
          getLastReadOwnMessageId(env, convId, partnerId, partnerCleared, partnerSlot),
          getTotalUnreadCount(env, user.id),
        ]);
        await Promise.all([
          emitUserEvent(env, partnerId, {
            type: 'message.read',
            conversation_id: convId,
            reader_id: user.id,
            last_read_id: partnerLastRead,
          }),
          emitUserEvent(env, user.id, {
            type: 'unread.updated',
            messages: unreadTotal,
          }),
        ]);
      }
    });
  }

  return jsonResponse(
    {
      success: true,
      messages: loaded.messages,
      has_more: loaded.hasMore,
      last_read_own_id: lastReadOwnId,
    },
    200,
  );
}

async function getEditedMessagesInWindow(
  env: Env,
  conversationId: number,
  viewerUserId: number,
  clearedBeforeId: number,
  minVisibleMsgId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<DirectMessage[]> {
  const floorId = Math.max(
    0,
    Number(clearedBeforeId || 0),
    minVisibleMsgId > 0 ? Number(minVisibleMsgId) - 1 : 0,
  );
  const delCond = viewerDelCond(viewerSlot);
  const res = await env.DB.prepare(
    `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, edited_at, edit_version, created_at
     FROM messages
     WHERE conversation_id = ?
       AND deleted_at IS NULL${delCond}
       AND edited_at IS NOT NULL
       AND id > ?
     ORDER BY id DESC
     LIMIT 50`,
  )
    .bind(conversationId, floorId)
    .all<DirectMessage>();

  return (res.results || []).map((m) => {
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
      edited_at: m.edited_at || null,
      edit_version: Number(m.edit_version || 0),
      created_at: m.created_at,
    };
  });
}

async function getDeletedMessageIdsInWindow(
  env: Env,
  conversationId: number,
  viewerSlot: 1 | 2,
  clearedBeforeId: number,
  minVisibleMsgId: number = 0,
): Promise<number[]> {
  const floorId = Math.max(
    0,
    Number(clearedBeforeId || 0),
    minVisibleMsgId > 0 ? Number(minVisibleMsgId) - 1 : 0,
  );
  const delCol = viewerSlot === 1 ? 'deleted_for_user1' : 'deleted_for_user2';
  const res = await env.DB.prepare(
    `SELECT id
     FROM messages
     WHERE conversation_id = ?
       AND id > ?
       AND (deleted_at IS NOT NULL OR ${delCol} = 1)
     ORDER BY id DESC
     LIMIT 200`,
  )
    .bind(conversationId, floorId)
    .all<{ id: number }>();
  return (res.results || []).map((r) => Number(r.id)).filter((id) => id > 0);
}

async function getListenedMessageIdsInWindow(
  env: Env,
  conversationId: number,
  clearedBeforeId: number,
  minVisibleMsgId: number = 0,
  viewerSlot: 1 | 2 | 0 = 0,
): Promise<number[]> {
  const floorId = Math.max(
    0,
    Number(clearedBeforeId || 0),
    minVisibleMsgId > 0 ? Number(minVisibleMsgId) - 1 : 0,
  );
  const delCond = viewerDelCond(viewerSlot);
  const res = await env.DB.prepare(
    `SELECT id
     FROM messages
     WHERE conversation_id = ?
       AND deleted_at IS NULL${delCond}
       AND listened_at IS NOT NULL
       AND id > ?
     ORDER BY id DESC
     LIMIT 200`,
  )
    .bind(conversationId, floorId)
    .all<{ id: number }>();
  return (res.results || []).map((r) => Number(r.id)).filter((id) => id > 0);
}

export async function handlePollMessages(request: Request, env: Env, url: URL): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const convId = parseInt(url.searchParams.get('conversation_id') || '0', 10);
  const afterId = parseInt(url.searchParams.get('after_id') || '0', 10);
  const minMsgId = parsePositiveId(url.searchParams.get('min_msg_id')) || 0;
  if (!Number.isInteger(convId) || convId <= 0) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const viewerSlot: 1 | 2 = conv.user1_id === Number(user.id) ? 1 : 2;
  const delCond = viewerDelCond(viewerSlot);
  const effectiveAfterId = Math.max(0, afterId, conv.cleared_before_id);
  const res = await env.DB.prepare(
    `SELECT id, conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope, read_at, listened_at, edited_at, edit_version, created_at
     FROM messages
     WHERE conversation_id = ? AND deleted_at IS NULL${delCond} AND id > ?
     ORDER BY id ASC
     LIMIT 50`,
  )
    .bind(convId, effectiveAfterId)
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
      listened_at: m.listened_at || null,
      edited_at: m.edited_at || null,
      edit_version: Number(m.edit_version || 0),
      created_at: m.created_at,
    };
  });

  if (newMessages.some((m) => m.sender_id !== user.id)) {
    const marked = await markConversationRead(env, convId, user.id, conv.cleared_before_id, viewerSlot);
    if (marked > 0) {
      const partnerId = conv.user1_id === Number(user.id) ? conv.user2_id : conv.user1_id;
      const partnerSlot: 1 | 2 = conv.user1_id === partnerId ? 1 : 2;
      const partnerCleared = partnerSlot === 1 ? conv.user1_cleared_before_id : conv.user2_cleared_before_id;
      const partnerLastRead = await getLastReadOwnMessageId(env, convId, partnerId, partnerCleared, partnerSlot);
      await emitUserEvent(env, partnerId, {
        type: 'message.read',
        conversation_id: convId,
        reader_id: user.id,
        last_read_id: partnerLastRead,
      });
    }
  }

  const [lastReadOwnId, unreadTotal, reactionsMap, editedMessages, deletedMessageIds, listenedMessageIds] = await Promise.all([
    getLastReadOwnMessageId(env, convId, user.id, conv.cleared_before_id, viewerSlot),
    getTotalUnreadCount(env, user.id),
    getConversationReactionsMap(env, convId, user.id, conv.cleared_before_id, minMsgId, viewerSlot),
    getEditedMessagesInWindow(env, convId, user.id, conv.cleared_before_id, minMsgId, viewerSlot),
    getDeletedMessageIdsInWindow(env, convId, viewerSlot, conv.cleared_before_id, minMsgId),
    getListenedMessageIdsInWindow(env, convId, conv.cleared_before_id, minMsgId, viewerSlot),
  ]);
  const messagesWithReactions = newMessages.map((m) => ({
    ...m,
    reactions: reactionsMap[String(m.id)] || [],
  }));

  return jsonResponse(
    {
      success: true,
      messages: messagesWithReactions,
      edited_messages: editedMessages,
      deleted_message_ids: deletedMessageIds,
      listened_message_ids: listenedMessageIds,
      reactions_map: reactionsMap,
      last_read_own_id: lastReadOwnId,
      unread_total: unreadTotal,
    },
    200,
  );
}

export async function handleSendMessage(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  let convId = 0;
  let targetUserId = 0;
  let senderDeviceId = 0;
  let sharedPostId = 0;
  let rawEnvelopes: unknown = null;
  let encMediaFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    if (!checkContentLength(request, MAX_DM_ENC_MEDIA_SIZE + 524288)) {
      return jsonError(t.messages.errImageTooLarge, 413);
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(t.common.networkError, 400);
    }
    convId = parsePositiveId(form.get('conversation_id')) || 0;
    targetUserId = parsePositiveId(form.get('target_user_id')) || 0;
    senderDeviceId = parsePositiveId(form.get('sender_device_id')) || 0;
    const envRawStr = typeof form.get('envelopes') === 'string' ? (form.get('envelopes') as string) : '';
    if (envRawStr.length > 524288) {
      return jsonError(t.common.networkError, 413);
    }
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
    const parsed = await readJsonWithLimit<{
      conversation_id?: unknown;
      target_user_id?: unknown;
      sender_device_id?: unknown;
      envelopes?: unknown;
      shared_post_id?: unknown;
    }>(request, 524288);
    if (!parsed.ok) {
      return jsonError(t.common.networkError, parsed.status);
    }
    const body = parsed.data;
    convId = parsePositiveId(body?.conversation_id) || 0;
    targetUserId = parsePositiveId(body?.target_user_id) || 0;
    senderDeviceId = parsePositiveId(body?.sender_device_id) || 0;
    sharedPostId = parsePositiveId(body?.shared_post_id) || 0;
    rawEnvelopes = body?.envelopes;
  }

  const [allowed, senderDevRow, existingConv] = await Promise.all([
    consumeRateLimitAtomic(env, `dm:send:user:${user.id}`, SEND_LIMIT_PER_MIN, 60),
    senderDeviceId > 0
      ? env.DB.prepare('SELECT id FROM e2ee_devices WHERE user_id = ? AND device_id = ?')
          .bind(user.id, senderDeviceId)
          .first<{ id: number }>()
      : Promise.resolve(null),
    convId > 0 ? getConversationForUser(env, convId, user.id) : Promise.resolve(null),
  ]);

  if (!allowed) {
    return jsonError(t.messages.errRateLimit, 429);
  }

  if (!senderDeviceId || !senderDevRow) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  let resolvedConvId = 0;
  let recipientUserId = 0;
  if (convId > 0) {
    if (!existingConv) return jsonError(t.common.authRequired, 403);
    resolvedConvId = existingConv.id;
    recipientUserId = existingConv.user1_id === user.id ? existingConv.user2_id : existingConv.user1_id;
  } else if (targetUserId > 0) {
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

  const [partnerDevRows, selfDevRows] = await Promise.all([
    env.DB.prepare('SELECT device_id FROM e2ee_devices WHERE user_id = ?')
      .bind(recipientUserId)
      .all<{ device_id: number }>(),
    env.DB.prepare('SELECT device_id FROM e2ee_devices WHERE user_id = ?')
      .bind(user.id)
      .all<{ device_id: number }>(),
  ]);
  const validDevicePairs = new Set<string>();
  for (const r of partnerDevRows.results || []) {
    validDevicePairs.add(`${recipientUserId}:${Number(r.device_id)}`);
  }
  for (const r of selfDevRows.results || []) {
    validDevicePairs.add(`${user.id}:${Number(r.device_id)}`);
  }
  const verifiedEnvelopes = envelopes.filter((e) => validDevicePairs.has(`${e.u}:${e.d}`));
  if (!verifiedEnvelopes.some((e) => e.u === recipientUserId)) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  let imageKey = '';
  if (encMediaFile) {
    if (encMediaFile.size < 20 || encMediaFile.size > MAX_DM_ENC_MEDIA_SIZE) {
      return jsonError(t.messages.errImageTooLarge, 400);
    }
    const buf = await encMediaFile.arrayBuffer();
    if (buf.byteLength < 20 || buf.byteLength > MAX_DM_ENC_MEDIA_SIZE) {
      return jsonError(t.messages.errImageTooLarge, 400);
    }
    const rand = crypto.randomUUID().replace(/-/g, '');
    imageKey = `dm/${resolvedConvId}/${Date.now()}_${rand}.enc`;
    await env.STORAGE.put(imageKey, buf, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
  }

  const serializedEnvelope = JSON.stringify(verifiedEnvelopes);
  let ins: { meta: { changes: number; last_row_id?: number } };
  try {
    ins = await env.DB.prepare(
      'INSERT INTO messages (conversation_id, sender_id, body, image_key, is_encrypted, sender_device_id, ciphertext_envelope) VALUES (?, ?, ?, ?, 1, ?, ?)',
    )
      .bind(resolvedConvId, user.id, '', imageKey, senderDeviceId, serializedEnvelope)
      .run();
  } catch {
    if (imageKey) {
      try {
        await env.STORAGE.delete(imageKey);
      } catch {}
    }
    return jsonError(t.common.networkError, 500);
  }

  let msgId = Number(ins.meta?.last_row_id || 0);
  if (!msgId) {
    const latest = await env.DB.prepare(
      'SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ? ORDER BY id DESC LIMIT 1',
    )
      .bind(resolvedConvId, user.id)
      .first<{ id: number }>();
    msgId = latest ? Number(latest.id) : 0;
  }

  if (msgId) {
    await env.DB.prepare(
      "UPDATE conversations SET last_message_id = ?, last_message_at = datetime('now'), user1_hidden = 0, user2_hidden = 0 WHERE id = ?",
    )
      .bind(msgId, resolvedConvId)
      .run();
  }

  let updatedSharesCount: number | undefined;
  if (sharedPostId > 0 && recipientUserId > 0) {
    try {
      const postExists = await env.DB.prepare('SELECT id FROM posts WHERE id = ?')
        .bind(sharedPostId)
        .first<{ id: number }>();
      if (postExists) {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO post_shares (post_id, user_id, recipient_id) VALUES (?, ?, ?)',
        )
          .bind(sharedPostId, user.id, recipientUserId)
          .run();
        const cntRow = await env.DB.prepare(
          'SELECT COUNT(*) AS cnt FROM post_shares WHERE post_id = ?',
        )
          .bind(sharedPostId)
          .first<{ cnt: number | string }>();
        updatedSharesCount = Number(cntRow?.cnt || 0);
        await env.DB.prepare('UPDATE posts SET shares_count = ? WHERE id = ?')
          .bind(updatedSharesCount, sharedPostId)
          .run();
      }
    } catch {}
  }

  const createdAt = new Date().toISOString();
  const baseMsg = {
    id: msgId,
    conversation_id: resolvedConvId,
    sender_id: user.id,
    body: '',
    image_key: imageKey,
    is_encrypted: 1,
    sender_device_id: senderDeviceId,
    read_at: null,
    listened_at: null,
    edited_at: null,
    edit_version: 0,
    created_at: createdAt,
    reactions: [],
  };
  const senderMsgPayload = {
    ...baseMsg,
    ciphertext_envelope: filterEnvelopeForUser(serializedEnvelope, user.id),
  };

  if (recipientUserId > 0) {
    const senderSessionHash = await getSessionHashFromRequest(request);
    const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
    const recipientMsgPayload = {
      ...baseMsg,
      ciphertext_envelope: filterEnvelopeForUser(serializedEnvelope, recipientUserId),
    };
    const senderMeta = {
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      avatar_key: user.avatar_key || '',
      is_verified: user.is_verified ? 1 : 0,
    };

    await runBackground(ctx, async () => {
      const recipientUnread = await getTotalUnreadCount(env, recipientUserId);
      await Promise.all([
        emitUserEvent(env, recipientUserId, {
          type: 'message.new',
          conversation_id: resolvedConvId,
          message: recipientMsgPayload,
          sender: senderMeta,
          unread_total: recipientUnread,
        }),
        emitUserEvent(env, recipientUserId, {
          type: 'unread.updated',
          messages: recipientUnread,
        }),
        emitUserEvent(
          env,
          user.id,
          {
            type: 'message.new',
            conversation_id: resolvedConvId,
            message: senderMsgPayload,
            sender: senderMeta,
          },
          { excludeSession: senderSessionKey },
        ),
        authorizeRealtimeConversation(env, user.id, resolvedConvId, recipientUserId),
        authorizeRealtimeConversation(env, recipientUserId, resolvedConvId, user.id),
      ]);

      const dmPushAllowed = await acquireCooldownAtomic(env, `push:dm:${recipientUserId}:${user.id}`, 5);
      if (dmPushAllowed) {
        await sendPushToUser(env, recipientUserId, (rt) => ({
          kind: 'dm',
          title: 'Photogram',
          body: `@${user.username}: ${rt.messages.encryptedPushBody}`,
          url: `/messages/${encodeURIComponent(user.username)}`,
          tag: `dm-${resolvedConvId}`,
        }));
      }
    });
  }

  return jsonResponse(
    {
      success: true,
      conversation_id: resolvedConvId,
      message: senderMsgPayload,
      ...(updatedSharesCount !== undefined ? { shares_count: updatedSharesCount } : {}),
    },
    201,
  );
}

export async function handleMarkRead(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const parsed = await readJsonWithLimit<{ conversation_id?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const convId = parsePositiveId(parsed.data?.conversation_id);
  if (!convId) {
    return jsonError(t.common.networkError, 400);
  }

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const viewerSlot: 1 | 2 = conv.user1_id === Number(user.id) ? 1 : 2;
  const marked = await markConversationRead(env, convId, user.id, conv.cleared_before_id, viewerSlot);
  const partnerId = conv.user1_id === Number(user.id) ? conv.user2_id : conv.user1_id;
  const partnerSlot: 1 | 2 = conv.user1_id === partnerId ? 1 : 2;
  const partnerCleared = partnerSlot === 1 ? conv.user1_cleared_before_id : conv.user2_cleared_before_id;
  const unreadTotal = await getTotalUnreadCount(env, user.id);
  await runBackground(ctx, async () => {
    const partnerLastRead = await getLastReadOwnMessageId(env, convId, partnerId, partnerCleared, partnerSlot);
    await Promise.all([
      marked > 0 || partnerLastRead > 0
        ? emitUserEvent(env, partnerId, {
            type: 'message.read',
            conversation_id: convId,
            reader_id: user.id,
            last_read_id: partnerLastRead,
          })
        : Promise.resolve(-1),
      emitUserEvent(env, user.id, {
        type: 'unread.updated',
        messages: unreadTotal,
      }),
    ]);
  });
  return jsonResponse({ success: true, unread_total: unreadTotal }, 200);
}

async function deleteDmStorageKeys(env: Env, keys: string[]): Promise<void> {
  const validKeys = Array.from(new Set(keys.filter((k) => Boolean(k && DM_KEY_RE.test(k)))));
  if (validKeys.length === 0) return;
  const BATCH_SIZE = 1000;
  for (let i = 0; i < validKeys.length; i += BATCH_SIZE) {
    const batch = validKeys.slice(i, i + BATCH_SIZE);
    try {
      await env.STORAGE.delete(batch.length === 1 ? batch[0] : batch);
    } catch {
      for (const k of batch) {
        try {
          await env.STORAGE.delete(k);
        } catch {}
      }
    }
  }
}

export async function handleDeleteConversation(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:delconv:user:${user.id}`, 20, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ conversation_id?: unknown; for_both?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const convId = parsePositiveId(parsed.data?.conversation_id);
  if (!convId) {
    return jsonError(t.common.networkError, 400);
  }
  const forBoth = parsed.data?.for_both === true;

  const conv = await getConversationForUser(env, convId, user.id);
  if (!conv) return jsonError(t.common.authRequired, 403);

  const visibleMsgRows = await env.DB.prepare(
    'SELECT id FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id DESC LIMIT 500',
  )
    .bind(convId, conv.cleared_before_id)
    .all<{ id: number }>();
  const clearedIds = (visibleMsgRows.results || []).map((r) => Number(r.id)).filter((id) => id > 0);

  if (forBoth) {
    const mediaRows = await env.DB.prepare(
      "SELECT image_key FROM messages WHERE conversation_id = ? AND image_key != ''",
    )
      .bind(convId)
      .all<{ image_key: string }>();
    const mediaKeys = (mediaRows.results || []).map((r) => r.image_key).filter(Boolean);

    await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?').bind(convId).run();
    await env.DB.prepare('DELETE FROM conversations WHERE id = ?').bind(convId).run();
    await deleteDmStorageKeys(env, mediaKeys);
  } else {
    const maxRow = await env.DB.prepare(
      'SELECT MAX(id) AS max_id FROM messages WHERE conversation_id = ?',
    )
      .bind(convId)
      .first<{ max_id: number | null }>();
    const maxId = Number(maxRow?.max_id || 0);
    const isUser1 = conv.user1_id === Number(user.id);
    const nextCleared = Math.max(isUser1 ? conv.user1_cleared_before_id : conv.user2_cleared_before_id, maxId);

    if (isUser1) {
      await env.DB.prepare(
        'UPDATE conversations SET user1_cleared_before_id = ?, user1_hidden = 1 WHERE id = ?',
      )
        .bind(nextCleared, convId)
        .run();
    } else {
      await env.DB.prepare(
        'UPDATE conversations SET user2_cleared_before_id = ?, user2_hidden = 1 WHERE id = ?',
      )
        .bind(nextCleared, convId)
        .run();
    }

    const u1Cleared = isUser1 ? nextCleared : conv.user1_cleared_before_id;
    const u2Cleared = isUser1 ? conv.user2_cleared_before_id : nextCleared;
    const minCleared = Math.min(u1Cleared, u2Cleared);
    if (minCleared > 0) {
      const oldMediaRows = await env.DB.prepare(
        "SELECT image_key FROM messages WHERE conversation_id = ? AND id <= ? AND image_key != ''",
      )
        .bind(convId, minCleared)
        .all<{ image_key: string }>();
      const oldMediaKeys = (oldMediaRows.results || []).map((r) => r.image_key).filter(Boolean);
      await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ? AND id <= ?')
        .bind(convId, minCleared)
        .run();
      await deleteDmStorageKeys(env, oldMediaKeys);
    }
  }

  const partnerId = conv.user1_id === Number(user.id) ? conv.user2_id : conv.user1_id;
  const [unreadTotal, senderSessionHash] = await Promise.all([
    getTotalUnreadCount(env, user.id),
    getSessionHashFromRequest(request),
  ]);
  const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
  await runBackground(ctx, async () => {
    await revokeRealtimeConversation(env, user.id, convId);
    const rtPromises: Promise<unknown>[] = [
      emitUserEvent(
        env,
        user.id,
        { type: 'conversation.deleted', conversation_id: convId, for_both: forBoth },
        { excludeSession: senderSessionKey },
      ),
      emitUserEvent(env, user.id, { type: 'unread.updated', messages: unreadTotal }),
    ];
    if (forBoth && partnerId > 0) {
      const partnerUnread = await getTotalUnreadCount(env, partnerId);
      rtPromises.push(
        revokeRealtimeConversation(env, partnerId, convId),
        emitUserEvent(env, partnerId, { type: 'conversation.deleted', conversation_id: convId, for_both: true }),
        emitUserEvent(env, partnerId, { type: 'unread.updated', messages: partnerUnread }),
      );
    }
    await Promise.all(rtPromises);
  });
  return jsonResponse(
    {
      success: true,
      conversation_id: convId,
      for_both: forBoth,
      cleared_message_ids: clearedIds,
      unread_total: unreadTotal,
    },
    200,
  );
}

async function refreshConversationLastMessage(env: Env, conversationId: number): Promise<void> {
  const prev = await env.DB.prepare(
    'SELECT id, created_at FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
  )
    .bind(conversationId)
    .first<{ id: number; created_at: string }>();

  if (prev) {
    await env.DB.prepare('UPDATE conversations SET last_message_id = ?, last_message_at = ? WHERE id = ?')
      .bind(prev.id, prev.created_at, conversationId)
      .run();
  } else {
    await env.DB.prepare('UPDATE conversations SET last_message_id = NULL WHERE id = ?')
      .bind(conversationId)
      .run();
  }
}

export async function handleDeleteMessage(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:del:user:${user.id}`, 30, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ message_id?: unknown; for_both?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const msgId = parsePositiveId(parsed.data?.message_id);
  if (!msgId) {
    return jsonError(t.common.networkError, 400);
  }
  const forBoth = parsed.data?.for_both === true;

  const msg = await env.DB.prepare(
    `SELECT m.id, m.conversation_id, m.sender_id, m.image_key, m.deleted_for_user1, m.deleted_for_user2,
            c.user1_id, c.user2_id, c.user1_cleared_before_id, c.user2_cleared_before_id
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ?
       AND m.deleted_at IS NULL
       AND (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
     LIMIT 1`,
  )
    .bind(msgId, user.id, user.id)
    .first<{
      id: number;
      conversation_id: number;
      sender_id: number;
      image_key: string;
      deleted_for_user1?: number;
      deleted_for_user2?: number;
      user1_id: number;
      user2_id: number;
      user1_cleared_before_id?: number;
      user2_cleared_before_id?: number;
    }>();

  if (!msg) return jsonError(t.common.networkError, 404);

  if (forBoth) {
    const updated = await env.DB.prepare(
      `UPDATE messages
       SET deleted_at = datetime('now'),
           body = '',
           image_key = '',
           ciphertext_envelope = ''
       WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL
       RETURNING id`,
    )
      .bind(msgId, msg.conversation_id)
      .first<{ id: number }>();

    if (!updated) return jsonError(t.common.networkError, 404);

    await env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ?').bind(msgId).run();
    if (msg.image_key) {
      await deleteDmStorageKeys(env, [msg.image_key]);
    }
    await refreshConversationLastMessage(env, msg.conversation_id);
  } else {
    const isUser1 = Number(msg.user1_id) === Number(user.id);
    const delCol = isUser1 ? 'deleted_for_user1' : 'deleted_for_user2';
    const updated = await env.DB.prepare(
      `UPDATE messages
       SET ${delCol} = 1
       WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL
       RETURNING deleted_for_user1, deleted_for_user2`,
    )
      .bind(msgId, msg.conversation_id)
      .first<{ deleted_for_user1: number; deleted_for_user2: number }>();

    if (!updated) return jsonError(t.common.networkError, 404);

    const hiddenFor1 =
      Number(updated.deleted_for_user1) === 1 || Number(msg.id) <= Number(msg.user1_cleared_before_id || 0);
    const hiddenFor2 =
      Number(updated.deleted_for_user2) === 1 || Number(msg.id) <= Number(msg.user2_cleared_before_id || 0);
    if (hiddenFor1 && hiddenFor2) {
      await env.DB.prepare(
        `UPDATE messages
         SET deleted_at = datetime('now'),
             body = '',
             image_key = '',
             ciphertext_envelope = ''
         WHERE id = ? AND conversation_id = ? AND deleted_at IS NULL`,
      )
        .bind(msgId, msg.conversation_id)
        .run();
      await env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ?').bind(msgId).run();
      if (msg.image_key) {
        await deleteDmStorageKeys(env, [msg.image_key]);
      }
      await refreshConversationLastMessage(env, msg.conversation_id);
    }
  }

  const partnerId = Number(msg.user1_id) === Number(user.id) ? Number(msg.user2_id) : Number(msg.user1_id);
  const [unreadTotal, senderSessionHash] = await Promise.all([
    getTotalUnreadCount(env, user.id),
    getSessionHashFromRequest(request),
  ]);
  const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
  await runBackground(ctx, async () => {
    const delPromises: Promise<unknown>[] = [
      emitUserEvent(
        env,
        user.id,
        { type: 'message.deleted', conversation_id: Number(msg.conversation_id), message_id: msgId, for_both: forBoth },
        { excludeSession: senderSessionKey },
      ),
      emitUserEvent(env, user.id, { type: 'unread.updated', messages: unreadTotal }),
    ];
    if (forBoth && partnerId > 0) {
      const partnerUnread = await getTotalUnreadCount(env, partnerId);
      delPromises.push(
        emitUserEvent(env, partnerId, {
          type: 'message.deleted',
          conversation_id: Number(msg.conversation_id),
          message_id: msgId,
          for_both: true,
        }),
        emitUserEvent(env, partnerId, { type: 'unread.updated', messages: partnerUnread }),
      );
    }
    await Promise.all(delPromises);
  });
  return jsonResponse({ success: true, deleted_id: msgId, for_both: forBoth, unread_total: unreadTotal }, 200);
}

export async function handleMarkListened(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:listened:user:${user.id}`, 60, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ message_id?: unknown }>(request, 1024);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const msgId = parsePositiveId(parsed.data?.message_id);
  if (!msgId) return jsonError(t.common.networkError, 400);

  const msg = await env.DB.prepare(
    `SELECT m.id, m.conversation_id, m.sender_id, m.image_key, m.listened_at
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ?
       AND m.deleted_at IS NULL
       AND (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
     LIMIT 1`,
  )
    .bind(msgId, user.id, user.id)
    .first<{
      id: number;
      conversation_id: number;
      sender_id: number;
      image_key: string;
      listened_at: string | null;
    }>();

  if (!msg || !msg.image_key) return jsonError(t.common.networkError, 404);
  if (Number(msg.sender_id) === Number(user.id)) {
    return jsonResponse({ success: true, ignored: true, listened_at: msg.listened_at || null }, 200);
  }
  if (msg.listened_at) {
    return jsonResponse({ success: true, listened_at: msg.listened_at }, 200);
  }

  const listenedAt = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE messages SET listened_at = datetime('now') WHERE id = ? AND listened_at IS NULL",
  )
    .bind(msgId)
    .run();

  const senderSessionHash = await getSessionHashFromRequest(request);
  const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
  await runBackground(ctx, () =>
    Promise.all([
      emitUserEvent(env, Number(msg.sender_id), {
        type: 'message.listened',
        conversation_id: Number(msg.conversation_id),
        message_id: msgId,
        listened_at: listenedAt,
      }),
      emitUserEvent(
        env,
        user.id,
        {
          type: 'message.listened',
          conversation_id: Number(msg.conversation_id),
          message_id: msgId,
          listened_at: listenedAt,
        },
        { excludeSession: senderSessionKey },
      ),
    ]),
  );

  return jsonResponse({ success: true, listened_at: listenedAt }, 200);
}

export async function handleToggleReaction(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:react:user:${user.id}`, REACT_LIMIT_PER_MIN, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const parsed = await readJsonWithLimit<{ message_id?: unknown; emoji?: unknown }>(request, 2048);
  if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);

  const msgId = parsePositiveId(parsed.data?.message_id);
  const emoji = typeof parsed.data?.emoji === 'string' ? parsed.data.emoji.trim() : '';
  if (!msgId || !ALLOWED_DM_REACTION_SET.has(emoji)) {
    return jsonError(t.common.networkError, 400);
  }

  const msg = await env.DB.prepare(
    `SELECT m.id, m.conversation_id, c.user1_id, c.user2_id
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ?
       AND m.deleted_at IS NULL
       AND (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
     LIMIT 1`,
  )
    .bind(msgId, user.id, user.id)
    .first<{ id: number; conversation_id: number; user1_id: number; user2_id: number }>();

  if (!msg) return jsonError(t.common.networkError, 404);

  const existing = await env.DB.prepare(
    'SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?',
  )
    .bind(msgId, user.id)
    .first<{ emoji: string }>();

  let action: 'set' | 'removed' = 'set';
  if (existing && existing.emoji === emoji) {
    await env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?')
      .bind(msgId, user.id)
      .run();
    action = 'removed';
  } else {
    await env.DB.prepare(
      `INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = datetime('now')`,
    )
      .bind(msgId, user.id, emoji)
      .run();
    action = 'set';
  }

  const partnerId = Number(msg.user1_id) === Number(user.id) ? Number(msg.user2_id) : Number(msg.user1_id);
  const [map, senderSessionHash] = await Promise.all([
    getReactionsForMessages(env, [msgId], user.id),
    getSessionHashFromRequest(request),
  ]);
  const reactions = map.get(msgId) || [];
  const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
  await runBackground(ctx, async () => {
    const partnerReactions = partnerId > 0
      ? ((await getReactionsForMessages(env, [msgId], partnerId)).get(msgId) || [])
      : [];
    await Promise.all([
      partnerId > 0
        ? emitUserEvent(env, partnerId, {
            type: 'message.reaction',
            conversation_id: Number(msg.conversation_id),
            message_id: msgId,
            reactions: partnerReactions,
          })
        : Promise.resolve(-1),
      emitUserEvent(
        env,
        user.id,
        {
          type: 'message.reaction',
          conversation_id: Number(msg.conversation_id),
          message_id: msgId,
          reactions,
        },
        { excludeSession: senderSessionKey },
      ),
    ]);
    if (action === 'set' && partnerId > 0) {
      const reactPushAllowed = await acquireCooldownAtomic(
        env,
        `push:dm_react:${partnerId}:${user.id}:${msgId}`,
        300,
      );
      if (reactPushAllowed) {
        await sendPushToUser(env, partnerId, {
          kind: 'dm_reaction',
          title: 'Photogram',
          body: `@${user.username} ${emoji}`,
          url: `/messages/${encodeURIComponent(user.username)}`,
          tag: `dm-react-${msg.conversation_id}`,
        });
      }
    }
  });
  return jsonResponse({ success: true, message_id: msgId, action, reactions }, 200);
}

export async function handleEditMessage(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonError(t.common.authRequired, 401);

  const allowed = await consumeRateLimitAtomic(env, `dm:edit:user:${user.id}`, EDIT_LIMIT_PER_MIN, 60);
  if (!allowed) return jsonError(t.messages.errRateLimit, 429);

  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  let msgId: number | null = null;
  let plainBodyInput: unknown = undefined;
  let senderDeviceIdInput: unknown = undefined;
  let rawEnvelopes: unknown = undefined;
  let encMediaFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    if (!checkContentLength(request, MAX_DM_ENC_MEDIA_SIZE + 524288)) {
      return jsonError(t.messages.errImageTooLarge, 413);
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(t.common.networkError, 400);
    }
    msgId = parsePositiveId(form.get('message_id'));
    senderDeviceIdInput = form.get('sender_device_id');
    const envStr = form.get('envelopes');
    if (typeof envStr === 'string' && envStr.length <= 524288) {
      try {
        rawEnvelopes = JSON.parse(envStr);
      } catch {
        rawEnvelopes = null;
      }
    }
    const maybeFile = form.get('encrypted_media');
    if (maybeFile && typeof maybeFile === 'object' && typeof (maybeFile as File).arrayBuffer === 'function') {
      encMediaFile = maybeFile as File;
    }
  } else {
    const parsed = await readJsonWithLimit<{
      message_id?: unknown;
      body?: unknown;
      sender_device_id?: unknown;
      envelopes?: unknown;
    }>(request, 524288);
    if (!parsed.ok) return jsonError(t.common.networkError, parsed.status);
    msgId = parsePositiveId(parsed.data?.message_id);
    plainBodyInput = parsed.data?.body;
    senderDeviceIdInput = parsed.data?.sender_device_id;
    rawEnvelopes = parsed.data?.envelopes;
  }

  if (!msgId) {
    return jsonError(t.common.networkError, 400);
  }

  const msg = await env.DB.prepare(
    `SELECT m.id, m.conversation_id, m.sender_id, m.is_encrypted, m.image_key, m.edit_version,
            c.user1_id, c.user2_id
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id = ?
       AND m.sender_id = ?
       AND m.deleted_at IS NULL
       AND (
         (c.user1_id = ? AND m.id > c.user1_cleared_before_id AND m.deleted_for_user1 = 0)
         OR (c.user2_id = ? AND m.id > c.user2_cleared_before_id AND m.deleted_for_user2 = 0)
       )
     LIMIT 1`,
  )
    .bind(msgId, user.id, user.id, user.id)
    .first<{
      id: number;
      conversation_id: number;
      sender_id: number;
      is_encrypted?: number | boolean;
      image_key?: string;
      edit_version?: number;
      user1_id: number;
      user2_id: number;
    }>();

  if (!msg) return jsonError(t.common.networkError, 404);

  const isLegacyPlaintext = !Boolean(msg.is_encrypted);
  const nextVersion = Number(msg.edit_version || 0) + 1;

  if (isLegacyPlaintext && rawEnvelopes === undefined && !encMediaFile) {
    const cleanBody = typeof plainBodyInput === 'string' ? plainBodyInput.trim() : '';
    if (!cleanBody && !msg.image_key) {
      return jsonError(t.messages.errEmptyMessage, 400);
    }
    if (cleanBody.length > 2000) {
      return jsonError(t.messages.errTooLong, 400);
    }

    const updated = await env.DB.prepare(
      `UPDATE messages
       SET body = ?,
           edited_at = datetime('now'),
           edit_version = edit_version + 1
       WHERE id = ? AND sender_id = ? AND is_encrypted = 0 AND deleted_at IS NULL
       RETURNING edited_at, edit_version`,
    )
      .bind(cleanBody, msgId, user.id)
      .first<{ edited_at: string | null; edit_version: number }>();

    if (!updated) return jsonError(t.common.networkError, 404);

    const editedAt = updated.edited_at || new Date().toISOString();
    const editVer = Number(updated.edit_version || nextVersion);
    const plainPartnerId = Number(msg.user1_id) === Number(user.id) ? Number(msg.user2_id) : Number(msg.user1_id);
    const senderSessionHash = await getSessionHashFromRequest(request);
    const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
    const plainEditMsg = {
      id: msgId,
      conversation_id: Number(msg.conversation_id),
      sender_id: user.id,
      body: cleanBody,
      image_key: msg.image_key || '',
      is_encrypted: 0,
      edited_at: editedAt,
      edit_version: editVer,
    };
    await runBackground(ctx, () =>
      Promise.all([
        plainPartnerId > 0
          ? emitUserEvent(env, plainPartnerId, {
              type: 'message.edited',
              conversation_id: Number(msg.conversation_id),
              message: plainEditMsg,
            })
          : Promise.resolve(-1),
        emitUserEvent(
          env,
          user.id,
          {
            type: 'message.edited',
            conversation_id: Number(msg.conversation_id),
            message: plainEditMsg,
          },
          { excludeSession: senderSessionKey },
        ),
      ]),
    );

    return jsonResponse(
      {
        success: true,
        message_id: msgId,
        conversation_id: Number(msg.conversation_id),
        body: cleanBody,
        is_encrypted: 0,
        edited_at: editedAt,
        edit_version: editVer,
      },
      200,
    );
  }

  const senderDeviceId = parsePositiveId(senderDeviceIdInput);
  if (!senderDeviceId) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  const senderDevRow = await env.DB.prepare(
    'SELECT id FROM e2ee_devices WHERE user_id = ? AND device_id = ?',
  )
    .bind(user.id, senderDeviceId)
    .first<{ id: number }>();
  if (!senderDevRow) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  const recipientUserId = Number(msg.user1_id) === Number(user.id) ? Number(msg.user2_id) : Number(msg.user1_id);
  const allowedRecipients = new Set<number>([recipientUserId, Number(user.id)]);
  const envelopes = validateEnvelopes(rawEnvelopes, allowedRecipients);
  if (!envelopes || !envelopes.some((e) => e.u === recipientUserId)) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  const [partnerDevRows, selfDevRows] = await Promise.all([
    env.DB.prepare('SELECT device_id FROM e2ee_devices WHERE user_id = ?')
      .bind(recipientUserId)
      .all<{ device_id: number }>(),
    env.DB.prepare('SELECT device_id FROM e2ee_devices WHERE user_id = ?')
      .bind(user.id)
      .all<{ device_id: number }>(),
  ]);
  const validDevicePairs = new Set<string>();
  for (const r of partnerDevRows.results || []) {
    validDevicePairs.add(`${recipientUserId}:${Number(r.device_id)}`);
  }
  for (const r of selfDevRows.results || []) {
    validDevicePairs.add(`${user.id}:${Number(r.device_id)}`);
  }
  const verifiedEnvelopes = envelopes.filter((e) => validDevicePairs.has(`${e.u}:${e.d}`));
  if (!verifiedEnvelopes.some((e) => e.u === recipientUserId)) {
    return jsonError(t.messages.e2eeRequired, 400);
  }

  const oldImageKey = msg.image_key || '';
  let nextImageKey = oldImageKey;
  let uploadedNewKey = '';
  if (encMediaFile) {
    if (!oldImageKey) {
      return jsonError(t.common.networkError, 400);
    }
    if (encMediaFile.size < 20 || encMediaFile.size > MAX_DM_ENC_MEDIA_SIZE) {
      return jsonError(t.messages.errImageTooLarge, 400);
    }
    const buf = await encMediaFile.arrayBuffer();
    if (buf.byteLength < 20 || buf.byteLength > MAX_DM_ENC_MEDIA_SIZE) {
      return jsonError(t.messages.errImageTooLarge, 400);
    }
    const rand = crypto.randomUUID().replace(/-/g, '');
    uploadedNewKey = `dm/${Number(msg.conversation_id)}/${Date.now()}_${rand}.enc`;
    await env.STORAGE.put(uploadedNewKey, buf, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    nextImageKey = uploadedNewKey;
  }

  const serializedEnvelope = JSON.stringify(verifiedEnvelopes);

  let updated: { edited_at: string | null; edit_version: number } | null = null;
  try {
    updated = await env.DB.prepare(
      `UPDATE messages
       SET body = '',
           image_key = ?,
           is_encrypted = 1,
           sender_device_id = ?,
           ciphertext_envelope = ?,
           edited_at = datetime('now'),
           edit_version = edit_version + 1
       WHERE id = ? AND sender_id = ? AND deleted_at IS NULL
       RETURNING edited_at, edit_version`,
    )
      .bind(nextImageKey, senderDeviceId, serializedEnvelope, msgId, user.id)
      .first<{ edited_at: string | null; edit_version: number }>();
  } catch {
    if (uploadedNewKey) {
      try { await env.STORAGE.delete(uploadedNewKey); } catch {}
    }
    return jsonError(t.common.networkError, 500);
  }

  if (!updated) {
    if (uploadedNewKey) {
      try { await env.STORAGE.delete(uploadedNewKey); } catch {}
    }
    return jsonError(t.common.networkError, 404);
  }

  const editedAt = updated.edited_at || new Date().toISOString();
  const editVer = Number(updated.edit_version || nextVersion);
  const senderSessionHash = await getSessionHashFromRequest(request);
  const senderSessionKey = senderSessionHash ? senderSessionHash.slice(0, 32) : undefined;
  const encBase = {
    id: msgId,
    conversation_id: Number(msg.conversation_id),
    sender_id: user.id,
    body: '',
    image_key: nextImageKey,
    is_encrypted: 1,
    sender_device_id: senderDeviceId,
    edited_at: editedAt,
    edit_version: editVer,
  };
  await runBackground(ctx, () =>
    Promise.all([
      uploadedNewKey && oldImageKey && oldImageKey !== uploadedNewKey
        ? env.STORAGE.delete(oldImageKey).catch(() => {})
        : Promise.resolve(),
      emitUserEvent(env, recipientUserId, {
        type: 'message.edited',
        conversation_id: Number(msg.conversation_id),
        message: {
          ...encBase,
          ciphertext_envelope: filterEnvelopeForUser(serializedEnvelope, recipientUserId),
        },
      }),
      emitUserEvent(
        env,
        user.id,
        {
          type: 'message.edited',
          conversation_id: Number(msg.conversation_id),
          message: {
            ...encBase,
            ciphertext_envelope: filterEnvelopeForUser(serializedEnvelope, user.id),
          },
        },
        { excludeSession: senderSessionKey },
      ),
    ]),
  );

  return jsonResponse(
    {
      success: true,
      message_id: msgId,
      conversation_id: Number(msg.conversation_id),
      image_key: nextImageKey,
      is_encrypted: 1,
      edited_at: editedAt,
      edit_version: editVer,
    },
    200,
  );
}

export async function handleUnreadCount(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonResponse({ unread_total: 0 }, 200);
  const unreadTotal = await getTotalUnreadCount(env, user.id);
  return jsonResponse({ success: true, unread_total: unreadTotal }, 200);
}
