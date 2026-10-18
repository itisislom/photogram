import { Env, Post, FeedPost, Comment } from './types';
import { getUserFromRequest } from './auth';
import { savePostTags, adjustAffinity, adjustTagAffinity } from './recommendations';

const MAX_POST_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_CAPTION_LEN = 1000;

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

export async function handleCreatePost(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  const recentPost = await env.DB.prepare(
    `SELECT 1 FROM posts WHERE user_id = ? AND ((julianday('now') - julianday(created_at)) * 86400.0) < 10.0 LIMIT 1`
  )
    .bind(currentUser.id)
    .first();

  if (recentPost) {
    return jsonError('Слишком часто. Публиковать можно не чаще одного раза в 10 секунд', 429);
  }

  const form = await request.formData();
  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return jsonError('Файл изображения не передан', 400);
  }

  if (file.size > MAX_POST_IMAGE_SIZE) {
    return jsonError('Максимальный размер фото — 5 МБ', 400);
  }

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const detected = detectImageType(bytes);

  if (!detected) {
    return jsonError('Разрешены только форматы JPEG, PNG, WEBP', 400);
  }

  const captionRaw = (form.get('caption') as string) ?? '';
  const caption = captionRaw.trim().slice(0, MAX_CAPTION_LEN);

  const STOP_WORDS_18_PLUS = /(18\+|nsfw|nude|onlyfans|нюдс|интим|порно|секс|эротика|сиськи|писька|член|вагина|дикпик)/i;
  const isSensitive = STOP_WORDS_18_PLUS.test(caption) ? 1 : 0;
  const skinScore = 0;

  const keyExt = detected.ext;
  const imageKey = `posts/${currentUser.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${keyExt}`;

  await env.STORAGE.put(imageKey, bytes, {
    httpMetadata: { contentType: detected.mime },
  });

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

    return jsonResponse(
      {
        success: true,
        post_id: newPostId,
        image_key: imageKey,
      },
      201,
    );
  } catch (err) {
    try {
      await env.STORAGE.delete(imageKey);
    } catch { }
    return jsonError('Ошибка сохранения публикации в базе данных', 500);
  }
}

export async function handleDeletePost(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  let postId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as { post_id?: number };
      if (data && typeof data.post_id === 'number') postId = data.post_id;
    } catch { }
  } else {
    try {
      const form = await request.formData();
      const raw = form.get('post_id');
      if (raw) postId = parseInt(raw as string, 10);
    } catch { }
  }

  if (!postId || isNaN(postId)) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id, image_key FROM posts WHERE id = ?')
    .bind(postId)
    .first<Post>();

  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  if (post.user_id !== currentUser.id) {
    return jsonError('Нет прав на удаление этой публикации', 403);
  }

  await env.DB.prepare('DELETE FROM likes WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM post_tags WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM user_interactions WHERE post_id = ?').bind(postId).run();
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run();

  try {
    await env.STORAGE.delete(post.image_key);
  } catch { }

  return jsonResponse({ success: true, deleted_id: postId }, 200);
}

export async function handleToggleLike(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  let postId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as { post_id?: number };
      if (data && typeof data.post_id === 'number') postId = data.post_id;
    } catch { }
  } else {
    try {
      const form = await request.formData();
      const raw = form.get('post_id');
      if (raw) postId = parseInt(raw as string, 10);
    } catch { }
  }

  if (!postId || isNaN(postId)) {
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
    await env.DB.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?')
      .bind(postId, currentUser.id)
      .run();
    liked = false;
    await adjustAffinity(env, currentUser.id, post.user_id, -4.0);
    await adjustTagAffinity(env, currentUser.id, postId, -1.0);
  } else {
    await env.DB.prepare('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)')
      .bind(postId, currentUser.id)
      .run();
    liked = true;
    await adjustAffinity(env, currentUser.id, post.user_id, 4.0);
    await adjustTagAffinity(env, currentUser.id, postId, 1.0);
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();
  const likesCount = countRow ? countRow.count : 0;

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
              u.username, u.display_name, u.avatar_key,
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
  const postIdRaw = url.searchParams.get('post_id');
  const postId = postIdRaw ? parseInt(postIdRaw, 10) : null;

  if (!postId || isNaN(postId)) {
    return jsonError('Идентификатор публикации не указан', 400);
  }

  const post = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id = ?')
    .bind(postId)
    .first<{ id: number; user_id: number }>();

  if (!post) {
    return jsonError('Публикация не найдена', 404);
  }

  const rows = await env.DB.prepare(
    `SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
            u.username, u.display_name, u.avatar_key
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC, c.id ASC`
  )
    .bind(postId)
    .all<{
      id: number;
      post_id: number;
      user_id: number;
      content: string;
      created_at: string;
      username: string;
      display_name: string;
      avatar_key: string;
    }>();

  const comments: Comment[] = (rows.results || []).map(c => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    username: c.username,
    display_name: c.display_name,
    avatar_key: c.avatar_key,
    can_delete: Boolean(currentUser && (currentUser.id === c.user_id || currentUser.id === post.user_id))
  }));

  return jsonResponse({
    success: true,
    post_id: postId,
    comments,
    comments_count: comments.length
  }, 200);
}

