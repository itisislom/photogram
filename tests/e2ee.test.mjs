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

function walkSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSourceFiles(full));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const sourceFiles = [...walkSourceFiles(path.join(root, 'src')), path.join(root, 'public/sw.js')];
for (const f of sourceFiles) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/^\s*\/\//.test(l) || /\/\*/.test(l) || /<!--/.test(l)) {
      throw new Error(`Comment found in ${rel}:${i + 1}: ${l.trim()}`);
    }
  });
}
console.log('1. Zero comments check PASSED across', sourceFiles.length, 'source files');

const migSql = fs.readFileSync(path.join(root, 'src/db/migrations/2026-11-27_seamless_e2ee.sql'), 'utf8');
assert.ok(migSql.includes('link_previews_enabled INTEGER NOT NULL DEFAULT 0'));
assert.ok(migSql.includes("approval_status TEXT NOT NULL DEFAULT 'approved'"));
assert.ok(migSql.includes("trust_origin TEXT NOT NULL DEFAULT 'legacy'"));
assert.ok(migSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_e2ee_devices_one_primary'));
assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS e2ee_device_challenges'));
assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS e2ee_device_lists'));
assert.ok(!/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i.test(migSql));
console.log('2. Non-destructive PostgreSQL migration verification PASSED');

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
  console: globalThis.console,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  fetch: globalThis.fetch,
};
fakeWindow.window = fakeWindow;
fakeWindow.self = fakeWindow;
runBrowserBundle(fakeWindow, fakeWindow, undefined, undefined, undefined, undefined, undefined, undefined);
const { E2eeClient, withCryptoLock } = fakeWindow.PhotogramE2EE || globalThis.PhotogramE2EE;

const sqlite = new DatabaseSync(':memory:');
const schemaSql = fs.readFileSync(path.join(root, 'src/db/schema.sql'), 'utf8');
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec(schemaSql);

const realtimeEvents = [];
const revokedRealtimeCalls = [];
const r2Store = new Map();

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
          const stmt = db.prepare(rawSql);
          const row = stmt.get(...this.params);
          return row === undefined ? null : { ...row };
        },
        async all() {
          const stmt = db.prepare(rawSql);
          const rows = stmt.all(...this.params).map((r) => ({ ...r }));
          return { results: rows };
        },
        async run() {
          const stmt = db.prepare(rawSql);
          const info = stmt.run(...this.params);
          return { meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) } };
        },
      };
    },
    async batch(queries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = [];
        for (const q of queries) {
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
      const buf = val instanceof ArrayBuffer ? new Uint8Array(val) : new Uint8Array(await val.arrayBuffer());
      r2Store.set(key, buf);
    },
    async get(key) {
      const data = r2Store.get(key);
      if (!data) return null;
      return { arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
    },
    async delete(key) {
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
            return new Response(JSON.stringify({ delivered_sockets: 1 }), { status: 200 });
          }
          if (url.includes('/revoke-session')) {
            revokedRealtimeCalls.push({ hub: id, ...body });
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
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
  assert.ok(m, `Missing session cookie for ${username}`);
  const row = sqlite.prepare('SELECT id, link_previews_enabled FROM users WHERE username = ?').get(username);
  return { userId: Number(row.id), token: m[1], linkPreviewsDefault: Number(row.link_previews_enabled) };
}

async function loginUser(username, password) {
  const fd = new FormData();
  fd.append('login', username);
  fd.append('password', password);
  const res = await worker.fetch(new Request(`${base}/api/auth/login`, { method: 'POST', body: fd }), env);
  assert.strictEqual(res.status, 200, `Login failed for ${username}`);
  const cookie = res.headers.get('Set-Cookie') || '';
  const m = /session=([^;]+)/.exec(cookie);
  assert.ok(m);
  return m[1];
}

function makeWorkerFetch(token) {
  return async (input, init = {}) => {
    const url = input.startsWith('http') ? input : `${base}${input}`;
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
      json: async () => res.json(),
      arrayBuffer: async () => res.arrayBuffer(),
    };
  };
}

function createMemoryBackend() {
  const stores = new Map();
  const gm = (n) => {
    if (!stores.has(n)) stores.set(n, new Map());
    return stores.get(n);
  };
  return {
    async get(s, k) { return gm(s).get(k); },
    async put(s, k, v) { gm(s).set(k, v); },
    async del(s, k) { gm(s).delete(k); },
    _stores: stores,
  };
}

const clientsToClose = [];

const aliceAcc = await registerUser('alice_e2ee', 'Alice', 'StrongPass123!');
const bobAcc = await registerUser('bob_e2ee', 'Bob', 'StrongPass456!');
assert.strictEqual(aliceAcc.linkPreviewsDefault, 0);
assert.strictEqual(bobAcc.linkPreviewsDefault, 0);

const lpOffRes = await worker.fetch(
  new Request(`${base}/api/messages/link-preview?url=${encodeURIComponent('https://example.com')}`, {
    headers: { Cookie: `session=${aliceAcc.token}` },
  }),
  env,
);
assert.strictEqual(lpOffRes.status, 403);
const lpImgOffRes = await worker.fetch(
  new Request(`${base}/api/messages/link-preview-img?url=${encodeURIComponent('https://example.com/a.jpg')}`, {
    headers: { Cookie: `session=${aliceAcc.token}` },
  }),
  env,
);
assert.strictEqual(lpImgOffRes.status, 403);

const toggleOnRes = await worker.fetch(
  new Request(`${base}/api/settings/link-previews`, {
    method: 'POST',
    headers: { Cookie: `session=${aliceAcc.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  }),
  env,
);
assert.strictEqual(toggleOnRes.status, 200);
assert.strictEqual(Number(sqlite.prepare('SELECT link_previews_enabled FROM users WHERE id = ?').get(aliceAcc.userId).link_previews_enabled), 1);

const toggleOffRes = await worker.fetch(
  new Request(`${base}/api/settings/link-previews`, {
    method: 'POST',
    headers: { Cookie: `session=${aliceAcc.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  }),
  env,
);
assert.strictEqual(toggleOffRes.status, 200);
assert.strictEqual(Number(sqlite.prepare('SELECT link_previews_enabled FROM users WHERE id = ?').get(aliceAcc.userId).link_previews_enabled), 0);
console.log('3. Link preview default-OFF & server enforcement + toggle PASSED');

const aliceBackend = createMemoryBackend();
const bobBackend = createMemoryBackend();
const alice = new E2eeClient(aliceAcc.userId, aliceBackend, makeWorkerFetch(aliceAcc.token));
const bob = new E2eeClient(bobAcc.userId, bobBackend, makeWorkerFetch(bobAcc.token));
clientsToClose.push(alice, bob);

const aliceDev1 = await alice.ensureInitialized();
const bobDev1 = await bob.ensureInitialized();

const aliceStatus = await alice.getDeviceStatus();
const bobStatus = await bob.getDeviceStatus();
assert.strictEqual(aliceStatus.approvalStatus, 'approved');
assert.strictEqual(aliceStatus.isPrimary, true);
assert.strictEqual(bobStatus.approvalStatus, 'approved');
assert.strictEqual(bobStatus.isPrimary, true);
assert.strictEqual(aliceStatus.listVersion, 1);
assert.strictEqual(bobStatus.listVersion, 1);

const encFirst = await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Hello seamless TOFU!' });
const sendFirstRes = await makeWorkerFetch(aliceAcc.token)('/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    target_user_id: bobAcc.userId,
    sender_device_id: encFirst.senderDeviceId,
    envelopes: encFirst.envelopes,
  }),
});
assert.strictEqual(sendFirstRes.status, 201);
const sendFirstData = await sendFirstRes.json();
const aliceBobConvId = Number(sendFirstData.conversation_id);
const firstMsgId = Number(sendFirstData.message.id);

