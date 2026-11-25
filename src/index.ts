import { Env, User } from './types';
import { handleLogin, handleRegister, handleLogout, handleChangePassword, handleSwitchAccount, handleRemoveAccount, getUserFromRequest, getSavedAccountsForPage } from './auth';
import { getProfileData, handleUpdateProfile, handleUploadAvatar, getExploreData, handleSearchUsers, handleToggleFollow, getFollowersList, getFollowingList } from './profile';
import { handleCreatePost, handleDeletePost, handleToggleLike, getFeedPosts, handleGetComments, handleCreateComment, handleDeleteComment } from './posts';
import { loginPage } from './pages/login';
import { registerPage } from './pages/register';
import { profilePage, userNotFoundPage } from './pages/profile';
import { settingsPage } from './pages/settings';
import { accountListPage } from './pages/accountlist';
import { messagesPage } from './pages/messages';
import { notificationsPage } from './pages/notifications';
import {
  getUserNotifications,
  markAllNotificationsRead,
  handleUnreadNotifications,
  handleToggleNotificationsSetting,
} from './notifications';
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
  handleDeleteMessage,
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
  getPersonalizedExplore,
  getRelatedPosts,
  getRecommendedUsers,
  getSimilarAuthors,
  handleTelemetryBatch
} from './recommendations';
import { createPostgresClient } from './db/client';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const activeEnv = env.DATABASE_URL
      ? { ...env, DB: createPostgresClient(env.DATABASE_URL) }
      : env;
    const url = new URL(request.url);
    const isMedia = url.pathname.startsWith('/media/');
    try {
      const response = await handleRequest(request, activeEnv, url);
      return withSecurityHeaders(response, isMedia);
    } catch (err: any) {
      console.error(err);
      return withSecurityHeaders(new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }), isMedia);
    }
  },
};

