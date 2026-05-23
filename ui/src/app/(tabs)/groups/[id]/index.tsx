import { useLocalSearchParams } from 'expo-router';
import { GroupDetailView } from '../../../../components/GroupDetailView';

export default function GroupsTabGroupDetail() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!groupId) {
    return null;
  }

  return <GroupDetailView groupId={groupId} />;
}