const bobListRes = await makeWorkerFetch(bobAcc.token)(`/api/messages/list?conversation_id=${aliceBobConvId}`);
assert.strictEqual(bobListRes.status, 200);
const bobListData = await bobListRes.json();
const decFirst = await bob.decryptMessage(bobListData.messages[0]);
assert.strictEqual(decFirst.ok, true);
assert.strictEqual(decFirst.payload.text, 'Hello seamless TOFU!');

const aliceSafety1 = await alice.getSafetyNumberAndQr(bobAcc.userId);
const bobSafety1 = await bob.getSafetyNumberAndQr(aliceAcc.userId);
assert.strictEqual(aliceSafety1.fingerprint60.length, 60);
assert.strictEqual(aliceSafety1.fingerprint60, bobSafety1.fingerprint60);
assert.strictEqual(aliceSafety1.qrPayload, bobSafety1.qrPayload);
assert.ok(aliceSafety1.qrSize >= 21 && aliceSafety1.qrModules.length === aliceSafety1.qrSize);
await alice.markPartnerVerified(bobAcc.userId, aliceSafety1.fingerprint60, true);
assert.strictEqual(await alice.getPartnerVerificationStatus(bobAcc.userId), true);
console.log('4. Seamless TOFU first chat + Official 60-digit Safety Number & QR PASSED');

const raceAcc = await registerUser('race_user', 'Race', 'StrongPass789!');
const raceDevA = new E2eeClient(raceAcc.userId, createMemoryBackend(), makeWorkerFetch(raceAcc.token));
const raceDevB = new E2eeClient(raceAcc.userId, createMemoryBackend(), makeWorkerFetch(raceAcc.token));
clientsToClose.push(raceDevA, raceDevB);
await Promise.all([raceDevA.ensureInitialized(), raceDevB.ensureInitialized()]);
const raceRows = sqlite.prepare('SELECT device_id, approval_status, is_primary FROM e2ee_devices WHERE user_id = ?').all(raceAcc.userId);
assert.strictEqual(raceRows.length, 2);
assert.strictEqual(raceRows.filter((r) => r.approval_status === 'approved').length, 1);
assert.strictEqual(raceRows.filter((r) => Number(r.is_primary) === 1).length, 1);
assert.strictEqual(raceRows.filter((r) => r.approval_status === 'pending').length, 1);
console.log('5. Atomic first-device registration race PASSED');

const bobToken2 = await loginUser('bob_e2ee', 'StrongPass456!');
const bobDev2Backend = createMemoryBackend();
const bobDev2 = new E2eeClient(bobAcc.userId, bobDev2Backend, makeWorkerFetch(bobToken2));
clientsToClose.push(bobDev2);
const bobDev2Id = await bobDev2.ensureInitialized();
const bobDev2Status = await bobDev2.getDeviceStatus();
assert.strictEqual(bobDev2Status.approvalStatus, 'pending');

let pendingBlocked = false;
try {
  await bobDev2.encryptMessage({ partnerUserId: aliceAcc.userId, text: 'Should fail while pending' });
} catch (e) {
  pendingBlocked = e && e.code === 'DEVICE_PENDING';
}
assert.strictEqual(pendingBlocked, true);

