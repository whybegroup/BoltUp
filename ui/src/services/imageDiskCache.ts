import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/** Stable short key for a stored/source image URL (not the rotating presigned GET URL). */
export function imageCacheKey(sourceUrl: string): string {
  let h = 5381;
  for (let i = 0; i < sourceUrl.length; i++) {
    h = Math.imul(h, 33) ^ sourceUrl.charCodeAt(i);
  }
  const hex = (h >>> 0).toString(16);
  const safe = sourceUrl.replace(/[^a-zA-Z0-9]+/g, '_').slice(-24);
  return `${hex}_${safe}`;
}

function extFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.(jpe?g|png|gif|webp|heic|bmp)$/i);
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {
    /* ignore */
  }
  return 'jpg';
}

let cacheDir: Directory | null = null;
const inflight = new Map<string, Promise<string | null>>();

function getCacheDir(): Directory | null {
  if (Platform.OS === 'web') return null;
  if (cacheDir) return cacheDir;
  try {
    cacheDir = new Directory(Paths.cache, 'moijia-image-cache');
    if (!cacheDir.exists) {
      cacheDir.create({ intermediates: true, idempotent: true });
    }
    return cacheDir;
  } catch {
    return null;
  }
}

function cachedFileFor(sourceUrl: string, viewUrlHint?: string): File | null {
  const dir = getCacheDir();
  if (!dir) return null;
  const ext = extFromUrl(viewUrlHint || sourceUrl);
  return new File(dir, `${imageCacheKey(sourceUrl)}.${ext}`);
}

/** Returns a local `file://` URI if this source URL is already on disk. */
export function peekCachedImageFileUri(sourceUrl: string): string | null {
  const trimmed = sourceUrl?.trim();
  if (!trimmed || Platform.OS === 'web') return null;
  try {
    // Try common extensions without knowing the original.
    const dir = getCacheDir();
    if (!dir) return null;
    const key = imageCacheKey(trimmed);
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
      const f = new File(dir, `${key}.${ext}`);
      if (f.exists) return f.uri;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Ensure the image bytes for `sourceUrl` are on disk (keyed by source, not view URL).
 * Returns a `file://` URI, or `null` if caching is unavailable / failed (caller can use viewUrl).
 */
export async function ensureCachedImageFileUri(
  sourceUrl: string,
  viewUrl: string
): Promise<string | null> {
  const trimmed = sourceUrl?.trim();
  const view = viewUrl?.trim();
  if (!trimmed || !view || Platform.OS === 'web') return null;
  if (/^(blob:|file:|content:|ph:|data:)/i.test(trimmed) || trimmed.startsWith('assets-library:')) {
    return trimmed.startsWith('file:') ? trimmed : null;
  }

  const existing = peekCachedImageFileUri(trimmed);
  if (existing) return existing;

  const pending = inflight.get(trimmed);
  if (pending) return pending;

  const task = (async (): Promise<string | null> => {
    try {
      const dest = cachedFileFor(trimmed, view);
      if (!dest) return null;
      if (dest.exists) return dest.uri;
      const file = await File.downloadFileAsync(view, dest, { idempotent: true });
      return file.uri;
    } catch {
      return null;
    } finally {
      inflight.delete(trimmed);
    }
  })();

  inflight.set(trimmed, task);
  return task;
}

/** Fire-and-forget warm of disk cache for many resolved pairs. */
export function warmImageDiskCache(entries: Iterable<[string, string]>): void {
  if (Platform.OS === 'web') return;
  for (const [source, view] of entries) {
    if (!source?.trim() || !view?.trim()) continue;
    if (peekCachedImageFileUri(source)) continue;
    void ensureCachedImageFileUri(source, view);
  }
}
