import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const workerMod = await import(new URL('../dist/_worker.js', import.meta.url).href);
const worker = workerMod.default;

if (typeof crypto.subtle.timingSafeEqual !== 'function') {
  crypto.subtle.timingSafeEqual = (a, b) => {
    const ua = a instanceof Uint8Array ? a : new Uint8Array(a);
    const ub = b instanceof Uint8Array ? b : new Uint8Array(b);
    return ua.byteLength === ub.byteLength && nodeCrypto.timingSafeEqual(ua, ub);
  };
}

const browserBundleCode = fs.readFileSync(path.join(root, 'dist/e2ee.js'), 'utf8');
const runBrowserBundle = new Function(
  'window',
  'self',
  'process',
  '__dirname',
  '__filename',
  'module',
  'exports',
  'require',
  browserBundleCode,
);
const fakeWindow = {
  crypto: globalThis.crypto,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
  atob: globalThis.atob,
  btoa: globalThis.btoa,
  Blob: globalThis.Blob,
  URL: globalThis.URL,
  CompressionStream: globalThis.CompressionStream,
  DecompressionStream: globalThis.DecompressionStream,
  Response: globalThis.Response,
  ReadableStream: globalThis.ReadableStream,
  console: globalThis.console,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  fetch: globalThis.fetch,
};
fakeWindow.window = fakeWindow;
fakeWindow.self = fakeWindow;
runBrowserBundle(fakeWindow, fakeWindow, undefined, undefined, undefined, undefined, undefined, undefined);
const { E2eeClient, generateRecoveryKey, parseRecoveryKey } = fakeWindow.PhotogramE2EE || globalThis.PhotogramE2EE;

const sqlite = new DatabaseSync(':memory:');
const schemaSql = fs.readFileSync(path.join(root, 'src/db/schema.sql'), 'utf8');
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec(schemaSql);

const realtimeEvents = [];
const r2Store = new Map();
const metrics = {
  sqlQueries: 0,
  sqlBatchOps: 0,
  r2Put: 0,
  r2Get: 0,
  r2Delete: 0,
  r2PutBytes: 0,
  r2GetBytes: 0,
};

function resetMetrics() {
  metrics.sqlQueries = 0;
  metrics.sqlBatchOps = 0;
  metrics.r2Put = 0;
  metrics.r2Get = 0;
  metrics.r2Delete = 0;
  metrics.r2PutBytes = 0;
  metrics.r2GetBytes = 0;
}

function snapMetrics() {
  return { ...metrics };
}

let failNextCommitBatch = 0;

function makeSqliteDbAdapter(db) {
  return {
    prepare(rawSql) {
      return {
        sql: rawSql,
        params: [],
        bind(...p) {
          this.params = p;
          return this;
        },
        async first() {
          metrics.sqlQueries++;
          const stmt = db.prepare(rawSql);
          const row = stmt.get(...this.params);
          return row === undefined ? null : { ...row };
        },
        async all() {
          metrics.sqlQueries++;
          const stmt = db.prepare(rawSql);
          const rows = stmt.all(...this.params).map((r) => ({ ...r }));
          return { results: rows };
        },
        async run() {
          metrics.sqlQueries++;
          const stmt = db.prepare(rawSql);
          const info = stmt.run(...this.params);
          return { meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } };
        },
      };
    },
    async batch(queries) {
      if (failNextCommitBatch > 0 && queries.some((q) => /e2ee_backups/i.test(q.sql))) {
        failNextCommitBatch--;
        throw new Error('Simulated DB commit failure');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = [];
        for (const q of queries) {
          metrics.sqlQueries++;
          metrics.sqlBatchOps++;
          const rawSql = q.sql;
          const params = q.params || [];
          const stmt = db.prepare(rawSql);
          if (/\bRETURNING\b/i.test(rawSql)) {
            const rows = stmt.all(...params).map((r) => ({ ...r }));
            out.push(rows);
          } else {
            const info = stmt.run(...params);
            out.push({ meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } });
          }
        }
        db.exec('COMMIT');
        return out;
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        throw err;
      }
    },
  };
}

const env = {
  DB: makeSqliteDbAdapter(sqlite),
  STORAGE: {
    async put(key, val) {
      const buf =
        val instanceof Uint8Array
          ? new Uint8Array(val)
          : ArrayBuffer.isView(val)
            ? new Uint8Array(val.buffer, val.byteOffset, val.byteLength)
            : val instanceof ArrayBuffer
              ? new Uint8Array(val)
              : new Uint8Array(await val.arrayBuffer());
      metrics.r2Put++;
      metrics.r2PutBytes += buf.byteLength;
      r2Store.set(key, buf);
    },
    async get(key) {
      metrics.r2Get++;
      const data = r2Store.get(key);
      if (!data) return null;
      metrics.r2GetBytes += data.byteLength;
      return {
        arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        body: data,
        httpMetadata: { contentType: 'application/octet-stream' },
        writeHttpMetadata(h) {
          h.set('Content-Type', 'application/octet-stream');
        },
        httpEtag: '"mock-etag"',
        size: data.byteLength,
      };
    },
    async delete(key) {
      metrics.r2Delete++;
      r2Store.delete(key);
    },
  },
  REALTIME_HUB: {
    idFromName(name) {
      return name;
    },
    get(id) {
      return {
        async fetch(url, init) {
          const body = init && init.body ? JSON.parse(init.body) : {};
          if (url.includes('/emit')) {
            realtimeEvents.push({ hub: id, ...body });
          }
          return new Response(JSON.stringify({ ok: true, delivered_sockets: 1 }), { status: 200 });
        },
      };
    },
  },
};

