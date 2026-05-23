import { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { useEventScopeNav } from './EventScopeNavContext';
import {
  isNativeStackClosingTransition,
  listenNativeStackTransitions,
} from '../groupScope/nativeStackTransitionListeners';

/** Updates breadcrumb chrome when the events stack pops back to All Events. */
export function EventsTabNavBridge() {
  const navigation = useNavigation();
  const { setOptimisticAllEvents } = useEventScopeNav();

  useEffect(() => {
    const onTransitionStart = (e: unknown) => {
      if (!isNativeStackClosingTransition(e)) return;
      const state = navigation.getState();
      const idx = typeof state.index === 'number' ? state.index : 0;
      if (idx < 1) return;
      const closing = state.routes[idx];
      const prev = state.routes[idx - 1];
      const closingIsEvent =
        closing.name === '[eventId]' ||
        (typeof closing.name === 'string' && closing.name.includes('[eventId]'));
      if (prev.name === 'index' && closingIsEvent) {
        setOptimisticAllEvents(true);
      }
    };

    return listenNativeStackTransitions(navigation, {
      onTransitionStart,
      onGestureCancel: () => setOptimisticAllEvents(false),
    });
  }, [navigation, setOptimisticAllEvents]);

  return null;
}
