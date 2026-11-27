import { Env, ProfileData, User, Post, ExploreData, ExploreUser, ExplorePost, FollowerUser } from './types';
import { getUserFromRequest } from './auth';
import { adjustAffinity, getPersonalizedExplore, invalidateRecommendationCaches } from './recommendations';
import { isBlockedUsername } from './blockedUsernames';
import { detectLanguage, getTranslations } from './languages';
import { createNotification, removeNotification } from './notifications';
import {
  acquireCooldownAtomic,
  checkContentLength,
  consumeBurstWithLockoutAtomic,
  consumeRateLimitAtomic,
  parsePositiveId,
  readJsonWithLimit,
  validateImageBytes,
} from './security';

const MAX_DISPLAY_NAME_LEN = 50;
const MAX_BIO_LEN = 150;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;


function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export async function getProfileData(
  env: Env,
  username: string,
  currentUserId?: number,
  includePosts: boolean = true,
): Promise<ProfileData | null> {
  const user = await env.DB.prepare(
    'SELECT id, username, display_name, bio, avatar_key, is_verified, created_at FROM users WHERE username = ?',
  )
    .bind(username)
    .first<User>();

  if (!user) return null;

  let postsCount = 0;
  let followersCount = 0;
  let followingCount = 0;
  let isFollowing = false;
  let followsYou = false;

  let userPosts: Post[] = [];
  if (includePosts) {
    try {
      const cntRow = await env.DB.prepare('SELECT COUNT(*) as c FROM posts WHERE user_id = ?')
        .bind(user.id)
        .first<{ c: number }>();
      if (cntRow) postsCount = Number(cntRow.c) || 0;
    } catch { }
    try {
      const viewerId = currentUserId || 0;
      const postRows = await env.DB.prepare(
        `SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
                COALESCE(p.shares_count, 0) AS shares_count,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS is_liked
         FROM posts p
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC
         LIMIT 120`
      )
        .bind(viewerId, user.id)
        .all<Post & { likes_count: number; comments_count: number; shares_count: number; is_liked: number | boolean }>();
      if (postRows.results) {
        userPosts = postRows.results.map(p => ({
          ...p,
          likes_count: Number(p.likes_count) || 0,
          comments_count: Number(p.comments_count) || 0,
          shares_count: Number(p.shares_count) || 0,
          is_liked: Boolean(p.is_liked)
        }));
        if (!postsCount) postsCount = userPosts.length;
      }
    } catch { }
  }

  try {
    const f1 = await env.DB.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?')
      .bind(user.id)
      .first<{ c: number }>();
    if (f1) followersCount = f1.c;
  } catch { }

  try {
    const f2 = await env.DB.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?')
      .bind(user.id)
      .first<{ c: number }>();
    if (f2) followingCount = f2.c;
  } catch { }

  if (currentUserId && currentUserId !== user.id) {
    try {
      const row = await env.DB.prepare(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      )
        .bind(currentUserId, user.id)
        .first();
      isFollowing = Boolean(row);
    } catch { }

    try {
      const rowBack = await env.DB.prepare(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      )
        .bind(user.id, currentUserId)
        .first();
      followsYou = Boolean(rowBack);
    } catch { }
  }

  let usernameChangesLeft = 3;
  let usernameUnlockDays = 0;

  if (currentUserId === user.id) {
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const windowStart = nowSeconds - 14 * 24 * 60 * 60;
      const changes = await env.DB.prepare(
        'SELECT created_at FROM username_changes WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC',
      )
        .bind(user.id, windowStart)
        .all<{ created_at: number }>();

      const recentChanges = changes.results || [];
      if (recentChanges.length >= 3) {
        usernameChangesLeft = 0;
        const oldestChange = recentChanges[0].created_at;
        const unlockAt = oldestChange + 14 * 24 * 60 * 60;
        const remainingSeconds = Math.max(0, unlockAt - nowSeconds);
        usernameUnlockDays = Math.max(1, Math.ceil(remainingSeconds / 86400));
      } else {
        usernameChangesLeft = 3 - recentChanges.length;
      }
    } catch { }
  }

  return {
    user,
    posts_count: postsCount,
    followers_count: followersCount,
    following_count: followingCount,
    is_owner: currentUserId === user.id,
    is_following: isFollowing,
    follows_you: followsYou,
    username_changes_left: usernameChangesLeft,
    username_unlock_days: usernameUnlockDays,
    current_user_id: currentUserId || 0,
    posts: userPosts,
  };
}


const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const USERNAME_CHANGE_LIMIT = 3;
const USERNAME_CHANGE_COOLDOWN_SECONDS = 14 * 24 * 60 * 60;


