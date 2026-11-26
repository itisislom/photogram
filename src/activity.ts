import { Env, User } from './types';
import { getUserFromRequest } from './auth';
import { consumeRateLimitAtomic, parsePositiveId, readJsonWithLimit } from './security';

export type ActivitySection = 'likes' | 'comment_likes' | 'comments' | 'follows' | 'posts' | 'history';
export type ActivitySort = 'newest' | 'oldest';
export type ActivityCommentFilter = 'all' | 'comments' | 'replies';

export interface ActivitySummary {
  liked_posts_count: number;
  liked_comments_count: number;
  comments_count: number;
  replies_count: number;
  follows_count: number;
  posts_count: number;
  history_count: number;
}

export interface ActivityLikedPostItem {
  post_id: number;
  image_key: string;
  caption: string;
  author_username: string;
  author_display_name: string;
  author_is_verified: number;
  liked_at: string;
}

export interface ActivityLikedCommentItem {
  comment_id: number;
  post_id: number;
  content: string;
  comment_author_username: string;
  comment_author_avatar_key: string;
  comment_author_is_verified: number;
  post_image_key: string;
  post_author_username: string;
  liked_at: string;
}

export interface ActivityCommentItem {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  post_image_key: string;
  post_author_username: string;
  parent_author_username: string | null;
  parent_content: string | null;
}

export interface ActivityFollowItem {
  user_id: number;
  username: string;
  display_name: string;
  avatar_key: string;
  is_verified: number;
  created_at: string;
}

export interface ActivityPostItem {
  id: number;
  image_key: string;
  caption: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

export interface ActivityHistoryItem {
  kind: 'created' | 'username_changed';
  created_at: string;
  username: string;
}

export interface ActivitySectionResult {
  items: Array<
    | ActivityLikedPostItem
    | ActivityLikedCommentItem
    | ActivityCommentItem
    | ActivityFollowItem
    | ActivityPostItem
    | ActivityHistoryItem
  >;
  has_more: boolean;
}

const VALID_SECTIONS = new Set<ActivitySection>(['likes', 'comment_likes', 'comments', 'follows', 'posts', 'history']);
const PAGE_SIZE = 30;
const MAX_BULK_IDS = 50;

function jsonPrivate(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}

function normalizeUnixToSqlDate(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString().replace('T', ' ').substring(0, 19);
}

export async function getActivitySummary(env: Env, userId: number): Promise<ActivitySummary> {
  const [likedPostsRow, likedCommentsRow, commentsRow, followsRow, postsRow, usernameChangesRow] = await Promise.all([
    env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM likes l JOIN posts p ON p.id = l.post_id WHERE l.user_id = ?',
    )
      .bind(userId)
      .first<{ cnt: number | string }>(),
    env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM comment_likes cl JOIN comments c ON c.id = cl.comment_id JOIN posts p ON p.id = c.post_id WHERE cl.user_id = ?',
    )
      .bind(userId)
      .first<{ cnt: number | string }>(),
    env.DB.prepare(
      'SELECT COUNT(*) AS total_cnt, SUM(CASE WHEN c.parent_id IS NOT NULL THEN 1 ELSE 0 END) AS replies_cnt FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.user_id = ?',
    )
      .bind(userId)
      .first<{ total_cnt: number | string; replies_cnt: number | string | null }>(),
    env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM follows f JOIN users u ON u.id = f.following_id WHERE f.follower_id = ?',
    )
      .bind(userId)
      .first<{ cnt: number | string }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM posts WHERE user_id = ?')
      .bind(userId)
      .first<{ cnt: number | string }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM username_changes WHERE user_id = ?')
      .bind(userId)
      .first<{ cnt: number | string }>(),
  ]);

  return {
    liked_posts_count: Number(likedPostsRow?.cnt || 0),
    liked_comments_count: Number(likedCommentsRow?.cnt || 0),
    comments_count: Number(commentsRow?.total_cnt || 0),
    replies_count: Number(commentsRow?.replies_cnt || 0),
    follows_count: Number(followsRow?.cnt || 0),
    posts_count: Number(postsRow?.cnt || 0),
    history_count: 1 + Number(usernameChangesRow?.cnt || 0),
  };
}

