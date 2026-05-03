import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  ScrollView,
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

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');
  const { data: allGroupsForChrome = [] } = useGroups(currentUserId ?? '', true);
  const { data: notifs = [], isLoading: notifsLoading } = useNotifications(currentUserId || '');
  const { data: groupColors = {} } = useAllGroupMemberColors(currentUserId || '');

  const groupEventsFetchWindow = useMemo(() => {
    const now = new Date();
    const lookback = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      startAfter: lookback.toISOString(),
      startBefore: weekEnd.toISOString(),
      weekEndMs: weekEnd.getTime(),
    };
  }, [groupId]);

  const fetchGroupWeekEvents =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');
  const { data: groupWeekEvents = [], isLoading: groupWeekEventsLoading, refetch: refetchGroupEvents } = useEvents({
    userId: currentUserId ?? '',
    groupId,
    startAfter: groupEventsFetchWindow.startAfter,
    startBefore: groupEventsFetchWindow.startBefore,
    limit: 200,
    enabled: fetchGroupWeekEvents,
  });
  const [eventsSummaryRefreshTick, setEventsSummaryRefreshTick] = useState(0);
  const groupEventsSummary = useMemo(() => {
    const nowMs = Date.now();
    const { weekEndMs } = groupEventsFetchWindow;
    const eventsForModal: EventDetailed[] = [];
    for (const ev of groupWeekEvents) {
      const s = new Date(ev.start).getTime();
      const e = new Date(ev.end).getTime();
      if (s <= nowMs && e > nowMs) {
        eventsForModal.push(ev);
      } else if (s > nowMs && s <= weekEndMs) {
        eventsForModal.push(ev);
      }
    }
    eventsForModal.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { eventsForModal };
  }, [groupWeekEvents, groupEventsFetchWindow, eventsSummaryRefreshTick]);

  useEffect(() => {
    if (!fetchGroupWeekEvents) return;
    const interval = setInterval(() => {
      refetchGroupEvents();
      setEventsSummaryRefreshTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchGroupWeekEvents, refetchGroupEvents]);

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
        onPress: titleIsSwitchable
          ? () => setShowSwitchGroups(true)
          : () => router.push(`/(tabs)/groups/${groupId}` as Href),
        showSwitchChevron: titleIsSwitchable,
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

  const body = !fetchGroupWeekEvents ? null : groupWeekEventsLoading && groupEventsSummary.eventsForModal.length === 0 ? (
    <View style={styles.emptyWrap}>
      <ActivityIndicator color={Colors.textSub} />
    </View>
  ) : groupEventsSummary.eventsForModal.length === 0 ? (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>No in-progress or upcoming events</Text>
    </View>
  ) : (
    <ListView
      listContainerStyle={styles.list}
      events={groupEventsSummary.eventsForModal}
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
      {showSwitchGroups && onSwitchGroup && switchableGroups.length > 0 ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSwitchGroups(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowSwitchGroups(false)} activeOpacity={1}>
            <View style={styles.switchGroupsCard}>
              <Text style={styles.switchGroupsTitle}>Switch group</Text>
              <ScrollView style={styles.switchGroupsList} keyboardShouldPersistTaps="handled">
                {switchableGroups.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => {
                      setShowSwitchGroups(false);
                      onSwitchGroup(g.id);
                    }}
                    style={styles.switchGroupsRow}
                  >
                    <Text style={styles.switchGroupsRowText} numberOfLines={2}>
                      {g.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
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
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  switchGroupsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 0,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    ...Shadows.lg,
  },
  switchGroupsTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  switchGroupsList: { maxHeight: 400 },
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
  switchGroupsRowText: { flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: Colors.text },
});
