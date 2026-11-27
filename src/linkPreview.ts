import { Env } from './types';
import { getUserFromRequest } from './auth';
import { consumeRateLimitAtomic } from './security';

export interface LinkPreviewResult {
  url: string;
  siteName: string;
  title: string;
  description: string;
  image?: string;
  videoId?: string;
  startSec?: number;
}

const MAX_URL_LEN = 2048;
const MAX_HTML_BYTES = 262144;
const MAX_IMG_BYTES = 1048576;
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT_MS = 4500;
const YT_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PUBLIC_HOSTNAME_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/;

const BLOCKED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'lan',
  'home',
  'corp',
  'intranet',
  'localdomain',
  'arpa',
  'invalid',
  'test',
  'example',
  'onion',
]);

const BLOCKED_SUFFIXES = [
  '.nip.io',
  '.sslip.io',
  '.xip.io',
  '.localtest.me',
  '.lvh.me',
  '.vcap.me',
  '.metadata.google.internal',
  '.metadata.goog',
];

const BLOCKED_EXACT_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'nip.io',
  'sslip.io',
  'xip.io',
  'localtest.me',
  'lvh.me',
  'vcap.me',
]);

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const ALLOWED_IMG_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function validateExternalUrl(raw: string): URL | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LEN) return null;
  if (/[\x00-\x1f\x7f\s]/.test(trimmed)) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253) return null;
  if (!PUBLIC_HOSTNAME_RE.test(host)) return null;
  if (BLOCKED_EXACT_HOSTS.has(host)) return null;
  const lastDot = host.lastIndexOf('.');
  const tld = lastDot >= 0 ? host.slice(lastDot + 1) : host;
  if (BLOCKED_TLDS.has(tld)) return null;
  for (const suffix of BLOCKED_SUFFIXES) {
    if (host.endsWith(suffix)) return null;
  }
  return u;
}

export function parseYouTubeStartSeconds(raw: string | null): number {
  if (!raw) return 0;
  const s = raw.trim().toLowerCase();
  if (!s) return 0;
  if (/^\d{1,6}s?$/.test(s)) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 && n <= 86400 ? n : 0;
  }
  const m = /^(?:(\d{1,2})h)?(?:(\d{1,3})m)?(?:(\d{1,3})s?)?$/.exec(s);
  if (!m) return 0;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const secs = m[3] ? parseInt(m[3], 10) : 0;
  const total = h * 3600 + mins * 60 + secs;
  return total > 0 && total <= 86400 ? total : 0;
}

export function extractYouTubeInfo(u: URL): { videoId: string; startSec: number } | null {
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!YOUTUBE_HOSTS.has(host)) return null;
  let id = '';
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = parts[0] || '';
  } else if (parts[0] === 'watch') {
    id = u.searchParams.get('v') || '';
  } else if (parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'embed') {
    id = parts[1] || '';
  }
  if (!YT_VIDEO_ID_RE.test(id)) return null;
  const startSec =
    parseYouTubeStartSeconds(u.searchParams.get('t')) ||
    parseYouTubeStartSeconds(u.searchParams.get('start'));
  return { videoId: id, startSec };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => {
      const cp = parseInt(hex, 16);
      if (!Number.isFinite(cp) || cp < 32 || cp > 0x10ffff) return '';
      try {
        return String.fromCodePoint(cp);
      } catch {
        return '';
      }
    })
    .replace(/&#(\d{1,7});/g, (_, dec) => {
      const cp = parseInt(dec, 10);
      if (!Number.isFinite(cp) || cp < 32 || cp > 0x10ffff) return '';
      try {
        return String.fromCodePoint(cp);
      } catch {
        return '';
      }
    });
}

