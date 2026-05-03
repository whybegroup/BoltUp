import { useMemo, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GroupEventsView } from '../../../../components/GroupEventsView';
import { useGroups } from '../../../../hooks/api';
import { useCurrentUserContext } from '../../../../contexts/CurrentUserContext';
import { firstSearchParam } from '../../../../utils/navigationReturn';

export default function GroupEventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; returnTo?: string | string[] }>();
  const { userId: currentUserId } = useCurrentUserContext();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: allGroups = [] } = useGroups(currentUserId ?? '', true);
  const listGroups = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          g.membershipStatus === 'member' ||
          g.membershipStatus === 'admin' ||
          g.membershipStatus === 'pending'
      ),
    [allGroups]
  );

  const switchableGroups = useMemo(
    () =>
      listGroups
        .filter((g) => g.id !== groupId)
        .map((g) => ({ id: g.id, name: g.name })),
    [listGroups, groupId]
  );

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
      switchableGroups={switchableGroups}
      onSwitchGroup={onSwitchGroup}
    />
  );
}
