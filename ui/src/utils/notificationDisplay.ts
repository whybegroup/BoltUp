/**
 * Heading shown in notification lists. Mention alerts always use this copy
 * so the title stays correct even if older rows used a different title.
 */
export function notificationListTitle(n: {
  title: string;
  type?: string | null;
  icon?: string | null;
  body?: string | null;
}): string {
  const t = (n.type ?? '').trim().toLowerCase();
  if (t === 'mention') return 'You were mentioned';
  const body = (n.body ?? '').toLowerCase();
  if (body.includes('mentioned you in a comment')) return 'You were mentioned';
  return n.title;
}

/** Same local-timezone clock as comments / posts (`toLocaleString(undefined, …)`). */
export function formatNotificationTimestamp(value: string | Date | number): string {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
