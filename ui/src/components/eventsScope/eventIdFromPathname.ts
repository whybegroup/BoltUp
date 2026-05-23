/** Event id on the Events tab stack (`/events/:eventId`), not group-nested event routes. */
export function eventIdFromEventsTabPathname(pathname: string): string | null {
  if (/\/groups\/[^/]+\/events\//.test(pathname)) return null;
  const match = pathname.match(/\/events\/([^/]+)/);
  if (!match) return null;
  return match[1];
}
