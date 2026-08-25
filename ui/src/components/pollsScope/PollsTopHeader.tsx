import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Layout } from '../../constants/theme';
import { NotificationBellButton } from '../NotificationBellButton';
import type { ChromeHeaderTheme } from '../chromeHeaderTypes';

export type PollsTopHeaderProps = {
  showNotifs: boolean;
  onToggleNotifs: () => void;
  unreadCount: number;
  trailingActions?: ReactNode;
  createAction?: ReactNode;
  headerTheme?: ChromeHeaderTheme | null;
};

export function PollsTopHeader({
  showNotifs,
  onToggleNotifs,
  unreadCount,
  trailingActions,
  createAction,
  headerTheme,
}: PollsTopHeaderProps) {
  return (
    <View
      collapsable={false}
      style={[
        styles.header,
        {
          backgroundColor: headerTheme?.backgroundColor ?? Colors.surface,
          borderBottomColor: headerTheme?.borderBottomColor ?? Colors.border,
        },
      ]}
    >
      <View style={styles.headerTitleRow}>
        <Ionicons name="bar-chart-outline" size={22} color={Colors.text} />
        <Text style={styles.title} numberOfLines={1}>
          Polls
        </Text>
      </View>
      <View style={styles.headerActions}>
        {trailingActions}
        {createAction}
        <NotificationBellButton
          showNotifs={showNotifs}
          onPress={onToggleNotifs}
          unreadCount={unreadCount}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: Layout.tabHeaderMinHeight,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.text, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
});
