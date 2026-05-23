import { forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type KeyboardAvoidingViewProps,
  type ScrollViewProps,
} from 'react-native';

/** Props applied to vertical scroll areas that contain text fields (native only). */
export const keyboardAwareScrollProps: Partial<ScrollViewProps> =
  Platform.OS === 'web'
    ? { keyboardShouldPersistTaps: 'handled' }
    : {
        automaticallyAdjustKeyboardInsets: true,
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'interactive',
      };

export const KeyboardSafeScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardSafeScrollView(
    { keyboardShouldPersistTaps = 'handled', keyboardDismissMode, ...rest },
    ref
  ) {
    return (
      <ScrollView
        ref={ref}
        {...keyboardAwareScrollProps}
        {...rest}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={
          keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : undefined)
        }
      />
    );
  }
);

type KeyboardFormRootProps = KeyboardAvoidingViewProps & {
  children: React.ReactNode;
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
    return <>{children}</>;
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
