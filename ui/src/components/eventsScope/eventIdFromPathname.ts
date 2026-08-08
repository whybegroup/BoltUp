/** Event id on the Events tab stack (`/events/:eventId`), not group-nested event routes. */
export function eventIdFromEventsTabPathname(pathname: string): string | null {
  if (/\/groups\/[^/]+\/events\//.test(pathname)) return null;
  if (/\/events\/group\//.test(pathname)) {
    // Extract eventId from query params for group detail pages within Events tab
    const queryMatch = pathname.match(/[?&]eventId=([^&]+)/);
    return queryMatch ? queryMatch[1] : null;
  }
  const match = pathname.match(/\/events\/([^/]+)/);
  if (!match) return null;
  return match[1];
}

/** Group id when viewing a group from Events tab (`/events/group/:groupId`). */
export function groupIdFromEventsTabPathname(pathname: string): string | null {
  const match = pathname.match(/\/events\/group\/([^/?]+)/);
  if (!match) return null;
  return match[1];
}
