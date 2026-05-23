import { useLocalSearchParams } from 'expo-router';
import { GroupPollDetailView } from '../../../../../components/GroupPollDetailView';

export default function GroupPollDetailRoute() {
  const params = useLocalSearchParams<{ id: string; pollId: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const pollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;
  if (!groupId || !pollId) return null;
  return <GroupPollDetailView groupId={groupId} pollId={pollId} />;
}
