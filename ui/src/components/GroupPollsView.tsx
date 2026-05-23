import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors } from '../constants/theme';
import { useGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { PollsListScreen } from './PollsListScreen';

export type GroupPollsViewProps = {
  groupId: string;
};

export function GroupPollsView({ groupId }: GroupPollsViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');

  const fetchPollsForGroup =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

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

  const body = !fetchPollsForGroup ? null : <PollsListScreen lockedGroupId={groupId} embedded />;

  return <View style={styles.page}>{body}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
});
