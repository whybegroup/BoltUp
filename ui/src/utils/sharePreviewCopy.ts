const POST_ATTACHMENT_MARKER = '[[MOIJIA_POST_ATTACHMENTS]]';

export function clipShareText(value: string, max = 220): string {
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

export function stripForumBodyToText(body: string): string {
  const markerSep = `\n${POST_ATTACHMENT_MARKER}\n`;
  let markdown = body.replace(/\r\n/g, '\n');
  if (markdown.startsWith(`${POST_ATTACHMENT_MARKER}\n`)) return '';
  const idx = markdown.indexOf(markerSep);
  if (idx !== -1) markdown = markdown.slice(0, idx).trimEnd();
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`#>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localeZone(timeZone?: string | null): { timeZone: string } | Record<string, never> {
  const tz = timeZone?.trim();
  return tz ? { timeZone: tz } : {};
}

export function formatShareInstant(
  instant: Date,
  opts?: { timeZone?: string | null; isAllDay?: boolean | null }
): string {
  const zone = localeZone(opts?.timeZone);
  const dateStr = instant.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...zone,
  });
  if (opts?.isAllDay) return dateStr;
  const timeStr = instant.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...zone,
  });
  return `${dateStr} at ${timeStr}`;
}

export function formatShareWhenRange(
  start: Date,
  end: Date,
  opts?: { timeZone?: string | null; isAllDay?: boolean | null }
): string {
  const zone = localeZone(opts?.timeZone);
  const startDay = start.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...zone,
  });
  const endDay = end.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...zone,
  });
  const startLabel = formatShareInstant(start, opts);
  if (startDay === endDay) {
    if (opts?.isAllDay) return startLabel;
    const endTime = end.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      ...zone,
    });
    return `${startLabel} – ${endTime}`;
  }
  return `${startLabel} – ${formatShareInstant(end, opts)}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eventLocationShareLabel(ev: {
  location?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
}): string {
  const name = (ev.locationName ?? '').trim();
  const addr = (ev.locationAddress ?? '').trim();
  const loc = (ev.location ?? '').trim();
  if (name && addr && addr !== name) return `${name}, ${addr}`;
  return name || loc;
}

function joinLines(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function eventShareCopy(details: {
  name: string;
  start?: Date | string | null;
  end?: Date | string | null;
  isAllDay?: boolean | null;
  location?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  groupName?: string | null;
}): { title: string; message: string } {
  const name = details.name.trim() || 'this event';
  const start = toDate(details.start);
  const end = toDate(details.end) ?? start;
  const when =
    start && end ? formatShareWhenRange(start, end, { isAllDay: !!details.isAllDay }) : start ? formatShareInstant(start, { isAllDay: !!details.isAllDay }) : '';
  const group = (details.groupName ?? '').trim();
  return {
    title: `${name} on Moijia`,
    message: joinLines([
      name,
      when,
      eventLocationShareLabel(details),
      group ? `In ${group}` : null,
    ]),
  };
}

export function pollShareCopy(details: {
  title: string;
  description?: string | null;
  deadline?: Date | string | null;
  closed?: boolean;
  groupName?: string | null;
}): { title: string; message: string } {
  const pollTitle = details.title.trim() || 'this poll';
  const group = (details.groupName ?? '').trim();
  const deadline = toDate(details.deadline);
  const deadlineLine = deadline
    ? details.closed
      ? `Closed · was due ${formatShareInstant(deadline)}`
      : `Vote by ${formatShareInstant(deadline)}`
    : details.closed
      ? 'Closed'
      : null;
  return {
    title: `${pollTitle} on Moijia`,
    message: joinLines([
      pollTitle,
      group ? `Poll in ${group}` : null,
      deadlineLine,
      clipShareText(stripHtmlToText(details.description ?? ''), 160),
    ]),
  };
}

export function postShareCopy(details: {
  title?: string | null;
  body?: string | null;
  authorName?: string | null;
  groupName?: string | null;
}): { title: string; message: string } {
  const group = (details.groupName ?? '').trim() || 'the group';
  const author = (details.authorName ?? '').trim();
  const storedTitle = (details.title ?? '').trim();
  const excerpt = clipShareText(stripForumBodyToText(details.body ?? ''), 180);
  const heading = storedTitle && storedTitle.toLowerCase() !== 'post' ? storedTitle : excerpt || 'this post';
  return {
    title: excerpt ? clipShareText(heading, 80) : `Post in ${group} on Moijia`,
    message: joinLines([
      heading,
      author ? `From ${author} in ${group}` : `Posted in ${group}`,
      heading === excerpt ? null : excerpt,
    ]),
  };
}

export function groupInviteShareCopy(details: {
  name: string;
  description?: string | null;
}): { title: string; message: string } {
  const name = details.name.trim() || 'this group';
  return {
    title: `Join ${name} on Moijia`,
    message: joinLines([`Join ${name} on Moijia`, clipShareText(details.description ?? '', 160)]),
  };
}
