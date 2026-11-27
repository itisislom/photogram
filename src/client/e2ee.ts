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
  FingerprintGenerator,
} from '@privacyresearch/libsignal-protocol-typescript';
import { crypto as signalCrypto } from '@privacyresearch/libsignal-protocol-typescript/lib/internal';
import qrcode from 'qrcode-generator';

const INITIAL_PREKEY_COUNT = 50;
const LOW_PREKEY_THRESHOLD = 15;
const REFILL_PREKEY_COUNT = 40;
const SPK_ROTATE_MS = 7 * 24 * 60 * 60 * 1000;
const PREKEY_REFILL_COOLDOWN_MS = 30_000;
const SESSION_RECOVERY_THRESHOLD = 2;
const SESSION_RECOVERY_COOLDOWN_MS = 60_000;
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

export interface SignedDeviceListEntry {
  device_id: number;
  identity_key_pub: string;
  signing_key_pub: string;
}

export interface ServerDeviceList {
  user_id: number;
  list_version: number;
  signer_device_id: number;
  devices: SignedDeviceListEntry[];
  ecdsa_signature: string;
  signal_signature: string;
  is_recovery_reset: boolean;
  updated_at?: string;
}

export interface KeyChangeItem {
  userId: number;
  deviceId: number;
  identityKey: string;
  reason?: string;
}

export interface DeviceStatusInfo {
  userId: number;
  deviceId: number;
  approvalStatus: 'approved' | 'pending' | 'unknown';
  trustOrigin: string;
  isPrimary: boolean;
  verificationCode: string;
  identityKeyPub: string;
  signingKeyPub: string;
  pendingCount: number;
  approvedCount: number;
  listVersion: number;
}

export interface OwnDeviceItem {
  device_id: number;
  identity_key_pub: string;
  signing_key_pub: string;
  approval_status: string;
  trust_origin: string;
  is_primary: boolean;
  device_label: string;
  approved_by_device_id: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  verification_code: string;
  is_current: boolean;
}

export interface SafetyNumberInfo {
  fingerprint60: string;
  groups: string[];
  qrPayload: string;
  qrModules: boolean[][];
  qrSize: number;
  verified: boolean;
  partnerDeviceCount: number;
  partnerKeyPub: string;
  keyChanged: boolean;
  hasLegacyDevices: boolean;
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
  const preview =
    typeof r.preview === 'string' ? r.preview.replace(/\s+/g, ' ').trim().slice(0, MAX_REPLY_PREVIEW_LEN) : '';
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

function utf8ToArrayBuffer(str: string): ArrayBuffer {
  const u8 = new TextEncoder().encode(str);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
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

function detectClientDeviceLabel(): string {
  const nav = (globalThis as unknown as { navigator?: { userAgent?: string; maxTouchPoints?: number } }).navigator;
  const ua = nav?.userAgent || '';
  if (!ua) return 'Photogram Device';
  let os = 'Web';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && (nav?.maxTouchPoints || 0) > 1)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/YaBrowser/i.test(ua)) browser = 'Yandex';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/CriOS|Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return `${browser} • ${os}`;
}

export function buildApprovalChallengeMsg(
  userId: number,
  approverDeviceId: number,
  targetDeviceId: number,
  targetIdentityKeyPub: string,
  targetSigningKeyPub: string,
  nonce: string,
  challengeId: string,
): string {
  return `pg-e2ee-approve-v1|${userId}|${approverDeviceId}|${targetDeviceId}|${targetIdentityKeyPub}|${targetSigningKeyPub}|${nonce}|${challengeId}`;
}

export function buildDeviceListCanonicalMsg(
  userId: number,
  listVersion: number,
  isRecoveryReset: boolean,
  devices: SignedDeviceListEntry[],
): string {
  const sorted = [...devices].sort((a, b) => a.device_id - b.device_id);
  const body = sorted
    .map((d) => `${d.device_id}:${d.identity_key_pub}:${d.signing_key_pub}`)
    .join(',');
  return `pg-e2ee-devlist-v1|${userId}|${listVersion}|${isRecoveryReset ? 1 : 0}|${body}`;
}

export async function computeDeviceVerificationCode(
  userId: number,
  deviceId: number,
  identityKeyPub: string,
  signingKeyPub: string = '',
): Promise<string> {
  const input = utf8ToArrayBuffer(`pg-devcode-v1|${userId}|${deviceId}|${identityKeyPub}|${signingKeyPub}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const num = (((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0) % 1_000_000;
  const s = String(num).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

async function signSignalEd25519(privKey: ArrayBuffer, message: string): Promise<string> {
  const sigBuf = await signalCrypto.Ed25519Sign(privKey, utf8ToArrayBuffer(message));
  return bytesToBase64(sigBuf);
}

async function verifySignalEd25519(
  pubKeyB64: string,
  message: string,
  sigB64: string,
): Promise<boolean> {
  if (!pubKeyB64 || !sigB64) return false;
  try {
    const pubBuf = base64ToArrayBuffer(pubKeyB64);
    const sigBuf = base64ToArrayBuffer(sigB64);
    if (sigBuf.byteLength !== 64) return false;
    await signalCrypto.Ed25519Verify(pubBuf, utf8ToArrayBuffer(message), sigBuf);
    return true;
  } catch {
    return false;
  }
}

const localMutexChains = new Map<string, Promise<unknown>>();
const tabLockOwner = `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;

async function acquireFallbackLease(lockName: string, fn: () => Promise<unknown>): Promise<unknown> {
  const ls = (
    globalThis as unknown as {
      localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
    }
  ).localStorage;
  if (!ls) {
    return fn();
  }
  const storageKey = `pg_e2ee_lock:${lockName}`;
  const leaseMs = 8000;
  const deadline = Date.now() + 12000;
  const token = `${tabLockOwner}:${Math.random().toString(36).slice(2)}`;
  let acquired = false;
  while (Date.now() < deadline) {
    try {
      const raw = ls.getItem(storageKey);
      let canTake = !raw;
      if (raw) {
        const parsed = JSON.parse(raw) as { exp?: number };
        if (!parsed || !parsed.exp || parsed.exp <= Date.now()) {
          canTake = true;
        }
      }
      if (canTake) {
        ls.setItem(storageKey, JSON.stringify({ owner: token, exp: Date.now() + leaseMs }));
        const verify = ls.getItem(storageKey);
        if (verify && verify.includes(token)) {
          acquired = true;
          break;
        }
      }
    } catch {
      acquired = false;
      break;
    }
    await new Promise((r) => setTimeout(r, 15));
  }
  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        const cur = ls.getItem(storageKey);
        if (cur && cur.includes(token)) {
          ls.removeItem(storageKey);
        }
      } catch {}
    }
  }
}

