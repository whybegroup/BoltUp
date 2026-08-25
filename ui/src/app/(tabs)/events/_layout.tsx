import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { EventScopeChrome } from '../../../components/eventsScope/EventScopeChrome';
import { EventsTabNavBridge } from '../../../components/eventsScope/EventsTabNavBridge';
import { EventScopeNavProvider, useEventScopeNav } from '../../../components/eventsScope/EventScopeNavContext';
import { useEventSubpage } from '../../../components/eventsScope/useEventSubpage';
import { useEventsTabParentNavigation } from '../../../components/eventsScope/useEventsTabParentNavigation';

function EventsTabLayoutInner() {
  const subpage = useEventSubpage();
  const { optimisticAllEvents, setOptimisticAllEvents, fromEventId } = useEventScopeNav();

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