export async function getActivitySectionData(
  env: Env,
  user: User,
  section: ActivitySection,
  sort: ActivitySort = 'newest',
  filter: ActivityCommentFilter = 'all',
  offset = 0,
): Promise<ActivitySectionResult> {
  const dir = sort === 'oldest' ? 'ASC' : 'DESC';
  const safeOffset = Number.isInteger(offset) && offset >= 0 && offset <= 10000 ? offset : 0;
  const fetchLimit = PAGE_SIZE + 1;

  if (section === 'likes') {
    const res = await env.DB.prepare(
      `SELECT l.post_id, p.image_key, p.caption, u.username AS author_username, u.display_name AS author_display_name, u.is_verified AS author_is_verified, l.created_at AS liked_at
       FROM likes l
       JOIN posts p ON p.id = l.post_id
       JOIN users u ON u.id = p.user_id
       WHERE l.user_id = ?
       ORDER BY l.created_at ${dir}, l.post_id ${dir}
       LIMIT ? OFFSET ?`,
    )
      .bind(user.id, fetchLimit, safeOffset)
      .all<ActivityLikedPostItem>();
    const rows = res.results || [];
    const has_more = rows.length > PAGE_SIZE;
    return { items: has_more ? rows.slice(0, PAGE_SIZE) : rows, has_more };
  }

  if (section === 'comment_likes') {
    const res = await env.DB.prepare(
      `SELECT cl.comment_id, c.post_id, c.content,
              cu.username AS comment_author_username, cu.avatar_key AS comment_author_avatar_key, cu.is_verified AS comment_author_is_verified,
              p.image_key AS post_image_key, pu.username AS post_author_username,
              cl.created_at AS liked_at
       FROM comment_likes cl
       JOIN comments c ON c.id = cl.comment_id
       JOIN users cu ON cu.id = c.user_id
       JOIN posts p ON p.id = c.post_id
       JOIN users pu ON pu.id = p.user_id
       WHERE cl.user_id = ?
       ORDER BY cl.created_at ${dir}, cl.comment_id ${dir}
       LIMIT ? OFFSET ?`,
    )
      .bind(user.id, fetchLimit, safeOffset)
      .all<ActivityLikedCommentItem>();
    const rows = res.results || [];
    const has_more = rows.length > PAGE_SIZE;
    return { items: has_more ? rows.slice(0, PAGE_SIZE) : rows, has_more };
  }

  if (section === 'comments') {
    const filterSql =
      filter === 'replies'
        ? 'AND c.parent_id IS NOT NULL'
        : filter === 'comments'
          ? 'AND c.parent_id IS NULL'
          : '';
    const res = await env.DB.prepare(
      `SELECT c.id, c.post_id, c.parent_id, c.content, c.created_at,
              p.image_key AS post_image_key, pu.username AS post_author_username,
              parent_u.username AS parent_author_username,
              parent_c.content AS parent_content
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       JOIN users pu ON pu.id = p.user_id
       LEFT JOIN comments parent_c ON parent_c.id = c.parent_id
       LEFT JOIN users parent_u ON parent_u.id = parent_c.user_id
       WHERE c.user_id = ? ${filterSql}
       ORDER BY c.created_at ${dir}, c.id ${dir}
       LIMIT ? OFFSET ?`,
    )
      .bind(user.id, fetchLimit, safeOffset)
      .all<ActivityCommentItem>();
    const rows = res.results || [];
    const has_more = rows.length > PAGE_SIZE;
    return { items: has_more ? rows.slice(0, PAGE_SIZE) : rows, has_more };
  }

  if (section === 'follows') {
    const res = await env.DB.prepare(
      `SELECT u.id AS user_id, u.username, u.display_name, u.avatar_key, u.is_verified, f.created_at
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at ${dir}, f.following_id ${dir}
       LIMIT ? OFFSET ?`,
    )
      .bind(user.id, fetchLimit, safeOffset)
      .all<ActivityFollowItem>();
    const rows = res.results || [];
    const has_more = rows.length > PAGE_SIZE;
    return { items: has_more ? rows.slice(0, PAGE_SIZE) : rows, has_more };
  }

  if (section === 'posts') {
    const res = await env.DB.prepare(
      `SELECT p.id, p.image_key, p.caption, p.created_at,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count
       FROM posts p
       WHERE p.user_id = ?
       ORDER BY p.created_at ${dir}, p.id ${dir}
       LIMIT ? OFFSET ?`,
    )
      .bind(user.id, fetchLimit, safeOffset)
      .all<ActivityPostItem>();
    const rows = (res.results || []).map((r) => ({
      ...r,
      likes_count: Number(r.likes_count || 0),
      comments_count: Number(r.comments_count || 0),
    }));
    const has_more = rows.length > PAGE_SIZE;
    return { items: has_more ? rows.slice(0, PAGE_SIZE) : rows, has_more };
  }

  const changesRes = await env.DB.prepare(
    'SELECT created_at FROM username_changes WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
  )
    .bind(user.id)
    .all<{ created_at: number | string }>();

  const events: ActivityHistoryItem[] = [];
  if (user.created_at) {
    events.push({
      kind: 'created',
      created_at: user.created_at,
      username: user.username,
    });
  }
  for (const ch of changesRes.results || []) {
    const dt = normalizeUnixToSqlDate(ch.created_at);
    if (dt) {
      events.push({
        kind: 'username_changed',
        created_at: dt,
        username: user.username,
      });
    }
  }
  events.sort((a, b) => {
    const ta = Date.parse(a.created_at.includes('T') ? a.created_at : a.created_at.replace(' ', 'T') + 'Z') || 0;
    const tb = Date.parse(b.created_at.includes('T') ? b.created_at : b.created_at.replace(' ', 'T') + 'Z') || 0;
    return sort === 'oldest' ? ta - tb : tb - ta;
  });
  const sliced = events.slice(safeOffset, safeOffset + PAGE_SIZE);
  return {
    items: sliced,
    has_more: safeOffset + PAGE_SIZE < events.length,
  };
}

