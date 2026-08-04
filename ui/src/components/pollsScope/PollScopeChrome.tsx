import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useGroups, useNotifications, useAllGroupMemberColors } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { PollsTopHeader } from './PollsTopHeader';
import { GroupsBreadcrumbTrail } from '../GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from '../NotificationsPanelModal';
import { usePollScopeBreadcrumbs } from './usePollScopeBreadcrumbs';

type PollScopeChromeProps = {
  pollId: string | null;
};

/**
 * Single top bar + breadcrumb strip for the entire Polls tab.
 * Stack screens below must not render their own headers.
 */
export function PollScopeChrome({ pollId }: PollScopeChromeProps) {
  const insets = useSafeAreaInsets();
  const { userId: currentUserId } = useCurrentUserContext();
  const { segments } = usePollScopeBreadcrumbs(pollId);

  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');
  const [showNotifs, setShowNotifs] = useState(false);

  const unreadNotifCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  return (
    <>
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <PollsTopHeader
          showNotifs={showNotifs}
          onToggleNotifs={() => setShowNotifs((p) => !p)}
          unreadCount={unreadNotifCount}
        />
        <GroupsBreadcrumbTrail segments={segments} />
      </View>
      <NotificationsPanelModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={currentUserId || ''}
        notifications={notifs}
        isLoading={notifsLoading}
        groups={allGroupsForChrome.map((g) => ({ id: g.id, name: g.name }))}
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
});