export async function withCryptoLock<T>(lockName: string, fn: () => Promise<T>): Promise<T> {
  const navLocks = (
    globalThis as unknown as {
      navigator?: {
        locks?: {
          request<R>(name: string, options: { mode: 'exclusive' }, cb: () => Promise<R>): Promise<R>;
        };
      };
    }
  ).navigator?.locks;

  if (navLocks && typeof navLocks.request === 'function') {
    return navLocks.request(lockName, { mode: 'exclusive' }, fn);
  }

  const prev = localMutexChains.get(lockName) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const chained = prev.then(() => gate);
  localMutexChains.set(lockName, chained);

  await prev;
  try {
    return (await acquireFallbackLease(lockName, fn)) as T;
  } finally {
    release();
    if (localMutexChains.get(lockName) === chained) {
      localMutexChains.delete(lockName);
    }
  }
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
    const idbFactory = (
      globalThis as unknown as { indexedDB?: { open(n: string, v: number): MiniIdbRequest<MiniIdbDatabase> } }
    ).indexedDB;
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

interface StoredEcdsaKeyPair {
  pubSpki: string;
  privJwk: JsonWebKey;
  bindingSig: string;
}

interface StoredVerifiedRecord {
  fingerprint60: string;
  verified: boolean;
  verifiedAt: number;
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

  async getDeviceSigningKey(): Promise<StoredEcdsaKeyPair | undefined> {
    return this.backend.get<StoredEcdsaKeyPair>('meta', 'deviceSigningKey');
  }

  async setDeviceSigningKey(record: StoredEcdsaKeyPair): Promise<void> {
    await this.backend.put('meta', 'deviceSigningKey', record);
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

  async getPinnedDeviceListVersion(partnerUserId: number): Promise<number> {
    const v = await this.backend.get<number>('meta', `pinned_list_ver_${partnerUserId}`);
    return v && v > 0 ? v : 0;
  }

  async setPinnedDeviceListVersion(partnerUserId: number, version: number): Promise<void> {
    if (version > 0) {
      await this.backend.put('meta', `pinned_list_ver_${partnerUserId}`, version);
    }
  }

  async getVerifiedRecord(partnerUserId: number): Promise<StoredVerifiedRecord | undefined> {
    return this.backend.get<StoredVerifiedRecord>('verified', `partner_${partnerUserId}`);
  }

  async setVerifiedRecord(partnerUserId: number, rec: StoredVerifiedRecord | null): Promise<void> {
    if (!rec) {
      await this.backend.del('verified', `partner_${partnerUserId}`);
      return;
    }
    await this.backend.put('verified', `partner_${partnerUserId}`, rec);
  }

  async closeBackend(): Promise<void> {
    if (this.backend.close) {
      await this.backend.close();
    }
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction,
  ): Promise<boolean> {
    const key = normalizeAddrName(identifier);
    const existing = await this.backend.get<string>('identityKeys', key);
    if (!existing) return true;
    const incomingB64 = bytesToBase64(identityKey);
    return existing === incomingB64;
  }

  async getTrustedIdentityB64(identifier: string): Promise<string | undefined> {
    return this.backend.get<string>('identityKeys', normalizeAddrName(identifier));
  }

  async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer): Promise<boolean> {
    const key = normalizeAddrName(encodedAddress);
    const nextB64 = bytesToBase64(publicKey);
    const existing = await this.backend.get<string>('identityKeys', key);
    if (!existing) {
      await this.backend.put('identityKeys', key, nextB64);
      return false;
    }
    if (existing === nextB64) {
      return false;
    }
    throw Object.assign(new Error('Identity key changed'), {
      code: 'KEY_CHANGED',
      identityKey: nextB64,
    });
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
    const vals = await Promise.all(
      unique.map((id) => this.backend.get<DecryptedPayload>('msgCache', String(id))),
    );
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

interface MiniBroadcastChannel {
  onmessage: ((ev: { data?: unknown }) => void) | null;
  postMessage(msg: unknown): void;
  close(): void;
}

interface RemoteIdentityDevice {
  device_id: number;
  identity_key_pub: string;
  signing_key_pub?: string;
  signing_key_binding_sig?: string;
  trust_origin?: string;
  is_primary?: boolean;
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
  private sessionFailureTracker = new Map<string, { msgIds: Set<number>; lastResetAt: number }>();
  private lastPrekeyCheckAt = 0;
  private deviceStatus: DeviceStatusInfo | null = null;
  private syncChannel: MiniBroadcastChannel | null = null;
  private syncListeners = new Set<(ev: { type: string; [k: string]: unknown }) => void>();

  constructor(userId: number, backend?: KeyValueBackend, fetchImpl?: BrowserFetch) {
    this.userId = userId;
    this.store = new SignalStore(backend || createIdbBackend(userId));
    this.fetchImpl =
      fetchImpl ||
      ((input: string, init?: Record<string, unknown>) =>
        (globalThis as unknown as { fetch: BrowserFetch }).fetch(input, init));
    this.setupBroadcastSync();
  }

  private setupBroadcastSync(): void {
    const BC = (
      globalThis as unknown as { BroadcastChannel?: new (name: string) => MiniBroadcastChannel }
    ).BroadcastChannel;
    if (typeof BC !== 'function') return;
    try {
      this.syncChannel = new BC(`pg_e2ee_sync_u_${this.userId}`);
      this.syncChannel.onmessage = (ev: { data?: unknown }) => {
        const d = ev?.data as { type?: string; [k: string]: unknown } | null;
        if (!d || typeof d.type !== 'string') return;
        if (d.type === 'msg_cached' && Number(d.msgId) > 0 && d.payload) {
          this.memMsgCache.set(Number(d.msgId), d.payload as DecryptedPayload);
        } else if (d.type === 'device_approved' || d.type === 'devices_reset' || d.type === 'device_revoked') {
          void this.refreshDeviceStatus();
        }
        this.syncListeners.forEach((fn) => {
          try {
            fn(d as { type: string; [k: string]: unknown });
          } catch {}
        });
      };
    } catch {
      this.syncChannel = null;
    }
  }

  private postSync(event: { type: string; [k: string]: unknown }): void {
    try {
      this.syncChannel?.postMessage(event);
    } catch {}
  }

  onSyncEvent(listener: (ev: { type: string; [k: string]: unknown }) => void): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private async ensureSigningKeyPair(
    deviceId: number,
    identityKp: KeyPairType,
  ): Promise<{ record: StoredEcdsaKeyPair; freshlyCreated: boolean }> {
    const existing = await this.store.getDeviceSigningKey();
    if (existing && existing.pubSpki && existing.privJwk && existing.bindingSig) {
      return { record: existing, freshlyCreated: false };
    }
    const kp = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const spkiBuf = (await crypto.subtle.exportKey('spki', kp.publicKey)) as ArrayBuffer;
    const privJwk = (await crypto.subtle.exportKey('jwk', kp.privateKey)) as JsonWebKey;
    const pubSpki = bytesToBase64(spkiBuf);
    const bindMsg = `pg-bind-v1|${this.userId}|${deviceId}|${pubSpki}`;
    const bindingSig = await signSignalEd25519(identityKp.privKey, bindMsg);
    const record: StoredEcdsaKeyPair = { pubSpki, privJwk, bindingSig };
    await this.store.setDeviceSigningKey(record);
    return { record, freshlyCreated: true };
  }

  private async signEcdsaP256(message: string): Promise<string> {
    const rec = await this.store.getDeviceSigningKey();
    if (!rec || !rec.privJwk) {
      throw new Error('Missing device signing key');
    }
    const privKey = await crypto.subtle.importKey(
      'jwk',
      rec.privJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privKey,
      utf8ToArrayBuffer(message),
    );
    return bytesToBase64(sigBuf);
  }

  async ensureInitialized(): Promise<number> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = withCryptoLock(`pg_e2ee_u_${this.userId}:core`, () => this.doInitialize()).catch((err) => {
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

    const { record: signingRec, freshlyCreated: signingCreated } = await this.ensureSigningKeyPair(
      deviceId,
      identityKp,
    );

    let needRegister = freshlyCreated || signingCreated;
    let prekeyCount = 0;
    let approvalStatus: 'approved' | 'pending' | 'unknown' = 'unknown';
    let trustOrigin = 'legacy';
    let isPrimary = false;
    let pendingCount = 0;
    let approvedCount = 0;
    let listVersion = 0;

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
        const cntData = (await cntRes.json()) as {
          registered?: boolean;
          prekey_count?: number;
          approval_status?: string;
          trust_origin?: string;
          is_primary?: boolean;
          pending_count?: number;
          approved_count?: number;
          list_version?: number;
        };
        if (!cntData.registered) needRegister = true;
        prekeyCount = Number(cntData.prekey_count || 0);
        if (cntData.approval_status === 'approved' || cntData.approval_status === 'pending') {
          approvalStatus = cntData.approval_status;
        }
        trustOrigin = String(cntData.trust_origin || 'legacy');
        isPrimary = Boolean(cntData.is_primary);
        pendingCount = Number(cntData.pending_count || 0);
        approvedCount = Number(cntData.approved_count || 0);
        listVersion = Number(cntData.list_version || 0);
      }
    }

    const identityKeyPub = bytesToBase64(identityKp.pubKey);

    if (needRegister) {
      const prekeys =
        prekeyCount < LOW_PREKEY_THRESHOLD
          ? await this.generateAndStorePreKeys(INITIAL_PREKEY_COUNT)
          : [];
      const regRes = await this.fetchImpl('/api/e2ee/keys/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          registration_id: regId,
          identity_key_pub: identityKeyPub,
          signed_prekey: {
            key_id: spkId,
            public_key: bytesToBase64(spkKp.pubKey),
            signature: spkSigB64,
          },
          signing_key_pub: signingRec.pubSpki,
          signing_key_binding_sig: signingRec.bindingSig,
          device_label: detectClientDeviceLabel(),
          prekeys,
        }),
      });
      if (!regRes.ok) {
        throw new Error('Failed to register E2EE device keys');
      }
      const regData = (await regRes.json()) as {
        approval_status?: string;
        trust_origin?: string;
        is_primary?: boolean;
        list_version?: number;
      };
      approvalStatus = regData.approval_status === 'pending' ? 'pending' : 'approved';
      trustOrigin = String(regData.trust_origin || 'first_device');
      isPrimary = Boolean(regData.is_primary);
      listVersion = Number(regData.list_version || 0);
    } else if (prekeyCount < LOW_PREKEY_THRESHOLD) {
      const prekeys = await this.generateAndStorePreKeys(REFILL_PREKEY_COUNT);
      await this.fetchImpl('/api/e2ee/keys/prekeys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, prekeys }),
      });
    }

    const verificationCode = await computeDeviceVerificationCode(
      this.userId,
      deviceId,
      identityKeyPub,
      signingRec.pubSpki,
    );

    this.deviceStatus = {
      userId: this.userId,
      deviceId,
      approvalStatus,
      trustOrigin,
      isPrimary,
      verificationCode,
      identityKeyPub,
      signingKeyPub: signingRec.pubSpki,
      pendingCount,
      approvedCount,
      listVersion,
    };

    if (approvalStatus === 'approved' && listVersion === 0) {
      try {
        await this.publishSignedDeviceListInternal(deviceId, identityKp);
      } catch {}
    }

    return deviceId;
  }

  private async publishSignedDeviceListInternal(
    myDeviceId: number,
    identityKp: KeyPairType,
  ): Promise<number> {
    const devRes = await this.fetchImpl('/api/e2ee/devices', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!devRes.ok) return 0;
    const data = (await devRes.json()) as {
      devices?: Array<{
        device_id: number;
        identity_key_pub: string;
        signing_key_pub?: string;
        approval_status: string;
      }>;
      device_list?: ServerDeviceList | null;
    };
    const currentVer = Number(data.device_list?.list_version || 0);
    if (currentVer > 0) return currentVer;
    const approved: SignedDeviceListEntry[] = (data.devices || [])
      .filter((d) => d.approval_status === 'approved')
      .map((d) => ({
        device_id: Number(d.device_id),
        identity_key_pub: d.identity_key_pub,
        signing_key_pub: d.signing_key_pub || '',
      }))
      .sort((a, b) => a.device_id - b.device_id);
    if (!approved.some((d) => d.device_id === myDeviceId)) return 0;
    const nextVer = currentVer + 1;
    const msg = buildDeviceListCanonicalMsg(this.userId, nextVer, false, approved);
    const [ecdsaSig, signalSig] = await Promise.all([
      this.signEcdsaP256(msg),
      signSignalEd25519(identityKp.privKey, msg),
    ]);
    const postRes = await this.fetchImpl('/api/e2ee/devices/sign-list', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer_device_id: myDeviceId,
        device_list: {
          list_version: nextVer,
          devices: approved,
          ecdsa_signature: ecdsaSig,
          signal_signature: signalSig,
        },
      }),
    });
    if (postRes.ok && this.deviceStatus) {
      this.deviceStatus.listVersion = nextVer;
      return nextVer;
    }
    return currentVer;
  }

  async refreshDeviceStatus(): Promise<DeviceStatusInfo> {
    const deviceId = await this.ensureInitialized();
    const identityKp = await this.store.getIdentityKeyPair();
    const signingRec = await this.store.getDeviceSigningKey();
    const identityKeyPub = identityKp ? bytesToBase64(identityKp.pubKey) : '';
    const signingKeyPub = signingRec?.pubSpki || '';
    const cntRes = await this.fetchImpl(`/api/e2ee/keys/count?device_id=${deviceId}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const verificationCode = await computeDeviceVerificationCode(
      this.userId,
      deviceId,
      identityKeyPub,
      signingKeyPub,
    );
    if (cntRes.ok) {
      const cntData = (await cntRes.json()) as {
        registered?: boolean;
        approval_status?: string;
        trust_origin?: string;
        is_primary?: boolean;
        pending_count?: number;
        approved_count?: number;
        list_version?: number;
      };
      this.deviceStatus = {
        userId: this.userId,
        deviceId,
        approvalStatus:
          cntData.registered === false
            ? 'pending'
            : cntData.approval_status === 'pending'
              ? 'pending'
              : 'approved',
        trustOrigin: String(cntData.trust_origin || 'legacy'),
        isPrimary: Boolean(cntData.is_primary),
        verificationCode,
        identityKeyPub,
        signingKeyPub,
        pendingCount: Number(cntData.pending_count || 0),
        approvedCount: Number(cntData.approved_count || 0),
        listVersion: Number(cntData.list_version || 0),
      };
    }
    return (
      this.deviceStatus || {
        userId: this.userId,
        deviceId,
        approvalStatus: 'unknown',
        trustOrigin: 'legacy',
        isPrimary: false,
        verificationCode,
        identityKeyPub,
        signingKeyPub,
        pendingCount: 0,
        approvedCount: 0,
        listVersion: 0,
      }
    );
  }

  async getDeviceStatus(): Promise<DeviceStatusInfo> {
    await this.ensureInitialized();
    if (this.deviceStatus) return this.deviceStatus;
    return this.refreshDeviceStatus();
  }

  async listOwnDevices(): Promise<{ devices: OwnDeviceItem[]; device_list: ServerDeviceList | null }> {
    const myDeviceId = await this.ensureInitialized();
    const res = await this.fetchImpl('/api/e2ee/devices', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to load devices');
    const data = (await res.json()) as {
      devices?: Array<Omit<OwnDeviceItem, 'verification_code' | 'is_current'>>;
      device_list?: ServerDeviceList | null;
    };
    const items: OwnDeviceItem[] = await Promise.all(
      (data.devices || []).map(async (d) => ({
        ...d,
        device_id: Number(d.device_id),
        verification_code: await computeDeviceVerificationCode(
          this.userId,
          Number(d.device_id),
          d.identity_key_pub,
          d.signing_key_pub || '',
        ),
        is_current: Number(d.device_id) === Number(myDeviceId),
      })),
    );
    return { devices: items, device_list: data.device_list || null };
  }

  async approvePendingDevice(targetDeviceId: number): Promise<{ success: boolean; list_version: number }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:core`, async () => {
      const myDeviceId = await this.ensureInitialized();
      const identityKp = await this.store.getIdentityKeyPair();
      if (!identityKp) throw new Error('Missing identity key');

      const chRes = await this.fetchImpl('/api/e2ee/devices/challenge', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approver_device_id: myDeviceId,
          target_device_id: targetDeviceId,
        }),
      });
      if (!chRes.ok) {
        const errData = (await chRes.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Challenge failed'), {
          code: errData.code || 'CHALLENGE_FAILED',
        });
      }
      const ch = (await chRes.json()) as {
        challenge_id: string;
        nonce: string;
        target_identity_key_pub: string;
        target_signing_key_pub: string;
        next_list_version: number;
        approved_devices: SignedDeviceListEntry[];
      };

      const challengeMsg = buildApprovalChallengeMsg(
        this.userId,
        myDeviceId,
        targetDeviceId,
        ch.target_identity_key_pub,
        ch.target_signing_key_pub || '',
        ch.nonce,
        ch.challenge_id,
      );
      const approvalSignature = await signEcdsaP256WithInstance(this, challengeMsg);

      const nextDevices: SignedDeviceListEntry[] = [
        ...(ch.approved_devices || []),
        {
          device_id: targetDeviceId,
          identity_key_pub: ch.target_identity_key_pub,
          signing_key_pub: ch.target_signing_key_pub || '',
        },
      ].sort((a, b) => a.device_id - b.device_id);

      const listMsg = buildDeviceListCanonicalMsg(
        this.userId,
        Number(ch.next_list_version),
        false,
        nextDevices,
      );
      const [ecdsaSig, signalSig] = await Promise.all([
        signEcdsaP256WithInstance(this, listMsg),
        signSignalEd25519(identityKp.privKey, listMsg),
      ]);

      const apprRes = await this.fetchImpl('/api/e2ee/devices/approve', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: ch.challenge_id,
          approver_device_id: myDeviceId,
          target_device_id: targetDeviceId,
          approval_signature: approvalSignature,
          device_list: {
            list_version: Number(ch.next_list_version),
            devices: nextDevices,
            ecdsa_signature: ecdsaSig,
            signal_signature: signalSig,
          },
        }),
      });
      if (!apprRes.ok) {
        const errData = (await apprRes.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Approve failed'), {
          code: errData.code || 'APPROVE_FAILED',
        });
      }
      const resData = (await apprRes.json()) as { list_version?: number };
      const nextVer = Number(resData.list_version || ch.next_list_version);
      if (this.deviceStatus) {
        this.deviceStatus.listVersion = nextVer;
      }
      await this.store.setPinnedDeviceListVersion(this.userId, nextVer);
      this.postSync({ type: 'device_approved', deviceId: targetDeviceId, listVersion: nextVer });
      return { success: true, list_version: nextVer };
    });
  }

  async revokeDevice(targetDeviceId: number): Promise<{ success: boolean }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:core`, async () => {
      const myDeviceId = await this.ensureInitialized();
      const identityKp = await this.store.getIdentityKeyPair();
      if (!identityKp) throw new Error('Missing identity key');

      const { devices, device_list } = await this.listOwnDevices();
      const target = devices.find((d) => Number(d.device_id) === Number(targetDeviceId));
      if (!target) throw new Error('Device not found');

      let bodyPayload: Record<string, unknown> = {
        approver_device_id: myDeviceId,
        target_device_id: targetDeviceId,
      };

      if (target.approval_status === 'approved') {
        const nextVer = Number(device_list?.list_version || 0) + 1;
        const remaining: SignedDeviceListEntry[] = devices
          .filter((d) => d.approval_status === 'approved' && Number(d.device_id) !== Number(targetDeviceId))
          .map((d) => ({
            device_id: Number(d.device_id),
            identity_key_pub: d.identity_key_pub,
            signing_key_pub: d.signing_key_pub || '',
          }))
          .sort((a, b) => a.device_id - b.device_id);
        const listMsg = buildDeviceListCanonicalMsg(this.userId, nextVer, false, remaining);
        const [ecdsaSig, signalSig] = await Promise.all([
          this.signEcdsaP256(listMsg),
          signSignalEd25519(identityKp.privKey, listMsg),
        ]);
        bodyPayload = {
          approver_device_id: myDeviceId,
          target_device_id: targetDeviceId,
          device_list: {
            list_version: nextVer,
            devices: remaining,
            ecdsa_signature: ecdsaSig,
            signal_signature: signalSig,
          },
        };
      }

      const res = await this.fetchImpl('/api/e2ee/devices/revoke', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Revoke failed'), {
          code: errData.code || 'REVOKE_FAILED',
        });
      }
      const revokedAddr = makeDeviceAddress(this.userId, targetDeviceId);
      await this.store.removeSession(revokedAddr.toString());
      this.postSync({ type: 'device_revoked', deviceId: targetDeviceId });
      await this.refreshDeviceStatus();
      return { success: true };
    });
  }

  async recoverLostDevice(password: string): Promise<{ success: boolean; list_version: number }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:core`, async () => {
      const myDeviceId = await this.ensureInitialized();
      const identityKp = await this.store.getIdentityKeyPair();
      const signingRec = await this.store.getDeviceSigningKey();
      if (!identityKp || !signingRec) throw new Error('Missing device keys');

      const { device_list } = await this.listOwnDevices();
      const nextVer = Number(device_list?.list_version || 0) + 1;
      const myEntry: SignedDeviceListEntry = {
        device_id: myDeviceId,
        identity_key_pub: bytesToBase64(identityKp.pubKey),
        signing_key_pub: signingRec.pubSpki,
      };
      const listMsg = buildDeviceListCanonicalMsg(this.userId, nextVer, true, [myEntry]);
      const [ecdsaSig, signalSig] = await Promise.all([
        this.signEcdsaP256(listMsg),
        signSignalEd25519(identityKp.privKey, listMsg),
      ]);

      const res = await this.fetchImpl('/api/e2ee/devices/recover', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          device_id: myDeviceId,
          device_list: {
            list_version: nextVer,
            devices: [myEntry],
            ecdsa_signature: ecdsaSig,
            signal_signature: signalSig,
          },
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Recovery failed'), {
          code: errData.code || 'RECOVERY_FAILED',
        });
      }
      if (this.deviceStatus) {
        this.deviceStatus.approvalStatus = 'approved';
        this.deviceStatus.trustOrigin = 'recovery_reset';
        this.deviceStatus.isPrimary = true;
        this.deviceStatus.listVersion = nextVer;
      }
      await this.store.setPinnedDeviceListVersion(this.userId, nextVer);
      this.postSync({ type: 'devices_reset', deviceId: myDeviceId, listVersion: nextVer });
      return { success: true, list_version: nextVer };
    });
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

  private schedulePreKeyRefillCheck(deviceId: number): void {
    const now = Date.now();
    if (now - this.lastPrekeyCheckAt < PREKEY_REFILL_COOLDOWN_MS) return;
    this.lastPrekeyCheckAt = now;
    void withCryptoLock(`pg_e2ee_u_${this.userId}:core`, async () => {
      try {
        const res = await this.fetchImpl(`/api/e2ee/keys/count?device_id=${deviceId}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { registered?: boolean; prekey_count?: number };
        if (data.registered && Number(data.prekey_count || 0) < LOW_PREKEY_THRESHOLD) {
          const prekeys = await this.generateAndStorePreKeys(REFILL_PREKEY_COUNT);
          await this.fetchImpl('/api/e2ee/keys/prekeys', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId, prekeys }),
          });
        }
      } catch {}
    });
  }

  async getDeviceId(): Promise<number> {
    return this.ensureInitialized();
  }

  private async verifyRemoteDeviceTrust(
    targetUserId: number,
    remoteDevs: RemoteIdentityDevice[],
    deviceList: ServerDeviceList | null | undefined,
    excludeDeviceId: number = 0,
  ): Promise<{ changes: KeyChangeItem[]; nextListVersion: number; rollbackDetected: boolean }> {
    const filteredDevs = remoteDevs.filter((d) => Number(d.device_id) !== excludeDeviceId);
    const knownDevIds = await this.store.getKnownDevices(targetUserId);
    const pinnedKeys = new Map<number, string>();
    for (const devId of knownDevIds) {
      const addr = makeDeviceAddress(targetUserId, devId);
      const b64 = await this.store.getTrustedIdentityB64(addr.getName());
      if (b64) pinnedKeys.set(devId, b64);
    }
    for (const d of filteredDevs) {
      const devId = Number(d.device_id);
      if (!pinnedKeys.has(devId)) {
        const addr = makeDeviceAddress(targetUserId, devId);
        const b64 = await this.store.getTrustedIdentityB64(addr.getName());
        if (b64) pinnedKeys.set(devId, b64);
      }
    }

    const pinnedListVer = await this.store.getPinnedDeviceListVersion(targetUserId);
    const incomingListVer = deviceList ? Number(deviceList.list_version || 0) : 0;

    if (pinnedListVer > 0 && (!deviceList || incomingListVer < pinnedListVer)) {
      return {
        changes: filteredDevs.map((d) => ({
          userId: targetUserId,
          deviceId: Number(d.device_id),
          identityKey: d.identity_key_pub,
          reason: 'LIST_ROLLBACK',
        })),
        nextListVersion: incomingListVer,
        rollbackDetected: true,
      };
    }

    let validChainedDeviceMap: Map<number, string> | null = null;
    if (deviceList && Array.isArray(deviceList.devices) && deviceList.devices.length > 0) {
      const entries: SignedDeviceListEntry[] = deviceList.devices.map((e) => ({
        device_id: Number(e.device_id),
        identity_key_pub: String(e.identity_key_pub || ''),
        signing_key_pub: String(e.signing_key_pub || ''),
      }));
      const canonical = buildDeviceListCanonicalMsg(
        targetUserId,
        incomingListVer,
        Boolean(deviceList.is_recovery_reset),
        entries,
      );
      const signerId = Number(deviceList.signer_device_id);

      if (pinnedKeys.size === 0) {
        const signerEntry = entries.find((e) => e.device_id === signerId);
        if (signerEntry) {
          const ok = await verifySignalEd25519(
            signerEntry.identity_key_pub,
            canonical,
            String(deviceList.signal_signature || ''),
          );
          if (ok) {
            validChainedDeviceMap = new Map(entries.map((e) => [e.device_id, e.identity_key_pub]));
          }
        }
      } else {
        const pinnedSignerKey =
          targetUserId === this.userId && signerId === this.deviceStatus?.deviceId
            ? this.deviceStatus.identityKeyPub
            : pinnedKeys.get(signerId);
        if (pinnedSignerKey && !deviceList.is_recovery_reset) {
          const ok = await verifySignalEd25519(
            pinnedSignerKey,
            canonical,
            String(deviceList.signal_signature || ''),
          );
          if (ok) {
            validChainedDeviceMap = new Map(entries.map((e) => [e.device_id, e.identity_key_pub]));
          }
        }
      }
    }

    if (pinnedKeys.size === 0) {
      if (deviceList && !validChainedDeviceMap) {
        return {
          changes: filteredDevs.map((d) => ({
            userId: targetUserId,
            deviceId: Number(d.device_id),
            identityKey: d.identity_key_pub,
            reason: 'INVALID_DEVICE_LIST_SIG',
          })),
          nextListVersion: incomingListVer,
          rollbackDetected: false,
        };
      }
      if (validChainedDeviceMap) {
        for (const d of filteredDevs) {
          const listedKey = validChainedDeviceMap.get(Number(d.device_id));
          if (!listedKey || listedKey !== d.identity_key_pub) {
            return {
              changes: [
                {
                  userId: targetUserId,
                  deviceId: Number(d.device_id),
                  identityKey: d.identity_key_pub,
                  reason: 'UNLISTED_DEVICE',
                },
              ],
              nextListVersion: incomingListVer,
              rollbackDetected: false,
            };
          }
        }
      }
      if (incomingListVer > 0 && validChainedDeviceMap) {
        await this.store.setPinnedDeviceListVersion(targetUserId, incomingListVer);
      }
      return { changes: [], nextListVersion: incomingListVer, rollbackDetected: false };
    }

    const changes: KeyChangeItem[] = [];

    if (deviceList && deviceList.is_recovery_reset && incomingListVer > pinnedListVer) {
      for (const d of filteredDevs) {
        changes.push({
          userId: targetUserId,
          deviceId: Number(d.device_id),
          identityKey: d.identity_key_pub,
          reason: 'RECOVERY_RESET',
        });
      }
      return { changes, nextListVersion: incomingListVer, rollbackDetected: false };
    }

    for (const d of filteredDevs) {
      const devId = Number(d.device_id);
      const pinned = pinnedKeys.get(devId);
      if (pinned) {
        if (pinned !== d.identity_key_pub) {
          changes.push({
            userId: targetUserId,
            deviceId: devId,
            identityKey: d.identity_key_pub,
            reason: 'IDENTITY_CHANGED',
          });
        }
      } else {
        const vouchedKey = validChainedDeviceMap ? validChainedDeviceMap.get(devId) : undefined;
        if (!vouchedKey || vouchedKey !== d.identity_key_pub) {
          changes.push({
            userId: targetUserId,
            deviceId: devId,
            identityKey: d.identity_key_pub,
            reason: 'UNVERIFIED_NEW_DEVICE',
          });
        }
      }
    }

    if (changes.length === 0 && incomingListVer > pinnedListVer) {
      if (!validChainedDeviceMap) {
        for (const d of filteredDevs) {
          changes.push({
            userId: targetUserId,
            deviceId: Number(d.device_id),
            identityKey: d.identity_key_pub,
            reason: 'INVALID_DEVICE_LIST_SIG',
          });
        }
      } else {
        await this.store.setPinnedDeviceListVersion(targetUserId, incomingListVer);
      }
    }

    return { changes, nextListVersion: incomingListVer, rollbackDetected: false };
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
    return withCryptoLock(`pg_e2ee_u_${this.userId}:partner:${opts.partnerUserId}`, async () => {
      const myDeviceId = await this.ensureInitialized();
      if (this.deviceStatus && this.deviceStatus.approvalStatus === 'pending') {
        const refreshed = await this.refreshDeviceStatus();
        if (refreshed.approvalStatus === 'pending') {
          throw Object.assign(new Error('Device approval required'), {
            code: 'DEVICE_PENDING',
            verificationCode: refreshed.verificationCode,
          });
        }
      }

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
      if (cleanReply) payload.reply = cleanReply;
      if (cleanSharedPost) payload.sharedPost = cleanSharedPost;
      if (cleanLinkPreview) payload.linkPreview = cleanLinkPreview;
      if (opts.editOf && Number(opts.editOf) > 0) payload.editOf = Number(opts.editOf);

      const plaintextBuf = utf8ToArrayBuffer(JSON.stringify(payload));

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
        devices?: RemoteIdentityDevice[];
        device_list?: ServerDeviceList | null;
        self_devices?: RemoteIdentityDevice[];
        self_device_list?: ServerDeviceList | null;
      };

      const partnerDevs = idsData.devices || [];
      const selfDevs = Array.isArray(idsData.self_devices) ? idsData.self_devices : [];

      if (partnerDevs.length === 0) {
        throw Object.assign(new Error('Partner has no E2EE keys'), { code: 'PARTNER_NOT_READY' });
      }

      const partnerTrust = await this.verifyRemoteDeviceTrust(
        opts.partnerUserId,
        partnerDevs,
        idsData.device_list,
        0,
      );
      if (partnerTrust.changes.length > 0) {
        throw Object.assign(new Error('Partner security keys changed'), {
          code: 'KEY_CHANGED',
          userId: opts.partnerUserId,
          changes: partnerTrust.changes,
          devices: partnerTrust.changes,
          nextListVersion: partnerTrust.nextListVersion,
          rollbackDetected: partnerTrust.rollbackDetected,
        });
      }

      const selfOtherDevs = selfDevs.filter((d) => Number(d.device_id) !== Number(myDeviceId));
      let verifiedSelfOtherDevs: RemoteIdentityDevice[] = [];
      if (selfOtherDevs.length > 0) {
        const selfTrust = await this.verifyRemoteDeviceTrust(
          this.userId,
          selfOtherDevs,
          idsData.self_device_list,
          myDeviceId,
        );
        if (selfTrust.changes.length === 0) {
          verifiedSelfOtherDevs = selfOtherDevs;
        }
      }

      const knownPartnerDevs = await this.store.getKnownDevices(opts.partnerUserId);
      const mergedPartnerDevs = Array.from(
        new Set([...knownPartnerDevs, ...partnerDevs.map((d) => Number(d.device_id))]),
      );
      if (mergedPartnerDevs.length !== knownPartnerDevs.length) {
        await this.store.setKnownDevices(opts.partnerUserId, mergedPartnerDevs);
      }

      const targets: Array<{ userId: number; deviceId: number; identityKeyPub: string }> = [
        ...partnerDevs.map((d) => ({
          userId: opts.partnerUserId,
          deviceId: Number(d.device_id),
          identityKeyPub: d.identity_key_pub,
        })),
        ...verifiedSelfOtherDevs.map((d) => ({
          userId: this.userId,
          deviceId: Number(d.device_id),
          identityKeyPub: d.identity_key_pub,
        })),
      ];

      const needSessionKeys = new Set<string>();
      for (const target of targets) {
        const addr = makeDeviceAddress(target.userId, target.deviceId);
        const cipher = new SessionCipher(this.store, addr);
        const hasSession = await cipher.hasOpenSession();
        if (!hasSession) {
          needSessionKeys.add(`${target.userId}:${target.deviceId}`);
        }
      }

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

        const expectedKeyByTarget = new Map(
          targets.map((t) => [`${t.userId}:${t.deviceId}`, t.identityKeyPub]),
        );
        const allBundles = [...(bData.devices || []), ...(bData.self_devices || [])];
        for (const b of allBundles) {
          const key = `${b.user_id}:${b.device_id}`;
          if (!needSessionKeys.has(key)) continue;
          const expectedKey = expectedKeyByTarget.get(key);
          if (!expectedKey || expectedKey !== b.identity_key_pub) {
            if (Number(b.user_id) === opts.partnerUserId) {
              throw Object.assign(new Error('Partner identity key mismatch in bundle'), {
                code: 'KEY_CHANGED',
                userId: opts.partnerUserId,
                changes: [
                  {
                    userId: opts.partnerUserId,
                    deviceId: Number(b.device_id),
                    identityKey: b.identity_key_pub,
                    reason: 'BUNDLE_KEY_MISMATCH',
                  },
                ],
                nextListVersion: partnerTrust.nextListVersion,
              });
            }
            continue;
          }
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
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '';
            if (/Identity key changed/i.test(msg) && Number(b.user_id) === opts.partnerUserId) {
              throw Object.assign(new Error('Partner security keys changed'), {
                code: 'KEY_CHANGED',
                userId: opts.partnerUserId,
                changes: [
                  {
                    userId: opts.partnerUserId,
                    deviceId: Number(b.device_id),
                    identityKey: b.identity_key_pub,
                    reason: 'IDENTITY_CHANGED',
                  },
                ],
                nextListVersion: partnerTrust.nextListVersion,
              });
            }
          }
        }
      }

      const envelopes: CipherEnvelopeItem[] = [];
      for (const target of targets) {
        const addr = makeDeviceAddress(target.userId, target.deviceId);
        const cipher = new SessionCipher(this.store, addr);
        try {
          const hasSession = await cipher.hasOpenSession();
          if (!hasSession) continue;
          const encResult = await cipher.encrypt(plaintextBuf);
          if (!encResult || !encResult.body) continue;
          envelopes.push({
            u: target.userId,
            d: target.deviceId,
            t: Number(encResult.type),
            b: binaryStringToBase64(encResult.body),
          });
        } catch {}
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
    });
  }

  async cacheSentMessage(msgId: number, payload: DecryptedPayload, editVersion: number = 0): Promise<void> {
    if (msgId > 0) {
      const entry: DecryptedPayload = {
        ...payload,
        editVersion: Math.max(0, Number(editVersion || 0)),
      };
      this.memMsgCache.set(msgId, entry);
      await this.store.setCachedMessage(msgId, entry);
      this.postSync({ type: 'msg_cached', msgId, payload: entry });
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

    const senderId = Number(msg.sender_id || 0);
    const senderDeviceId = Number(msg.sender_device_id || 0);
    const crossTabLock = `pg_e2ee_u_${this.userId}:sess:${senderId}:${senderDeviceId}`;

    const work = withCryptoLock(crossTabLock, async () => {
      if (msgId > 0) {
        const cachedAfterLock = await this.store.getCachedMessage(msgId);
        if (cachedAfterLock && Number(cachedAfterLock.editVersion || 0) >= expectedVersion) {
          this.memMsgCache.set(msgId, cachedAfterLock);
          return { ok: true, payload: cachedAfterLock };
        }
      }
      return this.doDecryptMessage(msg);
    }).finally(() => {
      if (msgId > 0) this.decryptLocks.delete(lockKey);
    });
    if (msgId > 0) this.decryptLocks.set(lockKey, work);
    return work;
  }

  private async trySafeBrokenSessionRecovery(
    senderId: number,
    senderDeviceId: number,
    msgId: number,
    errMsg: string,
  ): Promise<{ reason: string; identityKey?: string }> {
    const senderAddr = makeDeviceAddress(senderId, senderDeviceId);
    const pinnedB64 = await this.store.getTrustedIdentityB64(senderAddr.getName());

    let serverKeyB64 = '';
    try {
      const idRes = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${senderId}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (idRes.ok) {
        const d = (await idRes.json()) as { devices?: RemoteIdentityDevice[] };
        const dev = (d.devices || []).find((x) => Number(x.device_id) === senderDeviceId);
        if (dev) serverKeyB64 = dev.identity_key_pub;
      }
    } catch {}

    if (pinnedB64 && serverKeyB64 && serverKeyB64 !== pinnedB64) {
      return { reason: 'KEY_CHANGED', identityKey: serverKeyB64 };
    }

    if (/MessageCounterError|already been decrypted|Duplicate/i.test(errMsg)) {
      return { reason: 'DECRYPT_ERROR' };
    }

    if (!pinnedB64 || !serverKeyB64 || pinnedB64 !== serverKeyB64) {
      return { reason: 'DECRYPT_ERROR' };
    }

    const peerKey = `${senderId}:${senderDeviceId}`;
    let tracker = this.sessionFailureTracker.get(peerKey);
    if (!tracker) {
      tracker = { msgIds: new Set<number>(), lastResetAt: 0 };
      this.sessionFailureTracker.set(peerKey, tracker);
    }
    if (msgId > 0) {
      tracker.msgIds.add(msgId);
    }

    if (
      tracker.msgIds.size < SESSION_RECOVERY_THRESHOLD ||
      Date.now() - tracker.lastResetAt < SESSION_RECOVERY_COOLDOWN_MS
    ) {
      return { reason: 'DECRYPT_ERROR' };
    }

    tracker.lastResetAt = Date.now();
    tracker.msgIds.clear();

    try {
      const myDeviceId = await this.ensureInitialized();
      const bRes = await this.fetchImpl('/api/e2ee/keys/bundle', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: senderId,
          include_self: false,
          self_device_id: myDeviceId,
        }),
      });
      if (!bRes.ok) return { reason: 'DECRYPT_ERROR' };
      const bData = (await bRes.json()) as {
        devices?: Array<{
          user_id: number;
          device_id: number;
          registration_id: number;
          identity_key_pub: string;
          signed_prekey: { key_id: number; public_key: string; signature: string };
          prekey: { key_id: number; public_key: string } | null;
        }>;
      };
      const targetBundle = (bData.devices || []).find(
        (b) => Number(b.user_id) === senderId && Number(b.device_id) === senderDeviceId,
      );
      if (!targetBundle || targetBundle.identity_key_pub !== pinnedB64) {
        if (targetBundle && targetBundle.identity_key_pub !== pinnedB64) {
          return { reason: 'KEY_CHANGED', identityKey: targetBundle.identity_key_pub };
        }
        return { reason: 'DECRYPT_ERROR' };
      }

      await this.store.removeSession(senderAddr.toString());
      const builder = new SessionBuilder(this.store, senderAddr);
      await builder.processPreKey({
        registrationId: Number(targetBundle.registration_id),
        identityKey: base64ToArrayBuffer(targetBundle.identity_key_pub),
        signedPreKey: {
          keyId: Number(targetBundle.signed_prekey.key_id),
          publicKey: base64ToArrayBuffer(targetBundle.signed_prekey.public_key),
          signature: base64ToArrayBuffer(targetBundle.signed_prekey.signature),
        },
        preKey: targetBundle.prekey
          ? {
              keyId: Number(targetBundle.prekey.key_id),
              publicKey: base64ToArrayBuffer(targetBundle.prekey.public_key),
            }
          : undefined,
      });
      return { reason: 'SESSION_RECOVERED_PRE_RESET' };
    } catch {
      return { reason: 'DECRYPT_ERROR' };
    }
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
      const isPreKeyMsg = Number(target.t) === 3;
      const plainBuf = isPreKeyMsg
        ? await cipher.decryptPreKeyWhisperMessage(binStr, 'binary')
        : await cipher.decryptWhisperMessage(binStr, 'binary');

      if (isPreKeyMsg) {
        this.schedulePreKeyRefillCheck(myDeviceId);
      }
      this.sessionFailureTracker.delete(`${senderId}:${senderDeviceId}`);

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
        this.postSync({ type: 'msg_cached', msgId: msg.id, payload });
      }
      return { ok: true, payload };
    } catch (err: unknown) {
      const e = err as { code?: string; identityKey?: string; message?: string };
      const errMsg = e?.message || String(err || '');
      if ((e && e.code === 'KEY_CHANGED') || /Identity key changed|Untrusted identity/i.test(errMsg)) {
        let serverKey = e?.identityKey || '';
        if (!serverKey) {
          try {
            const idRes = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${senderId}`, {
              credentials: 'same-origin',
              cache: 'no-store',
            });
            if (idRes.ok) {
              const d = (await idRes.json()) as { devices?: RemoteIdentityDevice[] };
              const dev = (d.devices || []).find((x) => Number(x.device_id) === senderDeviceId);
              if (dev) serverKey = dev.identity_key_pub;
            }
          } catch {}
        }
        return {
          ok: false,
          reason: 'KEY_CHANGED',
          userId: senderId,
          deviceId: senderDeviceId,
          identityKey: serverKey,
        };
      }

      const recovery = await this.trySafeBrokenSessionRecovery(
        senderId,
        senderDeviceId,
        Number(msg.id || 0),
        errMsg,
      );
      if (recovery.reason === 'KEY_CHANGED') {
        return {
          ok: false,
          reason: 'KEY_CHANGED',
          userId: senderId,
          deviceId: senderDeviceId,
          identityKey: recovery.identityKey || '',
        };
      }
      return { ok: false, reason: recovery.reason };
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
      ? ALLOWED_VOICE_MIMES.has(rawMime)
        ? rawMime
        : 'audio/webm'
      : ALLOWED_MEDIA_MIMES.has(rawMime)
        ? rawMime
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

  async getSafetyNumberAndQr(partnerUserId: number): Promise<SafetyNumberInfo> {
    await this.ensureInitialized();
    const localKp = await this.store.getIdentityKeyPair();
    if (!localKp) throw new Error('Missing local identity key');

    const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${partnerUserId}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch partner identity');
    const data = (await res.json()) as {
      devices?: RemoteIdentityDevice[];
      device_list?: ServerDeviceList | null;
    };
    const devs = data.devices || [];
    if (devs.length === 0) {
      throw Object.assign(new Error('Partner has no E2EE keys'), { code: 'PARTNER_NOT_READY' });
    }

    const primary = devs.find((d) => d.is_primary) || [...devs].sort((a, b) => a.device_id - b.device_id)[0];
    const trustCheck = await this.verifyRemoteDeviceTrust(partnerUserId, devs, data.device_list, 0);
    const keyChanged = trustCheck.changes.length > 0;
    const hasLegacyDevices = devs.some((d) => !d.trust_origin || d.trust_origin === 'legacy');

    const pinnedPrimary = await this.store.getTrustedIdentityB64(
      makeDeviceAddress(partnerUserId, Number(primary.device_id)).getName(),
    );
    const effectiveRemoteKey = pinnedPrimary || primary.identity_key_pub;
    const remoteBuf = base64ToArrayBuffer(effectiveRemoteKey);

    const fpGen = new FingerprintGenerator(5200);
    const fingerprint60 = await fpGen.createFor(
      String(this.userId),
      localKp.pubKey,
      String(partnerUserId),
      remoteBuf,
    );
    const groups: string[] = [];
    for (let i = 0; i < fingerprint60.length; i += 5) {
      groups.push(fingerprint60.slice(i, i + 5));
    }

    const minU = Math.min(this.userId, partnerUserId);
    const maxU = Math.max(this.userId, partnerUserId);
    const qrPayload = `PG1:${minU}:${maxU}:${fingerprint60}`;

    const qr = qrcode(0, 'M');
    qr.addData(qrPayload);
    qr.make();
    const qrSize = qr.getModuleCount();
    const qrModules: boolean[][] = [];
    for (let r = 0; r < qrSize; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < qrSize; c++) {
        row.push(qr.isDark(r, c));
      }
      qrModules.push(row);
    }

    const verRec = await this.store.getVerifiedRecord(partnerUserId);
    const verified = Boolean(verRec && verRec.verified && verRec.fingerprint60 === fingerprint60 && !keyChanged);

    return {
      fingerprint60,
      groups,
      qrPayload,
      qrModules,
      qrSize,
      verified,
      partnerDeviceCount: devs.length,
      partnerKeyPub: effectiveRemoteKey,
      keyChanged,
      hasLegacyDevices,
    };
  }

  async markPartnerVerified(
    partnerUserId: number,
    fingerprint60: string,
    verified: boolean,
  ): Promise<void> {
    if (!verified) {
      await this.store.setVerifiedRecord(partnerUserId, null);
    } else {
      await this.store.setVerifiedRecord(partnerUserId, {
        fingerprint60,
        verified: true,
        verifiedAt: Date.now(),
      });
    }
    this.postSync({ type: 'partner_verified', partnerUserId, verified });
  }

  async getPartnerVerificationStatus(partnerUserId: number): Promise<boolean> {
    const rec = await this.store.getVerifiedRecord(partnerUserId);
    return Boolean(rec && rec.verified);
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
    await this.store.setVerifiedRecord(targetUserId, null);
    this.sessionFailureTracker.delete(`${targetUserId}:${targetDeviceId}`);
  }

  async acceptKeyChanges(
    items: Array<{ userId: number; deviceId: number; identityKey: string }>,
    partnerUserId?: number,
    nextListVersion?: number,
  ): Promise<void> {
    if (!Array.isArray(items)) return;
    const affectedUsers = new Set<number>();
    for (const item of items) {
      if (!item || !item.userId || !item.deviceId) continue;
      affectedUsers.add(Number(item.userId));
      await this.acceptKeyChange(
        Number(item.userId),
        Number(item.deviceId),
        String(item.identityKey || ''),
      );
    }
    const targetUid = partnerUserId || (items[0] ? Number(items[0].userId) : 0);
    if (targetUid > 0 && nextListVersion && nextListVersion > 0) {
      await this.store.setPinnedDeviceListVersion(targetUid, nextListVersion);
    }
    if (targetUid > 0) {
      try {
        const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${targetUid}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            devices?: RemoteIdentityDevice[];
            device_list?: ServerDeviceList | null;
          };
          const liveIds = (data.devices || []).map((d) => Number(d.device_id));
          await this.store.setKnownDevices(targetUid, liveIds);
          if (data.device_list && Number(data.device_list.list_version) > 0) {
            await this.store.setPinnedDeviceListVersion(targetUid, Number(data.device_list.list_version));
          }
        }
      } catch {}
    }
    affectedUsers.forEach((uid) => {
      this.postSync({ type: 'key_accepted', userId: uid });
    });
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
    try {
      this.syncChannel?.close();
    } catch {}
    this.syncChannel = null;
    await this.store.closeBackend();
  }
}

async function signEcdsaP256WithInstance(client: E2eeClient, message: string): Promise<string> {
  return (client as unknown as { signEcdsaP256(m: string): Promise<string> }).signEcdsaP256(message);
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
    computeDeviceVerificationCode,
    withCryptoLock,
  };
}
