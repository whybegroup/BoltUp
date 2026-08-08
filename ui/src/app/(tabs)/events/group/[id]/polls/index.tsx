import { useLocalSearchParams } from 'expo-router';
import { GroupPollsView } from '../../../../../../components/GroupPollsView';
import { GroupScopeNavProvider } from '../../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../../utils/navigationReturn';

export default function EventsTabGroupPollsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = firstSearchParam(params.id);
  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupPollsView groupId={groupId} />
    </GroupScopeNavProvider>
  );
}
