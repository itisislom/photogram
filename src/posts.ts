import { Env, Post, FeedPost, Comment } from './types';
import { getUserFromRequest } from './auth';
import { savePostTags, adjustAffinity, adjustTagAffinity, adjustPostEngagementBatch, invalidateRecommendationCaches } from './recommendations';
import { createNotification, removeNotification } from './notifications';
import {
  acquireCooldownAtomic,
  checkContentLength,
  consumeBurstWithLockoutAtomic,
  consumeRateLimitAtomic,
  hasAdminPermission,
  parsePositiveId,
  readJsonWithLimit,
  validateImageBytes,
} from './security';

const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_THUMB_IMAGE_SIZE = 300 * 1024;
const MAX_FULL_IMAGE_SIZE = 2.5 * 1024 * 1024;
const MAX_CAPTION_LEN = 1000;
const PUBLIC_MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function derivePostVariantKeys(imageKey: string): { thumbKey: string | null; fullKey: string | null } {
  if (
    !imageKey ||
    !imageKey.startsWith('posts/') ||
    !imageKey.endsWith('.webp') ||
    imageKey.endsWith('_thumb.webp') ||
    imageKey.endsWith('_full.webp')
  ) {
    return { thumbKey: null, fullKey: null };
  }
  const base = imageKey.slice(0, -5);
  return {
    thumbKey: `${base}_thumb.webp`,
    fullKey: `${base}_full.webp`,
  };
}

