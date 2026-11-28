import { Env, NotificationItem } from './types';
import { getUserFromRequest } from './auth';
import { detectLanguage, getTranslations } from './languages';
import {
  formatPushActorTitle,
  safePushAvatarUrl,
  safePushPostThumbUrl,
  sendPushToUser,
} from './push';
import { emitUserEvent } from './realtime';
import { acquireCooldownAtomic, consumeRateLimitAtomic, readJsonWithLimit } from './security';

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export type NotificationType = 'like' | 'comment' | 'comment_like' | 'comment_reply' | 'follow' | 'mention';

const MAX_MENTION_TARGETS = 10;

export function extractMentionUsernames(text: string): string[] {
  if (!text || text.indexOf('@') === -1) return [];
  const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,24})(?![a-zA-Z0-9_])/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const uname = m[2].toLowerCase();
    set.add(uname);
    if (set.size >= MAX_MENTION_TARGETS) break;
  }
  return Array.from(set);
}

export async function notifyMentionedUsers(
  env: Env,
  opts: {
    text: string;
    actorId: number;
    postId?: number | null;
    commentId?: number | null;
    excludeUserIds?: number[];
  },
): Promise<void> {
  try {
    const names = extractMentionUsernames(opts.text);
    if (names.length === 0) return;

    const placeholders = names.map((_, idx) => `?${idx + 1}`).join(', ');
    const rows = await env.DB.prepare(
      `SELECT id FROM users WHERE LOWER(username) IN (${placeholders})`,
    )
      .bind(...names)
      .all<{ id: number }>();

    const excluded = new Set<number>([Number(opts.actorId)]);
    if (Array.isArray(opts.excludeUserIds)) {
      for (const id of opts.excludeUserIds) {
        if (id > 0) excluded.add(Number(id));
      }
    }

    const targets = (rows.results || [])
      .map((r) => Number(r.id))
      .filter((id) => id > 0 && !excluded.has(id));
    if (targets.length === 0) return;

    await Promise.all(
      targets.map((targetId) =>
        createNotification(env, {
          userId: targetId,
          actorId: opts.actorId,
          type: 'mention',
          postId: opts.postId ?? null,
          commentId: opts.commentId ?? null,
          commentPreview: opts.text,
        }),
      ),
    );
  } catch {}
}

