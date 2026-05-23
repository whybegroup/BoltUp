import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { usePollScopeNav } from './PollScopeNavContext';
import {
  isNativeStackClosingTransition,
  listenNativeStackTransitions,
} from '../groupScope/nativeStackTransitionListeners';

/** Updates breadcrumb chrome when the polls stack pops back to All Polls. */
export function PollsTabNavBridge() {
  const navigation = useNavigation();
  const { setOptimisticAllPolls } = usePollScopeNav();

  useEffect(() => {
    const onTransitionStart = (e: unknown) => {
      if (!isNativeStackClosingTransition(e)) return;
      const state = navigation.getState();
      const idx = typeof state.index === 'number' ? state.index : 0;
      if (idx < 1) return;
      const closing = state.routes[idx];
      const prev = state.routes[idx - 1];
      const closingIsPoll =
        closing.name === '[pollId]' ||
        (typeof closing.name === 'string' && closing.name.includes('[pollId]'));
      if (prev.name === 'index' && closingIsPoll) {
        setOptimisticAllPolls(true);
      }
    };

    return listenNativeStackTransitions(navigation, {
      onTransitionStart,
      onGestureCancel: () => setOptimisticAllPolls(false),
    });
  }, [navigation, setOptimisticAllPolls]);

  return null;
}