async function purgePublicMediaEdgeCache(keys: string[]): Promise<void> {
  try {
    const edge = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
    if (!edge) return;
    for (const k of keys) {
      if (!k) continue;
      for (const dl of ['0', '1']) {
        try {
          await edge.delete(`https://media-cache.photogram.internal/${encodeURIComponent(k)}?dl=${dl}`);
        } catch {}
      }
    }
  } catch {}
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

export async function handleCreatePost(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const burstAllowed = await consumeRateLimitAtomic(env, `post:burst:${currentUser.id}`, 20, 60);
  if (!burstAllowed) {
    return jsonError('Слишком часто. Публиковать можно не чаще одного раза в 10 секунд', 429);
  }

  if (!checkContentLength(request, MAX_POST_IMAGE_SIZE + 65536)) {
    return jsonError('Максимальный размер фото — 5 МБ', 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Неверный формат запроса', 400);
  }
  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return jsonError('Файл изображения не передан', 400);
  }

  if (file.size <= 0 || file.size > MAX_POST_IMAGE_SIZE) {
    return jsonError('Максимальный размер фото — 5 МБ', 400);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_POST_IMAGE_SIZE) {
    return jsonError('Максимальный размер фото — 5 МБ', 400);
  }
  const detected = validateImageBytes(bytes);

  if (!detected) {
    return jsonError('Разрешены только форматы JPEG, PNG, WEBP', 400);
  }

  let thumbBytes: Uint8Array | null = null;
  let fullBytes: Uint8Array | null = null;
  const thumbField = form.get('image_thumb');
  const fullField = form.get('image_full');

  if (thumbField && typeof thumbField !== 'string') {
    if (thumbField.size <= 0 || thumbField.size > MAX_THUMB_IMAGE_SIZE) {
      return jsonError('Неверный размер миниатюры изображения', 400);
    }
    const tb = new Uint8Array(await thumbField.arrayBuffer());
    const detThumb = validateImageBytes(tb, 512);
    if (!detThumb || detThumb.ext !== 'webp') {
      return jsonError('Неверный формат миниатюры изображения', 400);
    }
    thumbBytes = tb;
  }

  if (fullField && typeof fullField !== 'string') {
    if (fullField.size <= 0 || fullField.size > MAX_FULL_IMAGE_SIZE) {
      return jsonError('Неверный размер полной версии изображения', 400);
    }
    const fb = new Uint8Array(await fullField.arrayBuffer());
    const detFull = validateImageBytes(fb, 2048);
    if (!detFull || detFull.ext !== 'webp') {
      return jsonError('Неверный формат полной версии изображения', 400);
    }
    fullBytes = fb;
  }

  const cdAllowed = await acquireCooldownAtomic(env, `post:cd:${currentUser.id}`, 10);
  if (!cdAllowed) {
    return jsonError('Слишком часто. Публиковать можно не чаще одного раза в 10 секунд', 429);
  }

  const captionRaw = typeof form.get('caption') === 'string' ? (form.get('caption') as string) : '';
  const caption = captionRaw.trim().slice(0, MAX_CAPTION_LEN);

  const STOP_WORDS_18_PLUS = /(18\+|nsfw|nude|onlyfans|нюдс|интим|порно|секс|эротика|сиськи|писька|член|вагина|дикпик)/i;
  const isSensitive = STOP_WORDS_18_PLUS.test(caption) ? 1 : 0;
  const skinScore = 0;

  const keyExt = detected.ext;
  const baseKey = `posts/${currentUser.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const imageKey = `${baseKey}.${keyExt}`;
  const thumbKey = keyExt === 'webp' && thumbBytes ? `${baseKey}_thumb.webp` : null;
  const fullKey = keyExt === 'webp' && fullBytes ? `${baseKey}_full.webp` : null;

  const uploadedKeys: string[] = [imageKey];
  const putTasks: Promise<unknown>[] = [
    env.STORAGE.put(imageKey, bytes, {
      httpMetadata: { contentType: detected.mime, cacheControl: PUBLIC_MEDIA_CACHE_CONTROL },
    }),
  ];
  if (thumbKey && thumbBytes) {
    uploadedKeys.push(thumbKey);
    putTasks.push(
      env.STORAGE.put(thumbKey, thumbBytes, {
        httpMetadata: { contentType: 'image/webp', cacheControl: PUBLIC_MEDIA_CACHE_CONTROL },
      }),
    );
  }
  if (fullKey && fullBytes) {
    uploadedKeys.push(fullKey);
    putTasks.push(
      env.STORAGE.put(fullKey, fullBytes, {
        httpMetadata: { contentType: 'image/webp', cacheControl: PUBLIC_MEDIA_CACHE_CONTROL },
      }),
    );
  }
  await Promise.all(putTasks);

  try {
    const result = await env.DB.prepare(
      'INSERT INTO posts (user_id, image_key, caption, skin_score, is_sensitive, reports_count) VALUES (?, ?, ?, ?, ?, 0)',
    )
      .bind(currentUser.id, imageKey, caption, skinScore, isSensitive)
      .run();

    const newPostId = result.meta?.last_row_id;
    if (newPostId && typeof newPostId === 'number' && caption) {
      await savePostTags(env, newPostId, caption);
    }
    await invalidateRecommendationCaches({ postChanged: true });

    return jsonResponse(
      {
        success: true,
        post_id: newPostId,
        image_key: imageKey,
        variants: {
          thumb: Boolean(thumbKey),
          full: Boolean(fullKey),
        },
      },
      201,
    );
  } catch (err) {
    try {
      await Promise.all(uploadedKeys.map((k) => env.STORAGE.delete(k).catch(() => {})));
    } catch { }
    return jsonError('Ошибка сохранения публикации в базе данных', 500);
  }
}

export async function handleDeletePost(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const allowed = await consumeRateLimitAtomic(env, `post:del:${currentUser.id}`, 20, 60);
  if (!allowed) return jsonError('Слишком много запросов. Подождите несколько секунд', 429);

  let postId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const parsed = await readJsonWithLimit<{ post_id?: unknown }>(request, 4096);
    if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);
    postId = parsePositiveId(parsed.data?.post_id);
  } else {
    try {
      if (!checkContentLength(request, 8192)) return jsonError('Неверный формат запроса', 413);
      const form = await request.formData();
      postId = parsePositiveId(form.get('post_id'));
    } catch { }
  }

  if (!postId) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id, image_key FROM posts WHERE id = ?')
    .bind(postId)
    .first<Post>();

  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  if (post.user_id !== currentUser.id && !hasAdminPermission(currentUser, env, 'posts.delete')) {
    return jsonError('Нет прав на удаление этой публикации', 403);
  }

  await env.DB.prepare('DELETE FROM likes WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)').bind(postId).run();
  await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM post_reports WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM user_interactions WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

  const { thumbKey, fullKey } = derivePostVariantKeys(post.image_key);
  const keysToDelete = [post.image_key, thumbKey, fullKey].filter((k): k is string => Boolean(k));
  try {
    await Promise.all(keysToDelete.map((k) => env.STORAGE.delete(k).catch(() => {})));
  } catch { }
  await purgePublicMediaEdgeCache(keysToDelete);

  await invalidateRecommendationCaches({ postChanged: true });

  return jsonResponse({ success: true, deleted_id: postId }, 200);
}

export async function handleToggleLike(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const rl = await consumeBurstWithLockoutAtomic(env, `like:${currentUser.id}`, 15, 5, 10);
  if (!rl.allowed) {
    return jsonError('Слишком много запросов. Действие временно заблокировано на 10 секунд', 429);
  }

  let postId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const parsed = await readJsonWithLimit<{ post_id?: unknown }>(request, 4096);
    if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);
    postId = parsePositiveId(parsed.data?.post_id);
  } else {
    try {
      if (!checkContentLength(request, 8192)) return jsonError('Неверный формат запроса', 413);
      const form = await request.formData();
      postId = parsePositiveId(form.get('post_id'));
    } catch { }
  }

  if (!postId) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?')
    .bind(postId)
    .first<{ id: number; user_id: number }>();
  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  const existing = await env.DB.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?')
    .bind(postId, currentUser.id)
    .first();

  let liked = false;
  if (existing) {
    const delRow = await env.DB.prepare(
      'DELETE FROM likes WHERE post_id = ? AND user_id = ? RETURNING post_id',
    )
      .bind(postId, currentUser.id)
      .first<{ post_id: number }>();
    liked = false;
    if (delRow) {
      await Promise.all([
        adjustPostEngagementBatch(env, currentUser.id, postId, post.user_id, -3.5, -2.0),
        removeNotification(env, { userId: post.user_id, actorId: currentUser.id, type: 'like', postId }),
      ]);
    }
  } else {
    const insRow = await env.DB.prepare(
      'INSERT INTO likes (post_id, user_id) VALUES (?, ?) ON CONFLICT (post_id, user_id) DO NOTHING RETURNING post_id',
    )
      .bind(postId, currentUser.id)
      .first<{ post_id: number }>();
    liked = true;
    if (insRow) {
      await Promise.all([
        adjustPostEngagementBatch(env, currentUser.id, postId, post.user_id, 3.5, 2.0),
        createNotification(env, { userId: post.user_id, actorId: currentUser.id, type: 'like', postId }),
      ]);
    }
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();
  const likesCount = countRow ? Number(countRow.count) : 0;

  return jsonResponse({
    success: true,
    liked,
    likes_count: likesCount,
    post_id: postId,
  }, 200);
}

export async function getFeedPosts(env: Env, viewerId: number): Promise<FeedPost[]> {
  try {
    const rows = await env.DB.prepare(
      `SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
              u.username, u.display_name, u.avatar_key, u.is_verified,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked,
              EXISTS(SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = p.user_id) AS is_followed_author
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ORDER BY
         CASE
           WHEN p.user_id = ?1 THEN 0
           WHEN EXISTS(SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = p.user_id) THEN 0
           ELSE 1
         END,
         p.created_at DESC
       LIMIT 40`
    )
      .bind(viewerId)
      .all<FeedPost & { likes_count: number; comments_count: number; is_liked: number | boolean; is_followed_author: number | boolean }>();

    if (rows.results) {
      return rows.results.map(p => ({
        ...p,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        is_liked: Boolean(p.is_liked),
        is_followed_author: Boolean(p.is_followed_author)
      }));
    }
  } catch (err) { }
  return [];
}

export async function handleGetComments(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  const url = new URL(request.url);
  const postId = parsePositiveId(url.searchParams.get('post_id'));

  if (!postId) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?')
    .bind(postId)
    .first<{ id: number; user_id: number }>();

  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  const viewerId = currentUser ? Number(currentUser.id) : 0;
  const rows = await env.DB.prepare(
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, c.content, c.created_at,
            u.username, u.display_name, u.avatar_key, u.is_verified,
            (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) AS likes_count,
            EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) AS is_liked
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC, c.id ASC
     LIMIT 200`
  )
    .bind(viewerId, postId)
    .all<{
      id: number;
      post_id: number;
      user_id: number;
      parent_id?: number | null;
      content: string;
      created_at: string;
      username: string;
      display_name: string;
      avatar_key: string;
      is_verified?: number | boolean;
      likes_count?: number;
      is_liked?: number | boolean;
    }>();

  const totalRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();

  const comments: Comment[] = (rows.results || []).map(c => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    parent_id: c.parent_id ? Number(c.parent_id) : null,
    content: c.content,
    created_at: c.created_at,
    username: c.username,
    display_name: c.display_name,
    avatar_key: c.avatar_key,
    is_verified: c.is_verified,
    can_delete: Boolean(currentUser && (currentUser.id === c.user_id || currentUser.id === post.user_id)),
    likes_count: Number(c.likes_count || 0),
    is_liked: Boolean(c.is_liked),
  }));

  return jsonResponse({
    success: true,
    post_id: postId,
    comments,
    comments_count: totalRow ? Number(totalRow.count) : comments.length
  }, 200);
}

