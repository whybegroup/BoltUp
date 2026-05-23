import { Redirect, useLocalSearchParams } from 'expo-router';
import { firstSearchParam } from '../../utils/navigationReturn';

/** Legacy modal route — redirects into the Events tab stack. */
export default function EventDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const eventId = firstSearchParam(params.id);
  if (!eventId) {
    return <Redirect href="/(tabs)/events" />;
  }
  return <Redirect href={`/(tabs)/events/${eventId}`} />;
}
