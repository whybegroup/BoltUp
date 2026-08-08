import { useLocalSearchParams } from 'expo-router';
import { GroupMembersView } from '../../../../../components/GroupMembersView';
import { GroupScopeNavProvider } from '../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function EventsTabGroupMembersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = firstSearchParam(params.id);
  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupMembersView groupId={groupId} />
    </GroupScopeNavProvider>
  );
}
