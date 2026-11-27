import {
  KeyHelper,
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
  Direction,
  StorageType,
  KeyPairType,
  SessionRecordType,
  DeviceType,
} from '@privacyresearch/libsignal-protocol-typescript';

const INITIAL_PREKEY_COUNT = 50;
const LOW_PREKEY_THRESHOLD = 15;
const REFILL_PREKEY_COUNT = 40;
const SPK_ROTATE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLAIN_TEXT_LEN = 2000;
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_BYTES = 1536 * 1024;
const MAX_VOICE_DURATION_MS = 120_000;
const MAX_WAVEFORM_BARS = 40;
const MAX_REPLY_NAME_LEN = 40;
const MAX_REPLY_PREVIEW_LEN = 120;
const ALLOWED_MEDIA_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VOICE_MIMES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
]);

function normalizeAudioMime(raw: string): string {
  return String(raw || '').toLowerCase().replace(/\s*;\s*/g, ';').trim();
}

function sanitizeWaveform(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: number[] = [];
  const cap = Math.min(raw.length, MAX_WAVEFORM_BARS);
  for (let i = 0; i < cap; i++) {
    const v = Number(raw[i]);
    out.push(Number.isFinite(v) ? Math.max(4, Math.min(100, Math.round(v))) : 12);
  }
  return out;
}

export interface DecryptedMediaMeta {
  aesKey: string;
  iv: string;
  sha256: string;
  mime: string;
  kind?: 'image' | 'voice';
  durationMs?: number;
  waveform?: number[];
}

export interface DecryptedReplyMeta {
  id: number;
  senderId: number;
  senderName: string;
  preview: string;
  kind?: 'text' | 'image' | 'voice' | 'post';
  videoId?: string;
}

export interface DecryptedSharedPostMeta {
  postId: number;
  authorUsername: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  imageKey: string;
  caption?: string;
}

export interface DecryptedLinkPreviewMeta {
  url: string;
  siteName: string;
  title: string;
  description?: string;
  image?: string;
  videoId?: string;
  startSec?: number;
}

const SHARED_USERNAME_RE = /^[a-zA-Z0-9._]{1,40}$/;
const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (!s || s.length > 2048 || /[\x00-\x1f\x7f\s]/.test(s)) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username || u.password) return false;
    if (!u.hostname || !u.hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}

export function sanitizeLinkPreviewMeta(raw: unknown): DecryptedLinkPreviewMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!isSafeHttpUrl(r.url)) return undefined;
  const title = typeof r.title === 'string' ? r.title.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
  const siteName = typeof r.siteName === 'string' ? r.siteName.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  const description =
    typeof r.description === 'string' ? r.description.replace(/\s+/g, ' ').trim().slice(0, 260) : '';
  if (!title && !description) return undefined;
  const out: DecryptedLinkPreviewMeta = {
    url: r.url.trim(),
    siteName: siteName || new URL(r.url.trim()).hostname.replace(/^www\./i, '').slice(0, 60),
    title: title || siteName,
  };
  if (description) out.description = description;
  if (isSafeHttpUrl(r.image)) out.image = r.image.trim();
  if (typeof r.videoId === 'string' && YT_VIDEO_ID_RE.test(r.videoId.trim())) {
    out.videoId = r.videoId.trim();
  }
  const startSec = Math.floor(Number(r.startSec || 0));
  if (Number.isFinite(startSec) && startSec > 0 && startSec <= 86400) {
    out.startSec = startSec;
  }
  return out;
}

