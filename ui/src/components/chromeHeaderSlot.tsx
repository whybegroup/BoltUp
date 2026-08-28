import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Colors } from '../constants/theme';
import { modalTopBarStyles } from './modalTopBarStyles';
import type { ChromeHeaderSlotSetters, ChromeHeaderTheme } from './chromeHeaderTypes';
import { usePollScopeNavOptional } from './pollsScope/PollScopeNavContext';
import { useEventScopeNavOptional } from './eventsScope/EventScopeNavContext';
import { useGroupScopeNavOptional } from './groupScope/GroupScopeNavContext';

export type { ChromeHeaderSlotSetters, ChromeHeaderSlotState, ChromeHeaderTheme } from './chromeHeaderTypes';

/** Prefer the tab that actually renders chrome (polls > events > groups). */
export function useActiveChromeHeaderSetters(): ChromeHeaderSlotSetters | null {
  const poll = usePollScopeNavOptional();
  const event = useEventScopeNavOptional();
  const group = useGroupScopeNavOptional();
  if (poll) return poll;
  if (event) return event;
  if (group) return group;
  return null;
}

export function useRegisterChromeHeader(
  setters: ChromeHeaderSlotSetters | null | undefined,
  enabled: boolean,
  trailing: ReactNode | null,
  theme: ChromeHeaderTheme | null,
) {
  const setHeaderTrailing = setters?.setHeaderTrailing;
  const setHeaderTheme = setters?.setHeaderTheme;
  const themeKeyRef = useRef<string | null>(null);
  // The slot is shared by every screen in the tab's stack, so ownership has to follow
  // focus: otherwise a screen pushed on top clears the slot when it pops and the screen
  // underneath never re-registers.
  const isFocused = useIsFocused();
  const active = enabled && isFocused;

  useLayoutEffect(() => {
    if (!setHeaderTrailing || !setHeaderTheme || !active) return;
    setHeaderTrailing(trailing);
    const key = theme ? `${theme.backgroundColor}|${theme.borderBottomColor}` : '';
    if (themeKeyRef.current !== key) {
      themeKeyRef.current = key;
      setHeaderTheme(theme);
    }
  }, [setHeaderTrailing, setHeaderTheme, active, trailing, theme]);

  useLayoutEffect(() => {
    if (!setHeaderTrailing || !setHeaderTheme || !active) return;
    return () => {
      themeKeyRef.current = null;
      setHeaderTrailing(null);
      setHeaderTheme(null);
    };
  }, [setHeaderTrailing, setHeaderTheme, active]);
}

/** Mount on a page-variant detail screen to hoist actions into the tab header. */
export function RegisterChromeHeader({
  trailing,
  theme,
}: {
  trailing: ReactNode | null;
  theme: ChromeHeaderTheme | null;
}) {
  const setters = useActiveChromeHeaderSetters();
  useRegisterChromeHeader(setters, true, trailing, theme);
  return null;
}

export function ChromeHeaderTrailingRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function DetailActionIcon({
  placement,
  onPress,
  disabled,
  accessibilityLabel,
  children,
}: {
  placement: 'chrome' | 'modal';
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  if (placement === 'chrome') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={styles.iconBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[modalTopBarStyles.trailingIconTap, { marginRight: 8 }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
