import { useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { usePathname, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../constants/theme';
import {
  useGroup,
  useAllGroupMemberColors,
  useEvents,
} from '../hooks/api';
import { type EventDetailed } from '@moijia/client';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { ListView } from './ListView';
import { EventsListFiltersPanel } from './EventsListFiltersPanel';
import { useEventListFilterState } from '../hooks/useEventListFilterState';
import { filterEventsForList } from '../utils/eventListFilters';
import { withReturnTo } from '../utils/navigationReturn';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

export type GroupEventsViewProps = {
  groupId: string;
};

export function GroupEventsView({ groupId }: GroupEventsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { userId: currentUserId } = useCurrentUserContext();
  const filterState = useEventListFilterState();

  const { data: group, isError, refetch: refetchGroup } = useGroup(groupId, currentUserId ?? '');
  const { data: groupColors = {}, refetch: refetchGroupColors } = useAllGroupMemberColors(
    currentUserId || ''
  );

  const fetchGroupEvents =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  const { data: groupEvents = [], isLoading: groupEventsLoading, refetch: refetchGroupEvents } =
    useEvents({
      userId: currentUserId ?? '',
      groupId,
      enabled: fetchGroupEvents,
    });
  const refreshData = useCallback(async () => {
    await Promise.all([refetchGroup(), refetchGroupColors(), refetchGroupEvents()]);
  }, [refetchGroup, refetchGroupColors, refetchGroupEvents]);
  const { refreshControl } = usePullToRefresh(refreshData);

  const filteredEvents = useMemo(() => {
    return filterEventsForList(groupEvents, filterState.filters, currentUserId ?? undefined);
  }, [groupEvents, filterState.filters, currentUserId]);

  const hasFilters = !!(
    filterState.filterRsvp.length ||
    filterState.filterNeeds ||
    filterState.startMode !== 'now' ||
    filterState.endMode !== 'allTime'
  );

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

  const body = !fetchGroupEvents ? null : groupEventsLoading && filteredEvents.length === 0 ? (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.emptyWrap}
      refreshControl={refreshControl}
    >
      <ActivityIndicator color={Colors.textSub} />
    </ScrollView>
  ) : filteredEvents.length === 0 ? (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.emptyWrap}
      refreshControl={refreshControl}
    >
      <Ionicons name="calendar-outline" size={56} color={Colors.textMuted} style={styles.emptyGlyph} />
      <Text style={styles.emptyTitle}>No events</Text>
      <Text style={styles.emptyDesc}>
        {hasFilters ? 'Try adjusting your filters' : 'No events in this group yet'}
      </Text>
    </ScrollView>
  ) : (
    <ListView
      listContainerStyle={styles.list}
      events={filteredEvents}
      groups={[group]}
      groupColors={groupColors}
      refreshControl={refreshControl}
      onSelect={(ev: EventDetailed) => {
        router.push(`/(tabs)/groups/${groupId}/events/${ev.id}` as Href);
      }}
      onSelectGroup={(gid) => {
        router.push(withReturnTo(`/(tabs)/groups/${gid}`, pathname));
      }}
      showGroup={false}
    />
  );

  return (
    <View style={styles.page}>
      {fetchGroupEvents ? <EventsListFiltersPanel {...filterState} /> : null}
      <View style={styles.content}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
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