export async function handleUpdateProfile(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const allowed = await consumeRateLimitAtomic(env, `profile:upd:${currentUser.id}`, 15, 60);
  if (!allowed) return jsonError('Слишком много запросов. Подождите несколько секунд', 429);

  if (!checkContentLength(request, 16384)) {
    return jsonError('Неверный формат запроса', 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Неверный формат запроса', 400);
  }
  const usernameRaw = form.get('username');
  const targetUsername = typeof usernameRaw === 'string'
    ? usernameRaw.trim().toLowerCase()
    : currentUser.username;
  const displayName = (typeof form.get('display_name') === 'string' ? (form.get('display_name') as string) : '').trim();
  const bio = (typeof form.get('bio') === 'string' ? (form.get('bio') as string) : '').trim();

  if (!USERNAME_RE.test(targetUsername)) {
    return jsonError(
      'Имя пользователя должно содержать от 3 до 24 символов (буквы a-z, цифры, подчёркивание)',
      400,
    );
  }

  if (displayName.length > MAX_DISPLAY_NAME_LEN) {
    return jsonError(`Имя не должно превышать ${MAX_DISPLAY_NAME_LEN} символов`, 400);
  }
  if (bio.length > MAX_BIO_LEN) {
    return jsonError(`Описание не должно превышать ${MAX_BIO_LEN} символов`, 400);
  }

  let usernameChanged = false;
  if (targetUsername !== currentUser.username) {
    if (isBlockedUsername(targetUsername)) {
      const t = getTranslations(detectLanguage(request));
      return jsonError(t.auth.errUsernameForbidden, 400);
    }

    const unameLock = await acquireCooldownAtomic(env, `uname:cd:${currentUser.id}`, 5);
    if (!unameLock) {
      return jsonError('Слишком много запросов. Подождите несколько секунд', 429);
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .bind(targetUsername, currentUser.id)
      .first();
    if (existing) {
      return jsonError('Это имя пользователя уже занято', 409);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowStart = nowSeconds - USERNAME_CHANGE_COOLDOWN_SECONDS;

    const changes = await env.DB.prepare(
      'SELECT created_at FROM username_changes WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC',
    )
      .bind(currentUser.id, windowStart)
      .all<{ created_at: number }>();

    const recentChanges = changes.results || [];
    if (recentChanges.length >= USERNAME_CHANGE_LIMIT) {
      const oldestChange = recentChanges[0].created_at;
      const unlockAt = oldestChange + USERNAME_CHANGE_COOLDOWN_SECONDS;
      const remainingSeconds = Math.max(0, unlockAt - nowSeconds);
      const remainingDays = Math.max(1, Math.ceil(remainingSeconds / 86400));
      return jsonError(
        `Вы можете менять имя пользователя не более 3 раз за 14 дней. Следующее изменение будет доступно через ${remainingDays} дн.`,
        429,
      );
    }

    usernameChanged = true;
  }

  try {
    await env.DB.prepare('UPDATE users SET username = ?, display_name = ?, bio = ? WHERE id = ?')
      .bind(targetUsername, displayName || targetUsername, bio, currentUser.id)
      .run();
  } catch {
    return jsonError('Это имя пользователя уже занято', 409);
  }

  let changesLeft = USERNAME_CHANGE_LIMIT;
  let unlockDays = 0;

  if (usernameChanged) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO username_changes (user_id, created_at) VALUES (?, ?)',
    )
      .bind(currentUser.id, nowSeconds)
      .run();

    const windowStart = nowSeconds - USERNAME_CHANGE_COOLDOWN_SECONDS;
    const changes = await env.DB.prepare(
      'SELECT created_at FROM username_changes WHERE user_id = ? AND created_at >= ? ORDER BY created_at ASC',
    )
      .bind(currentUser.id, windowStart)
      .all<{ created_at: number }>();

    const total = changes.results ? changes.results.length : 1;
    if (total >= USERNAME_CHANGE_LIMIT) {
      changesLeft = 0;
      const oldestChange = changes.results[0].created_at;
      const unlockAt = oldestChange + USERNAME_CHANGE_COOLDOWN_SECONDS;
      unlockDays = Math.max(1, Math.ceil(Math.max(0, unlockAt - nowSeconds) / 86400));
    } else {
      changesLeft = USERNAME_CHANGE_LIMIT - total;
    }
  }

  return jsonResponse({
    success: true,
    username: targetUsername,
    changes_left: changesLeft,
    unlock_days: unlockDays,
  }, 200);
}




export async function handleUploadAvatar(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const burstAllowed = await consumeRateLimitAtomic(env, `avatar:burst:${currentUser.id}`, 15, 60);
  if (!burstAllowed) {
    return jsonError('Слишком часто. Менять аватар можно не чаще одного раза в 10 секунд', 429);
  }

  if (!checkContentLength(request, MAX_AVATAR_SIZE + 65536)) {
    return jsonError('Максимальный размер файла — 2 МБ', 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Неверный формат запроса', 400);
  }
  const file = form.get('avatar');
  if (!file || typeof file === 'string') {
    return jsonError('Файл аватара не передан', 400);
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_SIZE) {
    return jsonError('Максимальный размер файла — 2 МБ', 400);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_AVATAR_SIZE) {
    return jsonError('Максимальный размер файла — 2 МБ', 400);
  }
  const detected = validateImageBytes(bytes);

  if (!detected) {
    return jsonError('Разрешены только форматы JPEG, PNG, WEBP', 400);
  }

  const cdAllowed = await acquireCooldownAtomic(env, `avatar:${currentUser.id}`, 10);
  if (!cdAllowed) {
    return jsonError('Слишком часто. Менять аватар можно не чаще одного раза в 10 секунд', 429);
  }

  const oldAvatarKey = currentUser.avatar_key || '';
  const key = `avatars/${currentUser.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${detected.ext}`;

  await env.STORAGE.put(key, bytes, {
    httpMetadata: { contentType: detected.mime },
  });

  try {
    await env.DB.prepare('UPDATE users SET avatar_key = ? WHERE id = ?')
      .bind(key, currentUser.id)
      .run();
  } catch {
    try {
      await env.STORAGE.delete(key);
    } catch { }
    return jsonError('Ошибка обновления аватара', 500);
  }

  if (oldAvatarKey && oldAvatarKey !== key) {
    try {
      await env.STORAGE.delete(oldAvatarKey);
    } catch { }
  }

  return jsonResponse({
    success: true,
    avatar_key: key,
    avatar_url: `/media/${key}`,
  }, 200);
}

export async function handleSearchUsers(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const allowed = await consumeRateLimitAtomic(env, `search:user:${currentUser.id}`, 30, 60);
  if (!allowed) return jsonError('Слишком много запросов. Подождите несколько секунд', 429);

  const url = new URL(request.url);
  let q = (url.searchParams.get('q') || '').trim();
  q = q.replace(/^@+/, '').trim();
  if (!q || q.length < 1) {
    return jsonResponse({ users: [] }, 200);
  }
  q = q.slice(0, 50);

  const safeQ = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const prefix = safeQ + '%';
  const substr = '%' + safeQ + '%';

  try {
    const rows = await env.DB.prepare(
      `SELECT id, username, display_name, avatar_key, is_verified
       FROM users
       WHERE (username LIKE ?3 ESCAPE '\\' OR display_name LIKE ?3 ESCAPE '\\')
       ORDER BY CASE
         WHEN LOWER(username) = LOWER(?1) THEN 0
         WHEN LOWER(username) LIKE LOWER(?2) ESCAPE '\\' THEN 1
         WHEN LOWER(display_name) LIKE LOWER(?2) ESCAPE '\\' THEN 2
         ELSE 3
       END, is_verified DESC, id DESC
       LIMIT 20`
    )
      .bind(q, prefix, substr)
      .all<ExploreUser>();

    return jsonResponse({ users: rows.results || [] }, 200);
  } catch (err) {
    return jsonError('Ошибка выполнения поиска', 500);
  }
}

export async function handleResolveMentions(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const allowed = await consumeRateLimitAtomic(env, `mentions:resolve:${currentUser.id}`, 60, 60);
  if (!allowed) return jsonError('Слишком много запросов. Подождите несколько секунд', 429);

  const parsed = await readJsonWithLimit<{ usernames?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);

  const rawList = parsed.data?.usernames;
  if (!Array.isArray(rawList)) return jsonError('Неверный формат запроса', 400);

  const cleanSet = new Set<string>();
  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const uname = item.trim().toLowerCase();
    if (/^[a-z0-9_]{3,24}$/.test(uname)) {
      cleanSet.add(uname);
      if (cleanSet.size >= 25) break;
    }
  }

  const names = Array.from(cleanSet);
  if (names.length === 0) {
    return new Response(JSON.stringify({ existing: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  try {
    const placeholders = names.map((_, idx) => `?${idx + 1}`).join(', ');
    const rows = await env.DB.prepare(
      `SELECT LOWER(username) AS username FROM users WHERE LOWER(username) IN (${placeholders})`,
    )
      .bind(...names)
      .all<{ username: string }>();

    const existing = (rows.results || []).map((r) => String(r.username || '').toLowerCase()).filter(Boolean);
    return new Response(JSON.stringify({ existing }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return jsonError('Ошибка проверки упоминаний', 500);
  }
}

export async function getExploreData(env: Env, currentUserId?: number): Promise<ExploreData> {
  const viewerId = currentUserId || 0;
  const res = await getPersonalizedExplore(env, viewerId, 'all', 40);
  return { recommended_users: [], posts: res.posts };
}

export async function handleToggleFollow(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const rl = await consumeBurstWithLockoutAtomic(env, `follow:${currentUser.id}`, 10, 5, 10);
  if (!rl.allowed) {
    return jsonError('Слишком много запросов. Действие временно заблокировано на 10 секунд', 429);
  }

  const parsed = await readJsonWithLimit<{ following_id?: unknown; target_id?: unknown; username?: unknown }>(request, 4096);
  if (!parsed.ok) {
    return jsonError('Неверный формат запроса', parsed.status);
  }
  const body = parsed.data;

  let targetId: number | null = null;
  if (body?.following_id !== undefined) {
    targetId = parsePositiveId(body.following_id);
  } else if (body?.target_id !== undefined) {
    targetId = parsePositiveId(body.target_id);
  } else if (typeof body?.username === 'string' && body.username.trim()) {
    const u = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(body.username.toLowerCase().trim())
      .first<{ id: number }>();
    if (u) targetId = u.id;
  }

  if (!targetId) {
    return jsonError('ID пользователя не указан', 400);
  }

  if (targetId === currentUser.id) {
    return jsonError('Нельзя подписаться на самого себя', 400);
  }

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(targetId)
    .first<{ id: number }>();

  if (!targetUser) {
    return jsonError('Пользователь не найден', 404);
  }

  try {
    const existing = await env.DB.prepare(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?'
    )
      .bind(currentUser.id, targetId)
      .first();

    let isFollowing = false;
    if (existing) {
      const delRow = await env.DB.prepare(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ? RETURNING follower_id'
      )
        .bind(currentUser.id, targetId)
        .first<{ follower_id: number }>();
      isFollowing = false;
      if (delRow) {
        await Promise.all([
          adjustAffinity(env, currentUser.id, targetId, -8.0),
          removeNotification(env, { userId: targetId, actorId: currentUser.id, type: 'follow' }),
          invalidateRecommendationCaches({ userId: currentUser.id }),
        ]);
      }
    } else {
      const insRow = await env.DB.prepare(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?) ON CONFLICT (follower_id, following_id) DO NOTHING RETURNING follower_id'
      )
        .bind(currentUser.id, targetId)
        .first<{ follower_id: number }>();
      isFollowing = true;
      if (insRow) {
        await Promise.all([
          adjustAffinity(env, currentUser.id, targetId, 10.0),
          createNotification(env, { userId: targetId, actorId: currentUser.id, type: 'follow' }),
          invalidateRecommendationCaches({ userId: currentUser.id }),
        ]);
      }
    }

    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as c FROM follows WHERE following_id = ?'
    )
      .bind(targetId)
      .first<{ c: number }>();

    const followersCount = countRow ? Number(countRow.c) : 0;

    return jsonResponse({
      success: true,
      is_following: isFollowing,
      followers_count: followersCount
    }, 200);
  } catch (err) {
    return jsonError('Ошибка обновления подписки', 500);
  }
}


export async function getFollowersList(
  env: Env,
  targetUserId: number,
  currentUserId?: number
): Promise<FollowerUser[]> {
  try {
    const rows = await env.DB.prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_key, u.is_verified,
              EXISTS(
                SELECT 1 FROM follows f2
                WHERE f2.follower_id = ?1 AND f2.following_id = u.id
              ) as is_following
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ?2
       ORDER BY f.created_at DESC
       LIMIT 200`
    )
      .bind(currentUserId || 0, targetUserId)
      .all<{
        id: number;
        username: string;
        display_name: string;
        avatar_key: string;
        is_verified?: number;
        is_following?: number;
      }>();

    const results = rows.results || [];
    return results.map(r => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name || r.username,
      avatar_key: r.avatar_key || '',
      is_verified: Boolean(r.is_verified),
      is_following: Boolean(r.is_following),
      is_self: currentUserId ? r.id === currentUserId : false
    }));
  } catch {
    return [];
  }
}


export async function getFollowingList(
  env: Env,
  targetUserId: number,
  currentUserId?: number
): Promise<FollowerUser[]> {
  try {
    const rows = await env.DB.prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_key, u.is_verified,
              EXISTS(
                SELECT 1 FROM follows f2
                WHERE f2.follower_id = ?1 AND f2.following_id = u.id
              ) as is_following
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?2
       ORDER BY f.created_at DESC
       LIMIT 200`
    )
      .bind(currentUserId || 0, targetUserId)
      .all<{
        id: number;
        username: string;
        display_name: string;
        avatar_key: string;
        is_verified?: number;
        is_following?: number;
      }>();

    const results = rows.results || [];
    return results.map(r => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name || r.username,
      avatar_key: r.avatar_key || '',
      is_verified: Boolean(r.is_verified),
      is_following: Boolean(r.is_following),
      is_self: currentUserId ? r.id === currentUserId : false
    }));
  } catch {
    return [];
  }
}
