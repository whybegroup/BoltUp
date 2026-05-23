import type { EventArg, NavigationProp, ParamListBase } from '@react-navigation/native';

export type TransitionStartEvent = EventArg<'transitionStart', true, { closing: boolean }>;

/** Native-stack back transitions include `{ closing: true }`; tabs/other navigators often omit `data`. */
export function isNativeStackClosingTransition(event: unknown): boolean {
  const data = (event as { data?: { closing?: boolean } } | undefined)?.data;
  return data?.closing === true;
}

type NativeStackListenerNav = NavigationProp<ParamListBase> & {
  addListener(type: 'transitionStart', callback: (e: TransitionStartEvent) => void): () => void;
  addListener(type: 'gestureCancel', callback: () => void): () => void;
};

export function listenNativeStackTransitions(
  navigation: NavigationProp<ParamListBase>,
  handlers: {
    onTransitionStart?: (e: unknown) => void;
    onGestureCancel?: () => void;
  }
): () => void {
  const nav = navigation as NativeStackListenerNav;
  const unsubs: (() => void)[] = [];
  if (handlers.onTransitionStart) {
    unsubs.push(nav.addListener('transitionStart', handlers.onTransitionStart as (e: TransitionStartEvent) => void));
  }
  if (handlers.onGestureCancel) {
    unsubs.push(nav.addListener('gestureCancel', handlers.onGestureCancel));
  }
  return () => {
    for (const unsub of unsubs) unsub();
  };
}
