import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PollDetailScreen } from '../../components/PollDetailScreen';
import { firstSearchParam } from '../../utils/navigationReturn';

export default function PollModalRoute() {
  const { id: rawId, returnTo } = useLocalSearchParams<{ id?: string | string[]; returnTo?: string | string[] }>();
  const pollId = useMemo(() => firstSearchParam(rawId), [rawId]);
  const returnToParam = useMemo(() => firstSearchParam(returnTo), [returnTo]);
  if (!pollId) return null;
  return <PollDetailScreen variant="modal" pollId={pollId} returnToParam={returnToParam} />;
}
