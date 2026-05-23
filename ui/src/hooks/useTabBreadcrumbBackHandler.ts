import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import type { Href } from 'expo-router';

/**
 * Android hardware back → breadcrumb parent navigation.
 *
 * iOS swipe-back is not intercepted here: native-stack does not support blocking
 * pops via `beforeRemove` without desyncing JS/native state. Keep stacks shallow
 * via `dismissTo` / `navigateGroupsTabTo` so gesture back matches breadcrumbs.
 */
export function useTabBreadcrumbBackHandler(options: {
  parentHref: Href | null;
  onNavigateToParent: () => void;
}) {
  const { parentHref, onNavigateToParent } = options;
  const navigatingRef = useRef(false);

  const goToParent = useCallback(() => {
    if (!parentHref || navigatingRef.current) return false;
    navigatingRef.current = true;
    onNavigateToParent();
    requestAnimationFrame(() => {
      navigatingRef.current = false;
    });
    return true;
  }, [parentHref, onNavigateToParent]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !parentHref) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => goToParent());
    return () => sub.remove();
  }, [parentHref, goToParent]);
}
