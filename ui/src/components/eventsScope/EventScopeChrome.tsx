import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useGroups, useNotifications, useAllGroupMemberColors } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { EventsTopHeader } from './EventsTopHeader';
import { GroupsBreadcrumbTrail } from '../GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from '../NotificationsPanelModal';
import { CreateOrJoinButton } from '../CreateOrJoinButton';
import { useEventScopeBreadcrumbs } from './useEventScopeBreadcrumbs';
import { useEventScopeHeaderSlot, useEventScopeNav } from './EventScopeNavContext';
import type { EventSubpage } from './useEventSubpage';

type EventScopeChromeProps = {
  subpage: EventSubpage;
  fromEventId?: string;
};

/**
 * Single top bar + breadcrumb strip for the entire Events tab.
 * Stack screens below must not render their own headers.
 */
export function EventScopeChrome({ subpage, fromEventId }: EventScopeChromeProps) {
  const insets = useSafeAreaInsets();
  const { userId: currentUserId } = useCurrentUserContext();
  const { viewMode, setViewMode } = useEventScopeNav();
  const { headerTrailing, headerTheme } = useEventScopeHeaderSlot();
  const { segments } = useEventScopeBreadcrumbs(subpage, fromEventId);

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
  const showDetailActions =
    subpage.kind === 'event-detail' ||
    subpage.kind === 'group-event-detail' ||
    subpage.kind === 'group-poll-detail' ||
    subpage.kind === 'group-overview';
  const createAction =
    subpage.kind === 'all-events'
      ? { mode: 'event' as const, groupId: undefined as string | undefined }
      : subpage.kind === 'group-events'
        ? { mode: 'event' as const, groupId: subpage.groupId }
        : subpage.kind === 'group-polls'
          ? { mode: 'poll' as const, groupId: subpage.groupId }
          : null;

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
        <EventsTopHeader
          showNotifs={showNotifs}
          onToggleNotifs={() => setShowNotifs((p) => !p)}
          unreadCount={unreadNotifCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          trailingActions={showDetailActions ? headerTrailing : undefined}
          createAction={
            createAction ? (
              <CreateOrJoinButton
                userId={currentUserId}
                eventEligibleGroupCount={eventEligibleGroupCount}
                mode={createAction.mode}
                groupId={createAction.groupId}
                variant="header"
              />
            ) : undefined
          }
          headerTheme={showDetailActions ? headerTheme : undefined}
          showViewToggle={!showDetailActions}
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