function cleanText(raw: string, maxLen: number): string {
  if (!raw) return '';
  return decodeHtmlEntities(raw)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const re = /<meta\s+[^>]*>/gi;
  let m: RegExpExecArray | null;
  const targetVal = attrValue.toLowerCase();
  const targetAttr = attrName.toLowerCase();
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(tag)) !== null) {
      attrs[am[1].toLowerCase()] = am[2] ?? am[3] ?? am[4] ?? '';
    }
    if ((attrs[targetAttr] || '').toLowerCase() === targetVal && attrs.content) {
      return attrs.content;
    }
  }
  return '';
}

function extractHtmlTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]{1,400}?)<\/title>/i.exec(html);
  return m ? m[1] : '';
}

function extractYouTubeShortDescription(html: string): string {
  const m = /"shortDescription"\s*:\s*"((?:\\.|[^"\\]){1,1200})"/.exec(html);
  if (!m) return '';
  try {
    const parsed = JSON.parse(`"${m[1]}"`);
    if (typeof parsed === 'string') return parsed;
  } catch {}
  return '';
}

async function fetchWithSafeRedirects(
  initialUrl: URL,
  headers: Record<string, string>,
): Promise<{ res: Response; finalUrl: URL } | null> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers,
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc || hop === MAX_REDIRECTS) return null;
      let nextUrl: URL;
      try {
        nextUrl = new URL(loc, currentUrl);
      } catch {
        return null;
      }
      const validated = validateExternalUrl(nextUrl.toString());
      if (!validated) return null;
      currentUrl = validated;
      continue;
    }
    return { res, finalUrl: currentUrl };
  }
  return null;
}