const bobFetch2 = makeWorkerFetch(bobToken2);
const directPendingSend = await bobFetch2('/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: aliceBobConvId,
    sender_device_id: bobDev2Id,
    envelopes: [{ u: aliceAcc.userId, d: aliceDev1, t: 3, b: 'AAAA' }],
  }),
});
assert.strictEqual(directPendingSend.status, 403, 'Server MUST reject /api/messages/send from pending device with 403');
const directPendingSendJson = await directPendingSend.json();
assert.strictEqual(directPendingSendJson.code, 'DEVICE_PENDING');

const encBobApproved = await bob.encryptMessage({ partnerUserId: aliceAcc.userId, text: 'From approved Bob' });
const sendBobRes = await makeWorkerFetch(bobAcc.token)('/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: aliceBobConvId,
    sender_device_id: encBobApproved.senderDeviceId,
    envelopes: encBobApproved.envelopes,
  }),
});
assert.strictEqual(sendBobRes.status, 201);
const bobMsgId = Number((await sendBobRes.json()).message.id);

const directPendingEdit = await bobFetch2('/api/messages/edit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message_id: bobMsgId,
    sender_device_id: bobDev2Id,
    envelopes: [{ u: aliceAcc.userId, d: aliceDev1, t: 1, b: 'AAAA' }],
  }),
});
assert.strictEqual(directPendingEdit.status, 403, 'Server MUST reject /api/messages/edit from pending device with 403');
assert.strictEqual((await directPendingEdit.json()).code, 'DEVICE_PENDING');

const sendToPendingTarget = await makeWorkerFetch(aliceAcc.token)('/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: aliceBobConvId,
    sender_device_id: aliceDev1,
    envelopes: [{ u: bobAcc.userId, d: bobDev2Id, t: 3, b: 'AAAA' }],
  }),
});
assert.strictEqual(sendToPendingTarget.status, 400, 'Server MUST refuse envelopes targeting unapproved pending devices');
console.log('6. Server-side approval_status enforcement on send & edit PASSED');

const bobFetch1 = makeWorkerFetch(bobAcc.token);
const badChalRes = await bobFetch1('/api/e2ee/devices/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approver_device_id: bobDev2Id, target_device_id: bobDev1 }),
});
assert.strictEqual(badChalRes.status, 403);

const goodChalRes = await bobFetch1('/api/e2ee/devices/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approver_device_id: bobDev1, target_device_id: bobDev2Id }),
});
assert.strictEqual(goodChalRes.status, 200);
const goodChal = await goodChalRes.json();

const forgedSig = Buffer.alloc(64, 0xaa).toString('base64');
const forgedApproveRes = await bobFetch1('/api/e2ee/devices/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge_id: goodChal.challenge_id,
    approver_device_id: bobDev1,
    target_device_id: bobDev2Id,
    approval_signature: forgedSig,
    device_list: {
      list_version: goodChal.next_list_version,
      devices: [
        ...goodChal.approved_devices,
        { device_id: bobDev2Id, identity_key_pub: goodChal.target_identity_key_pub, signing_key_pub: goodChal.target_signing_key_pub },
      ],
      ecdsa_signature: forgedSig,
      signal_signature: forgedSig,
    },
  }),
});
assert.strictEqual(forgedApproveRes.status, 403);

sqlite.prepare("INSERT INTO e2ee_device_challenges (challenge_id, user_id, approver_device_id, target_device_id, target_identity_key_pub, target_signing_key_pub, nonce, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
  'deadbeefdeadbeef1111222233334444',
  bobAcc.userId,
  bobDev1,
  bobDev2Id,
  goodChal.target_identity_key_pub,
  goodChal.target_signing_key_pub,
  'aabbccdd',
  new Date(Date.now() - 10_000).toISOString(),
);
const expiredApproveRes = await bobFetch1('/api/e2ee/devices/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge_id: 'deadbeefdeadbeef1111222233334444',
    approver_device_id: bobDev1,
    target_device_id: bobDev2Id,
    approval_signature: forgedSig,
    device_list: {
      list_version: goodChal.next_list_version,
      devices: [
        ...goodChal.approved_devices,
        { device_id: bobDev2Id, identity_key_pub: goodChal.target_identity_key_pub, signing_key_pub: goodChal.target_signing_key_pub },
      ],
      ecdsa_signature: forgedSig,
      signal_signature: forgedSig,
    },
  }),
});
assert.strictEqual(expiredApproveRes.status, 410);

const origBatch = env.DB.batch.bind(env.DB);
let failOnceBatch = true;
env.DB.batch = async (queries) => {
  if (failOnceBatch) {
    failOnceBatch = false;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.prepare('UPDATE e2ee_device_lists SET list_version = 999 WHERE user_id = ?').run(bobAcc.userId);
      throw new Error('Simulated mid-transaction failure');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  }
  return origBatch(queries);
};
let txFailed = false;
try {
  await bob.approvePendingDevice(bobDev2Id);
} catch {
  txFailed = true;
}
env.DB.batch = origBatch;
assert.strictEqual(txFailed, true);
assert.strictEqual(
  Number(sqlite.prepare('SELECT list_version FROM e2ee_device_lists WHERE user_id = ?').get(bobAcc.userId).list_version),
  1,
  'Mid-transaction failure MUST roll back e2ee_device_lists atomically',
);
assert.strictEqual(
  sqlite.prepare('SELECT approval_status FROM e2ee_devices WHERE user_id = ? AND device_id = ?').get(bobAcc.userId, bobDev2Id).approval_status,
  'pending',
  'Mid-transaction failure MUST leave pending device untouched',
);

const apprOut = await bob.approvePendingDevice(bobDev2Id);
assert.strictEqual(apprOut.success, true);
assert.strictEqual(apprOut.list_version, 2);

