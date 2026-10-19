import { Env, FeedPost, ExplorePost, ExploreUser } from './types';

const STOP_WORDS = new Set([
  'этот', 'эта', 'это', 'эти', 'тот', 'тоже', 'когда', 'куда', 'если', 'хотя',
  'меня', 'тебя', 'него', 'нее', 'нами', 'вами', 'ними', 'свой', 'своя', 'свои',
  'очень', 'просто', 'здесь', 'везде', 'всегда', 'никогда', 'после', 'перед',
  'через', 'вместе', 'между', 'чтобы', 'будто', 'снова', 'опять', 'может',
  'this', 'that', 'with', 'from', 'have', 'were', 'which', 'about', 'there',
  'their', 'would', 'could', 'other', 'after', 'first', 'these', 'where',
  'bilan', 'uchun', 'hamda', 'ammo', 'lekin', 'chunki', 'faqat', 'bunday',
  'ushbu', 'kerak', 'keyin', 'oldin', 'qanday', 'barcha', 'aynan',
  'үшін', 'және', 'бірақ', 'себебі', 'қалай', 'осылай', 'кейін', 'дейін'
]);

export function extractTagsFromCaption(caption: string): string[] {
  if (!caption) return [];
  const text = caption.toLowerCase();
  const rawMatches = text.match(/[#]?([a-zа-яё0-9_]{4,30})/gi) || [];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const m of rawMatches) {
    const clean = m.replace(/^#+/, '').trim();
    if (clean.length < 4 || clean.length > 30) continue;
    if (STOP_WORDS.has(clean)) continue;
    if (/^\d+$/.test(clean)) continue;
    if (!seen.has(clean)) {
      seen.add(clean);
      tags.push(clean);
      if (tags.length >= 10) break;
    }
  }
  return tags;
}

export async function ensureTagsBackfilled(env: Env): Promise<void> {
  try {
    const existing = await env.DB.prepare('SELECT 1 FROM post_tags LIMIT 1').first();
    if (existing) return;

    const posts = await env.DB.prepare("SELECT id, caption FROM posts WHERE caption != '' LIMIT 500").all<{ id: number; caption: string }>();
    if (!posts.results || posts.results.length === 0) return;

    const statements: any[] = [];
    for (const p of posts.results) {
      const tags = extractTagsFromCaption(p.caption);
      for (const t of tags) {
        statements.push(
          env.DB.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)').bind(p.id, t)
        );
      }
    }
    if (statements.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < statements.length; i += chunkSize) {
        await env.DB.batch(statements.slice(i, i + chunkSize));
      }
    }
  } catch {}
}

export async function savePostTags(env: Env, postId: number, caption: string): Promise<string[]> {
  const tags = extractTagsFromCaption(caption);
  if (tags.length === 0) return [];
  try {
    const stmts = tags.map(tag =>
      env.DB.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)').bind(postId, tag)
    );
    await env.DB.batch(stmts);
  } catch {}
  return tags;
}

export async function adjustAffinity(env: Env, userId: number, authorId: number, delta: number): Promise<void> {
  if (!userId || !authorId || userId === authorId) return;
  try {
    await env.DB.prepare(
      `INSERT INTO user_affinity (user_id, author_id, affinity_score, updated_at)
       VALUES (?1, ?2, MAX(0, ?3), datetime('now'))
       ON CONFLICT (user_id, author_id) DO UPDATE SET
         affinity_score = MAX(0, affinity_score + ?3),
         updated_at = datetime('now')`
    ).bind(userId, authorId, delta).run();
  } catch {}
}

export async function adjustTagAffinity(env: Env, userId: number, postId: number, delta: number): Promise<void> {
  if (!userId || !postId) return;
  try {
    const tagRows = await env.DB.prepare('SELECT tag FROM post_tags WHERE post_id = ?').bind(postId).all<{ tag: string }>();
    const tags = (tagRows.results || []).map(r => r.tag);
    if (tags.length === 0) return;

    const stmts = tags.map(tag =>
      env.DB.prepare(
        `INSERT INTO user_tag_affinity (user_id, tag, score)
         VALUES (?1, ?2, MAX(0, ?3))
         ON CONFLICT (user_id, tag) DO UPDATE SET
           score = MAX(0, score + ?3)`
      ).bind(userId, tag, delta)
    );
    await env.DB.batch(stmts);
  } catch {}
}

