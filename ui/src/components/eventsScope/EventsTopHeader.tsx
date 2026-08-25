import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Layout } from '../../constants/theme';
import { EventsCalendarGlyph } from '../TabScreenIcons';
import { NotificationBellButton } from '../NotificationBellButton';
import type { ChromeHeaderTheme } from '../chromeHeaderTypes';

export type EventsTopHeaderProps = {
  showNotifs: boolean;
  onToggleNotifs: () => void;
  unreadCount: number;
  viewMode: 'list' | 'calendar';
  onViewModeChange: (mode: 'list' | 'calendar') => void;
  trailingActions?: ReactNode;
  createAction?: ReactNode;
  headerTheme?: ChromeHeaderTheme | null;
  showViewToggle?: boolean;
};

export function EventsTopHeader({
  showNotifs,
  onToggleNotifs,
  unreadCount,
  viewMode,
  onViewModeChange,
  trailingActions,
  createAction,
  headerTheme,
  showViewToggle = true,
}: EventsTopHeaderProps) {
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
        <EventsCalendarGlyph size={22} color={Colors.text} />
        <Text style={styles.title} numberOfLines={1}>
          Events
        </Text>
      </View>
      <View style={styles.headerActions}>
        {trailingActions}
        {showViewToggle ? (
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, styles.viewToggleSegLeft, viewMode === 'list' && styles.viewBtnActive]}
            onPress={() => onViewModeChange('list')}
            activeOpacity={0.7}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={viewMode === 'list' ? Colors.text : Colors.textMuted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M4 7h16M4 12h16M4 17h16" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, styles.viewToggleSegRight, viewMode === 'calendar' && styles.viewBtnActive]}
            onPress={() => onViewModeChange('calendar')}
            activeOpacity={0.7}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={viewMode === 'calendar' ? Colors.text : Colors.textMuted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M8 2v4M16 2v4M3 10h18" />
              <Path
                d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>
        ) : null}
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
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  viewBtn: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  viewToggleSegLeft: { borderRightWidth: 1, borderRightColor: Colors.border },
  viewToggleSegRight: {},
  viewBtnActive: { backgroundColor: '#F0F0EE' },
});
