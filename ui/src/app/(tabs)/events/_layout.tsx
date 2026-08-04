import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { EventScopeChrome } from '../../../components/eventsScope/EventScopeChrome';
import { EventsTabNavBridge } from '../../../components/eventsScope/EventsTabNavBridge';
import { EventScopeNavProvider, useEventScopeNav } from '../../../components/eventsScope/EventScopeNavContext';
import { eventIdFromEventsTabPathname } from '../../../components/eventsScope/eventIdFromPathname';
import { useEventsTabParentNavigation } from '../../../components/eventsScope/useEventsTabParentNavigation';
import { CreateOrJoinButton } from '../../../components/CreateOrJoinButton';
import { useGroups } from '../../../hooks/api';
import { useCurrentUserContext } from '../../../contexts/CurrentUserContext';

function EventsTabLayoutInner() {
  const pathname = usePathname();
  const pathnameEventId = eventIdFromEventsTabPathname(pathname);
  const { optimisticAllEvents, setOptimisticAllEvents } = useEventScopeNav();
  const chromeEventId = optimisticAllEvents ? null : pathnameEventId;
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
    if (pathnameEventId) {
      setOptimisticAllEvents(false);
    }
  }, [pathnameEventId, setOptimisticAllEvents]);

  return (
    <View style={styles.root}>
      <EventsTabNavBridge />
      <EventScopeChrome eventId={chromeEventId} />
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
        mode="event"
      />
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