export interface PersonalizedFeedResult {
  followedPosts: FeedPost[];
  suggestedPosts: FeedPost[];
  allCaughtUp: boolean;
  recommendedUsers: ExploreUser[];
}

export async function getPersonalizedFeed(env: Env, viewerId: number): Promise<PersonalizedFeedResult> {
  await ensureTagsBackfilled(env);

  let followedPosts: FeedPost[] = [];
  let suggestedPosts: FeedPost[] = [];
  let allCaughtUp = false;

  try {
    const followedRows = await env.DB.prepare(
      `SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
              u.username, u.display_name, u.avatar_key,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked,
              1 AS is_followed_author,
              COALESCE(ui.impressions, 0) AS user_impressions,
              COALESCE(ui.opened, 0) AS user_opened,
              (
                COALESCE(ua.affinity_score, 0) * 1.5 +
                (CASE WHEN COALESCE(ui.impressions, 0) = 0 THEN 20.0 ELSE 0.0 END) -
                ((julianday('now') - julianday(p.created_at)) * 24.0 * 0.8)
              ) AS sort_rank
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN follows f ON f.follower_id = ?1 AND f.following_id = p.user_id
       LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
       LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = p.user_id
       WHERE COALESCE(ui.is_hidden, 0) = 0
         AND (p.reports_count IS NULL OR p.reports_count < 5)
       ORDER BY
         CASE WHEN COALESCE(ui.impressions, 0) = 0 THEN 0 ELSE 1 END,
         sort_rank DESC,
         p.created_at DESC
       LIMIT 30`
    ).bind(viewerId).all<any>();

    if (followedRows.results) {
      followedPosts = followedRows.results.map(p => ({
        id: p.id,
        user_id: p.user_id,
        image_key: p.image_key,
        caption: p.caption,
        created_at: p.created_at,
        username: p.username,
        display_name: p.display_name,
        avatar_key: p.avatar_key,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        is_liked: Boolean(p.is_liked),
        is_followed_author: true
      }));
    }
  } catch {}

  const unseenFollowedCount = followedPosts.filter(p => (p as any).user_impressions === 0).length;
  allCaughtUp = followedPosts.length === 0 || unseenFollowedCount === 0;

  try {
    const suggestedRows = await env.DB.prepare(
      `WITH post_base AS (
         SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
                u.username, u.display_name, u.avatar_key,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked,
                0 AS is_followed_author,
                COALESCE(ui.impressions, 0) AS user_impressions,
                COALESCE(ui.opened, 0) AS user_opened,
                (SELECT COUNT(*) FROM user_interactions WHERE post_id = p.id AND impressions > 0) AS total_impressions,
                COALESCE(ua.affinity_score, 0) AS affinity_score,
                COALESCE((
                  SELECT SUM(uta.score)
                  FROM post_tags pt
                  JOIN user_tag_affinity uta ON uta.user_id = ?1 AND uta.tag = pt.tag
                  WHERE pt.post_id = p.id
                ), 0) AS tag_score,
                (
                  SELECT COUNT(DISTINCT l1.user_id)
                  FROM likes l1
                  JOIN likes l2 ON l2.post_id = l1.post_id AND l2.user_id = ?1
                  WHERE l1.post_id = p.id AND l1.user_id != ?1
                ) AS collab_count,
                ((julianday('now') - julianday(p.created_at)) * 24.0) AS age_hours,
                ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at DESC) AS author_post_rank
         FROM posts p
         JOIN users u ON p.user_id = u.id
         LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
         LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = p.user_id
         WHERE p.user_id != ?1
           AND NOT EXISTS(SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = p.user_id)
           AND COALESCE(ui.is_hidden, 0) = 0
           AND (p.reports_count IS NULL OR p.reports_count < 5)
       )
       SELECT id, user_id, image_key, caption, created_at,
              username, display_name, avatar_key,
              likes_count, comments_count, is_liked, is_followed_author,
              (
                (
                  (likes_count * 3.5 + comments_count * 6.0 + (CASE WHEN total_impressions > 5 THEN (CAST(likes_count + comments_count * 2 AS REAL) / total_impressions) * 25.0 ELSE 0.0 END)) +
                  (collab_count * 5.0) +
                  (affinity_score * 2.0) +
                  (tag_score * 2.5) +
                  (CASE WHEN age_hours < 6.0 AND total_impressions < 15 THEN 12.0 ELSE 0.0 END) +
                  1.0
                )
                /
                ((age_hours + 2.0) * (age_hours + 2.0))
              )
              *
              (CASE
                WHEN user_opened = 1 THEN 0.08
                WHEN user_impressions >= 1 THEN 0.25
                ELSE 1.0
              END)
              *
              (CASE
                WHEN author_post_rank = 1 THEN 1.0
                WHEN author_post_rank = 2 THEN 0.5
                ELSE 0.25
              END) AS final_rank
       FROM post_base
       ORDER BY final_rank DESC, created_at DESC
       LIMIT 30`
    ).bind(viewerId).all<any>();

    if (suggestedRows.results) {
      suggestedPosts = suggestedRows.results.map(p => ({
        id: p.id,
        user_id: p.user_id,
        image_key: p.image_key,
        caption: p.caption,
        created_at: p.created_at,
        username: p.username,
        display_name: p.display_name,
        avatar_key: p.avatar_key,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        is_liked: Boolean(p.is_liked),
        is_followed_author: false
      }));
    }
  } catch {}

  const recommendedUsers = await getRecommendedUsers(env, viewerId, 8);

  return {
    followedPosts,
    suggestedPosts,
    allCaughtUp,
    recommendedUsers
  };
}