export async function handleCreateComment(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const burstAllowed = await consumeRateLimitAtomic(env, `comment:burst:${currentUser.id}`, 30, 60);
  if (!burstAllowed) {
    return jsonError('Слишком часто, подождите пару секунд', 429);
  }

  let postId: number | null = null;
  let content = '';
  let rawParentId: unknown = undefined;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const parsed = await readJsonWithLimit<{ post_id?: unknown; content?: unknown; parent_id?: unknown }>(request, 8192);
    if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);
    postId = parsePositiveId(parsed.data?.post_id);
    if (typeof parsed.data?.content === 'string') content = parsed.data.content;
    rawParentId = parsed.data?.parent_id;
  } else {
    try {
      if (!checkContentLength(request, 16384)) return jsonError('Неверный формат запроса', 413);
      const form = await request.formData();
      postId = parsePositiveId(form.get('post_id'));
      const rawContent = form.get('content');
      if (typeof rawContent === 'string') content = rawContent;
      rawParentId = form.get('parent_id');
    } catch { }
  }

  if (!postId) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  content = content.trim();
  if (!content) {
    return jsonError('Комментарий не может быть пустым', 400);
  }
  if (content.length > 500) {
    return jsonError('Максимальная длина комментария — 500 символов', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?')
    .bind(postId)
    .first<{ id: number; user_id: number }>();

  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  let resolvedParentId: number | null = null;
  let parentAuthorId = 0;
  if (rawParentId !== undefined && rawParentId !== null && rawParentId !== '') {
    const parsedParentId = parsePositiveId(rawParentId);
    if (!parsedParentId) {
      return jsonError('Неверный идентификатор родительского комментария', 400);
    }
    const parentRow = await env.DB.prepare(
      'SELECT id, post_id, user_id, parent_id FROM comments WHERE id = ?',
    )
      .bind(parsedParentId)
      .first<{ id: number; post_id: number; user_id: number; parent_id?: number | null }>();
    if (!parentRow || Number(parentRow.post_id) !== postId) {
      return jsonError('Комментарий не найден', 404);
    }
    resolvedParentId = parentRow.parent_id ? Number(parentRow.parent_id) : Number(parentRow.id);
    parentAuthorId = Number(parentRow.user_id);
  }

  const cdAllowed = await acquireCooldownAtomic(env, `comment:cd:${currentUser.id}`, 3);
  if (!cdAllowed) {
    return jsonError('Слишком часто, подождите пару секунд', 429);
  }

  const insertResult = await env.DB.prepare(
    'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)'
  )
    .bind(postId, currentUser.id, content, resolvedParentId)
    .run();

  const commentId = Number(insertResult.meta.last_row_id) || 0;

  const notifyPromises: Promise<unknown>[] = [
    adjustPostEngagementBatch(env, currentUser.id, postId, post.user_id, 5.0, 2.5),
  ];
  if (parentAuthorId > 0) {
    notifyPromises.push(
      createNotification(env, {
        userId: parentAuthorId,
        actorId: currentUser.id,
        type: 'comment_reply',
        postId,
        commentId: commentId || null,
        commentPreview: content,
      }),
    );
    if (Number(post.user_id) !== parentAuthorId) {
      notifyPromises.push(
        createNotification(env, {
          userId: post.user_id,
          actorId: currentUser.id,
          type: 'comment',
          postId,
          commentId: commentId || null,
          commentPreview: content,
        }),
      );
    }
  } else {
    notifyPromises.push(
      createNotification(env, {
        userId: post.user_id,
        actorId: currentUser.id,
        type: 'comment',
        postId,
        commentId: commentId || null,
        commentPreview: content,
      }),
    );
  }
  await Promise.all(notifyPromises);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();
  const commentsCount = countRow ? Number(countRow.count) : 1;

  const newComment: Comment = {
    id: commentId,
    post_id: postId,
    user_id: currentUser.id,
    parent_id: resolvedParentId,
    content,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    username: currentUser.username,
    display_name: currentUser.display_name,
    avatar_key: currentUser.avatar_key,
    is_verified: currentUser.is_verified,
    can_delete: true,
    likes_count: 0,
    is_liked: false,
  };

  return jsonResponse({
    success: true,
    comment: newComment,
    comments_count: commentsCount
  }, 201);
}

export async function handleDeleteComment(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const allowed = await consumeRateLimitAtomic(env, `comment:del:${currentUser.id}`, 30, 60);
  if (!allowed) return jsonError('Слишком много запросов. Подождите несколько секунд', 429);

  let commentId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const parsed = await readJsonWithLimit<{ comment_id?: unknown }>(request, 4096);
    if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);
    commentId = parsePositiveId(parsed.data?.comment_id);
  } else {
    try {
      if (!checkContentLength(request, 8192)) return jsonError('Неверный формат запроса', 413);
      const form = await request.formData();
      commentId = parsePositiveId(form.get('comment_id'));
    } catch { }
  }

  if (!commentId) {
    return jsonError('Идентификатор комментария не указан', 400);
  }

  const comment = await env.DB.prepare(
    `SELECT c.id, c.post_id, c.user_id, c.parent_id, p.user_id AS post_author_id
     FROM comments c
     JOIN posts p ON c.post_id = p.id
     WHERE c.id = ?`
  )
    .bind(commentId)
    .first<{ id: number; post_id: number; user_id: number; parent_id?: number | null; post_author_id: number }>();

  if (!comment) {
    return jsonError('Комментарий не найден', 404);
  }

  const canDelete = currentUser.id === comment.user_id || currentUser.id === comment.post_author_id;
  if (!canDelete) {
    return jsonError('Нет прав на удаление этого комментария', 403);
  }

  await env.DB.prepare('DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE parent_id = ?)').bind(commentId).run();
  await env.DB.prepare('DELETE FROM comment_likes WHERE comment_id = ?').bind(commentId).run();
  await env.DB.prepare('DELETE FROM comments WHERE parent_id = ?').bind(commentId).run();
  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  await removeNotification(env, { userId: comment.post_author_id, actorId: comment.user_id, type: 'comment', commentId });

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(comment.post_id)
    .first<{ count: number }>();
  const commentsCount = countRow ? countRow.count : 0;

  return jsonResponse({
    success: true,
    deleted_id: commentId,
    parent_id: comment.parent_id ? Number(comment.parent_id) : null,
    post_id: comment.post_id,
    comments_count: commentsCount
  }, 200);
}

