import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type Href, usePathname } from 'expo-router';
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
  const pathname = usePathname();
  const groupsTabNav = useGroupScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();
  
  // Detect if we're in Events tab context
  const isInEventsTab = pathname.includes('/(tabs)/events/group') || pathname.includes('/events/group');

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');

  const fetchEventsForGroup =
    !!currentUserId &&
    !!group &&
    (group.membershipStatus === 'member' || group.membershipStatus === 'admin');

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace(isInEventsTab ? '/(tabs)/events' : '/(tabs)/groups');
    }
  }, [isError, group?.membershipStatus, router, isInEventsTab]);

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
