import {
  Dimensions,
  Keyboard,
  Platform,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextInputFocusEventData,
  type View,
} from 'react-native';
import type { MutableRefObject, RefObject } from 'react';

const GAP_ABOVE_KEYBOARD = 12;

type MeasurableView = View & {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/** Scroll a parent ScrollView just enough to place `targetRef` above the keyboard. */
export function scrollNodeAboveKeyboard(args: {
  scrollRef: RefObject<ScrollView | null>;
  scrollOffsetYRef: MutableRefObject<number>;
  targetRef: RefObject<View | null>;
  keyboardHeight: number;
}): void {
  if (Platform.OS === 'web') return;

  const { scrollRef, scrollOffsetYRef, targetRef, keyboardHeight } = args;
  const node = targetRef.current as MeasurableView | null;
  if (!node?.measureInWindow) return;

  node.measureInWindow((_x, y, _w, h) => {
    const windowH = Dimensions.get('window').height;
    const visibleBottom = windowH - keyboardHeight - GAP_ABOVE_KEYBOARD;
    const targetBottom = y + h;
    if (targetBottom <= visibleBottom) return;

    const delta = targetBottom - visibleBottom;
    scrollRef.current?.scrollTo({
      y: Math.max(0, scrollOffsetYRef.current + delta),
      animated: true,
    });
  });
}

function readKeyboardHeight(): number {
  const metrics = Keyboard.metrics?.();
  return metrics && metrics.height > 0 ? metrics.height : 0;
}

/**
 * `onFocus` handler: waits for keyboard height, then scrolls the target view above it.
 */
export function createScrollAboveKeyboardOnFocus(args: {
  scrollRef: RefObject<ScrollView | null>;
  scrollOffsetYRef: MutableRefObject<number>;
  targetRef: RefObject<View | null>;
}): (e?: NativeSyntheticEvent<TextInputFocusEventData>) => void {
  const { scrollRef, scrollOffsetYRef, targetRef } = args;

  return (_e?: NativeSyntheticEvent<TextInputFocusEventData>) => {
    if (Platform.OS === 'web') return;

    const run = (keyboardHeight: number) => {
      if (keyboardHeight <= 0) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollNodeAboveKeyboard({ scrollRef, scrollOffsetYRef, targetRef, keyboardHeight });
        });
      });
    };

    const existing = readKeyboardHeight();
    if (existing > 0) {
      run(existing);
      return;
    }

    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    let handled = false;
    const sub = Keyboard.addListener(eventName, (ev) => {
      if (handled) return;
      handled = true;
      sub.remove();
      run(ev.endCoordinates.height);
    });

    // Switching between inputs while keyboard stays open (no show event on iOS).
    const fallbackMs = Platform.OS === 'ios' ? 400 : 200;
    setTimeout(() => {
      if (handled) return;
      const h = readKeyboardHeight();
      if (h > 0) {
        handled = true;
        sub.remove();
        run(h);
      }
    }, fallbackMs);
  };
}
