import { useMemo } from 'react';
import { usePathname } from 'expo-router';
import {
  isGroupStorageCategory,
  type GroupStorageCategory,
} from '../../utils/groupStorageCategories';

export type EventSubpage =
  | { kind: 'all-events' }
  | { kind: 'event-detail'; eventId: string }
  | { kind: 'group-overview'; groupId: string }
  | { kind: 'group-events'; groupId: string }
  | { kind: 'group-event-detail'; groupId: string; eventId: string }
  | { kind: 'group-polls'; groupId: string }
  | { kind: 'group-poll-detail'; groupId: string; pollId: string }
  | { kind: 'group-forum'; groupId: string }
  | { kind: 'group-members'; groupId: string }
  | { kind: 'group-settings'; groupId: string }
  | { kind: 'group-storage'; groupId: string }
  | { kind: 'group-storage-category'; groupId: string; category: GroupStorageCategory };

export function eventSubpageFromPathname(pathname: string): EventSubpage {
  // Group event detail: /events/group/:groupId/events/:eventId
  const groupEventMatch = pathname.match(/\/events\/group\/([^/]+)\/events\/([^/]+)/);
  if (groupEventMatch) {
    return { kind: 'group-event-detail', groupId: groupEventMatch[1], eventId: groupEventMatch[2] };
  }

  // Group events list: /events/group/:groupId/events
  const groupEventsMatch = pathname.match(/\/events\/group\/([^/]+)\/events$/);
  if (groupEventsMatch) {
    return { kind: 'group-events', groupId: groupEventsMatch[1] };
  }

  // Group poll detail: /events/group/:groupId/polls/:pollId
  const groupPollMatch = pathname.match(/\/events\/group\/([^/]+)\/polls\/([^/]+)/);
  if (groupPollMatch) {
    return { kind: 'group-poll-detail', groupId: groupPollMatch[1], pollId: groupPollMatch[2] };
  }

  // Group polls list: /events/group/:groupId/polls
  const groupPollsMatch = pathname.match(/\/events\/group\/([^/]+)\/polls$/);
  if (groupPollsMatch) {
    return { kind: 'group-polls', groupId: groupPollsMatch[1] };
  }

  // Group forum: /events/group/:groupId/forum
  const groupForumMatch = pathname.match(/\/events\/group\/([^/]+)\/forum/);
  if (groupForumMatch) {
    return { kind: 'group-forum', groupId: groupForumMatch[1] };
  }

  // Group members: /events/group/:groupId/members
  const groupMembersMatch = pathname.match(/\/events\/group\/([^/]+)\/members/);
  if (groupMembersMatch) {
    return { kind: 'group-members', groupId: groupMembersMatch[1] };
  }

  // Group storage category: /events/group/:groupId/storage/:category
  const groupStorageCatMatch = pathname.match(/\/events\/group\/([^/]+)\/storage\/([^/]+)/);
  if (groupStorageCatMatch) {
    const category = groupStorageCatMatch[2];
    if (isGroupStorageCategory(category)) {
      return {
        kind: 'group-storage-category',
        groupId: groupStorageCatMatch[1],
        category,
      };
    }
    return { kind: 'group-storage', groupId: groupStorageCatMatch[1] };
  }

  // Group storage: /events/group/:groupId/storage
  const groupStorageMatch = pathname.match(/\/events\/group\/([^/]+)\/storage/);
  if (groupStorageMatch) {
    return { kind: 'group-storage', groupId: groupStorageMatch[1] };
  }

  // Group settings: /events/group/:groupId/settings
  const groupSettingsMatch = pathname.match(/\/events\/group\/([^/]+)\/settings/);
  if (groupSettingsMatch) {
    return { kind: 'group-settings', groupId: groupSettingsMatch[1] };
  }

  // Group overview: /events/group/:groupId
  const groupMatch = pathname.match(/\/events\/group\/([^/]+)/);
  if (groupMatch) {
    return { kind: 'group-overview', groupId: groupMatch[1] };
  }

  // Event detail: /events/:eventId
  const eventMatch = pathname.match(/\/events\/([^/]+)/);
  if (eventMatch) {
    return { kind: 'event-detail', eventId: eventMatch[1] };
  }

  // All events: /events
  return { kind: 'all-events' };
}

export function useEventSubpage(): EventSubpage {
  const pathname = usePathname();
  return useMemo(() => eventSubpageFromPathname(pathname), [pathname]);
}