const usedChal = sqlite.prepare('SELECT challenge_id, used_at FROM e2ee_device_challenges WHERE user_id = ? AND used_at IS NOT NULL').get(bobAcc.userId);
assert.ok(usedChal && usedChal.used_at);
const replayRes = await bobFetch1('/api/e2ee/devices/approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge_id: usedChal.challenge_id,
    approver_device_id: bobDev1,
    target_device_id: bobDev2Id,
    approval_signature: forgedSig,
    device_list: {
      list_version: 3,
      devices: [{ device_id: bobDev1, identity_key_pub: bobStatus.identityKeyPub, signing_key_pub: bobStatus.signingKeyPub }],
      ecdsa_signature: forgedSig,
      signal_signature: forgedSig,
    },
  }),
});
assert.strictEqual(replayRes.status, 409);

const encToTwoDevs = await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Seamless multi-device!' });
assert.strictEqual(encToTwoDevs.envelopes.filter((e) => e.u === bobAcc.userId).length, 2);
const decOnBob2 = await bobDev2.decryptMessage({
  id: 1002,
  sender_id: aliceAcc.userId,
  sender_device_id: encToTwoDevs.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encToTwoDevs.envelopes),
});
assert.strictEqual(decOnBob2.ok, true);
assert.strictEqual(decOnBob2.payload.text, 'Seamless multi-device!');
console.log('7. Atomic transactional approval, anti-replay & peer chain verification PASSED');

const aliceToken2 = await loginUser('alice_e2ee', 'StrongPass123!');
const aliceDev2 = new E2eeClient(aliceAcc.userId, createMemoryBackend(), makeWorkerFetch(aliceToken2));
clientsToClose.push(aliceDev2);
const aliceDev2Id = await aliceDev2.ensureInitialized();
const aliceAppr2 = await alice.approvePendingDevice(aliceDev2Id);
assert.strictEqual(aliceAppr2.success, true);

const [snA1, snA2, snB1, snB2] = await Promise.all([
  alice.getSafetyNumberAndQr(bobAcc.userId),
  aliceDev2.getSafetyNumberAndQr(bobAcc.userId),
  bob.getSafetyNumberAndQr(aliceAcc.userId),
  bobDev2.getSafetyNumberAndQr(aliceAcc.userId),
]);
assert.strictEqual(snA1.fingerprint60, snA2.fingerprint60, 'Alice Dev1 and Alice Dev2 must produce identical Safety Number');
assert.strictEqual(snA1.fingerprint60, snB1.fingerprint60, 'Alice and Bob Dev1 must produce identical Safety Number');
assert.strictEqual(snB1.fingerprint60, snB2.fingerprint60, 'Bob Dev1 and Bob Dev2 must produce identical Safety Number');
assert.strictEqual(snA2.qrPayload, snB2.qrPayload, 'All approved devices of Alice and Bob must produce identical QR payload');
assert.notStrictEqual(snA1.fingerprint60, aliceSafety1.fingerprint60, 'Adding approved devices must update account Safety Number');
console.log('8. Multi-device symmetric Safety Number & QR across all 4 devices PASSED');

const fakeGhostKey = Buffer.concat([Buffer.from([0x05]), Buffer.alloc(32, 0x42)]).toString('base64');
const fakeSpkSig = Buffer.alloc(64, 0x11).toString('base64');
sqlite.prepare(
  `INSERT INTO e2ee_devices (user_id, device_id, registration_id, identity_key_pub, signed_prekey_id, signed_prekey_pub, signed_prekey_sig, approval_status, trust_origin, is_primary)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'device_approved', 0)`,
).run(bobAcc.userId, 999888, 777, fakeGhostKey, 1, fakeGhostKey, fakeSpkSig);

let ghostBlocked = false;
try {
  await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Should NOT encrypt to ghost device' });
} catch (e) {
  ghostBlocked = e && e.code === 'KEY_CHANGED';
}
assert.strictEqual(ghostBlocked, true);
sqlite.prepare('DELETE FROM e2ee_devices WHERE user_id = ? AND device_id = 999888').run(bobAcc.userId);

const savedListRow = sqlite.prepare('SELECT * FROM e2ee_device_lists WHERE user_id = ?').get(bobAcc.userId);
sqlite.prepare('UPDATE e2ee_device_lists SET list_version = 1 WHERE user_id = ?').run(bobAcc.userId);
let rollbackErr = null;
try {
  await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Should reject rollback' });
} catch (e) {
  rollbackErr = e;
}
assert.ok(rollbackErr && rollbackErr.code === 'KEY_CHANGED' && rollbackErr.rollbackDetected === true);

let acceptRollbackBlocked = false;
try {
  await alice.acceptKeyChanges(rollbackErr.changes, bobAcc.userId, rollbackErr.nextListVersion, true);
} catch (e) {
  acceptRollbackBlocked = e && e.code === 'LIST_ROLLBACK_FORBIDDEN';
}
assert.strictEqual(acceptRollbackBlocked, true, 'acceptKeyChanges MUST reject rolled-back list when flagged');

let acceptRollbackImplicitBlocked = false;
try {
  await alice.acceptKeyChanges(
    rollbackErr.changes.map((c) => ({ userId: c.userId, deviceId: c.deviceId, identityKey: c.identityKey })),
    bobAcc.userId,
    1,
    false,
  );
} catch (e) {
  acceptRollbackImplicitBlocked = e && e.code === 'LIST_ROLLBACK_FORBIDDEN';
}
assert.strictEqual(acceptRollbackImplicitBlocked, true, 'acceptKeyChanges MUST refuse lowering pinnedListVersion even without explicit flag');
assert.strictEqual(await aliceBackend.get('meta', `pinned_list_ver_${bobAcc.userId}`), 2, 'pinnedListVersion MUST remain strictly monotonic');

