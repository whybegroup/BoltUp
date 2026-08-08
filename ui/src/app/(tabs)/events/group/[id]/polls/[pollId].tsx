import { useLocalSearchParams } from 'expo-router';
import { GroupPollDetailView } from '../../../../../../components/GroupPollDetailView';
import { GroupScopeNavProvider } from '../../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../../utils/navigationReturn';

export default function EventsTabGroupPollDetailScreen() {
  const params = useLocalSearchParams<{ id: string; pollId: string }>();
  const groupId = firstSearchParam(params.id);
  const pollId = firstSearchParam(params.pollId);
  if (!groupId || !pollId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupPollDetailView groupId={groupId} pollId={pollId} />
    </GroupScopeNavProvider>
  );
}
