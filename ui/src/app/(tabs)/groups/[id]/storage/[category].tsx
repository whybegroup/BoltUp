import { useLocalSearchParams } from 'expo-router';
import { GroupStorageCategoryView } from '../../../../../components/GroupStorageCategoryView';

export default function GroupStorageCategoryScreen() {
  const params = useLocalSearchParams<{ id: string; category: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const category = Array.isArray(params.category) ? params.category[0] : params.category;
  if (!groupId || !category) return null;
  return <GroupStorageCategoryView groupId={groupId} category={category} />;
}