const base = 'https://photogramapp.pages.dev';

async function registerUser(username, displayName, password) {
  const fd = new FormData();
  fd.append('username', username);
  fd.append('display_name', displayName);
  fd.append('password', password);
  fd.append('terms', '1');
  const res = await worker.fetch(new Request(`${base}/api/auth/register`, { method: 'POST', body: fd }), env);
  assert.ok(res.status === 200 || res.status === 201, `Register failed for ${username}: ${res.status}`);
  const cookie = res.headers.get('Set-Cookie') || '';
  const m = /session=([^;]+)/.exec(cookie);
  assert.ok(m);
  const row = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return { userId: Number(row.id), token: m[1] };
}

async function loginUser(username, password) {
  const fd = new FormData();
  fd.append('login', username);
  fd.append('password', password);
  const res = await worker.fetch(new Request(`${base}/api/auth/login`, { method: 'POST', body: fd }), env);
  assert.strictEqual(res.status, 200);
  const cookie = res.headers.get('Set-Cookie') || '';
  const m = /session=([^;]+)/.exec(cookie);
  assert.ok(m);
  return m[1];
}

function makeWorkerFetch(token, interceptor) {
  return async (input, init = {}) => {
    const url = input.startsWith('http') ? input : `${base}${input}`;
    if (interceptor) {
      const intercepted = await interceptor(url, init);
      if (intercepted) return intercepted;
    }
    const headers = new Headers(init.headers || {});
    headers.set('Cookie', `session=${token}; lang=ru`);
    const res = await worker.fetch(
      new Request(url, {
        method: init.method || 'GET',
        headers,
        body: init.body,
      }),
      env,
    );
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      json: async () => res.json(),
      arrayBuffer: async () => res.arrayBuffer(),
    };
  };
}

function createMemoryBackend() {
  const stores = new Map();
  const ensure = (n) => {
    if (!stores.has(n)) stores.set(n, new Map());
    return stores.get(n);
  };
  return {
    async get(s, k) {
      const m = ensure(s);
      return m.has(k) ? m.get(k) : undefined;
    },
    async put(s, k, v) {
      ensure(s).set(k, v);
    },
    async del(s, k) {
      ensure(s).delete(k);
    },
    async getAllKeys(s) {
      return Array.from(ensure(s).keys());
    },
    async getAllEntries(s) {
      return Array.from(ensure(s).entries());
    },
    async clearAll() {
      stores.clear();
    },
    async close() {},
  };
}

const clientsToClose = [];