async function handleRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const pathname = url.pathname;
  const method = request.method;
  const isHttps = url.protocol === 'https:' || !['localhost', '127.0.0.1'].includes(url.hostname);

  const cookieHeader = request.headers.get('Cookie') || '';
  const hasLangCookie = /(?:^|;\s*)lang=([a-zA-Z-]+)/.test(cookieHeader);
  const userLang = detectLanguage(request);
  const setLangCookie = !hasLangCookie ? userLang : undefined;
  const t = getTranslations(userLang);
  const userTheme = /(?:^|;\s*)theme=(dark|light)/.exec(cookieHeader)?.[1];

    if (method === 'POST') {
      const origin = request.headers.get('Origin');
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
      const secFetchSite = request.headers.get('Sec-Fetch-Site');
      if (secFetchSite === 'cross-site') {
        return new Response('Forbidden: Cross-site request rejected', { status: 403 });
      }
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
      return html(feedPage(feedData, user, t, userTheme), setLangCookie, isHttps);
    }

    if (pathname === '/explore' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const tagParam = url.searchParams.get('tag') || 'all';
      const exploreData = await getPersonalizedExplore(env, user.id, tagParam);
      return html(explorePage(exploreData, user, t, userTheme), setLangCookie, isHttps);
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

    if ((pathname === '/accountlist' || pathname === '/accountlist.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const { accounts, syncCookie } = await getSavedAccountsForPage(env, request, user);
      return html(accountListPage(accounts, t, userTheme), setLangCookie, isHttps, 200, syncCookie);
    }

    if ((pathname === '/messages' || pathname === '/messages.ts') && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const chatData = await getChatPageData(env, user);
      return html(messagesPage(chatData, user, t, userTheme), setLangCookie, isHttps);
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
      const targetUsername = decodeURIComponent(pathname.slice('/messages/'.length)).replace(/\/+$/, '').trim();
      if (!targetUsername) return redirect('/messages', request, setLangCookie);
      const chatData = await getChatPageData(env, user, targetUsername);
      if (chatData.notFound) return redirect('/messages', request, setLangCookie);
      return html(messagesPage(chatData, user, t, userTheme), setLangCookie, isHttps);
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
        const sublistUsername = decodeURIComponent(sublistMatch[1]).toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        const targetUser = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
          .bind(sublistUsername)
          .first<User>();
        if (!targetUser) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        const followers = await getFollowersList(env, targetUser.id, currentUser?.id);
        return html(sublistPage(targetUser, followers, currentUser, t, userTheme), setLangCookie, isHttps);
      }
      const subslistMatch = /^([^\/]+)\/subslist(?:\.ts)?$/i.exec(rest);
      if (subslistMatch) {
        const subslistUsername = decodeURIComponent(subslistMatch[1]).toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        const targetUser = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
          .bind(subslistUsername)
          .first<User>();
        if (!targetUser) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        const followingUsers = await getFollowingList(env, targetUser.id, currentUser?.id);
        return html(subslistPage(targetUser, followingUsers, currentUser, t, userTheme), setLangCookie, isHttps);
      }

      const editprofileMatch = /^([^\/]+)\/editprofile(?:\.ts)?$/i.exec(rest);
      if (editprofileMatch) {
        const requestedUsername = decodeURIComponent(editprofileMatch[1]).toLowerCase().trim();
        const currentUser = await getUserFromRequest(env, request);
        if (!currentUser) {
          return redirect('/login', request, setLangCookie);
        }
        if (currentUser.username.toLowerCase() !== requestedUsername) {
          return redirect(`/u/${encodeURIComponent(currentUser.username)}/editprofile`, request, setLangCookie);
        }
        const profile = await getProfileData(env, currentUser.username, currentUser.id);
        if (!profile) {
          return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
        }
        return html(editProfilePage(profile, t, userTheme), setLangCookie, isHttps);
      }

      const targetUsername = decodeURIComponent(rest).toLowerCase().trim();
      const currentUser = await getUserFromRequest(env, request);
      const profile = await getProfileData(env, targetUsername, currentUser?.id);
      if (!profile) {
        return html(userNotFoundPage(t, userTheme), setLangCookie, isHttps, 404);
      }
      return html(profilePage(profile, t, userTheme), setLangCookie, isHttps);
    }

    if (pathname.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
      const key = decodeURIComponent(pathname.slice('/media/'.length));
      const isDmMedia = key.startsWith('dm/');
      if (!key || key.includes('..') || (!key.startsWith('posts/') && !key.startsWith('avatars/') && !isDmMedia)) {
        return new Response('Not Found', { status: 404 });
      }
      if (isDmMedia) {
        const user = await getUserFromRequest(env, request);
        if (!user) return new Response('Unauthorized', { status: 401 });
        const allowed = await canAccessDmMedia(env, user.id, key);
        if (!allowed) return new Response('Forbidden', { status: 403 });
      }

      const object = await env.STORAGE.get(key);
      if (!object) return new Response('Not Found', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', isDmMedia ? 'private, max-age=3600' : 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'");
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/octet-stream');
      }
      if (url.searchParams.get('download') === '1' && key.startsWith('posts/')) {
        const ct = (headers.get('Content-Type') || '').toLowerCase();
        const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg';
        headers.set('Content-Disposition', `attachment; filename="photogram-photo.${ext}"`);
      }

      return new Response(object.body, { headers });
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
      try {
        const body = (await request.json()) as { events?: unknown };
        const result = await handleTelemetryBatch(env, user.id, body?.events);
        return new Response(
          JSON.stringify(result.ok ? { success: true, accepted: result.accepted || 0 } : { error: result.error || 'Bad request' }),
          {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch {
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (pathname === '/api/recommendations/explore' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      const tag = url.searchParams.get('tag') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '36', 10);
      const data = await getPersonalizedExplore(env, user?.id || 0, tag, limit);
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/api/posts/related' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      const postId = parseInt(url.searchParams.get('post_id') || '0', 10);
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
        return new Response(JSON.stringify({ users: [] }), {
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
      const authorId = parseInt(url.searchParams.get('author_id') || '0', 10);
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

    if (pathname === '/api/messages/conversations' && method === 'GET') {
      return handleGetConversations(request, env);
    }

    if (pathname === '/api/messages/start' && method === 'POST') {
      return handleStartConversation(request, env);
    }

    if (pathname === '/api/messages/list' && method === 'GET') {
      return handleGetMessages(request, env, url);
    }

    if (pathname === '/api/messages/poll' && method === 'GET') {
      return handlePollMessages(request, env, url);
    }

    if (pathname === '/api/messages/send' && method === 'POST') {
      return handleSendMessage(request, env);
    }

    if (pathname === '/api/messages/read' && method === 'POST') {
      return handleMarkRead(request, env);
    }

    if (pathname === '/api/messages/delete' && method === 'POST') {
      return handleDeleteMessage(request, env);
    }

    if (pathname === '/api/messages/unread' && method === 'GET') {
      return handleUnreadCount(request, env);
    }

    if (pathname === '/api/notifications/unread' && method === 'GET') {
      return handleUnreadNotifications(request, env);
    }

    if (pathname === '/api/settings/notifications' && method === 'POST') {
      return handleToggleNotificationsSetting(request, env);
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

    if (pathname === '/api/e2ee/keys/bundle' && method === 'GET') {
      return handleGetKeyBundle(request, env, url);
    }

    if (pathname === '/api/e2ee/keys/identities' && method === 'GET') {
      return handleGetIdentities(request, env, url);
    }



    if (pathname === '/api/lang' && method === 'POST') {
      try {
        const body = (await request.json()) as { lang?: string };
        const valid = normalizeLang(body?.lang);
        if (!valid) {
          return new Response(JSON.stringify({ error: 'Invalid language' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, lang: valid }), {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `lang=${valid}; Path=/; Max-Age=31536000; SameSite=Lax${isHttps ? '; Secure' : ''}`,
          },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
}

function withSecurityHeaders(response: Response, isMedia = false): Response {
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  if (isMedia) {
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  } else {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
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

