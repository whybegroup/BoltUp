import { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type View,
} from 'react-native';
import type { MutableRefObject, RefObject } from 'react';

/** Extra space so the caret / input bottom isn’t tucked under the IME suggestion bar. */
const GAP_ABOVE_KEYBOARD = Platform.OS === 'android' ? 72 : 20;
const VIEWPORT_TOP_GAP = 12;
/**
 * Room below a focused TextInput for trailing actions (Comment / Reply / Post,
 * attach row) so those controls sit above the keyboard too.
 */
const ACTIONS_BELOW_FOCUSED_INPUT = Platform.OS === 'android' ? 96 : 72;
/** Extra scroll-content room on Android so the focused field can actually move up. */
const ANDROID_KEYBOARD_SCROLL_PAD = 96;

type MeasurableView = View & {
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

type Scrollable = {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
  measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  getNativeScrollRef?: () => unknown;
  getScrollRef?: () => unknown;
};

/** RN 0.83+ `measureLayout` requires a host instance, not a numeric node handle. */
function nativeScrollHost(scroll: Scrollable | null): object | null {
  if (!scroll) return null;
  const inner = scroll.getNativeScrollRef?.() ?? scroll.getScrollRef?.();
  return inner && typeof inner === 'object' ? inner : null;
}

function visibleBottomY(keyboardHeight: number): number {
  const windowH = Dimensions.get('window').height;
  if (Platform.OS === 'android') {
    const occluded = Dimensions.get('screen').height - windowH;
    // `softwareKeyboardLayoutMode: resize` already shrank the window by ~IME height.
    if (keyboardHeight > 0 && occluded >= keyboardHeight * 0.5) {
      return windowH - GAP_ABOVE_KEYBOARD;
    }
  }
  return windowH - Math.max(0, keyboardHeight) - GAP_ABOVE_KEYBOARD;
}

function scrollMeasuredNodeAboveKeyboard(args: {
  scrollRef: RefObject<Scrollable | null>;
  scrollOffsetYRef: MutableRefObject<number>;
  y: number;
  h: number;
  keyboardHeight: number;
  extraBelow?: number;
}): void {
  const { scrollRef, scrollOffsetYRef, y, h, keyboardHeight, extraBelow = 0 } = args;
  const visibleBottom = visibleBottomY(keyboardHeight);
  const targetBottom = y + h + extraBelow;
  if (targetBottom <= visibleBottom) return;

  const delta = targetBottom - visibleBottom;
  scrollRef.current?.scrollTo({
    y: Math.max(0, scrollOffsetYRef.current + delta),
    animated: true,
  });
}

/** Scroll a parent ScrollView just enough to place `targetRef` above the keyboard. */
export function scrollNodeAboveKeyboard(args: {
  scrollRef: RefObject<Scrollable | null>;
  scrollOffsetYRef: MutableRefObject<number>;
  targetRef: RefObject<View | null>;
  keyboardHeight: number;
}): void {
  if (Platform.OS === 'web') return;

  const { scrollRef, scrollOffsetYRef, targetRef, keyboardHeight } = args;
  const node = targetRef.current as MeasurableView | null;
  if (!node?.measureInWindow) return;

  node.measureInWindow((_x, y, _w, h) => {
    scrollMeasuredNodeAboveKeyboard({
      scrollRef,
      scrollOffsetYRef,
      y,
      h,
      keyboardHeight,
      extraBelow: 120,
    });
  });
}

/** Place `targetRef` near the top of the ScrollView viewport. */
export function scrollNodeToTopOfViewport(args: {
  scrollRef: RefObject<Scrollable | null>;
  scrollViewportYRef: MutableRefObject<number>;
  scrollOffsetYRef: MutableRefObject<number>;
  targetRef: RefObject<View | null> | { current: View | null };
}): void {
  const { scrollRef, scrollViewportYRef, scrollOffsetYRef, targetRef } = args;
  const node = targetRef.current as MeasurableView | null;
  if (!node?.measureInWindow) return;

  node.measureInWindow((_x, y) => {
    const viewportY = scrollViewportYRef.current;
    const absoluteTarget = scrollOffsetYRef.current + (y - viewportY);
    scrollRef.current?.scrollTo({
      y: Math.max(0, absoluteTarget - VIEWPORT_TOP_GAP),
      animated: true,
    });
  });
}

function readKeyboardHeight(): number {
  const metrics = Keyboard.metrics?.();
  return metrics && metrics.height > 0 ? metrics.height : 0;
}

function afterLayout(run: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

/**
 * `onFocus` handler: waits for keyboard height, then scrolls the target view above it.
 */
export function createScrollAboveKeyboardOnFocus(args: {
  scrollRef: RefObject<Scrollable | null>;
  scrollOffsetYRef: MutableRefObject<number>;
  targetRef: RefObject<View | null>;
}): (e?: NativeSyntheticEvent<TextInputFocusEventData>) => void {
  const { scrollRef, scrollOffsetYRef, targetRef } = args;

  return (_e?: NativeSyntheticEvent<TextInputFocusEventData>) => {
    if (Platform.OS === 'web') return;

    const run = (keyboardHeight: number) => {
      if (keyboardHeight <= 0) return;
      afterLayout(() => {
        scrollNodeAboveKeyboard({ scrollRef, scrollOffsetYRef, targetRef, keyboardHeight });
      });
      if (Platform.OS === 'android') {
        setTimeout(() => {
          scrollNodeAboveKeyboard({ scrollRef, scrollOffsetYRef, targetRef, keyboardHeight });
        }, 280);
      }
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
    const fallbackMs = Platform.OS === 'ios' ? 400 : 280;
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

/** Extra bottom space while the Android IME is open so focused fields can scroll fully into view. */
export function useAndroidKeyboardContentPad(): number {
  const [pad, setPad] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setPad(ANDROID_KEYBOARD_SCROLL_PAD));
    const hide = Keyboard.addListener('keyboardDidHide', () => setPad(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return pad;
}

/**
 * When the keyboard opens, scroll this ScrollView so the focused TextInput sits fully above it.
 */
export function useEnsureFocusedInputAboveKeyboard(
  scrollRef: RefObject<Scrollable | null>,
  scrollOffsetYRef: MutableRefObject<number>
): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const tryScroll = (keyboardHeight: number) => {
      if (keyboardHeight <= 0) return;
      const focused = TextInput.State.currentlyFocusedInput?.() as (MeasurableView & {
        measureLayout?: (
          relativeTo: object,
          onSuccess: (x: number, y: number, w: number, h: number) => void,
          onFail: () => void
        ) => void;
      }) | null;
      if (!focused?.measureInWindow) return;

      const apply = (y: number, h: number) => {
        scrollMeasuredNodeAboveKeyboard({
          scrollRef,
          scrollOffsetYRef,
          y,
          h,
          keyboardHeight,
          extraBelow: ACTIONS_BELOW_FOCUSED_INPUT,
        });
      };

      const relativeTo = nativeScrollHost(scrollRef.current);
      if (relativeTo && focused.measureLayout) {
        focused.measureLayout(
          relativeTo,
          () => {
            focused.measureInWindow((_x, y, _w, h) => apply(y, h));
          },
          () => undefined
        );
        return;
      }

      const scrollNode = scrollRef.current as MeasurableView | null;
      if (!scrollNode?.measureInWindow) return;
      scrollNode.measureInWindow((sx, sy, sw, sh) => {
        focused.measureInWindow((x, y, w, h) => {
          const inside =
            x + w > sx && x < sx + sw && y + h > sy - 24 && y < sy + sh + keyboardHeight + 80;
          if (!inside) return;
          apply(y, h);
        });
      });
    };

    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(eventName, (ev) => {
      const height = ev.endCoordinates.height;
      afterLayout(() => tryScroll(height));
      if (Platform.OS === 'android') {
        setTimeout(() => tryScroll(height), 280);
      }
    });
    return () => sub.remove();
  }, [scrollOffsetYRef, scrollRef]);
}
