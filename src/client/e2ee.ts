import {
  KeyHelper,
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
  FingerprintGenerator,
  Direction,
  StorageType,
  KeyPairType,
  SessionRecordType,
  DeviceType,
} from '@privacyresearch/libsignal-protocol-typescript';

const INITIAL_PREKEY_COUNT = 50;
const LOW_PREKEY_THRESHOLD = 15;
const REFILL_PREKEY_COUNT = 40;
const MAX_PLAIN_TEXT_LEN = 2000;
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface DecryptedMediaMeta {
  aesKey: string;
  iv: string;
  sha256: string;
  mime: string;
}

export interface DecryptedPayload {
  v: number;
  text: string;
  media?: DecryptedMediaMeta | null;
}

export interface CipherEnvelopeItem {
  u: number;
  d: number;
  t: number;
  b: string;
}

export interface IncomingEncryptedMessage {
  id: number;
  sender_id: number;
  sender_device_id?: number;
  is_encrypted?: number | boolean;
  body?: string;
  image_key?: string;
  ciphertext_envelope?: string;
}

export interface KeyValueBackend {
  get<T = unknown>(store: string, key: string): Promise<T | undefined>;
  put(store: string, key: string, value: unknown): Promise<void>;
  del(store: string, key: string): Promise<void>;
}

export type BrowserFetch = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;

interface MiniIdbRequest<T = unknown> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
}

interface MiniIdbStore {
  get(key: string): MiniIdbRequest;
  put(val: unknown, key: string): MiniIdbRequest;
  delete(key: string): MiniIdbRequest;
}

interface MiniIdbTransaction {
  objectStore(name: string): MiniIdbStore;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  error: unknown;
}

interface MiniIdbDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): void;
  transaction(name: string, mode: string): MiniIdbTransaction;
}

function bytesToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function binaryStringToBase64(bin: string): string {
  return btoa(bin);
}

function base64ToBinaryString(b64: string): string {
  return atob(b64);
}

function equalBuffers(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  if (va.length !== vb.length) return false;
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function randomPositiveInt31(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] & 0x7fffffff) || 1;
}

function normalizeAddrName(addr: string): string {
  const idx = addr.indexOf('.');
  return idx === -1 ? addr : addr.slice(0, idx);
}

function makeDeviceAddress(userId: number, deviceId: number): SignalProtocolAddress {
  return new SignalProtocolAddress(`u:${userId}:${deviceId}`, 1);
}

export function createMemoryBackend(): KeyValueBackend {
  const stores = new Map<string, Map<string, unknown>>();
  const getMap = (name: string) => {
    let m = stores.get(name);
    if (!m) {
      m = new Map<string, unknown>();
      stores.set(name, m);
    }
    return m;
  };
  return {
    async get<T>(store: string, key: string) {
      return getMap(store).get(key) as T | undefined;
    },
    async put(store: string, key: string, value: unknown) {
      getMap(store).set(key, value);
    },
    async del(store: string, key: string) {
      getMap(store).delete(key);
    },
  };
}

