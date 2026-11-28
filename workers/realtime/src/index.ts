export interface RealtimeEnv {
  REALTIME_HUB: DurableObjectNamespace;
}

interface SocketAttachment {
  userId: number;
  sessionKey: string;
  connectedAt: number;
}

interface SqlStorageLike {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
}

const MAX_SOCKETS_PER_USER = 12;
const MAX_INCOMING_FRAME_BYTES = 1024;
const MAX_ALLOWED_CONVS = 200;
const PRESENCE_BROADCAST_LIMIT = 80;
const TYPING_START_COOLDOWN_MS = 1500;
const TYPING_STOP_COOLDOWN_MS = 400;
const SESSION_KEY_RE = /^[a-f0-9]{16,64}$/;
const ALLOWED_TYPING_ACTIONS = new Set(['text', 'voice', 'photo']);

function parsePositiveInt(val: unknown): number {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function jsonRes(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class UserHub {
  private readonly ctx: DurableObjectState;
  private readonly env: RealtimeEnv;
  private schemaReady = false;
  private readonly convFallback = new Map<number, number>();
  private readonly typingRate = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: RealtimeEnv) {
    this.ctx = ctx;
    this.env = env;
    try {
      if (typeof this.ctx.setWebSocketAutoResponse === 'function' && typeof WebSocketRequestResponsePair !== 'undefined') {
        this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
      }
    } catch {}
  }

  private getSql(): SqlStorageLike | null {
    const storage = this.ctx.storage as DurableObjectStorage & { sql?: SqlStorageLike };
    return storage && storage.sql ? storage.sql : null;
  }

  private ensureSchema(): void {
    if (this.schemaReady) return;
    const sql = this.getSql();
    if (sql) {
      sql.exec(
        'CREATE TABLE IF NOT EXISTS allowed_convs (conv_id INTEGER PRIMARY KEY, partner_user_id INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
      );
    }
    this.schemaReady = true;
  }

  private saveAllowedConv(convId: number, partnerUserId: number): void {
    this.ensureSchema();
    const now = Date.now();
    this.convFallback.set(convId, partnerUserId);
    const sql = this.getSql();
    if (sql) {
      sql.exec(
        'INSERT OR REPLACE INTO allowed_convs (conv_id, partner_user_id, updated_at) VALUES (?, ?, ?)',
        convId,
        partnerUserId,
        now,
      );
      sql.exec(
        'DELETE FROM allowed_convs WHERE conv_id NOT IN (SELECT conv_id FROM allowed_convs ORDER BY updated_at DESC LIMIT ?)',
        MAX_ALLOWED_CONVS,
      );
    }
  }

  private removeAllowedConv(convId: number): void {
    this.ensureSchema();
    this.convFallback.delete(convId);
    const sql = this.getSql();
    if (sql) {
      sql.exec('DELETE FROM allowed_convs WHERE conv_id = ?', convId);
    }
  }

  private getPartnerForConv(convId: number): number {
    this.ensureSchema();
    const cached = this.convFallback.get(convId);
    if (cached && cached > 0) return cached;
    const sql = this.getSql();
    if (sql) {
      const rows = sql.exec('SELECT partner_user_id FROM allowed_convs WHERE conv_id = ? LIMIT 1', convId).toArray();
      if (rows.length > 0) {
        const pid = parsePositiveInt(rows[0].partner_user_id);
        if (pid > 0) {
          this.convFallback.set(convId, pid);
          return pid;
        }
      }
    }
    return 0;
  }

  private getAllowedPartnerIds(): number[] {
    this.ensureSchema();
    const ids = new Set<number>();
    const sql = this.getSql();
    if (sql) {
      const rows = sql
        .exec('SELECT DISTINCT partner_user_id FROM allowed_convs ORDER BY updated_at DESC LIMIT ?', PRESENCE_BROADCAST_LIMIT)
        .toArray();
      for (const row of rows) {
        const pid = parsePositiveInt(row.partner_user_id);
        if (pid > 0) ids.add(pid);
      }
    }
    for (const pid of this.convFallback.values()) {
      if (pid > 0 && ids.size < PRESENCE_BROADCAST_LIMIT) {
        ids.add(pid);
      }
    }
    return Array.from(ids);
  }

  private async broadcastPresence(userId: number, online: boolean): Promise<void> {
    if (!this.env.REALTIME_HUB || !userId) return;
    const partnerIds = this.getAllowedPartnerIds();
    if (partnerIds.length === 0) return;
    const now = Date.now();
    await Promise.all(
      partnerIds.map(async (partnerId) => {
        if (!partnerId || partnerId === userId) return;
        try {
          const stub = this.env.REALTIME_HUB.get(this.env.REALTIME_HUB.idFromName(`u:${partnerId}`));
          await stub.fetch('https://hub/emit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: {
                id: crypto.randomUUID(),
                type: 'presence.update',
                user_id: userId,
                online,
                ts: now,
              },
            }),
          });
        } catch {}
      }),
    );
  }

  private schedulePresence(userId: number, online: boolean): void {
    const task = this.broadcastPresence(userId, online);
    try {
      if (typeof this.ctx.waitUntil === 'function') {
        this.ctx.waitUntil(task);
        return;
      }
    } catch {}
    task.catch(() => {});
  }

  private getAttachment(ws: WebSocket): SocketAttachment | null {
    try {
      const raw = ws.deserializeAttachment() as Partial<SocketAttachment> | null;
      if (!raw || typeof raw !== 'object') return null;
      const userId = parsePositiveInt(raw.userId);
      const sessionKey = typeof raw.sessionKey === 'string' ? raw.sessionKey : '';
      if (!userId || !sessionKey) return null;
      return {
        userId,
        sessionKey,
        connectedAt: Number(raw.connectedAt || 0),
      };
    } catch {
      return null;
    }
  }

  private enforceSocketLimit(): void {
    const existing = this.ctx.getWebSockets();
    if (existing.length < MAX_SOCKETS_PER_USER) return;
    const sorted = existing
      .map((ws) => ({ ws, at: this.getAttachment(ws)?.connectedAt || 0 }))
      .sort((a, b) => a.at - b.at);
    const overflow = sorted.length - MAX_SOCKETS_PER_USER + 1;
    for (let i = 0; i < overflow; i++) {
      try {
        sorted[i].ws.close(4001, 'Too many connections');
      } catch {}
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/connect' && request.method === 'GET') {
      const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
      if (upgrade !== 'websocket') {
        return jsonRes({ error: 'Upgrade required' }, 426);
      }
      const userId = parsePositiveInt(url.searchParams.get('user'));
      const sessionKey = (url.searchParams.get('session') || '').trim();
      if (!userId || !SESSION_KEY_RE.test(sessionKey)) {
        return jsonRes({ error: 'Unauthorized' }, 401);
      }

      const wasOffline = this.ctx.getWebSockets().length === 0;
      this.enforceSocketLimit();

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server, [`u:${userId}`, `s:${sessionKey}`]);
      server.serializeAttachment({
        userId,
        sessionKey,
        connectedAt: Date.now(),
      } satisfies SocketAttachment);

      if (wasOffline) {
        this.schedulePresence(userId, true);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (pathname === '/emit' && request.method === 'POST') {
      let body: {
        event?: Record<string, unknown>;
        exclude_session?: unknown;
        only_session?: unknown;
      };
      try {
        body = (await request.json()) as {
          event?: Record<string, unknown>;
          exclude_session?: unknown;
          only_session?: unknown;
        };
      } catch {
        return jsonRes({ error: 'Bad request' }, 400);
      }
      if (!body || !body.event || typeof body.event !== 'object' || typeof body.event.type !== 'string') {
        return jsonRes({ error: 'Invalid event' }, 400);
      }
      const eventPayload: Record<string, unknown> = {
        ...body.event,
        id: typeof body.event.id === 'string' && body.event.id ? body.event.id : crypto.randomUUID(),
        ts: typeof body.event.ts === 'number' ? body.event.ts : Date.now(),
      };
      const serialized = JSON.stringify(eventPayload);
      const excludeSession = typeof body.exclude_session === 'string' ? body.exclude_session : '';
      const onlySession = typeof body.only_session === 'string' && SESSION_KEY_RE.test(body.only_session)
        ? body.only_session
        : '';

      const sockets = onlySession
        ? this.ctx.getWebSockets(`s:${onlySession}`)
        : this.ctx.getWebSockets();

      let delivered = 0;
      for (const ws of sockets) {
        if (excludeSession) {
          const att = this.getAttachment(ws);
          if (att && att.sessionKey === excludeSession) continue;
        }
        try {
          ws.send(serialized);
          delivered += 1;
        } catch {
          try {
            ws.close(1011, 'Send failed');
          } catch {}
        }
      }
      return jsonRes({ ok: true, delivered_sockets: delivered }, 200);
    }

    if (pathname === '/authorize-conv' && request.method === 'POST') {
      let body: { conv_id?: unknown; partner_user_id?: unknown; items?: Array<{ conv_id?: unknown; partner_user_id?: unknown }> };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return jsonRes({ error: 'Bad request' }, 400);
      }
      if (Array.isArray(body?.items)) {
        let saved = 0;
        for (const item of body.items.slice(0, 60)) {
          const cid = parsePositiveInt(item?.conv_id);
          const pid = parsePositiveInt(item?.partner_user_id);
          if (cid && pid) {
            this.saveAllowedConv(cid, pid);
            saved += 1;
          }
        }
        return jsonRes({ ok: true, saved }, 200);
      }
      const convId = parsePositiveInt(body?.conv_id);
      const partnerUserId = parsePositiveInt(body?.partner_user_id);
      if (!convId || !partnerUserId) {
        return jsonRes({ error: 'Invalid conversation' }, 400);
      }
      this.saveAllowedConv(convId, partnerUserId);
      return jsonRes({ ok: true }, 200);
    }

    if (pathname === '/revoke-conv' && request.method === 'POST') {
      let body: { conv_id?: unknown };
      try {
        body = (await request.json()) as { conv_id?: unknown };
      } catch {
        return jsonRes({ error: 'Bad request' }, 400);
      }
      const convId = parsePositiveInt(body?.conv_id);
      if (!convId) return jsonRes({ error: 'Invalid conversation' }, 400);
      this.removeAllowedConv(convId);
      return jsonRes({ ok: true }, 200);
    }

    if (pathname === '/revoke-session' && request.method === 'POST') {
      let body: { session?: unknown; all?: unknown; except_session?: unknown; refresh_session?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return jsonRes({ error: 'Bad request' }, 400);
      }
      const revokeAll = body?.all === true;
      const targetSession = typeof body?.session === 'string' && SESSION_KEY_RE.test(body.session)
        ? body.session
        : '';
      const exceptSession = typeof body?.except_session === 'string' ? body.except_session : '';
      const refreshSession = typeof body?.refresh_session === 'string' && SESSION_KEY_RE.test(body.refresh_session)
        ? body.refresh_session
        : '';

      if (!revokeAll && !targetSession) {
        return jsonRes({ error: 'Missing session' }, 400);
      }

      const sockets = revokeAll
        ? this.ctx.getWebSockets()
        : this.ctx.getWebSockets(`s:${targetSession}`);

      const notice = JSON.stringify({
        id: crypto.randomUUID(),
        type: 'session.revoked',
        ts: Date.now(),
      });

      let closed = 0;
      for (const ws of sockets) {
        const att = this.getAttachment(ws);
        if (refreshSession && att && att.sessionKey === refreshSession) {
          try {
            ws.close(4004, 'Session refreshed');
          } catch {}
          closed += 1;
          continue;
        }
        if (exceptSession && att && att.sessionKey === exceptSession) continue;
        try {
          ws.send(notice);
        } catch {}
        try {
          ws.close(4003, 'Session revoked');
        } catch {}
        closed += 1;
      }
      return jsonRes({ ok: true, closed }, 200);
    }

    if (pathname === '/presence' && request.method === 'GET') {
      const count = this.ctx.getWebSockets().length;
      return jsonRes({ online: count > 0, sockets: count }, 200);
    }

    return jsonRes({ error: 'Not Found' }, 404);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    if (message.length === 0 || message.length > MAX_INCOMING_FRAME_BYTES) return;
    if (message === 'ping') {
      try {
        ws.send('pong');
      } catch {}
      return;
    }

    let parsed: { type?: unknown; conversation_id?: unknown; action?: unknown };
    try {
      parsed = JSON.parse(message) as { type?: unknown; conversation_id?: unknown; action?: unknown };
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    const evType = parsed.type;
    if (evType !== 'typing.start' && evType !== 'typing.stop') return;

    const rawAction = typeof parsed.action === 'string' ? parsed.action.trim().toLowerCase() : 'text';
    const action = ALLOWED_TYPING_ACTIONS.has(rawAction) ? rawAction : 'text';

    const convId = parsePositiveInt(parsed.conversation_id);
    if (!convId) return;

    const att = this.getAttachment(ws);
    if (!att || !att.userId) return;

    const partnerUserId = this.getPartnerForConv(convId);
    if (!partnerUserId || partnerUserId === att.userId) return;

    const now = Date.now();
    const rateKey = evType === 'typing.start' ? `${convId}:${evType}:${action}` : `${convId}:${evType}`;
    const lastSent = this.typingRate.get(rateKey) || 0;
    const minInterval = evType === 'typing.start' ? TYPING_START_COOLDOWN_MS : TYPING_STOP_COOLDOWN_MS;
    if (now - lastSent < minInterval) return;
    this.typingRate.set(rateKey, now);
    if (this.typingRate.size > 128) {
      for (const [k, ts] of this.typingRate.entries()) {
        if (now - ts > 15000) this.typingRate.delete(k);
      }
    }

    if (!this.env.REALTIME_HUB) return;
    try {
      const partnerStub = this.env.REALTIME_HUB.get(
        this.env.REALTIME_HUB.idFromName(`u:${partnerUserId}`),
      );
      await partnerStub.fetch('https://hub/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            id: crypto.randomUUID(),
            type: evType,
            action,
            conversation_id: convId,
            user_id: att.userId,
            ts: now,
          },
        }),
      });
    } catch {}
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    const att = this.getAttachment(ws);
    try {
      ws.close(code, reason);
    } catch {}
    if (att && att.userId) {
      const remaining = this.ctx.getWebSockets().filter((s) => s !== ws).length;
      if (remaining === 0) {
        this.schedulePresence(att.userId, false);
      }
    }
  }

  webSocketError(ws: WebSocket): void {
    const att = this.getAttachment(ws);
    try {
      ws.close(1011, 'Error');
    } catch {}
    if (att && att.userId) {
      const remaining = this.ctx.getWebSockets().filter((s) => s !== ws).length;
      if (remaining === 0) {
        this.schedulePresence(att.userId, false);
      }
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('Not Found', { status: 404 });
  },
};