export async function handleGetActivity(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonPrivate({ error: 'Unauthorized' }, 401);

  const allowed = await consumeRateLimitAtomic(env, `activity:get:u:${user.id}`, 120, 60);
  if (!allowed) return jsonPrivate({ error: 'Too many requests' }, 429);

  const rawSection = (url.searchParams.get('section') || '').trim() as ActivitySection;
  if (!VALID_SECTIONS.has(rawSection)) {
    const summary = await getActivitySummary(env, user.id);
    return jsonPrivate({ summary });
  }

  const rawSort = (url.searchParams.get('sort') || 'newest').trim();
  const sort: ActivitySort = rawSort === 'oldest' ? 'oldest' : 'newest';

  const rawFilter = (url.searchParams.get('filter') || 'all').trim();
  const filter: ActivityCommentFilter =
    rawFilter === 'replies' ? 'replies' : rawFilter === 'comments' ? 'comments' : 'all';

  const rawOffset = Number(url.searchParams.get('offset') || '0');
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 10000 ? rawOffset : 0;

  const data = await getActivitySectionData(env, user, rawSection, sort, filter, offset);
  return jsonPrivate({ section: rawSection, sort, filter, offset, ...data });
}

function parseUniquePositiveIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BULK_IDS) return null;
  const set = new Set<number>();
  for (const item of raw) {
    const id = parsePositiveId(item);
    if (!id) return null;
    set.add(id);
  }
  return Array.from(set);
}

export async function handleActivityUnlike(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonPrivate({ error: 'Unauthorized' }, 401);

  const allowed = await consumeRateLimitAtomic(env, `activity:unlike:u:${user.id}`, 30, 60);
  if (!allowed) return jsonPrivate({ error: 'Too many requests' }, 429);

  const parsed = await readJsonWithLimit<{ kind?: unknown; ids?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonPrivate({ error: parsed.status === 413 ? 'Payload too large' : 'Invalid request' }, parsed.status);

  const kind = parsed.data?.kind === 'comment' ? 'comment' : parsed.data?.kind === 'post' ? 'post' : null;
  if (!kind) return jsonPrivate({ error: 'Invalid kind' }, 400);

  const ids = parseUniquePositiveIds(parsed.data?.ids);
  if (!ids) return jsonPrivate({ error: 'Invalid ids' }, 400);

  const placeholders = ids.map(() => '?').join(', ');
  if (kind === 'post') {
    await env.DB.prepare(`DELETE FROM likes WHERE user_id = ? AND post_id IN (${placeholders})`)
      .bind(user.id, ...ids)
      .run();
  } else {
    await env.DB.prepare(`DELETE FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`)
      .bind(user.id, ...ids)
      .run();
  }

  const summary = await getActivitySummary(env, user.id);
  return jsonPrivate({ success: true, removed_ids: ids, summary });
}

export async function handleActivityDeleteComments(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) return jsonPrivate({ error: 'Unauthorized' }, 401);

  const allowed = await consumeRateLimitAtomic(env, `activity:delc:u:${user.id}`, 30, 60);
  if (!allowed) return jsonPrivate({ error: 'Too many requests' }, 429);

  const parsed = await readJsonWithLimit<{ ids?: unknown }>(request, 4096);
  if (!parsed.ok) return jsonPrivate({ error: parsed.status === 413 ? 'Payload too large' : 'Invalid request' }, parsed.status);

  const ids = parseUniquePositiveIds(parsed.data?.ids);
  if (!ids) return jsonPrivate({ error: 'Invalid ids' }, 400);

  const placeholders = ids.map(() => '?').join(', ');
  await env.DB.prepare(`DELETE FROM comments WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(user.id, ...ids)
    .run();

  const summary = await getActivitySummary(env, user.id);
  return jsonPrivate({ success: true, deleted_ids: ids, summary });
}