sqlite.prepare('UPDATE e2ee_device_lists SET list_version = ? WHERE user_id = ?').run(savedListRow.list_version, bobAcc.userId);
console.log('9. Ghost-device MITM & monotonic anti-rollback confirmation guard PASSED');

const encGoodBeforeBadMac = await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Valid msg 1' });
const encOutOfOrder2 = await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Valid msg 2 (out of order)' });
const decGood1 = await bob.decryptMessage({
  id: 2001,
  sender_id: aliceAcc.userId,
  sender_device_id: encGoodBeforeBadMac.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encGoodBeforeBadMac.envelopes),
});
assert.strictEqual(decGood1.ok, true);

const corruptedEnv = JSON.parse(JSON.stringify(encOutOfOrder2.envelopes));
corruptedEnv.forEach((item) => {
  if (item.u === bobAcc.userId && item.d === bobDev1) {
    const raw = Buffer.from(item.b, 'base64');
    raw[raw.length - 1] ^= 0xff;
    item.b = raw.toString('base64');
  }
});
const decSingleBadMac = await bob.decryptMessage({
  id: 2002,
  sender_id: aliceAcc.userId,
  sender_device_id: encOutOfOrder2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(corruptedEnv),
});
assert.strictEqual(decSingleBadMac.ok, false);
assert.strictEqual(decSingleBadMac.reason, 'DECRYPT_ERROR');

const decRealMsg2AfterSingleBadMac = await bob.decryptMessage({
  id: 2003,
  sender_id: aliceAcc.userId,
  sender_device_id: encOutOfOrder2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encOutOfOrder2.envelopes),
});
assert.strictEqual(decRealMsg2AfterSingleBadMac.ok, true);
assert.strictEqual(decRealMsg2AfterSingleBadMac.payload.text, 'Valid msg 2 (out of order)');

const corruptedFailA = await bob.decryptMessage({
  id: 2004,
  sender_id: aliceAcc.userId,
  sender_device_id: encOutOfOrder2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(corruptedEnv),
});
assert.strictEqual(corruptedFailA.reason, 'DECRYPT_ERROR');
const corruptedFailB = await bob.decryptMessage({
  id: 2005,
  sender_id: aliceAcc.userId,
  sender_device_id: encOutOfOrder2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(corruptedEnv),
});
assert.strictEqual(corruptedFailB.reason, 'SESSION_RECOVERED_PRE_RESET');

const encAfterRecovery = await bob.encryptMessage({ partnerUserId: aliceAcc.userId, text: 'Recovered seamlessly!' });
const decAfterRecovery = await alice.decryptMessage({
  id: 2006,
  sender_id: bobAcc.userId,
  sender_device_id: encAfterRecovery.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encAfterRecovery.envelopes),
});
assert.strictEqual(decAfterRecovery.ok, true);
assert.strictEqual(decAfterRecovery.payload.text, 'Recovered seamlessly!');
console.log('10. Safe broken-session recovery (1 Bad MAC preserves ratchet; 2 consecutive auto-recover) PASSED');

const bobToken3 = await loginUser('bob_e2ee', 'StrongPass456!');
const bobDev3 = new E2eeClient(bobAcc.userId, createMemoryBackend(), makeWorkerFetch(bobToken3));
clientsToClose.push(bobDev3);
const bobDev3Id = await bobDev3.ensureInitialized();
assert.strictEqual((await bobDev3.getDeviceStatus()).approvalStatus, 'pending');

let wrongPwRejected = false;
try {
  await bobDev3.recoverLostDevice('WrongPassword999!');
} catch (e) {
  wrongPwRejected = e && e.code === 'INVALID_PASSWORD';
}
assert.strictEqual(wrongPwRejected, true);

const recRes = await bobDev3.recoverLostDevice('StrongPass456!');
assert.strictEqual(recRes.success, true);
assert.strictEqual(recRes.list_version, 3);

const bobDevsAfterRec = sqlite.prepare('SELECT device_id, approval_status, trust_origin, is_primary FROM e2ee_devices WHERE user_id = ?').all(bobAcc.userId);
assert.strictEqual(bobDevsAfterRec.length, 1);
assert.strictEqual(Number(bobDevsAfterRec[0].device_id), bobDev3Id);
assert.strictEqual(bobDevsAfterRec[0].approval_status, 'approved');
assert.strictEqual(bobDevsAfterRec[0].trust_origin, 'recovery_reset');

const bobSessionsAfterRec = sqlite.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').all(bobAcc.userId);
assert.strictEqual(bobSessionsAfterRec.length, 1);
assert.ok(realtimeEvents.some((e) => e.event && e.event.type === 'e2ee.devices_reset'));
assert.ok(revokedRealtimeCalls.some((c) => c.hub === `u:${bobAcc.userId}` && c.except_session));

let keyChangedAfterRec = null;
try {
  await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'After Bob lost phone' });
} catch (e) {
  keyChangedAfterRec = e;
}
assert.ok(keyChangedAfterRec && keyChangedAfterRec.code === 'KEY_CHANGED');

await alice.acceptKeyChanges(keyChangedAfterRec.changes, bobAcc.userId, keyChangedAfterRec.nextListVersion);
assert.strictEqual(await alice.getPartnerVerificationStatus(bobAcc.userId), false);

const encPostRec = await alice.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Confirmed new key!' });
const decPostRec = await bobDev3.decryptMessage({
  id: 3001,
  sender_id: aliceAcc.userId,
  sender_device_id: encPostRec.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encPostRec.envelopes),
});
assert.strictEqual(decPostRec.ok, true);
assert.strictEqual(decPostRec.payload.text, 'Confirmed new key!');
console.log('11. Atomic lost-device recovery & partner KEY_CHANGED confirmation PASSED');

