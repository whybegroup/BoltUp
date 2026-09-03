import { useLocalSearchParams } from 'expo-router';
import { GroupStorageCategoryView } from '../../../../../../components/GroupStorageCategoryView';
import { GroupScopeNavProvider } from '../../../../../../components/groupScope/GroupScopeNavContext';
import { firstSearchParam } from '../../../../../../utils/navigationReturn';

export default function EventsTabGroupStorageCategoryScreen() {
  const params = useLocalSearchParams<{ id: string; category: string }>();
  const groupId = firstSearchParam(params.id);
  const category = firstSearchParam(params.category);
  if (!groupId || !category) return null;
  return (
    <GroupScopeNavProvider>
      <GroupStorageCategoryView groupId={groupId} category={category} />
    </GroupScopeNavProvider>
  );
}
