/** Group id when pathname is under `/groups/:id/...`; null on list, invite, etc. */
export function groupIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/groups\/([^/]+)/);
  if (!match) return null;
  const segment = match[1];
  if (segment === 'invite') return null;
  return segment;
}
