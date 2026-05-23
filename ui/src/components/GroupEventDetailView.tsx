import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors } from '../constants/theme';
import { useGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { EventDetailScreen } from './EventDetailScreen';
import { useGroupScopeNav } from './groupScope/GroupScopeNavContext';

export type GroupEventDetailViewProps = {
  groupId: string;
  eventId: string;
  focusCommentId?: string;
};

export function GroupEventDetailView({
  groupId,
  eventId,
  focusCommentId,
}: GroupEventDetailViewProps) {
  const router = useRouter();
  const groupsTabNav = useGroupScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');

  const fetchEventsForGroup =
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

  const body =
    !fetchEventsForGroup || !eventId ? null : (
      <EventDetailScreen
        variant="groups"
        eventId={eventId}
        routeGroupId={groupId}
        focusCommentId={focusCommentId}
        groupsTabNav={groupsTabNav}
      />
    );

  return <View style={styles.page}>{body}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
});