export async function getPersonalizedExplore(
  env: Env,
  viewerId: number,
  tagFilter: string = 'all',
  limit: number = 36
): Promise<{ posts: ExplorePost[]; tags: string[]; activeTag: string }> {
  await ensureTagsBackfilled(env);
  const tags = await getPopularExploreTags(env, 10);
  let posts: ExplorePost[] = [];

  const cleanFilter = (tagFilter || 'all').toLowerCase().trim();

  try {
    let query = '';
    const bindings: any[] = [viewerId];

    if (cleanFilter === 'recent') {
      query = `
        SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
               u.username, u.display_name, u.avatar_key AS author_avatar_key,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
        WHERE COALESCE(ui.is_hidden, 0) = 0
          AND (p.reports_count IS NULL OR p.reports_count < 5)
        ORDER BY p.created_at DESC
        LIMIT ?2`;
      bindings.push(limit);
    } else if (cleanFilter === 'popular') {
      query = `
        SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
               u.username, u.display_name, u.avatar_key AS author_avatar_key,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
        WHERE COALESCE(ui.is_hidden, 0) = 0
          AND (p.reports_count IS NULL OR p.reports_count < 5)
        ORDER BY (likes_count * 2.0 + comments_count * 4.0) DESC, p.created_at DESC
        LIMIT ?2`;
      bindings.push(limit);
    } else if (cleanFilter !== 'all') {
      query = `
        SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
               u.username, u.display_name, u.avatar_key AS author_avatar_key,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
               EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN post_tags pt ON pt.post_id = p.id AND pt.tag = ?2
        LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
        WHERE COALESCE(ui.is_hidden, 0) = 0
          AND (p.reports_count IS NULL OR p.reports_count < 5)
        ORDER BY p.created_at DESC
        LIMIT ?3`;
      bindings.push(cleanFilter, limit);
    } else {
      query = `
        WITH post_base AS (
          SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at,
                 u.username, u.display_name, u.avatar_key AS author_avatar_key,
                 (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
                 (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
                 EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?1) AS is_liked,
                 COALESCE(ui.impressions, 0) AS user_impressions,
                 COALESCE(ui.opened, 0) AS user_opened,
                 (SELECT COUNT(*) FROM user_interactions WHERE post_id = p.id AND impressions > 0) AS total_impressions,
                 COALESCE(ua.affinity_score, 0) AS affinity_score,
                 COALESCE((
                   SELECT SUM(uta.score)
                   FROM post_tags pt
                   JOIN user_tag_affinity uta ON uta.user_id = ?1 AND uta.tag = pt.tag
                   WHERE pt.post_id = p.id
                 ), 0) AS tag_score,
                 (
                   SELECT COUNT(DISTINCT l1.user_id)
                   FROM likes l1
                   JOIN likes l2 ON l2.post_id = l1.post_id AND l2.user_id = ?1
                   WHERE l1.post_id = p.id AND l1.user_id != ?1
                 ) AS collab_count,
                 ((julianday('now') - julianday(p.created_at)) * 24.0) AS age_hours,
                 ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.created_at DESC) AS author_post_rank
          FROM posts p
          JOIN users u ON p.user_id = u.id
          LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = p.id
          LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = p.user_id
          WHERE COALESCE(ui.is_hidden, 0) = 0
            AND (p.reports_count IS NULL OR p.reports_count < 5)
        )
        SELECT id, user_id, image_key, caption, created_at,
               username, display_name, author_avatar_key,
               likes_count, comments_count, is_liked,
               (
                 (
                   (likes_count * 3.5 + comments_count * 6.0 + (CASE WHEN total_impressions > 5 THEN (CAST(likes_count + comments_count * 2 AS REAL) / total_impressions) * 25.0 ELSE 0.0 END)) +
                   (collab_count * 5.0) +
                   (affinity_score * 2.0) +
                   (tag_score * 2.5) +
                   (CASE WHEN age_hours < 6.0 AND total_impressions < 15 THEN 12.0 ELSE 0.0 END) +
                   1.0
                 )
                 /
                 ((age_hours + 2.0) * (age_hours + 2.0))
               )
               *
               (CASE
                 WHEN user_opened = 1 THEN 0.08
                 WHEN user_impressions >= 1 THEN 0.25
                 ELSE 1.0
               END)
               *
               (CASE
                 WHEN author_post_rank = 1 THEN 1.0
                 WHEN author_post_rank = 2 THEN 0.5
                 ELSE 0.25
               END) AS final_rank
        FROM post_base
        ORDER BY final_rank DESC, created_at DESC
        LIMIT ?2`;
      bindings.push(limit);
    }

    let stmt = env.DB.prepare(query);
    if (bindings.length === 1) stmt = stmt.bind(bindings[0]);
    else if (bindings.length === 2) stmt = stmt.bind(bindings[0], bindings[1]);
    else if (bindings.length === 3) stmt = stmt.bind(bindings[0], bindings[1], bindings[2]);

    const postRows = await stmt.all<any>();
    if (postRows.results) {
      posts = postRows.results.map(p => ({
        id: p.id,
        user_id: p.user_id,
        image_key: p.image_key,
        caption: p.caption,
        created_at: p.created_at,
        username: p.username,
        display_name: p.display_name,
        author_avatar_key: p.author_avatar_key,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        is_liked: Boolean(p.is_liked)
      }));
    }
  } catch {}

  return { posts, tags, activeTag: cleanFilter };
}