async function readLimitedText(res: Response, maxBytes: number, stopAtHeadEnd: boolean): Promise<string> {
  if (!res.body) {
    const t = await res.text();
    return t.slice(0, maxBytes);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let out = '';
  try {
    while (total < maxBytes) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remain = maxBytes - total;
      const slice = value.byteLength > remain ? value.subarray(0, remain) : value;
      total += slice.byteLength;
      out += decoder.decode(slice, { stream: true });
      if (stopAtHeadEnd && /<\/head>/i.test(out)) {
        break;
      }
    }
  } catch {
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
  return out;
}

async function readLimitedBytes(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const cl = Number(res.headers.get('content-length') || 0);
  if (cl > maxBytes) return null;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {}
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function detectRasterImageMime(bytes: Uint8Array): string | null {
  if (bytes.byteLength < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  return null;
}

async function resolveYouTubePreview(
  canonicalUrl: URL,
  videoId: string,
  startSec: number,
): Promise<LinkPreviewResult | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = new URL(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
  );

  let title = '';
  let authorName = '';
  let description = '';

  const [oembedRes, pageRes] = await Promise.all([
    fetchWithSafeRedirects(oembedUrl, {
      Accept: 'application/json',
      'User-Agent': 'PhotogramLinkPreview/1.0',
    }),
    fetchWithSafeRedirects(new URL(`${watchUrl}&hl=en`), {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; PhotogramBot/1.0)',
    }),
  ]);

  if (oembedRes && oembedRes.res.ok) {
    try {
      const json = (await oembedRes.res.json()) as { title?: string; author_name?: string };
      title = cleanText(String(json.title || ''), 180);
      authorName = cleanText(String(json.author_name || ''), 100);
    } catch {}
  }

  if (pageRes && pageRes.res.ok) {
    const html = await readLimitedText(pageRes.res, MAX_HTML_BYTES, false);
    if (!title) {
      title = cleanText(
        extractMetaContent(html, 'property', 'og:title') ||
          extractMetaContent(html, 'name', 'title') ||
          extractHtmlTitle(html).replace(/\s*-\s*YouTube$/i, ''),
        180,
      );
    }
    const rawDesc =
      extractYouTubeShortDescription(html) ||
      extractMetaContent(html, 'property', 'og:description') ||
      extractMetaContent(html, 'name', 'description');
    const cleanedDesc = cleanText(rawDesc, 260);
    if (cleanedDesc && !/^Enjoy the videos and music you love/i.test(cleanedDesc)) {
      description = cleanedDesc;
    }
  }

  if (!title) return null;
  if (!description && authorName) {
    description = authorName;
  }

  return {
    url: canonicalUrl.toString(),
    siteName: 'YouTube',
    title,
    description,
    image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoId,
    ...(startSec > 0 ? { startSec } : {}),
  };
}

async function resolveGenericPreview(targetUrl: URL): Promise<LinkPreviewResult | null> {
  const fetched = await fetchWithSafeRedirects(targetUrl, {
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.8,ru;q=0.6',
    'User-Agent': 'Mozilla/5.0 (compatible; PhotogramBot/1.0)',
  });
  if (!fetched || !fetched.res.ok) return null;

  const ct = (fetched.res.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
    return null;
  }

  const html = await readLimitedText(fetched.res, MAX_HTML_BYTES, true);
  const title = cleanText(
    extractMetaContent(html, 'property', 'og:title') ||
      extractMetaContent(html, 'name', 'twitter:title') ||
      extractHtmlTitle(html),
    180,
  );
  const description = cleanText(
    extractMetaContent(html, 'property', 'og:description') ||
      extractMetaContent(html, 'name', 'twitter:description') ||
      extractMetaContent(html, 'name', 'description'),
    260,
  );
  const siteName = cleanText(
    extractMetaContent(html, 'property', 'og:site_name') ||
      fetched.finalUrl.hostname.replace(/^www\./i, ''),
    60,
  );

  if (!title && !description) return null;

  const rawImg =
    extractMetaContent(html, 'property', 'og:image') ||
    extractMetaContent(html, 'name', 'twitter:image');
  let validImage: string | undefined;
  if (rawImg) {
    try {
      const resolvedImg = new URL(decodeHtmlEntities(rawImg).trim(), fetched.finalUrl);
      const checked = validateExternalUrl(resolvedImg.toString());
      if (checked) validImage = checked.toString();
    } catch {}
  }

  return {
    url: fetched.finalUrl.toString(),
    siteName: siteName || fetched.finalUrl.hostname.replace(/^www\./i, ''),
    title: title || siteName,
    description,
    ...(validImage ? { image: validImage } : {}),
  };
}

export async function handleLinkPreview(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  const allowed = await consumeRateLimitAtomic(env, `linkprev:u:${user.id}`, 30, 60);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  const rawTarget = url.searchParams.get('url') || '';
  const validated = validateExternalUrl(rawTarget);
  if (!validated) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }

  const yt = extractYouTubeInfo(validated);
  const preview = yt
    ? await resolveYouTubePreview(validated, yt.videoId, yt.startSec)
    : await resolveGenericPreview(validated);

  if (!preview) {
    return new Response(JSON.stringify({ ok: false, preview: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=60' },
    });
  }

  return new Response(JSON.stringify({ ok: true, preview }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' },
  });
}

export async function handleLinkPreviewImage(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromRequest(env, request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const allowed = await consumeRateLimitAtomic(env, `linkimg:u:${user.id}`, 90, 60);
  if (!allowed) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const rawTarget = url.searchParams.get('url') || '';
  const validated = validateExternalUrl(rawTarget);
  if (!validated) {
    return new Response('Bad Request', { status: 400 });
  }

  const fetched = await fetchWithSafeRedirects(validated, {
    Accept: 'image/webp,image/png,image/jpeg,image/gif;q=0.8',
    'User-Agent': 'PhotogramLinkPreview/1.0',
  });
  if (!fetched || !fetched.res.ok) {
    return new Response('Not Found', { status: 404 });
  }

  const ctRaw = (fetched.res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_IMG_MIMES.has(ctRaw)) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  const bytes = await readLimitedBytes(fetched.res, MAX_IMG_BYTES);
  if (!bytes || bytes.byteLength < 12) {
    return new Response('Payload Too Large', { status: 413 });
  }

  const detectedMime = detectRasterImageMime(bytes);
  if (!detectedMime) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': detectedMime,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
