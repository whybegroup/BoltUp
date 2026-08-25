export type SharePreviewCard = {
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
};

const SITE_NAME = 'Moijia';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function clipText(value: string, max = 220): string {
  const t = value.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMarkdownToText(markdown: string): string {
  return markdown
    .replace(/\[\[MOIJIA_POST_ATTACHMENTS\]\][\s\S]*$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`#>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function absoluteHttpUrl(url: string | null | undefined): string | null {
  const t = (url ?? '').trim();
  if (!t) return null;
  if (t.startsWith('//')) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

export function joinPreviewLines(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function renderSharePreviewHtml(card: SharePreviewCard): string {
  const title = clipText(card.title, 80) || SITE_NAME;
  const description = clipText(card.description, 220);
  const image = absoluteHttpUrl(card.imageUrl);
  const url = card.canonicalUrl;
  const twitterCard = image ? 'summary_large_image' : 'summary';
  const imageTags = image
    ? `  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
${imageTags}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(url)}">Open in ${SITE_NAME}</a></p>
</body>
</html>`;
}
