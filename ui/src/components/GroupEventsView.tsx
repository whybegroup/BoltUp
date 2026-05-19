import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../constants/theme';
import {
  useGroup,
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
  useEvents,
} from '../hooks/api';
import { type EventDetailed } from '@moijia/client';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { GroupsTopHeader } from './GroupsTopHeader';
import { GroupsBreadcrumbTrail, type BreadcrumbSegment } from './GroupsBreadcrumbTrail';
import { useGroupsActivitySectionSwitch } from './GroupsActivitySectionSwitch';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { ListView } from './ListView';
import { EventsListFiltersPanel } from './EventsListFiltersPanel';
import { useEventListFilterState } from '../hooks/useEventListFilterState';
import { filterEventsForList } from '../utils/eventListFilters';
import { withReturnTo } from '../utils/navigationReturn';
import { useGroupsBreadcrumbGroupSwitch } from './groupsBreadcrumbDropdown';

export type GroupEventsViewProps = {
  groupId: string;
  orderedSwitcherGroups?: { id: string; name: string }[];
  onSwitchGroup?: (groupId: string) => void;
};

export function GroupEventsView({
  groupId,
  orderedSwitcherGroups = [],
  onSwitchGroup,
}: GroupEventsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId: currentUserId } = useCurrentUserContext();
  const filterState = useEventListFilterState();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');
  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');

  const fetchGroupEvents =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  const { data: groupEvents = [], isLoading: groupEventsLoading } = useEvents({
    userId: currentUserId ?? '',
    groupId,
    enabled: fetchGroupEvents,
  });

  const filteredEvents = useMemo(() => {
    return filterEventsForList(groupEvents, filterState.filters, currentUserId ?? undefined);
  }, [groupEvents, filterState.filters, currentUserId]);

  const hasFilters = !!(
    filterState.filterRsvp.length ||
    filterState.filterNeeds ||
    filterState.startMode !== 'now' ||
    filterState.endMode !== 'allTime'
  );

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
    useGroupsActivitySectionSwitch(groupId, 'events', { returnPathname: pathname });

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

  const body = !fetchGroupEvents ? null : groupEventsLoading && filteredEvents.length === 0 ? (
    <View style={styles.emptyWrap}>
      <ActivityIndicator color={Colors.textSub} />
    </View>
  ) : filteredEvents.length === 0 ? (
    <View style={styles.emptyWrap}>
      <Ionicons name="calendar-outline" size={56} color={Colors.textMuted} style={styles.emptyGlyph} />
      <Text style={styles.emptyTitle}>No events</Text>
      <Text style={styles.emptyDesc}>
        {hasFilters ? 'Try adjusting your filters' : 'No events in this group yet'}
      </Text>
    </View>
  ) : (
    <ListView
      listContainerStyle={styles.list}
      events={filteredEvents}
      groups={[group]}
      groupColors={groupColors}
      onSelect={(ev: EventDetailed) => {
        router.push(withReturnTo(`/event/${ev.id}`, pathname));
      }}
      onSelectGroup={(gid) => {
        router.push(withReturnTo(`/(tabs)/groups/${gid}`, pathname));
      }}
      showGroup={false}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {groupsTopHeader}
      <GroupsBreadcrumbTrail segments={breadcrumbSegments} />
      {fetchGroupEvents ? <EventsListFiltersPanel {...filterState} /> : null}
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
  list: { flex: 1, paddingHorizontal: 20 },
  emptyWrap: { flex: 1, paddingTop: 48, paddingHorizontal: 20, alignItems: 'center' },
  emptyGlyph: { marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
