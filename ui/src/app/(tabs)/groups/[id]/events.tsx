import { useLocalSearchParams } from 'expo-router';
import { GroupEventsView } from '../../../../components/GroupEventsView';

export default function GroupEventsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!groupId) return null;
  return <GroupEventsView groupId={groupId} />;
}
