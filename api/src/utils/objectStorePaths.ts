import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getS3Config, type S3Config } from './s3Config';

export const STORAGE_KEY_PREFIX = 'storage';

export function urlMatchesOurObjectStore(url: string, cfg: S3Config): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  try {
    if (u.origin === new URL(cfg.publicBase).origin) return true;
  } catch {
    /* ignore */
  }
  if (u.host === `${cfg.bucket}.s3.${cfg.region}.amazonaws.com`) return true;
  if (u.host === `${cfg.bucket}.s3.amazonaws.com`) return true;
  return false;
}

/** Object key from a stored public S3 URL. */
export function tryExtractUploadObjectKey(sourceUrl: string, cfg?: S3Config | null): string | null {
  if (!sourceUrl?.trim()) return null;
  let u: URL;
  try {
    u = new URL(sourceUrl.trim());
  } catch {
    return null;
  }
  if (u.pathname.includes('..') || u.pathname.includes('\\')) return null;

  const resolved = cfg ?? getS3Config();
  if (!resolved || !urlMatchesOurObjectStore(sourceUrl, resolved)) return null;

  const path = u.pathname
    .replace(/^\//, '')
    .split('/')
    .map((s) => decodeURIComponent(s))
    .join('/');
  if (!path.startsWith(`${STORAGE_KEY_PREFIX}/`)) return null;
  return path;
}

export function publicFileUrl(key: string, cfg: S3Config): string {
  return `${cfg.publicBase}/${key.split('/').map((s) => encodeURIComponent(s)).join('/')}`;
}

export async function managedUploadByteSize(sourceUrl: string): Promise<number | null> {
  const cfg = getS3Config();
  if (!cfg) return null;
  const key = tryExtractUploadObjectKey(sourceUrl, cfg);
  if (!key) return null;
  return storageKeyByteSize(key, cfg);
}

export async function storageKeyByteSize(key: string, cfg?: S3Config | null): Promise<number | null> {
  const resolved = cfg ?? getS3Config();
  if (!resolved) return null;
  try {
    const client = createS3Client(resolved);
    const out = await client.send(new HeadObjectCommand({ Bucket: resolved.bucket, Key: key }));
    return typeof out.ContentLength === 'number' ? out.ContentLength : null;
  } catch {
    return null;
  }
}
