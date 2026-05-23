import { useEffect } from 'react';
import { useNavigation, usePathname } from 'expo-router';
import { useGroupScopeNav, useClearOptimisticSubpageWhenSynced } from './GroupScopeNavContext';
import { subpageFromStackRoute } from './subpageFromStackRoute';
import { useGroupSubpage } from './useGroupSubpage';
import {
  isNativeStackClosingTransition,
  listenNativeStackTransitions,
} from './nativeStackTransitionListeners';

/**
 * Updates breadcrumb subpage as soon as a back transition starts (inner group stack).
 * Native stack commits pathname after the animation; this avoids stale breadcrumbs.
 */
export function InnerGroupSubpageBridge({ groupId }: { groupId: string }) {
  const navigation = useNavigation();
  const pathname = usePathname();
  const pathnameSubpage = useGroupSubpage(groupId);
  const { optimisticSubpage, setOptimisticSubpage } = useGroupScopeNav();
  const clearIfSynced = useClearOptimisticSubpageWhenSynced(
    pathnameSubpage,
    optimisticSubpage,
    setOptimisticSubpage
  );

  useEffect(() => {
    clearIfSynced();
  }, [clearIfSynced, pathname]);

  useEffect(() => {
    const onTransitionStart = (e: unknown) => {
      if (!isNativeStackClosingTransition(e)) return;
      const state = navigation.getState();
      const idx = typeof state.index === 'number' ? state.index : 0;
      if (idx < 1) return;
      const prev = state.routes[idx - 1];
      const sub = subpageFromStackRoute(prev.name, prev.params as Record<string, unknown> | undefined);
      if (sub) setOptimisticSubpage(sub);
    };

    return listenNativeStackTransitions(navigation, {
      onTransitionStart,
      onGestureCancel: () => setOptimisticSubpage(null),
    });
  }, [navigation, setOptimisticSubpage]);

  return null;
}
