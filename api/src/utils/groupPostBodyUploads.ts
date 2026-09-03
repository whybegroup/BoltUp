/** Matches forum post attachment block delimiter in stored bodies. */
export const GROUP_POST_ATTACHMENT_MARKER = '[[MOIJIA_POST_ATTACHMENTS]]';

export type ForumBodyUpload = { url: string; fileName?: string };

function fileNameFromAlt(alt: string | undefined): string | undefined {
  const name = alt?.trim();
  if (!name) return undefined;
  if (/^(image|photo|img)$/i.test(name)) return undefined;
  return name;
}

function parseImageFromLine(trimmedLine: string): ForumBodyUpload | null {
  const markdownMatch = trimmedLine.match(/^!\[(.*?)\]\(([^)\s]+)\)$/);
  if (markdownMatch) {
    const url = markdownMatch[2]?.trim();
    if (!url) return null;
    return { url, fileName: fileNameFromAlt(markdownMatch[1]) };
  }
  const plainUrlLike = /^[^\s]+$/.test(trimmedLine);
  if (!plainUrlLike) return null;
  const looksLikeImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmedLine);
  return looksLikeImageUrl ? { url: trimmedLine } : null;
}

function parseFileFromLine(trimmedLine: string): ForumBodyUpload | null {
  const m = trimmedLine.match(/^\[(.*?)\]\(([^)\s]+)\)$/);
  if (!m) return null;
  const url = m[2]?.trim();
  if (!url) return null;
  return { url, fileName: fileNameFromAlt(m[1]) };
}

function parseImageUrlFromLine(trimmedLine: string): string | null {
  return parseImageFromLine(trimmedLine)?.url ?? null;
}

function parseFileUrlFromLine(trimmedLine: string): string | null {
  return parseFileFromLine(trimmedLine)?.url ?? null;
}

function addUpload(map: Map<string, ForumBodyUpload>, item: ForumBodyUpload | null) {
  if (!item) return;
  const url = item.url?.trim();
  if (!url) return;
  const name = item.fileName?.trim();
  const prev = map.get(url);
  if (!prev) {
    map.set(url, { url, fileName: name || undefined });
    return;
  }
  if (name && !prev.fileName) prev.fileName = name;
}

function uploadsFromAttachmentBlock(block: string): ForumBodyUpload[] {
  const map = new Map<string, ForumBodyUpload>();
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const img = parseImageFromLine(trimmed);
    if (img) {
      addUpload(map, img);
      continue;
    }
    addUpload(map, parseFileFromLine(trimmed));
  }
  return [...map.values()];
}

function collectUploadsFromMarkdown(source: string, map: Map<string, ForumBodyUpload>) {
  for (const m of source.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const url = m[2]?.trim();
    if (url) addUpload(map, { url, fileName: fileNameFromAlt(m[1]) });
  }
  for (const m of source.matchAll(/(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const url = m[2]?.trim();
    if (url) addUpload(map, { url, fileName: fileNameFromAlt(m[1]) });
  }
}

/** Collect image/file URLs (and names when present) from a group post or comment body. */
export function extractUploadItemsFromForumBody(body: string | null | undefined): ForumBodyUpload[] {
  const raw = body?.trim();
  if (!raw) return [];

  const map = new Map<string, ForumBodyUpload>();
  const marker = GROUP_POST_ATTACHMENT_MARKER;
  const markerSep = `\n${marker}\n`;

  if (raw.startsWith(`${marker}\n`)) {
    for (const item of uploadsFromAttachmentBlock(raw.slice(marker.length + 1))) addUpload(map, item);
    return [...map.values()];
  }

  let markdownSource = raw;
  const idx = raw.indexOf(markerSep);
  if (idx !== -1) {
    markdownSource = raw.slice(0, idx).trimEnd();
    for (const item of uploadsFromAttachmentBlock(raw.slice(idx + markerSep.length))) addUpload(map, item);
  }

  collectUploadsFromMarkdown(markdownSource, map);
  return [...map.values()];
}

/** Collect image/file URLs embedded in a group post or comment body (markdown + attachment block). */
export function extractUploadUrlsFromForumBody(body: string | null | undefined): string[] {
  return extractUploadItemsFromForumBody(body).map((item) => item.url);
}

/** File attachments written as `Name: https://...` (event comments) plus bare managed upload URLs. */
export function extractUploadItemsFromPlainText(text: string | null | undefined): ForumBodyUpload[] {
  const raw = text ?? '';
  if (!raw.trim()) return [];
  const map = new Map<string, ForumBodyUpload>();
  const named = /(?:^|\n)\s*([^:\n]{1,240}?):\s*(https?:\/\/[^\s]+)/g;
  for (const m of raw.matchAll(named)) {
    const url = (m[2] ?? '').replace(/[.,;)\]]+$/, '').trim();
    const fileName = fileNameFromAlt(m[1]);
    if (url && /\/storage\//i.test(url)) addUpload(map, { url, fileName });
  }
  for (const m of raw.matchAll(/https?:\/\/[^\s]+/g)) {
    const url = m[0].replace(/[.,;)\]]+$/, '').trim();
    if (url && /\/storage\//i.test(url)) addUpload(map, { url });
  }
  return [...map.values()];
}

