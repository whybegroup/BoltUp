import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Text,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Shadows } from '../constants/theme';
import {
  useGroup,
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
  usePoll,
} from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { GroupsTopHeader } from './GroupsTopHeader';
import { GroupsBreadcrumbTrail, type BreadcrumbSegment } from './GroupsBreadcrumbTrail';
import { NotificationsPanelModal } from './NotificationsPanelModal';
import { PollDetailScreen } from './PollDetailScreen';
import { breadcrumbTruncate } from '../utils/helpers';

export type GroupPollDetailViewProps = {
  groupId: string;
  pollId: string;
  switchableGroups?: { id: string; name: string }[];
  onSwitchGroup?: (groupId: string) => void;
};

export function GroupPollDetailView({
  groupId,
  pollId,
  switchableGroups = [],
  onSwitchGroup,
}: GroupPollDetailViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');
  const { data: poll } = usePoll(pollId, currentUserId ?? '');
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
  const [showSwitchGroups, setShowSwitchGroups] = useState(false);

  const requestOverview = useCallback(() => {
    goToOverview();
  }, [goToOverview]);

  const titleIsSwitchable = switchableGroups.length > 0 && !!onSwitchGroup;

  const breadcrumbSegments: BreadcrumbSegment[] = useMemo(() => {
    const pollLabel = breadcrumbTruncate(poll?.title?.trim() ? poll.title : 'Poll');
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
      {
        label: 'Polls',
        onPress: () => router.push(`/(tabs)/groups/${groupId}/polls` as Href),
      },
      { label: pollLabel },
    ];
  }, [group, groupId, titleIsSwitchable, requestOverview, router, poll?.title]);

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

  const body =
    !fetchPollsForGroup || !pollId ? null : (
      <PollDetailScreen variant="groups" pollId={pollId} routeGroupId={groupId} />
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
  content: { flex: 1, minHeight: 0 },
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
