import { Env } from './types';
import { handleLogin, handleRegister, handleLogout, getUserFromRequest } from './auth';
import { getProfileData, handleUpdateProfile, handleUploadAvatar, getExploreData, handleSearchUsers, handleToggleFollow } from './profile';
import { handleCreatePost, handleDeletePost, handleToggleLike, getFeedPosts, handleGetComments, handleCreateComment, handleDeleteComment } from './posts';
import { loginPage } from './pages/login';
import { registerPage } from './pages/register';
import { profilePage } from './pages/profile';
import { feedPage } from './pages/feed';
import { explorePage } from './pages/explore';
import { userAcceptPage } from './pages/useraccept';
import { errorPage } from './pages/error';
import { ICON_SVG, getIconJpgBytes, MANIFEST_JSON, SW_JS } from './assets';
import { detectLanguage, getTranslations, normalizeLang } from './languages';
import {
  getPersonalizedFeed,
  getPersonalizedExplore,
  getRelatedPosts,
  getRecommendedUsers,
  getSimilarAuthors,
  handleTelemetryBatch,
  handleHidePost
} from './recommendations';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const cookieHeader = request.headers.get('Cookie') || '';
    const hasLangCookie = /(?:^|;\s*)lang=([a-zA-Z-]+)/.test(cookieHeader);
    const userLang = detectLanguage(request);
    const setLangCookie = !hasLangCookie ? userLang : undefined;
    const t = getTranslations(userLang);

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
      return new Response(MANIFEST_JSON, {
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
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

    if (pathname === '/offline') {
      return html(errorPage(t), setLangCookie);
    }

    if (pathname === '/') {
      const user = await getUserFromRequest(env, request);
      return redirect(user ? '/feed' : '/login', request, setLangCookie);
    }

    if (pathname === '/login' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (user) return redirect('/feed', request, setLangCookie);
      return html(loginPage(t), setLangCookie);
    }

    if (pathname === '/register' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (user) return redirect('/feed', request, setLangCookie);
      return html(registerPage(t), setLangCookie);
    }

    if ((pathname === '/useraccept' || pathname === '/terms' || pathname === '/useraccept.ts') && method === 'GET') {
      return html(userAcceptPage(t), setLangCookie);
    }

    if (pathname === '/feed' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const feedData = await getPersonalizedFeed(env, user.id);
      return html(feedPage(feedData, user, t), setLangCookie);
    }

    if (pathname === '/explore' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      const tagParam = url.searchParams.get('tag') || 'all';
      const exploreData = await getPersonalizedExplore(env, user.id, tagParam);
      return html(explorePage(exploreData, user, t), setLangCookie);
    }

    if (pathname === '/profile' && method === 'GET') {
      const user = await getUserFromRequest(env, request);
      if (!user) return redirect('/login', request, setLangCookie);
      return redirect(`/u/${encodeURIComponent(user.username)}`, request, setLangCookie);
    }

    if (pathname.startsWith('/u/') && method === 'GET') {
      const targetUsername = decodeURIComponent(pathname.slice(3)).toLowerCase().trim();
      const currentUser = await getUserFromRequest(env, request);
      const profile = await getProfileData(env, targetUsername, currentUser?.id);
      if (!profile) {
        return new Response(t.explore.noResults, { status: 404 });
      }
      return html(profilePage(profile, t), setLangCookie);
    }

    if (pathname.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
      const key = decodeURIComponent(pathname.slice('/media/'.length));
      if (!key || key.includes('..') || (!key.startsWith('posts/') && !key.startsWith('avatars/'))) {
        return new Response('Not Found', { status: 404 });
      }

      const object = await env.STORAGE.get(key);
      if (!object) return new Response('Not Found', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'");
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/octet-stream');
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
        const body = (await request.json()) as { events?: any[] };
        if (body && Array.isArray(body.events)) {
          await handleTelemetryBatch(env, user.id, body.events);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (pathname === '/api/posts/hide' && method === 'POST') {
      const user = await getUserFromRequest(env, request);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      try {
        const body = (await request.json()) as { post_id?: number };
        if (body && typeof body.post_id === 'number') {
          const ok = await handleHidePost(env, user.id, body.post_id);
          return new Response(JSON.stringify({ success: ok }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Invalid post_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
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
            'Set-Cookie': `lang=${valid}; Path=/; Max-Age=31536000; SameSite=Lax`,
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
  },
};

function html(content: string, setLangCookie?: string): Response {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'none'",
  });
  if (setLangCookie) {
    headers.set('Set-Cookie', `lang=${setLangCookie}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  return new Response(content, { headers });
}

function redirect(path: string, request: Request, setLangCookie?: string): Response {
  const headers = new Headers({ Location: new URL(path, request.url).toString() });
  if (setLangCookie) {
    headers.set('Set-Cookie', `lang=${setLangCookie}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  return new Response(null, { status: 302, headers });
}

