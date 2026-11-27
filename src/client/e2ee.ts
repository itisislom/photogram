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
  getAllEntries?<T = unknown>(store: string): Promise<Array<[string, T]>>;
  put(store: string, key: string, value: unknown): Promise<void>;
  del(store: string, key: string): Promise<void>;
  close?(): Promise<void>;
}

export type BrowserFetch = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  status?: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

interface MiniIdbCursor {
  key: unknown;
  value: unknown;
  continue(): void;
}

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
  openCursor?(): MiniIdbRequest<MiniIdbCursor | null>;
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

export function buildUnregisterDeviceMsg(
  userId: number,
  deviceId: number,
  timestamp: number,
): string {
  return `pg-e2ee-unreg-v1|${userId}|${deviceId}|${timestamp}`;
}

function concatKeyBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  let total = 0;
  for (let i = 0; i < buffers.length; i++) total += buffers[i].byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const view = new Uint8Array(buffers[i]);
    out.set(view, offset);
    offset += view.byteLength;
  }
  return out.buffer;
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

const BACKUP_B32_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BACKUP_COMPACT_THRESHOLD = 10;
const BACKUP_MAX_CHUNKS_PER_EPOCH = 32;
const DEFAULT_MAX_CHUNK_RAW_BYTES = 1_100_000;
const AUTO_BACKUP_MIN_INTERVAL_MS = 10 * 60 * 1000;
const AUTO_BACKUP_MIN_BG_INTERVAL_MS = 3 * 60 * 1000;
const AUTO_BACKUP_BATCH_THRESHOLD = 25;

function encodeBase32NoPad(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BACKUP_B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BACKUP_B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function decodeBase32NoPad(str: string): Uint8Array | null {
  const clean = str.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BACKUP_B32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
    return null;
  }
  return new Uint8Array(out);
}

export async function formatRecoveryKeyFromRaw(rawKey: Uint8Array): Promise<string> {
  const copy = rawKey.buffer.slice(rawKey.byteOffset, rawKey.byteOffset + rawKey.byteLength) as ArrayBuffer;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
  const combined = new Uint8Array(34);
  combined.set(rawKey, 0);
  combined[32] = digest[0];
  combined[33] = digest[1];
  const b32 = encodeBase32NoPad(combined);
  const groups: string[] = [];
  for (let i = 0; i < b32.length; i += 4) {
    groups.push(b32.slice(i, i + 4));
  }
  return groups.join('-');
}

export async function generateRecoveryKey(): Promise<{ rawB64: string; formatted: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const formatted = await formatRecoveryKeyFromRaw(raw);
  return { rawB64: bytesToBase64(raw), formatted };
}

export async function parseRecoveryKey(input: string): Promise<Uint8Array> {
  const decoded = decodeBase32NoPad(String(input || ''));
  if (!decoded || decoded.length !== 34) {
    throw Object.assign(new Error('Invalid recovery key'), { code: 'INVALID_RECOVERY_KEY' });
  }
  const keyBytes = decoded.slice(0, 32);
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    ),
  );
  if (digest[0] !== decoded[32] || digest[1] !== decoded[33]) {
    throw Object.assign(new Error('Invalid recovery key checksum'), { code: 'INVALID_RECOVERY_KEY' });
  }
  return keyBytes;
}

async function sha256B64Bytes(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return bytesToBase64(digest);
}

async function compressPayloadBytes(raw: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as unknown as { CompressionStream?: new (fmt: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  if (typeof CS === 'function') {
    try {
      const cs = new CS('gzip');
      const writer = cs.writable.getWriter();
      const writePromise = writer.write(raw).then(() => writer.close());
      const reader = cs.readable.getReader();
      const parts: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          parts.push(value);
          total += value.byteLength;
        }
      }
      await writePromise;
      const out = new Uint8Array(1 + total);
      out[0] = 0x01;
      let off = 1;
      for (const p of parts) {
        out.set(p, off);
        off += p.byteLength;
      }
      return out;
    } catch {}
  }
  const out = new Uint8Array(1 + raw.byteLength);
  out[0] = 0x00;
  out.set(raw, 1);
  return out;
}

