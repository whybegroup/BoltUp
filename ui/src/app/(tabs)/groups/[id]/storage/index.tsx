import { useLocalSearchParams } from 'expo-router';
import { GroupManageStorageView } from '../../../../../components/GroupManageStorageView';

export default function GroupStorageScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!groupId) return null;
  return <GroupManageStorageView groupId={groupId} />;
}
