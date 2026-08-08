import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors } from '../constants/theme';
import { useGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { GroupDetailView } from './GroupDetailView';
import { GroupScopeNavProvider } from './groupScope/GroupScopeNavContext';

export type EventGroupDetailViewProps = {
  groupId: string;
};

export function EventGroupDetailView({ groupId }: EventGroupDetailViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError } = useGroup(groupId, currentUserId ?? '');

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace('/(tabs)/events');
    }
  }, [isError, group?.membershipStatus, router]);

  if (!group) {
    return null;
  }

  const body = (
    <GroupScopeNavProvider>
      <GroupDetailView groupId={groupId} />
    </GroupScopeNavProvider>
  );

  return <View style={styles.root}>{body}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
});
