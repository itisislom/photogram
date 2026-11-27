import { Env, User } from './types';
import { getStyles } from './styles';
import { handleLogin, handleRegister, handleLogout, handleChangePassword, handleSwitchAccount, handleRemoveAccount, getUserFromRequest, getSavedAccountsForPage } from './auth';
import { getProfileData, handleUpdateProfile, handleUploadAvatar, getExploreData, handleSearchUsers, handleResolveMentions, handleToggleFollow, getFollowersList, getFollowingList } from './profile';
import { handleCreatePost, handleDeletePost, handleToggleLike, getFeedPosts, handleGetComments, handleCreateComment, handleDeleteComment, handleToggleCommentLike, handleToggleCommentPin } from './posts';
import { loginPage } from './pages/login';
import { registerPage } from './pages/register';
import { profilePage, userNotFoundPage } from './pages/profile';
import { settingsPage } from './pages/settings';
import { activityPage } from './pages/activity';
import {
  ActivitySection,
  getActivitySummary,
  handleGetActivity,
  handleActivityUnlike,
  handleActivityDeleteComments,
} from './activity';
import { accountListPage } from './pages/accountlist';
import { messagesPage } from './pages/messages';
import { notificationsPage } from './pages/notifications';
import {
  getUserNotifications,
  markAllNotificationsRead,
  handleUnreadNotifications,
  handleToggleNotificationsSetting,
} from './notifications';
import { handleRealtimeWs } from './realtime';
import { handleLinkPreview, handleLinkPreviewImage, handleToggleLinkPreviews } from './linkPreview';
import {
  handleGetVapidKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
} from './push';
import {
  handleRegisterE2eeKeys,
  handleUploadPreKeys,
  handlePreKeyCount,
  handleGetKeyBundle,
  handleGetIdentities,
  handleUnregisterE2eeDevice,
  handleListE2eeDevices,
  handleCreateDeviceChallenge,
  handleApproveE2eeDevice,
  handleRevokeE2eeDevice,
  handleSignDeviceList,
  handleRecoverE2eeDevice,
} from './e2ee';
import {
  getChatPageData,
  canAccessDmMedia,
  handleGetConversations,
  handleStartConversation,
  handleGetMessages,
  handlePollMessages,
  handleSendMessage,
  handleMarkRead,
  handleMarkListened,
  handleDeleteMessage,
  handleDeleteConversation,
  handleToggleReaction,
  handleEditMessage,
  handleUnreadCount,
} from './messages';
import { sublistPage } from './pages/sublist';
import { editProfilePage } from './pages/editprofile';
import { publishPostPage } from './pages/publishpost';
import { subslistPage } from './pages/subslist';
import { feedPage } from './pages/feed';
import { explorePage } from './pages/explore';
import { userAcceptPage } from './pages/useraccept';
import { errorPage } from './pages/error';
import { ICON_SVG, getIconJpgBytes, getManifestJson, SW_JS } from './assets';
import { detectLanguage, getTranslations, normalizeLang } from './languages';
import {
  getPersonalizedFeed,
  getPersonalizedFeedPage,
  getPersonalizedExplore,
  getRelatedPosts,
  getRecommendedUsers,
  getSimilarAuthors,
  handleTelemetryBatch
} from './recommendations';
import { createPostgresClient } from './db/client';
import {
  consumeRateLimitAtomic,
  getClientIp,
  hasAdminPermission,
  parsePositiveId,
  readJsonWithLimit,
} from './security';

function safeDecode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

let cachedAppCss: string | null = null;

function getAppCssCached(): string {
  if (cachedAppCss === null) {
    cachedAppCss = getStyles();
  }
  return cachedAppCss;
}