function isSafeSharedMediaKey(raw: unknown, prefix: string): raw is string {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (!s || s.length > 200) return false;
  if (!s.startsWith(prefix)) return false;
  if (s.includes('..') || s.includes('\\') || s.includes('?') || s.includes('#')) return false;
  if (/[\x00-\x20\x7f"'<>]/.test(s)) return false;
  return true;
}

export function sanitizeSharedPostMeta(raw: unknown): DecryptedSharedPostMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const postId = Math.floor(Number(r.postId || 0));
  if (!Number.isFinite(postId) || postId <= 0 || postId > 2147483647) return undefined;
  const authorUsername = typeof r.authorUsername === 'string' ? r.authorUsername.trim() : '';
  if (!SHARED_USERNAME_RE.test(authorUsername)) return undefined;
  if (!isSafeSharedMediaKey(r.imageKey, 'posts/')) return undefined;
  const imageKey = r.imageKey.trim();
  const out: DecryptedSharedPostMeta = {
    postId,
    authorUsername,
    imageKey,
  };
  if (isSafeSharedMediaKey(r.authorAvatar, 'avatars/')) {
    out.authorAvatar = r.authorAvatar.trim();
  }
  if (r.authorVerified === true || Number(r.authorVerified) === 1) {
    out.authorVerified = true;
  }
  if (typeof r.caption === 'string') {
    const cleanCap = r.caption.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (cleanCap) out.caption = cleanCap;
  }
  return out;
}

function sanitizeReplyMeta(raw: unknown): DecryptedReplyMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const id = Math.floor(Number(r.id || 0));
  if (!Number.isFinite(id) || id <= 0) return undefined;
  const senderId = Math.max(0, Math.floor(Number(r.senderId || 0)));
  const senderName = typeof r.senderName === 'string' ? r.senderName.trim().slice(0, MAX_REPLY_NAME_LEN) : '';
  const preview = typeof r.preview === 'string' ? r.preview.replace(/\s+/g, ' ').trim().slice(0, MAX_REPLY_PREVIEW_LEN) : '';
  const rawKind = r.kind === 'image' || r.kind === 'voice' || r.kind === 'post' ? r.kind : 'text';
  if (!senderName && !preview) return undefined;
  const out: DecryptedReplyMeta = {
    id,
    senderId,
    senderName,
    preview,
    kind: rawKind,
  };
  if (typeof r.videoId === 'string' && YT_VIDEO_ID_RE.test(r.videoId.trim())) {
    out.videoId = r.videoId.trim();
  }
  return out;
}

export interface DecryptedPayload {
  v: number;
  text: string;
  media?: DecryptedMediaMeta | null;
  reply?: DecryptedReplyMeta | null;
  sharedPost?: DecryptedSharedPostMeta | null;
  linkPreview?: DecryptedLinkPreviewMeta | null;
  editOf?: number;
  editVersion?: number;
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
  edit_version?: number;
}

