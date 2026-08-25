import { type ReactNode, useMemo } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadows } from '../constants/theme';
import { useGuardedPress } from '../hooks/useGuardedPress';
import { AppToastMount } from './AppToastMount';
import { KeyboardFormRoot } from './KeyboardSafeScrollView';

const POPOVER_MAX_W = 560;

type Props = { children: ReactNode; onClose: () => void };

/**
 * Dimmed scrim + centered card. Layout does not depend on viewport width.
 * Used with Stack `presentation: 'transparentModal'`.
 *
 * The sheet keeps a bounded height (`flex: 1` + `maxHeight`) so inner ScrollViews
 * can layout. Android skips SafeAreaView — root already applies window insets,
 * and a second pass collapsed the card or added huge empty bands.
 */
export function EventFormPopoverChrome({ children, onClose }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const guardedClose = useGuardedPress(onClose);
  const padTop = Math.max(insets.top, 10) + 6;
  const padBottom = Math.max(insets.bottom, 10) + 2;
  const sheetMaxHeight = Math.max(320, height - padTop - padBottom - 16);

  const rootStyle = useMemo(
    () => [styles.root, { paddingTop: padTop, paddingBottom: padBottom }],
    [padBottom, padTop]
  );

  const sheetStyle = useMemo(
    () => [
      styles.sheet,
      {
        maxWidth: POPOVER_MAX_W,
        width: '100%' as const,
        flex: 1,
        maxHeight: sheetMaxHeight,
        borderRadius: Radius['2xl'],
        overflow: 'hidden' as const,
        alignSelf: 'center' as const,
        ...(Shadows.lg ?? {}),
      },
    ],
    [sheetMaxHeight]
  );

  const sheetInner = <KeyboardFormRoot style={{ flex: 1 }}>{children}</KeyboardFormRoot>;

  return (
    <View style={rootStyle}>
      <Pressable style={styles.scrim} onPress={guardedClose} accessibilityRole="button" accessibilityLabel="Close" />
      {Platform.OS === 'android' ? (
        <View style={sheetStyle}>{sheetInner}</View>
      ) : (
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={sheetStyle}>
          {sheetInner}
        </SafeAreaView>
      )}
      <AppToastMount />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrim: StyleSheet.absoluteFillObject,
  sheet: {
    backgroundColor: Colors.surface,
  },
});