let concurrentInside = 0;
let maxConcurrentInside = 0;
await Promise.all(
  Array.from({ length: 12 }, (_, idx) =>
    withCryptoLock('test_parallel_tabs_mutex', async () => {
      concurrentInside++;
      if (concurrentInside > maxConcurrentInside) maxConcurrentInside = concurrentInside;
      await new Promise((r) => setTimeout(r, 8));
      concurrentInside--;
      return idx;
    }),
  ),
);
assert.strictEqual(maxConcurrentInside, 1);

const prevLocalStorageDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const prevNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const fakeLsMap = new Map();
Object.defineProperty(globalThis, 'navigator', {
  value: {},
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem(k) { return fakeLsMap.has(k) ? fakeLsMap.get(k) : null; },
    setItem(k, v) { fakeLsMap.set(k, String(v)); },
    removeItem(k) { fakeLsMap.delete(k); },
  },
  configurable: true,
  writable: true,
});
fakeLsMap.set('pg_e2ee_lock:contended_mutex', JSON.stringify({ owner: 'other_tab_999', exp: Date.now() + 60_000 }));
let ranWithoutLock = false;
let lockTimedOut = false;
try {
  await withCryptoLock(
    'contended_mutex',
    async () => {
      ranWithoutLock = true;
    },
    { timeoutMs: 80 },
  );
} catch (e) {
  lockTimedOut = e && e.code === 'LOCK_TIMEOUT';
} finally {
  if (prevLocalStorageDesc) Object.defineProperty(globalThis, 'localStorage', prevLocalStorageDesc);
  else delete globalThis.localStorage;
  if (prevNavigatorDesc) Object.defineProperty(globalThis, 'navigator', prevNavigatorDesc);
  else delete globalThis.navigator;
}
assert.strictEqual(lockTimedOut, true, 'Contended fallback localStorage mutex MUST fail closed with LOCK_TIMEOUT');
assert.strictEqual(ranWithoutLock, false, 'Fallback mutex MUST NEVER execute callback without holding lease');

const tab1 = new E2eeClient(aliceAcc.userId, aliceBackend, makeWorkerFetch(aliceAcc.token));
const tab2 = new E2eeClient(aliceAcc.userId, aliceBackend, makeWorkerFetch(aliceAcc.token));
clientsToClose.push(tab1, tab2);
await Promise.all([tab1.ensureInitialized(), tab2.ensureInitialized()]);

const bobToAlice1 = await bobDev3.encryptMessage({ partnerUserId: aliceAcc.userId, text: 'Inbound during concurrent send 1' });
const bobToAlice2 = await bobDev3.encryptMessage({ partnerUserId: aliceAcc.userId, text: 'Inbound during concurrent send 2' });
const [pEnc1, pDec1, pEnc2, pDec2] = await Promise.all([
  tab1.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Concurrent out 1' }),
  tab2.decryptMessage({
    id: 4101,
    sender_id: bobAcc.userId,
    sender_device_id: bobToAlice1.senderDeviceId,
    is_encrypted: 1,
    ciphertext_envelope: JSON.stringify(bobToAlice1.envelopes),
  }),
  tab2.encryptMessage({ partnerUserId: bobAcc.userId, text: 'Concurrent out 2' }),
  tab1.decryptMessage({
    id: 4102,
    sender_id: bobAcc.userId,
    sender_device_id: bobToAlice2.senderDeviceId,
    is_encrypted: 1,
    ciphertext_envelope: JSON.stringify(bobToAlice2.envelopes),
  }),
]);
assert.strictEqual(pDec1.ok, true);
assert.strictEqual(pDec2.ok, true);
const bobDecP1 = await bobDev3.decryptMessage({
  id: 4103,
  sender_id: aliceAcc.userId,
  sender_device_id: pEnc1.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(pEnc1.envelopes),
});
const bobDecP2 = await bobDev3.decryptMessage({
  id: 4104,
  sender_id: aliceAcc.userId,
  sender_device_id: pEnc2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(pEnc2.envelopes),
});
assert.strictEqual(bobDecP1.ok, true);
assert.strictEqual(bobDecP2.ok, true);
console.log('12. Unified encrypt/decrypt partner lock & fail-closed fallback mutex PASSED');

const aliceFetch = makeWorkerFetch(aliceAcc.token);
const unsignedUnreg = await aliceFetch('/api/e2ee/keys/unregister', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_id: aliceDev2Id }),
});
assert.strictEqual(unsignedUnreg.status, 403, 'Unsigned /api/e2ee/keys/unregister MUST return 403');

const badSigUnreg = await aliceFetch('/api/e2ee/keys/unregister', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_id: aliceDev2Id, timestamp: Date.now(), signature: forgedSig }),
});
assert.strictEqual(badSigUnreg.status, 403, 'Forged unregister signature MUST return 403');

const staleTsUnreg = await aliceFetch('/api/e2ee/keys/unregister', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_id: aliceDev2Id, timestamp: Date.now() - 10 * 60 * 1000, signature: forgedSig }),
});
assert.strictEqual(staleTsUnreg.status, 403, 'Stale unregister timestamp MUST return 403');

