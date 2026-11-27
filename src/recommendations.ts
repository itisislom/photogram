import { Env, FeedPost, ExplorePost, ExploreUser } from './types';
import { consumeBurstWithLockoutAtomic } from './security';

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

const BATCH_CHUNK_SIZE = 50;
const MAX_TELEMETRY_EVENTS = 30;
const MAX_DWELL_MS = 120000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;
const MAX_CACHE_ENTRIES = 400;
const MAX_TELEMETRY_DEDUPE_ENTRIES = 4000;
const TTL_TELEMETRY_DEDUPE_MS = 10 * 60 * 1000;
const TELEMETRY_EVENT_ID_RE = /^[A-Za-z0-9_-]{6,48}$/;
const TTL_PERSONAL_MS = 3 * 60 * 1000;
const TTL_POPULAR_MS = 7 * 60 * 1000;
const TTL_TAGS_MS = 15 * 60 * 1000;
const TTL_SIMILAR_MS = 15 * 60 * 1000;
const ALLOWED_TELEMETRY_TYPES = new Set([
  'impression',
  'dwell',
  'skip',
  'post_open',
  'profile_visit',
  'comment_open',
]);

interface CachedEntry<T> {
  value: T;
  expiresAt: number;
}

interface RankedIdItem {
  id: number;
  score?: number;
}

interface FeedRankCacheValue {
  followedIds: number[];
  suggestedIds: number[];
  allCaughtUp: boolean;
  gen: string;
}

interface RankedListCacheValue {
  items: RankedIdItem[];
  gen: string;
}

const memCache = new Map<string, CachedEntry<unknown>>();
const telemetrySeenIds = new Map<string, number>();
let tagsBackfilledDone = false;

function hasOrRememberTelemetryEventId(userId: number, eventId: string, now: number): boolean {
  const key = `${userId}:${eventId}`;
  const exp = telemetrySeenIds.get(key);
  if (exp !== undefined && exp > now) {
    return true;
  }
  if (telemetrySeenIds.size >= MAX_TELEMETRY_DEDUPE_ENTRIES) {
    for (const [k, v] of telemetrySeenIds.entries()) {
      if (v <= now) telemetrySeenIds.delete(k);
    }
    if (telemetrySeenIds.size >= MAX_TELEMETRY_DEDUPE_ENTRIES) {
      const oldest = telemetrySeenIds.keys().next().value;
      if (oldest !== undefined) telemetrySeenIds.delete(oldest);
    }
  }
  telemetrySeenIds.set(key, now + TTL_TELEMETRY_DEDUPE_MS);
  return false;
}

export function clearTelemetryDedupeCache(): void {
  telemetrySeenIds.clear();
}

function getEdgeCache(): Cache | null {
  try {
    const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches;
    return c && c.default ? c.default : null;
  } catch {
    return null;
  }
}

function makeEdgeCacheUrl(key: string): string {
  return `https://rec-cache.photogram.internal/${encodeURIComponent(key)}`;
}

async function recCacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit) {
    if (hit.expiresAt > now) {
      return hit.value as T;
    }
    memCache.delete(key);
  }
  const edge = getEdgeCache();
  if (!edge) return null;
  try {
    const res = await edge.match(makeEdgeCacheUrl(key));
    if (!res) return null;
    const parsed = (await res.json()) as CachedEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= now) {
      return null;
    }
    memCacheSet(key, parsed.value, parsed.expiresAt - now);
    return parsed.value;
  } catch {
    return null;
  }
}

function memCacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (memCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = memCache.keys().next().value;
    if (firstKey !== undefined) memCache.delete(firstKey);
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function recCacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  memCacheSet(key, value, ttlMs);
  const edge = getEdgeCache();
  if (!edge) return;
  try {
    const ttlSec = Math.max(10, Math.floor(ttlMs / 1000));
    const entry: CachedEntry<T> = { value, expiresAt: Date.now() + ttlMs };
    await edge.put(
      makeEdgeCacheUrl(key),
      new Response(JSON.stringify(entry), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSec}`,
        },
      }),
    );
  } catch {}
}

export async function invalidateRecommendationCaches(opts?: { userId?: number; postChanged?: boolean }): Promise<void> {
  const edge = getEdgeCache();
  const keysToDrop: string[] = [];
  if (opts?.userId && opts.userId > 0) {
    const uid = opts.userId;
    keysToDrop.push(`feed:u:${uid}`, `explore:all:u:${uid}`, `recusers:u:${uid}`);
  }
  if (opts?.postChanged) {
    keysToDrop.push('explore:popular', 'explore:tags:10');
    for (const k of memCache.keys()) {
      if (k.startsWith('explore:tag:') || k.startsWith('feed:u:') || k.startsWith('explore:all:u:')) {
        keysToDrop.push(k);
      }
    }
  }
  const unique = Array.from(new Set(keysToDrop));
  for (const k of unique) {
    memCache.delete(k);
    if (edge) {
      try {
        await edge.delete(makeEdgeCacheUrl(k));
      } catch {}
    }
  }
}

function encodeCursor(offset: number, gen: string): string {
  const raw = JSON.stringify({ o: Math.max(0, Math.floor(offset)), g: gen.slice(0, 16) });
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCursor(rawCursor?: string | null): { offset: number; gen: string } | null {
  if (!rawCursor || typeof rawCursor !== 'string' || rawCursor.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(rawCursor)) return null;
  try {
    const padded = rawCursor.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (rawCursor.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { o?: unknown; g?: unknown };
    const o = Number(parsed?.o);
    const g = typeof parsed?.g === 'string' ? parsed.g.slice(0, 16) : '';
    if (!Number.isInteger(o) || o < 0 || o > 300) return null;
    return { offset: o, gen: g };
  } catch {
    return null;
  }
}

function decodeRecentCursor(rawCursor?: string | null): number {
  if (!rawCursor || typeof rawCursor !== 'string' || rawCursor.length > 64) return 0;
  if (!/^r:(\d{1,12})$/.test(rawCursor)) return 0;
  const id = Number(rawCursor.slice(2));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

async function hydratePostsByIds(
  env: Env,
  orderedIds: number[],
  viewerId: number,
  isFollowedMap?: Set<number>,
): Promise<Array<FeedPost & ExplorePost>> {
  const cleanIds = orderedIds.filter((id) => Number.isInteger(id) && id > 0);
  if (cleanIds.length === 0) return [];
  const placeholders = cleanIds.map((_, idx) => `?${idx + 2}`).join(', ');
  const res = await env.DB.prepare(
    `WITH target_posts AS (
       SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at, COALESCE(p.shares_count, 0) AS shares_count
       FROM posts p
       WHERE p.id IN (${placeholders})
         AND (p.reports_count IS NULL OR p.reports_count < 5)
     ),
     post_likes AS (
       SELECT l.post_id, COUNT(*)::int AS likes_count
       FROM likes l
       JOIN target_posts tp ON tp.id = l.post_id
       GROUP BY l.post_id
     ),
     post_comments AS (
       SELECT c.post_id, COUNT(*)::int AS comments_count
       FROM comments c
       JOIN target_posts tp ON tp.id = c.post_id
       GROUP BY c.post_id
     )
     SELECT tp.id, tp.user_id, tp.image_key, tp.caption, tp.created_at, tp.shares_count,
            u.username, u.display_name, u.avatar_key, u.is_verified,
            COALESCE(pl.likes_count, 0) AS likes_count,
            COALESCE(pc.comments_count, 0) AS comments_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = tp.id AND l.user_id = ?1) AS is_liked
     FROM target_posts tp
     JOIN users u ON u.id = tp.user_id
     LEFT JOIN post_likes pl ON pl.post_id = tp.id
     LEFT JOIN post_comments pc ON pc.post_id = tp.id
     LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = tp.id
     WHERE COALESCE(ui.is_hidden, 0) = 0`,
  )
    .bind(viewerId, ...cleanIds)
    .all<any>();

  const byId = new Map<number, FeedPost & ExplorePost>();
  for (const p of res.results || []) {
    const id = Number(p.id);
    byId.set(id, {
      id,
      user_id: Number(p.user_id),
      image_key: p.image_key,
      caption: p.caption,
      created_at: p.created_at,
      username: p.username,
      display_name: p.display_name,
      avatar_key: p.avatar_key,
      author_avatar_key: p.avatar_key,
      likes_count: Number(p.likes_count) || 0,
      comments_count: Number(p.comments_count) || 0,
      shares_count: Number(p.shares_count) || 0,
      is_liked: Boolean(p.is_liked),
      is_followed_author: isFollowedMap ? isFollowedMap.has(id) : false,
      is_verified: Number(p.is_verified) === 1 ? 1 : 0,
    });
  }

  const ordered: Array<FeedPost & ExplorePost> = [];
  for (const id of cleanIds) {
    const item = byId.get(id);
    if (item) ordered.push(item);
  }
  return ordered;
}

async function runBatchChunked(env: Env, statements: any[]): Promise<void> {
  if (!statements.length) return;
  for (let i = 0; i < statements.length; i += BATCH_CHUNK_SIZE) {
    await env.DB.batch(statements.slice(i, i + BATCH_CHUNK_SIZE) as any);
  }
}

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
  if (tagsBackfilledDone) return;
  try {
    const existing = await env.DB.prepare('SELECT 1 FROM post_tags LIMIT 1').first();
    if (existing) {
      tagsBackfilledDone = true;
      return;
    }

    const posts = await env.DB.prepare("SELECT id, caption FROM posts WHERE caption != '' LIMIT 300").all<{ id: number; caption: string }>();
    if (!posts.results || posts.results.length === 0) {
      tagsBackfilledDone = true;
      return;
    }

    const statements: any[] = [];
    for (const p of posts.results) {
      const tags = extractTagsFromCaption(p.caption);
      for (const t of tags) {
        statements.push(
          env.DB.prepare('INSERT INTO post_tags (post_id, tag) VALUES (?, ?) ON CONFLICT (post_id, tag) DO NOTHING').bind(p.id, t)
        );
      }
    }
    await runBatchChunked(env, statements);
    tagsBackfilledDone = true;
  } catch { }
}

export async function savePostTags(env: Env, postId: number, caption: string): Promise<string[]> {
  const tags = extractTagsFromCaption(caption);
  if (tags.length === 0) return [];
  try {
    const stmts = tags.map(tag =>
      env.DB.prepare('INSERT INTO post_tags (post_id, tag) VALUES (?, ?) ON CONFLICT (post_id, tag) DO NOTHING').bind(postId, tag)
    );
    await runBatchChunked(env, stmts);
  } catch { }
  return tags;
}

function buildAuthorAffinityStmt(env: Env, userId: number, authorId: number, delta: number): any {
  return env.DB.prepare(
    `INSERT INTO user_affinity (user_id, author_id, affinity_score, updated_at)
     VALUES (?1, ?2, GREATEST(-5.0, LEAST(100.0, CAST(?3 AS DOUBLE PRECISION))), NOW())
     ON CONFLICT (user_id, author_id) DO UPDATE SET
       affinity_score = GREATEST(
         -5.0,
         LEAST(
           100.0,
           (user_affinity.affinity_score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - user_affinity.updated_at)) / 86400.0) / 14.0)) + CAST(?3 AS DOUBLE PRECISION)
         )
       ),
       updated_at = NOW()`
  ).bind(userId, authorId, delta);
}

function buildTagAffinityStmt(env: Env, userId: number, tag: string, delta: number): any {
  return env.DB.prepare(
    `INSERT INTO user_tag_affinity (user_id, tag, score, updated_at)
     VALUES (?1, ?2, GREATEST(-4.0, LEAST(80.0, CAST(?3 AS DOUBLE PRECISION))), NOW())
     ON CONFLICT (user_id, tag) DO UPDATE SET
       score = GREATEST(
         -4.0,
         LEAST(
           80.0,
           (user_tag_affinity.score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - user_tag_affinity.updated_at)) / 86400.0) / 14.0)) + CAST(?3 AS DOUBLE PRECISION)
         )
       ),
       updated_at = NOW()`
  ).bind(userId, tag, delta);
}

export async function adjustAffinity(env: Env, userId: number, authorId: number, delta: number): Promise<void> {
  if (!userId || !authorId || userId === authorId || !Number.isFinite(delta) || delta === 0) return;
  try {
    await buildAuthorAffinityStmt(env, userId, authorId, delta).run();
  } catch { }
}

export async function adjustTagAffinity(env: Env, userId: number, postId: number, delta: number): Promise<void> {
  if (!userId || !postId || !Number.isFinite(delta) || delta === 0) return;
  try {
    const postRow = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(postId).first<{ user_id: number }>();
    if (!postRow || postRow.user_id === userId) return;

    const tagRows = await env.DB.prepare('SELECT tag FROM post_tags WHERE post_id = ?').bind(postId).all<{ tag: string }>();
    const tags = (tagRows.results || []).map(r => r.tag);
    if (tags.length === 0) return;

    const stmts = tags.map(tag => buildTagAffinityStmt(env, userId, tag, delta));
    await runBatchChunked(env, stmts);
  } catch { }
}

export async function adjustPostEngagementBatch(
  env: Env,
  userId: number,
  postId: number,
  authorId: number,
  authorDelta: number,
  tagDelta: number,
): Promise<void> {
  if (!userId || !postId || userId === authorId) return;
  try {
    const stmts: any[] = [];
    if (authorId > 0 && Number.isFinite(authorDelta) && authorDelta !== 0) {
      stmts.push(buildAuthorAffinityStmt(env, userId, authorId, authorDelta));
    }
    if (Number.isFinite(tagDelta) && tagDelta !== 0) {
      const tagRows = await env.DB.prepare('SELECT tag FROM post_tags WHERE post_id = ?').bind(postId).all<{ tag: string }>();
      for (const r of tagRows.results || []) {
        if (r.tag) stmts.push(buildTagAffinityStmt(env, userId, r.tag, tagDelta));
      }
    }
    if (stmts.length > 0) {
      await runBatchChunked(env, stmts);
    }
  } catch { }
}

interface RawCandidatePost {
  id: number;
  user_id: number;
  image_key: string;
  caption: string;
  created_at: string;
  username: string;
  display_name: string;
  author_avatar_key: string;
  is_verified: number | boolean;
  likes_count: number;
  comments_count: number;
  is_liked: boolean | number;
  total_impressions: number;
  recent_impressions: number;
  recent_opened: number;
  recent_skips: number;
  author_affinity: number;
  tag_score: number;
  collab_score: number;
  age_hours: number;
}

interface ScoredCandidate {
  post: RawCandidatePost;
  personalScore: number;
  trendingScore: number;
  explorationScore: number;
  hasPersonalSignal: boolean;
  isFreshExplore: boolean;
}

function scoreCandidates(rows: RawCandidatePost[], viewerId: number): ScoredCandidate[] {
  return rows.map(row => {
    const likes = Number(row.likes_count) || 0;
    const comments = Number(row.comments_count) || 0;
    const totalImpressions = Number(row.total_impressions) || 0;
    const recentImpressions = Number(row.recent_impressions) || 0;
    const recentOpened = Number(row.recent_opened) || 0;
    const recentSkips = Number(row.recent_skips) || 0;
    const authorAffinity = Number(row.author_affinity) || 0;
    const tagScore = Number(row.tag_score) || 0;
    const collabScore = Number(row.collab_score) || 0;
    const ageHours = Math.max(0, Number(row.age_hours) || 0);
    const isLiked = Boolean(row.is_liked);
    const isVerified = Number(row.is_verified) === 1;

    const bayesianRate = (likes + comments * 2.0 + 0.5) / (totalImpressions + 10.0);
    const gravity = 1.0 / (1.0 + Math.pow(ageHours / 18.0, 1.4));
    const verifiedTieBreaker = isVerified ? 1.05 : 1.0;

    let seenPenalty = 1.0;
    if (recentSkips > 0 && !isLiked && recentOpened === 0) {
      seenPenalty = 0.06;
    } else if (recentOpened > 0) {
      seenPenalty = 0.10;
    } else if (recentImpressions > 0) {
      seenPenalty = 0.18;
    }

    const quality = (likes * 3.0 + comments * 5.0) * 0.25 + bayesianRate * 30.0;
    const velocity = ((likes * 2.0 + comments * 4.0) / Math.pow(ageHours + 2.0, 1.15)) * 4.0;
    const personalSignal = authorAffinity * 2.4 + tagScore * 2.2 + Math.min(collabScore, 40.0) * 1.8;
    const hasPersonalSignal = viewerId > 0 && (Math.abs(authorAffinity) > 0.05 || Math.abs(tagScore) > 0.05 || collabScore > 0.05);

    const personalScore = Math.max(0.01, (personalSignal + quality * 0.6 + 1.5)) * gravity * seenPenalty * verifiedTieBreaker;
    const trendingScore = (quality + velocity + 0.5) * gravity * seenPenalty * verifiedTieBreaker;
    const isFreshExplore = ageHours < 48.0 && totalImpressions < 25;
    const explorationScore = isFreshExplore
      ? ((25.0 / (totalImpressions + 3.0)) + bayesianRate * 12.0 + (48.0 - ageHours) * 0.15) * seenPenalty * verifiedTieBreaker
      : (1.0 / (totalImpressions + 5.0)) * gravity * seenPenalty;

    return {
      post: row,
      personalScore,
      trendingScore,
      explorationScore,
      hasPersonalSignal,
      isFreshExplore,
    };
  });
}

function interleaveNoConsecutiveAuthors<T extends { user_id: number }>(items: T[]): T[] {
  if (items.length <= 2) return items;
  const remaining = items.slice();
  const result: T[] = [];
  let lastAuthorId = -1;

  while (remaining.length > 0) {
    const pickIdx = remaining.findIndex(item => item.user_id !== lastAuthorId);
    if (pickIdx !== -1) {
      const picked = remaining.splice(pickIdx, 1)[0];
      result.push(picked);
      lastAuthorId = picked.user_id;
    } else {
      const picked = remaining.shift()!;
      let inserted = false;
      for (let pos = 0; pos < result.length; pos++) {
        const prevDiff = pos === 0 || result[pos - 1].user_id !== picked.user_id;
        const currDiff = result[pos].user_id !== picked.user_id;
        if (prevDiff && currDiff) {
          result.splice(pos, 0, picked);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        result.push(picked);
        lastAuthorId = picked.user_id;
      }
    }
  }
  return result;
}

function mixAndDiversify(
  scored: ScoredCandidate[],
  viewerId: number,
  limit: number,
  maxPerAuthor: number = 2
): RawCandidatePost[] {
  if (scored.length === 0 || limit <= 0) return [];

  const hasUserHistory = viewerId > 0 && scored.some(c => c.hasPersonalSignal);

  const personalPool = scored.slice().sort((a, b) => b.personalScore - a.personalScore);
  const trendingPool = scored.slice().sort((a, b) => b.trendingScore - a.trendingScore);
  const explorePool = scored.slice().sort((a, b) => {
    if (a.isFreshExplore !== b.isFreshExplore) return a.isFreshExplore ? -1 : 1;
    return b.explorationScore - a.explorationScore;
  });

  const personalTarget = hasUserHistory ? Math.round(limit * 0.6) : 0;
  const trendingTarget = hasUserHistory ? Math.round(limit * 0.2) : Math.round(limit * 0.6);
  const exploreTarget = Math.max(0, limit - personalTarget - trendingTarget);

  const usedPostIds = new Set<number>();
  const authorCounts = new Map<number, number>();
  const selected: RawCandidatePost[] = [];

  function pickFromPool(pool: ScoredCandidate[], count: number, enforceAuthorCap: boolean): void {
    let added = 0;
    for (const item of pool) {
      if (added >= count || selected.length >= limit) break;
      const pid = item.post.id;
      if (usedPostIds.has(pid)) continue;
      const uid = item.post.user_id;
      const currentCount = authorCounts.get(uid) || 0;
      if (enforceAuthorCap && currentCount >= maxPerAuthor) continue;
      usedPostIds.add(pid);
      authorCounts.set(uid, currentCount + 1);
      selected.push(item.post);
      added++;
    }
  }

  const slotPattern: Array<'p' | 't' | 'e'> = hasUserHistory
    ? ['p', 'p', 't', 'p', 'e']
    : ['t', 'e', 't', 't', 'e'];

  let pLeft = personalTarget;
  let tLeft = trendingTarget;
  let eLeft = exploreTarget;
  let guard = 0;

  while (selected.length < limit && (pLeft > 0 || tLeft > 0 || eLeft > 0) && guard < limit * 4) {
    const slot = slotPattern[guard % slotPattern.length];
    guard++;
    const before = selected.length;
    if (slot === 'p' && pLeft > 0) {
      pickFromPool(personalPool, 1, true);
      if (selected.length > before) pLeft--;
      else pLeft = 0;
    } else if (slot === 't' && tLeft > 0) {
      pickFromPool(trendingPool, 1, true);
      if (selected.length > before) tLeft--;
      else tLeft = 0;
    } else if (slot === 'e' && eLeft > 0) {
      pickFromPool(explorePool, 1, true);
      if (selected.length > before) eLeft--;
      else eLeft = 0;
    }
  }

  if (selected.length < limit) {
    pickFromPool(personalPool, limit - selected.length, true);
  }
  if (selected.length < limit) {
    pickFromPool(trendingPool, limit - selected.length, true);
  }
  if (selected.length < limit) {
    pickFromPool(explorePool, limit - selected.length, true);
  }

  return interleaveNoConsecutiveAuthors(selected);
}

async function fetchScoredCandidates(
  env: Env,
  viewerId: number,
  excludeFollowedAndSelf: boolean
): Promise<RawCandidatePost[]> {
  const filterSql = excludeFollowedAndSelf
    ? `AND p.user_id != ?1 AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.following_id = p.user_id)`
    : '';

  const query = `
    WITH candidate_posts AS (
      SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at
      FROM posts p
      WHERE (p.reports_count IS NULL OR p.reports_count < 5)
        ${filterSql}
      ORDER BY p.created_at DESC
      LIMIT 300
    ),
    viewer_recent_likes AS (
      SELECT post_id
      FROM likes
      WHERE user_id = ?1 AND created_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 100
    ),
    viewer_recent_comments AS (
      SELECT DISTINCT post_id
      FROM comments
      WHERE user_id = ?1 AND created_at >= NOW() - INTERVAL '30 days'
      LIMIT 100
    ),
    viewer_engaged_posts AS (
      SELECT post_id FROM viewer_recent_likes
      UNION
      SELECT post_id FROM viewer_recent_comments
    ),
    viewer_engaged_authors AS (
      SELECT DISTINCT p.user_id AS author_id
      FROM viewer_engaged_posts vep
      JOIN posts p ON p.id = vep.post_id
      WHERE p.user_id != ?1
    ),
    similar_users AS (
      SELECT peer_id, SUM(weight) AS sim_weight
      FROM (
        SELECT l.user_id AS peer_id, 2.0 AS weight
        FROM likes l
        JOIN viewer_engaged_posts vep ON vep.post_id = l.post_id
        WHERE l.user_id != ?1 AND l.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT c.user_id AS peer_id, 2.5 AS weight
        FROM comments c
        JOIN viewer_engaged_posts vep ON vep.post_id = c.post_id
        WHERE c.user_id != ?1 AND c.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT l.user_id AS peer_id, 0.8 AS weight
        FROM likes l
        JOIN posts p ON p.id = l.post_id
        JOIN viewer_engaged_authors vea ON vea.author_id = p.user_id
        WHERE l.user_id != ?1 AND l.created_at >= NOW() - INTERVAL '30 days'
      ) peers
      GROUP BY peer_id
      ORDER BY sim_weight DESC
      LIMIT 50
    ),
    collab_scores AS (
      SELECT post_id, SUM(peer_score) AS collab_score
      FROM (
        SELECT l.post_id, su.sim_weight * 1.0 AS peer_score
        FROM likes l
        JOIN similar_users su ON su.peer_id = l.user_id
        JOIN candidate_posts cp ON cp.id = l.post_id
        WHERE l.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT c.post_id, su.sim_weight * 1.4 AS peer_score
        FROM comments c
        JOIN similar_users su ON su.peer_id = c.user_id
        JOIN candidate_posts cp ON cp.id = c.post_id
        WHERE c.created_at >= NOW() - INTERVAL '30 days'
      ) cs
      GROUP BY post_id
    ),
    post_likes AS (
      SELECT l.post_id, COUNT(*)::int AS likes_count
      FROM likes l
      JOIN candidate_posts cp ON cp.id = l.post_id
      GROUP BY l.post_id
    ),
    post_comments AS (
      SELECT c.post_id, COUNT(*)::int AS comments_count
      FROM comments c
      JOIN candidate_posts cp ON cp.id = c.post_id
      GROUP BY c.post_id
    ),
    post_impressions AS (
      SELECT ui.post_id, COUNT(*)::int AS total_impressions
      FROM user_interactions ui
      JOIN candidate_posts cp ON cp.id = ui.post_id
      WHERE ui.impressions > 0
      GROUP BY ui.post_id
    ),
    tag_scores AS (
      SELECT pt.post_id,
             SUM(uta.score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - uta.updated_at)) / 86400.0) / 14.0)) AS tag_score
      FROM post_tags pt
      JOIN candidate_posts cp ON cp.id = pt.post_id
      JOIN user_tag_affinity uta ON uta.user_id = ?1 AND LOWER(uta.tag) = LOWER(pt.tag)
      GROUP BY pt.post_id
    )
    SELECT cp.id, cp.user_id, cp.image_key, cp.caption, cp.created_at,
           u.username, u.display_name, u.avatar_key AS author_avatar_key, u.is_verified,
           COALESCE(pl.likes_count, 0) AS likes_count,
           COALESCE(pc.comments_count, 0) AS comments_count,
           EXISTS(SELECT 1 FROM likes l WHERE l.post_id = cp.id AND l.user_id = ?1) AS is_liked,
           COALESCE(pi.total_impressions, 0) AS total_impressions,
           COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.impressions ELSE 0 END, 0) AS recent_impressions,
           COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.opened ELSE 0 END, 0) AS recent_opened,
           COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.skips ELSE 0 END, 0) AS recent_skips,
           COALESCE(ua.affinity_score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - ua.updated_at)) / 86400.0) / 14.0), 0.0) AS author_affinity,
           COALESCE(ts.tag_score, 0.0) AS tag_score,
           COALESCE(cs.collab_score, 0.0) AS collab_score,
           GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - cp.created_at)) / 3600.0) AS age_hours
    FROM candidate_posts cp
    JOIN users u ON u.id = cp.user_id
    LEFT JOIN post_likes pl ON pl.post_id = cp.id
    LEFT JOIN post_comments pc ON pc.post_id = cp.id
    LEFT JOIN post_impressions pi ON pi.post_id = cp.id
    LEFT JOIN tag_scores ts ON ts.post_id = cp.id
    LEFT JOIN collab_scores cs ON cs.post_id = cp.id
    LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = cp.id
    LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = cp.user_id
    WHERE COALESCE(ui.is_hidden, 0) = 0`;

  const res = await env.DB.prepare(query).bind(viewerId).all<RawCandidatePost>();
  return res.results || [];
}

export interface PersonalizedFeedResult {
  followedPosts: FeedPost[];
  suggestedPosts: FeedPost[];
  allCaughtUp: boolean;
  recommendedUsers: ExploreUser[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface FeedPageSliceResult {
  posts: FeedPost[];
  next_cursor: string | null;
  has_more: boolean;
}

async function computeFeedRankedIds(env: Env, viewerId: number): Promise<FeedRankCacheValue> {
  const cacheKey = `feed:u:${viewerId}`;
  const cached = await recCacheGet<FeedRankCacheValue>(cacheKey);
  if (cached) return cached;

  let followedIds: number[] = [];
  let unseenFollowedCount = 0;

  try {
    const followedRows = await env.DB.prepare(
      `WITH candidate_followed AS (
         SELECT p.id, p.user_id, p.created_at
         FROM posts p
         JOIN follows f ON f.follower_id = ?1 AND f.following_id = p.user_id
         WHERE (p.reports_count IS NULL OR p.reports_count < 5)
         ORDER BY p.created_at DESC
         LIMIT 150
       )
       SELECT cf.id,
              COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.impressions ELSE 0 END, 0) AS recent_impressions,
              (
                COALESCE(ua.affinity_score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - ua.updated_at)) / 86400.0) / 14.0), 0.0) * 1.6 +
                (CASE WHEN COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.impressions ELSE 0 END, 0) = 0 THEN 22.0 ELSE 0.0 END) +
                (CASE WHEN u.is_verified = 1 THEN 0.15 ELSE 0.0 END) -
                (GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - cf.created_at)) / 3600.0) * 0.75)
              ) AS sort_rank
       FROM candidate_followed cf
       JOIN users u ON u.id = cf.user_id
       LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = cf.id
       LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = cf.user_id
       WHERE COALESCE(ui.is_hidden, 0) = 0
       ORDER BY
         CASE WHEN COALESCE(CASE WHEN ui.last_seen_at >= NOW() - INTERVAL '14 days' THEN ui.impressions ELSE 0 END, 0) = 0 THEN 0 ELSE 1 END,
         sort_rank DESC,
         cf.created_at DESC
       LIMIT 60`
    ).bind(viewerId).all<{ id: number; recent_impressions: number }>();

    if (followedRows.results) {
      unseenFollowedCount = followedRows.results.filter(p => Number(p.recent_impressions) === 0).length;
      followedIds = followedRows.results.map(p => Number(p.id)).filter(id => id > 0);
    }
  } catch { }

  const allCaughtUp = followedIds.length === 0 || unseenFollowedCount === 0;
  const followedIdSet = new Set(followedIds);
  let suggestedIds: number[] = [];

  try {
    const rawCandidates = await fetchScoredCandidates(env, viewerId, true);
    const filteredCandidates = rawCandidates.filter(c => !followedIdSet.has(c.id));
    const scored = scoreCandidates(filteredCandidates, viewerId);
    const mixed = mixAndDiversify(scored, viewerId, 100, 2);
    suggestedIds = mixed.map(p => Number(p.id)).filter(id => id > 0);
  } catch { }

  const result: FeedRankCacheValue = {
    followedIds,
    suggestedIds,
    allCaughtUp,
    gen: Date.now().toString(36),
  };
  await recCacheSet(cacheKey, result, TTL_PERSONAL_MS);
  return result;
}

export async function getPersonalizedFeed(
  env: Env,
  viewerId: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<PersonalizedFeedResult> {
  await ensureTagsBackfilled(env);
  const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(pageSize) || DEFAULT_PAGE_SIZE));

  const [ranked, recommendedUsers] = await Promise.all([
    computeFeedRankedIds(env, viewerId),
    getRecommendedUsers(env, viewerId, 8),
  ]);

  const followedCount = ranked.followedIds.length;
  const combinedIds = [...ranked.followedIds, ...ranked.suggestedIds];
  const firstSliceIds = combinedIds.slice(0, safeLimit);
  const followedSet = new Set(ranked.followedIds);
  const hydrated = await hydratePostsByIds(env, firstSliceIds, viewerId, followedSet);

  const followedPosts: FeedPost[] = [];
  const suggestedPosts: FeedPost[] = [];
  for (const post of hydrated) {
    if (followedSet.has(post.id)) followedPosts.push(post);
    else suggestedPosts.push(post);
  }

  const nextOffset = firstSliceIds.length;
  const hasMore = nextOffset < combinedIds.length;
  const nextCursor = hasMore ? encodeCursor(nextOffset, ranked.gen) : null;

  return {
    followedPosts,
    suggestedPosts,
    allCaughtUp: ranked.allCaughtUp && followedPosts.length >= followedCount,
    recommendedUsers,
    nextCursor,
    hasMore,
  };
}

export async function getPersonalizedFeedPage(
  env: Env,
  viewerId: number,
  cursor?: string | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<FeedPageSliceResult> {
  await ensureTagsBackfilled(env);
  const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(pageSize) || DEFAULT_PAGE_SIZE));
  const ranked = await computeFeedRankedIds(env, viewerId);
  const decoded = decodeCursor(cursor);
  const offset = decoded ? decoded.offset : 0;

  const combinedIds = [...ranked.followedIds, ...ranked.suggestedIds];
  const sliceIds = combinedIds.slice(offset, offset + safeLimit);
  const followedSet = new Set(ranked.followedIds);
  const posts = await hydratePostsByIds(env, sliceIds, viewerId, followedSet);

  const nextOffset = offset + sliceIds.length;
  const hasMore = sliceIds.length > 0 && nextOffset < combinedIds.length;
  return {
    posts,
    next_cursor: hasMore ? encodeCursor(nextOffset, ranked.gen) : null,
    has_more: hasMore,
  };
}

export async function getPersonalizedExplore(
  env: Env,
  viewerId: number,
  tagFilter: string = 'all',
  limit: number = DEFAULT_PAGE_SIZE,
  cursor?: string | null,
): Promise<{ posts: ExplorePost[]; tags: string[]; activeTag: string; next_cursor: string | null; has_more: boolean }> {
  await ensureTagsBackfilled(env);
  const tags = await getPopularExploreTags(env, 10);
  const safeLimit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || DEFAULT_PAGE_SIZE));
  const cleanFilter = (tagFilter || 'all').toLowerCase().trim();
  let posts: ExplorePost[] = [];
  let nextCursor: string | null = null;
  let hasMore = false;

  try {
    if (cleanFilter === 'all') {
      const cacheKey = `explore:all:u:${viewerId}`;
      let ranked = await recCacheGet<RankedListCacheValue>(cacheKey);
      if (!ranked) {
        const rawCandidates = await fetchScoredCandidates(env, viewerId, false);
        const scored = scoreCandidates(rawCandidates, viewerId);
        const mixed = mixAndDiversify(scored, viewerId, 120, 2);
        ranked = {
          items: mixed.map((p, idx) => ({ id: Number(p.id), score: 120 - idx })),
          gen: Date.now().toString(36),
        };
        await recCacheSet(cacheKey, ranked, TTL_PERSONAL_MS);
      }
      const decoded = decodeCursor(cursor);
      const offset = decoded ? decoded.offset : 0;
      const sliceIds = ranked.items.slice(offset, offset + safeLimit).map(it => it.id);
      posts = await hydratePostsByIds(env, sliceIds, viewerId);
      const nextOffset = offset + sliceIds.length;
      hasMore = sliceIds.length > 0 && nextOffset < ranked.items.length;
      nextCursor = hasMore ? encodeCursor(nextOffset, ranked.gen) : null;
    } else if (cleanFilter === 'recent') {
      const beforeId = decodeRecentCursor(cursor);
      const fetchLimit = safeLimit + 1;
      const postRows = beforeId > 0
        ? await env.DB.prepare(
            `WITH candidate_posts AS (
               SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at, COALESCE(p.shares_count, 0) AS shares_count
               FROM posts p
               WHERE (p.reports_count IS NULL OR p.reports_count < 5)
                 AND p.id < ?2
               ORDER BY p.id DESC
               LIMIT 120
             ),
             post_likes AS (
               SELECT l.post_id, COUNT(*)::int AS likes_count
               FROM likes l
               JOIN candidate_posts cp ON cp.id = l.post_id
               GROUP BY l.post_id
             ),
             post_comments AS (
               SELECT c.post_id, COUNT(*)::int AS comments_count
               FROM comments c
               JOIN candidate_posts cp ON cp.id = c.post_id
               GROUP BY c.post_id
             )
             SELECT cp.id, cp.user_id, cp.image_key, cp.caption, cp.created_at, cp.shares_count,
                    u.username, u.display_name, u.avatar_key AS author_avatar_key, u.is_verified,
                    COALESCE(pl.likes_count, 0) AS likes_count,
                    COALESCE(pc.comments_count, 0) AS comments_count,
                    EXISTS(SELECT 1 FROM likes l WHERE l.post_id = cp.id AND l.user_id = ?1) AS is_liked
             FROM candidate_posts cp
             JOIN users u ON u.id = cp.user_id
             LEFT JOIN post_likes pl ON pl.post_id = cp.id
             LEFT JOIN post_comments pc ON pc.post_id = cp.id
             LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = cp.id
             WHERE COALESCE(ui.is_hidden, 0) = 0
             ORDER BY cp.id DESC
             LIMIT ?3`
          ).bind(viewerId, beforeId, fetchLimit).all<any>()
        : await env.DB.prepare(
            `WITH candidate_posts AS (
               SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at, COALESCE(p.shares_count, 0) AS shares_count
               FROM posts p
               WHERE (p.reports_count IS NULL OR p.reports_count < 5)
               ORDER BY p.id DESC
               LIMIT 120
             ),
             post_likes AS (
               SELECT l.post_id, COUNT(*)::int AS likes_count
               FROM likes l
               JOIN candidate_posts cp ON cp.id = l.post_id
               GROUP BY l.post_id
             ),
             post_comments AS (
               SELECT c.post_id, COUNT(*)::int AS comments_count
               FROM comments c
               JOIN candidate_posts cp ON cp.id = c.post_id
               GROUP BY c.post_id
             )
             SELECT cp.id, cp.user_id, cp.image_key, cp.caption, cp.created_at, cp.shares_count,
                    u.username, u.display_name, u.avatar_key AS author_avatar_key, u.is_verified,
                    COALESCE(pl.likes_count, 0) AS likes_count,
                    COALESCE(pc.comments_count, 0) AS comments_count,
                    EXISTS(SELECT 1 FROM likes l WHERE l.post_id = cp.id AND l.user_id = ?1) AS is_liked
             FROM candidate_posts cp
             JOIN users u ON u.id = cp.user_id
             LEFT JOIN post_likes pl ON pl.post_id = cp.id
             LEFT JOIN post_comments pc ON pc.post_id = cp.id
             LEFT JOIN user_interactions ui ON ui.user_id = ?1 AND ui.post_id = cp.id
             WHERE COALESCE(ui.is_hidden, 0) = 0
             ORDER BY cp.id DESC
             LIMIT ?2`
          ).bind(viewerId, fetchLimit).all<any>();

      const rawRows = postRows.results || [];
      hasMore = rawRows.length > safeLimit;
      const sliced = hasMore ? rawRows.slice(0, safeLimit) : rawRows;
      posts = sliced.map(p => ({
        id: Number(p.id),
        user_id: Number(p.user_id),
        image_key: p.image_key,
        caption: p.caption,
        created_at: p.created_at,
        username: p.username,
        display_name: p.display_name,
        author_avatar_key: p.author_avatar_key,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        shares_count: Number(p.shares_count) || 0,
        is_liked: Boolean(p.is_liked),
        is_verified: Number(p.is_verified) === 1 ? 1 : 0
      }));
      nextCursor = hasMore && posts.length > 0 ? `r:${posts[posts.length - 1].id}` : null;
    } else if (cleanFilter === 'popular') {
      const cacheKey = 'explore:popular';
      let ranked = await recCacheGet<RankedListCacheValue>(cacheKey);
      if (!ranked) {
        const postRows = await env.DB.prepare(
          `WITH candidate_posts AS (
             SELECT p.id, p.user_id, p.created_at
             FROM posts p
             WHERE (p.reports_count IS NULL OR p.reports_count < 5)
             ORDER BY p.created_at DESC
             LIMIT 300
           ),
           post_likes AS (
             SELECT l.post_id, COUNT(*)::int AS likes_count
             FROM likes l
             JOIN candidate_posts cp ON cp.id = l.post_id
             GROUP BY l.post_id
           ),
           post_comments AS (
             SELECT c.post_id, COUNT(*)::int AS comments_count
             FROM comments c
             JOIN candidate_posts cp ON cp.id = c.post_id
             GROUP BY c.post_id
           ),
           post_impressions AS (
             SELECT ui.post_id, COUNT(*)::int AS total_impressions
             FROM user_interactions ui
             JOIN candidate_posts cp ON cp.id = ui.post_id
             WHERE ui.impressions > 0
             GROUP BY ui.post_id
           )
           SELECT cp.id, cp.user_id,
                  (
                    (
                      (COALESCE(pl.likes_count, 0) * 3.0 + COALESCE(pc.comments_count, 0) * 5.0) +
                      ((COALESCE(pl.likes_count, 0) + COALESCE(pc.comments_count, 0) * 2.0 + 0.5) / (COALESCE(pi.total_impressions, 0) + 10.0)) * 25.0
                    ) * (CASE WHEN u.is_verified = 1 THEN 1.05 ELSE 1.0 END)
                  ) AS pop_score
           FROM candidate_posts cp
           JOIN users u ON u.id = cp.user_id
           LEFT JOIN post_likes pl ON pl.post_id = cp.id
           LEFT JOIN post_comments pc ON pc.post_id = cp.id
           LEFT JOIN post_impressions pi ON pi.post_id = cp.id
           ORDER BY pop_score DESC, cp.created_at DESC
           LIMIT 120`
        ).all<{ id: number; user_id: number; pop_score: number }>();

        const interleaved = interleaveNoConsecutiveAuthors(
          (postRows.results || []).map(r => ({ id: Number(r.id), user_id: Number(r.user_id), score: Number(r.pop_score) || 0 })),
        );
        ranked = {
          items: interleaved.map(r => ({ id: r.id, score: r.score })),
          gen: Date.now().toString(36),
        };
        await recCacheSet(cacheKey, ranked, TTL_POPULAR_MS);
      }
      const decoded = decodeCursor(cursor);
      const offset = decoded ? decoded.offset : 0;
      const sliceIds = ranked.items.slice(offset, offset + safeLimit).map(it => it.id);
      posts = await hydratePostsByIds(env, sliceIds, viewerId);
      const nextOffset = offset + sliceIds.length;
      hasMore = sliceIds.length > 0 && nextOffset < ranked.items.length;
      nextCursor = hasMore ? encodeCursor(nextOffset, ranked.gen) : null;
    } else {
      const cacheKey = `explore:tag:${cleanFilter.slice(0, 32)}`;
      let ranked = await recCacheGet<RankedListCacheValue>(cacheKey);
      if (!ranked) {
        const postRows = await env.DB.prepare(
          `WITH candidate_posts AS (
             SELECT p.id, p.created_at
             FROM posts p
             JOIN post_tags pt ON pt.post_id = p.id AND LOWER(pt.tag) = LOWER(?1)
             WHERE (p.reports_count IS NULL OR p.reports_count < 5)
             ORDER BY p.created_at DESC
             LIMIT 200
           ),
           post_likes AS (
             SELECT l.post_id, COUNT(*)::int AS likes_count
             FROM likes l
             JOIN candidate_posts cp ON cp.id = l.post_id
             GROUP BY l.post_id
           ),
           post_comments AS (
             SELECT c.post_id, COUNT(*)::int AS comments_count
             FROM comments c
             JOIN candidate_posts cp ON cp.id = c.post_id
             GROUP BY c.post_id
           )
           SELECT cp.id,
                  (COALESCE(pl.likes_count, 0) * 2.0 + COALESCE(pc.comments_count, 0) * 3.5) AS tag_rank
           FROM candidate_posts cp
           LEFT JOIN post_likes pl ON pl.post_id = cp.id
           LEFT JOIN post_comments pc ON pc.post_id = cp.id
           ORDER BY tag_rank DESC, cp.created_at DESC
           LIMIT 120`
        ).bind(cleanFilter).all<{ id: number; tag_rank: number }>();

        ranked = {
          items: (postRows.results || []).map(r => ({ id: Number(r.id), score: Number(r.tag_rank) || 0 })),
          gen: Date.now().toString(36),
        };
        await recCacheSet(cacheKey, ranked, TTL_POPULAR_MS);
      }
      const decoded = decodeCursor(cursor);
      const offset = decoded ? decoded.offset : 0;
      const sliceIds = ranked.items.slice(offset, offset + safeLimit).map(it => it.id);
      posts = await hydratePostsByIds(env, sliceIds, viewerId);
      const nextOffset = offset + sliceIds.length;
      hasMore = sliceIds.length > 0 && nextOffset < ranked.items.length;
      nextCursor = hasMore ? encodeCursor(nextOffset, ranked.gen) : null;
    }
  } catch { }

  return { posts, tags, activeTag: cleanFilter, next_cursor: nextCursor, has_more: hasMore };
}

export async function getPopularExploreTags(env: Env, limit: number = 10): Promise<string[]> {
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 10));
  const cacheKey = `explore:tags:${safeLimit}`;
  const cached = await recCacheGet<string[]>(cacheKey);
  if (cached) return cached;
  try {
    const rows = await env.DB.prepare(
      `SELECT LOWER(tag) AS tag, COUNT(*) AS cnt
       FROM post_tags
       GROUP BY LOWER(tag)
       ORDER BY cnt DESC, LOWER(tag) ASC
       LIMIT ?`
    ).bind(safeLimit).all<{ tag: string }>();
    const tags = (rows.results || []).map(r => r.tag);
    await recCacheSet(cacheKey, tags, TTL_TAGS_MS);
    return tags;
  } catch {
    return [];
  }
}

export async function getRelatedPosts(env: Env, postId: number, viewerId: number, limit: number = 6): Promise<ExplorePost[]> {
  try {
    const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(postId).first<{ user_id: number }>();
    if (!post) return [];
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 6));

    const rows = await env.DB.prepare(
      `WITH candidate_posts AS (
         SELECT p.id, p.user_id, p.image_key, p.caption, p.created_at, COALESCE(p.shares_count, 0) AS shares_count
         FROM posts p
         WHERE p.id != ?1
           AND (p.reports_count IS NULL OR p.reports_count < 5)
         ORDER BY p.created_at DESC
         LIMIT 300
       ),
       target_likers AS (
         SELECT user_id FROM likes WHERE post_id = ?1
         UNION
         SELECT user_id FROM comments WHERE post_id = ?1
       ),
       target_tags AS (
         SELECT LOWER(tag) AS tag FROM post_tags WHERE post_id = ?1
       ),
       co_engagement AS (
         SELECT cp.id AS post_id, COUNT(DISTINCT e.user_id)::int AS overlap_users
         FROM candidate_posts cp
         JOIN (
           SELECT post_id, user_id FROM likes
           UNION
           SELECT post_id, user_id FROM comments
         ) e ON e.post_id = cp.id
         JOIN target_likers tl ON tl.user_id = e.user_id
         GROUP BY cp.id
       ),
       tag_overlap AS (
         SELECT pt.post_id, COUNT(*)::int AS shared_tags
         FROM post_tags pt
         JOIN candidate_posts cp ON cp.id = pt.post_id
         JOIN target_tags tt ON tt.tag = LOWER(pt.tag)
         GROUP BY pt.post_id
       ),
       post_likes AS (
         SELECT l.post_id, COUNT(*)::int AS likes_count
         FROM likes l
         JOIN candidate_posts cp ON cp.id = l.post_id
         GROUP BY l.post_id
       ),
       post_comments AS (
         SELECT c.post_id, COUNT(*)::int AS comments_count
         FROM comments c
         JOIN candidate_posts cp ON cp.id = c.post_id
         GROUP BY c.post_id
       )
       SELECT cp.id, cp.user_id, cp.image_key, cp.caption, cp.created_at, cp.shares_count,
              u.username, u.display_name, u.avatar_key AS author_avatar_key, u.is_verified,
              COALESCE(pl.likes_count, 0) AS likes_count,
              COALESCE(pc.comments_count, 0) AS comments_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = cp.id AND l.user_id = ?2) AS is_liked,
              (
                COALESCE(ce.overlap_users, 0) * 4.5 +
                COALESCE(to2.shared_tags, 0) * 3.5 +
                (CASE WHEN cp.user_id = ?3 THEN 2.5 ELSE 0.0 END) +
                (COALESCE(pl.likes_count, 0) * 0.15 + COALESCE(pc.comments_count, 0) * 0.25) +
                (CASE WHEN u.is_verified = 1 THEN 0.15 ELSE 0.0 END)
              ) AS relation_score
       FROM candidate_posts cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN co_engagement ce ON ce.post_id = cp.id
       LEFT JOIN tag_overlap to2 ON to2.post_id = cp.id
       LEFT JOIN post_likes pl ON pl.post_id = cp.id
       LEFT JOIN post_comments pc ON pc.post_id = cp.id
       ORDER BY relation_score DESC, cp.created_at DESC
       LIMIT ?4`
    ).bind(postId, viewerId, post.user_id, safeLimit * 2).all<any>();

    const mapped: ExplorePost[] = (rows.results || []).map(p => ({
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
      shares_count: Number(p.shares_count) || 0,
      is_liked: Boolean(p.is_liked),
      is_verified: Number(p.is_verified) === 1 ? 1 : 0
    }));

    return interleaveNoConsecutiveAuthors(mapped).slice(0, safeLimit);
  } catch {
    return [];
  }
}

export async function getRecommendedUsers(env: Env, viewerId: number, limit: number = 8): Promise<ExploreUser[]> {
  try {
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));
    const cacheKey = `recusers:u:${viewerId}`;
    let rankedIds = await recCacheGet<number[]>(cacheKey);
    if (!rankedIds) {
      const rows = await env.DB.prepare(
        `WITH fof AS (
           SELECT f2.following_id AS uid, COUNT(*)::int AS mutual_cnt
           FROM follows f1
           JOIN follows f2 ON f2.follower_id = f1.following_id
           WHERE f1.follower_id = ?1
           GROUP BY f2.following_id
         ),
         author_tag_match AS (
           SELECT p.user_id AS uid,
                  SUM(uta.score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - uta.updated_at)) / 86400.0) / 14.0)) AS tag_match
           FROM post_tags pt
           JOIN posts p ON p.id = pt.post_id
           JOIN user_tag_affinity uta ON uta.user_id = ?1 AND LOWER(uta.tag) = LOWER(pt.tag)
           WHERE p.user_id != ?1
           GROUP BY p.user_id
         ),
         follower_counts AS (
           SELECT following_id AS uid, COUNT(*)::int AS cnt
           FROM follows
           GROUP BY following_id
         ),
         recent_posts AS (
           SELECT user_id AS uid, COUNT(*)::int AS cnt
           FROM posts
           WHERE created_at >= NOW() - INTERVAL '72 hours'
           GROUP BY user_id
         ),
         candidate_users AS (
           SELECT u.id,
                  (
                    COALESCE(fof.mutual_cnt, 0) * 6.0 +
                    COALESCE(ua.affinity_score / (1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - ua.updated_at)) / 86400.0) / 14.0), 0.0) * 3.0 +
                    COALESCE(atm.tag_match, 0.0) * 1.5 +
                    COALESCE(fc.cnt, 0) * 0.4 +
                    COALESCE(rp.cnt, 0) * 3.0 +
                    (CASE WHEN u.is_verified = 1 THEN 0.15 ELSE 0.0 END)
                  ) AS rec_score
           FROM users u
           LEFT JOIN fof ON fof.uid = u.id
           LEFT JOIN author_tag_match atm ON atm.uid = u.id
           LEFT JOIN follower_counts fc ON fc.uid = u.id
           LEFT JOIN recent_posts rp ON rp.uid = u.id
           LEFT JOIN user_affinity ua ON ua.user_id = ?1 AND ua.author_id = u.id
           WHERE u.id != ?1
             AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.following_id = u.id)
         )
         SELECT id
         FROM candidate_users
         ORDER BY rec_score DESC, id DESC
         LIMIT 20`
      ).bind(viewerId).all<{ id: number }>();

      rankedIds = (rows.results || []).map(r => Number(r.id)).filter(id => id > 0);
      await recCacheSet(cacheKey, rankedIds, TTL_PERSONAL_MS);
    }

    if (rankedIds.length === 0) return [];
    const placeholders = rankedIds.map((_, idx) => `?${idx + 2}`).join(', ');
    const hydrated = await env.DB.prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_key, u.is_verified
       FROM users u
       WHERE u.id IN (${placeholders})
         AND u.id != ?1
         AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.following_id = u.id)`
    ).bind(viewerId, ...rankedIds).all<ExploreUser>();

    const byId = new Map<number, ExploreUser>();
    for (const u of hydrated.results || []) {
      byId.set(Number(u.id), { ...u, id: Number(u.id), is_verified: Number(u.is_verified) === 1 ? 1 : 0 });
    }
    const out: ExploreUser[] = [];
    for (const id of rankedIds) {
      const u = byId.get(id);
      if (u) {
        out.push(u);
        if (out.length >= safeLimit) break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function getSimilarAuthors(env: Env, targetAuthorId: number, viewerId: number, limit: number = 6): Promise<ExploreUser[]> {
  try {
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 6));
    const cacheKey = `similar:a:${targetAuthorId}`;
    let rankedIds = await recCacheGet<number[]>(cacheKey);
    if (!rankedIds) {
      const rows = await env.DB.prepare(
        `WITH target_followers AS (
           SELECT follower_id FROM follows WHERE following_id = ?1
         ),
         co_following AS (
           SELECT f.following_id AS uid, COUNT(*)::int AS shared_followers
           FROM follows f
           JOIN target_followers tf ON tf.follower_id = f.follower_id
           WHERE f.following_id != ?1
           GROUP BY f.following_id
         ),
         target_tags AS (
           SELECT DISTINCT LOWER(pt.tag) AS tag
           FROM post_tags pt
           JOIN posts p ON p.id = pt.post_id
           WHERE p.user_id = ?1
         ),
         tag_overlap AS (
           SELECT p.user_id AS uid, COUNT(DISTINCT LOWER(pt.tag))::int AS shared_tags
           FROM posts p
           JOIN post_tags pt ON pt.post_id = p.id
           JOIN target_tags tt ON tt.tag = LOWER(pt.tag)
           WHERE p.user_id != ?1
           GROUP BY p.user_id
         ),
         target_likers AS (
           SELECT DISTINCT l.user_id
           FROM likes l
           JOIN posts p ON p.id = l.post_id
           WHERE p.user_id = ?1 AND l.created_at >= NOW() - INTERVAL '30 days'
           LIMIT 200
         ),
         co_likers AS (
           SELECT p.user_id AS uid, COUNT(DISTINCT l.user_id)::int AS shared_likers
           FROM likes l
           JOIN target_likers tl ON tl.user_id = l.user_id
           JOIN posts p ON p.id = l.post_id
           WHERE p.user_id != ?1 AND l.created_at >= NOW() - INTERVAL '30 days'
           GROUP BY p.user_id
         ),
         similar_candidates AS (
           SELECT u.id,
                  (
                    COALESCE(cf.shared_followers, 0) * 5.0 +
                    COALESCE(to2.shared_tags, 0) * 3.5 +
                    COALESCE(cl.shared_likers, 0) * 2.5 +
                    (CASE WHEN u.is_verified = 1 THEN 0.15 ELSE 0.0 END)
                  ) AS sim_score
           FROM users u
           LEFT JOIN co_following cf ON cf.uid = u.id
           LEFT JOIN tag_overlap to2 ON to2.uid = u.id
           LEFT JOIN co_likers cl ON cl.uid = u.id
           WHERE u.id != ?1
         )
         SELECT id
         FROM similar_candidates
         WHERE sim_score > 0
         ORDER BY sim_score DESC, id DESC
         LIMIT 25`
      ).bind(targetAuthorId).all<{ id: number }>();

      rankedIds = (rows.results || []).map(r => Number(r.id)).filter(id => id > 0);
      await recCacheSet(cacheKey, rankedIds, TTL_SIMILAR_MS);
    }

    const filteredIds = rankedIds.filter(id => id !== targetAuthorId && id !== viewerId);
    if (filteredIds.length === 0) return [];
    const placeholders = filteredIds.map((_, idx) => `?${idx + 2}`).join(', ');
    const hydrated = viewerId > 0
      ? await env.DB.prepare(
          `SELECT u.id, u.username, u.display_name, u.avatar_key, u.is_verified
           FROM users u
           WHERE u.id IN (${placeholders})
             AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.following_id = u.id)`
        ).bind(viewerId, ...filteredIds).all<ExploreUser>()
      : await env.DB.prepare(
          `SELECT u.id, u.username, u.display_name, u.avatar_key, u.is_verified
           FROM users u
           WHERE u.id IN (${placeholders})`
        ).bind(...filteredIds).all<ExploreUser>();

    const byId = new Map<number, ExploreUser>();
    for (const u of hydrated.results || []) {
      byId.set(Number(u.id), { ...u, id: Number(u.id), is_verified: Number(u.is_verified) === 1 ? 1 : 0 });
    }
    const out: ExploreUser[] = [];
    for (const id of filteredIds) {
      const u = byId.get(id);
      if (u) {
        out.push(u);
        if (out.length >= safeLimit) break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

export interface TelemetryEvent {
  event_id?: string;
  type: 'impression' | 'dwell' | 'skip' | 'post_open' | 'profile_visit' | 'comment_open';
  post_id?: number;
  author_id?: number;
  dwell_ms?: number;
}

export interface TelemetryBatchResult {
  ok: boolean;
  status: number;
  error?: string;
  accepted?: number;
}

async function checkTelemetryRateLimit(env: Env, userId: number): Promise<boolean> {
  const rl = await consumeBurstWithLockoutAtomic(env, `tel:${userId}`, 30, 60, 30);
  return rl.allowed;
}

export async function handleTelemetryBatch(
  env: Env,
  userId: number,
  rawEvents: unknown
): Promise<TelemetryBatchResult> {
  if (!userId || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!Array.isArray(rawEvents)) {
    return { ok: false, status: 400, error: 'Invalid events payload' };
  }
  if (rawEvents.length === 0) {
    return { ok: true, status: 200, accepted: 0 };
  }

  const allowed = await checkTelemetryRateLimit(env, userId);
  if (!allowed) {
    return { ok: false, status: 429, error: 'Too many requests' };
  }

  const slice = rawEvents.slice(0, MAX_TELEMETRY_EVENTS);
  const validEvents: TelemetryEvent[] = [];
  const seenEventKeys = new Set<string>();
  const postIdSet = new Set<number>();
  const profileAuthorIdSet = new Set<number>();
  const nowMs = Date.now();

  for (const item of slice) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const evType = typeof raw.type === 'string' ? raw.type : '';
    if (!ALLOWED_TELEMETRY_TYPES.has(evType)) continue;

    let cleanEventId: string | undefined;
    if (raw.event_id !== undefined && raw.event_id !== null && raw.event_id !== '') {
      if (typeof raw.event_id !== 'string' || !TELEMETRY_EVENT_ID_RE.test(raw.event_id)) continue;
      cleanEventId = raw.event_id;
    }

    const type = evType as TelemetryEvent['type'];
    const rawPostId = typeof raw.post_id === 'number' ? raw.post_id : Number(raw.post_id);
    const hasValidPostId = Number.isInteger(rawPostId) && rawPostId > 0 && rawPostId <= 2147483647;

    if (type !== 'profile_visit' && !hasValidPostId) continue;

    const rawAuthorId = typeof raw.author_id === 'number' ? raw.author_id : Number(raw.author_id);
    const hasValidAuthorId = Number.isInteger(rawAuthorId) && rawAuthorId > 0 && rawAuthorId <= 2147483647;

    if (type === 'profile_visit' && !hasValidAuthorId && !hasValidPostId) continue;

    let dwellMs = 0;
    if (type === 'dwell') {
      const parsed = Number(raw.dwell_ms);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      dwellMs = Math.max(0, Math.min(MAX_DWELL_MS, Math.round(parsed)));
    }

    const dedupeKey = `${type}:${hasValidPostId ? rawPostId : 0}:${hasValidAuthorId ? rawAuthorId : 0}`;
    if (seenEventKeys.has(dedupeKey)) continue;
    if (cleanEventId && hasOrRememberTelemetryEventId(userId, cleanEventId, nowMs)) continue;
    seenEventKeys.add(dedupeKey);

    if (hasValidPostId) postIdSet.add(rawPostId);
    if (type === 'profile_visit' && hasValidAuthorId && rawAuthorId !== userId) {
      profileAuthorIdSet.add(rawAuthorId);
    }

    validEvents.push({
      event_id: cleanEventId,
      type,
      post_id: hasValidPostId ? rawPostId : undefined,
      author_id: hasValidAuthorId ? rawAuthorId : undefined,
      dwell_ms: type === 'dwell' ? dwellMs : undefined,
    });
  }

  if (validEvents.length === 0) {
    return { ok: true, status: 200, accepted: 0 };
  }

  const postAuthorMap = new Map<number, number>();
  const postIds = Array.from(postIdSet);
  if (postIds.length > 0) {
    const placeholders = postIds.map((_, idx) => `?${idx + 1}`).join(', ');
    const postRows = await env.DB.prepare(
      `SELECT id, user_id FROM posts WHERE id IN (${placeholders})`
    ).bind(...postIds).all<{ id: number; user_id: number }>();
    for (const r of postRows.results || []) {
      postAuthorMap.set(Number(r.id), Number(r.user_id));
    }
  }

  const validProfileAuthorSet = new Set<number>();
  const profileAuthorIds = Array.from(profileAuthorIdSet);
  if (profileAuthorIds.length > 0) {
    const placeholders = profileAuthorIds.map((_, idx) => `?${idx + 1}`).join(', ');
    const userRows = await env.DB.prepare(
      `SELECT id FROM users WHERE id IN (${placeholders})`
    ).bind(...profileAuthorIds).all<{ id: number }>();
    for (const r of userRows.results || []) {
      validProfileAuthorSet.add(Number(r.id));
    }
  }

  const interactionStmts: any[] = [];
  const affinityUpdates = new Map<number, number>();
  const tagPostUpdates = new Map<number, number>();
  let accepted = 0;

  for (const ev of validEvents) {
    if (ev.type === 'profile_visit') {
      const targetAuthorId = ev.post_id && postAuthorMap.has(ev.post_id)
        ? postAuthorMap.get(ev.post_id)!
        : (ev.author_id && validProfileAuthorSet.has(ev.author_id) ? ev.author_id : 0);

      if (!targetAuthorId || targetAuthorId === userId) continue;
      accepted++;
      affinityUpdates.set(targetAuthorId, (affinityUpdates.get(targetAuthorId) || 0) + 2.5);
      if (ev.post_id && postAuthorMap.has(ev.post_id)) {
        tagPostUpdates.set(ev.post_id, (tagPostUpdates.get(ev.post_id) || 0) + 0.8);
      }
      continue;
    }

    if (!ev.post_id || !postAuthorMap.has(ev.post_id)) continue;
    const realAuthorId = postAuthorMap.get(ev.post_id)!;
    const isSelf = realAuthorId === userId;
    accepted++;

    if (ev.type === 'impression') {
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, impressions, event_type, created_at, last_seen_at)
           VALUES (?1, ?2, 1, 'impression', NOW(), NOW())
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             impressions = user_interactions.impressions + 1,
             event_type = CASE WHEN user_interactions.event_type IN ('post_open', 'comment_open', 'dwell') THEN user_interactions.event_type ELSE 'impression' END,
             last_seen_at = NOW()`
        ).bind(userId, ev.post_id)
      );
    } else if (ev.type === 'dwell') {
      const ms = ev.dwell_ms || 0;
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, impressions, dwell_ms, event_type, created_at, last_seen_at)
           VALUES (?1, ?2, 1, ?3, 'dwell', NOW(), NOW())
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             impressions = GREATEST(user_interactions.impressions, 1),
             dwell_ms = LEAST(3600000, user_interactions.dwell_ms + ?3),
             event_type = CASE WHEN user_interactions.event_type IN ('post_open', 'comment_open') THEN user_interactions.event_type ELSE 'dwell' END,
             last_seen_at = NOW()`
        ).bind(userId, ev.post_id, ms)
      );
      if (!isSelf) {
        if (ms >= 8000) {
          affinityUpdates.set(realAuthorId, (affinityUpdates.get(realAuthorId) || 0) + 2.5);
          tagPostUpdates.set(ev.post_id, (tagPostUpdates.get(ev.post_id) || 0) + 1.5);
        } else if (ms >= 3000) {
          affinityUpdates.set(realAuthorId, (affinityUpdates.get(realAuthorId) || 0) + 1.0);
          tagPostUpdates.set(ev.post_id, (tagPostUpdates.get(ev.post_id) || 0) + 0.6);
        }
      }
    } else if (ev.type === 'skip') {
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, impressions, skips, event_type, created_at, last_seen_at)
           VALUES (?1, ?2, 1, 1, 'skip', NOW(), NOW())
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             impressions = GREATEST(user_interactions.impressions, 1),
             skips = user_interactions.skips + 1,
             event_type = CASE WHEN user_interactions.event_type IN ('post_open', 'comment_open', 'dwell') THEN user_interactions.event_type ELSE 'skip' END,
             last_seen_at = NOW()`
        ).bind(userId, ev.post_id)
      );
      if (!isSelf) {
        affinityUpdates.set(realAuthorId, (affinityUpdates.get(realAuthorId) || 0) - 0.6);
        tagPostUpdates.set(ev.post_id, (tagPostUpdates.get(ev.post_id) || 0) - 0.4);
      }
    } else if (ev.type === 'post_open' || ev.type === 'comment_open') {
      interactionStmts.push(
        env.DB.prepare(
          `INSERT INTO user_interactions (user_id, post_id, impressions, opened, event_type, created_at, last_seen_at)
           VALUES (?1, ?2, 1, 1, ?3, NOW(), NOW())
           ON CONFLICT (user_id, post_id) DO UPDATE SET
             impressions = GREATEST(user_interactions.impressions, 1),
             opened = 1,
             event_type = ?3,
             last_seen_at = NOW()`
        ).bind(userId, ev.post_id, ev.type)
      );
      if (!isSelf) {
        affinityUpdates.set(realAuthorId, (affinityUpdates.get(realAuthorId) || 0) + 1.5);
        tagPostUpdates.set(ev.post_id, (tagPostUpdates.get(ev.post_id) || 0) + 1.0);
      }
    }
  }

  for (const [authorId, delta] of affinityUpdates.entries()) {
    if (authorId !== userId && delta !== 0) {
      interactionStmts.push(buildAuthorAffinityStmt(env, userId, authorId, delta));
    }
  }

  const tagPostIds = Array.from(tagPostUpdates.keys());
  if (tagPostIds.length > 0) {
    const placeholders = tagPostIds.map((_, idx) => `?${idx + 1}`).join(', ');
    const tagRows = await env.DB.prepare(
      `SELECT post_id, LOWER(tag) AS tag FROM post_tags WHERE post_id IN (${placeholders})`
    ).bind(...tagPostIds).all<{ post_id: number; tag: string }>();

    const tagDeltaMap = new Map<string, number>();
    for (const r of tagRows.results || []) {
      const postDelta = tagPostUpdates.get(Number(r.post_id)) || 0;
      if (postDelta !== 0) {
        tagDeltaMap.set(r.tag, (tagDeltaMap.get(r.tag) || 0) + postDelta);
      }
    }

    let tagCount = 0;
    for (const [tag, delta] of tagDeltaMap.entries()) {
      if (delta !== 0 && tagCount < 30) {
        interactionStmts.push(buildTagAffinityStmt(env, userId, tag, delta));
        tagCount++;
      }
    }
  }

  if (interactionStmts.length > 0) {
    await runBatchChunked(env, interactionStmts);
  }

  return { ok: true, status: 200, accepted };
}
