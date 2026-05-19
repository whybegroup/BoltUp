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