export async function getPopularExploreTags(env: Env, limit: number = 10): Promise<string[]> {
  await ensureTagsBackfilled(env);
  try {
    const rows = await env.DB.prepare(
      `SELECT tag, COUNT(*) as cnt
       FROM post_tags
       GROUP BY tag
       ORDER BY cnt DESC, tag ASC
       LIMIT ?`
    ).bind(limit).all<{ tag: string }>();
    return (rows.results || []).map(r => r.tag);
  } catch {
    return [];
  }
}

export async function getRelatedPosts(env: Env, postId: number, viewerId: number, limit: number = 6): Promise<ExplorePost[]> {
  try {
    const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(postId).first<{ user_id: number }>();
    if (!post) return [];

    const rows = await env.DB.prepare(
      `SELECT DISTINCT p.id, p.user_id, p.image_key, p.caption, p.created_at,
              u.username, u.display_name, u.avatar_key AS author_avatar_key,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?2) AS is_liked,
              (
                (CASE WHEN p.user_id = ?3 THEN 5.0 ELSE 0.0 END) +
                (SELECT COUNT(*) * 3.0 FROM post_tags pt1 JOIN post_tags pt2 ON pt2.post_id = ?1 AND pt2.tag = pt1.tag WHERE pt1.post_id = p.id) +
                (SELECT COUNT(DISTINCT l1.user_id) * 2.0 FROM likes l1 JOIN likes l2 ON l2.post_id = ?1 AND l2.user_id = l1.user_id WHERE l1.post_id = p.id)
              ) AS relation_score
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id != ?1
         AND (p.reports_count IS NULL OR p.reports_count < 5)
       ORDER BY relation_score DESC, p.created_at DESC
       LIMIT ?4`
    ).bind(postId, viewerId, post.user_id, limit).all<any>();

    return (rows.results || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      image_key: p.image_key,
      caption: p.caption,
      created_at: p.created_at,
      username: p.username,
      display_name: p.display_name,
      avatar_key: p.author_avatar_key,
      author_avatar_key: p.author_avatar_key,
      likes_count: Number(p.likes_count) || 0,
      comments_count: Number(p.comments_count) || 0,
      is_liked: Boolean(p.is_liked)
    }));
  } catch {
    return [];
  }
}

