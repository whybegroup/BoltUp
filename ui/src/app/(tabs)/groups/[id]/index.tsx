import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupDetailView } from '../../../../components/GroupDetailView';
import { useCurrentUserContext } from '../../../../contexts/CurrentUserContext';
import { useOrderedSwitcherGroups } from '../../../../hooks/useOrderedSwitcherGroups';
import { firstSearchParam, parseReturnToParam } from '../../../../utils/navigationReturn';

export default function GroupsTabGroupDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const { userId: currentUserId } = useCurrentUserContext();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const returnToHref = parseReturnToParam(firstSearchParam(params.returnTo));

  const { orderedSwitcherGroups } = useOrderedSwitcherGroups(currentUserId ?? '');

  const onSwitchGroup = useCallback(
    (nextId: string) => {
      const rt = firstSearchParam(params.returnTo);
      const q = rt ? `?returnTo=${encodeURIComponent(rt)}` : '';
      router.replace(`/(tabs)/groups/${nextId}${q}`);
    },
    [router, params.returnTo]
  );

  if (!groupId) {
    return null;
  }

  return (
    <GroupDetailView
      groupId={groupId}
      returnToHref={returnToHref}
      orderedSwitcherGroups={orderedSwitcherGroups}
      onSwitchGroup={onSwitchGroup}
    />
  );
}
