import { View, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { useGroup } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { GroupDetailView } from './GroupDetailView';
import { GroupScopeNavProvider } from './groupScope/GroupScopeNavContext';
import { useMissingGroupRedirect } from '../hooks/useMissingResourceAlert';

export type EventGroupDetailViewProps = {
  groupId: string;
};

export function EventGroupDetailView({ groupId }: EventGroupDetailViewProps) {
  const { userId: currentUserId } = useCurrentUserContext();

  const { data: group, isError, error: groupError } = useGroup(groupId, currentUserId ?? '');

  useMissingGroupRedirect(isError, groupError, group?.membershipStatus, '/(tabs)/events');

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