const signedUnregOk = await aliceDev2.unregisterDevice();
assert.strictEqual(signedUnregOk, true, 'Cryptographically signed unregisterDevice() MUST succeed');
const aliceDevsAfterUnreg = sqlite.prepare('SELECT device_id FROM e2ee_devices WHERE user_id = ?').all(aliceAcc.userId);
assert.strictEqual(aliceDevsAfterUnreg.length, 1);
assert.strictEqual(Number(aliceDevsAfterUnreg[0].device_id), aliceDev1);
const aliceListAfterUnreg = sqlite.prepare('SELECT list_version, device_list_json FROM e2ee_device_lists WHERE user_id = ?').get(aliceAcc.userId);
assert.strictEqual(Number(aliceListAfterUnreg.list_version), 3, 'Unregistering an approved device with siblings MUST increment signed device_list');
assert.strictEqual(JSON.parse(aliceListAfterUnreg.device_list_json).length, 1);
console.log('13. Cryptographic proof-of-possession on /api/e2ee/keys/unregister PASSED');

const legacyUserA = await registerUser('legacy_a', 'LegacyA', 'StrongPass111!');
const legacyUserB = await registerUser('legacy_b', 'LegacyB', 'StrongPass222!');
const legacyBackendA = createMemoryBackend();
const legacyBackendB = createMemoryBackend();
const legacyClientA0 = new E2eeClient(legacyUserA.userId, legacyBackendA, makeWorkerFetch(legacyUserA.token));
const legacyClientB0 = new E2eeClient(legacyUserB.userId, legacyBackendB, makeWorkerFetch(legacyUserB.token));
clientsToClose.push(legacyClientA0, legacyClientB0);

const legDevA = await legacyClientA0.ensureInitialized();
const legDevB = await legacyClientB0.ensureInitialized();

const preUpdateMsg1 = await legacyClientA0.encryptMessage({ partnerUserId: legacyUserB.userId, text: 'Legacy msg before update' });
const preUpdateDec1 = await legacyClientB0.decryptMessage({
  id: 7001,
  sender_id: legacyUserA.userId,
  sender_device_id: preUpdateMsg1.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(preUpdateMsg1.envelopes),
});
assert.strictEqual(preUpdateDec1.ok, true);

const preUpdateMsg2 = await legacyClientA0.encryptMessage({ partnerUserId: legacyUserB.userId, text: 'In-flight legacy ciphertext from old version' });

await legacyBackendA.put('msgCache', '7001', { v: 1, text: 'Legacy msg before update' });
await legacyBackendA.del('meta', 'deviceSigningKey');
await legacyBackendB.del('meta', 'deviceSigningKey');
await legacyBackendA.del('meta', `pinned_list_ver_${legacyUserB.userId}`);
await legacyBackendB.del('meta', `pinned_list_ver_${legacyUserA.userId}`);

sqlite.prepare("UPDATE e2ee_devices SET signing_key_pub = '', signing_key_binding_sig = '', trust_origin = 'legacy', is_primary = 0, approval_status = 'approved' WHERE user_id IN (?, ?)").run(legacyUserA.userId, legacyUserB.userId);
sqlite.prepare('DELETE FROM e2ee_device_lists WHERE user_id IN (?, ?)').run(legacyUserA.userId, legacyUserB.userId);

const upgradedA = new E2eeClient(legacyUserA.userId, legacyBackendA, makeWorkerFetch(legacyUserA.token));
const upgradedB = new E2eeClient(legacyUserB.userId, legacyBackendB, makeWorkerFetch(legacyUserB.token));
clientsToClose.push(upgradedA, upgradedB);

const upgradedDevA = await upgradedA.ensureInitialized();
const upgradedDevB = await upgradedB.ensureInitialized();
assert.strictEqual(upgradedDevA, legDevA, 'Upgrade MUST preserve existing device_id without re-keying');
assert.strictEqual(upgradedDevB, legDevB, 'Upgrade MUST preserve existing partner device_id without re-keying');

const cachedOldOut = await upgradedA.decryptMessage({
  id: 7001,
  sender_id: legacyUserA.userId,
  sender_device_id: legDevA,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(preUpdateMsg1.envelopes),
});
assert.strictEqual(cachedOldOut.ok, true, 'Legacy msgCache entry without editVersion MUST remain readable');
assert.strictEqual(cachedOldOut.payload.text, 'Legacy msg before update');

const decInFlightLegacy = await upgradedB.decryptMessage({
  id: 7002,
  sender_id: legacyUserA.userId,
  sender_device_id: preUpdateMsg2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(preUpdateMsg2.envelopes),
});
assert.strictEqual(decInFlightLegacy.ok, true, 'Preserved Double Ratchet session MUST decrypt pre-update ciphertext seamlessly');
assert.strictEqual(decInFlightLegacy.payload.text, 'In-flight legacy ciphertext from old version');

const postUpgradeEnc = await upgradedB.encryptMessage({ partnerUserId: legacyUserA.userId, text: 'Reply after in-place upgrade' });
const postUpgradeDec = await upgradedA.decryptMessage({
  id: 7003,
  sender_id: legacyUserB.userId,
  sender_device_id: postUpgradeEnc.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(postUpgradeEnc.envelopes),
});
assert.strictEqual(postUpgradeDec.ok, true);
assert.strictEqual(postUpgradeDec.payload.text, 'Reply after in-place upgrade');

const newDevTokenB = await loginUser('legacy_b', 'StrongPass222!');
const newDevB = new E2eeClient(legacyUserB.userId, createMemoryBackend(), makeWorkerFetch(newDevTokenB));
clientsToClose.push(newDevB);
await newDevB.ensureInitialized();

const oldIncomingOnNewDev = await newDevB.decryptMessage({
  id: 7002,
  sender_id: legacyUserA.userId,
  sender_device_id: preUpdateMsg2.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(preUpdateMsg2.envelopes),
});
assert.strictEqual(oldIncomingOnNewDev.ok, false);
assert.strictEqual(oldIncomingOnNewDev.reason, 'NOT_FOR_THIS_DEVICE', 'Pre-device incoming message must report NOT_FOR_THIS_DEVICE');