async function decompressPayloadBytes(framed: Uint8Array): Promise<Uint8Array> {
  if (!framed || framed.byteLength < 2) {
    throw Object.assign(new Error('Corrupted backup payload'), { code: 'BACKUP_CORRUPTED' });
  }
  const mode = framed[0];
  const body = framed.subarray(1);
  if (mode === 0x00) return body;
  if (mode !== 0x01) {
    throw Object.assign(new Error('Unknown backup compression mode'), { code: 'BACKUP_CORRUPTED' });
  }
  const DS = (globalThis as unknown as { DecompressionStream?: new (fmt: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (typeof DS !== 'function') {
    throw Object.assign(new Error('DecompressionStream unavailable'), { code: 'BACKUP_CORRUPTED' });
  }
  const ds = new DS('gzip');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(body).then(() => writer.close());
  const reader = ds.readable.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      parts.push(value);
      total += value.byteLength;
    }
  }
  await writePromise;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

async function deriveBackupAesKey(
  rawKeyBytes: Uint8Array,
  saltB64: string,
  userId: number,
  epoch: number,
): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey(
    'raw',
    rawKeyBytes.buffer.slice(rawKeyBytes.byteOffset, rawKeyBytes.byteOffset + rawKeyBytes.byteLength) as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: base64ToArrayBuffer(saltB64),
      info: utf8ToArrayBuffer(`pg-backup-v1|enc|${userId}|${epoch}`),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function verifyEcdsaP256Local(spkiB64: string, message: string, sigB64: string): Promise<boolean> {
  if (!spkiB64 || !sigB64) return false;
  try {
    const spki = base64ToArrayBuffer(spkiB64);
    const sig = base64ToArrayBuffer(sigB64);
    if (sig.byteLength !== 64) return false;
    const key = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig,
      utf8ToArrayBuffer(message),
    );
  } catch {
    return false;
  }
}

export async function computeTransferCode6(
  userId: number,
  transferId: string,
  requesterDeviceId: number,
  requesterEphPub: string,
): Promise<string> {
  const input = utf8ToArrayBuffer(`pg-xfer-code-v1|${userId}|${transferId}|${requesterDeviceId}|${requesterEphPub}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const num = (((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0) % 1_000_000;
  const s = String(num).padStart(6, '0');
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

function buildQrMatrix(payload: string): { qrModules: boolean[][]; qrSize: number } {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
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
  return { qrModules, qrSize };
}

function randomHexLocal(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const localMutexChains = new Map<string, Promise<unknown>>();

export async function withCryptoLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const navLocks = (
    globalThis as unknown as {
      navigator?: {
        locks?: {
          request<R>(
            name: string,
            options: { mode: 'exclusive'; signal?: AbortSignal },
            cb: () => Promise<R>,
          ): Promise<R>;
        };
      };
    }
  ).navigator?.locks;

  if (navLocks && typeof navLocks.request === 'function') {
    const timeoutMs = Math.max(50, Math.floor(Number(opts?.timeoutMs) || 15000));
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let acquired = false;
    if (ctrl) {
      timer = setTimeout(() => {
        if (!acquired) ctrl.abort();
      }, timeoutMs);
    }
    try {
      const reqOpts: { mode: 'exclusive'; signal?: AbortSignal } = ctrl
        ? { mode: 'exclusive', signal: ctrl.signal }
        : { mode: 'exclusive' };
      return await navLocks.request(lockName, reqOpts, async () => {
        acquired = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        return fn();
      });
    } catch (err: unknown) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const name = err instanceof Error ? err.name : '';
      if (!acquired && (name === 'AbortError' || (ctrl && ctrl.signal.aborted))) {
        throw Object.assign(new Error('Failed to acquire Web Locks crypto mutex'), { code: 'LOCK_TIMEOUT' });
      }
      throw err;
    }
  }

  const isBrowserContext =
    typeof (globalThis as unknown as { window?: unknown }).window !== 'undefined' &&
    typeof (globalThis as unknown as { document?: unknown }).document !== 'undefined';

  if (isBrowserContext) {
    throw Object.assign(new Error('Web Locks API unavailable for cross-tab crypto locking'), {
      code: 'LOCK_UNAVAILABLE',
    });
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
    return await fn();
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
    async getAllEntries<T>(store: string): Promise<Array<[string, T]>> {
      return Array.from(getMap(store).entries()) as Array<[string, T]>;
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
    async getAllEntries<T>(store: string): Promise<Array<[string, T]>> {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const out: Array<[string, T]> = [];
        const tx = db.transaction(store, 'readonly');
        const os = tx.objectStore(store);
        if (typeof os.openCursor !== 'function') {
          resolve(out);
          return;
        }
        const req = os.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            out.push([String(cursor.key), cursor.value as T]);
            cursor.continue();
          }
        };
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
    const next = Math.floor(Number(version || 0));
    if (!Number.isFinite(next) || next <= 0) return;
    const cur = await this.getPinnedDeviceListVersion(partnerUserId);
    if (next > cur) {
      await this.backend.put('meta', `pinned_list_ver_${partnerUserId}`, next);
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

  async getAllCachedMessages(): Promise<Array<{ id: number; payload: DecryptedPayload }>> {
    if (typeof this.backend.getAllEntries !== 'function') return [];
    const raw = await this.backend.getAllEntries<DecryptedPayload>('msgCache');
    const out: Array<{ id: number; payload: DecryptedPayload }> = [];
    for (const [k, v] of raw) {
      const id = Number(k);
      if (Number.isInteger(id) && id > 0 && v && typeof v === 'object') {
        out.push({ id, payload: v });
      }
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  async getTombstones(): Promise<number[]> {
    const raw = await this.backend.get<number[]>('meta', 'deleted_msg_ids');
    return Array.isArray(raw)
      ? Array.from(new Set(raw.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0))).sort((a, b) => a - b)
      : [];
  }

  async addTombstones(ids: number[]): Promise<number[]> {
    const existing = await this.getTombstones();
    const merged = new Set<number>(existing);
    for (const rawId of ids) {
      const id = Number(rawId);
      if (Number.isInteger(id) && id > 0) merged.add(id);
    }
    const sorted = Array.from(merged).sort((a, b) => a - b);
    await this.backend.put('meta', 'deleted_msg_ids', sorted);
    return sorted;
  }

  async getBackupRecoveryKeyRaw(): Promise<string | undefined> {
    return this.backend.get<string>('meta', 'backupRecoveryKey');
  }

  async setBackupRecoveryKeyRaw(rawB64: string | null): Promise<void> {
    if (!rawB64) {
      await this.backend.del('meta', 'backupRecoveryKey');
      return;
    }
    await this.backend.put('meta', 'backupRecoveryKey', rawB64);
  }

  async getBackupSyncState(): Promise<{
    epoch: number;
    version: number;
    pinnedVersion: number;
    kdfSalt: string;
    backedUpMsgVersions: Record<string, number>;
    backedUpTombstones: number[];
    lastAutoBackupAt: number;
  }> {
    const raw = await this.backend.get<{
      epoch?: number;
      version?: number;
      pinnedVersion?: number;
      kdfSalt?: string;
      backedUpMsgVersions?: Record<string, number>;
      backedUpTombstones?: number[];
      lastAutoBackupAt?: number;
    }>('meta', 'backupSyncState');
    return {
      epoch: Number(raw?.epoch || 1),
      version: Number(raw?.version || 0),
      pinnedVersion: Number(raw?.pinnedVersion || 0),
      kdfSalt: String(raw?.kdfSalt || ''),
      backedUpMsgVersions:
        raw && raw.backedUpMsgVersions && typeof raw.backedUpMsgVersions === 'object'
          ? { ...raw.backedUpMsgVersions }
          : {},
      backedUpTombstones: Array.isArray(raw?.backedUpTombstones)
        ? raw.backedUpTombstones.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)
        : [],
      lastAutoBackupAt: Number(raw?.lastAutoBackupAt || 0),
    };
  }

  async setBackupSyncState(state: {
    epoch: number;
    version: number;
    pinnedVersion: number;
    kdfSalt: string;
    backedUpMsgVersions: Record<string, number>;
    backedUpTombstones: number[];
    lastAutoBackupAt: number;
  }): Promise<void> {
    const cur = await this.getBackupSyncState();
    await this.backend.put('meta', 'backupSyncState', {
      ...state,
      pinnedVersion: Math.max(cur.pinnedVersion, Number(state.pinnedVersion || 0)),
    });
  }

  async clearBackupSyncState(): Promise<void> {
    const cur = await this.getBackupSyncState();
    await this.backend.put('meta', 'backupSyncState', {
      epoch: cur.epoch + 1,
      version: 0,
      pinnedVersion: cur.pinnedVersion,
      kdfSalt: '',
      backedUpMsgVersions: {},
      backedUpTombstones: [],
      lastAutoBackupAt: 0,
    });
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
  private pendingBackupDirty = 0;
  private autoBackupEnabledCache: boolean | null = null;
  private autoBackupRunning = false;
  private activeReceiveTransfers = new Map<string, { ephPriv: CryptoKey; ephPub: string; deviceId: number }>();

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
      this.noteBackupDirty(1);
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
    const crossTabLock = `pg_e2ee_u_${this.userId}:partner:${senderId}`;

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
      return {
        ok: false,
        reason: senderId === Number(this.userId) ? 'SENT_FROM_OTHER_DEVICE' : 'NOT_FOR_THIS_DEVICE',
      };
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
        this.noteBackupDirty(1);
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
    if (!res.ok) {
      if (res.status === 404 || res.status === 403 || res.status === 410) {
        throw Object.assign(new Error('Encrypted media unavailable'), { code: 'MEDIA_UNAVAILABLE' });
      }
      throw Object.assign(new Error('Failed to download encrypted media'), { code: 'NETWORK' });
    }
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

    const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${partnerUserId}&include_self=1`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch partner identity');
    const data = (await res.json()) as {
      devices?: RemoteIdentityDevice[];
      device_list?: ServerDeviceList | null;
      self_devices?: RemoteIdentityDevice[];
      self_device_list?: ServerDeviceList | null;
    };
    const devs = data.devices || [];
    if (devs.length === 0) {
      throw Object.assign(new Error('Partner has no E2EE keys'), { code: 'PARTNER_NOT_READY' });
    }

    const sortedPartnerDevs = [...devs].sort((a, b) => Number(a.device_id) - Number(b.device_id));
    const primary = devs.find((d) => d.is_primary) || sortedPartnerDevs[0];
    const trustCheck = await this.verifyRemoteDeviceTrust(partnerUserId, devs, data.device_list, 0);
    const keyChanged = trustCheck.changes.length > 0;
    const hasLegacyDevices = devs.some((d) => !d.trust_origin || d.trust_origin === 'legacy');

    const remoteKeyBufs: ArrayBuffer[] = [];
    const seenPartnerIds = new Set<number>();
    let effectivePrimaryKey = primary.identity_key_pub;
    for (const d of sortedPartnerDevs) {
      const devId = Number(d.device_id);
      if (seenPartnerIds.has(devId)) continue;
      seenPartnerIds.add(devId);
      const pinned = await this.store.getTrustedIdentityB64(
        makeDeviceAddress(partnerUserId, devId).getName(),
      );
      const effectiveKey = pinned || d.identity_key_pub;
      if (devId === Number(primary.device_id)) {
        effectivePrimaryKey = effectiveKey;
      }
      remoteKeyBufs.push(base64ToArrayBuffer(effectiveKey));
    }

    const selfDevs = Array.isArray(data.self_devices) ? data.self_devices : [];
    const sortedSelfDevs = [...selfDevs].sort((a, b) => Number(a.device_id) - Number(b.device_id));
    const localKeyBufs: ArrayBuffer[] = [];
    const seenSelfIds = new Set<number>();
    for (const sd of sortedSelfDevs) {
      const devId = Number(sd.device_id);
      if (seenSelfIds.has(devId)) continue;
      seenSelfIds.add(devId);
      localKeyBufs.push(base64ToArrayBuffer(sd.identity_key_pub));
    }
    if (localKeyBufs.length === 0) {
      localKeyBufs.push(localKp.pubKey);
    }

    const localCanonicalBuf = concatKeyBuffers(localKeyBufs);
    const remoteCanonicalBuf = concatKeyBuffers(remoteKeyBufs);

    const fpGen = new FingerprintGenerator(5200);
    const fingerprint60 = await fpGen.createFor(
      String(this.userId),
      localCanonicalBuf,
      String(partnerUserId),
      remoteCanonicalBuf,
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
      partnerKeyPub: effectivePrimaryKey,
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
    items: Array<{ userId: number; deviceId: number; identityKey: string; reason?: string }>,
    partnerUserId?: number,
    nextListVersion?: number,
    rollbackDetected?: boolean,
  ): Promise<void> {
    if (!Array.isArray(items)) return;
    const targetUid = partnerUserId || (items[0] ? Number(items[0].userId) : 0);
    if (rollbackDetected || items.some((i) => i && i.reason === 'LIST_ROLLBACK')) {
      throw Object.assign(new Error('Device list rollback cannot be accepted'), {
        code: 'LIST_ROLLBACK_FORBIDDEN',
      });
    }
    const lockName = targetUid > 0 ? `pg_e2ee_u_${this.userId}:partner:${targetUid}` : `pg_e2ee_u_${this.userId}:core`;
    await withCryptoLock(lockName, async () => {
      const curPinned = targetUid > 0 ? await this.store.getPinnedDeviceListVersion(targetUid) : 0;
      if (curPinned > 0 && nextListVersion !== undefined && nextListVersion > 0 && nextListVersion < curPinned) {
        throw Object.assign(new Error('Device list rollback cannot be accepted'), {
          code: 'LIST_ROLLBACK_FORBIDDEN',
        });
      }

      let liveData: { devices?: RemoteIdentityDevice[]; device_list?: ServerDeviceList | null } | null = null;
      if (targetUid > 0) {
        try {
          const res = await this.fetchImpl(`/api/e2ee/keys/identities?user_id=${targetUid}`, {
            credentials: 'same-origin',
            cache: 'no-store',
          });
          if (res.ok) {
            liveData = (await res.json()) as {
              devices?: RemoteIdentityDevice[];
              device_list?: ServerDeviceList | null;
            };
          }
        } catch {}
      }

      const liveVer = liveData && liveData.device_list ? Number(liveData.device_list.list_version || 0) : 0;
      if (curPinned > 0 && liveData && liveVer < curPinned) {
        throw Object.assign(new Error('Device list rollback cannot be accepted'), {
          code: 'LIST_ROLLBACK_FORBIDDEN',
        });
      }

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
      if (targetUid > 0) {
        const bestVer = Math.max(Number(nextListVersion || 0), liveVer);
        if (bestVer > 0) {
          await this.store.setPinnedDeviceListVersion(targetUid, bestVer);
        }
        if (liveData) {
          const liveIds = (liveData.devices || []).map((d) => Number(d.device_id));
          await this.store.setKnownDevices(targetUid, liveIds);
        }
      }
      affectedUsers.forEach((uid) => {
        this.postSync({ type: 'key_accepted', userId: uid });
      });
    });
  }

  async unregisterDevice(): Promise<boolean> {
    try {
      const deviceId = await this.store.getDeviceId();
      if (!deviceId || deviceId <= 0) return false;
      const signingRec = await this.store.getDeviceSigningKey();
      const identityKp = await this.store.getIdentityKeyPair();
      if (!signingRec || !signingRec.privJwk || !identityKp) return false;

      const timestamp = Date.now();
      const unregMsg = buildUnregisterDeviceMsg(this.userId, deviceId, timestamp);
      const signature = await this.signEcdsaP256(unregMsg);

      const payload: Record<string, unknown> = {
        device_id: deviceId,
        timestamp,
        signature,
      };

      try {
        const devRes = await this.fetchImpl('/api/e2ee/devices', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (devRes.ok) {
          const devData = (await devRes.json()) as {
            devices?: Array<{
              device_id: number;
              identity_key_pub: string;
              signing_key_pub?: string;
              approval_status: string;
            }>;
            device_list?: ServerDeviceList | null;
          };
          const me = (devData.devices || []).find((d) => Number(d.device_id) === Number(deviceId));
          const remaining: SignedDeviceListEntry[] = (devData.devices || [])
            .filter((d) => d.approval_status === 'approved' && Number(d.device_id) !== Number(deviceId))
            .map((d) => ({
              device_id: Number(d.device_id),
              identity_key_pub: d.identity_key_pub,
              signing_key_pub: d.signing_key_pub || '',
            }))
            .sort((a, b) => a.device_id - b.device_id);
          if (me && me.approval_status === 'approved' && remaining.length > 0) {
            const nextVer = Number(devData.device_list?.list_version || 0) + 1;
            const listMsg = buildDeviceListCanonicalMsg(this.userId, nextVer, false, remaining);
            const [ecdsaSig, signalSig] = await Promise.all([
              this.signEcdsaP256(listMsg),
              signSignalEd25519(identityKp.privKey, listMsg),
            ]);
            payload.device_list = {
              list_version: nextVer,
              devices: remaining,
              ecdsa_signature: ecdsaSig,
              signal_signature: signalSig,
            };
          }
        }
      } catch {}

      const res = await this.fetchImpl('/api/e2ee/keys/unregister', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return Boolean(res && res.ok);
    } catch {
      return false;
    }
  }

  async clearCachedMessages(msgIds: number[]): Promise<void> {
    if (!Array.isArray(msgIds) || msgIds.length === 0) return;
    const validIds: number[] = [];
    for (const rawId of msgIds) {
      const id = Number(rawId);
      if (Number.isInteger(id) && id > 0) {
        validIds.push(id);
        this.memMsgCache.delete(id);
        try {
          await this.store.removeCachedMessage(id);
        } catch {}
      }
    }
    if (validIds.length > 0) {
      try {
        await this.store.addTombstones(validIds);
      } catch {}
      this.noteBackupDirty(validIds.length);
    }
  }

  private noteBackupDirty(count: number = 1): void {
    this.pendingBackupDirty += Math.max(1, count);
    if (this.pendingBackupDirty >= AUTO_BACKUP_BATCH_THRESHOLD) {
      void this.flushAutoBackupIfDue(0);
    } else {
      void this.flushAutoBackupIfDue(AUTO_BACKUP_MIN_INTERVAL_MS);
    }
  }

  async flushAutoBackupIfDue(minIntervalMs: number = AUTO_BACKUP_MIN_BG_INTERVAL_MS): Promise<boolean> {
    if (this.autoBackupRunning || this.pendingBackupDirty <= 0) return false;
    try {
      const rawKey = await this.store.getBackupRecoveryKeyRaw();
      if (!rawKey) return false;
      const sync = await this.store.getBackupSyncState();
      if (minIntervalMs > 0 && Date.now() - sync.lastAutoBackupAt < minIntervalMs) {
        return false;
      }
      if (this.autoBackupEnabledCache === false) return false;
      this.autoBackupRunning = true;
      const status = await this.getBackupStatus();
      this.autoBackupEnabledCache = Boolean(status.enabled);
      if (!status.enabled) return false;
      await this.backupNow({ auto: true });
      this.pendingBackupDirty = 0;
      return true;
    } catch {
      return false;
    } finally {
      this.autoBackupRunning = false;
    }
  }

  async getLocalHistoryStats(): Promise<{
    cachedMessages: number;
    tombstones: number;
    hasRecoveryKey: boolean;
    estimatedBytes: number;
  }> {
    await this.ensureInitialized();
    const [entries, tombstones, rawKey] = await Promise.all([
      this.store.getAllCachedMessages(),
      this.store.getTombstones(),
      this.store.getBackupRecoveryKeyRaw(),
    ]);
    const tombSet = new Set(tombstones);
    const live = entries.filter((e) => !tombSet.has(e.id));
    let est = 0;
    for (let i = 0; i < live.length; i++) {
      est += JSON.stringify(live[i]).length;
    }
    return {
      cachedMessages: live.length,
      tombstones: tombstones.length,
      hasRecoveryKey: Boolean(rawKey),
      estimatedBytes: est,
    };
  }

  async getLocalRecoveryKeyFormatted(): Promise<string | null> {
    await this.ensureInitialized();
    const rawB64 = await this.store.getBackupRecoveryKeyRaw();
    if (!rawB64) return null;
    const raw = new Uint8Array(base64ToArrayBuffer(rawB64));
    if (raw.byteLength !== 32) return null;
    return formatRecoveryKeyFromRaw(raw);
  }

  async generateNewRecoveryKeyDraft(): Promise<{ rawB64: string; formatted: string }> {
    return generateRecoveryKey();
  }

  async getBackupStatus(): Promise<{
    exists: boolean;
    enabled: boolean;
    backup_epoch: number;
    backup_version: number;
    kdf_salt: string;
    signer_device_id: number;
    manifest_sig: string;
    chunk_count: number;
    base_chunk_count?: number;
    total_size_bytes: number;
    message_count: number;
    last_msg_id: number;
    last_backup_at: string | null;
    chunks: Array<{
      chunk_seq: number;
      iv_b64: string;
      sha256_b64: string;
      size_bytes: number;
      msg_count: number;
      max_msg_id: number;
    }>;
    has_local_key: boolean;
    local_cached_messages: number;
  }> {
    await this.ensureInitialized();
    const [res, rawKey, localEntries, tombstones] = await Promise.all([
      this.fetchImpl('/api/e2ee/backup/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      }),
      this.store.getBackupRecoveryKeyRaw(),
      this.store.getAllCachedMessages(),
      this.store.getTombstones(),
    ]);
    if (!res.ok) {
      throw Object.assign(new Error('Failed to load backup status'), { code: 'NETWORK' });
    }
    const data = (await res.json()) as {
      backup: {
        exists: boolean;
        enabled: boolean;
        backup_epoch: number;
        backup_version: number;
        kdf_salt: string;
        signer_device_id: number;
        manifest_sig: string;
        chunk_count: number;
        total_size_bytes: number;
        message_count: number;
        last_msg_id: number;
        last_backup_at: string | null;
      };
      chunks: Array<{
        chunk_seq: number;
        iv_b64: string;
        sha256_b64: string;
        size_bytes: number;
        msg_count: number;
        max_msg_id: number;
      }>;
    };
    this.autoBackupEnabledCache = Boolean(data.backup?.enabled);
    const tombSet = new Set(tombstones);
    const liveCount = localEntries.filter((e) => !tombSet.has(e.id)).length;
    return {
      ...data.backup,
      chunks: Array.isArray(data.chunks) ? data.chunks : [],
      has_local_key: Boolean(rawKey),
      local_cached_messages: liveCount,
    };
  }

  async setAutoBackupEnabled(enabled: boolean): Promise<boolean> {
    await this.ensureInitialized();
    const res = await this.fetchImpl('/api/e2ee/backup/toggle', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: Boolean(enabled) }),
    });
    if (!res.ok) throw Object.assign(new Error('Failed to toggle backup'), { code: 'NETWORK' });
    this.autoBackupEnabledCache = Boolean(enabled);
    return Boolean(enabled);
  }

  async enableBackupWithKey(
    formattedKey: string,
    opts?: { maxChunkRawBytes?: number },
  ): Promise<{
    backup_epoch: number;
    backup_version: number;
    chunk_count: number;
    total_size_bytes: number;
    message_count: number;
  }> {
    const keyBytes = await parseRecoveryKey(formattedKey);
    await this.store.setBackupRecoveryKeyRaw(bytesToBase64(keyBytes));
    await this.setAutoBackupEnabled(true);
    const res = await this.backupNow({ forceFull: false, maxChunkRawBytes: opts?.maxChunkRawBytes });
    return {
      backup_epoch: res.backup_epoch,
      backup_version: res.backup_version,
      chunk_count: res.chunk_count,
      total_size_bytes: res.total_size_bytes,
      message_count: res.message_count,
    };
  }

  private async downloadAndDecryptBackupChunks(
    rawKeyBytes: Uint8Array,
    epoch: number,
    kdfSalt: string,
    chunks: Array<{ chunk_seq: number; iv_b64: string; sha256_b64: string; size_bytes: number }>,
  ): Promise<{ messages: Array<{ id: number; payload: DecryptedPayload }>; tombstones: number[] }> {
    const aesKey = await deriveBackupAesKey(rawKeyBytes, kdfSalt, this.userId, epoch);
    const mergedMessages = new Map<number, DecryptedPayload>();
    const mergedTombstones = new Set<number>();
    let prevSha = 'GENESIS';

    for (let i = 0; i < chunks.length; i++) {
      const meta = chunks[i];
      if (Number(meta.chunk_seq) !== i) {
        throw Object.assign(new Error('Missing backup chunk sequence'), { code: 'BACKUP_CORRUPTED' });
      }
      const res = await this.fetchImpl(`/api/e2ee/backup/chunk?epoch=${epoch}&seq=${i}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw Object.assign(new Error('Failed to download backup chunk'), { code: 'NETWORK' });
      }
      const encBuf = await res.arrayBuffer();
      const encBytes = new Uint8Array(encBuf);
      const actualSha = await sha256B64Bytes(encBytes);
      if (actualSha !== meta.sha256_b64) {
        throw Object.assign(new Error('Backup chunk checksum mismatch'), { code: 'BACKUP_CORRUPTED' });
      }

      const aad = utf8ToArrayBuffer(`pg-backup-chunk-v1|${this.userId}|${epoch}|${i}|${prevSha}`);
      let plainFramed: ArrayBuffer;
      try {
        plainFramed = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(base64ToArrayBuffer(meta.iv_b64)),
            additionalData: aad,
          },
          aesKey,
          encBytes,
        );
      } catch {
        throw Object.assign(new Error('Backup decryption failed'), {
          code: i === 0 ? 'WRONG_RECOVERY_KEY' : 'BACKUP_CORRUPTED',
        });
      }

      const rawJsonBytes = await decompressPayloadBytes(new Uint8Array(plainFramed));
      let parsed: {
        v?: number;
        messages?: Array<{ id?: unknown; payload?: DecryptedPayload }>;
        tombstones?: unknown[];
      };
      try {
        parsed = JSON.parse(new TextDecoder().decode(rawJsonBytes));
      } catch {
        throw Object.assign(new Error('Invalid backup chunk JSON'), { code: 'BACKUP_CORRUPTED' });
      }

      if (Array.isArray(parsed.tombstones)) {
        for (const tid of parsed.tombstones) {
          const n = Number(tid);
          if (Number.isInteger(n) && n > 0) {
            mergedTombstones.add(n);
            mergedMessages.delete(n);
          }
        }
      }
      if (Array.isArray(parsed.messages)) {
        for (const item of parsed.messages) {
          const id = Number(item?.id || 0);
          if (!Number.isInteger(id) || id <= 0 || mergedTombstones.has(id)) continue;
          const p = item.payload;
          if (!p || typeof p !== 'object') continue;
          const existing = mergedMessages.get(id);
          if (!existing || Number(p.editVersion || 0) >= Number(existing.editVersion || 0)) {
            mergedMessages.set(id, p);
          }
        }
      }

      prevSha = meta.sha256_b64;
    }

    const outMessages: Array<{ id: number; payload: DecryptedPayload }> = [];
    mergedMessages.forEach((payload, id) => {
      if (!mergedTombstones.has(id)) outMessages.push({ id, payload });
    });
    outMessages.sort((a, b) => a.id - b.id);
    return {
      messages: outMessages,
      tombstones: Array.from(mergedTombstones).sort((a, b) => a - b),
    };
  }

  private async mergeDecryptedHistoryIntoLocal(
    messages: Array<{ id: number; payload: DecryptedPayload }>,
    tombstones: number[],
  ): Promise<{ restoredMessages: number; appliedTombstones: number }> {
    const allTombs = await this.store.addTombstones(tombstones);
    const tombSet = new Set(allTombs);
    let appliedTombstones = 0;
    for (const tid of tombstones) {
      this.memMsgCache.delete(tid);
      try {
        await this.store.removeCachedMessage(tid);
        appliedTombstones++;
      } catch {}
    }

    const existingEntries = await this.store.getAllCachedMessages();
    const existingMap = new Map<number, DecryptedPayload>(existingEntries.map((e) => [e.id, e.payload]));
    let restoredMessages = 0;

    for (const item of messages) {
      if (tombSet.has(item.id)) continue;
      const cur = existingMap.get(item.id);
      const nextVer = Number(item.payload.editVersion || 0);
      const curVer = cur ? Number(cur.editVersion || 0) : -1;
      if (!cur || nextVer > curVer) {
        this.memMsgCache.set(item.id, item.payload);
        await this.store.setCachedMessage(item.id, item.payload);
        restoredMessages++;
      }
    }
    return { restoredMessages, appliedTombstones };
  }

  private splitIntoPlaintextChunks(
    messages: Array<{ id: number; payload: DecryptedPayload }>,
    tombstones: number[],
    maxChunkRawBytes: number,
  ): Array<{ messages: Array<{ id: number; payload: DecryptedPayload }>; tombstones: number[] }> {
    const cap = Math.max(4096, Math.floor(maxChunkRawBytes || DEFAULT_MAX_CHUNK_RAW_BYTES));
    const chunks: Array<{ messages: Array<{ id: number; payload: DecryptedPayload }>; tombstones: number[] }> = [];
    let curMsgs: Array<{ id: number; payload: DecryptedPayload }> = [];
    let curSize = 64;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const mLen = JSON.stringify(m).length + 2;
      if (curMsgs.length > 0 && curSize + mLen > cap) {
        chunks.push({ messages: curMsgs, tombstones: chunks.length === 0 ? tombstones : [] });
        curMsgs = [];
        curSize = 64;
      }
      curMsgs.push(m);
      curSize += mLen;
    }

    if (curMsgs.length > 0 || chunks.length === 0) {
      chunks.push({ messages: curMsgs, tombstones: chunks.length === 0 ? tombstones : [] });
    }
    return chunks;
  }

  async backupNow(opts?: {
    forceFull?: boolean;
    maxChunkRawBytes?: number;
    auto?: boolean;
  }): Promise<{
    skipped?: boolean;
    mode: 'delta' | 'base' | 'skipped';
    backup_epoch: number;
    backup_version: number;
    chunk_count: number;
    total_size_bytes: number;
    message_count: number;
    merged_remote?: boolean;
  }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      const myDeviceId = await this.ensureInitialized();
      if (this.deviceStatus && this.deviceStatus.approvalStatus === 'pending') {
        const refreshed = await this.refreshDeviceStatus();
        if (refreshed.approvalStatus === 'pending') {
          throw Object.assign(new Error('Device approval required'), { code: 'DEVICE_PENDING' });
        }
      }

      const rawKeyB64 = await this.store.getBackupRecoveryKeyRaw();
      if (!rawKeyB64) {
        throw Object.assign(new Error('Recovery key not configured on this device'), { code: 'NO_RECOVERY_KEY' });
      }
      const rawKeyBytes = new Uint8Array(base64ToArrayBuffer(rawKeyB64));
      const maxRaw = opts?.maxChunkRawBytes || DEFAULT_MAX_CHUNK_RAW_BYTES;
      let mergedRemote = false;

      for (let attempt = 0; attempt < 2; attempt++) {
        const srv = await this.getBackupStatus();
        const sync = await this.store.getBackupSyncState();

        if (sync.pinnedVersion > 0 && srv.exists && srv.backup_version < sync.pinnedVersion) {
          throw Object.assign(new Error('Backup version rollback detected'), { code: 'BACKUP_ROLLBACK_DETECTED' });
        }

        if (srv.exists && (srv.backup_version > sync.version || srv.backup_epoch !== sync.epoch)) {
          const remoteHistory = await this.downloadAndDecryptBackupChunks(
            rawKeyBytes,
            srv.backup_epoch,
            srv.kdf_salt,
            srv.chunks,
          );
          await this.mergeDecryptedHistoryIntoLocal(remoteHistory.messages, remoteHistory.tombstones);
          mergedRemote = true;
          const nextMap: Record<string, number> = {};
          for (const rm of remoteHistory.messages) {
            nextMap[String(rm.id)] = Number(rm.payload.editVersion || 0);
          }
          await this.store.setBackupSyncState({
            epoch: srv.backup_epoch,
            version: srv.backup_version,
            pinnedVersion: Math.max(sync.pinnedVersion, srv.backup_version),
            kdfSalt: srv.kdf_salt,
            backedUpMsgVersions: nextMap,
            backedUpTombstones: remoteHistory.tombstones,
            lastAutoBackupAt: sync.lastAutoBackupAt,
          });
        }

        const freshSync = await this.store.getBackupSyncState();
        const [allLocalEntries, allTombstones] = await Promise.all([
          this.store.getAllCachedMessages(),
          this.store.getTombstones(),
        ]);
        const tombSet = new Set(allTombstones);
        const liveEntries = allLocalEntries.filter((e) => !tombSet.has(e.id));

        const prevTombSet = new Set(freshSync.backedUpTombstones);
        const dirtyMessages = liveEntries.filter(
          (e) => freshSync.backedUpMsgVersions[String(e.id)] !== Number(e.payload.editVersion || 0),
        );
        const dirtyTombstones = allTombstones.filter((tid) => !prevTombSet.has(tid));

        if (srv.exists && !opts?.forceFull && dirtyMessages.length === 0 && dirtyTombstones.length === 0) {
          await this.store.setBackupSyncState({
            ...freshSync,
            lastAutoBackupAt: Date.now(),
          });
          this.pendingBackupDirty = 0;
          return {
            skipped: true,
            mode: 'skipped',
            backup_epoch: srv.backup_epoch,
            backup_version: srv.backup_version,
            chunk_count: srv.chunk_count,
            total_size_bytes: srv.total_size_bytes,
            message_count: liveEntries.length,
            merged_remote: mergedRemote,
          };
        }

        const deltaRawBytes = JSON.stringify({ v: 1, messages: dirtyMessages, tombstones: dirtyTombstones }).length;
        const baseChunks = Math.max(1, Math.min(srv.chunk_count, Number(srv.base_chunk_count || srv.chunk_count)));
        const deltaChunks = srv.chunk_count - baseChunks;
        const canAppendDelta =
          srv.exists &&
          !opts?.forceFull &&
          srv.chunk_count > 0 &&
          deltaChunks < BACKUP_COMPACT_THRESHOLD - 1 &&
          srv.chunk_count < BACKUP_MAX_CHUNKS_PER_EPOCH &&
          deltaRawBytes <= maxRaw &&
          Boolean(srv.kdf_salt);

        if (canAppendDelta) {
          const seq = srv.chunk_count;
          const prevSha = srv.chunks[seq - 1].sha256_b64;
          const aesKey = await deriveBackupAesKey(rawKeyBytes, srv.kdf_salt, this.userId, srv.backup_epoch);
          const plainJson = new TextEncoder().encode(
            JSON.stringify({ v: 1, messages: dirtyMessages, tombstones: dirtyTombstones }),
          );
          const compressed = await compressPayloadBytes(plainJson);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ivB64 = bytesToBase64(iv);
          const aad = utf8ToArrayBuffer(`pg-backup-chunk-v1|${this.userId}|${srv.backup_epoch}|${seq}|${prevSha}`);
          const encBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, aesKey, compressed);
          const encBytes = new Uint8Array(encBuf);
          const shaB64 = await sha256B64Bytes(encBytes);
          const nextVer = srv.backup_version + 1;
          const maxMsgId = dirtyMessages.reduce((mx, m) => (m.id > mx ? m.id : mx), srv.last_msg_id);

          const deltaMsg = `pg-backup-delta-v1|${this.userId}|${myDeviceId}|${srv.backup_epoch}|${srv.backup_version}|${nextVer}|${seq}|${ivB64}|${shaB64}|${encBytes.byteLength}|${srv.kdf_salt}`;
          const signature = await this.signEcdsaP256(deltaMsg);

          const fd = new FormData();
          fd.append('device_id', String(myDeviceId));
          fd.append('epoch', String(srv.backup_epoch));
          fd.append('expected_version', String(srv.backup_version));
          fd.append('chunk_seq', String(seq));
          fd.append('iv_b64', ivB64);
          fd.append('sha256_b64', shaB64);
          fd.append('msg_count', String(dirtyMessages.length));
          fd.append('max_msg_id', String(maxMsgId));
          fd.append('total_message_count', String(liveEntries.length));
          fd.append('kdf_salt', srv.kdf_salt);
          fd.append('signature', signature);
          fd.append('chunk', new Blob([encBytes], { type: 'application/octet-stream' }), `c_${seq}.bin`);

          const upRes = await this.fetchImpl('/api/e2ee/backup/delta', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd,
          });
          if (upRes.status === 409 && attempt === 0) {
            continue;
          }
          if (!upRes.ok) {
            const errData = (await upRes.json().catch(() => ({}))) as { error?: string; code?: string };
            throw Object.assign(new Error(errData.error || 'Delta backup failed'), {
              code: errData.code || 'BACKUP_FAILED',
            });
          }
          const upData = (await upRes.json()) as {
            backup_epoch: number;
            backup_version: number;
            chunk_count: number;
            total_size_bytes: number;
          };

          const nextVersionsMap: Record<string, number> = {};
          for (const e of liveEntries) nextVersionsMap[String(e.id)] = Number(e.payload.editVersion || 0);
          await this.store.setBackupSyncState({
            epoch: upData.backup_epoch,
            version: upData.backup_version,
            pinnedVersion: Math.max(freshSync.pinnedVersion, upData.backup_version),
            kdfSalt: srv.kdf_salt,
            backedUpMsgVersions: nextVersionsMap,
            backedUpTombstones: allTombstones,
            lastAutoBackupAt: Date.now(),
          });
          this.pendingBackupDirty = 0;
          return {
            mode: 'delta',
            backup_epoch: upData.backup_epoch,
            backup_version: upData.backup_version,
            chunk_count: upData.chunk_count,
            total_size_bytes: upData.total_size_bytes,
            message_count: liveEntries.length,
            merged_remote: mergedRemote,
          };
        }

        const targetEpoch = srv.backup_version > 0 ? srv.backup_epoch + 1 : Math.max(1, srv.backup_epoch);
        const kdfSalt = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
        const aesKey = await deriveBackupAesKey(rawKeyBytes, kdfSalt, this.userId, targetEpoch);
        const plainChunks = this.splitIntoPlaintextChunks(liveEntries, allTombstones, maxRaw);

        const stagedMeta: Array<{ chunk_seq: number; sha256_b64: string; size_bytes: number }> = [];
        let prevSha = 'GENESIS';
        let overallMaxId = 0;

        for (let seq = 0; seq < plainChunks.length; seq++) {
          const pc = plainChunks[seq];
          const plainJson = new TextEncoder().encode(
            JSON.stringify({ v: 1, messages: pc.messages, tombstones: pc.tombstones }),
          );
          const compressed = await compressPayloadBytes(plainJson);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ivB64 = bytesToBase64(iv);
          const aad = utf8ToArrayBuffer(`pg-backup-chunk-v1|${this.userId}|${targetEpoch}|${seq}|${prevSha}`);
          const encBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, aesKey, compressed);
          const encBytes = new Uint8Array(encBuf);
          const shaB64 = await sha256B64Bytes(encBytes);
          const chunkMaxId = pc.messages.reduce((mx, m) => (m.id > mx ? m.id : mx), 0);
          if (chunkMaxId > overallMaxId) overallMaxId = chunkMaxId;

          const stageMsg = `pg-backup-stage-v1|${this.userId}|${myDeviceId}|${targetEpoch}|${seq}|${ivB64}|${shaB64}|${encBytes.byteLength}`;
          const stageSig = await this.signEcdsaP256(stageMsg);

          const fd = new FormData();
          fd.append('device_id', String(myDeviceId));
          fd.append('target_epoch', String(targetEpoch));
          fd.append('chunk_seq', String(seq));
          fd.append('iv_b64', ivB64);
          fd.append('sha256_b64', shaB64);
          fd.append('msg_count', String(pc.messages.length));
          fd.append('max_msg_id', String(chunkMaxId));
          fd.append('signature', stageSig);
          fd.append('chunk', new Blob([encBytes], { type: 'application/octet-stream' }), `c_${seq}.bin`);

          const stgRes = await this.fetchImpl('/api/e2ee/backup/stage-chunk', {
            method: 'POST',
            credentials: 'same-origin',
            body: fd,
          });
          if (stgRes.status === 409 && attempt === 0) {
            stagedMeta.length = 0;
            break;
          }
          if (!stgRes.ok) {
            const errData = (await stgRes.json().catch(() => ({}))) as { error?: string; code?: string };
            throw Object.assign(new Error(errData.error || 'Failed to stage backup chunk'), {
              code: errData.code || 'BACKUP_FAILED',
            });
          }
          stagedMeta.push({ chunk_seq: seq, sha256_b64: shaB64, size_bytes: encBytes.byteLength });
          prevSha = shaB64;
        }

        if (stagedMeta.length === 0 && attempt === 0) {
          continue;
        }

        const nextVer = srv.backup_version + 1;
        const digestsCsv = stagedMeta.map((c) => `${c.chunk_seq}:${c.sha256_b64}:${c.size_bytes}`).join(',');
        const commitMsg = `pg-backup-commit-v1|${this.userId}|${myDeviceId}|${targetEpoch}|${srv.backup_version}|${nextVer}|${kdfSalt}|${digestsCsv}`;
        const commitSig = await this.signEcdsaP256(commitMsg);

        const comRes = await this.fetchImpl('/api/e2ee/backup/commit', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: myDeviceId,
            target_epoch: targetEpoch,
            expected_version: srv.backup_version,
            next_version: nextVer,
            kdf_salt: kdfSalt,
            total_message_count: liveEntries.length,
            last_msg_id: overallMaxId,
            enabled: srv.enabled || !opts?.auto,
            chunks: stagedMeta,
            signature: commitSig,
          }),
        });
        if (comRes.status === 409 && attempt === 0) {
          continue;
        }
        if (!comRes.ok) {
          const errData = (await comRes.json().catch(() => ({}))) as { error?: string; code?: string };
          throw Object.assign(new Error(errData.error || 'Backup commit failed'), {
            code: errData.code || 'BACKUP_FAILED',
          });
        }
        const comData = (await comRes.json()) as {
          backup_epoch: number;
          backup_version: number;
          chunk_count: number;
          total_size_bytes: number;
        };

        const nextVersionsMap: Record<string, number> = {};
        for (const e of liveEntries) nextVersionsMap[String(e.id)] = Number(e.payload.editVersion || 0);
        await this.store.setBackupSyncState({
          epoch: comData.backup_epoch,
          version: comData.backup_version,
          pinnedVersion: Math.max(freshSync.pinnedVersion, comData.backup_version),
          kdfSalt,
          backedUpMsgVersions: nextVersionsMap,
          backedUpTombstones: allTombstones,
          lastAutoBackupAt: Date.now(),
        });
        this.pendingBackupDirty = 0;
        return {
          mode: 'base',
          backup_epoch: comData.backup_epoch,
          backup_version: comData.backup_version,
          chunk_count: comData.chunk_count,
          total_size_bytes: comData.total_size_bytes,
          message_count: liveEntries.length,
          merged_remote: mergedRemote,
        };
      }

      throw Object.assign(new Error('Backup version conflict'), { code: 'BACKUP_VERSION_CONFLICT' });
    });
  }

  async restoreFromBackup(formattedRecoveryKey: string): Promise<{
    restoredMessages: number;
    appliedTombstones: number;
    backup_epoch: number;
    backup_version: number;
  }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      await this.ensureInitialized();
      const rawKeyBytes = await parseRecoveryKey(formattedRecoveryKey);
      const srv = await this.getBackupStatus();
      if (!srv.exists || srv.chunks.length === 0 || !srv.kdf_salt) {
        throw Object.assign(new Error('No backup found'), { code: 'NO_BACKUP_FOUND' });
      }
      const sync = await this.store.getBackupSyncState();
      if (sync.pinnedVersion > 0 && srv.backup_version < sync.pinnedVersion) {
        throw Object.assign(new Error('Backup version rollback detected'), { code: 'BACKUP_ROLLBACK_DETECTED' });
      }

      const decrypted = await this.downloadAndDecryptBackupChunks(
        rawKeyBytes,
        srv.backup_epoch,
        srv.kdf_salt,
        srv.chunks,
      );

      const { restoredMessages, appliedTombstones } = await this.mergeDecryptedHistoryIntoLocal(
        decrypted.messages,
        decrypted.tombstones,
      );

      await this.store.setBackupRecoveryKeyRaw(bytesToBase64(rawKeyBytes));
      const versionsMap: Record<string, number> = {};
      for (const m of decrypted.messages) versionsMap[String(m.id)] = Number(m.payload.editVersion || 0);
      await this.store.setBackupSyncState({
        epoch: srv.backup_epoch,
        version: srv.backup_version,
        pinnedVersion: Math.max(sync.pinnedVersion, srv.backup_version),
        kdfSalt: srv.kdf_salt,
        backedUpMsgVersions: versionsMap,
        backedUpTombstones: decrypted.tombstones,
        lastAutoBackupAt: Date.now(),
      });
      this.postSync({ type: 'backup_restored', restoredMessages });
      return {
        restoredMessages,
        appliedTombstones,
        backup_epoch: srv.backup_epoch,
        backup_version: srv.backup_version,
      };
    });
  }

  async deleteBackup(password?: string): Promise<{ success: boolean }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      const myDeviceId = await this.ensureInitialized();
      const srv = await this.getBackupStatus();
      const ts = Date.now();
      let body: Record<string, unknown>;
      if (password) {
        body = { password };
      } else {
        const msg = `pg-backup-delete-v1|${this.userId}|${myDeviceId}|${srv.backup_version}|${ts}`;
        const signature = await this.signEcdsaP256(msg);
        body = {
          device_id: myDeviceId,
          expected_version: srv.backup_version,
          timestamp: ts,
          signature,
        };
      }
      const res = await this.fetchImpl('/api/e2ee/backup/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Failed to delete backup'), {
          code: errData.code || 'DELETE_BACKUP_FAILED',
        });
      }
      await this.store.setBackupRecoveryKeyRaw(null);
      await this.store.clearBackupSyncState();
      this.autoBackupEnabledCache = false;
      this.pendingBackupDirty = 0;
      return { success: true };
    });
  }

  private async verifyOwnApprovedDeviceSigningKey(targetDeviceId: number): Promise<string> {
    const myDeviceId = await this.ensureInitialized();
    const { devices, device_list } = await this.listOwnDevices();
    const target = devices.find((d) => Number(d.device_id) === Number(targetDeviceId));
    if (!target || target.approval_status !== 'approved' || !target.signing_key_pub) {
      throw Object.assign(new Error('Target device is not approved'), { code: 'DEVICE_NOT_TRUSTED' });
    }
    if (!device_list || !Array.isArray(device_list.devices)) {
      throw Object.assign(new Error('Missing signed device list'), { code: 'UNVERIFIED_DEVICE_LIST' });
    }
    const entries: SignedDeviceListEntry[] = device_list.devices.map((e) => ({
      device_id: Number(e.device_id),
      identity_key_pub: String(e.identity_key_pub || ''),
      signing_key_pub: String(e.signing_key_pub || ''),
    }));
    const listedTarget = entries.find((e) => e.device_id === Number(targetDeviceId));
    const listedMe = entries.find((e) => e.device_id === Number(myDeviceId));
    const signerEntry = entries.find((e) => e.device_id === Number(device_list.signer_device_id));
    if (
      !listedTarget ||
      listedTarget.signing_key_pub !== target.signing_key_pub ||
      listedTarget.identity_key_pub !== target.identity_key_pub ||
      !listedMe ||
      !signerEntry
    ) {
      throw Object.assign(new Error('Device not present in signed device list'), { code: 'UNVERIFIED_DEVICE_LIST' });
    }
    const canonical = buildDeviceListCanonicalMsg(
      this.userId,
      Number(device_list.list_version),
      Boolean(device_list.is_recovery_reset),
      entries,
    );
    const sigOk = await verifySignalEd25519(
      signerEntry.identity_key_pub,
      canonical,
      String(device_list.signal_signature || ''),
    );
    if (!sigOk) {
      throw Object.assign(new Error('Invalid signed device list signature'), { code: 'UNVERIFIED_DEVICE_LIST' });
    }
    return listedTarget.signing_key_pub;
  }

  async startDeviceTransferReceive(): Promise<{
    transferId: string;
    code6: string;
    qrPayload: string;
    qrModules: boolean[][];
    qrSize: number;
    expiresAt: string;
    requesterDeviceId: number;
    requesterEphPub: string;
  }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      const myDeviceId = await this.ensureInitialized();
      if (this.deviceStatus && this.deviceStatus.approvalStatus === 'pending') {
        const st = await this.refreshDeviceStatus();
        if (st.approvalStatus === 'pending') {
          throw Object.assign(new Error('Device approval required'), { code: 'DEVICE_PENDING' });
        }
      }
      const ephKp = (await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      )) as CryptoKeyPair;
      const ephPubSpki = bytesToBase64((await crypto.subtle.exportKey('spki', ephKp.publicKey)) as ArrayBuffer);
      const transferId = randomHexLocal(16);
      const initMsg = `pg-transfer-init-v1|${this.userId}|${transferId}|${myDeviceId}|${ephPubSpki}`;
      const signature = await this.signEcdsaP256(initMsg);

      const res = await this.fetchImpl('/api/e2ee/transfer/init', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: myDeviceId,
          transfer_id: transferId,
          requester_eph_pub: ephPubSpki,
          signature,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Transfer init failed'), {
          code: errData.code || 'TRANSFER_FAILED',
        });
      }
      const data = (await res.json()) as { expires_at: string };
      this.activeReceiveTransfers.set(transferId, {
        ephPriv: ephKp.privateKey,
        ephPub: ephPubSpki,
        deviceId: myDeviceId,
      });

      const code6 = await computeTransferCode6(this.userId, transferId, myDeviceId, ephPubSpki);
      const qrPayload = `PGX1:${this.userId}:${myDeviceId}:${transferId}:${ephPubSpki}`;
      const { qrModules, qrSize } = buildQrMatrix(qrPayload);
      return {
        transferId,
        code6,
        qrPayload,
        qrModules,
        qrSize,
        expiresAt: data.expires_at,
        requesterDeviceId: myDeviceId,
        requesterEphPub: ephPubSpki,
      };
    });
  }

  parseTransferQrPayload(raw: string): {
    userId: number;
    requesterDeviceId: number;
    transferId: string;
    requesterEphPub: string;
  } | null {
    const s = String(raw || '').trim();
    if (!s.startsWith('PGX1:')) return null;
    const parts = s.split(':');
    if (parts.length < 5) return null;
    const userId = Number(parts[1]);
    const requesterDeviceId = Number(parts[2]);
    const transferId = parts[3];
    const requesterEphPub = parts.slice(4).join(':');
    if (userId !== this.userId || !Number.isInteger(requesterDeviceId) || requesterDeviceId <= 0) return null;
    if (!/^[a-f0-9]{24,64}$/i.test(transferId) || requesterEphPub.length < 64) return null;
    return { userId, requesterDeviceId, transferId, requesterEphPub };
  }

  async listPendingDeviceTransfers(): Promise<
    Array<{
      transfer_id: string;
      requester_device_id: number;
      requester_eph_pub: string;
      status: string;
      expires_at: string;
      code6: string;
      is_mine: boolean;
    }>
  > {
    const myDeviceId = await this.ensureInitialized();
    const res = await this.fetchImpl('/api/e2ee/transfer/pending', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) throw Object.assign(new Error('Failed to load transfers'), { code: 'NETWORK' });
    const data = (await res.json()) as {
      transfers?: Array<{
        transfer_id: string;
        requester_device_id: number;
        requester_eph_pub: string;
        status: string;
        expires_at: string;
      }>;
    };
    return Promise.all(
      (data.transfers || []).map(async (tr) => ({
        ...tr,
        code6: await computeTransferCode6(
          this.userId,
          tr.transfer_id,
          Number(tr.requester_device_id),
          tr.requester_eph_pub,
        ),
        is_mine: Number(tr.requester_device_id) === Number(myDeviceId),
      })),
    );
  }

  async sendHistoryToDevice(req: {
    transferId: string;
    requesterDeviceId: number;
    requesterEphPub: string;
    expectedCode6?: string;
    includeRecoveryKey?: boolean;
  }): Promise<{ success: boolean; messageCount: number; sizeBytes: number }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      const myDeviceId = await this.ensureInitialized();
      if (Number(req.requesterDeviceId) === Number(myDeviceId)) {
        throw Object.assign(new Error('Cannot transfer to same device'), { code: 'SAME_DEVICE_TRANSFER' });
      }
      await this.verifyOwnApprovedDeviceSigningKey(req.requesterDeviceId);

      if (req.expectedCode6) {
        const actualCode = await computeTransferCode6(
          this.userId,
          req.transferId,
          req.requesterDeviceId,
          req.requesterEphPub,
        );
        if (actualCode.replace(/\s+/g, '') !== String(req.expectedCode6).replace(/\s+/g, '')) {
          throw Object.assign(new Error('Transfer verification code mismatch'), { code: 'CODE_MISMATCH' });
        }
      }

      const senderEphKp = (await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      )) as CryptoKeyPair;
      const senderEphPubSpki = bytesToBase64((await crypto.subtle.exportKey('spki', senderEphKp.publicKey)) as ArrayBuffer);
      const remotePubKey = await crypto.subtle.importKey(
        'spki',
        base64ToArrayBuffer(req.requesterEphPub),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: remotePubKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
        senderEphKp.privateKey,
        256,
      );

      const bindingInfo = `pg-transfer-v1|${this.userId}|${req.transferId}|${req.requesterDeviceId}|${req.requesterEphPub}|${myDeviceId}|${senderEphPubSpki}`;
      const ikm = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
      const xferAesKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: utf8ToArrayBuffer(req.transferId),
          info: utf8ToArrayBuffer(bindingInfo),
        },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt'],
      );

      const [allEntries, tombstones, rawRecoveryKey] = await Promise.all([
        this.store.getAllCachedMessages(),
        this.store.getTombstones(),
        this.store.getBackupRecoveryKeyRaw(),
      ]);
      const tombSet = new Set(tombstones);
      const liveMessages = allEntries.filter((e) => !tombSet.has(e.id));

      const bundleObj: Record<string, unknown> = {
        v: 1,
        messages: liveMessages,
        tombstones,
      };
      if (req.includeRecoveryKey !== false && rawRecoveryKey) {
        bundleObj.recoveryKeyRawB64 = rawRecoveryKey;
      }

      const plainBytes = new TextEncoder().encode(JSON.stringify(bundleObj));
      const compressed = await compressPayloadBytes(plainBytes);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ivB64 = bytesToBase64(iv);
      const encBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: utf8ToArrayBuffer(bindingInfo) },
        xferAesKey,
        compressed,
      );
      const encBytes = new Uint8Array(encBuf);
      const shaB64 = await sha256B64Bytes(encBytes);

      const uploadMsg = `pg-transfer-v1|${this.userId}|${req.transferId}|${req.requesterDeviceId}|${req.requesterEphPub}|${myDeviceId}|${senderEphPubSpki}|${ivB64}|${shaB64}|${encBytes.byteLength}`;
      const signature = await this.signEcdsaP256(uploadMsg);

      const fd = new FormData();
      fd.append('transfer_id', req.transferId);
      fd.append('sender_device_id', String(myDeviceId));
      fd.append('sender_eph_pub', senderEphPubSpki);
      fd.append('iv_b64', ivB64);
      fd.append('payload_sha256', shaB64);
      fd.append('signature', signature);
      fd.append('payload', new Blob([encBytes], { type: 'application/octet-stream' }), 'transfer.bin');

      const res = await this.fetchImpl('/api/e2ee/transfer/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Transfer upload failed'), {
          code: errData.code || 'TRANSFER_FAILED',
        });
      }
      return { success: true, messageCount: liveMessages.length, sizeBytes: encBytes.byteLength };
    });
  }

  async completeDeviceTransferReceive(transferId: string): Promise<{
    restoredMessages: number;
    appliedTombstones: number;
    importedRecoveryKey: boolean;
  }> {
    return withCryptoLock(`pg_e2ee_u_${this.userId}:backup`, async () => {
      const myDeviceId = await this.ensureInitialized();
      const session = this.activeReceiveTransfers.get(transferId);
      if (!session || session.deviceId !== myDeviceId) {
        throw Object.assign(new Error('Transfer session not found on this device'), { code: 'TRANSFER_SESSION_MISSING' });
      }

      const res = await this.fetchImpl(
        `/api/e2ee/transfer/download?transfer_id=${encodeURIComponent(transferId)}&device_id=${myDeviceId}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Transfer download failed'), {
          code: errData.code || 'TRANSFER_NOT_READY',
        });
      }

      const senderDeviceId = Number(res.headers?.get('X-Transfer-Sender-Device') || 0);
      const senderEphPub = String(res.headers?.get('X-Transfer-Sender-Eph-Pub') || '').trim();
      const senderSig = String(res.headers?.get('X-Transfer-Sender-Sig') || '').trim();
      const ivB64 = String(res.headers?.get('X-Transfer-Iv') || '').trim();
      const expectedSha = String(res.headers?.get('X-Transfer-Sha256') || '').trim();
      if (!senderDeviceId || !senderEphPub || !senderSig || !ivB64 || !expectedSha) {
        throw Object.assign(new Error('Incomplete transfer headers'), { code: 'TRANSFER_CORRUPTED' });
      }

      const encBuf = await res.arrayBuffer();
      const encBytes = new Uint8Array(encBuf);
      const actualSha = await sha256B64Bytes(encBytes);
      if (actualSha !== expectedSha) {
        throw Object.assign(new Error('Transfer checksum mismatch'), { code: 'TRANSFER_CORRUPTED' });
      }

      const trustedSenderSigningPub = await this.verifyOwnApprovedDeviceSigningKey(senderDeviceId);
      const uploadMsg = `pg-transfer-v1|${this.userId}|${transferId}|${myDeviceId}|${session.ephPub}|${senderDeviceId}|${senderEphPub}|${ivB64}|${expectedSha}|${encBytes.byteLength}`;
      const sigOk = await verifyEcdsaP256Local(trustedSenderSigningPub, uploadMsg, senderSig);
      if (!sigOk) {
        throw Object.assign(new Error('Invalid transfer sender signature'), { code: 'INVALID_TRANSFER_SIG' });
      }

      const senderEphKey = await crypto.subtle.importKey(
        'spki',
        base64ToArrayBuffer(senderEphPub),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: senderEphKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
        session.ephPriv,
        256,
      );
      const bindingInfo = `pg-transfer-v1|${this.userId}|${transferId}|${myDeviceId}|${session.ephPub}|${senderDeviceId}|${senderEphPub}`;
      const ikm = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
      const xferAesKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: utf8ToArrayBuffer(transferId),
          info: utf8ToArrayBuffer(bindingInfo),
        },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );

      let plainFramed: ArrayBuffer;
      try {
        plainFramed = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(base64ToArrayBuffer(ivB64)),
            additionalData: utf8ToArrayBuffer(bindingInfo),
          },
          xferAesKey,
          encBytes,
        );
      } catch {
        throw Object.assign(new Error('Transfer decryption failed'), { code: 'TRANSFER_CORRUPTED' });
      }

      const rawJsonBytes = await decompressPayloadBytes(new Uint8Array(plainFramed));
      const parsed = JSON.parse(new TextDecoder().decode(rawJsonBytes)) as {
        messages?: Array<{ id: number; payload: DecryptedPayload }>;
        tombstones?: number[];
        recoveryKeyRawB64?: string;
      };

      const { restoredMessages, appliedTombstones } = await this.mergeDecryptedHistoryIntoLocal(
        Array.isArray(parsed.messages) ? parsed.messages : [],
        Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
      );

      let importedRecoveryKey = false;
      if (parsed.recoveryKeyRawB64 && !(await this.store.getBackupRecoveryKeyRaw())) {
        const rawRk = new Uint8Array(base64ToArrayBuffer(parsed.recoveryKeyRawB64));
        if (rawRk.byteLength === 32) {
          await this.store.setBackupRecoveryKeyRaw(parsed.recoveryKeyRawB64);
          importedRecoveryKey = true;
        }
      }

      this.activeReceiveTransfers.delete(transferId);

      const compRes = await this.fetchImpl('/api/e2ee/transfer/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_id: transferId, device_id: myDeviceId }),
      });
      if (!compRes.ok) {
        const errData = (await compRes.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(errData.error || 'Transfer completion failed'), {
          code: errData.code || 'TRANSFER_COMPLETE_FAILED',
        });
      }

      this.postSync({ type: 'backup_restored', restoredMessages });
      return { restoredMessages, appliedTombstones, importedRecoveryKey };
    });
  }

  async close(): Promise<void> {
    this.activeReceiveTransfers.clear();
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
    generateRecoveryKey,
    parseRecoveryKey,
    computeTransferCode6,
  };
}
