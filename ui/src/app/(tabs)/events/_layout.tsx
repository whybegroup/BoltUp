import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { EventScopeChrome } from '../../../components/eventsScope/EventScopeChrome';
import { EventsTabNavBridge } from '../../../components/eventsScope/EventsTabNavBridge';
import { EventScopeNavProvider, useEventScopeNav } from '../../../components/eventsScope/EventScopeNavContext';
import { useEventSubpage } from '../../../components/eventsScope/useEventSubpage';
import { useEventsTabParentNavigation } from '../../../components/eventsScope/useEventsTabParentNavigation';
import { CreateOrJoinButton } from '../../../components/CreateOrJoinButton';
import { useGroups } from '../../../hooks/api';
import { useCurrentUserContext } from '../../../contexts/CurrentUserContext';

function EventsTabLayoutInner() {
  const subpage = useEventSubpage();
  const { optimisticAllEvents, setOptimisticAllEvents, fromEventId } = useEventScopeNav();
  const { userId: currentUserId } = useCurrentUserContext();
  const { data: allGroups = [] } = useGroups(currentUserId ?? '', true);
  const eventEligibleGroupCount = useMemo(
    () =>
      allGroups.filter(
        (g) => !g.deletedAt && (g.membershipStatus === 'member' || g.membershipStatus === 'admin')
      ).length,
    [allGroups]
  );

  useEventsTabParentNavigation();

  useEffect(() => {
    if (subpage.kind !== 'all-events') {
      setOptimisticAllEvents(false);
    }
  }, [subpage.kind, setOptimisticAllEvents]);

  return (
    <View style={styles.root}>
      <EventsTabNavBridge />
      <EventScopeChrome 
        subpage={optimisticAllEvents ? { kind: 'all-events' } : subpage} 
        fromEventId={fromEventId}
      />
      <View style={styles.stack}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { flex: 1, backgroundColor: Colors.bg },
          }}
        />
      </View>
      {(optimisticAllEvents || subpage.kind === 'all-events') ? (
        <CreateOrJoinButton
          userId={currentUserId}
          eventEligibleGroupCount={eventEligibleGroupCount}
          mode="event"
        />
      ) : null}
    </View>
  );
}

export default function EventsTabLayout() {
  return (
    <EventScopeNavProvider>
      <EventsTabLayoutInner />
    </EventScopeNavProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  stack: { flex: 1, minHeight: 0 },
});