try {
  const pgSchema = fs.readFileSync(path.join(root, 'src/db/schema.postgres.sql'), 'utf8');
  const bkMig = fs.readFileSync(path.join(root, 'src/db/migrations/2026-11-27_encrypted_backup_transfer.sql'), 'utf8');
  for (const required of [
    'link_previews_enabled',
    'listened_at',
    'e2ee_device_challenges',
    'e2ee_device_lists',
    'e2ee_backups',
    'e2ee_backup_chunks',
    'e2ee_device_transfers',
    'idx_e2ee_devices_one_primary',
    'idx_e2ee_backup_chunks_user_epoch',
    'idx_e2ee_transfers_user_status',
  ]) {
    assert.ok(pgSchema.includes(required), `schema.postgres.sql missing ${required}`);
  }
  assert.ok(!/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i.test(bkMig));
  assert.ok(bkMig.includes('CREATE TABLE IF NOT EXISTS e2ee_backups'));
  assert.ok(bkMig.includes('CREATE TABLE IF NOT EXISTS e2ee_backup_chunks'));
  assert.ok(bkMig.includes('CREATE TABLE IF NOT EXISTS e2ee_device_transfers'));

  const backupSrc = fs.readFileSync(path.join(root, 'src/backup.ts'), 'utf8');
  const clientTs = fs.readFileSync(path.join(root, 'src/db/client.ts'), 'utf8');
  const toPgMatch = clientTs.match(/export function toPostgresSql\(rawSql: string\): string \{([\s\S]*?)\n\}/);
  assert.ok(toPgMatch);
  const toPostgresSql = new Function('rawSql', toPgMatch[1]);

  const sqlLiterals = [];
  const prepBacktickRe = /\.prepare\(\s*`([\s\S]*?)`,?\s*\)/g;
  const prepSingleRe = /\.prepare\(\s*'([^']+)',?\s*\)/g;
  let m;
  while ((m = prepBacktickRe.exec(backupSrc)) !== null) sqlLiterals.push(m[1]);
  while ((m = prepSingleRe.exec(backupSrc)) !== null) sqlLiterals.push(m[1]);
  assert.ok(sqlLiterals.length >= 20, `Expected >=20 SQL queries in src/backup.ts, got ${sqlLiterals.length}`);
  for (const rawSql of sqlLiterals) {
    const pg = toPostgresSql(rawSql);
    assert.ok(!/strftime|AUTOINCREMENT|INSERT\s+OR\s+REPLACE/i.test(pg), `SQLite-only syntax in Postgres SQL: ${pg}`);
    const stripped = pg.replace(/'[^']*'/g, '');
    assert.ok(!stripped.includes('?'), `Untranslated ? placeholder in Postgres SQL: ${pg}`);
  }
  console.log('1. PostgreSQL schema sync, non-destructive migration & SQL translation parity PASSED');

  const aliceAcc = await registerUser('alice_bk', 'Alice <script>alert(1)</script>', 'StrongPass123!');
  const bobAcc = await registerUser('bob_bk', 'Bob Backup', 'StrongPass456!');

  for (const [pagePath, withAuth] of [
    ['/login', false],
    ['/settings', true],
    ['/messages', true],
    ['/u/alice_bk', true],
  ]) {
    const r = await worker.fetch(
      new Request(`${base}${pagePath}`, { headers: { Cookie: withAuth ? `session=${aliceAcc.token}; lang=ru` : 'lang=ru' } }),
      env,
    );
    assert.strictEqual(r.status, 200, `Page ${pagePath} failed: ${r.status}`);
    const csp = r.headers.get('Content-Security-Policy') || '';
    const nonceM = /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(csp);
    assert.ok(nonceM, `Missing CSP nonce on ${pagePath}`);
    assert.ok(!/script-src[^;]*unsafe-inline/i.test(csp), `unsafe-inline in script-src on ${pagePath}`);
    const htmlStr = await r.text();
    assert.ok(!htmlStr.includes(`<script nonce="${nonceM[1]}">alert(1)`), `Untrusted <script> received CSP nonce on ${pagePath}!`);
    const scriptTags = htmlStr.match(/<script\b[^>]*>/gi) || [];
    for (const tag of scriptTags) {
      assert.ok(tag.includes(`nonce="${nonceM[1]}"`), `Trusted script tag missing matching nonce on ${pagePath}: ${tag}`);
    }
  }
  console.log('2. Trusted-only CSP nonce rendering (untrusted <script> never receives nonce) PASSED');

  const aliceBackend1 = createMemoryBackend();
  const aliceDev1 = new E2eeClient(aliceAcc.userId, aliceBackend1, makeWorkerFetch(aliceAcc.token));
  const bobBackend1 = createMemoryBackend();
  const bobDev1 = new E2eeClient(bobAcc.userId, bobBackend1, makeWorkerFetch(bobAcc.token));
  clientsToClose.push(aliceDev1, bobDev1);

  const aliceDev1Id = await aliceDev1.ensureInitialized();
  await bobDev1.ensureInitialized();

  const sampleMediaBytes = new Uint8Array(2048);
  crypto.getRandomValues(sampleMediaBytes);
  const encPhotoMsg = await aliceDev1.encryptMessage({
    partnerUserId: bobAcc.userId,
    text: 'Photo caption',
    fileBytes: sampleMediaBytes.buffer,
    fileMime: 'image/webp',
    mediaKind: 'image',
  });
  const mediaR2Key = `dm/1/test_photo_${Date.now()}.enc`;
  await env.STORAGE.put(mediaR2Key, encPhotoMsg.encryptedBytes);
  sqlite
    .prepare('INSERT INTO conversations (id, user1_id, user2_id) VALUES (1, ?, ?)')
    .run(Math.min(aliceAcc.userId, bobAcc.userId), Math.max(aliceAcc.userId, bobAcc.userId));
  sqlite
    .prepare('INSERT INTO messages (id, conversation_id, sender_id, body, image_key, is_encrypted) VALUES (102, 1, ?, ?, ?, 1)')
    .run(aliceAcc.userId, '', mediaR2Key);

  const sampleVoiceBytes = new Uint8Array(1536);
  crypto.getRandomValues(sampleVoiceBytes);
  const encVoiceMsg = await aliceDev1.encryptMessage({
    partnerUserId: bobAcc.userId,
    text: '',
    fileBytes: sampleVoiceBytes.buffer,
    fileMime: 'audio/webm;codecs=opus',
    mediaKind: 'voice',
    voiceDurationMs: 4200,
    voiceWaveform: [10, 40, 80, 30],
  });
  const voiceR2Key = `dm/1/test_voice_${Date.now()}.enc`;
  await env.STORAGE.put(voiceR2Key, encVoiceMsg.encryptedBytes);

  const decPhotoOnBob = await bobDev1.decryptMessage({
    id: 102,
    sender_id: aliceAcc.userId,
    sender_device_id: encPhotoMsg.senderDeviceId,
    is_encrypted: 1,
    ciphertext_envelope: JSON.stringify(encPhotoMsg.envelopes),
  });
  assert.strictEqual(decPhotoOnBob.ok, true, JSON.stringify(decPhotoOnBob));
  const decVoiceOnBob = await bobDev1.decryptMessage({
    id: 103,
    sender_id: aliceAcc.userId,
    sender_device_id: encVoiceMsg.senderDeviceId,
    is_encrypted: 1,
    ciphertext_envelope: JSON.stringify(encVoiceMsg.envelopes),
  });
  assert.strictEqual(decVoiceOnBob.ok, true);

  await aliceDev1.cacheSentMessage(101, { text: 'Hello encrypted backup!' });
  await aliceDev1.cacheSentMessage(102, decPhotoOnBob.payload);
  await aliceDev1.cacheSentMessage(103, decVoiceOnBob.payload);
  await aliceDev1.cacheSentMessage(104, {
    text: 'Replying to 101',
    reply: { id: 101, senderId: aliceAcc.userId, senderName: 'alice_bk', preview: 'Hello encrypted backup!', kind: 'text' },
  });
  await aliceDev1.cacheSentMessage(105, {
    text: 'Check this post',
    sharedPost: { postId: 77, authorUsername: 'bob_bk', imageKey: 'posts/77.webp', caption: 'Nice view' },
  });
  await aliceDev1.cacheSentMessage(106, { text: 'Edited v1' }, 1);
  await aliceDev1.cacheSentMessage(106, { text: 'Edited v2 final' }, 2);

  const rkDraft = await generateRecoveryKey();
  const parsedOk = await parseRecoveryKey(rkDraft.formatted);
  assert.ok(parsedOk && parsedOk.byteLength === 32);
  const badKey = rkDraft.formatted.slice(0, -1) + (rkDraft.formatted.endsWith('A') ? 'B' : 'A');
  let badKeyErr = false;
  try {
    await parseRecoveryKey(badKey);
  } catch (e) {
    badKeyErr = e && e.code === 'INVALID_RECOVERY_KEY';
  }
  assert.strictEqual(badKeyErr, true);

  const enableRes = await aliceDev1.enableBackupWithKey(rkDraft.formatted);
  assert.strictEqual(enableRes.backup_version, 1);
  assert.strictEqual(enableRes.message_count, 6);

  const aliceFreshBackend = createMemoryBackend();
  const aliceRestored = new E2eeClient(aliceAcc.userId, aliceFreshBackend, makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(aliceRestored);
  await aliceRestored.ensureInitialized();

  const restoreRes = await aliceRestored.restoreFromBackup(rkDraft.formatted);
  assert.strictEqual(restoreRes.restoredMessages, 6);
  assert.strictEqual((await aliceRestored.getCachedMessage(101)).text, 'Hello encrypted backup!');
  assert.strictEqual((await aliceRestored.getCachedMessage(102)).media.sha256, decPhotoOnBob.payload.media.sha256);
  assert.strictEqual((await aliceRestored.getCachedMessage(103)).media.durationMs, 4200);
  assert.strictEqual((await aliceRestored.getCachedMessage(104)).reply.id, 101);
  assert.strictEqual((await aliceRestored.getCachedMessage(105)).sharedPost.postId, 77);
  assert.strictEqual((await aliceRestored.getCachedMessage(106)).text, 'Edited v2 final');

  const restoredPhotoUrl = await aliceRestored.decryptMediaToObjectUrl(mediaR2Key, (await aliceRestored.getCachedMessage(102)).media);
  assert.ok(restoredPhotoUrl.startsWith('blob:'));
  console.log('3. Backup enable, Recovery Key checksum & full multi-type restore after IDB wipe PASSED');

  await env.STORAGE.delete(mediaR2Key);
  let mediaUnavailErr = null;
  const aliceRestored2 = new E2eeClient(aliceAcc.userId, aliceFreshBackend, makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(aliceRestored2);
  await aliceRestored2.ensureInitialized();
  try {
    await aliceRestored2.decryptMediaToObjectUrl(mediaR2Key, (await aliceRestored2.getCachedMessage(102)).media);
  } catch (e) {
    mediaUnavailErr = e;
  }
  assert.ok(mediaUnavailErr && mediaUnavailErr.code === 'MEDIA_UNAVAILABLE');
  console.log('4. Deleted/expired media after restore yields MEDIA_UNAVAILABLE PASSED');

  for (let i = 200; i < 255; i++) {
    await aliceDev1.cacheSentMessage(i, {
      text: `Long multi-chunk payload message #${i} ` + 'A'.repeat(240) + ` uniq=${nodeCrypto.randomBytes(16).toString('hex')}`,
    });
  }

  const r2KeysBeforeFail = Array.from(r2Store.keys()).filter((k) => k.startsWith(`backups/u_${aliceAcc.userId}/`));
  assert.ok(r2KeysBeforeFail.length >= 1);

  failNextCommitBatch = 2;
  let commitFailedAsExpected = false;
  try {
    await aliceDev1.backupNow({ forceFull: true, maxChunkRawBytes: 4096 });
  } catch {
    commitFailedAsExpected = true;
  }
  assert.strictEqual(commitFailedAsExpected, true);
  for (const k of r2KeysBeforeFail) {
    assert.ok(r2Store.has(k), `Two-phase safety violation: old R2 object ${k} deleted on failed commit!`);
  }

  const multiRes = await aliceDev1.backupNow({ forceFull: true, maxChunkRawBytes: 4096 });
  assert.ok(multiRes.chunk_count >= 3, `Expected >=3 base chunks, got ${multiRes.chunk_count}`);
  assert.strictEqual(multiRes.mode, 'base');
  for (const k of r2KeysBeforeFail) {
    assert.strictEqual(r2Store.has(k), false, `Old epoch object ${k} should be GC'd after successful commit`);
  }

  const epochBeforeDeltas = multiRes.backup_epoch;
  for (let d = 1; d <= 10; d++) {
    await aliceDev1.cacheSentMessage(300 + d, { text: `Incremental delta message #${d}` });
    const dRes = await aliceDev1.backupNow();
    if (d < 10) {
      assert.strictEqual(dRes.mode, 'delta', `Expected delta mode on step ${d}, got ${dRes.mode}`);
      assert.strictEqual(dRes.backup_epoch, epochBeforeDeltas);
    } else {
      assert.strictEqual(dRes.mode, 'base', 'Expected automatic compaction on 10th delta');
      assert.ok(dRes.backup_epoch > epochBeforeDeltas);
    }
  }

  const freshAfterCompact = new E2eeClient(aliceAcc.userId, createMemoryBackend(), makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(freshAfterCompact);
  await freshAfterCompact.ensureInitialized();
  const compactRestore = await freshAfterCompact.restoreFromBackup(rkDraft.formatted);
  assert.strictEqual(compactRestore.restoredMessages, 71);
  assert.strictEqual((await freshAfterCompact.getCachedMessage(310)).text, 'Incremental delta message #10');
  console.log('5. Multi-chunk base split, two-phase commit safety, 10 deltas & auto-compaction PASSED');

  const aliceToken2 = await loginUser('alice_bk', 'StrongPass123!');
  const aliceBackend2 = createMemoryBackend();
  const aliceDev2 = new E2eeClient(aliceAcc.userId, aliceBackend2, makeWorkerFetch(aliceToken2));
  clientsToClose.push(aliceDev2);
  const aliceDev2Id = await aliceDev2.ensureInitialized();
  assert.strictEqual((await aliceDev2.getDeviceStatus()).approvalStatus, 'pending');

  let pendingBlocked = false;
  try {
    await aliceDev2.enableBackupWithKey(rkDraft.formatted);
  } catch (e) {
    pendingBlocked = e && (e.code === 'DEVICE_PENDING' || e.code === 'DEVICE_NOT_APPROVED');
  }
  assert.strictEqual(pendingBlocked, true, 'Pending device MUST be blocked from writing backups');

  await aliceDev1.approvePendingDevice(aliceDev2Id);
  await aliceDev2.refreshDeviceStatus();

  await aliceDev2.store.setBackupRecoveryKeyRaw(rkDraft.rawB64);
  await aliceDev2.cacheSentMessage(401, { text: 'Partial msg from Dev2 #1' });
  await aliceDev2.cacheSentMessage(402, { text: 'Partial msg from Dev2 #2' });

  const dev2MergedRes = await aliceDev2.backupNow();
  assert.strictEqual(dev2MergedRes.message_count, 73, 'Partial device MUST merge remote 71 msgs + own 2 msgs = 73');

  const verifyMergeClient = new E2eeClient(aliceAcc.userId, createMemoryBackend(), makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(verifyMergeClient);
  await verifyMergeClient.ensureInitialized();
  await verifyMergeClient.restoreFromBackup(rkDraft.formatted);
  assert.strictEqual((await verifyMergeClient.getCachedMessage(101)).text, 'Hello encrypted backup!');
  assert.strictEqual((await verifyMergeClient.getCachedMessage(402)).text, 'Partial msg from Dev2 #2');

  await aliceDev1.cacheSentMessage(403, { text: 'Concurrent from Dev1' });
  await aliceDev2.cacheSentMessage(404, { text: 'Concurrent from Dev2' });
  const [race1, race2] = await Promise.all([aliceDev1.backupNow(), aliceDev2.backupNow()]);
  assert.ok(race1.backup_version > 0 && race2.backup_version > 0);
  const afterRaceClient = new E2eeClient(aliceAcc.userId, createMemoryBackend(), makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(afterRaceClient);
  await afterRaceClient.ensureInitialized();
  await afterRaceClient.restoreFromBackup(rkDraft.formatted);
  assert.strictEqual((await afterRaceClient.getCachedMessage(403)).text, 'Concurrent from Dev1');
  assert.strictEqual((await afterRaceClient.getCachedMessage(404)).text, 'Concurrent from Dev2');
  console.log('6. Concurrent multi-device backup conflict resolution & partial-history merge PASSED');

  await aliceDev1.clearCachedMessages([101, 401]);
  await aliceDev1.cacheSentMessage(106, { text: 'Edited v3 newest' }, 3);
  await aliceDev1.backupNow();

  await aliceDev2.restoreFromBackup(rkDraft.formatted);
  assert.ok(!(await aliceDev2.getCachedMessage(101)), 'Deleted message 101 MUST NOT resurrect');
  assert.ok(!(await aliceDev2.getCachedMessage(401)), 'Deleted message 401 MUST NOT resurrect');
  assert.strictEqual((await aliceDev2.getCachedMessage(106)).text, 'Edited v3 newest');

  const freshTombClient = new E2eeClient(aliceAcc.userId, createMemoryBackend(), makeWorkerFetch(aliceAcc.token));
  clientsToClose.push(freshTombClient);
  await freshTombClient.ensureInitialized();
  await freshTombClient.restoreFromBackup(rkDraft.formatted);
  assert.ok(!(await freshTombClient.getCachedMessage(101)));
  assert.ok(!(await freshTombClient.getCachedMessage(401)));
  assert.strictEqual((await freshTombClient.getCachedMessage(106)).text, 'Edited v3 newest');
  console.log('7. Tombstones & editVersion merge (deleted messages never resurrect) PASSED');

  const wrongRk = await generateRecoveryKey();
  let errCode = '';
  try {
    await freshTombClient.restoreFromBackup('INVALID-KEY-0000');
  } catch (e) {
    errCode = e && e.code;
  }
  assert.strictEqual(errCode, 'INVALID_RECOVERY_KEY');

  errCode = '';
  try {
    await freshTombClient.restoreFromBackup(wrongRk.formatted);
  } catch (e) {
    errCode = e && e.code;
  }
  assert.strictEqual(errCode, 'WRONG_RECOVERY_KEY');
  assert.strictEqual((await freshTombClient.getCachedMessage(106)).text, 'Edited v3 newest', 'Failed restore must preserve local data');

  const currentSt = await aliceDev1.getBackupStatus();
  const activeR2Key = `backups/u_${aliceAcc.userId}/e_${currentSt.backup_epoch}/c_0.bin`;
  const rawOrig = r2Store.get(activeR2Key);
  assert.ok(rawOrig && rawOrig.byteLength > 0);
  const origCipher = new Uint8Array(rawOrig);
  const corruptedCipher = new Uint8Array(origCipher);
  corruptedCipher[corruptedCipher.length - 1] ^= 0xff;
  r2Store.set(activeR2Key, corruptedCipher);
  errCode = '';
  try {
    await freshTombClient.restoreFromBackup(rkDraft.formatted);
  } catch (e) {
    errCode = e && e.code;
  }
  assert.strictEqual(errCode, 'BACKUP_CORRUPTED');
  r2Store.set(activeR2Key, origCipher);

  const rollbackFetch = makeWorkerFetch(aliceAcc.token, async (url) => {
    if (url.includes('/api/e2ee/backup/status')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          backup: {
            exists: true,
            enabled: true,
            backup_epoch: 1,
            backup_version: 1,
            kdf_salt: currentSt.kdf_salt,
            signer_device_id: currentSt.signer_device_id,
            manifest_sig: currentSt.manifest_sig,
            chunk_count: 1,
            total_size_bytes: 100,
            message_count: 1,
            last_msg_id: 1,
            last_backup_at: new Date().toISOString(),
          },
          chunks: currentSt.chunks.slice(0, 1),
        }),
      };
    }
    return null;
  });
  const rollbackClient = new E2eeClient(aliceAcc.userId, aliceBackend1, rollbackFetch);
  clientsToClose.push(rollbackClient);
  errCode = '';
  try {
    await rollbackClient.restoreFromBackup(rkDraft.formatted);
  } catch (e) {
    errCode = e && e.code;
  }
  assert.strictEqual(errCode, 'BACKUP_ROLLBACK_DETECTED');

  const bobChunkRes = await makeWorkerFetch(bobAcc.token)(`/api/e2ee/backup/chunk?epoch=${currentSt.backup_epoch}&seq=0`);
  assert.strictEqual(bobChunkRes.status, 404, 'IDOR: Bob must not access Alice backup chunk');

  const badSigDel = await makeWorkerFetch(aliceAcc.token)('/api/e2ee/backup/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: aliceDev1Id,
      expected_version: currentSt.backup_version,
      timestamp: Math.floor(Date.now() / 1000),
      signature: Buffer.alloc(64, 7).toString('base64'),
    }),
  });
  assert.strictEqual(badSigDel.status, 403, 'Forged signature on backup delete must be rejected');
  console.log('8. Negative security tests (wrong key, checksum, corrupted R2, rollback, IDOR, forged sig) PASSED');

  const aliceToken3 = await loginUser('alice_bk', 'StrongPass123!');
  const aliceBackend3 = createMemoryBackend();
  const aliceDev3 = new E2eeClient(aliceAcc.userId, aliceBackend3, makeWorkerFetch(aliceToken3));
  clientsToClose.push(aliceDev3);
  const aliceDev3Id = await aliceDev3.ensureInitialized();
  await aliceDev1.approvePendingDevice(aliceDev3Id);
  await aliceDev3.refreshDeviceStatus();

  const dev3IdBefore = await aliceDev3.store.getIdentityKeyPair();
  const xferInit = await aliceDev3.startDeviceTransferReceive();
  assert.ok(xferInit.qrPayload.startsWith('PGX1:'));
  assert.ok(xferInit.qrSize >= 21);
  assert.match(xferInit.code6, /^\d{3} \d{3}$/);

  const parsedQr = aliceDev1.parseTransferQrPayload(xferInit.qrPayload);
  assert.ok(parsedQr && parsedQr.transferId === xferInit.transferId);

  const pendingOnDev1 = await aliceDev1.listPendingDeviceTransfers();
  assert.ok(pendingOnDev1.some((p) => p.transfer_id === xferInit.transferId && p.code6 === xferInit.code6));

  const sendOut = await aliceDev1.sendHistoryToDevice({
    transferId: parsedQr.transferId,
    requesterDeviceId: parsedQr.requesterDeviceId,
    requesterEphPub: parsedQr.requesterEphPub,
    expectedCode6: xferInit.code6,
    includeRecoveryKey: true,
  });
  assert.strictEqual(sendOut.success, true);
  assert.ok(realtimeEvents.some((ev) => ev.event && ev.event.type === 'e2ee.transfer_ready' && ev.event.transfer_id === xferInit.transferId));

  const bobDownloadIdor = await makeWorkerFetch(bobAcc.token)(
    `/api/e2ee/transfer/download?transfer_id=${encodeURIComponent(xferInit.transferId)}&device_id=${aliceDev3Id}`,
  );
  assert.strictEqual(bobDownloadIdor.status, 404, 'IDOR: Bob must not download Alice transfer');

  const tamperRow = sqlite.prepare('SELECT sender_signature FROM e2ee_device_transfers WHERE transfer_id = ?').get(xferInit.transferId);
  const forgedSig = Buffer.alloc(64, 5).toString('base64');
  sqlite.prepare('UPDATE e2ee_device_transfers SET sender_signature = ? WHERE transfer_id = ?').run(forgedSig, xferInit.transferId);
  let xferSigErr = '';
  try {
    await aliceDev3.completeDeviceTransferReceive(xferInit.transferId);
  } catch (e) {
    xferSigErr = e && e.code;
  }
  assert.strictEqual(xferSigErr, 'INVALID_TRANSFER_SIG');
  sqlite.prepare('UPDATE e2ee_device_transfers SET sender_signature = ? WHERE transfer_id = ?').run(tamperRow.sender_signature, xferInit.transferId);

  const recvOut = await aliceDev3.completeDeviceTransferReceive(xferInit.transferId);
  assert.ok(recvOut.restoredMessages >= 50);
  assert.strictEqual(recvOut.importedRecoveryKey, true);
  assert.ok(!(await aliceDev3.getCachedMessage(101)), 'Tombstone 101 must transfer cleanly');
  assert.strictEqual((await aliceDev3.getCachedMessage(106)).text, 'Edited v3 newest');

  const dev3IdAfter = await aliceDev3.store.getIdentityKeyPair();
  assert.strictEqual(
    Buffer.from(dev3IdBefore.pubKey).toString('base64'),
    Buffer.from(dev3IdAfter.pubKey).toString('base64'),
    'Device Transfer MUST NEVER overwrite receiver Identity KeyPair',
  );
  const dev3Sessions = await aliceBackend3.getAllKeys('sessions');
  assert.strictEqual(dev3Sessions.length, 0, 'Device Transfer MUST NEVER copy Signal sessions');

  const replayRes = await makeWorkerFetch(aliceToken3)('/api/e2ee/transfer/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transfer_id: xferInit.transferId, device_id: aliceDev3Id }),
  });
  assert.strictEqual(replayRes.status, 409, 'Single-use transfer replay MUST fail with 409');

  const expInit = await aliceDev3.startDeviceTransferReceive();
  await aliceDev1.sendHistoryToDevice({
    transferId: expInit.transferId,
    requesterDeviceId: aliceDev3Id,
    requesterEphPub: expInit.requesterEphPub,
  });
  const expRow = sqlite.prepare('SELECT r2_key FROM e2ee_device_transfers WHERE transfer_id = ?').get(expInit.transferId);
  assert.ok(expRow && expRow.r2_key && r2Store.has(expRow.r2_key));
  sqlite.prepare("UPDATE e2ee_device_transfers SET expires_at = '2020-01-01 00:00:00' WHERE transfer_id = ?").run(expInit.transferId);
  await aliceDev1.getBackupStatus();
  assert.strictEqual(r2Store.has(expRow.r2_key), false, 'Expired transfer R2 blob MUST be deleted by cleanupExpiredTransfers');
  const expAfter = sqlite.prepare('SELECT status, r2_key FROM e2ee_device_transfers WHERE transfer_id = ?').get(expInit.transferId);
  assert.strictEqual(expAfter.status, 'expired');
  assert.strictEqual(expAfter.r2_key, '');
  console.log('9. Authenticated Device Transfer (ECDH+HKDF+ECDSA, zero session copy, single-use, R2 expiry GC) PASSED');

  const delRes = await aliceDev1.deleteBackup();
  assert.strictEqual(delRes.success, true);
  assert.strictEqual((await aliceDev1.getBackupStatus()).exists, false);
  const remainingAliceR2 = Array.from(r2Store.keys()).filter((k) => k.startsWith(`backups/u_${aliceAcc.userId}/`));
  assert.strictEqual(remainingAliceR2.length, 0, 'Backup delete must purge all R2 backup objects');

  const benchUser = await registerUser('bench_bk', 'Bench User', 'StrongPass789!');
  const benchClient1 = new E2eeClient(benchUser.userId, createMemoryBackend(), makeWorkerFetch(benchUser.token));
  clientsToClose.push(benchClient1);
  await benchClient1.ensureInitialized();
  for (let i = 1; i <= 200; i++) {
    await benchClient1.cacheSentMessage(i, {
      text: `Benchmark chat message #${i}: Привет! Как дела? Обсуждаем планы на выходные и тестируем шифрование.`,
    });
  }
  const benchRk = await generateRecoveryKey();

  resetMetrics();
  const baseBench = await benchClient1.enableBackupWithKey(benchRk.formatted);
  const mBase = snapMetrics();

  for (let i = 201; i <= 215; i++) {
    await benchClient1.cacheSentMessage(i, { text: `Delta message #${i}: Новое сообщение в чате` });
  }
  resetMetrics();
  const deltaBench = await benchClient1.backupNow();
  const mDelta = snapMetrics();

  const benchTok2 = await loginUser('bench_bk', 'StrongPass789!');
  const benchClient2 = new E2eeClient(benchUser.userId, createMemoryBackend(), makeWorkerFetch(benchTok2));
  clientsToClose.push(benchClient2);
  const benchDev2Id = await benchClient2.ensureInitialized();
  await benchClient1.approvePendingDevice(benchDev2Id);
  await benchClient2.refreshDeviceStatus();
  await benchClient2.store.setBackupRecoveryKeyRaw(benchRk.rawB64);
  await benchClient2.cacheSentMessage(216, { text: 'Conflict merge message from Device 2' });

  resetMetrics();
  await benchClient2.backupNow();
  const mConflict = snapMetrics();

  resetMetrics();
  const bxInit = await benchClient2.startDeviceTransferReceive();
  const bxSend = await benchClient1.sendHistoryToDevice({
    transferId: bxInit.transferId,
    requesterDeviceId: benchDev2Id,
    requesterEphPub: bxInit.requesterEphPub,
  });
  await benchClient2.completeDeviceTransferReceive(bxInit.transferId);
  const mTransfer = snapMetrics();

  console.log('10. Backup delete & real measured resource consumption PASSED');
  console.log('MEASURED_RESOURCES_JSON=' + JSON.stringify({
    base200Msgs: { ...mBase, totalBytes: baseBench.total_size_bytes, chunks: baseBench.chunk_count },
    delta15Msgs: { ...mDelta, totalBytes: deltaBench.total_size_bytes },
    conflictMerge: mConflict,
    transfer216Msgs: { ...mTransfer, payloadBytes: bxSend.sizeBytes },
  }));
  console.log('ALL_BACKUP_TESTS_PASSED');
} finally {
  for (const c of clientsToClose) {
    try {
      await c.close();
    } catch {}
  }
}
