import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { GroupScopeChrome } from '../../../components/groupScope/GroupScopeChrome';
import { GroupsTabNavBridge } from '../../../components/groupScope/GroupsTabNavBridge';
import { GroupScopeNavProvider, useGroupScopeNav } from '../../../components/groupScope/GroupScopeNavContext';
import { groupIdFromPathname } from '../../../components/groupScope/groupIdFromPathname';
import { useGroupsTabParentNavigation } from '../../../components/groupScope/useGroupsTabParentNavigation';
import { CreateOrJoinButton } from '../../../components/CreateOrJoinButton';
import { useGroups } from '../../../hooks/api';
import { useCurrentUserContext } from '../../../contexts/CurrentUserContext';

function GroupsTabLayoutInner() {
  const pathname = usePathname();
  const pathnameGroupId = groupIdFromPathname(pathname);
  const { optimisticAllGroups, setOptimisticAllGroups } = useGroupScopeNav();
  const chromeGroupId = optimisticAllGroups ? null : pathnameGroupId;
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: allGroups = [] } = useGroups(currentUserId ?? '', true);
  const eventEligibleGroupCount = useMemo(
    () =>
      allGroups.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroups]
  );

  useGroupsTabParentNavigation({ enabled: !pathnameGroupId });

  useEffect(() => {
    if (pathnameGroupId) {
      setOptimisticAllGroups(false);
    }
  }, [pathnameGroupId, setOptimisticAllGroups]);

  return (
    <View style={styles.root}>
      <GroupsTabNavBridge />
      <GroupScopeChrome groupId={chromeGroupId} />
      <View style={styles.stack}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { flex: 1, backgroundColor: Colors.bg },
          }}
        />
      </View>
      {!chromeGroupId ? (
        <CreateOrJoinButton
          userId={currentUserId}
          eventEligibleGroupCount={eventEligibleGroupCount}
          mode="group"
        />
      ) : null}
    </View>
  );
}

export default function GroupsTabLayout() {
  return (
    <GroupScopeNavProvider>
      <GroupsTabLayoutInner />
    </GroupScopeNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stack: { flex: 1, minHeight: 0 },
});
