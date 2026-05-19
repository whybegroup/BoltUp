import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';
import {
  useGroup,
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
} from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { GroupsTopHeader } from './GroupsTopHeader';
import { GroupsBreadcrumbTrail, type BreadcrumbSegment } from './GroupsBreadcrumbTrail';
import { useGroupsActivitySectionSwitch } from './GroupsActivitySectionSwitch';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { PollsListScreen } from './PollsListScreen';
import { useGroupsBreadcrumbGroupSwitch } from './groupsBreadcrumbDropdown';

export type GroupPollsViewProps = {
  groupId: string;
  orderedSwitcherGroups?: { id: string; name: string }[];
  onSwitchGroup?: (groupId: string) => void;
};

export function GroupPollsView({
  groupId,
  orderedSwitcherGroups = [],
  onSwitchGroup,
}: GroupPollsViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');
  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');

  const fetchPollsForGroup =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  const goToOverview = useCallback(() => {
    router.replace('/(tabs)/groups');
  }, [router]);

  const eventEligibleGroupCount = useMemo(
    () =>
      allGroupsForChrome.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroupsForChrome]
  );
  const unreadNotifCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);

  const [showNotifs, setShowNotifs] = useState(false);
  const { chevronProps: groupChevronProps, modal: groupSwitchModal } = useGroupsBreadcrumbGroupSwitch(
    group ? { id: groupId, name: group.name } : null,
    orderedSwitcherGroups,
    onSwitchGroup
  );

  const requestOverview = useCallback(() => {
    goToOverview();
  }, [goToOverview]);

  const { segment: activitySectionSegment, modal: activitySectionSwitchModal } =
    useGroupsActivitySectionSwitch(groupId, 'polls');

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    if (!group) {
      return [{ label: 'All Groups', onPress: requestOverview }];
    }
    return [
      { label: 'All Groups', onPress: requestOverview },
      {
        label: group.name,
        onPress: () => router.push(`/(tabs)/groups/${groupId}` as Href),
        ...groupChevronProps,
      },
      activitySectionSegment,
    ];
  }, [group, groupId, requestOverview, router, activitySectionSegment, groupChevronProps]);

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace('/(tabs)/groups');
    }
  }, [isError, group?.membershipStatus, router]);

  useEffect(() => {
    if (group?.membershipStatus === 'pending') {
      router.replace(`/(tabs)/groups/${groupId}` as Href);
    }
  }, [group?.membershipStatus, groupId, router]);

  if (!group) {
    return null;
  }

  const groupsTopHeader = (
    <GroupsTopHeader
      userId={currentUserId}
      eventEligibleGroupCount={eventEligibleGroupCount}
      showNotifs={showNotifs}
      onToggleNotifs={() => setShowNotifs((p) => !p)}
      unreadCount={unreadNotifCount}
    />
  );

  const body = !fetchPollsForGroup ? null : (
    <PollsListScreen lockedGroupId={groupId} embedded />
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {groupsTopHeader}
      <GroupsBreadcrumbTrail segments={breadcrumbSegments} />
      {activitySectionSwitchModal}
      {groupSwitchModal}
      <View style={styles.content}>{body}</View>
      <NotificationsPanelModal
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        userId={currentUserId || ''}
        notifications={notifs}
        isLoading={notifsLoading}
        groups={allGroupsForChrome.map((g) => ({ id: g.id, name: g.name }))}
        groupColors={groupColors}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, paddingTop: 8, minHeight: 0 },
});
