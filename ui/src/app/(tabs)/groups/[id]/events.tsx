import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupEventsView } from '../../../../components/GroupEventsView';
import { useCurrentUserContext } from '../../../../contexts/CurrentUserContext';
import { useOrderedSwitcherGroups } from '../../../../hooks/useOrderedSwitcherGroups';
import { firstSearchParam } from '../../../../utils/navigationReturn';

export default function GroupEventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const { userId: currentUserId } = useCurrentUserContext();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { orderedSwitcherGroups } = useOrderedSwitcherGroups(currentUserId ?? '');

  const onSwitchGroup = useCallback(
    (nextId: string) => {
      const rt = firstSearchParam(params.returnTo);
      const q = rt ? `?returnTo=${encodeURIComponent(rt)}` : '';
      router.replace(`/(tabs)/groups/${nextId}/events${q}`);
    },
    [router, params.returnTo]
  );

  if (!groupId) {
    return null;
  }

  return (
    <GroupEventsView
      groupId={groupId}
      orderedSwitcherGroups={orderedSwitcherGroups}
      onSwitchGroup={onSwitchGroup}
    />
  );
}
