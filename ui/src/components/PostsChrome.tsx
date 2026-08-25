import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Layout } from '../constants/theme';
import { useGroups, useNotifications, useAllGroupMemberColors } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { NotificationBellButton } from './NotificationBellButton';

type PostsChromeProps = {
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
};

export function PostsChrome({ viewMode, onViewModeChange }: PostsChromeProps) {
  const insets = useSafeAreaInsets();
  const { userId: currentUserId } = useCurrentUserContext();
  
  const { data: allGroups = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');
  const [showNotifs, setShowNotifs] = useState(false);

  const unreadNotifCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  return (
    <>
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="newspaper-outline" size={22} color={Colors.text} />
            <Text style={styles.title} numberOfLines={1}>
              Posts
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
                style={[styles.viewBtn, styles.viewToggleSegRight, viewMode === 'grid' && styles.viewBtnActive]}
                onPress={() => onViewModeChange('grid')}
                activeOpacity={0.7}
              >
                <Svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={viewMode === 'grid' ? Colors.text : Colors.textMuted}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M10 3H3v7h7V3zM21 3h-7v7h7V3zM21 14h-7v7h7v-7zM10 14H3v7h7v-7z" />
                </Svg>
              </TouchableOpacity>
            </View>
            <NotificationBellButton
              showNotifs={showNotifs}
              onPress={() => setShowNotifs(true)}
              unreadCount={unreadNotifCount}
            />
          </View>
        </View>
      </View>
      <NotificationsPanelModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={currentUserId || ''}
        notifications={notifs}
        isLoading={notifsLoading}
        groups={allGroups.map((g) => ({ id: g.id, name: g.name }))}
        groupColors={groupColors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chrome: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.bg,
  },
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
  headerTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    flexShrink: 1, 
    minWidth: 0,
  },
  title: { 
    fontSize: 18, 
    fontFamily: Fonts.extraBold, 
    color: Colors.text, 
    flexShrink: 1,
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    flexShrink: 0,
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  viewBtn: { 
    width: 36, 
    height: 32, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  viewToggleSegLeft: { 
    borderRightWidth: 1, 
    borderRightColor: Colors.border,
  },
  viewToggleSegRight: {},
  viewBtnActive: { backgroundColor: '#F0F0EE' },
});
