import { useMemo, useCallback } from 'react';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import type { BreadcrumbSegment } from '../GroupsBreadcrumbTrail';
import { useEvent } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { breadcrumbTruncate } from '../../utils/helpers';
import { ALL_EVENTS_HREF, navigateEventsTabTo } from '../../utils/tabBreadcrumbNav';
import { useEventScopeNav } from './EventScopeNavContext';

export function useEventScopeBreadcrumbs(eventId: string | null) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: event } = useEvent(eventId ?? '', currentUserId ?? '');

  const navCallbacks = useEventScopeNav();

  const goToAllEvents = useCallback(() => {
    if (!eventId) return;
    navigateEventsTabTo(router, ALL_EVENTS_HREF, navCallbacks);
  }, [router, eventId, navCallbacks]);

  const segments: BreadcrumbSegment[] = useMemo(() => {
    if (!eventId) {
      return [{ label: 'All Events' }];
    }
    const eventLabel = breadcrumbTruncate(event?.title?.trim() ? event.title : 'Event');
    return [
      { label: 'All Events', onPress: goToAllEvents },
      { label: eventLabel },
    ];
  }, [eventId, event?.title, goToAllEvents]);

  return { segments };
}
