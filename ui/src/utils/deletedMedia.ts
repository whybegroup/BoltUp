/** Must match api/src/utils/groupPostBodyUploads.ts */
export const DELETED_IMAGE_SRC = 'moijia:deleted-image';
export const DELETED_FILE_HREF = 'moijia:deleted-file';

export function isDeletedImageSrc(url?: string | null): boolean {
  return (url ?? '').trim() === DELETED_IMAGE_SRC;
}

export function isDeletedFileHref(url?: string | null): boolean {
  return (url ?? '').trim() === DELETED_FILE_HREF;
}

export function isDeletedMediaUrl(url?: string | null): boolean {
  return isDeletedImageSrc(url) || isDeletedFileHref(url);
}

export function withDeletedFileSuffix(name: string): string {
  const n = name.trim() || 'File';
  if (/\(deleted\)\s*$/i.test(n)) return n;
  return `${n} (deleted)`;
}
