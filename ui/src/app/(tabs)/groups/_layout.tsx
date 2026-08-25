import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { GroupScopeChrome } from '../../../components/groupScope/GroupScopeChrome';
import { GroupsTabNavBridge } from '../../../components/groupScope/GroupsTabNavBridge';
import { GroupScopeNavProvider, useGroupScopeNav } from '../../../components/groupScope/GroupScopeNavContext';
import { groupIdFromPathname } from '../../../components/groupScope/groupIdFromPathname';
import { useGroupsTabParentNavigation } from '../../../components/groupScope/useGroupsTabParentNavigation';

function GroupsTabLayoutInner() {
  const pathname = usePathname();
  const pathnameGroupId = groupIdFromPathname(pathname);
  const { optimisticAllGroups, setOptimisticAllGroups } = useGroupScopeNav();
  const chromeGroupId = optimisticAllGroups ? null : pathnameGroupId;

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
