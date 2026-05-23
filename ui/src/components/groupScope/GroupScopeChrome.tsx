import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useGroups, useNotifications, useAllGroupMemberColors } from '../../hooks/api';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { useOrderedSwitcherGroups } from '../../hooks/useOrderedSwitcherGroups';
import { GroupsTopHeader } from '../GroupsTopHeader';
import { GroupsBreadcrumbTrail } from '../GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from '../NotificationsPanelModal';
import { useGroupScopeNav } from './GroupScopeNavContext';
import { useGroupSubpage } from './useGroupSubpage';
import { useGroupScopeBreadcrumbs } from './useGroupScopeBreadcrumbs';

type GroupScopeChromeProps = {
  /** When null, breadcrumbs show the All Groups list (no group scope). */
  groupId: string | null;
};

/**
 * Single top bar + breadcrumb strip for the entire Groups tab.
 * Stack screens below must not render their own headers.
 */
export function GroupScopeChrome({ groupId }: GroupScopeChromeProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();
  const { orderedSwitcherGroups } = useOrderedSwitcherGroups(currentUserId ?? '');

  const { optimisticSubpage } = useGroupScopeNav();
  const pathnameSubpage = useGroupSubpage(groupId ?? '');
  const subpage = groupId
    ? (optimisticSubpage ?? pathnameSubpage)
    : ({ kind: 'overview' as const });
  const onSwitchGroup = useCallback(
    (nextId: string) => {
      if (groupId && nextId === groupId) return;
      router.replace(`/(tabs)/groups/${nextId}` as never);
    },
    [router, groupId]
  );

  const groupBreadcrumbs = useGroupScopeBreadcrumbs(
    groupId ?? '',
    subpage,
    orderedSwitcherGroups,
    onSwitchGroup,
    { enabled: !!groupId }
  );

  const listSegments = useMemo(() => [{ label: 'All Groups' }], []);

  const segments = groupId ? groupBreadcrumbs.segments : listSegments;
  const groupSwitchModal = groupId ? groupBreadcrumbs.groupSwitchModal : null;
  const activitySectionSwitchModal = groupId ? groupBreadcrumbs.activitySectionSwitchModal : null;

  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');
  const [showNotifs, setShowNotifs] = useState(false);

  const eventEligibleGroupCount = useMemo(
    () =>
      allGroupsForChrome.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroupsForChrome]
  );
  const unreadNotifCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  return (
    <>
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <GroupsTopHeader
          userId={currentUserId}
          eventEligibleGroupCount={eventEligibleGroupCount}
          showNotifs={showNotifs}
          onToggleNotifs={() => setShowNotifs((p) => !p)}
          unreadCount={unreadNotifCount}
        />
        <GroupsBreadcrumbTrail segments={segments} />
      </View>
      {groupSwitchModal}
      {activitySectionSwitchModal}
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
