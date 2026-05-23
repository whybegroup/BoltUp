import { useCallback, useMemo } from 'react';
import { usePathname, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { useTabBreadcrumbBackHandler } from '../../hooks/useTabBreadcrumbBackHandler';
import {
  ALL_GROUPS_HREF,
  groupsTabParentHrefFromPathname,
  navigateGroupsTabTo,
} from '../../utils/tabBreadcrumbNav';
import { groupIdFromPathname } from './groupIdFromPathname';
import { useGroupScopeNav } from './GroupScopeNavContext';

function groupsTabOuterParentHref(pathname: string, hasGroupInPath: boolean): Href | null {
  if (hasGroupInPath) return null;
  if (/\/groups\/invite/.test(pathname)) return ALL_GROUPS_HREF;
  return null;
}

/** Breadcrumb-parent back for the Groups tab (hardware, gesture, and shared navigate helper). */
export function useGroupsTabParentNavigation(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const router = useRouter();
  const pathname = usePathname();
  const groupId = groupIdFromPathname(pathname);
  const navCallbacks = useGroupScopeNav();

  const parentHref = useMemo(() => {
    if (!enabled) return null;
    return (
      groupsTabParentHrefFromPathname(pathname) ??
      groupsTabOuterParentHref(pathname, !!groupId)
    );
  }, [enabled, pathname, groupId]);

  const navigateToParent = useCallback(() => {
    if (!parentHref) return;
    navigateGroupsTabTo(router, parentHref, groupId, navCallbacks);
  }, [parentHref, router, groupId, navCallbacks]);

  const navigateTo = useCallback(
    (target: Href) => {
      navigateGroupsTabTo(router, target, groupId, navCallbacks);
    },
    [router, groupId, navCallbacks]
  );

  useTabBreadcrumbBackHandler({ parentHref, onNavigateToParent: navigateToParent });

  return { parentHref, navigateToParent, navigateTo };
}
