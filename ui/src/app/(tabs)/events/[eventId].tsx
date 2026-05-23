import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '../../../components/EventDetailScreen';
import { firstSearchParam } from '../../../utils/navigationReturn';
import { useEventScopeNav } from '../../../components/eventsScope/EventScopeNavContext';

export default function EventsTabEventDetailRoute() {
  const params = useLocalSearchParams<{
    eventId: string;
    commentId?: string | string[];
  }>();
  const eventId = firstSearchParam(params.eventId);
  const focusCommentId = firstSearchParam(
    Array.isArray(params.commentId) ? params.commentId[0] : params.commentId
  );
  const eventsTabNav = useEventScopeNav();
  if (!eventId) return null;
  return (
    <EventDetailScreen
      variant="events"
      eventId={eventId}
      focusCommentId={focusCommentId}
      eventsTabNav={eventsTabNav}
    />
  );
}
