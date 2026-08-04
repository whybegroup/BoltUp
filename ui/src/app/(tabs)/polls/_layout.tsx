import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { PollScopeChrome } from '../../../components/pollsScope/PollScopeChrome';
import { PollsTabNavBridge } from '../../../components/pollsScope/PollsTabNavBridge';
import { PollScopeNavProvider, usePollScopeNav } from '../../../components/pollsScope/PollScopeNavContext';
import { pollIdFromPollsTabPathname } from '../../../components/pollsScope/pollIdFromPathname';
import { usePollsTabParentNavigation } from '../../../components/pollsScope/usePollsTabParentNavigation';
import { CreateOrJoinButton } from '../../../components/CreateOrJoinButton';
import { useGroups } from '../../../hooks/api';
import { useCurrentUserContext } from '../../../contexts/CurrentUserContext';

function PollsTabLayoutInner() {
  const pathname = usePathname();
  const pathnamePollId = pollIdFromPollsTabPathname(pathname);
  const { optimisticAllPolls, setOptimisticAllPolls } = usePollScopeNav();
  const chromePollId = optimisticAllPolls ? null : pathnamePollId;
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: allGroups = [] } = useGroups(currentUserId ?? '', true);
  const eventEligibleGroupCount = useMemo(
    () =>
      allGroups.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroups]
  );

  usePollsTabParentNavigation();

  useEffect(() => {
    if (pathnamePollId) {
      setOptimisticAllPolls(false);
    }
  }, [pathnamePollId, setOptimisticAllPolls]);

  return (
    <View style={styles.root}>
      <PollsTabNavBridge />
      <PollScopeChrome pollId={chromePollId} />
      <View style={styles.stack}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { flex: 1, backgroundColor: Colors.bg },
          }}
        />
      </View>
      <CreateOrJoinButton
        userId={currentUserId}
        eventEligibleGroupCount={eventEligibleGroupCount}
        mode="poll"
      />
    </View>
  );
}

export default function PollsTabLayout() {
  return (
    <PollScopeNavProvider>
      <PollsTabLayoutInner />
    </PollScopeNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stack: { flex: 1, minHeight: 0 },
});
