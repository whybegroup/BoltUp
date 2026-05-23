import { useMemo } from 'react';
import { usePathname } from 'expo-router';

export type GroupSubpage =
  | { kind: 'overview' }
  | { kind: 'events' }
  | { kind: 'posts' }
  | { kind: 'polls' }
  | { kind: 'poll'; pollId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'members' }
  | { kind: 'settings' };

export function groupSubpageFromPathname(pathname: string, groupId: string): GroupSubpage {
  const idEsc = groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const eventDetailMatch = pathname.match(new RegExp(`/groups/${idEsc}/events/([^/]+)`));
  if (eventDetailMatch?.[1]) {
    return { kind: 'event', eventId: eventDetailMatch[1] };
  }
  if (new RegExp(`/groups/${idEsc}/events`).test(pathname)) return { kind: 'events' };

  if (new RegExp(`/groups/${idEsc}/forum`).test(pathname)) return { kind: 'posts' };
  if (new RegExp(`/groups/${idEsc}/members`).test(pathname)) return { kind: 'members' };
  if (new RegExp(`/groups/${idEsc}/settings`).test(pathname)) return { kind: 'settings' };

  const pollDetailMatch = pathname.match(new RegExp(`/groups/${idEsc}/polls/([^/]+)`));
  if (pollDetailMatch?.[1]) {
    return { kind: 'poll', pollId: pollDetailMatch[1] };
  }
  if (new RegExp(`/groups/${idEsc}/polls`).test(pathname)) return { kind: 'polls' };

  return { kind: 'overview' };
}

export function useGroupSubpage(groupId: string): GroupSubpage {
  const pathname = usePathname();
  return useMemo(() => groupSubpageFromPathname(pathname, groupId), [groupId, pathname]);
}

export function groupSubpageHref(groupId: string, subpage: GroupSubpage, returnToQuery?: string): string {
  const q = returnToQuery ?? '';
  switch (subpage.kind) {
    case 'overview':
      return `/(tabs)/groups/${groupId}${q}`;
    case 'events':
      return `/(tabs)/groups/${groupId}/events${q}`;
    case 'posts':
      return `/(tabs)/groups/${groupId}/forum${q}`;
    case 'polls':
      return `/(tabs)/groups/${groupId}/polls${q}`;
    case 'poll':
      return `/(tabs)/groups/${groupId}/polls/${subpage.pollId}${q}`;
    case 'event':
      return `/(tabs)/groups/${groupId}/events/${subpage.eventId}${q}`;
    case 'members':
      return `/(tabs)/groups/${groupId}/members${q}`;
    case 'settings':
      return `/(tabs)/groups/${groupId}/settings${q}`;
  }
}
