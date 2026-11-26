import { Env } from './types';
import { getSessionHashFromRequest, getUserFromRequest } from './auth';
import { consumeRateLimitAtomic, getClientIp } from './security';

function jsonRes(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function getUserHubStub(env: Env, userId: number): DurableObjectStub | null {
  if (!env.REALTIME_HUB || !Number.isInteger(userId) || userId <= 0) return null;
  try {
    return env.REALTIME_HUB.get(env.REALTIME_HUB.idFromName(`u:${userId}`));
  } catch {
    return null;
  }
}

export async function handleRealtimeWs(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (!env.REALTIME_HUB) {
    return jsonRes({ error: 'Realtime unavailable' }, 503);
  }

  const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
  if (upgrade !== 'websocket') {
    return jsonRes({ error: 'Upgrade required' }, 426);
  }

  const secFetchSite = request.headers.get('Sec-Fetch-Site');
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return jsonRes({ error: 'Forbidden' }, 403);
  }

  const origin = request.headers.get('Origin');
  if (!origin) {
    return jsonRes({ error: 'Forbidden' }, 403);
  }
  try {
    const originUrl = new URL(origin);
    if (originUrl.origin !== url.origin) {
      return jsonRes({ error: 'Forbidden' }, 403);
    }
  } catch {
    return jsonRes({ error: 'Forbidden' }, 403);
  }

  const user = await getUserFromRequest(env, request);
  if (!user) {
    return jsonRes({ error: 'Unauthorized' }, 401);
  }

  const sessionHash = await getSessionHashFromRequest(request);
  const sessionKey = sessionHash ? sessionHash.slice(0, 32) : '';
  if (!sessionKey) {
    return jsonRes({ error: 'Unauthorized' }, 401);
  }

  const [userAllowed, ipAllowed] = await Promise.all([
    consumeRateLimitAtomic(env, `ws:connect:user:${user.id}`, 60, 60),
    consumeRateLimitAtomic(env, `ws:connect:ip:${getClientIp(request)}`, 120, 60),
  ]);
  if (!userAllowed || !ipAllowed) {
    return jsonRes({ error: 'Too many requests' }, 429);
  }

  const stub = getUserHubStub(env, user.id);
  if (!stub) {
    return jsonRes({ error: 'Realtime unavailable' }, 503);
  }

  return stub.fetch(`https://hub/connect?user=${user.id}&session=${sessionKey}`, {
    method: 'GET',
    headers: { Upgrade: 'websocket' },
  });
}

export async function emitUserEvent(
  env: Env,
  userId: number,
  event: Record<string, unknown>,
  opts?: { excludeSession?: string; onlySession?: string },
): Promise<number> {
  const stub = getUserHubStub(env, userId);
  if (!stub) return -1;
  try {
    const res = await stub.fetch('https://hub/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        exclude_session: opts?.excludeSession || undefined,
        only_session: opts?.onlySession || undefined,
      }),
    });
    if (!res.ok) return -1;
    const data = (await res.json()) as { delivered_sockets?: unknown };
    return Number(data?.delivered_sockets || 0);
  } catch {
    return -1;
  }
}

export async function authorizeRealtimeConversation(
  env: Env,
  userId: number,
  convId: number,
  partnerUserId: number,
): Promise<void> {
  const stub = getUserHubStub(env, userId);
  if (!stub || !convId || !partnerUserId) return;
  try {
    await stub.fetch('https://hub/authorize-conv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: convId, partner_user_id: partnerUserId }),
    });
  } catch {}
}

export async function authorizeRealtimeConversations(
  env: Env,
  userId: number,
  items: Array<{ conv_id: number; partner_user_id: number }>,
): Promise<void> {
  const stub = getUserHubStub(env, userId);
  if (!stub || items.length === 0) return;
  try {
    await stub.fetch('https://hub/authorize-conv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.slice(0, 60) }),
    });
  } catch {}
}

export async function revokeRealtimeConversation(
  env: Env,
  userId: number,
  convId: number,
): Promise<void> {
  const stub = getUserHubStub(env, userId);
  if (!stub || !convId) return;
  try {
    await stub.fetch('https://hub/revoke-conv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conv_id: convId }),
    });
  } catch {}
}

export async function revokeUserRealtimeSessions(
  env: Env,
  userId: number,
  opts: { sessionKey?: string; all?: boolean; exceptSessionKey?: string; refreshSessionKey?: string },
): Promise<void> {
  const stub = getUserHubStub(env, userId);
  if (!stub) return;
  try {
    await stub.fetch('https://hub/revoke-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: opts.sessionKey || undefined,
        all: opts.all === true,
        except_session: opts.exceptSessionKey || undefined,
        refresh_session: opts.refreshSessionKey || undefined,
      }),
    });
  } catch {}
}
