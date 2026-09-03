import { StorageService } from '@moijia/client';
import { warmImageDiskCache } from './imageDiskCache';

/**
 * Bucket names with dots cannot use virtual-hosted HTTPS
 * (`bucket.name.s3.region.amazonaws.com` fails TLS). Rewrite to path-style.
 */
export function toRenderableImageUrl(url: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return url;
  try {
    const u = new URL(trimmed);
    const m = u.hostname.match(/^(.+)\.s3\.([a-z0-9-]+)\.amazonaws\.com$/i);
    if (m?.[1]?.includes('.')) {
      const key = u.pathname.replace(/^\//, '');
      return `https://s3.${m[2]}.amazonaws.com/${m[1]}/${key}${u.search}`;
    }
  } catch {
    /* keep original */
  }
  return trimmed;
}

export function isDirectRenderableImageUrl(url: string): boolean {
  if (!url?.trim()) return false;
  return (
    /^(blob:|file:|content:|ph:|data:|https?:)/i.test(url) ||
    url.startsWith('assets-library:')
  );
}

type PresignCacheEntry = {
  viewUrl: string;
  /** Epoch ms; 0 = no expiry (e.g. public / local passthrough). */
  expiresAt: number;
};

/** In-memory cache of source URL → short-lived view URL. */
const presignCache = new Map<string, PresignCacheEntry>();

/** Refresh a bit before the signed URL actually expires. */
const EXPIRY_SKEW_MS = 30_000;
/** Fallback TTL when API omits expiresIn (5 minutes, matches server default). */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function cacheGet(sourceUrl: string): string | null {
  const hit = presignCache.get(sourceUrl);
  if (!hit) return null;
  if (hit.expiresAt > 0 && Date.now() >= hit.expiresAt - EXPIRY_SKEW_MS) {
    presignCache.delete(sourceUrl);
    return null;
  }
  return hit.viewUrl;
}

function cacheSet(sourceUrl: string, viewUrl: string, expiresInSeconds: number): void {
  const expiresAt =
    expiresInSeconds > 0 ? Date.now() + expiresInSeconds * 1000 : Date.now() + DEFAULT_TTL_MS;
  // expiresIn 0 from local API means “stable URL” — keep longer
  const stable = expiresInSeconds === 0;
  presignCache.set(sourceUrl, {
    viewUrl,
    expiresAt: stable ? 0 : expiresAt,
  });
}

/** Batch-resolve stored DB URLs to short-lived presigned GET URLs; locals pass through. Cached in memory. */
export async function resolveImageViewUrls(urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const needsApi: string[] = [];

  for (const u of urls) {
    if (!u) continue;
    if (isDirectRenderableImageUrl(u)) {
      out.set(u, toRenderableImageUrl(u));
      continue;
    }
    const cached = cacheGet(u);
    if (cached) {
      out.set(u, cached);
    } else {
      needsApi.push(u);
    }
  }

  if (needsApi.length === 0) {
    warmImageDiskCache(out);
    return out;
  }

  try {
    const res = await StorageService.presignGetBatch({ sourceUrls: needsApi });
    for (const row of res.results) {
      const view = toRenderableImageUrl(row.viewUrl || row.sourceUrl);
      cacheSet(row.sourceUrl, view, typeof row.expiresIn === 'number' ? row.expiresIn : 300);
      out.set(row.sourceUrl, view);
    }
    for (const u of needsApi) {
      if (!out.has(u)) {
        const view = toRenderableImageUrl(u);
        out.set(u, view);
        cacheSet(u, view, 0);
      }
    }
  } catch {
    for (const u of needsApi) out.set(u, toRenderableImageUrl(u));
  }

  warmImageDiskCache(out);
  return out;
}

/** Drop all cached presign mappings (e.g. after auth change). */
export function clearImageViewUrlCache(): void {
  presignCache.clear();
}
