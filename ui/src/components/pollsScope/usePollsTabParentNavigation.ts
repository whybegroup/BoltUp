import { useCallback, useMemo } from 'react';
import { usePathname } from 'expo-router';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { useTabBreadcrumbBackHandler } from '../../hooks/useTabBreadcrumbBackHandler';
import {
  ALL_POLLS_HREF,
  pollsTabParentHrefFromPathname,
  navigatePollsTabTo,
} from '../../utils/tabBreadcrumbNav';
import { usePollScopeNav } from './PollScopeNavContext';

/** Breadcrumb-parent back for the Polls tab (hardware, gesture, and shared navigate helper). */
export function usePollsTabParentNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const navCallbacks = usePollScopeNav();

  const parentHref = useMemo(() => pollsTabParentHrefFromPathname(pathname), [pathname]);

  const navigateToParent = useCallback(() => {
    if (!parentHref) return;
    navigatePollsTabTo(router, parentHref, navCallbacks);
  }, [parentHref, router, navCallbacks]);

  const navigateToAllPolls = useCallback(() => {
    navigatePollsTabTo(router, ALL_POLLS_HREF, navCallbacks);
  }, [router, navCallbacks]);

  useTabBreadcrumbBackHandler({ parentHref, onNavigateToParent: navigateToParent });

  return { parentHref, navigateToParent, navigateToAllPolls };
}