const oldOwnOnNewDev = await newDevB.decryptMessage({
  id: 7003,
  sender_id: legacyUserB.userId,
  sender_device_id: postUpgradeEnc.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(postUpgradeEnc.envelopes),
});
assert.strictEqual(oldOwnOnNewDev.ok, false);
assert.strictEqual(oldOwnOnNewDev.reason, 'SENT_FROM_OTHER_DEVICE', 'Pre-device own outgoing message must report SENT_FROM_OTHER_DEVICE');
console.log('14. E2EE backwards compatibility (legacy in-place upgrade + NOT_FOR_THIS_DEVICE/SENT_FROM_OTHER_DEVICE) PASSED');

const encVoice = await alice.encryptMessage({
  partnerUserId: bobAcc.userId,
  text: '',
  fileBytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
  fileMime: 'audio/webm;codecs=opus',
  mediaKind: 'voice',
  voiceDurationMs: 4200,
  voiceWaveform: [12, 48, 82, 35],
  reply: { id: 3001, senderId: aliceAcc.userId, senderName: 'alice_e2ee', preview: 'Confirmed new key!', kind: 'text' },
});
const decVoice = await bobDev3.decryptMessage({
  id: 5001,
  sender_id: aliceAcc.userId,
  sender_device_id: encVoice.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encVoice.envelopes),
});
assert.strictEqual(decVoice.ok, true);
assert.strictEqual(decVoice.payload.media.kind, 'voice');
assert.strictEqual(decVoice.payload.reply.id, 3001);
const decVoiceBytes = new Uint8Array(await bobDev3.decryptMediaBytes(encVoice.encryptedBytes, decVoice.payload.media));
assert.deepStrictEqual(Array.from(decVoiceBytes), [1, 2, 3, 4, 5, 6, 7, 8]);

const encPost = await alice.encryptMessage({
  partnerUserId: bobAcc.userId,
  text: 'Check this post',
  sharedPost: { postId: 42, authorUsername: 'islom', imageKey: 'posts/42.webp', caption: 'Hi' },
});
const decPost = await bobDev3.decryptMessage({
  id: 5002,
  sender_id: aliceAcc.userId,
  sender_device_id: encPost.senderDeviceId,
  is_encrypted: 1,
  ciphertext_envelope: JSON.stringify(encPost.envelopes),
});
assert.strictEqual(decPost.ok, true);
assert.strictEqual(decPost.payload.sharedPost.postId, 42);
console.log('15. E2EE compatibility for voice, media AES-GCM, replies, and shared posts PASSED');

const headersFile = fs.readFileSync(path.join(root, 'public/_headers'), 'utf8');
const headersScriptSrc = /script-src\s+([^;]+)/.exec(headersFile);
assert.ok(headersScriptSrc && !headersScriptSrc[1].includes('unsafe-inline'), 'public/_headers script-src MUST NOT contain unsafe-inline');

for (const lang of ['ru', 'en', 'uz', 'kz']) {
  for (const route of ['/messages', '/settings', '/login']) {
    const cookieVal = route === '/login' ? `lang=${lang}` : `session=${aliceAcc.token}; lang=${lang}`;
    const pageRes = await worker.fetch(
      new Request(`${base}${route}`, { headers: { Cookie: cookieVal } }),
      env,
    );
    assert.strictEqual(pageRes.status, 200, `${route} (${lang}) failed`);
    assert.strictEqual(pageRes.headers.get('X-Pg-Csp-Nonce'), null, 'Internal X-Pg-Csp-Nonce header MUST be stripped');
    const csp = pageRes.headers.get('Content-Security-Policy') || '';
    const scriptDirective = /script-src\s+([^;]+)/.exec(csp);
    assert.ok(scriptDirective, `Missing script-src CSP on ${route}`);
    assert.ok(!scriptDirective[1].includes('unsafe-inline'), `script-src MUST NOT contain unsafe-inline on ${route}: ${scriptDirective[1]}`);
    const nonceMatch = /'nonce-([A-Za-z0-9+/=]+)'/.exec(scriptDirective[1]);
    assert.ok(nonceMatch && nonceMatch[1].length >= 16, `Missing cryptographic CSP nonce on ${route}`);
    const nonce = nonceMatch[1];

    const html = await pageRes.text();
    let scriptCount = 0;
    for (const m of html.matchAll(/<script(\s+[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      scriptCount++;
      const attrs = m[1] || '';
      assert.ok(attrs.includes(`nonce="${nonce}"`), `Every <script> on ${route} must carry matching CSP nonce`);
      if (m[2].trim()) new Function(m[2]);
    }
    assert.ok(scriptCount > 0, `Expected scripts on ${route}`);
    if (route === '/settings') {
      assert.ok(html.includes('id="linkPreviewsToggleInput"'));
      assert.ok(html.includes('id="settingsDevicesBtn"'));
      assert.ok(html.includes('id="devicesModal"'));
    } else if (route === '/messages') {
      assert.ok(html.includes('id="dmSafetyModal"'));
      assert.ok(html.includes('id="dmRecoverModal"'));
      assert.ok(html.includes('"linkPreviewsEnabled":false'));
      assert.ok(html.includes('e2eeNotForThisDevice'));
      assert.ok(html.includes('e2eeSentFromOtherDevice'));
    }
  }
}
console.log('16. Strict nonce CSP (zero unsafe-inline in script-src) & 4-language HTML/JS verification PASSED');

await Promise.all(clientsToClose.map((c) => c.close()));
sqlite.close();
console.log('ALL_E2EE_TESTS_PASSED');
