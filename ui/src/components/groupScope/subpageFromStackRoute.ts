import type { GroupSubpage } from './useGroupSubpage';
import { isGroupStorageCategory } from '../../utils/groupStorageCategories';

/** Map an expo-router stack route to a group subpage (inner `[id]` stack). */
export function subpageFromStackRoute(
  routeName: string,
  params?: Record<string, unknown>
): GroupSubpage | null {
  if (routeName === 'index') return { kind: 'overview' };
  if (routeName === 'events') return { kind: 'events' };
  if (routeName === 'forum') return { kind: 'posts' };
  if (routeName === 'members') return { kind: 'members' };
  if (routeName === 'settings') return { kind: 'settings' };
  if (routeName === 'storage/index' || routeName === 'storage') return { kind: 'storage' };
  if (routeName === 'storage/[category]') {
    const category = params?.category;
    if (isGroupStorageCategory(category)) {
      return { kind: 'storage-category', category };
    }
    return { kind: 'storage' };
  }
  if (routeName === 'polls/index' || routeName === 'polls') return { kind: 'polls' };
  if (routeName === 'polls/[pollId]') {
    const pollId = params?.pollId;
    if (typeof pollId === 'string') return { kind: 'poll', pollId };
  }
  if (routeName === 'events/[eventId]') {
    const eventId = params?.eventId;
    if (typeof eventId === 'string') return { kind: 'event', eventId };
  }
  return null;
}
