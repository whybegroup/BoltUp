import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useGroups, useNotifications, useAllGroupMemberColors } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { PollsTopHeader } from './PollsTopHeader';
import { GroupsBreadcrumbTrail } from '../GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from '../NotificationsPanelModal';
import { CreateOrJoinButton } from '../CreateOrJoinButton';
import { usePollScopeBreadcrumbs } from './usePollScopeBreadcrumbs';
import { usePollScopeHeaderSlot } from './PollScopeNavContext';

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
  const eventEligibleGroupCount = useMemo(
    () =>
      allGroupsForChrome.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroupsForChrome]
  );
  const { headerTrailing, headerTheme } = usePollScopeHeaderSlot();
  const showDetailActions = !!pollId;

  return (
    <>
      <View
        collapsable={false}
        style={[
          styles.chrome,
          { paddingTop: insets.top },
          {
            backgroundColor:
              showDetailActions && headerTheme ? headerTheme.backgroundColor : Colors.bg,
          },
        ]}
      >
        <PollsTopHeader
          showNotifs={showNotifs}
          onToggleNotifs={() => setShowNotifs((p) => !p)}
          unreadCount={unreadNotifCount}
          trailingActions={showDetailActions ? headerTrailing : undefined}
          createAction={
            !showDetailActions ? (
              <CreateOrJoinButton
                userId={currentUserId}
                eventEligibleGroupCount={eventEligibleGroupCount}
                mode="poll"
                variant="header"
              />
            ) : undefined
          }
          headerTheme={showDetailActions ? headerTheme : undefined}
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
