/** Matches forum post attachment block delimiter in stored bodies. */
export const GROUP_POST_ATTACHMENT_MARKER = '[[MOIJIA_POST_ATTACHMENTS]]';

function parseImageUrlFromLine(trimmedLine: string): string | null {
  const markdownMatch = trimmedLine.match(/^!\[(.*?)\]\(([^)\s]+)\)$/);
  if (markdownMatch) return markdownMatch[2]?.trim() || null;
  const plainUrlLike = /^[^\s]+$/.test(trimmedLine);
  if (!plainUrlLike) return null;
  const looksLikeImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmedLine);
  return looksLikeImageUrl ? trimmedLine : null;
}

function parseFileUrlFromLine(trimmedLine: string): string | null {
  const m = trimmedLine.match(/^\[(.*?)\]\(([^)\s]+)\)$/);
  if (!m) return null;
  return m[2]?.trim() || null;
}

function urlsFromAttachmentBlock(block: string): string[] {
  const urls: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const img = parseImageUrlFromLine(trimmed);
    if (img) {
      urls.push(img);
      continue;
    }
    const file = parseFileUrlFromLine(trimmed);
    if (file) urls.push(file);
  }
  return urls;
}

/** Collect image/file URLs embedded in a group post or comment body (markdown + attachment block). */
export function extractUploadUrlsFromForumBody(body: string | null | undefined): string[] {
  const raw = body?.trim();
  if (!raw) return [];

  const urls = new Set<string>();
  const marker = GROUP_POST_ATTACHMENT_MARKER;
  const markerSep = `\n${marker}\n`;

  if (raw.startsWith(`${marker}\n`)) {
    for (const u of urlsFromAttachmentBlock(raw.slice(marker.length + 1))) urls.add(u);
    return [...urls];
  }

  let markdownSource = raw;
  const idx = raw.indexOf(markerSep);
  if (idx !== -1) {
    markdownSource = raw.slice(0, idx).trimEnd();
    for (const u of urlsFromAttachmentBlock(raw.slice(idx + markerSep.length))) urls.add(u);
  }

  for (const m of markdownSource.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const u = m[1]?.trim();
    if (u) urls.add(u);
  }
  for (const m of markdownSource.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const u = m[1]?.trim();
    if (u) urls.add(u);
  }

  return [...urls];
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