function extractSpaFragmentHtml(fullHtml: string): string | null {
  const titleStart = fullHtml.indexOf('<title>');
  const titleEnd = titleStart !== -1 ? fullHtml.indexOf('</title>', titleStart) : -1;
  const styleStart = fullHtml.indexOf('<link id="appMainStyles"');
  const styleEnd = styleStart !== -1 ? fullHtml.indexOf('>', styleStart) : -1;
  const rootStart = fullHtml.indexOf('<div id="appPageRoot">');
  const shellMarker = '\n<div class="modal-backdrop app-alert-backdrop';
  const rootEnd = rootStart !== -1 ? fullHtml.indexOf(shellMarker, rootStart) : -1;
  const scriptStart = fullHtml.indexOf('<script type="text/plain" id="appPageScript"');
  const scriptEnd = scriptStart !== -1 ? fullHtml.indexOf('</script>', scriptStart) : -1;
  if (
    titleStart === -1 ||
    titleEnd === -1 ||
    styleStart === -1 ||
    styleEnd === -1 ||
    rootStart === -1 ||
    rootEnd === -1 ||
    scriptStart === -1 ||
    scriptEnd === -1
  ) {
    return null;
  }
  const titleTag = fullHtml.slice(titleStart, titleEnd + 8);
  const styleTag = fullHtml.slice(styleStart, styleEnd + 1);
  const rootHtml = fullHtml.slice(rootStart, rootEnd).trimEnd();
  const scriptTag = fullHtml.slice(scriptStart, scriptEnd + 9);
  return `<!DOCTYPE html><html><head>${titleTag}${styleTag}</head><body>${rootHtml}\n${scriptTag}</body></html>`;
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const activeEnv = env.DATABASE_URL
      ? { ...env, DB: createPostgresClient(env.DATABASE_URL) }
      : env;
    const url = new URL(request.url);
    const isMedia = url.pathname.startsWith('/media/');
    try {
      let response = await handleRequest(request, activeEnv, url, ctx);
      if (
        request.method === 'GET' &&
        request.headers.get('X-Requested-With') === 'photogram-spa' &&
        response.status === 200 &&
        (response.headers.get('Content-Type') || '').includes('text/html')
      ) {
        const fullText = await response.text();
        const frag = extractSpaFragmentHtml(fullText);
        const h = new Headers(response.headers);
        h.set('Vary', 'Cookie, X-Requested-With');
        response = new Response(frag || fullText, { status: response.status, headers: h });
      }
      return withSecurityHeaders(response, isMedia, url);
    } catch (err: any) {
      console.error(err);
      return withSecurityHeaders(new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }), isMedia, url);
    }
  },
};

function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function detectTimeZone(request: Request, cookieHeader: string): string {
  const m = /(?:^|;\s*)tz=([^;]+)/.exec(cookieHeader);
  if (m && m[1]) {
    try {
      const decoded = decodeURIComponent(m[1]).trim();
      if (isValidTimeZone(decoded)) return decoded;
    } catch {}
  }
  const cfTz = (request as Request & { cf?: { timezone?: unknown } }).cf?.timezone;
  if (typeof cfTz === 'string' && isValidTimeZone(cfTz.trim())) {
    return cfTz.trim();
  }
  return 'UTC';
}