function openIndexedDb(userId: number): Promise<MiniIdbDatabase> {
  return new Promise((resolve, reject) => {
    const idbFactory = (globalThis as unknown as { indexedDB?: { open(n: string, v: number): MiniIdbRequest<MiniIdbDatabase> } }).indexedDB;
    if (!idbFactory) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = idbFactory.open(`pg_signal_e2ee_u_${userId}`, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const names = ['meta', 'identityKeys', 'preKeys', 'signedPreKeys', 'sessions', 'msgCache', 'verified'];
      for (const n of names) {
        if (!db.objectStoreNames.contains(n)) {
          db.createObjectStore(n);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function createIdbBackend(userId: number): KeyValueBackend {
  let dbPromise: Promise<MiniIdbDatabase> | null = null;
  const getDb = () => {
    if (!dbPromise) dbPromise = openIndexedDb(userId);
    return dbPromise;
  };
  return {
    async get<T>(store: string, key: string): Promise<T | undefined> {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      });
    },
    async put(store: string, key: string, value: unknown): Promise<void> {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async del(store: string, key: string): Promise<void> {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

interface StoredKeyPair {
  pub: string;
  priv: string;
}

function serializeKeyPair(kp: KeyPairType): StoredKeyPair {
  return { pub: bytesToBase64(kp.pubKey), priv: bytesToBase64(kp.privKey) };
}

function deserializeKeyPair(raw: StoredKeyPair | undefined): KeyPairType | undefined {
  if (!raw || !raw.pub || !raw.priv) return undefined;
  return { pubKey: base64ToArrayBuffer(raw.pub), privKey: base64ToArrayBuffer(raw.priv) };
}

class SignalStore implements StorageType {
  private backend: KeyValueBackend;

  constructor(backend: KeyValueBackend) {
    this.backend = backend;
  }

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const raw = await this.backend.get<StoredKeyPair>('meta', 'identityKeyPair');
    return deserializeKeyPair(raw);
  }

  async setIdentityKeyPair(kp: KeyPairType): Promise<void> {
    await this.backend.put('meta', 'identityKeyPair', serializeKeyPair(kp));
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.backend.get<number>('meta', 'registrationId');
  }

  async setLocalRegistrationId(id: number): Promise<void> {
    await this.backend.put('meta', 'registrationId', id);
  }

  async getDeviceId(): Promise<number | undefined> {
    return this.backend.get<number>('meta', 'deviceId');
  }

  async setDeviceId(id: number): Promise<void> {
    await this.backend.put('meta', 'deviceId', id);
  }

  async getNextPreKeyId(): Promise<number> {
    const v = await this.backend.get<number>('meta', 'nextPreKeyId');
    return v && v > 0 ? v : 1;
  }

  async setNextPreKeyId(id: number): Promise<void> {
    await this.backend.put('meta', 'nextPreKeyId', id);
  }

  async getSignedPreKeyId(): Promise<number | undefined> {
    return this.backend.get<number>('meta', 'signedPreKeyId');
  }

  async setSignedPreKeyId(id: number): Promise<void> {
    await this.backend.put('meta', 'signedPreKeyId', id);
  }

  async getSignedPreKeySig(): Promise<string | undefined> {
    return this.backend.get<string>('meta', 'signedPreKeySig');
  }

  async setSignedPreKeySig(sigB64: string): Promise<void> {
    await this.backend.put('meta', 'signedPreKeySig', sigB64);
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction,
  ): Promise<boolean> {
    const key = normalizeAddrName(identifier);
    const existingB64 = await this.backend.get<string>('identityKeys', key);
    if (!existingB64) return true;
    return equalBuffers(base64ToArrayBuffer(existingB64), identityKey);
  }

  async getTrustedIdentityB64(identifier: string): Promise<string | undefined> {
    return this.backend.get<string>('identityKeys', normalizeAddrName(identifier));
  }

  async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer): Promise<boolean> {
    const key = normalizeAddrName(encodedAddress);
    const nextB64 = bytesToBase64(publicKey);
    const existing = await this.backend.get<string>('identityKeys', key);
    await this.backend.put('identityKeys', key, nextB64);
    return Boolean(existing && existing !== nextB64);
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const raw = await this.backend.get<StoredKeyPair>('preKeys', String(keyId));
    return deserializeKeyPair(raw);
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await this.backend.put('preKeys', String(keyId), serializeKeyPair(keyPair));
  }

  async removePreKey(keyId: number | string): Promise<void> {
    await this.backend.del('preKeys', String(keyId));
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const raw = await this.backend.get<StoredKeyPair>('signedPreKeys', String(keyId));
    return deserializeKeyPair(raw);
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await this.backend.put('signedPreKeys', String(keyId), serializeKeyPair(keyPair));
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    await this.backend.del('signedPreKeys', String(keyId));
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    return this.backend.get<SessionRecordType>('sessions', encodedAddress);
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    await this.backend.put('sessions', encodedAddress, record);
  }

  async removeSession(encodedAddress: string): Promise<void> {
    await this.backend.del('sessions', encodedAddress);
  }

  async getCachedMessage(msgId: number): Promise<DecryptedPayload | undefined> {
    return this.backend.get<DecryptedPayload>('msgCache', String(msgId));
  }

  async setCachedMessage(msgId: number, payload: DecryptedPayload): Promise<void> {
    await this.backend.put('msgCache', String(msgId), payload);
  }

  async getVerifiedFingerprint(partnerUserId: number): Promise<string | undefined> {
    return this.backend.get<string>('verified', String(partnerUserId));
  }

  async setVerifiedFingerprint(partnerUserId: number, fp: string | null): Promise<void> {
    if (fp) {
      await this.backend.put('verified', String(partnerUserId), fp);
    } else {
      await this.backend.del('verified', String(partnerUserId));
    }
  }
}

export class E2eeClient {
  private userId: number;
  private store: SignalStore;
  private fetchImpl: BrowserFetch;
  private initPromise: Promise<number> | null = null;
  private mediaUrlCache = new Map<string, string>();
  private decryptLocks = new Map<number, Promise<{ ok: boolean; payload?: DecryptedPayload; reason?: string }>>();

  constructor(userId: number, backend?: KeyValueBackend, fetchImpl?: BrowserFetch) {
    this.userId = userId;
    this.store = new SignalStore(backend || createIdbBackend(userId));
    this.fetchImpl =
      fetchImpl ||
      ((input: string, init?: Record<string, unknown>) =>
        (globalThis as unknown as { fetch: BrowserFetch }).fetch(input, init));
  }

  async ensureInitialized(): Promise<number> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async doInitialize(): Promise<number> {
    let deviceId = await this.store.getDeviceId();
    let regId = await this.store.getLocalRegistrationId();
    let identityKp = await this.store.getIdentityKeyPair();
    let spkId = await this.store.getSignedPreKeyId();
    let spkSigB64 = await this.store.getSignedPreKeySig();
    let spkKp = spkId ? await this.store.loadSignedPreKey(spkId) : undefined;

    let freshlyCreated = false;
    if (!deviceId || !regId || !identityKp || !spkId || !spkKp || !spkSigB64) {
      freshlyCreated = true;
      deviceId = randomPositiveInt31();
      regId = KeyHelper.generateRegistrationId();
      identityKp = await KeyHelper.generateIdentityKeyPair();
      spkId = 1;
      const signedPreKey = await KeyHelper.generateSignedPreKey(identityKp, spkId);
      spkKp = signedPreKey.keyPair;
      spkSigB64 = bytesToBase64(signedPreKey.signature);

      await this.store.setDeviceId(deviceId);
      await this.store.setLocalRegistrationId(regId);
      await this.store.setIdentityKeyPair(identityKp);
      await this.store.setSignedPreKeyId(spkId);
      await this.store.setSignedPreKeySig(spkSigB64);
      await this.store.storeSignedPreKey(spkId, spkKp);
      await this.store.setNextPreKeyId(1);
    }

    let needRegister = freshlyCreated;
    let prekeyCount = 0;

    if (!freshlyCreated) {
      const cntRes = await this.fetchImpl(`/api/e2ee/keys/count?device_id=${deviceId}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (cntRes.ok) {
        const cntData = (await cntRes.json()) as { registered?: boolean; prekey_count?: number };
        needRegister = !cntData.registered;
        prekeyCount = Number(cntData.prekey_count || 0);
      }
    }

    if (needRegister) {
      const prekeys = await this.generateAndStorePreKeys(INITIAL_PREKEY_COUNT);
      const regRes = await this.fetchImpl('/api/e2ee/keys/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          registration_id: regId,
          identity_key_pub: bytesToBase64(identityKp.pubKey),
          signed_prekey: {
            key_id: spkId,
            public_key: bytesToBase64(spkKp.pubKey),
            signature: spkSigB64,
          },
          prekeys,
        }),
      });
      if (!regRes.ok) {
        throw new Error('Failed to register E2EE device keys');
      }
    } else if (prekeyCount < LOW_PREKEY_THRESHOLD) {
      const prekeys = await this.generateAndStorePreKeys(REFILL_PREKEY_COUNT);
      await this.fetchImpl('/api/e2ee/keys/prekeys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, prekeys }),
      });
    }

    return deviceId;
  }

  private async generateAndStorePreKeys(
    count: number,
  ): Promise<Array<{ key_id: number; public_key: string }>> {
    const startId = await this.store.getNextPreKeyId();
    const out: Array<{ key_id: number; public_key: string }> = [];
    for (let i = 0; i < count; i++) {
      const keyId = startId + i;
      const pk = await KeyHelper.generatePreKey(keyId);
      await this.store.storePreKey(keyId, pk.keyPair);
      out.push({ key_id: keyId, public_key: bytesToBase64(pk.keyPair.pubKey) });
    }
    await this.store.setNextPreKeyId(startId + count);
    return out;
  }

  async getDeviceId(): Promise<number> {
    return this.ensureInitialized();
  }

  private async encryptAttachment(
    fileBytes: ArrayBuffer,
    mime: string,
  ): Promise<{ encryptedBlob: Blob; encryptedBytes: Uint8Array; mediaMeta: DecryptedMediaMeta }> {
    const cleanMime = (mime || '').toLowerCase();
    if (!ALLOWED_MEDIA_MIMES.has(cleanMime)) {
      throw Object.assign(new Error('Invalid image type'), { code: 'INVALID_IMAGE' });
    }
    if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_MEDIA_BYTES) {
      throw Object.assign(new Error('Image too large'), { code: 'IMAGE_TOO_LARGE' });
    }

    const aesKey = (await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )) as CryptoKey;
    const rawKey = (await crypto.subtle.exportKey('raw', aesKey)) as ArrayBuffer;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, fileBytes);
    const encBytes = new Uint8Array(ciphertext);
    const hashBuf = await crypto.subtle.digest('SHA-256', encBytes);

    return {
      encryptedBlob: new Blob([encBytes], { type: 'application/octet-stream' }),
      encryptedBytes: encBytes,
      mediaMeta: {
        aesKey: bytesToBase64(rawKey),
        iv: bytesToBase64(iv),
        sha256: bytesToBase64(hashBuf),
        mime: cleanMime,
      },
    };
  }

  async encryptMessage(opts: {
    partnerUserId: number;
    text: string;
    fileBytes?: ArrayBuffer | null;
    fileMime?: string;
  }): Promise<{
    senderDeviceId: number;
    envelopes: CipherEnvelopeItem[];
    encryptedBlob: Blob | null;
    encryptedBytes: Uint8Array | null;
    payload: DecryptedPayload;
  }> {
    const myDeviceId = await this.ensureInitialized();
    const cleanText = (opts.text || '').trim();
    if (!cleanText && !opts.fileBytes) {
      throw Object.assign(new Error('Empty message'), { code: 'EMPTY' });
    }
    if (cleanText.length > MAX_PLAIN_TEXT_LEN) {
      throw Object.assign(new Error('Message too long'), { code: 'TOO_LONG' });
    }

    let encryptedBlob: Blob | null = null;
    let encryptedBytes: Uint8Array | null = null;
    let mediaMeta: DecryptedMediaMeta | null = null;

    if (opts.fileBytes) {
      const enc = await this.encryptAttachment(opts.fileBytes, opts.fileMime || 'image/jpeg');
      encryptedBlob = enc.encryptedBlob;
      encryptedBytes = enc.encryptedBytes;
      mediaMeta = enc.mediaMeta;
    }

    const payload: DecryptedPayload = mediaMeta
      ? { v: 1, text: cleanText, media: mediaMeta }
      : { v: 1, text: cleanText };
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));
    const plaintextBuf = plaintextBytes.buffer.slice(
      plaintextBytes.byteOffset,
      plaintextBytes.byteOffset + plaintextBytes.byteLength,
    ) as ArrayBuffer;

    const [partnerIdRes, selfIdRes] = await Promise.all([
      this.fetchImpl(`/api/e2ee/keys/identities?user_id=${opts.partnerUserId}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      }),
      this.fetchImpl(`/api/e2ee/keys/identities?user_id=${this.userId}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    ]);

    if (!partnerIdRes.ok) {
      throw Object.assign(new Error('Key lookup failed'), { code: 'NETWORK' });
    }

    const partnerIdsData = (await partnerIdRes.json()) as {
      devices?: Array<{ device_id: number; identity_key_pub: string }>;
    };
    const selfIdsData = selfIdRes.ok
      ? ((await selfIdRes.json()) as {
          devices?: Array<{ device_id: number; identity_key_pub: string }>;
        })
      : { devices: [] };

    const partnerDevs = partnerIdsData.devices || [];
    if (partnerDevs.length === 0) {
      throw Object.assign(new Error('Partner has no E2EE keys'), { code: 'PARTNER_NOT_READY' });
    }

    const selfOtherDevs = (selfIdsData.devices || []).filter(
      (d) => Number(d.device_id) !== Number(myDeviceId),
    );

    const targets: Array<{ userId: number; deviceId: number; identityKeyPub: string }> = [
      ...partnerDevs.map((d) => ({
        userId: opts.partnerUserId,
        deviceId: Number(d.device_id),
        identityKeyPub: d.identity_key_pub,
      })),
      ...selfOtherDevs.map((d) => ({
        userId: this.userId,
        deviceId: Number(d.device_id),
        identityKeyPub: d.identity_key_pub,
      })),
    ];

    const needSessionKeys = new Set<string>();
    for (const target of targets) {
      const addr = makeDeviceAddress(target.userId, target.deviceId);
      const trustedB64 = await this.store.getTrustedIdentityB64(addr.getName());
      if (trustedB64 && trustedB64 !== target.identityKeyPub) {
        throw Object.assign(new Error('Identity key changed'), {
          code: 'KEY_CHANGED',
          userId: target.userId,
          deviceId: target.deviceId,
          identityKey: target.identityKeyPub,
        });
      }
      const cipher = new SessionCipher(this.store, addr);
      const hasSession = await cipher.hasOpenSession();
      if (!hasSession) {
        needSessionKeys.add(`${target.userId}:${target.deviceId}`);
      }
    }

    if (needSessionKeys.size > 0) {
      const bRes = await this.fetchImpl(
        `/api/e2ee/keys/bundle?user_id=${opts.partnerUserId}&include_self=1&self_device_id=${myDeviceId}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!bRes.ok) {
        throw Object.assign(new Error('Bundle fetch failed'), { code: 'NETWORK' });
      }
      const bData = (await bRes.json()) as {
        devices?: Array<{
          user_id: number;
          device_id: number;
          registration_id: number;
          identity_key_pub: string;
          signed_prekey: { key_id: number; public_key: string; signature: string };
          prekey: { key_id: number; public_key: string } | null;
        }>;
        self_devices?: Array<{
          user_id: number;
          device_id: number;
          registration_id: number;
          identity_key_pub: string;
          signed_prekey: { key_id: number; public_key: string; signature: string };
          prekey: { key_id: number; public_key: string } | null;
        }>;
      };

      const allBundles = [...(bData.devices || []), ...(bData.self_devices || [])];
      for (const b of allBundles) {
        const key = `${b.user_id}:${b.device_id}`;
        if (!needSessionKeys.has(key)) continue;
        const addr = makeDeviceAddress(Number(b.user_id), Number(b.device_id));
        const builder = new SessionBuilder(this.store, addr);
        const deviceBundle: DeviceType = {
          registrationId: Number(b.registration_id),
          identityKey: base64ToArrayBuffer(b.identity_key_pub),
          signedPreKey: {
            keyId: Number(b.signed_prekey.key_id),
            publicKey: base64ToArrayBuffer(b.signed_prekey.public_key),
            signature: base64ToArrayBuffer(b.signed_prekey.signature),
          },
          preKey: b.prekey
            ? {
                keyId: Number(b.prekey.key_id),
                publicKey: base64ToArrayBuffer(b.prekey.public_key),
              }
            : undefined,
        };
        await builder.processPreKey(deviceBundle);
      }
    }

    const envelopes: CipherEnvelopeItem[] = [];
    for (const target of targets) {
      const addr = makeDeviceAddress(target.userId, target.deviceId);
      const cipher = new SessionCipher(this.store, addr);
      const encResult = await cipher.encrypt(plaintextBuf);
      if (!encResult || !encResult.body) continue;
      envelopes.push({
        u: target.userId,
        d: target.deviceId,
        t: Number(encResult.type),
        b: binaryStringToBase64(encResult.body),
      });
    }

    if (!envelopes.some((e) => e.u === opts.partnerUserId)) {
      throw Object.assign(new Error('Encryption produced no recipient envelopes'), { code: 'ENCRYPT_FAILED' });
    }

    return {
      senderDeviceId: myDeviceId,
      envelopes,
      encryptedBlob,
      encryptedBytes,
      payload,
    };
  }

  async cacheSentMessage(msgId: number, payload: DecryptedPayload): Promise<void> {
    if (msgId > 0) {
      await this.store.setCachedMessage(msgId, payload);
    }
  }

  async getCachedMessage(msgId: number): Promise<DecryptedPayload | undefined> {
    if (!msgId || msgId <= 0) return undefined;
    return this.store.getCachedMessage(msgId);
  }

  async decryptMessage(
    msg: IncomingEncryptedMessage,
  ): Promise<{ ok: boolean; payload?: DecryptedPayload; reason?: string }> {
    const msgId = Number(msg.id || 0);
    if (!msg.is_encrypted) {
      return { ok: true, payload: { v: 0, text: msg.body || '' } };
    }

    if (msgId > 0) {
      const cached = await this.store.getCachedMessage(msgId);
      if (cached) return { ok: true, payload: cached };
      const inFlight = this.decryptLocks.get(msgId);
      if (inFlight) return inFlight;
    }

    const work = this.doDecryptMessage(msg).finally(() => {
      if (msgId > 0) this.decryptLocks.delete(msgId);
    });
    if (msgId > 0) this.decryptLocks.set(msgId, work);
    return work;
  }

  private async doDecryptMessage(
    msg: IncomingEncryptedMessage,
  ): Promise<{ ok: boolean; payload?: DecryptedPayload; reason?: string }> {
    const myDeviceId = await this.ensureInitialized();
    const senderDeviceId = Number(msg.sender_device_id || 0);
    if (!senderDeviceId || !msg.ciphertext_envelope) {
      return { ok: false, reason: 'NO_ENVELOPE' };
    }

    let items: CipherEnvelopeItem[] = [];
    try {
      const parsed = JSON.parse(msg.ciphertext_envelope);
      if (Array.isArray(parsed)) items = parsed as CipherEnvelopeItem[];
    } catch {
      return { ok: false, reason: 'BAD_ENVELOPE' };
    }

    const target = items.find(
      (i) => Number(i.u) === Number(this.userId) && Number(i.d) === Number(myDeviceId),
    );
    if (!target || !target.b) {
      return { ok: false, reason: 'NOT_FOR_THIS_DEVICE' };
    }

    try {
      const senderAddr = makeDeviceAddress(Number(msg.sender_id), senderDeviceId);
      const cipher = new SessionCipher(this.store, senderAddr);
      const binStr = base64ToBinaryString(target.b);
      const plainBuf =
        Number(target.t) === 3
          ? await cipher.decryptPreKeyWhisperMessage(binStr, 'binary')
          : await cipher.decryptWhisperMessage(binStr, 'binary');

      const rawText = new TextDecoder().decode(plainBuf);
      const parsed = JSON.parse(rawText) as DecryptedPayload;
      const payload: DecryptedPayload = {
        v: Number(parsed?.v || 1),
        text: typeof parsed?.text === 'string' ? parsed.text : '',
        media: parsed?.media || null,
      };

      if (msg.id > 0) {
        await this.store.setCachedMessage(msg.id, payload);
      }
      return { ok: true, payload };
    } catch {
      return { ok: false, reason: 'DECRYPT_ERROR' };
    }
  }

  async decryptMediaBytes(
    encryptedBytes: ArrayBuffer | Uint8Array,
    mediaMeta: DecryptedMediaMeta,
  ): Promise<ArrayBuffer> {
    const encU8 = encryptedBytes instanceof Uint8Array ? encryptedBytes : new Uint8Array(encryptedBytes);
    const digest = await crypto.subtle.digest('SHA-256', encU8);
    const expectedDigest = base64ToArrayBuffer(mediaMeta.sha256);
    if (!equalBuffers(digest, expectedDigest)) {
      throw new Error('Encrypted media integrity check failed');
    }
    const aesKey = await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(mediaMeta.aesKey),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const iv = new Uint8Array(base64ToArrayBuffer(mediaMeta.iv));
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encU8);
  }

  async decryptMediaToObjectUrl(imageKey: string, mediaMeta: DecryptedMediaMeta): Promise<string> {
    if (this.mediaUrlCache.has(imageKey)) {
      return this.mediaUrlCache.get(imageKey)!;
    }
    const res = await this.fetchImpl(`/media/${encodeURIComponent(imageKey)}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('Failed to download encrypted media');
    const encBuf = await res.arrayBuffer();
    const plainBuf = await this.decryptMediaBytes(encBuf, mediaMeta);
    const safeMime = ALLOWED_MEDIA_MIMES.has((mediaMeta.mime || '').toLowerCase())
      ? mediaMeta.mime
      : 'image/jpeg';
    const url = URL.createObjectURL(new Blob([plainBuf], { type: safeMime }));
    this.mediaUrlCache.set(imageKey, url);
    return url;
  }

  revokeAllMediaUrls(): void {
    this.mediaUrlCache.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    this.mediaUrlCache.clear();
  }

  async getSafetyNumber(partnerUserId: number): Promise<{
    ready: boolean;
    fingerprint: string;
    formatted: string;
    verified: boolean;
    partnerDeviceCount: number;
  }> {
    await this.ensureInitialized();
    const myIdentity = await this.store.getIdentityKeyPair();
    if (!myIdentity) {
      return { ready: false, fingerprint: '', formatted: '', verified: false, partnerDeviceCount: 0 };
    }

    const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${partnerUserId}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ready: false, fingerprint: '', formatted: '', verified: false, partnerDeviceCount: 0 };
    }
    const data = (await res.json()) as {
      devices?: Array<{ device_id: number; identity_key_pub: string }>;
    };
    const devs = data.devices || [];
    if (devs.length === 0) {
      return { ready: false, fingerprint: '', formatted: '', verified: false, partnerDeviceCount: 0 };
    }

    const primaryPartnerKey = base64ToArrayBuffer(devs[0].identity_key_pub);
    const gen = new FingerprintGenerator(5200);
    const fp = await gen.createFor(
      String(this.userId),
      myIdentity.pubKey,
      String(partnerUserId),
      primaryPartnerKey,
    );
    const groups = fp.match(/.{1,5}/g) || [fp];
    const formatted = groups.join(' ');
    const savedVerified = await this.store.getVerifiedFingerprint(partnerUserId);

    return {
      ready: true,
      fingerprint: fp,
      formatted,
      verified: Boolean(savedVerified && savedVerified === fp),
      partnerDeviceCount: devs.length,
    };
  }

  async setVerified(partnerUserId: number, fingerprint: string | null): Promise<void> {
    await this.store.setVerifiedFingerprint(partnerUserId, fingerprint);
  }

  async acceptKeyChange(
    targetUserId: number,
    targetDeviceId: number,
    newIdentityKeyB64: string,
  ): Promise<void> {
    const addr = makeDeviceAddress(targetUserId, targetDeviceId);
    await this.store.saveIdentity(addr.toString(), base64ToArrayBuffer(newIdentityKeyB64));
    await this.store.removeSession(addr.toString());
    await this.store.setVerifiedFingerprint(targetUserId, null);
  }
}

const clientCache = new Map<number, E2eeClient>();

export function getE2eeClient(userId: number): E2eeClient {
  let c = clientCache.get(userId);
  if (!c) {
    c = new E2eeClient(userId);
    clientCache.set(userId, c);
  }
  return c;
}

const globalObj = globalThis as unknown as { PhotogramE2EE?: unknown };
if (globalObj) {
  globalObj.PhotogramE2EE = {
    getClient: getE2eeClient,
    E2eeClient,
  };
}
