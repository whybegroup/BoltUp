import { useLocalSearchParams } from 'expo-router';
import { GroupSettingsView } from '../../../../../components/GroupSettingsView';
import { GroupScopeNavProvider } from '../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function EventsTabGroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = firstSearchParam(params.id);
  if (!groupId) return null;
  return (
    <GroupScopeNavProvider>
      <GroupSettingsView groupId={groupId} />
    </GroupScopeNavProvider>
  );
}
