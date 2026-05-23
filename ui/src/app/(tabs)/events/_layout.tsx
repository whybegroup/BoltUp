import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { EventScopeChrome } from '../../../components/eventsScope/EventScopeChrome';
import { EventsTabNavBridge } from '../../../components/eventsScope/EventsTabNavBridge';
import { EventScopeNavProvider, useEventScopeNav } from '../../../components/eventsScope/EventScopeNavContext';
import { eventIdFromEventsTabPathname } from '../../../components/eventsScope/eventIdFromPathname';
import { useEventsTabParentNavigation } from '../../../components/eventsScope/useEventsTabParentNavigation';

function EventsTabLayoutInner() {
  const pathname = usePathname();
  const pathnameEventId = eventIdFromEventsTabPathname(pathname);
  const { optimisticAllEvents, setOptimisticAllEvents } = useEventScopeNav();
  const chromeEventId = optimisticAllEvents ? null : pathnameEventId;

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