export function fileNameFromUploadUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url.trim()).pathname);
    const base = path.split('/').filter(Boolean).pop();
    if (base) return base;
  } catch {
    /* ignore */
  }
  return 'file';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAttachmentBlockUrl(block: string, target: string): string {
  return block
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed === target) return false;
      if (parseImageUrlFromLine(trimmed) === target) return false;
      if (parseFileUrlFromLine(trimmed) === target) return false;
      return true;
    })
    .join('\n');
}

function stripMarkdownUrl(src: string, target: string): string {
  const escaped = escapeRegExp(target);
  let out = src.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, 'g'), '');
  out = out.replace(new RegExp(`(?<!!)\\[[^\\]]*\\]\\(${escaped}\\)`, 'g'), '');
  out = out
    .split(/\r?\n/)
    .filter((line) => line.trim() !== target)
    .join('\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Remove one upload URL from a group post/comment body (markdown + attachment block). */
export function removeUploadUrlFromForumBody(body: string | null | undefined, url: string): string {
  const raw = body ?? '';
  const target = url.trim();
  if (!raw.trim() || !target) return raw;

  const marker = GROUP_POST_ATTACHMENT_MARKER;
  const markerSep = `\n${marker}\n`;

  if (raw.startsWith(`${marker}\n`)) {
    const remaining = stripAttachmentBlockUrl(raw.slice(marker.length + 1), target);
    return remaining ? `${marker}\n${remaining}` : '';
  }

  const idx = raw.indexOf(markerSep);
  if (idx !== -1) {
    const md = stripMarkdownUrl(raw.slice(0, idx).trimEnd(), target);
    const remaining = stripAttachmentBlockUrl(raw.slice(idx + markerSep.length), target);
    if (!md && !remaining) return '';
    if (!remaining) return md;
    if (!md) return `${marker}\n${remaining}`;
    return `${md}${markerSep}${remaining}`;
  }

  return stripMarkdownUrl(raw, target);
}

const IMAGE_URL_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif)(\?.*)?$/i;
const NON_IMAGE_URL_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|json|txt)(\?.*)?$/i;

export function isLikelyUploadedImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u || NON_IMAGE_URL_EXT.test(u)) return false;
  if (IMAGE_URL_EXT.test(u)) return true;
  return /\/storage\//i.test(u);
}

export function firstImageUrlFromForumBody(body: string | null | undefined): string | null {
  for (const u of extractUploadUrlsFromForumBody(body)) {
    if (isLikelyUploadedImageUrl(u)) return u.trim();
  }
  const md = (body ?? '').match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  return md?.[1]?.trim() || null;
}