export async function getRecommendedUsers(env: Env, viewerId: number, limit: number = 8): Promise<ExploreUser[]> {
  try {
    const rows = await env.DB.prepare(
      `WITH candidate_users AS (
         SELECT u.id, u.username, u.display_name, u.avatar_key,
                (
                  (SELECT COUNT(*) * 8.0
                   FROM follows f1
                   JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = u.id
                   WHERE f1.follower_id = ?1) +
                  (COALESCE(ua.affinity_score, 0) * 3.0) +
                  ((SELECT COUNT(*) FROM follows WHERE following_id = u.id) * 0.5) +
                  ((SELECT COUNT(*) FROM posts WHERE user_id = u.id AND ((julianday('now') - julianday(created_at)) * 24.0) < 72.0) * 4.0)
                ) AS rec_score
         FROM users u
         LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = u.id
         WHERE u.id != ?1
           AND NOT EXISTS(SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = u.id)
       )
       SELECT id, username, display_name, avatar_key
       FROM candidate_users
       WHERE rec_score > 0
       ORDER BY rec_score DESC, id DESC
       LIMIT ?2`
    ).bind(viewerId, limit).all<ExploreUser>();

    return rows.results || [];
  } catch {
    return [];
  }
}

export async function getSimilarAuthors(env: Env, targetAuthorId: number, viewerId: number, limit: number = 6): Promise<ExploreUser[]> {
  try {
    const rows = await env.DB.prepare(
      `WITH similar_candidates AS (
         SELECT u.id, u.username, u.display_name, u.avatar_key,
                (
                  (SELECT COUNT(*) * 5.0
                   FROM follows f1
                   JOIN follows f2 ON f2.follower_id = f1.follower_id AND f2.following_id = u.id
                   WHERE f1.following_id = ?1) +
                  (SELECT COUNT(DISTINCT l1.user_id) * 2.5
                   FROM posts p1
                   JOIN likes l1 ON l1.post_id = p1.id
                   JOIN posts p2 ON p2.user_id = u.id
                   JOIN likes l2 ON l2.post_id = p2.id AND l2.user_id = l1.user_id
                   WHERE p1.user_id = ?1)
                ) AS sim_score
         FROM users u
         WHERE u.id != ?1
           AND u.id != ?2
           AND NOT EXISTS(SELECT 1 FROM follows WHERE follower_id = ?2 AND following_id = u.id)
       )
       SELECT id, username, display_name, avatar_key
       FROM similar_candidates
       WHERE sim_score > 0
       ORDER BY sim_score DESC, id DESC
       LIMIT ?3`
    ).bind(targetAuthorId, viewerId, limit).all<ExploreUser>();

    return rows.results || [];
  } catch {
    return [];
  }
}