export async function createNotification(
  env: Env,
  opts: {
    userId: number;
    actorId: number;
    type: NotificationType;
    postId?: number | null;
    commentId?: number | null;
    commentPreview?: string;
  },
): Promise<void> {
  try {
    if (!opts.userId || !opts.actorId || Number(opts.userId) === Number(opts.actorId)) return;

    const pref = await env.DB.prepare('SELECT notifications_enabled FROM users WHERE id = ?')
      .bind(opts.userId)
      .first<{ notifications_enabled?: number | boolean }>();

    if (!pref) return;
    if (pref.notifications_enabled === 0 || pref.notifications_enabled === false) return;

    if (opts.type === 'like' && opts.postId) {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'like' AND post_id = ?",
      )
        .bind(opts.userId, opts.actorId, opts.postId)
        .run();
    } else if (opts.type === 'comment_like' && opts.commentId) {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'comment_like' AND comment_id = ?",
      )
        .bind(opts.userId, opts.actorId, opts.commentId)
        .run();
    } else if (opts.type === 'follow') {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow'",
      )
        .bind(opts.userId, opts.actorId)
        .run();
    }

    const preview = opts.commentPreview ? String(opts.commentPreview).trim().slice(0, 120) : '';
    const ins = await env.DB.prepare(
      'INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id, comment_preview, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
    )
      .bind(
        opts.userId,
        opts.actorId,
        opts.type,
        opts.postId ?? null,
        opts.commentId ?? null,
        preview,
      )
      .run();

    let notifId = Number(ins.meta?.last_row_id || 0);
    if (!notifId) {
      const latestIns = await env.DB.prepare(
        'SELECT id FROM notifications WHERE user_id = ? AND actor_id = ? ORDER BY id DESC LIMIT 1',
      )
        .bind(opts.userId, opts.actorId)
        .first<{ id: number }>();
      notifId = Number(latestIns?.id || 0);
    }

    const [actor, cntRow, postInfo] = await Promise.all([
      env.DB.prepare('SELECT username, display_name, avatar_key FROM users WHERE id = ?')
        .bind(opts.actorId)
        .first<{ username: string; display_name?: string | null; avatar_key?: string | null }>(),
      env.DB.prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0')
        .bind(opts.userId)
        .first<{ cnt: number }>(),
      opts.postId
        ? env.DB.prepare(
            `SELECT p.image_key, p.caption, u.username AS author_username
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.id = ?`,
          )
            .bind(opts.postId)
            .first<{ image_key?: string | null; caption?: string | null; author_username?: string | null }>()
        : Promise.resolve(null),
    ]);
    const unreadCount = Number(cntRow?.cnt || 0);

    const isToggleNotif = opts.type === 'like' || opts.type === 'comment_like' || opts.type === 'follow';
    const targetScope = opts.commentId || opts.postId || 0;
    const cooldownSec = isToggleNotif ? 600 : 5;
    const notifyAllowed = actor?.username
      ? await acquireCooldownAtomic(
          env,
          `push:notif:${opts.userId}:${opts.actorId}:${opts.type}:${targetScope}`,
          cooldownSec,
        )
      : false;

    if (actor?.username && notifyAllowed) {
      await emitUserEvent(env, opts.userId, {
        type: 'notification.new',
        unread_count: unreadCount,
        notification: {
          id: notifId,
          type: opts.type,
          actor_username: actor.username,
          comment_preview: preview,
        },
      });
    }
    await emitUserEvent(env, opts.userId, {
      type: 'unread.updated',
      notifications: unreadCount,
    });

    if (actor?.username && notifyAllowed) {
      const actorTitle = formatPushActorTitle(actor.display_name, actor.username);
      const actorIcon = safePushAvatarUrl(actor.avatar_key);
      const postThumb = safePushPostThumbUrl(postInfo?.image_key);
      const captionSnippet = postInfo?.caption ? String(postInfo.caption).trim().slice(0, 60) : '';
      const targetUrl =
        opts.type === 'follow'
          ? `/u/${encodeURIComponent(actor.username)}`
          : opts.postId && postInfo?.author_username
            ? `/u/${encodeURIComponent(postInfo.author_username)}?post=${opts.postId}`
            : '/notifications';
      const nowTs = Date.now();
      await sendPushToUser(env, opts.userId, (rt) => {
        let bodyText = '';
        if (opts.type === 'like') {
          bodyText = captionSnippet
            ? rt.notifications.pushLikedPostWithCaption(captionSnippet)
            : rt.notifications.pushLikedPost;
        } else if (opts.type === 'comment_like') {
          bodyText = preview
            ? rt.notifications.pushLikedCommentWithText(preview)
            : rt.notifications.pushLikedComment;
        } else if (opts.type === 'comment_reply') {
          bodyText = preview
            ? rt.notifications.pushRepliedCommentWithText(preview)
            : rt.notifications.pushRepliedComment;
        } else if (opts.type === 'follow') {
          bodyText = rt.notifications.pushFollowed;
        } else if (opts.type === 'mention') {
          bodyText = preview
            ? rt.notifications.pushMentionedWithText(preview)
            : rt.notifications.pushMentioned;
        } else {
          bodyText = preview
            ? rt.notifications.pushCommentedPostWithText(preview)
            : rt.notifications.pushCommentedPost;
        }
        return {
          kind: opts.type,
          title: actorTitle,
          body: bodyText.slice(0, 160),
          url: targetUrl,
          tag: `notif-${opts.type}-${opts.commentId || opts.postId || opts.actorId}`,
          icon: actorIcon,
          image: opts.type === 'follow' ? undefined : postThumb,
          ts: nowTs,
        };
      });
    }
  } catch {}
}

export async function removeNotification(
  env: Env,
  opts: {
    userId: number;
    actorId: number;
    type: NotificationType;
    postId?: number | null;
    commentId?: number | null;
  },
): Promise<void> {
  try {
    if (opts.type === 'like' && opts.postId) {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'like' AND post_id = ?",
      )
        .bind(opts.userId, opts.actorId, opts.postId)
        .run();
    } else if (opts.type === 'comment_like' && opts.commentId) {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'comment_like' AND comment_id = ?",
      )
        .bind(opts.userId, opts.actorId, opts.commentId)
        .run();
    } else if (opts.type === 'follow') {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow'",
      )
        .bind(opts.userId, opts.actorId)
        .run();
    } else if ((opts.type === 'comment' || opts.type === 'comment_reply') && opts.commentId) {
      await env.DB.prepare('DELETE FROM notifications WHERE comment_id = ?')
        .bind(opts.commentId)
        .run();
    }
    if (opts.userId > 0) {
      const cntRow = await env.DB.prepare(
        'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      )
        .bind(opts.userId)
        .first<{ cnt: number }>();
      await emitUserEvent(env, opts.userId, {
        type: 'unread.updated',
        notifications: Number(cntRow?.cnt || 0),
      });
    }
  } catch {}
}

