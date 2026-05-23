import { useLocalSearchParams } from 'expo-router';
import { GroupSettingsView } from '../../../../components/GroupSettingsView';

export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!groupId) return null;
  return <GroupSettingsView groupId={groupId} />;
}
