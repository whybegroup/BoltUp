import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type Href, usePathname } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors } from '../constants/theme';
import { useGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { PollDetailScreen } from './PollDetailScreen';
import { useGroupScopeNav } from './groupScope/GroupScopeNavContext';
import { useMissingGroupRedirect } from '../hooks/useMissingResourceAlert';

export type GroupPollDetailViewProps = {
  groupId: string;
  pollId: string;
};

export function GroupPollDetailView({ groupId, pollId }: GroupPollDetailViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const groupsTabNav = useGroupScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();
  
  // Detect if we're in Events tab context
  const isInEventsTab = pathname.includes('/(tabs)/events/group') || pathname.includes('/events/group');

  const { data: group, isError, error: groupError } = useGroup(groupId, currentUserId ?? '');

  const fetchPollsForGroup =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  useMissingGroupRedirect(
    isError,
    groupError,
    group?.membershipStatus,
    isInEventsTab ? '/(tabs)/events' : '/(tabs)/groups'
  );

  useEffect(() => {
    if (group?.membershipStatus === 'pending') {
      router.replace((isInEventsTab 
        ? `/(tabs)/events/group/${groupId}`
        : `/(tabs)/groups/${groupId}`) as Href);
    }
  }, [group?.membershipStatus, groupId, router, isInEventsTab]);

  if (!group) {
    return null;
  }

  const body =
    !fetchPollsForGroup || !pollId ? null : (
      <PollDetailScreen
        variant="groups"
        pollId={pollId}
        routeGroupId={groupId}
        groupsTabNav={groupsTabNav}
      />
    );

  return <View style={styles.page}>{body}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
});
