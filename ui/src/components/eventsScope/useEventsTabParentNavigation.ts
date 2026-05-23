import { useCallback, useMemo } from 'react';
import { usePathname } from 'expo-router';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { useTabBreadcrumbBackHandler } from '../../hooks/useTabBreadcrumbBackHandler';
import {
  ALL_EVENTS_HREF,
  eventsTabParentHrefFromPathname,
  navigateEventsTabTo,
} from '../../utils/tabBreadcrumbNav';
import { useEventScopeNav } from './EventScopeNavContext';

/** Breadcrumb-parent back for the Events tab (hardware, gesture, and shared navigate helper). */
export function useEventsTabParentNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navCallbacks = useEventScopeNav();

  const parentHref = useMemo(() => eventsTabParentHrefFromPathname(pathname), [pathname]);

  const navigateToParent = useCallback(() => {
    if (!parentHref) return;
    navigateEventsTabTo(router, parentHref, navCallbacks);
  }, [parentHref, router, navCallbacks]);

  const navigateToAllEvents = useCallback(() => {
    navigateEventsTabTo(router, ALL_EVENTS_HREF, navCallbacks);
  }, [router, navCallbacks]);

  useTabBreadcrumbBackHandler({ parentHref, onNavigateToParent: navigateToParent });

  return { parentHref, navigateToParent, navigateToAllEvents };
}
