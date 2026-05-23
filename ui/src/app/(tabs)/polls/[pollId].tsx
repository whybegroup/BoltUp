import { useLocalSearchParams } from 'expo-router';
import { PollDetailScreen } from '../../../components/PollDetailScreen';
import { firstSearchParam } from '../../../utils/navigationReturn';
import { usePollScopeNav } from '../../../components/pollsScope/PollScopeNavContext';

export default function PollsTabPollDetailRoute() {
  const params = useLocalSearchParams<{ pollId: string }>();
  const pollId = firstSearchParam(params.pollId);
  const pollsTabNav = usePollScopeNav();
  if (!pollId) return null;
  return <PollDetailScreen variant="polls" pollId={pollId} pollsTabNav={pollsTabNav} />;
}
