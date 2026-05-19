import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupForumView } from '../../../../components/GroupForumView';
import { useCurrentUserContext } from '../../../../contexts/CurrentUserContext';
import { useOrderedSwitcherGroups } from '../../../../hooks/useOrderedSwitcherGroups';
import { firstSearchParam } from '../../../../utils/navigationReturn';

export default function GroupForumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const { userId: currentUserId } = useCurrentUserContext();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { orderedSwitcherGroups } = useOrderedSwitcherGroups(currentUserId ?? '');

  const onSwitchGroup = useCallback(
    (nextId: string) => {
      const rt = firstSearchParam(params.returnTo);
      const q = rt ? `?returnTo=${encodeURIComponent(rt)}` : '';
      router.replace(`/(tabs)/groups/${nextId}/forum${q}`);
    },
    [router, params.returnTo]
  );

  if (!groupId) {
    return null;
  }

  return (
    <GroupForumView
      groupId={groupId}
      orderedSwitcherGroups={orderedSwitcherGroups}
      onSwitchGroup={onSwitchGroup}
    />
  );
}
