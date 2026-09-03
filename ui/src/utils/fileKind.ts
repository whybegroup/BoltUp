import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const IMAGE_EXT = /^(png|jpe?g|gif|webp|bmp|heic|heif|svg|avif)$/i;
const NON_IMAGE_EXT = /^(pdf|docx?|xlsx?|csv|pptx?|zip|json|txt|rtf|mp3|wav|m4a|mp4|mov|webm)$/i;
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export type FileKindStyle = {
  icon: IoniconName;
  color: string;
  label: string;
};

export function extensionFromFileNameOrUrl(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  let path = raw;
  try {
    path = decodeURIComponent(new URL(raw).pathname);
  } catch {
    const q = raw.split(/[?#]/)[0];
    path = q;
  }
  const base = path.split('/').filter(Boolean).pop() || path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

export function isImageFileUrl(url: string, fileName?: string): boolean {
  const ext = extensionFromFileNameOrUrl(fileName?.trim() || url);
  if (ext) {
    if (NON_IMAGE_EXT.test(ext)) return false;
    return IMAGE_EXT.test(ext);
  }
  const u = url.trim();
  if (!u) return false;
  if (/\.(pdf|docx?|xlsx?|csv|pptx?|zip|json|txt)(\?.*)?$/i.test(u)) return false;
  if (/\.(png|jpe?g|gif|webp|bmp|heic|heif|svg|avif)(\?.*)?$/i.test(u)) return true;
  return /\/storage\//i.test(u);
}

export function displayFileName(url: string, fileName?: string): string {
  const named = fileName?.trim();
  const ext = extensionFromFileNameOrUrl(named || url);
  if (named && !/^(image|photo|img|attachment)$/i.test(named) && !UUID_FILE.test(named)) {
    if (named.includes('.') || !ext) return named;
    return `${named}.${ext}`;
  }
  try {
    const path = decodeURIComponent(new URL(url.trim()).pathname);
    const base = path.split('/').filter(Boolean).pop() || '';
    if (base && !UUID_FILE.test(base)) return base;
  } catch {
    /* ignore */
  }
  if (named && !UUID_FILE.test(named)) return named;
  return ext ? `file.${ext}` : 'File';
}

export function fileKindStyle(url: string, fileName?: string): FileKindStyle {
  const ext = extensionFromFileNameOrUrl(fileName?.trim() || url);
  const label = (ext || 'file').toUpperCase();
  switch (ext) {
    case 'pdf':
      return { icon: 'document-text-outline', color: '#DC2626', label };
    case 'doc':
    case 'docx':
    case 'rtf':
      return { icon: 'document-text-outline', color: '#2563EB', label };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: 'grid-outline', color: '#16A34A', label };
    case 'ppt':
    case 'pptx':
      return { icon: 'easel-outline', color: '#EA580C', label };
    case 'zip':
      return { icon: 'archive-outline', color: '#7C3AED', label };
    case 'json':
      return { icon: 'code-slash-outline', color: '#CA8A04', label };
    case 'txt':
      return { icon: 'document-text-outline', color: '#71717A', label };
    case 'mp3':
    case 'wav':
    case 'm4a':
      return { icon: 'musical-notes-outline', color: '#DB2777', label };
    case 'mp4':
    case 'mov':
    case 'webm':
      return { icon: 'videocam-outline', color: '#7C3AED', label };
    default:
      return { icon: 'document-outline', color: '#71717A', label };
  }
}