export async function handleToggleCommentLike(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const rl = await consumeBurstWithLockoutAtomic(env, `comment_like:${currentUser.id}`, 20, 5, 10);
  if (!rl.allowed) {
    return jsonError('Слишком много запросов. Действие временно заблокировано на 10 секунд', 429);
  }

  let commentId: number | null = null;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const parsed = await readJsonWithLimit<{ comment_id?: unknown }>(request, 4096);
    if (!parsed.ok) return jsonError('Неверный формат запроса', parsed.status);
    commentId = parsePositiveId(parsed.data?.comment_id);
  } else {
    try {
      if (!checkContentLength(request, 8192)) return jsonError('Неверный формат запроса', 413);
      const form = await request.formData();
      commentId = parsePositiveId(form.get('comment_id'));
    } catch { }
  }

  if (!commentId) {
    return jsonError('Идентификатор комментария не указан', 400);
  }

  const comment = await env.DB.prepare('SELECT id, post_id, user_id, content FROM comments WHERE id = ?')
    .bind(commentId)
    .first<{ id: number; post_id: number; user_id: number; content: string }>();
  if (!comment) {
    return jsonError('Комментарий не найден', 404);
  }

  const existing = await env.DB.prepare('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?')
    .bind(commentId, currentUser.id)
    .first();

  let liked = false;
  if (existing) {
    const delRow = await env.DB.prepare(
      'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ? RETURNING comment_id',
    )
      .bind(commentId, currentUser.id)
      .first<{ comment_id: number }>();
    liked = false;
    if (delRow) {
      await removeNotification(env, {
        userId: comment.user_id,
        actorId: currentUser.id,
        type: 'comment_like',
        postId: comment.post_id,
        commentId,
      });
    }
  } else {
    const insRow = await env.DB.prepare(
      'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?) ON CONFLICT (comment_id, user_id) DO NOTHING RETURNING comment_id',
    )
      .bind(commentId, currentUser.id)
      .first<{ comment_id: number }>();
    liked = true;
    if (insRow) {
      await createNotification(env, {
        userId: comment.user_id,
        actorId: currentUser.id,
        type: 'comment_like',
        postId: comment.post_id,
        commentId,
        commentPreview: comment.content,
      });
    }
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM comment_likes WHERE comment_id = ?')
    .bind(commentId)
    .first<{ count: number }>();
  const likesCount = countRow ? Number(countRow.count) : 0;

  return jsonResponse({
    success: true,
    liked,
    likes_count: likesCount,
    comment_id: commentId,
  }, 200);
}
