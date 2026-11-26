import { Env, NotificationItem } from './types';
import { getUserFromRequest } from './auth';
import { detectLanguage, getTranslations } from './languages';
import { sendPushToUser } from './push';
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

export async function createNotification(
  env: Env,
  opts: {
    userId: number;
    actorId: number;
    type: 'like' | 'comment' | 'follow';
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
    } else if (opts.type === 'follow') {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow'",
      )
        .bind(opts.userId, opts.actorId)
        .run();
    }

    const preview = opts.commentPreview ? String(opts.commentPreview).trim().slice(0, 120) : '';
    await env.DB.prepare(
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

    const actor = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
      .bind(opts.actorId)
      .first<{ username: string }>();

    if (actor?.username) {
      const pushAllowed = await acquireCooldownAtomic(
        env,
        `push:notif:${opts.userId}:${opts.actorId}:${opts.type}`,
        30,
      );
      if (pushAllowed) {
        let bodyText = '';
        if (opts.type === 'like') bodyText = `@${actor.username} liked your post`;
        else if (opts.type === 'follow') bodyText = `@${actor.username} started following you`;
        else bodyText = `@${actor.username}: ${preview || 'commented on your post'}`;

        await sendPushToUser(env, opts.userId, {
          kind: opts.type,
          title: 'Photogram',
          body: bodyText.slice(0, 140),
          url: '/notifications',
          tag: `notif-${opts.type}-${opts.postId || opts.actorId}`,
        });
      }
    }
  } catch {}
}

export async function removeNotification(
  env: Env,
  opts: {
    userId: number;
    actorId: number;
    type: 'like' | 'comment' | 'follow';
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
    } else if (opts.type === 'follow') {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE user_id = ? AND actor_id = ? AND type = 'follow'",
      )
        .bind(opts.userId, opts.actorId)
        .run();
    } else if (opts.type === 'comment' && opts.commentId) {
      await env.DB.prepare('DELETE FROM notifications WHERE comment_id = ?')
        .bind(opts.commentId)
        .run();
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
         EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = n.actor_id) AS is_following_actor
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 60`,
    )
      .bind(userId, userId)
      .all<{
        id: number;
        type: 'like' | 'comment' | 'follow';
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
