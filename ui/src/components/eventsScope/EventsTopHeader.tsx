import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Layout } from '../../constants/theme';
import { EventsCalendarGlyph } from '../TabScreenIcons';

export type EventsTopHeaderProps = {
  showNotifs: boolean;
  onToggleNotifs: () => void;
  unreadCount: number;
  viewMode: 'list' | 'calendar';
  onViewModeChange: (mode: 'list' | 'calendar') => void;
};

export function EventsTopHeader({
  showNotifs,
  onToggleNotifs,
  unreadCount,
  viewMode,
  onViewModeChange,
}: EventsTopHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <EventsCalendarGlyph size={22} color={Colors.text} />
        <Text style={styles.title} numberOfLines={1}>
          Events
        </Text>
      </View>
      <View style={styles.headerActions}>
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
        <TouchableOpacity
          onPress={onToggleNotifs}
          style={[styles.iconBtn, showNotifs && { borderColor: Colors.borderStrong, backgroundColor: Colors.bg }]}
        >
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={Colors.text}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </Svg>
          {unreadCount > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
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
    paddingVertical: 16,
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
  bellDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.notGoing,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
});
