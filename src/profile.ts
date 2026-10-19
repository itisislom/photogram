import { Env, ProfileData, User, Post, ExploreData, ExploreUser, ExplorePost } from './types';
import { getUserFromRequest } from './auth';
import { adjustAffinity, getPersonalizedExplore } from './recommendations';

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

function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0D &&
    bytes[5] === 0x0A &&
    bytes[6] === 0x1A &&
    bytes[7] === 0x0A
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export async function getProfileData(
  env: Env,
  username: string,
  currentUserId?: number,
): Promise<ProfileData | null> {
  const user = await env.DB.prepare(
    'SELECT id, username, email, display_name, bio, avatar_key, is_verified, created_at FROM users WHERE username = ?',
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
  try {
    const viewerId = currentUserId || 0;
    const postRows = await env.DB.prepare(
      `SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS is_liked
       FROM posts p
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`
    )
      .bind(viewerId, user.id)
      .all<Post & { likes_count: number; comments_count: number; is_liked: number | boolean }>();
    if (postRows.results) {
      userPosts = postRows.results.map(p => ({
        ...p,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        is_liked: Boolean(p.is_liked)
      }));
      postsCount = userPosts.length;
    }
  } catch { }

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

  const form = await request.formData();
  const usernameRaw = form.get('username');
  const targetUsername = typeof usernameRaw === 'string'
    ? usernameRaw.trim().toLowerCase()
    : currentUser.username;
  const displayName = ((form.get('display_name') as string) ?? '').trim();
  const bio = ((form.get('bio') as string) ?? '').trim();

  if (!USERNAME_RE.test(targetUsername)) {
    return jsonError(
      'Имя пользователя должно содержать от 3 до 24 символов (буквы a-z, цифры, подчёркивание)',
      400,
    );
  }

  let usernameChanged = false;
  if (targetUsername !== currentUser.username) {
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

  if (displayName.length > MAX_DISPLAY_NAME_LEN) {
    return jsonError(`Имя не должно превышать ${MAX_DISPLAY_NAME_LEN} символов`, 400);
  }
  if (bio.length > MAX_BIO_LEN) {
    return jsonError(`Описание не должно превышать ${MAX_BIO_LEN} символов`, 400);
  }

  await env.DB.prepare('UPDATE users SET username = ?, display_name = ?, bio = ? WHERE id = ?')
    .bind(targetUsername, displayName || targetUsername, bio, currentUser.id)
    .run();

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

  const now = Math.floor(Date.now() / 1000);
  const avatarRateKey = `avatar:${currentUser.id}`;
  const rateRow = await env.DB.prepare(
    'SELECT locked_until FROM auth_rate_limits WHERE key = ?',
  )
    .bind(avatarRateKey)
    .first<{ locked_until: number }>();

  if (rateRow && rateRow.locked_until > now) {
    return jsonError('Слишком часто. Менять аватар можно не чаще одного раза в 10 секунд', 429);
  }

  const form = await request.formData();
  const file = form.get('avatar');
  if (!file || typeof file === 'string') {
    return jsonError('Файл аватара не передан', 400);
  }


  if (file.size > MAX_AVATAR_SIZE) {
    return jsonError('Максимальный размер файла — 2 МБ', 400);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const detected = detectImageType(bytes);

  if (!detected) {
    return jsonError('Разрешены только форматы JPEG, PNG, WEBP', 400);
  }

  const key = `avatars/${currentUser.id}_${Date.now()}.${detected.ext}`;

  if (currentUser.avatar_key) {
    try {
      await env.STORAGE.delete(currentUser.avatar_key);
    } catch { }
  }

  await env.STORAGE.put(key, buf, {
    httpMetadata: { contentType: detected.mime },
  });

  await env.DB.prepare('UPDATE users SET avatar_key = ? WHERE id = ?')
    .bind(key, currentUser.id)
    .run();

  await env.DB.prepare(
    'INSERT INTO auth_rate_limits (key, attempts, locked_until, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(key) DO UPDATE SET locked_until = ?, updated_at = ?',
  )
    .bind(avatarRateKey, now + 10, now, now + 10, now)
    .run();

  return jsonResponse({
    success: true,
    avatar_key: key,
    avatar_url: `/media/${key}`,
  }, 200);
}

export async function handleSearchUsers(request: Request, env: Env): Promise<Response> {
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

export async function getExploreData(env: Env, currentUserId?: number): Promise<ExploreData> {
  const viewerId = currentUserId || 0;
  const res = await getPersonalizedExplore(env, viewerId, 'all', 40);
  return { recommended_users: [], posts: res.posts };
}

export async function handleToggleFollow(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  let targetId: number | null = null;
  try {
    const body = await request.json() as { following_id?: number; target_id?: number; username?: string };
    if (typeof body.following_id === 'number') {
      targetId = body.following_id;
    } else if (typeof body.target_id === 'number') {
      targetId = body.target_id;
    } else if (body.username) {
      const u = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
        .bind(body.username.toLowerCase().trim())
        .first<{ id: number }>();
      if (u) targetId = u.id;
    }
  } catch {
    return jsonError('Неверный формат запроса', 400);
  }

  if (!targetId || isNaN(targetId)) {
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
      await env.DB.prepare(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?'
      )
        .bind(currentUser.id, targetId)
        .run();
      isFollowing = false;
      await adjustAffinity(env, currentUser.id, targetId, -8.0);
    } else {
      await env.DB.prepare(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)'
      )
        .bind(currentUser.id, targetId)
        .run();
      isFollowing = true;
      await adjustAffinity(env, currentUser.id, targetId, 10.0);
    }

    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) as c FROM follows WHERE following_id = ?'
    )
      .bind(targetId)
      .first<{ c: number }>();

    const followersCount = countRow ? countRow.c : 0;

    return jsonResponse({
      success: true,
      is_following: isFollowing,
      followers_count: followersCount
    }, 200);
  } catch (err) {
    return jsonError('Ошибка обновления подписки', 500);
  }
}
