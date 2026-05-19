import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupPollDetailView } from '../../../../../components/GroupPollDetailView';
import { useCurrentUserContext } from '../../../../../contexts/CurrentUserContext';
import { useOrderedSwitcherGroups } from '../../../../../hooks/useOrderedSwitcherGroups';
import { firstSearchParam } from '../../../../../utils/navigationReturn';

export default function GroupPollDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; pollId: string; returnTo?: string | string[] }>();
  const { userId: currentUserId } = useCurrentUserContext();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const pollId = Array.isArray(params.pollId) ? params.pollId[0] : params.pollId;

  const { orderedSwitcherGroups } = useOrderedSwitcherGroups(currentUserId ?? '');

  const onSwitchGroup = useCallback(
    (nextId: string) => {
      const rt = firstSearchParam(params.returnTo);
      const q = rt ? `?returnTo=${encodeURIComponent(rt)}` : '';
      router.replace(`/(tabs)/groups/${nextId}/polls${q}`);
    },
    [router, params.returnTo]
  );

  if (!groupId || !pollId) {
    return null;
  }

  return (
    <GroupPollDetailView
      groupId={groupId}
      pollId={pollId}
      orderedSwitcherGroups={orderedSwitcherGroups}
      onSwitchGroup={onSwitchGroup}
    />
  );
}
