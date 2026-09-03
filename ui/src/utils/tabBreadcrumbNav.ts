import type { Href, Router } from 'expo-router';
import { runGuardedNavigation } from './navigationGuard';
import {
  groupSubpageFromPathname,
  type GroupSubpage,
} from '../components/groupScope/useGroupSubpage';
import { groupIdFromPathname } from '../components/groupScope/groupIdFromPathname';
import { pollIdFromPollsTabPathname } from '../components/pollsScope/pollIdFromPathname';
import { eventIdFromEventsTabPathname } from '../components/eventsScope/eventIdFromPathname';

export const ALL_GROUPS_HREF = '/(tabs)/groups' as Href;
export const ALL_POLLS_HREF = '/(tabs)/polls' as Href;
export const ALL_EVENTS_HREF = '/(tabs)/events' as Href;

export function groupsTabParentHref(groupId: string, subpage: GroupSubpage): Href | null {
  switch (subpage.kind) {
    case 'overview':
      return ALL_GROUPS_HREF;
    case 'poll':
      return `/(tabs)/groups/${groupId}/polls` as Href;
    case 'event':
      return `/(tabs)/groups/${groupId}/events` as Href;
    case 'events':
    case 'posts':
    case 'polls':
    case 'members':
    case 'settings':
    case 'storage':
      return `/(tabs)/groups/${groupId}` as Href;
    case 'storage-category':
      return `/(tabs)/groups/${groupId}/storage` as Href;
  }
}

export function groupsTabParentHrefFromPathname(pathname: string): Href | null {
  const groupId = groupIdFromPathname(pathname);
  if (!groupId) return null;
  return groupsTabParentHref(groupId, groupSubpageFromPathname(pathname, groupId));
}

export function pollsTabParentHrefFromPathname(pathname: string): Href | null {
  if (!pollIdFromPollsTabPathname(pathname)) return null;
  return ALL_POLLS_HREF;
}

export function eventsTabParentHrefFromPathname(pathname: string): Href | null {
  if (!eventIdFromEventsTabPathname(pathname)) return null;
  return ALL_EVENTS_HREF;
}

export function groupSubpageForGroupsTabHref(pathname: string, groupId: string): GroupSubpage | null {
  const target = pathname.trim();
  if (!target.includes(`/groups/${groupId}`)) return null;
  return groupSubpageFromPathname(target, groupId);
}

export function navigateToBreadcrumbTarget(
  router: Pick<Router, 'dismissTo' | 'replace'>,
  target: Href
): void {
  router.dismissTo(target);
}

export type GroupsTabNavCallbacks = {
  setOptimisticAllGroups?: (value: boolean) => void;
  setOptimisticSubpage?: (subpage: GroupSubpage | null) => void;
};

/** Navigate within the Groups tab; updates breadcrumb chrome optimistically when provided. */
export function navigateGroupsTabTo(
  router: Pick<Router, 'dismissTo' | 'replace'>,
  target: Href,
  groupId: string | null,
  callbacks?: GroupsTabNavCallbacks
): void {
  const targetStr = String(target);
  if (targetStr === String(ALL_GROUPS_HREF) || targetStr.endsWith('/groups')) {
    callbacks?.setOptimisticAllGroups?.(true);
    callbacks?.setOptimisticSubpage?.(null);
    router.replace(target);
    return;
  }
  if (groupId) {
    callbacks?.setOptimisticAllGroups?.(false);
    const sub = groupSubpageForGroupsTabHref(targetStr, groupId);
    if (sub) callbacks?.setOptimisticSubpage?.(sub);
  }
  navigateToBreadcrumbTarget(router, target);
}

export type PollsTabNavCallbacks = {
  setOptimisticAllPolls?: (value: boolean) => void;
};

export function navigatePollsTabTo(
  router: Pick<Router, 'dismissTo' | 'replace'>,
  target: Href,
  callbacks?: PollsTabNavCallbacks
): void {
  if (String(target) === String(ALL_POLLS_HREF)) {
    callbacks?.setOptimisticAllPolls?.(true);
  }
  navigateToBreadcrumbTarget(router, target);
}

export type EventsTabNavCallbacks = {
  setOptimisticAllEvents?: (value: boolean) => void;
  setFromEventId?: (id: string | undefined) => void;
};

