import { forwardRef, useRef, type ForwardedRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
} from 'react-native';
import {
  useAndroidKeyboardContentPad,
  useEnsureFocusedInputAboveKeyboard,
} from '../utils/scrollInputAboveKeyboard';

/** Props applied to vertical scroll areas that contain text fields (native only). */
export const keyboardAwareScrollProps: Partial<ScrollViewProps> =
  Platform.OS === 'web'
    ? { keyboardShouldPersistTaps: 'handled' }
    : {
        automaticallyAdjustKeyboardInsets: true,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
      };

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const KeyboardSafeScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardSafeScrollView(
    {
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode,
      onScroll,
      children,
      scrollEventThrottle,
      ...rest
    },
    ref
  ) {
    const innerRef = useRef<ScrollView | null>(null);
    const offsetYRef = useRef(0);
    const androidKbPad = useAndroidKeyboardContentPad();
    useEnsureFocusedInputAboveKeyboard(innerRef, offsetYRef);

    return (
      <ScrollView
        ref={(node) => {
          innerRef.current = node;
          assignRef(ref, node);
        }}
        {...keyboardAwareScrollProps}
        {...rest}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={
          keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : undefined)
        }
        onScroll={(e) => {
          offsetYRef.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
        scrollEventThrottle={scrollEventThrottle ?? 16}
      >
        {children}
        {androidKbPad > 0 ? <View style={{ height: androidKbPad }} pointerEvents="none" /> : null}
      </ScrollView>
    );
  }
);

type KeyboardFormRootProps = KeyboardAvoidingViewProps & {
  children: ReactNode;
  /** Extra offset when a nav bar sits above the form (modal header). */
  headerOffset?: number;
};

/** Wraps full-screen / modal forms so the keyboard does not cover inputs. */
export function KeyboardFormRoot({
  children,
  style,
  behavior,
  keyboardVerticalOffset = 0,
  headerOffset = 0,
  ...rest
}: KeyboardFormRootProps) {
  if (Platform.OS === 'web') {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)}
      keyboardVerticalOffset={keyboardVerticalOffset + headerOffset}
      {...rest}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