async function handleRequest(request: Request, env: Env, url: URL, ctx?: ExecutionContext): Promise<Response> {
  const pathname = url.pathname;
  const method = request.method;
  const isHttps = url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(url.hostname);

  const cookieHeader = request.headers.get('Cookie') || '';
  const hasLangCookie = /(?:^|;\s*)lang=([a-zA-Z-]+)/.test(cookieHeader);
  const userLang = detectLanguage(request);
  const setLangCookie = !hasLangCookie ? userLang : undefined;
  const t = getTranslations(userLang);
  const userTheme = /(?:^|;\s*)theme=(dark|light)/.exec(cookieHeader)?.[1];
  const userTimeZone = detectTimeZone(request, cookieHeader);

    if (method === 'POST') {
      const origin = request.headers.get('Origin');
      const secFetchSite = request.headers.get('Sec-Fetch-Site');
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.host !== url.host) {
            return new Response('Forbidden: Cross-site request rejected', { status: 403 });
          }
        } catch {
          return new Response('Forbidden: Invalid origin', { status: 403 });
        }
      }
      if (secFetchSite === 'cross-site') {
        return new Response('Forbidden: Cross-site request rejected', { status: 403 });
      }
      if (!origin && !secFetchSite) {
        const referer = request.headers.get('Referer');
        if (referer) {
          try {
            const refUrl = new URL(referer);
            if (refUrl.host !== url.host) {
              return new Response('Forbidden: Cross-site request rejected', { status: 403 });
            }
          } catch {
            return new Response('Forbidden: Invalid referer', { status: 403 });
          }
        }
      }
    }

    if (pathname === '/app.css' && (method === 'GET' || method === 'HEAD')) {
      return new Response(method === 'HEAD' ? null : getAppCssCached(), {
        status: 200,
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': url.searchParams.has('v')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (pathname === '/icon.svg' || pathname === '/favicon.ico') {
      return new Response(ICON_SVG, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    if (pathname === '/icon.jpg') {
      return new Response(getIconJpgBytes(), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    if (pathname === '/manifest.webmanifest' || pathname === '/manifest.json') {
      return new Response(getManifestJson(userTheme), {
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate',
        },
      });
    }

    if (pathname === '/sw.js') {
      return new Response(SW_JS, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    if (pathname === '/e2ee.js' && method === 'GET' && env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes && assetRes.ok) {
        const headers = new Headers(assetRes.headers);
        headers.set('Content-Type', 'application/javascript; charset=utf-8');
        headers.set('X-License', 'GPL-3.0-only; source="https://github.com/itisislom/photogram/blob/main/src/client/e2ee.ts"');
        headers.set('Cache-Control', url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate');
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }
    }

    if (pathname === '/offline') {
      return html(errorPage(t, userTheme), setLangCookie, isHttps);
    }

    if (pathname === '/') {
      const user = await getUserFromRequest(env, request);
      return redirect(user ? '/feed' : '/login', request, setLangCookie);
    }

    if (pathname === '/login' && method === 'GET') {
      const addMode = url.searchParams.get('add') === '1';
      const user = await getUserFromRequest(env, request);
      if (user && !addMode) return redirect('/feed', request, setLangCookie);
      return html(loginPage(t, userTheme, Boolean(user && addMode)), setLangCookie, isHttps);
    }

    if (pathname === '/register' && method === 'GET') {
      const addMode = url.searchParams.get('add') === '1';
      const user = await getUserFromRequest(env, request);
      if (user && !addMode) return redirect('/feed', request, setLangCookie);
      return html(registerPage(t, userTheme, Boolean(user && addMode)), setLangCookie, isHttps);
    }

    if ((pathname === '/useraccept' || pathname === '/terms' || pathname === '/useraccept.ts') && method === 'GET') {
      return html(userAcceptPage(t, userTheme), setLangCookie, isHttps);
    }

    if (pathname === '/feed' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const feedData = await getPersonalizedFeed(env, user.id);
      return html(feedPage(feedData, user, t, userTheme, hasAdminPermission(user, env, 'posts.delete')), setLangCookie, isHttps);
    }

    if (pathname === '/explore' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const tagParam = url.searchParams.get('tag') || 'all';
      const exploreData = await getPersonalizedExplore(env, user.id, tagParam);
      return html(explorePage(exploreData, user, t, userTheme, hasAdminPermission(user, env, 'posts.delete')), setLangCookie, isHttps);
    }

    if (pathname === '/profile' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      return redirect(`/u/${encodeURIComponent(user.username)}`, request, setLangCookie);
    }

    if (pathname === '/settings' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      return html(settingsPage(user, t, userTheme), setLangCookie, isHttps);
    }

    if ((pathname === '/activity' || pathname === '/activity.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const summary = await getActivitySummary(env, user.id);
      const rawSec = (url.searchParams.get('section') || '').trim();
      const validSec: ActivitySection | null =
        rawSec === 'likes' ||
        rawSec === 'comment_likes' ||
        rawSec === 'comments' ||
        rawSec === 'follows' ||
        rawSec === 'posts' ||
        rawSec === 'history'
          ? rawSec
          : null;
      return html(activityPage(user, summary, validSec, t, userTheme), setLangCookie, isHttps);
    }

    if ((pathname === '/accountlist' || pathname === '/accountlist.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const { accounts, syncCookie } = await getSavedAccountsForPage(env, request, user);
      return html(accountListPage(accounts, t, userTheme), setLangCookie, isHttps, 200, syncCookie);
    }

    if ((pathname === '/messages' || pathname === '/messages.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const chatData = await getChatPageData(env, user, undefined, ctx);
      return html(messagesPage(chatData, user, t, userTheme, userTimeZone), setLangCookie, isHttps);
    }

    if ((pathname === '/notifications' || pathname === '/notifications.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const items = await getUserNotifications(env, user.id);
      await markAllNotificationsRead(env, user.id);
      return html(notificationsPage(items, user, t, userTheme), setLangCookie, isHttps);
    }

    if (pathname.startsWith('/messages/') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const decodedTarget = safeDecode(pathname.slice('/messages/'.length));
      if (decodedTarget === null) return new Response('Bad Request', { status: 400 });
      const targetUsername = decodedTarget.replace(/\/+$/, '').trim();
      if (!targetUsername) return redirect('/messages', request, setLangCookie);
      const chatData = await getChatPageData(env, user, targetUsername, ctx);
      if (chatData.notFound) return redirect('/messages', request, setLangCookie);
      return html(messagesPage(chatData, user, t, userTheme, userTimeZone), setLangCookie, isHttps);
    }

    if ((pathname === '/publishpost' || pathname === '/publishpost.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      return html(publishPostPage(user, t, userTheme), setLangCookie, isHttps);
    }

    if (pathname.startsWith('/u/') && method === 'GET') {
      const rest = pathname.slice(3);
      const sublistMatch = /^([^\/]+)\/sublist(?:\.ts)?$/i.exec(rest);
      if (sublistMatch) {
        const decodedSub = safeDecode(sublistMatch[1]);
        if (decodedSub === null) return new Response('Bad Request', { status: 400 });
        const sublistUsername = decodedSub.toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        const targetUser = await env.DB.prepare(
          'SELECT id, username, display_name, bio, avatar_key, is_verified, created_at FROM users WHERE username = ?',
        )
          .bind(sublistUsername)
          .first<User>();
        if (!targetUser) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        const [followers, followingUsers] = await Promise.all([
          getFollowersList(env, targetUser.id, currentUser?.id),
          getFollowingList(env, targetUser.id, currentUser?.id),
        ]);
        return html(sublistPage(targetUser, followers, followingUsers, currentUser, t, userTheme), setLangCookie, isHttps);
      }
      const subslistMatch = /^([^\/]+)\/subslist(?:\.ts)?$/i.exec(rest);
      if (subslistMatch) {
        const decodedSubs = safeDecode(subslistMatch[1]);
        if (decodedSubs === null) return new Response('Bad Request', { status: 400 });
        const subslistUsername = decodedSubs.toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        const targetUser = await env.DB.prepare(
          'SELECT id, username, display_name, bio, avatar_key, is_verified, created_at FROM users WHERE username = ?',
        )
          .bind(subslistUsername)
          .first<User>();
        if (!targetUser) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        const [subsFollowers, followingUsers] = await Promise.all([
          getFollowersList(env, targetUser.id, currentUser?.id),
          getFollowingList(env, targetUser.id, currentUser?.id),
        ]);
        return html(subslistPage(targetUser, subsFollowers, followingUsers, currentUser, t, userTheme), setLangCookie, isHttps);
      }

      const editprofileMatch = /^([^\/]+)\/editprofile(?:\.ts)?$/i.exec(rest);
      if (editprofileMatch) {
        const decodedEdit = safeDecode(editprofileMatch[1]);
        if (decodedEdit === null) return new Response('Bad Request', { status: 400 });
        const requestedUsername = decodedEdit.toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        if (!currentUser) {
          return redirect('/login', request, setLangCookie);
        }
        if (currentUser.username.toLowerCase() !== requestedUsername) {
          return redirect(`/u/${encodeURIComponent(currentUser.username)}/editprofile`, request, setLangCookie);
        }
        const profile = await getProfileData(env, currentUser.username, currentUser.id, false);
        if (!profile) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        return html(editProfilePage(profile, t, userTheme), setLangCookie, isHttps);
      }

      const decodedProfile = safeDecode(rest);
      if (decodedProfile === null) return new Response('Bad Request', { status: 400 });
      const targetUsername = decodedProfile.toLowerCase().trim();
      const currentUser = await getUserFromRequest(env, request);
      const profile = await getProfileData(env, targetUsername, currentUser?.id);
      if (!profile) {
        return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
      }
      profile.is_admin = hasAdminPermission(currentUser, env, 'posts.delete');
      return html(profilePage(profile, t, userTheme), setLangCookie, isHttps);
    }

    if (pathname.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
      const key = safeDecode(pathname.slice('/media/'.length));
      if (key === null) {
        return new Response('Bad Request', { status: 400 });
      }
      const isDmMedia = key.startsWith('dm/');
      if (
        !key ||
        key.includes('..') ||
        key.includes('\\') ||
        /[\x00-\x1f\x7f]/.test(key) ||
        (!key.startsWith('posts/') && !key.startsWith('avatars/') && !isDmMedia)
      ) {
        return new Response('Not Found', { status: 404 });
      }
      if (isDmMedia) {
        const user = await getUserFromRequest(env, request);
        if (!user) return new Response('Unauthorized', { status: 401 });
        const allowed = await canAccessDmMedia(env, user.id, key);
        if (!allowed) return new Response('Forbidden', { status: 403 });
      }

      const rawVariant = url.searchParams.get('v');
      const variant =
        !isDmMedia &&
        (rawVariant === 'thumb' || rawVariant === 'full') &&
        key.startsWith('posts/') &&
        key.endsWith('.webp') &&
        !key.endsWith('_thumb.webp') &&
        !key.endsWith('_full.webp')
          ? rawVariant
          : null;
      const resolvedKey = variant ? `${key.slice(0, -5)}_${variant}.webp` : key;
      const isDownload = url.searchParams.get('download') === '1' && key.startsWith('posts/');
      const ifNoneMatch = request.headers.get('If-None-Match');

      const edgeCache = !isDmMedia
        ? (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default || null
        : null;
      const edgeCacheUrl = `https://media-cache.photogram.internal/${encodeURIComponent(resolvedKey)}?dl=${isDownload ? '1' : '0'}`;

      if (edgeCache && method === 'GET') {
        try {
          const cachedRes = await edgeCache.match(edgeCacheUrl);
          if (cachedRes) {
            const cachedEtag = cachedRes.headers.get('etag');
            if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
              return new Response(null, { status: 304, headers: cachedRes.headers });
            }
            return cachedRes;
          }
        } catch {}
      }

      let object = await env.STORAGE.get(resolvedKey);
      if (!object && variant) {
        object = await env.STORAGE.get(key);
      }
      if (!object) return new Response('Not Found', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      if (object.httpEtag) {
        headers.set('etag', object.httpEtag);
      }
      if (isDmMedia) {
        headers.set('Cache-Control', 'private, no-store');
        headers.set('CDN-Cache-Control', 'private, no-store');
        headers.set('Vary', 'Cookie');
      } else {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
      }
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'");
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/octet-stream');
      }
      if (isDownload) {
        const ct = (headers.get('Content-Type') || '').toLowerCase();
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
        headers.set('Content-Disposition', `attachment; filename="photogram-photo.${ext}"`);
      }

      if (!isDmMedia && ifNoneMatch && object.httpEtag && ifNoneMatch === object.httpEtag) {
        return new Response(null, { status: 304, headers });
      }

      if (method === 'HEAD') {
        return new Response(null, { headers });
      }

      const response = new Response(object.body, { headers });
      if (edgeCache) {
        try {
          const putTask = edgeCache.put(edgeCacheUrl, response.clone()).catch(() => {});
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(putTask);
          } else {
            void putTask;
          }
        } catch {}
      }
      return response;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      return handleLogin(request, env);
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      return handleRegister(request, env);
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      return handleLogout(request, env);
    }

    if (pathname === '/api/auth/change-password' && method === 'POST') {
      return handleChangePassword(request, env);
    }

    if (pathname === '/api/auth/switch-account' && method === 'POST') {
      return handleSwitchAccount(request, env);
    }

    if (pathname === '/api/auth/remove-account' && method === 'POST') {
      return handleRemoveAccount(request, env);
    }

    if (pathname === '/api/profile/update' && method === 'POST') {
      return handleUpdateProfile(request, env);
    }

    if (pathname === '/api/profile/avatar' && method === 'POST') {
      return handleUploadAvatar(request, env);
    }

    if (pathname === '/api/posts/create' && method === 'POST') {
      return handleCreatePost(request, env);
    }

    if (pathname === '/api/posts/delete' && method === 'POST') {
      return handleDeletePost(request, env);
    }

    if (pathname === '/api/posts/like' && method === 'POST') {
      return handleToggleLike(request, env);
    }

    if (pathname === '/api/users/search' && method === 'GET') {
      return handleSearchUsers(request, env);
    }

    if (pathname === '/api/users/resolve-mentions' && method === 'POST') {
      return handleResolveMentions(request, env);
    }

    if ((pathname === '/api/profile/follow' || pathname === '/api/users/follow') && method === 'POST') {
      return handleToggleFollow(request, env);
    }

    if (pathname === '/api/telemetry' && method === 'POST') {
      const user = await getUserFromRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const parsed = await readJsonWithLimit<{ events?: unknown }>(request, 16384);
      if (!parsed.ok) {
        return new Response(JSON.stringify({ error: parsed.status === 413 ? 'Payload too large' : 'Bad request' }), {
          status: parsed.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = await handleTelemetryBatch(env, user.id, parsed.data?.events);
      return new Response(
        JSON.stringify(result.ok ? { success: true, accepted: result.accepted || 0 } : { error: result.error || 'Bad request' }),
        {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (pathname === '/api/recommendations/feed' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
      }
      const allowed = await consumeRateLimitAtomic(env, `feed:user:${user.id}`, 60, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
      }
      const cursor = url.searchParams.get('cursor') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const data = await getPersonalizedFeedPage(env, user.id, cursor, limit);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
      });
    }

    if (pathname === '/api/recommendations/explore' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
      }
      const allowed = await consumeRateLimitAtomic(env, `explore:user:${user.id}`, 60, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
        });
      }
      const tag = (url.searchParams.get('tag') || 'all').slice(0, 40);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const cursor = url.searchParams.get('cursor') || undefined;
      const data = await getPersonalizedExplore(env, user.id, tag, limit, cursor);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
      });
    }

    if (pathname === '/api/posts/related' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      const rlKey = user ? `related:u:${user.id}` : `related:ip:${getClientIp(request)}`;
      const allowed = await consumeRateLimitAtomic(env, rlKey, 40, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const postId = parsePositiveId(url.searchParams.get('post_id'));
      if (!postId) {
        return new Response(JSON.stringify({ posts: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const related = await getRelatedPosts(env, postId, user?.id || 0, 6);
      return new Response(JSON.stringify({ posts: related }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/api/recommendations/users' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const allowed = await consumeRateLimitAtomic(env, `recusers:u:${user.id}`, 40, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const users = await getRecommendedUsers(env, user.id, 8);
      return new Response(JSON.stringify({ users }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/api/authors/similar' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      const rlKey = user ? `similar:u:${user.id}` : `similar:ip:${getClientIp(request)}`;
      const allowed = await consumeRateLimitAtomic(env, rlKey, 40, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const authorId = parsePositiveId(url.searchParams.get('author_id'));
      if (!authorId) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const similar = await getSimilarAuthors(env, authorId, user?.id || 0, 6);
      return new Response(JSON.stringify({ users: similar }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/api/posts/comments' && method === 'GET') {
      return handleGetComments(request, env);
    }

    if (pathname === '/api/posts/comment' && method === 'POST') {
      return handleCreateComment(request, env);
    }

    if (pathname === '/api/posts/comment/delete' && method === 'POST') {
      return handleDeleteComment(request, env);
    }

    if (pathname === '/api/posts/comment/like' && method === 'POST') {
      return handleToggleCommentLike(request, env);
    }

    if (pathname === '/api/posts/comment/pin' && method === 'POST') {
      return handleToggleCommentPin(request, env);
    }

    if (pathname === '/api/realtime/ws' && method === 'GET') {
      return handleRealtimeWs(request, env, url);
    }

    if (pathname === '/api/messages/conversations' && method === 'GET') {
      return handleGetConversations(request, env, ctx);
    }

    if (pathname === '/api/messages/start' && method === 'POST') {
      return handleStartConversation(request, env);
    }

    if (pathname === '/api/messages/list' && method === 'GET') {
      return handleGetMessages(request, env, url, ctx);
    }

    if (pathname === '/api/messages/poll' && method === 'GET') {
      return handlePollMessages(request, env, url);
    }

    if (pathname === '/api/messages/send' && method === 'POST') {
      return handleSendMessage(request, env, ctx);
    }

    if (pathname === '/api/messages/read' && method === 'POST') {
      return handleMarkRead(request, env, ctx);
    }

    if (pathname === '/api/messages/listened' && method === 'POST') {
      return handleMarkListened(request, env, ctx);
    }

    if (pathname === '/api/messages/delete' && method === 'POST') {
      return handleDeleteMessage(request, env, ctx);
    }

    if (pathname === '/api/messages/conversation/delete' && method === 'POST') {
      return handleDeleteConversation(request, env, ctx);
    }

    if (pathname === '/api/messages/react' && method === 'POST') {
      return handleToggleReaction(request, env, ctx);
    }

    if (pathname === '/api/messages/edit' && method === 'POST') {
      return handleEditMessage(request, env, ctx);
    }

    if (pathname === '/api/messages/unread' && method === 'GET') {
      return handleUnreadCount(request, env);
    }

    if (pathname === '/api/messages/link-preview' && method === 'GET') {
      return handleLinkPreview(request, env, url);
    }

    if (pathname === '/api/messages/link-preview-img' && method === 'GET') {
      return handleLinkPreviewImage(request, env, url);
    }

    if (pathname === '/api/notifications/unread' && method === 'GET') {
      return handleUnreadNotifications(request, env);
    }

    if (pathname === '/api/settings/notifications' && method === 'POST') {
      return handleToggleNotificationsSetting(request, env);
    }

    if (pathname === '/api/settings/link-previews' && method === 'POST') {
      return handleToggleLinkPreviews(request, env);
    }

    if (pathname === '/api/activity' && method === 'GET') {
      return handleGetActivity(request, env, url);
    }

    if (pathname === '/api/activity/unlike' && method === 'POST') {
      return handleActivityUnlike(request, env);
    }

    if (pathname === '/api/activity/delete-comments' && method === 'POST') {
      return handleActivityDeleteComments(request, env);
    }

    if (pathname === '/api/push/vapid-key' && method === 'GET') {
      return handleGetVapidKey(env);
    }

    if (pathname === '/api/push/subscribe' && method === 'POST') {
      return handlePushSubscribe(request, env);
    }

    if (pathname === '/api/push/unsubscribe' && method === 'POST') {
      return handlePushUnsubscribe(request, env);
    }

    if (pathname === '/api/e2ee/keys/register' && method === 'POST') {
      return handleRegisterE2eeKeys(request, env);
    }

    if (pathname === '/api/e2ee/keys/prekeys' && method === 'POST') {
      return handleUploadPreKeys(request, env);
    }

    if (pathname === '/api/e2ee/keys/count' && method === 'GET') {
      return handlePreKeyCount(request, env, url);
    }

    if (pathname === '/api/e2ee/keys/bundle' && method === 'POST') {
      return handleGetKeyBundle(request, env);
    }

    if (pathname === '/api/e2ee/keys/identities' && method === 'GET') {
      return handleGetIdentities(request, env, url);
    }

    if (pathname === '/api/e2ee/keys/unregister' && method === 'POST') {
      return handleUnregisterE2eeDevice(request, env);
    }

    if (pathname === '/api/e2ee/devices' && method === 'GET') {
      return handleListE2eeDevices(request, env);
    }

    if (pathname === '/api/e2ee/devices/challenge' && method === 'POST') {
      return handleCreateDeviceChallenge(request, env);
    }

    if (pathname === '/api/e2ee/devices/approve' && method === 'POST') {
      return handleApproveE2eeDevice(request, env);
    }

    if (pathname === '/api/e2ee/devices/revoke' && method === 'POST') {
      return handleRevokeE2eeDevice(request, env);
    }

    if (pathname === '/api/e2ee/devices/sign-list' && method === 'POST') {
      return handleSignDeviceList(request, env);
    }

    if (pathname === '/api/e2ee/devices/recover' && method === 'POST') {
      return handleRecoverE2eeDevice(request, env);
    }

    if (pathname === '/api/lang' && method === 'POST') {
      const parsed = await readJsonWithLimit<{ lang?: string }>(request, 1024);
      if (!parsed.ok) {
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: parsed.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const valid = normalizeLang(parsed.data?.lang);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid language' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const langUser = await getUserFromRequest(env, request);
        if (langUser) {
          await env.DB.prepare('UPDATE push_subscriptions SET lang = ? WHERE user_id = ?')
            .bind(valid, langUser.id)
            .run();
        }
      } catch {}
      return new Response(JSON.stringify({ success: true, lang: valid }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `lang=${valid}; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? '; Secure' : ''}`,
        },
      });
    }

    return new Response('Not Found', { status: 404 });
}

function withSecurityHeaders(response: Response, isMedia = false, url?: URL): Response {
  if (response.status === 101 || Boolean((response as Response & { webSocket?: unknown }).webSocket)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

  if (isMedia) {
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  } else {
    const wsScheme = url && url.protocol === 'http:' ? 'ws:' : 'wss:';
    const wsOrigin = url ? ` ${wsScheme}//${url.host}` : '';
    headers.set(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'${wsOrigin}; frame-src 'self' https://www.youtube-nocookie.com; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function html(content: string, setLangCookie?: string, isHttps = true, status = 200, extraCookie?: string): Response {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  if (setLangCookie) {
    headers.append('Set-Cookie', `lang=${setLangCookie}; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? '; Secure' : ''}`);
  }
  if (extraCookie) {
    headers.append('Set-Cookie', extraCookie);
  }
  return new Response(content, { status, headers });
}

function redirect(path: string, request: Request, setLangCookie?: string): Response {
  const isHttps = new URL(request.url).protocol === 'https:' || !['localhost', '127.0.0.1'].includes(new URL(request.url).hostname);
  const headers = new Headers({ Location: new URL(path, request.url).toString() });
  if (setLangCookie) {
    headers.set('Set-Cookie', `lang=${setLangCookie}; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? '; Secure' : ''}`);
  }
  return new Response(null, { status: 302, headers });
}