export async function handleCreateComment(request: Request, env: Env): Promise<Response> {
  const currentUser = await getUserFromRequest(env, request);
  if (!currentUser) return jsonError('Необходима авторизация', 401);

  let postId: number | null = null;
  let content = '';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as { post_id?: number; content?: string };
      if (data && typeof data.post_id === 'number') postId = data.post_id;
      if (data && typeof data.content === 'string') content = data.content;
    } catch { }
  } else {
    try {
      const form = await request.formData();
      const raw = form.get('post_id');
      if (raw) postId = parseInt(raw as string, 10);
      const rawContent = form.get('content');
      if (typeof rawContent === 'string') content = rawContent;
    } catch { }
  }

  if (!postId || isNaN(postId)) {
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

  const recentComment = await env.DB.prepare(
    `SELECT 1 FROM comments
     WHERE user_id = ? AND ((julianday('now') - julianday(created_at)) * 86400.0) < 3.0
     ORDER BY id DESC LIMIT 1`
  )
    .bind(currentUser.id)
    .first();

  if (recentComment) {
    return jsonError('Слишком часто, подождите пару секунд', 429);
  }

  const insertResult = await env.DB.prepare(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)'
  )
    .bind(postId, currentUser.id, content)
    .run();

  const commentId = insertResult.meta.last_row_id;

  await adjustAffinity(env, currentUser.id, post.user_id, 7.0);
  await adjustTagAffinity(env, currentUser.id, postId, 2.0);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(postId)
    .first<{ count: number }>();
  const commentsCount = countRow ? countRow.count : 1;

  const newComment: Comment = {
    id: commentId,
    post_id: postId,
    user_id: currentUser.id,
    content,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    username: currentUser.username,
    display_name: currentUser.display_name,
    avatar_key: currentUser.avatar_key,
    can_delete: true
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

  let commentId: number | null = null;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as { comment_id?: number };
      if (data && typeof data.comment_id === 'number') commentId = data.comment_id;
    } catch { }
  } else {
    try {
      const form = await request.formData();
      const raw = form.get('comment_id');
      if (raw) commentId = parseInt(raw as string, 10);
    } catch { }
  }

  if (!commentId || isNaN(commentId)) {
    return jsonError('Идентификатор комментария не указан', 400);
  }

  const comment = await env.DB.prepare(
    `SELECT c.id, c.post_id, c.user_id, p.user_id AS post_author_id
     FROM comments c
     JOIN posts p ON c.post_id = p.id
     WHERE c.id = ?`
  )
    .bind(commentId)
    .first<{ id: number; post_id: number; user_id: number; post_author_id: number }>();

  if (!comment) {
    return jsonError('Комментарий не найден', 404);
  }

  const canDelete = currentUser.id === comment.user_id || currentUser.id === comment.post_author_id;
  if (!canDelete) {
    return jsonError('Нет прав на удаление этого комментария', 403);
  }

  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?')
    .bind(comment.post_id)
    .first<{ count: number }>();
  const commentsCount = countRow ? countRow.count : 0;

  return jsonResponse({
    success: true,
    deleted_id: commentId,
    post_id: comment.post_id,
    comments_count: commentsCount
  }, 200);
}
