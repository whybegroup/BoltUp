import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Shadows } from '../constants/theme';
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
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { ListView } from './ListView';
import { EventsListFiltersPanel } from './EventsListFiltersPanel';
import { useEventListFilterState } from '../hooks/useEventListFilterState';
import { filterEventsForList } from '../utils/eventListFilters';
import { withReturnTo } from '../utils/navigationReturn';

export type GroupEventsViewProps = {
  groupId: string;
  switchableGroups?: { id: string; name: string }[];
  onSwitchGroup?: (groupId: string) => void;
};

export function GroupEventsView({
  groupId,
  switchableGroups = [],
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
  const [showSwitchGroups, setShowSwitchGroups] = useState(false);
  const [switchGroupsAnchor, setSwitchGroupsAnchor] = useState<{ x: number; y: number } | null>(null);

  const requestOverview = useCallback(() => {
    goToOverview();
  }, [goToOverview]);

  const titleIsSwitchable = switchableGroups.length > 0 && !!onSwitchGroup;

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    if (!group) {
      return [{ label: 'All Groups', onPress: requestOverview }];
    }
    return [
      { label: 'All Groups', onPress: requestOverview },
      {
        label: group.name,
        onPress: () => router.push(`/(tabs)/groups/${groupId}` as Href),
        showSwitchChevron: titleIsSwitchable,
        onSwitchChevronPress: titleIsSwitchable
          ? (anchor) => {
              setSwitchGroupsAnchor(anchor);
              setShowSwitchGroups(true);
            }
          : undefined,
      },
      { label: 'Events' },
    ];
  }, [group, groupId, titleIsSwitchable, requestOverview, router]);

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

  const switchMenuWidth = 240;
  const windowWidth = Dimensions.get('window').width;
  const switchMenuLeft = Math.max(
    12,
    Math.min((switchGroupsAnchor?.x ?? windowWidth - 12) - switchMenuWidth + 20, windowWidth - switchMenuWidth - 12)
  );
  const switchMenuTop = Math.max(12, (switchGroupsAnchor?.y ?? 0) + 10);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {groupsTopHeader}
      <GroupsBreadcrumbTrail segments={breadcrumbSegments} />
      {fetchGroupEvents ? <EventsListFiltersPanel {...filterState} /> : null}
      {showSwitchGroups && onSwitchGroup && switchableGroups.length > 0 ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSwitchGroups(false)}>
          <View style={styles.switchGroupsOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSwitchGroups(false)} activeOpacity={1} />
            <View style={[styles.switchGroupsCard, { top: switchMenuTop, left: switchMenuLeft, width: switchMenuWidth }]}>
              <ScrollView style={styles.switchGroupsList} keyboardShouldPersistTaps="handled">
                {switchableGroups.map((g, idx) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => {
                      setShowSwitchGroups(false);
                      onSwitchGroup(g.id);
                    }}
                    style={[
                      styles.switchGroupsRow,
                      idx === 0 && styles.switchGroupsRowFirst,
                      (idx === 0 || idx === switchableGroups.length - 1) && styles.switchGroupsRowEdge,
                    ]}
                  >
                    <Text style={styles.switchGroupsRowText} numberOfLines={2}>
                      {g.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
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
  switchGroupsOverlay: { ...StyleSheet.absoluteFillObject },
  switchGroupsCard: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 0,
    maxHeight: 320,
    ...Shadows.lg,
  },
  switchGroupsList: { maxHeight: 300 },
  switchGroupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  switchGroupsRowFirst: { borderTopWidth: 0 },
  switchGroupsRowEdge: { paddingVertical: 12 },
  switchGroupsRowText: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Colors.text },
});
