import { useLocalSearchParams } from 'expo-router';
import { GroupMembersView } from '../../../../components/GroupMembersView';

export default function GroupMembersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!groupId) return null;
  return <GroupMembersView groupId={groupId} />;
}
