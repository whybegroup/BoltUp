import { useLocalSearchParams } from 'expo-router';
import { EventGroupDetailView } from '../../../../components/EventGroupDetailView';
import { firstSearchParam } from '../../../../utils/navigationReturn';

export default function EventsTabGroupDetailRoute() {
  const params = useLocalSearchParams<{ id: string; eventId?: string | string[] }>();
  const groupId = firstSearchParam(params.id);
  const eventId = firstSearchParam(params.eventId);
  if (!groupId) return null;
  return <EventGroupDetailView groupId={groupId} eventId={eventId} />;
}
