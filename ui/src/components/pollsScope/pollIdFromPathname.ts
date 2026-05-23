/** Poll id on the Polls tab stack (`/polls/:pollId`), not group-nested poll routes. */
export function pollIdFromPollsTabPathname(pathname: string): string | null {
  if (/\/groups\/[^/]+\/polls\//.test(pathname)) return null;
  const match = pathname.match(/\/polls\/([^/]+)/);
  if (!match) return null;
  return match[1];
}
