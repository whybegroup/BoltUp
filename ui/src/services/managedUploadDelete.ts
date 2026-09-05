import { StorageService } from '@moijia/client';

/** Best-effort DELETE for app-managed `https` uploads; ignores failures. */
export function deleteManagedUploadFireAndForget(userId: string, sourceUrl: string): void {
  const uid = userId.trim();
  const u = sourceUrl.trim();
  if (!uid || !/^https?:\/\//i.test(u)) return;
  void StorageService.deleteUploadedObject(uid, { sourceUrl: u }).catch(() => {
    /* 400/403/404/network */
  });
}

export function deleteManagedUploadsFireAndForget(userId: string, sourceUrls: Iterable<string>): void {
  for (const url of sourceUrls) deleteManagedUploadFireAndForget(userId, url);
}

export function trackManagedUploadUrl(tracked: Set<string>, url: string): void {
  const u = url.trim();
  if (u) tracked.add(u);
}

export function trackManagedUploadUrls(tracked: Set<string>, urls: Iterable<string>): void {
  for (const url of urls) trackManagedUploadUrl(tracked, url);
}

/** Delete from S3 when this URL was uploaded in the current draft session. */
export function deleteTrackedUploadIfNeeded(
  userId: string | null | undefined,
  tracked: Set<string>,
  url: string
): void {
  const u = url.trim();
  if (!u || !tracked.has(u)) return;
  tracked.delete(u);
  if (userId) deleteManagedUploadFireAndForget(userId, u);
}

/** Discard a draft: delete remaining session uploads, then forget them. */
export function discardTrackedUploads(userId: string | null | undefined, tracked: Set<string>): void {
  if (userId) deleteManagedUploadsFireAndForget(userId, [...tracked]);
  tracked.clear();
}

/** Successful publish: keep S3 objects, drop session tracking. */
export function clearTrackedUploads(tracked: Set<string>): void {
  tracked.clear();
}