export function navigateEventsTabTo(
  router: Pick<Router, 'dismissTo' | 'replace'>,
  target: Href,
  callbacks?: EventsTabNavCallbacks
): void {
  if (String(target) === String(ALL_EVENTS_HREF)) {
    callbacks?.setOptimisticAllEvents?.(true);
  }
  navigateToBreadcrumbTarget(router, target);
}

export function groupsTabGroupOverviewHref(groupId: string): Href {
  return `/(tabs)/groups/${groupId}` as Href;
}

/**
 * Open group overview on the Groups tab.
 * Uses dismissTo when already under that tab; push when coming from Polls tab or a modal.
 */
export function navigateToGroupsTabGroupOverview(
  router: Pick<Router, 'dismissTo' | 'replace' | 'push'>,
  groupId: string,
  options?: { withinGroupsTab?: boolean; groupsTabNav?: GroupsTabNavCallbacks }
): void {
  const href = groupsTabGroupOverviewHref(groupId);
  if (options?.withinGroupsTab) {
    navigateGroupsTabTo(router, href, groupId, options.groupsTabNav);
    return;
  }
  options?.groupsTabNav?.setOptimisticAllGroups?.(false);
  options?.groupsTabNav?.setOptimisticSubpage?.({ kind: 'overview' });
  runGuardedNavigation(() => {
    router.replace(ALL_GROUPS_HREF);
    router.push(href);
  }, 1200);
}

export function groupForumHref(
  groupId: string,
  query?: { postId?: string; commentId?: string }
): Href {
  if (!query?.postId && !query?.commentId) {
    return `/(tabs)/groups/${groupId}/forum` as Href;
  }
  return {
    pathname: '/(tabs)/groups/[id]/forum',
    params: {
      id: groupId,
      ...(query.postId ? { postId: query.postId } : {}),
      ...(query.commentId ? { commentId: query.commentId } : {}),
    },
  } as Href;
}

export function eventDetailHref(
  eventId: string,
  query?: { commentId?: string }
): Href {
  if (!query?.commentId) {
    return `/(tabs)/events/${eventId}` as Href;
  }
  return {
    pathname: '/(tabs)/events/[eventId]',
    params: { eventId, commentId: query.commentId },
  } as Href;
}

/**
 * Open event detail focused on a comment (mention notification deep link).
 */
export function navigateToEventCommentMention(
  router: Pick<Router, 'dismissTo' | 'replace' | 'push'>,
  pathname: string,
  eventId: string,
  commentId: string
): void {
  const href = eventDetailHref(eventId, { commentId });
  const pathEventId = pathname.match(/\/events\/([^/?]+)/)?.[1] ?? null;
  const onEventsTab =
    pathname.includes('/events') && !/\/groups\/[^/]+\/events\//.test(pathname);
  const sameEvent = pathEventId === eventId;

  if (sameEvent) {
    router.replace(href);
    return;
  }

  runGuardedNavigation(() => {
    if (!onEventsTab) {
      router.replace(ALL_EVENTS_HREF);
    }
    router.push(href);
  }, 1200);
}

/**
 * Open group forum focused on a post/comment.
 * Seeds group overview on the stack when needed so back → group page, not All Groups.
 */
export function navigateToGroupForumMention(
  router: Pick<Router, 'dismissTo' | 'replace' | 'push'>,
  pathname: string,
  groupId: string,
  postId: string,
  commentId?: string | null,
  callbacks?: GroupsTabNavCallbacks
): void {
  const href = groupForumHref(groupId, {
    postId,
    commentId: commentId ?? undefined,
  });
  const overviewHref = groupsTabGroupOverviewHref(groupId);

  callbacks?.setOptimisticAllGroups?.(false);
  callbacks?.setOptimisticSubpage?.({ kind: 'posts' });

  const onGroupsTab = pathname.includes('/groups');
  const currentGroupId = groupIdFromPathname(pathname);
  const sameGroup = onGroupsTab && currentGroupId === groupId;
  const onForum = sameGroup && pathname.includes('/forum');

  if (onForum) {
    router.replace(href);
    return;
  }

  runGuardedNavigation(() => {
    if (!onGroupsTab) {
      router.replace(ALL_GROUPS_HREF);
    } else if (currentGroupId && currentGroupId !== groupId) {
      router.replace(ALL_GROUPS_HREF);
    }

    if (sameGroup) {
      router.push(href);
      return;
    }

    router.push(overviewHref);
    router.push(href);
  }, 1200);
}