export interface TelemetryEvent {
  type: 'impression' | 'dwell' | 'open_modal' | 'profile_visit';
  post_id?: number;
  author_id?: number;
  dwell_ms?: number;
}

export async function handleTelemetryBatch(env: Env, userId: number, events: TelemetryEvent[]): Promise<void> {
  if (!userId || !events || !Array.isArray(events) || events.length === 0) return;
  const batch = events.slice(0, 50);

  const interactionStmts: any[] = [];
  const affinityUpdates: Map<number, number> = new Map();
  const tagUpdates: Map<number, number> = new Map();

  for (const ev of batch) {
    if (ev.type === 'impression' && typeof ev.post_id === 'number') {
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, impressions, last_seen_at)
           VALUES (?1, ?2, 1, datetime('now'))
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             impressions = impressions + 1,
             last_seen_at = datetime('now')`
        ).bind(userId, ev.post_id)
      );
    } else if (ev.type === 'dwell' && typeof ev.post_id === 'number') {
      const ms = Math.min(Math.max(ev.dwell_ms || 0, 0), 60000);
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, dwell_ms, last_seen_at)
           VALUES (?1, ?2, ?3, datetime('now'))
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             dwell_ms = dwell_ms + ?3,
             last_seen_at = datetime('now')`
        ).bind(userId, ev.post_id, ms)
      );
      if (ms >= 2500) {
        if (typeof ev.author_id === 'number' && ev.author_id !== userId) {
          affinityUpdates.set(ev.author_id, (affinityUpdates.get(ev.author_id) || 0) + 1.0);
        }
        tagUpdates.set(ev.post_id, (tagUpdates.get(ev.post_id) || 0) + 0.5);
      }
    } else if (ev.type === 'open_modal' && typeof ev.post_id === 'number') {
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, opened, last_seen_at)
           VALUES (?1, ?2, 1, datetime('now'))
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             opened = 1,
             last_seen_at = datetime('now')`
        ).bind(userId, ev.post_id)
      );
      if (typeof ev.author_id === 'number' && ev.author_id !== userId) {
        affinityUpdates.set(ev.author_id, (affinityUpdates.get(ev.author_id) || 0) + 1.5);
      }
      tagUpdates.set(ev.post_id, (tagUpdates.get(ev.post_id) || 0) + 1.0);
    } else if (ev.type === 'profile_visit' && typeof ev.author_id === 'number' && ev.author_id !== userId) {
      affinityUpdates.set(ev.author_id, (affinityUpdates.get(ev.author_id) || 0) + 2.0);
    }
  }

  for (const [authorId, delta] of affinityUpdates.entries()) {
    interactionStmts.push(
      env.DB.prepare(
        `INSERT INTO user_affinity (user_id, author_id, affinity_score, updated_at)
         VALUES (?1, ?2, MAX(0, ?3), datetime('now'))
         ON CONFLICT (user_id, author_id) DO UPDATE SET
           affinity_score = MAX(0, affinity_score + ?3),
           updated_at = datetime('now')`
      ).bind(userId, authorId, delta)
    );
  }

  if (interactionStmts.length > 0) {
    try {
      await env.DB.batch(interactionStmts);
    } catch {}
  }

  for (const [postId, delta] of tagUpdates.entries()) {
    await adjustTagAffinity(env, userId, postId, delta);
  }
}
