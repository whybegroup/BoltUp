import { Redirect, useLocalSearchParams } from 'expo-router';
import { firstSearchParam } from '../../utils/navigationReturn';

/** `/poll/:id` deep links open the poll in the Polls tab. */
export default function PollDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const pollId = firstSearchParam(params.id);
  if (!pollId) {
    return <Redirect href="/(tabs)/polls" />;
  }
  return <Redirect href={`/(tabs)/polls/${pollId}`} />;
}