export interface KeyValueBackend {
  get<T = unknown>(store: string, key: string): Promise<T | undefined>;
  getMany?<T = unknown>(store: string, keys: string[]): Promise<Map<string, T>>;
  put(store: string, key: string, value: unknown): Promise<void>;
  del(store: string, key: string): Promise<void>;
  close?(): Promise<void>;
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
  close?: () => void;
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
    async getMany<T>(store: string, keys: string[]): Promise<Map<string, T>> {
      const m = getMap(store);
      const out = new Map<string, T>();
      for (const k of keys) {
        if (m.has(k)) out.set(k, m.get(k) as T);
      }
      return out;
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
    async getMany<T>(store: string, keys: string[]): Promise<Map<string, T>> {
      const out = new Map<string, T>();
      if (!keys.length) return out;
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const os = tx.objectStore(store);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const req = os.get(k);
          req.onsuccess = () => {
            if (req.result !== undefined) out.set(k, req.result as T);
          };
        }
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
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
    async close(): Promise<void> {
      if (!dbPromise) return;
      try {
        const db = await dbPromise;
        if (db && typeof db.close === 'function') db.close();
      } catch {}
      dbPromise = null;
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

  async getSignedPreKeyCreatedAt(): Promise<number> {
    const v = await this.backend.get<number>('meta', 'spkCreatedAt');
    return v && v > 0 ? v : 0;
  }

  async setSignedPreKeyCreatedAt(ts: number): Promise<void> {
    await this.backend.put('meta', 'spkCreatedAt', ts);
  }

  async getKnownDevices(partnerUserId: number): Promise<number[]> {
    const raw = await this.backend.get<number[]>('meta', `known_devices_${partnerUserId}`);
    return Array.isArray(raw) ? raw.map((x) => Number(x)).filter((x) => x > 0) : [];
  }

  async setKnownDevices(partnerUserId: number, deviceIds: number[]): Promise<void> {
    const clean = Array.from(new Set(deviceIds.map((x) => Number(x)).filter((x) => x > 0)));
    await this.backend.put('meta', `known_devices_${partnerUserId}`, clean);
  }

  async closeBackend(): Promise<void> {
    if (this.backend.close) {
      await this.backend.close();
    }
  }

  async isTrustedIdentity(
    _identifier: string,
    _identityKey: ArrayBuffer,
    _direction: Direction,
  ): Promise<boolean> {
    return true;
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

  async forceSaveIdentity(encodedAddress: string, publicKey: ArrayBuffer): Promise<void> {
    const key = normalizeAddrName(encodedAddress);
    const nextB64 = bytesToBase64(publicKey);
    await this.backend.put('identityKeys', key, nextB64);
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

  async getCachedMessagesBatch(msgIds: number[]): Promise<Map<number, DecryptedPayload>> {
    const out = new Map<number, DecryptedPayload>();
    const unique = Array.from(new Set(msgIds.filter((n) => Number.isFinite(n) && n > 0)));
    if (!unique.length) return out;
    if (typeof this.backend.getMany === 'function') {
      const raw = await this.backend.getMany<DecryptedPayload>('msgCache', unique.map(String));
      for (const id of unique) {
        const val = raw.get(String(id));
        if (val) out.set(id, val);
      }
      return out;
    }
    const vals = await Promise.all(unique.map((id) => this.backend.get<DecryptedPayload>('msgCache', String(id))));
    for (let i = 0; i < unique.length; i++) {
      if (vals[i]) out.set(unique[i], vals[i] as DecryptedPayload);
    }
    return out;
  }

  async setCachedMessage(msgId: number, payload: DecryptedPayload): Promise<void> {
    await this.backend.put('msgCache', String(msgId), payload);
  }

  async removeCachedMessage(msgId: number): Promise<void> {
    await this.backend.del('msgCache', String(msgId));
  }
}

export class E2eeClient {
  private userId: number;
  private store: SignalStore;
  private fetchImpl: BrowserFetch;
  private initPromise: Promise<number> | null = null;
  private mediaUrlCache = new Map<string, string>();
  private memMsgCache = new Map<number, DecryptedPayload>();
  private decryptLocks = new Map<
    string,
    Promise<{ ok: boolean; payload?: DecryptedPayload; reason?: string; userId?: number; deviceId?: number; identityKey?: string }>
  >();

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
      await this.store.setSignedPreKeyCreatedAt(Date.now());
      await this.store.storeSignedPreKey(spkId, spkKp);
      await this.store.setNextPreKeyId(1);
    }

    let needRegister = freshlyCreated;
    let prekeyCount = 0;

    if (!freshlyCreated) {
      const spkCreatedAt = await this.store.getSignedPreKeyCreatedAt();
      if (!spkCreatedAt) {
        await this.store.setSignedPreKeyCreatedAt(Date.now());
      } else if (Date.now() - spkCreatedAt > SPK_ROTATE_MS) {
        spkId = (spkId || 1) + 1;
        const rotatedSpk = await KeyHelper.generateSignedPreKey(identityKp, spkId);
        spkKp = rotatedSpk.keyPair;
        spkSigB64 = bytesToBase64(rotatedSpk.signature);
        await this.store.setSignedPreKeyId(spkId);
        await this.store.setSignedPreKeySig(spkSigB64);
        await this.store.setSignedPreKeyCreatedAt(Date.now());
        await this.store.storeSignedPreKey(spkId, spkKp);
        needRegister = true;
      }

      const cntRes = await this.fetchImpl(`/api/e2ee/keys/count?device_id=${deviceId}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (cntRes.ok) {
        const cntData = (await cntRes.json()) as { registered?: boolean; prekey_count?: number };
        if (!cntData.registered) needRegister = true;
        prekeyCount = Number(cntData.prekey_count || 0);
      }
    }

    if (needRegister) {
      const prekeys = prekeyCount < LOW_PREKEY_THRESHOLD
        ? await this.generateAndStorePreKeys(INITIAL_PREKEY_COUNT)
        : [];
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
    mediaKind: 'image' | 'voice' = 'image',
    voiceDurationMs?: number,
    voiceWaveform?: number[],
  ): Promise<{ encryptedBlob: Blob; encryptedBytes: Uint8Array; mediaMeta: DecryptedMediaMeta }> {
    const isVoice = mediaKind === 'voice';
    const cleanMime = isVoice ? normalizeAudioMime(mime) : (mime || '').toLowerCase();
    if (isVoice) {
      if (!ALLOWED_VOICE_MIMES.has(cleanMime)) {
        throw Object.assign(new Error('Invalid audio type'), { code: 'INVALID_VOICE' });
      }
      if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_VOICE_BYTES) {
        throw Object.assign(new Error('Voice message too large'), { code: 'VOICE_TOO_LARGE' });
      }
    } else {
      if (!ALLOWED_MEDIA_MIMES.has(cleanMime)) {
        throw Object.assign(new Error('Invalid image type'), { code: 'INVALID_IMAGE' });
      }
      if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_MEDIA_BYTES) {
        throw Object.assign(new Error('Image too large'), { code: 'IMAGE_TOO_LARGE' });
      }
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

    const mediaMeta: DecryptedMediaMeta = {
      aesKey: bytesToBase64(rawKey),
      iv: bytesToBase64(iv),
      sha256: bytesToBase64(hashBuf),
      mime: cleanMime,
    };
    if (isVoice) {
      mediaMeta.kind = 'voice';
      const dur = Number(voiceDurationMs || 0);
      mediaMeta.durationMs = Number.isFinite(dur) ? Math.max(0, Math.min(MAX_VOICE_DURATION_MS, Math.round(dur))) : 0;
      const wf = sanitizeWaveform(voiceWaveform);
      if (wf) mediaMeta.waveform = wf;
    }

    return {
      encryptedBlob: new Blob([encBytes], { type: 'application/octet-stream' }),
      encryptedBytes: encBytes,
      mediaMeta,
    };
  }

  async encryptMessage(opts: {
    partnerUserId: number;
    text: string;
    fileBytes?: ArrayBuffer | null;
    fileMime?: string;
    mediaKind?: 'image' | 'voice';
    voiceDurationMs?: number;
    voiceWaveform?: number[];
    existingMedia?: DecryptedMediaMeta | null;
    reply?: DecryptedReplyMeta | null;
    sharedPost?: DecryptedSharedPostMeta | null;
    linkPreview?: DecryptedLinkPreviewMeta | null;
    editOf?: number;
  }): Promise<{
    senderDeviceId: number;
    envelopes: CipherEnvelopeItem[];
    encryptedBlob: Blob | null;
    encryptedBytes: Uint8Array | null;
    payload: DecryptedPayload;
  }> {
    const myDeviceId = await this.ensureInitialized();
    const cleanText = (opts.text || '').trim();
    const cleanSharedPost = sanitizeSharedPostMeta(opts.sharedPost);
    const cleanLinkPreview = sanitizeLinkPreviewMeta(opts.linkPreview);
    if (!cleanText && !opts.fileBytes && !opts.existingMedia && !cleanSharedPost) {
      throw Object.assign(new Error('Empty message'), { code: 'EMPTY' });
    }
    if (cleanText.length > MAX_PLAIN_TEXT_LEN) {
      throw Object.assign(new Error('Message too long'), { code: 'TOO_LONG' });
    }

    let encryptedBlob: Blob | null = null;
    let encryptedBytes: Uint8Array | null = null;
    let mediaMeta: DecryptedMediaMeta | null = null;

    if (opts.fileBytes) {
      const kind = opts.mediaKind === 'voice' ? 'voice' : 'image';
      const enc = await this.encryptAttachment(
        opts.fileBytes,
        opts.fileMime || (kind === 'voice' ? 'audio/webm' : 'image/jpeg'),
        kind,
        opts.voiceDurationMs,
        opts.voiceWaveform,
      );
      encryptedBlob = enc.encryptedBlob;
      encryptedBytes = enc.encryptedBytes;
      mediaMeta = enc.mediaMeta;
    } else if (opts.existingMedia) {
      mediaMeta = opts.existingMedia;
    }

    const payload: DecryptedPayload = mediaMeta
      ? { v: 1, text: cleanText, media: mediaMeta }
      : { v: 1, text: cleanText };
    const cleanReply = sanitizeReplyMeta(opts.reply);
    if (cleanReply) {
      payload.reply = cleanReply;
    }
    if (cleanSharedPost) {
      payload.sharedPost = cleanSharedPost;
    }
    if (cleanLinkPreview) {
      payload.linkPreview = cleanLinkPreview;
    }
    if (opts.editOf && Number(opts.editOf) > 0) {
      payload.editOf = Number(opts.editOf);
    }
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));
    const plaintextBuf = plaintextBytes.buffer.slice(
      plaintextBytes.byteOffset,
      plaintextBytes.byteOffset + plaintextBytes.byteLength,
    ) as ArrayBuffer;

    const idRes = await this.fetchImpl(
      `/api/e2ee/keys/identities?user_id=${opts.partnerUserId}&include_self=1`,
      {
        credentials: 'same-origin',
        cache: 'no-store',
      },
    );

    if (!idRes.ok) {
      throw Object.assign(new Error('Key lookup failed'), { code: 'NETWORK' });
    }

    const idsData = (await idRes.json()) as {
      devices?: Array<{ device_id: number; identity_key_pub: string }>;
      self_devices?: Array<{ device_id: number; identity_key_pub: string }>;
    };

    const partnerDevs = idsData.devices || [];
    const selfDevs = Array.isArray(idsData.self_devices) ? idsData.self_devices : [];

    if (partnerDevs.length === 0) {
      throw Object.assign(new Error('Partner has no E2EE keys'), { code: 'PARTNER_NOT_READY' });
    }

    const knownPartnerDevs = await this.store.getKnownDevices(opts.partnerUserId);
    const mergedPartnerDevs = Array.from(
      new Set([...knownPartnerDevs, ...partnerDevs.map((d) => Number(d.device_id))]),
    );
    if (mergedPartnerDevs.length !== knownPartnerDevs.length) {
      await this.store.setKnownDevices(opts.partnerUserId, mergedPartnerDevs);
    }

    const selfOtherDevs = selfDevs.filter(
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
    await Promise.all(
      targets.map(async (target) => {
        const addr = makeDeviceAddress(target.userId, target.deviceId);
        const trustedB64 = await this.store.getTrustedIdentityB64(addr.getName());
        if (trustedB64 && trustedB64 !== target.identityKeyPub) {
          await this.store.forceSaveIdentity(addr.getName(), base64ToArrayBuffer(target.identityKeyPub));
          await this.store.removeSession(addr.toString());
          needSessionKeys.add(`${target.userId}:${target.deviceId}`);
          return;
        }
        const cipher = new SessionCipher(this.store, addr);
        const hasSession = await cipher.hasOpenSession();
        if (!hasSession) {
          needSessionKeys.add(`${target.userId}:${target.deviceId}`);
        }
      }),
    );

    if (needSessionKeys.size > 0) {
      const bRes = await this.fetchImpl('/api/e2ee/keys/bundle', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: opts.partnerUserId,
          include_self: true,
          self_device_id: myDeviceId,
        }),
      });
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
      await Promise.all(
        allBundles.map(async (b) => {
          const key = `${b.user_id}:${b.device_id}`;
          if (!needSessionKeys.has(key)) return;
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
          try {
            await builder.processPreKey(deviceBundle);
          } catch {}
        }),
      );
    }

    const encryptedItems = await Promise.all(
      targets.map(async (target): Promise<CipherEnvelopeItem | null> => {
        const addr = makeDeviceAddress(target.userId, target.deviceId);
        const cipher = new SessionCipher(this.store, addr);
        try {
          const hasSession = await cipher.hasOpenSession();
          if (!hasSession) return null;
          const encResult = await cipher.encrypt(plaintextBuf);
          if (!encResult || !encResult.body) return null;
          return {
            u: target.userId,
            d: target.deviceId,
            t: Number(encResult.type),
            b: binaryStringToBase64(encResult.body),
          };
        } catch {
          return null;
        }
      }),
    );
    const envelopes: CipherEnvelopeItem[] = encryptedItems.filter(
      (item): item is CipherEnvelopeItem => item !== null,
    );

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

  async cacheSentMessage(msgId: number, payload: DecryptedPayload, editVersion: number = 0): Promise<void> {
    if (msgId > 0) {
      const entry: DecryptedPayload = {
        ...payload,
        editVersion: Math.max(0, Number(editVersion || 0)),
      };
      this.memMsgCache.set(msgId, entry);
      await this.store.setCachedMessage(msgId, entry);
    }
  }

  async getCachedMessage(msgId: number): Promise<DecryptedPayload | undefined> {
    if (!msgId || msgId <= 0) return undefined;
    const mem = this.memMsgCache.get(msgId);
    if (mem) return mem;
    const stored = await this.store.getCachedMessage(msgId);
    if (stored) this.memMsgCache.set(msgId, stored);
    return stored;
  }

  async getCachedMessagesBatch(msgIds: number[]): Promise<Map<number, DecryptedPayload>> {
    const out = new Map<number, DecryptedPayload>();
    const missing: number[] = [];
    for (let i = 0; i < msgIds.length; i++) {
      const id = Number(msgIds[i]);
      if (!Number.isFinite(id) || id <= 0) continue;
      const mem = this.memMsgCache.get(id);
      if (mem) out.set(id, mem);
      else missing.push(id);
    }
    if (missing.length > 0) {
      const fromDb = await this.store.getCachedMessagesBatch(missing);
      fromDb.forEach((val, id) => {
        this.memMsgCache.set(id, val);
        out.set(id, val);
      });
    }
    return out;
  }

  async decryptMessage(
    msg: IncomingEncryptedMessage,
  ): Promise<{
    ok: boolean;
    payload?: DecryptedPayload;
    reason?: string;
    userId?: number;
    deviceId?: number;
    identityKey?: string;
  }> {
    const msgId = Number(msg.id || 0);
    const expectedVersion = Math.max(0, Number(msg.edit_version || 0));
    if (!msg.is_encrypted) {
      return { ok: true, payload: { v: 0, text: msg.body || '', editVersion: expectedVersion } };
    }

    const lockKey = `${msgId}:${expectedVersion}`;
    if (msgId > 0) {
      const mem = this.memMsgCache.get(msgId);
      if (mem && Number(mem.editVersion || 0) >= expectedVersion) {
        return { ok: true, payload: mem };
      }
      const cached = await this.store.getCachedMessage(msgId);
      if (cached && Number(cached.editVersion || 0) >= expectedVersion) {
        this.memMsgCache.set(msgId, cached);
        return { ok: true, payload: cached };
      }
      const inFlight = this.decryptLocks.get(lockKey);
      if (inFlight) return inFlight;
    }

    const work = this.doDecryptMessage(msg).finally(() => {
      if (msgId > 0) this.decryptLocks.delete(lockKey);
    });
    if (msgId > 0) this.decryptLocks.set(lockKey, work);
    return work;
  }

  private async doDecryptMessage(
    msg: IncomingEncryptedMessage,
  ): Promise<{
    ok: boolean;
    payload?: DecryptedPayload;
    reason?: string;
    userId?: number;
    deviceId?: number;
    identityKey?: string;
  }> {
    const myDeviceId = await this.ensureInitialized();
    const senderId = Number(msg.sender_id || 0);
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
      const senderAddr = makeDeviceAddress(senderId, senderDeviceId);
      const cipher = new SessionCipher(this.store, senderAddr);
      const binStr = base64ToBinaryString(target.b);
      const plainBuf =
        Number(target.t) === 3
          ? await cipher.decryptPreKeyWhisperMessage(binStr, 'binary')
          : await cipher.decryptWhisperMessage(binStr, 'binary');

      const rawText = new TextDecoder().decode(plainBuf);
      const parsed = JSON.parse(rawText) as DecryptedPayload;
      const expectedVersion = Math.max(0, Number(msg.edit_version || 0));
      if (expectedVersion > 0 && Number(parsed?.editOf) !== Number(msg.id)) {
        return { ok: false, reason: 'TAMPERED_EDIT' };
      }
      const rawMedia = parsed?.media;
      let safeMedia: DecryptedMediaMeta | null = null;
      if (
        rawMedia &&
        typeof rawMedia === 'object' &&
        typeof rawMedia.aesKey === 'string' &&
        typeof rawMedia.iv === 'string' &&
        typeof rawMedia.sha256 === 'string' &&
        typeof rawMedia.mime === 'string' &&
        rawMedia.aesKey.length <= 128 &&
        rawMedia.iv.length <= 64 &&
        rawMedia.sha256.length <= 128 &&
        rawMedia.mime.length <= 64
      ) {
        const isVoiceMedia = rawMedia.kind === 'voice';
        const normMime = isVoiceMedia ? normalizeAudioMime(rawMedia.mime) : rawMedia.mime.toLowerCase();
        safeMedia = {
          aesKey: rawMedia.aesKey,
          iv: rawMedia.iv,
          sha256: rawMedia.sha256,
          mime: normMime,
        };
        if (isVoiceMedia) {
          safeMedia.kind = 'voice';
          const durNum = Number(rawMedia.durationMs || 0);
          safeMedia.durationMs = Number.isFinite(durNum)
            ? Math.max(0, Math.min(MAX_VOICE_DURATION_MS, Math.round(durNum)))
            : 0;
          const wf = sanitizeWaveform(rawMedia.waveform);
          if (wf) safeMedia.waveform = wf;
        }
      }
      const safeReply = sanitizeReplyMeta(parsed?.reply) || null;
      const safeSharedPost = sanitizeSharedPostMeta(parsed?.sharedPost) || null;
      const safeLinkPreview = sanitizeLinkPreviewMeta(parsed?.linkPreview) || null;
      const payload: DecryptedPayload = {
        v: Number(parsed?.v || 1),
        text: typeof parsed?.text === 'string' ? parsed.text.slice(0, MAX_PLAIN_TEXT_LEN) : '',
        media: safeMedia,
        reply: safeReply,
        sharedPost: safeSharedPost,
        linkPreview: safeLinkPreview,
        editVersion: expectedVersion,
      };

      if (senderId > 0 && senderId !== Number(this.userId)) {
        const known = await this.store.getKnownDevices(senderId);
        if (!known.includes(senderDeviceId)) {
          await this.store.setKnownDevices(senderId, [...known, senderDeviceId]);
        }
      }

      if (msg.id > 0) {
        this.memMsgCache.set(msg.id, payload);
        await this.store.setCachedMessage(msg.id, payload);
      }
      return { ok: true, payload };
    } catch (err: unknown) {
      const e = err as { code?: string; identityKey?: string };
      if (e && e.code === 'KEY_CHANGED') {
        return {
          ok: false,
          reason: 'KEY_CHANGED',
          userId: senderId,
          deviceId: senderDeviceId,
          identityKey: e.identityKey || '',
        };
      }
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
    const isVoice = mediaMeta.kind === 'voice';
    const rawMime = isVoice ? normalizeAudioMime(mediaMeta.mime || '') : (mediaMeta.mime || '').toLowerCase();
    const safeMime = isVoice
      ? (ALLOWED_VOICE_MIMES.has(rawMime) ? rawMime : 'audio/webm')
      : (ALLOWED_MEDIA_MIMES.has(rawMime) ? rawMime : 'image/jpeg');
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

  async isPartnerReady(partnerUserId: number): Promise<boolean> {
    await this.ensureInitialized();
    const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${partnerUserId}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      devices?: Array<{ device_id: number; identity_key_pub: string }>;
    };
    return Boolean(data.devices && data.devices.length > 0);
  }

  async acceptKeyChange(
    targetUserId: number,
    targetDeviceId: number,
    newIdentityKeyB64: string,
  ): Promise<void> {
    const addr = makeDeviceAddress(targetUserId, targetDeviceId);
    if (newIdentityKeyB64) {
      await this.store.forceSaveIdentity(addr.toString(), base64ToArrayBuffer(newIdentityKeyB64));
    }
    const known = await this.store.getKnownDevices(targetUserId);
    if (!known.includes(targetDeviceId)) {
      await this.store.setKnownDevices(targetUserId, [...known, targetDeviceId]);
    }
    await this.store.removeSession(addr.toString());
  }

  async acceptKeyChanges(
    items: Array<{ userId: number; deviceId: number; identityKey: string }>,
  ): Promise<void> {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !item.userId || !item.deviceId) continue;
      await this.acceptKeyChange(
        Number(item.userId),
        Number(item.deviceId),
        String(item.identityKey || ''),
      );
    }
  }

  async unregisterDevice(): Promise<void> {
    try {
      const deviceId = await this.store.getDeviceId();
      if (deviceId && deviceId > 0) {
        await this.fetchImpl('/api/e2ee/keys/unregister', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId }),
        });
      }
    } catch {}
  }

  async clearCachedMessages(msgIds: number[]): Promise<void> {
    if (!Array.isArray(msgIds) || msgIds.length === 0) return;
    for (const rawId of msgIds) {
      const id = Number(rawId);
      if (Number.isInteger(id) && id > 0) {
        this.memMsgCache.delete(id);
        try {
          await this.store.removeCachedMessage(id);
        } catch {}
      }
    }
  }

  async close(): Promise<void> {
    this.revokeAllMediaUrls();
    await this.store.closeBackend();
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

export async function wipeLocalData(userId: number): Promise<void> {
  const uid = Number(userId || 0);
  if (!uid || uid <= 0) return;
  const existing = clientCache.get(uid);
  if (existing) {
    try {
      await existing.unregisterDevice();
    } catch {}
    try {
      await existing.close();
    } catch {}
    clientCache.delete(uid);
  }
  const idbFactory = (
    globalThis as unknown as {
      indexedDB?: {
        deleteDatabase?: (name: string) => {
          onsuccess?: (() => void) | null;
          onerror?: (() => void) | null;
          onblocked?: (() => void) | null;
        };
      };
    }
  ).indexedDB;
  if (idbFactory && typeof idbFactory.deleteDatabase === 'function') {
    await new Promise<void>((resolve) => {
      try {
        const req = idbFactory.deleteDatabase!(`pg_signal_e2ee_u_${uid}`);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        setTimeout(resolve, 1500);
      } catch {
        resolve();
      }
    });
  }
}

const globalObj = globalThis as unknown as { PhotogramE2EE?: unknown };
if (globalObj) {
  globalObj.PhotogramE2EE = {
    getClient: getE2eeClient,
    wipeLocalData,
    E2eeClient,
  };
}
