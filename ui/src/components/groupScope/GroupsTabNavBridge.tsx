import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { useGroupScopeNav } from './GroupScopeNavContext';
import {
  isNativeStackClosingTransition,
  listenNativeStackTransitions,
} from './nativeStackTransitionListeners';

/** Updates breadcrumb chrome when the outer groups stack pops back to All Groups. */
export function GroupsTabNavBridge() {
  const navigation = useNavigation();
  const { setOptimisticAllGroups } = useGroupScopeNav();

  useEffect(() => {
    const onTransitionStart = (e: unknown) => {
      if (!isNativeStackClosingTransition(e)) return;
      const state = navigation.getState();
      const idx = typeof state.index === 'number' ? state.index : 0;
      if (idx < 1) return;
      const closing = state.routes[idx];
      const prev = state.routes[idx - 1];
      const closingIsGroup =
        closing.name === '[id]' ||
        (typeof closing.name === 'string' && closing.name.includes('[id]'));
      if (prev.name === 'index' && closingIsGroup) {
        setOptimisticAllGroups(true);
      }
    };

    return listenNativeStackTransitions(navigation, {
      onTransitionStart,
      onGestureCancel: () => setOptimisticAllGroups(false),
    });
  }, [navigation, setOptimisticAllGroups]);

  return null;
}
