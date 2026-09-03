import { useMemo, useCallback } from 'react';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import type { BreadcrumbSegment } from '../GroupsBreadcrumbTrail';
import { useEvent, useGroup, usePoll } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { breadcrumbTruncate } from '../../utils/helpers';
import { ALL_EVENTS_HREF, navigateEventsTabTo } from '../../utils/tabBreadcrumbNav';
import { useEventScopeNav } from './EventScopeNavContext';
import type { EventSubpage } from './useEventSubpage';
import {
  buildGroupDetailUrl,
  buildGroupEventsUrl,
  buildGroupPollsUrl,
  buildGroupForumUrl,
  buildGroupMembersUrl,
  buildGroupSettingsUrl,
  buildGroupStorageUrl,
} from '../../utils/breadcrumbUrl';
import { GROUP_STORAGE_CATEGORY_LABELS } from '../../utils/groupStorageCategories';

type UseEventScopeBreadcrumbsOptions = {
  enabled?: boolean;
};

export function useEventScopeBreadcrumbs(
  subpage: EventSubpage,
  fromEventIdProp?: string,
  options?: UseEventScopeBreadcrumbsOptions
) {
  const enabled = options?.enabled !== false;
  const router = useRouter();
  const navCallbacks = useEventScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();

  // Extract IDs from subpage
  const eventId = subpage.kind === 'event-detail' ? subpage.eventId 
    : subpage.kind === 'group-event-detail' ? subpage.eventId 
    : undefined;
  const groupId = subpage.kind === 'group-overview' ? subpage.groupId
    : subpage.kind === 'group-events' ? subpage.groupId
    : subpage.kind === 'group-event-detail' ? subpage.groupId
    : subpage.kind === 'group-polls' ? subpage.groupId
    : subpage.kind === 'group-poll-detail' ? subpage.groupId
    : subpage.kind === 'group-forum' ? subpage.groupId
    : subpage.kind === 'group-members' ? subpage.groupId
    : subpage.kind === 'group-settings' ? subpage.groupId
    : subpage.kind === 'group-storage' ? subpage.groupId
    : subpage.kind === 'group-storage-category' ? subpage.groupId
    : undefined;
  const pollId = subpage.kind === 'group-poll-detail' ? subpage.pollId : undefined;
  
  // Use the fromEventId passed as a prop
  const fromEventId = fromEventIdProp;

  const { data: event } = useEvent(eventId ?? '', currentUserId ?? '');
  const { data: group } = useGroup(groupId ?? '', currentUserId ?? '');
  const { data: poll } = usePoll(pollId ?? '', currentUserId ?? '');
  const { data: fromEvent } = useEvent(fromEventId ?? '', currentUserId ?? '');

  const goToAllEvents = useCallback(() => {
    navigateEventsTabTo(router, ALL_EVENTS_HREF, navCallbacks);
  }, [router, navCallbacks]);

  const navigateTo = useCallback(
    (target: Href) => {
      navigateEventsTabTo(router, target, navCallbacks);
    },
    [router, navCallbacks]
  );

  const segments: BreadcrumbSegment[] = useMemo(() => {
    if (!enabled) {
      return [{ label: 'All Events' }];
    }

    const segs: BreadcrumbSegment[] = [{ label: 'All Events', onPress: goToAllEvents }];

    // Build breadcrumbs based on subpage
    switch (subpage.kind) {
      case 'all-events':
        // Just "All Events"
        return segs;

      case 'event-detail':
        // All Events > Event
        if (event) {
          segs.push({ label: breadcrumbTruncate(event.name || 'Event') });
        }
        return segs;

      case 'group-overview':
        // All Events > Event > Group (if fromEventId is present)
        // All Events > Group (if no fromEventId)
        console.log('fromEventId', fromEventId);
        console.log('fromEvent', fromEvent);
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          segs.push({ label: breadcrumbTruncate(group.name || 'Group') });
        }
        return segs;

      case 'group-events':
        // All Events > Event > Group > Events (if fromEventId)
        // All Events > Group > Events (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Events' });
        }
        return segs;

      case 'group-event-detail':
        // All Events > Event > Group > Events > Event (if fromEventId)
        // All Events > Group > Events > Event (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          const eventsHref = buildGroupEventsUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({
            label: 'Events',
            onPress: () => navigateTo(eventsHref),
          });
          if (event) {
            segs.push({ label: breadcrumbTruncate(event.name || 'Event') });
          }
        }
        return segs;

      case 'group-polls':
        // All Events > Event > Group > Polls (if fromEventId)
        // All Events > Group > Polls (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Polls' });
        }
        return segs;

      case 'group-poll-detail':
        // All Events > Event > Group > Polls > Poll (if fromEventId)
        // All Events > Group > Polls > Poll (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          const pollsHref = buildGroupPollsUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({
            label: 'Polls',
            onPress: () => navigateTo(pollsHref),
          });
          if (poll) {
            segs.push({ label: breadcrumbTruncate(poll.title || 'Poll') });
          }
        }
        return segs;

      case 'group-forum':
        // All Events > Event > Group > Forum (if fromEventId)
        // All Events > Group > Forum (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Forum' });
        }
        return segs;

      case 'group-members':
        // All Events > Event > Group > Members (if fromEventId)
        // All Events > Group > Members (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Members' });
        }
        return segs;

      case 'group-settings':
        // All Events > Event > Group > Settings (if fromEventId)
        // All Events > Group > Settings (if no fromEventId)
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Settings' });
        }
        return segs;

      case 'group-storage':
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({ label: 'Manage Storage' });
        }
        return segs;

      case 'group-storage-category':
        if (fromEventId && fromEvent) {
          segs.push({
            label: breadcrumbTruncate(fromEvent.name || 'Event'),
            onPress: () => navigateTo(`/(tabs)/events/${fromEventId}` as Href),
          });
        }
        if (group) {
          const groupHref = buildGroupDetailUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          const storageHref = buildGroupStorageUrl(subpage.groupId, { isInEventsTab: true, fromEventId });
          segs.push({
            label: breadcrumbTruncate(group.name || 'Group'),
            onPress: () => navigateTo(groupHref),
          });
          segs.push({
            label: 'Manage Storage',
            onPress: () => navigateTo(storageHref),
          });
          segs.push({ label: GROUP_STORAGE_CATEGORY_LABELS[subpage.category] });
        }
        return segs;

      default:
        return segs;
    }
  }, [enabled, subpage, event, group, poll, fromEvent, fromEventId, goToAllEvents, navigateTo]);

  return { segments };
}
