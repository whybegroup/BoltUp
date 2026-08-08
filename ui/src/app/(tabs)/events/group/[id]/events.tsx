import { useLocalSearchParams } from 'expo-router';
import { GroupEventsView } from '../../../../../components/GroupEventsView';
import { GroupScopeNavProvider } from '../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function EventsTabGroupEventsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = firstSearchParam(params.id);

  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupEventsView groupId={groupId} />
    </GroupScopeNavProvider>
  );
}
