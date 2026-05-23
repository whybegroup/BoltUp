import { useRouter as useExpoRouter, type Href, type Router } from 'expo-router';
import { useMemo } from 'react';
import {
  guardedRouterDismissTo,
  guardedRouterPush,
  guardedRouterReplace,
} from '../utils/navigationGuard';

/** Drop-in replacement for expo-router `useRouter` with double-navigation protection. */
export function useAppRouter(): Router {
  const router = useExpoRouter();

  return useMemo(
    () => ({
      ...router,
      push: (href: Href) => guardedRouterPush(router, href),
      replace: (href: Href) => guardedRouterReplace(router, href),
      dismissTo: (href: Href) => guardedRouterDismissTo(router, href),
    }),
    [router],
  );
}
