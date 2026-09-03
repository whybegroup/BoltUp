import { useLocalSearchParams } from 'expo-router';
import { GroupManageStorageView } from '../../../../../../components/GroupManageStorageView';
import { GroupScopeNavProvider } from '../../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../../utils/navigationReturn';

export default function EventsTabGroupStorageScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = firstSearchParam(params.id);
  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupManageStorageView groupId={groupId} />
    </GroupScopeNavProvider>
  );
}
