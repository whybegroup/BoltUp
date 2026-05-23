import { useLocalSearchParams } from 'expo-router';
import { GroupPollsView } from '../../../../../components/GroupPollsView';

export default function GroupPollsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!groupId) return null;
  return <GroupPollsView groupId={groupId} />;
}