export async function getUserNotifications(env: Env, userId: number): Promise<NotificationItem[]> {
  try {
    const res = await env.DB.prepare(
      `SELECT
         n.id,
         n.type,
         n.actor_id,
         n.post_id,
         n.comment_preview,
         n.is_read,
         n.created_at,
         u.username AS actor_username,
         u.display_name AS actor_display_name,
         u.avatar_key AS actor_avatar_key,
         u.is_verified AS actor_is_verified,
         p.image_key AS post_image_key,
         pu.username AS post_author_username,
         EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = n.actor_id) AS is_following_actor
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       LEFT JOIN users pu ON pu.id = p.user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 60`,
    )
      .bind(userId, userId)
      .all<{
        id: number;
        type: NotificationType;
        actor_id: number;
        post_id: number | null;
        comment_preview: string;
        is_read: number | boolean;
        created_at: string;
        actor_username: string;
        actor_display_name: string;
        actor_avatar_key: string;
        actor_is_verified?: number | boolean;
        post_image_key: string | null;
        post_author_username?: string | null;
        is_following_actor: number | boolean;
      }>();

    return (res.results || []).map((r) => ({
      id: Number(r.id),
      type: r.type,
      actor_id: Number(r.actor_id),
      actor_username: r.actor_username,
      actor_display_name: r.actor_display_name || r.actor_username,
      actor_avatar_key: r.actor_avatar_key || '',
      actor_is_verified: r.actor_is_verified,
      post_id: r.post_id !== null ? Number(r.post_id) : null,
      post_image_key: r.post_image_key || '',
      post_author_username: r.post_author_username || '',
      comment_preview: r.comment_preview || '',
      is_read: Boolean(r.is_read),
      is_following_actor: Boolean(r.is_following_actor),
      created_at: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function markAllNotificationsRead(env: Env, userId: number): Promise<void> {
  try {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
      .bind(userId)
      .run();
    await emitUserEvent(env, userId, {
      type: 'unread.updated',
      notifications: 0,
    });
  } catch {}
}

export async function handleUnreadNotifications(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return jsonResponse({ enabled: false, unread_count: 0, latest: null }, 200);
  }

  const enabled = user.notifications_enabled !== 0 && user.notifications_enabled !== false;
  if (!enabled) {
    return jsonResponse({ success: true, enabled: false, unread_count: 0, latest: null }, 200);
  }

  const cntRow = await env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0',
  )
    .bind(user.id)
    .first<{ cnt: number }>();

  const latestRow = await env.DB.prepare(
    `SELECT n.id, n.type, n.comment_preview, u.username AS actor_username
     FROM notifications n
     JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = ? AND n.is_read = 0
     ORDER BY n.id DESC
     LIMIT 1`,
  )
    .bind(user.id)
    .first<{ id: number; type: string; comment_preview: string; actor_username: string }>();

  return jsonResponse(
    {
      success: true,
      enabled: true,
      unread_count: Number(cntRow?.cnt || 0),
      latest: latestRow
        ? {
            id: Number(latestRow.id),
            type: latestRow.type,
            actor_username: latestRow.actor_username,
            comment_preview: latestRow.comment_preview || '',
          }
        : null,
    },
    200,
  );
}

export async function handleToggleNotificationsSetting(
  request: Request,
  env: Env,
): Promise<Response> {
  const t = getTranslations(detectLanguage(request));
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return jsonError(t.common.authRequired, 401);
  }

  const allowed = await consumeRateLimitAtomic(env, `notif:pref:${user.id}`, 20, 60);
  if (!allowed) {
    return jsonError(t.common.networkError, 429);
  }

  const parsed = await readJsonWithLimit<{ enabled?: unknown }>(request, 1024);
  if (!parsed.ok) {
    return jsonError(t.common.networkError, parsed.status);
  }
  const body = parsed.data;

  if (typeof body?.enabled !== 'boolean') {
    return jsonError(t.common.networkError, 400);
  }

  const val = body.enabled ? 1 : 0;
  await env.DB.prepare('UPDATE users SET notifications_enabled = ? WHERE id = ?')
    .bind(val, user.id)
    .run();

  return jsonResponse({ success: true, enabled: body.enabled }, 200);
}
